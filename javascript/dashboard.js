(() => {
    "use strict";

    const CONFIG = {
        authPage: "./auth.html",
        dashboardPage: "./dashboard.html",
        businessPage: "./create-business.html",
        productsPage: "./products.html",
        storefrontPage: "./storefront.html",
        growPage: "./grow-digitally.html"
    };

    const SELECTORS = {
        sidebar: "#dashboard-sidebar",
        menuButton: "#mobile-menu-button",
        sidebarOverlay: "#sidebar-overlay",
        profileButton: "#profile-menu-button",
        profileMenu: "#profile-menu",
        logoutButtons: "#logout-button, #settings-logout-button",
        message: "#dashboard-message"
    };

    const state = {
        client: null,
        user: null,
        business: null,
        products: [],
        isLoggingOut: false,
        initialized: false
    };

    const $ = (selector, parent = document) =>
        parent.querySelector(selector);

    const $$ = (selector, parent = document) =>
        Array.from(parent.querySelectorAll(selector));

    function setText(selector, value, fallback = "") {
        const element = $(selector);

        if (element) {
            element.textContent = value ?? fallback;
        }
    }

    function showMessage(message, type = "info") {
        const element = $(SELECTORS.message);

        if (!element) {
            console[type === "error" ? "error" : "log"](message);
            return;
        }

        element.textContent = message;
        element.classList.remove("is-error", "is-success");

        if (type === "error") {
            element.classList.add("is-error");
        } else if (type === "success") {
            element.classList.add("is-success");
        }

        element.hidden = false;
        element.setAttribute(
            "role",
            type === "error" ? "alert" : "status"
        );
    }

    function hideMessage() {
        const element = $(SELECTORS.message);

        if (!element) {
            return;
        }

        element.hidden = true;
        element.textContent = "";
        element.classList.remove("is-error", "is-success");
    }

    function initials(value) {
        const words = String(value || "")
            .trim()
            .split(/\s+/)
            .filter(Boolean);

        if (!words.length) {
            return "B";
        }

        return words
            .slice(0, 2)
            .map(word => word.charAt(0).toUpperCase())
            .join("");
    }

    function formatNumber(value) {
        return new Intl.NumberFormat("en-IN").format(value);
    }

    function setButtonLabel(element, label) {
        if (!element) {
            return;
        }

        const labelElement = element.querySelector(
            "#business-primary-label, #business-secondary-label"
        );

        if (labelElement) {
            labelElement.textContent = label;
            return;
        }

        const textNode = Array.from(element.childNodes).find(
            node =>
                node.nodeType === Node.TEXT_NODE &&
                node.textContent.trim()
        );

        if (textNode) {
            textNode.textContent = ` ${label} `;
        } else {
            element.prepend(
                document.createTextNode(`${label} `)
            );
        }
    }

    function setDisabled(element, disabled) {
        if (!element) {
            return;
        }

        element.setAttribute("aria-disabled", String(disabled));

        if (disabled) {
            element.setAttribute("tabindex", "-1");
        } else {
            element.removeAttribute("tabindex");
        }
    }

    function getSupabaseClient() {
        if (window.bizoraSupabase?.auth) {
            return window.bizoraSupabase;
        }

        if (window.supabaseClient?.auth) {
            return window.supabaseClient;
        }

        return null;
    }

    function waitForSupabase(timeout = 10000) {
        return new Promise((resolve, reject) => {
            const startedAt = Date.now();

            function check() {
                const client = getSupabaseClient();

                if (client) {
                    resolve(client);
                    return;
                }

                if (Date.now() - startedAt >= timeout) {
                    reject(
                        new Error(
                            "Supabase client was not initialized. Check javascript/supabase.js."
                        )
                    );
                    return;
                }

                window.setTimeout(check, 100);
            }

            check();
        });
    }

    // Authentication

    async function verifySession() {
        const { data, error } =
            await state.client.auth.getSession();

        if (error) {
            throw error;
        }

        const session = data?.session;

        if (!session?.user) {
            window.location.replace(CONFIG.authPage);
            return false;
        }

        state.user = session.user;

        return true;
    }

    function getDisplayName(user = state.user) {
        const metadata = user?.user_metadata || {};

        return (
            metadata.full_name ||
            metadata.fullName ||
            metadata.name ||
            metadata.username ||
            user?.email?.split("@")[0] ||
            "Business owner"
        );
    }

    function renderUserDetails() {
        if (!state.user) {
            return;
        }

        const name = getDisplayName();
        const email = state.user.email || "";
        const avatar = initials(name);

        setText("#welcome-name", name);
        setText("#profile-name", name);
        setText("#profile-email", email);
        setText("#settings-name", name);
        setText("#settings-email", email);
        setText("#profile-avatar", avatar);
        setText("#settings-avatar", avatar);
    }

    // Business and products

    async function loadBusiness() {
        const { data, error } = await state.client
            .from("businesses")
            .select("*")
            .eq("owner_id", state.user.id)
            .maybeSingle();

        if (error) {
            throw error;
        }

        state.business = data || null;

        return state.business;
    }

    async function loadProducts() {
        if (!state.business?.id) {
            state.products = [];
            return [];
        }

        const { data, error } = await state.client
            .from("products")
            .select(
                "id, name, description, price, item_type, is_available, created_at"
            )
            .eq("business_id", state.business.id)
            .order("created_at", { ascending: false });

        if (error) {
            throw error;
        }

        state.products = data || [];

        return state.products;
    }

    // Dashboard business status

    function setBusinessStatus({
        label,
        title,
        description,
        primaryText,
        primaryUrl,
        secondaryText,
        secondaryUrl,
        published = false
    }) {
        setText("#business-status-label", label);
        setText("#launch-title", title);
        setText("#business-status-title", title);
        setText("#business-status-description", description);

        const indicator = $("#status-indicator");

        if (indicator) {
            indicator.classList.toggle("is-published", published);
            indicator.classList.remove("is-error");
        }

        const primary = $("#business-primary-action");
        const secondary = $("#business-secondary-action");

        if (primary) {
            setButtonLabel(primary, primaryText);
            primary.href = primaryUrl;
            primary.hidden = false;
            setDisabled(primary, false);
        }

        if (secondary) {
            setButtonLabel(secondary, secondaryText);
            secondary.href = secondaryUrl;
            secondary.hidden = !secondaryText;
            setDisabled(secondary, false);
        }
    }

    function renderBusinessStatus() {
        const business = state.business;

        if (!business) {
            setBusinessStatus({
                label: "GET STARTED",
                title: "Give your business a place online.",
                description:
                    "Create your business profile to start building your digital presence with Bizora.",
                primaryText: "Set up my business",
                primaryUrl: CONFIG.businessPage,
                secondaryText: "Explore digital tools",
                secondaryUrl: CONFIG.growPage
            });

            return;
        }

        if (!business.is_published) {
            setBusinessStatus({
                label: "PROFILE IN PROGRESS",
                title: "Your business is taking shape.",
                description:
                    "Your business profile is saved, but your public storefront is not published yet. Review your details and publish when you're ready.",
                primaryText: "Edit business profile",
                primaryUrl: CONFIG.businessPage,
                secondaryText: "Manage products",
                secondaryUrl: CONFIG.productsPage
            });

            return;
        }

        const storefrontUrl = business.slug
            ? `${CONFIG.storefrontPage}?slug=${encodeURIComponent(business.slug)}`
            : CONFIG.businessPage;

        setBusinessStatus({
            label: "BUSINESS PUBLISHED",
            title: "Your business is online.",
            description:
                "Your business profile is published. Keep your business information and listings up to date.",
            primaryText: business.slug
                ? "View storefront"
                : "Edit business profile",
            primaryUrl: storefrontUrl,
            secondaryText: "Manage products",
            secondaryUrl: CONFIG.productsPage,
            published: true
        });
    }

    // Dashboard overview

    function renderOverview() {
        const business = state.business;

        const requiredFields = [
            business?.name,
            business?.category,
            business?.description,
            business?.phone,
            business?.address
        ];

        const completedFields = requiredFields.filter(value =>
            typeof value === "string"
                ? value.trim().length > 0
                : Boolean(value)
        ).length;

        const completion = business
            ? Math.round(
                (completedFields / requiredFields.length) * 100
            )
            : 0;

        const availableProducts = state.products.filter(
            product => product.is_available
        );

        setText("#profile-completion", `${completion}%`);
        setText(
            "#profile-completion-description",
            business
                ? `${completedFields} of ${requiredFields.length} key details completed`
                : "Set up your business profile to get started"
        );

        setText(
            "#product-count",
            formatNumber(state.products.length)
        );

        setText(
            "#product-count-description",
            `${availableProducts.length} available listing${availableProducts.length === 1 ? "" : "s"}`
        );

        setText(
            "#publication-status",
            !business
                ? "Not created"
                : business.is_published
                    ? "Published"
                    : "Draft"
        );

        setText(
            "#publication-description",
            !business
                ? "Your profile hasn't been created yet"
                : business.is_published
                    ? "Your storefront is visible to customers"
                    : "Your storefront isn't public yet"
        );

        // Support alternative IDs from earlier layouts.
        setText("#business-count", business ? "1" : "0");
        setText(
            "#products-count",
            formatNumber(state.products.length)
        );
        setText(
            "#visibility-count",
            business?.is_published ? "Live" : "Not live"
        );
    }

    // Next steps

    function renderNextSteps() {
        const container = $("#next-steps-list");

        if (!container) {
            return;
        }

        const business = state.business;
        const products = state.products;
        const steps = [];

        if (!business) {
            steps.push(
                {
                    number: "01",
                    title: "Create your business profile",
                    description:
                        "Add your business name, category, contact details and description.",
                    destination: CONFIG.businessPage
                },
                {
                    number: "02",
                    title: "Add your products or services",
                    description:
                        "Show customers what your business offers.",
                    destination: CONFIG.productsPage
                },
                {
                    number: "03",
                    title: "Explore digital growth",
                    description:
                        "Learn about online visibility, digital tools and payment safety.",
                    destination: CONFIG.growPage
                }
            );
        } else {
            const requiredFields = [
                business.name,
                business.category,
                business.description,
                business.phone,
                business.address
            ];

            const hasMissingFields = requiredFields.some(value =>
                typeof value === "string"
                    ? !value.trim()
                    : !value
            );

            if (hasMissingFields) {
                steps.push({
                    number: "",
                    title: "Complete your business information",
                    description:
                        "Review your profile and fill in any missing details.",
                    destination: CONFIG.businessPage
                });
            }

            if (products.length === 0) {
                steps.push({
                    number: "",
                    title: "Add your first product or service",
                    description:
                        "Create a listing so customers can discover what you offer.",
                    destination: CONFIG.productsPage
                });
            }

            if (!business.is_published) {
                steps.push({
                    number: "",
                    title: "Get your storefront ready",
                    description:
                        "Review your business details and publish your profile when ready.",
                    destination: CONFIG.businessPage
                });
            } else {
                steps.push({
                    number: "✓",
                    title: "Your business is online",
                    description:
                        "Your storefront is published. Keep your information and listings current.",
                    destination: business.slug
                        ? `${CONFIG.storefrontPage}?slug=${encodeURIComponent(business.slug)}`
                        : CONFIG.businessPage
                });
            }

            steps.push({
                number: "",
                title: "Learn how to grow digitally",
                description:
                    "Explore online visibility, digital tools and payment safety.",
                destination: CONFIG.growPage
            });

            steps.forEach((step, index) => {
                if (!step.number) {
                    step.number = String(index + 1).padStart(2, "0");
                }
            });
        }

        container.replaceChildren();

        steps.slice(0, 4).forEach(step => {
            const link = document.createElement("a");
            link.className = "next-step";
            link.href = step.destination;

            const number = document.createElement("span");
            number.className = "step-number";
            number.textContent = step.number;

            const content = document.createElement("span");
            content.className = "step-content";

            const title = document.createElement("h3");
            title.textContent = step.title;

            const description = document.createElement("p");
            description.textContent = step.description;

            const arrow = document.createElement("span");
            arrow.className = "step-arrow";
            arrow.setAttribute("aria-hidden", "true");
            arrow.textContent = "→";

            content.append(title, description);
            link.append(number, content, arrow);
            container.append(link);
        });
    }

    // Navigation and profile menu

    function setSidebarOpen(open) {
        const sidebar = $(SELECTORS.sidebar);
        const button = $(SELECTORS.menuButton);
        const overlay = $(SELECTORS.sidebarOverlay);

        if (!sidebar) {
            return;
        }

        sidebar.classList.toggle("is-open", open);

        if (button) {
            button.setAttribute("aria-expanded", String(open));
            button.setAttribute(
                "aria-label",
                open ? "Close navigation menu" : "Open navigation menu"
            );
        }

        if (overlay) {
            overlay.hidden = !open;
        }

        document.body.classList.toggle("sidebar-open", open);
    }

    function setupMobileNavigation() {
        const button = $(SELECTORS.menuButton);
        const overlay = $(SELECTORS.sidebarOverlay);
        const sidebar = $(SELECTORS.sidebar);

        if (!sidebar) {
            return;
        }

        button?.addEventListener("click", () => {
            setSidebarOpen(!sidebar.classList.contains("is-open"));
        });

        overlay?.addEventListener("click", () => {
            setSidebarOpen(false);
        });

        $$(".workspace-nav a, .dashboard-navigation a", sidebar)
            .forEach(link => {
                link.addEventListener("click", () => {
                    setSidebarOpen(false);
                });
            });

        window.addEventListener("resize", () => {
            if (window.innerWidth > 900) {
                setSidebarOpen(false);
            }
        });
    }

    function closeProfileMenu() {
        const menu = $(SELECTORS.profileMenu);
        const button = $(SELECTORS.profileButton);

        if (menu) {
            menu.hidden = true;
        }

        button?.setAttribute("aria-expanded", "false");
    }

    function setupProfileMenu() {
        const button = $(SELECTORS.profileButton);
        const menu = $(SELECTORS.profileMenu);

        if (!button || !menu) {
            return;
        }

        button.setAttribute("aria-haspopup", "true");
        button.setAttribute("aria-expanded", "false");

        button.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();

            const open = menu.hidden;
            menu.hidden = !open;

            button.setAttribute("aria-expanded", String(open));
        });

        menu.addEventListener("click", event => {
            if (event.target.closest(SELECTORS.logoutButtons)) {
                return;
            }

            if (event.target.closest("[data-settings-link]")) {
                closeProfileMenu();
            }
        });

        document.addEventListener("click", event => {
            if (
                !menu.contains(event.target) &&
                !button.contains(event.target)
            ) {
                closeProfileMenu();
            }
        });
    }

    function setupSettingsNavigation() {
const currentFile = window.location.pathname
            .split("/")
            .pop() || "dashboard.html";

        $$(".workspace-nav-link, .dashboard-navigation .nav-item")
            .forEach(link => {
                const href = link.getAttribute("href");

                if (!href) {
                    return;
                }

                const linkFile = href
                    .split("?")[0]
                    .split("#")[0]
                    .split("/")
                    .pop();

                if (linkFile === currentFile) {
                    link.classList.add("active");
                    link.setAttribute("aria-current", "page");
                } else {
                    link.classList.remove("active");
                    link.removeAttribute("aria-current");
                }
            });
    }

    function setupGlobalKeyboardNavigation() {
        document.addEventListener("keydown", event => {
            if (event.key === "Escape") {
                setSidebarOpen(false);
                closeProfileMenu();
            }
        });
    }

    // Auth listener

    function setupAuthListener() {
        state.client.auth.onAuthStateChange((event, session) => {
            if (event === "SIGNED_OUT" && !state.isLoggingOut) {
                window.location.replace(CONFIG.authPage);
                return;
            }

            if (event === "USER_UPDATED" && session?.user) {
                state.user = session.user;
                renderUserDetails();
            }
        });
    }

    // Initialize dashboard

    async function initializeDashboard() {
        if (state.initialized) {
            return;
        }

        state.initialized = true;

        setupMobileNavigation();
        setupProfileMenu();
        setupBusinessActions();
        setupSettingsNavigation();
        setupLogout();
        setupActiveNavigation();
        setupGlobalKeyboardNavigation();

        try {
            state.client = await waitForSupabase();

            const authenticated = await verifySession();

            if (!authenticated) {
                return;
            }

            setupAuthListener();
            renderUserDetails();

            await loadDashboard();
        } catch (error) {
            console.error("Dashboard initialization error:", error);

            showMessage(
                "Bizora couldn't connect to your account. Check your internet connection and Supabase configuration, then refresh the page.",
                "error"
            );
        }
    }

    async function loadDashboard() {
        hideMessage();

        try {
            await loadBusiness();
            await loadProducts();

            renderUserDetails();
            renderBusinessStatus();
            renderOverview();
            renderNextSteps();
        } catch (error) {
            console.error("Dashboard data error:", error);

            showMessage(
                "We couldn't load your business data. Check your Supabase connection, table permissions and RLS policies, then refresh the page.",
                "error"
            );
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            initializeDashboard,
            { once: true }
        );
    } else {
        initializeDashboard();
    }
})();
     
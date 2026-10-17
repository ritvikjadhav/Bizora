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
        isLoggingOut: false
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
        element.setAttribute("role", type === "error" ? "alert" : "status");
    }

    function hideMessage() {
        const element = $(SELECTORS.message);

        if (element) {
            element.hidden = true;
            element.textContent = "";
            element.classList.remove("is-error", "is-success");
        }
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

    function formatDate(date = new Date()) {
        return new Intl.DateTimeFormat("en-IN", {
            day: "numeric",
            month: "long",
            year: "numeric"
        }).format(date);
    }

    function formatNumber(value) {
        return new Intl.NumberFormat("en-IN").format(value);
    }

    function setButtonLabel(element, label) {
        if (!element) {
            return;
        }

        const textNode = Array.from(element.childNodes).find(
            node => node.nodeType === Node.TEXT_NODE &&
                node.textContent.trim()
        );

        if (textNode) {
            textNode.textContent = ` ${label} `;
        } else {
            element.textContent = label;
        }
    }

    function setDisabled(button, disabled) {
        if (!button) {
            return;
        }

        button.disabled = disabled;
        button.setAttribute("aria-disabled", String(disabled));
    }

    function setInitialDate() {
        setText("#welcome-date", formatDate());
    }

    // =========================================
    // SUPABASE INITIALIZATION
    // =========================================

    function getSupabaseClient() {
        if (window.bizoraSupabase) {
            return window.bizoraSupabase;
        }

        if (window.supabaseClient) {
            return window.supabaseClient;
        }

        if (
            window.supabase &&
            typeof window.supabase.from === "function" &&
            window.supabase.auth
        ) {
            return window.supabase;
        }

        return null;
    }

    function waitForSupabase(timeout = 10000) {
        return new Promise((resolve, reject) => {
            const start = Date.now();

            const check = () => {
                const client = getSupabaseClient();

                if (client) {
                    resolve(client);
                    return;
                }

                if (Date.now() - start >= timeout) {
                    reject(
                        new Error(
                            "Supabase client was not initialized. Check javascript/supabase.js."
                        )
                    );
                    return;
                }

                window.setTimeout(check, 100);
            };

            check();
        });
    }

    // =========================================
    // AUTHENTICATION
    // =========================================

    async function verifySession() {
        const { data, error } = await state.client.auth.getSession();

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

    function getDisplayName(user) {
        const metadata = user?.user_metadata || {};

        const businessName = state.business?.name;

        const metadataName =
            metadata.full_name ||
            metadata.fullName ||
            metadata.name ||
            metadata.username;

        const emailName = user?.email
            ? user.email.split("@")[0]
            : "";

        return businessName || metadataName || emailName || "Business owner";
    }

    function renderUserDetails() {
        if (!state.user) {
            return;
        }

        const name = getDisplayName(state.user);
        const email = state.user.email || "";

        setText("#welcome-name", name);
        setText("#profile-name", name);
        setText("#profile-email", email);
        setText("#settings-name", name);
        setText("#settings-email", email);

        const avatar = initials(name);

        setText("#profile-avatar", avatar);
        setText("#settings-avatar", avatar);

        $$(".profile-avatar, .settings-avatar").forEach(element => {
            if (
                element.tagName === "IMG" &&
                element instanceof HTMLImageElement
            ) {
                element.alt = `${name} profile`;
            } else {
                element.setAttribute("aria-label", `${name} profile`);
            }
        });
    }

    // =========================================
    // BUSINESS DATA
    // =========================================

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
            .select("id, name, description, price, item_type, is_available")
            .eq("business_id", state.business.id)
            .order("created_at", { ascending: false });

        if (error) {
            throw error;
        }

        state.products = data || [];

        return state.products;
    }

    // =========================================
    // BUSINESS STATUS
    // =========================================

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
            primary.dataset.destination = primaryUrl;
            primary.hidden = false;
            setDisabled(primary, false);
        }

        if (secondary) {
            setButtonLabel(secondary, secondaryText);
            secondary.dataset.destination = secondaryUrl;
            secondary.hidden = !secondaryText;
        }
    }

    function renderBusinessStatus() {
        const business = state.business;

        if (!business) {
            setBusinessStatus({
                label: "GET STARTED",
                title: "Bring your business online.",
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
                    "Your business profile exists, but your public storefront is not published yet. Review your details and publish when you're ready.",
                primaryText: "Edit business profile",
                primaryUrl: CONFIG.businessPage,
                secondaryText: "Manage products",
                secondaryUrl: CONFIG.productsPage
            });

            return;
        }

        setBusinessStatus({
            label: "BUSINESS PUBLISHED",
            title: "Your business is online.",
            description:
                "Your public business profile is published. Keep your information and product listings up to date.",
            primaryText: "View storefront",
            primaryUrl: `${CONFIG.storefrontPage}?slug=${encodeURIComponent(business.slug || "")}`,
            secondaryText: "Manage products",
            secondaryUrl: CONFIG.productsPage,
            published: true
        });
    }

    // =========================================
    // DASHBOARD OVERVIEW
    // =========================================

    function renderOverview() {
        const business = state.business;

        // Business profile completion is based on actual saved fields.
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
            ? Math.round((completedFields / requiredFields.length) * 100)
            : 0;

        setText("#profile-completion", `${completion}%`);
        setText("#product-count", formatNumber(state.products.length));

        setText(
            "#publication-status",
            !business
                ? "Not created"
                : business.is_published
                    ? "Published"
                    : "Draft"
        );

        // Also support alternative IDs used by an earlier dashboard layout.
        setText("#business-count", business ? "1" : "0");
        setText("#products-count", formatNumber(state.products.length));
        setText(
            "#visibility-count",
            business?.is_published ? "Live" : "Not live"
        );
    }

    // =========================================
    // NEXT STEPS
    // =========================================

    function renderNextSteps() {
        const container = $("#next-steps-list");

        if (!container) {
            return;
        }

        const business = state.business;
        const products = state.products;

        const steps = [];

        if (!business) {
            steps.push({
                number: "01",
                title: "Create your business profile",
                description:
                    "Add your business name, category, contact details and description.",
                destination: CONFIG.businessPage
            });

            steps.push({
                number: "02",
                title: "Add your products or services",
                description:
                    "Show customers what your business offers.",
                destination: CONFIG.productsPage
            });

            steps.push({
                number: "03",
                title: "Explore digital growth",
                description:
                    "Learn about UPI safety, digital tools and online visibility.",
                destination: CONFIG.growPage
            });
        } else {
            const requiredFields = [
                business.name,
                business.category,
                business.description,
                business.phone,
                business.address
            ];

            const missingFields = requiredFields.some(value =>
                typeof value === "string"
                    ? !value.trim()
                    : !value
            );

            if (missingFields) {
                steps.push({
                    number: "01",
                    title: "Complete your business information",
                    description:
                        "Review your profile and fill in any missing details.",
                    destination: CONFIG.businessPage
                });
            }

            if (products.length === 0) {
                steps.push({
                    number: steps.length ? "02" : "01",
                    title: "Add your first product or service",
                    description:
                        "Create a listing so customers can discover what you offer.",
                    destination: CONFIG.productsPage
                });
            }

            if (!business.is_published) {
                steps.push({
                    number: String(steps.length + 1).padStart(2, "0"),
                    title: "Get your storefront ready",
                    description:
                        "Review your business details and publish your profile when ready.",
                    destination: CONFIG.businessPage
                });
            }

            steps.push({
                number: String(steps.length + 1).padStart(2, "0"),
                title: "Learn how to grow digitally",
                description:
                    "Explore online visibility, digital tools and payment safety.",
                destination: CONFIG.growPage
            });

            if (business.is_published && products.length > 0) {
                steps.unshift({
                    number: "✓",
                    title: "Your business is online",
                    description:
                        "Your storefront is published. Keep your information and listings current.",
                    destination: CONFIG.storefrontPage
                });
            }
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

    // =========================================
    // LOAD DASHBOARD
    // =========================================

    async function loadDashboard() {
        hideMessage();

        try {
            await loadBusiness();
            renderUserDetails();
            renderBusinessStatus();

            await loadProducts();

            renderOverview();
            renderNextSteps();
            renderUserDetails();
        } catch (error) {
            console.error("Dashboard data error:", error);

            showMessage(
                "We couldn't load all your business data. Check your connection and Supabase permissions, then refresh the page.",
                "error"
            );
        }
    }

    // =========================================
    // MOBILE SIDEBAR
    // =========================================

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

        $$(".dashboard-navigation a", sidebar).forEach(link => {
            link.addEventListener("click", () => {
                setSidebarOpen(false);
            });
        });

        document.addEventListener("keydown", event => {
            if (event.key === "Escape") {
                setSidebarOpen(false);
                closeProfileMenu();
            }
        });

        window.addEventListener("resize", () => {
            if (window.innerWidth > 900) {
                setSidebarOpen(false);
            }
        });
    }

    // =========================================
    // PROFILE MENU
    // =========================================

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
    event.stopPropagation();

            const open = menu.hidden;

            menu.hidden = !open;
            button.setAttribute("aria-expanded", String(open));
        });

        menu.addEventListener("click", event => {
            event.stopPropagation();
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

    // =========================================
    // DASHBOARD BUTTONS
    // =========================================

    function setupBusinessActions() {
        const primary = $("#business-primary-action");
        const secondary = $("#business-secondary-action");

        primary?.addEventListener("click", () => {
            const destination = primary.dataset.destination;

            if (destination) {
                window.location.href = destination;
            }
        });

        secondary?.addEventListener("click", () => {
            const destination = secondary.dataset.destination;

            if (destination) {
                window.location.href = destination;
            }
        });

        // Support a manual refresh button if the HTML includes one.
        $("#refresh-dashboard")?.addEventListener("click", loadDashboard);
    }

    function setupSettingsNavigation() {
        const settingsLink = $("#settings-link");

        settingsLink?.addEventListener("click", event => {
            const settings = $("#settings");

            if (!settings) {
                return;
            }

            event.preventDefault();
            settings.scrollIntoView({
                behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
                    ? "auto"
                    : "smooth",
                block: "start"
            });

            history.replaceState(null, "", "#settings");
            setSidebarOpen(false);
        });
    }

    // =========================================
    // LOGOUT
    // =========================================

    async function logout() {
        if (state.isLoggingOut) {
            return;
        }

        state.isLoggingOut = true;

        const buttons = $$(SELECTORS.logoutButtons);
        const originalLabels = buttons.map(button => button.textContent);

        buttons.forEach(button => {
            setDisabled(button, true);
            button.textContent = "Signing out…";
        });

        try {
            const { error } = await state.client.auth.signOut();

            if (error) {
                throw error;
            }

            window.location.replace(CONFIG.authPage);
        } catch (error) {
            console.error("Logout error:", error);

            state.isLoggingOut = false;

            buttons.forEach((button, index) => {
                setDisabled(button, false);
                button.textContent = originalLabels[index];
            });

            showMessage(
                "We couldn't sign you out. Please try again.",
                "error"
            );
        }
    }

    function setupLogout() {
        $$(SELECTORS.logoutButtons).forEach(button => {
            button.addEventListener("click", event => {
                event.preventDefault();
                logout();
            });
        });
    }

    // =========================================
    // ACTIVE NAVIGATION
    // =========================================

    function setupActiveNavigation() {
        const currentFile = window.location.pathname
            .split("/")
            .pop() || "dashboard.html";

        $$(".dashboard-navigation .nav-item").forEach(link => {
            const href = link.getAttribute("href");

            if (!href) {
                return;
            }

            const linkFile = href.split("#")[0].split("/").pop();

            if (linkFile === currentFile) {
                link.classList.add("active");
                link.setAttribute("aria-current", "page");
            } else {
                link.classList.remove("active");
                link.removeAttribute("aria-current");
            }
        });
    }

    // =========================================
    // AUTH STATE CHANGES
    // =========================================

    function setupAuthListener() {
        state.client.auth.onAuthStateChange((event, session) => {
            if (event === "SIGNED_OUT" && !state.isLoggingOut) {
                window.location.replace(CONFIG.authPage);
                return;
            }

            if (
                event === "USER_UPDATED" &&
                session?.user
            ) {
                state.user = session.user;
                renderUserDetails();
            }
        });
    }

    // =========================================
    // INITIALIZE
    // =========================================

    async function initializeDashboard() {
        setInitialDate();

        setupMobileNavigation();
        setupProfileMenu();
        setupBusinessActions();
        setupSettingsNavigation();
        setupLogout();
        setupActiveNavigation();

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
                "Bizora couldn't connect to your account. Check your internet connection and Supabase configuration.",
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
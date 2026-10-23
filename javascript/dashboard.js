(() => {
    "use strict";

    const CONFIG = {
        brandName: "Bizvero",
        authPage: "./auth.html",
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
        initialized: false,
        authSubscription: null
    };

    const $ = (selector, parent = document) =>
        parent.querySelector(selector);

    const $$ = (selector, parent = document) =>
        Array.from(parent.querySelectorAll(selector));

    // --------------------------------------------------
    // DOM HELPERS
    // --------------------------------------------------

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

        if (!element) return;

        element.hidden = true;
        element.textContent = "";
        element.classList.remove("is-error", "is-success");
    }

    function initials(value) {
        const words = String(value || "")
            .trim()
            .split(/\s+/)
            .filter(Boolean);

        return words.length
            ? words.slice(0, 2)
                .map(word => word.charAt(0).toUpperCase())
                .join("")
            : "B";
    }

    function formatNumber(value) {
        return new Intl.NumberFormat("en-IN").format(
            Number(value) || 0
        );
    }

    function setButtonLabel(element, label) {
        if (!element) return;

        const labelElement = element.querySelector(
            "#business-primary-label, #business-secondary-label"
        );

        if (labelElement) {
            labelElement.textContent = label || "";
            return;
        }

        const textNode = Array.from(element.childNodes).find(
            node =>
                node.nodeType === Node.TEXT_NODE &&
                node.textContent.trim()
        );

        if (textNode) {
            textNode.textContent = ` ${label || ""} `;
        } else if (label) {
            element.prepend(
                document.createTextNode(`${label} `)
            );
        }
    }

    // --------------------------------------------------
    // SUPABASE
    // --------------------------------------------------

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
                            "Supabase client unavailable. Check javascript/supabase.js and script loading order."
                        )
                    );
                    return;
                }

                window.setTimeout(check, 100);
            }

            check();
        });
    }

    // --------------------------------------------------
    // AUTHENTICATION
    // --------------------------------------------------

async function verifySession() {
const { data, error } =
await state.client.auth.getSession();

if (error) {
    throw error;
}

let session = data?.session;

// If a session wasn't immediately available, allow Supabase
// a short period to restore it before redirecting.
if (!session) {
    session = await new Promise((resolve, reject) => {
        let finished = false;

        const timeout = window.setTimeout(() => {
            if (finished) return;

            finished = true;
            subscription?.unsubscribe();
            resolve(null);
        }, 3000);

        let subscription;

        const result = state.client.auth.onAuthStateChange(
            (event, updatedSession) => {
                if (finished) return;

                if (
                    updatedSession?.user &&
                    (
                        event === "INITIAL_SESSION" ||
                        event === "SIGNED_IN" ||
                        event === "TOKEN_REFRESHED"
                    )
                ) {
                    finished = true;
                    window.clearTimeout(timeout);
                    subscription?.unsubscribe();
                    resolve(updatedSession);
                }
            }
        );

        subscription = result?.data?.subscription;

        // Check again in case session restoration completed
        // while the listener was being registered.
        state.client.auth.getSession().then(({ data: latest }) => {
            if (finished || !latest?.session?.user) return;

            finished = true;
            window.clearTimeout(timeout);
            subscription?.unsubscribe();
            resolve(latest.session);
        }).catch(error => {
            if (finished) return;

            finished = true;
            window.clearTimeout(timeout);
            subscription?.unsubscribe();
            reject(error);
        });
    });
}

if (!session?.user) {
    window.location.replace(CONFIG.authPage);
    return false;
}

state.user = session.user;

return true;

}

    // --------------------------------------------------
    // BUSINESS DATA
    // --------------------------------------------------

    async function loadBusiness() {
        const { data, error } = await state.client
            .from("businesses")
            .select("*")
            .eq("owner_id", state.user.id)
            .maybeSingle();

        if (error) throw error;

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

        if (error) throw error;

        state.products = data || [];

        return state.products;
    }

    // --------------------------------------------------
    // BUSINESS STATUS
    // --------------------------------------------------

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
            indicator.classList.toggle(
                "is-published",
                published
            );
            indicator.classList.remove("is-error");
        }

        const primary = $("#business-primary-action");
        const secondary = $("#business-secondary-action");

        if (primary) {
            setButtonLabel(primary, primaryText);
            primary.href = primaryUrl || CONFIG.businessPage;
            primary.hidden = false;
            primary.removeAttribute("aria-disabled");
            primary.removeAttribute("tabindex");
        }

        if (secondary) {
            setButtonLabel(secondary, secondaryText);
            secondary.href = secondaryUrl || "#";
            secondary.hidden = !secondaryText;

            secondary.removeAttribute("aria-disabled");
            secondary.removeAttribute("tabindex");
        }
    }

    function getStorefrontUrl(business) {
        if (!business?.slug) {
            return CONFIG.businessPage;
        }

        return (
            `${CONFIG.storefrontPage}?slug=` +
            encodeURIComponent(business.slug)
        );
    }

    function renderBusinessStatus() {
        const business = state.business;

        if (!business) {
            setBusinessStatus({
                label: "GET STARTED",
                title: "Give your business a place online.",
                description:
                    "Create your business profile to start building your digital presence with Bizvero.",
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

        setBusinessStatus({
            label: "BUSINESS PUBLISHED",
            title: "Your business is online.",
            description:
                "Your business profile is published. Keep your information and listings up to date.",
            primaryText: business.slug
                ? "View storefront"
                : "Edit business profile",
            primaryUrl: getStorefrontUrl(business),
            secondaryText: "Manage products",
            secondaryUrl: CONFIG.productsPage,
            published: true
        });
    }

    // --------------------------------------------------
    // OVERVIEW STATISTICS
    // --------------------------------------------------

    function getRequiredBusinessFields(business) {
        return [
            business?.name,
            business?.category,
            business?.description,
            business?.phone,
            business?.address
        ];
    }

    function isFieldComplete(value) {
        if (typeof value === "string") {
            return value.trim().length > 0;
        }

        return Boolean(value);
    }

    function renderOverview() {
        const business = state.business;
        const requiredFields =
            getRequiredBusinessFields(business);

        const completedFields =
            requiredFields.filter(isFieldComplete).length;

        const completion = business
            ? Math.round(
                (completedFields / requiredFields.length) * 100
            )
            : 0;

        const availableProducts = state.products.filter(
            product => product.is_available === true
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
            `${availableProducts.length} available listing` +
            `${availableProducts.length === 1 ? "" : "s"}`
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

    // --------------------------------------------------
    // NEXT STEPS
    // --------------------------------------------------

    function renderNextSteps() {
        const container = $("#next-steps-list");

        if (!container) return;

        const business = state.business;
        const products = state.products;
        const steps = [];

        if (!business) {
            steps.push(
                {
                    title: "Create your business profile",
                    description:
                        "Add your business name, category, contact details and description.",
                    destination: CONFIG.businessPage
                },
                {
                    title: "Add your products or services",
                    description:
                        "Show customers what your business offers.",
                    destination: CONFIG.productsPage
                },
                {
                    title: "Explore digital growth",
                    description:
                        "Learn about online visibility, digital tools and payment safety.",
                    destination: CONFIG.growPage
                }
            );
        } else {
            const missingFields =
                getRequiredBusinessFields(business)
                    .some(value => !isFieldComplete(value));

            if (missingFields) {
                steps.push({
                    title: "Complete your business information",
                    description:
                        "Review your profile and fill in any missing details.",
                    destination: CONFIG.businessPage
                });
            }

            if (products.length === 0) {
                steps.push({
                    title: "Add your first product or service",
                    description:
                        "Create a listing so customers can discover what you offer.",
                    destination: CONFIG.productsPage
                });
            }

            if (!business.is_published) {
                steps.push({
                    title: "Get your storefront ready",
                    description:
                        "Review your business details and publish your profile when ready.",
                    destination: CONFIG.businessPage
                });
            } else {
                steps.push({
                    title: "Your business is online",
                    description:
                        "Your storefront is published. Keep your information and listings current.",
                    destination: getStorefrontUrl(business),
                    completed: true
                });
            }

            steps.push({
                title: "Learn how to grow digitally",
                description:
                    "Explore online visibility, digital tools and payment safety.",
                destination: CONFIG.growPage
            });
        }

        container.replaceChildren();

        steps.slice(0, 4).forEach((step, index) => {
            const link = document.createElement("a");
            link.className = "next-step";
            link.href = step.destination;

            const number = document.createElement("span");
            number.className = "step-number";
            number.textContent = step.completed
                ? "✓"
                : String(index + 1).padStart(2, "0");

            const content = document.createElement("span");
            content.className = "step-content";

            const title = document.createElement("h3");
            title.textContent = step.title;

            const description = document.createElement("p");
            description.textContent = step.description;

            const arrow = document.createElement("span");
            arrow.className = "step-arrow";
            arrow.setAttribute("aria-hidden", "true");
            arrow.textContent = step.completed ? "✓" : "→";

            content.append(title, description);
            link.append(number, content, arrow);
            container.append(link);
        });
    }

    // --------------------------------------------------
    // MOBILE NAVIGATION
    // --------------------------------------------------

    function setSidebarOpen(open) {
        const sidebar = $(SELECTORS.sidebar);
        const button = $(SELECTORS.menuButton);
        const overlay = $(SELECTORS.sidebarOverlay);

        if (!sidebar) return;

        sidebar.classList.toggle("is-open", open);

        button?.setAttribute("aria-expanded", String(open));
        button?.setAttribute(
            "aria-label",
            open ? "Close navigation menu" : "Open navigation menu"
        );

        if (overlay) {
            overlay.hidden = !open;
        }

        document.body.classList.toggle("sidebar-open", open);
    }

    function setupMobileNavigation() {
        const button = $(SELECTORS.menuButton);
        const overlay = $(SELECTORS.sidebarOverlay);
        const sidebar = $(SELECTORS.sidebar);

        if (!sidebar) return;

        button?.addEventListener("click", () => {
            setSidebarOpen(
                !sidebar.classList.contains("is-open")
            );
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

    // --------------------------------------------------
    // PROFILE DROPDOWN
    // --------------------------------------------------

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

        if (!button || !menu) return;

        button.setAttribute("aria-haspopup", "true");
        button.setAttribute("aria-expanded", "false");

        button.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();

            const open = menu.hidden;
            menu.hidden = !open;

            button.setAttribute("aria-expanded", String(open));
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

    // --------------------------------------------------
    // SETTINGS NAVIGATION
    // --------------------------------------------------

    function setupSettingsNavigation() {
        $$("[data-settings-link]").forEach(link => {
            link.addEventListener("click", event => {
                const target = $("#account-settings");

                if (!target) return;

                event.preventDefault();

                closeProfileMenu();
                setSidebarOpen(false);

                target.scrollIntoView({
                    behavior: window.matchMedia(
                        "(prefers-reduced-motion: reduce)"
                    ).matches ? "auto" : "smooth",
                    block: "start"
                });
            });
        });
    }

    // --------------------------------------------------
    // BUSINESS ACTIONS
    // --------------------------------------------------

    function setupBusinessActions() {
        [
            $("#business-primary-action"),
            $("#business-secondary-action")
        ].filter(Boolean).forEach(link => {
            link.addEventListener("click", event => {
                if (link.hidden) {
                    event.preventDefault();
                }
            });
        });
    }

    // --------------------------------------------------
    // LOGOUT
    // --------------------------------------------------

    async function logout() {
        if (state.isLoggingOut || !state.client) return;

        state.isLoggingOut = true;

        const buttons = $$(SELECTORS.logoutButtons);

        buttons.forEach(button => {
            button.setAttribute("aria-disabled", "true");

            if ("disabled" in button) {
                button.disabled = true;
            }
        });

        try {
            const { error } =
                await state.client.auth.signOut();

            if (error) throw error;

            window.location.replace(CONFIG.authPage);
        } catch (error) {
            console.error("Logout error:", error);

            state.isLoggingOut = false;

            buttons.forEach(button => {
                button.removeAttribute("aria-disabled");

                if ("disabled" in button) {
                    button.disabled = false;
                }
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

    // --------------------------------------------------
    // ACTIVE NAVIGATION
    // --------------------------------------------------

    function setupActiveNavigation() {
        const currentFile =
            window.location.pathname.split("/").pop() ||
            "dashboard.html";

        $$(".workspace-nav-link, .dashboard-navigation .nav-item")
            .forEach(link => {
                const href = link.getAttribute("href");

                if (!href) return;

                let linkFile = "";

                try {
                    linkFile = new URL(
                        href,
                        window.location.href
                    ).pathname.split("/").pop();
                } catch {
                    return;
                }

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

    // --------------------------------------------------
    // DASHBOARD LOADING
    // --------------------------------------------------

    async function loadDashboard() {
        hideMessage();

        // Load business information first.
        try {
            await loadBusiness();
        } catch (error) {
            console.error("Business data error:", error);

            showMessage(
                "We couldn't load your business profile. Check your Supabase connection, table permissions and RLS policies.",
                "error"
            );

            return;
        }

        // Render the business information even if products fail.
        renderUserDetails();
        renderBusinessStatus();

        try {
            await loadProducts();
        } catch (error) {
            console.error("Product data error:", error);

            state.products = [];

            showMessage(
                "Your business profile loaded, but products couldn't be loaded. Check your products table permissions and RLS policies.",
                "error"
            );
        }

        renderOverview();
        renderNextSteps();
    }
// --------------------------------------------------
    // INITIALIZATION
    // --------------------------------------------------

    async function initializeDashboard() {
        if (state.initialized) return;

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

            if (!authenticated) return;

            setupAuthListener();
            renderUserDetails();

            await loadDashboard();
        } catch (error) {
            console.error(
                "Dashboard initialization error:",
                error
            );

            showMessage(
                `${CONFIG.brandName} couldn't connect to your account. Check your internet connection and Supabase configuration, then refresh the page.`,
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
"use strict";

/* =========================
BIZVERO — MAIN SCRIPT
========================= */

document.addEventListener("DOMContentLoaded", () => {
initMobileNavigation();
initFooterYear();
initAnchorNavigation();
initSessionAwareNavigation();
});

/* =========================
SESSION-AWARE NAVIGATION
========================= */

function initSessionAwareNavigation() {
const client = window.bizoraSupabase;

if (!client?.auth) {
    console.warn(
        "Bizvero: Supabase client unavailable on homepage."
    );
    return;
}

const authLinks = document.querySelectorAll(
    'a[href="./auth.html"], a[href="auth.html"], a[href$="/auth.html"]'
);

let navigationStarted = false;

async function handleExistingSession() {
    if (navigationStarted) return;

    try {
        const { data, error } = await client.auth.getSession();

        if (error) {
            console.error(
                "Bizvero: Could not check the current session.",
                error
            );
            return;
        }

        const user = data?.session?.user;

        if (!user || navigationStarted) return;

        navigationStarted = true;

        const { data: business, error: businessError } =
            await client
                .from("businesses")
                .select("id")
                .eq("owner_id", user.id)
                .maybeSingle();

        if (businessError) {
            console.error(
                "Bizvero: Could not load the business profile.",
                businessError
            );

            navigationStarted = false;
            return;
        }

        window.location.replace(
            business
                ? "./dashboard.html"
                : "./create-business.html"
        );
    } catch (error) {
        navigationStarted = false;

        console.error(
            "Bizvero: Homepage session check failed.",
            error
        );
    }
}

// If a visitor clicks a link to sign in, check whether
// they already have an active session before navigating.
authLinks.forEach((link) => {
    link.addEventListener("click", async (event) => {
        event.preventDefault();

        await handleExistingSession();

        if (!navigationStarted) {
            window.location.href = link.href;
        }
    });
});

// Returning signed-in users can go straight to their workspace.
handleExistingSession();

}

/* =========================
MOBILE NAVIGATION
========================= */

function initMobileNavigation() {
const menuToggle = document.getElementById("menu-toggle");
const navigation = document.getElementById("primary-navigation");

if (!menuToggle || !navigation) return;

const closeMenu = () => {
    navigation.classList.remove("is-open");
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "Open navigation");
};

const openMenu = () => {
    navigation.classList.add("is-open");
    menuToggle.setAttribute("aria-expanded", "true");
    menuToggle.setAttribute("aria-label", "Close navigation");
};

menuToggle.addEventListener("click", () => {
    const isOpen =
        menuToggle.getAttribute("aria-expanded") === "true";

    if (isOpen) {
        closeMenu();
    } else {
        openMenu();
    }
});

navigation.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeMenu);
});

document.addEventListener("click", (event) => {
    if (
        navigation.classList.contains("is-open") &&
        !navigation.contains(event.target) &&
        !menuToggle.contains(event.target)
    ) {
        closeMenu();
    }
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        closeMenu();
        menuToggle.focus();
    }
});

const desktopQuery = window.matchMedia("(min-width: 761px)");

desktopQuery.addEventListener("change", (event) => {
    if (event.matches) {
        closeMenu();
    }
});

}

/* =========================
FOOTER YEAR
========================= */

function initFooterYear() {
const yearElement = document.getElementById("current-year");

if (yearElement) {
    yearElement.textContent = new Date().getFullYear();
}

}

/* =========================
ANCHOR NAVIGATION
========================= */

function initAnchorNavigation() {
const internalLinks = document.querySelectorAll('a[href^="#"]');

internalLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
        const targetId = link.getAttribute("href");

        if (!targetId || targetId === "#") return;

        const target = document.getElementById(targetId.slice(1));

        if (!target) return;

        event.preventDefault();

        target.scrollIntoView({
            behavior: window.matchMedia(
                "(prefers-reduced-motion: reduce)"
            ).matches
                ? "auto"
                : "smooth",
            block: "start"
        });

        if (window.location.hash !== targetId) {
            history.replaceState(null, "", targetId);
        }
    });
});

}
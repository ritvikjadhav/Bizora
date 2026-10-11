"use strict";

/* =========================
   BIZORA — MAIN SCRIPT
========================= */

document.addEventListener("DOMContentLoaded", () => {
    initMobileNavigation();
    initFooterYear();
    initAnchorNavigation();
});


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
        const isOpen = menuToggle.getAttribute("aria-expanded") === "true";

        if (isOpen) {
            closeMenu();
        } else {
            openMenu();
        }
    });

    // Close after selecting a navigation link.
    navigation.querySelectorAll("a").forEach((link) => {
        link.addEventListener("click", closeMenu);
    });

    // Close when clicking outside the mobile menu.
    document.addEventListener("click", (event) => {
        if (
            navigation.classList.contains("is-open") &&
            !navigation.contains(event.target) &&
            !menuToggle.contains(event.target)
        ) {
            closeMenu();
        }
    });

    // Close the menu with Escape.
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeMenu();
            menuToggle.focus();
        }
    });

    // Reset mobile navigation when returning to desktop layout.
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

            // Leave normal browser behaviour if the target doesn't exist.
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

            // Keep the URL in sync without adding history entries.
            if (window.location.hash !== targetId) {
                history.replaceState(null, "", targetId);
            }
        });
    });
}

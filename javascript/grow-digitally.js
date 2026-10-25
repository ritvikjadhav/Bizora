/* =========================================================
   BIZVERO — GROW DIGITALLY
   Sales ideas, digital tools, UPI safety and navigation
   Lightweight JavaScript — no external API required
   ========================================================= */

(() => {
  "use strict";

  /* =======================================================
     HELPERS
  ======================================================= */

  const $ = (selector, parent = document) =>
    parent.querySelector(selector);

  const $$ = (selector, parent = document) =>
    Array.from(parent.querySelectorAll(selector));

  let toastTimer;

  /* =======================================================
     TOAST NOTIFICATIONS
  ======================================================= */

  function showToast(message) {
    const toast = $("#growth-toast");

    if (!toast) {
      console.info(`[Bizvero] ${message}`);
      return;
    }

    toast.textContent = message;
    toast.classList.add("is-visible");

    window.clearTimeout(toastTimer);

    toastTimer = window.setTimeout(() => {
      toast.classList.remove("is-visible");
    }, 2800);
  }

  /* =======================================================
     DIGITAL TOOL FILTERS
  ======================================================= */

  function setupToolFilters() {
    const filters = $$("[data-tool-filter]");
    const cards = $$("[data-tool-category]");

    if (!filters.length || !cards.length) return;

    function applyFilter(filterButton) {
      const category = filterButton.dataset.toolFilter;

      filters.forEach((button) => {
        const active = button === filterButton;

        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", String(active));
      });

      cards.forEach((card) => {
        const categories = (card.dataset.toolCategory || "")
          .split(/\s+/)
          .filter(Boolean);

        card.hidden =
          category !== "all" && !categories.includes(category);
      });
    }

    filters.forEach((button) => {
      button.addEventListener("click", () => applyFilter(button));
    });

    const initialFilter =
      filters.find((button) =>
        button.classList.contains("is-active")
      ) || filters[0];

    applyFilter(initialFilter);
  }

  /* =======================================================
     SALES BOOSTER
  ======================================================= */

  const salesIdeas = {
    bundles: {
      title: "Create a useful bundle",
      description:
        "Combine two complementary products or services into one " +
        "simple offer. For example, a tea seller could offer tea " +
        "with biscuits, or a stationery shop could bundle notebooks " +
        "with pens. Show the individual prices and the bundle price " +
        "clearly, and only advertise a saving you can genuinely offer.",
      action: "Choose two related products and calculate your costs."
    },

    slow: {
      title: "Give a slow-moving product more visibility",
      description:
        "Feature one product that customers often overlook. Put it " +
        "near your best-selling item, explain its main benefit, or " +
        "include it in a relevant bundle. Avoid buying more stock " +
        "until you understand whether customers want it.",
      action:
        "Select one product and give it a clear, useful description."
    },

    repeat: {
      title: "Encourage repeat customers",
      description:
        "Remind customers about products they regularly use. A " +
        "grocery shop could share a weekly essentials list, while " +
        "a tailor could remind customers about seasonal clothing " +
        "services. Message customers only when appropriate and with " +
        "their permission.",
      action:
        "Identify one product or service customers buy regularly."
    },

    whatsapp: {
      title: "Make your WhatsApp catalogue work harder",
      description:
        "Add clear product names, current prices, useful photos " +
        "and availability information. Share a relevant catalogue " +
        "item when a customer asks about it instead of sending " +
        "a long list of unrelated products.",
      action: "Update three important catalogue items today."
    },

    visibility: {
      title: "Help nearby customers discover you",
      description:
        "Keep your business name, address, opening hours and phone " +
        "number consistent across your online profiles. Add genuine " +
        "photos and explain what makes your products or services " +
        "useful to local customers.",
      action:
        "Check your business details on your main online profile."
    },

    pricing: {
      title: "Review your pricing before offering a discount",
      description:
        "Calculate the product cost, packaging, delivery and other " +
        "relevant expenses before reducing your price. A bundle or " +
        "helpful add-on may provide more value than a large discount.",
      action:
        "Work out your minimum acceptable selling price first."
    }
  };

  function setupSalesBooster() {
    const form = $("#sales-booster-form");
    const selector = $("#sales-booster-type");
    const result = $("#sales-booster-result");

    if (!form || !selector || !result) return;

    form.addEventListener("submit", (event) => {
      event.preventDefault();

      const idea = salesIdeas[selector.value];

      if (!idea) {
        showToast("Choose a sales idea first.");
        return;
      }

      const title = $("#sales-booster-title");
      const description = $("#sales-booster-description");
      const action = $("#sales-booster-action");

      if (title) title.textContent = idea.title;
      if (description) description.textContent = idea.description;
      if (action) action.textContent = idea.action;

      result.hidden = false;
      result.classList.add("is-visible");

      result.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
      });
    });
  }

  /* =======================================================
     COPY BUTTONS
  ======================================================= */

  async function copyText(text) {
    if (!text) {
      showToast("There is no text to copy.");
      return;
    }

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");

        textarea.value = text;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        textarea.style.opacity = "0";

        document.body.appendChild(textarea);
        textarea.select();

        const copied = document.execCommand("copy");
        textarea.remove();

        if (!copied) {
          throw new Error("Copy command failed.");
        }
      }

      showToast("Copied successfully.");
    } catch (error) {
      console.error("[Bizvero] Copy failed:", error);
      showToast("Could not copy. Please select the text manually.");
    }
  }

  function setupCopyButtons() {
    $$("[data-copy-text], [data-copy-target]").forEach((button) => {
      button.addEventListener("click", () => {
        const targetSelector = button.dataset.copyTarget;
        let target = null;

        if (targetSelector) {
          try {
            target = $(targetSelector);
          } catch (error) {
            console.warn(
              "[Bizvero] Invalid copy target selector.",
              error
            );
          }
        }

        const text = target
          ? target.innerText
          : button.dataset.copyText;

        copyText(text);
      });
    });
  }

  /* =======================================================
     PAYMENT SAFETY CHECKLIST
  ======================================================= */

  const SAFETY_STORAGE_KEY = "bizvero_upi_safety_checklist";

  function setupSafetyChecklist() {
    const checklist = $("[data-safety-checklist]");

    if (!checklist) return;

    const checkboxes = $$('input[type="checkbox"]', checklist);

    let saved = {};

    try {
      saved = JSON.parse(
        localStorage.getItem(SAFETY_STORAGE_KEY) || "{}"
      );

      if (!saved || typeof saved !== "object" ||
          Array.isArray(saved)) {
        saved = {};
      }
    } catch {
      saved = {};
    }

    checkboxes.forEach((checkbox, index) => {
      const key = checkbox.dataset.safetyItem || String(index);

      checkbox.checked = saved[key] === true;

      checkbox.addEventListener("change", () => {
        saved[key] = checkbox.checked;

        try {
          localStorage.setItem(
            SAFETY_STORAGE_KEY,
            JSON.stringify(saved)
          );
        } catch (error) {
          console.warn(
            "[Bizvero] Checklist could not be saved.",
            error
          );
        }

        updateChecklistCount();
      });
    });

    function updateChecklistCount() {
      const count = $("#safety-checklist-count");

      if (count) {
        const completed = checkboxes.filter(
          (checkbox) => checkbox.checked
        ).length;

        count.textContent =
          `${completed} of ${checkboxes.length} checked`;
      }
    }

    updateChecklistCount();
  }

  /* =======================================================
     MOBILE SIDEBAR
     Supports both:
       #dashboard-sidebar (workspace sidebar)
       #sidebar          (legacy sidebar)

     Hamburger:
       #mobile-menu-button

     Backdrop:
       #sidebar-overlay
  ======================================================= */

  function setupMobileSidebar() {
    const menuButton = $("#mobile-menu-button");

    const sidebar =
      $("#dashboard-sidebar") || $("#sidebar");

    const overlay = $("#sidebar-overlay");

    if (!sidebar || !menuButton) return;

    function setMenuOpen(open) {
      sidebar.classList.toggle("is-open", open);

      if (overlay) {
        overlay.classList.toggle("is-visible", open);
        overlay.hidden = !open;
      }

      menuButton.setAttribute(
        "aria-expanded",
        String(open)
      );

      menuButton.setAttribute(
        "aria-label",
        open ? "Close navigation" : "Open navigation"
      );

      document.body.classList.toggle("sidebar-open", open);
    }

    menuButton.addEventListener("click", () => {
      const isOpen = sidebar.classList.contains("is-open");
      setMenuOpen(!isOpen);
    });

    if (overlay) {
      overlay.addEventListener("click", () => {
        setMenuOpen(false);
      });
    }

    $$("a", sidebar).forEach((link) => {
      link.addEventListener("click", () => {
        setMenuOpen(false);
      });
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth > 900) {
        setMenuOpen(false);
      }
    });

    // Keep the initial state consistent with the HTML.
    setMenuOpen(false);
  }

  /* =======================================================
     LOGOUT
     Uses the existing shared Supabase client.
  ======================================================= */

  function setupLogout() {
    const button = $("#logout-button");

    if (!button) return;

    button.addEventListener("click", async () => {
      if (button.disabled) return;

      const originalHTML = button.innerHTML;
      button.disabled = true;

      try {
        const client =
          window.bizveroSupabase || window.bizoraSupabase;

        if (client?.auth) {
          const { error } = await client.auth.signOut();

          if (error) throw error;
        }

        window.location.href = "./auth.html";
      } catch (error) {
        console.error("[Bizvero] Sign out failed:", error);

        showToast("Could not sign out. Please try again.");

        button.disabled = false;
        button.innerHTML = originalHTML;
      }
    });
  }

  /* =======================================================
     HERO NAVIGATION
  ======================================================= */

  function setupHeroNavigation() {
    $$('a[href="#growth-guides"]').forEach((link) => {
      link.addEventListener("click", (event) => {
        const target = $("#growth-guides");

        if (!target) return;

        event.preventDefault();

        target.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });

        if (window.history.replaceState) {
          window.history.replaceState(
            null,
            "",
            "#growth-guides"
          );
        }
      });
    });
  }

  /* =======================================================
     EXTERNAL LINKS
  ======================================================= */

  function setupExternalLinks() {
    $$('a[target="_blank"]').forEach((link) => {
      const rel = new Set(
        (link.getAttribute("rel") || "")
          .split(/\s+/)
          .filter(Boolean)
      );

      rel.add("noopener");
      rel.add("noreferrer");

      link.setAttribute("rel", [...rel].join(" "));
    });
  }

  /* =======================================================
     INITIALISATION
  ======================================================= */

  function init() {
    setupToolFilters();
    setupSalesBooster();
    setupCopyButtons();
    setupSafetyChecklist();
    setupMobileSidebar();
    setupLogout();
    setupHeroNavigation();
    setupExternalLinks();

    console.info("[Bizvero] Grow Digitally ready.");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, {
      once: true
    });
  } else {
    init();
  }
})();
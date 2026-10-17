/* =========================================================
   BIZORA — GROW DIGITALLY
   Page interactions, progress tracking and safety learning
   ========================================================= */

(() => {
  "use strict";

  /* -------------------------------------------------------
     DOM HELPERS
  ------------------------------------------------------- */

  const $ = (selector, parent = document) =>
    parent.querySelector(selector);

  const $$ = (selector, parent = document) =>
    Array.from(parent.querySelectorAll(selector));

  const STORAGE_KEYS = {
    lessons: "bizora_growth_completed_lessons",
    checklist: "bizora_growth_weekly_checklist"
  };

  let toastTimer;
  let selectedSimulatorAnswer = null;
  let simulatorAnswered = false;

  /* -------------------------------------------------------
     SAFE LOCAL STORAGE
  ------------------------------------------------------- */

  function readStorage(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      console.warn("Could not read saved Bizora progress:", error);
      return fallback;
    }
  }

  function writeStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.warn("Could not save Bizora progress:", error);
      showToast("Progress could not be saved on this device.");
      return false;
    }
  }

  /* -------------------------------------------------------
     TOAST NOTIFICATIONS
  ------------------------------------------------------- */

  function showToast(message) {
    const toast = $("#growth-toast");

    if (!toast) {
      console.info(message);
      return;
    }

    toast.textContent = message;
    toast.classList.add("is-visible");
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
      toast.classList.remove("is-visible");
    }, 3000);
  }

  /* -------------------------------------------------------
     LESSON COMPLETION
  ------------------------------------------------------- */

  function getCompletedLessons() {
    const saved = readStorage(STORAGE_KEYS.lessons, []);

    return Array.isArray(saved)
      ? saved.filter((id) => typeof id === "string")
      : [];
  }

  function updateLessonProgress() {
    const completed = getCompletedLessons();

    const lessonCards = $$("[data-complete-module]");
    const totalLessons = lessonCards.length;

    lessonCards.forEach((button) => {
      const card = button.closest(".growth-module-card");

      if (!card) return;

      const lessonId = button.dataset.completeModule;
      const isComplete = completed.includes(lessonId);

      card.classList.toggle("is-complete", isComplete);

      const status = $(".growth-module-status", card);

      if (status) {
        status.textContent = isComplete ? "Completed" : "Not started";
      }

      button.textContent = isComplete
        ? "✓ Completed"
        : "Mark as completed";

      button.setAttribute("aria-pressed", String(isComplete));
    });

    const completedCount = lessonCards.filter((button) =>
      completed.includes(button.dataset.completeModule)
    ).length;

    const percentage = totalLessons
      ? Math.round((completedCount / totalLessons) * 100)
      : 0;

    const countElement = $("#completed-lessons");

    if (countElement) {
      countElement.textContent = `${completedCount} of ${totalLessons}`;
    }

    const progressTitle = $("#growth-progress-title");

    if (progressTitle) {
      progressTitle.textContent =
        percentage === 100
          ? "Your learning path is complete!"
          : "Your digital growth progress";
    }

    const progressDescription = $("#growth-progress-description");

    if (progressDescription) {
      progressDescription.textContent =
        percentage === 100
          ? "Great work! Review the lessons whenever you need a refresher."
          : "Complete the learning cards as you explore practical digital tools.";
    }

    const progressBar = $(
      ".growth-progress-track > span"
    );

    if (progressBar) {
      progressBar.style.width = `${percentage}%`;
      progressBar.setAttribute("role", "progressbar");
      progressBar.setAttribute("aria-valuemin", "0");
      progressBar.setAttribute("aria-valuemax", "100");
      progressBar.setAttribute("aria-valuenow", String(percentage));
      progressBar.setAttribute(
        "aria-label",
        "Digital learning completion"
      );
    }
  }

  function setupLessonCompletion() {
    $$("[data-complete-module]").forEach((button) => {
      button.addEventListener("click", () => {
        const lessonId = button.dataset.completeModule;

        if (!lessonId) return;

        const completed = getCompletedLessons();
        const alreadyComplete = completed.includes(lessonId);

        const updated = alreadyComplete
          ? completed.filter((id) => id !== lessonId)
          : [...completed, lessonId];

        if (!writeStorage(STORAGE_KEYS.lessons, updated)) return;

        updateLessonProgress();

        showToast(
          alreadyComplete
            ? "Lesson marked as not completed."
            : "Lesson completed. Keep growing your business!"
        );
      });
    });

    updateLessonProgress();
  }

  /* -------------------------------------------------------
     DIGITAL TOOL DIRECTORY FILTERS
  ------------------------------------------------------- */

  function setupToolFilters() {
    const filters = $$("[data-tool-filter]");
    const cards = $$("[data-tool-category]");

    if (!filters.length || !cards.length) return;

    filters.forEach((button) => {
      button.addEventListener("click", () => {
        const selectedCategory = button.dataset.toolFilter;

        filters.forEach((filter) => {
          const isActive = filter === button;

          filter.classList.toggle("is-active", isActive);
          filter.setAttribute("aria-pressed", String(isActive));
        });

        cards.forEach((card) => {
          const category = card.dataset.toolCategory;
          const shouldShow =
            selectedCategory === "all" ||
            category === selectedCategory;

          card.hidden = !shouldShow;
        });
      });
    });

    const initialActive = filters.find((button) =>
      button.classList.contains("is-active")
    );

    if (initialActive) {
      initialActive.click();
    } else {
      filters[0].click();
    }
  }

  /* -------------------------------------------------------
     WEEKLY DIGITAL-READINESS CHECKLIST
  ------------------------------------------------------- */

  function getChecklistState() {
    const saved = readStorage(STORAGE_KEYS.checklist, {});

    return saved &&
      typeof saved === "object" &&
      !Array.isArray(saved)
      ? saved
      : {};
  }

  function updateChecklistProgress() {
    const checkboxes = $$("[data-checklist-item]");
    const state = getChecklistState();

    checkboxes.forEach((checkbox) => {
      checkbox.checked = Boolean(state[checkbox.dataset.checklistItem]);
    });

    const completedCount = checkboxes.filter(
      (checkbox) => checkbox.checked
    ).length;

    const totalCount = checkboxes.length;

    const countElement = $("#checklist-completed-count");

    if (countElement) {
      countElement.textContent = `${completedCount} of ${totalCount} completed`;
    }

    const progressBar = $("#checklist-progress-bar");

    if (progressBar) {
      const percentage = totalCount
        ? Math.round((completedCount / totalCount) * 100)
        : 0;

      progressBar.style.width = `${percentage}%`;
      progressBar.setAttribute("role", "progressbar");
      progressBar.setAttribute("aria-valuemin", "0");
      progressBar.setAttribute("aria-valuemax", "100");
      progressBar.setAttribute("aria-valuenow", String(percentage));
    }

    const progressText = $("#checklist-progress");

    if (progressText) {
      progressText.textContent =
        completedCount === totalCount && totalCount > 0
          ? "Your weekly checklist is complete. Excellent work!"
          : "Small steps this week can make your business easier to discover.";
    }
  }

  function setupChecklist() {
    const checkboxes = $$("[data-checklist-item]");

    if (!checkboxes.length) return;

    const saved = getChecklistState();

    checkboxes.forEach((checkbox) => {
      const itemId = checkbox.dataset.checklistItem;

      checkbox.checked = Boolean(saved[itemId]);

      checkbox.addEventListener("change", () => {
        const state = getChecklistState();

        state[itemId] = checkbox.checked;

        if (!writeStorage(STORAGE_KEYS.checklist, state)) {
          checkbox.checked = !checkbox.checked;
          return;
        }

        updateChecklistProgress();

        showToast(
          checkbox.checked
            ? "Checklist item completed!"
            : "Checklist item unchecked."
        );
      });
    });

    updateChecklistProgress();
  }

  /* -------------------------------------------------------
     PAYMENT SAFETY SIMULATOR
  ------------------------------------------------------- */

  const simulatorAnswers = {
    "trust-screenshot": {
      correct: false,
      message:
        "Not quite. A screenshot can be edited or show an incomplete payment. Check your own bank or payment app for the actual transaction."
    },

    "verify-payment": {
      correct: true,
      message:
        "Correct! Check your own bank account or payment app and confirm the transaction before handing over goods. Never rely only on a screenshot or sound."
    },

    "ask-for-pin": {
      correct: false,
      message:
        "Never ask for or share a UPI PIN to receive money. A UPI PIN is used to authorise certain payments, not to prove that a customer paid you."
    }
  };

  function setupPaymentSimulator() {
    const optionsContainer = $("#simulator-options");

    if (!optionsContainer) return;

    const options = $$(
      "button, [data-simulator-answer]",
      optionsContainer
    );

    const feedback = $("#simulator-feedback");
    const nextButton = $("#simulator-next");
    const retryButton = $("#simulator-retry");

    function resetSimulator() {
      selectedSimulatorAnswer = null;
      simulatorAnswered = false;

      options.forEach((option) => {
        option.classList.remove("is-selected");
        option.setAttribute("aria-pressed", "false");
        option.disabled = false;
      });

      if (feedback) {
        feedback.hidden = true;
        feedback.textContent = "";
        feedback.classList.remove("is-warning");
      }

      if (nextButton) nextButton.hidden = true;
      if (retryButton) retryButton.hidden = true;
    }

    options.forEach((option) => {
      option.addEventListener("click", () => {
        if (simulatorAnswered) return;

        const answerId =
          option.dataset.simulatorAnswer ||
          option.dataset.answer ||
          option.id;

        if (!simulatorAnswers[answerId]) return;

        selectedSimulatorAnswer = answerId;

        options.forEach((otherOption) => {
          const isSelected = otherOption === option;

          otherOption.classList.toggle("is-selected", isSelected);
          otherOption.setAttribute(
            "aria-pressed",
            String(isSelected)
          );
        });

        if (feedback) {
          feedback.hidden = true;
          feedback.textContent = "";
        }
      });
    });

    function submitAnswer() {
      if (!selectedSimulatorAnswer) {
        showToast("Choose an answer first.");
        return;
      }

      const result = simulatorAnswers[selectedSimulatorAnswer];

      simulatorAnswered = true;

      options.forEach((option) => {
        option.disabled = true;
      });

      if (feedback) {
        feedback.hidden = false;
        feedback.textContent = result.message;
        feedback.classList.toggle("is-warning", !result.correct);
      }

      if (nextButton) nextButton.hidden = true;
      if (retryButton) retryButton.hidden = false;

      showToast(
        result.correct
          ? "Correct answer!"
          : "Review the safety tip and try again."
      );
    }

    /*
      The HTML may provide a separate check-answer button.
      If present, use it. Otherwise, selecting an answer
      reveals the explanation immediately.
    */

    const checkButton = $("#simulator-check");

    if (checkButton) {
      checkButton.addEventListener("click", submitAnswer);
    } else {
      options.forEach((option) => {
        option.addEventListener("click", () => {
          if (simulatorAnswered) return;

          const answerId =
            option.dataset.simulatorAnswer ||
            option.dataset.answer ||
            option.id;

          if (!simulatorAnswers[answerId]) return;

          submitAnswer();
        });
      });
    }

    if (nextButton) {
      nextButton.addEventListener("click", resetSimulator);
    }

    if (retryButton) {
      retryButton.addEventListener("click", resetSimulator);
    }

    resetSimulator();
  }

  /* -------------------------------------------------------
     MOBILE SIDEBAR
  ------------------------------------------------------- */

  function setupMobileSidebar() {
    const menuButton = $("#mobile-menu-button");
    const sidebar = $("#sidebar");
    const overlay = $("#sidebar-overlay");

    if (!menuButton || !sidebar) return;

    function closeSidebar() {
      sidebar.classList.remove("is-open");
      if (overlay) overlay.classList.remove("is-visible");

      menuButton.setAttribute("aria-expanded", "false");
      document.body.classList.remove("sidebar-open");
    }

    function openSidebar() {
      sidebar.classList.add("is-open");
      if (overlay) overlay.classList.add("is-visible");

      menuButton.setAttribute("aria-expanded", "true");
      document.body.classList.add("sidebar-open");
    }

    menuButton.setAttribute("aria-expanded", "false");

    menuButton.addEventListener("click", () => {
      const isOpen = sidebar.classList.contains("is-open");

      if (isOpen) {
        closeSidebar();
      } else {
        openSidebar();
      }
    });

    if (overlay) {
      overlay.addEventListener("click", closeSidebar);
    }

    $$("a", sidebar).forEach((link) => {
      link.addEventListener("click", closeSidebar);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeSidebar();
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth > 900) closeSidebar();
    });
  }

  /* -------------------------------------------------------
     LOGOUT
  ------------------------------------------------------- */

  async function setupLogout() {
    const logoutButton = $("#logout-button");

    if (!logoutButton) return;

    logoutButton.addEventListener("click", async () => {
      const originalText = logoutButton.textContent;

      logoutButton.disabled = true;
      logoutButton.textContent = "Signing out…";

      try {
        const client = window.bizoraSupabase;

        if (client && client.auth) {
          const { error } = await client.auth.signOut();

          if (error) throw error;
        }

        window.location.href = "./auth.html";
      } catch (error) {
        console.error("Logout failed:", error);

        showToast("Could not sign out. Please try again.");

        logoutButton.disabled = false;
        logoutButton.textContent = originalText;
      }
    });
  }

  /* -------------------------------------------------------
     EXTERNAL LINKS
  ------------------------------------------------------- */

  function setupExternalLinks() {
    $$('a[target="_blank"]').forEach((link) => {
      const relValues = new Set(
        (link.getAttribute("rel") || "")
          .split(/\s+/)
          .filter(Boolean)
      );

      relValues.add("noopener");
      relValues.add("noreferrer");

      link.setAttribute("rel", [...relValues].join(" "));
    });
  }

  /* -------------------------------------------------------
     INITIALISE PAGE
  ------------------------------------------------------- */

  function init() {
    setupLessonCompletion();
    setupToolFilters();
    setupChecklist();
    setupPaymentSimulator();
    setupMobileSidebar();
    setupLogout();
    setupExternalLinks();

    console.info("Bizora Grow Digitally page initialised.");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
/* =========================================================
   BIZVERO — GROW DIGITALLY
   Lesson progress, digital tools, payment safety and navigation
   ========================================================= */

(() => {
  "use strict";

  /* =======================================================
     SELECTORS & CONSTANTS
  ======================================================= */

  const $ = (selector, parent = document) =>
    parent.querySelector(selector);

  const $$ = (selector, parent = document) =>
    Array.from(parent.querySelectorAll(selector));

  const STORAGE_KEY = "bizvero_growth_completed_lessons";
  const TOAST_DURATION = 3000;

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

    clearTimeout(toastTimer);

    toastTimer = window.setTimeout(() => {
      toast.classList.remove("is-visible");
    }, TOAST_DURATION);
  }

  /* =======================================================
     SAFE LOCAL STORAGE
  ======================================================= */

  function readStorage(key, fallback) {
    try {
      const value = localStorage.getItem(key);

      if (value === null) {
        return fallback;
      }

      return JSON.parse(value);
    } catch (error) {
      console.warn("[Bizvero] Could not read saved data:", error);
      return fallback;
    }
  }

  function writeStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error("[Bizvero] Could not save progress:", error);
      showToast("Progress could not be saved on this device.");
      return false;
    }
  }

  /* =======================================================
     LESSON COMPLETION & PROGRESS
  ======================================================= */

  function getCompletedLessons() {
    const saved = readStorage(STORAGE_KEY, []);

    if (!Array.isArray(saved)) {
      return [];
    }

    return [
      ...new Set(
        saved.filter(
          (id) => typeof id === "string" && id.trim() !== ""
        )
      )
    ];
  }

  function getLessonButtons() {
    return $$("[data-complete-module]");
  }

  function updateLessonProgress() {
    const buttons = getLessonButtons();

    const lessonIds = [
      ...new Set(
        buttons
          .map((button) => button.dataset.completeModule)
          .filter(Boolean)
      )
    ];

    const completed = getCompletedLessons();

    const total = lessonIds.length;

    const completedCount = lessonIds.filter((id) =>
      completed.includes(id)
    ).length;

    const percentage = total
      ? Math.round((completedCount / total) * 100)
      : 0;

    /* Update lesson buttons and cards. */

    buttons.forEach((button) => {
      const id = button.dataset.completeModule;
      const isComplete = completed.includes(id);
      const card = button.closest(".learning-module");

      button.textContent = isComplete
        ? "✓ Completed"
        : "Mark as complete";

      button.setAttribute("aria-pressed", String(isComplete));

      if (card) {
        card.classList.toggle("is-complete", isComplete);
      }
    });

    /* Update completed lesson count. */

    const count = $("#completed-lessons");

    if (count) {
      count.textContent = `${completedCount} of ${total}`;
    }

    /* Update progress heading. */

    const title = $("#growth-progress-title");

    if (title) {
      title.textContent =
        total > 0 && completedCount === total
          ? "You've completed every lesson!"
          : "Your digital growth progress";
    }

    /* Update progress description. */

    const description = $("#growth-progress-description");

    if (description) {
      description.textContent =
        total > 0 && completedCount === total
          ? "Great work! Return to these lessons whenever you need a refresher."
          : "Explore practical lessons and mark each one complete as you learn.";
    }

    /* Update progress bar. */

    const progressBar = $(".growth-progress-track > span");

    if (progressBar) {
      progressBar.style.width = `${percentage}%`;

      progressBar.setAttribute("role", "progressbar");
      progressBar.setAttribute("aria-valuemin", "0");
      progressBar.setAttribute("aria-valuemax", "100");
      progressBar.setAttribute("aria-valuenow", String(percentage));
      progressBar.setAttribute(
        "aria-label",
        "Completed lesson progress"
      );
    }

    return {
      total,
      completedCount,
      percentage
    };
  }

  function setupLessonCompletion() {
    getLessonButtons().forEach((button) => {
      button.addEventListener("click", () => {
        const id = button.dataset.completeModule;

        if (!id) {
          return;
        }

        const completed = getCompletedLessons();
        const isComplete = completed.includes(id);

        const updated = isComplete
          ? completed.filter((item) => item !== id)
          : [...completed, id];

        if (!writeStorage(STORAGE_KEY, updated)) {
          return;
        }

        updateLessonProgress();

        showToast(
          isComplete
            ? "Lesson marked as incomplete."
            : "Lesson completed. Keep growing!"
        );
      });
    });

    updateLessonProgress();
  }

  /* =======================================================
     DIGITAL TOOL FILTERS
  ======================================================= */

  function setupToolFilters() {
    const filters = $$("[data-tool-filter]");
    const cards = $$("[data-tool-category]");

    if (!filters.length || !cards.length) {
      return;
    }

    function applyFilter(selectedButton) {
      const selectedCategory = selectedButton.dataset.toolFilter;

      filters.forEach((button) => {
        const isActive = button === selectedButton;

        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-pressed", String(isActive));
      });

      cards.forEach((card) => {
        const cardCategory = card.dataset.toolCategory;

        const shouldHide =
          selectedCategory !== "all" &&
          cardCategory !== selectedCategory;

        card.hidden = shouldHide;
      });
    }

    filters.forEach((button) => {
      button.addEventListener("click", () => {
        applyFilter(button);
      });
    });

    const initialFilter =
      filters.find((button) =>
        button.classList.contains("is-active")
      ) || filters[0];

    applyFilter(initialFilter);
  }

  /* =======================================================
     PAYMENT SAFETY CHALLENGE
     Five practical UPI safety scenarios
  ======================================================= */

  const scenarios = [
    {
      title: "A customer shows you a payment screenshot.",
      description:
        "They say the money has been sent and ask you to hand over the goods.",
      question: "What should you do?",

      options: [
        {
          id: "trust-screenshot",
          title: "Trust the screenshot",
          detail: "It looks like a successful payment."
        },
        {
          id: "verify-payment",
          title: "Verify the transaction",
          detail: "Check your own payment app or bank account."
        },
        {
          id: "ask-for-pin",
          title: "Ask for their UPI PIN",
          detail: "Use it to confirm the payment."
        }
      ],

      correct: "verify-payment",

      explanation:
        "Verify the transaction in your own payment app or bank account before handing over goods. Screenshots and sounds alone are not proof of payment."
    },

    {
      title: "Someone asks for your UPI PIN to send you money.",
      description:
        "The person claims that entering your PIN will help them transfer money to your account.",
      question: "What is the safest response?",

      options: [
        {
          id: "enter-pin",
          title: "Enter your UPI PIN",
          detail: "Follow the person's instructions."
        },
        {
          id: "share-otp",
          title: "Share your OTP",
          detail: "Help them complete the transfer."
        },
        {
          id: "never-share",
          title: "Never share your PIN or OTP",
          detail: "Decline and verify the request independently."
        }
      ],

      correct: "never-share",

      explanation:
        "Never share your UPI PIN or OTP. You do not need to disclose these secrets to receive money. Contact your bank through its official channel if you are concerned."
    },

    {
      title: "You receive an unexpected UPI collect request.",
      description:
        "A stranger says you must approve the request to receive a refund or prize.",
      question: "What should you do?",

      options: [
        {
          id: "approve-request",
          title: "Approve it immediately",
          detail: "The stranger says it will send you money."
        },
        {
          id: "check-request",
          title: "Review and decline if unexpected",
          detail: "Do not approve a payment you do not recognise."
        },
        {
          id: "share-details",
          title: "Send your bank details",
          detail: "Ask the stranger to explain the request."
        }
      ],

      correct: "check-request",

      explanation:
        "A collect request may ask you to authorise a payment from your account. Do not approve unexpected requests. Verify any refund through the business or provider's official channel."
    },

    {
      title: "A customer says their payment is still pending.",
      description:
        "They show a pending transaction screen and ask you to release the goods now.",
      question: "What is the safest action?",

      options: [
        {
          id: "release-goods",
          title: "Release the goods immediately",
          detail: "The customer says the money will arrive soon."
        },
        {
          id: "verify-status",
          title: "Check the actual payment status",
          detail: "Confirm the credit using your own payment app or bank."
        },
        {
          id: "trust-message",
          title: "Trust their message",
          detail: "A payment notification is enough."
        }
      ],

      correct: "verify-status",

      explanation:
        "A pending transaction is not confirmation that money has reached you. Check your own account and follow your payment provider's guidance if the status remains unclear."
    },

    {
      title: "Someone asks you to scan a QR code for a refund.",
      description:
        "They tell you to scan it and enter your UPI PIN to receive money.",
      question: "What should you do?",

      options: [
        {
          id: "scan-enter-pin",
          title: "Scan and enter your PIN",
          detail: "Follow the instructions to get the refund."
        },
        {
          id: "send-small-amount",
          title: "Send a small amount first",
          detail: "Test whether the refund works."
        },
        {
          id: "refuse-verify",
          title: "Stop and verify independently",
          detail: "Do not authorise an unfamiliar payment."
        }
      ],

      correct: "refuse-verify",

      explanation:
        "Do not follow unfamiliar QR-code or PIN instructions to receive a refund. A QR payment flow may initiate money leaving your account. Contact the business or provider using a trusted, official channel."
    }
  ];

  function setupPaymentSimulator() {
    const container = $("#simulator-options");
    const panel = $(".simulator-panel");

    if (!container || !panel) {
      return;
    }

    const situation = $(".simulator-situation", panel);
    const feedback = $("#simulator-feedback");
    const checkButton = $("#simulator-check");
    const retryButton = $("#simulator-retry");

    if (!situation || !checkButton) {
      return;
    }

    const heading = $("#simulator-title");

    const sectionDescription = heading
      ? heading.closest(".section-heading")?.querySelector("p")
      : null;

    if (sectionDescription) {
      sectionDescription.textContent =
        "Five everyday situations. Choose the safest action and learn why.";
    }

    /* Challenge state. */

    let currentScenario = 0;
    let score = 0;
    let answered = false;
    let selectedAnswer = null;

    /* Find or create the Next button. */

    let nextButton = $("#simulator-next");

    if (!nextButton) {
      nextButton = document.createElement("button");

      nextButton.type = "button";
      nextButton.id = "simulator-next";
      nextButton.className = "module-primary-link";
      nextButton.textContent = "Next scenario →";
      nextButton.hidden = true;

      const controls = $(".simulator-controls", panel);

      if (controls) {
        controls.appendChild(nextButton);
      } else {
        panel.appendChild(nextButton);
      }
    }

    /* Find or create the final results container. */

    let resultSummary = $("#simulator-result");

    if (!resultSummary) {
      resultSummary = document.createElement("div");

      resultSummary.id = "simulator-result";
      resultSummary.className = "simulator-result";
      resultSummary.hidden = true;
      resultSummary.setAttribute("role", "status");

      panel.appendChild(resultSummary);
    }

    /* Score label. */

    let scoreLabel = $("#simulator-score");

    if (!scoreLabel) {
      scoreLabel = document.createElement("strong");

      scoreLabel.id = "simulator-score";
      scoreLabel.className = "simulator-score";

      situation.insertBefore(scoreLabel, situation.firstChild);
    }

    /* Render one scenario. */

    function renderScenario() {
      const scenario = scenarios[currentScenario];

      answered = false;
      selectedAnswer = null;

      const label = $(".simulator-label", situation);
      const icon = $(".simulator-icon", situation);
      const title = $("h3", situation);
      const description = $("p", situation);
      const question = $("strong", situation);

      if (label) {
        label.textContent =
          `SCENARIO ${String(currentScenario + 1).padStart(2, "0")} OF ${scenarios.length}`;
      }

      scoreLabel.textContent = `Score: ${score}`;

      if (icon) {
        icon.textContent = "₹";
        icon.setAttribute("aria-hidden", "true");
      }

      if (title) {
        title.textContent = scenario.title;
      }

      if (description) {
        description.textContent = scenario.description;
      }

      if (question) {
        question.textContent = scenario.question;
      }

      /* Rebuild answer choices safely. */

      container.replaceChildren();
      container.hidden = false;

      scenario.options.forEach((option, index) => {
        const button = document.createElement("button");

        button.type = "button";
        button.dataset.simulatorAnswer = option.id;
        button.setAttribute("aria-pressed", "false");

        const letter = document.createElement("span");

        letter.className = "simulator-choice-letter";
        letter.textContent = String.fromCharCode(65 + index);
        letter.setAttribute("aria-hidden", "true");

        const content = document.createElement("span");

        const optionTitle = document.createElement("strong");
        optionTitle.textContent = option.title;

        const detail = document.createElement("small");
        detail.textContent = option.detail;

        content.append(optionTitle, detail);
        button.append(letter, content);

        button.addEventListener("click", () => {
          if (answered) {
            return;
          }

          selectedAnswer = option.id;

          $$("[data-simulator-answer]", container).forEach((item) => {
            const isSelected = item === button;

            item.classList.toggle("is-selected", isSelected);
            item.setAttribute("aria-pressed", String(isSelected));
          });

          if (feedback) {
            feedback.hidden = true;
            feedback.textContent = "";
            feedback.classList.remove("is-warning", "is-correct");
          }
        });

        container.appendChild(button);
      });

      /* Reset feedback and controls. */

      if (feedback) {
        feedback.hidden = true;
        feedback.textContent = "";
        feedback.classList.remove("is-warning", "is-correct");
      }

      checkButton.hidden = false;
      checkButton.disabled = false;
      checkButton.textContent = "Check answer →";

      nextButton.hidden = true;

      if (retryButton) {
        retryButton.hidden = true;
      }

      resultSummary.hidden = true;

      situation.hidden = false;
    }

    /* Display the final score. */

    function finishChallenge() {
      container.hidden = true;
      situation.hidden = true;
      checkButton.hidden = true;
      nextButton.hidden = true;

      if (retryButton) {
        retryButton.hidden = true;
      }

      if (feedback) {
        feedback.hidden = true;
      }

      let message;

      if (score === scenarios.length) {
        message =
          "Excellent! You answered all five scenarios correctly.";
      } else if (score >= 3) {
        message =
          "Good work! Review the explanations to strengthen your payment safety.";
      } else {
        message =
          "Keep learning. Review the safety tips and practise again.";
      }

      resultSummary.replaceChildren();

      const title = document.createElement("h3");
      title.textContent = "Challenge complete";

      const scoreText = document.createElement("p");
      scoreText.textContent =
        `Your score: ${score} / ${scenarios.length}`;

      const description = document.createElement("p");
      description.textContent = message;

      const restartButton = document.createElement("button");

      restartButton.type = "button";
      restartButton.className = "module-primary-link";
      restartButton.textContent = "Try all scenarios again →";

      restartButton.addEventListener("click", () => {
        currentScenario = 0;
        score = 0;

        resultSummary.hidden = true;

        container.hidden = false;
        situation.hidden = false;

        renderScenario();
      });

      resultSummary.append(
        title,
        scoreText,
        description,
        restartButton
      );

      resultSummary.hidden = false;
    }

    /* Check the selected answer. */

    checkButton.addEventListener("click", () => {
      if (answered) {
        return;
      }

      if (!selectedAnswer) {
        showToast("Choose an answer first.");
        return;
      }

      const scenario = scenarios[currentScenario];
      const isCorrect = selectedAnswer === scenario.correct;

      answered = true;

      if (isCorrect) {
        score++;
      }

      $$("[data-simulator-answer]", container).forEach((button) => {
        button.disabled = true;

        const answerId = button.dataset.simulatorAnswer;

        if (answerId === scenario.correct) {
          button.classList.add("is-correct");
        } else if (answerId === selectedAnswer) {
          button.classList.add("is-incorrect");
        }
      });

      if (feedback) {
        const resultText = isCorrect ? "Correct!" : "Not quite.";

        feedback.textContent =
          `${resultText} ${scenario.explanation}`;

        feedback.hidden = false;

        feedback.classList.toggle("is-warning", !isCorrect);
        feedback.classList.toggle("is-correct", isCorrect);
      }

      scoreLabel.textContent = `Score: ${score}`;

      checkButton.hidden = true;
      nextButton.hidden = false;

      nextButton.textContent =
        currentScenario < scenarios.length - 1
          ? "Next scenario →"
          : "See final score →";
    });

    /* Continue to the next scenario or finish. */

    nextButton.addEventListener("click", () => {
      if (!answered) {
        return;
      }

      if (currentScenario < scenarios.length - 1) {
        currentScenario++;
        renderScenario();
      } else {
        finishChallenge();
      }
    });

    /* Optional retry control, if present in the HTML. */

    if (retryButton) {
      retryButton.addEventListener("click", () => {
        renderScenario();
      });
    }

    renderScenario();
  }

  /* =======================================================
     SIDEBAR NAVIGATION
     Supports existing mobile-menu HTML if present.
  ======================================================= */

  function setupMobileSidebar() {
    const menuButton = $("#mobile-menu-button");
    const sidebar = $("#sidebar");
    const overlay = $("#sidebar-overlay");

    if (!menuButton || !sidebar) {
      return;
    }

    function closeSidebar() {
      sidebar.classList.remove("is-open");

      if (overlay) {
        overlay.classList.remove("is-visible");
      }

      menuButton.setAttribute("aria-expanded", "false");
      document.body.classList.remove("sidebar-open");
    }

    function openSidebar() {
      sidebar.classList.add("is-open");

      if (overlay) {
        overlay.classList.add("is-visible");
      }

      menuButton.setAttribute("aria-expanded", "true");
      document.body.classList.add("sidebar-open");
    }

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

    sidebar.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", closeSidebar);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeSidebar();
      }
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth > 900) {
        closeSidebar();
      }
    });

    if (window.innerWidth <= 900) {
      closeSidebar();
    }
  }

  /* =======================================================
     LOGOUT
  ======================================================= */

  function setupLogout() {
    const button = $("#logout-button");

    if (!button) {
      return;
    }

    button.addEventListener("click", async () => {
      const originalText = button.textContent;

      button.disabled = true;
      button.textContent = "Signing out…";

      try {
        const client =
          window.bizveroSupabase || window.bizoraSupabase;

        if (client?.auth) {
          const { error } = await client.auth.signOut();

          if (error) {
            throw error;
          }
        }

        window.location.href = "./auth.html";
      } catch (error) {
        console.error("[Bizvero] Sign out failed:", error);

        showToast("Could not sign out. Please try again.");

        button.disabled = false;
        button.textContent = originalText;
      }
    });
  }

  /* =======================================================
     EXTERNAL LINK SAFETY
  ======================================================= */

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

  /* =======================================================
     INITIALISATION
  ======================================================= */

  function init() {
    setupLessonCompletion();
    setupToolFilters();
    setupPaymentSimulator();
    setupMobileSidebar();
    setupLogout();
    setupExternalLinks();

    console.info("[Bizvero] Grow Digitally initialised.");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, {
      once: true
    });
  } else {
    init();
  }
})();
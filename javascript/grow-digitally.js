/* =========================================================
   BIZVERO — GROW DIGITALLY
   Lesson progress, payment safety, tools and navigation
   ========================================================= */

(() => {
  "use strict";

  const $ = (selector, parent = document) =>
    parent.querySelector(selector);

  const $$ = (selector, parent = document) =>
    Array.from(parent.querySelectorAll(selector));

  const STORAGE_KEY = "bizvero_growth_completed_lessons";

  let toastTimer;
  let currentScenario = 0;
  let score = 0;
  let answered = false;
  let selectedAnswer = null;

  /* =======================================================
     TOAST
  ======================================================= */

  function showToast(message) {
    const toast = $("#growth-toast");

    if (!toast) {
      console.info(message);
      return;
    }

    toast.textContent = message;
    toast.classList.add("is-visible");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
      toast.classList.remove("is-visible");
    }, 3000);
  }

  /* =======================================================
     SAFE LOCAL STORAGE
  ======================================================= */

  function readStorage(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      showToast("Progress could not be saved on this device.");
      return false;
    }
  }

  /* =======================================================
     LESSON COMPLETION
  ======================================================= */

  function getCompletedLessons() {
    const saved = readStorage(STORAGE_KEY, []);

    return Array.isArray(saved)
      ? [...new Set(saved.filter((id) => typeof id === "string"))]
      : [];
  }

  function updateLessonProgress() {
    const buttons = $$("[data-complete-module]");
    const lessonIds = [
      ...new Set(buttons.map((button) => button.dataset.completeModule))
    ].filter(Boolean);

    const completed = getCompletedLessons();
    const total = lessonIds.length;

    const completedCount = lessonIds.filter((id) =>
      completed.includes(id)
    ).length;

    const percentage = total
      ? Math.round((completedCount / total) * 100)
      : 0;

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

    const count = $("#completed-lessons");

    if (count) {
      count.textContent = `${completedCount} of ${total}`;
    }

    const title = $("#growth-progress-title");

    if (title) {
      title.textContent =
        total > 0 && completedCount === total
          ? "You've completed every lesson!"
          : "Your digital growth progress";
    }

    const description = $("#growth-progress-description");

    if (description) {
      description.textContent =
        total > 0 && completedCount === total
          ? "Great work! Return to these lessons whenever you need a refresher."
          : "Explore practical lessons and mark each one complete as you learn.";
    }

    const progressBar = $(".growth-progress-track > span");

    if (progressBar) {
      progressBar.style.width = `${percentage}%`;
      progressBar.setAttribute("role", "progressbar");
      progressBar.setAttribute("aria-valuemin", "0");
      progressBar.setAttribute("aria-valuemax", "100");
      progressBar.setAttribute("aria-valuenow", String(percentage));
    }
  }

  function setupLessonCompletion() {
    $$("[data-complete-module]").forEach((button) => {
      button.addEventListener("click", () => {
        const id = button.dataset.completeModule;

        if (!id) return;

        const completed = getCompletedLessons();
        const isComplete = completed.includes(id);

        const updated = isComplete
          ? completed.filter((item) => item !== id)
          : [...completed, id];

        if (!writeStorage(STORAGE_KEY, updated)) return;

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

    if (!filters.length || !cards.length) return;

    function applyFilter(button) {
      const category = button.dataset.toolFilter;

      filters.forEach((filter) => {
        const active = filter === button;

        filter.classList.toggle("is-active", active);
        filter.setAttribute("aria-pressed", String(active));
      });

      cards.forEach((card) => {
        card.hidden =
          category !== "all" &&
          card.dataset.toolCategory !== category;
      });
    }

    filters.forEach((button) => {
      button.addEventListener("click", () => applyFilter(button));
    });

    applyFilter(
      filters.find((button) =>
        button.classList.contains("is-active")
      ) || filters[0]
    );
  }

  /* =======================================================
     PAYMENT SAFETY CHALLENGE — FIVE SCENARIOS
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
        "Correct practice: verify the transaction in your own payment app or bank account before handing over goods. Screenshots and sounds alone are not proof of payment."
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
        "Correct! Never share your UPI PIN or OTP. You do not need to disclose these secrets to receive money. Contact your bank through its official channel if you are concerned."
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
        "Correct! A collect request may ask you to authorise a payment from your account. Do not approve unexpected requests. Verify any refund through the business or provider's official channel."
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
        "Correct! A pending transaction is not confirmation that money has reached you. Check your own account and follow your payment provider's guidance if the status remains unclear."
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
        "Correct! Do not follow unfamiliar QR-code or PIN instructions to receive a refund. A QR payment flow may initiate money leaving your account. Contact the business or provider using a trusted, official channel."
    }
  ];

  function setupPaymentSimulator() {
    const container = $("#simulator-options");
    const panel = $(".simulator-panel");

    if (!container || !panel) return;

    const situation = $(".simulator-situation", panel);
    const feedback = $("#simulator-feedback");
    const checkButton = $("#simulator-check");
    const retryButton = $("#simulator-retry");

    if (!situation || !checkButton) return;

    let nextButton = $("#simulator-next");

    // Create a Next button if the HTML does not already contain one.
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

    const heading = $("#simulator-title");
    const sectionDescription = heading
      ? heading.closest(".section-heading")?.querySelector("p")
      : null;

    if (sectionDescription) {
      sectionDescription.textContent =
        "Five everyday situations. Choose the safest action and learn why.";
    }

    let resultSummary = $("#simulator-result");

    if (!resultSummary) {
      resultSummary = document.createElement("div");
      resultSummary.id = "simulator-result";
      resultSummary.className = "simulator-result";
      resultSummary.hidden = true;
      resultSummary.setAttribute("role", "status");
      panel.appendChild(resultSummary);
    }

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

      let scoreLabel = $("#simulator-score");

      if (!scoreLabel) {
        scoreLabel = document.createElement("strong");
        scoreLabel.id = "simulator-score";
        scoreLabel.className = "simulator-score";
        situation.insertBefore(scoreLabel, situation.firstChild);
      }

      scoreLabel.textContent = `Score: ${score}`;

      if (icon) icon.textContent = "₹";
      if (title) title.textContent = scenario.title;
      if (description) description.textContent = scenario.description;
      if (question) question.textContent = scenario.question;

      container.replaceChildren();

      scenario.options.forEach((option, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.simulatorAnswer = option.id;
        button.setAttribute("aria-pressed", "false");

        const letter = document.createElement("span");
        letter.className = "simulator-choice-letter";
        letter.textContent = String.fromCharCode(65 + index);

        const content = document.createElement("span");

        const title = document.createElement("strong");
        title.textContent = option.title;

        const detail = document.createElement("small");
        detail.textContent = option.detail;

        content.append(title, detail);
        button.append(letter, content);

        button.addEventListener("click", () => {
          if (answered) return;

          selectedAnswer = option.id;

          $$("[data-simulator-answer]", container).forEach((item) => {
            const selected = item === button;

            item.classList.toggle("is-selected", selected);
            item.setAttribute("aria-pressed", String(selected));
          });

          if (feedback) {
            feedback.hidden = true;
            feedback.textContent = "";
          }
        });

        container.appendChild(button);
      });

      if (feedback) {
        feedback.hidden = true;
        feedback.textContent = "";
        feedback.classList.remove("is-warning", "is-correct");
      }

      checkButton.hidden = false;
      checkButton.disabled = false;
      checkButton.textContent = "Check answer →";

      nextButton.hidden = true;
      retryButton.hidden = true;
      resultSummary.hidden = true;
    }

    function finishChallenge() {
      container.hidden = true;
      situation.hidden = true;
      checkButton.hidden = true;
      retryButton.hidden = true;
      nextButton.hidden = true;

      if (feedback) {
        feedback.hidden = true;
      }

      const message =
        score === scenarios.length
          ? "Excellent! You answered all five scenarios correctly."
          : score >= 3
            ? "Good work! Review the explanations to strengthen your payment safety."
            : "Keep learning. Review the safety tips and practise again.";

      resultSummary.replaceChildren();

      const title = document.createElement("h3");
      title.textContent = "Challenge complete";

      const scoreText = document.createElement("p");
      scoreText.textContent = `Your score: ${score} / ${scenarios.length}`;

      const description = document.createElement("p");
      description.textContent = message;

      const restartButton = document.createElement("button");
      restartButton.type = "button";
      restartButton.className = "module-primary-link";
      restartButton.textContent = "Try all scenarios again →";

      restartButton.addEventListener("click", () => {
        currentScenario = 0;
        score = 0;
        container.hidden = false;
        situation.hidden = false;
        renderScenario();
      });

      resultSummary.append(title, scoreText, description, restartButton);
      resultSummary.hidden = false;
    }

    checkButton.addEventListener("click", () => {
      if (answered) return;

      if (!selectedAnswer) {
        showToast("Choose an answer first.");
        return;
      }

      const scenario = scenarios[currentScenario];
      const correct = selectedAnswer === scenario.correct;

      answered = true;

      if (correct) score++;

      $$("[data-simulator-answer]", container).forEach((button) => {
        button.disabled = true;

        if (button.dataset.simulatorAnswer === scenario.correct) {
          button.classList.add("is-correct");
        } else if (button.dataset.simulatorAnswer === selectedAnswer) {
          button.classList.add("is-incorrect");
        }
      });

      if (feedback) {
        feedback.hidden = false;
        feedback.textContent =
          `${correct ? "Correct!" : "Not quite."} ${scenario.explanation}`;

        feedback.classList.toggle("is-warning", !correct);
        feedback.classList.toggle("is-correct", correct);
      }

      const scoreLabel = $("#simulator-score");

      if (scoreLabel) {
        scoreLabel.textContent = `Score: ${score}`;
      }

      checkButton.hidden = true;

      if (currentScenario < scenarios.length - 1) {
        nextButton.hidden = false;
        nextButton.textContent = "Next scenario →";
      } else {
        nextButton.hidden = false;
        nextButton.textContent = "See final score →";
      }
    });

    nextButton.addEventListener("click", () => {
      if (!answered) return;

      if (currentScenario < scenarios.length - 1) {
        currentScenario++;
        renderScenario();
      } else {
        finishChallenge();
      }
    });

    if (retryButton) {
      retryButton.addEventListener("click", () => {
        renderScenario();
      });
    }

    renderScenario();
  }

  /* =======================================================
     MOBILE SIDEBAR
  ======================================================= */

  function setupMobileSidebar() {
  const menuButton = $("#mobile-menu-button");
  const sidebar = $("#sidebar");
  const overlay = $("#sidebar-overlay");

  if (!menuButton || !sidebar) return;

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

    if (!button) return;

    button.addEventListener("click", async () => {
      const originalText = button.textContent;

      button.disabled = true;
      button.textContent = "Signing out…";

      try {
        const client = window.bizveroSupabase || window.bizoraSupabase;

        if (client?.auth) {
          const { error } = await client.auth.signOut();
          if (error) throw error;
        }

        window.location.href = "./auth.html";
      } catch (error) {
        console.error("Sign out failed:", error);

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
     INITIALISE
  ======================================================= */

  function init() {
    setupLessonCompletion();
    setupToolFilters();
    setupPaymentSimulator();
    setupMobileSidebar();
    setupLogout();
    setupExternalLinks();

    console.info("Bizvero Grow Digitally initialised.");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
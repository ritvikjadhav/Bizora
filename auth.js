"use strict";

document.addEventListener("DOMContentLoaded", () => {
    initAuthForms();
    initPasswordToggles();
    initLoginForm();
    initRegistrationForm();
});

function initAuthForms() {
    const loginPanel = document.getElementById("login-panel");
    const registerPanel = document.getElementById("register-panel");
    const showRegister = document.getElementById("show-register");
    const showLogin = document.getElementById("show-login");

    if (!loginPanel || !registerPanel) return;

    function switchForm(mode, message = "") {
        const showSignup = mode === "signup";

        loginPanel.hidden = showSignup;
        registerPanel.hidden = !showSignup;
        document.title = showSignup ? "Create Account | Bizora" : "Sign in | Bizora";

        clearMessage("login-message");
        clearMessage("register-message");

        if (message) {
            showMessage("login-message", message, "success");
        }

        if (showSignup) {
            document.getElementById("full-name")?.focus();
        } else {
            document.getElementById("login-email")?.focus();
        }
    }

    showRegister?.addEventListener("click", () => switchForm("signup"));
    showLogin?.addEventListener("click", () => switchForm("login"));

    const params = new URLSearchParams(window.location.search);
    switchForm(params.get("mode") === "signup" ? "signup" : "login");
}

function initPasswordToggles() {
    document.querySelectorAll("[data-password-target]").forEach((button) => {
        button.addEventListener("click", () => {
            const input = document.getElementById(button.dataset.passwordTarget);

            if (!input) return;

            const showPassword = input.type === "password";
            input.type = showPassword ? "text" : "password";
            button.textContent = showPassword ? "Hide" : "Show";
            button.setAttribute("aria-pressed", String(showPassword));
            button.setAttribute("aria-label", `${showPassword ? "Hide" : "Show"} password`);
        });
    });
}

function showMessage(id, text, type = "error") {
    const message = document.getElementById(id);

    if (!message) return;

    message.textContent = text;
    message.className = `auth-message is-${type}`;
    message.hidden = false;
}

function clearMessage(id) {
    const message = document.getElementById(id);

    if (!message) return;

    message.textContent = "";
    message.className = "auth-message";
    message.hidden = true;
}

function setInvalid(field, invalid) {
    field?.setAttribute("aria-invalid", String(invalid));
}

function getSupabaseClient() {
    const client = window.bizoraSupabase;

    if (!client?.auth) {
        console.error("Bizora: Supabase client is unavailable.");
        return null;
    }

    return client;
}

function setSubmitState(button, loading, label) {
    if (!button) return;

    button.disabled = loading;

    const buttonText = button.querySelector("span");

    if (buttonText) {
        buttonText.textContent = loading ? label : button.dataset.defaultLabel;
    }
}

function initLoginForm() {
    const form = document.getElementById("login-form");
    const email = document.getElementById("login-email");
    const password = document.getElementById("login-password");
    const submitButton = document.getElementById("login-submit");

    if (!form || !email || !password || !submitButton) return;

    submitButton.dataset.defaultLabel = submitButton.querySelector("span")?.textContent || "Log in";

    form.addEventListener("input", () => {
        clearMessage("login-message");
        setInvalid(email, false);
        setInvalid(password, false);
    });

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        clearMessage("login-message");

        const emailAddress = email.value.trim();
        const userPassword = password.value;

        if (!emailAddress || !email.validity.valid) {
            setInvalid(email, true);
            showMessage("login-message", "Please enter a valid email address.");
            email.focus();
            return;
        }

        if (!userPassword) {
            setInvalid(password, true);
            showMessage("login-message", "Please enter your password.");
            password.focus();
            return;
        }

        const client = getSupabaseClient();

        if (!client) {
            showMessage("login-message", "Connection unavailable. Refresh the page and try again.");
            return;
        }

        setSubmitState(submitButton, true, "Signing in…");

        try {
            const { data, error } = await client.auth.signInWithPassword({
                email: emailAddress,
                password: userPassword
            });

            if (error) {
                showMessage("login-message", "Unable to sign in. Check your email and password, then try again.");
                console.error("Bizora login error:", error);
                return;
            }

            if (!data.user) {
                showMessage("login-message", "We couldn't verify your account. Please try again.");
                return;
            }

            await redirectAfterLogin(client, data.user.id);
        } catch (error) {
            console.error("Bizora login error:", error);
            showMessage("login-message", "Something went wrong. Check your connection and try again.");
        } finally {
            setSubmitState(submitButton, false);
        }
    });
}

async function redirectAfterLogin(client, userId) {
    try {
        const { data: business, error } = await client
            .from("businesses")
            .select("id")
            .eq("owner_id", userId)
            .maybeSingle();

        if (error) {
            console.error("Bizora business lookup error:", error);
            showMessage("login-message", "You're signed in, but we couldn't check your business profile. Please try again.");
            return;
        }

        window.location.replace(business ? "./dashboard.html" : "./create-business.html");
    } catch (error) {
        console.error("Bizora redirect error:", error);
        showMessage("login-message", "You're signed in, but we couldn't load your business profile. Please try again.");
    }
}

function initRegistrationForm() {
    const form = document.getElementById("register-form");
    const fullName = document.getElementById("full-name");
    const email = document.getElementById("email");
    const password = document.getElementById("password");
    const confirmPassword = document.getElementById("confirm-password");
    const acceptTerms = document.getElementById("accept-terms");
    const submitButton = document.getElementById("register-submit");

    if (!form || !fullName || !email || !password || !confirmPassword || !acceptTerms || !submitButton) return;

    submitButton.dataset.defaultLabel = submitButton.querySelector("span")?.textContent || "Create account";

    form.addEventListener("input", () => {
        clearMessage("register-message");
        [fullName, email, password, confirmPassword].forEach((field) => setInvalid(field, false));
    });

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        clearMessage("register-message");

        const name = fullName.value.trim();
        const emailAddress = email.value.trim();
        const userPassword = password.value;

        if (name.length < 2) {
            setInvalid(fullName, true);
            showMessage("register-message", "Please enter your full name.");
            fullName.focus();
            return;
        }

        if (!emailAddress || !email.validity.valid) {
            setInvalid(email, true);
            showMessage("register-message", "Please enter a valid email address.");
            email.focus();
            return;
        }

        if (userPassword.length < 8) {
            setInvalid(password, true);
            showMessage("register-message", "Your password must contain at least 8 characters.");
            password.focus();
            return;
        }

        if (userPassword !== confirmPassword.value) {
            setInvalid(confirmPassword, true);
            showMessage("register-message", "Your passwords don't match.");
            confirmPassword.focus();
            return;
        }

        if (!acceptTerms.checked) {
            showMessage("register-message", "Please agree to the Terms & Conditions and Privacy Policy.");
            acceptTerms.focus();
            return;
        }

        const client = getSupabaseClient();

        if (!client) {
            showMessage("register-message", "Connection unavailable. Refresh the page and try again.");
            return;
        }

        setSubmitState(submitButton, true, "Creating account…");

        try {
            const redirectUrl = new URL("./auth.html", window.location.href);
            redirectUrl.search = "";
            redirectUrl.hash = "";

            const { data, error } = await client.auth.signUp({
                email: emailAddress,
                password: userPassword,
                options: {
                    data: { full_name: name },
                    emailRedirectTo: redirectUrl.href
                }
            });

            if (error) {
                console.error("Bizora registration error:", error);
                showMessage("register-message", getRegistrationError(error));
                return;
            }

            if (data.user && !data.session) {
                form.reset();
                switchToLoginWithMessage("Account created. Check your email for the confirmation link, then sign in.");
                return;
            }

            if (data.session && data.user) {
                window.location.replace("./create-business.html");
                return;
            }

            showMessage("register-message", "Registration submitted. Check your email for further instructions.", "success");
        } catch (error) {
            console.error("Bizora registration error:", error);
            showMessage("register-message", "We couldn't create your account. Check your connection and try again.");
        } finally {
            setSubmitState(submitButton, false);
        }
    });
}

function switchToLoginWithMessage(message) {
    const loginPanel = document.getElementById("login-panel");
    const registerPanel = document.getElementById("register-panel");

    if (!loginPanel || !registerPanel) return;

    registerPanel.hidden = true;
    loginPanel.hidden = false;
    document.title = "Sign in | Bizora";

    clearMessage("register-message");
    showMessage("login-message", message, "success");
    document.getElementById("login-email")?.focus();
}

function getRegistrationError(error) {
    const message = String(error?.message || "").toLowerCase();

    if (message.includes("already registered") || message.includes("already been registered")) {
        return "An account may already exist for this email. Try signing in instead.";
    }

    if (message.includes("password")) {
        return "Your password doesn't meet the account security requirements.";
    }

    if (message.includes("rate limit") || message.includes("too many requests")) {
        return "Too many attempts. Please wait a little and try again.";
    }

    return "We couldn't create your account. Check your details and try again.";
}
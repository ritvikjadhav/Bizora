"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const client = window.bizoraSupabase;
    const form = document.getElementById("business-form");
    const status = document.getElementById("business-status");
    const logoInput = document.getElementById("business-logo");
    const logoPreview = document.getElementById("logo-preview");
    const uploadPreview = document.getElementById("logo-upload-preview");
    const uploadFallback = document.getElementById("logo-upload-fallback");
    const previewButton = document.getElementById("preview-button");
    const saveButton = document.getElementById("save-button");
    const publishButton = document.getElementById("publish-button");

    if (!form || !status) {
        console.error("Bizora: Business form elements are missing.");
        return;
    }

    let currentUser = null;
    let existingBusiness = null;
    let existingLogoUrl = null;
    let selectedLogoFile = null;
    let previewObjectUrl = null;
    let isSubmitting = false;

    const fields = {
        name: form.elements.namedItem("name"),
        category: form.elements.namedItem("category"),
        description: form.elements.namedItem("description"),
        address: form.elements.namedItem("address"),
        contactName: form.elements.namedItem("contact_name"),
        phone: form.elements.namedItem("phone"),
        whatsapp: form.elements.namedItem("whatsapp"),
        website: form.elements.namedItem("website_url"),
        instagram: form.elements.namedItem("instagram_url")
    };

    function showStatus(message, type = "info") {
        status.textContent = message;
        status.className = `business-status ${type}`;
        status.hidden = false;
        status.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    function clearStatus() {
        status.textContent = "";
        status.className = "business-status";
        status.hidden = true;
    }

    function setSubmitting(value) {
        isSubmitting = value;
        saveButton.disabled = value;
        publishButton.disabled = value;
        previewButton.disabled = value;

        saveButton.textContent = value ? "Saving..." : "Save draft";

        publishButton.textContent = value
            ? "Please wait..."
            : existingBusiness?.is_published
                ? "Update published profile"
                : "Publish profile";

        if (!value && existingBusiness?.is_published) {
            publishButton.innerHTML = 'Update published profile <span aria-hidden="true">→</span>';
        } else if (!value) {
            publishButton.innerHTML = 'Publish profile <span aria-hidden="true">→</span>';
        }
    }

    function createSlug(name) {
        return name
            .normalize("NFKD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 70)
            .replace(/-+$/g, "");
    }

    async function getUniqueSlug(name) {
        const baseSlug = createSlug(name);

        if (!baseSlug) {
            throw new Error("Enter a business name containing letters or numbers.");
        }

        for (let attempt = 0; attempt < 8; attempt++) {
            const candidate = attempt === 0
                ? baseSlug
                : `${baseSlug}-${crypto.randomUUID().slice(0, 8)}`;

            const { data, error } = await client
                .from("businesses")
                .select("id")
                .eq("slug", candidate)
                .maybeSingle();

            if (error) {
                console.error("Bizora: Slug lookup failed.", error);
                throw new Error("Unable to prepare your business link. Please try again.");
            }

            if (!data || data.id === existingBusiness?.id) {
                return candidate;
            }
        }

        throw new Error("Unable to create a unique business link. Please try again.");
    }

    function normalizeUrl(value) {
        const input = value.trim();

        if (!input) {
            return null;
        }

        let url;

        try {
            url = new URL(input);
        } catch {
            throw new Error("Enter a complete website URL beginning with https://.");
        }

        if (!["https:", "http:"].includes(url.protocol) || !url.hostname.includes(".")) {
            throw new Error("Enter a valid HTTP or HTTPS website URL.");
        }

        return url.href;
    }

    function getFormData(isPublished, slug, logoUrl) {
        return {
            owner_id: currentUser.id,
            name: fields.name.value.trim(),
            category: fields.category.value,
            description: fields.description.value.trim(),
            address: fields.address.value.trim(),
            contact_name: fields.contactName.value.trim(),
            phone: fields.phone.value.trim(),
            whatsapp: fields.whatsapp.value.trim() || null,
            website_url: normalizeUrl(fields.website.value),
            instagram_url: normalizeUrl(fields.instagram.value),
            logo_url: logoUrl,
            slug,
            is_published: isPublished
        };
    }

    function setImageSources(url) {
        [logoPreview, uploadPreview].forEach((image) => {
            if (!image) {
                return;
            }

            if (url) {
                image.onerror = () => {
                    image.hidden = true;
                };
                image.onload = () => {
                    image.hidden = false;
                };
                image.src = url;
            } else {
                image.removeAttribute("src");
                image.hidden = true;
            }
        });

        if (uploadFallback) {
            uploadFallback.hidden = Boolean(url);
        }

        if (logoPreview) {
            logoPreview.hidden = !url;
        }
    }

    function updateLivePreview() {
        const name = fields.name.value.trim();
        const category = fields.category.value;
        const description = fields.description.value.trim();
        const phone = fields.phone.value.trim();
        const whatsapp = fields.whatsapp.value.trim();

        document.getElementById("preview-business-name").textContent =
            name || "Your business name";

        document.getElementById("preview-business-category").textContent =
            category || "Your business category";

        document.getElementById("preview-business-description").textContent =
            description || "Your business story will appear here as you fill in your profile.";

        document.getElementById("preview-contact-label").textContent =
            whatsapp || phone || "Your contact details";

        document.getElementById("preview-logo-letter").textContent =
            (name || "B").charAt(0).toUpperCase();

        document.getElementById("preview-state").textContent =
            existingBusiness?.is_published ? "PUBLISHED" : "IN PROGRESS";
    }

    function updateProgress() {
        const requiredFields = [
            fields.name,
            fields.category,
            fields.description,
            fields.address,
            fields.contactName,
            fields.phone
        ];

        const completed = requiredFields.filter((field) => field.value.trim()).length;
        const percentage = Math.round((completed / requiredFields.length) * 100);

        document.getElementById("completion-percentage").textContent = `${percentage}%`;
        document.getElementById("completion-bar").style.width = `${percentage}%`;

        const description = fields.description.value;
        const counter = document.getElementById("description-count");

        if (counter) {
            counter.textContent = `${description.length} / 1000`;
        }

        document.querySelectorAll("[data-section-link]").forEach((link) => {
            const section = document.getElementById(link.dataset.sectionLink);

            if (!section) {
                return;
            }

            const sectionFields = section.querySelectorAll(
                "input[required], select[required], textarea[required]"
            );

            const sectionComplete = Array.from(sectionFields).every(
                (field) => field.value.trim() !== ""
            );

            link.classList.toggle(
                "completed",
                sectionFields.length > 0 && sectionComplete
            );
        });
    }

    function displayBusiness(business) {
        fields.name.value = business.name || "";
        fields.category.value = business.category || "";
        fields.description.value = business.description || "";
        fields.address.value = business.address || "";
        fields.contactName.value = business.contact_name || "";
        fields.phone.value = business.phone || "";
        fields.whatsapp.value = business.whatsapp || "";
        fields.website.value = business.website_url || "";
        fields.instagram.value = business.instagram_url || "";

        existingLogoUrl = business.logo_url || null;
        setImageSources(existingLogoUrl);

        document.getElementById("page-title").innerHTML =
            "Make your business<br>ready for more.";

        updateLivePreview();
        updateProgress();
        setSubmitting(false);
    }

    async function loadBusiness() {
        if (!client) {
            throw new Error("Supabase has not initialized. Check supabase.js and its loading order.");
        }

        const { data: sessionData, error: sessionError } =
            await client.auth.getSession();

        if (sessionError) {
            throw new Error("Unable to verify your session. Please sign in again.");
        }

        currentUser = sessionData.session?.user || null;

        if (!currentUser) {
            window.location.replace("./auth.html");
            return;
        }

        const { data, error } = await client
            .from("businesses")
            .select("*")
            .eq("owner_id", currentUser.id)
            .maybeSingle();

        if (error) {
            console.error("Bizora: Business lookup failed.", error);
            throw new Error("Unable to load your business profile. Please try again.");
        }

        if (data) {
            existingBusiness = data;
            displayBusiness(data);
        } else {
            updateLivePreview();
            updateProgress();
        }
    }

    async function uploadLogo() {
        if (!selectedLogoFile) {
            return existingLogoUrl;
        }

        const extensionByType = {
            "image/png": "png",
            "image/jpeg": "jpg",
            "image/webp": "webp"
        };

        const extension = extensionByType[selectedLogoFile.type];

        if (!extension) {
            throw new Error("Choose a PNG, JPG or WebP image.");
        }

        const path = `${currentUser.id}/${crypto.randomUUID()}.${extension}`;

        const { data, error } = await client.storage
            .from("business-logos")
            .upload(path, selectedLogoFile, {
                upsert: false,
                contentType: selectedLogoFile.type
            });

        if (error) {
            console.error("Bizora: Logo upload failed.", error);
            throw new Error("Logo upload failed. Check the business-logos bucket and its storage policies.");
        }

        const { data: publicData } = client.storage
            .from("business-logos")
            .getPublicUrl(data.path);

        return publicData.publicUrl;
    }

    function releasePreviewUrl() {
        if (previewObjectUrl) {
            URL.revokeObjectURL(previewObjectUrl);
            previewObjectUrl = null;
        }
    }

    function isUniqueConstraintError(error) {
        return error?.code === "23505";
    }

    async function saveBusiness(isPublished) {
        const businessName = fields.name.value.trim();

        let slug = existingBusiness?.slug || "";

        if (!slug) {
            slug = await getUniqueSlug(businessName);
        }

        const logoUrl = await uploadLogo();
        const businessData = getFormData(isPublished, slug, logoUrl);

        let result;

        if (existingBusiness) {
            result = await client
                .from("businesses")
                .update(businessData)
                .eq("id", existingBusiness.id)
                .eq("owner_id", currentUser.id)
                .select()
                .single();
        } else {
            result = await client
                .from("businesses")
                .insert(businessData)
                .select()
                .single();
        }

        if (result.error) {
            console.error("Bizora: Business save failed.", result.error);

            if (isUniqueConstraintError(result.error) && result.error.message?.includes("slug")) {
                throw new Error("That business link was just taken. Please save again to generate another.");
            }

            throw new Error(
                "Unable to save your business. Check your database columns and RLS policies."
            );
        }

        existingBusiness = result.data;
        existingLogoUrl = result.data.logo_url || null;
        selectedLogoFile = null;
        logoInput.value = "";

        releasePreviewUrl();
        displayBusiness(existingBusiness);

        return result.data;
    }

    form.addEventListener("input", () => {
        clearStatus();
        updateLivePreview();
        updateProgress();
    });

    form.addEventListener("change", () => {
        updateLivePreview();
        updateProgress();
    });

    logoInput.addEventListener("change", () => {
        clearStatus();

        const file = logoInput.files?.[0];

        selectedLogoFile = null;
        releasePreviewUrl();

        if (!file) {
            setImageSources(existingLogoUrl);
            return;
        }

        const allowedTypes = ["image/png", "image/jpeg", "image/webp"];

        if (!allowedTypes.includes(file.type) || file.size > 2 * 1024 * 1024) {
            logoInput.value = "";
            setImageSources(existingLogoUrl);
            showStatus("Choose a PNG, JPG or WebP image smaller than 2 MB.", "error");
            return;
        }

        selectedLogoFile = file;
        previewObjectUrl = URL.createObjectURL(file);
        setImageSources(previewObjectUrl);
    });

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (isSubmitting) {
            return;
        }

        clearStatus();

        if (!client || !currentUser) {
            showStatus("Your session is unavailable. Please sign in again.", "error");
            return;
        }

        if (!form.reportValidity()) {
            return;
        }

        const isPublished = event.submitter?.value === "publish";

        setSubmitting(true);

        try {
            const business = await saveBusiness(isPublished);

            showStatus(
                isPublished
                    ? "Your business profile is published successfully."
                    : "Your business profile has been saved as a draft.",
                "success"
            );

            if (isPublished) {
                window.setTimeout(() => {
                    window.location.href =
                        `./storefront.html?slug=${encodeURIComponent(business.slug)}`;
                }, 700);
            }
        } catch (error) {
            console.error("Bizora: Business form error.", error);
            showStatus(error.message || "Something went wrong. Please try again.", "error");
        } finally {
            setSubmitting(false);
        }
    });

    previewButton.addEventListener("click", () => {
        clearStatus();

        if (!existingBusiness?.slug) {
            showStatus("Save your profile first to create its business link.", "info");
            return;
        }

        if (!existingBusiness.is_published) {
            showStatus("Publish your profile before viewing its public storefront.", "info");
            return;
        }

        window.open(
            `./storefront.html?slug=${encodeURIComponent(existingBusiness.slug)}`,
            "_blank",
            "noopener,noreferrer"
        );
    });

    document.querySelectorAll("[data-section-link]").forEach((link) => {
        link.addEventListener("click", () => {
            document.querySelectorAll("[data-section-link]").forEach((item) => {
                item.classList.remove("active");
            });

            link.classList.add("active");
        });
    });

    window.addEventListener("beforeunload", releasePreviewUrl);

    loadBusiness().catch((error) => {
        console.error("Bizora: Page initialization failed.", error);
        showStatus(error.message || "Unable to load your business profile.", "error");
    });
});
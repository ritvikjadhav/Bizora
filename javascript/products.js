/* =========================================================
   BIZVERO — PRODUCTS & SERVICES
   Supabase client: window.bizoraSupabase
   Storage bucket: product-images
   ========================================================= */

"use strict";

(() => {
    const supabase = () => window.bizoraSupabase;
    const BUCKET = "product-images";
    const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
    const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

const path = `${state.business.id}/${productId}/${crypto.randomUUID()}.${extension}`;
    const state = {
        user: null,
        business: null,
        products: [],
        editingId: null,
        currentImageUrl: null,
        removeCurrentImage: false,
        previewUrl: null,
        saving: false,
        loading: false
    };

    const $ = id => document.getElementById(id);
    const el = {};

    /* =====================================================
       ELEMENTS
    ===================================================== */

    function cacheElements() {
        const ids = [
            "dashboard-sidebar",
            "mobile-menu-button",
            "sidebar-overlay",
            "profile-menu-button",
            "profile-menu",
            "profile-avatar",
            "profile-name",
            "profile-email",
            "logout-button",
            "total-products",
            "available-products",
            "product-categories-count",
            "product-search",
            "filter-type",
            "filter-category",
            "filter-availability",
            "catalogue-loading",
            "catalogue-error",
            "retry-catalogue",
            "catalogue-empty",
            "catalogue-no-results",
            "clear-product-filters",
            "empty-add-product-button",
            "add-product-button",
            "catalogue-grid",
            "product-editor",
            "editor-title",
            "product-form",
            "item-name",
            "item-description",
            "item-price",
            "item-type",
            "item-category",
            "item-available",
            "item-image",
            "image-preview-img",
            "image-placeholder",
            "image-hint",
            "image-error",
            "remove-image",
            "reset-form",
            "cancel-edit",
            "save-item",
            "save-button-text",
            "description-count",
            "name-error",
            "type-error",
            "price-error",
            "form-status",
            "dashboard-message",
            "settings-avatar",
            "settings-name",
            "settings-email"
        ];

        ids.forEach(id => el[id] = $(id));
    }

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[char]);
    }

    function setHidden(element, hidden) {
        if (element) element.hidden = hidden;
    }

    function showMessage(message, type = "success") {
        const target = el["dashboard-message"];
        if (!target) return;

        target.textContent = message;
        target.classList.toggle("error", type === "error");
        target.hidden = false;
    }

    function showFormMessage(message, type = "error") {
        const target = el["form-status"];
        if (!target) return;

        target.textContent = message;
        target.classList.toggle("error", type === "error");
        target.hidden = false;
    }

    function clearMessages() {
        [
            el["dashboard-message"],
            el["form-status"]
        ].forEach(target => {
            if (!target) return;

            target.textContent = "";
            target.hidden = true;
            target.classList.remove("error");
        });
    }

    function setFieldError(element, message) {
        if (!element) return;

        const errorId = element.getAttribute("aria-describedby");
        const errorElement = errorId ? $(errorId) : null;

        if (errorElement) {
            errorElement.textContent = message;
            errorElement.hidden = !message;
        }

        element.setAttribute(
            "aria-invalid",
            message ? "true" : "false"
        );
    }

    function formatPrice(value) {
        if (value === null || value === undefined || value === "") {
            return "Price on request";
        }

        const number = Number(value);

        if (!Number.isFinite(number)) {
            return "Price unavailable";
        }

        return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 2
        }).format(number);
    }

    function safeImageUrl(value) {
        if (!value) return "";

        try {
            const url = new URL(value, window.location.href);

            return ["https:", "http:"].includes(url.protocol)
                ? url.href
                : "";

        } catch {
            return "";
        }
    }

    function releasePreview() {
        if (state.previewUrl) {
            URL.revokeObjectURL(state.previewUrl);
            state.previewUrl = null;
        }
    }

    /* =====================================================
       AUTHENTICATION
    ===================================================== */

    async function getUser() {
        const client = supabase();

        if (!client) {
            throw new Error(
                "Supabase client not found. Check supabase.js."
            );
        }

        const { data, error } = await client.auth.getUser();

        if (error) throw error;

        if (!data.user) {
            window.location.replace("./auth.html");
            return null;
        }

        state.user = data.user;
        updateAccount(data.user);

        return data.user;
    }

    function updateAccount(user) {
        const email = user.email || "No email available";
        const metadata = user.user_metadata || {};

        const name =
            metadata.full_name ||
            metadata.name ||
            metadata.first_name ||
            email.split("@")[0] ||
            "Your account";

        const initial = name.trim().charAt(0).toUpperCase() || "B";

        if (el["profile-name"])
            el["profile-name"].textContent = name;

        if (el["profile-email"])
            el["profile-email"].textContent = email;

        if (el["profile-avatar"])
            el["profile-avatar"].textContent = initial;

        if (el["settings-name"])
            el["settings-name"].textContent = name;

        if (el["settings-email"])
            el["settings-email"].textContent = email;

        if (el["settings-avatar"])
            el["settings-avatar"].textContent = initial;
    }

    async function logout() {
        if (!confirm("Are you sure you want to log out?")) return;

        try {
            const { error } = await supabase().auth.signOut();

            if (error) throw error;

            window.location.replace("./auth.html");

        } catch (error) {
            console.error("Logout failed:", error);
            showMessage(error.message, "error");
        }
    }

    async function getBusiness() {
        const { data, error } = await supabase()
            .from("businesses")
            .select("id, name, owner_id, is_published")
            .eq("owner_id", state.user.id)
            .maybeSingle();

        if (error) throw error;

        if (!data) {
            throw new Error(
                "No business profile found. Please create your business first."
            );
        }

        state.business = data;

        return data;
    }

    /* =====================================================
       LOAD PRODUCTS
    ===================================================== */

    async function loadProducts() {
        if (state.loading) return;

        state.loading = true;
        clearMessages();

        setHidden(el["catalogue-loading"], false);
        setHidden(el["catalogue-error"], true);
        setHidden(el["catalogue-empty"], true);
        setHidden(el["catalogue-no-results"], true);

        el["catalogue-grid"]?.setAttribute("aria-busy", "true");

        try {
            if (!state.user) await getUser();
            if (!state.user) return;

            if (!state.business) await getBusiness();

            const { data, error } = await supabase()
                .from("products")
                .select(`
                    id,
                    business_id,
                    name,
                    description,
                    price,
                    image_url,
                    item_type,
                    is_available,
                    created_at
                `)
                .eq("business_id", state.business.id)
                .order("created_at", { ascending: false });

            if (error) throw error;

            state.products = data || [];

            updateSummary();
            populateCategoryFilter();
            renderProducts();

        } catch (error) {
            console.error("Product loading failed:", error);

            setHidden(el["catalogue-error"], false);
            setHidden(el["catalogue-empty"], true);
            setHidden(el["catalogue-no-results"], true);

            showMessage(
                error.message || "Unable to load catalogue.",
                "error"
            );

        } finally {
            state.loading = false;

            setHidden(el["catalogue-loading"], true);

            el["catalogue-grid"]?.setAttribute(
                "aria-busy",
                "false"
            );
        }
    }

    function updateSummary() {
        const products = state.products;

        const available = products.filter(
            item => item.is_available === true
        ).length;

        const categories = new Set(
            products.map(item => item.item_type).filter(Boolean)
        );

        if (el["total-products"])
            el["total-products"].textContent = products.length;

        if (el["available-products"])
            el["available-products"].textContent = available;

        if (el["product-categories-count"])
            el["product-categories-count"].textContent = categories.size;
    }

    /* =====================================================
       FILTERS
       Category currently uses item_type.
    ===================================================== */

    function populateCategoryFilter() {
        const select = el["filter-category"];

        if (!select) return;

        const previous = select.value;

        const types = [...new Set(
            state.products
                .map(item => item.item_type)
                .filter(Boolean)
        )].sort();

        select.replaceChildren();

        const all = document.createElement("option");
        all.value = "all";
        all.textContent = "All categories";

        select.appendChild(all);

        types.forEach(type => {
            const option = document.createElement("option");

            option.value = type;
            option.textContent =
                type.charAt(0).toUpperCase() + type.slice(1);

            select.appendChild(option);
        });

        select.value = types.includes(previous) ? previous : "all";
    }

    function getFilteredProducts() {
        const search = (
            el["product-search"]?.value || ""
        ).trim().toLowerCase();

        const type = (
            el["filter-type"]?.value || "all"
        ).toLowerCase();

        const category =
            el["filter-category"]?.value || "all";

        const availability =
            el["filter-availability"]?.value || "all";

        return state.products.filter(item => {
            const name = String(item.name || "").toLowerCase();

            const description =
                String(item.description || "").toLowerCase();

            const itemType =
                String(item.item_type || "").toLowerCase();

            const matchesSearch =
                !search ||
                name.includes(search) ||
                description.includes(search);

            const matchesType =
                type === "all" || itemType === type;

            const matchesCategory =
                category === "all" ||
                item.item_type === category;

            const matchesAvailability =
                availability === "all" ||
                (
                    availability === "available" &&
                    item.is_available === true
                ) ||
                (
                    availability === "unavailable" &&
                    item.is_available === false
                );

            return (
                matchesSearch &&
                matchesType &&
                matchesCategory &&
                matchesAvailability
            );
        });
    }

    function clearFilters() {
        if (el["product-search"])
            el["product-search"].value = "";

        if (el["filter-type"])
            el["filter-type"].value = "all";

        if (el["filter-category"])
            el["filter-category"].value = "all";

        if (el["filter-availability"])
            el["filter-availability"].value = "all";

        renderProducts();
    }

    /* =====================================================
       PRODUCT CARDS
    ===================================================== */

    function renderProducts() {
        const grid = el["catalogue-grid"];

        if (!grid) return;

        grid.replaceChildren();

        const filtered = getFilteredProducts();

        if (state.products.length === 0) {
            setHidden(el["catalogue-empty"], false);
            setHidden(el["catalogue-no-results"], true);
            return;
        }

        setHidden(el["catalogue-empty"], true);

        if (filtered.length === 0) {
            setHidden(el["catalogue-no-results"], false);
            return;
        }

        setHidden(el["catalogue-no-results"], true);

        const fragment = document.createDocumentFragment();

        filtered.forEach(product => {
            fragment.appendChild(createProductCard(product));
        });

        grid.appendChild(fragment);
    }

    function createProductCard(product) {
        const card = document.createElement("article");

        card.className = "product-card catalogue-product-card";
        card.dataset.productId = product.id;

        const name = escapeHTML(product.name || "Untitled item");

        const description = escapeHTML(
            product.description || "No description provided."
        );

        const type = escapeHTML(product.item_type || "Item");

        const price = escapeHTML(formatPrice(product.price));

        const imageUrl = safeImageUrl(product.image_url);

        const available = product.is_available === true;

        const id = escapeHTML(product.id);

        card.innerHTML = `
            <div class="product-card-image">
                ${
                    imageUrl
                        ? `<img src="${escapeHTML(imageUrl)}"
                               alt="${name}"
                               loading="lazy">`
                        : `<div class="product-image-placeholder">B</div>`
                }

                <span class="product-type-badge">${type}</span>
            </div>

            <div class="product-card-content">

                <div class="product-card-heading">
                    <h3>${name}</h3>

                    <span class="product-availability ${
                        available ? "available" : "unavailable"
                    }">
                        ${available ? "Available" : "Unavailable"}
                    </span>
                </div>

                <p class="product-card-description">
                    ${description}
                </p>

                <div class="product-card-footer">

                    <strong class="product-card-price">
                        ${price}
                    </strong>

                    <div class="product-card-actions">

                        <button type="button"
                            data-action="edit"
                            data-id="${id}">
                            Edit
                        </button>

                        <button type="button"
                            data-action="toggle"
                            data-id="${id}">
                            ${available ? "Mark unavailable" : "Mark available"}
                        </button>

                        <button type="button"
                            data-action="delete"
                            data-id="${id}">
                            Delete
                        </button>

                    </div>
                </div>
            </div>
        `;

        const image = card.querySelector("img");

        image?.addEventListener("error", () => {
            const placeholder = document.createElement("div");

            placeholder.className = "product-image-placeholder";
            placeholder.textContent = "B";

            image.replaceWith(placeholder);
        }, { once: true });

        return card;
    }

    /* =====================================================
       IMAGE PREVIEW
    ===================================================== */

    function displayImagePreview(url, isLocal = false) {
        const image = el["image-preview-img"];
        const placeholder = el["image-placeholder"];

        if (!image || !placeholder) return;

        // Local preview images use blob URLs.
        // Saved images use normal HTTP/HTTPS URLs.
        const previewUrl =
            isLocal && String(url || "").startsWith("blob:")
                ? url
                : safeImageUrl(url);

        if (!previewUrl) {
            image.removeAttribute("src");
            image.hidden = true;

            placeholder.hidden = false;

            setHidden(el["remove-image"], true);

            return;
        }

        image.onload = () => {
            image.hidden = false;
            placeholder.hidden = true;

            setHidden(el["remove-image"], false);
        };

        image.onerror = () => {
            image.hidden = true;
            placeholder.hidden = false;

            setHidden(el["remove-image"], true);

            if (!isLocal) {
                showFormMessage(
                    "Unable to display the saved image."
                );
            }
        };

        image.src = previewUrl;
    }

    function handleImageSelection() {
        const file = el["item-image"]?.files?.[0];

        setFieldError(el["item-image"], "");

        if (!file) return;

        if (!ALLOWED_TYPES.includes(file.type)) {
            el["item-image"].value = "";

            showFormMessage(
                "Choose a JPG, PNG or WebP image."
            );

            return;
        }

        if (file.size > MAX_IMAGE_SIZE) {
            el["item-image"].value = "";

            showFormMessage(
                "Image must be 5 MB or smaller."
            );

            return;
        }

        clearMessages();

        state.removeCurrentImage = false;

        releasePreview();

        state.previewUrl = URL.createObjectURL(file);

        // Important: allow blob URL for preview.
        displayImagePreview(state.previewUrl, true);
    }

    function removeImage() {
        if (el["item-image"]) {
            el["item-image"].value = "";
        }

        releasePreview();

        state.currentImageUrl = null;
        state.removeCurrentImage = true;

        displayImagePreview(null);
    }

    /* =====================================================
       IMAGE UPLOAD TO SUPABASE STORAGE
    ===================================================== */

    async function uploadImage(productId) {
        const file = el["item-image"]?.files?.[0];

        if (!file) return state.currentImageUrl;

        const extension = file.name
            .split(".")
            .pop()
            .toLowerCase();

        const safeExtension =
            ["jpg", "jpeg", "png", "webp"].includes(extension)
                ? extension
                : "jpg";

        const uniqueId = crypto.randomUUID
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

        const path =
            `${state.business.id}/${productId}/${uniqueId}.${safeExtension}`;

        const { error } = await supabase()
            .storage
            .from(BUCKET)
            .upload(path, file, {
                contentType: file.type,
                upsert: false
            });

        if (error) throw error;

        const { data } = supabase()
            .storage
            .from(BUCKET)
            .getPublicUrl(path);

        if (!data?.publicUrl) {
            throw new Error(
                "Image uploaded, but its public URL could not be created."
            );
        }

        return data.publicUrl;
    }

    /* =====================================================
       PRODUCT FORM
    ===================================================== */

    function setEditorMode(editing) {
        if (el["editor-title"]) {
            el["editor-title"].textContent = editing
                ? "Edit product or service"
                : "Add a product or service";
        }

        if (el["save-button-text"]) {
            el["save-button-text"].textContent = editing
                ? "Save changes"
                : "Save item";
        }

        setHidden(el["cancel-edit"], !editing);
    }

    function resetForm() {
        el["product-form"]?.reset();

        releasePreview();

        state.editingId = null;
        state.currentImageUrl = null;
        state.removeCurrentImage = false;

        if (el["item-available"]) {
            el["item-available"].checked = true;
        }

        if (el["item-image"]) {
            el["item-image"].value = "";
        }

        if (el["item-category"]) {
            el["item-category"].value = "";
            el["item-category"].disabled = true;
        }

        displayImagePreview(null);

        setEditorMode(false);

        if (el["description-count"]) {
            el["description-count"].textContent = "0";
        }

        [
            el["item-name"],
            el["item-type"],
            el["item-price"],
            el["item-image"]
        ].forEach(field => setFieldError(field, ""));

        clearMessages();
    }

    function openEditor() {
        if (!el["product-editor"]) return;

        el["product-editor"].hidden = false;

        el["product-editor"].scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }

    function startAddProduct() {
        resetForm();
        openEditor();
    }

    function startEditProduct(id) {
        const product = state.products.find(
            item => String(item.id) === String(id)
        );

        if (!product) {
            showMessage("Product not found.", "error");
            return;
        }

        resetForm();

        state.editingId = product.id;
        state.currentImageUrl = product.image_url || null;

        el["item-name"].value = product.name || "";

        el["item-description"].value =
            product.description || "";

        el["item-price"].value =
            product.price ?? "";

        el["item-type"].value =
            product.item_type || "";

        el["item-available"].checked =
            product.is_available === true;

        // Your current database has no separate category column.
        if (el["item-category"]) {
            el["item-category"].value = "";
            el["item-category"].disabled = true;
        }

        if (el["description-count"]) {
            el["description-count"].textContent =
                el["item-description"].value.length;
        }

        displayImagePreview(state.currentImageUrl);

        setEditorMode(true);

        openEditor();
    }

    function validateForm() {
        const name = el["item-name"]?.value.trim() || "";

        const type = el["item-type"]?.value || "";

        const priceText =
            el["item-price"]?.value.trim() || "";

        setFieldError(el["item-name"], "");
        setFieldError(el["item-type"], "");
        setFieldError(el["item-price"], "");

        if (!name) {
            setFieldError(
                el["item-name"],
                "Enter an item name."
            );

            el["item-name"]?.focus();

            return null;
        }

        if (!type) {
            setFieldError(
                el["item-type"],
                "Choose Product or Service."
            );

            el["item-type"]?.focus();

            return null;
        }

        let price = null;

        if (priceText !== "") {
            price = Number(priceText);

            if (!Number.isFinite(price) || price < 0) {
                setFieldError(
                    el["item-price"],
                    "Enter a valid price."
                );

                el["item-price"]?.focus();

                return null;
            }
        }

        return {
            name,
            item_type: type,
            description:
                el["item-description"]?.value.trim() || "",
            price,
            is_available:
                el["item-available"]?.checked ?? true
        };
    }

    /* =====================================================
       SAVE PRODUCT
    ===================================================== */

    async function saveProduct(event) {
        event.preventDefault();

        if (state.saving) return;

        clearMessages();

        const formData = validateForm();

        if (!formData) return;

        state.saving = true;

        if (el["save-item"]) {
            el["save-item"].disabled = true;
        }

        if (el["save-button-text"]) {
            el["save-button-text"].textContent = "Saving...";
        }

        const editing = state.editingId !== null;

        try {
            if (!state.user) await getUser();

            if (!state.user) return;

            if (!state.business) await getBusiness();

            const client = supabase();

            let productId = state.editingId;

            // Update existing product.
            if (editing) {
                const { error } = await client
                    .from("products")
                    .update(formData)
                    .eq("id", productId)
                    .eq("business_id", state.business.id);

                if (error) throw error;

            } else {
                // Insert new product.
                const { data, error } = await client
                    .from("products")
                    .insert({
                        business_id: state.business.id,
                        ...formData,
                        image_url: null
                    })
                    .select("id")
                    .single();

                if (error) throw error;

                productId = data.id;
            }

            let imageUrl = state.currentImageUrl;

            // Upload newly selected image.
            if (el["item-image"]?.files?.length) {
                imageUrl = await uploadImage(productId);
            }

            // Remove existing image if requested.
            else if (state.removeCurrentImage) {
                imageUrl = null;
            }

            // Save image URL in products table.
            if (
                el["item-image"]?.files?.length ||
                state.removeCurrentImage ||
                !editing
            ) {
                const { error } = await client
                    .from("products")
                    .update({
                        image_url: imageUrl
                    })
                    .eq("id", productId)
                    .eq("business_id", state.business.id);

                if (error) throw error;
            }

            resetForm();

            setHidden(el["product-editor"], true);

            showMessage(
                editing
                    ? "Item updated successfully."
                    : "Item added successfully."
            );

            await loadProducts();

        } catch (error) {
            console.error("Save failed:", error);

            showFormMessage(
                error.message || "Unable to save this item."
            );

        } finally {
            state.saving = false;

            if (el["save-item"]) {
                el["save-item"].disabled = false;
            }

            if (el["save-button-text"]) {
                el["save-button-text"].textContent =
                    editing ? "Save changes" : "Save item";
            }
        }
    }

    /* =====================================================
       AVAILABILITY
    ===================================================== */

    async function toggleAvailability(id) {
        const product = state.products.find(
            item => String(item.id) === String(id)
        );

        if (!product) return;

        const newValue = product.is_available !== true;

        try {
            const { error } = await supabase()
                .from("products")
                .update({
                    is_available: newValue
                })
                .eq("id", product.id)
                .eq("business_id", state.business.id);

            if (error) throw error;

            product.is_available = newValue;

            updateSummary();
            renderProducts();

            showMessage(
                newValue
                    ? "Item marked as available."
                    : "Item marked as unavailable."
            );

        } catch (error) {
            console.error("Availability update failed:", error);

            showMessage(
                error.message || "Unable to update availability.",
                "error"
            );
        }
    }

    /* =====================================================
       DELETE PRODUCT
    ===================================================== */

    async function deleteProduct(id) {
        const product = state.products.find(
            item => String(item.id) === String(id)
        );

        if (!product) return;

        if (!confirm(
            `Delete "${product.name}"? This action cannot be undone.`
        )) return;

        try {
            const { error } = await supabase()
                .from("products")
                .delete()
                .eq("id", product.id)
                .eq("business_id", state.business.id);

            if (error) throw error;

            state.products = state.products.filter(
                item => String(item.id) !== String(id)
            );

            updateSummary();
            populateCategoryFilter();
            renderProducts();

            showMessage("Item deleted successfully.");

        } catch (error) {
            console.error("Delete failed:", error);

            showMessage(
                error.message || "Unable to delete item.",
                "error"
            );
        }
    }

    /* =====================================================
       MOBILE NAVIGATION
    ===================================================== */

    function closeSidebar() {
        el["dashboard-sidebar"]?.classList.remove("is-open");

        document.body.classList.remove("sidebar-open");

        if (el["sidebar-overlay"]) {
            el["sidebar-overlay"].hidden = true;

            el["sidebar-overlay"].classList.remove("is-visible");
        }

        el["mobile-menu-button"]?.setAttribute(
            "aria-expanded",
            "false"
        );
    }

    function openSidebar() {
        el["dashboard-sidebar"]?.classList.add("is-open");

        document.body.classList.add("sidebar-open");

        if (el["sidebar-overlay"]) {
            el["sidebar-overlay"].hidden = false;

            el["sidebar-overlay"].classList.add("is-visible");
        }

        el["mobile-menu-button"]?.setAttribute(
            "aria-expanded",
            "true"
        );
    }

    function closeProfileMenu() {
        setHidden(el["profile-menu"], true);

        el["profile-menu-button"]?.setAttribute(
            "aria-expanded",
            "false"
        );
    }

    function setupNavigation() {
        el["mobile-menu-button"]?.addEventListener("click", () => {
            const sidebar = el["dashboard-sidebar"];

            sidebar?.classList.contains("is-open")
                ? closeSidebar()
                : openSidebar();
        });

        el["sidebar-overlay"]?.addEventListener(
            "click",
            closeSidebar
        );

        el["dashboard-sidebar"]?.querySelectorAll("a").forEach(link => {
            link.addEventListener("click", closeSidebar);
        });

        document.addEventListener("keydown", event => {
            if (event.key === "Escape") {
                closeSidebar();
                closeProfileMenu();
            }
        });

        window.addEventListener("resize", () => {
            if (window.innerWidth > 900) {
                closeSidebar();
            }
        });
    }

    /* =====================================================
       PROFILE MENU
    ===================================================== */

    function setupProfileMenu() {
        el["profile-menu-button"]?.addEventListener("click", () => {
            const menu = el["profile-menu"];

            if (!menu) return;

            const opening = menu.hidden;

            menu.hidden = !opening;

            el["profile-menu-button"].setAttribute(
                "aria-expanded",
                String(opening)
            );
        });

        el["logout-button"]?.addEventListener("click", logout);

        document.querySelectorAll("[data-settings-link]").forEach(link => {
            link.addEventListener("click", closeProfileMenu);
        });

        document.addEventListener("click", event => {
            const menu = el["profile-menu"];
            const button = el["profile-menu-button"];

            if (
                menu &&
                button &&
                !menu.contains(event.target) &&
                !button.contains(event.target)
            ) {
                closeProfileMenu();
            }
        });
    }

    /* =====================================================
       EVENT LISTENERS
    ===================================================== */

    function setupEvents() {
        el["product-form"]?.addEventListener(
            "submit",
            saveProduct
        );

        el["add-product-button"]?.addEventListener(
            "click",
            startAddProduct
        );

        el["empty-add-product-button"]?.addEventListener(
            "click",
            startAddProduct
        );

        el["reset-form"]?.addEventListener(
            "click",
            resetForm
        );

        el["cancel-edit"]?.addEventListener("click", () => {
            resetForm();
            setHidden(el["product-editor"], true);
        });

        // Image selection: one listener only.
        el["item-image"]?.addEventListener(
            "change",
            handleImageSelection
        );

        // Remove selected or existing image.
        el["remove-image"]?.addEventListener(
            "click",
            removeImage
        );

        el["retry-catalogue"]?.addEventListener(
            "click",
            loadProducts
        );

        el["clear-product-filters"]?.addEventListener(
            "click",
            clearFilters
        );

        el["product-search"]?.addEventListener(
            "input",
            renderProducts
        );

        el["filter-type"]?.addEventListener(
            "change",
            renderProducts
        );

        el["filter-category"]?.addEventListener(
            "change",
            renderProducts
        );

        el["filter-availability"]?.addEventListener(
            "change",
            renderProducts
        );

        el["item-description"]?.addEventListener("input", () => {
            if (el["description-count"]) {
                el["description-count"].textContent =
                    el["item-description"].value.length;
            }
        });

        // Product card actions.
        el["catalogue-grid"]?.addEventListener("click", async event => {
            const button = event.target.closest(
                "button[data-action]"
            );

            if (!button) return;

            const { action, id } = button.dataset;

            if (!id) return;

            if (action === "edit") {
                startEditProduct(id);
            }

            else if (action === "toggle") {
                await toggleAvailability(id);
            }

            else if (action === "delete") {
                await deleteProduct(id);
            }
        });

        setupNavigation();
        setupProfileMenu();
    }

    /* =====================================================
       INITIALIZATION
    ===================================================== */

    async function initialize() {
        cacheElements();

        if (el["product-editor"]) {
            el["product-editor"].hidden = true;
        }

        setHidden(el["catalogue-loading"], false);
        setHidden(el["catalogue-error"], true);

        setupEvents();

        if (!el["catalogue-grid"] || !el["product-form"]) {
            console.error(
                "Required products.html elements are missing."
            );

            showMessage(
                "The products page HTML is missing required elements.",
                "error"
            );

            return;
        }

        await loadProducts();
    }

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            initialize,
            { once: true }
        );
    } else {
        initialize();
    }

})();
/* =========================================================
   BIZVERO — PRODUCTS CATALOGUE
   Corrected to match products.html dashboard IDs
   Supabase client: window.bizoraSupabase
   ========================================================= */

"use strict";

(() => {
    /* -----------------------------------------------------
       1. CONFIGURATION
       ----------------------------------------------------- */

    const SUPABASE = () => window.bizoraSupabase;
    const STORAGE_BUCKET = "product-images";

    const state = {
        user: null,
        business: null,
        products: [],
        editingProductId: null,
        loading: false,
        saving: false,
        initialized: false
    };

    const elements = {};

    /* -----------------------------------------------------
       2. DOM HELPERS
       ----------------------------------------------------- */

    const byId = (id) => document.getElementById(id);

    function cacheElements() {
        const ids = {
            sidebar: "dashboard-sidebar",
            mobileMenuButton: "mobile-menu-button",
            sidebarOverlay: "sidebar-overlay",

            totalProducts: "total-products",
            availableProducts: "available-products",
            categoryCount: "product-categories-count",

            search: "product-search",
            filterType: "filter-type",
            filterCategory: "filter-category",
            filterAvailability: "filter-availability",

            loading: "catalogue-loading",
            error: "catalogue-error",
            retry: "retry-catalogue",
            empty: "catalogue-empty",
            noResults: "catalogue-no-results",
            clearFilters: "clear-product-filters",
            emptyAddButton: "empty-add-product-button",

            grid: "catalogue-grid",
            editor: "product-editor",
            editorTitle: "editor-title",

            message: "dashboard-message"
        };

        Object.entries(ids).forEach(([key, id]) => {
            elements[key] = byId(id);
        });

        /*
         * Form elements are discovered using the IDs already
         * present in the supplied HTML. Multiple common IDs are
         * supported to avoid relying on a single naming style.
         */
        elements.form =
            byId("product-form") ||
            byId("item-form") ||
            (elements.editor
                ? elements.editor.querySelector("form")
                : null);

        elements.name = findElement([
            "item-name",
            "product-name",
            "name"
        ]);

        elements.description = findElement([
            "item-description",
            "product-description",
            "description"
        ]);

        elements.price = findElement([
            "item-price",
            "product-price",
            "price"
        ]);

        elements.type = findElement([
            "item-type",
            "product-type",
            "type"
        ]);

        elements.category = findElement([
            "item-category",
            "product-category",
            "category"
        ]);

        elements.availability = findElement([
            "item-availability",
            "product-availability",
            "is-available"
        ]);

        elements.imageInput = findElement([
            "item-image",
            "product-image",
            "image-file",
            "product-image-input"
        ]);

        elements.imageUrl = findElement([
            "item-image-url",
            "product-image-url",
            "image-url"
        ]);

        elements.imagePreview = findElement([
            "image-preview",
            "product-image-preview",
            "item-image-preview"
        ]);

        elements.cancelButton = findElement([
            "cancel-edit",
            "cancel-product",
            "cancel-button"
        ]);

        elements.submitButton = elements.form
            ? elements.form.querySelector(
                'button[type="submit"], input[type="submit"]'
            )
            : null;
    }

    function findElement(ids) {
        for (const id of ids) {
            const element = byId(id);
            if (element) return element;
        }

        return null;
    }

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, (character) => {
            const replacements = {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"
            };

            return replacements[character];
        });
    }

    function formatPrice(value) {
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

    function setHidden(element, hidden) {
        if (element) {
            element.hidden = hidden;
        }
    }

    function showMessage(message, type = "success") {
        if (elements.message) {
            elements.message.textContent = message;
            elements.message.classList.toggle(
                "error",
                type === "error"
            );
            elements.message.hidden = false;
            elements.message.setAttribute("role", "status");
            return;
        }

        console[type === "error" ? "error" : "log"](message);
    }

    function clearMessage() {
        if (!elements.message) return;

        elements.message.textContent = "";
        elements.message.hidden = true;
        elements.message.classList.remove("error");
    }

    function setLoading(isLoading) {
        state.loading = isLoading;

        setHidden(elements.loading, !isLoading);

        if (elements.retry) {
            elements.retry.disabled = isLoading;
        }
    }

    function setSaving(isSaving) {
        state.saving = isSaving;

        if (elements.submitButton) {
            elements.submitButton.disabled = isSaving;
            elements.submitButton.textContent = isSaving
                ? "Saving..."
                : (
                    state.editingProductId
                        ? "Save Changes"
                        : "Add Product"
                );
        }
    }

    /* -----------------------------------------------------
       3. SUPABASE AUTHENTICATION
       ----------------------------------------------------- */

    async function getAuthenticatedUser() {
        const supabase = SUPABASE();

        if (!supabase) {
            throw new Error(
                "Supabase was not initialized. Check javascript/supabase.js."
            );
        }

        const { data, error } = await supabase.auth.getUser();

        if (error) throw error;

        if (!data || !data.user) {
            window.location.href = "./login.html";
            return null;
        }

        state.user = data.user;
        return data.user;
    }

    async function getAuthenticatedBusiness() {
        const supabase = SUPABASE();
        const user = state.user || await getAuthenticatedUser();

        if (!user) return null;

        const { data, error } = await supabase
            .from("businesses")
            .select("id, name, owner_id, is_published")
            .eq("owner_id", user.id)
            .maybeSingle();

        if (error) {
            throw new Error(
                `Unable to load your business: ${error.message}`
            );
        }

        if (!data) {
            state.business = null;
            throw new Error(
                "No business profile was found for this account."
            );
        }

        state.business = data;
        return data;
    }

    /* -----------------------------------------------------
       4. LOAD PRODUCTS
       ----------------------------------------------------- */

    async function loadProducts() {
        if (state.loading) return;

        clearMessage();
        setLoading(true);

        setHidden(elements.error, true);
        setHidden(elements.empty, true);
        setHidden(elements.noResults, true);

        try {
            const supabase = SUPABASE();

            if (!supabase) {
                throw new Error(
                    "Supabase client is missing. Check javascript/supabase.js."
                );
            }

            if (!state.user) {
                await getAuthenticatedUser();
            }

            if (!state.user) return;

            if (!state.business) {
                await getAuthenticatedBusiness();
            }

            if (!state.business) return;

            /*
             * This query intentionally uses only the columns
             * already present in the previously supplied code.
             *
             * Do not add "category" here unless that column
             * exists in the Supabase products table.
             */
            const { data, error } = await supabase
                .from("products")
                .select(
                    "id, business_id, name, description, price, image_url, item_type, is_available, created_at"
                )
                .eq("business_id", state.business.id)
                .order("created_at", { ascending: false });

            if (error) throw error;

            state.products = Array.isArray(data) ? data : [];

            updateSummary();
            populateCategoryFilter();
            renderProducts();
        } catch (error) {
            console.error("Catalogue loading failed:", error);

            setHidden(elements.error, false);
            setHidden(elements.empty, true);
            setHidden(elements.noResults, true);

            showMessage(
                error.message || "Unable to load your catalogue.",
                "error"
            );
        } finally {
            setLoading(false);
        }
    }

    /* -----------------------------------------------------
       5. SUMMARY CARDS
       ----------------------------------------------------- */

    function updateSummary() {
        const products = state.products;

        const availableCount = products.filter(
            (product) => product.is_available === true
        ).length;

        /*
         * The supplied query does not include a category column.
         * Count distinct item_type values for this summary until
         * a real category column is confirmed in your database.
         */
        const categories = new Set(
            products
                .map((product) => product.item_type)
                .filter(Boolean)
        );

        if (elements.totalProducts) {
            elements.totalProducts.textContent = products.length;
        }

        if (elements.availableProducts) {
            elements.availableProducts.textContent = availableCount;
        }

        if (elements.categoryCount) {
            elements.categoryCount.textContent = categories.size;
        }
    }

    /* -----------------------------------------------------
       6. FILTER OPTIONS
       ----------------------------------------------------- */

    function populateCategoryFilter() {
        const select = elements.filterCategory;

        if (!select) return;

        const previousValue = select.value;

        const values = [
            ...new Set(
                state.products
                    .map((product) => product.item_type)
                    .filter(Boolean)
            )
        ].sort((a, b) => String(a).localeCompare(String(b)));

        select.replaceChildren();

        const defaultOption = document.createElement("option");
        defaultOption.value = "";
        defaultOption.textContent = "All categories";
        select.appendChild(defaultOption);

        values.forEach((value) => {
            const option = document.createElement("option");
            option.value = value;
            option.textContent = value;
            select.appendChild(option);
        });

        if (values.includes(previousValue)) {
            select.value = previousValue;
        }
    }

    /* -----------------------------------------------------
       7. FILTERING
       ----------------------------------------------------- */

    function getFilteredProducts() {
        const searchTerm = (elements.search?.value || "")
            .trim()
            .toLowerCase();

        const selectedType = elements.filterType?.value || "";
        const selectedCategory = elements.filterCategory?.value || "";
        const selectedAvailability =
            elements.filterAvailability?.value || "";

        return state.products.filter((product) => {
            const name = String(product.name || "").toLowerCase();
            const description = String(
                product.description || ""
            ).toLowerCase();

            const matchesSearch =
                !searchTerm ||
                name.includes(searchTerm) ||
                description.includes(searchTerm);

            const matchesType =
                !selectedType ||
                String(product.item_type || "") === selectedType;

            /*
             * Until a category column exists, the category filter
             * uses item_type. This avoids querying a nonexistent
             * database field.
             */
            const matchesCategory =
                !selectedCategory ||
                String(product.item_type || "") === selectedCategory;

            let matchesAvailability = true;

            if (
                selectedAvailability === "available" ||
                selectedAvailability === "true"
            ) {
                matchesAvailability = product.is_available === true;
            } else if (
                selectedAvailability === "unavailable" ||
                selectedAvailability === "false"
            ) {
                matchesAvailability = product.is_available === false;
            }

            return (
                matchesSearch &&
                matchesType &&
                matchesCategory &&
                matchesAvailability
            );
        });
    }

    function hasActiveFilters() {
        return Boolean(
            elements.search?.value.trim() ||
            elements.filterType?.value ||
            elements.filterCategory?.value ||
            elements.filterAvailability?.value
        );
    }

    function clearFilters() {
        if (elements.search) elements.search.value = "";
        if (elements.filterType) elements.filterType.value = "";
        if (elements.filterCategory) elements.filterCategory.value = "";
        if (elements.filterAvailability) {
            elements.filterAvailability.value = "";
        }

        renderProducts();
    }

    /* -----------------------------------------------------
       8. RENDER PRODUCT CARDS
       ----------------------------------------------------- */

    function renderProducts() {
        if (!elements.grid) {
            console.error(
                'Missing catalogue grid element: expected id="catalogue-grid".'
            );
            return;
        }

        const filteredProducts = getFilteredProducts();

        elements.grid.replaceChildren();

        setHidden(elements.loading, state.loading);
        setHidden(elements.error, true);

        if (state.products.length === 0) {
            setHidden(elements.empty, false);
            setHidden(elements.noResults, true);
            return;
        }

        setHidden(elements.empty, true);

        if (filteredProducts.length === 0) {
            setHidden(elements.noResults, false);
            return;
        }

        setHidden(elements.noResults, true);

        const fragment = document.createDocumentFragment();

        filteredProducts.forEach((product) => {
            fragment.appendChild(createProductCard(product));
        });

        elements.grid.appendChild(fragment);
    }

    function createProductCard(product) {
        const card = document.createElement("article");
        card.className = "product-card catalogue-product-card";
        card.dataset.productId = product.id;

        const name = escapeHTML(product.name || "Untitled product");
        const description = escapeHTML(
            product.description || "No description provided."
        );
        const type = escapeHTML(product.item_type || "Product");
        const price = escapeHTML(formatPrice(product.price));

        const available = product.is_available === true;
        const availabilityText = available ? "Available" : "Unavailable";
        const availabilityClass = available
            ? "available"
            : "unavailable";

        const imageUrl = safeImageUrl(product.image_url);

        card.innerHTML = `
            <div class="product-card-image">
                ${
                    imageUrl
                        ? `<img src="${escapeHTML(imageUrl)}"
                                alt="${name}"
                                loading="lazy">`
                        : `<div class="product-image-placeholder"
                                aria-label="No product image">B</div>`
                }
                <span class="product-type-badge">${type}</span>
            </div>

            <div class="product-card-content">
                <div class="product-card-heading">
                    <h3>${name}</h3>
                    <span class="product-availability ${availabilityClass}">
                        ${availabilityText}
                    </span>
                </div>

                <p class="product-card-description">${description}</p>

                <div class="product-card-footer">
                    <strong class="product-card-price">${price}</strong>

                    <div class="product-card-actions">
                        <button type="button"
                                class="edit-product-button"
                                data-action="edit"
                                data-id="${escapeHTML(product.id)}">
                            Edit
                        </button>

                        <button type="button"
                                class="toggle-product-button"
                                data-action="toggle"
                                data-id="${escapeHTML(product.id)}">
                            ${available ? "Mark unavailable" : "Mark available"}
                        </button>

                        <button type="button"
                                class="delete-product-button"
                                data-action="delete"
                                data-id="${escapeHTML(product.id)}">
                            Delete
                        </button>
                    </div>
                </div>
            </div>
        `;

        const image = card.querySelector("img");

        if (image) {
            image.addEventListener("error", () => {
                const placeholder = document.createElement("div");
                placeholder.className = "product-image-placeholder";
                placeholder.textContent = "B";
                placeholder.setAttribute("aria-label", "Image unavailable");
                image.replaceWith(placeholder);
            }, { once: true });
        }

        return card;
    }

    function safeImageUrl(value) {
        if (!value) return "";

        try {
            const url = new URL(value, window.location.href);

            if (url.protocol !== "http:" && url.protocol !== "https:") {
                return "";
            }

            return url.href;
        } catch {
            return "";
        }
    }

    /* -----------------------------------------------------
       9. OPEN AND RESET FORM
       -------------------------------*/

    function openEditor() {
        if (!elements.editor) return;

        elements.editor.hidden = false;
        elements.editor.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }

    function closeEditor() {
        resetForm();

        if (elements.editor) {
            elements.editor.hidden = true;
        }
    }

    function resetForm() {
        if (elements.form) {
            elements.form.reset();
        }

        state.editingProductId = null;

        if (elements.editorTitle) {
            elements.editorTitle.textContent = "Add Product";
        }

        if (elements.submitButton) {
            elements.submitButton.textContent = "Add Product";
            elements.submitButton.disabled = false;
        }

        if (elements.imagePreview) {
            elements.imagePreview.replaceChildren();
            elements.imagePreview.hidden = true;
        }

        if (elements.imageUrl) {
            elements.imageUrl.value = "";
        }

        setSaving(false);
    }

    function startAddProduct() {
        resetForm();
        openEditor();
    }

    function startEditProduct(productId) {
        const product = state.products.find(
            (item) => String(item.id) === String(productId)
        );

        if (!product) {
            showMessage("That product could not be found.", "error");
            return;
        }

        resetForm();

        state.editingProductId = product.id;

        if (elements.name) {
            elements.name.value = product.name || "";
        }

        if (elements.description) {
            elements.description.value = product.description || "";
        }

        if (elements.price) {
            elements.price.value = product.price ?? "";
        }

        if (elements.type) {
            elements.type.value = product.item_type || "";
        }

        if (elements.category) {
            /*
             * The current known database query has no category
             * column. Do not populate category from an assumed
             * database value.
             */
            elements.category.value = "";
        }

        if (elements.availability) {
            if (elements.availability.type === "checkbox") {
                elements.availability.checked =
                    product.is_available === true;
            } else {
                elements.availability.value =
                    String(product.is_available === true);
            }
        }

        if (elements.imageUrl) {
            elements.imageUrl.value = product.image_url || "";
        }

        if (elements.editorTitle) {
            elements.editorTitle.textContent = "Edit Product";
        }

        if (elements.imagePreview && product.image_url) {
            elements.imagePreview.innerHTML = `
                <img src="${escapeHTML(safeImageUrl(product.image_url))}"
                     alt="Current product image">
            `;
            elements.imagePreview.hidden = false;
        }

        openEditor();
    }

    /* -----------------------------------------------------
       10. FORM VALUES AND VALIDATION
       ----------------------------------------------------- */

    function getFormValue(element) {
        return element ? String(element.value ?? "").trim() : "";
    }

    function getAvailabilityValue() {
        const element = elements.availability;

        if (!element) return true;

        if (element.type === "checkbox") {
            return element.checked;
        }

        return element.value !== "false";
    }

    function validateForm() {
        if (!elements.form) {
            throw new Error(
                "Product form not found. Check the form ID in products.html."
            );
        }

        if (!elements.name) {
            throw new Error(
                "Product name field not found. Expected item-name or product-name."
            );
        }

        const name = getFormValue(elements.name);
        const priceText = getFormValue(elements.price);

        if (!name) {
            elements.name.focus();
            throw new Error("Please enter a product name.");
        }

        if (!priceText) {
            elements.price?.focus();
            throw new Error("Please enter a product price.");
        }

        const price = Number(priceText);

        if (!Number.isFinite(price) || price < 0) {
            elements.price?.focus();
            throw new Error("Enter a valid non-negative price.");
        }

        return {
            name,
            description: getFormValue(elements.description),
            price,
            item_type: getFormValue(elements.type) || "Product",
            is_available: getAvailabilityValue()
        };
    }

    /* -----------------------------------------------------
       11. IMAGE UPLOAD
       ----------------------------------------------------- */

    async function uploadProductImage(productId) {
        const file = elements.imageInput?.files?.[0];

        if (!file) {
            return getFormValue(elements.imageUrl) || null;
        }

        if (!file.type.startsWith("image/")) {
            throw new Error("Please select a valid image file.");
        }

        const maxSize = 5 * 1024 * 1024;

        if (file.size > maxSize) {
            throw new Error("The image must be smaller than 5 MB.");
        }

        const supabase = SUPABASE();

        const extension = (
            file.name.split(".").pop() || "jpg"
        ).toLowerCase().replace(/[^a-z0-9]/g, "");

        const filePath =
            `${state.business.id}/${productId}/${Date.now()}.${extension}`;

        const { error: uploadError } = await supabase
            .storage
            .from(STORAGE_BUCKET)
            .upload(filePath, file, {
                upsert: true,
                contentType: file.type
            });

        if (uploadError) {
            throw new Error(
                `Image upload failed: ${uploadError.message}`
            );
        }

        const { data } = supabase
            .storage
            .from(STORAGE_BUCKET)
            .getPublicUrl(filePath);

        return data?.publicUrl || null;
    }

    /* -----------------------------------------------------
       12. SAVE PRODUCT
       ----------------------------------------------------- */

    async function saveProduct(event) {
        event.preventDefault();

        if (state.saving) return;

        clearMessage();
        setSaving(true);

        let uploadedProductId = null;

        try {
            const supabase = SUPABASE();

            if (!state.user) {
                await getAuthenticatedUser();
            }

            if (!state.business) {
                await getAuthenticatedBusiness();
            }

            const formData = validateForm();
            const isEditing = Boolean(state.editingProductId);

            let productId = state.editingProductId;

            if (!isEditing) {
                /*
                 * Insert first to obtain the new product ID.
                 * Image upload follows, then the image URL is
                 * written back to the same product record.
                 */
                const { data, error } = await supabase
                    .from("products")
                    .insert({
                        business_id: state.business.id,
                        ...formData,
                        image_url: getFormValue(elements.imageUrl) || null
                    })
                    .select("id")
                    .single();

                if (error) throw error;

                productId = data.id;
                uploadedProductId = productId;
            } else {
                const { error } = await supabase
                    .from("products")
                    .update(formData)
                    .eq("id", productId)
                    .eq("business_id", state.business.id);

                if (error) throw error;
            }

            const selectedImageFile =
                elements.imageInput?.files?.[0];

            if (selectedImageFile) {
                const imageUrl = await uploadProductImage(productId);

                const { error } = await supabase
                    .from("products")
                    .update({ image_url: imageUrl })
                    .eq("id", productId)
                    .eq("business_id", state.business.id);

                if (error) throw error;
            } else if (isEditing && elements.imageUrl) {
                const imageUrl = getFormValue(elements.imageUrl) || null;

                const { error } = await supabase
                    .from("products")
                    .update({ image_url: imageUrl })
                    .eq("id", productId)
                    .eq("business_id", state.business.id);

                if (error) throw error;
            }

            closeEditor();

            showMessage(
                isEditing
                    ? "Product updated successfully."
                    : "Product added successfully."
            );

            await loadProducts();
        } catch (error) {
            console.error("Saving product failed:", error);

            /*
             * If image upload fails after insertion, leave the
             * inserted product in place. This avoids silently
             * deleting a user's product because of an image error.
             */
            showMessage(
                error.message || "Unable to save this product.",
                "error"
            );
        } finally {
            setSaving(false);
        }
    }
/* -----------------------------------------------------
       13. AVAILABILITY TOGGLE
       ----------------------------------------------------- */

    async function toggleProductAvailability(productId) {
        const product = state.products.find(
            (item) => String(item.id) === String(productId)
        );

        if (!product || !state.business) return;

        const newAvailability = product.is_available !== true;

        try {
            const { error } = await SUPABASE()
                .from("products")
                .update({ is_available: newAvailability })
                .eq("id", product.id)
                .eq("business_id", state.business.id);

            if (error) throw error;

            product.is_available = newAvailability;

            updateSummary();
            renderProducts();

            showMessage(
                newAvailability
                    ? "Product marked as available."
                    : "Product marked as unavailable."
            );
        } catch (error) {
            console.error("Availability update failed:", error);

            showMessage(
                error.message || "Could not update availability.",
                "error"
            );
        }
    }

    /* -----------------------------------------------------
       14. DELETE PRODUCT
       ----------------------------------------------------- */

    async function deleteProduct(productId) {
        const product = state.products.find(
            (item) => String(item.id) === String(productId)
        );

        if (!product || !state.business) return;

        const confirmed = window.confirm(
            `Delete "${product.name || "this product"}"? This cannot be undone.`
        );

        if (!confirmed) return;

        try {
            const { error } = await SUPABASE()
                .from("products")
                .delete()
                .eq("id", product.id)
                .eq("business_id", state.business.id);

            if (error) throw error;

            state.products = state.products.filter(
                (item) => String(item.id) !== String(productId)
            );

            updateSummary();
            populateCategoryFilter();
            renderProducts();

            showMessage("Product deleted successfully.");
        } catch (error) {
            console.error("Product deletion failed:", error);

            showMessage(
                error.message || "Unable to delete this product.",
                "error"
            );
        }
    }

    /* -----------------------------------------------------
       15. MOBILE SIDEBAR
       ----------------------------------------------------- */

    function setupMobileNavigation() {
        const sidebar = elements.sidebar;
        const menuButton = elements.mobileMenuButton;
        const overlay = elements.sidebarOverlay;

        if (!sidebar || !menuButton) return;

        function closeSidebar() {
            sidebar.classList.remove("is-open");
            document.body.classList.remove("sidebar-open");

            if (overlay) {
                overlay.classList.remove("is-visible");
                overlay.hidden = true;
            }

            menuButton.setAttribute("aria-expanded", "false");
        }

        function openSidebar() {
            sidebar.classList.add("is-open");
            document.body.classList.add("sidebar-open");

            if (overlay) {
                overlay.hidden = false;
                overlay.classList.add("is-visible");
            }

            menuButton.setAttribute("aria-expanded", "true");
        }

        menuButton.addEventListener("click", () => {
            const isOpen = sidebar.classList.contains("is-open");

            if (isOpen) {
                closeSidebar();
            } else {
                openSidebar();
            }
        });

        overlay?.addEventListener("click", closeSidebar);

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
    }

    /* -----------------------------------------------------
       16. EVENT LISTENERS
       ----------------------------------------------------- */

    function setupEventListeners() {
        elements.form?.addEventListener("submit", saveProduct);

        elements.retry?.addEventListener("click", loadProducts);

        elements.search?.addEventListener("input", renderProducts);

        elements.filterType?.addEventListener("change", renderProducts);

        elements.filterCategory?.addEventListener(
            "change",
            renderProducts
        );

        elements.filterAvailability?.addEventListener(
            "change",
            renderProducts
        );

        elements.clearFilters?.addEventListener("click", clearFilters);

        elements.emptyAddButton?.addEventListener(
            "click",
            startAddProduct
        );

        elements.cancelButton?.addEventListener(
            "click",
            closeEditor
        );

        /*
         * Support any existing "Add Product" button without
         * requiring a specific new ID in the HTML.
         */
        document.querySelectorAll(
            '[data-action="add-product"], #add-product-button, #add-item-button'
        ).forEach((button) => {
            button.addEventListener("click", startAddProduct);
        });

        elements.grid?.addEventListener("click", async (event) => {
            const button = event.target.closest("button[data-action]");

            if (!button) return;

            const action = button.dataset.action;
            const productId = button.dataset.id;

            if (!productId) return;

            if (action === "edit") {
                startEditProduct(productId);
            } else if (action === "toggle") {
                await toggleProductAvailability(productId);
            } else if (action === "delete") {
                await deleteProduct(productId);
            }
        });

        elements.imageInput?.addEventListener("change", () => {
            const file = elements.imageInput.files?.[0];

            if (!elements.imagePreview) return;

            elements.imagePreview.replaceChildren();

            if (!file) {
                elements.imagePreview.hidden = true;
                return;
            }

            if (!file.type.startsWith("image/")) {
                showMessage("Please select an image file.", "error");
                elements.imageInput.value = "";
                elements.imagePreview.hidden = true;
                return;
            }

            const image = document.createElement("img");
            image.alt = "Selected product image";
            image.src = URL.createObjectURL(file);

            image.addEventListener("load", () => {
                URL.revokeObjectURL(image.src);
            }, { once: true });

            elements.imagePreview.appendChild(image);
            elements.imagePreview.hidden = false;
        });

        setupMobileNavigation();
    }

    /* -----------------------------------------------------
 17. INITIALIZATION
       ----------------------------------------------------- */

    async function initialize() {
        if (state.initialized) return;

        state.initialized = true;

        cacheElements();
        setupEventListeners();

        if (!elements.grid) {
            console.error(
                'Cannot initialize catalogue: #catalogue-grid is missing.'
            );

            showMessage(
                "The catalogue grid is missing from products.html.",
                "error"
            );

            setHidden(elements.loading, true);
            setHidden(elements.error, false);
            return;
        }

        setHidden(elements.loading, false);
        setHidden(elements.error, true);

        await loadProducts();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initialize, {
            once: true
        });
    } else {
        initialize();
    }
})();
(() => {
    "use strict";

    const supabase = window.bizoraSupabase;

    const CONFIG = {
        table: "products",
        businessesTable: "businesses",
        storageBucket: "product-images",
        maxImageSize: 5 * 1024 * 1024,
        allowedImageTypes: ["image/jpeg", "image/png", "image/webp"]
    };

    const $ = (id) => document.getElementById(id);

    const elements = {
        form: $("product-form"),
        productId: $("product-id"),
        name: $("item-name"),
        type: $("item-type"),
        category: $("item-category"),
        description: $("item-description"),
        price: $("item-price"),
        available: $("item-available"),
        image: $("item-image"),
        imagePreview: $("image-preview-img"),
        imagePlaceholder: $("image-placeholder"),
        removeImage: $("remove-image"),
        uploadArea: $("image-upload-area"),
        nameError: $("name-error"),
        typeError: $("type-error"),
        priceError: $("price-error"),
        imageError: $("image-error"),
        descriptionCount: $("description-count"),
        totalItems: $("total-items"),
        availableItems: $("available-items"),
        unavailableItems: $("unavailable-items"),
        filter: $("item-filter"),
        grid: $("catalogue-grid"),
        loading: $("catalogue-loading"),
        empty: $("catalogue-empty"),
        error: $("catalogue-error"),
        errorMessage: $("catalogue-error-message"),
        retry: $("retry-loading"),
        noResults: $("no-results"),
        clearFilter: $("clear-filter"),
        emptyAddButton: $("empty-add-button"),
        formTitle: $("form-title"),
        saveButton: $("save-item"),
        saveButtonText: $("save-button-text"),
        cancelEdit: $("cancel-edit"),
        resetForm: $("reset-form"),
        formStatus: $("form-status"),
        toast: $("products-toast"),
        sidebar: $("sidebar"),
        menuButton: $("mobile-menu-button"),
        sidebarOverlay: $("sidebar-overlay"),
        logoutButton: $("logout-button")
    };

    let currentUser = null;
    let currentBusiness = null;
    let products = [];
    let originalImageUrl = "";
    let selectedImage = null;
    let imageRemoved = false;
    let isEditing = false;
    let isSaving = false;
    let toastTimer = null;
    let imagePreviewUrl = null;

    function showToast(message, type = "success") {
        if (!elements.toast) return;

        clearTimeout(toastTimer);

        elements.toast.textContent = message;
        elements.toast.className = `toast ${type}`;
        elements.toast.hidden = false;

        toastTimer = setTimeout(() => {
            elements.toast.hidden = true;
        }, 3500);
    }

    function setStatus(message = "", type = "") {
        if (!elements.formStatus) return;

        elements.formStatus.textContent = message;
        elements.formStatus.className = `form-status${type ? ` ${type}` : ""}`;
    }

    function setFieldError(element, message = "") {
        if (element) {
            element.textContent = message;
        }
    }

    function setLoading(isLoading) {
        elements.loading.hidden = !isLoading;
    }

    function setButtonLoading(loading) {
        elements.saveButton.disabled = loading;
        elements.saveButtonText.textContent = loading
            ? "Saving..."
            : isEditing
                ? "Save changes"
                : "Add to catalogue";
    }

    function formatPrice(price) {
        if (price === null || price === undefined || price === "") {
            return "Price on enquiry";
        }

        return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 2
        }).format(Number(price));
    }

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, (character) => {
            const entities = {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"
            };

            return entities[character];
        });
    }

    function getImagePath(imageUrl) {
        if (!imageUrl) return null;

        const marker = `/storage/v1/object/public/${CONFIG.storageBucket}/`;
        const index = imageUrl.indexOf(marker);

        if (index !== -1) {
            return imageUrl.slice(index + marker.length).split("?")[0];
        }

        return null;
    }

    function getProductImageUrl(imageUrl) {
        if (!imageUrl) return "";

        const path = getImagePath(imageUrl);

        if (!path) {
            return imageUrl;
        }

        const { data } = supabase.storage
            .from(CONFIG.storageBucket)
            .getPublicUrl(path);

        return data.publicUrl;
    }

    function revokeImagePreview() {
        if (imagePreviewUrl) {
            URL.revokeObjectURL(imagePreviewUrl);
            imagePreviewUrl = null;
        }
    }

    function showImagePreview(file) {
        revokeImagePreview();

        if (file) {
            imagePreviewUrl = URL.createObjectURL(file);
            elements.imagePreview.src = imagePreviewUrl;
            elements.imagePreview.hidden = false;
            elements.imagePlaceholder.hidden = true;
            elements.removeImage.hidden = false;
            return;
        }

        elements.imagePreview.removeAttribute("src");
        elements.imagePreview.hidden = true;
        elements.imagePlaceholder.hidden = false;
        elements.removeImage.hidden = true;
    }

    function resetImageState() {
        selectedImage = null;
        imageRemoved = false;
        originalImageUrl = "";

        if (elements.image) {
            elements.image.value = "";
        }

        showImagePreview(null);
    }

    function clearValidation() {
        setFieldError(elements.nameError);
        setFieldError(elements.typeError);
        setFieldError(elements.priceError);
        setFieldError(elements.imageError);

        [
            elements.name,
            elements.type,
            elements.price,
            elements.image
        ].forEach((element) => {
            if (element) {
                element.removeAttribute("aria-invalid");
            }
        });
    }

    function validateForm() {
        clearValidation();

        let valid = true;

        const name = elements.name.value.trim();
        const priceValue = elements.price.value.trim();

        if (!name) {
            setFieldError(elements.nameError, "Please enter an item name.");
            elements.name.setAttribute("aria-invalid", "true");
            valid = false;
        } else if (name.length > 100) {
            setFieldError(elements.nameError, "The name cannot exceed 100 characters.");
            elements.name.setAttribute("aria-invalid", "true");
            valid = false;
        }

        if (!["product", "service"].includes(elements.type.value)) {
            setFieldError(elements.typeError, "Choose a valid item type.");
            elements.type.setAttribute("aria-invalid", "true");
            valid = false;
        }

        if (priceValue !== "") {
            const price = Number(priceValue);

            if (
                !Number.isFinite(price) ||
                price < 0 ||
                price > 99999999 ||
                !/^\d+(\.\d{1,2})?$/.test(priceValue)
            ) {
                setFieldError(
                    elements.priceError,
                    "Enter a valid price with up to two decimal places."
                );

                elements.price.setAttribute("aria-invalid", "true");
                valid = false;
            }
        }

        if (selectedImage) {
            if (!CONFIG.allowedImageTypes.includes(selectedImage.type)) {
                setFieldError(
                    elements.imageError,
                    "Choose a JPG, PNG, or WebP image."
                );

                valid = false;
            } else if (selectedImage.size > CONFIG.maxImageSize) {
                setFieldError(
                    elements.imageError,
                    "The image must be 5 MB or smaller."
                );

                valid = false;
            }
        }

        return valid;
    }

    async function getAuthenticatedBusiness() {
        const {
            data: { user },
            error: authError
        } = await supabase.auth.getUser();

        if (authError) throw authError;

        if (!user) {
            window.location.replace("./auth.html");
            return null;
        }

        currentUser = user;

        const { data, error } = await supabase
            .from(CONFIG.businessesTable)
            .select("id, name, owner_id, is_published")
            .eq("owner_id", user.id)
            .maybeSingle();

        if (error) throw error;

        if (!data) {
            showToast("Create your business profile before adding items.", "error");

            setTimeout(() => {
                window.location.href = "./create-business.html";
            }, 1200);

            return null;
        }

        currentBusiness = data;

        return data;
    }

    async function loadProducts() {
        elements.error.hidden = true;
        elements.noResults.hidden = true;

        setLoading(true);

        try {
            if (!currentBusiness) {
                await getAuthenticatedBusiness();
            }

            if (!currentBusiness) return;

            const { data, error } = await supabase
                .from(CONFIG.table)
                .select(
                    "id, business_id, name, description, price, image_url, item_type, is_available, created_at"
                )
                .eq("business_id", currentBusiness.id)
                .order("created_at", { ascending: false });

            if (error) throw error;

            products = data || [];

            updateSummary();
            renderProducts();
        } catch (error) {
            console.error("Could not load products:", error);

            elements.errorMessage.textContent =
                error.message || "Please check your connection and try again.";

            elements.error.hidden = false;
            elements.grid.replaceChildren();
            elements.empty.hidden = true;
        } finally {
            setLoading(false);
        }
    }

    function updateSummary() {
        elements.totalItems.textContent = products.length;

        elements.availableItems.textContent = products.filter(
            (product) => product.is_available
        ).length;

        elements.unavailableItems.textContent = products.filter(
            (product) => !product.is_available
        ).length;
    }

    function getFilteredProducts() {
        const filter = elements.filter.value;

        return products.filter((product) => {
            switch (filter) {
                case "product":
                    return product.item_type === "product";

                case "service":
                    return product.item_type === "service";

                case "available":
                    return product.is_available;

                case "unavailable":
                    return !product.is_available;

                default:
                    return true;
            }
        });
    }

    function createProductCard(product) {
        const card = document.createElement("article");
        card.className = "catalogue-card";

        const imageContainer = document.createElement("div");
        imageContainer.className = "catalogue-card-image";

        const imageUrl = getProductImageUrl(product.image_url);

        if (imageUrl) {
            const image = document.createElement("img");

            image.src = imageUrl;
            image.alt = product.name;
            image.loading = "lazy";
            image.decoding = "async";

            image.addEventListener("error", () => {
                image.remove();

                const placeholder = document.createElement("div");
                placeholder.className = "catalogue-card-placeholder";
                placeholder.setAttribute("aria-label", "Image unavailable");

                const icon = document.createElement("span");
                icon.setAttribute("aria-hidden", "true");
                icon.textContent = "▧";

                placeholder.append(icon);
                imageContainer.prepend(placeholder);
            }, { once: true });

            imageContainer.append(image);
        } else {
            const placeholder = document.createElement("div");
            placeholder.className = "catalogue-card-placeholder";

            const icon = document.createElement("span");
            icon.setAttribute("aria-hidden", "true");
            icon.textContent = "▧";

            placeholder.append(icon);
            imageContainer.append(placeholder);
        }

        const type = document.createElement("span");
        type.className = "catalogue-card-type";
        type.textContent = product.item_type === "service" ? "Service" : "Product";

        imageContainer.append(type);

        const content = document.createElement("div");
        content.className = "catalogue-card-content";

        const title = document.createElement("h3");
        title.className = "catalogue-card-title";
        title.textContent = product.name;

        const description = document.createElement("p");
        description.className = "catalogue-card-description";
        description.textContent = product.description || "No description added yet.";

        const footer = document.createElement("div");
        footer.className = "catalogue-card-footer";

        const price = document.createElement("span");
        price.className = "catalogue-card-price";
        price.textContent = formatPrice(product.price);

        const availability = document.createElement("span");
        availability.className = "catalogue-card-availability";
        availability.textContent = product.is_available ? "Available" : "Unavailable";

        if (!product.is_available) {
            availability.classList.add("unavailable");
        }

        footer.append(price, availability);

        const actions = document.createElement("div");
        actions.className = "catalogue-card-actions";

        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.className = "catalogue-card-edit";
        editButton.textContent = "Edit";
        editButton.addEventListener("click", () => editProduct(product.id));

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "catalogue-card-delete";
        deleteButton.textContent = "Delete";
        deleteButton.addEventListener("click", () => deleteProduct(product.id));

        actions.append(editButton, deleteButton);
        content.append(title, description, footer, actions);
        card.append(imageContainer, content);

        return card;
    }

    function renderProducts() {
        elements.grid.replaceChildren();

        const filteredProducts = getFilteredProducts();

        elements.empty.hidden = products.length !== 0;
        elements.noResults.hidden =
            products.length === 0 || filteredProducts.length !== 0;

        if (products.length === 0) {
            return;
        }

        filteredProducts.forEach((product) => {
            elements.grid.append(createProductCard(product));
        });
    }

    async function uploadImage(file) {
        if (!file) return null;

        if (!currentUser || !currentBusiness) {
            throw new Error("Your business session has expired. Please sign in again.");
        }

        const extensionByType = {
            "image/jpeg": "jpg",
            "image/png": "png",
            "image/webp": "webp"
        };

        const extension = extensionByType[file.type];

        if (!extension) {
            throw new Error("Unsupported image format.");
        }

        const path = `${currentUser.id}/${currentBusiness.id}/${crypto.randomUUID()}.${extension}`;

        const { error } = await supabase.storage
            .from(CONFIG.storageBucket)
            .upload(path, file, {
                contentType: file.type,
                upsert: false
            });

        if (error) throw error;

        const { data } = supabase.storage
            .from(CONFIG.storageBucket)
            .getPublicUrl(path);

        return data.publicUrl;
    }

    async function removeStoredImage(imageUrl) {
        const path = getImagePath(imageUrl);

        if (!path) return;

        const { error } = await supabase.storage
            .from(CONFIG.storageBucket)
            .remove([path]);

        if (error) {
            console.error("Could not remove stored image:", error);
        }
    }

    async function saveProduct(event) {
        event.preventDefault();

        if (isSaving) return;

        setStatus("");

        if (!validateForm()) {
            setStatus("Please correct the highlighted fields.", "error");
            return;
        }

        isSaving = true;
        setButtonLoading(true);

        let newlyUploadedImage = null;

        try {
            if (!currentBusiness) {
                await getAuthenticatedBusiness();
            }

            if (!currentBusiness || !currentUser) {
                throw new Error("Please sign in and create your business profile.");
            }

            const name = elements.name.value.trim();
            const description = elements.description.value.trim();
            const priceValue = elements.price.value.trim();

            let imageUrl = originalImageUrl;

            if (selectedImage) {
                newlyUploadedImage = await uploadImage(selectedImage);
                imageUrl = newlyUploadedImage;
            } else if (imageRemoved) {
                imageUrl = null;
            }

            const productData = {
                business_id: currentBusiness.id,
                name,
                description: description || null,
                price: priceValue === "" ? null : Number(priceValue),
                image_url: imageUrl,
                item_type: elements.type.value,
                is_available: elements.available.checked
            };

            const productId = elements.productId.value;

            let query;

            if (productId) {
                query = supabase
                    .from(CONFIG.table)
                    .update(productData)
                    .eq("id", productId)
                    .eq("business_id", currentBusiness.id)
                    .select("id")
                    .single();
            } else {
                query = supabase
                    .from(CONFIG.table)
                    .insert(productData)
                    .select("id")
                    .single();
            }

            const { error } = await query;

            if (error) throw error;

            if (
                selectedImage &&
                originalImageUrl &&
                originalImageUrl !== imageUrl
            ) {
                await removeStoredImage(originalImageUrl);
            }

            if (imageRemoved && originalImageUrl) {
                await removeStoredImage(originalImageUrl);
            }

            resetForm();
            await loadProducts();

            showToast(
                productId
                    ? "Your item has been updated."
                    : "Your item has been added to the catalogue."
            );

            setStatus(
                productId ? "Changes saved successfully." : "Item added successfully.",
                "success"
            );
        } catch (error) {
            console.error("Could not save product:", error);

            if (newlyUploadedImage) {
                await removeStoredImage(newlyUploadedImage);
            }

            const message = error.message || "Something went wrong while saving.";

            setStatus(message, "error");
            showToast(message, "error");
        } finally {
            isSaving = false;
            setButtonLoading(false);
        }
    }

    function editProduct(productId) {
        const product = products.find((item) => item.id === productId);

        if (!product) return;

        isEditing = true;

        elements.productId.value = product.id;
        elements.name.value = product.name || "";
        elements.type.value = product.item_type || "product";
        elements.description.value = product.description || "";
        elements.price.value = product.price ?? "";
        elements.available.checked = Boolean(product.is_available);

        /*
         * Category is not currently stored in the supplied products schema.
         * Keep the field blank rather than pretending the value is persisted.
         */
        elements.category.value = "";

        originalImageUrl = product.image_url || "";
        selectedImage = null;
        imageRemoved = false;

        if (originalImageUrl) {
            elements.imagePreview.src = getProductImageUrl(originalImageUrl);
            elements.imagePreview.hidden = false;
            elements.imagePlaceholder.hidden = true;
            elements.removeImage.hidden = false;
        } else {
            showImagePreview(null);
        }

        elements.formTitle.textContent = "Edit item";
        elements.saveButtonText.textContent = "Save changes";
        elements.cancelEdit.hidden = false;
        elements.resetForm.textContent = "Clear form";

        updateDescriptionCount();
        clearValidation();
        setStatus("Editing your selected item.");

        $("add-item-section").scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

        elements.name.focus({ preventScroll: true });
    }

    async function deleteProduct(productId) {
        const product = products.find((item) => item.id === productId);

        if (!product) return;

        const confirmed = window.confirm(
            `Delete "${product.name}" from your catalogue? This action cannot be undone.`
        );

        if (!confirmed) return;

        try {
            const { error } = await supabase
                .from(CONFIG.table)
                .delete()
                .eq("id", productId)
                .eq("business_id", currentBusiness.id);

            if (error) throw error;

            if (product.image_url) {
                await removeStoredImage(product.image_url);
            }

            if (elements.productId.value === productId) {
                resetForm();
            }

            await loadProducts();
            showToast("Item deleted successfully.");
        } catch (error) {
            console.error("Could not delete product:", error);
            showToast(error.message || "Could not delete this item.", "error");
        }
    }

    function updateDescriptionCount() {
        elements.descriptionCount.textContent =
            `${elements.description.value.length}/500`;
    }

    function resetForm() {
        elements.form.reset();

        elements.productId.value = "";
        elements.available.checked = true;

        isEditing = false;

        resetImageState();
        clearValidation();
        setStatus("");

        elements.formTitle.textContent = "Add a new item";
        elements.saveButtonText.textContent = "Add to catalogue";
        elements.cancelEdit.hidden = true;
        elements.resetForm.textContent = "Clear form";

        updateDescriptionCount();
    }

    function setupImageUpload() {
        elements.image.addEventListener("change", () => {
            const file = elements.image.files?.[0];

            if (!file) return;

            if (!CONFIG.allowedImageTypes.includes(file.type)) {
                setFieldError(elements.imageError, "Choose a JPG, PNG, or WebP image.");
                elements.image.value = "";
                return;
            }

            if (file.size > CONFIG.maxImageSize) {
                setFieldError(elements.imageError, "The image must be 5 MB or smaller.");
                elements.image.value = "";
                return;
            }

            setFieldError(elements.imageError);

            selectedImage = file;
            imageRemoved = false;

            showImagePreview(file);
        });

        elements.removeImage.addEventListener("click", () => {
            selectedImage = null;
            imageRemoved = true;
            elements.image.value = "";

            showImagePreview(null);
            setFieldError(elements.imageError);
        });
    }

    function setupMobileNavigation() {
        function setSidebarOpen(open) {
            elements.sidebar.classList.toggle("is-open", open);
            elements.sidebarOverlay.hidden = !open;
            elements.menuButton.setAttribute("aria-expanded", String(open));
            elements.menuButton.setAttribute(
                "aria-label",
                open ? "Close navigation" : "Open navigation"
            );

            document.body.style.overflow = open ? "hidden" : "";
        }

        elements.menuButton.addEventListener("click", () => {
            setSidebarOpen(!elements.sidebar.classList.contains("is-open"));
        });

        elements.sidebarOverlay.addEventListener("click", () => {
            setSidebarOpen(false);
        });

        elements.sidebar.querySelectorAll("a").forEach((link) => {
            link.addEventListener("click", () => setSidebarOpen(false));
        });

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
                setSidebarOpen(false);
            }
        });

        window.addEventListener("resize", () => {
            if (window.innerWidth > 950) {
                setSidebarOpen(false);
            }
        });
    }

    async function logout() {
        const confirmed = window.confirm("Are you sure you want to log out?");

        if (!confirmed) return;

        elements.logoutButton.disabled = true;

        try {
            const { error } = await supabase.auth.signOut();

            if (error) throw error;

            window.location.replace("./auth.html");
        } catch (error) {
            console.error("Logout failed:", error);
            showToast("Could not log out. Please try again.", "error");
            elements.logoutButton.disabled = false;
        }
    }

    function setupEventListeners() {
        elements.form.addEventListener("submit", saveProduct);

        elements.resetForm.addEventListener("click", () => {
            resetForm();
        });

        elements.cancelEdit.addEventListener("click", () => {
            resetForm();
            $("add-item-section").scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        });

        elements.filter.addEventListener("change", renderProducts);

        elements.retry.addEventListener("click", loadProducts);

        elements.clearFilter.addEventListener("click", () => {
            elements.filter.value = "all";
            renderProducts();
        });

        elements.emptyAddButton.addEventListener("click", () => {
            $("add-item-section").scrollIntoView({
                behavior: "smooth",
                block: "start"
            });

            elements.name.focus({ preventScroll: true });
        });

        elements.description.addEventListener("input", updateDescriptionCount);

        elements.logoutButton.addEventListener("click", logout);

        setupImageUpload();
        setupMobileNavigation();
    }

    async function initialize() {
        if (!supabase) {
            console.error("Bizora Supabase client was not initialized.");

            elements.errorMessage.textContent =
                "Supabase could not be initialized. Check javascript/supabase.js and the script loading order.";

            elements.error.hidden = false;
            elements.loading.hidden = true;
            return;
        }

        setupEventListeners();
        updateDescriptionCount();

        try {
            const business = await getAuthenticatedBusiness();

            if (!business) {
                setLoading(false);
                return;
            }

            await loadProducts();
        } catch (error) {
            console.error("Could not initialize products page:", error);

            elements.errorMessage.textContent =
                error.message || "Unable to load your business. Please try again.";

            elements.error.hidden = false;
            setLoading(false);
        }
    }

    document.addEventListener("DOMContentLoaded", initialize);
})();
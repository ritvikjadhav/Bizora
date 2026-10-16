(() => {
  "use strict";

  const supabase = window.bizoraSupabase;

  const elements = {
    category: document.getElementById("business-category"),
    shareButton: document.getElementById("share-storefront"),
    logo: document.getElementById("business-logo"),
    logoFallback: document.getElementById("business-logo-fallback"),
    name: document.getElementById("business-name"),
    location: document.getElementById("business-location"),
    address: document.getElementById("business-address"),
    description: document.getElementById("business-description"),
    contactActions: document.getElementById("business-contact-actions"),
    whatsapp: document.getElementById("whatsapp-link"),
    call: document.getElementById("call-link"),
    website: document.getElementById("website-link"),
    catalogueTitle: document.getElementById("catalogue-title"),
    catalogueCount: document.getElementById("catalogue-count"),
    catalogueGrid: document.getElementById("catalogue-grid"),
    catalogueLoading: document.getElementById("catalogue-loading"),
    catalogueEmpty: document.getElementById("catalogue-empty"),
    about: document.getElementById("business-about"),
    aboutDescription: document.getElementById("business-about-description"),
    instagram: document.getElementById("instagram-link"),
    error: document.getElementById("storefront-error"),
    errorTitle: document.getElementById("error-title"),
    errorDescription: document.getElementById("error-description"),
    toast: document.getElementById("storefront-toast")
  };

  let currentBusiness = null;
  let toastTimer = null;

  function showToast(message) {
    if (!elements.toast) return;

    elements.toast.textContent = message;
    elements.toast.hidden = false;

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
      elements.toast.hidden = true;
    }, 3000);
  }

  function setText(element, value) {
    if (!element) return;

    const text = typeof value === "string" ? value.trim() : "";

    element.textContent = text;
    element.hidden = !text;
  }

  function setLink(element, url, label) {
    if (!element) return;

    if (!url) {
      element.hidden = true;
      element.removeAttribute("href");
      return;
    }

    element.href = url;

    if (label) {
      element.setAttribute("aria-label", label);
    }

    element.hidden = false;
  }

  function normalizePhone(value) {
    const digits = String(value || "").replace(/\D/g, "");

    if (digits.length === 10) {
      return `91${digits}`;
    }

    if (digits.length === 11 && digits.startsWith("0")) {
      return `91${digits.slice(1)}`;
    }

    if (digits.length >= 11 && digits.length <= 15) {
      return digits;
    }

    return "";
  }

  function normalizeWebsite(value) {
    const input = String(value || "").trim();

    if (!input) return "";

    try {
      const url = new URL(
        /^https?:\/\//i.test(input) ? input : `https://${input}`
      );

      if (!["http:", "https:"].includes(url.protocol)) {
        return "";
      }

      return url.href;
    } catch {
      return "";
    }
  }

  function normalizeInstagram(value) {
    const input = String(value || "").trim();

    if (!input) return "";

    const username = input
      .replace(/^@/, "")
      .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
      .replace(/[/?#].*$/, "")
      .trim();

    if (!/^[a-zA-Z0-9._]{1,30}$/.test(username)) {
      return "";
    }

    return `https://www.instagram.com/${username}/`;
  }

  function getInitial(name) {
    const cleaned = String(name || "").trim();

    return cleaned ? cleaned.charAt(0).toUpperCase() : "B";
  }

  function showError(title, description) {
    if (elements.error) {
      elements.error.hidden = false;
    }

    setText(elements.errorTitle, title);
    setText(elements.errorDescription, description);

    if (elements.catalogueLoading) {
      elements.catalogueLoading.hidden = true;
    }

    if (elements.catalogueGrid) {
      elements.catalogueGrid.hidden = true;
    }

    if (elements.catalogueEmpty) {
      elements.catalogueEmpty.hidden = true;
    }

    const content = document.querySelector(".storefront-content");

    if (content) {
      content.hidden = true;
    }
  }

  function showStorefront() {
    if (elements.error) {
      elements.error.hidden = true;
    }

    const content = document.querySelector(".storefront-content");

    if (content) {
      content.hidden = false;
    }
  }

  function renderBusiness(business) {
    currentBusiness = business;

    setText(elements.category, business.category);
    setText(elements.name, business.name);

    const address = String(business.address || "").trim();

    setText(elements.location, address);
    setText(elements.address, address);

    setText(elements.description, business.description);

    if (elements.logo && elements.logoFallback) {
      const logoUrl = String(business.logo_url || "").trim();

      elements.logo.hidden = true;
      elements.logoFallback.textContent = getInitial(business.name);
      elements.logoFallback.hidden = !business.name;

      if (logoUrl) {
        elements.logo.onload = () => {
          elements.logo.hidden = false;
          elements.logoFallback.hidden = true;
        };

        elements.logo.onerror = () => {
          elements.logo.hidden = true;
          elements.logoFallback.hidden = false;
        };

        elements.logo.src = logoUrl;
        elements.logo.alt = `${business.name || "Business"} logo`;
      } else {
        elements.logo.removeAttribute("src");
      }
    }

    const phone = String(business.phone || "").trim();
    const whatsappNumber = normalizePhone(
      business.whatsapp || business.phone
    );

    setLink(
      elements.call,
      phone ? `tel:${phone.replace(/[^\d+]/g, "")}` : "",
      `Call ${business.name || "business"}`
    );

    setLink(
      elements.whatsapp,
      whatsappNumber
        ? `https://wa.me/${whatsappNumber}`
        : "",
      `Message ${business.name || "business"} on WhatsApp`
    );

    if (elements.whatsapp && whatsappNumber) {
      elements.whatsapp.target = "_blank";
      elements.whatsapp.rel = "noopener noreferrer";
    }

    const website = normalizeWebsite(business.website_url);

    setLink(elements.website, website, "Visit business website");

    if (elements.website && website) {
      elements.website.target = "_blank";
      elements.website.rel = "noopener noreferrer";
    }

    if (elements.contactActions) {
      const hasContact = [elements.call, elements.whatsapp, elements.website]
        .some((element) => element && !element.hidden);

      elements.contactActions.hidden = !hasContact;
    }

    const instagramUrl = normalizeInstagram(business.instagram_url);

    setLink(elements.instagram, instagramUrl, "Visit Instagram profile");

    if (elements.instagram && instagramUrl) {
      elements.instagram.target = "_blank";
      elements.instagram.rel = "noopener noreferrer";
    }

    /*
     * The database has one description field.
     * Display it once rather than repeating it in About.
     */
    if (elements.about) {
      elements.about.hidden = true;
    }

    if (elements.aboutDescription) {
      elements.aboutDescription.textContent = "";
      elements.aboutDescription.hidden = true;
    }

    if (elements.catalogueTitle) {
      elements.catalogueTitle.textContent = "Products & Services";
    }

    document.title = business.name
      ? `${business.name} | Bizora`
      : "Business Storefront | Bizora";

    showStorefront();
  }

  function formatPrice(price) {
    if (price === null || price === undefined || price === "") {
      return "";
    }

    const amount = Number(price);

    if (!Number.isFinite(amount) || amount < 0) {
      return "";
    }

    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2
    }).format(amount);
  }

  function createProductCard(product) {
    const card = document.createElement("article");
    card.className = "storefront-product-card";

    const imageWrap = document.createElement("div");
    imageWrap.className = "storefront-product-image-wrap";

    const fallback = document.createElement("div");
    fallback.className = "storefront-product-image-fallback";
    fallback.setAttribute("aria-hidden", "true");
    fallback.textContent = "◇";

    const imageUrl = String(product.image_url || "").trim();

    if (imageUrl) {
      const image = document.createElement("img");

      image.className = "storefront-product-image";
      image.alt = product.name
        ? `${product.name}`
        : "Business catalogue item";
      image.loading = "lazy";
      image.decoding = "async";
      image.src = imageUrl;

      image.onload = () => {
        fallback.hidden = true;
      };

      image.onerror = () => {
        image.remove();
        fallback.hidden = false;
      };

      imageWrap.append(image, fallback);
    } else {
      fallback.hidden = false;
      imageWrap.append(fallback);
    }

    const type = document.createElement("span");
    type.className = "storefront-product-type";
    type.textContent =
      product.item_type === "service" ? "Service" : "Product";

    imageWrap.append(type);

    const content = document.createElement("div");
    content.className = "storefront-product-content";

    const name = document.createElement("h3");
    name.className = "storefront-product-name";
    name.textContent = product.name || "Untitled item";

    content.append(name);

    const descriptionText = String(product.description || "").trim();

    if (descriptionText) {
      const description = document.createElement("p");
      description.className = "storefront-product-description";
      description.textContent = descriptionText;
      content.append(description);
    }

    const footer = document.createElement("div");
    footer.className = "storefront-product-footer";

    const priceText = formatPrice(product.price);

    if (priceText) {
      const price = document.createElement("span");
      price.className = "storefront-product-price";
      price.textContent = priceText;
      footer.append(price);
    }

    const availability = document.createElement("span");
    availability.className = "storefront-product-availability";
    availability.textContent = "Available";
    footer.append(availability);

    content.append(footer);
    card.append(imageWrap, content);

    return card;
  }

  async function loadProducts(businessId) {
    if (elements.catalogueLoading) {
      elements.catalogueLoading.hidden = false;
    }

    if (elements.catalogueGrid) {
      elements.catalogueGrid.replaceChildren();
      elements.catalogueGrid.hidden = true;
      elements.catalogueGrid.setAttribute("aria-busy", "true");
    }

    if (elements.catalogueEmpty) {
      elements.catalogueEmpty.hidden = true;
    }

    const { data, error } = await supabase
      .from("products")
      .select("id, name, description, price, image_url, item_type, is_available")
      .eq("business_id", businessId)
      .eq("is_available", true)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    if (elements.catalogueLoading) {
      elements.catalogueLoading.hidden = true;
    }

    if (elements.catalogueGrid) {
      elements.catalogueGrid.setAttribute("aria-busy", "false");
    }

    const products = Array.isArray(data) ? data : [];

    if (elements.catalogueCount) {
      elements.catalogueCount.textContent =
        `${products.length} ${products.length === 1 ? "item" : "items"}`;
    }

    if (!products.length) {
      if (elements.catalogueEmpty) {
        elements.catalogueEmpty.hidden = false;
      }

      return;
    }

    const fragment = document.createDocumentFragment();

    products.forEach((product) => {
      fragment.append(createProductCard(product));
    });

    if (elements.catalogueGrid) {
      elements.catalogueGrid.append(fragment);
      elements.catalogueGrid.hidden = false;
    }
  }

  async function loadStorefront() {
    if (!supabase) {
      showError(
        "Storefront unavailable",
        "We couldn't connect to the business page. Please refresh and try again."
      );
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const slug = String(params.get("slug") || "").trim();

    if (!slug) {
      showError(
        "Business page not found",
        "This link doesn't include a business address. Please check the link and try again."
      );
      return;
    }

    try {
      const { data: business, error } = await supabase
        .from("businesses")
        .select(
          "id, name, category, address, description, phone, whatsapp, website_url, instagram_url, logo_url, slug, is_published"
        )
        .eq("slug", slug)
        .eq("is_published", true)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!business) {
        showError(
          "Business page unavailable",
          "This business page may not exist or may not be published yet."
        );
        return;
      }

      renderBusiness(business);
      await loadProducts(business.id);
    } catch (error) {
      console.error("Storefront loading failed:", error);

      showError(
        "Couldn't load this page",
        "Something went wrong while loading this storefront. Please refresh and try again."
      );
    }
  }

  async function shareStorefront() {
    if (!currentBusiness) return;

    const shareData = {
      title: currentBusiness.name || "Business storefront",
      text: `Visit ${currentBusiness.name || "this business"} on Bizora.`,
      url: window.location.href
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }

      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(shareData.url);
        showToast("Storefront link copied.");
        return;
      }

      const input = document.createElement("textarea");
      input.value = shareData.url;
      input.setAttribute("readonly", "");
      input.style.position = "fixed";
      input.style.opacity = "0";

      document.body.append(input);
      input.select();

      const copied = document.execCommand("copy");
      input.remove();

      showToast(
        copied
          ? "Storefront link copied."
          : "Copy the storefront link from your browser."
      );
    } catch (error) {
      if (error.name !== "AbortError") {
        showToast("Couldn't share the link. Please try again.");
      }
    }
  }

  if (elements.shareButton) {
    elements.shareButton.addEventListener("click", shareStorefront);
  }

  loadStorefront();
})();
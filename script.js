// =========================================================================
// CONFIGURACIÓN
// =========================================================================

const CONFIG = window.APP_CONFIG || {};

const GOOGLE_SHEETS_CSV_URL = CONFIG.PRODUCTS_CSV_URL || "catalogo_productos.csv";
const GOOGLE_SHEETS_COMPANY_CSV_URL = CONFIG.COMPANY_CSV_URL || "empresa.csv";

const SUPABASE_PROJECT_URL = CONFIG.SUPABASE_PROJECT_URL || "";
const SUPABASE_BUCKET_NAME = CONFIG.SUPABASE_BUCKET_NAME || "catalogo";
const SUPABASE_STORAGE_URL = SUPABASE_PROJECT_URL
    ? `${SUPABASE_PROJECT_URL}/storage/v1/object/public/${SUPABASE_BUCKET_NAME}/`
    : "";
const SUPABASE_RENDER_URL = SUPABASE_PROJECT_URL
    ? `${SUPABASE_PROJECT_URL}/storage/v1/render/image/public/${SUPABASE_BUCKET_NAME}/`
    : "";
const IMAGE_WIDTH = CONFIG.IMAGE_WIDTH || 350;
const IMAGE_QUALITY = CONFIG.IMAGE_QUALITY || 70;

const INCLUDE_COVER_ON_PRINT = CONFIG.INCLUDE_COVER_ON_PRINT !== false;
const SEARCH_DEBOUNCE_MS = CONFIG.SEARCH_DEBOUNCE_MS || 200;
const ENABLE_DEBUG_LOGS = CONFIG.ENABLE_DEBUG_LOGS !== false;
const WHATSAPP_NUMBER = CONFIG.WHATSAPP_NUMBER || "";

// Mensajes pre-cargados
const WHATSAPP_MESSAGE_TO_COMPANY = CONFIG.WHATSAPP_MESSAGE_TO_COMPANY || "Hola, quisiera más información sobre el catálogo de productos.";
const WHATSAPP_MESSAGE_SHARE = CONFIG.WHATSAPP_MESSAGE_SHARE || "Hola, te comparto el catálogo digital de productos:";

const UNKNOWN_BRAND_LABEL = "SIN MARCA";

const PLACEHOLDER_SVG = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 24 24" fill="none" stroke="%23cbd5e1" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';

const filterState = {
    categories: new Set(),
    brands: new Set()
};

let rawProductsData = [];
let lastScrollY = window.scrollY;
let searchDebounceTimer = null;
let isPrinting = false;
let printResetTimer = null;

function logDebug(...args) { if (ENABLE_DEBUG_LOGS) console.log("[Catálogo]", ...args); }
function logWarn(...args) { if (ENABLE_DEBUG_LOGS) console.warn("[Catálogo]", ...args); }

// =========================================================================
// HELPERS
// =========================================================================

function isUnknownBrand(brand) {
    if (!brand) return true;
    const b = String(brand).trim().toUpperCase();
    return b === "" || b === "#N/A" || b === "N/A" || b === "NA" || b === "#NA" || b === "NULL" || b === "GENERICO";
}

function getBrandDisplayName(brand) {
    return isUnknownBrand(brand) ? UNKNOWN_BRAND_LABEL : brand;
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function resetPrintState() {
    isPrinting = false;
    if (printResetTimer) {
        clearTimeout(printResetTimer);
        printResetTimer = null;
    }
    const overlay = document.getElementById("pdfLoadingOverlay");
    if (overlay) overlay.classList.remove("active");
}

// =========================================================================
// MODO OSCURO
// =========================================================================

const THEME_KEY = "catalogo-theme";

function getPreferredTheme() {
    // 1. Preferencia guardada
    try {
        const stored = localStorage.getItem(THEME_KEY);
        if (stored === "light" || stored === "dark") return stored;
    } catch (e) { /* localStorage bloqueado */ }

    // 2. Preferencia del sistema
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
        return "dark";
    }
    return "light";
}

function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* ignorar */ }
}

function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme") || "light";
    const next = current === "dark" ? "light" : "dark";
    applyTheme(next);
}

// Aplicar tema al cargar (antes del DOMContentLoaded si es posible)
applyTheme(getPreferredTheme());

// =========================================================================
// CARGA INICIAL
// =========================================================================

document.addEventListener("DOMContentLoaded", () => {
    if (!INCLUDE_COVER_ON_PRINT) {
        document.body.classList.add("no-print-cover");
    }

    loadCompanyData();
    loadProducts();

    const searchInput = document.getElementById("topSearchInput");
    if (searchInput) {
        searchInput.addEventListener("input", () => {
            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = setTimeout(() => {
                filterProducts();
            }, SEARCH_DEBOUNCE_MS);
        });
    }

    document.addEventListener("click", (e) => {
        if (!e.target.closest(".multifilter")) {
            document.querySelectorAll(".multifilter-menu.active").forEach(m => m.classList.remove("active"));
            document.querySelectorAll(".multifilter-btn.active").forEach(b => b.classList.remove("active"));
        }
        if (!e.target.closest("#whatsappFloatContainer")) {
            closeWhatsAppOptions();
        }
    });

    window.addEventListener("scroll", handleMobileScroll, { passive: true });

    window.addEventListener("afterprint", resetPrintState);
    if (window.matchMedia) {
        const mql = window.matchMedia("print");
        if (mql.addEventListener) {
            mql.addEventListener("change", (e) => {
                if (!e.matches) resetPrintState();
            });
        } else if (mql.addListener) {
            mql.addListener((e) => {
                if (!e.matches) resetPrintState();
            });
        }
    }
});

function loadProducts() {
    const url = withCacheBuster(GOOGLE_SHEETS_CSV_URL);
    fetch(url)
        .then(res => {
            if (!res.ok) throw new Error("No se pudo obtener el CSV desde Google Sheets");
            return res.text();
        })
        .then(text => parseCSV(text))
        .catch(err => {
            logWarn("Error al cargar catálogo remoto, intentando copia local:", err.message);
            fetch(withCacheBuster("catalogo_productos.csv"))
                .then(res => {
                    if (!res.ok) throw new Error("No hay copia local disponible");
                    return res.text();
                })
                .then(text => parseCSV(text))
                .catch(() => renderEmptyMessage());
        });
}

function withCacheBuster(url) {
    if (!url) return url;
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}_=${Date.now()}`;
}

function handleMobileScroll() {
    if (window.innerWidth > 768) return;

    const currentScrollY = window.scrollY;
    const topBar = document.getElementById("topBar");
    const whatsappContainer = document.getElementById("whatsappFloatContainer");

    if (currentScrollY > lastScrollY && currentScrollY > 80) {
        if (topBar) topBar.classList.add("scroll-hidden-top");
        if (whatsappContainer) whatsappContainer.classList.add("scroll-hidden-bottom");
    } else {
        if (topBar) topBar.classList.remove("scroll-hidden-top");
        if (whatsappContainer) whatsappContainer.classList.remove("scroll-hidden-bottom");
    }

    lastScrollY = currentScrollY;
}

// =========================================================================
// PARSER CSV
// =========================================================================

function parseCSVText(text) {
    text = text.replace(/^\uFEFF/, "");

    const firstLine = text.split(/\r\n|\n/).find(l => l.trim() !== "") || "";
    const delimiter = firstLine.includes(";") ? ";" : ",";

    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const next = text[i + 1];

        if (inQuotes) {
            if (char === '"') {
                if (next === '"') { field += '"'; i++; }
                else { inQuotes = false; }
            } else { field += char; }
        } else {
            if (char === '"') { inQuotes = true; }
            else if (char === delimiter) { row.push(field.trim()); field = ""; }
            else if (char === "\n") { row.push(field.trim()); rows.push(row); row = []; field = ""; }
            else if (char === "\r") { /* ignorar */ }
            else { field += char; }
        }
    }

    if (field !== "" || row.length > 0) {
        row.push(field.trim());
        rows.push(row);
    }

    return rows.filter(r => r.some(c => c !== ""));
}

// =========================================================================
// NORMALIZACIÓN DE URLs
// =========================================================================

function normalizeImageUrl(url) {
    if (!url) return "";
    url = url.trim();

    const driveMatch = url.match(/(?:\/d\/|id=)([a-zA-Z0-9_-]{20,})/);
    if (driveMatch && (url.includes("drive.google.com") || url.includes("docs.google.com"))) {
        const id = driveMatch[1];
        return `https://drive.google.com/thumbnail?id=${id}&sz=w1000`;
    }

    return url;
}

function buildThumbUrl(code) {
    if (!SUPABASE_RENDER_URL) return "";
    return `${SUPABASE_RENDER_URL}${code}.webp?width=${IMAGE_WIDTH}&quality=${IMAGE_QUALITY}&format=webp`;
}

function buildSocialLink(social) {
    if (!social) return "#";
    const s = String(social).trim();
    if (s.startsWith("http://") || s.startsWith("https://")) return s;
    if (s.startsWith("@")) return `https://instagram.com/${s.substring(1)}`;
    return `https://instagram.com/${s}`;
}

function buildWhatsAppLink(phone) {
    if (!phone) return "#";
    const num = (WHATSAPP_NUMBER || String(phone).replace(/[^\d]/g, "")).replace(/[^\d]/g, "");
    return `https://wa.me/${num}`;
}

function resolveMapsLink(mapsUrl, address) {
    if (mapsUrl && mapsUrl.trim() !== "") {
        const m = mapsUrl.trim();
        if (m.startsWith("http://") || m.startsWith("https://")) return m;
        return `https://${m}`;
    }
    if (address && address.trim() !== "") {
        return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    }
    return "#";
}

// =========================================================================
// CARGA DE DATOS DE LA EMPRESA
// =========================================================================

function loadCompanyData() {
    if (!GOOGLE_SHEETS_COMPANY_CSV_URL || GOOGLE_SHEETS_COMPANY_CSV_URL.includes("TU_ENLACE")) {
        logWarn("La URL de la empresa no ha sido configurada en config.js");
        return;
    }

    fetch(withCacheBuster(GOOGLE_SHEETS_COMPANY_CSV_URL))
        .then(res => {
            if (!res.ok) throw new Error("No se pudo obtener el CSV de la empresa");
            return res.text();
        })
        .then(text => {
            const rows = parseCSVText(text);
            if (rows.length < 2) {
                logWarn("El CSV de empresa no tiene fila de datos.");
                return;
            }

            const normalize = (s) => String(s)
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/\s+/g, "")
                .trim();

            const headers = rows[0].map(normalize);
            const dataRow = rows[1];

            const getVal = (key) => {
                const index = headers.indexOf(normalize(key));
                return (index !== -1 && dataRow[index]) ? dataRow[index].trim() : "";
            };

            const companyName = getVal("Empresa");
            const coverTitle = getVal("Titulo");
            const rif = getVal("RIF");
            const contact = getVal("Contacto");
            const social = getVal("Redes");
            const address = getVal("Direccion");
            const date = getVal("Fecha");
            const logoUrlRaw = getVal("Logo");
            const qrUrlRaw = getVal("QR");
            const mapsUrlRaw = getVal("Maps");

            logDebug("Maps URL detectada:", mapsUrlRaw);

            const mapsLink = resolveMapsLink(mapsUrlRaw, address);

            if (companyName) document.getElementById("sessionLabel").textContent = companyName;
            if (rif) document.getElementById("headerRif").textContent = `RIF: ${rif}`;

            if (companyName) document.getElementById("coverCompanyName").textContent = companyName;
            if (coverTitle) document.getElementById("coverTitleInline").textContent = coverTitle;

            if (date) document.getElementById("coverFooterDate").textContent = date;
            if (rif) document.getElementById("coverFooterRif").textContent = rif;
            if (address) document.getElementById("coverFooterAddress").textContent = address;

            if (contact) {
                document.getElementById("coverFooterContact").textContent = contact;
                const contactLink = document.getElementById("coverFooterContactLink");
                if (contactLink) contactLink.href = buildWhatsAppLink(contact);
            }

            if (social) {
                document.getElementById("coverFooterSocial").textContent = social;
                const socialLink = document.getElementById("coverFooterSocialLink");
                if (socialLink) socialLink.href = buildSocialLink(social);
            }

            const addressLink = document.getElementById("coverFooterAddressLink");
            if (addressLink) addressLink.href = mapsLink;

            const badgeLogo = document.getElementById("companyBadgeLogo");
            const badgeFallback = document.getElementById("companyBadgeFallback");
            const badgeLink = document.getElementById("companyBadgeLink");

            if (badgeLink) {
                badgeLink.href = mapsLink;
                badgeLink.target = "_blank";
                badgeLink.rel = "noopener";
            }

            if (badgeLogo && badgeFallback && logoUrlRaw) {
                const finalUrl = normalizeImageUrl(logoUrlRaw);
                badgeLogo.src = finalUrl;
                badgeLogo.style.display = "block";
                badgeFallback.style.display = "none";
                badgeLogo.onerror = () => {
                    badgeLogo.style.display = "none";
                    badgeFallback.style.display = "block";
                };
            }

            const logoImg = document.getElementById("companyLogoImg");
            if (logoImg && logoUrlRaw) {
                const finalUrl = normalizeImageUrl(logoUrlRaw);
                logoImg.src = finalUrl;
                logoImg.style.display = "block";
                logoImg.onerror = () => {
                    logWarn("No se pudo cargar el logo desde:", finalUrl);
                    logoImg.style.display = "none";
                };
            }

            const qrImg = document.getElementById("qrLogoImg");
            if (qrImg && qrUrlRaw) {
                const finalUrl = normalizeImageUrl(qrUrlRaw);
                qrImg.src = finalUrl;
                qrImg.style.display = "block";
                qrImg.onerror = () => {
                    logWarn("No se pudo cargar el QR desde:", finalUrl);
                    qrImg.style.display = "none";
                };
            }

            logDebug("Datos de empresa aplicados correctamente.");
        })
        .catch(err => {
            logWarn("Error al cargar la información de la empresa:", err.message);
        });
}

// =========================================================================
// INTERFAZ
// =========================================================================

function toggleMainMenu() {
    const menu = document.getElementById("mainDropdownMenu");
    const btn = document.getElementById("hamburgerBtn");
    if (!menu) return;
    const isActive = menu.classList.toggle("active");
    menu.setAttribute("aria-hidden", String(!isActive));
    if (btn) btn.setAttribute("aria-expanded", String(isActive));
}

// =========================================================================
// WHATSAPP - ACCIONES
// =========================================================================

function toggleWhatsAppOptions(event) {
    if (event) event.stopPropagation();
    const options = document.getElementById("whatsappFloatOptions");
    const btn = document.getElementById("whatsappBtn");
    if (!options || !btn) return;

    const isActive = options.classList.toggle("active");
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-expanded", String(isActive));
}

function closeWhatsAppOptions() {
    const options = document.getElementById("whatsappFloatOptions");
    const btn = document.getElementById("whatsappBtn");
    if (options) options.classList.remove("active");
    if (btn) {
        btn.classList.remove("active");
        btn.setAttribute("aria-expanded", "false");
    }
}

function openWhatsAppChatToCompany(event) {
    if (event) event.preventDefault();

    if (!WHATSAPP_NUMBER || WHATSAPP_NUMBER.trim() === "") {
        alert("El número de WhatsApp de la empresa no está configurado.");
        return;
    }

    const msg = WHATSAPP_MESSAGE_TO_COMPANY;
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");

    closeWhatsAppOptions();
}

function shareCatalogWhatsApp(event) {
    if (event) event.preventDefault();
    event.stopPropagation();

    const currentUrl = window.location.href;
    const msg = `${WHATSAPP_MESSAGE_SHARE} ${currentUrl}`;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");

    closeWhatsAppOptions();
}

// =========================================================================
// MODAL DE FILTROS
// =========================================================================

function openFiltersModal() {
    const overlay = document.getElementById("filtersModalOverlay");
    if (overlay) { overlay.classList.add("active"); document.body.style.overflow = "hidden"; }
}

function closeFiltersModal() {
    const overlay = document.getElementById("filtersModalOverlay");
    if (overlay) { overlay.classList.remove("active"); document.body.style.overflow = ""; }
}

function closeFiltersModalIfOutside(event) {
    if (event.target === event.currentTarget) closeFiltersModal();
}

function filterModalBrandOptions(searchValue) {
    const search = searchValue.toLowerCase().trim();
    document.querySelectorAll("#modalBrandOptions .multifilter-option").forEach(opt => {
        const text = opt.querySelector("span").textContent.toLowerCase();
        opt.style.display = text.includes(search) ? "" : "none";
    });
}

// =========================================================================
// MULTISELECCIÓN
// =========================================================================

function toggleMultifilter(type) {
    const menu = document.getElementById(type + "Menu");
    const btn = document.querySelector(`.multifilter[data-filter="${type}"] .multifilter-btn`);
    if (!menu || !btn) return;
    const isActive = menu.classList.contains("active");
    document.querySelectorAll(".multifilter-menu.active").forEach(m => m.classList.remove("active"));
    document.querySelectorAll(".multifilter-btn.active").forEach(b => b.classList.remove("active"));
    if (!isActive) { menu.classList.add("active"); btn.classList.add("active"); }
}

function toggleAllFilter(type, checked) {
    const listKey = type === "category" ? "categories" : "brands";
    filterState[listKey].clear();
    const desktopOptions = document.querySelectorAll(`#${type}Options input[type="checkbox"]`);
    const modalOptions = document.querySelectorAll(`#modal${capitalize(type)}Options input[type="checkbox"]`);
    [...desktopOptions, ...modalOptions].forEach(cb => {
        cb.checked = checked;
        if (checked) filterState[listKey].add(cb.value);
    });
    if (type === "category") updateBrandOptionsByCategories();
    updateMultifilterUI(type);
    updateFilterChips();
    filterProducts();
}

function toggleFilterOption(type, value, checked) {
    const listKey = type === "category" ? "categories" : "brands";
    if (checked) filterState[listKey].add(value);
    else filterState[listKey].delete(value);

    const allCheckbox = document.getElementById(type + "AllCheckbox");
    const totalOptions = document.querySelectorAll(`#${type}Options input[type="checkbox"]`).length;
    if (allCheckbox) {
        allCheckbox.checked = (filterState[listKey].size === totalOptions && totalOptions > 0);
        allCheckbox.indeterminate = (filterState[listKey].size > 0 && filterState[listKey].size < totalOptions);
    }

    if (type === "category") updateBrandOptionsByCategories();
    updateMultifilterUI(type);
    updateFilterChips();
    filterProducts();
}

function updateMultifilterUI(type) {
    const listKey = type === "category" ? "categories" : "brands";
    const count = filterState[listKey].size;
    const countEl = document.getElementById(type + "Count");
    const btn = document.querySelector(`.multifilter[data-filter="${type}"] .multifilter-btn`);
    const labelEl = btn ? btn.querySelector(".multifilter-label") : null;

    if (countEl) {
        if (count > 0) { countEl.textContent = count; countEl.hidden = false; }
        else { countEl.hidden = true; }
    }

    if (labelEl) {
        if (count === 0) labelEl.textContent = type === "category" ? "Categoría" : "Marca";
        else if (count === 1) labelEl.textContent = Array.from(filterState[listKey])[0];
        else labelEl.textContent = type === "category" ? `${count} categorías` : `${count} marcas`;
    }

    const desktopCbs = document.querySelectorAll(`#${type}Options input[type="checkbox"]`);
    const modalCbs = document.querySelectorAll(`#modal${capitalize(type)}Options input[type="checkbox"]`);
    [...desktopCbs, ...modalCbs].forEach(cb => {
        cb.checked = filterState[listKey].has(cb.value);
    });
}

function updateBrandOptionsByCategories() {
    let availableBrands;
    if (filterState.categories.size === 0) {
        availableBrands = Array.from(new Set(rawProductsData.map(p => p.brand).filter(b => b && !isUnknownBrand(b))));
    } else {
        availableBrands = Array.from(new Set(
            rawProductsData.filter(p => filterState.categories.has(p.category))
                .map(p => p.brand).filter(b => b && !isUnknownBrand(b))
        ));
    }
    availableBrands.sort((a, b) => a.localeCompare(b));

    const toRemove = [];
    filterState.brands.forEach(brand => { if (!availableBrands.includes(brand)) toRemove.push(brand); });
    toRemove.forEach(b => filterState.brands.delete(b));

    populateBrandOptions(availableBrands);
    populateModalBrandOptions(availableBrands);
    updateMultifilterUI("brand");
}

function filterBrandOptions(searchValue) {
    const search = searchValue.toLowerCase().trim();
    document.querySelectorAll("#brandOptions .multifilter-option").forEach(opt => {
        const text = opt.querySelector("span").textContent.toLowerCase();
        opt.style.display = text.includes(search) ? "" : "none";
    });
}

// =========================================================================
// CHIPS
// =========================================================================

function updateFilterChips() {
    const wrapper = document.getElementById("filterChipsWrapper");
    const container = document.getElementById("filterChips");
    if (!wrapper || !container) return;

    const chips = [];
    filterState.categories.forEach(cat => chips.push({ type: "category", value: cat, label: cat }));
    filterState.brands.forEach(brand => chips.push({ type: "brand", value: brand, label: brand }));

    if (chips.length === 0) {
        wrapper.style.display = "none";
        container.innerHTML = "";
        updateFiltersBadge();
        return;
    }

    wrapper.style.display = "block";
    let html = `<span class="filter-chips-label">Activos:</span>`;
    chips.forEach(chip => {
        const extraClass = chip.type === "brand" ? " chip-brand" : "";
        const safeVal = escapeHtml(chip.value);
        const safeLabel = escapeHtml(chip.label);
        html += `
            <span class="filter-chip${extraClass}" onclick="removeFilterChip('${chip.type}', '${safeVal.replace(/'/g, "\\'")}')">
                ${safeLabel}
                <span class="chip-close">✕</span>
            </span>
        `;
    });
    container.innerHTML = html;
    updateFiltersBadge();
}

function updateFiltersBadge() {
    const badge = document.getElementById("filtersBadge");
    if (!badge) return;
    const total = filterState.categories.size + filterState.brands.size;
    if (total > 0) { badge.textContent = total; badge.hidden = false; }
    else { badge.hidden = true; }
}

function removeFilterChip(type, value) {
    const listKey = type === "category" ? "categories" : "brands";
    filterState[listKey].delete(value);
    if (type === "category") updateBrandOptionsByCategories();
    updateMultifilterUI(type);
    updateFilterChips();
    filterProducts();
}

function clearAllFilters() {
    filterState.categories.clear();
    filterState.brands.clear();

    document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        if (cb.id && cb.id.includes("AllCheckbox")) { cb.checked = false; cb.indeterminate = false; }
        else if (cb.closest(".multifilter-option")) { cb.checked = false; }
    });

    const sortSel = document.getElementById("sortSelect");
    if (sortSel) sortSel.value = "default";
    const modalSortSel = document.getElementById("modalSortSelect");
    if (modalSortSel) modalSortSel.value = "default";

    const searchInput = document.getElementById("topSearchInput");
    if (searchInput) searchInput.value = "";

    const allBrands = Array.from(new Set(rawProductsData.map(p => p.brand).filter(b => b && !isUnknownBrand(b))));
    allBrands.sort((a, b) => a.localeCompare(b));
    populateBrandOptions(allBrands);
    populateModalBrandOptions(allBrands);

    updateMultifilterUI("category");
    updateMultifilterUI("brand");
    updateFilterChips();
    filterProducts();
}

// =========================================================================
// PREPARACIÓN DE PDF
// =========================================================================

function prepareAndPrint() {
    if (isPrinting) return;
    isPrinting = true;

    const overlay = document.getElementById("pdfLoadingOverlay");
    const subtext = document.getElementById("pdfLoadingSubtext");

    if (!INCLUDE_COVER_ON_PRINT) document.body.classList.add("no-print-cover");

    if (printResetTimer) clearTimeout(printResetTimer);
    printResetTimer = setTimeout(resetPrintState, 60000);

    const images = Array.from(document.querySelectorAll("#catalogContainer img, #pdfCoverSection img"));
    const total = images.length;
    let loaded = 0;

    if (total > 0 && overlay) {
        overlay.classList.add("active");
        if (subtext) subtext.textContent = `Cargando imágenes (0/${total})`;
    }

    const proceedToPrint = () => {
        if (overlay) overlay.classList.remove("active");
        setTimeout(() => {
            window.print();
            setTimeout(() => {
                if (isPrinting) resetPrintState();
            }, 2000);
        }, 100);
    };

    if (total === 0) {
        proceedToPrint();
        return;
    }

    const checkDone = () => {
        if (loaded >= total) setTimeout(proceedToPrint, 200);
    };

    images.forEach((img) => {
        if (img.complete && img.naturalHeight !== 0) {
            loaded++;
            if (subtext) subtext.textContent = `Cargando imágenes (${loaded}/${total})`;
            checkDone();
            return;
        }
        img.loading = "eager";
        const onLoad = () => { loaded++; if (subtext) subtext.textContent = `Cargando imágenes (${loaded}/${total})`; checkDone(); };
        const onError = () => { loaded++; if (subtext) subtext.textContent = `Cargando imágenes (${loaded}/${total})`; checkDone(); };
        img.addEventListener("load", onLoad, { once: true });
        img.addEventListener("error", onError, { once: true });
        setTimeout(() => {
            if (!img.complete) { loaded++; if (subtext) subtext.textContent = `Cargando imágenes (${loaded}/${total})`; checkDone(); }
        }, 8000);
    });
}

// =========================================================================
// PARSEO DE PRODUCTOS
// =========================================================================

function parseCSV(text) {
    const rows = parseCSVText(text);
    rawProductsData = [];
    const categoriesSet = new Set();
    const brandsSet = new Set();

    if (rows.length < 2) { renderEmptyMessage(); return; }

    for (let i = 1; i < rows.length; i++) {
        const cols = rows[i];
        if (cols.length === 0) continue;

        const code = cols[0] || "";
        const category = cols[1] || "VARIOS";
        const brand = cols[2] || "";
        const name = cols[3] || "";
        const presentation = cols[4] || "";
        const rawPrice = cols[5] !== undefined ? cols[5] : "0.00";
        const customUrl = cols[6] || "";

        if (name) {
            const formattedPrice = formatExactPrice(rawPrice);
            rawProductsData.push({
                code, category, brand, name, presentation,
                priceString: formattedPrice,
                priceNum: parseFloat(formattedPrice) || 0,
                customUrl
            });
            categoriesSet.add(category);
            if (brand && !isUnknownBrand(brand)) brandsSet.add(brand);
        }
    }

    populateCategoryOptions(Array.from(categoriesSet).sort());
    populateModalCategoryOptions(Array.from(categoriesSet).sort());
    populateBrandOptions(Array.from(brandsSet).sort());
    populateModalBrandOptions(Array.from(brandsSet).sort());
    filterProducts();
}

function formatExactPrice(valStr) {
    if (!valStr) return "0.00";
    let cleanStr = String(valStr).replace(/["'$]/g, "").trim().replace(",", ".");
    const match = cleanStr.match(/\d+(\.\d+)?/);
    if (!match) return "0.00";
    let validNumberStr = match[0];
    let parts = validNumberStr.split(".");
    if (parts.length === 1) return parts[0] + ".00";
    if (parts[1].length === 1) return parts[0] + "." + parts[1] + "0";
    return validNumberStr;
}

function populateCategoryOptions(categories) {
    const container = document.getElementById("categoryOptions");
    if (!container) return;
    let html = "";
    categories.forEach(cat => {
        const safeVal = escapeHtml(cat);
        html += `
            <label class="multifilter-option">
                <input type="checkbox" value="${safeVal}" onchange="toggleFilterOption('category', this.value, this.checked)">
                <span>${safeVal}</span>
            </label>
        `;
    });
    container.innerHTML = html;
}

function populateModalCategoryOptions(categories) {
    const container = document.getElementById("modalCategoryOptions");
    if (!container) return;
    let html = "";
    categories.forEach(cat => {
        const safeVal = escapeHtml(cat);
        html += `
            <label class="multifilter-option">
                <input type="checkbox" value="${safeVal}" onchange="toggleFilterOption('category', this.value, this.checked)">
                <span>${safeVal}</span>
            </label>
        `;
    });
    container.innerHTML = html;
}

function populateBrandOptions(brands) {
    const container = document.getElementById("brandOptions");
    if (!container) return;
    let html = "";
    brands.forEach(brand => {
        if (isUnknownBrand(brand)) return;
        const safeVal = escapeHtml(brand);
        html += `
            <label class="multifilter-option">
                <input type="checkbox" value="${safeVal}" onchange="toggleFilterOption('brand', this.value, this.checked)">
                <span>${safeVal}</span>
            </label>
        `;
    });
    container.innerHTML = html;
}

function populateModalBrandOptions(brands) {
    const container = document.getElementById("modalBrandOptions");
    if (!container) return;
    let html = "";
    brands.forEach(brand => {
        if (isUnknownBrand(brand)) return;
        const safeVal = escapeHtml(brand);
        html += `
            <label class="multifilter-option">
                <input type="checkbox" value="${safeVal}" onchange="toggleFilterOption('brand', this.value, this.checked)">
                <span>${safeVal}</span>
            </label>
        `;
    });
    container.innerHTML = html;
}

// =========================================================================
// RENDERIZADO
// =========================================================================

function getProductImageUrl(prod) {
    if (prod.customUrl && prod.customUrl.trim() !== "") {
        return normalizeImageUrl(prod.customUrl);
    }
    if (SUPABASE_RENDER_URL) return buildThumbUrl(prod.code);
    if (!SUPABASE_STORAGE_URL) return PLACEHOLDER_SVG;
    return `${SUPABASE_STORAGE_URL}${prod.code}.webp`;
}

function buildProductCardHtml(prod, isFirstPage, idx) {
    const imageSrc = getProductImageUrl(prod);
    const priorityAttr = (isFirstPage && idx < 12) ? 'fetchpriority="high"' : '';
    const brandDisplay = getBrandDisplayName(prod.brand);

    return `
        <div class="product-card">
            <div class="product-img-box">
                <img id="img-${prod.code}"
                     src="${imageSrc}"
                     loading="eager"
                     decoding="async"
                     ${priorityAttr}
                     onerror="handleImageError(this, '${prod.code}')"
                     alt="${prod.name}">
            </div>
            <div class="product-info">
                <span class="product-brand">${brandDisplay}</span>
                <div class="product-name" title="${prod.name}">${prod.name}</div>
                <span class="product-package">${prod.presentation}</span>
                <div class="product-price-tag">$${prod.priceString}</div>
            </div>
        </div>
    `;
}

function renderCatalog(products) {
    const container = document.getElementById("catalogContainer");
    if (!container) return;

    container.innerHTML = "";
    if (products.length === 0) { renderEmptyMessage(); return; }

    const searchInput = document.getElementById("topSearchInput");
    const searchVal = searchInput ? searchInput.value.trim() : "";
    const showSections = (searchVal === "");

    if (!showSections) {
        const grid = document.createElement("div");
        grid.className = "products-grid";
        let html = "";
        products.forEach((prod, idx) => { html += buildProductCardHtml(prod, true, idx); });
        grid.innerHTML = html;
        container.appendChild(grid);
    } else {
        const groupedByBrand = {};
        products.forEach(prod => {
            const key = isUnknownBrand(prod.brand) ? "__UNKNOWN__" : prod.brand;
            if (!groupedByBrand[key]) groupedByBrand[key] = [];
            groupedByBrand[key].push(prod);
        });

        const knownBrands = Object.keys(groupedByBrand).filter(k => k !== "__UNKNOWN__").sort((a, b) => a.localeCompare(b));
        const sortedKeys = knownBrands.slice();
        if (groupedByBrand["__UNKNOWN__"]) sortedKeys.push("__UNKNOWN__");

        let firstPageGlobal = true;
        sortedKeys.forEach(key => {
            const isUnknown = (key === "__UNKNOWN__");
            const brandProducts = groupedByBrand[key];
            const displayName = isUnknown ? UNKNOWN_BRAND_LABEL : key;

            const section = document.createElement("section");
            section.className = "brand-section" + (isUnknown ? " is-unknown" : "");

            const header = document.createElement("div");
            header.className = "brand-section-header";
            header.innerHTML = `
                <span class="brand-section-name">${displayName}</span>
                <span class="brand-section-count">${brandProducts.length} ${brandProducts.length === 1 ? "producto" : "productos"}</span>
            `;
            section.appendChild(header);

            const grid = document.createElement("div");
            grid.className = "products-grid";
            let html = "";
            brandProducts.forEach((prod, idx) => { html += buildProductCardHtml(prod, firstPageGlobal, idx); });
            firstPageGlobal = false;
            grid.innerHTML = html;
            section.appendChild(grid);
            container.appendChild(section);
        });
    }

    updateResultsInfo(products);
}

function updateResultsInfo(products) {
    const info = document.getElementById("resultsInfo");
    const count = document.getElementById("resultsCount");
    if (!info || !count) return;
    if (products.length === 0) { info.style.display = "none"; return; }
    const uniqueBrands = new Set(products.map(p => isUnknownBrand(p.brand) ? null : p.brand).filter(Boolean)).size;
    info.style.display = "block";
    count.innerHTML = `Mostrando <strong>${products.length}</strong> ${products.length === 1 ? "producto" : "productos"} · <strong>${uniqueBrands}</strong> ${uniqueBrands === 1 ? "marca" : "marcas"}`;
}

function handleImageError(imgElem, code) {
    const attempt = imgElem.dataset.attempt || "0";
    if (attempt === "0" && !imgElem.src.includes("data:image")) {
        imgElem.dataset.attempt = "1";
        if (SUPABASE_STORAGE_URL) imgElem.src = `${SUPABASE_STORAGE_URL}${code}.png`;
        else { imgElem.onerror = null; imgElem.src = PLACEHOLDER_SVG; }
    } else {
        imgElem.onerror = null;
        imgElem.src = PLACEHOLDER_SVG;
    }
}

function renderEmptyMessage() {
    const container = document.getElementById("catalogContainer");
    if (!container) return;
    const info = document.getElementById("resultsInfo");
    if (info) info.style.display = "none";
    container.innerHTML = `
        <div style="text-align:center; padding: 60px 20px; background: #fff; border-radius: 10px; border: 1px dashed #cbd5e1;">
            <p style="color:#64748b; font-weight: 700; font-size: 1.05em;">No hay productos que coincidan.</p>
            <p style="color:#94a3b8; font-size: 0.85em; margin-top: 6px;">Prueba con otros filtros o limpia la búsqueda.</p>
        </div>
    `;
}

// =========================================================================
// FILTROS
// =========================================================================

function syncAndFilter(type, value) {
    if (type === "sort") {
        const sortSel = document.getElementById("sortSelect");
        const modalSortSel = document.getElementById("modalSortSelect");
        if (sortSel && sortSel.value !== value) sortSel.value = value;
        if (modalSortSel && modalSortSel.value !== value) modalSortSel.value = value;
    }
    filterProducts();
}

function filterProducts() {
    const topSearch = document.getElementById("topSearchInput");
    const searchVal = topSearch ? topSearch.value.toLowerCase() : "";
    const sortSel = document.getElementById("sortSelect");
    const sortVal = sortSel ? sortSel.value : "default";

    let filtered = rawProductsData.filter(p => {
        const matchSearch = p.name.toLowerCase().includes(searchVal) ||
                            p.code.toLowerCase().includes(searchVal) ||
                            (p.brand || "").toLowerCase().includes(searchVal);
        const matchCat = (filterState.categories.size === 0) || filterState.categories.has(p.category);
        const matchBrand = (filterState.brands.size === 0) || filterState.brands.has(p.brand);
        return matchSearch && matchCat && matchBrand;
    });

    filtered.sort((a, b) => {
        const aUnknown = isUnknownBrand(a.brand);
        const bUnknown = isUnknownBrand(b.brand);
        switch (sortVal) {
            case "default": {
                if (aUnknown !== bUnknown) return aUnknown ? 1 : -1;
                const catCompare = a.category.localeCompare(b.category);
                if (catCompare !== 0) return catCompare;
                return (a.brand || "").localeCompare(b.brand || "");
            }
            case "name-asc":      return a.name.localeCompare(b.name);
            case "name-desc":     return b.name.localeCompare(a.name);
            case "price-asc":     return a.priceNum - b.priceNum;
            case "price-desc":    return b.priceNum - a.priceNum;
            case "category-asc":  return a.category.localeCompare(b.category);
            case "category-desc": return b.category.localeCompare(a.category);
            case "brand-asc":
                if (aUnknown !== bUnknown) return aUnknown ? 1 : -1;
                return (a.brand || "").localeCompare(b.brand || "");
            case "brand-desc":
                if (aUnknown !== bUnknown) return aUnknown ? 1 : -1;
                return (b.brand || "").localeCompare(a.brand || "");
            default: return 0;
        }
    });

    renderCatalog(filtered);
}
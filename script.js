// =========================================================================
// CONFIGURACIÓN DE FUENTES DE DATOS E IMÁGENES
// =========================================================================

// 1. Enlace del CSV publicado desde Google Sheets
const GOOGLE_SHEETS_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQf6lHp7YR9F2iYzaTexYRHm1lyxJwblAj95GAQ-ekPfkPlGqqgUxM-S1yyeAnHuW9ZZXwBPIOi2TI_/pub?gid=412358378&single=true&output=csv";

// 2. Configuración de Supabase Storage para imágenes de productos
const SUPABASE_PROJECT_URL = 'https://svruhyxfrfcafqjyziys.supabase.co';
const SUPABASE_BUCKET_NAME = 'imagenes-catalogo';
const SUPABASE_STORAGE_URL = `${SUPABASE_PROJECT_URL}/storage/v1/object/public/${SUPABASE_BUCKET_NAME}/`;

// 3. SVG marcador (Placeholder) liviano de 2KB para productos sin foto
const PLACEHOLDER_SVG = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 24 24" fill="none" stroke="%23cbd5e1" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';

// Variables globales del catálogo
let rawProductsData = [];
let lastScrollY = window.scrollY;

// =========================================================================
// CARGA INICIAL DE DATOS Y EVENTOS
// =========================================================================

document.addEventListener("DOMContentLoaded", () => {
    fetch(GOOGLE_SHEETS_CSV_URL)
        .then(res => {
            if (!res.ok) throw new Error("No se pudo obtener el CSV desde Google Sheets");
            return res.text();
        })
        .then(text => parseCSV(text))
        .catch(err => {
            console.error("Error al cargar el catálogo:", err);
            fetch("catalogo_productos.csv")
                .then(res => {
                    if (!res.ok) throw new Error("No hay copia local disponible");
                    return res.text();
                })
                .then(text => parseCSV(text))
                .catch(() => renderEmptyMessage());
        });

    window.addEventListener("scroll", handleMobileScroll, { passive: true });
});

function handleMobileScroll() {
    if (window.innerWidth > 768) return;

    const currentScrollY = window.scrollY;
    const topBar = document.getElementById("topBar");
    const secondaryBar = document.getElementById("secondaryBar");
    const whatsappBtn = document.getElementById("whatsappBtn");

    if (currentScrollY > lastScrollY && currentScrollY > 60) {
        if (topBar) topBar.classList.add("scroll-hidden-top");
        if (secondaryBar) secondaryBar.classList.add("scroll-hidden-top");
        if (whatsappBtn) whatsappBtn.classList.add("scroll-hidden-bottom");
    } else {
        if (topBar) topBar.classList.remove("scroll-hidden-top");
        if (secondaryBar) secondaryBar.classList.remove("scroll-hidden-top");
        if (whatsappBtn) whatsappBtn.classList.remove("scroll-hidden-bottom");
    }

    lastScrollY = currentScrollY;
}

// =========================================================================
// INTERFAZ Y NAVEGACIÓN
// =========================================================================

function toggleMainMenu() {
    const menu = document.getElementById('mainDropdownMenu');
    if (menu) menu.classList.toggle('active');
}

function toggleCompanyCoverMobile() {
    const cover = document.getElementById('pdfCoverSection');
    if (cover) cover.classList.toggle('mobile-visible');
}

function shareCatalogWhatsApp(event) {
    event.preventDefault();
    const currentUrl = encodeURIComponent(window.location.href);
    const message = encodeURIComponent(`Hola, te comparto el catálogo digital de productos: ${decodeURIComponent(currentUrl)}`);
    window.open(`https://api.whatsapp.com/send?text=${message}`, '_blank');
}

// =========================================================================
// PARSEO DE CSV Y CONSTRUCCIÓN DE OBJETOS
// =========================================================================

function parseCSV(text) {
    const lines = text.split(/\r\n|\n/);
    rawProductsData = [];
    const categoriesSet = new Set();
    const brandsSet = new Set();

    if (lines.length < 2) {
        renderEmptyMessage();
        return;
    }

    const firstLine = lines[0];
    const delimiter = firstLine.includes(';') ? ';' : ',';

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const regex = new RegExp(`(?:^|${delimiter})(?:"([^"]*)"|([^"${delimiter}]*))`, 'g');
        const cols = [];
        let match;

        while ((match = regex.exec(line)) !== null) {
            let val = match[1] !== undefined ? match[1] : match[2];
            cols.push(val ? val.trim() : '');
        }

        const code = cols[0] || '';
        const category = cols[1] || 'VARIOS';
        const brand = cols[2] || 'GENERICO';
        const name = cols[3] || '';
        const presentation = cols[4] || '';
        let rawPrice = cols[5] !== undefined ? cols[5] : '0.00';
        let customUrl = cols[6] || '';

        if (name) {
            const formattedPrice = formatExactPrice(rawPrice);
            rawProductsData.push({
                code, 
                category, 
                brand, 
                name, 
                presentation, 
                priceString: formattedPrice,
                priceNum: parseFloat(formattedPrice) || 0,
                customUrl
            });
            categoriesSet.add(category);
            if (brand) brandsSet.add(brand);
        }
    }

    populateCategorySelect(Array.from(categoriesSet));
    populateBrandSelect(Array.from(brandsSet));
    filterProducts();
}

function formatExactPrice(valStr) {
    if (!valStr) return '0.00';
    let cleanStr = String(valStr).replace(/["'$]/g, '').trim().replace(',', '.');
    const match = cleanStr.match(/\d+(\.\d+)?/);
    if (!match) return '0.00';

    let validNumberStr = match[0];
    let parts = validNumberStr.split('.');
    if (parts.length === 1) {
        return parts[0] + '.00';
    } else if (parts[1].length === 1) {
        return parts[0] + '.' + parts[1] + '0';
    }
    return validNumberStr;
}

function populateCategorySelect(categories) {
    const selects = [
        document.getElementById('categorySelect'),
        document.getElementById('mobileCategorySelect')
    ];
    
    selects.forEach(select => {
        if (!select) return;
        select.innerHTML = '<option value="all">Todas las categorías</option>';
        categories.sort().forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = cat;
            select.appendChild(option);
        });
    });
}

function populateBrandSelect(brands, selectedValue = 'all') {
    const selects = [
        document.getElementById('brandSelect'),
        document.getElementById('mobileBrandSelect')
    ];
    
    selects.forEach(select => {
        if (!select) return;
        select.innerHTML = '<option value="all">Todas las marcas</option>';
        brands.sort().forEach(b => {
            const option = document.createElement('option');
            option.value = b;
            option.textContent = b;
            if (b === selectedValue) option.selected = true;
            select.appendChild(option);
        });
    });
}

// =========================================================================
// RENDERIZADO DE CATÁLOGO Y OPTIMIZACIÓN DE IMÁGENES
// =========================================================================

function getProductImageUrl(prod) {
    if (prod.customUrl && prod.customUrl.trim() !== '') {
        return prod.customUrl.trim();
    }
    return `${SUPABASE_STORAGE_URL}${prod.code}.webp`;
}

function renderCatalog(products) {
    const container = document.getElementById('catalogContainer');
    if (!container) return;
    
    container.innerHTML = '';

    if (products.length === 0) {
        renderEmptyMessage();
        return;
    }

    const pageSize = 12; 
    for (let i = 0; i < products.length; i += pageSize) {
        const pageItems = products.slice(i, i + pageSize);

        const pageBlock = document.createElement('div');
        pageBlock.className = 'page-block category-group';

        let html = `<div class="products-grid">`;

        pageItems.forEach((prod) => {
            const imageSrc = getProductImageUrl(prod);

            html += `
                <div class="product-card">
                    <div class="product-img-box">
                        <img id="img-${prod.code}" 
                             src="${imageSrc}" 
                             loading="lazy"
                             onerror="handleImageError(this, '${prod.code}')" 
                             alt="${prod.name}">
                    </div>
                    <div class="product-info">
                        <span class="product-brand">${prod.brand}</span>
                        <div class="product-name" title="${prod.name}">${prod.name}</div>
                        <span class="product-package">${prod.presentation}</span>
                        <div class="product-price-tag">$${prod.priceString}</div>
                    </div>
                </div>
            `;
        });

        html += `</div>`;
        pageBlock.innerHTML = html;
        container.appendChild(pageBlock);
    }
}

function handleImageError(imgElem, code) {
    const attempt = imgElem.dataset.attempt || "0";

    if (attempt === "0" && !imgElem.src.includes('data:image')) {
        imgElem.dataset.attempt = "1";
        imgElem.src = `${SUPABASE_STORAGE_URL}${code}.png`;
    } else {
        imgElem.onerror = null;
        imgElem.src = PLACEHOLDER_SVG;
    }
}

function renderEmptyMessage() {
    const container = document.getElementById('catalogContainer');
    if (!container) return;
    container.innerHTML = `
        <div style="text-align:center; padding: 40px; background: #fff; border-radius: 8px; border: 1px dashed #cbd5e1;">
            <p style="color:#64748b; font-weight: 600;">No hay productos cargados.</p>
            <p style="color:#94a3b8; font-size: 0.85em; margin-top: 6px;">Verifica los filtros aplicados o la fuente de datos.</p>
        </div>
    `;
}

// =========================================================================
// FILTROS, BÚSQUEDA Y SINCRONIZACIÓN MÓVIL / ESCRITORIO
// =========================================================================

function syncAndFilter(type, value) {
    if (type === 'category') {
        const sideCat = document.getElementById('categorySelect');
        const mobileCat = document.getElementById('mobileCategorySelect');
        if (sideCat && sideCat.value !== value) sideCat.value = value;
        if (mobileCat && mobileCat.value !== value) mobileCat.value = value;

        updateBrandsBySelectedCategory(value);

    } else if (type === 'brand') {
        const sideBrand = document.getElementById('brandSelect');
        const mobileBrand = document.getElementById('mobileBrandSelect');
        if (sideBrand && sideBrand.value !== value) sideBrand.value = value;
        if (mobileBrand && mobileBrand.value !== value) mobileBrand.value = value;

    } else if (type === 'sort') {
        const sideSort = document.getElementById('sortSelect');
        const mobileSort = document.getElementById('mobileSortSelect');
        if (sideSort && sideSort.value !== value) sideSort.value = value;
        if (mobileSort && mobileSort.value !== value) mobileSort.value = value;
    }

    filterProducts();
}

function updateBrandsBySelectedCategory(selectedCategory) {
    let availableBrands;
    if (selectedCategory === 'all') {
        availableBrands = Array.from(new Set(rawProductsData.map(p => p.brand).filter(Boolean)));
    } else {
        availableBrands = Array.from(new Set(
            rawProductsData
                .filter(p => p.category === selectedCategory)
                .map(p => p.brand)
                .filter(Boolean)
        ));
    }

    const currentBrandSelect = document.getElementById('brandSelect');
    const currentBrandVal = currentBrandSelect ? currentBrandSelect.value : 'all';
    
    const newSelectedVal = availableBrands.includes(currentBrandVal) ? currentBrandVal : 'all';
    
    populateBrandSelect(availableBrands, newSelectedVal);
}

function filterProducts() {
    const topSearch = document.getElementById('topSearchInput');
    const searchVal = topSearch ? topSearch.value.toLowerCase() : '';

    const sideCat = document.getElementById('categorySelect');
    const selectedCat = sideCat ? sideCat.value : 'all';

    const sideBrand = document.getElementById('brandSelect');
    const selectedBrand = sideBrand ? sideBrand.value : 'all';

    const sideSort = document.getElementById('sortSelect');
    const sortVal = sideSort ? sideSort.value : 'default';

    let filtered = rawProductsData.filter(p => {
        const matchSearch = p.name.toLowerCase().includes(searchVal) || 
                            p.code.toLowerCase().includes(searchVal) || 
                            p.brand.toLowerCase().includes(searchVal);
        const matchCat = (selectedCat === 'all' || p.category === selectedCat);
        const matchBrand = (selectedBrand === 'all' || p.brand === selectedBrand);
        return matchSearch && matchCat && matchBrand;
    });

    // LÓGICA DE LA FRANJA DINÁMICA
    const stripElem = document.getElementById('stripActiveCategory');
    if (stripElem) {
        if (filtered.length === 0) {
            stripElem.textContent = 'SIN RESULTADOS';
        } else if (selectedBrand !== 'all') {
            if (selectedCat !== 'all') {
                stripElem.textContent = `${selectedCat}: ${selectedBrand} (${filtered.length} PRODUCTOS)`;
            } else {
                stripElem.textContent = `${selectedBrand} (${filtered.length} PRODUCTOS)`;
            }
        } else if (selectedCat !== 'all') {
            const brandsInCat = Array.from(new Set(filtered.map(p => p.brand).filter(Boolean)));
            if (brandsInCat.length === 1) {
                stripElem.textContent = `${selectedCat}: ${brandsInCat[0]} (${filtered.length} PRODUCTOS)`;
            } else {
                stripElem.textContent = `${selectedCat} (${filtered.length} PRODUCTOS, ${brandsInCat.length} MARCAS)`;
            }
        } else {
            const categoriesMap = {};
            filtered.forEach(p => {
                if (!categoriesMap[p.category]) categoriesMap[p.category] = new Set();
                if (p.brand) categoriesMap[p.category].add(p.brand);
            });

            const catSummaries = Object.entries(categoriesMap).map(([catName, brandSet]) => {
                const brandCount = brandSet.size;
                return `${catName} (${brandCount} ${brandCount === 1 ? 'MARCA' : 'MARCAS'})`;
            });

            stripElem.textContent = catSummaries.join(', ');
        }
    }

    // Ordenamiento
    filtered.sort((a, b) => {
        switch (sortVal) {
            case 'default':
                const catCompare = a.category.localeCompare(b.category);
                if (catCompare !== 0) return catCompare;
                return a.brand.localeCompare(b.brand);
            case 'name-asc':
                return a.name.localeCompare(b.name);
            case 'name-desc':
                return b.name.localeCompare(a.name);
            case 'price-asc':
                return a.priceNum - b.priceNum;
            case 'price-desc':
                return b.priceNum - a.priceNum;
            case 'category-asc':
                return a.category.localeCompare(b.category);
            case 'category-desc':
                return b.category.localeCompare(a.category);
            case 'brand-asc':
                return a.brand.localeCompare(b.brand);
            case 'brand-desc':
                return b.brand.localeCompare(a.brand);
            default:
                return 0;
        }
    });

    renderCatalog(filtered);
}
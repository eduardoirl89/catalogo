// =========================================================================
// CONFIGURACIÓN DE FUENTES DE DATOS E IMÁGENES
// =========================================================================

// 1. Pega aquí el enlace de tu CSV publicado desde Google Sheets
const GOOGLE_SHEETS_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQf6lHp7YR9F2iYzaTexYRHm1lyxJwblAj95GAQ-ekPfkPlGqqgUxM-S1yyeAnHuW9ZZXwBPIOi2TI_/pub?gid=412358378&single=true&output=csv";

// 2. Configuración de Supabase Storage para imágenes de productos
const SUPABASE_PROJECT_URL = 'https://svruhyxfrfcafqjyziys.supabase.co';
const SUPABASE_BUCKET_NAME = 'imagenes-catalogo';
const SUPABASE_STORAGE_URL = `${SUPABASE_PROJECT_URL}/storage/v1/object/public/${SUPABASE_BUCKET_NAME}/`;

// 3. SVG marcador (Placeholder) liviano de 2KB para productos sin foto
const PLACEHOLDER_SVG = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 24 24" fill="none" stroke="%23cbd5e1" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';

// Variables globales del catálogo
let rawProductsData = [];
let customImages = {}; 
let companyLogoBase64 = ''; 
let qrLogoBase64 = ''; 
let editModeActive = false;

// =========================================================================
// CARGA INICIAL DE DATOS
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
            // Si falla la red o la URL no está disponible, intenta buscar el archivo local de respaldo
            fetch("catalogo_productos.csv")
                .then(res => {
                    if (!res.ok) throw new Error("No hay copia local disponible");
                    return res.text();
                })
                .then(text => parseCSV(text))
                .catch(() => renderEmptyMessage());
        });
});

// =========================================================================
// INTERFAZ Y MODALES
// =========================================================================

function toggleMainMenu() {
    const menu = document.getElementById('mainDropdownMenu');
    if (menu) menu.classList.toggle('active');
}

function toggleMobileSearch() {
    const sidebar = document.getElementById('sidebarMenu');
    if (sidebar) sidebar.classList.toggle('mobile-visible');
}

function toggleCompanyCoverMobile() {
    const cover = document.getElementById('pdfCoverSection');
    if (cover) cover.classList.toggle('mobile-visible');
}

function toggleEditModeMobile() {
    editModeActive = !editModeActive;
    const btn = document.getElementById('editModeBtnMobile');
    if (btn) {
        btn.textContent = `MODO EDICIÓN: ${editModeActive ? 'ACTIVADO' : 'DESACTIVADO'}`;
        btn.style.backgroundColor = editModeActive ? '#16a34a' : '#3b82f6';
    }
}

function openModal() {
    document.getElementById('adminModal').style.display = 'flex';
}

function closeModal() {
    document.getElementById('adminModal').style.display = 'none';
}

/* Compartir por WhatsApp */
function shareCatalogWhatsApp(event) {
    event.preventDefault();
    const currentUrl = encodeURIComponent(window.location.href);
    const message = encodeURIComponent(`Hola, te comparto el catálogo digital de productos: ${decodeURIComponent(currentUrl)}`);
    window.open(`https://api.whatsapp.com/send?text=${message}`, '_blank');
}

/* Personalización visual de portada */
function changeCoverBgColor(color) {
    const cover = document.getElementById('pdfCoverSection');
    if (cover) cover.style.backgroundColor = color;
}

function changeCoverTextColor(color) {
    const cover = document.getElementById('pdfCoverSection');
    if (cover) cover.style.color = color;
}

// =========================================================================
// EXPORTACIÓN Y LOGOS
// =========================================================================

function exportCSV() {
    if (rawProductsData.length === 0) {
        alert("No hay datos cargados para exportar.");
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,CODIGO;CATEGORIA;MARCA;NOMBRE;PRESENTACION;PRECIO;URL\n";
    rawProductsData.forEach(p => {
        csvContent += `"${p.code}";"${p.category}";"${p.brand}";"${p.name}";"${p.presentation}";"${p.priceString}";"${p.customUrl || ''}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "catalogo_productos.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function exportEncodedImages() {
    if (Object.keys(customImages).length === 0) {
        alert("No hay imágenes codificadas personalizadas cargadas.");
        return;
    }

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(customImages));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "imagenes_codificadas.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
}

function handleCompanyLogoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        companyLogoBase64 = e.target.result;
        const logoImg = document.getElementById('companyLogoImg');
        if (logoImg) {
            logoImg.src = companyLogoBase64;
            logoImg.style.display = 'block';
        }
    };
    reader.readAsDataURL(file);
}

function handleQRLogoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        qrLogoBase64 = e.target.result;
        const qrImg = document.getElementById('qrLogoImg');
        if (qrImg) {
            qrImg.src = qrLogoBase64;
            qrImg.style.display = 'block';
        }
    };
    reader.readAsDataURL(file);
}

function handleCSVFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        parseCSV(e.target.result);
    };
    reader.readAsText(file);
}

// =========================================================================
// PARSEO DE CSV Y CONSTRUCCIÓN DE OBJETOS
// =========================================================================

function parseCSV(text) {
    const lines = text.split(/\r\n|\n/);
    rawProductsData = [];
    const categoriesSet = new Set();

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
        }
    }

    populateCategorySelect(Array.from(categoriesSet));
    renderCatalog(rawProductsData);
    closeModal();
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
    const select = document.getElementById('categorySelect');
    if (!select) return;
    
    select.innerHTML = '<option value="all">Todas las categorías</option>';
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        select.appendChild(option);
    });
}

// =========================================================================
// RENDERIZADO DE CATÁLOGO Y OPTIMIZACIÓN DE IMÁGENES
// =========================================================================

function getProductImageUrl(prod) {
    // 1. Imagen subida manualmente en el navegador
    if (customImages[prod.code]) return customImages[prod.code];

    // 2. Enlace explícito indicado en la columna del CSV (URL)
    if (prod.customUrl && prod.customUrl.trim() !== '') {
        return prod.customUrl.trim();
    }

    // 3. Apunta por defecto al archivo en Supabase Storage
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

    const grouped = {};
    products.forEach(p => {
        if (!grouped[p.category]) grouped[p.category] = [];
        grouped[p.category].push(p);
    });

    for (const [category, items] of Object.entries(grouped)) {
        const pageSize = 12; // Formato 3x4 por página para impresión PDF
        for (let i = 0; i < items.length; i += pageSize) {
            const pageItems = items.slice(i, i + pageSize);

            const pageBlock = document.createElement('div');
            pageBlock.className = 'page-block category-group';

            let html = `
                <aside class="category-sidebar">
                    <span class="category-title-text">${category}</span>
                </aside>
                <div class="products-grid">
            `;

            pageItems.forEach((prod) => {
                const imageSrc = getProductImageUrl(prod);

                html += `
                    <div class="product-card" onclick="triggerImageUpload('${prod.code}')">
                        <input type="file" id="file-${prod.code}" accept="image/*" style="display:none;" onchange="uploadProductImage(event, '${prod.code}')">
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
}

// Control de carga de imagen con reintento controlado (máximo 1 reintento para prevenir bucles)
function handleImageError(imgElem, code) {
    const attempt = imgElem.dataset.attempt || "0";

    if (attempt === "0" && !imgElem.src.includes('data:image')) {
        // Si falló el formato predeterminado .webp, prueba con .png
        imgElem.dataset.attempt = "1";
        imgElem.src = `${SUPABASE_STORAGE_URL}${code}.png`;
    } else {
        // Si vuelve a fallar, corta las peticiones y asigna el marcador SVG
        imgElem.onerror = null;
        imgElem.src = PLACEHOLDER_SVG;
    }
}

function triggerImageUpload(code) {
    if (window.innerWidth <= 768 && !editModeActive) {
        return;
    }
    const input = document.getElementById(`file-${code}`);
    if (input) input.click();
}

function uploadProductImage(event, code) {
    event.stopPropagation();
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const base64Img = e.target.result;
            customImages[code] = base64Img;
            const imgElem = document.getElementById(`img-${code}`);
            if (imgElem) {
                imgElem.onerror = null;
                imgElem.src = base64Img;
            }
            filterProducts();
        };
        reader.readAsDataURL(file);
    }
}

function renderEmptyMessage() {
    const container = document.getElementById('catalogContainer');
    if (!container) return;
    container.innerHTML = `
        <div style="text-align:center; padding: 40px; background: #fff; border-radius: 8px; border: 1px dashed #cbd5e1;">
            <p style="color:#64748b; font-weight: 600;">No hay productos cargados.</p>
            <p style="color:#94a3b8; font-size: 0.85em; margin-top: 6px;">Verifica el enlace publicado de Google Sheets o usa el menú <strong>DATOS</strong> para subir un archivo CSV.</p>
        </div>
    `;
}

// =========================================================================
// FILTROS, BÚSQUEDA Y ORDENAMIENTO
// =========================================================================

function filterProducts() {
    const searchVal = document.getElementById('searchInput').value.toLowerCase();
    const selectedCat = document.getElementById('categorySelect').value;
    const sortVal = document.getElementById('sortSelect').value;

    let filtered = rawProductsData.filter(p => {
        const matchSearch = p.name.toLowerCase().includes(searchVal) || 
                            p.code.toLowerCase().includes(searchVal) || 
                            p.brand.toLowerCase().includes(searchVal);
        const matchCat = (selectedCat === 'all' || p.category === selectedCat);
        return matchSearch && matchCat;
    });

    filtered.sort((a, b) => {
        switch (sortVal) {
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

function setColumns(cols) {
    const container = document.getElementById('catalogContainer');
    if (!container) return;
    
    container.className = `cols-${cols}`;

    const btn2 = document.getElementById('btn2col');
    const btn4 = document.getElementById('btn4col');

    if (btn2 && btn4) {
        btn2.classList.toggle('active', cols === 2);
        btn4.classList.toggle('active', cols === 4);
    }
}

let rawProductsData = [];
let customImages = {}; 
let companyLogoBase64 = ''; 
let qrLogoBase64 = ''; 
let editModeActive = false;

document.addEventListener("DOMContentLoaded", () => {
    // UNIFICADO: Busca 'catalogo_productos.csv' por defecto al cargar la página
    fetch("catalogo_productos.csv")
        .then(res => {
            if (!res.ok) throw new Error("No se halló catalogo_productos.csv automático");
            return res.text();
        })
        .then(text => parseCSV(text))
        .catch(() => renderEmptyMessage());
});

function toggleMainMenu() {
    const menu = document.getElementById('mainDropdownMenu');
    if (menu) {
        menu.classList.toggle('active');
    }
}

function toggleMobileSearch() {
    const sidebar = document.getElementById('sidebarMenu');
    if (sidebar) {
        sidebar.classList.toggle('mobile-visible');
    }
}

function toggleCompanyCoverMobile() {
    const cover = document.getElementById('pdfCoverSection');
    if (cover) {
        cover.classList.toggle('mobile-visible');
    }
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

/* ENVIAR URL / MENSAJE POR WHATSAPP */
function shareCatalogWhatsApp(event) {
    event.preventDefault();
    const currentUrl = encodeURIComponent(window.location.href);
    const message = encodeURIComponent(`Hola, te comparto el catálogo digital de productos: ${decodeURIComponent(currentUrl)}`);
    window.open(`https://api.whatsapp.com/send?text=${message}`, '_blank');
}

/* PERSONALIZACIÓN VISUAL */
function changeCoverBgColor(color) {
    const cover = document.getElementById('pdfCoverSection');
    if (cover) cover.style.backgroundColor = color;
}

function changeCoverTextColor(color) {
    const cover = document.getElementById('pdfCoverSection');
    if (cover) cover.style.color = color;
}

/* EXPORTACIONES (UNIFICADO A catalogo_productos.csv) */
function exportCSV() {
    if (rawProductsData.length === 0) {
        alert("No hay datos cargados para exportar.");
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,CODIGO;CATEGORIA;MARCA;NOMBRE;PRESENTACION;PRECIO\n";
    rawProductsData.forEach(p => {
        csvContent += `"${p.code}";"${p.category}";"${p.brand}";"${p.name}";"${p.presentation}";"${p.priceString}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "catalogo_productos.csv"); // Nombre unificado
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

/* CARGA DE LOGOTIPOS */
function handleCompanyLogoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        companyLogoBase64 = e.target.result;
        const logoImg = document.getElementById('companyLogoImg');
        if (logoImg) {
            logoImg.src = companyLogoBase64;
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

function parseCSV(text) {
    const lines = text.split(/\r\n|\n/);
    rawProductsData = [];
    const categoriesSet = new Set();

    if (lines.length < 2) return;

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
        let rawPrice = cols[5] !== undefined ? cols[5] : cols[cols.length - 1];

        if (name) {
            const formattedPrice = formatExactPrice(rawPrice);
            rawProductsData.push({
                code, 
                category, 
                brand, 
                name, 
                presentation, 
                priceString: formattedPrice,
                priceNum: parseFloat(formattedPrice) || 0
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
    let cleanStr = valStr.replace(/["'$]/g, '').trim().replace(',', '.');
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
    select.innerHTML = '<option value="all">Todas las categorías</option>';

    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        select.appendChild(option);
    });
}

function renderCatalog(products) {
    const container = document.getElementById('catalogContainer');
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
        const pageSize = 12; // 3x4 por página
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
                const imageSrc = customImages[prod.code] || `img/${prod.code}.jpg`;

                html += `
                    <div class="product-card" onclick="triggerImageUpload('${prod.code}')">
                        <input type="file" id="file-${prod.code}" accept="image/*" style="display:none;" onchange="uploadProductImage(event, '${prod.code}')">
                        <div class="product-img-box">
                            <img id="img-${prod.code}" src="${imageSrc}" onerror="handleImageError(this, '${prod.code}')" alt="${prod.name}">
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

function handleImageError(imgElem, code) {
    if (imgElem.src.endsWith('.jpg')) {
        imgElem.src = `img/${code}.png`;
    } else {
        imgElem.style.display = 'none';
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
                imgElem.src = base64Img;
                imgElem.style.display = 'block';
            }
            filterProducts();
        };
        reader.readAsDataURL(file);
    }
}

function renderEmptyMessage() {
    const container = document.getElementById('catalogContainer');
    container.innerHTML = `
        <div style="text-align:center; padding: 40px; background: #fff; border-radius: 8px; border: 1px dashed #cbd5e1;">
            <p style="color:#64748b; font-weight: 600;">No hay productos cargados.</p>
            <p style="color:#94a3b8; font-size: 0.85em; margin-top: 6px;">Asegúrate de colocar <strong>catalogo_productos.csv</strong> en la carpeta del proyecto o usa el menú <strong>DATOS</strong> para importarlo.</p>
        </div>
    `;
}

/* BÚSQUEDA, FILTRADO Y ORDENAMIENTO DE PRODUCTOS */
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

    // Lógica de ordenamiento
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
    container.className = `cols-${cols}`;

    const btn2 = document.getElementById('btn2col');
    const btn4 = document.getElementById('btn4col');

    if (btn2 && btn4) {
        btn2.classList.toggle('active', cols === 2);
        btn4.classList.toggle('active', cols === 4);
    }
}
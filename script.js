const gridContainer = document.getElementById('product-grid');

async function cargarCatalogoCSV() {
    try {
        const respuesta = await fetch('productos.csv');
        const dataTexto = await respuesta.text();

        const lineas = dataTexto.split('\n');
        gridContainer.innerHTML = '';

        const categoriasMap = {};

        for (let i = 1; i < lineas.length; i++) {
            const linea = lineas[i].trim();
            if (!linea) continue;

            const columnas = linea.split(',');
            
            const rawPrice = parseFloat(columnas[5]?.trim());
            const formattedPrice = !isNaN(rawPrice) ? "$" + rawPrice.toFixed(2) : "$0.00";

            const producto = {
                code: columnas[0]?.trim(),
                category: columnas[1]?.trim() || 'General',
                brand: columnas[2]?.trim(),
                name: columnas[3]?.trim(),
                presentation: columnas[4]?.trim(),
                price: formattedPrice
            };

            if (!categoriasMap[producto.category]) {
                categoriasMap[producto.category] = [];
            }
            categoriasMap[producto.category].push(producto);
        }

        for (const [categoria, productos] of Object.entries(categoriasMap)) {
            const tituloSeccion = document.createElement('div');
            tituloSeccion.className = 'category-section-title';
            tituloSeccion.innerHTML = `<h2>${categoria}</h2>`;
            gridContainer.appendChild(tituloSeccion);

            const subGrid = document.createElement('div');
            subGrid.className = 'sub-grid';

            productos.forEach(producto => {
                const card = document.createElement('div');
                card.className = 'product-card';
                
                // Guardar los datos en minusculas para facilitar la busqueda
                const stringBusqueda = `${producto.name} ${producto.brand} ${producto.category}`.toLowerCase();
                card.setAttribute('data-search', stringBusqueda);

                const extensiones = ['.jpg', '.jpeg', '.png', '.JPG', '.PNG'];
                let indexExt = 0;

                const imgElement = document.createElement('img');
                imgElement.alt = producto.name;
                
                imgElement.onerror = function() {
                    indexExt++;
                    if (indexExt < extensiones.length) {
                        this.src = `img/${producto.code}${extensiones[indexExt]}`;
                    } else {
                        this.src = 'https://via.placeholder.com/120?text=Sin+Imagen';
                    }
                };

                imgElement.src = `img/${producto.code}${extensiones[0]}`;

                const imageContainer = document.createElement('div');
                imageContainer.className = 'product-image-container';
                imageContainer.appendChild(imgElement);

                card.innerHTML = `
                    <div class="product-info-wrapper">
                        <div class="product-brand">${producto.brand}</div>
                        <div class="product-name" title="${producto.name}">${producto.name}</div>
                        <div class="product-presentation">${producto.presentation}</div>
                    </div>
                    <div class="product-price">${producto.price}</div>
                `;
                
                card.insertBefore(imageContainer, card.firstChild);
                subGrid.appendChild(card);
            });

            gridContainer.appendChild(subGrid);
        }

        // Re-aplicar busqueda si existia un término previo antes del renderizado
        filtrarProductos();

    } catch (error) {
        console.error("Error al cargar el archivo CSV:", error);
        gridContainer.innerHTML = "<p style='text-align:center;'>Error al cargar los datos del catálogo.</p>";
    }
}

function filtrarProductos() {
    const term = document.getElementById('search-input').value.toLowerCase().trim();
    const subGrids = document.querySelectorAll('.sub-grid');

    subGrids.forEach(subGrid => {
        const cards = subGrid.querySelectorAll('.product-card');
        let productosVisibles = 0;

        cards.forEach(card => {
            const searchData = card.getAttribute('data-search') || '';
            if (searchData.includes(term)) {
                card.classList.remove('hidden');
                productosVisibles++;
            } else {
                card.classList.add('hidden');
            }
        });

        // Ocultar la categoría completa si no posee productos coincidentes
        const tituloSeccion = subGrid.previousElementSibling;
        if (tituloSeccion && tituloSeccion.classList.contains('category-section-title')) {
            if (productosVisibles > 0) {
                tituloSeccion.style.display = '';
                subGrid.style.display = '';
            } else {
                tituloSeccion.style.display = 'none';
                subGrid.style.display = 'none';
            }
        }
    });
}

function exportarPDF() {
    window.print();
}

function setLayout(mode, event) {
    const body = document.body;
    const buttons = document.querySelectorAll('.layout-btn');
    
    buttons.forEach(btn => btn.classList.remove('active'));
    
    if (mode === 'grid-2') {
        body.classList.add('layout-grid-2');
        if (event) event.currentTarget.classList.add('active');
        localStorage.setItem('catalog_layout', 'grid-2');
    } else {
        body.classList.remove('layout-grid-2');
        if (event) event.currentTarget.classList.add('active');
        localStorage.setItem('catalog_layout', 'grid-4');
    }

    // Volver a ejecutar el filtro tras alternar la vista
    filtrarProductos();
}

window.addEventListener('DOMContentLoaded', () => {
    cargarCatalogoCSV();
    const savedLayout = localStorage.getItem('catalog_layout');
    if (savedLayout === 'grid-2') {
        document.body.classList.add('layout-grid-2');
        const buttons = document.querySelectorAll('.layout-btn');
        if (buttons.length >= 2) {
            buttons[0].classList.remove('active');
            buttons[1].classList.add('active');
        }
    }
});
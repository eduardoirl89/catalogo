document.addEventListener('DOMContentLoaded', () => {
    // Datos de productos de muestra / interfaz
    const productsData = [
        { id: "7591127122520", name: "COCA-COLA 1.25 LT", category: "BEBIDAS", price: "$4.50", image: "FEMSA/7591127122520.png" },
        { id: "7591014024920", name: "FRICAJITA DURAZNO 1X250ML", category: "BEBIDAS", price: "$1.01", image: "PARMALAT/7591014024920.png" },
        { id: "7591221106600", name: "MOSTAZA PREPARADA IBERIA 185G", category: "ALIMENTOS", price: "$1.98", image: "IBERIA/7591221106600.png" }
    ];

    const productsGrid = document.getElementById('productsGrid');
    const searchInput = document.getElementById('searchInput');
    const clearSearchBtn = document.getElementById('clearSearch');
    const categoriesList = document.getElementById('categoriesList');
    const productCount = document.getElementById('productCount');
    const noResults = document.getElementById('noResults');

    let currentCategory = 'all';
    let searchTerm = '';

    /**
     * Transforma cualquier extensión (.png, .jpg, .jpeg) a .webp
     */
    function getWebPUrl(path) {
        if (!path) return '';
        return path.replace(/\.(png|jpg|jpeg)$/i, '.webp');
    }

    /**
     * Construye la estructura de la imagen optimizada WebP usando la etiqueta <picture>
     */
    function createPictureElement(imagePath, altText) {
        const webpPath = getWebPUrl(imagePath);
        
        return `
            <picture>
                <source srcset="${webpPath}" type="image/webp">
                <img 
                    src="${imagePath}" 
                    alt="${altText}" 
                    loading="lazy"
                    onerror="this.onerror=null; this.src='https://via.placeholder.com/200?text=Sin+Imagen';"
                >
            </picture>
        `;
    }

    /**
     * Renderiza los productos aplicando filtros
     */
    function renderProducts() {
        productsGrid.innerHTML = '';

        const filtered = productsData.filter(product => {
            const matchesCategory = currentCategory === 'all' || product.category === currentCategory;
            const matchesSearch = product.name.toLowerCase().includes(searchTerm) ||
                                  product.id.includes(searchTerm) ||
                                  product.category.toLowerCase().includes(searchTerm);
            return matchesCategory && matchesSearch;
        });

        productCount.textContent = `${filtered.length} Productos`;

        if (filtered.length === 0) {
            noResults.style.display = 'block';
            return;
        }

        noResults.style.display = 'none';

        filtered.forEach(product => {
            const card = document.createElement('div');
            card.className = 'product-card';

            card.innerHTML = `
                <div class="img-container">
                    ${createPictureElement(product.image, product.name)}
                </div>
                <div class="product-details">
                    <div class="product-title">${product.name}</div>
                    <div class="product-meta">Cód: ${product.id} | ${product.category}</div>
                    <div class="product-price-val">${product.price}</div>
                </div>
            `;

            // Click para abrir visor
            card.querySelector('.img-container').addEventListener('click', () => {
                openModal(product);
            });

            productsGrid.appendChild(card);
        });
    }

    // Modal
    const modal = document.getElementById('imageModal');
    const closeModal = document.getElementById('closeModal');
    const modalImageContainer = document.getElementById('modalImageContainer');
    const modalTitle = document.getElementById('modalTitle');
    const modalCode = document.getElementById('modalCode');
    const modalCategory = document.getElementById('modalCategory');
    const modalPrice = document.getElementById('modalPrice');

    function openModal(product) {
        modalImageContainer.innerHTML = createPictureElement(product.image, product.name);
        modalTitle.textContent = product.name;
        modalCode.textContent = `Código: ${product.id}`;
        modalCategory.textContent = `Categoría: ${product.category}`;
        modalPrice.textContent = `Precio: ${product.price}`;
        modal.style.display = 'flex';
    }

    if (closeModal) {
        closeModal.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }

    window.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
    });

    // Control del buscador
    searchInput.addEventListener('input', (e) => {
        searchTerm = e.target.value.trim().toLowerCase();
        clearSearchBtn.style.display = searchTerm ? 'block' : 'none';
        renderProducts();
    });

    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchTerm = '';
        clearSearchBtn.style.display = 'none';
        renderProducts();
    });

    // Carga inicial
    renderProducts();
});

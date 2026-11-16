/* Logika halaman katalog pembeli. */

const catalogState = {
  search: '',
  categoryId: null,
  sort: 'featured'
};

let catalogCategories = [];
let catalogSearchTimer = null;

async function initCatalog() {
  renderSkeleton();
  await Promise.all([loadSession(), loadStoreInfo()]);
  updateStoreCopy();
  bindCatalogEvents();
  await loadCategories();
  await loadProducts();
}

function updateStoreCopy() {
  if (!App.store) return;
  document.getElementById('hero-store-hours').textContent = App.store.jamBuka || 'Buka Setiap Hari';
  document.getElementById('hero-store-name').textContent = App.store.namaToko || 'Ayiyaaa Street Bistro';
}

function renderSkeleton() {
  document.getElementById('catalog-grid').innerHTML = Array.from({ length: 4 })
    .map(
      () => `
        <div class="bg-white rounded-3xl border border-cream-200 overflow-hidden">
          <div class="aspect-[16/10] skeleton"></div>
          <div class="p-4 space-y-3">
            <div class="h-4 w-3/4 rounded skeleton"></div>
            <div class="h-3 w-full rounded skeleton"></div>
            <div class="h-3 w-2/3 rounded skeleton"></div>
            <div class="h-9 w-full rounded-xl skeleton mt-4"></div>
          </div>
        </div>`
    )
    .join('');
}

function bindCatalogEvents() {
  const searchInput = document.getElementById('catalog-search');
  searchInput.addEventListener('input', (event) => {
    const value = event.target.value;
    catalogState.search = value;
    document.getElementById('clear-search-btn').classList.toggle('hidden', value.trim().length === 0);

    clearTimeout(catalogSearchTimer);
    catalogSearchTimer = setTimeout(loadProducts, 250);
  });

  document.getElementById('clear-search-btn').addEventListener('click', () => {
    searchInput.value = '';
    catalogState.search = '';
    document.getElementById('clear-search-btn').classList.add('hidden');
    loadProducts();
  });

  document.getElementById('catalog-sort').addEventListener('change', (event) => {
    catalogState.sort = event.target.value;
    loadProducts();
  });

  document.getElementById('reset-filters-btn').addEventListener('click', () => {
    catalogState.search = '';
    catalogState.categoryId = null;
    catalogState.sort = 'featured';
    document.getElementById('catalog-search').value = '';
    document.getElementById('catalog-sort').value = 'featured';
    document.getElementById('clear-search-btn').classList.add('hidden');
    renderCategoryPills();
    loadProducts();
  });
}

async function loadCategories() {
  try {
    const data = await API.get('/categories');
    catalogCategories = data.categories;
    renderCategoryPills();
  } catch (err) {
    showToast('Gagal memuat kategori: ' + err.message, 'error');
  }
}

function renderCategoryPills() {
  const container = document.getElementById('category-pills');
  const total = catalogCategories.reduce((sum, category) => sum + category.jumlahProduk, 0);

  const pills = [{ id: null, nama: 'Semua', jumlahProduk: total }, ...catalogCategories];

  container.innerHTML = pills
    .map((category) => {
      const isActive =
        (category.id === null && catalogState.categoryId === null) ||
        Number(category.id) === Number(catalogState.categoryId);
      return `
        <button type="button" data-category-id="${category.id ?? ''}"
          class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            isActive
              ? 'bg-chili-600 text-white shadow-sm'
              : 'bg-cream-100 text-stone-700 hover:bg-cream-200 border border-cream-200'
          }">
          <span>${escapeHtml(category.nama)}</span>
          <span class="px-1.5 py-0.5 rounded-md text-[10px] ${isActive ? 'bg-white/20 text-white' : 'bg-white text-stone-500'}">${category.jumlahProduk}</span>
        </button>`;
    })
    .join('');

  container.querySelectorAll('[data-category-id]').forEach((button) => {
    button.addEventListener('click', () => {
      catalogState.categoryId = button.dataset.categoryId ? Number(button.dataset.categoryId) : null;
      renderCategoryPills();
      loadProducts();
    });
  });

  if (window.lucide) window.lucide.createIcons();
}

async function loadProducts() {
  const grid = document.getElementById('catalog-grid');
  const params = new URLSearchParams();
  if (catalogState.search.trim()) params.set('search', catalogState.search.trim());
  if (catalogState.categoryId) params.set('categoryId', catalogState.categoryId);
  params.set('sort', catalogState.sort);

  try {
    const data = await API.get(`/catalog?${params.toString()}`);
    if (data.store) {
      App.store = data.store;
      updateStoreCopy();
    }
    window.__catalogProducts = data.products || [];
    renderProducts(data.products);
  } catch (err) {
    grid.innerHTML = '';
    showToast('Gagal memuat menu: ' + err.message, 'error');
  }
}

function renderProducts(products) {
  const grid = document.getElementById('catalog-grid');
  const emptyState = document.getElementById('catalog-empty');
  const countLabel = document.getElementById('catalog-result-count');

  countLabel.textContent = `Menampilkan ${products.length} menu`;

  if (!products.length) {
    grid.innerHTML = '';
    grid.classList.add('hidden');
    emptyState.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  emptyState.classList.add('hidden');
  grid.classList.remove('hidden');

  grid.innerHTML = products
    .map((product) => {
      const isOutOfStock = product.stok <= 0;
      const isLowStock = !isOutOfStock && product.stok <= 5;
      const fallback = '/img/menu/bakso.svg';

      return `
        <article class="product-card bg-white rounded-3xl border border-cream-200 shadow-sm overflow-hidden flex flex-col justify-between ${isOutOfStock ? 'opacity-85' : ''}">
          <div>
            <div class="relative aspect-[16/10] bg-cream-100 overflow-hidden">
              <img src="${escapeHtml(product.imageUrl || fallback)}" alt="${escapeHtml(product.nama)}"
                onerror="this.src='${fallback}'"
                class="w-full h-full object-cover ${isOutOfStock ? 'grayscale-[45%]' : ''}" loading="lazy">
              <div class="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
                <span class="px-2.5 py-1 rounded-xl bg-charcoal/80 backdrop-blur-sm text-[11px] font-bold text-cream-50 shadow-sm">
                  ${escapeHtml(product.kategori)}
                </span>
                ${product.unggulan
                  ? `<span class="badge-gold inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-white text-[11px] font-extrabold tracking-wide">
                       <i data-lucide="star" class="w-3 h-3 fill-current"></i> Unggulan
                     </span>`
                  : ''}
              </div>
              ${isOutOfStock
                ? `<div class="absolute inset-0 bg-charcoal/55 backdrop-blur-[1px] flex items-center justify-center">
                     <span class="px-4 py-1.5 rounded-full bg-chili-600 text-white font-display font-bold text-xs uppercase tracking-wider shadow-md">Stok Habis</span>
                   </div>`
                : ''}
            </div>
            <div class="p-4 sm:p-5">
              <h3 class="font-display font-bold text-base sm:text-lg text-charcoal leading-snug mb-1.5">${escapeHtml(product.nama)}</h3>
              <p class="text-xs text-stone-500 line-clamp-2 leading-relaxed">${escapeHtml(product.deskripsi)}</p>
              <p class="text-[11px] text-stone-400 mt-2">oleh ${escapeHtml(product.sellerName || 'Ayiyaaa')}</p>
            </div>
          </div>
          <div class="px-4 sm:px-5 pb-4 sm:pb-5 pt-3 border-t border-cream-100 space-y-3">
            <div class="flex items-center justify-between">
              <div>
                <span class="block text-[10px] font-bold uppercase tracking-wider text-stone-400">Harga</span>
                <span class="font-display font-extrabold text-lg text-chili-600">${formatRupiah(product.harga)}</span>
              </div>
              <div class="text-right">
                ${isOutOfStock
                  ? `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-chili-50 text-chili-600 text-xs font-bold">Habis</span>`
                  : isLowStock
                  ? `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-turmeric-100 text-terracotta-700 text-xs font-bold">Sisa ${product.stok}</span>`
                  : `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-cream-100 text-stone-700 text-xs font-semibold">Stok: ${product.stok}</span>`}
              </div>
            </div>
            ${isOutOfStock
              ? `<button type="button" disabled class="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-stone-200 text-stone-400 text-xs sm:text-sm font-bold cursor-not-allowed">
                   <i data-lucide="slash" class="w-4 h-4"></i><span>Stok Habis</span>
                 </button>`
              : `<div class="flex gap-2">
                   <a href="${buildWhatsAppLink(product)}" target="_blank" rel="noopener noreferrer"
                     class="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white text-xs sm:text-sm font-bold shadow-sm transition-all">
                     <i data-lucide="message-circle" class="w-4 h-4"></i><span>Pesan</span>
                   </a>
                   <button type="button" onclick="addToCartProduct(${product.id})"
                     class="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-cream-100 hover:bg-cream-200 text-stone-700 text-xs sm:text-sm font-bold border border-cream-200 transition-colors" title="Tambah ke keranjang">
                     <i data-lucide="shopping-cart" class="w-4 h-4"></i>
                   </button>
                 </div>`}
          </div>
        </article>`;
    })
    .join('');

  if (window.lucide) window.lucide.createIcons();
}

initCatalog();

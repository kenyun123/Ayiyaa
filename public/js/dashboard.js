/* Logika dashboard seller/admin. */

const CATEGORY_IMAGE = {
  Bakso: '/img/menu/bakso.svg',
  'Mie Ayam': '/img/menu/mie-ayam.svg',
  'Paket Hemat': '/img/menu/paket-hemat.svg',
  'Topping & Ekstra': '/img/menu/topping.svg',
  Minuman: '/img/menu/minuman.svg'
};

const dashboardState = {
  products: [],
  categories: [],
  search: '',
  editingProductId: null,
  editingCategoryId: null,
  imageUrl: '/img/menu/bakso.svg',
  isCustomImage: false,
  uploading: false
};

function defaultImage(categoryId) {
  const category = dashboardState.categories.find((item) => Number(item.id) === Number(categoryId));
  return (category && CATEGORY_IMAGE[category.nama]) || '/img/menu/bakso.svg';
}

async function initDashboard() {
  const user = await requirePageRole(['seller', 'admin']);
  if (!user) return;

  document.getElementById('role-badge-text').textContent =
    user.role === 'admin' ? 'Masuk sebagai Admin' : 'Masuk sebagai Seller';
  document.getElementById('role-badge').title = user.email;

  bindDashboardEvents();
  setupImageUpload();

  if (user.role === 'admin') {
    const ownerField = document.getElementById('owner-field');
    if (ownerField) {
      ownerField.classList.remove('hidden');
      await loadSellerOptions();
    }
  }

  await loadCategories();
  await loadProducts();
  await loadSettings();

  resetProductForm();
  resetCategoryForm();
  renderStats();
  renderInventory();
  renderCategoryList();
  if (window.lucide) window.lucide.createIcons();
}

function bindDashboardEvents() {
  document.getElementById('product-form').addEventListener('submit', handleProductSubmit);
  document.getElementById('cancel-edit-btn').addEventListener('click', resetProductForm);
  document.getElementById('reset-uploaded-img-btn').addEventListener('click', resetProductImage);
  document.getElementById('prod-category').addEventListener('change', () => {
    if (!dashboardState.isCustomImage) {
      dashboardState.imageUrl = defaultImage(document.getElementById('prod-category').value);
      updateImagePreview();
    }
  });
  document.getElementById('pick-image-btn').addEventListener('click', () => {
    document.getElementById('prod-image-file').click();
  });

  document.getElementById('dashboard-search').addEventListener('input', (event) => {
    dashboardState.search = event.target.value;
    renderInventory();
  });

  document.getElementById('settings-form').addEventListener('submit', handleSettingsSubmit);

  document.getElementById('category-form').addEventListener('submit', handleCategorySubmit);
  document.getElementById('cancel-category-edit').addEventListener('click', resetCategoryForm);

  attachDropzoneEvents(document.getElementById('image-dropzone'));
}

async function loadSellerOptions() {
  const select = document.getElementById('owner-select');
  if (!select) return;
  try {
    const data = await API.get('/users?role=seller');
    select.innerHTML = data.users
      .map((user) => `<option value="${user.id}">${escapeHtml(user.nama)}${user.isActive ? '' : ' (nonaktif)'}</option>`)
      .join('');
    if (!data.users.length) {
      select.innerHTML = '<option value="">Belum ada seller</option>';
    }
  } catch (err) {
    showToast('Gagal memuat daftar seller: ' + err.message, 'error');
  }
}

async function loadProducts() {
  try {
    const data = await API.get('/products');
    dashboardState.products = data.products;
  } catch (err) {
    showToast('Gagal memuat produk: ' + err.message, 'error');
  }
}

async function loadCategories() {
  try {
    const data = await API.get('/categories');
    dashboardState.categories = data.categories;
    renderCategoryOptions();
  } catch (err) {
    showToast('Gagal memuat kategori: ' + err.message, 'error');
  }
}

async function loadSettings() {
  try {
    const data = await API.get('/settings');
    App.store = data.settings;
    document.getElementById('setting-store-name').value = data.settings.namaToko;
    document.getElementById('setting-whatsapp').value = data.settings.whatsappNumber;
    document.getElementById('setting-hours').value = data.settings.jamBuka || '';
  } catch (err) {
    showToast('Gagal memuat pengaturan toko: ' + err.message, 'error');
  }
}

function renderCategoryOptions() {
  const select = document.getElementById('prod-category');
  const selected = select.value;
  select.innerHTML = dashboardState.categories
    .map((category) => `<option value="${category.id}">${escapeHtml(category.nama)}</option>`)
    .join('');

  if (selected && dashboardState.categories.some((category) => Number(category.id) === Number(selected))) {
    select.value = selected;
  }
}

function renderStats() {
  const products = dashboardState.products;
  const totalStock = products.reduce((sum, product) => sum + product.stok, 0);
  const activeCategories = new Set(products.map((product) => product.kategori));

  document.getElementById('stat-products').textContent = products.length;
  document.getElementById('stat-stock').textContent = totalStock.toLocaleString('id-ID');
  document.getElementById('stat-categories').textContent = activeCategories.size;
  document.getElementById('stat-featured').textContent = products.filter((product) => product.unggulan).length;

  const counts = {};
  products.forEach((product) => {
    counts[product.kategori] = (counts[product.kategori] || 0) + 1;
  });

  const entries = Object.entries(counts);
  document.getElementById('stat-category-breakdown').innerHTML = entries.length
    ? entries
        .map(
          ([name, total]) =>
            `<span class="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-cream-100 text-stone-700 border border-cream-200">${escapeHtml(name)} (${total})</span>`
        )
        .join('')
    : '<span class="text-[11px] text-stone-400">Belum ada kategori aktif</span>';
}

function visibleProducts() {
  const query = dashboardState.search.trim().toLowerCase();
  if (!query) return dashboardState.products;
  return dashboardState.products.filter(
    (product) =>
      product.nama.toLowerCase().includes(query) ||
      product.kategori.toLowerCase().includes(query) ||
      (product.sellerName || '').toLowerCase().includes(query)
  );
}

function renderInventory() {
  const tbody = document.getElementById('inventory-body');
  const empty = document.getElementById('inventory-empty');
  const products = visibleProducts();

  if (!products.length) {
    tbody.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  tbody.innerHTML = products
    .map((product) => {
      const isEditing = dashboardState.editingProductId === product.id;
      return `
        <tr class="transition-colors ${isEditing ? 'bg-turmeric-50/70' : 'hover:bg-cream-50/80'}" data-row="${product.id}">
          <td class="py-3.5 px-4">
            <div class="flex items-center gap-3">
              <img src="${escapeHtml(product.imageUrl || '/img/menu/bakso.svg')}" alt="${escapeHtml(product.nama)}"
                onerror="this.src='/img/menu/bakso.svg'"
                class="w-11 h-11 rounded-xl object-cover border border-cream-200 bg-cream-100 shrink-0">
              <div class="min-w-0">
                <p class="font-bold text-charcoal text-xs sm:text-sm truncate max-w-[170px]">${escapeHtml(product.nama)}</p>
                <span class="inline-block mt-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-cream-100 text-stone-600">
                  ${escapeHtml(product.kategori)}
                </span>
                ${product.sellerName ? `<span class="ml-1 text-[10px] text-stone-400">${escapeHtml(product.sellerName)}</span>` : ''}
              </div>
            </div>
          </td>
          <td class="py-3.5 px-3 font-bold text-xs sm:text-sm text-chili-600 whitespace-nowrap">${formatRupiah(product.harga)}</td>
          <td class="py-3.5 px-3">
            <div class="flex items-center justify-center gap-1.5">
              <button type="button" data-stock="-1" data-id="${product.id}" title="Kurangi stok"
                class="w-7 h-7 rounded-lg bg-cream-100 hover:bg-cream-200 text-charcoal font-bold flex items-center justify-center transition-colors">-</button>
              <span class="min-w-[2rem] text-center text-xs font-extrabold ${product.stok === 0 ? 'text-chili-600' : 'text-charcoal'}">${product.stok}</span>
              <button type="button" data-stock="1" data-id="${product.id}" title="Tambah stok"
                class="w-7 h-7 rounded-lg bg-cream-100 hover:bg-cream-200 text-charcoal font-bold flex items-center justify-center transition-colors">+</button>
            </div>
          </td>
          <td class="py-3.5 px-3 text-center">
            <button type="button" data-featured="${product.id}" title="Ubah status unggulan"
              class="inline-flex items-center justify-center w-8 h-8 rounded-xl border transition-all ${
                product.unggulan
                  ? 'bg-turmeric-100 border-turmeric-300 text-amber-600'
                  : 'bg-cream-50 border-cream-200 text-stone-300 hover:text-stone-500'
              }">
              <i data-lucide="star" class="w-4 h-4 ${product.unggulan ? 'fill-current' : ''}"></i>
            </button>
          </td>
          <td class="py-3.5 px-4 text-right whitespace-nowrap">
            <div class="inline-flex items-center gap-1.5">
              <button type="button" data-edit="${product.id}" title="Edit menu"
                class="p-2 rounded-xl bg-cream-100 hover:bg-turmeric-100 text-stone-700 hover:text-terracotta-700 transition-colors">
                <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
              </button>
              <button type="button" data-delete="${product.id}" title="Hapus menu"
                class="p-2 rounded-xl bg-chili-50 hover:bg-chili-100 text-chili-600 transition-colors">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              </button>
            </div>
          </td>
        </tr>`;
    })
    .join('');

  tbody.querySelectorAll('[data-stock]').forEach((button) => {
    button.addEventListener('click', () => changeStock(Number(button.dataset.id), Number(button.dataset.stock)));
  });
  tbody.querySelectorAll('[data-featured]').forEach((button) => {
    button.addEventListener('click', () => toggleFeatured(Number(button.dataset.featured)));
  });
  tbody.querySelectorAll('[data-edit]').forEach((button) => {
    button.addEventListener('click', () => startEditProduct(Number(button.dataset.edit)));
  });
  tbody.querySelectorAll('[data-delete]').forEach((button) => {
    button.addEventListener('click', () => deleteProduct(Number(button.dataset.delete)));
  });

  if (window.lucide) window.lucide.createIcons();
}

function updatePreviewBadge() {
  const badge = document.getElementById('image-source-badge');
  badge.textContent = dashboardState.isCustomImage ? 'Foto Diunggah' : 'Placeholder Otomatis';
  badge.className = dashboardState.isCustomImage
    ? 'text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200'
    : 'text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-white text-stone-600 border border-cream-200';
  document.getElementById('reset-uploaded-img-btn').classList.toggle('hidden', !dashboardState.isCustomImage);
}

function updateImagePreview() {
  document.getElementById('form-img-preview').src = dashboardState.imageUrl;
  updatePreviewBadge();
}

function resetProductImage() {
  document.getElementById('prod-image-file').value = '';
  dashboardState.isCustomImage = false;
  dashboardState.imageUrl = defaultImage(document.getElementById('prod-category').value);
  updateImagePreview();
  showToast('Foto dihapus, kembali ke placeholder kategori.', 'info');
}

function resetProductForm() {
  dashboardState.editingProductId = null;
  document.getElementById('product-form').reset();
  document.getElementById('prod-id').value = '';
  document.getElementById('form-title').textContent = 'Tambah Menu Baru';
  document.getElementById('form-submit-text').textContent = 'Simpan Menu';
  document.getElementById('cancel-edit-btn').classList.add('hidden');
  document.getElementById('form-error').classList.add('hidden');

  const badge = document.getElementById('form-mode-badge');
  badge.className = 'w-9 h-9 rounded-xl bg-chili-100 text-chili-600 flex items-center justify-center';
  badge.innerHTML = '<i data-lucide="plus-circle" class="w-5 h-5"></i>';

  const select = document.getElementById('prod-category');
  if (!select.value && dashboardState.categories.length) select.value = dashboardState.categories[0].id;

  dashboardState.isCustomImage = false;
  dashboardState.imageUrl = defaultImage(select.value);
  updateImagePreview();
  if (window.lucide) window.lucide.createIcons();
}

function startEditProduct(id) {
  const product = dashboardState.products.find((item) => item.id === id);
  if (!product) return;

  dashboardState.editingProductId = id;
  document.getElementById('prod-id').value = product.id;
  document.getElementById('prod-name').value = product.nama;
  document.getElementById('prod-category').value = product.categoryId;
  document.getElementById('prod-price').value = product.harga;
  document.getElementById('prod-stock').value = product.stok;
  document.getElementById('prod-desc').value = product.deskripsi;
  document.getElementById('prod-featured').checked = product.unggulan;

  const ownerSelect = document.getElementById('owner-select');
  if (ownerSelect) ownerSelect.value = product.sellerId;

  dashboardState.imageUrl = product.imageUrl || defaultImage(product.categoryId);
  dashboardState.isCustomImage = !Object.values(CATEGORY_IMAGE).includes(product.imageUrl);
  updateImagePreview();

  document.getElementById('form-title').textContent = 'Edit Menu';
  document.getElementById('form-submit-text').textContent = 'Perbarui Menu';
  document.getElementById('cancel-edit-btn').classList.remove('hidden');

  const badge = document.getElementById('form-mode-badge');
  badge.className = 'w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center';
  badge.innerHTML = '<i data-lucide="pencil" class="w-5 h-5"></i>';

  document.getElementById('product-form-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
  renderInventory();
  if (window.lucide) window.lucide.createIcons();
}

async function handleProductSubmit(event) {
  event.preventDefault();

  const errorBox = document.getElementById('form-error');
  const errorText = document.getElementById('form-error-text');
  const submitButton = document.getElementById('form-submit-btn');

  const payload = {
    nama: document.getElementById('prod-name').value.trim(),
    categoryId: Number(document.getElementById('prod-category').value),
    harga: Number(document.getElementById('prod-price').value),
    stok: Number(document.getElementById('prod-stock').value),
    deskripsi: document.getElementById('prod-desc').value.trim(),
    imageUrl: dashboardState.imageUrl,
    unggulan: document.getElementById('prod-featured').checked
  };

  const ownerSelect = document.getElementById('owner-select');
  if (App.user.role === 'admin' && ownerSelect && ownerSelect.value) {
    payload.sellerId = Number(ownerSelect.value);
  }

  if (!payload.nama || !payload.deskripsi || !payload.categoryId) {
    errorText.textContent = 'Nama, kategori, dan deskripsi menu wajib diisi.';
    errorBox.classList.remove('hidden');
    return;
  }
  if (!Number.isFinite(payload.harga) || payload.harga < 0 || !Number.isInteger(payload.stok) || payload.stok < 0) {
    errorText.textContent = 'Harga dan stok tidak boleh negatif.';
    errorBox.classList.remove('hidden');
    return;
  }

  errorBox.classList.add('hidden');
  setButtonLoading(submitButton, true, 'Menyimpan...');

  try {
    if (dashboardState.editingProductId) {
      await API.put(`/products/${dashboardState.editingProductId}`, payload);
      showToast(`Menu "${payload.nama}" berhasil diperbarui.`);
    } else {
      // Seller tidak boleh mengirim sellerId sendiri.
      if (App.user.role !== 'admin') delete payload.sellerId;
      await API.post('/products', payload);
      showToast(`Menu "${payload.nama}" berhasil ditambahkan.`);
    }

    await loadProducts();
    await loadCategories();
    renderStats();
    renderInventory();
    renderCategoryList();
    resetProductForm();
  } catch (err) {
    errorText.textContent = err.message;
    errorBox.classList.remove('hidden');
  } finally {
    setButtonLoading(submitButton, false);
  }
}

async function changeStock(id, delta) {
  try {
    await API.patch(`/products/${id}/stock`, { delta });
    await loadProducts();
    renderStats();
    renderInventory();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function toggleFeatured(id) {
  const product = dashboardState.products.find((item) => item.id === id);
  if (!product) return;

  try {
    const data = await API.patch(`/products/${id}/featured`, { unggulan: !product.unggulan });
    await loadProducts();
    renderStats();
    renderInventory();
    showToast(
      data.product.unggulan
        ? `"${data.product.nama}" ditandai sebagai menu unggulan.`
        : `"${data.product.nama}" dihapus dari menu unggulan.`,
      'info'
    );
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteProduct(id) {
  const product = dashboardState.products.find((item) => item.id === id);
  if (!product) return;

  const confirmed = await confirmAction({
    title: 'Hapus Menu Ini?',
    desc: `Menu "${product.nama}" akan dihapus permanen dari katalog.`,
    confirmText: 'Ya, Hapus'
  });
  if (!confirmed) return;

  try {
    await API.delete(`/products/${id}`);
    if (dashboardState.editingProductId === id) resetProductForm();
    await loadProducts();
    await loadCategories();
    renderStats();
    renderInventory();
    renderCategoryList();
    showToast(`Menu "${product.nama}" berhasil dihapus.`, 'info');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderCategoryList() {
  const container = document.getElementById('category-list');
  const badge = document.getElementById('category-count-badge').querySelector('span');
  badge.textContent = `${dashboardState.categories.length} kategori`;

  if (!dashboardState.categories.length) {
    container.innerHTML = '<p class="p-5 text-sm text-stone-500">Belum ada kategori. Tambahkan kategori pertama Anda.</p>';
    return;
  }

  const counts = {};
  dashboardState.products.forEach((product) => {
    counts[product.categoryId] = (counts[product.categoryId] || 0) + 1;
  });

  container.innerHTML = dashboardState.categories
    .map(
      (category) => `
      <div class="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${dashboardState.editingCategoryId === category.id ? 'bg-turmeric-50/60' : ''}">
        <div class="flex items-start gap-3">
          <div class="w-10 h-10 rounded-xl bg-turmeric-50 text-turmeric-600 flex items-center justify-center shrink-0">
            <i data-lucide="tag" class="w-4 h-4"></i>
          </div>
          <div>
            <p class="font-bold text-charcoal text-sm">${escapeHtml(category.nama)} <span class="text-[10px] font-semibold text-stone-400">#${category.urutan}</span></p>
            <p class="text-xs text-stone-500">${escapeHtml(category.deskripsi || 'Tanpa deskripsi')}</p>
            <p class="text-[11px] font-semibold text-stone-400 mt-0.5">${counts[category.id] || 0} produk</p>
          </div>
        </div>
        <div class="flex items-center gap-1.5 sm:shrink-0">
          <button type="button" data-category-edit="${category.id}"
            class="p-2 rounded-xl bg-cream-100 hover:bg-turmeric-100 text-stone-700 hover:text-terracotta-700 transition-colors" title="Edit kategori">
            <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
          </button>
          <button type="button" data-category-delete="${category.id}"
            class="p-2 rounded-xl bg-chili-50 hover:bg-chili-100 text-chili-600 transition-colors" title="Hapus kategori">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      </div>`
    )
    .join('');

  container.querySelectorAll('[data-category-edit]').forEach((button) => {
    button.addEventListener('click', () => startEditCategory(Number(button.dataset.categoryEdit)));
  });
  container.querySelectorAll('[data-category-delete]').forEach((button) => {
    button.addEventListener('click', () => deleteCategory(Number(button.dataset.categoryDelete)));
  });

  if (window.lucide) window.lucide.createIcons();
}

function resetCategoryForm() {
  dashboardState.editingCategoryId = null;
  document.getElementById('category-form').reset();
  document.getElementById('category-id').value = '';
  document.getElementById('category-order').value = '0';
  document.getElementById('category-form-title').textContent = 'Tambah Kategori';
  document.getElementById('category-submit').querySelector('span').textContent = 'Tambah Kategori';
  document.getElementById('cancel-category-edit').classList.add('hidden');
  renderCategoryList();
}

function startEditCategory(id) {
  const category = dashboardState.categories.find((item) => item.id === id);
  if (!category) return;

  dashboardState.editingCategoryId = id;
  document.getElementById('category-id').value = category.id;
  document.getElementById('category-name').value = category.nama;
  document.getElementById('category-desc').value = category.deskripsi;
  document.getElementById('category-order').value = category.urutan;
  document.getElementById('category-form-title').textContent = 'Edit Kategori';
  document.getElementById('category-submit').querySelector('span').textContent = 'Perbarui Kategori';
  document.getElementById('cancel-category-edit').classList.remove('hidden');
  renderCategoryList();
  document.getElementById('category-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function handleCategorySubmit(event) {
  event.preventDefault();

  const payload = {
    nama: document.getElementById('category-name').value.trim(),
    deskripsi: document.getElementById('category-desc').value.trim(),
    urutan: Number(document.getElementById('category-order').value) || 0
  };

  if (!payload.nama) {
    showToast('Nama kategori wajib diisi.', 'error');
    return;
  }

  const submitButton = document.getElementById('category-submit');
  setButtonLoading(submitButton, true, 'Menyimpan...');

  try {
    if (dashboardState.editingCategoryId) {
      await API.put(`/categories/${dashboardState.editingCategoryId}`, payload);
      showToast(`Kategori "${payload.nama}" diperbarui.`);
    } else {
      await API.post('/categories', payload);
      showToast(`Kategori "${payload.nama}" ditambahkan.`);
    }
    await loadCategories();
    await loadProducts();
    renderStats();
    renderInventory();
    resetCategoryForm();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    setButtonLoading(submitButton, false);
  }
}

async function deleteCategory(id) {
  const category = dashboardState.categories.find((item) => item.id === id);
  if (!category) return;

  const confirmed = await confirmAction({
    title: 'Hapus Kategori?',
    desc: `Kategori "${category.nama}" akan dihapus. Kategori yang masih dipakai produk tidak dapat dihapus.`,
    confirmText: 'Ya, Hapus'
  });
  if (!confirmed) return;

  try {
    await API.delete(`/categories/${id}`);
    if (dashboardState.editingCategoryId === id) resetCategoryForm();
    await loadCategories();
    renderCategoryList();
    showToast(`Kategori "${category.nama}" dihapus.`, 'info');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleSettingsSubmit(event) {
  event.preventDefault();
  const submitButton = document.getElementById('settings-submit');
  setButtonLoading(submitButton, true, 'Menyimpan...');

  try {
    const data = await API.put('/settings', {
      namaToko: document.getElementById('setting-store-name').value.trim(),
      whatsappNumber: document.getElementById('setting-whatsapp').value.trim(),
      jamBuka: document.getElementById('setting-hours').value.trim()
    });
    App.store = data.settings;
    document.getElementById('setting-whatsapp').value = data.settings.whatsappNumber;
    showToast('Pengaturan toko dan nomor WhatsApp tersimpan.');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    setButtonLoading(submitButton, false);
  }
}

/* ---------- Unggah & kompresi foto ---------- */

function setupImageUpload() {
  const input = document.getElementById('prod-image-file');
  const dropzone = document.getElementById('image-dropzone');

  input.addEventListener('change', (event) => {
    if (event.target.files && event.target.files[0]) processImageFile(event.target.files[0]);
  });

  ['dragenter', 'dragover'].forEach((name) => {
    dropzone.addEventListener(name, (event) => {
      event.preventDefault();
      event.stopPropagation();
      dropzone.classList.add('border-chili-500', 'bg-chili-50/30');
    });
  });
  ['dragleave', 'drop'].forEach((name) => {
    dropzone.addEventListener(name, (event) => {
      event.preventDefault();
      event.stopPropagation();
      dropzone.classList.remove('border-chili-500', 'bg-chili-50/30');
    });
  });
  dropzone.addEventListener('drop', (event) => {
    const files = event.dataTransfer && event.dataTransfer.files;
    if (files && files[0]) processImageFile(files[0]);
  });
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const image = new Image();
      image.onload = () => {
        const maxSize = 800;
        let width = image.width;
        let height = image.height;
        if (width > maxSize || height > maxSize) {
          const ratio = Math.min(maxSize / width, maxSize / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(image, 0, 0, width, height);
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Gagal mengompres gambar.'))), 'image/jpeg', 0.85);
      };
      image.onerror = () => reject(new Error('File gambar tidak dapat dibaca.'));
      image.src = event.target.result;
    };
    reader.onerror = () => reject(new Error('File gambar tidak dapat dibaca.'));
    reader.readAsDataURL(file);
  });
}

async function processImageFile(file) {
  if (!file.type.startsWith('image/')) {
    showToast('Format file tidak didukung. Pilih gambar JPG, PNG, atau WebP.', 'error');
    return;
  }
  if (file.size > 8 * 1024 * 1024) {
    showToast('Ukuran foto asli maksimal 8MB.', 'error');
    return;
  }
  if (dashboardState.uploading) return;

  dashboardState.uploading = true;
  const badge = document.getElementById('image-source-badge');
  badge.textContent = 'Mengunggah...';

  try {
    const blob = await compressImage(file);
    const formData = new FormData();
    formData.append('image', blob, 'menu.jpg');
    const data = await API.upload('/uploads', formData);
    dashboardState.imageUrl = data.url;
    dashboardState.isCustomImage = true;
    updateImagePreview();
    showToast('Foto berhasil diunggah dan dikompres.');
  } catch (err) {
    showToast(err.message, 'error');
    updatePreviewBadge();
  } finally {
    dashboardState.uploading = false;
  }
}

initDashboard();

/* Logika halaman akun pembeli: profil, keranjang, belanja produk, dan pembayaran. */

let buyerProducts = [];

async function initBuyer() {
  const user = await requirePageRole(['buyer']);
  if (!user) return;

  bindBuyerEvents();
  await loadStoreInfo();
  renderProfile(user);
  renderCart();
  await loadBuyerProducts();
  if (window.lucide) window.lucide.createIcons();
}

function bindBuyerEvents() {
  const clearBtn = document.getElementById('clear-cart-btn');
  if (clearBtn) clearBtn.addEventListener('click', () => {
    if (!getCart().length) return;
    clearCart();
    renderCart();
    showToast('Keranjang dikosongkan.', 'info');
  });

  const waBtn = document.getElementById('checkout-whatsapp-btn');
  if (waBtn) waBtn.addEventListener('click', handleCheckoutWhatsApp);

  const transferBtn = document.getElementById('checkout-transfer-btn');
  if (transferBtn) transferBtn.addEventListener('click', () => {
    const cart = getCart();
    if (!cart.length) {
      showToast('Keranjang masih kosong.', 'info');
      return;
    }
    openTransferPaymentModal(cart, cartTotal());
  });

  const addCartBtn = document.getElementById('shop-add-cart-btn');
  if (addCartBtn) addCartBtn.addEventListener('click', addSelectedToCart);

  const shopTransferBtn = document.getElementById('shop-transfer-btn');
  if (shopTransferBtn) shopTransferBtn.addEventListener('click', () => {
    const selected = getSelectedShopItems();
    if (!selected.length) {
      showToast('Pilih produk terlebih dahulu.', 'info');
      return;
    }
    openTransferPaymentModal(selected, selected.reduce((s, i) => s + i.harga * i.qty, 0));
  });
}

function renderProfile(user) {
  const nameEl = document.getElementById('buyer-name');
  const emailEl = document.getElementById('buyer-email');
  const phoneEl = document.getElementById('buyer-phone');
  const roleEl = document.getElementById('buyer-role');
  if (nameEl) nameEl.textContent = user.nama;
  if (emailEl) emailEl.textContent = user.email;
  if (phoneEl) phoneEl.textContent = user.telepon || '-';
  if (roleEl) roleEl.textContent = 'Pembeli';
}

function renderCart() {
  const tbody = document.getElementById('cart-body');
  const empty = document.getElementById('cart-empty');
  const totalEl = document.getElementById('cart-total');
  const countEl = document.getElementById('cart-count');
  const cart = getCart();

  if (!cart.length) {
    if (tbody) tbody.innerHTML = '';
    if (empty) empty.classList.remove('hidden');
    if (totalEl) totalEl.textContent = formatRupiah(0);
    if (countEl) countEl.textContent = '0 item';
    updateCartBadge();
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  if (empty) empty.classList.add('hidden');
  if (tbody) {
    tbody.innerHTML = cart.map((item) => `
      <tr class="border-b border-cream-100">
        <td class="py-3 px-3">
          <div class="flex items-center gap-3">
            <img src="${escapeHtml(item.imageUrl || '/img/menu/bakso.svg')}" alt="${escapeHtml(item.nama)}"
              onerror="this.src='/img/menu/bakso.svg'" class="w-12 h-12 rounded-xl object-cover border border-cream-200 bg-cream-100 shrink-0">
            <div class="min-w-0">
              <p class="font-bold text-charcoal text-sm truncate">${escapeHtml(item.nama)}</p>
              <p class="text-xs text-stone-500">${formatRupiah(item.harga)} / porsi</p>
            </div>
          </div>
        </td>
        <td class="py-3 px-3 text-center">
          <div class="inline-flex items-center gap-1.5">
            <button type="button" data-cart-dec="${item.id}" class="w-7 h-7 rounded-lg bg-cream-100 hover:bg-cream-200 text-charcoal font-bold">-</button>
            <input type="number" min="1" value="${item.qty}" data-cart-qty="${item.id}"
              class="w-12 text-center text-xs font-bold border border-cream-200 rounded-lg py-1">
            <button type="button" data-cart-inc="${item.id}" class="w-7 h-7 rounded-lg bg-cream-100 hover:bg-cream-200 text-charcoal font-bold">+</button>
          </div>
        </td>
        <td class="py-3 px-3 text-right font-bold text-chili-600">${formatRupiah(item.harga * item.qty)}</td>
        <td class="py-3 px-3 text-right">
          <button type="button" data-cart-remove="${item.id}" class="p-2 rounded-xl bg-chili-50 hover:bg-chili-100 text-chili-600" title="Hapus">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          </button>
        </td>
      </tr>
    `).join('');
  }

  if (countEl) countEl.textContent = `${cartCount()} item`;
  if (totalEl) totalEl.textContent = formatRupiah(cartTotal());

  if (tbody) {
    tbody.querySelectorAll('[data-cart-dec]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.cartDec);
        const item = getCart().find((i) => Number(i.id) === id);
        if (item) updateCartQty(id, item.qty - 1);
        renderCart();
      });
    });
    tbody.querySelectorAll('[data-cart-inc]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.cartInc);
        const item = getCart().find((i) => Number(i.id) === id);
        if (item) updateCartQty(id, item.qty + 1);
        renderCart();
      });
    });
    tbody.querySelectorAll('[data-cart-qty]').forEach((input) => {
      input.addEventListener('change', () => {
        updateCartQty(Number(input.dataset.cartQty), input.value);
        renderCart();
      });
    });
    tbody.querySelectorAll('[data-cart-remove]').forEach((btn) => {
      btn.addEventListener('click', () => {
        removeFromCart(Number(btn.dataset.cartRemove));
        renderCart();
        showToast('Item dihapus dari keranjang.', 'info');
      });
    });
  }

  updateCartBadge();
  if (window.lucide) window.lucide.createIcons();
}

function handleCheckoutWhatsApp() {
  const cart = getCart();
  if (!cart.length) {
    showToast('Keranjang masih kosong.', 'info');
    return;
  }
  const phone = normalizeWhatsApp(App.store ? App.store.whatsappNumber : '');
  const lines = cart.map((item) => `• ${item.nama} x${item.qty} = ${formatRupiah(item.harga * item.qty)}`).join('\\n');
  const message = `Halo ${App.store ? App.store.namaToko : 'Ayiyaaa'}! Saya ingin memesan:\\n\\n${lines}\\n\\nTotal: ${formatRupiah(cartTotal())}\\n\\nTerima kasih!`;
  const url = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}` : null;
  if (url) {
    window.open(url, '_blank');
  } else {
    showToast('Nomor WhatsApp toko belum tersedia.', 'error');
  }
}

async function loadBuyerProducts() {
  const tbody = document.getElementById('shop-body');
  const empty = document.getElementById('shop-empty');
  try {
    const data = await API.get('/catalog');
    if (data.store) App.store = data.store;
    buyerProducts = data.products || [];
    if (!buyerProducts.length) {
      if (tbody) tbody.innerHTML = '';
      if (empty) empty.classList.remove('hidden');
      return;
    }
    if (empty) empty.classList.add('hidden');
    if (tbody) {
      tbody.innerHTML = buyerProducts.map((p) => `
        <tr class="border-b border-cream-100">
          <td class="py-3 px-3 text-center">
            <input type="checkbox" data-shop-check="${p.id}" class="w-4 h-4 accent-terracotta-600">
          </td>
          <td class="py-3 px-3">
            <div class="flex items-center gap-3">
              <img src="${escapeHtml(p.imageUrl || '/img/menu/bakso.svg')}" alt="${escapeHtml(p.nama)}"
                onerror="this.src='/img/menu/bakso.svg'" class="w-10 h-10 rounded-lg object-cover border border-cream-200 bg-cream-100 shrink-0">
              <div class="min-w-0">
                <p class="font-bold text-charcoal text-sm truncate">${escapeHtml(p.nama)}</p>
                <p class="text-xs text-stone-500">${escapeHtml(p.kategori)}</p>
              </div>
            </div>
          </td>
          <td class="py-3 px-3 text-center">
            <input type="number" min="1" value="1" data-shop-qty="${p.id}"
              class="w-14 text-center text-xs font-bold border border-cream-200 rounded-lg py-1">
          </td>
          <td class="py-3 px-3 text-right font-bold text-chili-600">${formatRupiah(p.harga)}</td>
        </tr>
      `).join('');
    }
    tbody.querySelectorAll('[data-shop-check], [data-shop-qty]').forEach((el) => {
      el.addEventListener('change', updateShopTotal);
      el.addEventListener('input', updateShopTotal);
    });
    updateShopTotal();
    if (window.lucide) window.lucide.createIcons();
  } catch (err) {
    if (empty) empty.classList.remove('hidden');
    showToast('Gagal memuat produk: ' + err.message, 'error');
  }
}

function getSelectedShopItems() {
  const selected = [];
  document.querySelectorAll('[data-shop-check]:checked').forEach((cb) => {
    const id = Number(cb.dataset.shopCheck);
    const product = buyerProducts.find((p) => Number(p.id) === id);
    if (!product) return;
    const qtyInput = document.querySelector(`[data-shop-qty="${id}"]`);
    const qty = Math.max(1, Number(qtyInput ? qtyInput.value : 1) || 1);
    selected.push({ id: product.id, nama: product.nama, harga: Number(product.harga) || 0, imageUrl: product.imageUrl || '', qty });
  });
  return selected;
}

function updateShopTotal() {
  const selected = getSelectedShopItems();
  const total = selected.reduce((s, i) => s + i.harga * i.qty, 0);
  const el = document.getElementById('shop-selected-total');
  if (el) el.textContent = `Total: ${formatRupiah(total)} (${selected.reduce((s, i) => s + i.qty, 0)} item)`;
}

function addSelectedToCart() {
  const selected = getSelectedShopItems();
  if (!selected.length) {
    showToast('Pilih produk terlebih dahulu.', 'info');
    return;
  }
  const cart = getCart();
  selected.forEach((item) => {
    const existing = cart.find((c) => Number(c.id) === Number(item.id));
    if (existing) existing.qty += item.qty;
    else cart.push({ id: item.id, nama: item.nama, harga: item.harga, imageUrl: item.imageUrl, qty: item.qty });
  });
  saveCart(cart);
  updateCartBadge();
  renderCart();
  showToast('Produk terpilih ditambahkan ke keranjang.', 'success');
}


function openTransferPaymentModal(items, total) {
  let modal = document.getElementById('transfer-payment-modal');
  if (modal) modal.remove();
  const lines = items.map((i) => `• ${i.nama} x${i.qty} = ${formatRupiah(i.harga * i.qty)}`).join('\\n');
  modal = ensureElement(`
    <div id="transfer-payment-modal" class="fixed inset-0 z-[70] bg-charcoal/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div class="bg-white rounded-3xl border border-cream-200 w-full max-w-md shadow-2xl overflow-hidden">
        <div class="bg-gradient-to-br from-terracotta-600 to-turmeric-500 p-6 text-white">
          <div class="flex items-start justify-between">
            <div>
              <h3 class="font-display font-extrabold text-xl">Pembayaran Transfer</h3>
              <p class="text-xs text-amber-50/90 mt-1">Transfer ke rekening toko, lalu konfirmasi.</p>
            </div>
            <button type="button" onclick="closeTransferPaymentModal()" class="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors">
              <i data-lucide="x" class="w-4 h-4"></i>
            </button>
          </div>
        </div>
        <div class="p-6 space-y-4 text-sm">
          <div class="p-3 rounded-xl bg-cream-50 border border-cream-200">
            <p class="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-1">Ringkasan Pesanan</p>
            <pre class="text-xs text-charcoal whitespace-pre-wrap font-sans">${escapeHtml(lines)}</pre>
            <p class="mt-2 font-display font-extrabold text-lg text-chili-600">Total: ${formatRupiah(total)}</p>
          </div>
          <div class="p-3 rounded-xl bg-cream-50 border border-cream-200 space-y-1">
            <p class="text-[11px] font-bold text-stone-400 uppercase tracking-wider">Rekening Tujuan</p>
            <p class="font-bold text-charcoal">Bank BCA</p>
            <p class="text-charcoal">No. Rekening: <span class="font-extrabold">1234567890</span></p>
            <p class="text-charcoal">a.n. <span class="font-extrabold">Ayiyaaa Street Bistro</span></p>
          </div>
          <p class="text-xs text-stone-500">Setelah transfer, klik konfirmasi. Anda juga bisa kirim bukti transfer via WhatsApp toko.</p>
          <div class="flex gap-2 pt-1">
            <button type="button" onclick="closeTransferPaymentModal()"
              class="flex-1 px-4 py-2.5 rounded-xl bg-cream-100 hover:bg-cream-200 text-stone-700 text-xs font-bold transition-colors">Batal</button>
            <button type="button" onclick="confirmTransferPayment()"
              class="flex-1 px-4 py-2.5 rounded-xl bg-terracotta-600 hover:bg-terracotta-700 text-white text-xs font-bold transition-colors">Saya Sudah Transfer</button>
          </div>
        </div>
      </div>
    </div>
  `);
  document.body.appendChild(modal);
  if (window.lucide) window.lucide.createIcons();
}

function closeTransferPaymentModal() {
  const modal = document.getElementById('transfer-payment-modal');
  if (modal) modal.remove();
}

function confirmTransferPayment() {
  closeTransferPaymentModal();
  clearCart();
  renderCart();
  showToast('Terima kasih! Pembayaran transfer akan diverifikasi.', 'success');
}

initBuyer();

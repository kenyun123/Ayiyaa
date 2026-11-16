/* Modul bersama: pemanggilan API, notifikasi, dialog, autentikasi, dan navigasi role. */

const API = {
  async request(path, { method = 'GET', body, formData } = {}) {
    const options = { method, credentials: 'same-origin', headers: {} };

    if (formData) {
      options.body = formData;
    } else if (body !== undefined) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`/api${path}`, options);
    let data = null;
    try {
      data = await response.json();
    } catch (err) {
      data = null;
    }

    if (!response.ok) {
      const error = new Error((data && data.message) || `Permintaan gagal (${response.status}).`);
      error.status = response.status;
      throw error;
    }
    return data;
  },
  get: (path) => API.request(path),
  post: (path, body) => API.request(path, { method: 'POST', body }),
  put: (path, body) => API.request(path, { method: 'PUT', body }),
  patch: (path, body) => API.request(path, { method: 'PATCH', body }),
  delete: (path) => API.request(path, { method: 'DELETE' }),
  upload: (path, formData) => API.request(path, { method: 'POST', formData })
};

const App = {
  user: null,
  store: null
};

const ROLE_LABEL = { admin: 'Admin', seller: 'Seller', buyer: 'Pembeli' };
const ROLE_STYLE = {
  admin: 'bg-chili-50 text-chili-700 border-chili-200',
  seller: 'bg-turmeric-50 text-terracotta-700 border-turmeric-200',
  buyer: 'bg-emerald-50 text-emerald-700 border-emerald-200'
};

function formatRupiah(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(Number(amount) || 0);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return map[char];
  });
}

function ensureElement(html) {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html.trim();
  return wrapper.firstElementChild;
}

function showToast(message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = ensureElement('<div id="toast-container" class="fixed bottom-5 right-5 z-[70] flex flex-col gap-2 pointer-events-none"></div>');
    document.body.appendChild(container);
  }

  const colors = {
    success: 'bg-charcoal text-white border-stone-700',
    error: 'bg-chili-600 text-white border-chili-700',
    info: 'bg-terracotta-600 text-white border-terracotta-700'
  };

  const toast = document.createElement('div');
  toast.className = `pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-2xl border shadow-xl text-xs font-bold transition-all duration-300 translate-y-2 opacity-0 ${colors[type] || colors.success}`;
  toast.textContent = message;
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.remove('translate-y-2', 'opacity-0'));

  setTimeout(() => {
    toast.classList.add('translate-y-2', 'opacity-0');
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

function confirmAction({ title = 'Konfirmasi Tindakan', desc = 'Lanjutkan tindakan ini?', confirmText = 'Ya, Lanjutkan' } = {}) {
  return new Promise((resolve) => {
    let modal = document.getElementById('confirm-modal');
    if (!modal) {
      modal = ensureElement(`
        <div id="confirm-modal" class="hidden fixed inset-0 z-[70] bg-charcoal/55 backdrop-blur-sm flex items-center justify-center p-4">
          <div class="bg-white rounded-3xl border border-cream-200 max-w-sm w-full p-6 shadow-2xl">
            <div class="w-12 h-12 rounded-2xl bg-chili-50 text-chili-600 flex items-center justify-center mb-4">
              <i data-lucide="alert-triangle" class="w-6 h-6"></i>
            </div>
            <h3 class="font-display font-bold text-lg text-charcoal mb-1.5" data-confirm-title></h3>
            <p class="text-sm text-stone-500 leading-relaxed mb-6" data-confirm-desc></p>
            <div class="flex items-center justify-end gap-2.5">
              <button type="button" data-confirm-cancel class="px-4 py-2.5 rounded-xl text-xs font-bold text-stone-600 bg-cream-100 hover:bg-cream-200 transition-colors">Batal</button>
              <button type="button" data-confirm-ok class="px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-chili-600 hover:bg-chili-700 shadow-sm transition-colors"></button>
            </div>
          </div>
        </div>
      `);
      document.body.appendChild(modal);
    }

    modal.querySelector('[data-confirm-title]').textContent = title;
    modal.querySelector('[data-confirm-desc]').textContent = desc;
    const okBtn = modal.querySelector('[data-confirm-ok]');
    const cancelBtn = modal.querySelector('[data-confirm-cancel]');
    okBtn.textContent = confirmText;

    const cleanup = (result) => {
      modal.classList.add('hidden');
      okBtn.onclick = null;
      cancelBtn.onclick = null;
      document.removeEventListener('keydown', onKey);
      resolve(result);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') cleanup(false);
    };

    okBtn.onclick = () => cleanup(true);
    cancelBtn.onclick = () => cleanup(false);
    document.addEventListener('keydown', onKey);
    modal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  });
}

function setButtonLoading(button, loading, loadingText = 'Memproses...') {
  if (!button) return;
  if (loading) {
    button.dataset.originalHtml = button.innerHTML;
    button.disabled = true;
    button.classList.add('opacity-70', 'cursor-wait');
    button.textContent = loadingText;
  } else {
    button.disabled = false;
    button.classList.remove('opacity-70', 'cursor-wait');
    if (button.dataset.originalHtml) {
      button.innerHTML = button.dataset.originalHtml;
      delete button.dataset.originalHtml;
      if (window.lucide) window.lucide.createIcons();
    }
  }
}

function togglePasswordVisibility(inputId, button) {
  const input = document.getElementById(inputId);
  if (!input || !button) return;
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  button.innerHTML = `<i data-lucide="${show ? 'eye-off' : 'eye'}" class="w-4 h-4"></i>`;
  if (window.lucide) window.lucide.createIcons();
}

function resetPasswordToggle(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.type = 'password';
  const button = input.parentElement ? input.parentElement.querySelector('button[onclick*="togglePasswordVisibility"]') : null;
  if (button) {
    button.innerHTML = '<i data-lucide="eye" class="w-4 h-4"></i>';
    if (window.lucide) window.lucide.createIcons();
  }
}

function normalizeWhatsApp(raw) {
  let digits = String(raw || '').replace(/\D/g, '');
  if (digits.startsWith('0')) digits = '62' + digits.slice(1);
  if (digits.startsWith('8')) digits = '62' + digits;
  return digits;
}

function buildWhatsAppLink(product) {
  const phone = normalizeWhatsApp(App.store ? App.store.whatsappNumber : '');
  const message = `Halo ${App.store ? App.store.namaToko : 'Ayiyaaa'}! Saya ingin memesan:\n\n• *${product.nama}* (${product.kategori})\n• Harga: ${formatRupiah(product.harga)}\n• Jumlah: 1 porsi\n\nApakah menu ini masih tersedia? Terima kasih!`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function renderAuthNav() {
  document.querySelectorAll('[data-auth-nav]').forEach((container, index) => {
    if (!App.user) {
      container.innerHTML = `
        <div class="flex items-center gap-2">
          <button type="button" onclick="openLoginModal()" class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-charcoal text-white text-xs sm:text-sm font-bold hover:bg-stone-800 transition-colors">
            <i data-lucide="log-in" class="w-4 h-4"></i>
            <span>Masuk</span>
          </button>
          <button type="button" onclick="openRegisterChoiceModal()" class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cream-100 hover:bg-cream-200 text-stone-700 text-xs sm:text-sm font-bold border border-cream-200 transition-colors">
            <i data-lucide="user-plus" class="w-4 h-4"></i>
            <span>Daftar</span>
          </button>
        </div>
      `;
      return;
    }

    const links = [];
    if (App.user.role === 'seller' || App.user.role === 'admin') {
      links.push('<a href="/dashboard.html" class="block px-3 py-2 rounded-lg text-xs font-bold text-stone-700 hover:bg-cream-100">Dashboard</a>');
    }
    if (App.user.role === 'admin') {
      links.push('<a href="/admin.html" class="block px-3 py-2 rounded-lg text-xs font-bold text-stone-700 hover:bg-cream-100">Manajemen User</a>');
    }
    if (App.user.role === 'buyer') {
      links.push('<a href="/buyer.html" class="block px-3 py-2 rounded-lg text-xs font-bold text-stone-700 hover:bg-cream-100">Akun & Keranjang</a>');
    }

    container.innerHTML = `
      <div class="relative">
        <button type="button" data-account-button class="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl border border-cream-200 bg-white hover:bg-cream-50 transition-colors">
          <span class="w-8 h-8 rounded-lg bg-gradient-to-br from-chili-500 to-terracotta-500 text-white text-xs font-extrabold flex items-center justify-center">
            ${escapeHtml(App.user.nama.charAt(0).toUpperCase())}
          </span>
          <span class="text-left hidden sm:block">
            <span class="block text-xs font-bold text-charcoal leading-tight max-w-[110px] truncate">${escapeHtml(App.user.nama)}</span>
            <span class="block text-[10px] font-semibold uppercase tracking-wide text-stone-500">${ROLE_LABEL[App.user.role]}</span>
          </span>
          <i data-lucide="chevron-down" class="w-3.5 h-3.5 text-stone-400"></i>
        </button>
        <div data-account-menu class="hidden absolute right-0 mt-2 w-52 bg-white rounded-2xl border border-cream-200 shadow-xl p-1.5 z-50">
          <div class="px-3 py-2 border-b border-cream-100 mb-1">
            <p class="text-xs font-bold text-charcoal truncate">${escapeHtml(App.user.email)}</p>
            <span class="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-md border ${ROLE_STYLE[App.user.role]}">${ROLE_LABEL[App.user.role]}</span>
          </div>
          ${links.join('')}
          <button type="button" onclick="logout()" class="w-full text-left px-3 py-2 rounded-lg text-xs font-bold text-chili-600 hover:bg-chili-50 flex items-center gap-2">
            <i data-lucide="log-out" class="w-3.5 h-3.5"></i> Keluar
          </button>
        </div>
      </div>
    `;

    const button = container.querySelector('[data-account-button]');
    const menu = container.querySelector('[data-account-menu]');
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      document.querySelectorAll('[data-account-menu]').forEach((other) => {
        if (other !== menu) other.classList.add('hidden');
      });
      menu.classList.toggle('hidden');
    });
  });

  document.addEventListener('click', () => {
    document.querySelectorAll('[data-account-menu]').forEach((menu) => menu.classList.add('hidden'));
  });

  document.querySelectorAll('[data-auth-only]').forEach((element) => {
    const required = element.dataset.authOnly;
    const allowed =
      required === 'admin'
        ? Boolean(App.user && App.user.role === 'admin')
        : Boolean(App.user && ['seller', 'admin'].includes(App.user.role));
    element.classList.toggle('hidden', !allowed);
  });

  if (window.lucide) window.lucide.createIcons();
}

function openLoginModal() {
  let modal = document.getElementById('login-modal');
  if (!modal) {
    modal = ensureElement(`
      <div id="login-modal" class="hidden fixed inset-0 z-[65] bg-charcoal/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div class="bg-white rounded-3xl border border-cream-200 w-full max-w-md shadow-2xl overflow-hidden">
          <div class="bg-gradient-to-br from-chili-700 via-terracotta-600 to-turmeric-500 p-6 text-white">
            <div class="flex items-start justify-between">
              <div>
                <h3 class="font-display font-extrabold text-xl">Masuk ke Ayiyaaa</h3>
                <p class="text-xs text-amber-50/90 mt-1">Admin mengelola user, seller mengelola menu, pembeli melihat katalog.</p>
              </div>
              <button type="button" onclick="closeLoginModal()" class="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors">
                <i data-lucide="x" class="w-4 h-4"></i>
              </button>
            </div>
          </div>
          <form id="login-form" class="p-6 space-y-4">
            <div>
              <label for="login-email" class="block text-xs font-bold text-charcoal mb-1.5">Email</label>
              <input type="email" id="login-email" required autocomplete="username" placeholder="nama@email.com"
                class="w-full px-3.5 py-2.5 rounded-xl border border-cream-200 bg-cream-50/50 text-sm focus:outline-none focus:ring-2 focus:ring-chili-500/25 focus:border-chili-500">
            </div>
            <div>
              <label for="login-password" class="block text-xs font-bold text-charcoal mb-1.5">Password</label>
              <div class="relative">
                <input type="password" id="login-password" required autocomplete="current-password" placeholder="••••••••"
                  class="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-cream-200 bg-cream-50/50 text-sm focus:outline-none focus:ring-2 focus:ring-chili-500/25 focus:border-chili-500">
                <button type="button" onclick="togglePasswordVisibility('login-password', this)"
                  class="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-cream-100 transition-colors" aria-label="Tampilkan password">
                  <i data-lucide="eye" class="w-4 h-4"></i>
                </button>
              </div>
            </div>
            <div id="login-error" class="hidden p-3 rounded-xl bg-chili-50 border border-chili-200 text-chili-700 text-xs font-semibold"></div>
            <button type="submit" id="login-submit" class="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-chili-600 to-terracotta-600 hover:from-chili-700 hover:to-terracotta-700 text-white text-sm font-bold shadow-md transition-all">
              <i data-lucide="log-in" class="w-4 h-4"></i>
              <span>Masuk</span>
            </button>
            <div class="pt-2 border-t border-cream-100">
              <p class="text-[11px] font-bold text-stone-500 mb-2">Akun demo (klik untuk isi otomatis):</p>
              <div id="demo-accounts" class="grid grid-cols-3 gap-2"></div>
            </div>
            <div class="pt-2 border-t border-cream-100 text-center space-y-1">
              <p class="text-[11px] text-stone-500 mb-1">Belum punya akun?</p>
              <div class="flex items-center justify-center gap-3">
                <button type="button" onclick="closeLoginModal(); openSellerRegisterModal();"
                  class="text-xs font-bold text-terracotta-600 hover:text-terracotta-700 underline underline-offset-2">
                  Daftar Seller
                </button>
                <button type="button" onclick="closeLoginModal(); openBuyerRegisterModal();"
                  class="text-xs font-bold text-emerald-600 hover:text-emerald-700 underline underline-offset-2">
                  Daftar Pembeli
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    `);
    document.body.appendChild(modal);

    modal.querySelector('#login-form').addEventListener('submit', handleLoginSubmit);
    modal.addEventListener('click', (event) => {
      if (event.target === modal) closeLoginModal();
    });

    const demoAccounts = [
      { label: 'Admin', email: 'admin@ayiyaaa.test', password: 'Admin#12345' },
      { label: 'Seller', email: 'seller@ayiyaaa.test', password: 'Seller#12345' },
      { label: 'Pembeli', email: 'pembeli@ayiyaaa.test', password: 'Pembeli#12345' }
    ];
    modal.querySelector('#demo-accounts').innerHTML = demoAccounts
      .map(
        (account) => `
          <button type="button" data-demo-email="${account.email}" data-demo-password="${account.password}"
            class="px-2 py-2 rounded-xl border border-cream-200 bg-cream-50 hover:bg-cream-100 text-[11px] font-bold text-stone-700 transition-colors">
            ${account.label}
          </button>`
      )
      .join('');

    modal.querySelectorAll('[data-demo-email]').forEach((button) => {
      button.addEventListener('click', () => {
        modal.querySelector('#login-email').value = button.dataset.demoEmail;
        modal.querySelector('#login-password').value = button.dataset.demoPassword;
      });
    });
  }

  modal.classList.remove('hidden');
  if (window.lucide) window.lucide.createIcons();
  setTimeout(() => modal.querySelector('#login-email').focus(), 50);
}

function closeLoginModal() {
  const modal = document.getElementById('login-modal');
  if (modal) modal.classList.add('hidden');
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  const modal = document.getElementById('login-modal');
  const errorBox = modal.querySelector('#login-error');
  const submitButton = modal.querySelector('#login-submit');

  errorBox.classList.add('hidden');
  setButtonLoading(submitButton, true, 'Memeriksa...');

  try {
    const data = await API.post('/auth/login', {
      email: modal.querySelector('#login-email').value.trim(),
      password: modal.querySelector('#login-password').value
    });
    App.user = data.user;
    showToast(`Selamat datang, ${data.user.nama}!`);
    window.location.href = data.redirectTo || '/';
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.classList.remove('hidden');
    setButtonLoading(submitButton, false);
  }
}

async function logout() {
  try {
    await API.post('/auth/logout');
    App.user = null;
    showToast('Anda telah keluar.', 'info');
    setTimeout(() => {
      window.location.href = '/';
    }, 400);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function loadSession() {
  try {
    const data = await API.get('/auth/me');
    App.user = data.user;
  } catch (err) {
    App.user = null;
  }
  renderAuthNav();
  return App.user;
}

async function loadStoreInfo() {
  try {
    const data = await API.get('/store');
    App.store = data.store;
  } catch (err) {
    App.store = null;
  }
  return App.store;
}

async function requirePageRole(roles) {
  const user = await loadSession();
  if (!user) {
    window.location.href = '/?login=1';
    return null;
  }
  if (!roles.includes(user.role)) {
    window.location.href = '/?forbidden=1';
    return null;
  }
  return user;
}

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('login') === '1') {
    openLoginModal();
  }
  if (params.get('forbidden') === '1') {
    showToast('Akun Anda tidak memiliki akses ke halaman tersebut.', 'error');
  }
  if (params.has('login') || params.has('forbidden')) {
    params.delete('login');
    params.delete('forbidden');
    const query = params.toString();
    history.replaceState({}, '', window.location.pathname + (query ? `?${query}` : ''));
  }
});

function openSellerRegisterModal() {
  let modal = document.getElementById('seller-register-modal');
  if (!modal) {
    modal = ensureElement(`
      <div id="seller-register-modal" class="hidden fixed inset-0 z-[65] bg-charcoal/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div class="bg-white rounded-3xl border border-cream-200 w-full max-w-md shadow-2xl overflow-hidden">
          <div class="bg-gradient-to-br from-terracotta-600 to-turmeric-500 p-6 text-white">
            <div class="flex items-start justify-between">
              <div>
                <h3 class="font-display font-extrabold text-xl">Daftar sebagai Seller</h3>
                <p class="text-xs text-amber-50/90 mt-1">Akun seller akan aktif setelah dikonfirmasi admin.</p>
              </div>
              <button type="button" onclick="closeSellerRegisterModal()" class="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors">
                <i data-lucide="x" class="w-4 h-4"></i>
              </button>
            </div>
          </div>
          <form id="seller-register-form" class="p-6 space-y-4">
            <div>
              <label for="register-nama" class="block text-xs font-bold text-charcoal mb-1.5">Nama Lengkap</label>
              <input type="text" id="register-nama" required maxlength="120" placeholder="Nama toko / penjual"
                class="w-full px-3.5 py-2.5 rounded-xl border border-cream-200 bg-cream-50/50 text-sm focus:outline-none focus:ring-2 focus:ring-chili-500/25 focus:border-chili-500">
            </div>
            <div>
              <label for="register-email" class="block text-xs font-bold text-charcoal mb-1.5">Email</label>
              <input type="email" id="register-email" required placeholder="nama@email.com"
                class="w-full px-3.5 py-2.5 rounded-xl border border-cream-200 bg-cream-50/50 text-sm focus:outline-none focus:ring-2 focus:ring-chili-500/25 focus:border-chili-500">
            </div>
            <div>
              <label for="register-telepon" class="block text-xs font-bold text-charcoal mb-1.5">Nomor Telepon / WhatsApp</label>
              <input type="tel" id="register-telepon" required maxlength="30" placeholder="08xxxxxxxxxx"
                class="w-full px-3.5 py-2.5 rounded-xl border border-cream-200 bg-cream-50/50 text-sm focus:outline-none focus:ring-2 focus:ring-chili-500/25 focus:border-chili-500">
            </div>
            <div>
              <label for="register-password" class="block text-xs font-bold text-charcoal mb-1.5">Password</label>
              <div class="relative">
                <input type="password" id="register-password" required minlength="8" autocomplete="new-password" placeholder="Min. 8 karakter"
                  class="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-cream-200 bg-cream-50/50 text-sm focus:outline-none focus:ring-2 focus:ring-chili-500/25 focus:border-chili-500">
                <button type="button" onclick="togglePasswordVisibility('register-password', this)"
                  class="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-cream-100 transition-colors" aria-label="Tampilkan password">
                  <i data-lucide="eye" class="w-4 h-4"></i>
                </button>
              </div>
            </div>
            <div>
              <label for="register-password-confirm" class="block text-xs font-bold text-charcoal mb-1.5">Konfirmasi Password</label>
              <div class="relative">
                <input type="password" id="register-password-confirm" required minlength="8" autocomplete="new-password" placeholder="Ulangi password"
                  class="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-cream-200 bg-cream-50/50 text-sm focus:outline-none focus:ring-2 focus:ring-chili-500/25 focus:border-chili-500">
                <button type="button" onclick="togglePasswordVisibility('register-password-confirm', this)"
                  class="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-cream-100 transition-colors" aria-label="Tampilkan password">
                  <i data-lucide="eye" class="w-4 h-4"></i>
                </button>
              </div>
              <p id="register-password-warning" class="hidden text-[11px] font-semibold text-chili-600 mt-1"></p>
            </div>
            <div id="register-error" class="hidden p-3 rounded-xl bg-chili-50 border border-chili-200 text-chili-700 text-xs font-semibold"></div>
            <div id="register-success" class="hidden p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm space-y-3">
              <p class="font-bold">Pendaftaran berhasil!</p>
              <p class="text-xs">Akun seller Anda menunggu konfirmasi admin. Kirim notifikasi ke admin via WhatsApp agar segera diproses.</p>
              <a id="register-whatsapp-link" href="#" target="_blank" rel="noopener"
                class="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors">
                <i data-lucide="message-circle" class="w-4 h-4"></i>
                <span>Kirim Notifikasi ke Admin</span>
              </a>
            </div>
            <div class="flex gap-2 pt-1" id="register-actions">
              <button type="button" onclick="closeSellerRegisterModal()"
                class="flex-1 px-4 py-2.5 rounded-xl bg-cream-100 hover:bg-cream-200 text-stone-700 text-xs font-bold transition-colors">Batal</button>
              <button type="submit" id="register-submit"
                class="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-terracotta-600 to-turmeric-500 hover:from-terracotta-700 hover:to-turmeric-600 text-white text-xs font-bold shadow-sm transition-colors">
                <i data-lucide="user-plus" class="w-3.5 h-3.5"></i>
                <span>Daftar Seller</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    `);
    document.body.appendChild(modal);

    modal.querySelector('#seller-register-form').addEventListener('submit', handleSellerRegisterSubmit);
    modal.addEventListener('click', (event) => {
      if (event.target === modal) closeSellerRegisterModal();
    });
  }

  modal.classList.remove('hidden');
  resetSellerRegisterModal();
  if (window.lucide) window.lucide.createIcons();
  setTimeout(() => modal.querySelector('#register-nama').focus(), 50);
}

function closeSellerRegisterModal() {
  const modal = document.getElementById('seller-register-modal');
  if (modal) modal.classList.add('hidden');
}

function resetSellerRegisterModal() {
  const form = document.getElementById('seller-register-form');
  if (!form) return;
  form.reset();
  document.getElementById('register-error').classList.add('hidden');
  document.getElementById('register-success').classList.add('hidden');
  document.getElementById('register-actions').classList.remove('hidden');
  document.getElementById('register-password-warning').classList.add('hidden');
  resetPasswordToggle('register-password');
  resetPasswordToggle('register-password-confirm');
}

async function handleSellerRegisterSubmit(event) {
  event.preventDefault();
  const modal = document.getElementById('seller-register-modal');
  const errorBox = modal.querySelector('#register-error');
  const warningBox = modal.querySelector('#register-password-warning');
  const submitButton = modal.querySelector('#register-submit');

  errorBox.classList.add('hidden');
  warningBox.classList.add('hidden');

  const nama = modal.querySelector('#register-nama').value.trim();
  const email = modal.querySelector('#register-email').value.trim();
  const telepon = modal.querySelector('#register-telepon').value.trim();
  const password = modal.querySelector('#register-password').value;
  const confirmPassword = modal.querySelector('#register-password-confirm').value;

  if (password.length < 8) {
    warningBox.textContent = 'Password minimal 8 karakter.';
    warningBox.classList.remove('hidden');
    return;
  }
  if (password !== confirmPassword) {
    warningBox.textContent = 'Konfirmasi password tidak sama dengan password.';
    warningBox.classList.remove('hidden');
    return;
  }

  setButtonLoading(submitButton, true, 'Mendaftar...');
  try {
    const data = await API.post('/auth/register-seller', { nama, email, telepon, password });
    modal.querySelector('#register-actions').classList.add('hidden');
    modal.querySelector('#register-success').classList.remove('hidden');
    const link = modal.querySelector('#register-whatsapp-link');
    if (data.whatsappUrl) {
      link.href = data.whatsappUrl;
      link.classList.remove('hidden');
    } else {
      link.classList.add('hidden');
    }
    showToast(data.message || 'Pendaftaran seller berhasil.');
    if (window.lucide) window.lucide.createIcons();
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.classList.remove('hidden');
  } finally {
    setButtonLoading(submitButton, false);
  }
}

function openBuyerRegisterModal() {
  let modal = document.getElementById('buyer-register-modal');
  if (!modal) {
    modal = ensureElement(`
      <div id="buyer-register-modal" class="hidden fixed inset-0 z-[65] bg-charcoal/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div class="bg-white rounded-3xl border border-cream-200 w-full max-w-md shadow-2xl overflow-hidden">
          <div class="bg-gradient-to-br from-emerald-600 to-teal-500 p-6 text-white">
            <div class="flex items-start justify-between">
              <div>
                <h3 class="font-display font-extrabold text-xl">Daftar sebagai Pembeli</h3>
                <p class="text-xs text-emerald-50/90 mt-1">Akun langsung aktif setelah pendaftaran.</p>
              </div>
              <button type="button" onclick="closeBuyerRegisterModal()" class="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors">
                <i data-lucide="x" class="w-4 h-4"></i>
              </button>
            </div>
          </div>
          <form id="buyer-register-form" class="p-6 space-y-4">
            <div>
              <label for="buyer-register-nama" class="block text-xs font-bold text-charcoal mb-1.5">Nama Lengkap</label>
              <input type="text" id="buyer-register-nama" required maxlength="120" placeholder="Nama pembeli"
                class="w-full px-3.5 py-2.5 rounded-xl border border-cream-200 bg-cream-50/50 text-sm focus:outline-none focus:ring-2 focus:ring-chili-500/25 focus:border-chili-500">
            </div>
            <div>
              <label for="buyer-register-email" class="block text-xs font-bold text-charcoal mb-1.5">Email</label>
              <input type="email" id="buyer-register-email" required placeholder="nama@email.com"
                class="w-full px-3.5 py-2.5 rounded-xl border border-cream-200 bg-cream-50/50 text-sm focus:outline-none focus:ring-2 focus:ring-chili-500/25 focus:border-chili-500">
            </div>
            <div>
              <label for="buyer-register-telepon" class="block text-xs font-bold text-charcoal mb-1.5">Nomor Telepon / WhatsApp</label>
              <input type="tel" id="buyer-register-telepon" required maxlength="30" placeholder="08xxxxxxxxxx"
                class="w-full px-3.5 py-2.5 rounded-xl border border-cream-200 bg-cream-50/50 text-sm focus:outline-none focus:ring-2 focus:ring-chili-500/25 focus:border-chili-500">
            </div>
            <div>
              <label for="buyer-register-password" class="block text-xs font-bold text-charcoal mb-1.5">Password</label>
              <div class="relative">
                <input type="password" id="buyer-register-password" required minlength="8" autocomplete="new-password" placeholder="Min. 8 karakter"
                  class="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-cream-200 bg-cream-50/50 text-sm focus:outline-none focus:ring-2 focus:ring-chili-500/25 focus:border-chili-500">
                <button type="button" onclick="togglePasswordVisibility('buyer-register-password', this)"
                  class="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-cream-100 transition-colors" aria-label="Tampilkan password">
                  <i data-lucide="eye" class="w-4 h-4"></i>
                </button>
              </div>
            </div>
            <div>
              <label for="buyer-register-password-confirm" class="block text-xs font-bold text-charcoal mb-1.5">Konfirmasi Password</label>
              <div class="relative">
                <input type="password" id="buyer-register-password-confirm" required minlength="8" autocomplete="new-password" placeholder="Ulangi password"
                  class="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-cream-200 bg-cream-50/50 text-sm focus:outline-none focus:ring-2 focus:ring-chili-500/25 focus:border-chili-500">
                <button type="button" onclick="togglePasswordVisibility('buyer-register-password-confirm', this)"
                  class="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-cream-100 transition-colors" aria-label="Tampilkan password">
                  <i data-lucide="eye" class="w-4 h-4"></i>
                </button>
              </div>
              <p id="buyer-register-password-warning" class="hidden text-[11px] font-semibold text-chili-600 mt-1"></p>
            </div>
            <div id="buyer-register-error" class="hidden p-3 rounded-xl bg-chili-50 border border-chili-200 text-chili-700 text-xs font-semibold"></div>
            <div id="buyer-register-success" class="hidden p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm space-y-3">
              <p class="font-bold">Pendaftaran berhasil!</p>
              <p class="text-xs">Akun pembeli Anda sudah aktif. Kirim konfirmasi ke WhatsApp Anda.</p>
              <a id="buyer-register-whatsapp-link" href="#" target="_blank" rel="noopener"
                class="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors">
                <i data-lucide="message-circle" class="w-4 h-4"></i>
                <span>Kirim Konfirmasi ke WhatsApp</span>
              </a>
            </div>
            <div class="flex gap-2 pt-1" id="buyer-register-actions">
              <button type="button" onclick="closeBuyerRegisterModal()"
                class="flex-1 px-4 py-2.5 rounded-xl bg-cream-100 hover:bg-cream-200 text-stone-700 text-xs font-bold transition-colors">Batal</button>
              <button type="submit" id="buyer-register-submit"
                class="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white text-xs font-bold shadow-sm transition-colors">
                <i data-lucide="user-plus" class="w-3.5 h-3.5"></i>
                <span>Daftar Pembeli</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    `);
    document.body.appendChild(modal);
    modal.querySelector('#buyer-register-form').addEventListener('submit', handleBuyerRegisterSubmit);
    modal.addEventListener('click', (event) => {
      if (event.target === modal) closeBuyerRegisterModal();
    });
  }
  modal.classList.remove('hidden');
  resetBuyerRegisterModal();
  if (window.lucide) window.lucide.createIcons();
  setTimeout(() => modal.querySelector('#buyer-register-nama').focus(), 50);
}

function closeBuyerRegisterModal() {
  const modal = document.getElementById('buyer-register-modal');
  if (modal) modal.classList.add('hidden');
}

function resetBuyerRegisterModal() {
  const form = document.getElementById('buyer-register-form');
  if (!form) return;
  form.reset();
  document.getElementById('buyer-register-error').classList.add('hidden');
  document.getElementById('buyer-register-success').classList.add('hidden');
  document.getElementById('buyer-register-actions').classList.remove('hidden');
  document.getElementById('buyer-register-password-warning').classList.add('hidden');
  resetPasswordToggle('buyer-register-password');
  resetPasswordToggle('buyer-register-password-confirm');
}

async function handleBuyerRegisterSubmit(event) {
  event.preventDefault();
  const modal = document.getElementById('buyer-register-modal');
  const errorBox = modal.querySelector('#buyer-register-error');
  const warningBox = modal.querySelector('#buyer-register-password-warning');
  const submitButton = modal.querySelector('#buyer-register-submit');

  errorBox.classList.add('hidden');
  warningBox.classList.add('hidden');

  const nama = modal.querySelector('#buyer-register-nama').value.trim();
  const email = modal.querySelector('#buyer-register-email').value.trim();
  const telepon = modal.querySelector('#buyer-register-telepon').value.trim();
  const password = modal.querySelector('#buyer-register-password').value;
  const confirmPassword = modal.querySelector('#buyer-register-password-confirm').value;

  if (password.length < 8) {
    warningBox.textContent = 'Password minimal 8 karakter.';
    warningBox.classList.remove('hidden');
    return;
  }
  if (password !== confirmPassword) {
    warningBox.textContent = 'Konfirmasi password tidak sama dengan password.';
    warningBox.classList.remove('hidden');
    return;
  }

  setButtonLoading(submitButton, true, 'Mendaftar...');
  try {
    const data = await API.post('/auth/register-buyer', { nama, email, telepon, password });
    modal.querySelector('#buyer-register-actions').classList.add('hidden');
    modal.querySelector('#buyer-register-success').classList.remove('hidden');
    const link = modal.querySelector('#buyer-register-whatsapp-link');
    if (data.whatsappUrl) {
      link.href = data.whatsappUrl;
      link.classList.remove('hidden');
    } else {
      link.classList.add('hidden');
    }
    showToast(data.message || 'Pendaftaran pembeli berhasil.');
    if (window.lucide) window.lucide.createIcons();
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.classList.remove('hidden');
  } finally {
    setButtonLoading(submitButton, false);
  }
}

/* ---------- Keranjang (Cart) ---------- */
const CART_KEY = 'ayiyaaa.cart';

function getCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

function saveCart(cart) {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  } catch (err) {}
}

function addToCart(product, qty = 1) {
  if (!product) return;
  const cart = getCart();
  const existing = cart.find((item) => Number(item.id) === Number(product.id));
  if (existing) {
    existing.qty = (Number(existing.qty) || 0) + qty;
  } else {
    cart.push({
      id: product.id,
      nama: product.nama,
      harga: Number(product.harga) || 0,
      imageUrl: product.imageUrl || '',
      qty: qty
    });
  }
  saveCart(cart);
  showToast(`"${product.nama}" ditambahkan ke keranjang.`);
  updateCartBadge();
}

function removeFromCart(productId) {
  const cart = getCart().filter((item) => Number(item.id) !== Number(productId));
  saveCart(cart);
  updateCartBadge();
}

function updateCartQty(productId, qty) {
  const cart = getCart();
  const item = cart.find((item) => Number(item.id) === Number(productId));
  if (!item) return;
  const next = Number(qty);
  if (!Number.isFinite(next) || next <= 0) {
    removeFromCart(productId);
    return;
  }
  item.qty = Math.floor(next);
  saveCart(cart);
  updateCartBadge();
}

function clearCart() {
  saveCart([]);
  updateCartBadge();
}

function cartCount() {
  return getCart().reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
}

function cartTotal() {
  return getCart().reduce((sum, item) => sum + (Number(item.harga) || 0) * (Number(item.qty) || 0), 0);
}

function updateCartBadge() {
  const badge = document.getElementById('cart-count-badge');
  if (badge) {
    const count = cartCount();
    badge.textContent = count;
    badge.classList.toggle('hidden', count === 0);
  }
}

function addToCartProduct(productId) {
  const source = window.__catalogProducts || [];
  const product = source.find((item) => Number(item.id) === Number(productId));
  if (product) {
    addToCart(product);
    return;
  }
  API.get('/catalog').then((data) => {
    const found = (data.products || []).find((item) => Number(item.id) === Number(productId));
    if (found) addToCart(found);
  }).catch(() => {});
}

document.addEventListener('DOMContentLoaded', () => {
  updateCartBadge();
});

function openRegisterChoiceModal() {
  let modal = document.getElementById('register-choice-modal');
  if (!modal) {
    modal = ensureElement(`
      <div id="register-choice-modal" class="hidden fixed inset-0 z-[65] bg-charcoal/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div class="bg-white rounded-3xl border border-cream-200 w-full max-w-md shadow-2xl overflow-hidden">
          <div class="bg-gradient-to-br from-chili-700 via-terracotta-600 to-turmeric-500 p-6 text-white">
            <div class="flex items-start justify-between">
              <div>
                <h3 class="font-display font-extrabold text-xl">Daftar Akun Baru</h3>
                <p class="text-xs text-amber-50/90 mt-1">Pilih jenis akun yang ingin Anda buat.</p>
              </div>
              <button type="button" onclick="closeRegisterChoiceModal()" class="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors">
                <i data-lucide="x" class="w-4 h-4"></i>
              </button>
            </div>
          </div>
          <div class="p-6 space-y-3">
            <button type="button" onclick="closeRegisterChoiceModal(); openSellerRegisterModal();"
              class="w-full flex items-center gap-3 p-4 rounded-2xl border border-cream-200 bg-cream-50 hover:bg-cream-100 transition-colors text-left">
              <div class="w-11 h-11 rounded-xl bg-terracotta-50 text-terracotta-600 flex items-center justify-center shrink-0">
                <i data-lucide="store" class="w-5 h-5"></i>
              </div>
              <div>
                <p class="font-bold text-charcoal text-sm">Daftar sebagai Seller</p>
                <p class="text-xs text-stone-500">Kelola menu & stok. Akun aktif setelah konfirmasi admin.</p>
              </div>
            </button>
            <button type="button" onclick="closeRegisterChoiceModal(); openBuyerRegisterModal();"
              class="w-full flex items-center gap-3 p-4 rounded-2xl border border-cream-200 bg-cream-50 hover:bg-cream-100 transition-colors text-left">
              <div class="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <i data-lucide="shopping-bag" class="w-5 h-5"></i>
              </div>
              <div>
                <p class="font-bold text-charcoal text-sm">Daftar sebagai Pembeli</p>
                <p class="text-xs text-stone-500">Lihat katalog, keranjang, dan checkout. Akun langsung aktif.</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    `);
    document.body.appendChild(modal);
    modal.addEventListener('click', (event) => {
      if (event.target === modal) closeRegisterChoiceModal();
    });
  }
  modal.classList.remove('hidden');
  if (window.lucide) window.lucide.createIcons();
}

function closeRegisterChoiceModal() {
  const modal = document.getElementById('register-choice-modal');
  if (modal) modal.classList.add('hidden');
}

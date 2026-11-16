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
        <button type="button" onclick="openLoginModal()" class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-charcoal text-white text-xs sm:text-sm font-bold hover:bg-stone-800 transition-colors">
          <i data-lucide="log-in" class="w-4 h-4"></i>
          <span>Masuk</span>
        </button>
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
              <input type="password" id="login-password" required autocomplete="current-password" placeholder="••••••••"
                class="w-full px-3.5 py-2.5 rounded-xl border border-cream-200 bg-cream-50/50 text-sm focus:outline-none focus:ring-2 focus:ring-chili-500/25 focus:border-chili-500">
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

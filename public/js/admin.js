/* Logika panel admin: manajemen user (buat, ubah, aktif/nonaktif, hapus). */

const adminState = {
  users: [],
  search: '',
  role: ''
};

async function initAdmin() {
  const user = await requirePageRole(['admin']);
  if (!user) return;

  bindAdminEvents();
  await loadUsers();
}

function bindAdminEvents() {
  document.getElementById('add-user-btn').addEventListener('click', () => openUserModal());

  document.getElementById('user-modal-close').addEventListener('click', closeUserModal);
  document.getElementById('user-cancel').addEventListener('click', closeUserModal);
  document.getElementById('user-modal').addEventListener('click', (event) => {
    if (event.target === event.currentTarget) closeUserModal();
  });
  document.getElementById('user-form').addEventListener('submit', handleUserSubmit);

  let searchTimer = null;
  document.getElementById('user-search').addEventListener('input', (event) => {
    adminState.search = event.target.value.trim();
    clearTimeout(searchTimer);
    searchTimer = setTimeout(loadUsers, 250);
  });

  document.getElementById('role-filter').addEventListener('change', (event) => {
    adminState.role = event.target.value;
    loadUsers();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeUserModal();
  });
}

async function loadUsers() {
  const params = new URLSearchParams();
  if (adminState.search) params.set('search', adminState.search);
  if (adminState.role) params.set('role', adminState.role);

  try {
    const data = await API.get(`/users?${params.toString()}`);
    adminState.users = data.users;
    renderSummary(data);
    renderUsers();
  } catch (err) {
    showToast('Gagal memuat user: ' + err.message, 'error');
  }
}

function renderSummary(data) {
  const counts = { admin: 0, seller: 0, buyer: 0 };
  adminState.users.forEach((user) => {
    counts[user.role] += 1;
  });

  document.getElementById('summary-total').textContent = adminState.users.length;
  document.getElementById('summary-admin').textContent = counts.admin;
  document.getElementById('summary-seller').textContent = counts.seller;
  document.getElementById('summary-buyer').textContent = counts.buyer;
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

function renderUsers() {
  const tbody = document.getElementById('user-table-body');
  const empty = document.getElementById('user-empty');

  if (!adminState.users.length) {
    tbody.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');

  tbody.innerHTML = adminState.users
    .map((user) => {
      const isSelf = App.user && App.user.id === user.id;
      return `
        <tr class="hover:bg-cream-50/80 transition-colors">
          <td class="py-3.5 px-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-chili-500 to-terracotta-500 text-white text-xs font-extrabold flex items-center justify-center shrink-0">
                ${escapeHtml(user.nama.charAt(0).toUpperCase())}
              </div>
              <div class="min-w-0">
                <p class="font-bold text-charcoal text-xs sm:text-sm truncate max-w-[180px]">
                  ${escapeHtml(user.nama)}${isSelf ? ' <span class="text-[10px] font-semibold text-stone-400">(Anda)</span>' : ''}
                </p>
                <p class="text-[11px] text-stone-500 truncate max-w-[180px]">${escapeHtml(user.email)}</p>
              </div>
            </div>
          </td>
          <td class="py-3.5 px-3">
            <span class="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg border ${ROLE_STYLE[user.role]}">
              ${ROLE_LABEL[user.role]}
            </span>
          </td>
          <td class="py-3.5 px-3">
            <span class="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-lg ${
              user.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-500'
            }">
              <span class="w-1.5 h-1.5 rounded-full ${user.isActive ? 'bg-emerald-500' : 'bg-stone-400'}"></span>
              ${user.isActive ? 'Aktif' : 'Nonaktif'}
            </span>
          </td>
          <td class="py-3.5 px-3 text-xs text-stone-500 hidden sm:table-cell">${formatDate(user.createdAt)}</td>
          <td class="py-3.5 px-4 text-right whitespace-nowrap">
            <div class="inline-flex items-center gap-1.5">
              <button type="button" data-user-edit="${user.id}" title="Edit user"
                class="p-2 rounded-xl bg-cream-100 hover:bg-turmeric-100 text-stone-700 hover:text-terracotta-700 transition-colors">
                <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
              </button>
              <button type="button" data-user-status="${user.id}" title="${user.isActive ? 'Nonaktifkan' : 'Aktifkan'}"
                ${isSelf ? 'disabled' : ''}
                class="p-2 rounded-xl transition-colors ${
                  isSelf
                    ? 'bg-cream-50 text-stone-300 cursor-not-allowed'
                    : user.isActive
                    ? 'bg-amber-50 hover:bg-amber-100 text-amber-600'
                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600'
                }">
                <i data-lucide="${user.isActive ? 'user-x' : 'user-check'}" class="w-3.5 h-3.5"></i>
              </button>
              <button type="button" data-user-delete="${user.id}" title="Hapus user"
                ${isSelf ? 'disabled' : ''}
                class="p-2 rounded-xl transition-colors ${
                  isSelf ? 'bg-cream-50 text-stone-300 cursor-not-allowed' : 'bg-chili-50 hover:bg-chili-100 text-chili-600'
                }">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              </button>
            </div>
          </td>
        </tr>`;
    })
    .join('');

  tbody.querySelectorAll('[data-user-edit]').forEach((button) => {
    button.addEventListener('click', () => {
      const user = adminState.users.find((item) => item.id === Number(button.dataset.userEdit));
      if (user) openUserModal(user);
    });
  });
  tbody.querySelectorAll('[data-user-status]').forEach((button) => {
    if (button.disabled) return;
    button.addEventListener('click', () => toggleUserStatus(Number(button.dataset.userStatus)));
  });
  tbody.querySelectorAll('[data-user-delete]').forEach((button) => {
    if (button.disabled) return;
    button.addEventListener('click', () => deleteUser(Number(button.dataset.userDelete)));
  });

  if (window.lucide) window.lucide.createIcons();
}

function openUserModal(user = null) {
  const modal = document.getElementById('user-modal');
  const form = document.getElementById('user-form');
  form.reset();

  document.getElementById('user-form-error').classList.add('hidden');
  document.getElementById('user-id').value = user ? user.id : '';
  document.getElementById('user-modal-title').textContent = user ? 'Edit User' : 'Tambah User';
  document.getElementById('user-modal-subtitle').textContent = user
    ? `Perbarui data akun ${user.email}.`
    : 'Buat akun baru dengan role tertentu.';

  document.getElementById('user-nama').value = user ? user.nama : '';
  document.getElementById('user-email').value = user ? user.email : '';
  document.getElementById('user-role').value = user ? user.role : 'buyer';
  document.getElementById('user-password').value = '';
  document.getElementById('user-password').required = !user;
  document.getElementById('user-active').checked = user ? user.isActive : true;
  document.getElementById('user-password-hint').classList.toggle('hidden', !user);

  const lockSelf = user && App.user && user.id === App.user.id;
  document.getElementById('user-role').disabled = Boolean(lockSelf);
  document.getElementById('user-active').disabled = Boolean(lockSelf);

  modal.classList.remove('hidden');
  if (window.lucide) window.lucide.createIcons();
  setTimeout(() => document.getElementById('user-nama').focus(), 50);
}

function closeUserModal() {
  document.getElementById('user-modal').classList.add('hidden');
}

async function handleUserSubmit(event) {
  event.preventDefault();

  const id = document.getElementById('user-id').value;
  const password = document.getElementById('user-password').value;
  const errorBox = document.getElementById('user-form-error');
  const submitButton = document.getElementById('user-submit');

  const payload = {
    nama: document.getElementById('user-nama').value.trim(),
    email: document.getElementById('user-email').value.trim(),
    role: document.getElementById('user-role').value,
    isActive: document.getElementById('user-active').checked
  };

  if (password) payload.password = password;
  if (!id) payload.password = password;

  errorBox.classList.add('hidden');
  setButtonLoading(submitButton, true, 'Menyimpan...');

  try {
    if (id) {
      await API.put(`/users/${id}`, payload);
      showToast('Data user berhasil diperbarui.');
    } else {
      await API.post('/users', payload);
      showToast('User baru berhasil dibuat.');
    }
    closeUserModal();
    await loadUsers();
    if (App.user && String(App.user.id) === String(id)) {
      await loadSession();
      if (App.user && !App.user.isActive) window.location.href = '/';
    }
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.classList.remove('hidden');
  } finally {
    setButtonLoading(submitButton, false);
  }
}

async function toggleUserStatus(id) {
  const user = adminState.users.find((item) => item.id === id);
  if (!user) return;

  if (user.isActive) {
    const confirmed = await confirmAction({
      title: 'Nonaktifkan Akun?',
      desc: `Akun "${user.nama}" tidak akan bisa login sampai diaktifkan kembali.`,
      confirmText: 'Ya, Nonaktifkan'
    });
    if (!confirmed) return;
  }

  try {
    await API.patch(`/users/${id}/status`, { isActive: !user.isActive });
    await loadUsers();
    showToast(user.isActive ? `Akun "${user.nama}" dinonaktifkan.` : `Akun "${user.nama}" diaktifkan.`, 'info');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteUser(id) {
  const user = adminState.users.find((item) => item.id === id);
  if (!user) return;

  const confirmed = await confirmAction({
    title: 'Hapus User Ini?',
    desc: `Akun "${user.nama}" (${user.email}) akan dihapus permanen. User dengan produk tidak dapat dihapus.`,
    confirmText: 'Ya, Hapus'
  });
  if (!confirmed) return;

  try {
    await API.delete(`/users/${id}`);
    await loadUsers();
    showToast(`User "${user.nama}" dihapus.`, 'info');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

initAdmin();

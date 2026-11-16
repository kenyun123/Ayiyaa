const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { ApiError, asyncHandler, toUser, normalizeWhatsApp } = require('../utils');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

const ROLES = ['admin', 'seller', 'buyer'];
const USER_SELECT = 'SELECT id, nama, email, telepon, role, is_active, approval_status, created_at, updated_at FROM users';

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 190;
}

function validatePassword(password) {
  return typeof password === 'string' && password.length >= 8 && password.length <= 72;
}

function validatePhone(phone) {
  return phone === '' || (/^[0-9+\-\s()]{6,30}$/.test(phone) && phone.length <= 30);
}

async function countActiveAdmins(excludeId = null) {
  const params = [];
  let extra = '';
  if (excludeId) {
    extra = ' AND id <> ?';
    params.push(excludeId);
  }
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM users WHERE role = 'admin' AND is_active = 1${extra}`,
    params
  );
  return Number(total);
}

router.use(requireRole('admin'));

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const role = String(req.query.role || '').trim();
    const search = String(req.query.search || '').trim();
    const approvalStatus = String(req.query.approvalStatus || '').trim();
    const where = [];
    const params = [];

    if (ROLES.includes(role)) {
      where.push('role = ?');
      params.push(role);
    }
    if (['pending', 'approved', 'rejected'].includes(approvalStatus)) {
      where.push('approval_status = ?');
      params.push(approvalStatus);
    }
    if (search) {
      where.push('(nama LIKE ? OR email LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    const [rows] = await pool.query(
      `${USER_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC`,
      params
    );

    res.json({
      users: rows.map(toUser),
      summary: {
        total: rows.length,
        admin: rows.filter((u) => u.role === 'admin').length,
        seller: rows.filter((u) => u.role === 'seller').length,
        buyer: rows.filter((u) => u.role === 'buyer').length
      }
    });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const nama = String(req.body.nama || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const telepon = String(req.body.telepon || '').trim();
    const password = String(req.body.password || '');
    const role = String(req.body.role || 'buyer');

    if (!nama || nama.length > 120) throw new ApiError(400, 'Nama wajib diisi (maksimal 120 karakter).');
    if (!validateEmail(email)) throw new ApiError(400, 'Format email tidak valid.');
    if (!validatePhone(telepon)) throw new ApiError(400, 'Nomor telepon tidak valid (6-30 karakter, angka/spasi/+/-/()).');
    if (!validatePassword(password)) throw new ApiError(400, 'Password minimal 8 karakter.');
    if (!ROLES.includes(role)) throw new ApiError(400, 'Role tidak valid.');

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    if (existing.length) throw new ApiError(409, 'Email sudah terdaftar.');

    const hash = await bcrypt.hash(password, 12);
    const [result] = await pool.query(
      'INSERT INTO users (nama, email, telepon, password_hash, role, is_active, approval_status) VALUES (?, ?, ?, ?, ?, 1, ?)',
      [nama, email, telepon, hash, role, 'approved']
    );

    const [rows] = await pool.query(`${USER_SELECT} WHERE id = ?`, [result.insertId]);
    res.status(201).json({ user: toUser(rows[0]) });
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const [rows] = await pool.query(`${USER_SELECT} WHERE id = ? LIMIT 1`, [id]);
    if (!rows.length) throw new ApiError(404, 'User tidak ditemukan.');
    const current = rows[0];

    const nama = String(req.body.nama ?? current.nama).trim();
    const email = String(req.body.email ?? current.email).trim().toLowerCase();
    const telepon =
      req.body.telepon === undefined ? String(current.telepon || '') : String(req.body.telepon).trim();
    const role = String(req.body.role ?? current.role);
    const isActive =
      req.body.isActive === undefined ? Boolean(current.is_active) : Boolean(req.body.isActive);
    const password = req.body.password ? String(req.body.password) : null;

    if (!nama || nama.length > 120) throw new ApiError(400, 'Nama wajib diisi (maksimal 120 karakter).');
    if (!validateEmail(email)) throw new ApiError(400, 'Format email tidak valid.');
    if (!validatePhone(telepon)) throw new ApiError(400, 'Nomor telepon tidak valid (6-30 karakter, angka/spasi/+/-/()).');
    if (!ROLES.includes(role)) throw new ApiError(400, 'Role tidak valid.');
    if (password !== null && !validatePassword(password)) {
      throw new ApiError(400, 'Password minimal 8 karakter.');
    }

    const [duplicate] = await pool.query('SELECT id FROM users WHERE email = ? AND id <> ? LIMIT 1', [email, id]);
    if (duplicate.length) throw new ApiError(409, 'Email sudah digunakan user lain.');

    if (id === req.user.id && (role !== 'admin' || !isActive)) {
      throw new ApiError(400, 'Anda tidak dapat menghapus akses admin atau menonaktifkan akun sendiri.');
    }

    const removingAdmin = current.role === 'admin' && current.is_active && (role !== 'admin' || !isActive);
    if (removingAdmin && (await countActiveAdmins(id)) === 0) {
      throw new ApiError(409, 'Harus ada minimal satu admin aktif.');
    }

    if (password !== null) {
      const hash = await bcrypt.hash(password, 12);
      await pool.query(
        'UPDATE users SET nama = ?, email = ?, telepon = ?, role = ?, is_active = ?, password_hash = ? WHERE id = ?',
        [nama, email, telepon, role, isActive ? 1 : 0, hash, id]
      );
    } else {
      await pool.query('UPDATE users SET nama = ?, email = ?, telepon = ?, role = ?, is_active = ? WHERE id = ?', [
        nama,
        email,
        telepon,
        role,
        isActive ? 1 : 0,
        id
      ]);
    }

    const [updated] = await pool.query(`${USER_SELECT} WHERE id = ?`, [id]);
    res.json({ user: toUser(updated[0]) });
  })
);

router.patch(
  '/:id/status',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const isActive = Boolean(req.body.isActive);

    if (id === req.user.id) {
      throw new ApiError(400, 'Anda tidak dapat menonaktifkan akun sendiri.');
    }

    const [rows] = await pool.query(`${USER_SELECT} WHERE id = ? LIMIT 1`, [id]);
    if (!rows.length) throw new ApiError(404, 'User tidak ditemukan.');
    const current = rows[0];

    if (current.role === 'admin' && current.is_active && !isActive && (await countActiveAdmins(id)) === 0) {
      throw new ApiError(409, 'Harus ada minimal satu admin aktif.');
    }

    await pool.query('UPDATE users SET is_active = ? WHERE id = ?', [isActive ? 1 : 0, id]);
    const [updated] = await pool.query(`${USER_SELECT} WHERE id = ?`, [id]);
    res.json({ user: toUser(updated[0]) });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);

    if (id === req.user.id) {
      throw new ApiError(400, 'Anda tidak dapat menghapus akun sendiri.');
    }

    const [rows] = await pool.query(`${USER_SELECT} WHERE id = ? LIMIT 1`, [id]);
    if (!rows.length) throw new ApiError(404, 'User tidak ditemukan.');
    const current = rows[0];

    if (current.role === 'admin' && current.is_active && (await countActiveAdmins(id)) === 0) {
      throw new ApiError(409, 'Harus ada minimal satu admin aktif.');
    }

    const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM products WHERE seller_id = ?', [id]);
    if (Number(total) > 0) {
      throw new ApiError(
        409,
        `User ini memiliki ${total} produk. Nonaktifkan akun atau hapus/pindahkan produknya terlebih dahulu.`
      );
    }

    await pool.query('DELETE FROM users WHERE id = ?', [id]);
    res.json({ message: 'User berhasil dihapus.' });
  })
);

router.post(
  '/:id/approve',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const [rows] = await pool.query(`${USER_SELECT} WHERE id = ? LIMIT 1`, [id]);
    if (!rows.length) throw new ApiError(404, 'User tidak ditemukan.');
    const current = rows[0];
    if (current.role !== 'seller') {
      throw new ApiError(400, 'Hanya akun seller yang dapat dikonfirmasi.');
    }

    await pool.query(
      "UPDATE users SET is_active = 1, approval_status = 'approved' WHERE id = ?",
      [id]
    );

    const [updated] = await pool.query(`${USER_SELECT} WHERE id = ?`, [id]);
    const user = toUser(updated[0]);
    const phone = normalizeWhatsApp(user.telepon);
    const message = `Halo ${user.nama}, akun seller Ayiyaaa Anda telah disetujui admin. Silakan masuk ke dashboard untuk mengelola menu: ${req.protocol}://${req.get('host')}/dashboard.html`;
    const whatsappUrl = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}` : null;

    res.json({ user, whatsappUrl });
  })
);

router.post(
  '/:id/reject',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const [rows] = await pool.query(`${USER_SELECT} WHERE id = ? LIMIT 1`, [id]);
    if (!rows.length) throw new ApiError(404, 'User tidak ditemukan.');
    const current = rows[0];
    if (current.role !== 'seller') {
      throw new ApiError(400, 'Hanya akun seller yang dapat ditolak.');
    }

    await pool.query(
      "UPDATE users SET is_active = 0, approval_status = 'rejected' WHERE id = ?",
      [id]
    );

    const [updated] = await pool.query(`${USER_SELECT} WHERE id = ?`, [id]);
    res.json({ user: toUser(updated[0]) });
  })
);

module.exports = router;

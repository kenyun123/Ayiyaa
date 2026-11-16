const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { ApiError, asyncHandler, toUser, normalizeWhatsApp } = require('../utils');

const router = express.Router();

router.get(
  '/me',
  asyncHandler(async (req, res) => {
    res.json({ user: req.user || null });
  })
);

router.post(
  '/login',
  asyncHandler(async (req, res, next) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (!email || !password) {
      throw new ApiError(400, 'Email dan password wajib diisi.');
    }

    const [rows] = await pool.query(
      'SELECT id, nama, email, telepon, password_hash, role, is_active, approval_status, created_at, updated_at FROM users WHERE email = ? LIMIT 1',
      [email]
    );

    if (!rows.length) {
      throw new ApiError(401, 'Email atau password salah.');
    }

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      throw new ApiError(401, 'Email atau password salah.');
    }

    if (!user.is_active) {
      if (user.approval_status === 'pending') {
        throw new ApiError(403, 'Akun seller Anda menunggu konfirmasi admin.');
      }
      if (user.approval_status === 'rejected') {
        throw new ApiError(403, 'Pendaftaran seller Anda ditolak. Hubungi admin.');
      }
      throw new ApiError(403, 'Akun Anda dinonaktifkan. Hubungi admin toko.');
    }

    // Regenerasi session untuk mencegah session fixation.
    await new Promise((resolve, reject) =>
      req.session.regenerate((err) => (err ? reject(err) : resolve()))
    );

    req.session.userId = user.id;
    res.json({ user: toUser(user), redirectTo: user.role === 'admin' ? '/admin.html' : user.role === 'seller' ? '/dashboard.html' : '/' });
  })
);

router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    await new Promise((resolve) => req.session.destroy(() => resolve()));
    res.clearCookie('ayiyaaa.sid');
    res.json({ message: 'Berhasil keluar.' });
  })
);

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 190;
}

function validatePassword(password) {
  return typeof password === 'string' && password.length >= 8 && password.length <= 72;
}

function validatePhone(phone) {
  return /^[0-9+\-\s()]{6,30}$/.test(phone) && phone.length <= 30;
}

router.post(
  '/register-seller',
  asyncHandler(async (req, res) => {
    const nama = String(req.body.nama || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const telepon = String(req.body.telepon || '').trim();
    const password = String(req.body.password || '');

    if (!nama || nama.length > 120) throw new ApiError(400, 'Nama wajib diisi (maksimal 120 karakter).');
    if (!validateEmail(email)) throw new ApiError(400, 'Format email tidak valid.');
    if (!validatePhone(telepon)) throw new ApiError(400, 'Nomor telepon wajib diisi dan valid (6-30 karakter).');
    if (!validatePassword(password)) throw new ApiError(400, 'Password minimal 8 karakter.');

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    if (existing.length) throw new ApiError(409, 'Email sudah terdaftar.');

    const hash = await bcrypt.hash(password, 12);
    const [result] = await pool.query(
      `INSERT INTO users (nama, email, telepon, password_hash, role, is_active, approval_status)
       VALUES (?, ?, ?, ?, 'seller', 0, 'pending')`,
      [nama, email, telepon, hash]
    );

    const [rows] = await pool.query(
      'SELECT id, nama, email, telepon, role, is_active, approval_status, created_at, updated_at FROM users WHERE id = ? LIMIT 1',
      [result.insertId]
    );

    const [admins] = await pool.query(
      "SELECT telepon FROM users WHERE role = 'admin' AND is_active = 1 AND telepon <> '' ORDER BY id LIMIT 1"
    );
    let adminPhone = admins.length ? admins[0].telepon : '';
    if (!adminPhone) {
      const [settings] = await pool.query('SELECT whatsapp_number FROM store_settings WHERE id = 1 LIMIT 1');
      adminPhone = settings.length ? settings[0].whatsapp_number : '';
    }
    const normalizedAdminPhone = normalizeWhatsApp(adminPhone);
    const message = `Halo Admin Ayiyaaa, ada pendaftaran seller baru:\n\nNama: ${nama}\nEmail: ${email}\nTelepon: ${telepon}\n\nSilakan konfirmasi akun di panel admin: ${req.protocol}://${req.get('host')}/admin.html`;
    const whatsappUrl = normalizedAdminPhone
      ? `https://wa.me/${normalizedAdminPhone}?text=${encodeURIComponent(message)}`
      : null;

    res.status(201).json({
      user: toUser(rows[0]),
      whatsappUrl,
      message: 'Pendaftaran seller berhasil. Akun menunggu konfirmasi admin.'
    });
  })
);

router.post(
  '/register-buyer',
  asyncHandler(async (req, res) => {
    const nama = String(req.body.nama || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const telepon = String(req.body.telepon || '').trim();
    const password = String(req.body.password || '');

    if (!nama || nama.length > 120) throw new ApiError(400, 'Nama wajib diisi (maksimal 120 karakter).');
    if (!validateEmail(email)) throw new ApiError(400, 'Format email tidak valid.');
    if (!validatePhone(telepon)) throw new ApiError(400, 'Nomor telepon wajib diisi dan valid (6-30 karakter).');
    if (!validatePassword(password)) throw new ApiError(400, 'Password minimal 8 karakter.');

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    if (existing.length) throw new ApiError(409, 'Email sudah terdaftar.');

    const hash = await bcrypt.hash(password, 12);
    const [result] = await pool.query(
      `INSERT INTO users (nama, email, telepon, password_hash, role, is_active, approval_status)
       VALUES (?, ?, ?, ?, 'buyer', 1, 'approved')`,
      [nama, email, telepon, hash]
    );

    const [rows] = await pool.query(
      'SELECT id, nama, email, telepon, role, is_active, approval_status, created_at, updated_at FROM users WHERE id = ? LIMIT 1',
      [result.insertId]
    );

    const phone = normalizeWhatsApp(telepon);
    const message = `Halo ${nama}, selamat! Akun pembeli Ayiyaaa Anda berhasil dibuat.\n\nEmail: ${email}\n\nSilakan masuk untuk melihat katalog dan keranjang belanja: ${req.protocol}://${req.get('host')}/buyer.html`;
    const whatsappUrl = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}` : null;

    res.status(201).json({
      user: toUser(rows[0]),
      whatsappUrl,
      message: 'Pendaftaran pembeli berhasil. Akun Anda sudah aktif.'
    });
  })
);

module.exports = router;

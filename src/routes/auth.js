const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { ApiError, asyncHandler, toUser } = require('../utils');

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
      'SELECT id, nama, email, password_hash, role, is_active, created_at, updated_at FROM users WHERE email = ? LIMIT 1',
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

module.exports = router;

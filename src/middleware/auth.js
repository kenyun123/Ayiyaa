const pool = require('../db');
const { toUser } = require('../utils');

/**
 * Memuat user dari session pada setiap request agar perubahan role/status
 * langsung berlaku tanpa perlu login ulang.
 */
async function loadUser(req, res, next) {
  try {
    if (!req.session || !req.session.userId) {
      req.user = null;
      return next();
    }

    const [rows] = await pool.query(
      'SELECT id, nama, email, telepon, role, is_active, approval_status, created_at, updated_at FROM users WHERE id = ? LIMIT 1',
      [req.session.userId]
    );

    if (!rows.length || !rows[0].is_active) {
      req.session.destroy(() => {});
      req.user = null;
      return next();
    }

    req.user = toUser(rows[0]);
    return next();
  } catch (err) {
    return next(err);
  }
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: 'Silakan masuk terlebih dahulu.' });
  }
  return next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Silakan masuk terlebih dahulu.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Anda tidak memiliki akses ke tindakan ini.' });
    }
    return next();
  };
}

/** Penjaga halaman HTML: redirect ke katalog bila role tidak sesuai. */
function pageGuard(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.redirect('/?login=1');
    if (!roles.includes(req.user.role)) return res.redirect('/?forbidden=1');
    return next();
  };
}

module.exports = { loadUser, requireAuth, requireRole, pageGuard };

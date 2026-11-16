const express = require('express');
const pool = require('../db');
const { ApiError, asyncHandler, normalizeWhatsApp } = require('../utils');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

router.get(
  '/',
  requireRole('seller', 'admin'),
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query('SELECT nama_toko, whatsapp_number, jam_buka FROM store_settings WHERE id = 1');
    const row = rows[0] || {};

    res.json({
      settings: {
        namaToko: row.nama_toko || 'Ayiyaaa Street Bistro',
        whatsappNumber: row.whatsapp_number || '6281234567890',
        jamBuka: row.jam_buka || ''
      }
    });
  })
);

router.put(
  '/',
  requireRole('seller', 'admin'),
  asyncHandler(async (req, res) => {
    const namaToko = String(req.body.namaToko ?? '').trim();
    const jamBuka = String(req.body.jamBuka ?? '').trim();
    const rawPhone = req.body.whatsappNumber;
    const whatsappNumber = normalizeWhatsApp(rawPhone);

    if (!namaToko || namaToko.length > 120) {
      throw new ApiError(400, 'Nama toko wajib diisi (maksimal 120 karakter).');
    }
    if (jamBuka.length > 80) {
      throw new ApiError(400, 'Jam buka maksimal 80 karakter.');
    }
    if (!/^62\d{9,13}$/.test(whatsappNumber)) {
      throw new ApiError(400, 'Nomor WhatsApp tidak valid. Contoh: 081234567890 atau 6281234567890.');
    }

    await pool.query(
      `INSERT INTO store_settings (id, nama_toko, whatsapp_number, jam_buka)
       VALUES (1, ?, ?, ?)
       ON DUPLICATE KEY UPDATE nama_toko = VALUES(nama_toko),
         whatsapp_number = VALUES(whatsapp_number),
         jam_buka = VALUES(jam_buka)`,
      [namaToko, whatsappNumber, jamBuka]
    );

    res.json({ settings: { namaToko, whatsappNumber, jamBuka } });
  })
);

module.exports = router;

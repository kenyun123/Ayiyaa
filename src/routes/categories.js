const express = require('express');
const pool = require('../db');
const { ApiError, asyncHandler } = require('../utils');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

function validateCategory(body) {
  const nama = String(body.nama || '').trim();
  const deskripsi = String(body.deskripsi || '').trim();
  const urutan = body.urutan === undefined || body.urutan === '' ? 0 : Number(body.urutan);

  if (!nama || nama.length > 80) {
    throw new ApiError(400, 'Nama kategori wajib diisi (maksimal 80 karakter).');
  }
  if (deskripsi.length > 255) {
    throw new ApiError(400, 'Deskripsi kategori maksimal 255 karakter.');
  }
  if (!Number.isInteger(urutan) || urutan < 0 || urutan > 999) {
    throw new ApiError(400, 'Urutan tidak valid.');
  }

  return { nama, deskripsi, urutan };
}

router.post(
  '/',
  requireRole('seller', 'admin'),
  asyncHandler(async (req, res) => {
    const data = validateCategory(req.body);

    const [existing] = await pool.query('SELECT id FROM categories WHERE nama = ? LIMIT 1', [data.nama]);
    if (existing.length) throw new ApiError(409, 'Nama kategori sudah digunakan.');

    const [result] = await pool.query(
      'INSERT INTO categories (nama, deskripsi, urutan) VALUES (?, ?, ?)',
      [data.nama, data.deskripsi, data.urutan]
    );

    res.status(201).json({ category: { id: result.insertId, nama: data.nama, deskripsi: data.deskripsi, urutan: data.urutan, jumlahProduk: 0 } });
  })
);

router.put(
  '/:id',
  requireRole('seller', 'admin'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const data = validateCategory(req.body);

    const [rows] = await pool.query('SELECT id FROM categories WHERE id = ? LIMIT 1', [id]);
    if (!rows.length) throw new ApiError(404, 'Kategori tidak ditemukan.');

    const [duplicate] = await pool.query('SELECT id FROM categories WHERE nama = ? AND id <> ? LIMIT 1', [data.nama, id]);
    if (duplicate.length) throw new ApiError(409, 'Nama kategori sudah digunakan.');

    await pool.query('UPDATE categories SET nama = ?, deskripsi = ?, urutan = ? WHERE id = ?', [
      data.nama,
      data.deskripsi,
      data.urutan,
      id
    ]);

    res.json({ category: { id, ...data } });
  })
);

router.delete(
  '/:id',
  requireRole('seller', 'admin'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);

    const [rows] = await pool.query('SELECT id FROM categories WHERE id = ? LIMIT 1', [id]);
    if (!rows.length) throw new ApiError(404, 'Kategori tidak ditemukan.');

    const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM products WHERE category_id = ?', [id]);
    if (Number(total) > 0) {
      throw new ApiError(409, `Kategori masih dipakai oleh ${total} produk. Pindahkan produk tersebut terlebih dahulu.`);
    }

    await pool.query('DELETE FROM categories WHERE id = ?', [id]);
    res.json({ message: 'Kategori berhasil dihapus.' });
  })
);

module.exports = router;

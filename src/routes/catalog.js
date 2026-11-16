const express = require('express');
const pool = require('../db');
const { asyncHandler, toProduct } = require('../utils');

const router = express.Router();

const SORTS = {
  featured: 'p.unggulan DESC, p.nama ASC',
  'price-asc': 'p.harga ASC, p.nama ASC',
  'price-desc': 'p.harga DESC, p.nama ASC',
  'name-asc': 'p.nama ASC',
  'stock-desc': 'p.stok DESC, p.nama ASC'
};

async function getStoreSettings() {
  const [rows] = await pool.query(
    'SELECT nama_toko, whatsapp_number, jam_buka FROM store_settings WHERE id = 1 LIMIT 1'
  );
  return rows[0] || {
    nama_toko: 'Ayiyaaa Street Bistro',
    whatsapp_number: '6281234567890',
    jam_buka: 'Buka Setiap Hari • 10.00 - 21.00 WIB'
  };
}

router.get(
  '/store',
  asyncHandler(async (req, res) => {
    const store = await getStoreSettings();
    res.json({
      store: {
        namaToko: store.nama_toko,
        whatsappNumber: store.whatsapp_number,
        jamBuka: store.jam_buka
      }
    });
  })
);

router.get(
  '/categories',
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
      `SELECT c.id, c.nama, c.deskripsi, c.urutan, COUNT(p.id) AS jumlah_produk
       FROM categories c
       LEFT JOIN products p ON p.category_id = c.id AND p.is_active = 1
       GROUP BY c.id, c.nama, c.deskripsi, c.urutan
       ORDER BY c.urutan ASC, c.nama ASC`
    );

    res.json({
      categories: rows.map((row) => ({
        id: row.id,
        nama: row.nama,
        deskripsi: row.deskripsi,
        urutan: row.urutan,
        jumlahProduk: Number(row.jumlah_produk)
      }))
    });
  })
);

router.get(
  '/catalog',
  asyncHandler(async (req, res) => {
    const search = String(req.query.search || '').trim();
    const categoryId = Number(req.query.categoryId) || null;
    const sort = SORTS[req.query.sort] ? req.query.sort : 'featured';

    const where = ['p.is_active = 1', 'u.is_active = 1'];
    const params = [];

    if (categoryId) {
      where.push('p.category_id = ?');
      params.push(categoryId);
    }

    if (search) {
      where.push('(p.nama LIKE ? OR p.deskripsi LIKE ? OR c.nama LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like);
    }

    const [rows] = await pool.query(
      `SELECT p.*, c.nama AS kategori, u.nama AS seller_name
       FROM products p
       JOIN categories c ON c.id = p.category_id
       JOIN users u ON u.id = p.seller_id
       WHERE ${where.join(' AND ')}
       ORDER BY ${SORTS[sort]}`,
      params
    );

    const store = await getStoreSettings();

    res.json({
      products: rows.map(toProduct),
      total: rows.length,
      store: {
        namaToko: store.nama_toko,
        whatsappNumber: store.whatsapp_number,
        jamBuka: store.jam_buka
      }
    });
  })
);

module.exports = router;

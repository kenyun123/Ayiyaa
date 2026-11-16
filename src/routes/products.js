const express = require('express');
const pool = require('../db');
const { ApiError, asyncHandler, toProduct } = require('../utils');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

const PRODUCT_SELECT = `
  SELECT p.*, c.nama AS kategori, u.nama AS seller_name
  FROM products p
  JOIN categories c ON c.id = p.category_id
  JOIN users u ON u.id = p.seller_id
`;

async function findProduct(id) {
  const [rows] = await pool.query(`${PRODUCT_SELECT} WHERE p.id = ? LIMIT 1`, [id]);
  return rows[0] || null;
}

function assertCanManage(user, product) {
  if (user.role !== 'admin' && product.seller_id !== user.id) {
    throw new ApiError(403, 'Anda hanya dapat mengelola produk milik sendiri.');
  }
}

async function validatePayload(body, current = null) {
  const nama = String(body.nama ?? current?.nama ?? '').trim();
  const deskripsi = String(body.deskripsi ?? current?.deskripsi ?? '').trim();
  const categoryId = Number(body.categoryId ?? current?.category_id);
  const harga = Number(body.harga ?? current?.harga);
  const stok = Number(body.stok ?? current?.stok);
  const imageUrl = String(body.imageUrl ?? current?.image_url ?? '').trim();
  const unggulan = body.unggulan === undefined ? Boolean(current?.unggulan) : Boolean(body.unggulan);

  if (!nama || nama.length > 150) {
    throw new ApiError(400, 'Nama menu wajib diisi (maksimal 150 karakter).');
  }
  if (!deskripsi) {
    throw new ApiError(400, 'Deskripsi menu wajib diisi.');
  }
  if (!Number.isInteger(harga) || harga < 0 || harga > 100000000) {
    throw new ApiError(400, 'Harga tidak valid.');
  }
  if (!Number.isInteger(stok) || stok < 0 || stok > 1000000) {
    throw new ApiError(400, 'Stok tidak valid.');
  }
  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    throw new ApiError(400, 'Kategori wajib dipilih.');
  }
  if (imageUrl.length > 500) {
    throw new ApiError(400, 'URL gambar terlalu panjang.');
  }

  const [categories] = await pool.query('SELECT id FROM categories WHERE id = ? LIMIT 1', [categoryId]);
  if (!categories.length) {
    throw new ApiError(400, 'Kategori tidak ditemukan.');
  }

  return { nama, deskripsi, categoryId, harga, stok, imageUrl, unggulan };
}

router.get(
  '/',
  requireRole('seller', 'admin'),
  asyncHandler(async (req, res) => {
    const params = [];
    let where = '';

    if (req.user.role === 'seller') {
      where = 'WHERE p.seller_id = ?';
      params.push(req.user.id);
    }

    const [rows] = await pool.query(
      `${PRODUCT_SELECT} ${where} ORDER BY p.unggulan DESC, p.nama ASC`,
      params
    );

    res.json({ products: rows.map(toProduct) });
  })
);

router.post(
  '/',
  requireRole('seller', 'admin'),
  asyncHandler(async (req, res) => {
    const data = await validatePayload(req.body);

    let sellerId = req.user.id;
    if (req.user.role === 'admin' && req.body.sellerId) {
      const requested = Number(req.body.sellerId);
      const [sellers] = await pool.query(
        "SELECT id FROM users WHERE id = ? AND role = 'seller' LIMIT 1",
        [requested]
      );
      if (!sellers.length) throw new ApiError(400, 'Seller tidak ditemukan.');
      sellerId = requested;
    }

    const [result] = await pool.query(
      `INSERT INTO products (seller_id, category_id, nama, harga, stok, deskripsi, image_url, unggulan, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [sellerId, data.categoryId, data.nama, data.harga, data.stok, data.deskripsi, data.imageUrl, data.unggulan ? 1 : 0]
    );

    const product = await findProduct(result.insertId);
    res.status(201).json({ product: toProduct(product) });
  })
);

router.put(
  '/:id',
  requireRole('seller', 'admin'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const current = await findProduct(id);
    if (!current) throw new ApiError(404, 'Produk tidak ditemukan.');

    assertCanManage(req.user, current);
    const data = await validatePayload(req.body, current);

    await pool.query(
      `UPDATE products
       SET category_id = ?, nama = ?, harga = ?, stok = ?, deskripsi = ?, image_url = ?, unggulan = ?
       WHERE id = ?`,
      [data.categoryId, data.nama, data.harga, data.stok, data.deskripsi, data.imageUrl, data.unggulan ? 1 : 0, id]
    );

    res.json({ product: toProduct(await findProduct(id)) });
  })
);

router.patch(
  '/:id/stock',
  requireRole('seller', 'admin'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const current = await findProduct(id);
    if (!current) throw new ApiError(404, 'Produk tidak ditemukan.');

    assertCanManage(req.user, current);

    const delta = Number(req.body.delta);
    if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 1000) {
      throw new ApiError(400, 'Perubahan stok tidak valid.');
    }

    await pool.query('UPDATE products SET stok = GREATEST(0, stok + ?) WHERE id = ?', [delta, id]);
    res.json({ product: toProduct(await findProduct(id)) });
  })
);

router.patch(
  '/:id/featured',
  requireRole('seller', 'admin'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const current = await findProduct(id);
    if (!current) throw new ApiError(404, 'Produk tidak ditemukan.');

    assertCanManage(req.user, current);

    const unggulan = Boolean(req.body.unggulan);
    await pool.query('UPDATE products SET unggulan = ? WHERE id = ?', [unggulan ? 1 : 0, id]);
    res.json({ product: toProduct(await findProduct(id)) });
  })
);

router.delete(
  '/:id',
  requireRole('seller', 'admin'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const current = await findProduct(id);
    if (!current) throw new ApiError(404, 'Produk tidak ditemukan.');

    assertCanManage(req.user, current);
    await pool.query('DELETE FROM products WHERE id = ?', [id]);
    res.json({ message: 'Produk berhasil dihapus.' });
  })
);

module.exports = router;

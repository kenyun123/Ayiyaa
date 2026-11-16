/**
 * Kelas error dengan status HTTP agar error handler bisa memberi respons yang tepat.
 */
class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Membungkus handler async agar rejection diteruskan ke error handler Express. */
const asyncHandler = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

/** Mengubah baris produk dari database menjadi objek JSON yang dipakai frontend. */
function toProduct(row) {
  return {
    id: row.id,
    sellerId: row.seller_id,
    sellerName: row.seller_name || null,
    categoryId: row.category_id,
    kategori: row.kategori,
    nama: row.nama,
    harga: Number(row.harga),
    stok: Number(row.stok),
    deskripsi: row.deskripsi,
    imageUrl: row.image_url,
    unggulan: Boolean(row.unggulan),
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toUser(row) {
  return {
    id: row.id,
    nama: row.nama,
    email: row.email,
    telepon: row.telepon || '',
    role: row.role,
    isActive: Boolean(row.is_active),
    approvalStatus: row.approval_status || 'approved',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/** Menormalkan nomor WhatsApp Indonesia menjadi format 62xxxxxxxxxx. */
function normalizeWhatsApp(raw) {
  let digits = String(raw || '').replace(/\D/g, '');
  if (digits.startsWith('0')) digits = '62' + digits.slice(1);
  if (digits.startsWith('8')) digits = '62' + digits;
  return digits;
}

module.exports = { ApiError, asyncHandler, toProduct, toUser, normalizeWhatsApp };

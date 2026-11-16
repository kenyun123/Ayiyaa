# Ayiyaaa — Katalog & Manajemen UMKM Bakso Mie Ayam

Versi production dari prototype `ayiyaaa_katalog_dashboard_umkm_bakso_mie_ayam (4).html`.
Katalog publik tetap bisa diakses tanpa login, sedangkan pengelolaan data dilakukan
lewat akun dengan role **admin**, **seller**, dan **pembeli** yang tersimpan di **MySQL**.

## Stack

- **Backend:** Node.js 18+, Express 4
- **Database:** MySQL 8 (driver `mysql2`, pool koneksi)
- **Autentikasi:** session cookie `httpOnly` + `bcryptjs` (hash password), session disimpan di tabel MySQL
- **Upload foto:** `multer` (maks 3 MB, tipe JPG/PNG/WebP/GIF) + kompresi canvas di browser
- **Frontend:** HTML + Tailwind CSS (CDN) + vanilla JS, tanpa build step

## Hak akses per role

| Kemampuan | Admin | Seller | Pembeli |
|---|:---:|:---:|:---:|
| Melihat katalog & pesan via WhatsApp | ✅ | ✅ | ✅ |
| Mengelola produk (CRUD, stok cepat, unggulan, foto) | ✅ (semua produk) | ✅ (produk sendiri) | ❌ |
| Mengelola kategori | ✅ | ✅ | ❌ |
| Mengubah nomor WhatsApp & pengaturan toko | ✅ | ✅ | ❌ |
| Mengelola user (buat, ubah, aktif/nonaktif, hapus) | ✅ | ❌ | ❌ |

Pembeli tidak perlu login untuk melihat katalog. Login pembeli hanya menampilkan katalog
(role `buyer` tidak memiliki akses dashboard maupun manajemen user).

## Menjalankan aplikasi

### 1. Prasyarat

- Node.js >= 18
- MySQL 8 yang berjalan di `127.0.0.1:3306`

Jika memakai Laragon, jalankan MySQL-nya (mis. dari menu Laragon) atau lewat terminal:

```bash
"/c/laragon/bin/mysql/mysql-8.4.3-winx64/bin/mysqld.exe" \
  --defaults-file="/c/laragon/bin/mysql/mysql-8.4.3-winx64/my.ini" --console
```

### 2. Konfigurasi

```bash
cp .env.example .env   # lalu sesuaikan DB_USER / DB_PASSWORD
npm install
```

Isi `.env` yang dipakai:

```env
PORT=3000
NODE_ENV=development
SESSION_SECRET=string-acak-panjang
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=ayiyaaa
```

### 3. Migrasi & data dummy

```bash
npm run db:migrate   # membuat database + tabel (users, categories, products, store_settings)
npm run db:seed      # 4 akun demo, 5 kategori, 8 produk contoh
```

Perintah lain:

```bash
npm run db:reset     # hapus & buat ulang database, lalu seed ulang
npm start            # jalankan server production-mode
npm run dev          # jalankan dengan auto-reload (node --watch)
```

Buka **http://localhost:3000**.

## Akun demo

| Role | Email | Password |
|---|---|---|
| Admin | `admin@ayiyaaa.test` | `Admin#12345` |
| Seller | `seller@ayiyaaa.test` | `Seller#12345` |
| Seller | `sari@ayiyaaa.test` | `Seller#12345` |
| Pembeli | `pembeli@ayiyaaa.test` | `Pembeli#12345` |

Tombol **Masuk** di kanan atas menyediakan tombol isi-otomatis untuk ketiga role tersebut.

## Halaman

| URL | Akses | Isi |
|---|---|---|
| `/` | publik | Katalog, pencarian, filter kategori, sorting, tombol WhatsApp |
| `/dashboard.html` | seller, admin | Statistik, pengaturan toko/WA, CRUD produk, stok cepat, CRUD kategori, upload foto |
| `/admin.html` | admin | Ringkasan user, pencarian/filter role, CRUD user, aktif/nonaktif |

## Struktur project

```
server.js                 # entrypoint Express, session, route, error handler
src/config.js             # konfigurasi .env
src/db.js                 # connection pool mysql2
src/utils.js              # ApiError, mapper produk/user, normalisasi nomor WA
src/middleware/auth.js    # loadUser, requireAuth, requireRole, pageGuard
src/routes/
  auth.js                 # login, logout, me
  catalog.js              # katalog publik, kategori, info toko
  products.js             # CRUD produk + stok + unggulan (seller/admin)
  categories.js           # CRUD kategori
  users.js                # manajemen user (admin)
  settings.js             # pengaturan toko & nomor WhatsApp
  uploads.js              # unggah foto produk
db/schema.sql             # skema MySQL
scripts/migrate.js        # runner migrasi (--fresh untuk reset)
scripts/seed.js           # seed akun, kategori, produk, pengaturan
public/                   # frontend (index, dashboard, admin, 404 + js/css/img)
public/uploads/           # hasil unggah foto
```

## Skema database

- **users** — `id, nama, email (unik), password_hash, role ENUM(admin|seller|buyer), is_active`
- **categories** — `id, nama (unik), deskripsi, urutan`
- **products** — `id, seller_id → users, category_id → categories, nama, harga, stok, deskripsi, image_url, unggulan, is_active`
- **store_settings** — satu baris (`id=1`): `nama_toko, whatsapp_number, jam_buka`
- **sessions** — dibuat otomatis oleh session store MySQL

Aturan integritas: produk tidak bisa dihapus kategorinya bila masih dipakai
(`ON DELETE RESTRICT`), dan user seller yang masih memiliki produk tidak dapat dihapus
(API mengembalikan pesan agar dinonaktifkan saja).

## Ringkasan API

Semua respons JSON. Autentikasi memakai cookie session (`credentials: same-origin`).

| Method & Path | Akses | Fungsi |
|---|---|---|
| `POST /api/auth/login` | publik | Login, set cookie session |
| `POST /api/auth/logout` | login | Hapus session |
| `GET /api/auth/me` | publik | User aktif / `null` |
| `GET /api/store` | publik | Info toko & nomor WhatsApp |
| `GET /api/categories` | publik | Kategori + jumlah produk aktif |
| `GET /api/catalog?search=&categoryId=&sort=` | publik | Produk aktif (sort: featured, price-asc, price-desc, name-asc, stock-desc) |
| `GET /api/products` | seller/admin | Produk milik seller / semua (admin) |
| `POST /api/products` | seller/admin | Tambah produk |
| `PUT /api/products/:id` | seller/admin | Ubah produk |
| `PATCH /api/products/:id/stock` | seller/admin | `{delta}` tambah/kurangi stok |
| `PATCH /api/products/:id/featured` | seller/admin | `{unggulan}` |
| `DELETE /api/products/:id` | seller/admin | Hapus produk |
| `POST/PUT/DELETE /api/categories/:id` | seller/admin | Kelola kategori |
| `GET/PUT /api/settings` | seller/admin | Pengaturan toko & WhatsApp |
| `POST /api/uploads` | seller/admin | Unggah foto (`multipart`, field `image`) |
| `GET /api/users?role=&search=` | admin | Daftar user |
| `POST /api/users` | admin | Buat user |
| `PUT /api/users/:id` | admin | Ubah user |
| `PATCH /api/users/:id/status` | admin | `{isActive}` |
| `DELETE /api/users/:id` | admin | Hapus user |

## Catatan keamanan & produksi

- Password di-hash `bcrypt` (cost 12); session cookie `httpOnly`, `sameSite=lax`,
  `secure` otomatis saat `NODE_ENV=production` (butuh HTTPS).
- Session disimpan di MySQL sehingga tetap valid setelah restart dan bisa dipakai multi-instance.
- Setiap request memuat ulang user dari database; menonaktifkan akun langsung memutus aksesnya.
- Otorisasi dicek di server (`requireRole`) — bukan hanya menyembunyikan tombol di UI.
- Validasi input di server: panjang teks, harga/stok bilangan bulat non-negatif, kategori harus ada,
  email unik, role hanya `admin|seller|buyer`, nomor WA dinormalisasi ke format `62...`.
- Upload dibatasi 3 MB dan tipe gambar; file disimpan dengan nama UUID di `public/uploads`.
- Admin tidak dapat menghapus/menonaktifkan akun sendiri atau menghapus admin aktif terakhir.
- Isi `SESSION_SECRET` dengan nilai acak kuat sebelum deploy, dan jalankan di balik HTTPS.

## Verifikasi yang dilakukan

- Migrasi & seed berhasil pada MySQL 8.4.
- Login/logout dan `/api/auth/me` untuk ketiga role.
- Guard halaman: pembeli → 302, seller bisa dashboard tapi bukan admin, admin bisa keduanya.
- CRUD produk (tambah, ubah, stok `-3`, unggulan, hapus) dan validasi harga negatif → 400.
- CRUD kategori termasuk penolakan hapus kategori yang masih dipakai produk.
- Pengaturan WhatsApp tidak valid → 400, nomor `08...` dinormalisasi menjadi `62...`.
- Upload gambar valid → URL tersimpan; tipe non-gambar ditolak.
- Manajemen user: buat, email duplikat → 409, aktif/nonaktif, hapus, larangan menonaktifkan diri sendiri → 400,
  dan penolakan hapus seller yang masih punya produk → 409.

## Troubleshooting

- **`ECONNREFUSED 3306`** — MySQL belum berjalan; nyalakan service/laragon lebih dulu.
- **`ER_ACCESS_DENIED_ERROR`** — sesuaikan `DB_USER` / `DB_PASSWORD` di `.env`.
- **Sesi hilang setelah restart** — pastikan tabel `sessions` ada (dibuat otomatis saat server pertama kali jalan).
- **Foto tidak tampil** — pastikan folder `public/uploads` dapat ditulis dan file tidak melebihi 3 MB.
- **Reset total data demo** — jalankan `npm run db:reset` (menghapus seluruh data di database `ayiyaaa`).

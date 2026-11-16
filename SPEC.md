# Spesifikasi Teknis (SPEC.md) — Ayiyaaa
Katalog & Dashboard UMKM Bakso dan Mie Ayam Berbasis Web (Latihan 1 Hari)

---

## 1. Tujuan
Membangun aplikasi web interaktif satu halaman (SPA) yang bersih, responsif, dan kaya fitur untuk UMKM kuliner (khususnya Bakso dan Mie Ayam) yang memungkinkan pengelola toko mengelola katalog produk secara mandiri dan memungkinkan calon pembeli menjelajahi menu serta memesan secara instan melalui WhatsApp—tanpa memerlukan backend server maupun sistem login yang rumit.

## 2. Pengguna
- **Calon Pembeli:** Pengunjung web yang ingin melihat daftar menu, mencari makanan berdasarkan kategori/nama, memeriksa ketersediaan stok, melihat menu unggulan, dan memesan langsung via WhatsApp.
- **Pengelola Toko (Admin):** Pemilik atau staf UMKM yang mengelola inventaris, memperbarui nomor WhatsApp toko, mengubah harga, menambah porsi stok, menandai menu unggulan, serta mengunggah foto menu langsung dari perangkat pada satu perangkat yang sama.

## 3. Daftar Fitur Utama
1. **Navigasi Dual-Mode:** Peralihan mulus antara **Katalog Pembeli** dan **Dashboard Pengelola** secara instan.
2. **Katalog Interaktif 5 Kategori:** Mendukung kategori *Bakso*, *Mie Ayam*, *Paket Hemat*, *Topping & Ekstra*, dan *Minuman*.
3. **Pencarian, Filter, & Sorting:** Pencarian teks *real-time*, tombol filter kategori dengan penghitung produk, serta pengurutan berdasarkan unggulan, harga termurah/tertinggi, nama A-Z, dan stok terbanyak.
4. **Pemesanan WhatsApp Langsung:** Tombol pemesanan per menu yang otomatis merangkai pesan pesanan dan mengarah ke nomor WhatsApp aktif toko.
5. **Nomor WhatsApp Toko yang Dapat Dikonfigurasi:** Kartu pengaturan di dashboard untuk melihat dan memperbarui nomor WhatsApp tujuan pesanan yang tersimpan di browser.
6. **Dashboard Demo CRUD Lengkap:**
   - **Create / Add:** Formulir tambah menu baru.
   - **Read:** Tabel inventaris menu lengkap dengan status stok dan tombol aksi.
   - **Update:** Edit detail produk & tombol penyesuaian stok cepat (`+` / `-`).
   - **Delete:** Hapus menu dengan konfirmasi modal.
7. **Unggah Foto Lokal & Kompresi Otomatis:** Input file gambar (drag-and-drop atau pilih dari perangkat) yang otomatis di-resize & dikompres via HTML5 Canvas, dengan *fallback* ilustrasi SVG lokal bebas hak cipta berdasarkan kategori.
8. **Ringkasan Total & Penyimpanan `localStorage`:** 4 kartu metrik (Total Produk, Total Stok Porsi, Rincian Kategori Aktif, Jumlah Menu Unggulan) dan persistensi data otomatis di browser.

## 4. Data Model (`Product`)
Struktur data objek produk (`Item`) yang disimpan dalam format JSON:
```json
{
  "id": "string (unik, cth: prod-1735680000000)",
  "nama": "string (wajib, min 1 karakter)",
  "kategori": "string (wajib: Bakso | Mie Ayam | Paket Hemat | Topping & Ekstra | Minuman)",
  "harga": "number (wajib, angka >= 0)",
  "stok": "integer (wajib, integer >= 0)",
  "deskripsi": "string (wajib)",
  "imageUrl": "string (data URI foto hasil upload atau ilustrasi SVG lokal)",
  "unggulan": "boolean (true jika menu unggulan, false jika biasa)"
}
```

## 5. Non-Functional Requirements (NFR)
- **Kinerja (Performance):** Waktu muat awal di bawah 1 detik karena berjalan dalam *single HTML file* dengan dependensi CDN ringan (Tailwind CSS, Lucide Icons, Google Fonts).
- **Responsif (Responsiveness):** Antarmuka seluler yang ramah pengguna (*mobile-first*) dengan tata letak grid fleksibel untuk tablet dan desktop.
- **Keandalan Data (Persistence):** Menggunakan `localStorage` browser sehingga data tidak hilang saat halaman direfresh.
- **Kompatibilitas:** Berjalan di semua peramban modern (Chrome, Safari, Firefox, Edge).

## 6. Risiko & Mitigasi
- **Risiko:** Penyimpanan `localStorage` penuh akibat ukuran gambar yang diunggah terlalu besar.
  - **Mitigasi:** Penerapan kompresi otomatis menggunakan HTML5 Canvas dengan batasan lebar maksimal (maks 600px) dan kualitas kompresi JPEG 82%.
- **Risiko:** Data rusak akibat format JSON tidak valid.
  - **Mitigasi:** Mekanisme *try-catch* yang aman dengan *fallback* otomatis memuat data awal (`SEED_PRODUCTS`) jika penyimpanan lokal bermasalah.

## 7. Batasan (Out-of-Scope)
- Tidak menggunakan database eksternal / server backend (Node.js, PHP, Python).
- Tidak menggunakan autentikasi akun atau login palsu berbasis password.
- Tidak ada fitur pembayaran online *gateway* (murni transaksi langsung via WhatsApp).

## 8. Kriteria Penerimaan (Acceptance Criteria)
| No | Fitur / Skenario | Kriteria Pemeriksaan Manual | Status |
|----|------------------|-----------------------------|--------|
| 1 | Tampilan & Tema | Tema bistro kuliner hangat dengan palet merah cabai & amber terlihat kreatif, rapi, dan responsif. | Dapat Diperiksa |
| 2 | Data Awal | Memuat tepat 8 data produk contoh dengan ilustrasi SVG lokal bebas hak cipta saat pertama kali dibuka. | Dapat Diperiksa |
| 3 | Katalog & Filter | Tombol kategori (Bakso, Mie Ayam, dll), pencarian teks, dan sorting berfungsi dengan akurat. | Dapat Diperiksa |
| 4 | Tombol WhatsApp | Klik tombol "Pesan via WhatsApp" membuka aplikasi/web WhatsApp dengan teks pesan detail produk yang benar. | Dapat Diperiksa |
| 5 | Ganti No. WhatsApp | Pengelola dapat mengubah nomor WhatsApp toko di dashboard dan nomor tersebut langsung aktif pada tombol pesan katalog. | Dapat Diperiksa |
| 6 | Dashboard CRUD | Pengelola dapat menambah menu baru, mengedit data, dan menghapus menu dari tabel inventaris. | Dapat Diperiksa |
| 7 | Ubah Stok Cepat | Tombol `+` dan `-` pada tabel dashboard langsung menambah atau mengurangi stok porsi seketika. | Dapat Diperiksa |
| 8 | Upload Gambar | Pengguna dapat mengunggah foto dari perangkat yang otomatis terkompresi dan tampil di preview. | Dapat Diperiksa |
| 9 | Penyimpanan Lokal | Setelah melakukan perubahan data atau penambahan menu, data tetap ada saat halaman direfresh (`localStorage`). | Dapat Diperiksa |

## 10. Rencana Implementasi (Iterasi 1 Hari)
- **Sesi 1 (Pagi - 2 Jam):** Penyusunan struktur HTML dasar, integrasi Tailwind CSS, Google Fonts, Lucide Icons, serta penetapan palet tema bistro kuliner kreatif.
- **Sesi 2 (Pagi/Siang - 2 Jam):** Pembuatan pustaka SVG lokal bebas hak cipta, data *seed* 8 menu dengan 5 kategori, serta implementasi logika Katalog Pembeli (Pencarian, Filter, Sorting, Kartu Menu).
- **Sesi 3 (Siang/Sore - 2 Jam):** Pembuatan Dashboard Pengelola, kartu statistik (Total Produk, Stok, Kategori Aktif, Unggulan), dan tabel inventaris dengan tombol stok cepat.
- **Sesi 4 (Sore - 2 Jam):** Implementasi formulir CRUD lengkap, fitur unggah foto berbasis *HTML5 Canvas Compression*, konfigurasi nomor WhatsApp dinamis, dan persistensi `localStorage`.
- **Sesi 5 (Malam - 1 Jam):** Pengujian manual seluruh kriteria penerimaan, perbaikan *edge cases*, dan finalisasi dokumentasi.
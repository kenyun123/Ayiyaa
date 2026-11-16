const bcrypt = require('bcryptjs');
const pool = require('../src/db');

const DEMO_USERS = [
  { nama: 'Rina Kartika', email: 'admin@ayiyaaa.test', password: 'Admin#12345', role: 'admin' },
  { nama: 'Budi Santoso', email: 'seller@ayiyaaa.test', password: 'Seller#12345', role: 'seller' },
  { nama: 'Sari Wulandari', email: 'sari@ayiyaaa.test', password: 'Seller#12345', role: 'seller' },
  { nama: 'Dewi Lestari', email: 'pembeli@ayiyaaa.test', password: 'Pembeli#12345', role: 'buyer' }
];

const CATEGORIES = [
  { nama: 'Bakso', deskripsi: 'Bakso sapi urat, halus, dan beranak dengan kuah kaldu gurih.', urutan: 1 },
  { nama: 'Mie Ayam', deskripsi: 'Mie telur kenyal dengan racikan ayam jamur dan yamin.', urutan: 2 },
  { nama: 'Paket Hemat', deskripsi: 'Kombinasi menu plus minuman dengan harga lebih ramah.', urutan: 3 },
  { nama: 'Topping & Ekstra', deskripsi: 'Tambahan pangsit, tetelan, dan pelengkap porsi.', urutan: 4 },
  { nama: 'Minuman', deskripsi: 'Es teh, jeruk peras, dan minuman segar pendamping.', urutan: 5 }
];

const PRODUCTS = [
  {
    seller: 'seller@ayiyaaa.test',
    kategori: 'Bakso',
    nama: 'Bakso Urat Mercon',
    harga: 18000,
    stok: 16,
    deskripsi: 'Bakso urat sapi asli ukuran besar dengan isian sambal rawit domba pedas nampol dan kuah kaldu gurih.',
    imageUrl: '/img/menu/bakso.svg',
    unggulan: true
  },
  {
    seller: 'seller@ayiyaaa.test',
    kategori: 'Bakso',
    nama: 'Bakso Beranak Jumbo',
    harga: 25000,
    stok: 9,
    deskripsi: 'Bakso super jumbo berisi anakan bakso halus, telur puyuh, tetelan sapi, dan lelehan keju gurih.',
    imageUrl: '/img/menu/bakso.svg',
    unggulan: true
  },
  {
    seller: 'sari@ayiyaaa.test',
    kategori: 'Mie Ayam',
    nama: 'Mie Ayam Jamur Ceker',
    harga: 17000,
    stok: 20,
    deskripsi: 'Mie telur kenyal racikan sendiri dengan topping ayam jamur kecap manis gurih dan 3 ceker lunak.',
    imageUrl: '/img/menu/mie-ayam.svg',
    unggulan: true
  },
  {
    seller: 'sari@ayiyaaa.test',
    kategori: 'Mie Ayam',
    nama: 'Mie Ayam Yamin Pedas',
    harga: 16000,
    stok: 18,
    deskripsi: 'Mie yamin racikan kecap manis khas bistro dengan sambal bawang pedas, ayam cincang, dan pangsit rebus.',
    imageUrl: '/img/menu/mie-ayam.svg',
    unggulan: false
  },
  {
    seller: 'seller@ayiyaaa.test',
    kategori: 'Paket Hemat',
    nama: 'Paket Komplit Bakso + Es Teh',
    harga: 20000,
    stok: 14,
    deskripsi: 'Paket hemat mengenyangkan: 1 porsi Bakso Halus Komplit (5 butir + tahu) gratis 1 Es Teh Manis Jumbo.',
    imageUrl: '/img/menu/paket-hemat.svg',
    unggulan: true
  },
  {
    seller: 'seller@ayiyaaa.test',
    kategori: 'Topping & Ekstra',
    nama: 'Tetelan & Pangsit Goreng',
    harga: 9000,
    stok: 0,
    deskripsi: 'Porsi ekstra tetelan daging sapi empuk gurih ditambah 3 pcs pangsit goreng kriuk dengan saus sambal.',
    imageUrl: '/img/menu/topping.svg',
    unggulan: false
  },
  {
    seller: 'sari@ayiyaaa.test',
    kategori: 'Minuman',
    nama: 'Es Teh Manis Jumbo',
    harga: 5000,
    stok: 40,
    deskripsi: 'Teh melati seduh segar dengan gula pasir murni dan es batu kristal dalam gelas ukuran jumbo.',
    imageUrl: '/img/menu/minuman.svg',
    unggulan: false
  },
  {
    seller: 'sari@ayiyaaa.test',
    kategori: 'Minuman',
    nama: 'Es Jeruk Peras Segar',
    harga: 7000,
    stok: 28,
    deskripsi: 'Perasan jeruk pontianak asli kaya vitamin C dengan es batu segar, cocok penetral rasa pedas bakso.',
    imageUrl: '/img/menu/minuman.svg',
    unggulan: false
  }
];

async function main() {
  const userIds = new Map();

  for (const user of DEMO_USERS) {
    const hash = await bcrypt.hash(user.password, 12);
    await pool.query(
      `INSERT INTO users (nama, email, password_hash, role, is_active)
       VALUES (?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE nama = VALUES(nama), role = VALUES(role),
         password_hash = VALUES(password_hash), is_active = 1`,
      [user.nama, user.email, hash, user.role]
    );
    const [[row]] = await pool.query('SELECT id FROM users WHERE email = ?', [user.email]);
    userIds.set(user.email, row.id);
  }

  const categoryIds = new Map();
  for (const category of CATEGORIES) {
    await pool.query(
      `INSERT INTO categories (nama, deskripsi, urutan)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE deskripsi = VALUES(deskripsi), urutan = VALUES(urutan)`,
      [category.nama, category.deskripsi, category.urutan]
    );
    const [[row]] = await pool.query('SELECT id FROM categories WHERE nama = ?', [category.nama]);
    categoryIds.set(category.nama, row.id);
  }

  await pool.query(
    `INSERT INTO store_settings (id, nama_toko, whatsapp_number, jam_buka)
     VALUES (1, 'Ayiyaaa Street Bistro', '6281234567890', 'Buka Setiap Hari • 10.00 - 21.00 WIB')
     ON DUPLICATE KEY UPDATE nama_toko = VALUES(nama_toko)`
  );

  const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM products');
  if (Number(total) === 0) {
    for (const product of PRODUCTS) {
      await pool.query(
        `INSERT INTO products (seller_id, category_id, nama, harga, stok, deskripsi, image_url, unggulan, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          userIds.get(product.seller),
          categoryIds.get(product.kategori),
          product.nama,
          product.harga,
          product.stok,
          product.deskripsi,
          product.imageUrl,
          product.unggulan ? 1 : 0
        ]
      );
    }
    console.log(`${PRODUCTS.length} produk contoh ditambahkan.`);
  } else {
    console.log('Tabel produk sudah berisi data, seed produk dilewati.');
  }

  console.log('Seed selesai. Akun demo:');
  for (const user of DEMO_USERS) {
    console.log(`  - ${user.role.padEnd(6)} | ${user.email} | ${user.password}`);
  }
  await pool.end();
}

main().catch(async (err) => {
  console.error('Seed gagal:', err.message);
  await pool.end().catch(() => {});
  process.exit(1);
});

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const config = require('../src/config');

const DB_NAME = config.db.database;
const fresh = process.argv.includes('--fresh');

if (!/^[A-Za-z0-9_]+$/.test(DB_NAME)) {
  console.error('Nama database tidak valid:', DB_NAME);
  process.exit(1);
}

async function main() {
  const conn = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    multipleStatements: true
  });

  if (fresh) {
    console.log(`Menghapus database "${DB_NAME}"...`);
    await conn.query(`DROP DATABASE IF EXISTS \`${DB_NAME}\``);
  }

  await conn.query(
    `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`
     CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await conn.query(`USE \`${DB_NAME}\``);

  const schema = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
  await conn.query(schema);

  // Migrasi tambahan untuk database yang sudah ada sebelum kolom telepon ditambahkan.
  const [cols] = await conn.query(
    "SELECT COUNT(*) AS total FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'telepon'",
    [DB_NAME]
  );
  if (Number(cols[0].total) === 0) {
    await conn.query("ALTER TABLE users ADD COLUMN telepon VARCHAR(30) NOT NULL DEFAULT '' AFTER email");
  }

  const [approvalCols] = await conn.query(
    "SELECT COUNT(*) AS total FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'approval_status'",
    [DB_NAME]
  );
  if (Number(approvalCols[0].total) === 0) {
    await conn.query("ALTER TABLE users ADD COLUMN approval_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'approved' AFTER is_active");
  }

  console.log(`Migrasi selesai. Database "${DB_NAME}" siap.`);
  await conn.end();
}

main().catch((err) => {
  console.error('Migrasi gagal:', err.message);
  process.exit(1);
});

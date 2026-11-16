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

  console.log(`Migrasi selesai. Database "${DB_NAME}" siap.`);
  await conn.end();
}

main().catch((err) => {
  console.error('Migrasi gagal:', err.message);
  process.exit(1);
});

const path = require('path');
const express = require('express');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const multer = require('multer');
const mysql = require('mysql2');

const config = require('./src/config');
const pool = require('./src/db');
const { loadUser, pageGuard } = require('./src/middleware/auth');
const { ApiError } = require('./src/utils');

const authRoutes = require('./src/routes/auth');
const catalogRoutes = require('./src/routes/catalog');
const productRoutes = require('./src/routes/products');
const categoryRoutes = require('./src/routes/categories');
const userRoutes = require('./src/routes/users');
const settingsRoutes = require('./src/routes/settings');
const uploadRoutes = require('./src/routes/uploads');

const app = express();
const publicDir = path.join(__dirname, 'public');

if (config.isProduction) app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

const sessionPool = mysql.createPool({ ...config.db, connectionLimit: 4 });
const sessionStore = new MySQLStore(
  {
    createDatabaseTable: true,
    clearExpired: true,
    checkExpirationInterval: 15 * 60 * 1000,
    expiration: 7 * 24 * 60 * 60 * 1000,
    schema: {
      tableName: 'sessions',
      columnNames: { session_id: 'session_id', expires: 'expires', data: 'data' }
    }
  },
  sessionPool
);

app.use(
  session({
    name: 'ayiyaaa.sid',
    secret: config.sessionSecret,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.isProduction,
      maxAge: 7 * 24 * 60 * 60 * 1000
    }
  })
);

app.use(loadUser);

// API
app.use('/api/auth', authRoutes);
app.use('/api', catalogRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/users', userRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/uploads', uploadRoutes);

app.use('/api', (req, res) => {
  res.status(404).json({ message: 'Endpoint tidak ditemukan.' });
});

// Halaman yang butuh role tertentu (didaftarkan sebelum static).
app.get('/dashboard.html', pageGuard('seller', 'admin'), (req, res) => {
  res.sendFile(path.join(publicDir, 'dashboard.html'));
});
app.get('/admin.html', pageGuard('admin'), (req, res) => {
  res.sendFile(path.join(publicDir, 'admin.html'));
});
app.get('/buyer.html', pageGuard('buyer'), (req, res) => {
  res.sendFile(path.join(publicDir, 'buyer.html'));
});

app.use(
  express.static(publicDir, {
    maxAge: config.isProduction ? '1h' : 0,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-store');
    }
  })
);

app.use((req, res) => {
  res.status(404).sendFile(path.join(publicDir, '404.html'));
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'Ukuran gambar maksimal 3MB.'
        : 'Gagal mengunggah gambar. Coba lagi.';
    return res.status(400).json({ message });
  }

  if (err instanceof ApiError) {
    return res.status(err.status).json({ message: err.message });
  }

  if (err && err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ message: 'Data sudah ada. Gunakan nilai yang berbeda.' });
  }

  console.error('[server] Unhandled error:', err);
  return res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
});

const server = app.listen(config.port, () => {
  console.log(`Ayiyaaa berjalan di http://localhost:${config.port} (${config.nodeEnv})`);
});

async function shutdown(signal) {
  console.log(`\n${signal} diterima, menutup server...`);
  server.close(async () => {
    try {
      await pool.end();
      sessionPool.end();
    } finally {
      process.exit(0);
    }
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

module.exports = app;

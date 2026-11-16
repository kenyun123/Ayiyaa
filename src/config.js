require('dotenv').config();

const env = process.env;

module.exports = {
  port: Number(env.PORT) || 3000,
  nodeEnv: env.NODE_ENV || 'development',
  isProduction: env.NODE_ENV === 'production',
  sessionSecret: env.SESSION_SECRET || 'ayiyaaa-insecure-dev-secret',
  db: {
    host: env.DB_HOST || '127.0.0.1',
    port: Number(env.DB_PORT) || 3306,
    user: env.DB_USER || 'root',
    password: env.DB_PASSWORD || '',
    database: env.DB_NAME || 'ayiyaaa'
  }
};

const { Pool } = require('pg');
require('dotenv').config();

let pool = null;

function hasDbConfig() {
  return Boolean(
    process.env.DB_HOST &&
    process.env.DB_PORT &&
    process.env.DB_NAME &&
    process.env.DB_USER &&
    process.env.DB_PASSWORD
  );
}

function getPool() {
  if (!hasDbConfig()) return null;
  if (!pool) {
    pool = new Pool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 5432),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: false
    });
  }
  return pool;
}

module.exports = { getPool, hasDbConfig };

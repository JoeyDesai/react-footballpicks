// Game dates and week start dates are stored as Eastern wall-clock times in
// "timestamp without time zone" columns. Queries that return them convert
// with AT TIME ZONE 'America/New_York' so Postgres sends a real instant;
// relying on the Node process zone failed on the Docker deploy (times showed
// 5h early). The pin below stays as a fallback for any unconverted query.
process.env.TZ = 'America/New_York';

const { Pool } = require('pg');
const config = require('./app');

// Database configuration - uses centralized config
const dbConfig = {
  user: config.database.user,
  host: config.database.host,
  database: config.database.database,
  password: config.database.password,
  port: config.database.port,
  ssl: config.database.ssl
};

// Create connection pool
const pool = new Pool(dbConfig);

// Test connection
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('PostgreSQL connection error:', err);
  process.exit(-1);
});

module.exports = pool;

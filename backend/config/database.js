// Game dates and week start dates are stored as Eastern wall-clock times in
// "timestamp without time zone" columns. node-pg parses those in the Node
// process's local zone, so pin it to Eastern; otherwise a UTC server sends
// an 8:15 PM ET kickoff to the browser as 8:15 PM UTC (4:15 PM ET).
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

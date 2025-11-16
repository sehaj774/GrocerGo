const { Pool } = require('pg');

// // --- TEMPORARY DEBUG CODE ---
// console.log('--- Checking PostgreSQL ENV Variables ---');
// console.log('User:', process.env.PG_USER);
// console.log('Host:', process.env.PG_HOST);
// console.log('Database:', process.env.PG_DATABASE);
// console.log('Password:', process.env.PG_PASSWORD);
// console.log('Port:', process.env.PG_PORT);
// console.log('------------------------------------');
// // --- END DEBUG CODE ---

const pool = new Pool({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
});

pool.on('connect', () => {
  console.log('PostgreSQL Connected...');
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};
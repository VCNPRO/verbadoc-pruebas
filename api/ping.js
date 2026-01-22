const { sql } = require('@vercel/postgres');

module.exports = async function handler(req, res) {
  let dbStatus = 'NOT TESTED';

  try {
    const result = await sql`SELECT COUNT(*) as count FROM users`;
    dbStatus = 'CONNECTED - ' + result.rows[0].count + ' users';
  } catch (error) {
    dbStatus = 'ERROR: ' + error.message;
  }

  return res.status(200).json({
    status: 'pong',
    db: dbStatus,
    env: {
      POSTGRES_URL: process.env.POSTGRES_URL ? 'SET' : 'NOT SET',
      JWT_SECRET: process.env.JWT_SECRET ? 'SET' : 'NOT SET',
    }
  });
}

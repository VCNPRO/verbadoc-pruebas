const { sql } = require('@vercel/postgres');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const result = await sql`
      SELECT id, filename, validation_status, created_at
      FROM extraction_results
      ORDER BY created_at DESC
      LIMIT 5
    `;

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      extractions: result.rows
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

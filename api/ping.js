// Super simple ping endpoint
module.exports = (req, res) => {
  res.json({
    status: 'ok',
    POSTGRES_URL: process.env.POSTGRES_URL ? 'SET' : 'NOT SET',
    timestamp: new Date().toISOString()
  });
};

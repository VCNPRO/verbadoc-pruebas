export default function handler(req, res) {
  return res.status(200).json({
    status: 'pong',
    env: {
      POSTGRES_URL: process.env.POSTGRES_URL ? 'SET (' + process.env.POSTGRES_URL.substring(0, 30) + '...)' : 'NOT SET',
      JWT_SECRET: process.env.JWT_SECRET ? 'SET (' + process.env.JWT_SECRET.length + ' chars)' : 'NOT SET',
      GOOGLE_CLOUD_PROJECT: process.env.GOOGLE_CLOUD_PROJECT || 'NOT SET',
      BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN ? 'SET' : 'NOT SET',
    }
  });
}

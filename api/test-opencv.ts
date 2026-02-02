import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = process.env.OPENCV_SERVICE_URL || 'NOT_SET';
  const testUrl = `${url}/health`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const resp = await fetch(testUrl, { signal: controller.signal });
    clearTimeout(timeout);

    const body = await resp.text();
    return res.status(200).json({
      opencv_url: url,
      test_url: testUrl,
      status: resp.status,
      response: body,
    });
  } catch (err: any) {
    return res.status(200).json({
      opencv_url: url,
      test_url: testUrl,
      error: err.message,
      cause: err.cause?.message || 'none',
      code: err.cause?.code || 'none',
    });
  }
}

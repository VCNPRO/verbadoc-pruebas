import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, email, displayName, department } = req.body;
    if (!userId || !email || !displayName || !department) {
      return res.status(400).json({ error: 'Missing user information' });
    }

    const initialQuota = 100; // Set an initial quota for new users

    await kv.hset('users', { [userId]: { email, displayName, department, quota: initialQuota } });

    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to register user' });
  }
}

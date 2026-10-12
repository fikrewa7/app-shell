import { completeMultipartUpload } from '@vercel/blob';

const BLOB_READ_WRITE_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const API_SECRET_KEY = process.env.API_SECRET_KEY;

export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization || '';
  const clientKey = authHeader.replace('Bearer ', '');
  if (!clientKey || clientKey !== API_SECRET_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { multipartUploadId, parts } = req.body || {};
  if (!multipartUploadId || !Array.isArray(parts)) {
    return res.status(400).json({ error: 'multipartUploadId and parts required' });
  }

  try {
    const result = await completeMultipartUpload(
      multipartUploadId,
      parts,
      { token: BLOB_READ_WRITE_TOKEN }
    );
    return res.status(200).json(result);
  } catch (err) {
    console.error('multipart-complete error:', err);
    return res.status(500).json({ error: err.message });
  }
}

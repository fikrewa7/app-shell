import { createMultipartUpload } from '@vercel/blob';

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

  const { filename, contentType, category } = req.body || {};
  if (!filename || !contentType) {
    return res.status(400).json({ error: 'filename and contentType required' });
  }

  const pathname = `uploads/${category || 'videos'}/${filename}`;

  try {
    const multipart = await createMultipartUpload(
      pathname,
      {
        access: 'public',
        contentType,
        token: BLOB_READ_WRITE_TOKEN,
      }
    );
    return res.status(200).json({ uploadId: multipart.uploadId });
  } catch (err) {
    console.error('multipart-start error:', err);
    return res.status(500).json({ error: err.message });
  }
}

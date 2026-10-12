import { uploadPart } from '@vercel/blob';
import { IncomingForm } from 'formidable';
import fs from 'fs';

const BLOB_READ_WRITE_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const API_SECRET_KEY = process.env.API_SECRET_KEY;

export const config = { api: { bodyParser: false } };

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

  const form = new IncomingForm();
  try {
    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    let file = files.chunk;
    if (Array.isArray(file)) file = file[0];
    if (!file) return res.status(400).json({ error: 'No chunk provided' });

    const multipartUploadId = fields.multipartUploadId;
    const partNumber = parseInt(fields.partNumber, 10);
    const buffer = fs.readFileSync(file.filepath);

    // ✅ Correct: only token, no access
    const part = await uploadPart(
      multipartUploadId,
      partNumber,
      buffer,
      { token: BLOB_READ_WRITE_TOKEN }
    );

    return res.status(200).json({ etag: part.etag });
  } catch (err) {
    console.error('multipart-upload-part error:', err);
    return res.status(500).json({ error: err.message });
  }
}

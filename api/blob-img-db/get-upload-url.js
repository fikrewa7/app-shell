import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const BLOB_READ_WRITE_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const API_SECRET_KEY = process.env.API_SECRET_KEY;
const BLOB_ENDPOINT = 'https://blob.vercel-storage.com';

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

  // S3 client configured for Vercel Blob
  const client = new S3Client({
    region: 'auto',
    endpoint: BLOB_ENDPOINT,
    credentials: {
      accessKeyId: BLOB_READ_WRITE_TOKEN,
      secretAccessKey: BLOB_READ_WRITE_TOKEN, // Vercel Blob token acts as both
    },
    forcePathStyle: true,
  });

  const command = new PutObjectCommand({
    Bucket: 'blob',          // fixed bucket name for Vercel Blob
    Key: pathname,
    ContentType: contentType,
    ACL: 'public-read',      // make the object public
  });

  try {
    const uploadUrl = await getSignedUrl(client, command, { expiresIn: 3600 });
    return res.status(200).json({ uploadUrl, pathname });
  } catch (error) {
    console.error('Presign error:', error);
    return res.status(500).json({ error: error.message });
  }
}

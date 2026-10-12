import { put, list, del } from '@vercel/blob';
import { IncomingForm } from 'formidable';
import fs from 'fs';
import crypto from 'crypto';

const BLOB_READ_WRITE_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const BLOB_STORE_ID = process.env.BLOB_STORE_ID || '';
const API_SECRET_KEY = process.env.API_SECRET_KEY;

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // ---------- AUTHENTICATION ----------
  const authHeader = req.headers.authorization || '';
  const clientKey = authHeader.replace('Bearer ', '');
  
  if (!clientKey || clientKey !== API_SECRET_KEY) {
    return res.status(401).json({ error: 'Unauthorized: Invalid API key' });
  }
  
  // ---------- POST: Upload a file ----------
  if (req.method === 'POST') {
    const form = new IncomingForm();
    
    try {
      const { fields, files } = await new Promise((resolve, reject) => {
        form.parse(req, (err, fields, files) => {
          if (err) reject(err);
          else resolve({ fields, files });
        });
      });
      
      let file = files.image;
      if (Array.isArray(file)) file = file[0];
      if (!file) throw new Error('No image file provided (field "image")');
      
      const lastModified = req.query.lastModified || fields.lastModified || Date.now();
      
      // Determine folder
      let folder = '';
      const customFolder = req.query.folder;
      const category = req.query.category;
      
      if (customFolder) {
        folder = customFolder + '/';
      } else if (category) {
        folder = `uploads/${category}/`;
      } else {
        folder = 'uploads/';
      }
      
      // Filename
      let filename = file.originalFilename || file.name || file.filename;
      if (!filename) {
        const ext = file.mimetype ? file.mimetype.split('/')[1] : 'png';
        filename = `${crypto.randomUUID()}.${ext}`;
      }
      const pathname = folder + filename;
      
      const buffer = fs.readFileSync(file.filepath);
      const blob = await put(pathname, buffer, {
        access: 'public',
        contentType: file.mimetype || 'application/octet-stream',
        token: BLOB_READ_WRITE_TOKEN,
        addRandomSuffix: false,
        metadata: {
          lastModified: String(lastModified),
        },
      });
      
      return res.status(200).json(blob);
    } catch (error) {
      console.error('Upload error:', error);
      return res.status(500).json({ error: error.message || 'Upload failed' });
    }
  }
  
  // ---------- GET: List all blobs ----------
  if (req.method === 'GET') {
    try {
      const result = await list({ token: BLOB_READ_WRITE_TOKEN });
      
      const blobsWithMeta = result.blobs.map(blob => {
        let lastModified = blob.uploadedAt; // fallback
        
        if (blob.metadata?.lastModified) {
          lastModified = Number(blob.metadata.lastModified);
        } else {
          // Try to parse date from folder structure
          const parts = blob.pathname.split('/').filter(p => p.length > 0);
          if (parts.length >= 4) {
            const year = parseInt(parts[parts.length - 4], 10);
            const month = parseInt(parts[parts.length - 3], 10);
            const day = parseInt(parts[parts.length - 2], 10);
            if (!isNaN(year) && !isNaN(month) && !isNaN(day) &&
              month >= 1 && month <= 12 && day >= 1 && day <= 31) {
              const parsed = new Date(year, month - 1, day).getTime();
              if (!isNaN(parsed)) {
                lastModified = parsed;
              }
            }
          }
        }
        
        return { ...blob, lastModified };
      });
      
      return res.status(200).json({
        blobs: blobsWithMeta,
        storeId: BLOB_STORE_ID,
      });
    } catch (error) {
      console.error('List error:', error);
      return res.status(500).json({ error: error.message });
    }
  }
  
  // ---------- DELETE: Remove a blob (pathname from query parameter) ----------
  if (req.method === 'DELETE') {
    try {
      const { pathname } = req.query;
      
      if (!pathname) {
        return res.status(400).json({ error: 'Missing pathname query parameter' });
      }
      
      await del(pathname, { token: BLOB_READ_WRITE_TOKEN });
      return res.status(200).json({ success: true, pathname });
    } catch (error) {
      console.error('Delete error:', error);
      return res.status(500).json({ error: error.message });
    }
  }
  
  // ---------- Method not allowed ----------
  res.setHeader('Allow', ['GET', 'POST', 'DELETE', 'OPTIONS']);
  return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
}

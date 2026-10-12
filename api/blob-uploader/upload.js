import { put } from '@vercel/blob';

const TOKEN = "vercel_blob_rw_Gk9GPvdVvphlILt6_XVlPuoRJdeLPvS73Roqhx3c5KCIfye"; 

export async function POST(request) {
  const { searchParams } = new URL(request.url);
  const filename = searchParams.get("filename");
  const folder = searchParams.get("folder"); // New parameter

  if (!filename) {
    return Response.json({ error: "Missing filename" }, { status: 400 });
  }

  // Prepare the full path. If a folder is provided, put a slash between it and the filename.
  const cleanFolder = folder ? folder.replace(/^\/|\/$/g, '') : ''; // Remove leading/trailing slashes
  const fullPath = cleanFolder ? `${cleanFolder}/${filename}` : filename;

  try {
    const blob = await put(fullPath, request.body, { // Use fullPath instead of filename
      access: 'public',
      token: TOKEN,
    });
    return Response.json({ pathname: blob.pathname });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

import { del } from '@vercel/blob';

// Use the exact same token you used in upload.js, view.js, and list.js
const TOKEN = "vercel_blob_rw_Gk9GPvdVvphlILt6_XVlPuoRJdeLPvS73Roqhx3c5KCIfye"; 

export async function DELETE(request) {
  const { searchParams } = new URL(request.url);
  const pathname = searchParams.get("pathname");

  if (!pathname) {
    return Response.json({ error: "Missing pathname" }, { status: 400 });
  }

  try {
    // Delete the blob by its pathname
    await del(pathname, {
      token: TOKEN,
    });

    return Response.json({ success: true, message: "File deleted successfully" });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

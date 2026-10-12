import { get } from '@vercel/blob';

// 👇 Use exactly the same token as in list.js
const TOKEN = "vercel_blob_rw_Gk9GPvdVvphlILt6_XVlPuoRJdeLPvS73Roqhx3c5KCIfye";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const pathname = searchParams.get("pathname");
  const cb = searchParams.get("cb"); // cache buster, optional

  if (!pathname) {
    return new Response("Missing pathname", { status: 400 });
  }

  try {
    const result = await get(pathname, {
      token: TOKEN,
      // If your files are public, no 'access' needed.
      // If they are private, uncomment the line below:
      // access: 'private',
    });

    if (!result) {
      return new Response("File not found", { status: 404 });
    }

    // Stream the file
    return new Response(result.stream, {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Type": result.blob.contentType,
      },
    });
  } catch (error) {
    // Return error as plain text so it shows in the image placeholder
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}

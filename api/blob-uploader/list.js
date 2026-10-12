import { list } from '@vercel/blob';

// 👇 PASTE YOUR EXACT SAME TOKEN HERE
const TOKEN = "vercel_blob_rw_Gk9GPvdVvphlILt6_XVlPuoRJdeLPvS73Roqhx3c5KCIfye"; 

export async function GET(request) {
  try {
    const { blobs, cursor } = await list({
      token: TOKEN,
    });

    return Response.json({ blobs, cursor });
  } catch (error) {
    // Return a clean JSON error so the frontend toast shows the real reason
    return Response.json({ 
      error: error.message || "Unknown error occurred in /api/list" 
    }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    return Response.json({
      success: true,
      imageLength: body.image?.length || 0,
      mimeType: body.mimeType || null
    });
  } catch (error) {
    return Response.json(
      { success: false },
      { status: 500 }
    );
  }
}
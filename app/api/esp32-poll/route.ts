import { supabaseAdmin } from "@/lib/supabase-server";

export async function GET() {
  try {
    // Atomically claim the latest unclaimed, non-expired row.
    // The UPDATE ... WHERE claimed_at IS NULL pattern ensures only one
    // concurrent poll can claim a given row.
    const { data, error } = await supabaseAdmin
      .from("esp32_captures")
      .update({ claimed_at: new Date().toISOString() })
      .is("claimed_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .select()
      .single();

    if (error || !data) {
      return Response.json({ status: "waiting" });
    }

    return Response.json({
      status:      "ready",
      id:          data.id,
      ocrResult:   data.ocr_result,
      imageBase64: data.image_base64,
      mimeType:    data.mime_type,
    });
  } catch (error) {
    console.error("[esp32-poll] error:", error);
    return Response.json({ status: "waiting" });
  }
}

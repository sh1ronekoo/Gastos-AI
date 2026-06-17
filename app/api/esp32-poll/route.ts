import { supabaseAdmin } from "@/lib/supabase-server";

export async function GET() {
  try {
    const nowIso = new Date().toISOString();

    // 1. Find the latest unclaimed, non-expired capture.
    const { data: rows, error: selErr } = await supabaseAdmin
      .from("esp32_captures")
      .select("id, ocr_result, image_base64, mime_type")
      .is("claimed_at", null)
      .gt("expires_at", nowIso)
      .order("created_at", { ascending: false })
      .limit(1);

    if (selErr) {
      console.error("[esp32-poll] select error:", selErr);
      return Response.json({ status: "waiting" });
    }

    const row = rows?.[0];
    if (!row) return Response.json({ status: "waiting" });

    // 2. Claim it by id (guard against a concurrent poll claiming the same row).
    const { data: claimed, error: claimErr } = await supabaseAdmin
      .from("esp32_captures")
      .update({ claimed_at: nowIso })
      .eq("id", row.id)
      .is("claimed_at", null)
      .select("id")
      .maybeSingle();

    // Another poll grabbed it first — tell the client to keep waiting.
    if (claimErr || !claimed) return Response.json({ status: "waiting" });

    return Response.json({
      status:      "ready",
      id:          row.id,
      ocrResult:   row.ocr_result,
      imageBase64: row.image_base64,
      mimeType:    row.mime_type,
    });
  } catch (error) {
    console.error("[esp32-poll] error:", error);
    return Response.json({ status: "waiting" });
  }
}

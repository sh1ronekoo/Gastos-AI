export async function GET() {
  return Response.json({
    status: "connected",
    device: "ESP32-CAM"
  });
}
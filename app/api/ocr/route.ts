import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const MODELS = [
  "models/gemini-3.1-flash-lite",
  "models/gemini-3.0-flash",
  "models/gemini-2.5-flash",
];

const VALID_CATEGORIES = ["Food", "Transport", "Utilities", "Shopping", "Health", "Other"];

async function runOCR(modelName: string, base64Image: string, mimeType: string) {
  const model = genAI.getGenerativeModel({ model: modelName });

  const prompt = `You are an OCR assistant for a Filipino expense tracker app.

Analyze this receipt image and extract the following information.
Respond ONLY with a valid JSON object. No markdown, no backticks, no explanation.

Required shape:
{
  "merchant": "store or restaurant name, or null if not found",
  "date": "date on receipt in YYYY-MM-DD format, or null if not found",
  "amount": <total amount as a number in PHP, or null if not found>,
  "category": "one of: Food, Transport, Utilities, Shopping, Health, Other",
  "items": ["list of line items if visible, otherwise empty array"],
  "raw_text": "all readable text found on the receipt as a single string",
  "confidence": <integer 0-100 indicating how confident you are in the extraction>
}

Category rules:
- Food: restaurants, groceries, food delivery, cafes, fast food
- Transport: gas stations, Grab, taxi, toll, parking, bus, LRT
- Utilities: electricity, water, internet, phone bills, Meralco, PLDT
- Shopping: malls, clothing, electronics, department stores
- Health: pharmacy, hospital, clinic, drugstore, Mercury Drug, Watsons
- Other: anything that doesn't fit above

If this is not a receipt, still return valid JSON with all fields as null and confidence: 0.`;

  const result = await model.generateContent([
    { inlineData: { mimeType, data: base64Image } },
    { text: prompt },
  ]);

  const text = result.response.text();

  const clean = text
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
    .replace(/```json|```/gi, "")
    .trim();

  const jsonMatch = clean.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in OCR response");

  const parsed = JSON.parse(jsonMatch[0]);

  if (!VALID_CATEGORIES.includes(parsed.category)) {
    parsed.category = "Other";
  }

  return parsed;
}

export async function POST(req: Request) {
  try {
    const { image, mimeType = "image/jpeg" } = await req.json();

    if (!image) {
      return Response.json({ error: "No image provided" }, { status: 400 });
    }

    let lastError: any;

    for (const modelName of MODELS) {
      try {
        const result = await runOCR(modelName, image, mimeType);
        return Response.json({ ...result, modelUsed: modelName });
      } catch (err: any) {
        lastError = err;
        if (err?.status === 503 || err?.status === 429) continue;
        if (err instanceof SyntaxError) continue;
        throw err;
      }
    }

    throw lastError;
  } catch (error: any) {
    console.error("OCR API error:", error);
    return Response.json(
      { error: "OCR service is temporarily unavailable." },
      { status: 500 }
    );
  }
}
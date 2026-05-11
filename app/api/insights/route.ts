import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const MODELS = [
  "models/gemini-3.1-flash-lite",
  "models/gemini-3.0-flash",
  "models/gemini-2.5-flash",
];

async function runInsights(modelName: string, expenses: any[], budget: string) {
  const model = genAI.getGenerativeModel({ model: modelName });

  const totalSpent = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const budgetNum = Number(budget);
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const dailyAvg = dayOfMonth > 0 ? totalSpent / dayOfMonth : 0;
  const projectedRaw = dailyAvg * daysInMonth;

  const prompt = `
You are a financial AI assistant for a Filipino expense tracker app.

The user has the following expenses this month:
${JSON.stringify(expenses, null, 2)}

Monthly budget: ₱${budgetNum}
Total spent so far: ₱${totalSpent}
Day ${dayOfMonth} of ${daysInMonth} in the month.
Estimated daily average: ₱${dailyAvg.toFixed(2)}
Raw projected month-end: ₱${projectedRaw.toFixed(2)}

Respond ONLY with a valid JSON object. No markdown, no backticks, no explanation, no thinking output.

Required shape:
{
  "summary": "2-3 sentence plain-language summary of spending so far",
  "prediction": "1-2 sentence forecast of where they'll end up by month-end",
  "advice": "1 specific actionable tip to save money or stay on budget",
  "topCategory": "the single category name with the highest spending",
  "projectedMonthEnd": <number>,
  "overspendRisk": <integer 0-100>,
  "suggestedWeeklyCap": <number>
}

Rules:
- projectedMonthEnd, overspendRisk, suggestedWeeklyCap must be plain numbers, never strings.
- suggestedWeeklyCap = remaining budget divided by remaining weeks in month.
- overspendRisk: 0 if well under budget, scales to 100 if already over.
- If no expenses, return zeroes and friendly placeholder text.
- Use ₱ context, practical advice for everyday Filipino spending.
`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  // Robust parsing: strip thinking tags, fences, then extract JSON object
  const clean = text
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
    .replace(/```json|```/gi, "")
    .trim();

  const jsonMatch = clean.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`No JSON found in model response: ${clean.slice(0, 200)}`);

  return JSON.parse(jsonMatch[0]);
}

export async function POST(req: Request) {
  try {
    const { expenses = [], budget = "10000" } = await req.json();

    let lastError: any;

    for (const modelName of MODELS) {
      try {
        const insights = await runInsights(modelName, expenses, budget);
        return Response.json({ ...insights, modelUsed: modelName });
      } catch (err: any) {
        lastError = err;
        // Retry on rate limit or overload; throw immediately on bad requests
        if (err?.status === 503 || err?.status === 429) continue;
        // Also retry on JSON parse errors (model glitched) up to next model
        if (err instanceof SyntaxError) continue;
        throw err;
      }
    }

    throw lastError;
  } catch (error: any) {
    console.error("Insights API error:", error);
    return Response.json(
      { error: "Insights service is temporarily unavailable." },
      { status: 500 }
    );
  }
}
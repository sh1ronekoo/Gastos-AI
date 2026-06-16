// app/api/chat/route.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabaseAdmin } from "@/lib/supabase-server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const MODELS = [
  "models/gemini-3.1-flash-lite",
  "models/gemini-3.0-flash",
  "models/gemini-2.5-flash",
];

function buildSystemPrompt(expenses: any[], budget: string): string {
  const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  const byCategory = expenses.reduce((acc: Record<string, number>, e) => {
    acc[e.category] = (acc[e.category] || 0) + Number(e.amount);
    return acc;
  }, {});

  const expenseList = expenses
    .map(
      (e) =>
        `- ${e.title} | Category: ${e.category} | Amount: ₱${Number(e.amount).toFixed(2)} | Date: ${new Date(e.created_at).toLocaleDateString()}`
    )
    .join("\n");

  const categoryBreakdown = Object.entries(byCategory)
    .map(([cat, amt]) => `- ${cat}: ₱${(amt as number).toFixed(2)}`)
    .join("\n");

  return `You are Gastos AI, a smart and friendly personal expense assistant for a Filipino user.

You have FULL access to the user's expense data. Always answer based on this data.
Never say you don't have access to their data — you do.

=== FINANCIAL SNAPSHOT ===
Monthly Budget: ₱${Number(budget).toFixed(2)}
Total Spent: ₱${total.toFixed(2)}
Remaining: ₱${(Number(budget) - total).toFixed(2)}
Number of Expenses: ${expenses.length}

=== SPENDING BY CATEGORY ===
${categoryBreakdown || "No expenses yet."}

=== ALL EXPENSE RECORDS ===
${expenseList || "No expenses recorded yet."}

=== INSTRUCTIONS ===
- Answer questions about spending clearly and helpfully.
- Use ₱ (Philippine Peso) for all amounts.
- If there are no expenses, say so kindly and suggest they add some.
- Be concise but friendly. Avoid unnecessary disclaimers.`;
}

async function runChat(
  modelName: string,
  messages: any[],
  systemPrompt: string
) {
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: systemPrompt,
  });

  const chat = model.startChat({
    history: messages.slice(0, -1).map((msg: any) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }],
    })),
  });

  const lastMessage = messages[messages.length - 1].content;
  const result = await chat.sendMessage(lastMessage);
  return result.response.text();
}

// Generate a short title from the first user message
function generateTitle(firstMessage: string): string {
  return firstMessage.length > 50
    ? firstMessage.slice(0, 47) + "…"
    : firstMessage;
}

export async function POST(req: Request) {
  try {
    const {
      messages,
      expenses = [],
      budget = "10000",
      sessionId,
      userId,
      isFirstMessage = false,
    } = await req.json();

    const systemPrompt = buildSystemPrompt(expenses, budget);
    let lastError: any;
    let reply = "";

    for (const model of MODELS) {
      try {
        reply = await runChat(model, messages, systemPrompt);
        break;
      } catch (err: any) {
        lastError = err;
        if (err?.status === 503 || err?.status === 429) continue;
        throw err;
      }
    }

    if (!reply) throw lastError;

    // ── Persist to Supabase if we have a session ──────────────
    if (sessionId && userId) {
      const userMessage = messages[messages.length - 1];

      // If this is the first message, update the session title
      if (isFirstMessage) {
        await supabaseAdmin
          .from("chat_sessions")
          .update({ title: generateTitle(userMessage.content) })
          .eq("id", sessionId);
      }

      // Save the user message
      await supabaseAdmin.from("chat_messages").insert({
        session_id: sessionId,
        role: "user",
        content: userMessage.content,
      });

      // Save the assistant reply
      await supabaseAdmin.from("chat_messages").insert({
        session_id: sessionId,
        role: "assistant",
        content: reply,
      });
    }

    return Response.json({ reply });
  } catch (error: any) {
    console.error("Chat API error:", error);
    return Response.json(
      { error: "Chat service is temporarily unavailable." },
      { status: 500 }
    );
  }
}
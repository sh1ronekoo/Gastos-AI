"use client";

import { useState, useEffect, useRef } from "react";
import { usePrototypeTheme } from "../prototype-shell";
import { supabase } from "@/lib/supabase";

type Message = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Where did most of my money go?",
  "Am I on track with my budget?",
  "What should I cut back on?",
  "How much have I spent on food?",
];

export default function ChatPage() {
  const { isDark } = usePrototypeTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [expenses, setExpenses] = useState<unknown[]>([]);
  const [budget, setBudget] = useState("10000");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      const { data: expensesData } = await supabase
        .from("expenses").select("*").order("created_at", { ascending: false });
      if (expensesData) setExpenses(expensesData);

      const month = new Date().toISOString().slice(0, 7);
      const { data: budgetData } = await supabase
        .from("budgets").select("*").eq("month", month).single();
      if (budgetData) setBudget(String(budgetData.monthly_budget));
    };
    fetchData();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage(content: string) {
    if (!content.trim() || loading) return;

    const newMessages: Message[] = [...messages, { role: "user", content: content.trim() }];
    setMessages(newMessages);
    setDraft("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages, expenses, budget }),
      });
      const data = await res.json();
      if (data.reply) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, I couldn't connect. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(draft);
    }
  }

  const cardClass = isDark ? "border border-slate-800/70 bg-slate-900/75" : "border border-slate-200 bg-white/90";
  const subtleText = isDark ? "text-slate-300" : "text-slate-600";
  const inputClass = isDark
    ? "w-full resize-none rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 outline-none ring-teal-400 placeholder:text-slate-500 focus:ring-2"
    : "w-full resize-none rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none ring-teal-500 placeholder:text-slate-400 focus:ring-2";
  const bubbleBot = isDark ? "rounded-2xl rounded-bl-md bg-slate-800 text-slate-100" : "rounded-2xl rounded-bl-md bg-slate-100 text-slate-900";
  const bubbleUser = isDark ? "rounded-2xl rounded-br-md bg-teal-900/50 text-teal-50 ring-1 ring-teal-700/40" : "rounded-2xl rounded-br-md bg-teal-600 text-white";

  const isEmpty = messages.length === 0;

  return (
    <div className="space-y-6">
      <header className={`rounded-2xl p-6 shadow-xl backdrop-blur lg:p-8 ${cardClass}`}>
        <p className="text-sm font-medium text-teal-500">Assistant</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight lg:text-3xl">Chat with Gastos AI</h1>
        <p className={`mt-2 ${subtleText}`}>
          Ask anything about your spending in plain language. Powered by Google Gemini.
        </p>
      </header>

      <div className={`flex min-h-[min(70vh,640px)] flex-col overflow-hidden rounded-2xl shadow-xl backdrop-blur ${cardClass}`}>
        {/* Header bar */}
        <div className={`flex items-center justify-between border-b px-4 py-3 ${isDark ? "border-slate-800" : "border-slate-200"}`}>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-500" />
            </span>
            <span className={`text-xs font-medium uppercase tracking-wide ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              AI Chatbot · Live
            </span>
          </div>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => setMessages([])}
              className={`text-xs font-medium transition ${isDark ? "text-slate-500 hover:text-slate-300" : "text-slate-400 hover:text-slate-600"}`}
            >
              Clear chat
            </button>
          )}
        </div>

        {/* Messages */}
        <div className={`flex-1 space-y-4 overflow-y-auto px-4 py-5 ${isDark ? "bg-slate-950/40" : "bg-slate-50/80"}`}>

          {/* Empty state */}
          {isEmpty && (
            <div className="flex h-full flex-col items-center justify-center gap-6 py-8">
              <div className="text-center">
                <div className="mb-3 text-4xl">💬</div>
                <p className={`text-sm font-medium ${subtleText}`}>Ask me anything about your finances</p>
                <p className={`mt-1 text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}>I can see your expenses and budget</p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => sendMessage(s)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${isDark ? "border border-slate-700 text-slate-300 hover:bg-slate-800" : "border border-slate-200 text-slate-600 hover:bg-slate-100"}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message bubbles */}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] px-4 py-3 text-sm leading-relaxed shadow-sm ${m.role === "user" ? bubbleUser : bubbleBot}`}>
                {m.role === "assistant" && (
                  <p className="mb-1 text-xs font-semibold text-teal-400">Gastos AI</p>
                )}
                <p className="whitespace-pre-wrap">{m.content}</p>
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {loading && (
            <div className="flex justify-start">
              <div className={`px-4 py-3 text-sm shadow-sm ${bubbleBot}`}>
                <p className="mb-1 text-xs font-semibold text-teal-400">Gastos AI</p>
                <div className="flex items-center gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal-400"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div className={`space-y-2 border-t p-4 ${isDark ? "border-slate-800 bg-slate-900/60" : "border-slate-200 bg-white/95"}`}>
          <textarea
            ref={textareaRef}
            id="chat-draft"
            rows={2}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a question about your spending… (Enter to send)"
            className={inputClass}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className={`text-xs ${subtleText}`}>
              {expenses.length} expense{expenses.length !== 1 ? "s" : ""} · ₱{budget} budget · Shift+Enter for new line
            </p>
            <button
              type="button"
              onClick={() => sendMessage(draft)}
              disabled={!draft.trim() || loading}
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Thinking…" : "Send →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
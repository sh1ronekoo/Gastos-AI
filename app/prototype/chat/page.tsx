"use client";

import { useState } from "react";
import { usePrototypeTheme } from "../prototype-shell";

export default function ChatPage() {
  const { isDark } = usePrototypeTheme();
  const [draft, setDraft] = useState("");

  const cardClass = isDark ? "border border-slate-800/70 bg-slate-900/75" : "border border-slate-200 bg-white/90";
  const subtleText = isDark ? "text-slate-300" : "text-slate-600";
  const inputClass = isDark
    ? "w-full resize-none rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 outline-none ring-teal-400 placeholder:text-slate-500 focus:ring-2"
    : "w-full resize-none rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none ring-teal-500 placeholder:text-slate-400 focus:ring-2";

  const bubbleBot = isDark ? "rounded-2xl rounded-bl-md bg-slate-800 text-slate-100" : "rounded-2xl rounded-bl-md bg-slate-100 text-slate-900";
  const bubbleUser = isDark ? "rounded-2xl rounded-br-md bg-teal-900/50 text-teal-50 ring-1 ring-teal-700/40" : "rounded-2xl rounded-br-md bg-teal-600 text-white";

  return (
    <div className="space-y-6">
      <header className={`rounded-2xl p-6 shadow-xl backdrop-blur lg:p-8 ${cardClass}`}>
        <p className="text-sm font-medium text-teal-500">Assistant</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight lg:text-3xl">Chat with Gastos AI</h1>
        <p className={`mt-2 ${subtleText}`}>
          Ask questions about your spending in plain language. The conversational model is not wired up yet — this screen is the layout only.
        </p>
      </header>

      <div className={`flex min-h-[min(70vh,640px)] flex-col overflow-hidden rounded-2xl shadow-xl backdrop-blur ${cardClass}`}>
        <div className={`border-b px-4 py-3 text-xs font-medium uppercase tracking-wide ${isDark ? "border-slate-800 text-slate-400" : "border-slate-200 text-slate-500"}`}>
          Conversation
        </div>

        <div className={`flex-1 space-y-4 overflow-y-auto px-4 py-5 ${isDark ? "bg-slate-950/40" : "bg-slate-50/80"}`}>
          <div className="flex justify-start">
            <div className={`max-w-[85%] px-4 py-3 text-sm leading-relaxed shadow-sm ${bubbleBot}`}>
              <p className="font-medium text-teal-400">Gastos AI</p>
              <p className={`mt-1 ${isDark ? "text-slate-200" : "text-slate-700"}`}>
                Hi — I&apos;m your spending assistant. Once connected, I can summarize expenses, compare categories, and suggest budgets based on your history.
              </p>
            </div>
          </div>
          <div className="flex justify-end">
            <div className={`max-w-[85%] px-4 py-3 text-sm leading-relaxed shadow-sm ${bubbleUser}`}>
              <p>Show me where most of my money went last month.</p>
            </div>
          </div>
          <div className="flex justify-start">
            <div className={`max-w-[85%] px-4 py-3 text-sm leading-relaxed shadow-sm ${bubbleBot}`}>
              <p className="font-medium text-teal-400">Gastos AI</p>
              <p className={`mt-1 italic ${subtleText}`}>AI reply placeholder — charts and numbers will appear here.</p>
            </div>
          </div>
        </div>

        <div className={`space-y-2 border-t p-4 ${isDark ? "border-slate-800 bg-slate-900/60" : "border-slate-200 bg-white/95"}`}>
          <label htmlFor="chat-draft" className={`sr-only`}>
            Message
          </label>
          <textarea
            id="chat-draft"
            rows={2}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type a question about your spending…"
            className={inputClass}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className={`text-xs ${subtleText}`}>no ai api.</p>
            <button
              type="button"
              disabled
              className={`rounded-lg px-4 py-2 text-sm font-semibold opacity-60 ${isDark ? "bg-slate-700 text-slate-300" : "bg-slate-200 text-slate-600"}`}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

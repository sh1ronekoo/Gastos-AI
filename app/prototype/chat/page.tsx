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
      const { data: expensesData } = await supabase.from("expenses").select("*").order("created_at", { ascending: false });
      if (expensesData) setExpenses(expensesData);
      const month = new Date().toISOString().slice(0, 7);
      const { data: budgetData } = await supabase.from("budgets").select("*").eq("month", month).single();
      if (budgetData) setBudget(String(budgetData.monthly_budget));
    };
    fetchData();
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

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
      if (data.reply) setMessages(prev => [...prev, { role: "assistant", content: data.reply }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I couldn't connect. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(draft); }
  }

  // ── Theme tokens ─────────────────────────────────────────
  const glass = isDark
    ? { background: "rgba(13,17,26,0.75)", border: "1px solid rgba(255,255,255,0.06)", backdropFilter: "blur(20px)" }
    : { background: "rgba(255,255,255,0.85)", border: "1px solid rgba(0,0,0,0.07)", backdropFilter: "blur(20px)" };
  const tx = isDark ? "#e2e8f0" : "#0f172a";
  const txSub = isDark ? "#94a3b8" : "#64748b";
  const txMute = isDark ? "#475569" : "#94a3b8";
  const msgBg = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)";
  const msgBorder = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)";

  return (
    <>
      <style suppressHydrationWarning>{`
        @keyframes fadeSlideUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes ping { 0%,100%{transform:scale(1);opacity:0.5} 50%{transform:scale(2);opacity:0} }
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
        @keyframes typingPulse { 0%,100%{opacity:0.3} 50%{opacity:1} }
        @keyframes dotPulse { 0%,100%{opacity:0.35; transform:translateY(0);} 50%{opacity:1; transform:translateY(-2px);} }
        @keyframes pulseBubble { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.03);opacity:0.95} }
        @keyframes msgIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }

        .chat-msg { animation: msgIn 0.3s cubic-bezier(0.22,1,0.36,1) both; }
        .triple-dot-path { animation: dotPulse 1.2s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }

        .chat-input {
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .chat-input:focus {
          border-color: rgba(20,184,166,0.5) !important;
          box-shadow: 0 0 0 3px rgba(20,184,166,0.08) !important;
          outline: none;
        }

        .send-btn {
          transition: transform 0.18s cubic-bezier(0.22,1,0.36,1), box-shadow 0.18s, background 0.15s;
        }
        .send-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(20,184,166,0.35);
        }
        .send-btn:active:not(:disabled) { transform: translateY(0); }

        .suggestion-btn {
          transition: background 0.15s, border-color 0.15s, color 0.15s, transform 0.15s;
        }
        .suggestion-btn:hover {
          background: rgba(20,184,166,0.1) !important;
          border-color: rgba(20,184,166,0.35) !important;
          color: #14b8a6 !important;
          transform: translateY(-1px);
        }

        .msg-area::-webkit-scrollbar { width: 4px; }
        .msg-area::-webkit-scrollbar-track { background: transparent; }
        .msg-area::-webkit-scrollbar-thumb { background: rgba(100,116,139,0.2); border-radius: 999px; }

        .clear-btn {
          transition: color 0.15s, background 0.15s;
          border-radius: 6px;
          padding: 0.2rem 0.5rem;
        }
        .clear-btn:hover {
          background: rgba(239,68,68,0.08) !important;
          color: #f87171 !important;
        }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 120px)", minHeight: 520 }}>

        {/* Chat Window */}
        <div style={{ ...glass, borderRadius: 22, display: "flex", flexDirection: "column", flex: 1, overflow: "hidden", position: "relative" }}>

          {/* Subtle dot-grid texture */}
          <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(20,184,166,0.05) 1px, transparent 1px)", backgroundSize: "24px 24px", pointerEvents: "none", borderRadius: 22, zIndex: 0 }} />

          {/* ── Top bar ── */}
          <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1rem 1.4rem", borderBottom: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.07)", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              {/* AI avatar */}
              <div style={{ position: "relative", width: 36, height: 36, borderRadius: 11, background: "rgba(20,184,166,0.12)", border: "1px solid rgba(20,184,166,0.25)", display: "grid", placeItems: "center", fontSize: "1rem", flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2C13.1 2 14 2.9 14 4V5H16C17.1 5 18 5.9 18 7V9C19.1 9 20 9.9 20 11V16C20 17.1 19.1 18 18 18H16V19C16 20.1 15.1 21 14 21H10C8.9 21 8 20.1 8 19V18H6C4.9 18 4 17.1 4 16V11C4 9.9 4.9 9 6 9V7C6 5.9 6.9 5 8 5H10V4C10 2.9 10.9 2 12 2ZM12 4C11.4 4 11 4.4 11 5V6H13V5C13 4.4 12.6 4 12 4ZM8 7V9H16V7H8ZM6 11V16H18V11H6Z" fill="currentColor"/>
                </svg>
                <span style={{ position: "absolute", bottom: -2, right: -2, width: 10, height: 10, borderRadius: "50%", background: isDark ? "#07090f" : "#f1f5f9", display: "grid", placeItems: "center" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", display: "block" }} />
                </span>
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ fontSize: "0.85rem", fontWeight: 700, color: tx }}>Gastos AI</span>
                  <span style={{ padding: "0.1rem 0.5rem", borderRadius: 999, fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", background: "rgba(20,184,166,0.1)", border: "1px solid rgba(20,184,166,0.2)", color: "#14b8a6" }}>Live · Gemini</span>
                </div>
                <p style={{ fontSize: "0.7rem", color: txMute, marginTop: "0.05rem" }}>Your AI financial companion</p>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              {/* Pulse indicator */}
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <span style={{ position: "relative", display: "inline-flex", width: 8, height: 8 }}>
                  <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "#14b8a6", animation: "ping 2s ease-in-out infinite", opacity: 0.5 }} />
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#14b8a6", display: "block", position: "relative" }} />
                </span>
                <span style={{ fontSize: "0.7rem", color: txMute }}>Online</span>
              </div>

              {messages.length > 0 && (
                <button type="button" className="clear-btn" onClick={() => setMessages([])} style={{ fontSize: "0.72rem", fontWeight: 500, color: txMute, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                  Clear chat
                </button>
              )}
            </div>
          </div>

          {/* ── Messages Area ── */}
          <div className="msg-area" style={{ flex: 1, overflowY: "auto", padding: "1.5rem 1.4rem", display: "flex", flexDirection: "column", gap: "1.1rem", position: "relative", zIndex: 1 }}>

            {messages.length === 0 && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1.75rem", padding: "2rem 1rem", animation: "fadeSlideUp 0.5s cubic-bezier(0.22,1,0.36,1) both" }}>
                {/* Central icon */}
                <div style={{ position: "relative" }}>
                  <div style={{ width: 72, height: 72, borderRadius: 22, background: "rgba(20,184,166,0.1)", border: "1px solid rgba(20,184,166,0.2)", display: "grid", placeItems: "center", fontSize: "2rem", animation: "pulseBubble 3s ease-in-out infinite" }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect x="4" y="6" width="16" height="10" rx="5" fill="currentColor" opacity="0.12" />
                      <path className="triple-dot-path" style={{ animationDelay: "0s" }} d="M8.5 11.5C8.5 12.3284 7.82843 13 7 13C6.17157 13 5.5 12.3284 5.5 11.5C5.5 10.6716 6.17157 10 7 10C7.82843 10 8.5 10.6716 8.5 11.5Z" fill="currentColor"/>
                      <path className="triple-dot-path" style={{ animationDelay: "0.12s" }} d="M14 11.5C14 12.3284 13.3284 13 12.5 13C11.6716 13 11 12.3284 11 11.5C11 10.6716 11.6716 10 12.5 10C13.3284 10 14 10.6716 14 11.5Z" fill="currentColor"/>
                      <path className="triple-dot-path" style={{ animationDelay: "0.24s" }} d="M19 11.5C19 12.3284 18.3284 13 17.5 13C16.6716 13 16 12.3284 16 11.5C16 10.6716 16.6716 10 17.5 10C18.3284 10 19 10.6716 19 11.5Z" fill="currentColor"/>
                    </svg>
                  </div>
                  {/* Orbiting dot */}
                  <div style={{ position: "absolute", top: -4, right: -4, width: 18, height: 18, borderRadius: "50%", background: "rgba(20,184,166,0.15)", border: "1px solid rgba(20,184,166,0.3)", display: "grid", placeItems: "center", fontSize: "0.6rem" }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 2L13.09 8.26L19 9L13.09 9.74L12 16L10.91 9.74L5 9L10.91 8.26L12 2Z" fill="currentColor"/>
                      <path d="M19 15L19.5 16.5L21 16L19.5 16.5L19 18L18.5 16.5L17 16L18.5 15.5L19 15Z" fill="currentColor"/>
                      <path d="M5 6L5.5 7.5L7 7L5.5 7.5L5 9L4.5 7.5L3 7L4.5 6.5L5 6Z" fill="currentColor"/>
                    </svg>
                  </div>
                </div>

                <div style={{ textAlign: "center" }}>
                  <p style={{ fontSize: "1.05rem", fontWeight: 700, color: tx, marginBottom: "0.4rem" }}>Ask me anything about your finances</p>
                  <p style={{ fontSize: "0.8rem", color: txMute }}>
                    I can see your <span style={{ color: "#14b8a6", fontWeight: 600 }}>{(expenses as unknown[]).length} expense{(expenses as unknown[]).length !== 1 ? "s" : ""}</span> and <span style={{ color: "#14b8a6", fontWeight: 600 }}>₱{budget}</span> budget
                  </p>
                </div>

                {/* Suggestion chips */}
                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0.5rem", maxWidth: 560 }}>
                  {SUGGESTIONS.map((s, i) => (
                    <button key={s} type="button" className="suggestion-btn" onClick={() => sendMessage(s)}
                      style={{ padding: "0.5rem 1rem", borderRadius: 999, fontSize: "0.8rem", fontWeight: 500, background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)", border: isDark ? "1px solid rgba(255,255,255,0.09)" : "1px solid rgba(0,0,0,0.09)", color: txSub, cursor: "pointer", fontFamily: "inherit", animationDelay: `${0.1 + i * 0.07}s`, animation: "fadeSlideUp 0.45s cubic-bezier(0.22,1,0.36,1) both" }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className="chat-msg" style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", gap: "0.6rem", alignItems: "flex-end" }}>
                {m.role === "assistant" && (
                  <div style={{ width: 30, height: 30, borderRadius: 9, background: "rgba(20,184,166,0.12)", border: "1px solid rgba(20,184,166,0.25)", display: "grid", placeItems: "center", flexShrink: 0, fontSize: "0.85rem" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 2C13.1 2 14 2.9 14 4V5H16C17.1 5 18 5.9 18 7V9C19.1 9 20 9.9 20 11V16C20 17.1 19.1 18 18 18H16V19C16 20.1 15.1 21 14 21H10C8.9 21 8 20.1 8 19V18H6C4.9 18 4 17.1 4 16V11C4 9.9 4.9 9 6 9V7C6 5.9 6.9 5 8 5H10V4C10 2.9 10.9 2 12 2ZM12 4C11.4 4 11 4.4 11 5V6H13V6V5C13 4.4 12.6 4 12 4ZM8 7V9H16V7H8ZM6 11V16H18V11H6Z" fill="currentColor"/>
                    </svg>
                  </div>
                )}

                <div style={{
                  maxWidth: "72%",
                  padding: "0.85rem 1.1rem",
                  fontSize: "0.875rem",
                  lineHeight: 1.65,
                  borderRadius: m.role === "user" ? "18px 18px 4px 18px" : "4px 18px 18px 18px",
                  background: m.role === "user"
                    ? "linear-gradient(135deg, #14b8a6, #0d9488)"
                    : msgBg,
                  color: m.role === "user" ? "#fff" : tx,
                  border: m.role === "user" ? "none" : `1px solid ${msgBorder}`,
                  boxShadow: m.role === "user" ? "0 4px 18px rgba(20,184,166,0.25)" : "none",
                }}>
                  {m.role === "assistant" && (
                    <p style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#14b8a6", marginBottom: "0.35rem" }}>GASTOS AI</p>
                  )}
                  <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{m.content}</p>
                </div>

                {m.role === "user" && (
                  <div style={{ width: 30, height: 30, borderRadius: 9, background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)", border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.08)", display: "grid", placeItems: "center", flexShrink: 0, fontSize: "0.85rem" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12ZM12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14Z" fill="currentColor"/>
                    </svg>
                  </div>
                )}
              </div>
            ))}

            {/* Typing indicator */}
            {loading && (
              <div className="chat-msg" style={{ display: "flex", justifyContent: "flex-start", gap: "0.6rem", alignItems: "flex-end" }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: "rgba(20,184,166,0.12)", border: "1px solid rgba(20,184,166,0.25)", display: "grid", placeItems: "center", fontSize: "0.85rem", flexShrink: 0 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2C13.1 2 14 2.9 14 4V5H16C17.1 5 18 5.9 18 7V9C19.1 9 20 9.9 20 11V16C20 17.1 19.1 18 18 18H16V19C16 20.1 15.1 21 14 21H10C8.9 21 8 20.1 8 19V18H6C4.9 18 4 17.1 4 16V11C4 9.9 4.9 9 6 9V7C6 5.9 6.9 5 8 5H10V4C10 2.9 10.9 2 12 2ZM12 4C11.4 4 11 4.4 11 5V6H13V6V5C13 4.4 12.6 4 12 4ZM8 7V9H16V7H8ZM6 11V16H18V11H6Z" fill="currentColor"/>
                  </svg>
                </div>
                <div style={{ padding: "0.85rem 1.1rem", borderRadius: "4px 18px 18px 18px", background: msgBg, border: `1px solid ${msgBorder}` }}>
                  <p style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#14b8a6", marginBottom: "0.5rem" }}>GASTOS AI</p>
                  <div style={{ display: "flex", gap: "5px", alignItems: "center" }}>
                    {[0, 1, 2].map(i => (
                      <span key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "#14b8a6", display: "inline-block", animation: `bounce 1.1s ease-in-out infinite`, animationDelay: `${i * 0.18}s` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* ── Input Bar ── */}
          <div style={{ position: "relative", zIndex: 1, padding: "1rem 1.4rem 1.2rem", borderTop: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.07)", background: isDark ? "rgba(7,9,15,0.6)" : "rgba(255,255,255,0.7)", backdropFilter: "blur(12px)", flexShrink: 0 }}>
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-end" }}>
              <textarea
                ref={textareaRef}
                className="chat-input"
                rows={2}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a question about your spending… (Enter to send)"
                style={{
                  flex: 1, resize: "none", padding: "0.8rem 1rem", borderRadius: 13, fontSize: "0.875rem",
                  background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                  border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.09)",
                  color: tx, fontFamily: "inherit",
                }}
              />
              <button type="button" className="send-btn" onClick={() => sendMessage(draft)} disabled={!draft.trim() || loading}
                style={{
                  padding: "0.8rem 1.3rem", borderRadius: 13, border: "none",
                  background: !draft.trim() || loading
                    ? isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)"
                    : "linear-gradient(135deg,#14b8a6,#0d9488)",
                  color: !draft.trim() || loading ? txMute : "#fff",
                  fontSize: "0.85rem", fontWeight: 700, cursor: !draft.trim() || loading ? "not-allowed" : "pointer",
                  fontFamily: "inherit", flexShrink: 0,
                }}>
                {loading ? "…" : "Send →"}
              </button>
            </div>
            <p style={{ fontSize: "0.68rem", color: txMute, marginTop: "0.5rem" }}>
              {(expenses as unknown[]).length} expense{(expenses as unknown[]).length !== 1 ? "s" : ""} · ₱{budget} budget · Shift+Enter for new line
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
      `}</style>
    </>
  );
}
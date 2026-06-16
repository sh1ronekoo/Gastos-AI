"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePrototypeTheme } from "../prototype-shell";
import { supabase } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────
type Message = { role: "user" | "assistant"; content: string };

type ChatSession = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  preview?: string; // last message snippet
};

// ─── Constants ────────────────────────────────────────────────────────────────
const SUGGESTIONS = [
  "Where did most of my money go?",
  "Am I on track with my budget?",
  "What should I cut back on?",
  "How much have I spent on food?",
];

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function ChatPage() {
  const { isDark } = usePrototypeTheme();

  // Financial data
  const [expenses, setExpenses] = useState<unknown[]>([]);
  const [budget, setBudget] = useState("10000");
  const [userId, setUserId] = useState<string | null>(null);

  // Session state
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // UI state
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Fetch user + financial data ──────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);

      const { data: expensesData } = await supabase
        .from("expenses")
        .select("*")
        .order("created_at", { ascending: false });
      if (expensesData) setExpenses(expensesData);

      const month = new Date().toISOString().slice(0, 7);
      const { data: incomeData } = await supabase
        .from("incomes")
        .select("amount")
        .eq("month", month);
      const totalIncome = (incomeData ?? []).reduce(
        (s, i) => s + Number(i.amount), 0
      );
      setBudget(String(totalIncome));
    };
    init();
  }, []);

  // ── Fetch sessions ───────────────────────────────────────────────────────
  const fetchSessions = useCallback(async () => {
    if (!userId) return;
    setLoadingSessions(true);
    const { data } = await supabase
      .from("chat_sessions")
      .select("id, title, created_at, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (data) {
      // Fetch last message for each session as a preview
      const withPreviews = await Promise.all(
        data.map(async (s) => {
          const { data: msgs } = await supabase
            .from("chat_messages")
            .select("content, role")
            .eq("session_id", s.id)
            .order("created_at", { ascending: false })
            .limit(1);
          return {
            ...s,
            preview: msgs?.[0]?.content ?? "",
          };
        })
      );
      setSessions(withPreviews);
    }
    setLoadingSessions(false);
  }, [userId]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  // ── Load messages for active session ────────────────────────────────────
  useEffect(() => {
    if (!activeSessionId) { setMessages([]); return; }
    const load = async () => {
      setLoadingMessages(true);
      const { data } = await supabase
        .from("chat_messages")
        .select("role, content")
        .eq("session_id", activeSessionId)
        .order("created_at", { ascending: true });
      setMessages((data ?? []) as Message[]);
      setLoadingMessages(false);
    };
    load();
  }, [activeSessionId]);

  // ── Auto-scroll ──────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  // ── Create a new session ─────────────────────────────────────────────────
  async function createSession(): Promise<string | null> {
    if (!userId) return null;
    const { data, error } = await supabase
      .from("chat_sessions")
      .insert({ user_id: userId, title: "New conversation" })
      .select("id")
      .single();
    if (error || !data) return null;
    return data.id;
  }

  // ── Delete a session ─────────────────────────────────────────────────────
  async function deleteSession(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setDeletingId(id);
    await supabase.from("chat_sessions").delete().eq("id", id);
    setSessions(prev => prev.filter(s => s.id !== id));
    if (activeSessionId === id) {
      setActiveSessionId(null);
      setMessages([]);
    }
    setDeletingId(null);
  }

  // ── Start a new chat ─────────────────────────────────────────────────────
  function startNewChat() {
    setActiveSessionId(null);
    setMessages([]);
    setDraft("");
    textareaRef.current?.focus();
  }

  // ── Send message ─────────────────────────────────────────────────────────
  async function sendMessage(content: string) {
    if (!content.trim() || sending) return;
    const trimmed = content.trim();
    setDraft("");

    // Ensure we have an active session
    let sessionId = activeSessionId;
    const isFirstMessage = !sessionId;

    if (!sessionId) {
      sessionId = await createSession();
      if (!sessionId) return;
      setActiveSessionId(sessionId);
    }

    const newMessages: Message[] = [...messages, { role: "user", content: trimmed }];
    setMessages(newMessages);
    setSending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          expenses,
          budget,
          sessionId,
          userId,
          isFirstMessage,
        }),
      });
      const data = await res.json();
      if (data.reply) {
        setMessages(prev => [...prev, { role: "assistant", content: data.reply }]);
      }
    } catch {
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: "Sorry, I couldn't connect. Please try again." },
      ]);
    } finally {
      setSending(false);
      // Refresh sidebar to show updated title/preview
      setTimeout(fetchSessions, 500);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(draft);
    }
  }

  // ── Theme tokens ─────────────────────────────────────────────────────────
  const bg       = isDark ? "#07090f" : "#f8fafc";
  const glass    = isDark
    ? { background: "rgba(13,17,26,0.8)", border: "1px solid rgba(255,255,255,0.07)" }
    : { background: "rgba(255,255,255,0.9)", border: "1px solid rgba(0,0,0,0.08)" };
  const sideGlass = isDark
    ? { background: "rgba(10,14,22,0.85)", border: "1px solid rgba(255,255,255,0.06)" }
    : { background: "rgba(248,250,252,0.95)", border: "1px solid rgba(0,0,0,0.07)" };
  const tx       = isDark ? "#e2e8f0" : "#0f172a";
  const txSub    = isDark ? "#94a3b8" : "#64748b";
  const txMute   = isDark ? "#475569" : "#94a3b8";
  const msgBg    = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)";
  const msgBorder = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.08)";
  const hoverBg  = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)";
  const activeBg = isDark ? "rgba(20,184,166,0.1)" : "rgba(20,184,166,0.08)";

  const expenseCount = (expenses as unknown[]).length;

  return (
    <>
      <style suppressHydrationWarning>{`
        @keyframes fadeSlideUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes msgIn       { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes ping        { 0%,100%{transform:scale(1);opacity:0.5} 50%{transform:scale(2);opacity:0} }
        @keyframes bounce      { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
        @keyframes pulseBubble { 0%,100%{transform:scale(1)} 50%{transform:scale(1.03)} }
        @keyframes dotPulse    { 0%,100%{opacity:0.35;transform:translateY(0)} 50%{opacity:1;transform:translateY(-2px)} }
        @keyframes shimmer     { 0%{opacity:0.4} 50%{opacity:0.7} 100%{opacity:0.4} }

        .chat-msg    { animation: msgIn 0.28s cubic-bezier(0.22,1,0.36,1) both; }
        .suggestion-btn { transition: background 0.15s, border-color 0.15s, color 0.15s, transform 0.15s; }
        .suggestion-btn:hover {
          background: rgba(20,184,166,0.1) !important;
          border-color: rgba(20,184,166,0.35) !important;
          color: #14b8a6 !important;
          transform: translateY(-1px);
        }
        .send-btn { transition: transform 0.18s cubic-bezier(0.22,1,0.36,1), box-shadow 0.18s, background 0.15s; }
        .send-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(20,184,166,0.3); }
        .send-btn:active:not(:disabled) { transform: translateY(0); }
        .chat-input { transition: border-color 0.2s, box-shadow 0.2s; }
        .chat-input:focus { border-color: rgba(20,184,166,0.5) !important; box-shadow: 0 0 0 3px rgba(20,184,166,0.08) !important; outline: none; }
        .session-item { transition: background 0.15s; cursor: pointer; border-radius: 10px; }
        .session-item:hover { background: ${hoverBg}; }
        .session-item.active { background: ${activeBg}; }
        .del-btn { opacity: 0; transition: opacity 0.15s, color 0.15s; background: none; border: none; cursor: pointer; padding: 2px 5px; border-radius: 5px; color: ${txMute}; font-size: 0.8rem; }
        .session-item:hover .del-btn { opacity: 1; }
        .del-btn:hover { color: #f87171 !important; background: rgba(239,68,68,0.08); }
        .new-chat-btn { transition: background 0.15s, transform 0.15s; }
        .new-chat-btn:hover { background: rgba(20,184,166,0.15) !important; transform: translateY(-1px); }
        .sidebar-toggle { transition: background 0.15s; border-radius: 8px; }
        .sidebar-toggle:hover { background: rgba(20,184,166,0.1) !important; }
        .msg-area::-webkit-scrollbar { width: 4px; }
        .msg-area::-webkit-scrollbar-track { background: transparent; }
        .msg-area::-webkit-scrollbar-thumb { background: rgba(100,116,139,0.2); border-radius: 999px; }
        .sidebar-scroll::-webkit-scrollbar { width: 3px; }
        .sidebar-scroll::-webkit-scrollbar-thumb { background: rgba(100,116,139,0.15); border-radius: 999px; }
        .triple-dot-path { animation: dotPulse 1.2s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
        .skeleton { animation: shimmer 1.6s ease-in-out infinite; background: ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}; border-radius: 6px; }
      `}</style>

      <div style={{ display: "flex", gap: "1rem", height: "calc(100vh - 120px)", minHeight: 520 }}>

        {/* ── Sidebar ───────────────────────────────────────────────────── */}
        {sidebarOpen && (
          <div style={{
            ...sideGlass,
            width: 260,
            flexShrink: 0,
            borderRadius: 18,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            backdropFilter: "blur(20px)",
            animation: "fadeSlideUp 0.3s cubic-bezier(0.22,1,0.36,1) both",
          }}>
            {/* Sidebar header */}
            <div style={{ padding: "1rem", borderBottom: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.07)", flexShrink: 0 }}>
              <p style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: txMute, marginBottom: "0.65rem" }}>Chat History</p>
              <button
                type="button"
                className="new-chat-btn"
                onClick={startNewChat}
                style={{
                  width: "100%",
                  padding: "0.55rem 0.9rem",
                  borderRadius: 10,
                  border: "1px solid rgba(20,184,166,0.3)",
                  background: "rgba(20,184,166,0.08)",
                  color: "#14b8a6",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.4rem",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
                New Chat
              </button>
            </div>

            {/* Session list */}
            <div className="sidebar-scroll" style={{ flex: 1, overflowY: "auto", padding: "0.6rem" }}>
              {loadingSessions ? (
                // Skeleton
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", padding: "0.4rem" }}>
                  {[1, 2, 3].map(i => (
                    <div key={i} style={{ padding: "0.7rem 0.6rem", borderRadius: 10 }}>
                      <div className="skeleton" style={{ height: 10, width: "70%", marginBottom: 6 }} />
                      <div className="skeleton" style={{ height: 8, width: "90%" }} />
                    </div>
                  ))}
                </div>
              ) : sessions.length === 0 ? (
                <div style={{ padding: "2rem 1rem", textAlign: "center" }}>
                  <p style={{ fontSize: "0.78rem", color: txMute }}>No conversations yet.</p>
                  <p style={{ fontSize: "0.72rem", color: txMute, marginTop: "0.3rem" }}>Start a new chat above!</p>
                </div>
              ) : (
                sessions.map(session => (
                  <div
                    key={session.id}
                    className={`session-item ${activeSessionId === session.id ? "active" : ""}`}
                    onClick={() => setActiveSessionId(session.id)}
                    style={{ padding: "0.65rem 0.7rem", marginBottom: 2, display: "flex", alignItems: "flex-start", gap: "0.5rem" }}
                  >
                    {/* Icon */}
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: activeSessionId === session.id ? "rgba(20,184,166,0.15)" : isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)", display: "grid", placeItems: "center", flexShrink: 0, marginTop: 1 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke={activeSessionId === session.id ? "#14b8a6" : txMute} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.3rem" }}>
                        <p style={{ fontSize: "0.78rem", fontWeight: 600, color: activeSessionId === session.id ? "#14b8a6" : tx, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 130 }}>
                          {session.title}
                        </p>
                        <button
                          type="button"
                          className="del-btn"
                          onClick={(e) => deleteSession(session.id, e)}
                          disabled={deletingId === session.id}
                        >
                          {deletingId === session.id ? "…" : "✕"}
                        </button>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 2 }}>
                        <p style={{ fontSize: "0.68rem", color: txMute, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 130 }}>
                          {session.preview || "No messages yet"}
                        </p>
                        <span style={{ fontSize: "0.62rem", color: txMute, flexShrink: 0 }}>
                          {relativeTime(session.updated_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Sidebar footer — expense context */}
            <div style={{ padding: "0.75rem 1rem", borderTop: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.07)", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", flexShrink: 0 }} />
                <p style={{ fontSize: "0.68rem", color: txMute }}>
                  {expenseCount} expense{expenseCount !== 1 ? "s" : ""} · ₱{Number(budget).toLocaleString()} budget
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Main Chat Window ──────────────────────────────────────────── */}
        <div style={{
          ...glass,
          flex: 1,
          borderRadius: 18,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          position: "relative",
          backdropFilter: "blur(20px)",
        }}>
          {/* Dot-grid texture */}
          <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(20,184,166,0.045) 1px, transparent 1px)", backgroundSize: "24px 24px", pointerEvents: "none", borderRadius: 18, zIndex: 0 }} />

          {/* Top bar */}
          <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.9rem 1.2rem", borderBottom: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.07)", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
              {/* Sidebar toggle */}
              <button
                type="button"
                className="sidebar-toggle"
                onClick={() => setSidebarOpen(v => !v)}
                style={{ width: 32, height: 32, display: "grid", placeItems: "center", background: "none", border: "none", cursor: "pointer", color: txMute }}
                title={sidebarOpen ? "Hide history" : "Show history"}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="3" y="6" width="18" height="2" rx="1" fill="currentColor"/><rect x="3" y="11" width="12" height="2" rx="1" fill="currentColor"/><rect x="3" y="16" width="15" height="2" rx="1" fill="currentColor"/></svg>
              </button>

              {/* AI avatar */}
              <div style={{ position: "relative", width: 34, height: 34, borderRadius: 10, background: "rgba(20,184,166,0.12)", border: "1px solid rgba(20,184,166,0.25)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" color="#14b8a6"><path d="M12 2C13.1 2 14 2.9 14 4V5H16C17.1 5 18 5.9 18 7V9C19.1 9 20 9.9 20 11V16C20 17.1 19.1 18 18 18H16V19C16 20.1 15.1 21 14 21H10C8.9 21 8 20.1 8 19V18H6C4.9 18 4 17.1 4 16V11C4 9.9 4.9 9 6 9V7C6 5.9 6.9 5 8 5H10V4C10 2.9 10.9 2 12 2ZM12 4C11.4 4 11 4.4 11 5V6H13V5C13 4.4 12.6 4 12 4ZM8 7V9H16V7H8ZM6 11V16H18V11H6Z" fill="currentColor"/></svg>
                <span style={{ position: "absolute", bottom: -2, right: -2, width: 9, height: 9, borderRadius: "50%", background: isDark ? "#07090f" : "#f8fafc", display: "grid", placeItems: "center" }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#22c55e", display: "block" }} />
                </span>
              </div>

              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
                  <span style={{ fontSize: "0.83rem", fontWeight: 700, color: tx }}>Gastos AI</span>
                  <span style={{ padding: "0.1rem 0.45rem", borderRadius: 999, fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", background: "rgba(20,184,166,0.1)", border: "1px solid rgba(20,184,166,0.2)", color: "#14b8a6" }}>Live · Gemini</span>
                </div>
                <p style={{ fontSize: "0.67rem", color: txMute, marginTop: "0.05rem" }}>
                  {activeSessionId
                    ? sessions.find(s => s.id === activeSessionId)?.title ?? "Conversation"
                    : "Your AI financial companion"}
                </p>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              {/* Online indicator */}
              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                <span style={{ position: "relative", display: "inline-flex", width: 8, height: 8 }}>
                  <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "#14b8a6", animation: "ping 2s ease-in-out infinite", opacity: 0.5 }} />
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#14b8a6", display: "block", position: "relative" }} />
                </span>
                <span style={{ fontSize: "0.68rem", color: txMute }}>Online</span>
              </div>
            </div>
          </div>

          {/* Messages area */}
          <div className="msg-area" style={{ flex: 1, overflowY: "auto", padding: "1.4rem 1.2rem", display: "flex", flexDirection: "column", gap: "1rem", position: "relative", zIndex: 1 }}>

            {/* Loading messages skeleton */}
            {loadingMessages && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {[1, 2, 3].map(i => (
                  <div key={i} style={{ display: "flex", justifyContent: i % 2 === 0 ? "flex-end" : "flex-start" }}>
                    <div className="skeleton" style={{ height: 50, width: `${45 + i * 10}%`, borderRadius: 14 }} />
                  </div>
                ))}
              </div>
            )}

            {/* Empty state */}
            {!loadingMessages && messages.length === 0 && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1.5rem", padding: "2rem 1rem", animation: "fadeSlideUp 0.45s cubic-bezier(0.22,1,0.36,1) both" }}>
                <div style={{ position: "relative" }}>
                  <div style={{ width: 68, height: 68, borderRadius: 20, background: "rgba(20,184,166,0.1)", border: "1px solid rgba(20,184,166,0.2)", display: "grid", placeItems: "center", animation: "pulseBubble 3s ease-in-out infinite" }}>
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" color="#14b8a6">
                      <rect x="4" y="6" width="16" height="10" rx="5" fill="currentColor" opacity="0.12"/>
                      <circle className="triple-dot-path" style={{ animationDelay: "0s" }} cx="8" cy="11" r="1.5" fill="currentColor"/>
                      <circle className="triple-dot-path" style={{ animationDelay: "0.15s" }} cx="12" cy="11" r="1.5" fill="currentColor"/>
                      <circle className="triple-dot-path" style={{ animationDelay: "0.3s" }} cx="16" cy="11" r="1.5" fill="currentColor"/>
                    </svg>
                  </div>
                  <div style={{ position: "absolute", top: -4, right: -4, width: 18, height: 18, borderRadius: "50%", background: "rgba(20,184,166,0.15)", border: "1px solid rgba(20,184,166,0.3)", display: "grid", placeItems: "center" }}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="#14b8a6"><path d="M12 2L13.09 8.26L19 9L13.09 9.74L12 16L10.91 9.74L5 9L10.91 8.26L12 2Z"/></svg>
                  </div>
                </div>

                <div style={{ textAlign: "center" }}>
                  <p style={{ fontSize: "1rem", fontWeight: 700, color: tx, marginBottom: "0.35rem" }}>Ask me anything about your finances</p>
                  <p style={{ fontSize: "0.77rem", color: txMute }}>
                    I can see your{" "}
                    <span style={{ color: "#14b8a6", fontWeight: 600 }}>{expenseCount} expense{expenseCount !== 1 ? "s" : ""}</span>
                    {" "}and{" "}
                    <span style={{ color: "#14b8a6", fontWeight: 600 }}>₱{Number(budget).toLocaleString()}</span> budget
                  </p>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0.45rem", maxWidth: 520 }}>
                  {SUGGESTIONS.map((s, i) => (
                    <button
                      key={s}
                      type="button"
                      className="suggestion-btn"
                      onClick={() => sendMessage(s)}
                      style={{
                        padding: "0.45rem 0.9rem",
                        borderRadius: 999,
                        fontSize: "0.78rem",
                        fontWeight: 500,
                        background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
                        border: isDark ? "1px solid rgba(255,255,255,0.09)" : "1px solid rgba(0,0,0,0.09)",
                        color: txSub,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        animation: "fadeSlideUp 0.4s cubic-bezier(0.22,1,0.36,1) both",
                        animationDelay: `${0.08 + i * 0.07}s`,
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Messages */}
            {!loadingMessages && messages.map((m, i) => (
              <div
                key={i}
                className="chat-msg"
                style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", gap: "0.55rem", alignItems: "flex-end" }}
              >
                {m.role === "assistant" && (
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(20,184,166,0.12)", border: "1px solid rgba(20,184,166,0.25)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" color="#14b8a6"><path d="M12 2C13.1 2 14 2.9 14 4V5H16C17.1 5 18 5.9 18 7V9C19.1 9 20 9.9 20 11V16C20 17.1 19.1 18 18 18H16V19C16 20.1 15.1 21 14 21H10C8.9 21 8 20.1 8 19V18H6C4.9 18 4 17.1 4 16V11C4 9.9 4.9 9 6 9V7C6 5.9 6.9 5 8 5H10V4C10 2.9 10.9 2 12 2ZM12 4C11.4 4 11 4.4 11 5V6H13V5C13 4.4 12.6 4 12 4ZM8 7V9H16V7H8ZM6 11V16H18V11H6Z" fill="currentColor"/></svg>
                  </div>
                )}

                <div style={{
                  maxWidth: "70%",
                  padding: "0.8rem 1rem",
                  fontSize: "0.86rem",
                  lineHeight: 1.65,
                  borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "4px 16px 16px 16px",
                  background: m.role === "user"
                    ? "linear-gradient(135deg, #14b8a6, #0d9488)"
                    : msgBg,
                  color: m.role === "user" ? "#fff" : tx,
                  border: m.role === "user" ? "none" : `1px solid ${msgBorder}`,
                  boxShadow: m.role === "user" ? "0 4px 16px rgba(20,184,166,0.22)" : "none",
                }}>
                  {m.role === "assistant" && (
                    <p style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "#14b8a6", marginBottom: "0.3rem" }}>GASTOS AI</p>
                  )}
                  <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{m.content}</p>
                </div>

                {m.role === "user" && (
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)", border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.07)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill={txMute}><path d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12ZM12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14Z"/></svg>
                  </div>
                )}
              </div>
            ))}

            {/* Typing indicator */}
            {sending && (
              <div className="chat-msg" style={{ display: "flex", justifyContent: "flex-start", gap: "0.55rem", alignItems: "flex-end" }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(20,184,166,0.12)", border: "1px solid rgba(20,184,166,0.25)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" color="#14b8a6"><path d="M12 2C13.1 2 14 2.9 14 4V5H16C17.1 5 18 5.9 18 7V9C19.1 9 20 9.9 20 11V16C20 17.1 19.1 18 18 18H16V19C16 20.1 15.1 21 14 21H10C8.9 21 8 20.1 8 19V18H6C4.9 18 4 17.1 4 16V11C4 9.9 4.9 9 6 9V7C6 5.9 6.9 5 8 5H10V4C10 2.9 10.9 2 12 2ZM12 4C11.4 4 11 4.4 11 5V6H13V5C13 4.4 12.6 4 12 4ZM8 7V9H16V7H8ZM6 11V16H18V11H6Z" fill="currentColor"/></svg>
                </div>
                <div style={{ padding: "0.8rem 1rem", borderRadius: "4px 16px 16px 16px", background: msgBg, border: `1px solid ${msgBorder}` }}>
                  <p style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "#14b8a6", marginBottom: "0.45rem" }}>GASTOS AI</p>
                  <div style={{ display: "flex", gap: "5px", alignItems: "center" }}>
                    {[0, 1, 2].map(i => (
                      <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#14b8a6", display: "inline-block", animation: `bounce 1.1s ease-in-out infinite`, animationDelay: `${i * 0.18}s` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input bar */}
          <div style={{ position: "relative", zIndex: 1, padding: "0.9rem 1.2rem 1.1rem", borderTop: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.07)", background: isDark ? "rgba(7,9,15,0.6)" : "rgba(255,255,255,0.7)", backdropFilter: "blur(12px)", flexShrink: 0 }}>
            <div style={{ display: "flex", gap: "0.65rem", alignItems: "flex-end" }}>
              <textarea
                ref={textareaRef}
                className="chat-input"
                rows={2}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a question about your spending… (Enter to send)"
                style={{
                  flex: 1, resize: "none", padding: "0.75rem 0.95rem", borderRadius: 12, fontSize: "0.86rem",
                  background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                  border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.09)",
                  color: tx, fontFamily: "inherit",
                }}
              />
              <button
                type="button"
                className="send-btn"
                onClick={() => sendMessage(draft)}
                disabled={!draft.trim() || sending}
                style={{
                  padding: "0.75rem 1.2rem",
                  borderRadius: 12,
                  border: "none",
                  background: !draft.trim() || sending
                    ? isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)"
                    : "linear-gradient(135deg,#14b8a6,#0d9488)",
                  color: !draft.trim() || sending ? txMute : "#fff",
                  fontSize: "0.83rem",
                  fontWeight: 700,
                  cursor: !draft.trim() || sending ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                  flexShrink: 0,
                }}
              >
                {sending ? "…" : "Send →"}
              </button>
            </div>
            <p style={{ fontSize: "0.67rem", color: txMute, marginTop: "0.45rem" }}>
              {expenseCount} expense{expenseCount !== 1 ? "s" : ""} · ₱{Number(budget).toLocaleString()} budget · Shift+Enter for new line
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
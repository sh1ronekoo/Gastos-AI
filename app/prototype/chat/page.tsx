"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePrototypeTheme } from "../prototype-shell";
import { supabase } from "@/lib/supabase";

// ─── Types ───────────────────────────────────────────────────────────────────
type Message    = { role: "user" | "assistant"; content: string };
type ChatSession = { id: string; title: string; created_at: string; updated_at: string; preview?: string };

// ─── Helpers ─────────────────────────────────────────────────────────────────
const SUGGESTIONS = [
  "Where did most of my money go?",
  "Am I on track with my budget?",
  "What should I cut back on?",
  "How much have I spent on food?",
];

function relativeTime(d: string) {
  const diff  = Date.now() - new Date(d).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 1)  return "just now";
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days  < 7)  return `${days}d ago`;
  return new Date(d).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function ChatPage() {
  const { isDark } = usePrototypeTheme();

  // Data
  const [expenses,  setExpenses]  = useState<unknown[]>([]);
  const [budget,    setBudget]    = useState("10000");
  const [userId,    setUserId]    = useState<string | null>(null);

  // Sessions
  const [sessions,        setSessions]        = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages,        setMessages]        = useState<Message[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // UI
  const [draft,       setDraft]       = useState("");
  const [sending,     setSending]     = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [drawerOpen,  setDrawerOpen]  = useState(false);
  const [isMobile,    setIsMobile]    = useState(false);
  const [isTablet,    setIsTablet]    = useState(false);
  const [deletingId,  setDeletingId]  = useState<string | null>(null);

  const bottomRef    = useRef<HTMLDivElement>(null);
  const inputRef     = useRef<HTMLTextAreaElement>(null);
  const chatPanelRef = useRef<HTMLDivElement>(null);
  const touchStartX  = useRef(0);

  // ── Responsive ───────────────────────────────────────────────────────────
  useEffect(() => {
    const check = () => {
      const width  = window.innerWidth;
      const mobile = width < 640;
      const tablet = width >= 640 && width < 1024;
      setIsMobile(mobile);
      setIsTablet(tablet);
      if (mobile) setSidebarOpen(false);
      else setSidebarOpen(true);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => { if (!isMobile) setDrawerOpen(false); }, [isMobile]);

  // ── Swipe to open drawer (mobile) ────────────────────────────────────────
  useEffect(() => {
    if (!isMobile || !chatPanelRef.current) return;
    const handleTouchStart = (e: TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
    const handleTouchEnd   = (e: TouchEvent) => {
      const diff = e.changedTouches[0].clientX - touchStartX.current;
      if (diff > 50 && touchStartX.current < 20) setDrawerOpen(true);
    };
    const panel = chatPanelRef.current;
    panel.addEventListener("touchstart", handleTouchStart);
    panel.addEventListener("touchend",   handleTouchEnd);
    return () => {
      panel.removeEventListener("touchstart", handleTouchStart);
      panel.removeEventListener("touchend",   handleTouchEnd);
    };
  }, [isMobile]);

  // ── Data fetch ───────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
      const { data: exp } = await supabase.from("expenses").select("*").order("created_at", { ascending: false });
      if (exp) setExpenses(exp);
      const month = new Date().toISOString().slice(0, 7);
      const { data: inc } = await supabase.from("incomes").select("amount").eq("month", month);
      setBudget(String((inc ?? []).reduce((s, i) => s + Number(i.amount), 0)));
    })();
  }, []);

  // ── Sessions ─────────────────────────────────────────────────────────────
  const fetchSessions = useCallback(async () => {
    if (!userId) return;
    setLoadingSessions(true);
    const { data } = await supabase
      .from("chat_sessions")
      .select("id, title, created_at, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });
    if (data) {
      const withPrev = await Promise.all(data.map(async s => {
        const { data: msgs } = await supabase
          .from("chat_messages").select("content")
          .eq("session_id", s.id).order("created_at", { ascending: false }).limit(1);
        return { ...s, preview: msgs?.[0]?.content ?? "" };
      }));
      setSessions(withPrev);
    }
    setLoadingSessions(false);
  }, [userId]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  // ── Load messages ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeSessionId) { setMessages([]); return; }
    (async () => {
      setLoadingMessages(true);
      const { data } = await supabase
        .from("chat_messages").select("role, content")
        .eq("session_id", activeSessionId).order("created_at", { ascending: true });
      setMessages((data ?? []) as Message[]);
      setLoadingMessages(false);
    })();
  }, [activeSessionId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, sending]);

  // ── Actions ──────────────────────────────────────────────────────────────
  async function createSession() {
    if (!userId) return null;
    const { data, error } = await supabase
      .from("chat_sessions").insert({ user_id: userId, title: "New conversation" }).select("id").single();
    return error || !data ? null : data.id;
  }

  async function deleteSession(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setDeletingId(id);
    await supabase.from("chat_sessions").delete().eq("id", id);
    setSessions(p => p.filter(s => s.id !== id));
    if (activeSessionId === id) { setActiveSessionId(null); setMessages([]); }
    setDeletingId(null);
  }

  function startNewChat() {
    setActiveSessionId(null); setMessages([]); setDraft("");
    if (isMobile) setDrawerOpen(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function selectSession(id: string) {
    setActiveSessionId(id);
    if (isMobile) setDrawerOpen(false);
  }

  async function sendMessage(content: string) {
    if (!content.trim() || sending) return;
    const trimmed = content.trim();
    setDraft("");
    let sessionId = activeSessionId;
    const isFirstMessage = !sessionId;
    if (!sessionId) {
      sessionId = await createSession();
      if (!sessionId) return;
      setActiveSessionId(sessionId);
    }
    const newMsgs: Message[] = [...messages, { role: "user", content: trimmed }];
    setMessages(newMsgs);
    setSending(true);
    try {
      const res  = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: newMsgs, expenses, budget, sessionId, userId, isFirstMessage }) });
      const data = await res.json();
      if (data.reply) setMessages(p => [...p, { role: "assistant", content: data.reply }]);
    } catch {
      setMessages(p => [...p, { role: "assistant", content: "Sorry, I couldn't connect. Please try again." }]);
    } finally {
      setSending(false);
      setTimeout(fetchSessions, 600);
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(draft); }
  }

  // ── Open main nav drawer via custom event (picked up by prototype-shell) ──
  function openMainNav() {
    window.dispatchEvent(new CustomEvent("open-mobile-nav"));
  }

  // ── Theme ─────────────────────────────────────────────────────────────────
  const bg        = isDark ? "#07090f"                : "#f1f5f9";
  const sideBg    = isDark ? "#0d1117"                : "#ffffff";
  const chatBg    = isDark ? "#07090f"                : "#f8fafc";
  const divider   = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)";
  const tx        = isDark ? "#e2e8f0"                : "#0f172a";
  const txSub     = isDark ? "#94a3b8"                : "#64748b";
  const txMute    = isDark ? "#475569"                : "#94a3b8";
  const msgBg     = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)";
  const msgBorder = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.08)";
  const inputBg   = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)";
  const inputBar  = isDark ? "rgba(13,17,23,0.95)"    : "rgba(255,255,255,0.95)";
  const hoverBg   = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)";
  const activeBg  = isDark ? "rgba(20,184,166,0.1)"   : "rgba(20,184,166,0.08)";

  const expenseCount = (expenses as unknown[]).length;
  const showSidebar  = !isMobile && sidebarOpen;
  const SIDEBAR_W    = isTablet ? 220 : 260;

  // ── Sidebar content ───────────────────────────────────────────────────────
  function SidebarContent() {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ padding: "1rem 1rem 0.85rem", borderBottom: `1px solid ${divider}`, flexShrink: 0 }}>
          {isMobile && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
              <span style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: txMute }}>Chat History</span>
              <button type="button" onClick={() => setDrawerOpen(false)}
                style={{ width: 28, height: 28, borderRadius: 7, border: `1px solid ${divider}`, background: "none", color: txMute, cursor: "pointer", display: "grid", placeItems: "center" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
              </button>
            </div>
          )}
          {!isMobile && (
            <span style={{ display: "block", fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: txMute, marginBottom: "0.75rem" }}>Chat History</span>
          )}
          <button type="button" onClick={startNewChat}
            style={{ width: "100%", padding: "0.55rem 0.85rem", borderRadius: 10, border: "1px solid rgba(20,184,166,0.28)", background: "rgba(20,184,166,0.07)", color: "#14b8a6", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem", transition: "background 0.15s, transform 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(20,184,166,0.14)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(20,184,166,0.07)"; e.currentTarget.style.transform = "translateY(0)"; }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
            New Chat
          </button>
        </div>

        {/* Session list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0.5rem 0.6rem" }} className="sidebar-scroll">
          {loadingSessions ? (
            [1,2,3].map(i => (
              <div key={i} style={{ padding: "0.65rem 0.6rem", marginBottom: 3 }}>
                <div className="skeleton" style={{ height: 10, width: "65%", marginBottom: 6, borderRadius: 5 }} />
                <div className="skeleton" style={{ height: 8,  width: "88%", borderRadius: 5 }} />
              </div>
            ))
          ) : sessions.length === 0 ? (
            <div style={{ padding: "2.5rem 1rem", textAlign: "center" }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)", display: "grid", placeItems: "center", margin: "0 auto 0.75rem" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke={txMute} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <p style={{ fontSize: "0.78rem", color: txSub, fontWeight: 600 }}>No conversations yet</p>
              <p style={{ fontSize: "0.7rem", color: txMute, marginTop: "0.25rem" }}>Start a chat to begin</p>
            </div>
          ) : (
            sessions.map(s => (
              <div key={s.id} onClick={() => selectSession(s.id)}
                style={{ padding: "0.6rem 0.65rem", marginBottom: 2, borderRadius: 10, display: "flex", alignItems: "flex-start", gap: "0.5rem", cursor: "pointer", background: activeSessionId === s.id ? activeBg : "transparent", transition: "background 0.15s", outline: activeSessionId === s.id ? "1px solid rgba(20,184,166,0.2)" : "none" }}
                onMouseEnter={e => { if (activeSessionId !== s.id) e.currentTarget.style.background = hoverBg; }}
                onMouseLeave={e => { if (activeSessionId !== s.id) e.currentTarget.style.background = "transparent"; }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: activeSessionId === s.id ? "rgba(20,184,166,0.15)" : isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)", display: "grid", placeItems: "center", flexShrink: 0, marginTop: 1 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke={activeSessionId === s.id ? "#14b8a6" : txMute} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.25rem" }}>
                    <p style={{ fontSize: "0.77rem", fontWeight: 600, color: activeSessionId === s.id ? "#14b8a6" : tx, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>
                      {s.title}
                    </p>
                    <button type="button" onClick={e => deleteSession(s.id, e)} disabled={deletingId === s.id}
                      style={{ opacity: 0, fontSize: "0.72rem", background: "none", border: "none", cursor: "pointer", color: txMute, padding: "2px 4px", borderRadius: 4, flexShrink: 0, transition: "opacity 0.15s, color 0.15s" }}
                      onMouseEnter={e => { e.currentTarget.style.color = "#f87171"; e.currentTarget.style.background = "rgba(239,68,68,0.08)"; }}
                      onMouseLeave={e => { e.currentTarget.style.color = txMute; e.currentTarget.style.background = "none"; }}
                      className="del-btn">
                      {deletingId === s.id ? "…" : "✕"}
                    </button>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "0.15rem", gap: "0.3rem" }}>
                    <p style={{ fontSize: "0.67rem", color: txMute, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>
                      {s.preview || "No messages yet"}
                    </p>
                    <span style={{ fontSize: "0.6rem", color: txMute, flexShrink: 0 }}>{relativeTime(s.updated_at)}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "0.7rem 1rem", borderTop: `1px solid ${divider}`, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", flexShrink: 0, boxShadow: "0 0 6px rgba(34,197,94,0.5)" }} />
            <p style={{ fontSize: "0.67rem", color: txMute }}>
              {expenseCount} expense{expenseCount !== 1 ? "s" : ""} · ₱{Number(budget).toLocaleString()} budget
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <style suppressHydrationWarning>{`
        @keyframes fadeIn      { from{opacity:0} to{opacity:1} }
        @keyframes slideInLeft { from{transform:translateX(-100%)} to{transform:translateX(0)} }
        @keyframes fadeUp      { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes msgIn       { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:translateY(0)} }
        @keyframes bounce      { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
        @keyframes ping        { 0%,100%{transform:scale(1);opacity:0.5} 50%{transform:scale(2.2);opacity:0} }
        @keyframes pulse       { 0%,100%{transform:scale(1)} 50%{transform:scale(1.04)} }
        @keyframes dotPulse    { 0%,100%{opacity:0.3;transform:translateY(0)} 50%{opacity:1;transform:translateY(-2px)} }
        @keyframes shimmer     { 0%,100%{opacity:0.4} 50%{opacity:0.7} }

        .chat-msg     { animation: msgIn 0.26s cubic-bezier(0.22,1,0.36,1) both; }
        .triple-dot   { animation: dotPulse 1.2s ease-in-out infinite; transform-origin: center; }
        .skeleton     { animation: shimmer 1.5s ease-in-out infinite; background: ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}; }

        .session-row:hover .del-btn { opacity: 1 !important; }

        .msg-area::-webkit-scrollbar       { width: 4px; }
        .msg-area::-webkit-scrollbar-track { background: transparent; }
        .msg-area::-webkit-scrollbar-thumb { background: rgba(100,116,139,0.18); border-radius: 99px; }

        .sidebar-scroll::-webkit-scrollbar       { width: 3px; }
        .sidebar-scroll::-webkit-scrollbar-thumb { background: rgba(100,116,139,0.12); border-radius: 99px; }

        .sug-btn { transition: background 0.14s, border-color 0.14s, color 0.14s, transform 0.14s; }
        .sug-btn:hover { background: rgba(20,184,166,0.09) !important; border-color: rgba(20,184,166,0.32) !important; color: #14b8a6 !important; transform: translateY(-1px); }

        .send-btn { transition: transform 0.16s cubic-bezier(0.22,1,0.36,1), box-shadow 0.16s, background 0.14s; }
        .send-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 22px rgba(20,184,166,0.28); }
        .send-btn:active:not(:disabled){ transform: translateY(0); }

        .chat-input { transition: border-color 0.18s, box-shadow 0.18s; }
        .chat-input:focus { border-color: rgba(20,184,166,0.45) !important; box-shadow: 0 0 0 3px rgba(20,184,166,0.07) !important; outline: none; }

        .toggle-btn { transition: background 0.14s; border-radius: 8px; }
        .toggle-btn:hover { background: rgba(20,184,166,0.09) !important; }

        .nav-btn { transition: background 0.14s, color 0.14s; }
        .nav-btn:hover { background: ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"} !important; }

        .mob-backdrop { position: fixed; inset: 0; z-index: 45; background: rgba(0,0,0,0.55); backdrop-filter: blur(4px); animation: fadeIn 0.2s ease both; }
        .mob-drawer   { position: fixed; top: 0; left: 0; bottom: 0; z-index: 50; width: min(${SIDEBAR_W}px, 85vw); background: ${sideBg}; border-right: 1px solid ${divider}; animation: slideInLeft 0.24s cubic-bezier(0.22,1,0.36,1) both; box-shadow: 4px 0 24px rgba(0,0,0,0.35); }
      `}</style>

      {/* Mobile backdrop */}
      {isMobile && drawerOpen && <div className="mob-backdrop" onClick={() => setDrawerOpen(false)} />}

      {/* Mobile chat-history drawer */}
      {isMobile && drawerOpen && (
        <div className="mob-drawer">
          <SidebarContent />
        </div>
      )}

      {/* ── Root layout ── */}
      <div style={{ display: "flex", height: "100vh", width: "100%", overflow: "hidden", background: bg }}>

        {/* Desktop sidebar */}
        {showSidebar && (
          <div style={{ width: SIDEBAR_W, flexShrink: 0, height: "100%", background: sideBg, borderRight: `1px solid ${divider}`, overflow: "hidden", animation: "fadeIn 0.2s ease both" }}>
            <SidebarContent />
          </div>
        )}

        {/* Chat panel */}
        <div ref={chatPanelRef} style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: chatBg, position: "relative" }}>

          {/* Ambient dot grid */}
          <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(20,184,166,0.038) 1px, transparent 1px)", backgroundSize: "26px 26px", pointerEvents: "none", zIndex: 0 }} />

          {/* ── Top bar ── */}
          <div style={{
            position: isMobile ? "fixed" : "relative",
            top:   isMobile ? 0 : undefined,
            left:  isMobile ? 0 : undefined,
            right: isMobile ? 0 : undefined,
            zIndex: isMobile ? 35 : 2,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: isMobile ? "0 0.75rem" : isTablet ? "0 1.25rem" : "0 1.5rem",
            height: 58, borderBottom: `1px solid ${divider}`,
            background: isDark ? "rgba(7,9,15,0.92)" : "rgba(248,250,252,0.95)",
            backdropFilter: "blur(16px)", flexShrink: 0,
          }}>

            {/* ── Left: chat history toggle ── */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <div style={{ position: "relative" }}>
                <button type="button" className="toggle-btn"
                  onClick={() => isMobile ? setDrawerOpen(true) : setSidebarOpen(v => !v)}
                  style={{
                    position: "relative", width: 34, height: 34,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    padding: 0,
                    background: isMobile ? (drawerOpen ? "rgba(20,184,166,0.1)" : "none") : "none",
                    border: isMobile ? (drawerOpen ? "1px solid rgba(20,184,166,0.3)" : "none") : "none",
                    cursor: "pointer",
                    color: isMobile && drawerOpen ? "#14b8a6" : txMute,
                    borderRadius: 8, transition: "all 0.15s",
                  }}
                  title="View chat history">
                  {/* Chat bubble icon */}
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>

              {/* Avatar + title (desktop / tablet) */}
              {!isMobile && (
                <>
                  <div style={{ position: "relative", width: 34, height: 34, borderRadius: 10, background: "rgba(20,184,166,0.11)", border: "1px solid rgba(20,184,166,0.24)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" color="#14b8a6">
                      <path d="M12 2C13.1 2 14 2.9 14 4V5H16C17.1 5 18 5.9 18 7V9C19.1 9 20 9.9 20 11V16C20 17.1 19.1 18 18 18H16V19C16 20.1 15.1 21 14 21H10C8.9 21 8 20.1 8 19V18H6C4.9 18 4 17.1 4 16V11C4 9.9 4.9 9 6 9V7C6 5.9 6.9 5 8 5H10V4C10 2.9 10.9 2 12 2ZM12 4C11.4 4 11 4.4 11 5V6H13V5C13 4.4 12.6 4 12 4ZM8 7V9H16V7H8ZM6 11V16H18V11H6Z" fill="currentColor"/>
                    </svg>
                    <span style={{ position: "absolute", bottom: -2, right: -2, width: 9, height: 9, borderRadius: "50%", background: isDark ? "#07090f" : "#f8fafc", display: "grid", placeItems: "center" }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#22c55e", display: "block" }} />
                    </span>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <span style={{ fontSize: "0.84rem", fontWeight: 700, color: tx, whiteSpace: "nowrap" }}>Gastos AI</span>
                      <span style={{ padding: "0.1rem 0.42rem", borderRadius: 999, fontSize: "0.57rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", background: "rgba(20,184,166,0.09)", border: "1px solid rgba(20,184,166,0.2)", color: "#14b8a6", whiteSpace: "nowrap" }}>
                        Live · Gemini
                      </span>
                    </div>
                    <p style={{ fontSize: "0.66rem", color: txMute, marginTop: "0.05rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 320 }}>
                      {activeSessionId
                        ? (sessions.find(s => s.id === activeSessionId)?.title ?? "Conversation")
                        : "Your AI financial companion"}
                    </p>
                  </div>
                </>
              )}

              {/* Center title (mobile only) */}
              {isMobile && (
                <div style={{ minWidth: 0 }}>
                  <span style={{ fontSize: "0.84rem", fontWeight: 700, color: tx, whiteSpace: "nowrap" }}>Gastos AI</span>
                  <p style={{ fontSize: "0.63rem", color: txMute, marginTop: "0.05rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 140 }}>
                    {activeSessionId
                      ? (sessions.find(s => s.id === activeSessionId)?.title ?? "Conversation")
                      : "Your AI financial companion"}
                  </p>
                </div>
              )}
            </div>

            {/* ── Right: Online dot + (mobile) main-nav hamburger ── */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
              {/* Online indicator */}
              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                <span style={{ position: "relative", display: "inline-flex", width: 8, height: 8 }}>
                  <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "#14b8a6", animation: "ping 2s ease-in-out infinite", opacity: 0.45 }} />
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#14b8a6", display: "block", position: "relative" }} />
                </span>
                {!isMobile && <span style={{ fontSize: "0.68rem", color: txMute }}>Online</span>}
              </div>

              {/* Mobile-only: open main nav sidebar */}
              {isMobile && (
                <button
                  type="button"
                  className="nav-btn"
                  onClick={openMainNav}
                  title="Open navigation"
                  style={{
                    width: 34, height: 34, borderRadius: 9,
                    background: "none",
                    border: `1px solid ${divider}`,
                    cursor: "pointer", color: txMute,
                    display: "grid", placeItems: "center",
                  }}
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="6"  width="18" height="2" rx="1" fill="currentColor"/>
                    <rect x="3" y="11" width="12" height="2" rx="1" fill="currentColor"/>
                    <rect x="3" y="16" width="15" height="2" rx="1" fill="currentColor"/>
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* ── Messages ── */}
          <div className="msg-area" style={{
            flex: 1, overflowY: "auto",
            padding: isMobile ? "calc(58px + 1rem) 0.9rem 1rem"
                    : isTablet ? "1.25rem 1.5rem"
                    : "1.5rem 2rem",
            display: "flex", flexDirection: "column", gap: "1rem",
            position: "relative", zIndex: 1,
          }}>

            {/* Loading skeleton */}
            {loadingMessages && [1,2,3].map(i => (
              <div key={i} style={{ display: "flex", justifyContent: i % 2 === 0 ? "flex-end" : "flex-start" }}>
                <div className="skeleton" style={{ height: 52, width: `${40 + i * 12}%`, borderRadius: 14 }} />
              </div>
            ))}

            {/* Empty state */}
            {!loadingMessages && messages.length === 0 && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1.5rem", padding: "2rem 1rem", animation: "fadeUp 0.4s cubic-bezier(0.22,1,0.36,1) both" }}>
                <div style={{ position: "relative" }}>
                  <div style={{ width: 70, height: 70, borderRadius: 22, background: "rgba(20,184,166,0.09)", border: "1px solid rgba(20,184,166,0.2)", display: "grid", placeItems: "center", animation: "pulse 3s ease-in-out infinite" }}>
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" color="#14b8a6">
                      <rect x="3" y="6" width="18" height="11" rx="5" fill="currentColor" opacity="0.1"/>
                      <circle className="triple-dot" style={{ animationDelay: "0s" }}    cx="8"  cy="11.5" r="1.5" fill="currentColor"/>
                      <circle className="triple-dot" style={{ animationDelay: "0.15s" }} cx="12" cy="11.5" r="1.5" fill="currentColor"/>
                      <circle className="triple-dot" style={{ animationDelay: "0.3s" }}  cx="16" cy="11.5" r="1.5" fill="currentColor"/>
                    </svg>
                  </div>
                  <div style={{ position: "absolute", top: -5, right: -5, width: 20, height: 20, borderRadius: "50%", background: "rgba(20,184,166,0.13)", border: "1px solid rgba(20,184,166,0.28)", display: "grid", placeItems: "center" }}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="#14b8a6"><path d="M12 2l1.09 6.26L19 9l-5.91.74L12 16l-1.09-6.26L5 9l5.91-.74L12 2z"/></svg>
                  </div>
                </div>
                <div style={{ textAlign: "center", maxWidth: 380 }}>
                  <p style={{ fontSize: isMobile ? "0.97rem" : isTablet ? "1rem" : "1.05rem", fontWeight: 700, color: tx, marginBottom: "0.4rem", letterSpacing: "-0.01em" }}>
                    Ask me anything about your finances
                  </p>
                  <p style={{ fontSize: "0.78rem", color: txMute, lineHeight: 1.5 }}>
                    I can see your{" "}
                    <span style={{ color: "#14b8a6", fontWeight: 600 }}>{expenseCount} expense{expenseCount !== 1 ? "s" : ""}</span>
                    {" "}and{" "}
                    <span style={{ color: "#14b8a6", fontWeight: 600 }}>₱{Number(budget).toLocaleString()}</span> budget
                  </p>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0.45rem", maxWidth: 500 }}>
                  {SUGGESTIONS.map((s, i) => (
                    <button key={s} type="button" className="sug-btn" onClick={() => sendMessage(s)}
                      style={{ padding: "0.48rem 0.95rem", borderRadius: 999, fontSize: isMobile ? "0.75rem" : isTablet ? "0.77rem" : "0.79rem", fontWeight: 500, background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)", border: `1px solid ${isDark ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.09)"}`, color: txSub, cursor: "pointer", fontFamily: "inherit", animation: "fadeUp 0.38s cubic-bezier(0.22,1,0.36,1) both", animationDelay: `${0.07 + i * 0.06}s` }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Message bubbles */}
            {!loadingMessages && messages.map((m, i) => (
              <div key={i} className="chat-msg" style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", gap: "0.5rem", alignItems: "flex-end" }}>
                {m.role === "assistant" && (
                  <div style={{ width: 26, height: 26, borderRadius: 8, background: "rgba(20,184,166,0.11)", border: "1px solid rgba(20,184,166,0.24)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" color="#14b8a6"><path d="M12 2C13.1 2 14 2.9 14 4V5H16C17.1 5 18 5.9 18 7V9C19.1 9 20 9.9 20 11V16C20 17.1 19.1 18 18 18H16V19C16 20.1 15.1 21 14 21H10C8.9 21 8 20.1 8 19V18H6C4.9 18 4 17.1 4 16V11C4 9.9 4.9 9 6 9V7C6 5.9 6.9 5 8 5H10V4C10 2.9 10.9 2 12 2ZM12 4C11.4 4 11 4.4 11 5V6H13V5C13 4.4 12.6 4 12 4ZM8 7V9H16V7H8ZM6 11V16H18V11H6Z" fill="currentColor"/></svg>
                  </div>
                )}
                <div style={{ maxWidth: isMobile ? "84%" : isTablet ? "72%" : "68%", padding: isMobile ? "0.7rem 0.9rem" : "0.85rem 1.05rem", fontSize: isMobile ? "0.84rem" : "0.875rem", lineHeight: 1.65, borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "4px 16px 16px 16px", background: m.role === "user" ? "linear-gradient(135deg,#14b8a6,#0d9488)" : msgBg, color: m.role === "user" ? "#fff" : tx, border: m.role === "user" ? "none" : `1px solid ${msgBorder}`, boxShadow: m.role === "user" ? "0 4px 18px rgba(20,184,166,0.2)" : "none" }}>
                  {m.role === "assistant" && (
                    <p style={{ fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#14b8a6", marginBottom: "0.28rem" }}>GASTOS AI</p>
                  )}
                  <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{m.content}</p>
                </div>
                {m.role === "user" && (
                  <div style={{ width: 26, height: 26, borderRadius: 8, background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)", border: `1px solid ${isDark ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.07)"}`, display: "grid", placeItems: "center", flexShrink: 0 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill={txMute}><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                  </div>
                )}
              </div>
            ))}

            {/* Typing indicator */}
            {sending && (
              <div className="chat-msg" style={{ display: "flex", justifyContent: "flex-start", gap: "0.5rem", alignItems: "flex-end" }}>
                <div style={{ width: 26, height: 26, borderRadius: 8, background: "rgba(20,184,166,0.11)", border: "1px solid rgba(20,184,166,0.24)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" color="#14b8a6"><path d="M12 2C13.1 2 14 2.9 14 4V5H16C17.1 5 18 5.9 18 7V9C19.1 9 20 9.9 20 11V16C20 17.1 19.1 18 18 18H16V19C16 20.1 15.1 21 14 21H10C8.9 21 8 20.1 8 19V18H6C4.9 18 4 17.1 4 16V11C4 9.9 4.9 9 6 9V7C6 5.9 6.9 5 8 5H10V4C10 2.9 10.9 2 12 2ZM12 4C11.4 4 11 4.4 11 5V6H13V5C13 4.4 12.6 4 12 4ZM8 7V9H16V7H8ZM6 11V16H18V11H6Z" fill="currentColor"/></svg>
                </div>
                <div style={{ padding: "0.75rem 1rem", borderRadius: "4px 16px 16px 16px", background: msgBg, border: `1px solid ${msgBorder}` }}>
                  <p style={{ fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#14b8a6", marginBottom: "0.4rem" }}>GASTOS AI</p>
                  <div style={{ display: "flex", gap: "5px", alignItems: "center" }}>
                    {[0,1,2].map(j => <span key={j} style={{ width: 6, height: 6, borderRadius: "50%", background: "#14b8a6", display: "inline-block", animation: "bounce 1.1s ease-in-out infinite", animationDelay: `${j * 0.18}s` }} />)}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* ── Input bar ── */}
          <div style={{ position: "relative", zIndex: 2, padding: isMobile ? "0.75rem 0.9rem 0.9rem" : isTablet ? "0.85rem 1.5rem 1rem" : "0.9rem 2rem 1rem", borderTop: `1px solid ${divider}`, background: inputBar, backdropFilter: "blur(16px)", flexShrink: 0 }}>
            <div style={{ display: "flex", gap: "0.6rem", alignItems: "flex-end", maxWidth: 860, margin: "0 auto" }}>
              <textarea ref={inputRef} className="chat-input" rows={isMobile ? 1 : 2} value={draft}
                onChange={e => setDraft(e.target.value)} onKeyDown={handleKey}
                placeholder={isMobile ? "Ask about your spending…" : "Type a question about your spending… (Enter to send)"}
                style={{ flex: 1, resize: "none", padding: isMobile ? "0.65rem 0.85rem" : isTablet ? "0.7rem 0.95rem" : "0.75rem 1rem", borderRadius: 13, fontSize: isMobile ? "0.85rem" : isTablet ? "0.87rem" : "0.875rem", background: inputBg, border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.09)"}`, color: tx, fontFamily: "inherit" }}
              />
              <button type="button" className="send-btn" onClick={() => sendMessage(draft)} disabled={!draft.trim() || sending}
                style={{ padding: isMobile ? "0.65rem 1rem" : isTablet ? "0.7rem 1.15rem" : "0.75rem 1.25rem", borderRadius: 13, border: "none", background: !draft.trim() || sending ? isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)" : "linear-gradient(135deg,#14b8a6,#0d9488)", color: !draft.trim() || sending ? txMute : "#fff", fontSize: "0.84rem", fontWeight: 700, cursor: !draft.trim() || sending ? "not-allowed" : "pointer", fontFamily: "inherit", flexShrink: 0, whiteSpace: "nowrap" }}>
                {sending ? "…" : isMobile ? "→" : "Send →"}
              </button>
            </div>
            {!isMobile && (
              <p style={{ fontSize: "0.66rem", color: txMute, marginTop: "0.4rem", textAlign: "center" }}>
                {expenseCount} expense{expenseCount !== 1 ? "s" : ""} · ₱{Number(budget).toLocaleString()} budget · Shift+Enter for new line
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
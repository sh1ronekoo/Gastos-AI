"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";

export const PrototypeThemeContext = createContext<{ isDark: boolean } | null>(null);

export function usePrototypeTheme() {
  const ctx = useContext(PrototypeThemeContext);
  if (!ctx) throw new Error("usePrototypeTheme must be used inside the prototype area.");
  return ctx;
}

type NavItem = { href: string; label: string; icon: string };

const navItems: NavItem[] = [
  { href: "/prototype",          label: "Dashboard", icon: "▦" },
  { href: "/prototype/chat",     label: "Chat",      icon: "💬" },
  { href: "/prototype/insights", label: "Insights",  icon: "📈" },
];

function SideNavItem({
  item,
  active,
  isDark,
  collapsed,
}: {
  item: NavItem;
  active: boolean;
  isDark: boolean;
  collapsed: boolean;
}) {
  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
      style={{
        background: active
          ? isDark ? "rgba(20,184,166,0.15)" : "rgba(20,184,166,0.1)"
          : "transparent",
        color: active
          ? isDark ? "#5eead4" : "#0f766e"
          : isDark ? "#94a3b8" : "#64748b",
        boxShadow: active
          ? isDark ? "inset 0 0 0 1px rgba(20,184,166,0.3)" : "inset 0 0 0 1px rgba(20,184,166,0.25)"
          : "none",
      }}
    >
      <span style={{ fontSize: "1rem", flexShrink: 0, lineHeight: 1 }}>{item.icon}</span>
      {!collapsed && <span style={{ whiteSpace: "nowrap", overflow: "hidden" }}>{item.label}</span>}
    </Link>
  );
}

export default function PrototypeShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isDark, setIsDark] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (!session) { router.replace("/login"); return; }
      setUserEmail(session.user.email ?? null);
      setSessionReady(true);
    });
    return () => { cancelled = true; };
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (!sessionReady) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: isDark ? "#020617" : "#f8fafc" }}>
        <p style={{ color: isDark ? "#94a3b8" : "#64748b", fontSize: "0.9rem" }}>Loading…</p>
      </div>
    );
  }

  const bg       = isDark ? "#020617" : "#f1f5f9";
  const sidebar  = isDark ? "#0f172a" : "#ffffff";
  const border   = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)";
  const textBase = isDark ? "#e2e8f0" : "#0f172a";
  const textMute = isDark ? "#64748b" : "#94a3b8";
  const sideW    = collapsed ? 64 : 220;

  return (
    <PrototypeThemeContext.Provider value={{ isDark }}>
      <>
        <style suppressHydrationWarning>{`
          .proto-main::-webkit-scrollbar { width: 6px; }
          .proto-main::-webkit-scrollbar-track { background: transparent; }
          .proto-main::-webkit-scrollbar-thumb { background: rgba(100,116,139,0.3); border-radius: 999px; }
          .sidebar-link:hover { background: ${isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)"} !important; color: ${isDark ? "#e2e8f0" : "#0f172a"} !important; }
          .logout-btn:hover { background: ${isDark ? "rgba(239,68,68,0.12)" : "rgba(239,68,68,0.07)"} !important; color: #ef4444 !important; }
          .theme-btn:hover { background: ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"} !important; }
          .collapse-btn:hover { background: ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"} !important; }
          @media (max-width: 768px) {
            .proto-sidebar { display: none !important; }
            .proto-topbar  { display: flex !important; }
            .proto-content { margin-left: 0 !important; }
          }
        `}</style>

        <div style={{ display: "flex", minHeight: "100vh", background: bg, color: textBase, transition: "background 0.3s, color 0.3s" }}>

          {/* ── SIDEBAR ── */}
          <aside
            className="proto-sidebar"
            style={{
              position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 30,
              width: sideW,
              background: sidebar,
              borderRight: `1px solid ${border}`,
              display: "flex", flexDirection: "column",
              transition: "width 0.25s cubic-bezier(0.22,1,0.36,1)",
              overflow: "hidden",
            }}
          >
            {/* Brand */}
            <div style={{ padding: collapsed ? "1.2rem 0" : "1.2rem 1rem", display: "flex", alignItems: "center", gap: "0.65rem", borderBottom: `1px solid ${border}`, flexShrink: 0, justifyContent: collapsed ? "center" : "flex-start" }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(20,184,166,0.15)", border: "1px solid rgba(20,184,166,0.3)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                <Image src="/web-logo.png" alt="Gastos AI" width={18} height={18} />
              </div>
              {!collapsed && (
                <div style={{ overflow: "hidden" }}>
                  <div style={{ fontWeight: 800, fontSize: "0.85rem", letterSpacing: "0.06em", color: "#14b8a6", whiteSpace: "nowrap" }}>GASTOS AI</div>
                  <div style={{ fontSize: "0.65rem", color: textMute, whiteSpace: "nowrap" }}>Smart Expense Tracker</div>
                </div>
              )}
            </div>

            {/* Nav items */}
            <nav style={{ flex: 1, padding: "0.75rem 0.6rem", display: "flex", flexDirection: "column", gap: "0.2rem", overflowY: "auto" }}>
              {!collapsed && (
                <p style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", color: textMute, textTransform: "uppercase", padding: "0.3rem 0.6rem 0.5rem" }}>
                  Menu
                </p>
              )}
              {navItems.map((item) => (
                <SideNavItem
                  key={item.href}
                  item={item}
                  active={pathname === item.href}
                  isDark={isDark}
                  collapsed={collapsed}
                />
              ))}
            </nav>

            {/* Bottom section */}
            <div style={{ padding: "0.75rem 0.6rem", borderTop: `1px solid ${border}`, display: "flex", flexDirection: "column", gap: "0.3rem", flexShrink: 0 }}>

              {/* User info */}
              {!collapsed && userEmail && (
                <div style={{ padding: "0.5rem 0.75rem", marginBottom: "0.2rem" }}>
                  <div style={{ fontSize: "0.65rem", color: textMute, marginBottom: "0.15rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>Signed in as</div>
                  <div style={{ fontSize: "0.75rem", color: textBase, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userEmail}</div>
                </div>
              )}

              {/* Theme toggle */}
              <button
                type="button"
                className="theme-btn"
                onClick={() => setIsDark(p => !p)}
                title={isDark ? "Switch to light mode" : "Switch to dark mode"}
                style={{ display: "flex", alignItems: "center", gap: "0.65rem", padding: collapsed ? "0.6rem" : "0.6rem 0.75rem", borderRadius: 10, background: "transparent", border: "none", cursor: "pointer", color: textMute, fontSize: "0.82rem", fontWeight: 600, fontFamily: "inherit", justifyContent: collapsed ? "center" : "flex-start", transition: "background 0.15s, color 0.15s", width: "100%" }}
              >
                <span style={{ fontSize: "1rem", flexShrink: 0 }}>{isDark ? "☀️" : "🌙"}</span>
                {!collapsed && <span>{isDark ? "Light Mode" : "Dark Mode"}</span>}
              </button>

              {/* Logout */}
              <button
                type="button"
                className="logout-btn"
                onClick={handleLogout}
                title="Logout"
                style={{ display: "flex", alignItems: "center", gap: "0.65rem", padding: collapsed ? "0.6rem" : "0.6rem 0.75rem", borderRadius: 10, background: "transparent", border: "none", cursor: "pointer", color: textMute, fontSize: "0.82rem", fontWeight: 600, fontFamily: "inherit", justifyContent: collapsed ? "center" : "flex-start", transition: "background 0.15s, color 0.15s", width: "100%" }}
              >
                <span style={{ fontSize: "1rem", flexShrink: 0 }}>🚪</span>
                {!collapsed && <span>Logout</span>}
              </button>

              {/* Collapse toggle */}
              <button
                type="button"
                className="collapse-btn"
                onClick={() => setCollapsed(p => !p)}
                title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                style={{ display: "flex", alignItems: "center", gap: "0.65rem", padding: collapsed ? "0.6rem" : "0.6rem 0.75rem", borderRadius: 10, background: "transparent", border: "none", cursor: "pointer", color: textMute, fontSize: "0.82rem", fontWeight: 600, fontFamily: "inherit", justifyContent: collapsed ? "center" : "flex-start", transition: "background 0.15s, color 0.15s", width: "100%" }}
              >
                <span style={{ fontSize: "0.9rem", flexShrink: 0, display: "inline-block", transform: collapsed ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.25s" }}>◀</span>
                {!collapsed && <span>Collapse</span>}
              </button>
            </div>
          </aside>

          {/* ── MOBILE TOPBAR ── */}
          <header
            className="proto-topbar"
            style={{
              display: "none",
              position: "fixed", top: 0, left: 0, right: 0, zIndex: 30,
              height: 56,
              background: sidebar,
              borderBottom: `1px solid ${border}`,
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 1rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: "rgba(20,184,166,0.15)", border: "1px solid rgba(20,184,166,0.3)", display: "grid", placeItems: "center" }}>
                <Image src="/web-logo.png" alt="Gastos AI" width={16} height={16} />
              </div>
              <span style={{ fontWeight: 800, fontSize: "0.82rem", letterSpacing: "0.06em", color: "#14b8a6" }}>GASTOS AI</span>
            </div>
            <nav style={{ display: "flex", gap: "0.25rem" }}>
              {navItems.map(item => (
                <Link key={item.href} href={item.href}
                  style={{ padding: "0.35rem 0.65rem", borderRadius: 8, fontSize: "0.78rem", fontWeight: 600, color: pathname === item.href ? "#14b8a6" : textMute, background: pathname === item.href ? "rgba(20,184,166,0.1)" : "transparent", textDecoration: "none" }}>
                  {item.label}
                </Link>
              ))}
            </nav>
            <div style={{ display: "flex", gap: "0.4rem" }}>
              <button type="button" onClick={() => setIsDark(p => !p)} style={{ padding: "0.35rem 0.6rem", borderRadius: 8, fontSize: "0.75rem", fontWeight: 600, background: "transparent", border: `1px solid ${border}`, color: textMute, cursor: "pointer", fontFamily: "inherit" }}>
                {isDark ? "☀️" : "🌙"}
              </button>
              <button type="button" onClick={handleLogout} style={{ padding: "0.35rem 0.6rem", borderRadius: 8, fontSize: "0.75rem", fontWeight: 600, background: "transparent", border: `1px solid ${border}`, color: textMute, cursor: "pointer", fontFamily: "inherit" }}>
                Out
              </button>
            </div>
          </header>

          {/* ── MAIN CONTENT ── */}
          <main
            className="proto-main proto-content"
            style={{
              marginLeft: sideW,
              flex: 1,
              minHeight: "100vh",
              overflowY: "auto",
              transition: "margin-left 0.25s cubic-bezier(0.22,1,0.36,1)",
              paddingTop: "0",
            }}
          >
            {/* Page header bar */}
            <div style={{
              position: "sticky", top: 0, zIndex: 20,
              background: isDark ? "rgba(2,6,23,0.85)" : "rgba(241,245,249,0.85)",
              backdropFilter: "blur(12px)",
              borderBottom: `1px solid ${border}`,
              padding: "0.75rem 2rem",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div>
                <p style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#14b8a6", marginBottom: "0.1rem" }}>
                  {navItems.find(n => n.pathname === pathname)?.label ?? navItems.find(n => pathname.startsWith(n.href))?.label ?? "Dashboard"}
                </p>
                <h1 style={{ fontSize: "1.15rem", fontWeight: 700, color: textBase, margin: 0 }}>
                  {pathname === "/prototype" && "Expense Dashboard"}
                  {pathname === "/prototype/chat" && "AI Chat"}
                  {pathname === "/prototype/insights" && "Insights"}
                </h1>
              </div>
              <div style={{ fontSize: "0.78rem", color: textMute }}>
                {new Date().toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
              </div>
            </div>

            {/* Page content */}
            <div style={{ maxWidth: 1200, margin: "0 auto", padding: "2rem" }}>
              {children}
            </div>
          </main>
        </div>
      </>
    </PrototypeThemeContext.Provider>
  );
}
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

// ── SVG Icons ────────────────────────────────────────────────
function IconSun({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="2" x2="12" y2="4" /><line x1="12" y1="20" x2="12" y2="22" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="2" y1="12" x2="4" y2="12" /><line x1="20" y1="12" x2="22" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}
function IconMoon({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}
function IconLogout({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
function IconChevronLeft({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}
function IconGrid({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}
function IconMessage({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
function IconTrendingUp({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
    </svg>
  );
}
function IconMenu({ size = 18, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}
function IconX({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

// ── Nav config ───────────────────────────────────────────────
type NavItem = { href: string; label: string; Icon: React.FC<{ size?: number; color?: string }> };
const navItems: NavItem[] = [
  { href: "/prototype",          label: "Dashboard", Icon: IconGrid },
  { href: "/prototype/chat",     label: "Chat",      Icon: IconMessage },
  { href: "/prototype/insights", label: "Insights",  Icon: IconTrendingUp },
];

// ── Brand lockup — login-page style ─────────────────────────
// Dark frame + teal glow, matching the login page brand exactly (Image 2 aesthetic)
function BrandLogo({ size = 36 }: { size?: number }) {
  return (
    <div style={{
      width: size, height: size,
      borderRadius: Math.round(size * 0.28),
      background: "rgba(14,18,28,0.92)",
      border: "1px solid rgba(14,212,184,0.45)",
      boxShadow: "0 0 0 1px rgba(14,212,184,0.35), 0 8px 28px rgba(14,212,184,0.22)",
      display: "grid", placeItems: "center", flexShrink: 0,
    }}>
      <Image
        src="/web-logo.png"
        alt="Gastos AI"
        width={Math.round(size * 0.62)}
        height={Math.round(size * 0.62)}
        style={{ filter: "drop-shadow(0 0 6px rgba(14,212,184,0.4))" }}
      />
    </div>
  );
}

function BrandText({ muted }: { muted: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.18rem" }}>
      <span style={{
        fontFamily: "'Syne', 'Space Grotesk', system-ui, sans-serif",
        fontWeight: 800, fontSize: "0.88rem",
        letterSpacing: "0.12em", color: "#14b8a6",
        textTransform: "uppercase", lineHeight: 1,
      }}>
        Gastos AI
      </span>
      <span style={{
        fontSize: "0.58rem", color: muted,
        letterSpacing: "0.05em", fontWeight: 500, lineHeight: 1,
      }}>
        Smart Expense Tracker
      </span>
    </div>
  );
}

// ── Shell ────────────────────────────────────────────────────
export default function PrototypeShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isDark, setIsDark] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
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

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (!sessionReady) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#07090f" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
          <div style={{ position: "relative", width: 40, height: 40 }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "2px solid rgba(20,184,166,0.2)", borderTopColor: "#14b8a6", animation: "spin 0.9s linear infinite" }} />
            <div style={{ position: "absolute", inset: 7, borderRadius: "50%", border: "2px solid rgba(20,184,166,0.08)", borderBottomColor: "#2dd4bf", animation: "spin 1.4s linear infinite reverse" }} />
          </div>
          <p style={{ color: "#475569", fontSize: "0.78rem", letterSpacing: "0.06em" }}>Loading…</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const bg       = isDark ? "#07090f" : "#f1f5f9";
  const sidebar  = isDark ? "#0d1117" : "#ffffff";
  const border   = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)";
  const textBase = isDark ? "#e2e8f0" : "#0f172a";
  const textMute = isDark ? "#475569" : "#94a3b8";
  const sideW    = collapsed ? 68 : 232;

  const currentPage = navItems.find(n => pathname === n.href)?.label
    ?? navItems.find(n => pathname.startsWith(n.href))?.label
    ?? "Dashboard";

  return (
    <PrototypeThemeContext.Provider value={{ isDark }}>
      <>
        <style suppressHydrationWarning>{`
          @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700;800&family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap');

          .shell-root * { box-sizing: border-box; }
          .shell-root { font-family: 'DM Sans', sans-serif; }
          .g-display { font-family: 'Syne', sans-serif; }

          .proto-main::-webkit-scrollbar { width: 5px; }
          .proto-main::-webkit-scrollbar-track { background: transparent; }
          .proto-main::-webkit-scrollbar-thumb { background: rgba(100,116,139,0.2); border-radius: 999px; }

          .nav-item { transition: background 0.15s, color 0.15s; }
          .nav-item:hover { background: ${isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)"} !important; }
          .nav-item-active { background: ${isDark ? "rgba(20,184,166,0.1)" : "rgba(20,184,166,0.08)"} !important; box-shadow: inset 0 0 0 1px rgba(20,184,166,0.22); }

          .side-btn { transition: background 0.15s, color 0.15s; }
          .side-btn:hover { background: ${isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)"} !important; }
          .logout-btn:hover { background: rgba(239,68,68,0.09) !important; color: #f87171 !important; }

          .collapse-btn { transition: background 0.15s, color 0.15s; }
          .collapse-btn:hover { background: ${isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)"} !important; }

          .mobile-overlay { position: fixed; inset: 0; z-index: 40; background: rgba(0,0,0,0.65); backdrop-filter: blur(6px); animation: fadeIn 0.2s ease; }
          .mobile-drawer  { position: fixed; top: 0; left: 0; bottom: 0; z-index: 50; width: 264px; background: ${sidebar}; border-right: 1px solid ${border}; display: flex; flex-direction: column; animation: slideIn 0.26s cubic-bezier(0.22,1,0.36,1); }

          @keyframes fadeIn  { from{opacity:0}                    to{opacity:1} }
          @keyframes slideIn { from{transform:translateX(-100%)}  to{transform:translateX(0)} }
          @keyframes spin    { to{transform:rotate(360deg)} }
          @keyframes glow1   { 0%,100%{transform:translate(0,0)} 50%{transform:translate(20px,-30px)} }
          @keyframes glow2   { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-30px,20px)} }
          .orb-1 { animation: glow1 14s ease-in-out infinite; }
          .orb-2 { animation: glow2 18s ease-in-out infinite; }

          @media (max-width: 768px) {
            .desktop-sidebar { display: none !important; }
            .proto-content   { margin-left: 0 !important; }
          }
          @media (min-width: 769px) {
            .mobile-topbar { display: none !important; }
          }
        `}</style>

        <div className="shell-root" style={{ display: "flex", minHeight: "100vh", background: bg, color: textBase, transition: "background 0.3s, color 0.3s", position: "relative", overflow: "hidden" }}>

          <div className="orb-1" style={{ position: "fixed", width: 600, height: 600, top: -250, left: -150, borderRadius: "50%", background: "radial-gradient(circle, rgba(14,212,184,0.08) 0%, transparent 70%)", filter: "blur(60px)", pointerEvents: "none", zIndex: 0 }} />
          <div className="orb-2" style={{ position: "fixed", width: 500, height: 500, bottom: -200, right: -100, borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.07) 0%, transparent 70%)", filter: "blur(60px)", pointerEvents: "none", zIndex: 0 }} />

          {/* ── DESKTOP SIDEBAR ── */}
          <aside className="desktop-sidebar" style={{
            position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 30,
            width: sideW, background: sidebar, borderRight: `1px solid ${border}`,
            display: "flex", flexDirection: "column",
            transition: "width 0.25s cubic-bezier(0.22,1,0.36,1)", overflow: "hidden",
          }}>
            {/* Brand */}
            <div style={{
              padding: collapsed ? "0.9rem 0" : "1rem 1.1rem",
              display: "flex", alignItems: "center", gap: "0.7rem",
              borderBottom: `1px solid ${border}`, flexShrink: 0,
              justifyContent: collapsed ? "center" : "flex-start", minHeight: 68,
            }}>
              <BrandLogo size={38} />
              {!collapsed && <BrandText muted={textMute} />}
            </div>

            {/* Nav */}
            <nav style={{ flex: 1, padding: "0.75rem 0.6rem", display: "flex", flexDirection: "column", gap: "0.1rem", overflowY: "auto" }}>
              {!collapsed && (
                <p style={{ fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.14em", color: textMute, textTransform: "uppercase", padding: "0.4rem 0.65rem 0.5rem" }}>Menu</p>
              )}
              {navItems.map(({ href, label, Icon }) => {
                const active = pathname === href;
                const iconColor = active ? "#14b8a6" : textMute;
                return (
                  <Link key={href} href={href} title={collapsed ? label : undefined}
                    className={`nav-item ${active ? "nav-item-active" : ""}`}
                    style={{
                      display: "flex", alignItems: "center", gap: "0.65rem",
                      padding: collapsed ? "0.7rem" : "0.65rem 0.75rem",
                      borderRadius: 10, textDecoration: "none",
                      fontWeight: 600, fontSize: "0.85rem",
                      color: active ? "#14b8a6" : textMute,
                      justifyContent: collapsed ? "center" : "flex-start",
                    }}>
                    <Icon size={17} color={iconColor} />
                    {!collapsed && <span>{label}</span>}
                  </Link>
                );
              })}
            </nav>

            {/* Bottom */}
            <div style={{ padding: "0.6rem 0.6rem", borderTop: `1px solid ${border}`, display: "flex", flexDirection: "column", gap: "0.1rem", flexShrink: 0 }}>
              {!collapsed && userEmail && (
                <div style={{ padding: "0.5rem 0.75rem 0.6rem", marginBottom: "0.15rem" }}>
                  <div style={{ fontSize: "0.56rem", color: textMute, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.15rem" }}>Signed in as</div>
                  <div style={{ fontSize: "0.72rem", color: textBase, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userEmail}</div>
                </div>
              )}
              <button type="button" onClick={() => setIsDark(p => !p)} title={collapsed ? (isDark ? "Light Mode" : "Dark Mode") : undefined}
                className="side-btn"
                style={{ display: "flex", alignItems: "center", gap: "0.65rem", padding: collapsed ? "0.6rem" : "0.6rem 0.75rem", borderRadius: 10, background: "transparent", border: "none", cursor: "pointer", color: textMute, fontSize: "0.82rem", fontWeight: 600, fontFamily: "inherit", justifyContent: collapsed ? "center" : "flex-start", width: "100%" }}>
                {isDark ? <IconSun size={17} color={textMute} /> : <IconMoon size={17} color={textMute} />}
                {!collapsed && <span>{isDark ? "Light Mode" : "Dark Mode"}</span>}
              </button>
              <button type="button" onClick={handleLogout} title={collapsed ? "Logout" : undefined}
                className="side-btn logout-btn"
                style={{ display: "flex", alignItems: "center", gap: "0.65rem", padding: collapsed ? "0.6rem" : "0.6rem 0.75rem", borderRadius: 10, background: "transparent", border: "none", cursor: "pointer", color: textMute, fontSize: "0.82rem", fontWeight: 600, fontFamily: "inherit", justifyContent: collapsed ? "center" : "flex-start", width: "100%" }}>
                <IconLogout size={17} color="currentColor" />
                {!collapsed && <span>Logout</span>}
              </button>
              <button type="button" onClick={() => setCollapsed(p => !p)} title={collapsed ? "Expand" : "Collapse"}
                className="collapse-btn"
                style={{ display: "flex", alignItems: "center", gap: "0.65rem", padding: collapsed ? "0.6rem" : "0.6rem 0.75rem", borderRadius: 10, background: "transparent", border: "none", cursor: "pointer", color: textMute, fontSize: "0.82rem", fontWeight: 600, fontFamily: "inherit", justifyContent: collapsed ? "center" : "flex-start", width: "100%" }}>
                <span style={{ display: "inline-flex", transform: collapsed ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.25s cubic-bezier(0.22,1,0.36,1)" }}>
                  <IconChevronLeft size={17} color="currentColor" />
                </span>
                {!collapsed && <span>Collapse</span>}
              </button>
            </div>
          </aside>

          {/* ── MOBILE TOPBAR ── */}
          <header className="mobile-topbar" style={{
            position: "fixed", top: 0, left: 0, right: 0, zIndex: 30,
            height: 58, background: sidebar, borderBottom: `1px solid ${border}`,
            display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 1rem",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <BrandLogo size={32} />
              {/* REPLACED: Now using the unified BrandText component */}
              <BrandText muted={textMute} /> 
            </div>
            
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <button type="button" onClick={() => setIsDark(p => !p)}
                style={{ width: 36, height: 36, borderRadius: 9, background: "transparent", border: `1px solid ${border}`, cursor: "pointer", display: "grid", placeItems: "center", color: textMute }}>
                {isDark ? <IconSun size={16} color={textMute} /> : <IconMoon size={16} color={textMute} />}
              </button>
              <button type="button" onClick={() => setMobileOpen(true)}
                style={{ width: 36, height: 36, borderRadius: 9, background: "transparent", border: `1px solid ${border}`, cursor: "pointer", display: "grid", placeItems: "center", color: textMute }}>
                <IconMenu size={18} color={textMute} />
              </button>
            </div>
          </header>

          {/* ── MOBILE DRAWER ── */}
          {mobileOpen && (
            <>
              <div className="mobile-overlay" onClick={() => setMobileOpen(false)} />
              <div className="mobile-drawer">
                <div style={{ padding: "1rem 1.1rem", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${border}`, minHeight: 64 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
                    <BrandLogo size={34} />
                    <BrandText muted={textMute} />
                  </div>
                  <button type="button" onClick={() => setMobileOpen(false)}
                    style={{ width: 30, height: 30, borderRadius: 8, background: "transparent", border: `1px solid ${border}`, cursor: "pointer", color: textMute, display: "grid", placeItems: "center" }}>
                    <IconX size={15} color={textMute} />
                  </button>
                </div>
                <nav style={{ flex: 1, padding: "0.75rem 0.65rem", display: "flex", flexDirection: "column", gap: "0.1rem" }}>
                  <p style={{ fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.14em", color: textMute, textTransform: "uppercase", padding: "0.3rem 0.65rem 0.5rem" }}>Menu</p>
                  {navItems.map(({ href, label, Icon }) => {
                    const active = pathname === href;
                    return (
                      <Link key={href} href={href}
                        className={`nav-item ${active ? "nav-item-active" : ""}`}
                        style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.7rem 0.85rem", borderRadius: 10, textDecoration: "none", fontWeight: 600, fontSize: "0.9rem", color: active ? "#14b8a6" : textMute }}>
                        <Icon size={17} color={active ? "#14b8a6" : textMute} />
                        <span>{label}</span>
                      </Link>
                    );
                  })}
                </nav>
                <div style={{ padding: "0.75rem 0.65rem", borderTop: `1px solid ${border}`, display: "flex", flexDirection: "column", gap: "0.1rem" }}>
                  {userEmail && (
                    <div style={{ padding: "0.4rem 0.75rem 0.65rem" }}>
                      <div style={{ fontSize: "0.58rem", color: textMute, textTransform: "uppercase", letterSpacing: "0.1em" }}>Signed in as</div>
                      <div style={{ fontSize: "0.78rem", color: textBase, fontWeight: 600, marginTop: "0.15rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userEmail}</div>
                    </div>
                  )}
                  <button type="button" onClick={handleLogout}
                    className="side-btn logout-btn"
                    style={{ display: "flex", alignItems: "center", gap: "0.65rem", padding: "0.65rem 0.85rem", borderRadius: 10, background: "transparent", border: "none", cursor: "pointer", color: "#f87171", fontSize: "0.85rem", fontWeight: 600, fontFamily: "inherit", width: "100%" }}>
                    <IconLogout size={16} color="currentColor" />
                    <span>Logout</span>
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ── MAIN CONTENT ── */}
          <main className="proto-main proto-content" style={{
            marginLeft: sideW, flex: 1, minHeight: "100vh", overflowY: "auto",
            transition: "margin-left 0.25s cubic-bezier(0.22,1,0.36,1)", position: "relative", zIndex: 1,
          }}>
            <div style={{
              position: "sticky", top: 0, zIndex: 20,
              background: isDark ? "rgba(7,9,15,0.88)" : "rgba(241,245,249,0.9)",
              backdropFilter: "blur(16px)", borderBottom: `1px solid ${border}`,
              padding: "0.75rem 1.75rem",
              display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 58,
            }}>
              <div>
                <p style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#14b8a6", margin: 0 }}>{currentPage}</p>
                <h1 style={{ fontFamily: "'Space Grotesk', 'Syne', sans-serif", fontSize: "1.05rem", fontWeight: 700, color: textBase, margin: 0, lineHeight: 1.25, letterSpacing: "-0.01em" }}>
                  {pathname === "/prototype"          && "Expense Dashboard"}
                  {pathname === "/prototype/chat"     && "Chat with Gastos AI"}
                  {pathname === "/prototype/insights" && "Insights & Predictions"}
                </h1>
              </div>
              <div style={{ fontSize: "0.72rem", color: textMute, display: "flex", alignItems: "center", gap: "0.45rem" }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#14b8a6", display: "inline-block", boxShadow: "0 0 8px rgba(20,184,166,0.7)" }} />
                {new Date().toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
              </div>
            </div>
            <div style={{ maxWidth: 1200, margin: "0 auto", padding: "1.5rem 1.75rem 3rem" }}>
              {children}
            </div>
          </main>
        </div>
      </>
    </PrototypeThemeContext.Provider>
  );
}
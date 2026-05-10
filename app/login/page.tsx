"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import AuthCard from "./AuthCard";
import MobileAuthSheet from "./MobileAuthSheet";
import type { AuthMode } from "./AuthCard";

type Theme = "dark" | "light";

/* ─── Theme Toggle ─────────────────────────────────────────────────── */

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
      <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} className="pg-theme-toggle"
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
      <span className="pg-tt-track">
        <span className="pg-tt-thumb" />
        <span className="pg-tt-icon pg-tt-sun"><SunIcon /></span>
        <span className="pg-tt-icon pg-tt-moon"><MoonIcon /></span>
      </span>
    </button>
  );
}

/* ─── Page ─────────────────────────────────────────────────────────── */

export default function AuthPage() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<AuthMode>("login");

  useEffect(() => {
    setMounted(true);
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setTheme(prefersDark ? "dark" : "light");
  }, []);

  const toggleTheme = () => setTheme(t => (t === "dark" ? "light" : "dark"));
  const t = theme;

  const openSheet = (mode: AuthMode) => {
    setSheetMode(mode);
    setSheetOpen(true);
  };

  return (
    <>
      <style suppressHydrationWarning>{`
        /* ── CSS Tokens ──────────────────────────────────── */
        .pg-root {
          --c-bg:         ${t === "dark" ? "#07090f"                   : "#eef4f8"};
          --c-left-bg:    ${t === "dark" ? "#07090f"                   : "#e5eef5"};
          --c-card:       ${t === "dark" ? "rgba(14,18,28,0.82)"       : "rgba(255,255,255,0.9)"};
          --c-card-bdr:   ${t === "dark" ? "rgba(255,255,255,0.07)"    : "rgba(0,0,0,0.08)"};
          --c-tab-bg:     ${t === "dark" ? "rgba(255,255,255,0.04)"    : "rgba(0,0,0,0.05)"};
          --c-tab-bdr:    ${t === "dark" ? "rgba(255,255,255,0.07)"    : "rgba(0,0,0,0.08)"};
          --c-input-bg:   ${t === "dark" ? "rgba(8,12,22,0.7)"         : "rgba(255,255,255,0.95)"};
          --c-input-bdr:  ${t === "dark" ? "rgba(255,255,255,0.09)"    : "rgba(0,0,0,0.13)"};
          --c-text-hi:    ${t === "dark" ? "#eef4f7"                   : "#0a1628"};
          --c-text-mid:   ${t === "dark" ? "#7a9aaa"                   : "#3d5a6b"};
          --c-text-lo:    ${t === "dark" ? "#445566"                   : "#8aabb8"};
          --c-accent:     #0ed4be;
          --c-divider:    ${t === "dark" ? "rgba(255,255,255,0.07)"    : "rgba(0,0,0,0.08)"};
          --c-social-bg:  ${t === "dark" ? "rgba(255,255,255,0.03)"    : "rgba(255,255,255,0.8)"};
          --c-social-bdr: ${t === "dark" ? "rgba(255,255,255,0.09)"    : "rgba(0,0,0,0.1)"};
          --c-grid:       ${t === "dark" ? "rgba(255,255,255,0.022)"   : "rgba(0,0,0,0.045)"};
          --c-orb1:       ${t === "dark" ? "rgba(14,212,184,0.18)"     : "rgba(14,212,184,0.11)"};
          --c-orb2:       ${t === "dark" ? "rgba(80,100,255,0.12)"     : "rgba(80,100,255,0.06)"};
          --c-orb3:       ${t === "dark" ? "rgba(14,212,184,0.10)"     : "rgba(14,212,184,0.07)"};
          --c-pill-bg:    ${t === "dark" ? "rgba(14,212,184,0.08)"     : "rgba(14,212,184,0.10)"};
          --c-pill-bdr:   ${t === "dark" ? "rgba(14,212,184,0.2)"      : "rgba(14,212,184,0.3)"};
          --c-pill-txt:   ${t === "dark" ? "#9be8e0"                   : "#0a6b62"};
          --c-stk1:       ${t === "dark" ? "rgba(14,18,28,0.82)"       : "rgba(228,240,248,0.9)"};
          --c-stk2:       ${t === "dark" ? "rgba(20,26,40,0.9)"        : "rgba(255,255,255,0.97)"};
          --c-stk-val:    ${t === "dark" ? "#eef4f7"                   : "#0a1628"};
          --shadow-card:  ${t === "dark"
            ? "0 32px 80px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.04)"
            : "0 24px 60px rgba(0,0,0,0.10), inset 0 0 0 1px rgba(255,255,255,0.6)"};
        }

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .pg-root {
          font-family: var(--font-dm-sans, system-ui, sans-serif);
          background: var(--c-bg);
          color: var(--c-text-hi);
          min-height: 100dvh;
          overflow-x: hidden;
          opacity: 0;
          transition: opacity 0.4s ease, background 0.35s ease, color 0.35s ease;
          position: relative;
        }
        .pg-root.mounted { opacity: 1; }

        /* Grid BG */
        .pg-grid-bg {
          background-image:
            linear-gradient(var(--c-grid) 1px, transparent 1px),
            linear-gradient(90deg, var(--c-grid) 1px, transparent 1px);
          background-size: 48px 48px;
          mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 100%);
          position: fixed; inset: 0; z-index: 0; pointer-events: none;
        }

        /* Orbs */
        .pg-orb { position: fixed; border-radius: 50%; z-index: 0; pointer-events: none; transition: background 0.5s; }
        .pg-orb-1 { width:600px;height:600px;top:-200px;left:-100px;filter:blur(80px); background:radial-gradient(circle,var(--c-orb1) 0%,transparent 70%); animation:pgOrb1 18s ease-in-out infinite; }
        .pg-orb-2 { width:500px;height:500px;bottom:-150px;left:30%;filter:blur(80px); background:radial-gradient(circle,var(--c-orb2) 0%,transparent 70%); animation:pgOrb2 22s ease-in-out infinite; }
        .pg-orb-3 { width:400px;height:400px;top:40%;right:-100px;filter:blur(80px); background:radial-gradient(circle,var(--c-orb3) 0%,transparent 70%); animation:pgOrb3 15s ease-in-out infinite; }
        @keyframes pgOrb1 { 0%,100%{transform:translate(0,0)} 33%{transform:translate(40px,60px)} 66%{transform:translate(-20px,30px)} }
        @keyframes pgOrb2 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-60px,-40px)} }
        @keyframes pgOrb3 { 0%,100%{transform:translate(0,0)} 40%{transform:translate(30px,-50px)} }

        /* Theme Toggle */
        .pg-theme-toggle {
          position: fixed; top: 1.1rem; right: 1.1rem; z-index: 300;
          background: var(--c-card); border: 1px solid var(--c-card-bdr);
          border-radius: 999px; cursor: pointer;
          width: 52px; height: 28px; padding: 0;
          box-shadow: 0 2px 12px rgba(0,0,0,0.15);
          transition: background 0.3s, border-color 0.3s, box-shadow 0.3s;
          backdrop-filter: blur(12px);
        }
        .pg-theme-toggle:hover { box-shadow: 0 4px 20px rgba(14,212,184,0.25); border-color: rgba(14,212,184,0.4); }
        .pg-tt-track { position: relative; width: 100%; height: 100%; display: flex; align-items: center; }
        .pg-tt-thumb {
          position: absolute; width: 22px; height: 22px; border-radius: 50%;
          background: linear-gradient(135deg, #0ed4be, #0bb8a6);
          box-shadow: 0 2px 8px rgba(14,212,184,0.4);
          transition: transform 0.35s cubic-bezier(0.34,1.56,0.64,1);
          transform: ${t === "dark" ? "translateX(3px)" : "translateX(27px)"};
          z-index: 2;
        }
        .pg-tt-icon { position: absolute; z-index: 1; color: var(--c-text-mid); display: flex; align-items: center; justify-content: center; transition: opacity 0.25s; width: 16px; height: 16px; }
        .pg-tt-sun  { left: 6px;  opacity: ${t === "dark" ? 0 : 1}; }
        .pg-tt-moon { right: 6px; opacity: ${t === "dark" ? 1 : 0}; }

        /* ── Desktop Layout ──────────────────────────────── */
        .pg-layout {
          display: grid;
          grid-template-columns: 1.1fr 0.9fr;
          min-height: 100dvh;
          position: relative; z-index: 1;
        }

        /* Left panel */
        .pg-left {
          background: var(--c-left-bg);
          border-right: 1px solid var(--c-divider);
          display: flex; align-items: center; justify-content: center;
          padding: 2.5rem 3rem;
          transition: background 0.35s, border-color 0.35s;
        }
        .pg-left-inner { display: flex; flex-direction: column; gap: 2rem; width: 100%; max-width: 480px; }

        .pg-brand { display: flex; align-items: center; gap: 0.75rem; }
        .pg-logo-frame {
          display: grid; place-items: center; border-radius: 14px;
          width: 56px; height: 56px;
          background: rgba(14,18,28,0.92);
          border: 1px solid rgba(14,212,184,0.45);
          box-shadow: 0 0 0 1px rgba(14,212,184,0.35), 0 14px 42px rgba(14,212,184,0.22);
        }
        .pg-logo-img { filter: drop-shadow(0 10px 26px rgba(14,212,184,0.35)); }
        .pg-brand-name {
          font-family: var(--font-syne, system-ui); font-weight: 800;
          font-size: 0.85rem; letter-spacing: 0.12em;
          color: var(--c-accent); text-transform: uppercase;
        }

        .pg-headline {
          font-family: var(--font-syne, system-ui); font-weight: 900;
          line-height: 1.0; letter-spacing: -0.03em;
          font-size: clamp(2.8rem, 4vw, 3.8rem);
        }
        .pg-line1 { color: var(--c-text-hi); transition: color 0.35s; }
        .pg-line2 {
          background: linear-gradient(135deg, #0ed4be 0%, #5ee8dc 50%, #a8f0eb 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }
        .pg-tagline { margin-top: 0.75rem; font-size: 0.95rem; line-height: 1.7; color: var(--c-text-mid); max-width: 440px; transition: color 0.35s; }

        .pg-pills { display: flex; flex-wrap: wrap; gap: 0.5rem; }
        .pg-pill {
          display: inline-flex; align-items: center; gap: 0.45rem;
          padding: 0.4rem 0.85rem; border-radius: 999px;
          font-size: 0.81rem; font-weight: 500;
          background: var(--c-pill-bg); border: 1px solid var(--c-pill-bdr); color: var(--c-pill-txt);
          transition: background 0.2s, border-color 0.2s;
        }
        .pg-pill:hover { background: rgba(14,212,184,0.14); border-color: rgba(14,212,184,0.35); }

        .pg-card-stack { position: relative; height: 160px; }
        .pg-stack-card { position: absolute; border-radius: 18px; padding: 1rem; backdrop-filter: blur(12px); transition: transform 0.35s cubic-bezier(0.22,1,0.36,1), background 0.35s; }
        .pg-stack-back  { width:260px;left:0;top:0;transform:rotate(-5deg); background:var(--c-stk1); border:1px solid rgba(14,212,184,0.15); }
        .pg-stack-front { width:240px;left:80px;top:20px;transform:rotate(2deg); background:var(--c-stk2); border:1px solid rgba(14,212,184,0.25); }
        .pg-card-stack:hover .pg-stack-back  { transform: rotate(-7deg) translateY(-4px); }
        .pg-card-stack:hover .pg-stack-front { transform: rotate(3deg) translateY(-8px); }
        .pg-stk-label { font-size:0.72rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--c-text-lo);margin-bottom:0.25rem;transition:color 0.35s; }
        .pg-stk-amt   { font-family:var(--font-syne,system-ui);font-weight:700;font-size:1.5rem;color:var(--c-accent);margin-bottom:0.75rem; }
        .pg-stk-track { height:4px;border-radius:999px;background:var(--c-divider);margin-bottom:0.25rem;overflow:hidden; }
        .pg-stk-fill  { height:100%;border-radius:999px;width:72%;background:linear-gradient(90deg,#0ed4be,#5ee8dc); }
        .pg-stk-pct   { font-size:0.72rem;color:var(--c-text-lo);transition:color 0.35s; }
        .pg-stk-row   { display:flex;align-items:center;gap:0.5rem;padding:0.45rem 0;border-bottom:1px solid var(--c-divider);transition:border-color 0.35s; }
        .pg-stk-dot   { width:8px;height:8px;border-radius:50%;flex-shrink:0; }
        .pg-stk-cat   { flex:1;font-size:0.8rem;color:var(--c-text-mid);transition:color 0.35s; }
        .pg-stk-val   { font-size:0.82rem;font-weight:600;color:var(--c-stk-val);transition:color 0.35s; }

        /* Right panel */
        .pg-right { display: flex; align-items: center; justify-content: center; padding: 2rem 1.5rem; }
        .pg-auth-card {
          width: 100%; max-width: 420px;
          background: var(--c-card); border: 1px solid var(--c-card-bdr);
          border-radius: 20px; padding: 1.75rem;
          backdrop-filter: blur(20px); box-shadow: var(--shadow-card);
          transition: background 0.35s, border-color 0.35s, box-shadow 0.35s;
        }

        /* Animations */
        @keyframes pgFadeUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pgCardIn { from{opacity:0;transform:translateY(32px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }
        .pg-fu1 { animation: pgFadeUp 0.7s cubic-bezier(0.22,1,0.36,1) 0.05s both; }
        .pg-fu2 { animation: pgFadeUp 0.7s cubic-bezier(0.22,1,0.36,1) 0.15s both; }
        .pg-fu3 { animation: pgFadeUp 0.7s cubic-bezier(0.22,1,0.36,1) 0.25s both; }
        .pg-fu4 { animation: pgFadeUp 0.7s cubic-bezier(0.22,1,0.36,1) 0.35s both; }
        .pg-card-in { animation: pgCardIn 0.75s cubic-bezier(0.22,1,0.36,1) 0.1s both; }

        /* ── Mobile Hero ─────────────────────────────────── */
        .pg-mobile-hero {
          display: none;
          flex-direction: column;
          min-height: 100dvh;
          position: relative; z-index: 1;
        }

        .pg-mob-topbar {
          background: rgba(7,9,15,0.96);
          border-bottom: 1px solid rgba(14,212,184,0.12);
          padding: 1rem 1.25rem;
          display: flex; align-items: center; gap: 0.75rem;
          flex-shrink: 0;
        }
        .pg-mob-logo-frame {
          display: grid; place-items: center; border-radius: 10px;
          width: 38px; height: 38px; flex-shrink: 0;
          background: rgba(14,18,28,0.95);
          border: 1px solid rgba(14,212,184,0.45);
          box-shadow: 0 0 0 1px rgba(14,212,184,0.3), 0 6px 18px rgba(14,212,184,0.18);
        }
        .pg-mob-brand {
          font-family: var(--font-syne, system-ui); font-weight: 800;
          font-size: 0.78rem; letter-spacing: 0.12em;
          color: var(--c-accent); text-transform: uppercase;
        }

        .pg-mob-body {
          flex: 1;
          display: flex; flex-direction: column; justify-content: center;
          padding: 2rem 1.5rem 1rem;
          gap: 1.5rem;
        }

        .pg-mob-headline {
          font-family: var(--font-syne, system-ui); font-weight: 900;
          line-height: 1.0; letter-spacing: -0.03em;
          font-size: clamp(2.5rem, 10vw, 3.8rem);
        }
        .pg-mob-tagline { margin-top: 0.75rem; font-size: 0.9rem; line-height: 1.7; color: var(--c-text-mid); transition: color 0.35s; }

        .pg-mob-pills { display: flex; flex-wrap: wrap; gap: 0.4rem; }
        .pg-mob-pill {
          display: inline-flex; align-items: center; gap: 0.35rem;
          padding: 0.35rem 0.75rem; border-radius: 999px;
          font-size: 0.77rem; font-weight: 500;
          background: var(--c-pill-bg); border: 1px solid var(--c-pill-bdr); color: var(--c-pill-txt);
        }

        /* Mini card stack */
        .pg-mob-stack { position: relative; height: 110px; flex-shrink: 0; }
        .pg-mob-card  { position: absolute; border-radius: 14px; padding: 0.8rem; backdrop-filter: blur(12px); transition: transform 0.35s cubic-bezier(0.22,1,0.36,1); }
        .pg-mob-back  { width:200px;left:0;top:0;transform:rotate(-4deg); background:var(--c-stk1); border:1px solid rgba(14,212,184,0.15); }
        .pg-mob-front { width:190px;left:50px;top:12px;transform:rotate(2deg); background:var(--c-stk2); border:1px solid rgba(14,212,184,0.25); }

        /* CTA buttons */
        .pg-mob-cta {
          display: flex; flex-direction: column; gap: 0.75rem;
          padding: 1rem 1.5rem;
          padding-bottom: calc(1.5rem + env(safe-area-inset-bottom));
          flex-shrink: 0;
        }
        .pg-mob-btn-primary {
          display: flex; align-items: center; justify-content: center; gap: 0.5rem;
          padding: 0.9rem; border-radius: 14px; border: none; cursor: pointer;
          font-size: 1rem; font-weight: 700; font-family: var(--font-syne, system-ui);
          background: linear-gradient(135deg, #0ed4be 0%, #0bb8a6 100%);
          color: #041f1c;
          box-shadow: 0 6px 24px rgba(14,212,184,0.35);
          transition: transform 0.18s cubic-bezier(0.22,1,0.36,1), box-shadow 0.18s;
        }
        .pg-mob-btn-primary:hover  { transform: translateY(-2px); box-shadow: 0 10px 32px rgba(14,212,184,0.45); }
        .pg-mob-btn-primary:active { transform: scale(0.97); }
        .pg-mob-btn-secondary {
          display: flex; align-items: center; justify-content: center;
          padding: 0.9rem; border-radius: 14px; cursor: pointer;
          font-size: 1rem; font-weight: 600; font-family: var(--font-syne, system-ui);
          background: var(--c-card); border: 1px solid var(--c-card-bdr);
          color: var(--c-text-hi);
          backdrop-filter: blur(12px);
          transition: transform 0.18s, background 0.35s, border-color 0.35s, color 0.35s;
        }
        .pg-mob-btn-secondary:hover  { transform: translateY(-1px); }
        .pg-mob-btn-secondary:active { transform: scale(0.97); }

        /* ── Breakpoints ─────────────────────────────────── */
        @media (max-width: 768px) {
          .pg-layout      { display: none; }
          .pg-mobile-hero { display: flex; }
        }
        @media (min-width: 769px) {
          .pg-mobile-hero { display: none !important; }
          .pg-layout      { display: grid; }
        }
        /* Tablet (769–960): single column, right panel only */
        @media (max-width: 960px) and (min-width: 769px) {
          .pg-layout { grid-template-columns: 1fr; }
          .pg-left   { display: none; }
          .pg-right  { min-height: 100dvh; padding: 5rem 1.5rem 2rem; align-items: flex-start; }
          .pg-auth-card { max-width: 460px; }
        }
      `}</style>

      <div className={`pg-root${mounted ? " mounted" : ""}`}>
        <div className="pg-grid-bg" />
        <div className="pg-orb pg-orb-1" />
        <div className="pg-orb pg-orb-2" />
        <div className="pg-orb pg-orb-3" />

        <ThemeToggle theme={theme} onToggle={toggleTheme} />

        {/* ═══ DESKTOP ═══════════════════════════════════ */}
        <div className="pg-layout">
          <section className="pg-left">
            <div className="pg-left-inner">
              <div className="pg-fu1 pg-brand">
                <div className="pg-logo-frame">
                  <Image className="pg-logo-img" src="/web-logo.png" alt="Gastos AI" width={38} height={38} priority />
                </div>
                <span className="pg-brand-name">Gastos AI</span>
              </div>
              <div className="pg-fu2">
                <h1 className="pg-headline">
                  <span className="pg-line1">Track Smarter.</span><br />
                  <span className="pg-line2">Spend Wiser.</span>
                </h1>
                <p className="pg-tagline">
                  Your AI-powered financial companion — scan receipts, automate categories,
                  and get real-time insights on every peso you spend.
                </p>
              </div>
              <div className="pg-fu3 pg-pills">
                {[["🧾","Receipt Scanning"],["🤖","AI Categorization"],["📈","Smart Insights"],["🔮","Spend Predictions"]].map(([icon,label]) => (
                  <div key={label} className="pg-pill"><span>{icon}</span><span>{label}</span></div>
                ))}
              </div>
              <div className="pg-fu4 pg-card-stack">
                <div className="pg-stack-card pg-stack-back">
                  <div className="pg-stk-label">This Month</div>
                  <div className="pg-stk-amt">₱ 24,800</div>
                  <div className="pg-stk-track"><div className="pg-stk-fill" /></div>
                  <div className="pg-stk-pct">72% of budget used</div>
                </div>
                <div className="pg-stack-card pg-stack-front">
                  {[["#0ed4be","Food","₱5,400"],["#6c8fff","Transport","₱2,600"],["#ffb547","Utilities","₱1,800"]].map(([dot,cat,val]) => (
                    <div key={cat} className="pg-stk-row">
                      <span className="pg-stk-dot" style={{ background: dot }} />
                      <span className="pg-stk-cat">{cat}</span>
                      <span className="pg-stk-val">{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="pg-right">
            <div className="pg-auth-card pg-card-in">
              <AuthCard defaultMode="login" />
            </div>
          </section>
        </div>

        {/* ═══ MOBILE hero ═══════════════════════════════ */}
        <div className="pg-mobile-hero">
          {/* Top bar — always dark for logo contrast */}
          <div className="pg-mob-topbar">
            <div className="pg-mob-logo-frame">
              <Image className="pg-logo-img" src="/web-logo.png" alt="Gastos AI" width={26} height={26} priority />
            </div>
            <span className="pg-mob-brand">Gastos AI</span>
          </div>

          {/* Hero body */}
          <div className="pg-mob-body">
            <div className="pg-fu1">
              <h1 className="pg-mob-headline">
                <span className="pg-line1">Track Smarter.</span><br />
                <span className="pg-line2">Spend Wiser.</span>
              </h1>
              <p className="pg-mob-tagline">
                Your AI-powered financial companion — scan receipts, automate categories,
                and get real-time insights on every peso you spend.
              </p>
            </div>

            <div className="pg-fu2 pg-mob-pills">
              {[["🧾","Receipt Scanning"],["🤖","AI Categorization"],["📈","Smart Insights"],["🔮","Spend Predictions"]].map(([icon,label]) => (
                <div key={label} className="pg-mob-pill"><span>{icon}</span><span>{label}</span></div>
              ))}
            </div>

            <div className="pg-fu3 pg-mob-stack">
              <div className="pg-mob-card pg-mob-back">
                <div className="pg-stk-label">This Month</div>
                <div className="pg-stk-amt" style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>₱ 24,800</div>
                <div className="pg-stk-track"><div className="pg-stk-fill" /></div>
                <div className="pg-stk-pct">72% of budget used</div>
              </div>
              <div className="pg-mob-card pg-mob-front">
                {[["#0ed4be","Food","₱5,400"],["#6c8fff","Transport","₱2,600"],["#ffb547","Utilities","₱1,800"]].map(([dot,cat,val]) => (
                  <div key={cat} className="pg-stk-row" style={{ padding: "0.28rem 0" }}>
                    <span className="pg-stk-dot" style={{ background: dot }} />
                    <span className="pg-stk-cat" style={{ fontSize: "0.73rem" }}>{cat}</span>
                    <span className="pg-stk-val" style={{ fontSize: "0.75rem" }}>{val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* CTA buttons that open the sheet */}
          <div className="pg-fu4 pg-mob-cta">
            <button className="pg-mob-btn-primary" onClick={() => openSheet("login")}>
              Sign In
            </button>
            <button className="pg-mob-btn-secondary" onClick={() => openSheet("register")}>
              Create Account
            </button>
          </div>
        </div>

        {/* Mobile Auth Sheet */}
        <MobileAuthSheet
          open={sheetOpen}
          defaultMode={sheetMode}
          onClose={() => setSheetOpen(false)}
          theme={theme}
        />
      </div>
    </>
  );
}
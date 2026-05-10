"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";

export const PrototypeThemeContext = createContext<{ isDark: boolean } | null>(null);

export function usePrototypeTheme() {
  const ctx = useContext(PrototypeThemeContext);
  if (!ctx) throw new Error("usePrototypeTheme must be used inside the prototype area.");
  return ctx;
}

function NavTab({
  href,
  children,
  active,
  isDark,
}: {
  href: string;
  children: ReactNode;
  active: boolean;
  isDark: boolean;
}) {
  const base =
    "rounded-lg px-3 py-2 text-sm font-semibold transition outline-none focus-visible:ring-2 focus-visible:ring-teal-500";
  const inactive = isDark
    ? "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
    : "text-slate-600 hover:bg-slate-200 hover:text-slate-900";
  const activeCls = isDark
    ? "bg-teal-950/80 text-teal-300 ring-1 ring-teal-700/60"
    : "bg-teal-50 text-teal-800 ring-1 ring-teal-200";
  return (
    <Link href={href} className={`${base} ${active ? activeCls : inactive}`}>
      {children}
    </Link>
  );
}

export default function PrototypeShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isDark, setIsDark] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (!session) {
        router.replace("/login");
        return;
      }
      setSessionReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const shellClass = isDark ? "min-h-screen bg-slate-950 text-slate-100" : "min-h-screen bg-slate-50 text-slate-900";
  const subtleText = isDark ? "text-slate-400" : "text-slate-500";
  const headerBar = isDark ? "border-slate-800 bg-slate-950/85" : "border-slate-200 bg-white/90";

  if (!sessionReady) {
    return (
      <div className={`${shellClass} flex items-center justify-center px-6 py-16`}>
        <p className={subtleText}>Loading…</p>
      </div>
    );
  }

  const isDashboard = pathname === "/prototype";

  return (
    <PrototypeThemeContext.Provider value={{ isDark }}>
      <div className={`${shellClass} transition-colors duration-300`}>
      <header className={`sticky top-0 z-20 border-b backdrop-blur-md ${headerBar}`}>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-3">
          <nav className="flex flex-wrap items-center gap-1 sm:gap-2">
            <span className="mr-1 shrink-0 text-sm font-bold tracking-tight text-teal-500 sm:mr-3">Gastos AI</span>
            <NavTab href="/prototype" active={isDashboard} isDark={isDark}>
              Dashboard
            </NavTab>
            <NavTab href="/prototype/chat" active={pathname === "/prototype/chat"} isDark={isDark}>
              Chat
            </NavTab>
            <NavTab href="/prototype/insights" active={pathname === "/prototype/insights"} isDark={isDark}>
              Insights
            </NavTab>
          </nav>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsDark((p) => !p)}
              className={`rounded-md px-3 py-2 text-xs font-semibold transition ${isDark ? "bg-slate-800 text-slate-100 hover:bg-slate-700" : "bg-slate-200 text-slate-800 hover:bg-slate-300"}`}
            >
              {isDark ? "Light" : "Dark"}
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className={`rounded-md px-3 py-2 text-xs font-semibold transition ${isDark ? "border border-slate-700 text-slate-100 hover:bg-slate-800" : "border border-slate-300 text-slate-700 hover:bg-slate-100"}`}
            >
              Logout
            </button>
          </div>
        </div>
      </header>
      <main className={`mx-auto w-full max-w-6xl px-6 py-8 ${isDashboard ? "dashboard-page" : ""}`}>{children}</main>
      </div>
    </PrototypeThemeContext.Provider>
  );
}

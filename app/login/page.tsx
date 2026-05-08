"use client";
import { supabase } from '@/lib/supabase'

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [darkMode, setDarkMode] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const errs = {};
    if (mode === "register" && !form.name.trim()) errs.name = "Name is required.";
    if (!form.email.trim()) errs.email = "Email is required.";
    else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = "Enter a valid email.";
    if (!form.password) errs.password = "Password is required.";
    else if (form.password.length < 6) errs.password = "At least 6 characters.";
    if (mode === "register" && form.password !== form.confirm)
      errs.confirm = "Passwords do not match.";
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setLoading(true)

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      })
      if (error) setErrors({ email: error.message })
      else router.push('/prototype')

    } else {
      const { error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
      })
      if (error) setErrors({ email: error.message })
      else router.push('/prototype')
    }

    setLoading(false)
  }

  const handleChange = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setErrors((er) => ({ ...er, [field]: undefined }));
  };

  const bg = darkMode ? "#0f1923" : "#e8f5f3";
  const cardBg = darkMode ? "#162130" : "#ffffff";
  const textPrimary = darkMode ? "#f0faf8" : "#0d2b2b";
  const textSecondary = darkMode ? "#7ab5ae" : "#3d7a70";
  const inputBg = darkMode ? "#1e2f3f" : "#f4fbfa";
  const inputBorder = darkMode ? "#2a4050" : "#c8e8e3";
  const inputFocus = "#0da88a";
  const accent = "#0da88a";
  const accentHover = "#0b9279";
  const subtleText = darkMode ? "#5a8a84" : "#7ab5ae";
  const errorColor = "#e05252";
  const dividerColor = darkMode ? "#2a4050" : "#d0ece8";

  return (
    <div style={{ minHeight: "100vh", background: bg, display: "flex", flexDirection: "column", transition: "background 0.3s" }}>
      {/* Navbar */}
      <nav style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "18px 36px", borderBottom: `1px solid ${dividerColor}`,
        background: darkMode ? "#111d28" : "#ffffffcc", backdropFilter: "blur(8px)",
        position: "sticky", top: 0, zIndex: 10
      }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 18, color: textPrimary, letterSpacing: "-0.5px" }}>GASTOS AI</div>
          <div style={{ fontSize: 11, color: subtleText, marginTop: 1 }}>Smart Expense Tracking</div>
        </div>
        <button
          onClick={() => setDarkMode((d) => !d)}
          style={{
            padding: "7px 18px", borderRadius: 8, fontSize: 13, cursor: "pointer",
            background: darkMode ? "#1e2f3f" : "#f0f7f6",
            color: textSecondary, border: `1px solid ${inputBorder}`,
            fontWeight: 500, transition: "all 0.2s"
          }}
        >
          {darkMode ? "☀ Light Mode" : "🌙 Dark Mode"}
        </button>
      </nav>

      {/* Main */}
      <div style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        padding: "48px 16px"
      }}>
        <div style={{
          background: cardBg, borderRadius: 20, padding: "44px 40px",
          width: "100%", maxWidth: 420,
          boxShadow: darkMode
            ? "0 24px 64px rgba(0,0,0,0.5)"
            : "0 12px 48px rgba(13,168,138,0.12)",
          transition: "background 0.3s, box-shadow 0.3s"
        }}>
          {/* Logo */}
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 52, height: 52, borderRadius: 14, background: accent,
              marginBottom: 12
            }}>
              <span style={{ fontSize: 24 }}>₱</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: textPrimary, letterSpacing: "-0.5px" }}>
              {mode === "login" ? "Welcome back" : "Create account"}
            </div>
            <div style={{ fontSize: 13, color: subtleText, marginTop: 4 }}>
              {mode === "login" ? "Sign in to your GASTOS AI account" : "Start tracking your expenses smarter"}
            </div>
          </div>

          {/* Tab Toggle */}
          <div style={{
            display: "flex", background: inputBg, borderRadius: 10,
            padding: 4, marginBottom: 28, border: `1px solid ${inputBorder}`
          }}>
            {["login", "register"].map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setErrors({}); }}
                style={{
                  flex: 1, padding: "9px 0", borderRadius: 8, fontSize: 13, cursor: "pointer",
                  fontWeight: 600, border: "none", transition: "all 0.2s",
                  background: mode === m ? accent : "transparent",
                  color: mode === m ? "#ffffff" : subtleText,
                }}
              >
                {m === "login" ? "Sign In" : "Register"}
              </button>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate>
            {mode === "register" && (
              <Field
                label="Full Name" placeholder="e.g. Juan dela Cruz"
                value={form.name} onChange={handleChange("name")}
                error={errors.name} inputBg={inputBg} inputBorder={inputBorder}
                inputFocus={inputFocus} textPrimary={textPrimary} subtleText={subtleText}
                errorColor={errorColor} darkMode={darkMode}
              />
            )}
            <Field
              label="Email Address" placeholder="you@email.com" type="email"
              value={form.email} onChange={handleChange("email")}
              error={errors.email} inputBg={inputBg} inputBorder={inputBorder}
              inputFocus={inputFocus} textPrimary={textPrimary} subtleText={subtleText}
              errorColor={errorColor} darkMode={darkMode}
            />
            <Field
              label="Password" placeholder="••••••••" type="password"
              value={form.password} onChange={handleChange("password")}
              error={errors.password} inputBg={inputBg} inputBorder={inputBorder}
              inputFocus={inputFocus} textPrimary={textPrimary} subtleText={subtleText}
              errorColor={errorColor} darkMode={darkMode}
            />
            {mode === "register" && (
              <Field
                label="Confirm Password" placeholder="••••••••" type="password"
                value={form.confirm} onChange={handleChange("confirm")}
                error={errors.confirm} inputBg={inputBg} inputBorder={inputBorder}
                inputFocus={inputFocus} textPrimary={textPrimary} subtleText={subtleText}
                errorColor={errorColor} darkMode={darkMode}
              />
            )}

            {mode === "login" && (
              <div style={{ textAlign: "right", marginBottom: 20, marginTop: -4 }}>
                <a href="#" style={{ fontSize: 12, color: accent, textDecoration: "none", fontWeight: 500 }}>
                  Forgot password?
                </a>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%", padding: "13px 0", borderRadius: 10, fontSize: 15,
                fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", border: "none",
                background: loading ? subtleText : accent,
                color: "#ffffff", letterSpacing: "0.2px",
                transition: "background 0.2s, transform 0.1s",
                marginTop: 4
              }}
            >
              {loading ? "Please wait…" : mode === "login" ? "Sign In" : "Create Account"}
            </button>
          </form>

          {/* Switch mode */}
          <div style={{ textAlign: "center", marginTop: 24, fontSize: 13, color: subtleText }}>
            {mode === "login" ? "Don't have an account? " : "Already have an account? "}
            <button
              onClick={() => { setMode(mode === "login" ? "register" : "login"); setErrors({}); }}
              style={{
                background: "none", border: "none", color: accent, cursor: "pointer",
                fontWeight: 700, fontSize: 13, padding: 0
              }}
            >
              {mode === "login" ? "Register" : "Sign In"}
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ textAlign: "center", padding: "20px", fontSize: 12, color: subtleText }}>
        © {new Date().getFullYear()} GASTOS AI · Smart Expense Tracking
      </div>
    </div>
  );
}

function Field({ label, placeholder, type = "text", value, onChange, error, inputBg, inputBorder, inputFocus, textPrimary, subtleText, errorColor, darkMode }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: textPrimary, marginBottom: 6 }}>
        {label}
      </label>
      <input
        type={type} placeholder={placeholder} value={value} onChange={onChange}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{
          width: "100%", padding: "11px 14px", borderRadius: 9, fontSize: 14,
          background: inputBg, color: textPrimary,
          border: `1.5px solid ${error ? errorColor : focused ? inputFocus : inputBorder}`,
          outline: "none", transition: "border 0.2s",
          boxSizing: "border-box",
          fontFamily: "inherit"
        }}
      />
      {error && <div style={{ fontSize: 11.5, color: errorColor, marginTop: 4 }}>{error}</div>}
    </div>
  );
}
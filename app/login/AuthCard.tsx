"use client";

import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { useState } from "react";
import { useRouter } from "next/navigation";

export type AuthMode = "login" | "register";
type FormState = { name: string; email: string; password: string; confirm: string };
type FormErrors = Partial<Record<keyof FormState, string>>;

/* ─── Icons ─────────────────────────────────────────────────────────── */

function EyeIcon({ hidden }: { hidden?: boolean }) {
  if (hidden) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M3 3l18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M10.7 10.7a2 2 0 002.6 2.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M9.9 5.2C10.6 5.1 11.3 5 12 5c5 0 9.3 5 9.3 5-.6.8-1.7 2-3 3.1M6.2 6.2C4.4 7.7 3.1 9.5 2.7 10c0 0 4.3 5 9.3 5 .8 0 1.6-.1 2.4-.3"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M2.7 12s3.6-6 9.3-6 9.3 6 9.3 6-3.6 6-9.3 6-9.3-6-9.3-6Z"
        stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M12 15a3 3 0 100-6 3 3 0 000 6Z" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function PasswordToggle({ visible, onToggle }: { visible: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle}
      aria-label={visible ? "Hide password" : "Show password"}
      tabIndex={-1} className="ac-pw-toggle">
      <EyeIcon hidden={visible} />
    </button>
  );
}

type FieldProps = {
  label: string; placeholder: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string; type?: React.HTMLInputTypeAttribute;
  icon?: string; toggle?: React.ReactNode;
};

function Field({ label, placeholder, value, onChange, error, type = "text", icon, toggle }: FieldProps) {
  return (
    <div className="ac-field-wrap">
      <label className="ac-field-label">{label}</label>
      <div className="ac-field-inner">
        {icon && <span className="ac-field-icon">{icon}</span>}
        <input
          className={`ac-input${error ? " ac-input-error" : ""}`}
          type={type} placeholder={placeholder} value={value} onChange={onChange}
          style={{ paddingLeft: icon ? "2.5rem" : "0.9rem", paddingRight: toggle ? "2.9rem" : "0.9rem" }}
        />
        {toggle}
      </div>
      {error && <p className="ac-field-error">⚠ {error}</p>}
    </div>
  );
}

/* ─── AuthCard ───────────────────────────────────────────────────────── */

export interface AuthCardProps {
  /** initial mode, defaults to "login" */
  defaultMode?: AuthMode;
  /** called when user successfully auth's */
  onSuccess?: () => void;
}

export default function AuthCard({ defaultMode = "login", onSuccess }: AuthCardProps) {
  const router = useRouter();

  const [mode, setMode] = useState<AuthMode>(defaultMode);
  const [form, setForm] = useState<FormState>({ name: "", email: "", password: "", confirm: "" });
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMsg, setResetMsg] = useState<string | null>(null);

  const validate = (): FormErrors => {
    const errs: FormErrors = {};
    if (mode === "register" && !form.name.trim()) errs.name = "Name is required.";
    if (!form.email.trim()) errs.email = "Email is required.";
    else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = "Enter a valid email.";
    if (!form.password) errs.password = "Password is required.";
    else if (form.password.length < 6) errs.password = "At least 6 characters.";
    if (mode === "register" && form.password !== form.confirm) errs.confirm = "Passwords do not match.";
    return errs;
  };

  async function signInWithGoogle() {
    setResetMsg(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/login/oauth-complete` },
    });
    if (error) setResetMsg(error.message);
  }

  async function handleForgotPassword() {
    setResetMsg(null);
    if (!form.email.trim()) { setErrors(p => ({ ...p, email: "Enter your email to reset your password." })); return; }
    if (!/\S+@\S+\.\S+/.test(form.email)) { setErrors(p => ({ ...p, email: "Enter a valid email." })); return; }
    setResetLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(form.email, {
      redirectTo: `${window.location.origin}/login/update-password`,
    });
    setResetLoading(false);
    if (error) { setResetMsg(error.message); return; }
    setResetMsg("If an account exists for that email, we sent a reset link.");
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setLoading(true);
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password });
      if (error) { setErrors({ email: error.message }); setLoading(false); return; }
    } else {
      const { error } = await supabase.auth.signUp({ email: form.email, password: form.password });
      if (error) { setErrors({ email: error.message }); setLoading(false); return; }
    }
    setLoading(false);
    if (onSuccess) onSuccess();
    else router.push("/prototype");
  };

  const setField = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(p => ({ ...p, [field]: e.target.value }));
    setErrors(p => ({ ...p, [field]: undefined }));
    setResetMsg(null);
  };

  const switchMode = (m: AuthMode) => {
    setMode(m); setErrors({}); setResetMsg(null);
    setForm({ name: "", email: "", password: "", confirm: "" });
  };

  return (
    <>
      <style suppressHydrationWarning>{`
        /* AuthCard scoped styles */
        .ac-tab-switch {
          position: relative; display: grid; grid-template-columns: 1fr 1fr;
          border-radius: 12px; padding: 4px; margin-bottom: 1.5rem;
          background: var(--c-tab-bg); border: 1px solid var(--c-tab-bdr);
          transition: background 0.35s, border-color 0.35s;
        }
        .ac-tab-btn {
          position: relative; z-index: 2; border-radius: 9px; padding: 0.5rem;
          font-size: 0.88rem; font-weight: 600; font-family: inherit;
          background: none; border: none; cursor: pointer; transition: color 0.2s;
        }
        .ac-tab-btn.active  { color: var(--c-text-hi); }
        .ac-tab-btn.inactive{ color: var(--c-text-mid); }
        .ac-tab-indicator {
          position: absolute; top: 4px; bottom: 4px; border-radius: 10px;
          background: rgba(14,212,184,0.14); border: 1px solid rgba(14,212,184,0.3);
          width: calc(50% - 4px);
          transition: left 0.28s cubic-bezier(0.34,1.56,0.64,1);
        }

        .ac-header { text-align: center; margin-bottom: 1.25rem; }
        .ac-logo-frame {
          display: grid; place-items: center; border-radius: 18px;
          margin: 0 auto 0.75rem;
          width: 72px; height: 72px;
          background: rgba(14,18,28,0.82);
          border: 1px solid rgba(14,212,184,0.38);
          box-shadow: 0 0 0 1px rgba(14,212,184,0.35), 0 14px 42px rgba(14,212,184,0.22);
        }
        .ac-logo-img { filter: drop-shadow(0 10px 26px rgba(14,212,184,0.35)); }
        .ac-title {
          font-family: var(--font-inter, system-ui); font-weight: 600;
          font-size: 1.5rem; letter-spacing: -0.02em;
          color: var(--c-text-hi); margin-bottom: 0.3rem;
          transition: color 0.35s;
        }
        .ac-sub { font-size: 0.87rem; color: var(--c-text-mid); transition: color 0.35s; }

        .ac-reset-msg { font-size: 0.84rem; color: #9be8e0; text-align: center; margin-bottom: 0.75rem; }

        .ac-form { display: flex; flex-direction: column; gap: 0.75rem; }

        .ac-field-wrap { display: flex; flex-direction: column; gap: 0.3rem; }
        .ac-field-label { font-size: 0.82rem; font-weight: 600; color: var(--c-text-mid); letter-spacing: 0.02em; transition: color 0.35s; }
        .ac-field-inner { position: relative; display: flex; align-items: center; }
        .ac-field-icon  { position: absolute; left: 0.85rem; font-size: 0.95rem; opacity: 0.55; z-index: 1; pointer-events: none; }
        .ac-field-error { font-size: 0.76rem; color: #f06464; display: flex; align-items: center; gap: 0.25rem; }

        .ac-input {
          width: 100%; border-radius: 12px;
          background: var(--c-input-bg); border: 1px solid var(--c-input-bdr);
          color: var(--c-text-hi); font-size: 0.9rem; font-family: inherit;
          padding-top: 0.72rem; padding-bottom: 0.72rem; outline: none;
          transition: border-color 0.2s, box-shadow 0.2s, background 0.35s, color 0.35s;
        }
        .ac-input::placeholder { color: var(--c-text-lo); }
        .ac-input:focus {
          border-color: rgba(14,212,184,0.6) !important;
          box-shadow: 0 0 0 3px rgba(14,212,184,0.12);
        }
        .ac-input.ac-input-error {
          border-color: rgba(240,100,100,0.7) !important;
          box-shadow: 0 0 0 3px rgba(240,100,100,0.1);
        }
        .ac-pw-toggle {
          position: absolute; right: 0.55rem; top: 50%; transform: translateY(-50%);
          background: none; border: none; cursor: pointer;
          padding: 0.35rem; color: var(--c-text-lo); line-height: 0; opacity: 0.9;
          transition: color 0.2s;
        }
        .ac-pw-toggle:hover { color: var(--c-accent); }

        .ac-form-row { display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; margin-top: -0.1rem; }

        .ac-custom-check { display: flex; align-items: center; gap: 0.5rem; cursor: pointer; user-select: none; font-size: 0.83rem; color: var(--c-text-mid); }
        .ac-custom-check input { display: none; }
        .ac-check-box {
          width: 16px; height: 16px; border-radius: 5px; flex-shrink: 0;
          border: 1.5px solid var(--c-input-bdr); background: var(--c-input-bg);
          position: relative; transition: background 0.15s, border-color 0.15s;
        }
        .ac-custom-check input:checked ~ .ac-check-box { background: #0ed4be; border-color: #0ed4be; }
        .ac-custom-check input:checked ~ .ac-check-box::after {
          content: ""; position: absolute; left: 4px; top: 1px; width: 5px; height: 9px;
          border: 2px solid #041f1c; border-top: none; border-left: none; transform: rotate(42deg);
        }

        .ac-forgot-btn {
          background: none; border: none; color: var(--c-accent);
          font-size: 0.83rem; cursor: pointer; font-family: inherit;
          padding: 0; white-space: nowrap; transition: opacity 0.15s;
        }
        .ac-forgot-btn:disabled { opacity: 0.65; cursor: not-allowed; }
        .ac-forgot-btn:hover:not(:disabled) { text-decoration: underline; }

        .ac-submit {
          width: 100%; border-radius: 12px; border: none;
          position: relative; overflow: hidden;
          background: linear-gradient(135deg, #0ed4be 0%, #0bb8a6 100%);
          color: #041f1c; font-size: 0.95rem; font-weight: 600; font-family: inherit;
          padding: 0.82rem; cursor: pointer;
          box-shadow: 0 4px 20px rgba(14,212,184,0.3);
          transition: transform 0.18s cubic-bezier(0.22,1,0.36,1), box-shadow 0.18s, opacity 0.15s;
          margin-top: 0.2rem;
        }
        .ac-submit:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 10px 32px rgba(14,212,184,0.4); }
        .ac-submit:active:not(:disabled) { transform: translateY(0); }
        .ac-submit:disabled { opacity: 0.65; cursor: not-allowed; }
        .ac-submit-sheen {
          position: absolute; inset: 0; border-radius: inherit;
          background: linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 60%);
          pointer-events: none;
        }
        .ac-submit-inner { display: flex; align-items: center; justify-content: center; gap: 0.5rem; }

        @keyframes ac-spin { to { transform: rotate(360deg); } }
        .ac-spinner {
          display: inline-block; border-radius: 50%; width: 14px; height: 14px;
          border: 2px solid rgba(4,31,28,0.3); border-top-color: #041f1c;
          animation: ac-spin 0.7s linear infinite;
        }

        .ac-or-divider {
          display: flex; align-items: center; gap: 0.75rem;
          margin: 1rem 0; color: var(--c-text-lo); font-size: 0.8rem;
        }
        .ac-or-line { flex: 1; height: 1px; background: var(--c-divider); transition: background 0.35s; }

        .ac-social-btn {
          display: flex; width: 100%; align-items: center; justify-content: center; gap: 0.5rem;
          border-radius: 12px; font-weight: 500; font-size: 0.88rem; font-family: inherit;
          border: 1px solid var(--c-social-bdr); background: var(--c-social-bg);
          color: var(--c-text-hi); padding: 0.72rem; cursor: pointer;
          transition: background 0.15s, border-color 0.15s, transform 0.15s, color 0.35s;
        }
        .ac-social-btn:hover { transform: translateY(-1px); }

        .ac-footer { text-align: center; margin-top: 1rem; font-size: 0.84rem; color: var(--c-text-lo); transition: color 0.35s; }
        .ac-switch-btn {
          background: none; border: none; color: var(--c-accent);
          font-weight: 700; cursor: pointer; font-family: inherit;
        }
        .ac-switch-btn:hover { text-decoration: underline; }
      `}</style>

      {/* Tab Switch */}
      <div className="ac-tab-switch">
        {(["login", "register"] as AuthMode[]).map(m => (
          <button key={m} type="button"
            className={`ac-tab-btn ${mode === m ? "active" : "inactive"}`}
            onClick={() => switchMode(m)}>
            {m === "login" ? "Sign In" : "Create Account"}
          </button>
        ))}
        <div className="ac-tab-indicator" style={{ left: mode === "login" ? 4 : "calc(50%)" }} />
      </div>

      {/* Header */}
      <div className="ac-header">
        <div className="ac-logo-frame">
          <Image className="ac-logo-img" src="/web-logo.png" alt="Gastos AI" width={46} height={46} />
        </div>
        <h2 className="ac-title">{mode === "login" ? "Welcome back" : "Join Gastos AI"}</h2>
        <p className="ac-sub">
          {mode === "login" ? "Sign in to your financial dashboard." : "Start building better spending habits today."}
        </p>
      </div>

      {resetMsg && <p className="ac-reset-msg">{resetMsg}</p>}

      {/* Form */}
      <form onSubmit={handleSubmit} noValidate className="ac-form">
        {mode === "register" && (
          <Field label="Full Name" placeholder="e.g. Juan Dela Cruz" value={form.name}
            onChange={setField("name")} error={errors.name}  />
        )}
        <Field label="Email Address" type="email" placeholder="email@address.com"
          value={form.email} onChange={setField("email")} error={errors.email}  />
        <Field label="Password" type={showPassword ? "text" : "password"} placeholder="••••••••"
          value={form.password} onChange={setField("password")} error={errors.password} 
          toggle={<PasswordToggle visible={showPassword} onToggle={() => setShowPassword(v => !v)} />} />
        {mode === "register" && (
          <Field label="Confirm Password" type={showConfirm ? "text" : "password"} placeholder="••••••••"
            value={form.confirm} onChange={setField("confirm")} error={errors.confirm} 
            toggle={<PasswordToggle visible={showConfirm} onToggle={() => setShowConfirm(v => !v)} />} />
        )}

        <div className="ac-form-row">
          <label className="ac-custom-check">
            <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} />
            <span className="ac-check-box" />
            <span>Remember me</span>
          </label>
          {mode === "login" ? (
            <button type="button" className="ac-forgot-btn"
              onClick={() => void handleForgotPassword()} disabled={resetLoading}>
              {resetLoading ? "Sending…" : "Forgot password?"}
            </button>
          ) : <span style={{ width: 1, opacity: 0 }} aria-hidden="true" />}
        </div>

        <button className="ac-submit" type="submit" disabled={loading}>
          <span className="ac-submit-sheen" />
          {loading ? (
            <span className="ac-submit-inner"><span className="ac-spinner" />Please wait...</span>
          ) : mode === "login" ? "Sign In" : "Create Account"}
        </button>
      </form>

      <div className="ac-or-divider">
        <div className="ac-or-line" /><span>or continue with</span><div className="ac-or-line" />
      </div>

      <button type="button" className="ac-social-btn" onClick={() => void signInWithGoogle()}>
        <Image src="/google-logo.png" alt="Google" width={18} height={18} style={{ objectFit: "contain" }} />
        <span>Google</span>
      </button>

      <p className="ac-footer">
        {mode === "login" ? "New to Gastos AI?" : "Already have an account?"}{" "}
        <button type="button" className="ac-switch-btn"
          onClick={() => switchMode(mode === "login" ? "register" : "login")}>
          {mode === "login" ? "Sign Up" : "Sign In"}
        </button>
      </p>
    </>
  );
}
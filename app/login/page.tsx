"use client";

import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "login" | "register";

type FormState = {
  name: string;
  email: string;
  password: string;
  confirm: string;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

export default function AuthPage() {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("login");
  const [form, setForm] = useState<FormState>({
    name: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const validate = (): FormErrors => {
    const errs: FormErrors = {};

    if (mode === "register" && !form.name.trim()) errs.name = "Name is required.";
    if (!form.email.trim()) errs.email = "Email is required.";
    else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = "Enter a valid email.";

    if (!form.password) errs.password = "Password is required.";
    else if (form.password.length < 6) errs.password = "At least 6 characters.";

    if (mode === "register" && form.password !== form.confirm) {
      errs.confirm = "Passwords do not match.";
    }

    return errs;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }

    setLoading(true);

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      });

      if (error) setErrors({ email: error.message });
      else router.push("/prototype");
    } else {
      const { error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
      });

      if (error) setErrors({ email: error.message });
      else router.push("/prototype");
    }

    setLoading(false);
  };

  const setField =
    (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setForm((prev) => ({ ...prev, [field]: value }));
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    };

  return (
    <main className="auth-shell">
      <section className="auth-left">
        <div className="left-logo-wrap">
          <Image src="/web-logo.png" alt="Gastos AI Logo" width={96} height={96} priority />
        </div>

        <h1>
          Welcome to
          <br />
          Gastos AI
        </h1>
        <p>Track smarter. Spend wiser.</p>

        <div className="left-visual">
          <div className="mock-card main">
            <div className="mock-title">Dashboard</div>
            <div className="mock-lines">
              <span />
              <span />
              <span />
            </div>
          </div>
          <div className="mock-card floating one">💳</div>
          <div className="mock-card floating two">📊</div>
          <div className="mock-card floating three">💼</div>
        </div>
      </section>

      <section className="auth-right">
        <div className="auth-card">
          <div className="auth-tabs">
            <button
              type="button"
              className={mode === "login" ? "active" : ""}
              onClick={() => {
                setMode("login");
                setErrors({});
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              className={mode === "register" ? "active" : ""}
              onClick={() => {
                setMode("register");
                setErrors({});
              }}
            >
              Create Account
            </button>
          </div>

          <div className="auth-header">
            <div className="auth-logo-plain">
              <Image src="/web-logo.png" alt="Gastos AI Logo" width={62} height={62} />
            </div>
            <h2>{mode === "login" ? "Sign In to Gastos AI" : "Create your account"}</h2>
            <p>
              {mode === "login"
                ? "Access your AI-powered financial dashboard."
                : "Start building better spending habits today."}
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate className="auth-form">
            {mode === "register" && (
              <Field
                label="Full Name"
                placeholder="e.g. Juan Dela Cruz"
                value={form.name}
                onChange={setField("name")}
                error={errors.name}
              />
            )}

            <Field
              label="Email Address"
              type="email"
              placeholder="email@address.com"
              value={form.email}
              onChange={setField("email")}
              error={errors.email}
            />

            <Field
              label="Password"
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={setField("password")}
              error={errors.password}
            />

            {mode === "register" && (
              <Field
                label="Confirm Password"
                type="password"
                placeholder="••••••••"
                value={form.confirm}
                onChange={setField("confirm")}
                error={errors.confirm}
              />
            )}

            <div className="auth-row">
              <label className="auth-check">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>Remember Me</span>
              </label>
              <button type="button" className="auth-link-btn">
                Forgot Password?
              </button>
            </div>

            <button className="auth-submit" type="submit" disabled={loading}>
              {loading
                ? "Please wait..."
                : mode === "login"
                ? "Sign In"
                : "Create Account"}
            </button>
          </form>

          <div className="auth-divider">or continue with</div>

          <div className="auth-socials">
            <button type="button" aria-label="Google">
              <Image src="/google-logo.png" alt="Google" width={22} height={22} />
            </button>
            <button type="button" aria-label="Apple">
              <Image src="/apple-logo.png" alt="Apple" width={22} height={22} />
            </button>
            <button type="button" aria-label="Microsoft">
              <Image src="/microsoft-logo.png" alt="Microsoft" width={22} height={22} />
            </button>
          </div>

          <p className="auth-switch">
            {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => {
                setMode(mode === "login" ? "register" : "login");
                setErrors({});
              }}
            >
              {mode === "login" ? "Sign Up" : "Sign In"}
            </button>
          </p>
        </div>
      </section>
    </main>
  );
}

type FieldProps = {
  label: string;
  placeholder: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  type?: React.HTMLInputTypeAttribute;
};

function Field({
  label,
  placeholder,
  value,
  onChange,
  error,
  type = "text",
}: FieldProps) {
  return (
    <div className="auth-field-wrap">
      <label className="auth-label">{label}</label>
      <input
        className={`auth-input ${error ? "error" : ""}`}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
      />
      {error && <p className="auth-error">{error}</p>}
    </div>
  );
}
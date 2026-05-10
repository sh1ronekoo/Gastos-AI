"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const canSubmit = useMemo(() => password.length >= 6 && password === confirm, [password, confirm]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (password.length < 6) {
      setMsg("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setMsg("Passwords do not match.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setMsg(error.message);
      return;
    }

    router.replace("/prototype");
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#07090f",
        color: "#eef4f7",
        display: "grid",
        placeItems: "center",
        padding: "1.25rem",
      }}
    >
      <div
        style={{
          width: "min(440px, 100%)",
          borderRadius: 18,
          padding: "1.25rem",
          border: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(14,18,28,0.82)",
          backdropFilter: "blur(14px)",
        }}
      >
        <h1 style={{ fontSize: "1.25rem", marginBottom: "0.35rem" }}>Set a new password</h1>
        <p style={{ opacity: 0.72, fontSize: "0.9rem", marginBottom: "1rem" }}>
          Enter and confirm your new password below.
        </p>

        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <label style={{ fontSize: "0.82rem", opacity: 0.85 }}>New password</label>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="new-password"
            style={{
              width: "100%",
              borderRadius: 12,
              padding: "0.72rem 0.85rem",
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(8,12,22,0.65)",
              color: "#eef4f7",
              outline: "none",
            }}
          />

          <label style={{ fontSize: "0.82rem", opacity: 0.85 }}>Confirm password</label>
          <input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            type="password"
            autoComplete="new-password"
            style={{
              width: "100%",
              borderRadius: 12,
              padding: "0.72rem 0.85rem",
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(8,12,22,0.65)",
              color: "#eef4f7",
              outline: "none",
            }}
          />

          {msg && <p style={{ color: "#ff7a7a", fontSize: "0.85rem" }}>{msg}</p>}

          <button
            type="submit"
            disabled={loading || !canSubmit}
            style={{
              marginTop: "0.25rem",
              borderRadius: 12,
              border: "none",
              padding: "0.85rem",
              cursor: loading || !canSubmit ? "not-allowed" : "pointer",
              opacity: loading || !canSubmit ? 0.65 : 1,
              fontWeight: 700,
              color: "#041f1c",
              background: "linear-gradient(135deg, #0ed4be 0%, #0bb8a6 100%)",
            }}
          >
            {loading ? "Updating…" : "Update password"}
          </button>

          <button
            type="button"
            onClick={() => router.push("/login")}
            style={{
              marginTop: "0.25rem",
              background: "transparent",
              border: "none",
              color: "#0ed4be",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Back to sign in
          </button>
        </form>
      </div>
    </main>
  );
}
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function OAuthCompletePage() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase.auth.getSession();
      if (cancelled) return;

      if (error || !data.session) {
        router.replace("/login");
        return;
      }

      router.replace("/prototype");
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#07090f",
        color: "#eef4f7",
        padding: "1.25rem",
      }}
    >
      <p style={{ opacity: 0.75 }}>Finishing sign-in…</p>
    </main>
  );
}
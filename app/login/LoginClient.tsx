"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useState } from "react";

type LoginClientProps = { error?: "forbidden" | "configuration"; nextPath: string };

export default function LoginClient({ error, nextPath }: LoginClientProps) {
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function signInWithGoogle() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) {
      setMessage("登入服務尚未完成設定。");
      return;
    }

    setIsLoading(true);
    setMessage("");
    const supabase = createBrowserClient(supabaseUrl, anonKey);
    await supabase.auth.signOut();
    const callbackUrl = new URL("/auth/callback", window.location.origin);
    callbackUrl.searchParams.set("next", nextPath);
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl.toString() }
    });

    if (signInError) {
      setMessage("Google 登入啟動失敗，請稍後再試。");
      setIsLoading(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#f7f4ee" }}>
      <section style={{ width: "min(100%, 420px)", padding: 32, borderRadius: 20, background: "white", boxShadow: "0 18px 50px rgba(40, 35, 25, .12)" }}>
        <p style={{ margin: "0 0 8px", color: "#8b6f47", fontWeight: 700 }}>Japan Note</p>
        <h1 style={{ margin: "0 0 16px", fontSize: 28 }}>後台管理員登入</h1>
        <p style={{ margin: "0 0 24px", lineHeight: 1.7, color: "#555" }}>請使用已設定為管理員的 Google 帳號登入。</p>
        {error === "forbidden" ? <p role="alert" style={{ padding: 12, borderRadius: 10, color: "#8a1c1c", background: "#fff0f0" }}>此 Google 帳號沒有後台管理權限。請改用管理員帳號。</p> : null}
        {error === "configuration" ? <p role="alert" style={{ padding: 12, borderRadius: 10, color: "#8a1c1c", background: "#fff0f0" }}>登入服務尚未完成環境設定，請聯絡網站管理員。</p> : null}
        {message ? <p role="alert">{message}</p> : null}
        <button type="button" disabled={isLoading} onClick={signInWithGoogle} style={{ width: "100%", padding: "13px 18px", border: "1px solid #d7d0c5", borderRadius: 12, background: "white", cursor: isLoading ? "wait" : "pointer", fontSize: 16, fontWeight: 700 }}>
          {isLoading ? "正在前往 Google…" : "使用 Google 登入"}
        </button>
      </section>
    </main>
  );
}


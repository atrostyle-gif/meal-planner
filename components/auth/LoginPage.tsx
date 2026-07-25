"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useFamilySession } from "@/components/providers/FamilySessionProvider";
import { toUserFacingError } from "@/lib/supabase/errors";

export function LoginPage() {
  const { mode, signIn, signUp, session, household } = useFamilySession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (mode === "supabase" && session) {
      router.replace(
        household ? searchParams.get("next") || "/today" : "/setup-household",
      );
    }
  }, [mode, session, household, router, searchParams]);

  if (mode === "local") {
    return (
      <div className="space-y-4 py-8">
        <h1 className="text-2xl font-bold">ログイン</h1>
        <p className="text-sm text-on-surface-variant">
          現在は「この端末だけに保存中」モードです。家族共有を使うには
          Supabase の URL と anon key を .env.local に設定してください。
        </p>
        <p className="text-sm">
          詳しくは docs/SUPABASE_SETUP.md を参照してください。
        </p>
        <button
          type="button"
          onClick={() => router.push("/today")}
          className="w-full rounded-2xl bg-primary px-4 py-3.5 font-semibold text-on-primary"
        >
          アプリを続ける
        </button>
      </div>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      if (isSignUp) {
        await signUp(email, password, displayName || email.split("@")[0] || "ユーザー");
        setInfo("アカウントを作成しました。メール確認が必要な場合は受信箱を確認してください。");
      } else {
        await signIn(email, password);
        router.replace(searchParams.get("next") || "/today");
      }
    } catch (err) {
      setError(toUserFacingError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 py-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">
          {isSignUp ? "アカウント作成" : "ログイン"}
        </h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          家族で献立・買い物リストを共有します
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-3">
        {isSignUp ? (
          <label className="block space-y-1">
            <span className="text-sm font-medium">表示名</span>
            <input
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              className="w-full rounded-xl bg-surface-container px-3 py-3 outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
              placeholder="例: 満恵"
            />
          </label>
        ) : null}

        <label className="block space-y-1">
          <span className="text-sm font-medium">メールアドレス</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-xl bg-surface-container px-3 py-3 outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium">パスワード</span>
          <div className="flex gap-2">
            <input
              type={showPassword ? "text" : "password"}
              required
              minLength={6}
              autoComplete={isSignUp ? "new-password" : "current-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="min-w-0 flex-1 rounded-xl bg-surface-container px-3 py-3 outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="shrink-0 rounded-xl px-3 text-sm text-primary ring-1 ring-outline-variant"
            >
              {showPassword ? "隠す" : "表示"}
            </button>
          </div>
        </label>

        {error ? <p className="text-sm text-error">{error}</p> : null}
        {info ? <p className="text-sm text-on-surface-variant">{info}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-2xl bg-primary px-4 py-3.5 font-semibold text-on-primary disabled:opacity-60"
        >
          {loading ? "処理中…" : isSignUp ? "作成する" : "ログイン"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => {
          setIsSignUp((current) => !current);
          setError(null);
          setInfo(null);
        }}
        className="w-full text-sm font-medium text-primary"
      >
        {isSignUp ? "ログインに戻る" : "新規アカウントを作成"}
      </button>
    </div>
  );
}

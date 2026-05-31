import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";

const search = z.object({
  mode: z.enum(["create", "join"]).default("create"),
});

export const Route = createFileRoute("/auth")({
  validateSearch: search,
  component: AuthPage,
});

function AuthPage() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"signup" | "login">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgotMode, setForgotMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      if (forgotMode) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + "/auth",
        });
        if (error) throw error;
        setResetSent(true);
      } else if (tab === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        navigate({ to: "/onboard", search: { mode } });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/onboard", search: { mode } });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const switchTab = (t: "signup" | "login") => {
    setTab(t);
    setForgotMode(false);
    setResetSent(false);
    setError(null);
  };

  return (
    <div className="min-h-[100dvh] flex flex-col px-6 pt-[max(env(safe-area-inset-top),48px)] pb-8">
      <div className="flex flex-col items-center mb-10">
        <Logo size="md" />
        <p className="text-muted-foreground text-xs mt-3 tracking-wider">
          {mode === "create" ? "Create your space" : "Join your person"}
        </p>
      </div>

      <div className="flex gap-2 mb-6 p-1 rounded-2xl bg-card border border-border max-w-sm w-full mx-auto">
        {(["signup", "login"] as const).map((t) => (
          <button
            key={t}
            onClick={() => switchTab(t)}
            className="flex-1 rounded-xl py-2 text-sm font-medium transition-colors"
            style={{
              background: tab === t && !forgotMode ? "var(--mine)" : "transparent",
              color: tab === t && !forgotMode ? "var(--primary-foreground)" : "var(--muted-foreground)",
            }}
          >
            {t === "signup" ? "Sign up" : "Log in"}
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} className="max-w-sm w-full mx-auto flex flex-col gap-3">
        {forgotMode && resetSent ? (
          <>
            <p className="text-sm text-muted-foreground">Check your email for a reset link.</p>
            <button
              type="button"
              onClick={() => {
                setForgotMode(false);
                setResetSent(false);
                setError(null);
              }}
              className="text-sm text-primary underline-offset-4 hover:underline text-left"
            >
              Back to login
            </button>
          </>
        ) : (
          <>
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-card border border-border rounded-xl px-4 py-3.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            />
            {!forgotMode && (
              <input
                type="password"
                required
                minLength={8}
                autoComplete={tab === "signup" ? "new-password" : "current-password"}
                placeholder="Password (min 8 chars)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-card border border-border rounded-xl px-4 py-3.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
              />
            )}
            {!forgotMode && tab === "login" && (
              <button
                type="button"
                onClick={() => {
                  setForgotMode(true);
                  setError(null);
                }}
                className="text-sm text-primary underline-offset-4 hover:underline text-left"
              >
                Forgot password?
              </button>
            )}
            {error && <p className="text-xs text-destructive">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="rounded-2xl px-6 py-4 font-medium mt-2 disabled:opacity-50"
              style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
            >
              {busy
                ? "…"
                : forgotMode
                  ? "Send reset link"
                  : tab === "signup"
                    ? "Continue"
                    : "Log in"}
            </button>
            {forgotMode && (
              <button
                type="button"
                onClick={() => {
                  setForgotMode(false);
                  setError(null);
                }}
                className="text-sm text-primary underline-offset-4 hover:underline text-left"
              >
                Back to login
              </button>
            )}
          </>
        )}
      </form>
    </div>
  );
}

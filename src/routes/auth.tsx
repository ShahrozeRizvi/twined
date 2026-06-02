import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { Eye, EyeOff, Check } from "lucide-react";

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
  const [resetMode, setResetMode] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetSuccess, setResetSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [confirmError, setConfirmError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash.includes("type=recovery")) {
      setResetMode(true);
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setResetMode(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const onResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setResetSuccess(true);
      setTimeout(() => navigate({ to: "/today" }), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      if (forgotMode) {
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) throw error;
        setResetSent(true);
      } else if (tab === "signup") {
        if (password !== confirm) {
          setError("Passwords don't match");
          setBusy(false);
          return;
        }
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
    setConfirm("");
    setConfirmError(null);
    setShowPassword(false);
    setShowConfirm(false);
  };

  const PASSWORD_RULES = [
    { id: "length", label: "At least 8 characters", test: (p: string) => p.length >= 8 },
    { id: "uppercase", label: "One uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
    { id: "lowercase", label: "One lowercase letter", test: (p: string) => /[a-z]/.test(p) },
    { id: "number", label: "One number", test: (p: string) => /[0-9]/.test(p) },
  ];

  if (resetMode) {
    return (
      <div className="min-h-[100dvh] flex flex-col px-6 pt-[max(env(safe-area-inset-top),48px)] pb-8">
        <div className="flex flex-col items-center mb-10">
          <Logo size="md" />
          <p className="text-muted-foreground text-xs mt-3 tracking-wider">Set a new password</p>
        </div>
        <form onSubmit={onResetSubmit} className="max-w-sm w-full mx-auto flex flex-col gap-3">
          {resetSuccess ? (
            <p className="text-sm text-muted-foreground">Password updated. You're now logged in.</p>
          ) : (
            <>
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="New password (min 8 chars)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="bg-card border border-border rounded-xl px-4 py-3.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
              />
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="bg-card border border-border rounded-xl px-4 py-3.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
              />
              {error && <p className="text-xs text-destructive">{error}</p>}
              <button
                type="submit"
                disabled={busy}
                className="rounded-2xl px-6 py-4 font-medium mt-2 disabled:opacity-50"
                style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
              >
                {busy ? "…" : "Update password"}
              </button>
            </>
          )}
        </form>
      </div>
    );
  }

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
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  autoComplete={tab === "signup" ? "new-password" : "current-password"}
                  placeholder="Password (min 8 chars)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-card border border-border rounded-xl px-4 py-3.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary w-full pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            )}
            {tab === "signup" && password.length > 0 && (
              <div className="flex flex-col gap-1.5 px-1">
                {PASSWORD_RULES.map((rule) => {
                  const met = rule.test(password);
                  return (
                    <div key={rule.id} className="flex items-center gap-2 transition-all duration-200">
                      <div
                        className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200"
                        style={{ background: met ? "var(--mine)" : "var(--border)" }}
                      >
                        {met && <Check size={10} strokeWidth={3} className="text-white" />}
                      </div>
                      <span
                        className="text-xs transition-colors duration-200"
                        style={{ color: met ? "var(--mine)" : "var(--muted-foreground)" }}
                      >
                        {rule.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            {tab === "signup" && !forgotMode && (
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  required
                  placeholder="Confirm password"
                  value={confirm}
                  onChange={(e) => {
                    setConfirm(e.target.value);
                    if (e.target.value && e.target.value !== password) {
                      setConfirmError("Passwords don't match");
                    } else {
                      setConfirmError(null);
                    }
                  }}
                  className="bg-card border border-border rounded-xl px-4 py-3.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary w-full pr-12"
                  style={{ borderColor: confirmError ? "var(--destructive)" : undefined }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((p) => !p)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                  aria-label={showConfirm ? "Hide password" : "Show password"}
                >
                  {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            )}
            {confirmError && <p className="text-xs text-destructive -mt-1">{confirmError}</p>}
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
              disabled={
                busy ||
                (tab === "signup" &&
                  (!PASSWORD_RULES.every((r) => r.test(password)) || password !== confirm))
              }
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

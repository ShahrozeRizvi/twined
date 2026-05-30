import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTwined } from "@/lib/use-twined";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/join-space")({
  component: JoinSpacePage,
});

function JoinSpacePage() {
  const { user, profile, loading, refetch } = useTwined();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) navigate({ to: "/" });
  }, [user, loading, navigate]);

  // already in a space? skip to paired
  useEffect(() => {
    if (profile?.space_id) navigate({ to: "/paired" });
  }, [profile?.space_id, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const cleaned = code.trim().toUpperCase();
      const { error: rpcErr } = await supabase.rpc("join_space_by_code", { _code: cleaned });
      if (rpcErr) throw rpcErr;
      await refetch();
      navigate({ to: "/paired" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't join that space");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col px-6 pt-[max(env(safe-area-inset-top),48px)] pb-10 max-w-sm mx-auto w-full">
      <div className="flex justify-center mb-12">
        <Logo size="md" />
      </div>

      <h1 className="font-serif text-2xl mb-2">Enter their code</h1>
      <p className="text-muted-foreground text-sm mb-8">
        Your person should have shared a 6-character code.
      </p>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
          placeholder="A B C 1 2 3"
          inputMode="text"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          className="bg-card border border-border rounded-2xl px-4 py-5 text-center text-2xl font-serif tracking-[0.4em] pl-[0.4em] focus:outline-none focus:border-primary"
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <button
          type="submit"
          disabled={code.length !== 6 || busy}
          className="rounded-2xl px-6 py-4 font-medium disabled:opacity-40"
          style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
        >
          {busy ? "…" : "Twin up"}
        </button>
      </form>
    </div>
  );
}

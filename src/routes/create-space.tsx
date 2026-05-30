import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTwined } from "@/lib/use-twined";
import { Logo } from "@/components/Logo";
import { PixelAvatar, type AvatarPreset } from "@/components/PixelAvatar";
import { Copy, Check } from "lucide-react";

export const Route = createFileRoute("/create-space")({
  component: CreateSpacePage,
});

function CreateSpacePage() {
  const { user, profile, partner, loading } = useTwined();
  const navigate = useNavigate();
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/" });
      return;
    }
    if (!profile?.space_id) return;
    // fetch the invite code for my space
    (async () => {
      const { data } = await supabase
        .from("spaces")
        .select("invite_code")
        .eq("id", profile.space_id!)
        .maybeSingle();
      setCode(data?.invite_code ?? null);
    })();
  }, [user, profile, loading, navigate]);

  // when partner joins, advance to paired
  useEffect(() => {
    if (partner) navigate({ to: "/paired" });
  }, [partner, navigate]);

  const copy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* noop */
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-between px-6 pt-[max(env(safe-area-inset-top),48px)] pb-10 max-w-sm mx-auto w-full">
      <Logo size="md" />

      <div className="flex flex-col items-center text-center gap-6 flex-1 justify-center w-full">
        <PixelAvatar preset={(profile?.avatar_preset as AvatarPreset) || 1} size={72} />
        <div>
          <h1 className="font-serif text-2xl">Your space is open.</h1>
          <p className="text-muted-foreground text-sm mt-2">
            Share this code with your person.
          </p>
        </div>

        <button
          onClick={copy}
          className="w-full rounded-2xl bg-card border border-border px-6 py-6 flex flex-col items-center gap-3 active:scale-[0.99] transition"
        >
          <div className="font-serif text-4xl tracking-[0.4em] pl-[0.4em]">
            {code ?? "······"}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "Copied" : "Tap to copy"}
          </div>
        </button>

        <p className="text-xs text-muted-foreground">
          Waiting for them to join…
        </p>
      </div>

      <Link to="/today" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
        Skip for now
      </Link>
    </div>
  );
}

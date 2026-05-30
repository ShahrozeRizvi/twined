import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTwined } from "@/lib/use-twined";
import { PixelAvatar, type AvatarPreset } from "@/components/PixelAvatar";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/paired")({
  component: PairedPage,
});

function PairedPage() {
  const { profile, partner, loading } = useTwined();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!profile) navigate({ to: "/" });
  }, [profile, loading, navigate]);

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-between px-6 pt-[max(env(safe-area-inset-top),48px)] pb-10 max-w-sm mx-auto w-full">
      <Logo size="md" />

      <div className="flex flex-col items-center text-center gap-8 flex-1 justify-center">
        <div className="flex items-center gap-5">
          <div className="rounded-full p-[3px]" style={{ background: "var(--mine)" }}>
            <div className="bg-card rounded-full p-2">
              <PixelAvatar preset={(profile?.avatar_preset as AvatarPreset) || 1} size={72} />
            </div>
          </div>
          <span className="font-serif text-2xl text-muted-foreground">·</span>
          <div className="rounded-full p-[3px]" style={{ background: "var(--partner)" }}>
            <div className="bg-card rounded-full p-2">
              <PixelAvatar preset={(partner?.avatar_preset as AvatarPreset) || 2} size={72} />
            </div>
          </div>
        </div>

        <div>
          <h1 className="font-serif text-3xl">You're twined.</h1>
          {partner && (
            <p className="text-muted-foreground text-sm mt-2">
              You and {partner.name} are sharing a space.
            </p>
          )}
          {!partner && (
            <p className="text-muted-foreground text-sm mt-2">
              They'll show up here as soon as they join.
            </p>
          )}
        </div>
      </div>

      <button
        onClick={() => navigate({ to: "/today" })}
        className="w-full rounded-2xl px-6 py-4 font-medium"
        style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
      >
        Start your day
      </button>
    </div>
  );
}

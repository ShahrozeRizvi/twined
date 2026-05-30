import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Logo } from "@/components/Logo";
import { PixelAvatar } from "@/components/PixelAvatar";
import { useTwined } from "@/lib/use-twined";

export const Route = createFileRoute("/")({
  component: WelcomePage,
});

function WelcomePage() {
  const { user, profile, loading } = useTwined();
  const navigate = useNavigate();

  // auto-route signed-in users to the right place
  useEffect(() => {
    if (loading) return;
    if (!user) return;
    if (!profile) return;
    if (!profile.name) {
      navigate({ to: "/onboard", search: { mode: "create" } });
      return;
    }
    if (!profile.space_id) {
      navigate({ to: "/create-space" });
      return;
    }
    navigate({ to: "/today" });
  }, [user, profile, loading, navigate]);

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-between px-6 pt-[max(env(safe-area-inset-top),48px)] pb-[max(env(safe-area-inset-bottom),32px)]">
      <div className="flex-1 flex flex-col items-center justify-center gap-10">
        <div className="flex items-center gap-2 opacity-90">
          <PixelAvatar preset={6} size={56} />
          <span className="text-muted-foreground text-xs tracking-[0.3em]">·</span>
          <PixelAvatar preset={1} size={56} />
        </div>
        <Logo size="xl" />
        <p className="text-muted-foreground text-base text-center max-w-xs leading-relaxed">
          Your days, twined.
        </p>
      </div>

      <div className="w-full max-w-sm flex flex-col gap-3">
        <Link
          to="/auth"
          search={{ mode: "create" }}
          className="w-full text-center rounded-2xl px-6 py-4 font-medium"
          style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
        >
          Create a Space
        </Link>
        <Link
          to="/auth"
          search={{ mode: "join" }}
          className="w-full text-center rounded-2xl px-6 py-4 font-medium border border-border text-foreground"
        >
          Join a Space
        </Link>
        <p className="text-center text-xs text-muted-foreground mt-3 px-4">
          Two people. One quiet shared window.
        </p>
      </div>
    </div>
  );
}

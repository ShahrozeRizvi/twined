import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { PixelAvatar } from "@/components/PixelAvatar";
import { useTwined } from "@/lib/use-twined";

export const Route = createFileRoute("/")({
  component: WelcomePage,
});

function WelcomePage() {
  const { user, profile, loading } = useTwined();
  const navigate = useNavigate();
  const [showSplash, setShowSplash] = useState(true);
  const [splashFading, setSplashFading] = useState(false);

  // auto-route signed-in users to the right place
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash.includes("type=recovery")) {
      navigate({ to: "/auth", search: { mode: "create" } });
      return;
    }
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

  useEffect(() => {
    const fadeTimer = setTimeout(() => setSplashFading(true), 2000);
    const hideTimer = setTimeout(() => setShowSplash(false), 2600);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  return (
    <>
      {showSplash && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center bg-background transition-opacity duration-[600ms] ${splashFading ? "opacity-0" : "opacity-100"}`}
        >
          <div className="flex flex-col items-center gap-6">
            <svg
              viewBox="0 0 400 100"
              className="w-64"
              aria-label="Twined"
            >
              <text
                x="50%"
                y="60%"
                dominantBaseline="middle"
                textAnchor="middle"
                fill="none"
                stroke="var(--mine)"
                strokeWidth="1.5"
                className="twined-write"
                style={{ fontFamily: "'Pinyon Script', cursive", fontSize: "72px" }}
              >
                Twined
              </text>
              <text
                x="50%"
                y="60%"
                dominantBaseline="middle"
                textAnchor="middle"
                fill="var(--mine)"
                className="twined-fill"
                style={{ fontFamily: "'Pinyon Script', cursive", fontSize: "72px" }}
              >
                Twined
              </text>
            </svg>
            <p className="twined-tagline text-sm text-muted-foreground tracking-wide">
              Two people. One quiet shared window.
            </p>
          </div>
        </div>
      )}
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
        </div>
      </div>
    </>
  );
}

import { useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { useTwined } from "@/lib/use-twined";
import { TimezoneHeader } from "@/components/TimezoneHeader";
import { BottomNav } from "@/components/BottomNav";

export function AppShell({ children }: { children: ReactNode }) {
  const { user, profile, partner, loading } = useTwined();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/" });
      return;
    }
    if (!profile) return;
    if (!profile.name) {
      navigate({ to: "/onboard", search: { mode: "create" } });
      return;
    }
    if (!profile.space_id) {
      navigate({ to: "/create-space" });
    }
  }, [user, profile, loading, navigate]);

  if (loading || !profile?.space_id) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center text-muted-foreground text-sm">
        …
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <TimezoneHeader me={profile} partner={partner} />
      <main className="flex-1 overflow-y-auto">{children}</main>
      <BottomNav />
    </div>
  );
}

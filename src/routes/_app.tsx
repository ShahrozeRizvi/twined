import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTwined } from "@/lib/use-twined";
import { TimezoneHeader } from "@/components/TimezoneHeader";
import { BottomNav } from "@/components/BottomNav";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, profile, loading } = useTwined();
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
      <TimezoneHeader me={profile} partner={null /* set below */} />
      <AppBody />
    </div>
  );
}

function AppBody() {
  const { profile, partner } = useTwined();
  if (!profile) return null;
  return (
    <>
      {/* re-render header with partner present */}
      <div className="-mt-[1px]">
        {/* header already at top from parent — we duplicate inside to get partner-aware sticky once partner loads */}
      </div>
      <PartnerHeader />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
      <BottomNav />
    </>
  );
}

function PartnerHeader() {
  // header already rendered above; nothing to do here. Kept for future expansion.
  return null;
}

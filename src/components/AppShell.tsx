import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTwined } from "@/lib/use-twined";
import { TimezoneHeader } from "@/components/TimezoneHeader";
import { BottomNav } from "@/components/BottomNav";
import { PingListener } from "@/components/PingListener";
import { FloatingHearts } from "@/components/FloatingHearts";

export function AppShell({ children }: { children: ReactNode }) {
  const { user, profile, partner, loading } = useTwined();
  const navigate = useNavigate();
  const [connected, setConnected] = useState(true);
  const lastActiveAt = useRef<number>(Date.now());

  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === "hidden") {
        lastActiveAt.current = Date.now();
        return;
      }

      const awayMs = Date.now() - lastActiveAt.current;

      if (awayMs > 30_000) {
        setConnected(false);

        try {
          await supabase.removeAllChannels();
          await new Promise((resolve) => setTimeout(resolve, 500));
          window.dispatchEvent(new CustomEvent("twined:reconnect"));
          setConnected(true);
        } catch {
          setConnected(false);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const channel = supabase.channel("connection-monitor");

    channel
      .on("system", { event: "disconnect" }, () => {
        setConnected(false);
      })
      .on("system", { event: "reconnect" }, () => {
        setConnected(true);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setConnected(true);
        if (status === "CHANNEL_ERROR") setConnected(false);
        if (status === "TIMED_OUT") setConnected(false);
        if (status === "CLOSED") setConnected(false);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const onOnline = () => setConnected(true);
    const onOffline = () => setConnected(false);

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash.includes("type=recovery")) {
      navigate({ to: "/auth", search: { mode: "create" } });
      return;
    }
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
    <div className="h-[100dvh] flex flex-col">
      {!connected && (
        <div
          className="shrink-0 bg-destructive/90 text-destructive-foreground text-[11px] text-center py-1 px-3"
          style={{ animation: "slide-down 0.3s ease-out" }}
        >
          No connection — updates paused
        </div>
      )}
      <TimezoneHeader me={profile} partner={partner} />
      <main className="flex-1 min-h-0 overflow-y-auto">{children}</main>
      <BottomNav />
      <PingListener me={profile} partner={partner} />
      <FloatingHearts spaceId={profile.space_id} myId={profile.id} />
    </div>
  );
}


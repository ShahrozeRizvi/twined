import { useEffect, useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { CheckSquare, Sparkles, Map, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTwined } from "@/lib/use-twined";

const TABS = [
  { to: "/today", label: "Today", icon: CheckSquare },
  { to: "/moments", label: "Moments", icon: Sparkles },
  { to: "/map", label: "Map", icon: Map },
  { to: "/settings", label: "Me", icon: User },
] as const;

const lastSeenKey = (userId: string) => `twined_today_last_seen_${userId}`;

export function BottomNav() {
  const { pathname } = useLocation();
  const { user, profile, partner } = useTwined();
  const [todayBadge, setTodayBadge] = useState(0);

  const spaceId = profile?.space_id ?? null;
  const userId = user?.id ?? null;
  const partnerId = partner?.id ?? null;
  const onToday = pathname.startsWith("/today");

  // Initial count of unseen partner task activity
  useEffect(() => {
    if (!userId || !spaceId || !partnerId) {
      setTodayBadge(0);
      return;
    }
    const lastSeen =
      typeof window !== "undefined"
        ? localStorage.getItem(lastSeenKey(userId)) ?? new Date(0).toISOString()
        : new Date(0).toISOString();

    let cancelled = false;
    (async () => {
      const { count } = await supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("space_id", spaceId)
        .eq("user_id", partnerId)
        .gt("created_at", lastSeen);
      if (!cancelled && typeof count === "number") {
        setTodayBadge(count);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, spaceId, partnerId]);

  // Realtime: increment on partner INSERT/UPDATE when not on /today
  useEffect(() => {
    if (!spaceId || !partnerId) return;
    const ch = supabase
      .channel(`today-badge:${spaceId}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "tasks", filter: `space_id=eq.${spaceId}` },
        (payload) => {
          const row = payload.new as { user_id?: string };
          if (row.user_id === partnerId && !onToday) {
            setTodayBadge((n) => n + 1);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "tasks", filter: `space_id=eq.${spaceId}` },
        (payload) => {
          const row = payload.new as { user_id?: string };
          if (row.user_id === partnerId && !onToday) {
            setTodayBadge((n) => n + 1);
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [spaceId, partnerId, onToday]);

  // Reset when visiting /today
  useEffect(() => {
    if (onToday && userId) {
      setTodayBadge(0);
      try {
        localStorage.setItem(lastSeenKey(userId), new Date().toISOString());
      } catch {
        // ignore
      }
    }
  }, [onToday, userId]);

  return (
    <nav
      className="sticky bottom-0 z-30 bg-card border-t border-border"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 8px)" }}
    >
      <div className="grid grid-cols-4 px-2 pt-2">
        {TABS.map(({ to, label, icon: Icon }) => {
          const active = pathname.startsWith(to);
          const showBadge = to === "/today" && todayBadge > 0;
          return (
            <Link
              key={to}
              to={to}
              className="flex flex-col items-center gap-1 py-1.5 rounded-lg transition-colors"
              style={{
                color: active ? "var(--mine)" : "var(--muted-foreground)",
              }}
            >
              <span className="relative inline-flex">
                <Icon size={22} strokeWidth={active ? 2.4 : 1.8} />
                {showBadge && (
                  <span
                    key={todayBadge}
                    className="absolute -top-1.5 -right-2 flex items-center justify-center rounded-full font-bold animate-in zoom-in-50 duration-200"
                    style={{
                      width: 16,
                      height: 16,
                      backgroundColor: "#EF4444",
                      color: "#fff",
                      fontSize: 9,
                      lineHeight: 1,
                    }}
                  >
                    {todayBadge > 9 ? "9+" : todayBadge}
                  </span>
                )}
              </span>
              <span className="text-[11px] font-medium tracking-wide">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

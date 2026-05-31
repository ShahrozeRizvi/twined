import { useEffect, useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { CheckSquare, Sparkles, Map, User, Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTwined } from "@/lib/use-twined";
import { spawnLocalHeart, broadcastHeart } from "@/components/FloatingHearts";

const LEFT_TABS = [
  { to: "/today", label: "Today", icon: CheckSquare },
  { to: "/moments", label: "Moments", icon: Sparkles },
] as const;

const RIGHT_TABS = [
  { to: "/map", label: "Map", icon: Map },
  { to: "/settings", label: "Me", icon: User },
] as const;

const lastSeenKey = (userId: string) => `twined_today_last_seen_${userId}`;

function todayMidnightIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function BottomNav() {
  const { pathname } = useLocation();
  const { user, profile, partner } = useTwined();
  const [todayBadge, setTodayBadge] = useState(0);
  const [heartCount, setHeartCount] = useState(0);

  const spaceId = profile?.space_id ?? null;
  const userId = user?.id ?? null;
  const partnerId = partner?.id ?? null;
  const onToday = pathname.startsWith("/today");

  // Today tab: unseen partner task activity
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
      if (!cancelled && typeof count === "number") setTodayBadge(count);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, spaceId, partnerId]);

  useEffect(() => {
    if (!spaceId || !partnerId) return;
    const ch = supabase
      .channel(`today-badge:${spaceId}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "tasks", filter: `space_id=eq.${spaceId}` },
        (payload) => {
          const row = payload.new as { user_id?: string };
          if (row.user_id === partnerId && !onToday) setTodayBadge((n) => n + 1);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "tasks", filter: `space_id=eq.${spaceId}` },
        (payload) => {
          const row = payload.new as { user_id?: string };
          if (row.user_id === partnerId && !onToday) setTodayBadge((n) => n + 1);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [spaceId, partnerId, onToday]);

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

  // Heart counter: my pings sent today (re-queries on mount / day change)
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const load = async () => {
      const { count } = await supabase
        .from("thinking_pings")
        .select("id", { count: "exact", head: true })
        .eq("from_user_id", userId)
        .gte("created_at", todayMidnightIso());
      if (!cancelled && typeof count === "number") setHeartCount(count);
    };
    load();
    // Re-check at next local midnight
    const now = new Date();
    const next = new Date(now);
    next.setHours(24, 0, 5, 0);
    const t = setTimeout(load, Math.max(1000, next.getTime() - now.getTime()));
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [userId]);

  const sendHeart = async () => {
    if (!profile?.space_id || !profile.id) return;
    // Optimistic UI
    setHeartCount((n) => n + 1);
    spawnLocalHeart("mine");
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate([80, 60, 120]);
      } catch {
        // ignore
      }
    }
    try {
      await supabase.from("thinking_pings").insert({
        space_id: profile.space_id,
        from_user_id: profile.id,
      });
      await broadcastHeart();
    } catch {
      setHeartCount((n) => Math.max(0, n - 1));
    }
  };

  const renderTab = (
    to: string,
    label: string,
    Icon: typeof CheckSquare,
    showBadge: boolean,
    badgeValue: number
  ) => {
    const active = pathname.startsWith(to);
    return (
      <Link
        key={to}
        to={to}
        className="flex flex-col items-center gap-1 py-1.5 rounded-lg transition-colors"
        style={{ color: active ? "var(--mine)" : "var(--muted-foreground)" }}
      >
        <span className="relative inline-flex">
          <Icon size={22} strokeWidth={active ? 2.4 : 1.8} />
          {showBadge && (
            <span
              key={badgeValue}
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
              {badgeValue > 9 ? "9+" : badgeValue}
            </span>
          )}
        </span>
        <span className="text-[11px] font-medium tracking-wide">{label}</span>
      </Link>
    );
  };

  return (
    <nav
      className="sticky bottom-0 z-30 bg-card border-t border-border"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 8px)" }}
    >
      <div className="grid grid-cols-5 px-2 pt-2 items-end">
        {LEFT_TABS.map((t) =>
          renderTab(t.to, t.label, t.icon, t.to === "/today" && todayBadge > 0, todayBadge)
        )}

        {/* Center heart action */}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={sendHeart}
            disabled={!profile?.space_id}
            aria-label="Thinking of you"
            className="relative -mt-6 rounded-full flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50"
            style={{
              width: 52,
              height: 52,
              backgroundColor: "var(--mine)",
              color: "#fff",
              boxShadow:
                "0 8px 18px -6px color-mix(in oklab, var(--mine) 55%, transparent), 0 2px 4px rgba(0,0,0,0.12)",
            }}
          >
            <Heart size={24} fill="#fff" strokeWidth={0} />
            {heartCount > 0 && (
              <span
                key={heartCount}
                className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full px-2 py-0.5 font-semibold animate-in zoom-in-50 duration-200"
                style={{
                  backgroundColor: "color-mix(in oklab, var(--mine) 85%, black)",
                  color: "#fff",
                  fontSize: 10,
                  lineHeight: 1.2,
                  whiteSpace: "nowrap",
                }}
              >
                {heartCount}
              </span>
            )}
          </button>
        </div>

        {RIGHT_TABS.map((t) => renderTab(t.to, t.label, t.icon, false, 0))}
      </div>
    </nav>
  );
}

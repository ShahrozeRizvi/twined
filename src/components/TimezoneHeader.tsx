import { useEffect, useState } from "react";
import { formatLocalTime } from "@/lib/twined";
import type { Profile } from "@/lib/use-twined";
import { PixelAvatar } from "./PixelAvatar";
import type { AvatarPreset } from "./PixelAvatar";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";

interface TimezoneHeaderProps {
  me: Profile;
  partner: Profile | null;
}

export function TimezoneHeader({ me, partner }: TimezoneHeaderProps) {
  const [now, setNow] = useState(() => new Date());
  const [myCount, setMyCount] = useState(0);
  const [partnerCount, setPartnerCount] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!me.space_id) return;
    let cancelled = false;

    const fetchCounts = async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { count: myC } = await supabase
        .from("thinking_pings")
        .select("*", { count: "exact", head: true })
        .eq("space_id", me.space_id!)
        .eq("from_user_id", me.id)
        .gte("created_at", today.toISOString());

      if (!cancelled) setMyCount(myC ?? 0);

      if (partner?.id) {
        const { count: pC } = await supabase
          .from("thinking_pings")
          .select("*", { count: "exact", head: true })
          .eq("space_id", me.space_id!)
          .eq("from_user_id", partner.id)
          .gte("created_at", today.toISOString());

        if (!cancelled) setPartnerCount(pC ?? 0);
      } else if (!cancelled) {
        setPartnerCount(0);
      }
    };

    fetchCounts();

    const channel = supabase
      .channel(`pings-header:${me.space_id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "thinking_pings",
          filter: `space_id=eq.${me.space_id}`,
        },
        (payload) => {
          const ping = payload.new as { from_user_id: string };
          if (ping.from_user_id === me.id) {
            setMyCount((c) => c + 1);
          } else {
            setPartnerCount((c) => c + 1);
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [me.space_id, me.id, partner?.id]);

  return (
    <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-md border-b border-border">
      <div className="px-4 pt-[max(env(safe-area-inset-top),12px)] pb-3 flex items-center justify-between gap-3">
        <PersonCell
          name={me.name || "You"}
          tz={me.timezone}
          preset={me.avatar_preset as AvatarPreset}
          color="mine"
          now={now}
          align="start"
          count={myCount}
        />
        <Logo size="sm" />
        <PersonCell
          name={partner?.name || "Your person"}
          tz={partner?.timezone || me.timezone}
          preset={(partner?.avatar_preset as AvatarPreset) || 2}
          color="partner"
          now={now}
          align="end"
          muted={!partner}
          count={partnerCount}
        />
      </div>
    </header>
  );
}

function PersonCell({
  name,
  tz,
  preset,
  color,
  now,
  align,
  muted,
  count = 0,
}: {
  name: string;
  tz: string;
  preset: AvatarPreset;
  color: "mine" | "partner";
  now: Date;
  align: "start" | "end";
  muted?: boolean;
  count?: number;
}) {
  return (
    <div className={`flex items-center gap-2 ${align === "end" ? "flex-row-reverse text-right" : ""}`}>
      <div className="relative">
        <div
          className="rounded-full p-[2px]"
          style={{
            background: muted
              ? "transparent"
              : color === "mine"
                ? "var(--mine)"
                : "var(--partner)",
            opacity: muted ? 0.4 : 1,
          }}
        >
          <div className="bg-card rounded-full p-[3px]">
            <PixelAvatar preset={preset} size={28} animated={false} />
          </div>
        </div>
        {count > 0 && (
          <div
            className="absolute -top-1 -right-1 flex items-center justify-center rounded-full text-white font-bold border-2 border-background"
            style={{
              background: "#EF4444",
              minWidth: 18,
              height: 18,
              fontSize: 10,
              paddingLeft: count > 9 ? 3 : 0,
              paddingRight: count > 9 ? 3 : 0,
              lineHeight: "14px",
              zIndex: 10,
            }}
          >
            {count > 99 ? "99+" : count}
          </div>
        )}
      </div>
      <div className={`flex flex-col leading-tight ${muted ? "opacity-50" : ""}`}>
        <span className="text-[13px] font-medium text-foreground truncate max-w-[100px]">
          {name}
        </span>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {formatLocalTime(tz, now)}
        </span>
      </div>
    </div>
  );
}

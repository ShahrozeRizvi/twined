import { useEffect, useState } from "react";
import { formatLocalTime } from "@/lib/twined";
import type { Profile } from "@/lib/use-twined";
import { PixelAvatar } from "./PixelAvatar";
import type { AvatarPreset } from "./PixelAvatar";

interface TimezoneHeaderProps {
  me: Profile;
  partner: Profile | null;
}

export function TimezoneHeader({ me, partner }: TimezoneHeaderProps) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

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
        />
        <span className="text-muted-foreground text-xs tracking-widest mt-2">←→</span>
        <PersonCell
          name={partner?.name || "Your person"}
          tz={partner?.timezone || me.timezone}
          preset={(partner?.avatar_preset as AvatarPreset) || 2}
          color="partner"
          now={now}
          align="end"
          muted={!partner}
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
}: {
  name: string;
  tz: string;
  preset: AvatarPreset;
  color: "mine" | "partner";
  now: Date;
  align: "start" | "end";
  muted?: boolean;
}) {
  return (
    <div className={`flex items-center gap-2 ${align === "end" ? "flex-row-reverse text-right" : ""}`}>
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

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "@/lib/use-twined";

interface Props {
  me: Profile;
  partner: Profile | null;
}

function playPingSound() {
  try {
    const Ctx =
      (window.AudioContext as typeof AudioContext) ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(880, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.18);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.4);
    setTimeout(() => ctx.close().catch(() => {}), 600);
  } catch {
    // ignore — autoplay restrictions etc.
  }
}

export function PingListener({ me, partner }: Props) {
  const mountedAt = useRef<number>(Date.now());

  useEffect(() => {
    if (!me.space_id) return;
    const ch = supabase
      .channel(`pings-global:${me.space_id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "thinking_pings",
          filter: `space_id=eq.${me.space_id}`,
        },
        (payload) => {
          const p = payload.new as {
            from_user_id: string;
            created_at: string;
          };
          if (p.from_user_id === me.id) return;
          // ignore pings that arrived before this listener mounted (avoid replays)
          if (new Date(p.created_at).getTime() < mountedAt.current - 2000) return;

          const name = partner?.name || "Your person";
          try {
            navigator.vibrate?.([80, 60, 120]);
          } catch {
            // ignore
          }
          playPingSound();
          toast(`${name} is thinking of you 🤍`, {
            duration: 4500,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [me.space_id, me.id, partner?.name]);

  return null;
}

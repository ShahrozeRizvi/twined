import { useEffect, useRef, useState } from "react";
import { Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export type HeartOrigin = "mine" | "partner";

interface FloatingHeart {
  id: string;
  size: number;
  drift: number; // horizontal drift in px
  origin: HeartOrigin;
  delay: number;
}

let _spawnHeart: ((origin: HeartOrigin) => void) | null = null;
export function spawnLocalHeart(origin: HeartOrigin = "mine") {
  _spawnHeart?.(origin);
}

export function FloatingHearts({
  spaceId,
  myId,
}: {
  spaceId: string;
  myId: string;
}) {
  const [hearts, setHearts] = useState<FloatingHeart[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const spawn = (origin: HeartOrigin) => {
    const count = 1 + Math.floor(Math.random() * 2);
    const next: FloatingHeart[] = [];
    for (let i = 0; i < count; i++) {
      next.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        size: 20 + Math.floor(Math.random() * 17),
        drift: (Math.random() - 0.5) * 120,
        origin,
        delay: i * 80,
      });
    }
    setHearts((prev) => [...prev, ...next]);
    next.forEach((h) => {
      setTimeout(() => {
        setHearts((prev) => prev.filter((x) => x.id !== h.id));
      }, 1600 + h.delay);
    });
  };

  // Expose for local triggering (BottomNav)
  useEffect(() => {
    _spawnHeart = spawn;
    return () => {
      if (_spawnHeart === spawn) _spawnHeart = null;
    };
  }, []);

  // Subscribe to broadcast channel
  useEffect(() => {
    if (!spaceId) return;
    const ch = supabase.channel(`hearts:${spaceId}`, {
      config: { broadcast: { self: false } },
    });
    ch.on("broadcast", { event: "heart" }, (msg) => {
      const payload = msg.payload as { from?: string };
      if (!payload?.from || payload.from === myId) return;
      spawn("partner");
    }).subscribe();
    channelRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
      channelRef.current = null;
    };
  }, [spaceId, myId]);

  return (
    <div className="fixed inset-0 z-50 pointer-events-none overflow-hidden">
      {hearts.map((h) => (
        <span
          key={h.id}
          className="absolute"
          style={{
            left: `calc(50% + ${h.drift}px)`,
            bottom: "96px",
            transform: "translateX(-50%)",
            color: h.origin === "mine" ? "var(--mine)" : "var(--partner)",
            animation: `float-heart 1.5s ease-out forwards`,
            animationDelay: `${h.delay}ms`,
            opacity: 0,
          }}
        >
          <Heart size={h.size} fill="currentColor" strokeWidth={0} />
        </span>
      ))}
    </div>
  );
}

/** Broadcast a heart event to the partner via the shared channel. */
export async function broadcastHeart(spaceId: string, fromId: string) {
  const ch = supabase.channel(`hearts:${spaceId}`);
  await new Promise<void>((resolve) => {
    ch.subscribe((status) => {
      if (status === "SUBSCRIBED") resolve();
    });
    setTimeout(() => resolve(), 400);
  });
  await ch.send({
    type: "broadcast",
    event: "heart",
    payload: { from: fromId, x: Math.random() },
  });
  // Don't remove — let the subscribed FloatingHearts instance own its channel.
  // This temporary sender channel will be GC'd on page unload.
  setTimeout(() => supabase.removeChannel(ch), 500);
}

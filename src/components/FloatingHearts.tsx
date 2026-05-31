import { useEffect, useRef, useState } from "react";
import { Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type HeartOrigin = "mine" | "partner";

interface FloatingHeart {
  id: string;
  size: number;
  drift: number;
  origin: HeartOrigin;
  delay: number;
}

let _spawnHeart: ((origin: HeartOrigin) => void) | null = null;
let _channel: RealtimeChannel | null = null;
let _myId: string | null = null;

export function spawnLocalHeart(origin: HeartOrigin = "mine") {
  _spawnHeart?.(origin);
}

export async function broadcastHeart() {
  if (!_channel || !_myId) return;
  await _channel.send({
    type: "broadcast",
    event: "heart",
    payload: { from: _myId, x: Math.random() },
  });
}

export function FloatingHearts({
  spaceId,
  myId,
}: {
  spaceId: string;
  myId: string;
}) {
  const [hearts, setHearts] = useState<FloatingHeart[]>([]);
  const spawnRef = useRef<(origin: HeartOrigin) => void>(() => {});

  spawnRef.current = (origin: HeartOrigin) => {
    const count = 1 + Math.floor(Math.random() * 2);
    const next: FloatingHeart[] = [];
    for (let i = 0; i < count; i++) {
      next.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}-${i}`,
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
      }, 1700 + h.delay);
    });
  };

  useEffect(() => {
    const fn = (o: HeartOrigin) => spawnRef.current(o);
    _spawnHeart = fn;
    _myId = myId;
    return () => {
      if (_spawnHeart === fn) _spawnHeart = null;
    };
  }, [myId]);

  useEffect(() => {
    if (!spaceId) return;
    const ch = supabase.channel(`hearts:${spaceId}`, {
      config: { broadcast: { self: false } },
    });
    ch.on("broadcast", { event: "heart" }, (msg) => {
      const payload = msg.payload as { from?: string };
      if (!payload?.from || payload.from === myId) return;
      spawnRef.current("partner");
    }).subscribe();
    _channel = ch;
    return () => {
      if (_channel === ch) _channel = null;
      supabase.removeChannel(ch);
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
            animation: "float-heart 1.5s ease-out forwards",
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

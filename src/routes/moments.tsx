import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTwined, type Profile } from "@/lib/use-twined";
import { formatLocalTime, localDateString } from "@/lib/twined";
import { PixelAvatar, type AvatarPreset } from "@/components/PixelAvatar";
import { AppShell } from "@/components/AppShell";
import { Plus, Heart, ImagePlus, Send, X } from "lucide-react";

export const Route = createFileRoute("/moments")({
  component: () => <AppShell><MomentsPage /></AppShell>,
});

interface Moment {
  id: string;
  space_id: string;
  user_id: string;
  type: "text" | "photo" | "voice" | "video";
  content: string | null;
  media_url: string | null;
  created_at: string;
}

function MomentsPage() {
  const { profile, partner } = useTwined();
  const [moments, setMoments] = useState<Moment[]>([]);
  const [yesterdayMoments, setYesterdayMoments] = useState<Moment[] | null>(null);
  const [loadingYesterday, setLoadingYesterday] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [pingFlash, setPingFlash] = useState<string | null>(null);

  const loadYesterday = async () => {
    if (!profile?.space_id) return;
    if (yesterdayMoments !== null) {
      setYesterdayMoments(null);
      return;
    }
    setLoadingYesterday(true);
    try {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - 1);
      const ydayStr = localDateString(profile.timezone, d);
      // Local-midnight bounds in the browser's timezone
      const startUtc = new Date(`${ydayStr}T00:00:00`);
      const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000);
      const { data } = await supabase
        .from("moments")
        .select("*")
        .eq("space_id", profile.space_id!)
        .gte("created_at", startUtc.toISOString())
        .lt("created_at", endUtc.toISOString())
        .order("created_at", { ascending: false });
      setYesterdayMoments((data as Moment[]) || []);
    } finally {
      setLoadingYesterday(false);
    }
  };

  useEffect(() => {
    if (!profile?.space_id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("moments")
        .select("*")
        .eq("space_id", profile.space_id!)
        .order("created_at", { ascending: false })
        .limit(100);
      if (!cancelled) setMoments((data as Moment[]) || []);
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.space_id]);

  // realtime moments
  useEffect(() => {
    if (!profile?.space_id) return;
    const ch = supabase
      .channel(`moments:${profile.space_id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "moments",
          filter: `space_id=eq.${profile.space_id}`,
        },
        (payload) =>
          setMoments((prev) => {
            const m = payload.new as Moment;
            if (prev.some((x) => x.id === m.id)) return prev;
            return [m, ...prev];
          })
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "moments",
          filter: `space_id=eq.${profile.space_id}`,
        },
        (payload) =>
          setMoments((prev) => prev.filter((x) => x.id !== (payload.old as Moment).id))
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [profile?.space_id]);

  // (Partner ping notifications are handled globally by PingListener in AppShell)


  const sendPing = async () => {
    if (!profile?.space_id) return;
    await supabase.from("thinking_pings").insert({
      space_id: profile.space_id,
      from_user_id: profile.id,
    });
    setPingFlash("Sent 🤍");
    setTimeout(() => setPingFlash(null), 2500);
  };

  if (!profile) return null;

  return (
    <div className="relative pb-24">
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <h1 className="font-serif text-xl">Moments</h1>
        <button
          onClick={sendPing}
          className="flex items-center gap-1.5 text-xs rounded-full border border-border px-3 py-1.5 active:scale-95 transition"
          style={{ color: "var(--mine)" }}
        >
          <Heart size={13} fill="currentColor" />
          Thinking of you
        </button>
      </div>

      {pingFlash && (
        <div
          className="mx-4 mb-3 rounded-2xl px-4 py-3 text-sm text-center"
          style={{ background: "color-mix(in oklab, var(--mine) 20%, var(--card))" }}
        >
          {pingFlash}
        </div>
      )}

      <div className="px-4 pb-2">
        <button
          onClick={loadYesterday}
          disabled={loadingYesterday}
          className="text-xs text-muted-foreground hover:text-foreground transition disabled:opacity-50"
        >
          {loadingYesterday
            ? "Loading…"
            : yesterdayMoments !== null
              ? "Hide yesterday"
              : "← Yesterday"}
        </button>
      </div>

      <div className="flex flex-col gap-3 px-4">
        {yesterdayMoments !== null && (
          <>
            <div className="flex items-center gap-2 pt-1">
              <div className="h-px flex-1 bg-border" />
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Yesterday
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>
            {yesterdayMoments.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                Nothing from yesterday.
              </p>
            )}
            {yesterdayMoments.map((m) => renderMoment(m, profile, partner))}
            <div className="flex items-center gap-2 pt-1">
              <div className="h-px flex-1 bg-border" />
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Today
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>
          </>
        )}

        {moments.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center py-16 gap-4">
            <PixelAvatar preset={profile.avatar_preset as AvatarPreset} size={72} />
            <p className="text-sm text-muted-foreground">Share a moment from your day</p>
          </div>
        )}

        {moments.map((m) => renderMoment(m, profile, partner))}
      </div>

      <button
        onClick={() => setComposerOpen(true)}
        className="fixed bottom-24 right-5 z-20 w-14 h-14 rounded-full flex items-center justify-center shadow-lg"
        style={{ background: "var(--mine)", color: "var(--primary-foreground)" }}
        aria-label="Add moment"
      >
        <Plus size={26} strokeWidth={2.4} />
      </button>

      {composerOpen && (
        <Composer profile={profile} onClose={() => setComposerOpen(false)} />
      )}
    </div>
  );
}

function Composer({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const sendText = async () => {
    if (!text.trim() || !profile.space_id) return;
    setBusy(true);
    try {
      await supabase.from("moments").insert({
        space_id: profile.space_id,
        user_id: profile.id,
        type: "text",
        content: text.trim().slice(0, 280),
      });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const sendPhoto = async (file: File) => {
    if (!profile.space_id) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${profile.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("moments-media")
        .upload(path, file);
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("moments-media").getPublicUrl(path);
      await supabase.from("moments").insert({
        space_id: profile.space_id,
        user_id: profile.id,
        type: "photo",
        media_url: pub.publicUrl,
        content: text.trim() ? text.trim().slice(0, 280) : null,
      });
      onClose();
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center">
      <div
        className="w-full max-w-md bg-card border border-border rounded-t-3xl sm:rounded-3xl p-4 flex flex-col gap-3"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 16px)" }}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-sm text-muted-foreground">Share a moment</h2>
          <button onClick={onClose} className="text-muted-foreground" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 280))}
          placeholder="What's happening?"
          rows={4}
          className="bg-background border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary resize-none"
        />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{text.length}/280</span>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && sendPhoto(e.target.files[0])}
        />

        <div className="flex gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex-1 flex items-center justify-center gap-2 rounded-2xl border border-border py-3 text-sm disabled:opacity-50"
          >
            <ImagePlus size={16} />
            {uploading ? "Uploading…" : "Photo"}
          </button>
          <button
            onClick={sendText}
            disabled={!text.trim() || busy}
            className="flex-1 flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-medium disabled:opacity-40"
            style={{ background: "var(--mine)", color: "var(--primary-foreground)" }}
          >
            <Send size={15} />
            Post
          </button>
        </div>
      </div>
    </div>
  );
}

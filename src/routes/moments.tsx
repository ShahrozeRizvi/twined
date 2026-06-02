import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTwined, type Profile } from "@/lib/use-twined";
import { formatLocalTime, localDateString } from "@/lib/twined";
import { PixelAvatar, type AvatarPreset } from "@/components/PixelAvatar";
import { AppShell } from "@/components/AppShell";
import { Plus, ImagePlus, Camera, Send, X } from "lucide-react";

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

function renderMoment(m: Moment, profile: Profile, partner: Profile | null) {
  const isMine = m.user_id === profile.id;
  const author = isMine ? profile : partner;
  return (
    <article
      key={m.id}
      className="rounded-2xl bg-card border border-border p-3"
      style={{
        borderLeftColor: isMine ? "var(--mine)" : "var(--partner)",
        borderLeftWidth: 3,
        background: isMine ? undefined : "color-mix(in oklab, var(--partner) 5%, var(--card))",
      }}
    >
      <header className="flex items-center gap-2 mb-2">
        {author && (
          <PixelAvatar preset={author.avatar_preset as AvatarPreset} size={22} animated={false} />
        )}
        <span className="text-sm font-semibold">{author?.name || "—"}</span>
        <span className="text-[11px] text-muted-foreground ml-auto tabular-nums">
          {formatLocalTime(profile.timezone, new Date(m.created_at))}
          {partner && profile.timezone !== partner.timezone && (
            <span className="ml-1.5 opacity-60">
              · {formatLocalTime(partner.timezone, new Date(m.created_at))}
            </span>
          )}
        </span>
      </header>

      {m.type === "text" && m.content && (
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.content}</p>
      )}
      {m.type === "photo" && m.media_url && (
        <>
          <img
            src={m.media_url}
            alt=""
            className="rounded-xl w-full object-cover max-h-[420px]"
            loading="lazy"
          />
          {m.content && (
            <p className="text-sm leading-relaxed whitespace-pre-wrap mt-2">{m.content}</p>
          )}
        </>
      )}
      {(m.type === "voice" || m.type === "video") && (
        <p className="text-xs text-muted-foreground italic">
          ({m.type} — coming soon)
        </p>
      )}
    </article>
  );
}

function MomentsPage() {
  const { profile, partner } = useTwined();
  const [moments, setMoments] = useState<Moment[]>([]);
  const [composerOpen, setComposerOpen] = useState(false);
  

  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const todayEnd = useMemo(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d;
  }, []);

  useEffect(() => {
    if (!profile?.space_id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("moments")
        .select("*")
        .eq("space_id", profile.space_id!)
        .gte("created_at", todayStart.toISOString())
        .lte("created_at", todayEnd.toISOString())
        .order("created_at", { ascending: false })
        .limit(100);
      if (!cancelled) setMoments((data as Moment[]) || []);
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.space_id, todayStart, todayEnd]);

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
        (payload) => {
          const m = payload.new as Moment;
          const mDate = new Date(m.created_at);
          if (mDate < todayStart || mDate > todayEnd) return;
          setMoments((prev) => {
            if (prev.some((x) => x.id === m.id)) return prev;
            return [m, ...prev];
          });
        }
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
  }, [profile?.space_id, todayStart, todayEnd]);

  // (Partner ping notifications are handled globally by PingListener in AppShell)

  if (!profile) return null;

  return (
    <div className="relative pb-24">
      <p className="text-xs text-muted-foreground px-4 pt-4 pb-1">
        {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
      </p>

      <div className="flex flex-col gap-3 px-4 pt-2">
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const previewUrl = selectedFile ? URL.createObjectURL(selectedFile) : null;

  const handlePost = async () => {
    if (!profile.space_id) return;
    if (selectedFile) {
      setUploading(true);
      try {
        const ext = selectedFile.name.split(".").pop() || "jpg";
        const path = `${profile.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("moments-media")
          .upload(path, selectedFile);
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("moments-media").getPublicUrl(path);
        await supabase.from("moments").insert({
          space_id: profile.space_id,
          user_id: profile.id,
          type: "photo",
          media_url: pub.publicUrl,
          content: text.trim() ? text.trim().slice(0, 280) : null,
        });
        setSelectedFile(null);
        onClose();
      } finally {
        setUploading(false);
      }
      return;
    }
    if (text.trim()) {
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
    }
  };

  const canPost = !!text.trim() || !!selectedFile;

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

        {previewUrl && (
          <div className="relative self-start">
            <img
              src={previewUrl}
              alt="Preview"
              className="rounded-xl max-h-[200px] object-cover"
            />
            <button
              onClick={() => setSelectedFile(null)}
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-background border border-border flex items-center justify-center shadow-sm"
              aria-label="Remove photo"
            >
              <X size={12} />
            </button>
          </div>
        )}

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
          onChange={(e) => {
            const file = e.target.files?.[0] || null;
            if (file) setSelectedFile(file);
            if (e.target.value) e.target.value = "";
          }}
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0] || null;
            if (file) setSelectedFile(file);
            if (e.target.value) e.target.value = "";
          }}
        />

        <div className="flex gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex-1 flex items-center justify-center gap-2 rounded-2xl border border-border py-3 text-sm disabled:opacity-50"
          >
            <ImagePlus size={16} />
            Gallery
          </button>
          <button
            onClick={() => cameraRef.current?.click()}
            disabled={uploading}
            className="flex-1 flex items-center justify-center gap-2 rounded-2xl border border-border py-3 text-sm disabled:opacity-50"
          >
            <Camera size={16} />
            Camera
          </button>
          <button
            onClick={handlePost}
            disabled={!canPost || busy || uploading}
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

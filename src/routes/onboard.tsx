import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useTwined } from "@/lib/use-twined";
import { detectTimezone, generateInviteCode } from "@/lib/twined";
import { AvatarPicker } from "@/components/AvatarPicker";
import { PixelAvatar, type AvatarPreset } from "@/components/PixelAvatar";
import { TimezonePicker } from "@/components/TimezonePicker";
import { Camera } from "lucide-react";

const search = z.object({
  mode: z.enum(["create", "join"]).default("create"),
});

export const Route = createFileRoute("/onboard")({
  validateSearch: search,
  component: OnboardPage,
});

function OnboardPage() {
  const { mode } = Route.useSearch();
  const { user, profile, loading, refetch } = useTwined();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [avatar, setAvatar] = useState<AvatarPreset>(1);
  const detectedTz = detectTimezone();
  const [tz, setTz] = useState(detectedTz);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // gate
  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/auth", search: { mode } });
    }
  }, [user, loading, mode, navigate]);

  // pre-fill from existing profile
  useEffect(() => {
    if (profile) {
      if (profile.name) setName(profile.name);
      if (profile.photo_url) setPhotoUrl(profile.photo_url);
      if (profile.timezone) setTz(profile.timezone);
      if (profile.avatar_preset) setAvatar(profile.avatar_preset as AvatarPreset);
    }
  }, [profile]);

  const uploadPhoto = async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("profile-photos")
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("profile-photos").getPublicUrl(path);
      setPhotoUrl(pub.publicUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const onContinue = async () => {
    if (!user || !name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const timezoneToSave = tz || detectTimezone();
      const { error: upErr } = await supabase
        .from("profiles")
        .update({
          name: name.trim(),
          photo_url: photoUrl,
          timezone: timezoneToSave,
          avatar_preset: avatar,
        })
        .eq("id", user.id);
      if (upErr) throw upErr;

      if (mode === "create") {
        // create a space
        const code = generateInviteCode();
        const { data: space, error: sErr } = await supabase
          .from("spaces")
          .insert({ invite_code: code, created_by: user.id })
          .select()
          .single();
        if (sErr) throw sErr;
        const { error: pErr } = await supabase
          .from("profiles")
          .update({ space_id: space.id })
          .eq("id", user.id);
        if (pErr) throw pErr;
        await refetch();
        navigate({ to: "/create-space" });
      } else {
        await refetch();
        navigate({ to: "/join-space" });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col px-6 pt-[max(env(safe-area-inset-top),32px)] pb-8 max-w-sm mx-auto w-full">
      <h1 className="font-serif text-2xl mb-1">Let's set you up</h1>
      <p className="text-muted-foreground text-sm mb-8">
        {mode === "create" ? "Your person will see this." : "Your person already misses you."}
      </p>

      <div className="flex flex-col items-center mb-6">
        <label className="relative cursor-pointer">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])}
          />
          <div
            className="w-24 h-24 rounded-full overflow-hidden bg-card border border-border flex items-center justify-center"
          >
            {photoUrl ? (
              <img src={photoUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <Camera size={26} className="text-muted-foreground" />
            )}
          </div>
          {uploading && (
            <div className="absolute inset-0 rounded-full bg-background/70 flex items-center justify-center text-xs">…</div>
          )}
        </label>
        <span className="text-xs text-muted-foreground mt-2">Tap to add a photo</span>
      </div>

      <input
        type="text"
        placeholder="Your name"
        maxLength={40}
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="bg-card border border-border rounded-xl px-4 py-3.5 text-foreground mb-4 focus:outline-none focus:border-primary"
      />

      <label className="text-xs text-muted-foreground mb-2 mt-2">Timezone</label>
      <div className="mb-1">
        <TimezonePicker value={tz} onChange={setTz} detected={detectedTz} />
      </div>
      <p className="text-xs text-muted-foreground mb-6">Auto-detected from your device. Change if needed.</p>


      <label className="text-xs text-muted-foreground mb-3">Pick your pixel</label>
      <AvatarPicker value={avatar} onChange={setAvatar} />

      <div className="flex items-center gap-3 mt-6 p-3 rounded-2xl bg-card border border-border">
        <PixelAvatar preset={avatar} size={48} />
        <div className="text-sm">
          <div className="font-medium">{name || "Your name"}</div>
          <div className="text-muted-foreground text-xs">{tz}</div>
        </div>
      </div>

      {error && <p className="text-xs text-destructive mt-3">{error}</p>}

      <button
        onClick={onContinue}
        disabled={!name.trim() || busy}
        className="rounded-2xl px-6 py-4 font-medium mt-6 disabled:opacity-40"
        style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
      >
        {busy ? "…" : "Continue"}
      </button>
    </div>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTwined } from "@/lib/use-twined";
import { AvatarPicker } from "@/components/AvatarPicker";
import { PixelAvatar, type AvatarPreset } from "@/components/PixelAvatar";
import { AppShell } from "@/components/AppShell";
import { TimezonePicker } from "@/components/TimezonePicker";
import { detectTimezone } from "@/lib/twined";
import { Copy, Check, LogOut, Unlink, Camera } from "lucide-react";

export const Route = createFileRoute("/settings")({
  component: () => <AppShell><SettingsPage /></AppShell>,
});

function SettingsPage() {
  const { user, profile, partner, refetch } = useTwined();
  const navigate = useNavigate();
  const [name, setName] = useState(profile?.name || "");
  const [tz, setTz] = useState(profile?.timezone || "UTC");
  const [avatar, setAvatar] = useState<AvatarPreset>((profile?.avatar_preset as AvatarPreset) || 1);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmingLeave, setConfirmingLeave] = useState(0);
  const [uploading, setUploading] = useState(false);

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
      await supabase.from("profiles").update({ photo_url: pub.publicUrl }).eq("id", user.id);
      await refetch();
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setTz(profile.timezone);
      setAvatar(profile.avatar_preset as AvatarPreset);
    }
  }, [profile]);

  useEffect(() => {
    if (!profile?.space_id) return;
    (async () => {
      const { data } = await supabase
        .from("spaces")
        .select("invite_code")
        .eq("id", profile.space_id!)
        .maybeSingle();
      setInviteCode(data?.invite_code ?? null);
    })();
  }, [profile?.space_id]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await supabase
        .from("profiles")
        .update({ name: name.trim(), timezone: tz, avatar_preset: avatar })
        .eq("id", user.id);
      await refetch();
    } finally {
      setSaving(false);
    }
  };

  const copy = async () => {
    if (!inviteCode) return;
    await navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const leaveSpace = async () => {
    if (!user) return;
    if (confirmingLeave < 2) {
      setConfirmingLeave((c) => c + 1);
      return;
    }
    await supabase.from("profiles").update({ space_id: null }).eq("id", user.id);
    await refetch();
    navigate({ to: "/" });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  if (!profile) return null;

  return (
    <div className="px-5 pt-5 pb-32 max-w-md mx-auto flex flex-col gap-6">
      <h1 className="font-serif text-2xl">Settings</h1>

      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <PixelAvatar preset={avatar} size={56} />
          <div className="flex-1">
            <div className="text-sm font-medium">{profile.name || "Unnamed"}</div>
            <div className="text-xs text-muted-foreground">{user?.email}</div>
          </div>
        </div>

        <div className="flex flex-col items-center my-2">
          <label className="relative cursor-pointer">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])}
            />
            <div className="w-24 h-24 rounded-full overflow-hidden bg-card border border-border flex items-center justify-center">
              {profile.photo_url ? (
                <img src={profile.photo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <Camera size={26} className="text-muted-foreground" />
              )}
            </div>
            {uploading && (
              <div className="absolute inset-0 rounded-full bg-background/70 flex items-center justify-center text-xs">…</div>
            )}
          </label>
          <span className="text-xs text-muted-foreground mt-2">Tap to change photo</span>
        </div>

        <label className="text-xs text-muted-foreground">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="bg-card border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary"
        />

        <label className="text-xs text-muted-foreground mt-1">Timezone</label>
        <TimezonePicker value={tz} onChange={setTz} detected={detectTimezone()} />

        <label className="text-xs text-muted-foreground mt-1">Avatar</label>
        <AvatarPicker value={avatar} onChange={setAvatar} />

        <button
          onClick={save}
          disabled={saving}
          className="rounded-2xl px-6 py-3 font-medium mt-2 disabled:opacity-40"
          style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
        >
          {saving ? "…" : "Save"}
        </button>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground">Your space</h2>
        {partner ? (
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-border">
            <PixelAvatar preset={partner.avatar_preset as AvatarPreset} size={36} animated={false} />
            <div className="flex-1 text-sm">
              <div className="font-medium">{partner.name}</div>
              <div className="text-xs text-muted-foreground">{partner.timezone}</div>
            </div>
          </div>
        ) : (
          inviteCode && (
            <button
              onClick={copy}
              className="rounded-2xl bg-card border border-border px-4 py-4 flex items-center justify-between"
            >
              <div>
                <div className="text-xs text-muted-foreground mb-1">Invite code</div>
                <div className="font-serif text-2xl tracking-[0.35em] pl-[0.35em]">{inviteCode}</div>
              </div>
              {copied ? <Check size={16} /> : <Copy size={16} className="text-muted-foreground" />}
            </button>
          )
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground">Account</h2>
        <button
          onClick={leaveSpace}
          className="rounded-2xl border border-border px-4 py-3 text-sm text-destructive flex items-center gap-2"
        >
          <Unlink size={15} />
          {confirmingLeave === 0 && "Leave Space"}
          {confirmingLeave === 1 && "Are you sure? Tap again."}
          {confirmingLeave === 2 && "Really sure? Tap once more to unpair."}
        </button>
        <button
          onClick={signOut}
          className="rounded-2xl border border-border px-4 py-3 text-sm flex items-center gap-2 text-muted-foreground"
        >
          <LogOut size={15} /> Sign out
        </button>
      </section>
    </div>
  );
}

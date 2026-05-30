import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export interface Profile {
  id: string;
  space_id: string | null;
  name: string;
  photo_url: string | null;
  timezone: string;
  avatar_preset: number;
  created_at: string;
}

/** Auth + profile state, kept in sync via supabase listener. */
export function useTwined() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [partner, setPartner] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // initial load + subscribe
  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setUser(data.session?.user ?? null);
      if (!data.session?.user) setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session) {
        setProfile(null);
        setPartner(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // load profile whenever user changes
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      if (cancelled) return;
      setProfile(data as Profile | null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // subscribe to my profile updates (e.g. when I join a space)
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`profile:${user.id}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
        (payload) => setProfile(payload.new as Profile)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user]);

  // load and subscribe to partner profile
  useEffect(() => {
    const spaceId = profile?.space_id;
    if (!spaceId || !user) {
      setPartner(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("space_id", spaceId)
        .neq("id", user.id)
        .maybeSingle();
      if (!cancelled) setPartner(data as Profile | null);
    })();

    const ch = supabase
      .channel(`partner:${spaceId}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "profiles",
          filter: `space_id=eq.${spaceId}`,
        },
        async () => {
          const { data } = await supabase
            .from("profiles")
            .select("*")
            .eq("space_id", spaceId)
            .neq("id", user.id)
            .maybeSingle();
          setPartner(data as Profile | null);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [profile?.space_id, user]);

  return { user, profile, partner, loading, refetch: async () => {
    if (!user) return;
    const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    setProfile(data as Profile | null);
  } };
}

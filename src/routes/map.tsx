import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { supabase } from "@/integrations/supabase/client";
import { useTwined, type Profile } from "@/lib/use-twined";
import { MAPBOX_TOKEN } from "@/lib/twined";
import { PixelAvatar, type AvatarPreset } from "@/components/PixelAvatar";
import { AppShell } from "@/components/AppShell";
import { Play, Square } from "lucide-react";

export const Route = createFileRoute("/map")({
  component: () => <AppShell><MapPage /></AppShell>,
});

interface TrailPoint {
  id: string;
  user_id: string;
  session_id: string;
  lat: number;
  lng: number;
  created_at: string;
}

interface TrailSession {
  id: string;
  space_id: string;
  user_id: string;
  active: boolean;
  started_at: string;
  ended_at: string | null;
}

mapboxgl.accessToken = MAPBOX_TOKEN;

function MapPage() {
  const { profile, partner } = useTwined();
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const myMarker = useRef<mapboxgl.Marker | null>(null);
  const partnerMarker = useRef<mapboxgl.Marker | null>(null);
  const watchId = useRef<number | null>(null);
  const activeSession = useRef<TrailSession | null>(null);

  const [sharing, setSharing] = useState(false);
  const [points, setPoints] = useState<TrailPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // init map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;
    const container = mapContainer.current;

    let map: mapboxgl.Map;
    try {
      map = new mapboxgl.Map({
        container,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [0, 20],
        zoom: 1.4,
        attributionControl: false,
      });
    } catch (e) {
      setError(
        e instanceof Error
          ? `Map failed to initialize: ${e.message}`
          : "Map failed to initialize"
      );
      return;
    }

    map.on("error", (e) => {
      const msg = e?.error?.message;
      if (msg) setError(msg);
      // eslint-disable-next-line no-console
      console.error("[mapbox]", e);
    });

    map.on("load", () => {
      map.addSource("trail-mine", { type: "geojson", data: emptyLine() });
      map.addSource("trail-partner", { type: "geojson", data: emptyLine() });
      map.addLayer({
        id: "trail-mine",
        type: "line",
        source: "trail-mine",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#9B7FE8", "line-width": 4, "line-opacity": 0.85 },
      });
      map.addLayer({
        id: "trail-partner",
        type: "line",
        source: "trail-partner",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#6DB5B0", "line-width": 4, "line-opacity": 0.85 },
      });
      map.resize();
      setMapReady(true);
    });
    mapRef.current = map;

    // Keep canvas synced to container size
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(container);
    const onWinResize = () => map.resize();
    window.addEventListener("resize", onWinResize);
    requestAnimationFrame(() => map.resize());
    const t = setTimeout(() => map.resize(), 300);
    const t2 = setTimeout(() => map.resize(), 1000);

    return () => {
      clearTimeout(t);
      clearTimeout(t2);
      window.removeEventListener("resize", onWinResize);
      ro.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);


  // load today's points
  useEffect(() => {
    if (!profile?.space_id) return;
    let cancelled = false;
    (async () => {
      const since = new Date();
      since.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from("trail_points")
        .select("*")
        .eq("space_id", profile.space_id!)
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: true });
      if (!cancelled) setPoints((data as TrailPoint[]) || []);
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.space_id]);

  // check if I already have an active session
  useEffect(() => {
    if (!profile?.space_id || !profile?.id) return;
    (async () => {
      const { data } = await supabase
        .from("trail_sessions")
        .select("*")
        .eq("user_id", profile.id)
        .eq("active", true)
        .maybeSingle();
      if (data) {
        activeSession.current = data as TrailSession;
        setSharing(true);
        startWatching();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, profile?.space_id]);

  // realtime subscribe to trail_points
  useEffect(() => {
    if (!profile?.space_id) return;
    const ch = supabase
      .channel(`trail:${profile.space_id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "trail_points",
          filter: `space_id=eq.${profile.space_id}`,
        },
        (payload) => {
          const p = payload.new as TrailPoint;
          setPoints((prev) => [...prev, p]);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [profile?.space_id]);

  // update map markers + trails whenever points/profiles change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !profile) return;

    const myPoints = points.filter((p) => p.user_id === profile.id);
    const partnerPoints = partner ? points.filter((p) => p.user_id === partner.id) : [];

    updateLine(map, "trail-mine", myPoints);
    updateLine(map, "trail-partner", partnerPoints);

    const myLast = myPoints[myPoints.length - 1];
    const partnerLast = partnerPoints[partnerPoints.length - 1];

    if (myLast) {
      if (!myMarker.current) {
        myMarker.current = new mapboxgl.Marker({ element: makeAvatarEl(profile, "mine") })
          .setLngLat([myLast.lng, myLast.lat])
          .addTo(map);
      } else {
        myMarker.current.setLngLat([myLast.lng, myLast.lat]);
      }
    }
    if (partnerLast && partner) {
      if (!partnerMarker.current) {
        partnerMarker.current = new mapboxgl.Marker({ element: makeAvatarEl(partner, "partner") })
          .setLngLat([partnerLast.lng, partnerLast.lat])
          .addTo(map);
      } else {
        partnerMarker.current.setLngLat([partnerLast.lng, partnerLast.lat]);
      }
    }

    // fit bounds if we have multiple points
    const all = [...myPoints, ...partnerPoints];
    if (all.length === 1) {
      map.easeTo({ center: [all[0].lng, all[0].lat], zoom: 12 });
    } else if (all.length > 1) {
      const bounds = new mapboxgl.LngLatBounds();
      all.forEach((p) => bounds.extend([p.lng, p.lat]));
      map.fitBounds(bounds, { padding: 60, maxZoom: 13, duration: 800 });
    }
  }, [points, profile, partner]);

  const startWatching = async () => {
    if (!profile?.space_id || !profile?.id) return;
    if (!("geolocation" in navigator)) {
      setError("Location not available on this device");
      return;
    }
    // create session if not present
    if (!activeSession.current) {
      const { data, error: e } = await supabase
        .from("trail_sessions")
        .insert({ space_id: profile.space_id, user_id: profile.id, active: true })
        .select()
        .single();
      if (e) {
        setError(e.message);
        return;
      }
      activeSession.current = data as TrailSession;
    }

    const onPos = async (pos: GeolocationPosition) => {
      const sess = activeSession.current;
      if (!sess || !profile.space_id) return;
      await supabase.from("trail_points").insert({
        space_id: profile.space_id,
        user_id: profile.id,
        session_id: sess.id,
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      });
    };
    const onErr = (e: GeolocationPositionError) => setError(e.message);

    // capture one immediately
    navigator.geolocation.getCurrentPosition(onPos, onErr, { enableHighAccuracy: true });
    watchId.current = navigator.geolocation.watchPosition(onPos, onErr, {
      enableHighAccuracy: true,
      maximumAge: 30_000,
    });
    setSharing(true);
  };

  const stopSharing = async () => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    const sess = activeSession.current;
    if (sess) {
      await supabase
        .from("trail_sessions")
        .update({ active: false, ended_at: new Date().toISOString() })
        .eq("id", sess.id);
      activeSession.current = null;
    }
    setSharing(false);
  };

  return (
    <div className="relative h-full min-h-[400px]">
      <div ref={mapContainer} className="absolute inset-0" />


      {error && (
        <div className="absolute top-3 left-3 right-3 bg-destructive/90 text-destructive-foreground text-xs rounded-xl px-3 py-2">
          {error}
        </div>
      )}

      <div
        className="absolute left-4 right-4 bottom-4 bg-card/95 backdrop-blur border border-border rounded-2xl p-3 flex items-center gap-3"
      >
        {sharing ? (
          <>
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-60 animate-ping" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
            </span>
            <span className="text-sm flex-1">Sharing your day…</span>
            <button
              onClick={stopSharing}
              className="rounded-full px-3.5 py-1.5 text-xs font-medium border border-border flex items-center gap-1.5"
            >
              <Square size={12} fill="currentColor" /> Stop
            </button>
          </>
        ) : (
          <button
            onClick={startWatching}
            className="w-full rounded-xl px-4 py-2.5 font-medium text-sm flex items-center justify-center gap-2"
            style={{ background: "var(--mine)", color: "var(--primary-foreground)" }}
          >
            <Play size={14} fill="currentColor" /> Start Sharing My Day
          </button>
        )}
      </div>
    </div>
  );
}

function emptyLine(): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: { type: "LineString", coordinates: [] },
        properties: {},
      },
    ],
  };
}

function updateLine(map: mapboxgl.Map, id: string, points: TrailPoint[]) {
  const src = map.getSource(id) as mapboxgl.GeoJSONSource | undefined;
  if (!src) return;
  src.setData({
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: points.map((p) => [p.lng, p.lat]),
        },
        properties: {},
      },
    ],
  });
}

function makeAvatarEl(p: Profile, kind: "mine" | "partner"): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.style.cssText = `
    width: 44px; height: 44px;
    border-radius: 9999px;
    background: ${kind === "mine" ? "#9B7FE8" : "#6DB5B0"};
    padding: 3px;
    box-shadow: 0 4px 18px rgba(0,0,0,0.5);
  `;
  const inner = document.createElement("div");
  inner.style.cssText = `
    width: 100%; height: 100%;
    border-radius: 9999px;
    background: #1A1A24;
    display: flex; align-items: center; justify-content: center;
    padding: 4px;
  `;
  // crude inline pixel avatar render — use the SVG approach by reusing PixelAvatar's logic
  // simpler: emoji-free fallback — render initials
  const initials = (p.name || "·").slice(0, 1).toUpperCase();
  inner.innerHTML = `<span style="font-family: 'Playfair Display', serif; font-weight: 700; font-size: 16px; color: #EEEAF4;">${initials}</span>`;
  // overlay avatar number badge
  inner.title = `${p.name} · avatar ${p.avatar_preset}`;
  void (p.avatar_preset as AvatarPreset);
  wrapper.appendChild(inner);
  return wrapper;
}

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { supabase } from "@/integrations/supabase/client";
import { useTwined, type Profile } from "@/lib/use-twined";
import { MAPBOX_TOKEN } from "@/lib/twined";
import { PixelAvatar, SPRITES, PALETTES, type AvatarPreset } from "@/components/PixelAvatar";
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
  const intervalId = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeSession = useRef<TrailSession | null>(null);
  const lastPoint = useRef<{ lat: number; lng: number } | null>(null);

  const [sharing, setSharing] = useState(false);
  const [points, setPoints] = useState<TrailPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [activeTab, setActiveTab] = useState<"mine" | "partner">("mine");

  // init map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;
    const container = mapContainer.current;
    if (container.offsetWidth === 0 || container.offsetHeight === 0) return;
    let map: mapboxgl.Map;
    try {
      map = new mapboxgl.Map({
        container,
        style: "mapbox://styles/mapbox/light-v11",
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
        paint: { "line-color": "#9B7FE8", "line-width": 5, "line-opacity": 0.85 },
      });
      map.addLayer({
        id: "trail-partner",
        type: "line",
        source: "trail-partner",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#6DB5B0", "line-width": 5, "line-opacity": 0.85 },
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
      if (!cancelled) {
        setPoints((data as TrailPoint[]) || []);
      }
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
          // refit if the new point belongs to the active tab's user
          const map = mapRef.current;
          if (!map) return;
          const activeUserId =
            activeTab === "mine" ? profile?.id : partner?.id;
          if (p.user_id === activeUserId) {
            setPoints((prev) => {
              const userPoints = prev.filter((pt) => pt.user_id === activeUserId);
              fitToTrail(map, userPoints);
              return prev;
            });
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [profile?.space_id, activeTab, profile?.id, partner?.id]);

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

    // Show/hide markers based on active tab
    if (activeTab === "mine") {
      myMarker.current?.getElement().style.setProperty("display", "block");
      partnerMarker.current?.getElement().style.setProperty("display", "none");
    } else {
      partnerMarker.current?.getElement().style.setProperty("display", "block");
      myMarker.current?.getElement().style.setProperty("display", "none");
    }
  }, [points, profile, partner, activeTab]);

  // reposition + restyle when active tab changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    if (activeTab === "mine") {
      const myPoints = points.filter((p) => p.user_id === profile?.id);
      if (myPoints.length > 0) {
        fitToTrail(map, myPoints);
      } else if (profile) {
        map.easeTo({ zoom: 14, duration: 600 });
      }
      map.setPaintProperty("trail-mine", "line-opacity", 0.85);
      map.setPaintProperty("trail-mine", "line-width", 4);
      map.setPaintProperty("trail-partner", "line-opacity", 0.25);
      map.setPaintProperty("trail-partner", "line-width", 2);
      myMarker.current?.getElement().style.setProperty("display", "block");
      partnerMarker.current?.getElement().style.setProperty("display", "none");
    } else {
      const partnerPoints = partner
        ? points.filter((p) => p.user_id === partner.id)
        : [];
      if (partnerPoints.length > 0) {
        fitToTrail(map, partnerPoints);
      } else {
        map.easeTo({ zoom: 2, duration: 600 });
      }
      map.setPaintProperty("trail-partner", "line-opacity", 0.85);
      map.setPaintProperty("trail-partner", "line-width", 4);
      map.setPaintProperty("trail-mine", "line-opacity", 0.25);
      map.setPaintProperty("trail-mine", "line-width", 2);
      partnerMarker.current?.getElement().style.setProperty("display", "block");
      myMarker.current?.getElement().style.setProperty("display", "none");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, mapReady]);

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
      const { latitude, longitude } = pos.coords;

      const isFirstPoint = lastPoint.current === null;

      // Skip if moved less than 20 meters from last recorded point
      if (lastPoint.current) {
        const dist = getDistance(
          lastPoint.current.lat,
          lastPoint.current.lng,
          latitude,
          longitude
        );
        if (dist < 20) return;
      }

      lastPoint.current = { lat: latitude, lng: longitude };

      const sess = activeSession.current;
      if (!sess || !profile.space_id) return;
      await supabase.from("trail_points").insert({
        space_id: profile.space_id,
        user_id: profile.id,
        session_id: sess.id,
        lat: latitude,
        lng: longitude,
      });

      if (isFirstPoint && mapRef.current) {
        fitToTrail(mapRef.current, [{
          id: "", user_id: profile.id, session_id: sess.id,
          lat: latitude, lng: longitude, created_at: new Date().toISOString(),
        }]);
      }

    };
    const onErr = (e: GeolocationPositionError) => setError(e.message);

    // capture one immediately
    navigator.geolocation.getCurrentPosition(onPos, onErr, {
      enableHighAccuracy: true,
    });
    watchId.current = navigator.geolocation.watchPosition(onPos, onErr, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 30000,
    });
    setSharing(true);
  };

  const stopSharing = async () => {
    if (intervalId.current !== null) {
      clearInterval(intervalId.current);
      intervalId.current = null;
    }
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    lastPoint.current = null;
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

  function getDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  const partnerHasTrail = partner
    ? points.some((p) => p.user_id === partner.id)
    : false;

  return (
    <div className="relative w-full bg-card" style={{ height: 'calc(100dvh - 120px)' }}>
      <div ref={mapContainer} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' }} />

      {/* Tab switcher */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-card/90 backdrop-blur border border-border rounded-full p-1 flex gap-1">
        <button
          onClick={() => setActiveTab("mine")}
          className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
            activeTab === "mine" ? "text-white" : "text-muted-foreground"
          }`}
          style={activeTab === "mine" ? { background: "var(--mine)" } : undefined}
        >
          My Day
        </button>
        <button
          onClick={() => partner && setActiveTab("partner")}
          disabled={!partner}
          className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
            activeTab === "partner" ? "text-white" : "text-muted-foreground"
          } ${!partner ? "opacity-40 cursor-not-allowed" : ""}`}
          style={activeTab === "partner" ? { background: "var(--partner)" } : undefined}
        >
          {partner ? `${partner.name}'s Day` : "Their Day"}
        </button>
      </div>

      {!mapReady && !error && (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-xs pointer-events-none">
          Loading map…
        </div>
      )}

      {error && (
        <div className="absolute top-20 left-3 right-3 bg-destructive/90 text-destructive-foreground text-xs rounded-xl px-3 py-2 z-10">
          {error}
        </div>
      )}

      {activeTab === "partner" && !partnerHasTrail && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="bg-card/90 backdrop-blur rounded-2xl px-5 py-4 text-center">
            <p className="text-sm text-muted-foreground">
              {partner?.name || "Your person"} hasn't started their day yet
            </p>
          </div>
        </div>
      )}

      {activeTab === "mine" && (
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
      )}
    </div>
  );
}

function fitToTrail(map: mapboxgl.Map, points: TrailPoint[], padding = 80) {
  if (points.length === 0) return;
  if (points.length === 1) {
    map.easeTo({ center: [points[0].lng, points[0].lat], zoom: 16, duration: 600 });
    return;
  }
  const bounds = new mapboxgl.LngLatBounds();
  points.forEach((p) => bounds.extend([p.lng, p.lat]));
  map.fitBounds(bounds, { padding, maxZoom: 16, minZoom: 2, duration: 600 });
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
    background: #ffffff;
    display: flex; align-items: center; justify-content: center;
    padding: 4px;
  `;
  const preset = (p.avatar_preset as AvatarPreset) || 1;
  const grid = SPRITES[preset];
  const palette = PALETTES[preset];
  let rects = "";
  for (let y = 0; y < grid.length; y++) {
    const row = grid[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === "." || !(ch in palette)) continue;
      const fill = (palette as unknown as Record<string, string>)[ch];
      rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${fill}"/>`;
    }
  }
  inner.innerHTML = `<svg width="36" height="36" viewBox="0 0 14 14" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">${rects}</svg>`;
  inner.title = `${p.name} · avatar ${p.avatar_preset}`;
  wrapper.appendChild(inner);
  return wrapper;
}

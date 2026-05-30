## 1. Global "Thinking of you" ping

Move the ping subscription out of `moments.tsx` and into the always-mounted `AppShell` so it fires on any tab.

- New `src/components/PingListener.tsx`: subscribes to `thinking_pings` INSERT for the user's `space_id`, ignores own pings, and on a partner ping:
  - Plays a short sound (small generated WebAudio beep — no asset needed) wrapped in try/catch (autoplay restrictions OK).
  - Triggers `navigator.vibrate?.([80, 60, 120])`.
  - Shows a toast via the existing `sonner` Toaster: "{partner.name} is thinking of you 🤍".
- Mount `<PingListener />` inside `AppShell` once `profile?.space_id` and `partner` exist.
- Remove the duplicate subscription from `src/routes/moments.tsx` (keep the in-page banner flash on send-success only, or drop it entirely in favor of the toast).
- Ensure `<Toaster />` from `sonner` is mounted in `__root.tsx` (add if missing).

## 2. Auto-detected timezone with searchable dropdown

In `src/routes/onboard.tsx`:
- Keep `detectTimezone()` as the default (already wired).
- Replace the free-text `<input>` with a searchable combobox using existing shadcn `Popover` + `Command` (`cmdk`).
- Populate from `Intl.supportedValuesOf("timezone")` (fallback to a curated list if unavailable).
- Show the detected zone preselected with a small "Detected" badge; user can search/override.
- Also show current local time preview for the selected zone using `formatLocalTime`.

## 3. Map tab black screen fix

Symptoms persist after the ResizeObserver attempt → the canvas is mounted but the dark style + no markers + no basemap tiles means the WebGL context may not be initializing, or the container has 0 height because `AppShell`'s `<main>` is `overflow-y-auto` without an enforced height, so `h-full` on the map collapses.

Fixes in `src/routes/map.tsx` + `AppShell`:
- In `AppShell`, give `<main>` a concrete flex height: `className="flex-1 min-h-0 overflow-y-auto"` so children using `h-full` actually get pixels.
- In `map.tsx`, wrap the page so the map root explicitly fills: use `h-[100%] min-h-[60vh]` and ensure parent chain has no `min-h-0` collapse. Use `position: absolute inset-0` on the canvas div (already there) inside a `relative h-full`.
- Add a WebGL support guard: if `mapboxgl.supported() === false`, render a friendly message instead of a black div.
- Verify the Mapbox token is valid by listening to `map.on('error', e => setError(e.error?.message))` so any 401/403 surfaces instead of silently producing black tiles.
- After `style.load`, call `map.resize()` and also resize on `window` resize.
- Add a visible loading placeholder under the canvas (subtle gradient + "Loading map…") so it's clear when tiles fail vs when layout is broken.

## Technical notes

- No DB changes needed; `thinking_pings` realtime + RLS already in place.
- `Intl.supportedValuesOf` is supported in all evergreen browsers; fallback ensures Safari < 15.4 still works.
- Sound: generated via `AudioContext` oscillator (~120ms), no asset import.
- Vibration: `navigator.vibrate` is a no-op on iOS Safari but harmless.

## Files touched

- `src/components/PingListener.tsx` (new)
- `src/components/AppShell.tsx` (mount listener, fix main height)
- `src/routes/__root.tsx` (ensure Toaster mounted)
- `src/routes/moments.tsx` (remove duplicate ping subscription)
- `src/routes/onboard.tsx` (timezone combobox)
- `src/routes/map.tsx` (height, error surfacing, WebGL guard)

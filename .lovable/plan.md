## 1. Lighter theme

The app is locked to a dark cool-violet palette in `src/styles.css`. Switch the default `:root` palette to a soft, warm light theme that keeps the existing violet/teal identity colors so brand recognition stays intact. The `.dark` block is kept as a true dark variant for future use, but the app continues to render in the default (now light) theme — no theme toggle is added in this pass.

New tokens (oklch) for `:root`:
- `--background`: warm off-white `oklch(0.985 0.005 80)` (~#FAF8F3)
- `--foreground`: deep ink `oklch(0.22 0.02 280)` (near-black with cool tint)
- `--card`: `oklch(1 0 0)` pure white surfaces
- `--surface-2`: `oklch(0.97 0.008 80)` faint cream for elevated rows
- `--popover` / `--card-foreground` mirror background/foreground
- `--muted`: `oklch(0.94 0.008 280)`
- `--muted-foreground`: `oklch(0.5 0.015 285)`
- `--border` / `--input`: `oklch(0.9 0.008 280)` soft lavender-gray
- `--primary` stays violet `oklch(0.62 0.16 295)` (slightly deeper for contrast on light bg)
- `--primary-foreground`: `oklch(0.99 0 0)` white
- `--mine` / `--partner`: same identity hues, nudged a touch deeper for legibility on cream
- `--destructive`: `oklch(0.55 0.22 25)`

Update `theme-color` meta in `src/routes/__root.tsx` from `#0F0F14` to the new cream so iOS status bar matches.

Spot-check components that hardcode dark-only assumptions:
- `src/components/PingListener.tsx`: `<Toaster theme="dark" />` → switch to `theme="light"`.
- `src/routes/map.tsx`: Mapbox style `mapbox/dark-v11` → `mapbox/light-v11` to match the new theme.
- `src/routes/map.tsx` `makeAvatarEl`: inner circle bg uses `#1A1A24` and text color `#EEEAF4` — replace with token-driven values (white inner, dark text) so markers read on a light map.
- Grep for any other hardcoded dark hexes (`#0F`, `#1A1A24`, `bg-background/80`) in components; replace with semantic tokens where they break on light.

No component refactors beyond these — everything else already uses semantic tokens (`bg-card`, `text-muted-foreground`, etc.) so it adapts automatically.

## 2. Profile + logout access

Settings page already exists at `src/routes/settings.tsx` with edit profile, leave space, and sign out — but it's unreachable because `BottomNav` only shows Today / Moments / Map. Fix the navigation, not the page.

Changes:
- `src/components/BottomNav.tsx`: add a 4th tab `{ to: "/settings", label: "Me", icon: User }` and switch grid from `grid-cols-3` to `grid-cols-4`. Use the user's avatar visually would be nicer but for icon consistency we stick with lucide `User` (or `UserCircle`).
- `src/routes/settings.tsx`: replace the free-text Timezone input with the new `<TimezonePicker />` component (consistent with onboarding) so the user can change it from a searchable list.
- Confirm sign-out flow still works: `supabase.auth.signOut()` → navigate to `/`. The root `onAuthStateChange` listener already invalidates queries on sign-out, so cached profile/partner data clears.

No new routes, no DB changes, no auth-config changes. Sign-out already calls `supabase.auth.signOut()` which clears the session everywhere.

## Files touched

- `src/styles.css` — new light palette in `:root` + keep `.dark` as dark variant
- `src/routes/__root.tsx` — update `theme-color` meta
- `src/components/PingListener.tsx` — toast `theme="light"`
- `src/routes/map.tsx` — light Mapbox style + token-driven avatar marker colors
- `src/components/BottomNav.tsx` — add Settings tab, grid-cols-4
- `src/routes/settings.tsx` — use `TimezonePicker` instead of plain input

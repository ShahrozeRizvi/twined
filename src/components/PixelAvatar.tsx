/**
 * Pixel avatars rendered from a tiny color grid — no images, fully crisp at any size.
 * 6 presets matching the spec.
 *
 * Color codes:
 *   . transparent  s skin  h hair/hat  c clothing  e eyes  m mouth  o outline
 */

export type AvatarPreset = 1 | 2 | 3 | 4 | 5 | 6;

interface Palette {
  s: string; // skin
  h: string; // hair/hijab
  c: string; // clothing
  e: string; // eyes
  m: string; // mouth
  o: string; // outline
}

export const PALETTES: Record<AvatarPreset, Palette> = {
  // Male presets
  1: { s: "#5A3825", h: "#1C1410", c: "#3E8E89", e: "#FFFFFF", m: "#3A1F12", o: "#000000" }, // dark skin, curly hair, teal hoodie
  2: { s: "#C99479", h: "#2A1E18", c: "#F0EDE6", e: "#FFFFFF", m: "#5A2E1F", o: "#000000" }, // medium skin, short hair, white tee
  3: { s: "#F0D4B5", h: "#8C6A3C", c: "#6B7A4B", e: "#FFFFFF", m: "#7A3220", o: "#000000" }, // light skin, messy hair, olive jacket
  // Female presets
  4: { s: "#5A3825", h: "#2A1812", c: "#E7C25D", e: "#FFFFFF", m: "#7A2D1A", o: "#000000" }, // dark skin, natural hair, yellow top
  5: { s: "#C99479", h: "#C7918D", c: "#B07A78", e: "#FFFFFF", m: "#7A3324", o: "#000000" }, // medium skin, hijab, dusty rose
  6: { s: "#F0D4B5", h: "#7A5638", c: "#B8A5DC", e: "#FFFFFF", m: "#A8463A", o: "#000000" }, // light skin, ponytail, lavender top
};

/** 14x14 grids. Each entry is a key in the palette or `.` for transparent. */
export const SPRITES: Record<AvatarPreset, string[]> = {
  // 1 — male, curly hair, hoodie
  1: [
    "..............",
    "....oohhoo....",
    "...ohhhhhho...",
    "..ohhhhhhhho..",
    "..ohssssshho..",
    "..oshssshhso..",
    "..osseseseo...",
    "..osssmssso...",
    "..ossssssso...",
    "..occcccccco..",
    ".occccccccco..",
    "occcccccccco..",
    "occc......cco.",
    "occ........co.",
  ],
  // 2 — male, short hair, plain tee
  2: [
    "..............",
    "....oohhoo....",
    "...ohhhhhho...",
    "..ohhhhhhho...",
    "..osssssso....",
    "..osssssso....",
    "..oseseseo....",
    "..osssmsso....",
    "..ossssso.....",
    "..ocsssco.....",
    "..occccco.....",
    ".occcccco.....",
    "occccccco.....",
    "occ....cco....",
  ],
  // 3 — male, messy hair, jacket
  3: [
    "..............",
    "..ohhohhohho..",
    ".ohhhhhhhhho..",
    ".ohhhhhhhho...",
    "..osssssso....",
    "..ossssssso...",
    "..oseseseo....",
    "..ossmmsso....",
    "..ossssso.....",
    ".occcsscco....",
    ".occcsscco....",
    "occcccccco....",
    "occc....cco...",
    "oc........co..",
  ],
  // 4 — female, natural hair, top
  4: [
    "..ohhhhhho....",
    ".ohhhhhhhho...",
    "ohhhhhhhhhho..",
    "ohhssssshho...",
    "ohssssshhho...",
    ".osseseso.....",
    ".ossssso......",
    ".ossmmso......",
    ".osssso.......",
    ".occcco.......",
    "occcccco......",
    "occcccco......",
    "ccccccccc.....",
    "cc......cc....",
  ],
  // 5 — female, hijab
  5: [
    "...ohhhho.....",
    "..ohhhhhho....",
    ".ohhhhhhhho...",
    "ohhhhhhhhho...",
    "ohhsssssho....",
    "ohsssssho.....",
    "ohseseso......",
    "ohssmsso......",
    "ohssssho......",
    "ohhhhhhh......",
    ".occccco......",
    "occcccco......",
    "occccccco.....",
    "occ....cco....",
  ],
  // 6 — female, ponytail
  6: [
    "...ohhhho.....",
    "..ohhhhhho....",
    ".ohhhhhhho..h.",
    ".ohhhhhhho.hh.",
    ".osssssso..hh.",
    ".ossssss.....h",
    ".oseseso......",
    ".ossmmso......",
    ".osssso.......",
    ".occcco.......",
    "occcccco......",
    "ccccccccc.....",
    "ccccccccc.....",
    "cc......cc....",
  ],
};

interface PixelAvatarProps {
  preset: AvatarPreset;
  size?: number; // px
  className?: string;
  animated?: boolean;
}

export function PixelAvatar({ preset, size = 64, className = "", animated = true }: PixelAvatarProps) {
  const grid = SPRITES[preset];
  const palette = PALETTES[preset];
  const pixel = size / 14;

  return (
    <div
      className={`${animated ? "pixel-bob" : ""} ${className}`}
      style={{
        width: size,
        height: size,
        position: "relative",
        flexShrink: 0,
      }}
      aria-hidden
    >
      <svg
        viewBox="0 0 14 14"
        width={size}
        height={size}
        className="pixelated"
        style={{ display: "block" }}
      >
        {grid.map((row, y) =>
          row.split("").map((cell, x) => {
            if (cell === ".") return null;
            const color = (palette as unknown as Record<string, string>)[cell];
            if (!color) return null;
            return (
              <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={color} />
            );
          })
        )}
      </svg>
    </div>
  );
}

export const AVATAR_PRESETS: AvatarPreset[] = [1, 2, 3, 4, 5, 6];

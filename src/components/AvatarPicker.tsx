import { AVATAR_PRESETS, PixelAvatar, type AvatarPreset } from "./PixelAvatar";

interface AvatarPickerProps {
  value: AvatarPreset;
  onChange: (v: AvatarPreset) => void;
}

export function AvatarPicker({ value, onChange }: AvatarPickerProps) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {AVATAR_PRESETS.map((p) => {
        const selected = p === value;
        return (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            className="rounded-2xl p-3 flex items-center justify-center transition-all"
            style={{
              background: "var(--card)",
              border: `1.5px solid ${selected ? "var(--mine)" : "var(--border)"}`,
              boxShadow: selected ? "0 0 0 3px color-mix(in oklab, var(--mine) 25%, transparent)" : "none",
            }}
            aria-pressed={selected}
            aria-label={`Avatar ${p}`}
          >
            <PixelAvatar preset={p} size={56} animated={selected} />
          </button>
        );
      })}
    </div>
  );
}

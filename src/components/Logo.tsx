interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const SIZE_PX: Record<NonNullable<LogoProps["size"]>, number> = {
  sm: 22,
  md: 32,
  lg: 56,
  xl: 88,
};

export function Logo({ size = "lg", className = "" }: LogoProps) {
  return (
    <div
      className={`tw-logo ${className}`}
      style={{ fontSize: `${SIZE_PX[size]}px` }}
      aria-label="Twined"
    >
      <span className="the">the</span>
      <span className="word">TWINED</span>
    </div>
  );
}

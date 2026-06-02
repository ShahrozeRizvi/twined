interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

export function Logo({ size = "lg", className = "" }: LogoProps) {
  const sizes = {
    sm: "text-2xl",
    md: "text-4xl",
    lg: "text-6xl",
    xl: "text-8xl",
  };

  return (
    <div
      className={`${sizes[size]} ${className}`}
      style={{
        fontFamily: "'Pinyon Script', cursive",
        color: "var(--mine)",
        lineHeight: 1.1,
        letterSpacing: "0.02em",
      }}
      aria-label="Twined"
    >
      Twined
    </div>
  );
}

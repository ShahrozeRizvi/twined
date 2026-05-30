import { Link, useLocation } from "@tanstack/react-router";
import { CheckSquare, Sparkles, Map, User } from "lucide-react";

const TABS = [
  { to: "/today", label: "Today", icon: CheckSquare },
  { to: "/moments", label: "Moments", icon: Sparkles },
  { to: "/map", label: "Map", icon: Map },
  { to: "/settings", label: "Me", icon: User },
] as const;

export function BottomNav() {
  const { pathname } = useLocation();

  return (
    <nav
      className="sticky bottom-0 z-30 bg-card border-t border-border"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 8px)" }}
    >
      <div className="grid grid-cols-4 px-2 pt-2">
        {TABS.map(({ to, label, icon: Icon }) => {
          const active = pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              className="flex flex-col items-center gap-1 py-1.5 rounded-lg transition-colors"
              style={{
                color: active ? "var(--mine)" : "var(--muted-foreground)",
              }}
            >
              <Icon size={22} strokeWidth={active ? 2.4 : 1.8} />
              <span className="text-[11px] font-medium tracking-wide">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}


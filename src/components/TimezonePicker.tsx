import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { formatLocalTime } from "@/lib/twined";

const FALLBACK_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "America/Mexico_City",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "Europe/Madrid",
  "Europe/Rome",
  "Europe/Amsterdam",
  "Europe/Istanbul",
  "Europe/Moscow",
  "Africa/Cairo",
  "Africa/Lagos",
  "Africa/Johannesburg",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Dhaka",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Pacific/Auckland",
];

function getAllTimezones(): string[] {
  try {
    const fn = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] })
      .supportedValuesOf;
    if (typeof fn === "function") {
      const list = fn("timeZone");
      if (Array.isArray(list) && list.length) return list;
    }
  } catch {
    // fall through
  }
  return FALLBACK_TIMEZONES;
}

interface Props {
  value: string;
  onChange: (tz: string) => void;
  detected: string;
}

export function TimezonePicker({ value, onChange, detected }: Props) {
  const [open, setOpen] = useState(false);
  const zones = useMemo(() => getAllTimezones(), []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground flex items-center justify-between gap-2 focus:outline-none focus:border-primary"
        >
          <span className="flex items-center gap-2 min-w-0">
            <span className="truncate">{value}</span>
            {value === detected && (
              <span className="text-[10px] uppercase tracking-wider rounded-full px-1.5 py-0.5 bg-primary/15 text-primary shrink-0">
                Detected
              </span>
            )}
          </span>
          <span className="flex items-center gap-2 text-muted-foreground text-xs shrink-0">
            <span className="tabular-nums">{formatLocalTime(value)}</span>
            <ChevronsUpDown size={14} />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
        <Command>
          <CommandInput placeholder="Search timezone…" />
          <CommandList>
            <CommandEmpty>No timezone found.</CommandEmpty>
            {zones.map((z) => (
              <CommandItem
                key={z}
                value={z}
                onSelect={() => {
                  onChange(z);
                  setOpen(false);
                }}
              >
                <Check
                  size={14}
                  className={cn("mr-2", value === z ? "opacity-100" : "opacity-0")}
                />
                <span className="flex-1 truncate">{z}</span>
                <span className="text-xs text-muted-foreground tabular-nums ml-2">
                  {formatLocalTime(z)}
                </span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

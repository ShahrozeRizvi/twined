/** Shared helpers for the Twined app. */

export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string;

const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

export function generateInviteCode(): string {
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += INVITE_ALPHABET[Math.floor(Math.random() * INVITE_ALPHABET.length)];
  }
  return out;
}

export function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** Format the current time in a given IANA timezone, e.g. "9:42 AM". */
export function formatLocalTime(tz: string, date: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      timeZone: tz,
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  } catch {
    return "—";
  }
}

/** Get today's date in YYYY-MM-DD for a given IANA timezone. */
export function localDateString(tz: string, date: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    return `${get("year")}-${get("month")}-${get("day")}`;
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

/** A short relative or absolute timestamp for moments. */
export function shortTime(tz: string, iso: string): string {
  return formatLocalTime(tz, new Date(iso));
}

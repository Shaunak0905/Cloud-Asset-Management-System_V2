// Display formatting. Timestamps are stored in UTC and shown in campus time;
// plain dates (YYYY-MM-DD) have no time zone and are shown as-is.

export const CAMPUS_TIME_ZONE = "Asia/Kolkata";
const LOCALE = "en-IN";

const dateFormat = new Intl.DateTimeFormat(LOCALE, {
  dateStyle: "medium",
  timeZone: "UTC",
});

const dateTimeFormat = new Intl.DateTimeFormat(LOCALE, {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: CAMPUS_TIME_ZONE,
});

/** "15 Jan 2028" for a date column value such as "2028-01-15". */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return dateFormat.format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
}

const campusDateFormat = new Intl.DateTimeFormat(LOCALE, {
  dateStyle: "medium",
  timeZone: CAMPUS_TIME_ZONE,
});

/** "15 Jan 2028": the campus-time date of a timestamptz value. */
export function formatCampusDate(value: string | null | undefined): string {
  if (!value) return "—";
  return campusDateFormat.format(new Date(value));
}

/** "15 Jan 2028, 2:05 pm" in campus time for a timestamptz value. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  return dateTimeFormat.format(new Date(value));
}

/** Today's date in campus time as YYYY-MM-DD. */
export function campusToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CAMPUS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Campus UTC offset at `at`, e.g. "+05:30". */
function campusOffset(at: Date): string {
  const name = new Intl.DateTimeFormat("en-US", {
    timeZone: CAMPUS_TIME_ZONE,
    timeZoneName: "longOffset",
  })
    .formatToParts(at)
    .find((part) => part.type === "timeZoneName")?.value;
  const offset = name?.replace("GMT", "") ?? "";
  return offset === "" ? "+00:00" : offset;
}

/**
 * Converts a datetime-local value ("2026-10-01T14:30"), which has no time
 * zone, to an ISO timestamp interpreted in campus time. Null if malformed.
 */
export function campusDateTimeToIso(local: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null;
  const guess = new Date(`${local}:00Z`);
  if (Number.isNaN(guess.getTime())) return null;
  const iso = new Date(`${local}:00${campusOffset(guess)}`);
  return Number.isNaN(iso.getTime()) ? null : iso.toISOString();
}

/** The current campus time as a datetime-local value (for `min`). */
export function campusDateTimeInputValue(now: Date = new Date()): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: CAMPUS_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export type WarrantyState =
  | { kind: "none" }
  | { kind: "active"; until: string }
  | { kind: "expired"; until: string };

/** Warranty is valid through its end date (inclusive), in campus time. */
export function warrantyState(
  warrantyUntil: string | null,
  today: string = campusToday(),
): WarrantyState {
  if (!warrantyUntil) return { kind: "none" };
  return warrantyUntil >= today
    ? { kind: "active", until: warrantyUntil }
    : { kind: "expired", until: warrantyUntil };
}

/** "340 KB", "2.1 MB": file sizes as people read them. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function nextDay(date: string): string {
  const day = new Date(`${date}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + 1);
  return day.toISOString().slice(0, 10);
}

/**
 * The UTC range covering campus days `from`–`to` (YYYY-MM-DD, both
 * inclusive), for filtering timestamps stored in UTC. `before` is exclusive.
 */
export function campusDayRange(range: {
  from: string | null;
  to: string | null;
}): { since: string | null; before: string | null } {
  return {
    since: range.from ? campusDateTimeToIso(`${range.from}T00:00`) : null,
    before: range.to ? campusDateTimeToIso(`${nextDay(range.to)}T00:00`) : null,
  };
}

/** Midnight on the 1st of the current campus month, as an ISO timestamp. */
export function campusMonthStart(now: Date = new Date()): string {
  const month = campusToday(now).slice(0, 7);
  return campusDateTimeToIso(`${month}-01T00:00`) ?? now.toISOString();
}

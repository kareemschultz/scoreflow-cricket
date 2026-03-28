// Guyana is UTC-4 year-round (no DST — Eastern Daylight Time zone without savings)
const TZ = "America/Guyana"

/**
 * Format a date as "Mar 28, 2026 · 3:45 PM" in Guyana time.
 */
export function formatMatchDate(date: Date | string | undefined | null): string {
  if (!date) return "—"
  const d = typeof date === "string" ? new Date(date) : date
  if (isNaN(d.getTime())) return "—"
  return new Intl.DateTimeFormat("en-GY", {
    timeZone: TZ,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d)
}

/**
 * Format just the date portion: "Mar 28, 2026"
 */
export function formatMatchDateShort(date: Date | string | undefined | null): string {
  if (!date) return "—"
  const d = typeof date === "string" ? new Date(date) : date
  if (isNaN(d.getTime())) return "—"
  return new Intl.DateTimeFormat("en-GY", {
    timeZone: TZ,
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d)
}

/**
 * Format as relative time if recent, or full date if older:
 * "Today · 3:45 PM", "Yesterday · 11:00 AM", "Mar 26, 2026 · 9:30 PM"
 */
export function formatMatchDateRelative(date: Date | string | undefined | null): string {
  if (!date) return "—"
  const d = typeof date === "string" ? new Date(date) : date
  if (isNaN(d.getTime())) return "—"

  const now = new Date()
  const todayStr = toDateStringInTZ(now)
  const inputStr = toDateStringInTZ(d)

  const time = new Intl.DateTimeFormat("en-GY", {
    timeZone: TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d)

  if (inputStr === todayStr) return `Today · ${time}`

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (inputStr === toDateStringInTZ(yesterday)) return `Yesterday · ${time}`

  return formatMatchDate(d)
}

/**
 * Returns today's date in Guyana time as "YYYY-MM-DD" — for HTML date input values and max attributes.
 */
export function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date())
}

/**
 * Converts any date to "YYYY-MM-DD" in Guyana time — for HTML date inputs showing existing dates.
 */
export function toISODate(date: Date | string | undefined | null): string {
  if (!date) return ""
  const d = typeof date === "string" ? new Date(date) : date
  if (isNaN(d.getTime())) return ""
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d)
}

/**
 * Format as "Wednesday, 28 January 2026" in Guyana time — for page headers.
 */
export function formatLongDate(date?: Date): string {
  return new Intl.DateTimeFormat("en-GY", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date ?? new Date())
}

function toDateStringInTZ(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d)
}

// ─── Import payload row-level validation ─────────────────────────────────────
//
// Validates a JSON backup payload before any DB writes. Each table has required
// field checks, non-empty string checks, enum membership checks, and
// structural validation for nested objects (innings, rules, dates).

const MATCH_FORMATS = new Set(["T20", "ODI", "TEST", "CUSTOM"])
const MATCH_STATUSES = new Set(["setup", "live", "completed", "abandoned"])
const TOURNAMENT_FORMATS = new Set(["ROUND_ROBIN", "KNOCKOUT", "GROUP_KNOCKOUT"])
const TOURNAMENT_STATUSES = new Set(["upcoming", "live", "completed"])
const STAT_FORMATS = new Set(["T20", "ODI", "TEST", "CUSTOM", "ALL"])
const SETTINGS_THEMES = new Set(["dark", "light", "system"])

export interface ImportRowError {
  table: string
  row: number
  issue: string
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v)
}

/** Check if a value looks like a valid date (ISO string, Date object, or parseable string) */
function isValidDate(v: unknown): boolean {
  if (v === undefined || v === null) return false
  if (typeof v === "string") return !isNaN(Date.parse(v))
  if (typeof v === "number") return !isNaN(v) && isFinite(v)
  if (v instanceof Date) return !isNaN(v.getTime())
  return false
}

/** Validate a match rules object — all 17 MatchRules fields */
function validateMatchRules(
  rules: Record<string, unknown>,
  push: (issue: string) => void
): void {
  // ── Core numeric fields (already validated with isFiniteNumber + positive check) ──
  if (!isFiniteNumber(rules.oversPerInnings) && rules.oversPerInnings !== null)
    push("rules.oversPerInnings must be a number or null")
  if (!isFiniteNumber(rules.ballsPerOver))
    push("rules.ballsPerOver must be a number")
  if (!isFiniteNumber(rules.maxWickets))
    push("rules.maxWickets must be a number")
  if (isFiniteNumber(rules.ballsPerOver) && rules.ballsPerOver <= 0)
    push("rules.ballsPerOver must be > 0")
  if (isFiniteNumber(rules.maxWickets) && rules.maxWickets <= 0)
    push("rules.maxWickets must be > 0")
  if (isFiniteNumber(rules.oversPerInnings) && rules.oversPerInnings <= 0)
    push("rules.oversPerInnings must be > 0 or null")

  // ── Additional numeric fields ──
  if (rules.maxOversPerBowler !== undefined && rules.maxOversPerBowler !== null) {
    if (!isFiniteNumber(rules.maxOversPerBowler))
      push("rules.maxOversPerBowler must be a number or null")
    else if (rules.maxOversPerBowler <= 0)
      push("rules.maxOversPerBowler must be > 0")
  }
  if (rules.wideRuns !== undefined) {
    if (!isFiniteNumber(rules.wideRuns)) push("rules.wideRuns must be a number")
    else if (rules.wideRuns < 0) push("rules.wideRuns must be >= 0")
  }
  if (rules.noBallRuns !== undefined) {
    if (!isFiniteNumber(rules.noBallRuns)) push("rules.noBallRuns must be a number")
    else if (rules.noBallRuns < 0) push("rules.noBallRuns must be >= 0")
  }
  if (rules.inningsPerSide !== undefined) {
    if (!isFiniteNumber(rules.inningsPerSide)) push("rules.inningsPerSide must be a number")
    else if (rules.inningsPerSide <= 0) push("rules.inningsPerSide must be > 0")
  }
  if (rules.powerplayOvers !== undefined) {
    if (!isFiniteNumber(rules.powerplayOvers)) push("rules.powerplayOvers must be a number")
    else if (rules.powerplayOvers < 0) push("rules.powerplayOvers must be >= 0")
  }

  // ── Boolean fields (only validated if present — backwards compat) ──
  const boolFields = [
    "wideReball", "noBallReball", "freeHitOnNoBall", "legByesEnabled",
    "byesEnabled", "lastManStands", "superOverOnTie", "retiredHurtCanReturn",
    "penaltyRunsEnabled", "powerplayEnabled",
  ] as const
  for (const field of boolFields) {
    if (rules[field] !== undefined && typeof rules[field] !== "boolean")
      push(`rules.${field} must be a boolean`)
  }
}

/** Validate each innings entry in a match */
function validateInnings(
  innings: unknown[],
  push: (issue: string) => void
): void {
  for (let i = 0; i < innings.length; i++) {
    const inn = innings[i]
    if (typeof inn !== "object" || inn === null || Array.isArray(inn)) {
      push(`innings[${i}] must be an object`)
      continue
    }
    const r = inn as Record<string, unknown>
    if (!Array.isArray(r.ballLog)) push(`innings[${i}].ballLog must be an array`)
    if (!Array.isArray(r.battingCard)) push(`innings[${i}].battingCard must be an array`)
    if (!Array.isArray(r.bowlingCard)) push(`innings[${i}].bowlingCard must be an array`)
    if (!isFiniteNumber(r.totalRuns)) push(`innings[${i}].totalRuns must be a number`)
    if (!isFiniteNumber(r.totalWickets)) push(`innings[${i}].totalWickets must be a number`)
  }
}

function validateRow(
  table: string,
  row: Record<string, unknown>,
  idx: number,
  errors: ImportRowError[]
): void {
  const push = (issue: string) => errors.push({ table, row: idx, issue })

  switch (table) {
    case "teams":
      if (!isNonEmptyString(row.id)) push("id must be a non-empty string")
      if (!isNonEmptyString(row.name)) push("name must be a non-empty string")
      if (row.createdAt !== undefined && !isValidDate(row.createdAt))
        push("createdAt must be a valid date")
      break
    case "players":
      if (!isNonEmptyString(row.id)) push("id must be a non-empty string")
      if (!isNonEmptyString(row.name)) push("name must be a non-empty string")
      if (row.role !== undefined) {
        const validRoles = new Set(["batsman", "bowler", "allrounder", "wicketkeeper"])
        if (!validRoles.has(row.role as string))
          push(`role must be batsman | bowler | allrounder | wicketkeeper (got: ${String(row.role)})`)
      }
      if (row.battingStyle !== undefined) {
        if (row.battingStyle !== "right" && row.battingStyle !== "left")
          push(`battingStyle must be "right" or "left" (got: ${String(row.battingStyle)})`)
      }
      if (row.createdAt !== undefined && !isValidDate(row.createdAt))
        push("createdAt must be a valid date")
      break
    case "matches":
      if (!isNonEmptyString(row.id)) push("id must be a non-empty string")
      if (!isNonEmptyString(row.team1Id)) push("team1Id must be a non-empty string")
      if (!isNonEmptyString(row.team2Id)) push("team2Id must be a non-empty string")
      if (!MATCH_FORMATS.has(row.format as string))
        push(`format must be T20 | ODI | TEST | CUSTOM (got: ${String(row.format)})`)
      if (!MATCH_STATUSES.has(row.status as string))
        push(`status must be setup | live | completed | abandoned (got: ${String(row.status)})`)
      if (!Array.isArray(row.innings)) {
        push("innings must be an array")
      } else {
        validateInnings(row.innings, push)
      }
      if (row.rules === null || typeof row.rules !== "object" || Array.isArray(row.rules)) {
        push("rules must be an object")
      } else {
        validateMatchRules(row.rules as Record<string, unknown>, push)
      }
      if (row.date !== undefined && !isValidDate(row.date))
        push("date must be a valid date")
      break
    case "tournaments":
      if (!isNonEmptyString(row.id)) push("id must be a non-empty string")
      if (!isNonEmptyString(row.name)) push("name must be a non-empty string")
      if (!TOURNAMENT_FORMATS.has(row.format as string))
        push(`format must be ROUND_ROBIN | KNOCKOUT | GROUP_KNOCKOUT (got: ${String(row.format)})`)
      if (!TOURNAMENT_STATUSES.has(row.status as string))
        push(`status must be upcoming | live | completed (got: ${String(row.status)})`)
      if (!Array.isArray(row.fixtures))
        push("fixtures must be an array")
      if (row.createdAt !== undefined && !isValidDate(row.createdAt))
        push("createdAt must be a valid date")
      break
    case "battingStats":
    case "bowlingStats":
      if (!isNonEmptyString(row.id)) push("id must be a non-empty string")
      if (!isNonEmptyString(row.playerId)) push("playerId must be a non-empty string")
      if (!STAT_FORMATS.has(row.format as string))
        push(`format must be T20 | ODI | TEST | CUSTOM | ALL (got: ${String(row.format)})`)
      if (!isFiniteNumber(row.matches)) push("matches must be a number")
      if (!isFiniteNumber(row.innings)) push("innings must be a number")
      break

    // ── Settings table ────────────────────────────────────────────────────────
    case "settings":
      if (!isNonEmptyString(row.id)) push("id must be a non-empty string")
      if (row.theme !== undefined && !SETTINGS_THEMES.has(row.theme as string))
        push(`theme must be dark | light | system (got: ${String(row.theme)})`)
      if (row.hapticFeedback !== undefined && typeof row.hapticFeedback !== "boolean")
        push("hapticFeedback must be a boolean")
      if (row.wakeLock !== undefined && typeof row.wakeLock !== "boolean")
        push("wakeLock must be a boolean")
      break
  }
}

/**
 * Validates an import payload (parsed JSON object) against the expected schema.
 * Returns an array of errors — empty means valid.
 */
export function validateImportPayload(data: Record<string, unknown>): ImportRowError[] {
  const tables = [
    "teams", "players", "matches", "tournaments", "battingStats", "bowlingStats",
    "settings",
  ] as const
  const errors: ImportRowError[] = []

  for (const table of tables) {
    const rows = data[table]
    if (rows === undefined) continue
    if (!Array.isArray(rows)) {
      errors.push({ table, row: -1, issue: "must be an array" })
      continue
    }
    rows.forEach((row, idx) => {
      if (typeof row !== "object" || row === null || Array.isArray(row)) {
        errors.push({ table, row: idx, issue: "row must be an object" })
        return
      }
      validateRow(table, row as Record<string, unknown>, idx, errors)
    })
  }

  return errors
}

/**
 * Format validation errors into a user-facing alert message.
 * Shows up to MAX_SHOWN errors then summarises the rest.
 */
export function formatValidationErrors(errors: ImportRowError[], maxShown = 10): string {
  const lines = errors.slice(0, maxShown).map(
    (e) => `• ${e.table}[${e.row}]: ${e.issue}`
  )
  if (errors.length > maxShown) {
    lines.push(`…and ${errors.length - maxShown} more error(s).`)
  }
  return `Import failed — ${errors.length} validation error(s):\n\n${lines.join("\n")}`
}

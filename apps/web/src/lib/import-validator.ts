// ─── Import payload row-level validation ─────────────────────────────────────
//
// Validates a JSON backup payload before any DB writes. Each table has required
// field checks, non-empty string checks, and enum membership checks.

const MATCH_FORMATS = new Set(["T20", "ODI", "TEST", "CUSTOM"])
const MATCH_STATUSES = new Set(["setup", "live", "completed", "abandoned"])
const TOURNAMENT_FORMATS = new Set(["ROUND_ROBIN", "KNOCKOUT", "GROUP_KNOCKOUT"])
const TOURNAMENT_STATUSES = new Set(["upcoming", "live", "completed"])
const STAT_FORMATS = new Set(["T20", "ODI", "TEST", "CUSTOM", "ALL"])

export interface ImportRowError {
  table: string
  row: number
  issue: string
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0
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
      break
    case "players":
      if (!isNonEmptyString(row.id)) push("id must be a non-empty string")
      if (!isNonEmptyString(row.name)) push("name must be a non-empty string")
      break
    case "matches":
      if (!isNonEmptyString(row.id)) push("id must be a non-empty string")
      if (!isNonEmptyString(row.team1Id)) push("team1Id must be a non-empty string")
      if (!isNonEmptyString(row.team2Id)) push("team2Id must be a non-empty string")
      if (!MATCH_FORMATS.has(row.format as string))
        push(`format must be T20 | ODI | TEST | CUSTOM (got: ${String(row.format)})`)
      if (!MATCH_STATUSES.has(row.status as string))
        push(`status must be setup | live | completed | abandoned (got: ${String(row.status)})`)
      if (!Array.isArray(row.innings)) push("innings must be an array")
      if (row.rules === null || typeof row.rules !== "object" || Array.isArray(row.rules))
        push("rules must be an object")
      break
    case "tournaments":
      if (!isNonEmptyString(row.id)) push("id must be a non-empty string")
      if (!isNonEmptyString(row.name)) push("name must be a non-empty string")
      if (!TOURNAMENT_FORMATS.has(row.format as string))
        push(`format must be ROUND_ROBIN | KNOCKOUT | GROUP_KNOCKOUT (got: ${String(row.format)})`)
      if (!TOURNAMENT_STATUSES.has(row.status as string))
        push(`status must be upcoming | live | completed (got: ${String(row.status)})`)
      break
    case "battingStats":
    case "bowlingStats":
      if (!isNonEmptyString(row.id)) push("id must be a non-empty string")
      if (!isNonEmptyString(row.playerId)) push("playerId must be a non-empty string")
      if (!STAT_FORMATS.has(row.format as string))
        push(`format must be T20 | ODI | TEST | CUSTOM | ALL (got: ${String(row.format)})`)
      break
  }
}

/**
 * Validates an import payload (parsed JSON object) against the expected schema.
 * Returns an array of errors — empty means valid.
 */
export function validateImportPayload(data: Record<string, unknown>): ImportRowError[] {
  const tables = ["teams", "players", "matches", "tournaments", "battingStats", "bowlingStats"] as const
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

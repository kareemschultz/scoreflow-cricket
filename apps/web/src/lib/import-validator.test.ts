import { describe, it, expect } from "vitest"
import { validateImportPayload } from "./import-validator"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTeam(overrides: Record<string, unknown> = {}) {
  return { id: "t1", name: "Team A", ...overrides }
}
function makePlayer(overrides: Record<string, unknown> = {}) {
  return { id: "p1", name: "Alice", ...overrides }
}
function makeMatch(overrides: Record<string, unknown> = {}) {
  return {
    id: "m1",
    team1Id: "t1",
    team2Id: "t2",
    format: "T20",
    status: "completed",
    innings: [],
    rules: {},
    ...overrides,
  }
}
function makeTournament(overrides: Record<string, unknown> = {}) {
  return { id: "tr1", name: "Cup 2024", format: "ROUND_ROBIN", status: "upcoming", ...overrides }
}
function makeBattingStats(overrides: Record<string, unknown> = {}) {
  return { id: "p1_T20", playerId: "p1", format: "T20", ...overrides }
}
function makeBowlingStats(overrides: Record<string, unknown> = {}) {
  return { id: "p1_ALL", playerId: "p1", format: "ALL", ...overrides }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("validateImportPayload", () => {
  it("returns no errors for a valid payload", () => {
    const payload = {
      teams: [makeTeam()],
      players: [makePlayer()],
      matches: [makeMatch()],
      tournaments: [makeTournament()],
      battingStats: [makeBattingStats()],
      bowlingStats: [makeBowlingStats()],
    }
    expect(validateImportPayload(payload)).toHaveLength(0)
  })

  it("returns no errors when optional tables are absent", () => {
    expect(validateImportPayload({ teams: [makeTeam()] })).toHaveLength(0)
    expect(validateImportPayload({})).toHaveLength(0)
  })

  it("errors when a table is not an array", () => {
    const errors = validateImportPayload({ teams: { id: "bad" } })
    expect(errors).toHaveLength(1)
    expect(errors[0].table).toBe("teams")
    expect(errors[0].row).toBe(-1)
    expect(errors[0].issue).toMatch(/must be an array/)
  })

  it("errors when a row is not an object", () => {
    const errors = validateImportPayload({ teams: ["not-an-object"] })
    expect(errors).toHaveLength(1)
    expect(errors[0].issue).toMatch(/row must be an object/)
  })

  // ── teams ──

  it("errors on team missing id", () => {
    const errors = validateImportPayload({ teams: [makeTeam({ id: "" })] })
    expect(errors.some((e) => e.issue.includes("id"))).toBe(true)
  })

  it("errors on team missing name", () => {
    const errors = validateImportPayload({ teams: [makeTeam({ name: "   " })] })
    expect(errors.some((e) => e.issue.includes("name"))).toBe(true)
  })

  // ── players ──

  it("errors on player with null id", () => {
    const errors = validateImportPayload({ players: [makePlayer({ id: null })] })
    expect(errors.some((e) => e.table === "players" && e.issue.includes("id"))).toBe(true)
  })

  // ── matches ──

  it("errors on match with invalid format", () => {
    const errors = validateImportPayload({ matches: [makeMatch({ format: "IPL" })] })
    expect(errors.some((e) => e.issue.includes("format"))).toBe(true)
  })

  it("errors on match with invalid status", () => {
    const errors = validateImportPayload({ matches: [makeMatch({ status: "paused" })] })
    expect(errors.some((e) => e.issue.includes("status"))).toBe(true)
  })

  it("errors on match with innings not an array", () => {
    const errors = validateImportPayload({ matches: [makeMatch({ innings: null })] })
    expect(errors.some((e) => e.issue.includes("innings"))).toBe(true)
  })

  it("errors on match with rules not an object", () => {
    const errors = validateImportPayload({ matches: [makeMatch({ rules: "bad" })] })
    expect(errors.some((e) => e.issue.includes("rules"))).toBe(true)
  })

  it("accepts all valid match formats", () => {
    for (const format of ["T20", "ODI", "TEST", "CUSTOM"]) {
      expect(validateImportPayload({ matches: [makeMatch({ format })] })).toHaveLength(0)
    }
  })

  // ── tournaments ──

  it("errors on tournament with invalid format", () => {
    const errors = validateImportPayload({ tournaments: [makeTournament({ format: "LEAGUE" })] })
    expect(errors.some((e) => e.issue.includes("format"))).toBe(true)
  })

  it("errors on tournament with invalid status", () => {
    const errors = validateImportPayload({ tournaments: [makeTournament({ status: "archived" })] })
    expect(errors.some((e) => e.issue.includes("status"))).toBe(true)
  })

  // ── battingStats / bowlingStats ──

  it("errors on battingStats with missing playerId", () => {
    const errors = validateImportPayload({ battingStats: [makeBattingStats({ playerId: "" })] })
    expect(errors.some((e) => e.table === "battingStats" && e.issue.includes("playerId"))).toBe(true)
  })

  it("errors on bowlingStats with invalid format", () => {
    const errors = validateImportPayload({ bowlingStats: [makeBowlingStats({ format: "IPL" })] })
    expect(errors.some((e) => e.table === "bowlingStats" && e.issue.includes("format"))).toBe(true)
  })

  it("accepts ALL as a valid stats format", () => {
    expect(validateImportPayload({ battingStats: [makeBattingStats({ format: "ALL" })] })).toHaveLength(0)
    expect(validateImportPayload({ bowlingStats: [makeBowlingStats({ format: "ALL" })] })).toHaveLength(0)
  })

  // ── multiple errors ──

  it("accumulates errors across multiple rows and tables", () => {
    const payload = {
      teams: [makeTeam({ id: "" }), makeTeam({ name: "" })],
      matches: [makeMatch({ format: "X", status: "Z" })],
    }
    const errors = validateImportPayload(payload)
    // team[0] id + team[1] name + match[0] format + match[0] status = 4 errors
    expect(errors.length).toBeGreaterThanOrEqual(4)
  })
})

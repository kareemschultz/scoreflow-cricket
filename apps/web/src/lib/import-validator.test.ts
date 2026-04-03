import { describe, it, expect } from "vitest"
import { validateImportPayload } from "./import-validator"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTeam(overrides: Record<string, unknown> = {}) {
  return { id: "t1", name: "Team A", ...overrides }
}
function makePlayer(overrides: Record<string, unknown> = {}) {
  return { id: "p1", name: "Alice", ...overrides }
}
function makeInnings(overrides: Record<string, unknown> = {}) {
  return {
    ballLog: [],
    battingCard: [],
    bowlingCard: [],
    totalRuns: 0,
    totalWickets: 0,
    ...overrides,
  }
}
function makeMatch(overrides: Record<string, unknown> = {}) {
  return {
    id: "m1",
    team1Id: "t1",
    team2Id: "t2",
    format: "T20",
    status: "completed",
    innings: [],
    rules: { oversPerInnings: 20, ballsPerOver: 6, maxWickets: 10 },
    ...overrides,
  }
}
function makeTournament(overrides: Record<string, unknown> = {}) {
  return { id: "tr1", name: "Cup 2024", format: "ROUND_ROBIN", status: "upcoming", fixtures: [], ...overrides }
}
function makeBattingStats(overrides: Record<string, unknown> = {}) {
  return { id: "p1_T20", playerId: "p1", format: "T20", matches: 5, innings: 5, ...overrides }
}
function makeBowlingStats(overrides: Record<string, unknown> = {}) {
  return { id: "p1_ALL", playerId: "p1", format: "ALL", matches: 3, innings: 3, ...overrides }
}
function makeSettings(overrides: Record<string, unknown> = {}) {
  return { id: "global", theme: "dark", hapticFeedback: true, wakeLock: true, ...overrides }
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

  // ── edge cases ────────────────────────────────────────────────────────────────

  it("errors on a null value in an array position (not an object)", () => {
    const errors = validateImportPayload({ teams: [null] })
    expect(errors).toHaveLength(1)
    expect(errors[0].table).toBe("teams")
    expect(errors[0].row).toBe(0)
    expect(errors[0].issue).toMatch(/row must be an object/)
  })

  it("accepts a match with innings: [] (empty array is valid)", () => {
    const errors = validateImportPayload({ matches: [makeMatch({ innings: [] })] })
    expect(errors).toHaveLength(0)
  })

  it("accumulates errors only for invalid rows, not entire table", () => {
    // First row valid, second row invalid — should produce exactly 1 error
    const payload = {
      teams: [makeTeam(), makeTeam({ id: "" })],
    }
    const errors = validateImportPayload(payload)
    expect(errors).toHaveLength(1)
    expect(errors[0].row).toBe(1)
  })

  it("ignores unknown table keys in the payload (no error)", () => {
    const payload = {
      unknownTable: [{ id: "x", name: "y" }],
      anotherUnknown: "some value",
      teams: [makeTeam()],
    }
    const errors = validateImportPayload(payload as Record<string, unknown>)
    expect(errors).toHaveLength(0)
  })

  it("errors when a numeric value appears instead of an array row", () => {
    const errors = validateImportPayload({ players: [42] })
    expect(errors).toHaveLength(1)
    expect(errors[0].issue).toMatch(/row must be an object/)
  })

  it("errors when an array value appears instead of an array row", () => {
    const errors = validateImportPayload({ players: [[{ id: "nested" }]] })
    expect(errors).toHaveLength(1)
    expect(errors[0].issue).toMatch(/row must be an object/)
  })

  // ── deep validation: dates ──

  it("errors on team with invalid createdAt date", () => {
    const errors = validateImportPayload({ teams: [makeTeam({ createdAt: "not-a-date" })] })
    expect(errors.some((e) => e.issue.includes("createdAt"))).toBe(true)
  })

  it("accepts team with valid ISO date string for createdAt", () => {
    const errors = validateImportPayload({ teams: [makeTeam({ createdAt: "2025-01-15T10:30:00Z" })] })
    expect(errors).toHaveLength(0)
  })

  it("errors on match with invalid date", () => {
    const errors = validateImportPayload({ matches: [makeMatch({ date: "xyz" })] })
    expect(errors.some((e) => e.issue.includes("date"))).toBe(true)
  })

  // ── deep validation: player enums ──

  it("errors on player with invalid role", () => {
    const errors = validateImportPayload({ players: [makePlayer({ role: "captain" })] })
    expect(errors.some((e) => e.issue.includes("role"))).toBe(true)
  })

  it("errors on player with invalid battingStyle", () => {
    const errors = validateImportPayload({ players: [makePlayer({ battingStyle: "switch" })] })
    expect(errors.some((e) => e.issue.includes("battingStyle"))).toBe(true)
  })

  it("accepts valid player roles and batting styles", () => {
    for (const role of ["batsman", "bowler", "allrounder", "wicketkeeper"]) {
      expect(validateImportPayload({ players: [makePlayer({ role })] })).toHaveLength(0)
    }
    for (const battingStyle of ["right", "left"]) {
      expect(validateImportPayload({ players: [makePlayer({ battingStyle })] })).toHaveLength(0)
    }
  })

  // ── deep validation: match rules ──

  it("errors on match with invalid rules fields", () => {
    const badRules = { oversPerInnings: "twenty", ballsPerOver: "six", maxWickets: "ten" }
    const errors = validateImportPayload({ matches: [makeMatch({ rules: badRules })] })
    expect(errors.some((e) => e.issue.includes("rules.oversPerInnings"))).toBe(true)
    expect(errors.some((e) => e.issue.includes("rules.ballsPerOver"))).toBe(true)
    expect(errors.some((e) => e.issue.includes("rules.maxWickets"))).toBe(true)
  })

  it("accepts match with rules.oversPerInnings as null (unlimited overs)", () => {
    const rules = { oversPerInnings: null, ballsPerOver: 6, maxWickets: 10 }
    const errors = validateImportPayload({ matches: [makeMatch({ rules })] })
    expect(errors).toHaveLength(0)
  })

  it("errors on match rules with non-positive numeric values", () => {
    const rules = { oversPerInnings: 0, ballsPerOver: 0, maxWickets: -1 }
    const errors = validateImportPayload({ matches: [makeMatch({ rules })] })
    expect(errors.some((e) => e.issue.includes("rules.oversPerInnings must be > 0"))).toBe(true)
    expect(errors.some((e) => e.issue.includes("rules.ballsPerOver must be > 0"))).toBe(true)
    expect(errors.some((e) => e.issue.includes("rules.maxWickets must be > 0"))).toBe(true)
  })

  // ── deep validation: innings structure ──

  it("errors on match with malformed innings entries", () => {
    const badInnings = [{ totalRuns: "not-a-number", totalWickets: 0, ballLog: [], battingCard: [], bowlingCard: [] }]
    const errors = validateImportPayload({ matches: [makeMatch({ innings: badInnings })] })
    expect(errors.some((e) => e.issue.includes("innings[0].totalRuns"))).toBe(true)
  })

  it("errors on innings missing required arrays", () => {
    const badInnings = [{ totalRuns: 120, totalWickets: 4 }]
    const errors = validateImportPayload({ matches: [makeMatch({ innings: badInnings })] })
    expect(errors.some((e) => e.issue.includes("ballLog"))).toBe(true)
    expect(errors.some((e) => e.issue.includes("battingCard"))).toBe(true)
    expect(errors.some((e) => e.issue.includes("bowlingCard"))).toBe(true)
  })

  it("accepts match with valid innings structure", () => {
    const innings = [makeInnings({ totalRuns: 150, totalWickets: 6 })]
    const errors = validateImportPayload({ matches: [makeMatch({ innings })] })
    expect(errors).toHaveLength(0)
  })

  // ── deep validation: tournament fixtures ──

  it("errors on tournament missing fixtures array", () => {
    const errors = validateImportPayload({ tournaments: [makeTournament({ fixtures: "none" })] })
    expect(errors.some((e) => e.issue.includes("fixtures"))).toBe(true)
  })

  // ── deep validation: stats numeric fields ──

  it("errors on battingStats with non-number matches/innings", () => {
    const errors = validateImportPayload({ battingStats: [makeBattingStats({ matches: "five", innings: null })] })
    expect(errors.some((e) => e.issue.includes("matches must be a number"))).toBe(true)
    expect(errors.some((e) => e.issue.includes("innings must be a number"))).toBe(true)
  })

  it("errors on bowlingStats with NaN matches/innings", () => {
    const errors = validateImportPayload({ bowlingStats: [makeBowlingStats({ matches: Number.NaN, innings: Number.NaN })] })
    expect(errors.some((e) => e.issue.includes("matches must be a number"))).toBe(true)
    expect(errors.some((e) => e.issue.includes("innings must be a number"))).toBe(true)
  })

  // ── MatchRules deep validation ──────────────────────────────────────────────

  it("errors on rules boolean fields set to non-boolean values", () => {
    const rules = {
      oversPerInnings: 20, ballsPerOver: 6, maxWickets: 10,
      wideReball: "yes", freeHitOnNoBall: 1, legByesEnabled: null,
    }
    const errors = validateImportPayload({ matches: [makeMatch({ rules })] })
    expect(errors.some((e) => e.issue.includes("rules.wideReball must be a boolean"))).toBe(true)
    expect(errors.some((e) => e.issue.includes("rules.freeHitOnNoBall must be a boolean"))).toBe(true)
    expect(errors.some((e) => e.issue.includes("rules.legByesEnabled must be a boolean"))).toBe(true)
  })

  it("accepts rules with all boolean fields as true/false", () => {
    const rules = {
      oversPerInnings: 20, ballsPerOver: 6, maxWickets: 10,
      wideReball: true, noBallReball: false, freeHitOnNoBall: true,
      legByesEnabled: true, byesEnabled: true, lastManStands: false,
      superOverOnTie: true, retiredHurtCanReturn: false, penaltyRunsEnabled: true,
      powerplayEnabled: true,
    }
    const errors = validateImportPayload({ matches: [makeMatch({ rules })] })
    expect(errors).toHaveLength(0)
  })

  it("errors on rules.maxOversPerBowler with non-positive value", () => {
    const rules = { oversPerInnings: 20, ballsPerOver: 6, maxWickets: 10, maxOversPerBowler: 0 }
    const errors = validateImportPayload({ matches: [makeMatch({ rules })] })
    expect(errors.some((e) => e.issue.includes("rules.maxOversPerBowler must be > 0"))).toBe(true)
  })

  it("accepts rules.maxOversPerBowler as null", () => {
    const rules = { oversPerInnings: 20, ballsPerOver: 6, maxWickets: 10, maxOversPerBowler: null }
    const errors = validateImportPayload({ matches: [makeMatch({ rules })] })
    expect(errors).toHaveLength(0)
  })

  it("errors on rules.inningsPerSide as 0", () => {
    const rules = { oversPerInnings: 20, ballsPerOver: 6, maxWickets: 10, inningsPerSide: 0 }
    const errors = validateImportPayload({ matches: [makeMatch({ rules })] })
    expect(errors.some((e) => e.issue.includes("rules.inningsPerSide must be > 0"))).toBe(true)
  })

  it("accepts rules.wideRuns and noBallRuns as 0 (valid — zero penalty rule)", () => {
    const rules = { oversPerInnings: 20, ballsPerOver: 6, maxWickets: 10, wideRuns: 0, noBallRuns: 0 }
    const errors = validateImportPayload({ matches: [makeMatch({ rules })] })
    expect(errors).toHaveLength(0)
  })

  it("errors on rules.wideRuns as negative", () => {
    const rules = { oversPerInnings: 20, ballsPerOver: 6, maxWickets: 10, wideRuns: -1 }
    const errors = validateImportPayload({ matches: [makeMatch({ rules })] })
    expect(errors.some((e) => e.issue.includes("rules.wideRuns must be >= 0"))).toBe(true)
  })

  // ── Settings table ──────────────────────────────────────────────────────────

  it("returns no errors for valid settings row", () => {
    const errors = validateImportPayload({ settings: [makeSettings()] })
    expect(errors).toHaveLength(0)
  })

  it("errors on settings with invalid theme", () => {
    const errors = validateImportPayload({ settings: [makeSettings({ theme: "purple" })] })
    expect(errors.some((e) => e.issue.includes("theme must be dark | light | system"))).toBe(true)
  })

  it("errors on settings with non-boolean hapticFeedback", () => {
    const errors = validateImportPayload({ settings: [makeSettings({ hapticFeedback: "yes" })] })
    expect(errors.some((e) => e.issue.includes("hapticFeedback must be a boolean"))).toBe(true)
  })

  it("returns no errors for valid full cricket payload", () => {
    const payload = {
      teams: [makeTeam()],
      players: [makePlayer()],
      matches: [makeMatch()],
      tournaments: [makeTournament()],
      battingStats: [makeBattingStats()],
      bowlingStats: [makeBowlingStats()],
      settings: [makeSettings()],
    }
    expect(validateImportPayload(payload)).toHaveLength(0)
  })
})

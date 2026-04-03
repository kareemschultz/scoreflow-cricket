import Dexie, { type EntityTable } from "dexie"
import type {
  Team,
  Player,
  Match,
  Tournament,
  PlayerBattingStats,
  PlayerBowlingStats,
  AppSettings,
  CricketFormat,
} from "@/types/cricket"
// ─── Database ────────────────────────────────────────────────────────────────

class ScoreFlowCricketDB extends Dexie {
  teams!: EntityTable<Team, "id">
  players!: EntityTable<Player, "id">
  matches!: EntityTable<Match, "id">
  tournaments!: EntityTable<Tournament, "id">
  battingStats!: EntityTable<PlayerBattingStats & { id: string }, "id">
  bowlingStats!: EntityTable<PlayerBowlingStats & { id: string }, "id">
  settings!: EntityTable<AppSettings & { id: string }, "id">

  constructor() {
    super("ScoreFlowCricketDB")

    this.version(1).stores({
      teams: "id, name, createdAt",
      players: "id, name, teamId, createdAt",
      matches: "id, status, date, format, team1Id, team2Id, tournamentId",
      tournaments: "id, status, createdAt",
      battingStats: "id, playerId, format, [playerId+format]",
      bowlingStats: "id, playerId, format, [playerId+format]",
      settings: "id",
    })
  }
}

export const db = new ScoreFlowCricketDB()

// ─── Settings helpers ─────────────────────────────────────────────────────────

export async function getSettings(): Promise<AppSettings> {
  const row = await db.settings.get("global")
  return (
    row ?? {
      id: "global",
      defaultFormat: "T20",
      defaultRules: {},
      theme: "dark",
      hapticFeedback: true,
      wakeLock: true,
    }
  )
}

export async function saveSettings(settings: Partial<AppSettings>) {
  const current = await getSettings()
  await db.settings.put({ ...current, ...settings, id: "global" } as AppSettings & { id: string })
}

// ─── Team helpers ─────────────────────────────────────────────────────────────

export async function getTeams() {
  return db.teams.orderBy("createdAt").toArray()
}

export async function getTeamWithPlayers(teamId: string) {
  const [team, players] = await Promise.all([
    db.teams.get(teamId),
    db.players.where("teamId").equals(teamId).sortBy("createdAt"),
  ])
  return { team, players }
}

// ─── Match helpers ────────────────────────────────────────────────────────────

export async function getLiveMatch(): Promise<Match | undefined> {
  return db.matches.where("status").equals("live").first()
}

export async function getMatchHistory(limit = 50): Promise<Match[]> {
  const all = await db.matches
    .where("status")
    .anyOf(["completed", "abandoned"])
    .sortBy("date")
  // sortBy always returns ascending — reverse for newest-first
  return all.reverse().slice(0, limit)
}

// ─── Stats helpers ────────────────────────────────────────────────────────────

export async function getPlayerBattingStats(
  playerId: string,
  format: CricketFormat | "ALL" = "ALL"
): Promise<PlayerBattingStats | undefined> {
  return (await db.battingStats.where("[playerId+format]").equals([playerId, format]).first()) as
    | PlayerBattingStats
    | undefined
}

export async function getPlayerBowlingStats(
  playerId: string,
  format: CricketFormat | "ALL" = "ALL"
): Promise<PlayerBowlingStats | undefined> {
  return (await db.bowlingStats.where("[playerId+format]").equals([playerId, format]).first()) as
    | PlayerBowlingStats
    | undefined
}

export async function getTopBatsmen(
  format: CricketFormat | "ALL" = "ALL",
  limit = 20
): Promise<PlayerBattingStats[]> {
  const all = (await db.battingStats.where("format").equals(format).toArray()) as PlayerBattingStats[]
  return all.sort((a, b) => b.runs - a.runs).slice(0, limit)
}

export async function getTopBowlers(
  format: CricketFormat | "ALL" = "ALL",
  limit = 20
): Promise<PlayerBowlingStats[]> {
  const rows = (await db.bowlingStats.where("format").equals(format).toArray()) as PlayerBowlingStats[]
  return rows
    .sort((a, b) => b.wickets - a.wickets)
    .slice(0, limit)
}

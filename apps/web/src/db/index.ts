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
import type { FifaPlayer, FifaMatch } from "@/types/fifa"
import type { DominoPlayer, DominoTeam, DominoMatch } from "@/types/dominoes"
import type { TrumpPlayer, TrumpTeam, TrumpMatch } from "@/types/trump"

// ─── Database ────────────────────────────────────────────────────────────────

class ScoreFlowDB extends Dexie {
  teams!: EntityTable<Team, "id">
  players!: EntityTable<Player, "id">
  matches!: EntityTable<Match, "id">
  tournaments!: EntityTable<Tournament, "id">
  battingStats!: EntityTable<PlayerBattingStats & { id: string }, "id">
  bowlingStats!: EntityTable<PlayerBowlingStats & { id: string }, "id">
  settings!: EntityTable<AppSettings & { id: string }, "id">
  fifaPlayers!: EntityTable<FifaPlayer, "id">
  fifaMatches!: EntityTable<FifaMatch, "id">
  dominoPlayers!: EntityTable<DominoPlayer, "id">
  dominoTeams!: EntityTable<DominoTeam, "id">
  dominoMatches!: EntityTable<DominoMatch, "id">
  trumpPlayers!: EntityTable<TrumpPlayer, "id">
  trumpTeams!: EntityTable<TrumpTeam, "id">
  trumpMatches!: EntityTable<TrumpMatch, "id">

  constructor() {
    super("CricketBookDB")

    this.version(1).stores({
      teams: "id, name, createdAt",
      players: "id, name, teamId, createdAt",
      matches: "id, status, date, format, team1Id, team2Id, tournamentId",
      tournaments: "id, status, createdAt",
      battingStats: "id, playerId, format, [playerId+format]",
      bowlingStats: "id, playerId, format, [playerId+format]",
      settings: "id",
    })

    this.version(2).stores({
      fifaPlayers: "id, name, createdAt",
      fifaMatches: "id, date, player1Id, player2Id",
    })

    this.version(3).stores({
      dominoPlayers: "id, name, createdAt",
      dominoTeams: "id, name, player1Id, player2Id, createdAt",
      dominoMatches: "id, date, team1Id, team2Id, status",
      trumpPlayers: "id, name, createdAt",
      trumpTeams: "id, name, player1Id, player2Id, createdAt",
      trumpMatches: "id, date, team1Id, team2Id, status",
    })
  }
}

export const db = new ScoreFlowDB()

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
  const all = (await db.bowlingStats.orderBy("wickets").reverse().toArray()) as PlayerBowlingStats[]
  const filtered = format === "ALL" ? all.filter((s) => s.format === "ALL") : all.filter((s) => s.format === format)
  return filtered.slice(0, limit)
}

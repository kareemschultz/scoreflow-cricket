import { db } from "@/db/index"
import { logError } from "@/lib/error-log"
import type {
  Match,
  CricketFormat,
  PlayerBattingStats,
  PlayerBowlingStats,
  BatsmanEntry,
  BowlerEntry,
} from "@/types/cricket"

// ─── NRR ─────────────────────────────────────────────────────────────────────

/**
 * Compute Net Run Rate.
 * NRR = (runsFor / oversFor) - (runsAgainst / oversAgainst)
 * Overs values are decimal cricket notation (e.g. 19.4 = 19 overs 4 balls).
 */
export function computeNRR(
  runsFor: number,
  oversFor: number,
  runsAgainst: number,
  oversAgainst: number
): number {
  const oversForInBalls = oversToBalls(oversFor)
  const oversAgainstInBalls = oversToBalls(oversAgainst)

  if (oversForInBalls <= 0 || oversAgainstInBalls <= 0) return 0

  const oversForTrue = oversForInBalls / 6
  const oversAgainstTrue = oversAgainstInBalls / 6

  return runsFor / oversForTrue - runsAgainst / oversAgainstTrue
}

function oversToBalls(overs: number): number {
  if (overs <= 0) return 0
  const wholeOvers = Math.trunc(overs)
  const rawBalls = Math.round((overs - wholeOvers) * 10)
  if (rawBalls < 0 || rawBalls > 5) {
    logError(
      "nrr-overs",
      `Invalid overs notation ${overs}: ball digit ${rawBalls} is outside 0–5. Clamping to nearest valid value.`
    )
  }
  const ballsPart = Math.max(0, Math.min(5, rawBalls))
  return wholeOvers * 6 + ballsPart
}

// ─── Bowling figure comparison ────────────────────────────────────────────────

/**
 * Returns true if (newW, newR) is a better bowling figure than (bestW, bestR).
 * Better = more wickets; on tie, fewer runs wins.
 */
function isBetterBowlingFigure(
  newW: number,
  newR: number,
  bestW: number,
  bestR: number
): boolean {
  if (newW > bestW) return true
  if (newW === bestW && newR < bestR) return true
  return false
}

// ─── Batting stats update ─────────────────────────────────────────────────────

/**
 * Merge a single innings' BatsmanEntry into a PlayerBattingStats record.
 * Returns the updated record (does not write to DB).
 */
function mergeBattingEntry(
  existing: PlayerBattingStats,
  entry: BatsmanEntry,
  isNewMatch: boolean
): PlayerBattingStats {
  const isNotOut = !entry.isOut && !entry.isRetiredHurt
  const scored = entry.runs

  const newMatches = existing.matches + (isNewMatch ? 1 : 0)
  const newInnings = existing.innings + 1
  const newNotOuts = existing.notOuts + (isNotOut ? 1 : 0)
  const newRuns = existing.runs + scored
  const newFours = existing.fours + entry.fours
  const newSixes = existing.sixes + entry.sixes
  const newDots = existing.dots + entry.dots
  const newFifties =
    existing.fifties + (scored >= 50 && scored < 100 ? 1 : 0)
  const newHundreds = existing.hundreds + (scored >= 100 ? 1 : 0)
  const newDucks = existing.ducks + (scored === 0 && entry.isOut ? 1 : 0)

  // High score
  let newHighScore = existing.highScore
  let newHighScoreNotOut = existing.highScoreNotOut
  if (
    scored > existing.highScore ||
    (scored === existing.highScore && isNotOut && !existing.highScoreNotOut)
  ) {
    newHighScore = scored
    newHighScoreNotOut = isNotOut
  }

  // Batting average = runs / (innings - notOuts)
  const dismissals = newInnings - newNotOuts
  const average = dismissals > 0 ? newRuns / dismissals : newRuns

  // Strike rate = (runs / balls) * 100
  // We need total balls faced — infer from existing SR and balls, then add
  const existingBalls =
    existing.strikeRate > 0
      ? (existing.runs / existing.strikeRate) * 100
      : 0
  const totalBalls = existingBalls + entry.balls
  const strikeRate = totalBalls > 0 ? (newRuns / totalBalls) * 100 : 0

  return {
    ...existing,
    matches: newMatches,
    innings: newInnings,
    notOuts: newNotOuts,
    runs: newRuns,
    highScore: newHighScore,
    highScoreNotOut: newHighScoreNotOut,
    average,
    strikeRate,
    fifties: newFifties,
    hundreds: newHundreds,
    fours: newFours,
    sixes: newSixes,
    ducks: newDucks,
    dots: newDots,
    lastUpdated: new Date(),
  }
}

// ─── Bowling stats update ─────────────────────────────────────────────────────

/**
 * Merge a single innings' BowlerEntry into a PlayerBowlingStats record.
 * Returns the updated record (does not write to DB).
 */
function mergeBowlingEntry(
  existing: PlayerBowlingStats,
  entry: BowlerEntry,
  ballsPerOver: number,
  isNewMatch: boolean
): PlayerBowlingStats {
  const newMatches = existing.matches + (isNewMatch ? 1 : 0)
  const newInnings = existing.innings + 1
  const newRuns = existing.runs + entry.runs
  const newWickets = existing.wickets + entry.wickets
  const newMaidens = existing.maidens + entry.maidens
  const newDots = existing.dots + entry.dots

  // Convert overs to total legal balls and back
  const existingLegalBalls = existing.overs * ballsPerOver + existing.balls
  const entryLegalBalls = entry.overs * ballsPerOver + entry.balls
  const totalLegalBalls = existingLegalBalls + entryLegalBalls
  const newOvers = Math.floor(totalLegalBalls / ballsPerOver)
  const newBalls = totalLegalBalls % ballsPerOver

  // Bowling average = runs / wickets
  const average = newWickets > 0 ? newRuns / newWickets : 0

  // Bowling strike rate = balls / wickets
  const strikeRate = newWickets > 0 ? totalLegalBalls / newWickets : 0

  // Economy = (runs / legalBalls) * ballsPerOver
  const economy =
    totalLegalBalls > 0 ? (newRuns / totalLegalBalls) * ballsPerOver : 0

  // Best bowling figures
  let newBestWickets = existing.bestWickets
  let newBestRuns = existing.bestRuns
  if (
    isBetterBowlingFigure(
      entry.wickets,
      entry.runs,
      existing.bestWickets,
      existing.bestRuns
    )
  ) {
    newBestWickets = entry.wickets
    newBestRuns = entry.runs
  }

  const newThreeWicketHauls =
    existing.threeWicketHauls + (entry.wickets >= 3 && entry.wickets < 5 ? 1 : 0)
  const newFiveWicketHauls =
    existing.fiveWicketHauls + (entry.wickets >= 5 ? 1 : 0)

  return {
    ...existing,
    matches: newMatches,
    innings: newInnings,
    overs: newOvers,
    balls: newBalls,
    maidens: newMaidens,
    runs: newRuns,
    wickets: newWickets,
    average,
    economy,
    strikeRate,
    bestWickets: newBestWickets,
    bestRuns: newBestRuns,
    threeWicketHauls: newThreeWicketHauls,
    fiveWicketHauls: newFiveWicketHauls,
    dots: newDots,
    lastUpdated: new Date(),
  }
}

// ─── Blank record factories ───────────────────────────────────────────────────

function blankBattingStats(
  playerId: string,
  playerName: string,
  format: CricketFormat | "ALL"
): PlayerBattingStats & { id: string } {
  return {
    id: `${playerId}_${format}`,
    playerId,
    playerName,
    format,
    matches: 0,
    innings: 0,
    notOuts: 0,
    runs: 0,
    highScore: 0,
    highScoreNotOut: false,
    average: 0,
    strikeRate: 0,
    fifties: 0,
    hundreds: 0,
    fours: 0,
    sixes: 0,
    ducks: 0,
    dots: 0,
    lastUpdated: new Date(),
  }
}

function blankBowlingStats(
  playerId: string,
  playerName: string,
  format: CricketFormat | "ALL"
): PlayerBowlingStats & { id: string } {
  return {
    id: `${playerId}_${format}`,
    playerId,
    playerName,
    format,
    matches: 0,
    innings: 0,
    overs: 0,
    balls: 0,
    maidens: 0,
    runs: 0,
    wickets: 0,
    average: 0,
    economy: 0,
    strikeRate: 0,
    bestWickets: 0,
    bestRuns: 0,
    threeWicketHauls: 0,
    fiveWicketHauls: 0,
    dots: 0,
    lastUpdated: new Date(),
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * After a match completes, iterate all innings and update both format-specific
 * and "ALL" aggregate PlayerBattingStats / PlayerBowlingStats in Dexie.
 *
 * Stats IDs follow the pattern: `${playerId}_${format}` and `${playerId}_ALL`
 */
export async function updatePlayerStatsFromMatch(match: Match): Promise<void> {
  const format = match.format
  const ballsPerOver = match.rules.ballsPerOver

  // Collect all player IDs that participated so we can look up existing stats
  // in a single batch rather than one-at-a-time queries.
  const batsmanIds = new Set<string>()
  const bowlerIds = new Set<string>()

  for (const innings of match.innings) {
    for (const entry of innings.battingCard) batsmanIds.add(entry.playerId)
    for (const entry of innings.bowlingCard) bowlerIds.add(entry.playerId)
  }

  // ── Batting ──────────────────────────────────────────────────────────────

  // Load existing batting stats for all batsmen, both format + ALL
  const battingUpdates = new Map<
    string,
    PlayerBattingStats & { id: string }
  >()

  await Promise.all(
    [...batsmanIds].flatMap((playerId) =>
      [format, "ALL" as const].map(async (fmt) => {
        const id = `${playerId}_${fmt}`
        const existing = await db.battingStats.get(id)
        battingUpdates.set(id, existing ?? blankBattingStats("", "", fmt))
      })
    )
  )

  // Track which IDs were actually touched — only these get written to DB
  const touchedBattingIds = new Set<string>()

  // Determine which matchId counts as "new" for each player's match tally
  const batsmanMatchSeen = new Set<string>() // `${playerId}_${fmt}`

  for (const innings of match.innings) {
    for (const entry of innings.battingCard) {
      // Skip entries that were never actually sent to bat (0 balls, 0 runs, not out)
      if (entry.balls === 0 && entry.runs === 0 && !entry.isOut) continue

      for (const fmt of [format, "ALL" as const]) {
        const id = `${entry.playerId}_${fmt}`
        const seenKey = `${entry.playerId}_${fmt}_match`
        const isNewMatch = !batsmanMatchSeen.has(seenKey)
        if (isNewMatch) batsmanMatchSeen.add(seenKey)

        const current =
          battingUpdates.get(id) ??
          blankBattingStats(entry.playerId, entry.playerName, fmt)

        // Ensure playerName is populated on blank records loaded from pre-seed
        if (!current.playerId) {
          current.playerId = entry.playerId
          current.playerName = entry.playerName
          current.id = id
        }

        battingUpdates.set(id, { ...mergeBattingEntry(current, entry, isNewMatch), id })
        touchedBattingIds.add(id)
      }
    }
  }

  // ── Bowling ──────────────────────────────────────────────────────────────

  const bowlingUpdates = new Map<
    string,
    PlayerBowlingStats & { id: string }
  >()

  await Promise.all(
    [...bowlerIds].flatMap((playerId) =>
      [format, "ALL" as const].map(async (fmt) => {
        const id = `${playerId}_${fmt}`
        const existing = await db.bowlingStats.get(id)
        bowlingUpdates.set(id, existing ?? blankBowlingStats("", "", fmt))
      })
    )
  )

  const touchedBowlingIds = new Set<string>()
  const bowlerMatchSeen = new Set<string>()

  for (const innings of match.innings) {
    for (const entry of innings.bowlingCard) {
      // Skip bowlers who bowled no balls
      if (entry.legalDeliveries === 0 && entry.wides === 0 && entry.noBalls === 0)
        continue

      for (const fmt of [format, "ALL" as const]) {
        const id = `${entry.playerId}_${fmt}`
        const seenKey = `${entry.playerId}_${fmt}_match`
        const isNewMatch = !bowlerMatchSeen.has(seenKey)
        if (isNewMatch) bowlerMatchSeen.add(seenKey)

        const current =
          bowlingUpdates.get(id) ??
          blankBowlingStats(entry.playerId, entry.playerName, fmt)

        if (!current.playerId) {
          current.playerId = entry.playerId
          current.playerName = entry.playerName
          current.id = id
        }

        bowlingUpdates.set(
          id,
          { ...mergeBowlingEntry(current, entry, ballsPerOver, isNewMatch), id }
        )
        touchedBowlingIds.add(id)
      }
    }
  }

  // ── Persist only touched records in a single transaction ─────────────────

  await db.transaction("rw", [db.battingStats, db.bowlingStats], async () => {
    const battingPuts = [...battingUpdates.entries()]
      .filter(([id]) => touchedBattingIds.has(id))
      .map(([, v]) => v)
    const bowlingPuts = [...bowlingUpdates.entries()]
      .filter(([id]) => touchedBowlingIds.has(id))
      .map(([, v]) => v)

    await Promise.all([
      db.battingStats.bulkPut(battingPuts),
      db.bowlingStats.bulkPut(bowlingPuts),
    ])
  })
}

// ─── Man of the Match ─────────────────────────────────────────────────────────

export interface ManOfMatchResult {
  playerId: string
  playerName: string
  teamName: string
  battingSummary: string | null   // e.g. "52* (34b) SR 152.9"
  bowlingSummary: string | null   // e.g. "3/18 in 4 ov"
  points: number
}

/**
 * Compute Man of the Match using a proven points system.
 * Only considers non-super-over innings.
 * Returns null if match is not completed or has no innings data.
 */
export function computeManOfMatch(match: Match): ManOfMatchResult | null {
  if (match.status !== "completed") return null
  if (match.innings.length === 0) return null

  // Build player → team name map from batting cards in all innings
  const playerTeam = new Map<string, string>()
  for (const innings of match.innings) {
    const battingTeamName = innings.battingTeamId === match.team1Id ? match.team1Name : match.team2Name
    const bowlingTeamName = innings.bowlingTeamId === match.team1Id ? match.team1Name : match.team2Name
    for (const entry of innings.battingCard) {
      if (!playerTeam.has(entry.playerId)) playerTeam.set(entry.playerId, battingTeamName)
    }
    for (const entry of innings.bowlingCard) {
      if (!playerTeam.has(entry.playerId)) playerTeam.set(entry.playerId, bowlingTeamName)
    }
  }

  // Accumulate points per player across all non-super-over innings
  const playerPoints = new Map<string, number>()
  const playerNames = new Map<string, string>()

  // Batting summary data (best innings per player)
  const playerBatSummary = new Map<string, string>()
  const playerBowlSummary = new Map<string, string>()

  // Aggregated bowling figures per player (across innings)
  const playerBowlAgg = new Map<string, { wickets: number; runs: number; legalBalls: number; maidens: number }>()

  for (const innings of match.innings) {
    // Batting points
    for (const entry of innings.battingCard) {
      // Skip players who never batted
      if (entry.balls === 0 && entry.runs === 0 && !entry.isOut) continue

      const balls = entry.balls
      const runs = entry.runs
      const sr = balls > 0 ? (runs / balls) * 100 : 0
      const srBonus = sr > 100 && balls > 0 ? (sr - 100) / 10 : 0
      const pts = runs + entry.fours * 1 + entry.sixes * 2 + srBonus

      playerNames.set(entry.playerId, entry.playerName)
      const prev = playerPoints.get(entry.playerId) ?? 0
      playerPoints.set(entry.playerId, prev + pts)

      // Build batting summary for highest-scoring innings
      if (!playerBatSummary.has(entry.playerId) || runs > 0) {
        const notOut = !entry.isOut && !entry.isRetiredHurt
        const srStr = balls > 0 ? ` SR ${sr.toFixed(1)}` : ""
        playerBatSummary.set(
          entry.playerId,
          `${runs}${notOut ? "*" : ""} (${balls}b)${srStr}`
        )
      }
    }

    // Bowling accumulation
    for (const entry of innings.bowlingCard) {
      const legalBalls = entry.overs * 6 + entry.balls
      if (legalBalls === 0 && entry.wides === 0 && entry.noBalls === 0) continue

      playerNames.set(entry.playerId, entry.playerName)
      const agg = playerBowlAgg.get(entry.playerId) ?? { wickets: 0, runs: 0, legalBalls: 0, maidens: 0 }
      agg.wickets += entry.wickets
      agg.runs += entry.runs
      agg.legalBalls += legalBalls
      agg.maidens += entry.maidens
      playerBowlAgg.set(entry.playerId, agg)
    }
  }

  // Convert bowling aggregates to points and summaries
  for (const [playerId, agg] of playerBowlAgg.entries()) {
    const eco = agg.legalBalls > 0 ? (agg.runs / agg.legalBalls) * 6 : 0
    const ecoBonus = eco < 6 && agg.legalBalls >= 6 ? (6 - eco) * 5 : 0
    const pts = agg.wickets * 25 + agg.maidens * 10 + ecoBonus

    const prev = playerPoints.get(playerId) ?? 0
    playerPoints.set(playerId, prev + pts)

    // Build bowling summary
    const overs = Math.floor(agg.legalBalls / 6)
    const balls = agg.legalBalls % 6
    const oversStr = balls > 0 ? `${overs}.${balls}` : `${overs}`
    playerBowlSummary.set(playerId, `${agg.wickets}/${agg.runs} in ${oversStr} ov`)
  }

  if (playerPoints.size === 0) return null

  // Winner = highest points
  let bestId = ""
  let bestPts = -Infinity
  for (const [pid, pts] of playerPoints.entries()) {
    if (pts > bestPts) {
      bestPts = pts
      bestId = pid
    }
  }

  if (!bestId) return null

  return {
    playerId: bestId,
    playerName: playerNames.get(bestId) ?? bestId,
    teamName: playerTeam.get(bestId) ?? "",
    battingSummary: playerBatSummary.get(bestId) ?? null,
    bowlingSummary: playerBowlSummary.get(bestId) ?? null,
    points: bestPts,
  }
}

import { nanoid } from "nanoid"
import type {
  Ball,
  BowlerEntry,
  Innings,
  MatchRules,
  DismissalType,
  ExtraType,
  Partnership,
  ExtrasBreakdown,
} from "@/types/cricket"
import {
  BOWLER_CREDITED,
} from "@/types/cricket"

// ─── Over display helpers ─────────────────────────────────────────────────────

/** Format legal delivery count as "16.3" (NOT decimal math) */
export function formatOvers(legalBalls: number, ballsPerOver = 6): string {
  const overs = Math.floor(legalBalls / ballsPerOver)
  const balls = legalBalls % ballsPerOver
  return balls === 0 ? `${overs}` : `${overs}.${balls}`
}

/** Parse "16.3" back to total legal balls */
export function parsedOvers(oversStr: string, ballsPerOver = 6): number {
  const [o, b = "0"] = oversStr.split(".")
  return (parseInt(o) || 0) * ballsPerOver + (parseInt(b) || 0)
}

// ─── Delivery classification ──────────────────────────────────────────────────

export function isLegalDelivery(ball: Ball, rules: MatchRules): boolean {
  if (!ball.isExtra) return true
  if (ball.extraType === "wide" && rules.wideReball) return false
  if (ball.extraType === "noBall" && rules.noBallReball) return false
  return true
}

export function isOverComplete(
  ballLog: Ball[],
  currentOverNumber: number,
  rules: MatchRules
): boolean {
  const legalInOver = ballLog.filter(
    (b) => b.overNumber === currentOverNumber && b.isLegal
  ).length
  return legalInOver >= rules.ballsPerOver
}

// ─── Run/credit classification ────────────────────────────────────────────────

/** Runs credited to batsman for this delivery */
export function getBatsmanRuns(ball: Ball): number {
  if (ball.extraType === "bye" || ball.extraType === "legBye") return 0
  if (ball.extraType === "wide") return 0
  return ball.batsmanRuns
}

/** Runs conceded by bowler */
export function getBowlerRuns(ball: Ball): number {
  // Byes and leg-byes don't count against bowler
  if (ball.extraType === "bye" || ball.extraType === "legBye") return 0
  return ball.runs
}

/** Runs to extras bucket */
export function getExtraRuns(ball: Ball): ExtrasBreakdown {
  const base: ExtrasBreakdown = { wide: 0, noBall: 0, bye: 0, legBye: 0, penalty: 0, total: 0 }
  if (!ball.isExtra) return base
  const total = ball.extraRuns
  switch (ball.extraType) {
    case "wide":          return { ...base, wide: total, total }
    case "noBall":        return { ...base, noBall: ball.extraRuns, total }
    case "bye":           return { ...base, bye: total, total }
    case "legBye":        return { ...base, legBye: total, total }
    case "penaltyBatting":return { ...base, penalty: total, total }
    case "penaltyBowling":return { ...base, penalty: total, total }
    default:              return base
  }
}

// ─── Strike rotation ──────────────────────────────────────────────────────────

/**
 * Determine whether strike should rotate after this delivery.
 * Strike changes on odd *completed* (physically run) deliveries:
 * - Bye / Leg-bye: all extraRuns were physically run → use extraRuns
 * - Wide: the penalty run is credited automatically (no physical crossing);
 *   only additional running counts → use extraRuns − wideRunPenalty
 * - No-ball: only the batsman's physical runs count; NB penalty is automatic
 * - Normal: batsmanRuns
 */
export function shouldSwapStrikeAfterBall(ball: Ball, wideRunPenalty = 1): boolean {
  switch (ball.extraType) {
    case "bye":
    case "legBye":
      return ball.extraRuns % 2 === 1
    case "wide":
      return Math.max(0, ball.extraRuns - wideRunPenalty) % 2 === 1
    case "noBall":
      return ball.batsmanRuns % 2 === 1
    default:
      return ball.batsmanRuns % 2 === 1
  }
}

export function shouldSwapStrikeEndOfOver(): boolean {
  return true // always swap at end of over
}

// ─── Maiden over ──────────────────────────────────────────────────────────────

export function isMaidenOver(ballsInOver: Ball[]): boolean {
  if (!ballsInOver.every((b) => b.isLegal)) return false // not all legal yet
  const runsOff = ballsInOver.reduce((acc, b) => {
    // Maidens: 0 runs off bat AND no wides/no-balls
    return acc + getBowlerRuns(b)
  }, 0)
  return runsOff === 0
}

// ─── Bowler eligibility ───────────────────────────────────────────────────────

export function canBowl(
  bowlerId: string,
  currentBowlerId: string,
  oversBowledByPlayer: Record<string, number>,
  rules: MatchRules
): boolean {
  // Can't bowl consecutive overs
  if (bowlerId === currentBowlerId) return false
  // Check max overs per bowler
  if (rules.maxOversPerBowler !== null) {
    const bowledSoFar = oversBowledByPlayer[bowlerId] ?? 0
    if (bowledSoFar >= rules.maxOversPerBowler) return false
  }
  return true
}

export function getOversBowledByPlayer(ballLog: Ball[], ballsPerOver: number): Record<string, number> {
  // Single pass: count legal balls per bowler per over
  const legalByBowlerOver: Record<string, Record<number, number>> = {}
  for (const ball of ballLog) {
    if (!ball.isLegal) continue
    if (!legalByBowlerOver[ball.bowlerId]) {
      legalByBowlerOver[ball.bowlerId] = {}
    }
    const byOver = legalByBowlerOver[ball.bowlerId]
    byOver[ball.overNumber] = (byOver[ball.overNumber] ?? 0) + 1
  }
  // Count completed overs per bowler
  const result: Record<string, number> = {}
  for (const [bowlerId, byOver] of Object.entries(legalByBowlerOver)) {
    result[bowlerId] = Object.values(byOver).filter((c) => c >= ballsPerOver).length
  }
  return result
}

// ─── Innings completion check ─────────────────────────────────────────────────

export function isInningsComplete(innings: Innings, rules: MatchRules): boolean {
  if (innings.isDeclared) return true
  // Chase complete — target reached
  if (innings.target !== undefined && innings.totalRuns >= innings.target) return true
  // All out (max wickets reached)
  if (innings.totalWickets >= rules.maxWickets) return true
  // Last man stands — need at least 1 batter remaining
  if (!rules.lastManStands && innings.totalWickets >= rules.maxWickets - 1) {
    const activeBatsmen = innings.battingCard.filter(
      (b) => !b.isOut && !b.isRetiredHurt
    )
    if (activeBatsmen.length < 2) return true
  }
  // Overs complete — use pre-computed counter when available, fallback to scan
  if (rules.oversPerInnings !== null) {
    const legalBalls = innings.totalLegalDeliveries > 0
      ? innings.totalLegalDeliveries
      : innings.ballLog.filter((b) => b.isLegal).length
    if (legalBalls >= rules.oversPerInnings * rules.ballsPerOver) return true
  }
  return false
}

// ─── Target / required run rate ───────────────────────────────────────────────

export function getTarget(innings: Innings): number {
  return innings.totalRuns + 1
}

export function getRemainingBalls(
  currentInnings: Innings,
  rules: MatchRules
): number | null {
  if (!rules.oversPerInnings) return null
  const totalBalls = rules.oversPerInnings * rules.ballsPerOver
  const legalBalls = currentInnings.totalLegalDeliveries > 0
    ? currentInnings.totalLegalDeliveries
    : currentInnings.ballLog.filter((b) => b.isLegal).length
  return Math.max(0, totalBalls - legalBalls)
}

export function getRequiredRunRate(needed: number, ballsRemaining: number, ballsPerOver = 6): number {
  if (ballsRemaining <= 0) return Infinity
  return (needed / ballsRemaining) * ballsPerOver
}

export function getCurrentRunRate(runs: number, legalBalls: number, ballsPerOver = 6): number {
  if (legalBalls === 0) return 0
  return (runs / legalBalls) * ballsPerOver
}

// ─── Partnership calculation ──────────────────────────────────────────────────

export function getCurrentPartnership(
  ballLog: Ball[],
  batsman1Id: string,
  batsman2Id: string,
  wicketNumber: number,
  inningsScore: number
): Partnership {
  const partnershipBalls = ballLog.filter(
    (b) => b.batsmanId === batsman1Id || b.batsmanId === batsman2Id
  )
  const runs = partnershipBalls.reduce((sum, b) => sum + b.runs, 0)
  const b1Runs = partnershipBalls
    .filter((b) => b.batsmanId === batsman1Id)
    .reduce((sum, b) => sum + getBatsmanRuns(b), 0)
  const b2Runs = partnershipBalls
    .filter((b) => b.batsmanId === batsman2Id)
    .reduce((sum, b) => sum + getBatsmanRuns(b), 0)
  const balls = partnershipBalls.filter((b) => b.isLegal).length

  return {
    batsman1Id,
    batsman2Id,
    runs,
    balls,
    batsman1Runs: b1Runs,
    batsman2Runs: b2Runs,
    startScore: inningsScore - runs,
    endScore: inningsScore,
    wicketNumber,
  }
}

// ─── Dismissal text builder ───────────────────────────────────────────────────

export function buildDismissalText(
  type: DismissalType,
  bowlerName: string,
  fielderName?: string
): string {
  switch (type) {
    case "bowled":          return `b ${bowlerName}`
    case "caught":          return `c ${fielderName ?? "?"} b ${bowlerName}`
    case "caughtAndBowled": return `c & b ${bowlerName}`
    case "lbw":             return `lbw b ${bowlerName}`
    case "stumped":         return `st ${fielderName ?? "?"} b ${bowlerName}`
    case "hitWicket":       return `hit wicket b ${bowlerName}`
    case "runOut":          return fielderName ? `run out (${fielderName})` : "run out"
    case "retiredHurt":     return "retired hurt"
    case "retiredOut":      return "retired out"
    case "obstructingField":return "obstructing the field"
    case "hitBallTwice":    return "hit ball twice"
    case "timedOut":        return "timed out"
    case "handledBall":     return "handled ball"
    default:                return "out"
  }
}

// ─── Ball factory ─────────────────────────────────────────────────────────────

export interface BallInput {
  inningsIndex: number
  overNumber: number
  deliveryNumber: number
  batsmanId: string
  bowlerId: string
  runs: number
  batsmanRuns: number
  isExtra: boolean
  extraType?: ExtraType
  extraRuns: number
  isWicket: boolean
  dismissalType?: DismissalType
  dismissedPlayerId?: string
  fielderId?: string
  dismissalText?: string
  isFreeHit: boolean
  nextIsFreeHit: boolean
  isNoBallBatRuns: boolean
  wagonZone?: number
  powerplay: boolean
  rules: MatchRules
  ballLog: Ball[]  // for computing ballInOver
}

export function createBall(input: BallInput): Ball {
  const legalInOverSoFar = input.ballLog.filter(
    (b) => b.overNumber === input.overNumber && b.isLegal
  ).length

  const ball: Ball = {
    id: nanoid(),
    inningsIndex: input.inningsIndex,
    overNumber: input.overNumber,
    ballInOver: legalInOverSoFar, // position of THIS legal delivery (0-indexed)
    deliveryNumber: input.deliveryNumber,
    batsmanId: input.batsmanId,
    bowlerId: input.bowlerId,
    runs: input.runs,
    batsmanRuns: input.batsmanRuns,
    extraRuns: input.extraRuns,
    isExtra: input.isExtra,
    extraType: input.extraType,
    isLegal: !input.isExtra || (input.extraType !== "wide" && input.extraType !== "noBall"),
    isWicket: input.isWicket,
    dismissalType: input.dismissalType,
    dismissedPlayerId: input.dismissedPlayerId,
    fielderId: input.fielderId,
    dismissalText: input.dismissalText,
    isFreeHit: input.isFreeHit,
    nextIsFreeHit: input.nextIsFreeHit,
    isNoBallBatRuns: input.isNoBallBatRuns,
    wagonZone: input.wagonZone,
    powerplay: input.powerplay,
    timestamp: new Date(),
  }

  // Override isLegal if wide/NB with reball rules
  ball.isLegal = isLegalDelivery(ball, input.rules)

  return ball
}

// ─── Scorecard builders ───────────────────────────────────────────────────────

export function computeBowlerEntry(
  playerId: string,
  playerName: string,
  ballLog: Ball[],
  ballsPerOver: number
): BowlerEntry {
  const myBalls = ballLog.filter((b) => b.bowlerId === playerId)
  const legalBalls = myBalls.filter((b) => b.isLegal)
  const completedOvers = Math.floor(legalBalls.length / ballsPerOver)
  const remainderBalls = legalBalls.length % ballsPerOver

  // Compute maidens
  const overNums = [...new Set(myBalls.map((b) => b.overNumber))]
  let maidens = 0
  for (const ov of overNums) {
    const overBalls = myBalls.filter((b) => b.overNumber === ov)
    const legalCount = overBalls.filter((b) => b.isLegal).length
    if (legalCount === ballsPerOver && isMaidenOver(overBalls)) maidens++
  }

  const runs = myBalls.reduce((sum, b) => sum + getBowlerRuns(b), 0)
  const wickets = myBalls.filter(
    (b) => b.isWicket && b.dismissalType && BOWLER_CREDITED.includes(b.dismissalType)
  ).length
  return {
    playerId,
    playerName,
    overs: completedOvers,
    balls: remainderBalls,
    maidens,
    runs,
    wickets,
    economy: legalBalls.length > 0 ? (runs / legalBalls.length) * ballsPerOver : 0,
    dots: myBalls.filter((b) => b.isLegal && getBowlerRuns(b) === 0 && !b.isWicket).length,
    wides: myBalls.filter((b) => b.extraType === "wide").length,
    noBalls: myBalls.filter((b) => b.extraType === "noBall").length,
    legalDeliveries: legalBalls.length,
  }
}

// ─── Powerplay helper ─────────────────────────────────────────────────────────

export function isInPowerplay(overNumber: number, rules: MatchRules): boolean {
  if (!rules.powerplayEnabled) return false
  return overNumber < rules.powerplayOvers
}

// ─── Super over check ──────────────────────────────────────────────────────────

export function isTied(team1Runs: number, team2Runs: number): boolean {
  return team1Runs === team2Runs
}

// ─── Result string builder ────────────────────────────────────────────────────

export function buildResultString(
  winnerName: string,
  _loserName: string,
  winnerBattedFirst: boolean,
  winnerRuns: number,
  loserRuns: number,
  remainingWickets: number,
  remainingBalls: number,
  ballsPerOver: number
): string {
  if (winnerBattedFirst) {
    return `${winnerName} won by ${winnerRuns - loserRuns} run${winnerRuns - loserRuns !== 1 ? "s" : ""}`
  }
  return `${winnerName} won by ${remainingWickets} wicket${remainingWickets !== 1 ? "s" : ""}` +
    (remainingBalls > 0 ? ` (${formatOvers(remainingBalls, ballsPerOver)} ov remaining)` : "")
}

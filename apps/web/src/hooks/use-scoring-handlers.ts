import { useCallback } from "react"
import type { NavigateFn } from "@tanstack/react-router"
import { useScoringStore } from "@/stores/scoring"
import {
  createBall,
  isInningsComplete,
  buildDismissalText,
} from "@/lib/cricket-engine"
import { updatePlayerStatsFromMatch } from "@/lib/stats-calculator"
import { logError } from "@/lib/error-log"
import { db } from "@/db/index"
import { WICKET_DISMISSALS } from "@/types/cricket"
import type { Ball, DismissalType, Innings, Match, MatchRules, Player, BowlerEntry } from "@/types/cricket"
import { getRemainingBalls, formatOvers } from "@/lib/cricket-engine"

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScoringContext {
  match: Match
  innings: Innings
  rules: MatchRules
  currentInningsIndex: number
  currentOver: number
  onStrikeBatsmanId: string | null
  offStrikeBatsmanId: string | null
  currentBowlerId: string | null
  isFreeHit: boolean
  isProcessing: boolean
  isPowerplay: boolean
  isSecondInnings: boolean
  prevInnings: Innings | undefined
  battingTeamName: string
  allPlayers: Player[]
  currentBowler: BowlerEntry | undefined
}

interface ScoringUIActions {
  haptic: () => void
  navigate: NavigateFn
  triggerFlash: (type: "boundary" | "six" | "wicket") => void
  setShowWicketDialog: (v: boolean) => void
  setShowNewBowlerSheet: (v: boolean) => void
  setShowNewBatsmanSheet: (v: boolean) => void
  setShowInningsEndDialog: (v: boolean) => void
  setShowMatchEndDialog: (v: boolean) => void
}

// ─── Delivery number helper ────────────────────────────────────────────────────

function getNextDeliveryNumber(ballLog: Ball[]): number {
  if (ballLog.length === 0) return 0
  return (ballLog[ballLog.length - 1]?.deliveryNumber ?? -1) + 1
}

// ─── useScoringHandlers ────────────────────────────────────────────────────────

export function useScoringHandlers(ctx: ScoringContext, ui: ScoringUIActions) {
  const { recordBall, undoLastBall } = useScoringStore()

  // ── Fresh post-ball check (reads store directly to avoid stale closure) ──────

  function checkPostBall() {
    const latestState = useScoringStore.getState()
    const latestMatch = latestState.match
    if (!latestMatch) return
    const latestIdx = latestState.currentInningsIndex
    const latestInnings = latestMatch.innings[latestIdx]
    if (!latestInnings) return

    if (isInningsComplete(latestInnings, ctx.rules)) {
      const totalInnings = (ctx.rules.inningsPerSide ?? 1) * 2
      const isLastInnings = latestIdx >= totalInnings - 1
      if (isLastInnings) {
        ui.setShowMatchEndDialog(true)
      } else {
        ui.setShowInningsEndDialog(true)
      }
      return
    }

    if (latestState.currentBowlerId === null) {
      ui.setShowNewBowlerSheet(true)
    }
  }

  // ── Ball input builder ────────────────────────────────────────────────────────

  function buildCoreBallInput(overrides: Partial<Parameters<typeof createBall>[0]>) {
    return {
      inningsIndex: ctx.currentInningsIndex,
      overNumber: ctx.currentOver,
      deliveryNumber: getNextDeliveryNumber(ctx.innings.ballLog),
      batsmanId: ctx.onStrikeBatsmanId ?? "",
      bowlerId: ctx.currentBowlerId ?? "",
      runs: 0,
      batsmanRuns: 0,
      isExtra: false,
      extraRuns: 0,
      isWicket: false,
      isFreeHit: ctx.isFreeHit,
      nextIsFreeHit: false,
      isNoBallBatRuns: false,
      powerplay: ctx.isPowerplay,
      rules: ctx.rules,
      ballLog: ctx.innings.ballLog,
      ...overrides,
    }
  }

  // ── Run handler ───────────────────────────────────────────────────────────────

  const handleRun = useCallback(
    async (runs: number) => {
      if (!ctx.onStrikeBatsmanId || !ctx.currentBowlerId || ctx.isProcessing) return
      ui.haptic()
      const ball = createBall(buildCoreBallInput({ runs, batsmanRuns: runs }))
      await recordBall(ball)
      if (runs === 4) ui.triggerFlash("boundary")
      else if (runs === 6) ui.triggerFlash("six")
      checkPostBall()
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ctx.onStrikeBatsmanId, ctx.currentBowlerId, ctx.isProcessing, ctx.isFreeHit, ctx.currentOver, ctx.innings]
  )

  // ── Wide handler ──────────────────────────────────────────────────────────────

  async function handleWide(extraRuns: number) {
    if (!ctx.onStrikeBatsmanId || !ctx.currentBowlerId || ctx.isProcessing) return
    ui.haptic()
    const wideRuns = ctx.rules.wideRuns + extraRuns
    const ball = createBall(buildCoreBallInput({
      runs: wideRuns, batsmanRuns: 0, isExtra: true,
      extraType: "wide", extraRuns: wideRuns,
    }))
    await recordBall(ball)
    checkPostBall()
  }

  // ── No-ball handler ───────────────────────────────────────────────────────────

  async function handleNoBall(batRuns: number) {
    if (!ctx.onStrikeBatsmanId || !ctx.currentBowlerId || ctx.isProcessing) return
    ui.haptic()
    const nbRuns = ctx.rules.noBallRuns
    const totalRuns = nbRuns + batRuns
    const ball = createBall(buildCoreBallInput({
      runs: totalRuns, batsmanRuns: batRuns, isExtra: true,
      extraType: "noBall", extraRuns: nbRuns,
      isNoBallBatRuns: batRuns > 0,
      nextIsFreeHit: ctx.rules.freeHitOnNoBall,
    }))
    await recordBall(ball)
    checkPostBall()
  }

  // ── Bye / leg-bye handler ─────────────────────────────────────────────────────

  async function handleBye(runs: number, isLegBye: boolean) {
    if (!ctx.onStrikeBatsmanId || !ctx.currentBowlerId || ctx.isProcessing) return
    ui.haptic()
    const ball = createBall(buildCoreBallInput({
      runs, batsmanRuns: 0, isExtra: true,
      extraType: isLegBye ? "legBye" : "bye",
      extraRuns: runs,
    }))
    await recordBall(ball)
    checkPostBall()
  }

  // ── Overthrow handler ─────────────────────────────────────────────────────────

  async function handleOverthrow(totalRuns: number) {
    if (!ctx.onStrikeBatsmanId || !ctx.currentBowlerId || ctx.isProcessing) return
    ui.haptic()
    const ball = createBall(buildCoreBallInput({ runs: totalRuns, batsmanRuns: totalRuns }))
    ball.overthrows = totalRuns
    await recordBall(ball)
    ui.triggerFlash("boundary")
    checkPostBall()
  }

  // ── Wicket handler ────────────────────────────────────────────────────────────

  async function handleWicketConfirm(data: {
    dismissalType: DismissalType
    dismissedPlayerId: string
    fielderId?: string
  }) {
    if (!ctx.onStrikeBatsmanId || !ctx.currentBowlerId || ctx.isProcessing) return
    ui.setShowWicketDialog(false)
    ui.haptic()

    const fielderPlayer = data.fielderId
      ? ctx.allPlayers.find((p) => p.id === data.fielderId)
      : undefined
    const dismissalText = buildDismissalText(
      data.dismissalType,
      ctx.currentBowler?.playerName ?? "",
      fielderPlayer?.name
    )
    const isCountedWicket = WICKET_DISMISSALS.includes(data.dismissalType)

    const ball = createBall(buildCoreBallInput({
      runs: 0, batsmanRuns: 0, isExtra: false, extraRuns: 0,
      isWicket: true,
      dismissalType: data.dismissalType,
      dismissedPlayerId: data.dismissedPlayerId,
      fielderId: data.fielderId,
      dismissalText,
    }))

    await recordBall(ball)
    ui.triggerFlash("wicket")

    const latestState = useScoringStore.getState()
    const latestInnings = latestState.match?.innings[ctx.currentInningsIndex]

    if (latestInnings && isInningsComplete(latestInnings, ctx.rules)) {
      const totalInnings = (ctx.rules.inningsPerSide ?? 1) * 2
      const isLastInnings = ctx.currentInningsIndex >= totalInnings - 1
      if (isLastInnings) {
        ui.setShowMatchEndDialog(true)
      } else {
        ui.setShowInningsEndDialog(true)
      }
      return
    }

    if (isCountedWicket) ui.setShowNewBatsmanSheet(true)
    if (latestState.currentBowlerId === null) ui.setShowNewBowlerSheet(true)
  }

  // ── New bowler selected ───────────────────────────────────────────────────────

  async function handleNewBowlerSelect(playerId: string) {
    ui.haptic()
    const player = ctx.allPlayers.find((p) => p.id === playerId)
    if (!player) return

    const latestStore = useScoringStore.getState()
    const latestMatch = latestStore.match
    if (!latestMatch) return

    const targetInnings = latestMatch.innings[ctx.currentInningsIndex]
    const alreadyInCard = targetInnings.bowlingCard.some((e) => e.playerId === playerId)

    if (!alreadyInCard) {
      const updated = structuredClone(latestMatch)
      updated.innings[ctx.currentInningsIndex].bowlingCard.push({
        playerId: player.id,
        playerName: player.name,
        overs: 0, balls: 0, maidens: 0, runs: 0, wickets: 0,
        economy: 0, dots: 0, wides: 0, noBalls: 0, legalDeliveries: 0,
      })
      await db.matches.put(updated)
      useScoringStore.setState({ match: updated, currentBowlerId: playerId })
    } else {
      useScoringStore.setState({ currentBowlerId: playerId })
    }

    ui.setShowNewBowlerSheet(false)
  }

  // ── New batsman selected ──────────────────────────────────────────────────────

  async function handleNewBatsmanSelect(playerId: string) {
    ui.haptic()
    const player = ctx.allPlayers.find((p) => p.id === playerId)
    if (!player) return

    const latestStore = useScoringStore.getState()
    const latestMatch = latestStore.match
    if (!latestMatch) return

    const targetInnings = latestMatch.innings[ctx.currentInningsIndex]
    const alreadyInCard = targetInnings.battingCard.some((e) => e.playerId === playerId)

    const updated = structuredClone(latestMatch)
    if (!alreadyInCard) {
      updated.innings[ctx.currentInningsIndex].battingCard.push({
        playerId: player.id,
        playerName: player.name,
        position: targetInnings.battingCard.length + 1,
        runs: 0, balls: 0, fours: 0, sixes: 0, dots: 0, strikeRate: 0,
        isOut: false, isRetiredHurt: false,
        dismissalText: "not out",
        comeInOver: ctx.currentOver,
        comeInScore: targetInnings.totalRuns,
      })
    }

    await db.matches.put(updated)
    useScoringStore.setState({ match: updated, onStrikeBatsmanId: playerId })
    ui.setShowNewBatsmanSheet(false)

    if (latestStore.currentBowlerId === null) {
      ui.setShowNewBowlerSheet(true)
    }
  }

  // ── Start next innings ────────────────────────────────────────────────────────

  async function handleStartNextInnings() {
    ui.setShowInningsEndDialog(false)

    const newInningsIndex = ctx.currentInningsIndex + 1
    const newBattingTeamId =
      ctx.innings.battingTeamId === ctx.match.team1Id ? ctx.match.team2Id : ctx.match.team1Id
    const newBowlingTeamId = ctx.innings.battingTeamId

    const updated = structuredClone(ctx.match)
    updated.currentInningsIndex = newInningsIndex
    updated.innings.push({
      index: newInningsIndex,
      battingTeamId: newBattingTeamId,
      bowlingTeamId: newBowlingTeamId,
      status: "live",
      totalRuns: 0,
      totalWickets: 0,
      totalOvers: 0,
      totalBalls: 0,
      totalLegalDeliveries: 0,
      extras: { wide: 0, noBall: 0, bye: 0, legBye: 0, penalty: 0, total: 0 },
      battingCard: [],
      bowlingCard: [],
      fallOfWickets: [],
      partnerships: [],
      ballLog: [],
      target: ctx.innings.totalRuns + 1,
      isDeclared: false,
    })
    updated.innings[ctx.currentInningsIndex].status = "completed"

    await db.matches.put(updated)
    useScoringStore.setState({
      match: updated,
      currentInningsIndex: newInningsIndex,
      onStrikeBatsmanId: null,
      offStrikeBatsmanId: null,
      currentBowlerId: null,
      isFreeHit: false,
      overBalls: [],
      lastOverBalls: [],
      lastOverSummary: "",
      oversBowledByBowler: {},
    })

    ui.setShowNewBatsmanSheet(true)
  }

  // ── End match ─────────────────────────────────────────────────────────────────

  async function handleEndMatch() {
    ui.setShowMatchEndDialog(false)

    // Read fresh state — ctx.match may be 1 ball behind if the final ball
    // triggered this dialog via checkPostBall's async recordBall call.
    const freshState = useScoringStore.getState()
    const freshMatch = freshState.match
    if (!freshMatch) return
    const freshInningsIdx = freshState.currentInningsIndex
    const freshInnings = freshMatch.innings[freshInningsIdx]
    if (!freshInnings) return

    const updated = structuredClone(freshMatch)
    updated.innings[freshInningsIdx].status = "completed"
    updated.status = "completed"

    let resultStr = ""
    let winnerId: string | undefined

    const isSecondInnings = freshInningsIdx > 0
    const prevInnings = isSecondInnings ? freshMatch.innings[freshInningsIdx - 1] : undefined

    if (isSecondInnings && prevInnings) {
      const team2Runs = freshInnings.totalRuns
      const team1Runs = prevInnings.totalRuns

      if (team2Runs > team1Runs) {
        const wicketsLeft = ctx.rules.maxWickets - freshInnings.totalWickets
        const ballsLeft = getRemainingBalls(freshInnings, ctx.rules)
        winnerId = freshInnings.battingTeamId
        const winnerName =
          freshInnings.battingTeamId === freshMatch.team1Id ? freshMatch.team1Name : freshMatch.team2Name
        resultStr = `${winnerName} won by ${wicketsLeft} wicket${wicketsLeft !== 1 ? "s" : ""}${
          ballsLeft ? ` (${formatOvers(ballsLeft, ctx.rules.ballsPerOver)} ov remaining)` : ""
        }`
      } else if (team1Runs > team2Runs) {
        winnerId = prevInnings.battingTeamId
        const winnerName =
          prevInnings.battingTeamId === freshMatch.team1Id ? freshMatch.team1Name : freshMatch.team2Name
        resultStr = `${winnerName} won by ${team1Runs - team2Runs} run${team1Runs - team2Runs !== 1 ? "s" : ""}`
      } else {
        resultStr = "Match tied"
        winnerId = "tie"
      }
    } else {
      const battingName =
        freshInnings.battingTeamId === freshMatch.team1Id ? freshMatch.team1Name : freshMatch.team2Name
      resultStr = `Innings complete — ${battingName} scored ${freshInnings.totalRuns}/${freshInnings.totalWickets}`
    }

    updated.result = resultStr
    updated.winner = winnerId

    await db.matches.put(updated)

    try {
      await updatePlayerStatsFromMatch(updated)
    } catch (err) {
      logError("stats-update", err) // non-fatal; surfaced in Settings → Diagnostics
    }

    useScoringStore.getState().clearSession()
    ui.navigate({ to: `/scorecard/${freshMatch.id}` })
  }

  // ── Undo handler ──────────────────────────────────────────────────────────────

  async function handleUndo() {
    if (ctx.isProcessing) return
    ui.haptic()
    await undoLastBall()
    ui.setShowNewBowlerSheet(false)
    ui.setShowNewBatsmanSheet(false)
  }

  return {
    handleRun,
    handleWide,
    handleNoBall,
    handleBye,
    handleOverthrow,
    handleWicketConfirm,
    handleNewBowlerSelect,
    handleNewBatsmanSelect,
    handleStartNextInnings,
    handleEndMatch,
    handleUndo,
  }
}

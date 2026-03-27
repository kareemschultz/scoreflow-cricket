import { useState, useEffect, useCallback } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useLiveQuery } from "dexie-react-hooks"
import { RotateCcw } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

import { useScoringStore } from "@/stores/scoring"
import {
  createBall,
  isInPowerplay,
  isInningsComplete,
  getRemainingBalls,
  getRequiredRunRate,
  getCurrentRunRate,
  formatOvers,
  getOversBowledByPlayer,
  buildDismissalText,
  getCurrentPartnership,
} from "@/lib/cricket-engine"
import { useWakeLock } from "@/hooks/use-wake-lock"
import { useHaptic } from "@/hooks/use-haptic"
import { updatePlayerStatsFromMatch } from "@/lib/stats-calculator"
import { db } from "@/db/index"

import { ScoreHeader } from "@/components/scoring/ScoreHeader"
import { BatsmanCard } from "@/components/scoring/BatsmanCard"
import { BowlerCard } from "@/components/scoring/BowlerCard"
import { OverDisplay } from "@/components/scoring/OverDisplay"
import { FreeHitBanner } from "@/components/scoring/FreeHitBanner"
import { WicketDialog } from "@/components/scoring/WicketDialog"
import { NewBowlerSheet } from "@/components/scoring/NewBowlerSheet"
import { NewBatsmanSheet } from "@/components/scoring/NewBatsmanSheet"
import { PartnershipBar } from "@/components/scoring/PartnershipBar"
import { RunPickerDialog } from "@/components/scoring/RunPickerDialog"

import { Button } from "@workspace/ui/components/button"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@workspace/ui/components/alert-dialog"
import { cn } from "@workspace/ui/lib/utils"

import type { Ball, DismissalType, Player, BatsmanEntry, BowlerEntry } from "@/types/cricket"
import { WICKET_DISMISSALS } from "@/types/cricket"

// ─── helpers ──────────────────────────────────────────────────────────────────

function getNextDeliveryNumber(ballLog: Ball[]): number {
  if (ballLog.length === 0) return 0
  return (ballLog[ballLog.length - 1]?.deliveryNumber ?? -1) + 1
}

// ─── component ────────────────────────────────────────────────────────────────

function ScoringPage() {
  const navigate = useNavigate()
  const haptic = useHaptic()

  const {
    match,
    currentInningsIndex,
    onStrikeBatsmanId,
    offStrikeBatsmanId,
    currentBowlerId,
    isFreeHit,
    overBalls,
    lastOverSummary,
    isProcessing,
    recordBall,
    undoLastBall,
    swapStrike,
  } = useScoringStore()

  // Wake lock while on this screen
  useWakeLock(true)

  // Load all players for fielding team look-ups
  const allPlayers = useLiveQuery(async () => {
    if (!match) return []
    const [p1, p2] = await Promise.all([
      db.players.where("teamId").equals(match.team1Id).toArray(),
      db.players.where("teamId").equals(match.team2Id).toArray(),
    ])
    return [...p1, ...p2]
  }, [match?.id]) ?? []

  // ── dialog / sheet state ──────────────────────────────────────────────────
  const [showWicketDialog, setShowWicketDialog] = useState(false)
  const [showNewBowlerSheet, setShowNewBowlerSheet] = useState(false)
  const [showNewBatsmanSheet, setShowNewBatsmanSheet] = useState(false)
  const [showInningsEndDialog, setShowInningsEndDialog] = useState(false)
  const [showMatchEndDialog, setShowMatchEndDialog] = useState(false)
  const [widePickerOpen, setWidePickerOpen] = useState(false)
  const [nbPickerOpen, setNbPickerOpen] = useState(false)
  const [byePickerOpen, setByePickerOpen] = useState(false)
  const [lbPickerOpen, setLbPickerOpen] = useState(false)
  const [otPickerOpen, setOtPickerOpen] = useState(false)
  const [scoreFlash, setScoreFlash] = useState<"boundary" | "six" | "wicket" | null>(null)

  // Redirect if no live match
  useEffect(() => {
    if (!match && !isProcessing) {
      navigate({ to: "/" })
    }
  }, [match, isProcessing, navigate])

  if (!match) return null

  const innings = match.innings[currentInningsIndex]
  const rules = match.rules
  if (!innings) return null

  const isSecondInnings = currentInningsIndex > 0
  const currentOver = innings.totalOvers // completed overs count = current over index

  // Resolve current players from batting/bowling cards
  const striker: BatsmanEntry | undefined = innings.battingCard.find(
    (e) => e.playerId === onStrikeBatsmanId
  )
  const nonStriker: BatsmanEntry | undefined = innings.battingCard.find(
    (e) => e.playerId === offStrikeBatsmanId
  )
  const currentBowler: BowlerEntry | undefined = innings.bowlingCard.find(
    (e) => e.playerId === currentBowlerId
  )

  // Team names
  const battingTeamName =
    innings.battingTeamId === match.team1Id ? match.team1Name : match.team2Name
  const bowlingTeamId =
    innings.battingTeamId === match.team1Id ? match.team2Id : match.team1Id

  // Score string
  const scoreStr = `${innings.totalRuns}/${innings.totalWickets}`
  const oversStr = `(${formatOvers(innings.totalLegalDeliveries, rules.ballsPerOver)} ov)`

  // Run rates
  const crr = getCurrentRunRate(
    innings.totalRuns,
    innings.totalLegalDeliveries,
    rules.ballsPerOver
  ).toFixed(2)

  const ballsRem = getRemainingBalls(innings, rules)
  const prevInnings = isSecondInnings ? match.innings[currentInningsIndex - 1] : undefined
  const target = prevInnings ? prevInnings.totalRuns + 1 : undefined
  const needed = target !== undefined ? target - innings.totalRuns : undefined
  const rrr =
    ballsRem !== null && ballsRem > 0 && needed !== undefined
      ? getRequiredRunRate(needed, ballsRem, rules.ballsPerOver).toFixed(2)
      : undefined

  // Powerplay
  const isPowerplay = isInPowerplay(currentOver, rules)

  // Partnership
  const partnership =
    striker && nonStriker
      ? getCurrentPartnership(
          innings.ballLog,
          striker.playerId,
          nonStriker.playerId,
          innings.totalWickets,
          innings.totalRuns
        )
      : null

  // Available batsmen for new batsman sheet
  const playingXI: string[] =
    innings.battingTeamId === match.team1Id ? match.playingXI1 : match.playingXI2
  const availableBatsmen: Player[] = allPlayers.filter(
    (p) =>
      playingXI.includes(p.id) &&
      p.id !== onStrikeBatsmanId &&
      p.id !== offStrikeBatsmanId &&
      !innings.battingCard.find((e) => e.playerId === p.id && (e.isOut || e.isRetiredHurt))
  )

  // Bowler options for new bowler sheet
  const fieldingXI: string[] =
    bowlingTeamId === match.team1Id ? match.playingXI1 : match.playingXI2
  const currentOversMap = getOversBowledByPlayer(innings.ballLog, rules.ballsPerOver)
  const lastBowlerId =
    innings.ballLog.length > 0
      ? innings.ballLog[innings.ballLog.length - 1]?.bowlerId
      : null

  const bowlerOptions = allPlayers
    .filter((p) => fieldingXI.includes(p.id))
    .map((p) => {
      const oversBowled = currentOversMap[p.id] ?? 0
      const maxOvers = rules.maxOversPerBowler
      const isDisabledConsecutive = p.id === lastBowlerId
      const isDisabledMax = maxOvers !== null && oversBowled >= maxOvers
      return {
        player: p,
        oversBowled,
        maxOvers,
        isDisabled: isDisabledConsecutive || isDisabledMax,
      }
    })

  // Fielding team players for wicket dialog
  const fieldingTeamPlayers = allPlayers.filter((p) => fieldingXI.includes(p.id))

  // ── post-ball checks ──────────────────────────────────────────────────────

  function checkPostBall() {
    if (!match) return
    const latestInnings = match.innings[currentInningsIndex]
    if (!latestInnings) return

    // Check innings complete
    if (isInningsComplete(latestInnings, rules)) {
      const isLastInnings =
        currentInningsIndex >= match.innings.length - 1 ||
        (rules.inningsPerSide === 1 && currentInningsIndex >= 1)
      if (isLastInnings) {
        setShowMatchEndDialog(true)
      } else {
        setShowInningsEndDialog(true)
      }
      return
    }

    // Check if new bowler needed (over just ended)
    if (useScoringStore.getState().currentBowlerId === null) {
      setShowNewBowlerSheet(true)
    }
  }

  // ── ball construction helpers ─────────────────────────────────────────────

  function buildCoreBallInput(overrides: Partial<Parameters<typeof createBall>[0]>) {
    return {
      inningsIndex: currentInningsIndex,
      overNumber: currentOver,
      deliveryNumber: getNextDeliveryNumber(innings.ballLog),
      batsmanId: onStrikeBatsmanId ?? "",
      bowlerId: currentBowlerId ?? "",
      runs: 0,
      batsmanRuns: 0,
      isExtra: false,
      extraRuns: 0,
      isWicket: false,
      isFreeHit,
      nextIsFreeHit: false,
      isNoBallBatRuns: false,
      powerplay: isPowerplay,
      rules,
      ballLog: innings.ballLog,
      ...overrides,
    }
  }

  // ── run handler ───────────────────────────────────────────────────────────

  const handleRun = useCallback(
    async (runs: number) => {
      if (!onStrikeBatsmanId || !currentBowlerId || isProcessing) return
      haptic()
      const ball = createBall(
        buildCoreBallInput({
          runs,
          batsmanRuns: runs,
          isExtra: false,
          extraRuns: 0,
        })
      )
      await recordBall(ball)
      if (runs === 4) setScoreFlash("boundary")
      else if (runs === 6) setScoreFlash("six")
      checkPostBall()
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onStrikeBatsmanId, currentBowlerId, isProcessing, isFreeHit, currentOver, innings]
  )

  // ── wide handler ──────────────────────────────────────────────────────────

  async function handleWide(extraRuns: number) {
    if (!onStrikeBatsmanId || !currentBowlerId || isProcessing) return
    haptic()
    const wideRuns = rules.wideRuns + extraRuns
    const ball = createBall(
      buildCoreBallInput({
        runs: wideRuns,
        batsmanRuns: 0,
        isExtra: true,
        extraType: "wide",
        extraRuns: wideRuns,
      })
    )
    await recordBall(ball)
    checkPostBall()
  }

  // ── no-ball handler ───────────────────────────────────────────────────────

  async function handleNoBall(batRuns: number) {
    if (!onStrikeBatsmanId || !currentBowlerId || isProcessing) return
    haptic()
    const nbRuns = rules.noBallRuns
    const totalRuns = nbRuns + batRuns
    const ball = createBall(
      buildCoreBallInput({
        runs: totalRuns,
        batsmanRuns: batRuns,
        isExtra: true,
        extraType: "noBall",
        extraRuns: nbRuns,
        isNoBallBatRuns: batRuns > 0,
        nextIsFreeHit: rules.freeHitOnNoBall,
      })
    )
    await recordBall(ball)
    checkPostBall()
  }

  // ── bye / leg-bye handler ─────────────────────────────────────────────────

  async function handleBye(runs: number, isLegBye: boolean) {
    if (!onStrikeBatsmanId || !currentBowlerId || isProcessing) return
    haptic()
    const ball = createBall(
      buildCoreBallInput({
        runs,
        batsmanRuns: 0,
        isExtra: true,
        extraType: isLegBye ? "legBye" : "bye",
        extraRuns: runs,
      })
    )
    await recordBall(ball)
    checkPostBall()
  }

  // ── overthrow handler ─────────────────────────────────────────────────────

  async function handleOverthrow(totalRuns: number) {
    if (!onStrikeBatsmanId || !currentBowlerId || isProcessing) return
    haptic()
    const ball = createBall(
      buildCoreBallInput({
        runs: totalRuns,
        batsmanRuns: totalRuns,
        isExtra: false,
        extraRuns: 0,
      })
    )
    ball.overthrows = totalRuns
    await recordBall(ball)
    setScoreFlash("boundary")
    checkPostBall()
  }

  // ── wicket handler ────────────────────────────────────────────────────────

  async function handleWicketConfirm(data: {
    dismissalType: DismissalType
    dismissedPlayerId: string
    fielderId?: string
  }) {
    if (!onStrikeBatsmanId || !currentBowlerId || isProcessing) return
    setShowWicketDialog(false)
    haptic()

    const fielderPlayer = data.fielderId
      ? allPlayers.find((p) => p.id === data.fielderId)
      : undefined
    const bowlerName = currentBowler?.playerName ?? ""
    const dismissalText = buildDismissalText(
      data.dismissalType,
      bowlerName,
      fielderPlayer?.name
    )

    const isCountedWicket = WICKET_DISMISSALS.includes(data.dismissalType)

    const ball = createBall(
      buildCoreBallInput({
        runs: 0,
        batsmanRuns: 0,
        isExtra: false,
        extraRuns: 0,
        isWicket: true,
        dismissalType: data.dismissalType,
        dismissedPlayerId: data.dismissedPlayerId,
        fielderId: data.fielderId,
        dismissalText,
      })
    )
    await recordBall(ball)
    setScoreFlash("wicket")

    // After recording, check if innings is done
    const latestState = useScoringStore.getState()
    const latestInnings = latestState.match?.innings[currentInningsIndex]

    if (latestInnings && isInningsComplete(latestInnings, rules)) {
      const isLastInnings =
        currentInningsIndex >= (latestState.match?.innings.length ?? 1) - 1 ||
        (rules.inningsPerSide === 1 && currentInningsIndex >= 1)
      if (isLastInnings) {
        setShowMatchEndDialog(true)
      } else {
        setShowInningsEndDialog(true)
      }
      return
    }

    // If counted wicket and innings not complete — need new batsman
    if (isCountedWicket) {
      setShowNewBatsmanSheet(true)
    }

    // Also check if over ended
    if (latestState.currentBowlerId === null) {
      setShowNewBowlerSheet(true)
    }
  }

  // ── new bowler selected ───────────────────────────────────────────────────

  function handleNewBowlerSelect(playerId: string) {
    if (!match) return
    haptic()
    const player = allPlayers.find((p) => p.id === playerId)
    if (!player) return

    // Add to bowling card if not already there
    const latestStore = useScoringStore.getState()
    const latestMatch = latestStore.match
    if (!latestMatch) return

    const targetInnings = latestMatch.innings[currentInningsIndex]
    const alreadyInCard = targetInnings.bowlingCard.some((e) => e.playerId === playerId)

    if (!alreadyInCard) {
      const updated = JSON.parse(JSON.stringify(latestMatch))
      updated.innings[currentInningsIndex].bowlingCard.push({
        playerId: player.id,
        playerName: player.name,
        overs: 0,
        balls: 0,
        maidens: 0,
        runs: 0,
        wickets: 0,
        economy: 0,
        dots: 0,
        wides: 0,
        noBalls: 0,
        legalDeliveries: 0,
      })
      db.matches.put(updated)
      useScoringStore.setState({ match: updated, currentBowlerId: playerId })
    } else {
      useScoringStore.setState({ currentBowlerId: playerId })
    }

    setShowNewBowlerSheet(false)
  }

  // ── new batsman selected ──────────────────────────────────────────────────

  function handleNewBatsmanSelect(playerId: string) {
    if (!match) return
    haptic()
    const player = allPlayers.find((p) => p.id === playerId)
    if (!player) return

    const latestStore = useScoringStore.getState()
    const latestMatch = latestStore.match
    if (!latestMatch) return

    const targetInnings = latestMatch.innings[currentInningsIndex]
    const alreadyInCard = targetInnings.battingCard.some((e) => e.playerId === playerId)

    const updated = JSON.parse(JSON.stringify(latestMatch))
    if (!alreadyInCard) {
      updated.innings[currentInningsIndex].battingCard.push({
        playerId: player.id,
        playerName: player.name,
        position: targetInnings.battingCard.length + 1,
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        dots: 0,
        strikeRate: 0,
        isOut: false,
        isRetiredHurt: false,
        dismissalText: "not out",
        comeInOver: currentOver,
        comeInScore: targetInnings.totalRuns,
      })
    }

    db.matches.put(updated)
    useScoringStore.setState({
      match: updated,
      onStrikeBatsmanId: playerId,
    })

    setShowNewBatsmanSheet(false)

    // If also need new bowler (over ended on wicket ball)
    if (latestStore.currentBowlerId === null) {
      setShowNewBowlerSheet(true)
    }
  }

  // ── start 2nd innings ─────────────────────────────────────────────────────

  async function handleStartNextInnings() {
    if (!match) return
    setShowInningsEndDialog(false)

    const newInningsIndex = currentInningsIndex + 1
    const newBattingTeamId =
      innings.battingTeamId === match.team1Id ? match.team2Id : match.team1Id
    const newBowlingTeamId = innings.battingTeamId

    const updated = JSON.parse(JSON.stringify(match))
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
      ballLog: [],
      fallOfWickets: [],
      partnerships: [],
      target: innings.totalRuns + 1,
      isDeclared: false,
    })
    // Complete current innings
    updated.innings[currentInningsIndex].status = "completed"

    await db.matches.put(updated)
    useScoringStore.setState({
      match: updated,
      currentInningsIndex: newInningsIndex,
      onStrikeBatsmanId: null,
      offStrikeBatsmanId: null,
      currentBowlerId: null,
      isFreeHit: false,
      overBalls: [],
      lastOverSummary: "",
      oversBowledByBowler: {},
    })

    // Open new batsman sheet to pick openers
    setShowNewBatsmanSheet(true)
  }

  // ── end match ─────────────────────────────────────────────────────────────

  async function handleEndMatch() {
    if (!match) return
    setShowMatchEndDialog(false)

    const updated = JSON.parse(JSON.stringify(match))
    // Mark innings complete
    updated.innings[currentInningsIndex].status = "completed"
    updated.status = "completed"

    // Determine winner
    let resultStr = ""
    let winnerId: string | undefined

    if (isSecondInnings && prevInnings) {
      const team2Runs = updated.innings[currentInningsIndex].totalRuns
      const team1Runs = prevInnings.totalRuns

      if (team2Runs > team1Runs) {
        // Chasing team won
        const wicketsLeft =
          rules.maxWickets - updated.innings[currentInningsIndex].totalWickets
        const ballsLeft = getRemainingBalls(updated.innings[currentInningsIndex], rules)
        winnerId = innings.battingTeamId
        const winnerName =
          innings.battingTeamId === match.team1Id ? match.team1Name : match.team2Name
        resultStr = `${winnerName} won by ${wicketsLeft} wicket${wicketsLeft !== 1 ? "s" : ""}${
          ballsLeft ? ` (${formatOvers(ballsLeft, rules.ballsPerOver)} ov remaining)` : ""
        }`
      } else if (team1Runs > team2Runs) {
        // First batting team won
        winnerId = prevInnings.battingTeamId
        const winnerName =
          prevInnings.battingTeamId === match.team1Id ? match.team1Name : match.team2Name
        resultStr = `${winnerName} won by ${team1Runs - team2Runs} run${team1Runs - team2Runs !== 1 ? "s" : ""}`
      } else {
        resultStr = "Match tied"
        winnerId = "tie"
      }
    } else {
      // First innings ended (all out / overs done)
      const runsScored = updated.innings[currentInningsIndex].totalRuns
      resultStr = `Innings complete — ${battingTeamName} scored ${runsScored}/${updated.innings[currentInningsIndex].totalWickets}`
    }

    updated.result = resultStr
    updated.winner = winnerId

    await db.matches.put(updated)

    // Update player stats
    try {
      await updatePlayerStatsFromMatch(updated)
    } catch {
      // Non-fatal
    }

    useScoringStore.getState().clearSession()
    navigate({ to: `/scorecard/${match.id}` })
  }

  // ── undo handler ─────────────────────────────────────────────────────────

  async function handleUndo() {
    if (isProcessing) return
    haptic()
    await undoLastBall()
    // Close any open sheets in case undo resolves them
    setShowNewBowlerSheet(false)
    setShowNewBatsmanSheet(false)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Guard: need striker + bowler to score
  // ─────────────────────────────────────────────────────────────────────────

  const canScore = !!onStrikeBatsmanId && !!currentBowlerId && !isProcessing

  // ── Result text for match end dialog ──────────────────────────────────────
  const inningsEndMsg = `${battingTeamName} scored ${innings.totalRuns}/${innings.totalWickets} in ${formatOvers(innings.totalLegalDeliveries, rules.ballsPerOver)} overs.`

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background select-none">

      {/* ── Score flash overlay ── */}
      <AnimatePresence>
        {scoreFlash && (
          <motion.div
            key={scoreFlash}
            className={cn(
              "fixed inset-0 z-[100] pointer-events-none",
              scoreFlash === "boundary" && "bg-emerald-500/20",
              scoreFlash === "six" && "bg-amber-500/20",
              scoreFlash === "wicket" && "bg-red-500/20"
            )}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onAnimationComplete={() => setTimeout(() => setScoreFlash(null), 100)}
          />
        )}
      </AnimatePresence>

      {/* ── Score header ── */}
      <ScoreHeader
        battingTeamName={battingTeamName}
        score={scoreStr}
        overs={oversStr}
        crr={crr}
        rrr={rrr}
        target={target}
        needed={needed ?? undefined}
        ballsRemaining={ballsRem ?? undefined}
        isPowerplay={isPowerplay}
        powerplayOversTotal={rules.powerplayOvers}
        currentOver={currentOver}
      />

      {/* ── Batsman cards ── */}
      <div className="border-b border-border/50">
        {striker ? (
          <BatsmanCard
            batsman={striker}
            isOnStrike={true}
            onSwapStrike={nonStriker ? swapStrike : undefined}
          />
        ) : (
          <div className="px-3 py-2 text-sm text-muted-foreground italic">
            Waiting for batsman...
          </div>
        )}
        {nonStriker ? (
          <BatsmanCard
            batsman={nonStriker}
            isOnStrike={false}
            onSwapStrike={striker ? swapStrike : undefined}
          />
        ) : (
          <div className="px-3 py-1.5 text-xs text-muted-foreground italic">
            Non-striker not set
          </div>
        )}
      </div>

      {/* ── Partnership ── */}
      {partnership && (
        <PartnershipBar
          runs={partnership.runs}
          balls={partnership.balls}
          batsman1Runs={partnership.batsman1Runs}
          batsman2Runs={partnership.batsman2Runs}
        />
      )}

      {/* ── Bowler card ── */}
      {currentBowler ? (
        <BowlerCard bowler={currentBowler} />
      ) : !currentBowlerId ? (
        <div className="px-3 py-1.5 border-b border-border/50 text-xs text-muted-foreground italic bg-muted/10">
          Tap "New Over" to select a bowler
        </div>
      ) : null}

      {/* ── Over display ── */}
      <OverDisplay balls={overBalls} lastOverSummary={lastOverSummary} />

      {/* ── Free hit banner ── */}
      {isFreeHit && <FreeHitBanner />}

      {/* ── Scoring buttons ── */}
      <div className="flex-1 flex flex-col justify-end px-2 pb-2 gap-1.5 pt-1.5">

        {/* Run buttons 0–3 */}
        <div className="grid grid-cols-4 gap-1.5">
          {[0, 1, 2, 3].map((r) => (
            <motion.button
              key={r}
              disabled={!canScore}
              onClick={() => handleRun(r)}
              whileTap={{ scale: 0.92 }}
              className={cn(
                "h-14 rounded-xl border font-bold text-lg transition-all active:scale-95",
                "bg-muted/40 border-border text-foreground",
                "hover:bg-muted/70 disabled:opacity-40 disabled:pointer-events-none"
              )}
            >
              {r}
            </motion.button>
          ))}
        </div>

        {/* 4 and 6 */}
        <div className="grid grid-cols-2 gap-1.5">
          <motion.button
            disabled={!canScore}
            onClick={() => handleRun(4)}
            whileTap={{ scale: 0.92 }}
            className={cn(
              "h-16 rounded-xl border font-bold text-2xl transition-all active:scale-95",
              "bg-cricket-btn-boundary-bg border-cricket-boundary/60 text-cricket-btn-boundary-fg",
              "dark:bg-cricket-boundary/20 dark:text-cricket-boundary dark:border-cricket-boundary/40",
              "hover:brightness-95 disabled:opacity-40 disabled:pointer-events-none"
            )}
          >
            4
          </motion.button>
          <motion.button
            disabled={!canScore}
            onClick={() => handleRun(6)}
            whileTap={{ scale: 0.92 }}
            className={cn(
              "h-16 rounded-xl border font-bold text-2xl transition-all active:scale-95",
              "bg-cricket-btn-six-bg border-cricket-six/60 text-cricket-btn-six-fg",
              "dark:bg-cricket-six/20 dark:text-cricket-six dark:border-cricket-six/40",
              "hover:brightness-95 disabled:opacity-40 disabled:pointer-events-none"
            )}
          >
            6
          </motion.button>
        </div>

        {/* Extras row */}
        <div className="grid grid-cols-4 gap-1.5">
          <button
            disabled={!canScore}
            onClick={() => setWidePickerOpen(true)}
            className={cn(
              "h-11 rounded-xl border text-sm font-semibold transition-all active:scale-95",
              "bg-cricket-wide/15 border-cricket-wide/40 text-cricket-wide",
              "dark:bg-cricket-wide/10 dark:border-cricket-wide/30",
              "hover:bg-cricket-wide/25 disabled:opacity-40 disabled:pointer-events-none"
            )}
          >
            Wide
          </button>
          <button
            disabled={!canScore}
            onClick={() => setNbPickerOpen(true)}
            className={cn(
              "h-11 rounded-xl border text-sm font-semibold transition-all active:scale-95",
              "bg-cricket-noball/15 border-cricket-noball/40 text-cricket-noball",
              "dark:bg-cricket-noball/10 dark:border-cricket-noball/30",
              "hover:bg-cricket-noball/25 disabled:opacity-40 disabled:pointer-events-none"
            )}
          >
            NB
          </button>
          <button
            disabled={!canScore || !rules.byesEnabled}
            onClick={() => setByePickerOpen(true)}
            className={cn(
              "h-11 rounded-xl border text-sm font-semibold transition-all active:scale-95",
              "bg-muted/40 border-border text-muted-foreground",
              "hover:bg-muted/70 disabled:opacity-40 disabled:pointer-events-none"
            )}
          >
            Bye
          </button>
          <button
            disabled={!canScore || !rules.legByesEnabled}
            onClick={() => setLbPickerOpen(true)}
            className={cn(
              "h-11 rounded-xl border text-sm font-semibold transition-all active:scale-95",
              "bg-muted/40 border-border text-muted-foreground",
              "hover:bg-muted/70 disabled:opacity-40 disabled:pointer-events-none"
            )}
          >
            LB
          </button>
        </div>

        {/* Overthrow */}
        <button
          disabled={!canScore}
          onClick={() => setOtPickerOpen(true)}
          className={cn(
            "h-9 rounded-xl border text-xs font-semibold transition-all active:scale-95",
            "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400",
            "hover:bg-amber-500/20 disabled:opacity-40 disabled:pointer-events-none"
          )}
        >
          Overthrow
        </button>

        {/* Wicket + Undo */}
        <div className="grid grid-cols-3 gap-1.5">
          <button
            disabled={!canScore || !striker || !nonStriker}
            onClick={() => { haptic(); setShowWicketDialog(true) }}
            className={cn(
              "col-span-2 h-12 rounded-xl border font-bold text-base transition-all active:scale-95",
              "bg-cricket-btn-wicket-bg border-cricket-wicket/60 text-cricket-btn-wicket-fg",
              "dark:bg-cricket-wicket/20 dark:text-cricket-wicket dark:border-cricket-wicket/40",
              "hover:brightness-95 disabled:opacity-40 disabled:pointer-events-none"
            )}
          >
            WICKET 🔴
          </button>
          <button
            disabled={isProcessing || innings.ballLog.length === 0}
            onClick={handleUndo}
            className={cn(
              "h-12 rounded-xl border font-medium text-sm transition-all active:scale-95 flex items-center justify-center gap-1",
              "bg-muted/40 border-border text-muted-foreground",
              "hover:bg-muted/70 disabled:opacity-40 disabled:pointer-events-none"
            )}
          >
            <RotateCcw className="size-3.5" />
            Undo
          </button>
        </div>

        {/* If no bowler set and over hasn't started, show pick bowler CTA */}
        {!currentBowlerId && (
          <Button
            variant="outline"
            className="w-full h-10 border-dashed border-primary/50 text-primary text-sm"
            onClick={() => setShowNewBowlerSheet(true)}
          >
            Pick Bowler to Start Over
          </Button>
        )}
      </div>

      {/* ── Dialogs & Sheets ── */}

      {/* Wide picker */}
      <RunPickerDialog
        open={widePickerOpen}
        onClose={() => setWidePickerOpen(false)}
        onSelect={(runs) => handleWide(runs)}
        title="Wide — Extra runs scored?"
        options={[0, 1, 2, 4]}
        colorClass="bg-cricket-wide/15 hover:bg-cricket-wide/25 border-cricket-wide/40 text-cricket-wide"
      />

      {/* No-ball picker */}
      <RunPickerDialog
        open={nbPickerOpen}
        onClose={() => setNbPickerOpen(false)}
        onSelect={(runs) => handleNoBall(runs)}
        title="No Ball — Bat runs?"
        options={[0, 1, 2, 3, 4, 6]}
        colorClass="bg-cricket-noball/15 hover:bg-cricket-noball/25 border-cricket-noball/40 text-cricket-noball"
      />

      {/* Bye picker */}
      <RunPickerDialog
        open={byePickerOpen}
        onClose={() => setByePickerOpen(false)}
        onSelect={(runs) => handleBye(runs, false)}
        title="Byes — How many?"
        options={[1, 2, 3, 4]}
        colorClass="bg-muted/50 hover:bg-muted border-border text-foreground"
      />

      {/* Leg-bye picker */}
      <RunPickerDialog
        open={lbPickerOpen}
        onClose={() => setLbPickerOpen(false)}
        onSelect={(runs) => handleBye(runs, true)}
        title="Leg Byes — How many?"
        options={[1, 2, 3, 4]}
        colorClass="bg-muted/50 hover:bg-muted border-border text-foreground"
      />

      {/* Overthrow picker */}
      <RunPickerDialog
        open={otPickerOpen}
        onClose={() => setOtPickerOpen(false)}
        onSelect={(runs) => handleOverthrow(runs)}
        title="Overthrow — Total runs on ball?"
        options={[4, 5, 6, 7]}
        colorClass="bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/40 text-amber-600 dark:text-amber-400"
      />

      {/* Wicket dialog */}
      {striker && nonStriker && currentBowler && (
        <WicketDialog
          open={showWicketDialog}
          onClose={() => setShowWicketDialog(false)}
          onConfirm={handleWicketConfirm}
          striker={striker}
          nonStriker={nonStriker}
          bowler={currentBowler}
          allPlayersInField={fieldingTeamPlayers}
          isFreeHit={isFreeHit}
        />
      )}

      {/* New bowler sheet */}
      <NewBowlerSheet
        open={showNewBowlerSheet}
        bowlers={bowlerOptions}
        onSelect={handleNewBowlerSelect}
      />

      {/* New batsman sheet */}
      <NewBatsmanSheet
        open={showNewBatsmanSheet}
        onClose={() => setShowNewBatsmanSheet(false)}
        availableBatsmen={availableBatsmen}
        onSelect={handleNewBatsmanSelect}
      />

      {/* Innings end dialog */}
      <AlertDialog open={showInningsEndDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Innings Complete</AlertDialogTitle>
            <AlertDialogDescription>
              {inningsEndMsg} Start the 2nd innings?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowInningsEndDialog(false)}>
              Wait
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleStartNextInnings}>
              Start 2nd Innings
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Match end dialog */}
      <AlertDialog open={showMatchEndDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Match Complete</AlertDialogTitle>
            <AlertDialogDescription>
              {inningsEndMsg}
              {"\n"}
              {isSecondInnings && prevInnings && (() => {
                const team2R = innings.totalRuns
                const team1R = prevInnings.totalRuns
                if (team2R > team1R) {
                  const wkLeft = rules.maxWickets - innings.totalWickets
                  const winnerName = innings.battingTeamId === match.team1Id ? match.team1Name : match.team2Name
                  return `${winnerName} won by ${wkLeft} wicket${wkLeft !== 1 ? "s" : ""}.`
                } else if (team1R > team2R) {
                  const winnerName = prevInnings.battingTeamId === match.team1Id ? match.team1Name : match.team2Name
                  return `${winnerName} won by ${team1R - team2R} run${team1R - team2R !== 1 ? "s" : ""}.`
                }
                return "Match tied!"
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={handleEndMatch}>
              View Scorecard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ─── route ────────────────────────────────────────────────────────────────────

function ScoringLoader() {
  const { match, matchId, loadMatch, isProcessing } = useScoringStore()
  const navigate = useNavigate()

  // Load live match from DB if not in store
  const liveMatch = useLiveQuery(() =>
    db.matches.where("status").equals("live").first()
  )

  useEffect(() => {
    if (liveMatch === undefined) return // still loading

    if (!liveMatch) {
      // No live match — go home
      navigate({ to: "/" })
      return
    }

    if (!match || matchId !== liveMatch.id) {
      loadMatch(liveMatch.id)
    }
  }, [liveMatch, match, matchId, loadMatch, navigate])

  if (!match || isProcessing) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        <div className="flex flex-col items-center gap-2">
          <div className="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span>Loading match...</span>
        </div>
      </div>
    )
  }

  return <ScoringPage />
}

export const Route = createFileRoute("/scoring")({
  component: ScoringLoader,
})

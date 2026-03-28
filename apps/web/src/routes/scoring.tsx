import { useState, useEffect, useMemo } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useLiveQuery } from "dexie-react-hooks"
import { RotateCcw, ChevronRight, Activity } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

import { useScoringStore } from "@/stores/scoring"
import {
  isInPowerplay,
  isInningsComplete,
  getRemainingBalls,
  getRequiredRunRate,
  getCurrentRunRate,
  formatOvers,
  getCurrentPartnership,
} from "@/lib/cricket-engine"
import { useWakeLock } from "@/hooks/use-wake-lock"
import { useHaptic } from "@/hooks/use-haptic"
import { useScoringHandlers } from "@/hooks/use-scoring-handlers"
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
import { InningsBreakOverlay } from "@/components/scoring/InningsBreakOverlay"
import { MatchResultOverlay } from "@/components/scoring/MatchResultOverlay"

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { cn } from "@workspace/ui/lib/utils"

import type { Player, BatsmanEntry, BowlerEntry } from "@/types/cricket"

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
    oversBowledByBowler,
    isProcessing,
    swapStrike,
    undoNBalls,
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
  }, [match?.id], null)
  const isPlayersLoading = allPlayers === null
  const players = allPlayers ?? []

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
  const [showUndoSheet, setShowUndoSheet] = useState(false)
  const [scoreFlash, setScoreFlash] = useState<"boundary" | "six" | "wicket" | null>(null)
  const [flashKey, setFlashKey] = useState(0)

  function triggerFlash(type: "boundary" | "six" | "wicket") {
    setFlashKey((k) => k + 1)
    setScoreFlash(type)
  }

  if (!match) {
    // ScoringLoader guarantees match is set before rendering ScoringPage,
    // but guard here as a safety net
    return null
  }

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

  // Partnership — memoised to avoid recomputing on every render
  const partnership = useMemo(
    () =>
      striker && nonStriker
        ? getCurrentPartnership(
            innings.ballLog,
            striker.playerId,
            nonStriker.playerId,
            innings.totalWickets,
            innings.totalRuns
          )
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [innings.ballLog, striker?.playerId, nonStriker?.playerId, innings.totalWickets, innings.totalRuns]
  )

  // Available batsmen for new batsman sheet
  const playingXI: string[] =
    innings.battingTeamId === match.team1Id ? match.playingXI1 : match.playingXI2
  const availableBatsmen: Player[] = players.filter(
    (p) =>
      playingXI.includes(p.id) &&
      p.id !== onStrikeBatsmanId &&
      p.id !== offStrikeBatsmanId &&
      !innings.battingCard.find((e) => e.playerId === p.id && (e.isOut || e.isRetiredHurt))
  )

  // Bowler options for new bowler sheet
  const fieldingXI: string[] =
    bowlingTeamId === match.team1Id ? match.playingXI1 : match.playingXI2
  const lastBowlerId =
    innings.ballLog.length > 0
      ? innings.ballLog[innings.ballLog.length - 1]?.bowlerId
      : null

  const bowlerOptions = players
    .filter((p) => fieldingXI.includes(p.id))
    .map((p) => {
      const oversBowled = oversBowledByBowler[p.id] ?? 0
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
  const fieldingTeamPlayers = players.filter((p) => fieldingXI.includes(p.id))

  // ── scoring handlers (extracted to reduce component size) ─────────────────

  const {
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
  } = useScoringHandlers(
    {
      match, innings, rules, currentInningsIndex, currentOver,
      onStrikeBatsmanId, offStrikeBatsmanId, currentBowlerId,
      isFreeHit, isProcessing, isPowerplay, isSecondInnings,
      prevInnings, battingTeamName, allPlayers: players, currentBowler,
    },
    {
      haptic, navigate, triggerFlash,
      setShowWicketDialog, setShowNewBowlerSheet, setShowNewBatsmanSheet,
      setShowInningsEndDialog, setShowMatchEndDialog,
    }
  )

  // ── Innings complete detection (for persistent recovery) ──────────────────
  const inningsIsOver = isInningsComplete(innings, rules)
  const totalExpectedInnings = (rules.inningsPerSide ?? 1) * 2
  const isLastInnings = currentInningsIndex >= totalExpectedInnings - 1

  // ─────────────────────────────────────────────────────────────────────────
  // Guard: need striker + bowler to score, and innings must be live
  // ─────────────────────────────────────────────────────────────────────────

  const canScore = !!onStrikeBatsmanId && !!currentBowlerId && !isProcessing && !inningsIsOver

  // ── Next required action (persistent strip) ───────────────────────────────
  type NextActionType = {
    kind: "batsman" | "bowler" | "innings" | "match-end"
    label: string
    disabled?: boolean
  } | null
  const nextAction: NextActionType = (() => {
    const inningsOrdinal = currentInningsIndex + 2
    // Highest priority: innings is complete — show transition action
    if (inningsIsOver && !isLastInnings)
      return {
        kind: "innings" as const,
        label: `Innings complete — start innings ${inningsOrdinal}/${totalExpectedInnings}`,
      }
    if (inningsIsOver && isLastInnings)
      return { kind: "match-end" as const, label: "Match complete — view results" }
    if (!onStrikeBatsmanId)
      return {
        kind: "batsman" as const,
        label: isPlayersLoading
          ? "Loading players..."
          : innings.battingCard.length === 0
            ? "Select opening batsman"
            : "Select new batsman",
        disabled: isPlayersLoading,
      }
    if (!offStrikeBatsmanId)
      return {
        kind: "batsman" as const,
        label: isPlayersLoading
          ? "Loading players..."
          : innings.battingCard.length <= 1
            ? "Select non-striker"
            : "Select new batsman",
        disabled: isPlayersLoading,
      }
    if (!currentBowlerId)
      return { kind: "bowler" as const, label: innings.ballLog.length === 0 ? "Select opening bowler" : "Select bowler for next over" }
    return null
  })()

  // ── Result text for match end dialog ──────────────────────────────────────
  const inningsEndMsg = `${battingTeamName} scored ${innings.totalRuns}/${innings.totalWickets} in ${formatOvers(innings.totalLegalDeliveries, rules.ballsPerOver)} overs.`

  // ── Target team name (team about to bat in 2nd innings) ───────────────────
  const targetTeamName =
    innings.battingTeamId === match.team1Id ? match.team2Name : match.team1Name

  // ── Match result computation for MatchResultOverlay ───────────────────────
  const matchResultStr = (() => {
    if (!isSecondInnings || !prevInnings) return inningsEndMsg
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
  })()

  const matchWinnerName = (() => {
    if (!isSecondInnings || !prevInnings) return undefined
    const team2R = innings.totalRuns
    const team1R = prevInnings.totalRuns
    if (team2R > team1R) {
      return innings.battingTeamId === match.team1Id ? match.team1Name : match.team2Name
    } else if (team1R > team2R) {
      return prevInnings.battingTeamId === match.team1Id ? match.team1Name : match.team2Name
    }
    return "tie"
  })()

  const matchWinnerIsFirstTeam = matchWinnerName === match.team1Name

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background select-none relative">
      {/* Animated background — live match field */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
        {/* Outfield boundary circle */}
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120vw] h-[120vw] rounded-full border border-emerald-500/6"
          animate={{ scale: [1, 1.03, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* Inner 30-yard circle */}
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vw] rounded-full border border-emerald-500/5"
          animate={{ scale: [1, 1.02, 1], opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        />
        {/* Cricket ball — orbiting top right */}
        <motion.svg
          className="absolute top-6 right-6 opacity-[0.09]"
          width="40" height="40" viewBox="0 0 40 40"
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
        >
          <circle cx="20" cy="20" r="18" fill="#ef4444" />
          <path d="M4 20 Q12 12 20 20 Q28 28 36 20" stroke="white" strokeWidth="1.5" fill="none" />
          <path d="M4 20 Q12 28 20 20 Q28 12 36 20" stroke="white" strokeWidth="1.5" fill="none" />
        </motion.svg>
        {/* Bat — bottom left */}
        <motion.svg
          className="absolute bottom-28 left-3 opacity-[0.06]"
          width="24" height="64" viewBox="0 0 24 64"
          animate={{ rotate: [-12, 12, -12] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <rect x="6" y="0" width="12" height="40" rx="6" fill="#a78bfa" />
          <rect x="9" y="38" width="6" height="22" rx="3" fill="#8b5cf6" />
        </motion.svg>
        <motion.div
          className="absolute bottom-32 left-4 w-24 h-24 rounded-full bg-emerald-500/5"
          animate={{ scale: [1, 1.15, 1], x: [0, 6, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        />
      </div>

      {/* ── Score flash overlay ── */}
      <AnimatePresence>
        {scoreFlash && (
          <motion.div
            key={flashKey}
            className={cn(
              "fixed inset-0 z-[100] pointer-events-none flex items-center justify-center",
              scoreFlash === "boundary" && "bg-emerald-500/15",
              scoreFlash === "six" && "bg-amber-500/15",
              scoreFlash === "wicket" && "bg-red-500/15"
            )}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            onAnimationComplete={() => setTimeout(() => setScoreFlash(null), 350)}
          >
            <motion.span
              className={cn(
                "text-7xl font-black tracking-tighter select-none drop-shadow-lg",
                scoreFlash === "boundary" && "text-emerald-400",
                scoreFlash === "six" && "text-amber-400",
                scoreFlash === "wicket" && "text-red-400"
              )}
              initial={{ scale: 0.4, opacity: 0, y: 20 }}
              animate={{ scale: 1.1, opacity: 1, y: 0 }}
              exit={{ scale: 1.4, opacity: 0, y: -10 }}
              transition={{ type: "spring", stiffness: 500, damping: 18, duration: 0.3 }}
            >
              {scoreFlash === "boundary" ? "4!" : scoreFlash === "six" ? "6!" : "W!"}
            </motion.span>
          </motion.div>
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
      {currentBowler && <BowlerCard bowler={currentBowler} />}
      {!currentBowler && innings.ballLog.length > 0 && (
        <div className="px-3 py-1.5 text-xs text-muted-foreground italic border-b border-border/50 bg-muted/20">
          Tap “Select bowler for next over” to continue
        </div>
      )}

      {/* ── Over display ── */}
      <OverDisplay balls={overBalls} lastOverSummary={lastOverSummary} currentBowler={currentBowler} />

      {/* ── Free hit banner ── */}
      {isFreeHit && <FreeHitBanner />}

      {/* ── Next required action strip ── */}
      <AnimatePresence mode="wait">
        {nextAction && (
          <motion.button
            key={nextAction.kind + nextAction.label}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            onClick={() => {
              if (nextAction.disabled) return
              haptic()
              if (nextAction.kind === "innings") {
                setShowInningsEndDialog(true)
              } else if (nextAction.kind === "match-end") {
                setShowMatchEndDialog(true)
              } else if (nextAction.kind === "batsman") {
                setShowNewBatsmanSheet(true)
              } else {
                setShowNewBowlerSheet(true)
              }
            }}
            className={cn(
              "w-full flex items-center justify-between px-3 py-2.5 text-sm font-semibold border-y transition-colors",
              nextAction.disabled && "opacity-70 cursor-wait",
              nextAction.kind === "innings" || nextAction.kind === "match-end"
                ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-600 dark:text-emerald-400"
                : nextAction.kind === "batsman"
                  ? "bg-primary/10 border-primary/25 text-primary"
                  : "bg-amber-500/10 border-amber-500/25 text-amber-600 dark:text-amber-400"
            )}
          >
            <span>{nextAction.label}</span>
            <ChevronRight className="size-4 opacity-70" />
          </motion.button>
        )}
      </AnimatePresence>

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
            onContextMenu={(e) => {
              if (overBalls.length > 1) {
                e.preventDefault()
                setShowUndoSheet(true)
              }
            }}
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
        overSummary={lastOverSummary || undefined}
      />

      {/* New batsman sheet */}
      <NewBatsmanSheet
        open={showNewBatsmanSheet}
        onClose={() => setShowNewBatsmanSheet(false)}
        availableBatsmen={availableBatsmen}
        onSelect={handleNewBatsmanSelect}
      />

      {/* Innings break overlay */}
      <InningsBreakOverlay
        open={showInningsEndDialog}
        completedInnings={{
          battingTeamName,
          totalRuns: innings.totalRuns,
          totalWickets: innings.totalWickets,
          oversStr: formatOvers(innings.totalLegalDeliveries, rules.ballsPerOver),
        }}
        targetTeamName={targetTeamName}
        target={innings.totalRuns + 1}
        onStartInnings={handleStartNextInnings}
      />

      {/* Multi-undo sheet */}
      <Sheet open={showUndoSheet} onOpenChange={(o) => !o && setShowUndoSheet(false)} modal={true}>
        <SheetContent side="bottom" showCloseButton={false} className="rounded-t-2xl pb-safe">
          <SheetHeader className="pb-3 pt-5 px-4">
            <div className="w-10 h-1.5 bg-muted-foreground/30 rounded-full mx-auto mb-3" />
            <SheetTitle className="text-center">Undo Balls</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-6 space-y-2">
            {overBalls.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No balls in this over to undo.</p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground text-center mb-3">
                  This over: {overBalls.map((b) => {
                    if (b.isWicket) return "W"
                    if (b.extraType === "wide") return "wd"
                    if (b.extraType === "noBall") return "nb"
                    return String(b.runs)
                  }).join(" ")}
                </p>
                {[1, 2, 3, 4, 5, 6].filter((n) => n <= overBalls.length).map((n) => (
                  <button
                    key={n}
                    onClick={async () => {
                      setShowUndoSheet(false)
                      haptic()
                      await undoNBalls(n)
                    }}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl hover:bg-muted/60 active:bg-muted transition-colors text-left"
                  >
                    <span className="text-sm font-medium">Undo {n} ball{n !== 1 ? "s" : ""}</span>
                    <span className="text-xs text-muted-foreground">Last {n}: {overBalls.slice(-n).map((b) => {
                      if (b.isWicket) return "W"
                      if (b.extraType === "wide") return "wd"
                      if (b.extraType === "noBall") return "nb"
                      return String(b.runs)
                    }).join(" ")}</span>
                  </button>
                ))}
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Match result overlay */}
      <MatchResultOverlay
        open={showMatchEndDialog}
        result={matchResultStr}
        winner={matchWinnerName}
        winnerIsFirstTeam={matchWinnerIsFirstTeam}
        team1Name={match.team1Name}
        team2Name={match.team2Name}
        onViewScorecard={handleEndMatch}
      />
    </div>
  )
}

// ─── route ────────────────────────────────────────────────────────────────────

function ScoringLoader() {
  const { match, matchId, loadMatch } = useScoringStore()
  const navigate = useNavigate()

  // Load live match from DB if not in store.
  // Pass null as the default so we can distinguish:
  //   null      = query still loading (Dexie not ready yet)
  //   undefined = query done, no live match found
  //   Match     = query done, live match found
  const liveMatch = useLiveQuery(
    () => db.matches.where("status").equals("live").first(),
    [],
    null
  )

  useEffect(() => {
    if (liveMatch === null) return // still loading
    if (liveMatch && (!match || matchId !== liveMatch.id)) {
      loadMatch(liveMatch.id)
    }
  }, [liveMatch, match, matchId, loadMatch])

  // Still querying Dexie
  if (liveMatch === null) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // No live match in DB — show a clear CTA instead of silently redirecting
  if (!liveMatch) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-6 text-center">
        <div className="size-14 rounded-full bg-muted flex items-center justify-center">
          <Activity className="size-7 text-muted-foreground/50" />
        </div>
        <div>
          <p className="font-semibold text-sm">No active match</p>
          <p className="text-xs text-muted-foreground mt-1">Start a new match to begin scoring</p>
        </div>
        <button
          onClick={() => navigate({ to: "/new-match" })}
          className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold"
        >
          New Match
        </button>
      </div>
    )
  }

  // Match found but store not hydrated yet
  if (!match) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return <ScoringPage />
}

export const Route = createFileRoute("/scoring")({
  component: ScoringLoader,
})

import { motion } from "framer-motion"
import { createFileRoute, useParams } from "@tanstack/react-router"
import { useLiveQuery } from "dexie-react-hooks"
import { format } from "date-fns"
import {
  ChevronDown,
  ChevronUp,
  Share2,
  Copy,
  Check,
  ArrowLeft,
} from "lucide-react"
import { useRef, useState } from "react"
import html2canvas from "html2canvas"
import { db } from "@/db/index"
import { formatOvers } from "@/lib/cricket-engine"
import type { Innings, Match } from "@/types/cricket"
import { BattingCard } from "@/components/scorecard/BattingCard"
import { BowlingCard } from "@/components/scorecard/BowlingCard"
import { FallOfWickets } from "@/components/scorecard/FallOfWickets"
import { PartnershipChart } from "@/components/scorecard/PartnershipChart"
import { ManhattanChart } from "@/components/charts/ManhattanChart"
import { WormGraph } from "@/components/charts/WormGraph"
import { RunRateGraph } from "@/components/charts/RunRateGraph"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/scorecard/$matchId")({
  component: ScorecardPage,
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function inningsLabel(index: number, total: number): string {
  if (total <= 2) return index === 0 ? "1st Innings" : "2nd Innings"
  const labels = ["1st", "2nd", "3rd", "4th"]
  return `${labels[index] ?? `${index + 1}th`} Innings`
}

function oversStr(innings: Innings): string {
  return formatOvers(innings.totalLegalDeliveries, 6)
}

function buildManhattanData(innings: Innings) {
  // Group balls by overNumber
  const overMap = new Map<number, { runs: number; wickets: number }>()
  for (const ball of innings.ballLog) {
    const ov = ball.overNumber
    const entry = overMap.get(ov) ?? { runs: 0, wickets: 0 }
    entry.runs += ball.runs
    if (ball.isWicket) entry.wickets += 1
    overMap.set(ov, entry)
  }
  return Array.from(overMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([overNumber, d]) => ({ overNumber, ...d }))
}

function resultBannerClass(match: Match): string {
  if (match.status === "abandoned") return "bg-red-500/10 border-red-500/30 text-red-400"
  if (match.winner === "tie") return "bg-amber-500/10 border-amber-500/30 text-amber-400"
  return "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
}

// ─── Text scorecard builder ───────────────────────────────────────────────────

function buildTextScorecard(match: Match): string {
  const lines: string[] = []
  lines.push("CricketBook Scorecard")
  lines.push("=====================")
  lines.push(`${match.team1Name} vs ${match.team2Name}`)
  lines.push(
    `${match.format} — ${format(new Date(match.date), "d MMM yyyy")}${match.venue ? ` — ${match.venue}` : ""}`
  )
  lines.push("")

  for (const inn of match.innings) {
    const battingName =
      inn.battingTeamId === match.team1Id ? match.team1Name : match.team2Name
    const bowlingName =
      inn.bowlingTeamId === match.team1Id ? match.team1Name : match.team2Name

    lines.push(`${battingName.toUpperCase()} BATTING`)
    for (const b of inn.battingCard) {
      const notOut = !b.isOut && !b.isRetiredHurt
      const name = `${b.playerName}${notOut ? "*" : ""}`.padEnd(20)
      const dis = (b.dismissalText || "not out").padEnd(20)
      const r = String(b.runs).padStart(4)
      const balls = String(b.balls).padStart(4)
      const fours = String(b.fours).padStart(3)
      const sixes = String(b.sixes).padStart(3)
      const sr = b.strikeRate.toFixed(1).padStart(7)
      lines.push(`${name}  ${dis}  ${r}  ${balls}  ${fours}  ${sixes}  ${sr}`)
    }
    const e = inn.extras
    const extParts = [`W:${e.wide}`, `NB:${e.noBall}`, `B:${e.bye}`, `LB:${e.legBye}`]
    lines.push(`Extras (${extParts.join(" ")}): ${e.total}`)
    lines.push(
      `Total: ${inn.totalRuns}/${inn.totalWickets} (${oversStr(inn)} ov)`
    )
    lines.push("")

    lines.push(`${bowlingName.toUpperCase()} BOWLING`)
    for (const b of inn.bowlingCard) {
      const overs = b.balls > 0 ? `${b.overs}.${b.balls}` : `${b.overs}`
      lines.push(
        `${b.playerName.padEnd(20)}  ${overs}-${b.maidens}-${b.runs}-${b.wickets}  Eco: ${b.economy.toFixed(2)}`
      )
    }
    lines.push("")
  }

  if (match.result) {
    lines.push(match.result)
  }

  return lines.join("\n")
}

// ─── Share buttons ────────────────────────────────────────────────────────────

function ShareButtons({ match, scorecardRef }: { match: Match; scorecardRef: React.RefObject<HTMLDivElement | null> }) {
  const [copied, setCopied] = useState(false)
  const [sharing, setSharing] = useState(false)

  async function handleCopy() {
    const text = buildTextScorecard(match)
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleShareImage() {
    if (!scorecardRef.current) return
    setSharing(true)
    try {
      const canvas = await html2canvas(scorecardRef.current, {
        backgroundColor: "#09090b",
        scale: 2,
      })
      canvas.toBlob(async (blob) => {
        if (!blob) return
        const file = new File([blob], "scorecard.png", { type: "image/png" })
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: `${match.team1Name} vs ${match.team2Name}` })
        } else {
          const url = URL.createObjectURL(blob)
          const a = document.createElement("a")
          a.href = url
          a.download = "scorecard.png"
          a.click()
          URL.revokeObjectURL(url)
        }
      }, "image/png")
    } finally {
      setSharing(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
        {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
        {copied ? "Copied!" : "Copy Text"}
      </Button>
      <Button variant="outline" size="sm" onClick={handleShareImage} disabled={sharing} className="gap-1.5">
        <Share2 className="size-3.5" />
        {sharing ? "Capturing…" : "Share Image"}
      </Button>
    </div>
  )
}

// ─── Charts section ───────────────────────────────────────────────────────────

function ChartsSection({ match }: { match: Match }) {
  const [open, setOpen] = useState(false)

  const inn1 = match.innings[0]
  const inn2 = match.innings[1]

  if (!inn1) return null

  const maxOvers = match.rules.oversPerInnings ?? 20

  const mhData1 = buildManhattanData(inn1)
  const mhData2 = inn2 ? buildManhattanData(inn2) : undefined

  const battingName1 =
    inn1.battingTeamId === match.team1Id ? match.team1Name : match.team2Name
  const battingName2 = inn2
    ? inn2.battingTeamId === match.team1Id
      ? match.team1Name
      : match.team2Name
    : undefined

  const target2 = inn2?.target
  const totalBalls = maxOvers * match.rules.ballsPerOver

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold hover:bg-muted/30 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <span>Charts</span>
        {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-6 border-t border-border">
          <div>
            <div className="mt-3 mb-2">
              <p className="text-xs font-medium text-foreground">Manhattan Chart</p>
              <p className="text-[10px] text-muted-foreground">Runs per over — hover a bar for details</p>
            </div>
            <ManhattanChart
              innings={mhData1}
              innings2={mhData2}
              maxOvers={maxOvers}
              team1Name={battingName1}
              team2Name={battingName2}
            />
          </div>

          <div>
            <div className="mb-2">
              <p className="text-xs font-medium text-foreground">Worm Graph</p>
              <p className="text-[10px] text-muted-foreground">Cumulative runs — shows scoring momentum over time</p>
            </div>
            <WormGraph
              innings1Balls={inn1.ballLog}
              innings2Balls={inn2?.ballLog}
              ballsPerOver={match.rules.ballsPerOver}
              maxOvers={maxOvers}
              team1Name={battingName1}
              team2Name={battingName2}
            />
          </div>

          {inn2 && target2 && (
            <div>
              <div className="mb-2">
                <p className="text-xs font-medium text-foreground">Run Rate (2nd Innings)</p>
                <p className="text-[10px] text-muted-foreground">CRR vs RRR — hover for over-by-over breakdown</p>
              </div>
              <RunRateGraph
                balls={inn2.ballLog}
                target={target2}
                ballsPerOver={match.rules.ballsPerOver}
                totalBalls={totalBalls}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Innings Tab Content ──────────────────────────────────────────────────────

function InningsTabContent({ innings, match }: { innings: Innings; match: Match }) {
  const ovStr = oversStr(innings)

  // Determine captain/keeper for the batting team in this innings
  const captainId =
    innings.battingTeamId === match.team1Id
      ? match.captainTeam1Id
      : match.captainTeam2Id
  const wicketKeeperId =
    innings.battingTeamId === match.team1Id
      ? match.wicketKeeperTeam1Id
      : match.wicketKeeperTeam2Id

  return (
    <div className="space-y-5 pt-3">
      <BattingCard
        battingCard={innings.battingCard}
        extras={innings.extras}
        totalRuns={innings.totalRuns}
        totalWickets={innings.totalWickets}
        oversStr={ovStr}
        captainId={captainId}
        wicketKeeperId={wicketKeeperId}
      />

      <div className="border-t border-border pt-4">
        <BowlingCard bowlingCard={innings.bowlingCard} />
      </div>

      {innings.fallOfWickets.length > 0 && (
        <div className="border-t border-border pt-4">
          <FallOfWickets fallOfWickets={innings.fallOfWickets} />
        </div>
      )}

      {innings.partnerships.length > 0 && (
        <div className="border-t border-border pt-4">
          <PartnershipChart
            partnerships={innings.partnerships}
            totalRuns={innings.totalRuns}
          />
        </div>
      )}
    </div>
  )
}

// ─── ScorecardPage ────────────────────────────────────────────────────────────

function ScorecardPage() {
  const { matchId } = useParams({ from: "/scorecard/$matchId" })
  const scorecardRef = useRef<HTMLDivElement>(null)

  const match = useLiveQuery(() => db.matches.get(matchId), [matchId])

  if (match === undefined) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <div className="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!match) {
    return (
      <div className="min-h-full flex items-center justify-center px-4">
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">Match not found</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const completedInnings = match.innings.filter(
    (i) => i.status === "completed" || i.status === "declared"
  )

  return (
    <div className="min-h-full bg-background relative overflow-hidden">
      {/* Animated background — scorecard / match data */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <motion.div
          className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-primary/5"
          animate={{ scale: [1, 1.1, 1], x: [0, -6, 0], y: [0, 10, 0] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute top-1/2 -left-20 w-48 h-48 rounded-full bg-blue-500/4"
          animate={{ scale: [1, 1.08, 1], y: [0, -8, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 3 }}
        />
        <motion.div
          className="absolute bottom-20 right-4 w-36 h-36 rounded-full bg-emerald-500/4"
          animate={{ scale: [1, 1.12, 1], x: [0, -4, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
        />
        {/* Subtle horizontal stat lines */}
        {[20, 38, 56, 74].map((pct, i) => (
          <motion.div
            key={i}
            className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/6 to-transparent"
            style={{ top: `${pct}%` }}
            animate={{ opacity: [0.2, 0.5, 0.2] }}
            transition={{ duration: 5 + i, repeat: Infinity, ease: "easeInOut", delay: i * 0.8 }}
          />
        ))}
      </div>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => history.back()}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold truncate">
              {match.team1Name} vs {match.team2Name}
            </h1>
            <p className="text-[10px] text-muted-foreground">
              {match.format} — {format(new Date(match.date), "d MMM yyyy")}
              {match.venue ? ` — ${match.venue}` : ""}
            </p>
          </div>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
            {match.format}
          </Badge>
        </div>
      </div>

      <div id="scorecard-capture" className="px-4 py-4 space-y-4 pb-8" ref={scorecardRef}>
        {/* Result banner */}
        {match.result && (
          <div
            className={`border rounded-lg px-4 py-2.5 text-sm font-semibold ${resultBannerClass(match)}`}
          >
            {match.result}
          </div>
        )}

        {/* Innings tabs */}
        {completedInnings.length > 0 ? (
          <Tabs defaultValue="0">
            <TabsList className="w-full">
              {completedInnings.map((inn, idx) => (
                <TabsTrigger key={inn.index} value={String(idx)} className="flex-1 text-xs">
                  {inningsLabel(inn.index, match.innings.length)}
                </TabsTrigger>
              ))}
            </TabsList>

            {completedInnings.map((inn, idx) => (
              <TabsContent key={inn.index} value={String(idx)}>
                <InningsTabContent innings={inn} match={match} />
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          <Card>
            <CardContent className="py-6 text-center">
              <p className="text-sm text-muted-foreground">No completed innings yet</p>
            </CardContent>
          </Card>
        )}

        {/* Charts */}
        <ChartsSection match={match} />

        {/* Share */}
        <div className="pt-2">
          <ShareButtons match={match} scorecardRef={scorecardRef} />
        </div>
      </div>
    </div>
  )
}

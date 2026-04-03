import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router"
import { useLiveQuery } from "dexie-react-hooks"
import { useState } from "react"
import { formatMatchDateShort } from "@/lib/date-utils"
import { ArrowLeft, BarChart2, TrendingUp, Activity, Target, Users, Zap, Plus } from "lucide-react"
import { motion } from "framer-motion"
import { db } from "@/db/index"
import { ManhattanChart } from "@/components/charts/ManhattanChart"
import { WormGraph } from "@/components/charts/WormGraph"
import { RunRateGraph } from "@/components/charts/RunRateGraph"
import { DismissalChart } from "@/components/charts/DismissalChart"
import { BatsmanBreakdownChart } from "@/components/charts/BatsmanBreakdownChart"
import { BowlerDotBallChart } from "@/components/charts/BowlerDotBallChart"
import { ExtrasChart } from "@/components/charts/ExtrasChart"
import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent } from "@workspace/ui/components/card"
import type { Innings, Match } from "@/types/cricket"

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/charts/$matchId")({
  component: ChartsPage,
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildManhattanData(innings: Innings) {
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

// ─── Tab definitions ──────────────────────────────────────────────────────────

const CHART_TABS = [
  { id: "manhattan", label: "Manhattan", icon: BarChart2 },
  { id: "worm", label: "Worm", icon: TrendingUp },
  { id: "runrate", label: "Run Rate", icon: Activity },
  { id: "dismissals", label: "Wickets", icon: Target },
  { id: "batting", label: "Batting", icon: Users },
  { id: "bowling", label: "Bowling", icon: Zap },
  { id: "extras", label: "Extras", icon: Plus },
] as const

type ChartTabId = (typeof CHART_TABS)[number]["id"]

// ─── Chart card wrapper ────────────────────────────────────────────────────────

function ChartCard({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-5 px-4">
        <div className="mb-3">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>
        </div>
        {children}
      </CardContent>
    </Card>
  )
}

// ─── ChartsContent ────────────────────────────────────────────────────────────

function ChartsContent({ match, activeTab }: { match: Match; activeTab: ChartTabId }) {
  const inn1 = match.innings[0]
  const inn2 = match.innings[1]

  if (!inn1) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm text-muted-foreground">No innings data yet</p>
        </CardContent>
      </Card>
    )
  }

  const maxOvers = match.rules.oversPerInnings ?? 20
  const totalBalls = maxOvers * match.rules.ballsPerOver
  const mhData1 = buildManhattanData(inn1)
  const mhData2 = inn2 ? buildManhattanData(inn2) : undefined
  const battingName1 = inn1.battingTeamId === match.team1Id ? match.team1Name : match.team2Name
  const battingName2 = inn2
    ? inn2.battingTeamId === match.team1Id
      ? match.team1Name
      : match.team2Name
    : undefined
  const target2 = inn2?.target

  if (activeTab === "manhattan") {
    return (
      <ChartCard
        title="Manhattan Chart"
        description="Runs scored per over — bars show each over's contribution, with red dots for wickets"
      >
        <ManhattanChart
          innings={mhData1}
          innings2={mhData2}
          maxOvers={maxOvers}
          team1Name={battingName1}
          team2Name={battingName2}
          height={260}
        />
      </ChartCard>
    )
  }

  if (activeTab === "worm") {
    return (
      <ChartCard
        title="Worm Graph"
        description="Cumulative runs over each over — steeper slopes mean faster scoring; dots mark wickets"
      >
        <WormGraph
          innings1Balls={inn1.ballLog}
          innings2Balls={inn2?.ballLog}
          ballsPerOver={match.rules.ballsPerOver}
          maxOvers={maxOvers}
          team1Name={battingName1}
          team2Name={battingName2}
          target={inn2 ? inn1.totalRuns + 1 : undefined}
          height={260}
        />
      </ChartCard>
    )
  }

  if (activeTab === "runrate") {
    if (!inn2 || !target2) {
      return (
        <Card>
          <CardContent className="py-12 text-center space-y-2">
            <Activity className="size-8 text-muted-foreground/40 mx-auto" />
            <p className="text-sm text-muted-foreground">Run Rate chart requires a 2nd innings chase</p>
          </CardContent>
        </Card>
      )
    }
    return (
      <ChartCard
        title="Run Rate — 2nd Innings"
        description="Current Run Rate (CRR) vs Required Run Rate (RRR) — when CRR crosses above RRR the batting team is on track"
      >
        <RunRateGraph
          balls={inn2.ballLog}
          target={target2}
          ballsPerOver={match.rules.ballsPerOver}
          totalBalls={totalBalls}
          height={260}
        />
      </ChartCard>
    )
  }

  const inningsList = ([inn1, inn2].filter(Boolean) as Innings[])
  const teamNamesList = [battingName1, battingName2 ?? ""].filter(Boolean)

  if (activeTab === "dismissals") {
    return (
      <ChartCard
        title="Dismissal Breakdown"
        description="How wickets fell — grouped by dismissal type per innings"
      >
        <DismissalChart innings={inningsList} teamNames={teamNamesList} />
      </ChartCard>
    )
  }

  if (activeTab === "batting") {
    return (
      <ChartCard
        title="Batsman Scoring Breakdown"
        description="Balls faced split by dots, fours, sixes, and other scoring shots — batsmen with ≥5 balls only"
      >
        <BatsmanBreakdownChart innings={inningsList} teamNames={teamNamesList} />
      </ChartCard>
    )
  }

  if (activeTab === "bowling") {
    return (
      <ChartCard
        title="Bowler Dot Ball %"
        description="Percentage of legal deliveries that were dot balls — bowlers with ≥6 deliveries only"
      >
        <BowlerDotBallChart innings={inningsList} teamNames={teamNamesList} />
      </ChartCard>
    )
  }

  if (activeTab === "extras") {
    return (
      <ChartCard
        title="Extras Summary"
        description="Wides, no-balls, byes, and leg-byes conceded per innings"
      >
        <ExtrasChart innings={inningsList} teamNames={teamNamesList} />
      </ChartCard>
    )
  }

  return null
}

// ─── ChartsPage ───────────────────────────────────────────────────────────────

function ChartsPage() {
  const { matchId } = useParams({ from: "/charts/$matchId" })
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<ChartTabId>("manhattan")

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

  return (
    <div className="min-h-full bg-background relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <motion.div
          className="absolute -top-24 -right-20 w-80 h-80 rounded-full bg-blue-500/5"
          animate={{ scale: [1, 1.1, 1], x: [0, -10, 0], y: [0, 12, 0] }}
          transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-32 -left-16 w-56 h-56 rounded-full bg-violet-500/5"
          animate={{ scale: [1, 1.08, 1], y: [0, -8, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        />
      </div>

      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate({ to: "/scorecard/$matchId", params: { matchId } })}
            className="size-8 rounded-full bg-muted/50 flex items-center justify-center"
            aria-label="Back to scorecard"
          >
            <ArrowLeft className="size-4" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold truncate">
              {match.team1Name} vs {match.team2Name}
            </h1>
            <p className="text-[10px] text-muted-foreground">
              {formatMatchDateShort(match.date)} — Charts
            </p>
          </div>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
            {match.format}
          </Badge>
        </div>

        {/* Tab row */}
        <div className="flex gap-1 mt-3">
          {CHART_TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                activeTab === id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted"
              }`}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart area */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="px-4 py-5 pb-20"
      >
        <ChartsContent match={match} activeTab={activeTab} />

        {/* Hint */}
        <p className="text-center text-[11px] text-muted-foreground/60 mt-4">
          Hover or tap the chart to explore over-by-over data
        </p>
      </motion.div>
    </div>
  )
}

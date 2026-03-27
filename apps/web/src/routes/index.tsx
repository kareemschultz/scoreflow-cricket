import { useState } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useLiveQuery } from "dexie-react-hooks"
import { formatDistanceToNow, format } from "date-fns"
import { Activity, Plus, Trophy, TrendingUp, Users, Zap, Settings } from "lucide-react"
import { db } from "@/db/index"
import type { Match } from "@/types/cricket"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import { seedDemoMatch } from "@/lib/demo-seed"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatBadgeVariant(format: Match["format"]) {
  const map: Record<Match["format"], string> = {
    T20: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    ODI: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    TEST: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    CUSTOM: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  }
  return map[format]
}

function getInningsScore(match: Match, teamId: string): string {
  const innings = match.innings.filter((i) => i.battingTeamId === teamId)
  if (!innings.length) return "—"
  return innings
    .map((i) => {
      const overs =
        i.totalOvers !== undefined && match.format !== "TEST"
          ? ` (${i.totalOvers}${i.totalBalls ? `.${i.totalBalls}` : ""} ov)`
          : ""
      return `${i.totalRuns}/${i.totalWickets}${overs}`
    })
    .join(" & ")
}

// ─── Active Match Card ────────────────────────────────────────────────────────

function ActiveMatchCard({ match }: { match: Match }) {
  const navigate = useNavigate()
  const currentInnings = match.innings[match.currentInningsIndex]
  const battingTeam = currentInnings?.battingTeamId === match.team1Id
    ? match.team1Name
    : match.team2Name
  const score = currentInnings
    ? `${currentInnings.totalRuns}/${currentInnings.totalWickets}`
    : "0/0"
  const overs = currentInnings
    ? `${currentInnings.totalOvers}.${currentInnings.totalBalls} ov`
    : "0.0 ov"

  return (
    <Card className="border-emerald-500/40 bg-emerald-500/5">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Live Match
          </CardTitle>
          <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            LIVE
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-base font-semibold">
            {match.team1Name} vs {match.team2Name}
          </p>
          <p className="text-sm text-muted-foreground mt-0.5">
            {battingTeam} batting · {score} · {overs}
          </p>
        </div>
        <Button
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white"
          onClick={() => navigate({ to: "/scoring" })}
        >
          <Activity className="size-4 mr-2" />
          Resume Match
        </Button>
      </CardContent>
    </Card>
  )
}

// ─── Recent Match Card ────────────────────────────────────────────────────────

function RecentMatchCard({ match }: { match: Match }) {
  const navigate = useNavigate()
  const team1Score = getInningsScore(match, match.team1Id)
  const team2Score = getInningsScore(match, match.team2Id)

  return (
    <button
      className="w-full text-left"
      onClick={() => navigate({ to: "/history" })}
    >
      <Card className="hover:bg-muted/50 transition-colors">
        <CardContent className="py-3 px-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm truncate">
                  {match.team1Name}
                </span>
                <span className="text-xs text-muted-foreground shrink-0">vs</span>
                <span className="font-medium text-sm truncate">
                  {match.team2Name}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-xs text-muted-foreground">
                  {team1Score}
                </span>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-xs text-muted-foreground">
                  {team2Score}
                </span>
              </div>
              {match.result && (
                <p className="text-xs text-primary mt-1 font-medium">
                  {match.result}
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <Badge
                variant="outline"
                className={`text-[10px] px-1.5 py-0 ${formatBadgeVariant(match.format)}`}
              >
                {match.format}
              </Badge>
              <span className="text-[10px] text-muted-foreground">
                {formatDistanceToNow(new Date(match.date), { addSuffix: true })}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </button>
  )
}

// ─── Home Page ────────────────────────────────────────────────────────────────

function HomePage() {
  const navigate = useNavigate()
  const [loadingDemo, setLoadingDemo] = useState(false)

  async function handleLoadDemo() {
    setLoadingDemo(true)
    try {
      await seedDemoMatch()
    } finally {
      setLoadingDemo(false)
    }
  }

  const liveMatch = useLiveQuery(() =>
    db.matches.where("status").equals("live").first()
  )

  const recentMatches = useLiveQuery(async () => {
    const matches = await db.matches
      .where("status")
      .anyOf(["completed", "abandoned"])
      .reverse()
      .sortBy("date")
    return matches.slice(0, 3)
  })

  const totalMatches = useLiveQuery(() =>
    db.matches.where("status").anyOf(["completed", "abandoned"]).count()
  )

  const topBatsman = useLiveQuery(async () => {
    const all = await db.battingStats
      .where("format")
      .equals("ALL")
      .toArray()
    return all.sort((a, b) => b.runs - a.runs)[0] ?? null
  })

  const topBowler = useLiveQuery(async () => {
    const all = await db.bowlingStats
      .where("format")
      .equals("ALL")
      .toArray()
    return all.sort((a, b) => b.wickets - a.wickets)[0] ?? null
  })

  return (
    <div className="min-h-full bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold tracking-tight">CricketBook</h1>
            <p className="text-xs text-muted-foreground">
              {format(new Date(), "EEEE, d MMMM yyyy")}
            </p>
          </div>
          <button
            onClick={() => navigate({ to: "/settings" })}
            className="size-9 rounded-full bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors"
            aria-label="Settings"
          >
            <Settings className="size-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      <div className="px-4 py-4 space-y-5">
        {/* Active match */}
        {liveMatch && <ActiveMatchCard match={liveMatch} />}

        {/* Quick actions */}
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="h-14 flex flex-col gap-1 text-sm font-medium border-dashed"
              onClick={() => navigate({ to: "/new-match" })}
            >
              <Plus className="size-4" />
              New Match
            </Button>
            <Button
              variant="outline"
              className="h-14 flex flex-col gap-1 text-sm font-medium border-dashed"
              onClick={() => navigate({ to: "/tournaments" })}
            >
              <Trophy className="size-4" />
              Tournaments
            </Button>
          </div>
        </div>

        {/* Quick stats strip */}
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            All-Time Stats
          </h2>
          <div className="grid grid-cols-3 gap-2">
            <Card>
              <CardContent className="py-3 px-3 text-center">
                <p className="text-xl font-bold tabular-nums">
                  {totalMatches ?? 0}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                  Matches
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3 px-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-0.5">
                  <TrendingUp className="size-3 text-blue-400" />
                  <p className="text-sm font-bold tabular-nums truncate">
                    {topBatsman ? topBatsman.runs : "—"}
                  </p>
                </div>
                <p className="text-[10px] text-muted-foreground leading-tight truncate">
                  {topBatsman ? topBatsman.playerName.split(" ")[0] : "Top Bat"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3 px-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-0.5">
                  <Zap className="size-3 text-amber-400" />
                  <p className="text-sm font-bold tabular-nums truncate">
                    {topBowler ? topBowler.wickets : "—"}
                  </p>
                </div>
                <p className="text-[10px] text-muted-foreground leading-tight truncate">
                  {topBowler
                    ? topBowler.playerName.split(" ")[0]
                    : "Top Bowl"}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Recent matches */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Recent Matches
            </h2>
            {(recentMatches?.length ?? 0) > 0 && (
              <button
                className="text-xs text-primary font-medium"
                onClick={() => navigate({ to: "/history" })}
              >
                See all
              </button>
            )}
          </div>

          {recentMatches === undefined ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="py-3 px-4">
                    <div className="h-4 bg-muted rounded animate-pulse w-3/4 mb-2" />
                    <div className="h-3 bg-muted rounded animate-pulse w-1/2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : recentMatches.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center space-y-3">
                <Users className="size-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  No matches yet
                </p>
                <p className="text-xs text-muted-foreground">
                  Start a new match to see results here
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 border-dashed border-primary/40 text-primary text-xs"
                  onClick={handleLoadDemo}
                  disabled={loadingDemo}
                >
                  {loadingDemo ? "Loading…" : "Load Demo Match"}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {recentMatches.map((match) => (
                <RecentMatchCard key={match.id} match={match} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export const Route = createFileRoute("/")({
  component: HomePage,
})

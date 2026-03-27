import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useLiveQuery } from "dexie-react-hooks"
import { useState } from "react"
import { BarChart2, TrendingUp, Zap, Target, Star } from "lucide-react"
import { db } from "@/db/index"
import type { StatFilter, PlayerBattingStats, PlayerBowlingStats } from "@/types/cricket"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { Card, CardContent } from "@workspace/ui/components/card"

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/stats/")({
  component: StatsPage,
})

// ─── Format filter ────────────────────────────────────────────────────────────

const FORMAT_FILTERS: { label: string; value: StatFilter }[] = [
  { label: "All", value: "ALL" },
  { label: "T20", value: "T20" },
  { label: "ODI", value: "ODI" },
  { label: "Test", value: "TEST" },
  { label: "Custom", value: "CUSTOM" },
]

// ─── Top Run Scorers ──────────────────────────────────────────────────────────

function RunScorersTable({
  format,
  onSelectPlayer,
}: {
  format: StatFilter
  onSelectPlayer: (id: string) => void
}) {
  const stats = useLiveQuery(async () => {
    const all = await db.battingStats.toArray()
    const filtered =
      format === "ALL"
        ? all.filter((s) => s.format === "ALL")
        : all.filter((s) => s.format === format)
    return filtered.sort((a, b) => b.runs - a.runs).slice(0, 20) as PlayerBattingStats[]
  }, [format])

  if (!stats?.length) {
    return <EmptyState message="No batting stats yet" />
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs min-w-[320px]">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2 px-2 text-muted-foreground font-medium w-6">#</th>
            <th className="text-left py-2 px-2 text-muted-foreground font-medium">Player</th>
            <th className="text-right py-2 px-2 text-muted-foreground font-medium">M</th>
            <th className="text-right py-2 px-2 text-muted-foreground font-medium">Inn</th>
            <th className="text-right py-2 px-2 text-muted-foreground font-medium">Runs</th>
            <th className="text-right py-2 px-2 text-muted-foreground font-medium">HS</th>
            <th className="text-right py-2 px-2 text-muted-foreground font-medium">Avg</th>
            <th className="text-right py-2 px-2 text-muted-foreground font-medium">SR</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((s, i) => (
            <tr
              key={s.playerId}
              className="border-b border-border/40 hover:bg-muted/30 transition-colors cursor-pointer active:bg-muted/50"
              onClick={() => onSelectPlayer(s.playerId)}
            >
              <td className="py-2 px-2 text-muted-foreground tabular-nums">{i + 1}</td>
              <td className="py-2 px-2 font-medium">{s.playerName}</td>
              <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">{s.matches}</td>
              <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">{s.innings}</td>
              <td className="py-2 px-2 text-right tabular-nums font-semibold">{s.runs}</td>
              <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">
                {s.highScore}{s.highScoreNotOut ? "*" : ""}
              </td>
              <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">
                {isFinite(s.average) ? s.average.toFixed(1) : "—"}
              </td>
              <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">
                {s.strikeRate.toFixed(1)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Top Wicket Takers ────────────────────────────────────────────────────────

function WicketTakersTable({
  format,
  onSelectPlayer,
}: {
  format: StatFilter
  onSelectPlayer: (id: string) => void
}) {
  const stats = useLiveQuery(async () => {
    const all = await db.bowlingStats.toArray()
    const filtered =
      format === "ALL"
        ? all.filter((s) => s.format === "ALL")
        : all.filter((s) => s.format === format)
    return filtered.sort((a, b) => b.wickets - a.wickets).slice(0, 20) as PlayerBowlingStats[]
  }, [format])

  if (!stats?.length) {
    return <EmptyState message="No bowling stats yet" />
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs min-w-[320px]">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2 px-2 text-muted-foreground font-medium w-6">#</th>
            <th className="text-left py-2 px-2 text-muted-foreground font-medium">Player</th>
            <th className="text-right py-2 px-2 text-muted-foreground font-medium">M</th>
            <th className="text-right py-2 px-2 text-muted-foreground font-medium">Wkts</th>
            <th className="text-right py-2 px-2 text-muted-foreground font-medium">Overs</th>
            <th className="text-right py-2 px-2 text-muted-foreground font-medium">Avg</th>
            <th className="text-right py-2 px-2 text-muted-foreground font-medium">Eco</th>
            <th className="text-right py-2 px-2 text-muted-foreground font-medium">Best</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((s, i) => (
            <tr
              key={s.playerId}
              className="border-b border-border/40 hover:bg-muted/30 transition-colors cursor-pointer active:bg-muted/50"
              onClick={() => onSelectPlayer(s.playerId)}
            >
              <td className="py-2 px-2 text-muted-foreground tabular-nums">{i + 1}</td>
              <td className="py-2 px-2 font-medium">{s.playerName}</td>
              <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">{s.matches}</td>
              <td className="py-2 px-2 text-right tabular-nums font-semibold">{s.wickets}</td>
              <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">{s.overs.toFixed(0)}</td>
              <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">
                {isFinite(s.average) && s.average > 0 ? s.average.toFixed(1) : "—"}
              </td>
              <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">{s.economy.toFixed(2)}</td>
              <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">
                {s.bestWickets}/{s.bestRuns}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Best Batting Average ─────────────────────────────────────────────────────

function BattingAvgTable({
  format,
  onSelectPlayer,
}: {
  format: StatFilter
  onSelectPlayer: (id: string) => void
}) {
  const stats = useLiveQuery(async () => {
    const all = await db.battingStats.toArray()
    const filtered =
      format === "ALL"
        ? all.filter((s) => s.format === "ALL")
        : all.filter((s) => s.format === format)
    return filtered
      .filter((s) => s.innings >= 3 && isFinite(s.average))
      .sort((a, b) => b.average - a.average)
      .slice(0, 20) as PlayerBattingStats[]
  }, [format])

  if (!stats?.length) {
    return <EmptyState message="No qualifying batters (min 3 innings)" />
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs min-w-[280px]">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2 px-2 text-muted-foreground font-medium w-6">#</th>
            <th className="text-left py-2 px-2 text-muted-foreground font-medium">Player</th>
            <th className="text-right py-2 px-2 text-muted-foreground font-medium">Inn</th>
            <th className="text-right py-2 px-2 text-muted-foreground font-medium">Runs</th>
            <th className="text-right py-2 px-2 text-muted-foreground font-medium">NO</th>
            <th className="text-right py-2 px-2 text-muted-foreground font-medium">Avg</th>
            <th className="text-right py-2 px-2 text-muted-foreground font-medium">50s</th>
            <th className="text-right py-2 px-2 text-muted-foreground font-medium">100s</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((s, i) => (
            <tr
              key={s.playerId}
              className="border-b border-border/40 hover:bg-muted/30 transition-colors cursor-pointer active:bg-muted/50"
              onClick={() => onSelectPlayer(s.playerId)}
            >
              <td className="py-2 px-2 text-muted-foreground tabular-nums">{i + 1}</td>
              <td className="py-2 px-2 font-medium">{s.playerName}</td>
              <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">{s.innings}</td>
              <td className="py-2 px-2 text-right tabular-nums">{s.runs}</td>
              <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">{s.notOuts}</td>
              <td className="py-2 px-2 text-right tabular-nums font-semibold text-primary">
                {s.average.toFixed(2)}
              </td>
              <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">{s.fifties}</td>
              <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">{s.hundreds}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Best Economy ─────────────────────────────────────────────────────────────

function BestEconomyTable({
  format,
  onSelectPlayer,
}: {
  format: StatFilter
  onSelectPlayer: (id: string) => void
}) {
  const stats = useLiveQuery(async () => {
    const all = await db.bowlingStats.toArray()
    const filtered =
      format === "ALL"
        ? all.filter((s) => s.format === "ALL")
        : all.filter((s) => s.format === format)
    return filtered
      .filter((s) => s.overs >= 5 && s.economy > 0)
      .sort((a, b) => a.economy - b.economy)
      .slice(0, 20) as PlayerBowlingStats[]
  }, [format])

  if (!stats?.length) {
    return <EmptyState message="No qualifying bowlers (min 5 overs)" />
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs min-w-[280px]">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2 px-2 text-muted-foreground font-medium w-6">#</th>
            <th className="text-left py-2 px-2 text-muted-foreground font-medium">Player</th>
            <th className="text-right py-2 px-2 text-muted-foreground font-medium">Overs</th>
            <th className="text-right py-2 px-2 text-muted-foreground font-medium">Runs</th>
            <th className="text-right py-2 px-2 text-muted-foreground font-medium">Wkts</th>
            <th className="text-right py-2 px-2 text-muted-foreground font-medium">Eco</th>
            <th className="text-right py-2 px-2 text-muted-foreground font-medium">Dots</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((s, i) => (
            <tr
              key={s.playerId}
              className="border-b border-border/40 hover:bg-muted/30 transition-colors cursor-pointer active:bg-muted/50"
              onClick={() => onSelectPlayer(s.playerId)}
            >
              <td className="py-2 px-2 text-muted-foreground tabular-nums">{i + 1}</td>
              <td className="py-2 px-2 font-medium">{s.playerName}</td>
              <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">{s.overs.toFixed(0)}</td>
              <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">{s.runs}</td>
              <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">{s.wickets}</td>
              <td className="py-2 px-2 text-right tabular-nums font-semibold text-primary">
                {s.economy.toFixed(2)}
              </td>
              <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">{s.dots}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-10 flex flex-col items-center text-center">
      <Star className="size-8 text-muted-foreground/40 mb-3" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

// ─── StatsPage ────────────────────────────────────────────────────────────────

function StatsPage() {
  const navigate = useNavigate()
  const [format, setFormat] = useState<StatFilter>("ALL")

  function handleSelectPlayer(id: string) {
    navigate({ to: "/stats/$playerId", params: { playerId: id } })
  }

  return (
    <div className="min-h-full bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 space-y-3">
        <div className="flex items-center gap-2">
          <BarChart2 className="size-5 text-primary" />
          <h1 className="text-lg font-bold tracking-tight">Leaderboards</h1>
        </div>

        {/* Format filter pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
          {FORMAT_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFormat(f.value)}
              className={[
                "shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors border",
                format === f.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4">
        <Tabs defaultValue="runs">
          <TabsList className="w-full grid grid-cols-4 mb-4">
            <TabsTrigger value="runs" className="text-xs gap-1">
              <TrendingUp className="size-3" />
              Runs
            </TabsTrigger>
            <TabsTrigger value="wickets" className="text-xs gap-1">
              <Zap className="size-3" />
              Wickets
            </TabsTrigger>
            <TabsTrigger value="avg" className="text-xs gap-1">
              <Target className="size-3" />
              Avg
            </TabsTrigger>
            <TabsTrigger value="eco" className="text-xs gap-1">
              <Star className="size-3" />
              Eco
            </TabsTrigger>
          </TabsList>

          <TabsContent value="runs">
            <Card>
              <CardContent className="p-0 overflow-hidden">
                <RunScorersTable format={format} onSelectPlayer={handleSelectPlayer} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="wickets">
            <Card>
              <CardContent className="p-0 overflow-hidden">
                <WicketTakersTable format={format} onSelectPlayer={handleSelectPlayer} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="avg">
            <Card>
              <CardContent className="p-0 overflow-hidden">
                <BattingAvgTable format={format} onSelectPlayer={handleSelectPlayer} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="eco">
            <Card>
              <CardContent className="p-0 overflow-hidden">
                <BestEconomyTable format={format} onSelectPlayer={handleSelectPlayer} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

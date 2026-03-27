import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useLiveQuery } from "dexie-react-hooks"
import { useState } from "react"
import { motion } from "framer-motion"
import { BarChart2, TrendingUp, Zap, Target, Star } from "lucide-react"

const rowVariants = {
  hidden: { opacity: 0, x: -6 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { duration: 0.18, delay: i * 0.03, ease: "easeOut" as const },
  }),
}
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
            <th title="Matches" className="text-right py-2 px-2 text-muted-foreground font-medium cursor-help">M</th>
            <th title="Innings" className="text-right py-2 px-2 text-muted-foreground font-medium cursor-help">Inn</th>
            <th className="text-right py-2 px-2 text-muted-foreground font-medium">Runs</th>
            <th title="Highest Score" className="text-right py-2 px-2 text-muted-foreground font-medium cursor-help">HS</th>
            <th title="Batting Average — runs per dismissal" className="text-right py-2 px-2 text-muted-foreground font-medium cursor-help">Avg</th>
            <th title="Strike Rate — runs per 100 balls" className="text-right py-2 px-2 text-muted-foreground font-medium cursor-help">SR</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((s, i) => (
            <motion.tr
              key={s.playerId}
              custom={i}
              variants={rowVariants}
              initial="hidden"
              animate="visible"
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
            </motion.tr>
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
            <th title="Matches" className="text-right py-2 px-2 text-muted-foreground font-medium cursor-help">M</th>
            <th className="text-right py-2 px-2 text-muted-foreground font-medium">Wkts</th>
            <th className="text-right py-2 px-2 text-muted-foreground font-medium">Overs</th>
            <th title="Bowling Average — runs per wicket" className="text-right py-2 px-2 text-muted-foreground font-medium cursor-help">Avg</th>
            <th title="Economy Rate — runs conceded per over" className="text-right py-2 px-2 text-muted-foreground font-medium cursor-help">Eco</th>
            <th title="Best bowling figures in a single innings" className="text-right py-2 px-2 text-muted-foreground font-medium cursor-help">Best</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((s, i) => (
            <motion.tr
              key={s.playerId}
              custom={i}
              variants={rowVariants}
              initial="hidden"
              animate="visible"
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
            </motion.tr>
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
            <motion.tr
              key={s.playerId}
              custom={i}
              variants={rowVariants}
              initial="hidden"
              animate="visible"
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
            </motion.tr>
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
            <motion.tr
              key={s.playerId}
              custom={i}
              variants={rowVariants}
              initial="hidden"
              animate="visible"
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
            </motion.tr>
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
    <div className="min-h-full bg-background relative overflow-hidden">
      {/* Animated background — podium ascending orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <motion.div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-amber-500/5"
          animate={{ scale: [1, 1.2, 1], y: [0, -20, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute top-20 -left-16 w-44 h-44 rounded-full bg-blue-500/5"
          animate={{ scale: [1, 1.1, 1], x: [0, 8, 0], y: [0, -8, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
        />
        <motion.div
          className="absolute top-1/3 -right-12 w-36 h-36 rounded-full bg-emerald-500/5"
          animate={{ scale: [1, 1.12, 1], x: [0, -6, 0] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 3 }}
        />
        {/* Cricket ball bottom right */}
        <motion.svg
          className="absolute bottom-8 right-6 opacity-[0.06]"
          width="44" height="44" viewBox="0 0 44 44"
          animate={{ rotate: [0, 25, 0, -25, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        >
          <circle cx="22" cy="22" r="20" fill="#ef4444" />
          <path d="M4 22 Q13 13 22 22 Q31 31 40 22" stroke="white" strokeWidth="1.5" fill="none" />
          <path d="M4 22 Q13 31 22 22 Q31 13 40 22" stroke="white" strokeWidth="1.5" fill="none" />
        </motion.svg>
        {/* Rising rank bars */}
        {[
          { left: "8%", height: "30%", color: "bg-amber-500/8", delay: 0 },
          { left: "22%", height: "50%", color: "bg-blue-500/6", delay: 0.5 },
          { left: "36%", height: "40%", color: "bg-emerald-500/6", delay: 1 },
          { left: "72%", height: "60%", color: "bg-amber-500/6", delay: 0.3 },
          { left: "86%", height: "35%", color: "bg-violet-500/6", delay: 0.8 },
        ].map((b, i) => (
          <motion.div
            key={i}
            className={`absolute bottom-0 w-1.5 rounded-t-full ${b.color}`}
            style={{ left: b.left, height: b.height }}
            animate={{ scaleY: [0.6, 1, 0.6], opacity: [0.4, 0.7, 0.4] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: b.delay }}
          />
        ))}
      </div>
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

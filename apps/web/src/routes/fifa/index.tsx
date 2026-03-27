import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useLiveQuery } from "dexie-react-hooks"
import { format } from "date-fns"
import { Plus, Trophy } from "lucide-react"
import { motion } from "framer-motion"
import { db } from "@/db/index"
import { computeFifaPlayerStats } from "@/lib/fifa-stats"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: "easeOut" as const } },
}

function PlayerAvatar({ name, color, size = "sm" }: { name: string; color: string; size?: "sm" | "md" }) {
  const initials = name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)
  const sizeClass = size === "md" ? "size-8 text-sm" : "size-6 text-xs"
  return (
    <div
      className={cn("rounded-full flex items-center justify-center font-bold text-white shrink-0", sizeClass)}
      style={{ backgroundColor: color }}
    >
      {initials}
    </div>
  )
}

function FormPill({ result }: { result: "W" | "D" | "L" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center size-5 rounded-full text-[9px] font-bold text-white",
        result === "W" && "bg-emerald-500",
        result === "D" && "bg-amber-500",
        result === "L" && "bg-red-500"
      )}
    >
      {result}
    </span>
  )
}

function LeaderboardTable() {
  const players = useLiveQuery(() => db.fifaPlayers.orderBy("createdAt").toArray())
  const matches = useLiveQuery(() => db.fifaMatches.toArray())

  if (!players || !matches) {
    return (
      <div className="space-y-1">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 bg-muted rounded animate-pulse" />
        ))}
      </div>
    )
  }

  if (players.length === 0 || matches.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Trophy className="size-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Add players and record matches to see the leaderboard</p>
        </CardContent>
      </Card>
    )
  }

  const stats = computeFifaPlayerStats(players, matches)

  return (
    <div className="overflow-x-auto -mx-4">
      <table className="w-full text-xs min-w-[520px] px-4">
        <thead>
          <tr className="text-muted-foreground border-b border-border">
            <th className="pl-4 pr-2 py-2 text-left font-medium w-8">#</th>
            <th className="px-2 py-2 text-left font-medium">Player</th>
            <th className="px-2 py-2 text-center font-medium">P</th>
            <th className="px-2 py-2 text-center font-medium">W</th>
            <th className="px-2 py-2 text-center font-medium">D</th>
            <th className="px-2 py-2 text-center font-medium">L</th>
            <th className="px-2 py-2 text-center font-medium">GF</th>
            <th className="px-2 py-2 text-center font-medium">GA</th>
            <th className="px-2 py-2 text-center font-medium">GD</th>
            <th className="px-2 py-2 text-center font-bold">Pts</th>
            <th className="pr-4 pl-2 py-2 text-center font-medium">Form</th>
          </tr>
        </thead>
        <motion.tbody initial="hidden" animate="visible" variants={containerVariants}>
          {stats.map((s, idx) => (
            <motion.tr
              key={s.playerId}
              variants={itemVariants}
              className={cn("border-b border-border/50 transition-colors", idx === 0 && "bg-primary/5")}
            >
              <td className="pl-4 pr-2 py-2.5 text-muted-foreground font-medium">{idx + 1}</td>
              <td className="px-2 py-2.5">
                <div className="flex items-center gap-2">
                  <PlayerAvatar name={s.name} color={s.colorHex} />
                  <span className="font-medium truncate max-w-[100px]">{s.name}</span>
                </div>
              </td>
              <td className="px-2 py-2.5 text-center tabular-nums">{s.played}</td>
              <td className="px-2 py-2.5 text-center tabular-nums text-emerald-500">{s.won}</td>
              <td className="px-2 py-2.5 text-center tabular-nums text-amber-500">{s.drawn}</td>
              <td className="px-2 py-2.5 text-center tabular-nums text-red-500">{s.lost}</td>
              <td className="px-2 py-2.5 text-center tabular-nums">{s.goalsFor}</td>
              <td className="px-2 py-2.5 text-center tabular-nums">{s.goalsAgainst}</td>
              <td className="px-2 py-2.5 text-center tabular-nums">
                <span className={s.goalDifference > 0 ? "text-emerald-500" : s.goalDifference < 0 ? "text-red-500" : ""}>
                  {s.goalDifference > 0 ? `+${s.goalDifference}` : s.goalDifference}
                </span>
              </td>
              <td className="px-2 py-2.5 text-center tabular-nums font-bold text-primary">{s.points}</td>
              <td className="pr-4 pl-2 py-2.5">
                <div className="flex items-center justify-center gap-0.5">
                  {s.form.length === 0
                    ? <span className="text-muted-foreground">—</span>
                    : s.form.map((r, i) => <FormPill key={i} result={r} />)
                  }
                </div>
              </td>
            </motion.tr>
          ))}
        </motion.tbody>
      </table>
    </div>
  )
}

function RecentMatches() {
  const navigate = useNavigate()

  const data = useLiveQuery(async () => {
    const matches = await db.fifaMatches.orderBy("date").reverse().limit(5).toArray()
    const players = await db.fifaPlayers.toArray()
    const playerMap = new Map(players.map((p) => [p.id, p]))
    return matches.map((m) => ({
      ...m,
      p1: playerMap.get(m.player1Id),
      p2: playerMap.get(m.player2Id),
    }))
  })

  if (!data || data.length === 0) return null

  return (
    <div className="space-y-2">
      {data.map((m) => {
        const winner =
          m.player1Score > m.player2Score ? m.p1?.name
          : m.player2Score > m.player1Score ? m.p2?.name
          : null

        return (
          <motion.div key={m.id} whileTap={{ scale: 0.98 }}>
            <Card className="hover:bg-muted/50 transition-colors">
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    {m.p1 && <PlayerAvatar name={m.p1.name} color={m.p1.colorHex} />}
                    <span className="font-semibold text-sm tabular-nums">{m.player1Score} – {m.player2Score}</span>
                    {m.p2 && <PlayerAvatar name={m.p2.name} color={m.p2.colorHex} />}
                    <span className="text-sm font-medium truncate min-w-0">
                      {m.p1?.name ?? "?"} vs {m.p2?.name ?? "?"}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-muted-foreground">{format(new Date(m.date), "d MMM")}</p>
                    {winner
                      ? <p className="text-[10px] text-emerald-500 font-medium">{winner} wins</p>
                      : <p className="text-[10px] text-amber-500 font-medium">Draw</p>
                    }
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )
      })}
      <button
        className="text-xs text-primary font-medium w-full text-center py-1"
        onClick={() => navigate({ to: "/fifa/matches" })}
      >
        See all matches →
      </button>
    </div>
  )
}

function FifaHomePage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-full bg-background relative overflow-hidden">
      {/* Animated background — football pitch */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
        {/* Centre circle */}
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full border border-emerald-500/10"
          animate={{ scale: [1, 1.04, 1], opacity: [0.5, 0.9, 0.5] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full border border-emerald-500/15"
          animate={{ scale: [1, 1.5, 1] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* Halfway line */}
        <motion.div
          className="absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/10 to-transparent"
          animate={{ opacity: [0.4, 0.8, 0.4] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* Green field orbs */}
        <motion.div
          className="absolute -top-20 -left-20 w-56 h-56 rounded-full bg-emerald-500/5"
          animate={{ scale: [1, 1.1, 1], x: [0, 8, 0], y: [0, 10, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-16 -right-16 w-64 h-64 rounded-full bg-emerald-500/5"
          animate={{ scale: [1, 1.12, 1], x: [0, -6, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        />
        {/* Football SVG */}
        <motion.svg
          className="absolute top-16 right-8 opacity-[0.07]"
          width="44" height="44" viewBox="0 0 44 44"
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        >
          <circle cx="22" cy="22" r="20" fill="white" />
          <polygon points="22,8 28,14 26,22 18,22 16,14" fill="#1a1a1a" />
          <polygon points="8,18 14,14 18,22 14,28 8,26" fill="#1a1a1a" />
          <polygon points="8,26 14,28 16,36 10,38 6,32" fill="#1a1a1a" />
          <polygon points="22,36 18,30 26,30 28,36 22,40" fill="#1a1a1a" />
          <polygon points="36,26 38,32 34,38 28,36 26,30" fill="#1a1a1a" />
          <polygon points="36,18 30,22 26,14 30,10 36,14" fill="#1a1a1a" />
        </motion.svg>
        {/* Goal post arc — bottom */}
        <motion.svg
          className="absolute -bottom-8 left-1/2 -translate-x-1/2 opacity-[0.06]"
          width="120" height="60" viewBox="0 0 120 60"
          animate={{ opacity: [0.04, 0.08, 0.04] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        >
          <path d="M0 60 L0 10 L120 10 L120 60" stroke="#4ade80" strokeWidth="3" fill="none" />
          <line x1="0" y1="30" x2="120" y2="30" stroke="#4ade80" strokeWidth="1.5" strokeDasharray="4 3" />
        </motion.svg>
      </div>
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
              <span>⚽</span> FIFA Tracker
            </h1>
            <p className="text-xs text-muted-foreground">{format(new Date(), "EEEE, d MMMM yyyy")}</p>
          </div>
          <motion.div whileTap={{ scale: 0.95 }}>
            <Button size="sm" onClick={() => navigate({ to: "/fifa/matches/new" })} className="gap-1">
              <Plus className="size-4" />
              Record
            </Button>
          </motion.div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-5">
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Leaderboard</h2>
          <Card>
            <CardContent className="px-0 pb-2 pt-0">
              <LeaderboardTable />
            </CardContent>
          </Card>
        </section>

        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Recent Matches</h2>
          <RecentMatches />
        </section>
      </div>
    </div>
  )
}

export const Route = createFileRoute("/fifa/")({
  component: FifaHomePage,
})

import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useLiveQuery } from "dexie-react-hooks"
import { format } from "date-fns"
import { ArrowLeft } from "lucide-react"
import { motion } from "framer-motion"
import { db } from "@/db/index"
import { computeFifaPlayerStats, computeFifaH2H } from "@/lib/fifa-stats"
import { Card, CardContent } from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: "easeOut" as const } },
}

function FormPill({ result }: { result: "W" | "D" | "L" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center size-6 rounded-full text-[10px] font-bold text-white",
        result === "W" && "bg-emerald-500",
        result === "D" && "bg-amber-500",
        result === "L" && "bg-red-500"
      )}
    >
      {result}
    </span>
  )
}

function FifaPlayerProfilePage() {
  const { playerId } = Route.useParams()
  const navigate = useNavigate()

  const data = useLiveQuery(async () => {
    const player = await db.fifaPlayers.get(playerId)
    const allPlayers = await db.fifaPlayers.toArray()
    const allMatches = await db.fifaMatches.toArray()

    if (!player) return null

    const stats = computeFifaPlayerStats(allPlayers, allMatches)
    const playerStats = stats.find((s) => s.playerId === playerId)
    const h2h = computeFifaH2H(playerId, allPlayers, allMatches)

    const playerMatches = allMatches
      .filter((m) => m.player1Id === playerId || m.player2Id === playerId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5)

    const playerMap = new Map(allPlayers.map((p) => [p.id, p]))

    const last10 = allMatches
      .filter((m) => m.player1Id === playerId || m.player2Id === playerId)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-10)
      .map((m): "W" | "D" | "L" => {
        const myScore = m.player1Id === playerId ? m.player1Score : m.player2Score
        const oppScore = m.player1Id === playerId ? m.player2Score : m.player1Score
        return myScore > oppScore ? "W" : myScore < oppScore ? "L" : "D"
      })

    return { player, playerStats, h2h, playerMatches, playerMap, last10 }
  })

  if (!data) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin size-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!data.player) {
    return (
      <div className="px-4 py-8 text-center">
        <p className="text-muted-foreground">Player not found</p>
      </div>
    )
  }

  const { player, playerStats: s, h2h, playerMatches, playerMap, last10 } = data
  const initials = player.name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2)

  return (
    <div className="min-h-full bg-background relative overflow-hidden">
      {/* Animated background — player spotlight */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <motion.div
          className="absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full bg-primary/6"
          animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute top-1/2 -left-16 w-44 h-44 rounded-full bg-blue-500/5"
          animate={{ scale: [1, 1.1, 1], x: [0, 8, 0] }}
          transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        />
        <motion.div
          className="absolute bottom-16 -right-12 w-40 h-40 rounded-full bg-emerald-500/5"
          animate={{ scale: [1, 1.12, 1], y: [0, -10, 0] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        />
        {/* Stat lines */}
        {[25, 50, 75].map((pct, i) => (
          <motion.div
            key={i}
            className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/6 to-transparent"
            style={{ top: `${pct}%` }}
            animate={{ opacity: [0.2, 0.5, 0.2] }}
            transition={{ duration: 5 + i, repeat: Infinity, ease: "easeInOut", delay: i }}
          />
        ))}
      </div>
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate({ to: "/fifa/players" as "/fifa/players" })}
            className="size-8 rounded-full bg-muted/50 flex items-center justify-center"
          >
            <ArrowLeft className="size-4" />
          </button>
          <h1 className="text-lg font-bold">{player.name}</h1>
        </div>
      </div>

      <motion.div className="px-4 py-4 space-y-4" initial="hidden" animate="visible" variants={containerVariants}>
        {/* Player header */}
        <motion.div variants={itemVariants} className="flex items-center gap-4">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            className="size-20 rounded-full flex items-center justify-center font-bold text-white text-2xl shrink-0"
            style={{ backgroundColor: player.colorHex }}
          >
            {initials}
          </motion.div>
          <div>
            <h2 className="text-xl font-bold">{player.name}</h2>
            {s && (
              <p className="text-sm text-muted-foreground">
                {s.points} points · {s.winRate}% win rate
              </p>
            )}
          </div>
        </motion.div>

        {/* Stats grid */}
        {s && (
          <motion.div variants={itemVariants}>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Stats</h3>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "P", value: s.played },
                { label: "W", value: s.won, color: "text-emerald-500" },
                { label: "D", value: s.drawn, color: "text-amber-500" },
                { label: "L", value: s.lost, color: "text-red-500" },
              ].map((stat) => (
                <Card key={stat.label}>
                  <CardContent className="py-3 px-2 text-center">
                    <p className={cn("text-xl font-bold tabular-nums", stat.color)}>{stat.value}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{stat.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {[
                { label: "Pts", value: s.points, color: "text-primary" },
                { label: "GD", value: s.goalDifference > 0 ? `+${s.goalDifference}` : s.goalDifference, color: s.goalDifference > 0 ? "text-emerald-500" : s.goalDifference < 0 ? "text-red-500" : "" },
                { label: "Win %", value: `${s.winRate}%` },
              ].map((stat) => (
                <Card key={stat.label}>
                  <CardContent className="py-3 px-2 text-center">
                    <p className={cn("text-xl font-bold tabular-nums", stat.color)}>{stat.value}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{stat.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </motion.div>
        )}

        {/* Form (last 10) */}
        {last10.length > 0 && (
          <motion.div variants={itemVariants}>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Form (Last 10)</h3>
            <Card>
              <CardContent className="py-4 px-4">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {last10.map((r, i) => (
                    <motion.div
                      key={i}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: i * 0.04, type: "spring", stiffness: 300 }}
                    >
                      <FormPill result={r} />
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Head-to-Head */}
        {h2h.length > 0 && (
          <motion.div variants={itemVariants}>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Head-to-Head</h3>
            <Card>
              <CardContent className="px-0 pb-2 pt-0">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground border-b border-border">
                      <th className="pl-4 pr-2 py-2 text-left font-medium">Opponent</th>
                      <th className="px-2 py-2 text-center font-medium text-emerald-500">W</th>
                      <th className="px-2 py-2 text-center font-medium text-amber-500">D</th>
                      <th className="px-2 py-2 text-center font-medium text-red-500">L</th>
                      <th className="px-2 py-2 text-center font-medium">GF</th>
                      <th className="pr-4 pl-2 py-2 text-center font-medium">GA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {h2h.map((record) => (
                      <tr key={record.opponentId} className="border-b border-border/40">
                        <td className="pl-4 pr-2 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="size-5 rounded-full shrink-0" style={{ backgroundColor: record.opponentColor }} />
                            <span className="font-medium truncate max-w-[80px]">{record.opponentName}</span>
                          </div>
                        </td>
                        <td className="px-2 py-2.5 text-center tabular-nums text-emerald-500 font-medium">{record.won}</td>
                        <td className="px-2 py-2.5 text-center tabular-nums text-amber-500 font-medium">{record.drawn}</td>
                        <td className="px-2 py-2.5 text-center tabular-nums text-red-500 font-medium">{record.lost}</td>
                        <td className="px-2 py-2.5 text-center tabular-nums">{record.goalsFor}</td>
                        <td className="pr-4 pl-2 py-2.5 text-center tabular-nums">{record.goalsAgainst}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Recent Matches */}
        {playerMatches.length > 0 && (
          <motion.div variants={itemVariants}>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Recent Matches</h3>
            <div className="space-y-2">
              {playerMatches.map((m) => {
                const opp = m.player1Id === playerId ? playerMap.get(m.player2Id) : playerMap.get(m.player1Id)
                const myScore = m.player1Id === playerId ? m.player1Score : m.player2Score
                const oppScore = m.player1Id === playerId ? m.player2Score : m.player1Score
                const result: "W" | "D" | "L" = myScore > oppScore ? "W" : myScore < oppScore ? "L" : "D"

                return (
                  <Card key={m.id}>
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="size-6 rounded-full shrink-0" style={{ backgroundColor: player.colorHex }} />
                          <span className="font-bold tabular-nums text-sm">{myScore} – {oppScore}</span>
                          <div className="size-6 rounded-full shrink-0" style={{ backgroundColor: opp?.colorHex ?? "#6b7280" }} />
                          <span className="text-sm text-muted-foreground">{opp?.name ?? "?"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <FormPill result={result} />
                          <span className="text-[10px] text-muted-foreground">{format(new Date(m.date), "d MMM")}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </motion.div>
        )}

        {(!s || s.played === 0) && (
          <motion.div variants={itemVariants}>
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground text-sm">No matches recorded yet for this player</p>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}

export const Route = createFileRoute("/fifa/players/$playerId")({
  component: FifaPlayerProfilePage,
})

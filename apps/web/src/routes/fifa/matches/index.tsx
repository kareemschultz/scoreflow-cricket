import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useLiveQuery } from "dexie-react-hooks"
import { formatMatchDateShort } from "@/lib/date-utils"
import { Plus } from "lucide-react"
import { motion } from "framer-motion"
import { db } from "@/db/index"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.04 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: "easeOut" as const } },
}

function PlayerAvatar({ name, color }: { name: string; color: string }) {
  const initials = name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)
  return (
    <div
      className="size-7 rounded-full flex items-center justify-center font-bold text-white text-xs shrink-0"
      style={{ backgroundColor: color }}
    >
      {initials}
    </div>
  )
}

function FifaMatchesPage() {
  const navigate = useNavigate()

  const data = useLiveQuery(async () => {
    const matches = await db.fifaMatches.orderBy("date").reverse().toArray()
    const players = await db.fifaPlayers.toArray()
    const playerMap = new Map(players.map((p) => [p.id, p]))
    return matches.map((m) => ({
      ...m,
      p1: playerMap.get(m.player1Id),
      p2: playerMap.get(m.player2Id),
    }))
  })

  return (
    <div className="min-h-full bg-background relative overflow-hidden">
      {/* Animated background — stadium / match history */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <motion.div
          className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-blue-500/5"
          animate={{ scale: [1, 1.1, 1], x: [0, -8, 0], y: [0, 10, 0] }}
          transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute top-1/2 -left-20 w-52 h-52 rounded-full bg-emerald-500/4"
          animate={{ scale: [1, 1.08, 1], y: [0, -10, 0] }}
          transition={{ duration: 13, repeat: Infinity, ease: "easeInOut", delay: 3 }}
        />
        <motion.div
          className="absolute -bottom-12 right-8 w-48 h-48 rounded-full bg-violet-500/4"
          animate={{ scale: [1, 1.12, 1], x: [0, -6, 0] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        />
        {/* Scoreboard lines */}
        {[18, 42, 66, 84].map((pct, i) => (
          <motion.div
            key={i}
            className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/7 to-transparent"
            style={{ top: `${pct}%` }}
            animate={{ opacity: [0.2, 0.5, 0.2] }}
            transition={{ duration: 5 + i, repeat: Infinity, ease: "easeInOut", delay: i * 0.7 }}
          />
        ))}
        {/* Rolling football */}
        <motion.svg
          className="absolute bottom-16 right-6 opacity-[0.07]"
          width="36" height="36" viewBox="0 0 36 36"
          animate={{ rotate: [0, 360], x: [0, -20, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        >
          <circle cx="18" cy="18" r="16" fill="white" />
          <polygon points="18,6 22,11 20,18 16,18 14,11" fill="#1a1a1a" />
          <polygon points="7,15 11,11 14,18 11,22 7,21" fill="#1a1a1a" />
          <polygon points="29,15 25,11 22,18 25,22 29,21" fill="#1a1a1a" />
          <polygon points="18,30 14,25 22,25 24,30 18,32" fill="#1a1a1a" />
        </motion.svg>
      </div>
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold tracking-tight">Match History</h1>
          <Button size="sm" onClick={() => navigate({ to: "/fifa/matches/new" })} className="gap-1">
            <Plus className="size-4" />
            New Match
          </Button>
        </div>
      </div>

      <div className="px-4 py-4">
        {!data ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : data.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center space-y-3">
              <p className="text-3xl">⚽</p>
              <p className="text-sm font-medium">No matches yet</p>
              <p className="text-xs text-muted-foreground">Record your first FIFA match to get started</p>
              <Button onClick={() => navigate({ to: "/fifa/matches/new" })} variant="outline" className="mt-2">
                <Plus className="size-4 mr-2" />
                Record First Match
              </Button>
            </CardContent>
          </Card>
        ) : (
          <motion.div className="space-y-2" initial="hidden" animate="visible" variants={containerVariants}>
            {data.map((m) => {
              const p1Wins = m.player1Score > m.player2Score
              const p2Wins = m.player2Score > m.player1Score
              const isDraw = m.player1Score === m.player2Score

              return (
                <motion.div key={m.id} variants={itemVariants} whileTap={{ scale: 0.99 }}>
                  <Card className="hover:bg-muted/40 transition-colors">
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {m.p1 && <PlayerAvatar name={m.p1.name} color={m.p1.colorHex} />}
                          <span className={cn("text-sm font-medium truncate", p1Wins && "text-emerald-500")}>
                            {m.p1?.name ?? "?"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={cn("text-lg font-bold tabular-nums", p1Wins && "text-emerald-500", isDraw && "text-amber-500")}>
                            {m.player1Score}
                          </span>
                          <span className="text-muted-foreground text-sm">–</span>
                          <span className={cn("text-lg font-bold tabular-nums", p2Wins && "text-emerald-500", isDraw && "text-amber-500")}>
                            {m.player2Score}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                          <span className={cn("text-sm font-medium truncate text-right", p2Wins && "text-emerald-500")}>
                            {m.p2?.name ?? "?"}
                          </span>
                          {m.p2 && <PlayerAvatar name={m.p2.name} color={m.p2.colorHex} />}
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-[10px] text-muted-foreground">
                          {formatMatchDateShort(m.date)}
                        </span>
                        <span className={cn("text-[10px] font-semibold", (p1Wins || p2Wins) && "text-emerald-500", isDraw && "text-amber-500")}>
                          {isDraw ? "Draw" : `${p1Wins ? m.p1?.name : m.p2?.name} wins`}
                        </span>
                      </div>
                      {m.notes && <p className="text-[10px] text-muted-foreground mt-1 italic">{m.notes}</p>}
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </motion.div>
        )}
      </div>
    </div>
  )
}

export const Route = createFileRoute("/fifa/matches/")({
  component: FifaMatchesPage,
})

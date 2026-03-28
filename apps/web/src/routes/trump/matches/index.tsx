import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useLiveQuery } from "dexie-react-hooks"
import { format } from "date-fns"
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

function TeamAvatar({ name, color }: { name: string; color: string }) {
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

function TrumpMatchesPage() {
  const navigate = useNavigate()

  const data = useLiveQuery(async () => {
    const matches = await db.trumpMatches.orderBy("date").reverse().toArray()
    const teams = await db.trumpTeams.toArray()
    const teamMap = new Map(teams.map((t) => [t.id, t]))
    return matches.map((m) => ({
      ...m,
      t1: teamMap.get(m.team1Id),
      t2: teamMap.get(m.team2Id),
    }))
  })

  return (
    <div className="min-h-full bg-background relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <motion.div
          className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-red-500/5"
          animate={{ scale: [1, 1.1, 1], x: [0, -8, 0] }}
          transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold tracking-tight">Match History</h1>
          <Button size="sm" onClick={() => navigate({ to: "/trump/matches/new" })} className="gap-1">
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
              <p className="text-3xl">{"\u2660"}</p>
              <p className="text-sm font-medium">No matches yet</p>
              <p className="text-xs text-muted-foreground">Record your first trump game to get started</p>
              <Button onClick={() => navigate({ to: "/trump/matches/new" })} variant="outline" className="mt-2">
                <Plus className="size-4 mr-2" />
                Record First Match
              </Button>
            </CardContent>
          </Card>
        ) : (
          <motion.div className="space-y-2" initial="hidden" animate="visible" variants={containerVariants}>
            {data.map((m) => {
              const t1Wins = m.winnerId === m.team1Id

              return (
                <motion.div key={m.id} variants={itemVariants} whileTap={{ scale: 0.99 }}>
                  <Card className="hover:bg-muted/40 transition-colors">
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {m.t1 && <TeamAvatar name={m.t1.name} color={m.t1.colorHex} />}
                          <span className={cn("text-sm font-medium truncate", t1Wins && "text-emerald-500")}>
                            {m.t1?.name ?? "?"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={cn("text-lg font-bold tabular-nums", t1Wins && "text-emerald-500")}>
                            {m.team1Score}
                          </span>
                          <span className="text-muted-foreground text-sm">-</span>
                          <span className={cn("text-lg font-bold tabular-nums", !t1Wins && m.winnerId && "text-emerald-500")}>
                            {m.team2Score}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                          <span className={cn("text-sm font-medium truncate text-right", !t1Wins && m.winnerId && "text-emerald-500")}>
                            {m.t2?.name ?? "?"}
                          </span>
                          {m.t2 && <TeamAvatar name={m.t2.name} color={m.t2.colorHex} />}
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-[10px] text-muted-foreground">
                          {format(new Date(m.date), "d MMM yyyy")} &middot; {m.hands.length} hands &middot; To {m.targetScore}
                        </span>
                        <span className="text-[10px] font-semibold text-emerald-500">
                          {t1Wins ? m.t1?.name : m.t2?.name} wins
                        </span>
                      </div>
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

export const Route = createFileRoute("/trump/matches/")({
  component: TrumpMatchesPage,
})

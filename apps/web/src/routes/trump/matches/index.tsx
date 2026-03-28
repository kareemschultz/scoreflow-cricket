import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useLiveQuery } from "dexie-react-hooks"
import { formatMatchDateShort } from "@/lib/date-utils"
import { Plus } from "lucide-react"
import { motion } from "framer-motion"
import { useState } from "react"
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
  const [selectedFilter, setSelectedFilter] = useState<string>("all")

  const data = useLiveQuery(async () => {
    const matches = await db.trumpMatches.orderBy("date").reverse().toArray()
    const teams = await db.trumpTeams.toArray()
    const tournaments = await db.trumpTournaments.toArray()
    const teamMap = new Map(teams.map((t) => [t.id, t]))
    const tournamentMap = new Map(tournaments.map((tournament) => [tournament.id, tournament]))
    return {
      tournaments: tournaments.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
      matches: matches.map((m) => ({
        ...m,
        t1: teamMap.get(m.team1Id),
        t2: teamMap.get(m.team2Id),
        tournament: m.tournamentId ? tournamentMap.get(m.tournamentId) : undefined,
      })),
    }
  })

  const tournaments = data?.tournaments ?? []
  const activeFilter =
    selectedFilter === "all" ||
    selectedFilter === "casual" ||
    tournaments.some((tournament) => tournament.id === selectedFilter)
      ? selectedFilter
      : "all"
  const filteredMatches = (data?.matches ?? []).filter((match) => {
    if (activeFilter === "all") return true
    if (activeFilter === "casual") return !match.tournamentId
    return match.tournamentId === activeFilter
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
          <Button
            size="sm"
            onClick={() => navigate({ to: "/trump/matches/new", search: { tournamentId: undefined, fixtureId: undefined } })}
            className="gap-1"
          >
            <Plus className="size-4" />
            New Match
          </Button>
        </div>
      </div>

      <div className="px-4 py-4">
        {tournaments.length > 0 && (
          <div className="mb-4 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Filter Matches
            </p>
            <div className="-mx-4 overflow-x-auto px-4">
              <div className="flex min-w-max gap-2">
                {[
                  { id: "all", label: "All Matches" },
                  { id: "casual", label: "Casual" },
                  ...tournaments.map((tournament) => ({
                    id: tournament.id,
                    label: tournament.name,
                  })),
                ].map((filter) => (
                  <button
                    key={filter.id}
                    onClick={() => setSelectedFilter(filter.id)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                      activeFilter === filter.id
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-muted/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                    )}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {filteredMatches.length} match{filteredMatches.length === 1 ? "" : "es"} shown
            </p>
          </div>
        )}

        {!data ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : filteredMatches.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center space-y-3">
              <p className="text-3xl">{"\u2660"}</p>
              <p className="text-sm font-medium">
                {activeFilter === "all" ? "No matches yet" : "No matches in this view"}
              </p>
              <p className="text-xs text-muted-foreground">
                {activeFilter === "casual"
                  ? "Tournament fixtures are saved separately from casual games."
                  : activeFilter === "all"
                  ? "Record your first trump game to get started."
                  : "This tournament has no recorded fixtures yet."}
              </p>
              <div className="flex items-center justify-center gap-2">
                <Button
                  onClick={() => navigate({ to: "/trump/matches/new", search: { tournamentId: undefined, fixtureId: undefined } })}
                  variant="outline"
                  className="mt-2"
                >
                  <Plus className="size-4 mr-2" />
                  Record Match
                </Button>
                {activeFilter !== "all" && activeFilter !== "casual" && (
                  <Button
                    onClick={() =>
                      navigate({
                        to: "/trump/tournaments/$tournamentId",
                        params: { tournamentId: activeFilter },
                      })
                    }
                    variant="outline"
                    className="mt-2"
                  >
                    Open Tournament
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <motion.div className="space-y-2" initial="hidden" animate="visible" variants={containerVariants}>
            {filteredMatches.map((m) => {
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
                          {formatMatchDateShort(m.date)} &middot; {m.hands.length} hands &middot; To {m.targetScore}
                        </span>
                        <span className="text-[10px] font-semibold text-emerald-500">
                          {t1Wins ? m.t1?.name : m.t2?.name} wins
                        </span>
                      </div>
                      {m.tournament && (
                        <button
                          type="button"
                          onClick={() =>
                            navigate({
                              to: "/trump/tournaments/$tournamentId",
                              params: { tournamentId: m.tournament!.id },
                            })
                          }
                          className="mt-1 text-[10px] font-medium text-red-500 hover:underline"
                        >
                          {m.tournament.name}
                        </button>
                      )}
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

import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useLiveQuery } from "dexie-react-hooks"
import { formatMatchDateShort, formatLongDate } from "@/lib/date-utils"
import { Plus, Trophy, Sparkles } from "lucide-react"
import { motion } from "framer-motion"
import { useState } from "react"
import { db } from "@/db/index"
import { computeTrumpTeamStats } from "@/lib/trump-stats"
import { computeTrumpTournamentStandings } from "@/lib/trump-tournaments"
import { seedDemoTrumpData } from "@/lib/demo-seed"
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

function TeamAvatar({ name, color, size = "sm" }: { name: string; color: string; size?: "sm" | "md" }) {
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

function FormPill({ result }: { result: "W" | "L" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center size-5 rounded-full text-[9px] font-bold text-white",
        result === "W" && "bg-emerald-500",
        result === "L" && "bg-red-500"
      )}
    >
      {result}
    </span>
  )
}

const SUIT_SYMBOLS: Record<string, string> = {
  hearts: "\u2665",
  diamonds: "\u2666",
  clubs: "\u2663",
  spades: "\u2660",
}

function LeaderboardTable({ onLoadDemo, loadingDemo }: { onLoadDemo: () => void; loadingDemo: boolean }) {
  const teams = useLiveQuery(() => db.trumpTeams.orderBy("createdAt").toArray())
  const matches = useLiveQuery(() => db.trumpMatches.toArray())
  const players = useLiveQuery(() => db.trumpPlayers.toArray())

  if (!teams || !matches || !players) {
    return (
      <div className="space-y-1">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 bg-muted rounded animate-pulse" />
        ))}
      </div>
    )
  }

  if (teams.length === 0 || matches.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center space-y-3">
          <Trophy className="size-8 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">Add teams and record matches to see the leaderboard</p>
          <Button variant="outline" size="sm" onClick={onLoadDemo} disabled={loadingDemo} className="gap-2">
            <Sparkles className="size-3.5" />
            {loadingDemo ? "Loading..." : "Load Demo Data"}
          </Button>
        </CardContent>
      </Card>
    )
  }

  const stats = computeTrumpTeamStats(teams, matches, players)

  return (
    <div className="overflow-x-auto -mx-4">
      <table className="w-full text-xs min-w-[520px] px-4">
        <thead>
          <tr className="text-muted-foreground border-b border-border">
            <th className="pl-4 pr-2 py-2 text-left font-medium w-8">#</th>
            <th className="px-2 py-2 text-left font-medium">Team</th>
            <th className="px-2 py-2 text-center font-medium">P</th>
            <th className="px-2 py-2 text-center font-medium">W</th>
            <th className="px-2 py-2 text-center font-medium">L</th>
            <th className="px-2 py-2 text-center font-medium">Win%</th>
            <th className="px-2 py-2 text-center font-medium" title="All Fours sweeps">AF</th>
            <th className="px-2 py-2 text-center font-medium" title="Hang Jacks">HJ</th>
            <th className="pr-4 pl-2 py-2 text-center font-medium">Form</th>
          </tr>
        </thead>
        <motion.tbody initial="hidden" animate="visible" variants={containerVariants}>
          {stats.map((s, idx) => (
            <motion.tr
              key={s.teamId}
              variants={itemVariants}
              className={cn("border-b border-border/50 transition-colors", idx === 0 && "bg-primary/5")}
            >
              <td className="pl-4 pr-2 py-2.5 text-muted-foreground font-medium">{idx + 1}</td>
              <td className="px-2 py-2.5">
                <div className="flex items-center gap-2">
                  <TeamAvatar name={s.name} color={s.colorHex} />
                  <div className="min-w-0">
                    <span className="font-medium truncate block max-w-[100px]">{s.name}</span>
                    <span className="text-[10px] text-muted-foreground">{s.player1Name} & {s.player2Name}</span>
                  </div>
                </div>
              </td>
              <td className="px-2 py-2.5 text-center tabular-nums">{s.matchesPlayed}</td>
              <td className="px-2 py-2.5 text-center tabular-nums text-emerald-500">{s.matchesWon}</td>
              <td className="px-2 py-2.5 text-center tabular-nums text-red-500">{s.matchesLost}</td>
              <td className="px-2 py-2.5 text-center tabular-nums font-bold text-primary">{s.winRate}%</td>
              <td className="px-2 py-2.5 text-center tabular-nums">{s.allFours}</td>
              <td className="px-2 py-2.5 text-center tabular-nums">{s.hangJacks}</td>
              <td className="pr-4 pl-2 py-2.5">
                <div className="flex items-center justify-center gap-0.5">
                  {s.form.length === 0
                    ? <span className="text-muted-foreground">-</span>
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
    const matches = await db.trumpMatches.orderBy("date").reverse().limit(5).toArray()
    const teams = await db.trumpTeams.toArray()
    const tournaments = await db.trumpTournaments.toArray()
    const teamMap = new Map(teams.map((t) => [t.id, t]))
    const tournamentMap = new Map(tournaments.map((tournament) => [tournament.id, tournament]))
    return matches
      .filter((m) => m.status === "completed")
      .map((m) => ({
        ...m,
        t1: teamMap.get(m.team1Id),
        t2: teamMap.get(m.team2Id),
        tournament: m.tournamentId ? tournamentMap.get(m.tournamentId) : undefined,
      }))
  })

  if (!data || data.length === 0) return null

  return (
    <div className="space-y-2">
      {data.map((m) => {
        const winner = m.winnerId === m.team1Id ? m.t1 : m.t2
        const isShutout = (m.winnerId === m.team1Id && m.team2Score === 0) ||
          (m.winnerId === m.team2Id && m.team1Score === 0)

        return (
          <motion.div key={m.id} whileTap={{ scale: 0.98 }}>
            <Card className="hover:bg-muted/50 transition-colors">
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    {m.t1 && <TeamAvatar name={m.t1.name} color={m.t1.colorHex} />}
                    <span className="font-semibold text-sm tabular-nums">{m.team1Score} - {m.team2Score}</span>
                    {m.t2 && <TeamAvatar name={m.t2.name} color={m.t2.colorHex} />}
                    <span className="text-sm font-medium truncate min-w-0">
                      {m.t1?.name ?? "?"} vs {m.t2?.name ?? "?"}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-muted-foreground">{formatMatchDateShort(m.date)}</p>
                    <p className="text-[10px] text-emerald-500 font-medium">
                      {winner?.name} wins{isShutout ? " (shutout!)" : ""}
                    </p>
                    {m.tournament && (
                      <p className="text-[10px] text-red-500 font-medium mt-1">{m.tournament.name}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )
      })}
      <button
        className="text-xs text-primary font-medium w-full text-center py-1"
        onClick={() => navigate({ to: "/trump/matches" })}
      >
        See all matches &rarr;
      </button>
    </div>
  )
}

function TournamentSnapshot() {
  const navigate = useNavigate()

  const data = useLiveQuery(async () => {
    const tournaments = await db.trumpTournaments.toArray()
    const teams = await db.trumpTeams.toArray()
    const matches = await db.trumpMatches.toArray()

    return tournaments
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 3)
      .map((tournament) => {
        const standings = computeTrumpTournamentStandings(tournament, teams, matches)
        const leader = standings[0]
        const completedFixtures = tournament.fixtures.filter((fixture) => fixture.result !== null).length
        const champion = tournament.championTeamId
          ? teams.find((team) => team.id === tournament.championTeamId)
          : undefined
        return {
          tournament,
          completedFixtures,
          leader,
          champion,
        }
      })
  })

  if (!data) {
    return (
      <div className="space-y-2">
        {[1, 2].map((item) => (
          <div key={item} className="h-20 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center space-y-3">
          <Trophy className="size-8 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">Create tournaments to track fixtures and champions</p>
          <Button variant="outline" size="sm" onClick={() => navigate({ to: "/trump/tournaments" })}>
            Open Tournaments
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-2">
      {data.map(({ tournament, completedFixtures, leader, champion }) => (
        <button
          key={tournament.id}
          className="w-full text-left"
          onClick={() =>
            navigate({
              to: "/trump/tournaments/$tournamentId",
              params: { tournamentId: tournament.id },
            })
          }
        >
          <Card className="hover:bg-muted/50 transition-colors">
            <CardContent className="py-3 px-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{tournament.name}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {tournament.format === "ROUND_ROBIN" ? "Round Robin" : "Knockout"} · {completedFixtures}/{tournament.fixtures.length} fixtures
                  </p>
                  <p className="text-[10px] mt-1 text-red-500 font-medium">
                    {champion
                      ? `Champion: ${champion.name}`
                      : leader
                        ? `Leader: ${leader.teamName}`
                        : "Waiting for teams"}
                  </p>
                </div>
                <span className={cn(
                  "rounded-full border px-2 py-0.5 text-[10px]",
                  tournament.status === "completed" && "border-border bg-muted text-muted-foreground",
                  tournament.status === "live" && "border-emerald-500/30 bg-emerald-500/20 text-emerald-400",
                  tournament.status === "upcoming" && "border-blue-500/30 bg-blue-500/20 text-blue-400",
                )}>
                  {tournament.status}
                </span>
              </div>
            </CardContent>
          </Card>
        </button>
      ))}
      <button
        className="text-xs text-primary font-medium w-full text-center py-1"
        onClick={() => navigate({ to: "/trump/tournaments" })}
      >
        See all tournaments &rarr;
      </button>
    </div>
  )
}

function TrumpHomePage() {
  const navigate = useNavigate()
  const [loadingDemo, setLoadingDemo] = useState(false)

  async function handleLoadDemo() {
    setLoadingDemo(true)
    try {
      await seedDemoTrumpData()
    } finally {
      setLoadingDemo(false)
    }
  }

  return (
    <div className="min-h-full bg-background relative overflow-hidden">
      {/* Animated background — card game theme */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <motion.div
          className="absolute -top-20 -right-20 w-56 h-56 rounded-full bg-red-500/5"
          animate={{ scale: [1, 1.1, 1], x: [0, -8, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-16 -left-16 w-64 h-64 rounded-full bg-red-500/5"
          animate={{ scale: [1, 1.12, 1], y: [0, -10, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        />
        {/* Card suit symbols floating */}
        {["\u2660", "\u2665", "\u2666", "\u2663"].map((suit, i) => (
          <motion.div
            key={suit}
            className="absolute text-3xl text-foreground/[0.04] select-none"
            style={{ top: `${15 + i * 20}%`, right: `${5 + i * 12}%` }}
            animate={{ y: [0, -10, 0], rotate: [-5, 5, -5] }}
            transition={{ duration: 6 + i, repeat: Infinity, ease: "easeInOut", delay: i * 0.8 }}
          >
            {suit}
          </motion.div>
        ))}
      </div>

      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
              <span>{SUIT_SYMBOLS.spades}</span> Trump / All Fours
            </h1>
            <p className="text-xs text-muted-foreground">{formatLongDate()}</p>
          </div>
          <motion.div whileTap={{ scale: 0.95 }}>
            <Button
              size="sm"
              onClick={() => navigate({ to: "/trump/matches/new", search: { tournamentId: undefined, fixtureId: undefined } })}
              className="gap-1"
            >
              <Plus className="size-4" />
              Record
            </Button>
          </motion.div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-5">
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Team Leaderboard</h2>
          <Card>
            <CardContent className="px-0 pb-2 pt-0">
              <LeaderboardTable onLoadDemo={handleLoadDemo} loadingDemo={loadingDemo} />
            </CardContent>
          </Card>
        </section>

        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Recent Matches</h2>
          <RecentMatches />
        </section>

        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Tournaments</h2>
          <TournamentSnapshot />
        </section>
      </div>
    </div>
  )
}

export const Route = createFileRoute("/trump/")({ 
  component: TrumpHomePage,
})

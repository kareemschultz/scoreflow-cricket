import { createFileRoute } from "@tanstack/react-router"
import { useLiveQuery } from "dexie-react-hooks"
import { format } from "date-fns"
import { Trophy, TrendingUp, Zap, Shield, Star, Target } from "lucide-react"
import { db } from "@/db/index"
import type { Match, BatsmanEntry, BowlerEntry } from "@/types/cricket"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Badge } from "@workspace/ui/components/badge"
import { Separator } from "@workspace/ui/components/separator"

// ─── Record types ─────────────────────────────────────────────────────────────

interface TeamRecord {
  teamName: string
  score: number
  wickets: number
  matchDate: Date
  format: Match["format"]
  opponent: string
}

interface PlayerBattingRecord {
  playerName: string
  value: number
  matchDate: Date
  format: Match["format"]
  opponent: string
}

interface PlayerBowlingRecord {
  playerName: string
  wickets: number
  runs: number
  matchDate: Date
  format: Match["format"]
  opponent: string
}

interface ComputedRecords {
  highestTeamScore: TeamRecord | null
  lowestTeamScore: TeamRecord | null
  highestIndividualScore: PlayerBattingRecord | null
  bestBowlingFigures: PlayerBowlingRecord | null
  mostRunsCareer: { playerName: string; runs: number } | null
  mostWicketsCareer: { playerName: string; wickets: number } | null
  mostFifties: { playerName: string; fifties: number } | null
  mostHundreds: { playerName: string; hundreds: number } | null
}

// ─── Compute records from match data ─────────────────────────────────────────

function computeRecords(matches: Match[]): ComputedRecords {
  let highestTeamScore: TeamRecord | null = null
  let lowestTeamScore: TeamRecord | null = null
  let highestIndividualScore: PlayerBattingRecord | null = null
  let bestBowlingFigures: PlayerBowlingRecord | null = null

  // Career aggregates keyed by playerName (using name since playerIds may shift)
  const careerBatting = new Map<
    string,
    { runs: number; fifties: number; hundreds: number }
  >()
  const careerBowling = new Map<string, { wickets: number }>()

  for (const match of matches) {
    if (!match.innings?.length) continue
    const opponent = (battingTeamId: string) =>
      battingTeamId === match.team1Id ? match.team2Name : match.team1Name
    const teamName = (battingTeamId: string) =>
      battingTeamId === match.team1Id ? match.team1Name : match.team2Name

    for (const innings of match.innings) {
      if (innings.status !== "completed" && innings.status !== "declared") continue

      const tName = teamName(innings.battingTeamId)
      const opp = opponent(innings.battingTeamId)
      const score = innings.totalRuns
      const wickets = innings.totalWickets

      // Highest team score
      if (!highestTeamScore || score > highestTeamScore.score) {
        highestTeamScore = {
          teamName: tName,
          score,
          wickets,
          matchDate: new Date(match.date),
          format: match.format,
          opponent: opp,
        }
      }

      // Lowest completed team score (all out or match completed innings only)
      if (
        !lowestTeamScore ||
        score < lowestTeamScore.score
      ) {
        lowestTeamScore = {
          teamName: tName,
          score,
          wickets,
          matchDate: new Date(match.date),
          format: match.format,
          opponent: opp,
        }
      }

      // Individual batting records
      for (const batsman of innings.battingCard as BatsmanEntry[]) {
        const runs = batsman.runs

        // Highest individual score
        if (!highestIndividualScore || runs > highestIndividualScore.value) {
          highestIndividualScore = {
            playerName: batsman.playerName,
            value: runs,
            matchDate: new Date(match.date),
            format: match.format,
            opponent: opp,
          }
        }

        // Career batting aggregates
        const existing = careerBatting.get(batsman.playerName) ?? {
          runs: 0,
          fifties: 0,
          hundreds: 0,
        }
        existing.runs += runs
        if (runs >= 100) existing.hundreds += 1
        else if (runs >= 50) existing.fifties += 1
        careerBatting.set(batsman.playerName, existing)
      }

      // Bowling records
      for (const bowler of innings.bowlingCard as BowlerEntry[]) {
        // Best bowling figures (most wickets, then fewest runs)
        if (
          !bestBowlingFigures ||
          bowler.wickets > bestBowlingFigures.wickets ||
          (bowler.wickets === bestBowlingFigures.wickets &&
            bowler.runs < bestBowlingFigures.runs)
        ) {
          bestBowlingFigures = {
            playerName: bowler.playerName,
            wickets: bowler.wickets,
            runs: bowler.runs,
            matchDate: new Date(match.date),
            format: match.format,
            opponent: opp,
          }
        }

        // Career bowling aggregates
        const existing = careerBowling.get(bowler.playerName) ?? { wickets: 0 }
        existing.wickets += bowler.wickets
        careerBowling.set(bowler.playerName, existing)
      }
    }
  }

  // Sort career maps
  const sortedBatting = [...careerBatting.entries()].sort(
    (a, b) => b[1].runs - a[1].runs
  )
  const sortedBowling = [...careerBowling.entries()].sort(
    (a, b) => b[1].wickets - a[1].wickets
  )
  const sortedFifties = [...careerBatting.entries()].sort(
    (a, b) => b[1].fifties - a[1].fifties
  )
  const sortedHundreds = [...careerBatting.entries()].sort(
    (a, b) => b[1].hundreds - a[1].hundreds
  )

  return {
    highestTeamScore,
    lowestTeamScore,
    highestIndividualScore,
    bestBowlingFigures,
    mostRunsCareer:
      sortedBatting[0]
        ? { playerName: sortedBatting[0][0], runs: sortedBatting[0][1].runs }
        : null,
    mostWicketsCareer:
      sortedBowling[0]
        ? {
            playerName: sortedBowling[0][0],
            wickets: sortedBowling[0][1].wickets,
          }
        : null,
    mostFifties:
      sortedFifties[0]
        ? {
            playerName: sortedFifties[0][0],
            fifties: sortedFifties[0][1].fifties,
          }
        : null,
    mostHundreds:
      sortedHundreds[0]
        ? {
            playerName: sortedHundreds[0][0],
            hundreds: sortedHundreds[0][1].hundreds,
          }
        : null,
  }
}

// ─── Record card ──────────────────────────────────────────────────────────────

interface RecordCardProps {
  icon: React.ReactNode
  title: string
  value: React.ReactNode
  sub?: string
  meta?: string
  format?: Match["format"]
  empty?: boolean
}

function RecordCard({ icon, title, value, sub, meta, format, empty }: RecordCardProps) {
  return (
    <Card className={empty ? "opacity-50" : ""}>
      <CardContent className="py-3 px-4">
        <div className="flex items-start gap-3">
          <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">{title}</p>
            <p className="text-xl font-bold tabular-nums leading-tight mt-0.5">
              {value}
            </p>
            {sub && (
              <p className="text-xs font-medium text-foreground/80 mt-0.5 truncate">
                {sub}
              </p>
            )}
            {meta && (
              <p className="text-[10px] text-muted-foreground mt-0.5">{meta}</p>
            )}
          </div>
          {format && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 shrink-0 self-start mt-1"
            >
              {format}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Records Page ─────────────────────────────────────────────────────────────

function RecordsPage() {
  const matches = useLiveQuery(async () => {
    return db.matches
      .where("status")
      .anyOf(["completed", "abandoned"])
      .toArray()
  })

  if (matches === undefined) {
    return (
      <div className="min-h-full bg-background flex items-center justify-center">
        <div className="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const records = computeRecords(matches)
  const isEmpty = matches.length === 0

  return (
    <div className="min-h-full bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Trophy className="size-5 text-primary" />
          <h1 className="text-lg font-bold tracking-tight">Records</h1>
          {!isEmpty && (
            <Badge
              variant="outline"
              className="ml-auto text-xs text-muted-foreground"
            >
              {matches.length} matches
            </Badge>
          )}
        </div>
      </div>

      <div className="px-4 py-4 space-y-5 pb-8">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Trophy className="size-12 text-muted-foreground/40 mb-4" />
            <p className="text-sm font-medium text-muted-foreground">
              No records yet
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Complete matches to see all-time records
            </p>
          </div>
        ) : (
          <>
            {/* Team records */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Shield className="size-4 text-muted-foreground" />
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Team Records
                </h2>
              </div>
              <div className="space-y-2">
                <RecordCard
                  icon={<TrendingUp className="size-4 text-emerald-400" />}
                  title="Highest team score"
                  value={
                    records.highestTeamScore
                      ? `${records.highestTeamScore.score}/${records.highestTeamScore.wickets}`
                      : "—"
                  }
                  sub={records.highestTeamScore?.teamName}
                  meta={
                    records.highestTeamScore
                      ? `vs ${records.highestTeamScore.opponent} · ${format(records.highestTeamScore.matchDate, "d MMM yyyy")}`
                      : undefined
                  }
                  format={records.highestTeamScore?.format}
                  empty={!records.highestTeamScore}
                />
                <RecordCard
                  icon={<TrendingUp className="size-4 text-red-400 rotate-180" />}
                  title="Lowest team score"
                  value={
                    records.lowestTeamScore
                      ? `${records.lowestTeamScore.score}/${records.lowestTeamScore.wickets}`
                      : "—"
                  }
                  sub={records.lowestTeamScore?.teamName}
                  meta={
                    records.lowestTeamScore
                      ? `vs ${records.lowestTeamScore.opponent} · ${format(records.lowestTeamScore.matchDate, "d MMM yyyy")}`
                      : undefined
                  }
                  format={records.lowestTeamScore?.format}
                  empty={!records.lowestTeamScore}
                />
              </div>
            </div>

            <Separator />

            {/* Individual match records */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Star className="size-4 text-muted-foreground" />
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Match Records
                </h2>
              </div>
              <div className="space-y-2">
                <RecordCard
                  icon={<TrendingUp className="size-4 text-blue-400" />}
                  title="Highest individual score"
                  value={
                    records.highestIndividualScore
                      ? records.highestIndividualScore.value
                      : "—"
                  }
                  sub={records.highestIndividualScore?.playerName}
                  meta={
                    records.highestIndividualScore
                      ? `vs ${records.highestIndividualScore.opponent} · ${format(records.highestIndividualScore.matchDate, "d MMM yyyy")}`
                      : undefined
                  }
                  format={records.highestIndividualScore?.format}
                  empty={!records.highestIndividualScore}
                />
                <RecordCard
                  icon={<Zap className="size-4 text-amber-400" />}
                  title="Best bowling figures"
                  value={
                    records.bestBowlingFigures
                      ? `${records.bestBowlingFigures.wickets}/${records.bestBowlingFigures.runs}`
                      : "—"
                  }
                  sub={records.bestBowlingFigures?.playerName}
                  meta={
                    records.bestBowlingFigures
                      ? `vs ${records.bestBowlingFigures.opponent} · ${format(records.bestBowlingFigures.matchDate, "d MMM yyyy")}`
                      : undefined
                  }
                  format={records.bestBowlingFigures?.format}
                  empty={!records.bestBowlingFigures}
                />
              </div>
            </div>

            <Separator />

            {/* Career records */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Target className="size-4 text-muted-foreground" />
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Career Records
                </h2>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Card className={!records.mostRunsCareer ? "opacity-50" : ""}>
                  <CardContent className="py-3 px-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <TrendingUp className="size-3 text-blue-400" />
                      <p className="text-[10px] text-muted-foreground">
                        Most runs
                      </p>
                    </div>
                    <p className="text-2xl font-bold tabular-nums">
                      {records.mostRunsCareer?.runs ?? "—"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {records.mostRunsCareer?.playerName ?? "No data"}
                    </p>
                  </CardContent>
                </Card>

                <Card className={!records.mostWicketsCareer ? "opacity-50" : ""}>
                  <CardContent className="py-3 px-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Zap className="size-3 text-amber-400" />
                      <p className="text-[10px] text-muted-foreground">
                        Most wickets
                      </p>
                    </div>
                    <p className="text-2xl font-bold tabular-nums">
                      {records.mostWicketsCareer?.wickets ?? "—"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {records.mostWicketsCareer?.playerName ?? "No data"}
                    </p>
                  </CardContent>
                </Card>

                <Card className={!records.mostFifties ? "opacity-50" : ""}>
                  <CardContent className="py-3 px-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Star className="size-3 text-purple-400" />
                      <p className="text-[10px] text-muted-foreground">
                        Most fifties
                      </p>
                    </div>
                    <p className="text-2xl font-bold tabular-nums">
                      {records.mostFifties?.fifties ?? "—"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {records.mostFifties?.playerName ?? "No data"}
                    </p>
                  </CardContent>
                </Card>

                <Card className={!records.mostHundreds ? "opacity-50" : ""}>
                  <CardContent className="py-3 px-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Trophy className="size-3 text-emerald-400" />
                      <p className="text-[10px] text-muted-foreground">
                        Most hundreds
                      </p>
                    </div>
                    <p className="text-2xl font-bold tabular-nums">
                      {records.mostHundreds?.hundreds ?? "—"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {records.mostHundreds?.playerName ?? "No data"}
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export const Route = createFileRoute("/records")({
  component: RecordsPage,
})

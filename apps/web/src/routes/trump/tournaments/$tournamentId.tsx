import { useMemo, useState } from "react"
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router"
import { useLiveQuery } from "dexie-react-hooks"
import { toISODate } from "@/lib/date-utils"
import { ArrowLeft, Calendar, Play, Trophy, Users } from "lucide-react"
import { db } from "@/db/index"
import {
  computeTrumpTournamentStandings,
  createTrumpTournamentFixtures,
} from "@/lib/trump-tournaments"
import type {
  TrumpTeam,
  TrumpTournament,
  TrumpTournamentFixture,
} from "@/types/trump"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Label } from "@workspace/ui/components/label"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { cn } from "@workspace/ui/lib/utils"

function statusClass(status: TrumpTournament["status"]) {
  if (status === "completed") return "bg-muted text-muted-foreground border-border"
  if (status === "live") return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
  return "bg-blue-500/20 text-blue-400 border-blue-500/30"
}

function fixtureStatusLabel(fixture: TrumpTournamentFixture): "Completed" | "Live" | "Upcoming" {
  if (fixture.result !== null) return "Completed"
  if (fixture.matchId) return "Live"
  return "Upcoming"
}

function fixtureStatusClass(label: "Completed" | "Live" | "Upcoming") {
  if (label === "Completed") return "bg-muted text-muted-foreground border-border"
  if (label === "Live") return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
  return "bg-blue-500/20 text-blue-400 border-blue-500/30"
}

function roundLabel(fixtures: TrumpTournamentFixture[], fixture: TrumpTournamentFixture): string {
  if (fixture.phase === "league") return `League Round ${fixture.round}`
  const fixturesInRound = fixtures.filter(
    (candidate) => candidate.phase === "knockout" && candidate.round === fixture.round
  ).length
  if (fixturesInRound === 1) return "Final"
  if (fixturesInRound === 2) return "Semi-final"
  if (fixturesInRound === 4) return "Quarter-final"
  return `Knockout Round ${fixture.round}`
}

function TeamPickerDialog({
  open,
  onClose,
  tournament,
  teams,
}: {
  open: boolean
  onClose: () => void
  tournament: TrumpTournament
  teams: TrumpTeam[]
}) {
  const [selected, setSelected] = useState<string[]>(tournament.teamIds)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggle(teamId: string) {
    setSelected((prev) =>
      prev.includes(teamId) ? prev.filter((current) => current !== teamId) : [...prev, teamId]
    )
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      await db.trumpTournaments.update(tournament.id, {
        teamIds: selected,
        fixtures: [],
        championTeamId: undefined,
        status: "upcoming",
        completedAt: undefined,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save teams.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="top-16 mx-4 max-h-[80dvh] max-w-sm translate-y-0 overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Select Teams</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 py-2">
          {teams.map((team) => (
            <div key={team.id} className="flex items-center gap-3 py-1.5">
              <Checkbox
                id={team.id}
                checked={selected.includes(team.id)}
                onCheckedChange={() => toggle(team.id)}
              />
              <Label htmlFor={team.id} className="cursor-pointer text-sm">
                {team.name}
              </Label>
            </div>
          ))}
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Teams"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TrumpTournamentDetailPage() {
  const { tournamentId } = useParams({ from: "/trump/tournaments/$tournamentId" })
  const navigate = useNavigate()
  const [showTeams, setShowTeams] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tournament = useLiveQuery(() => db.trumpTournaments.get(tournamentId), [tournamentId])
  const teams = useLiveQuery(() => db.trumpTeams.orderBy("createdAt").toArray())
  const matches = useLiveQuery(() => db.trumpMatches.toArray())

  const teamMap = useMemo(
    () => new Map((teams ?? []).map((team) => [team.id, team])),
    [teams]
  )

  if (tournament === undefined || !teams || !matches) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!tournament) {
    return (
      <div className="flex min-h-full items-center justify-center px-4">
        <p className="text-sm text-muted-foreground">Tournament not found.</p>
      </div>
    )
  }

  const currentTournament = tournament
  const standings = computeTrumpTournamentStandings(currentTournament, teams, matches)
  const champion = currentTournament.championTeamId ? teamMap.get(currentTournament.championTeamId) : undefined

  async function handleGenerateFixtures() {
    setError(null)
    try {
      const fixtures = createTrumpTournamentFixtures(
        currentTournament.id,
        currentTournament.format,
        currentTournament.teamIds
      )
      await db.trumpTournaments.update(currentTournament.id, {
        fixtures,
        status: fixtures.length > 0 ? "live" : "upcoming",
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate fixtures.")
    }
  }

  async function handleScheduledDateChange(fixtureId: string, dateValue: string) {
    const updatedFixtures = currentTournament.fixtures.map((fixture) =>
      fixture.id === fixtureId
        ? { ...fixture, scheduledDate: dateValue ? new Date(dateValue) : undefined }
        : fixture
    )
    await db.trumpTournaments.update(currentTournament.id, { fixtures: updatedFixtures })
  }

  return (
    <div className="min-h-full bg-background">
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate({ to: "/trump/tournaments" })}
            className="flex size-8 items-center justify-center rounded-full bg-muted/50"
          >
            <ArrowLeft className="size-4" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-bold">{currentTournament.name}</h1>
            <p className="text-[10px] text-muted-foreground">
              {currentTournament.format === "ROUND_ROBIN" ? "Round Robin" : "Knockout"}
            </p>
          </div>
          <span className={`rounded-full border px-2 py-0.5 text-[10px] ${statusClass(currentTournament.status)}`}>
            {currentTournament.status}
          </span>
        </div>
      </div>

      <div className="space-y-4 px-4 py-4 pb-8">
        {champion && (
          <Card className="border-red-500/30 bg-red-500/5">
            <CardContent className="flex items-center gap-3 py-4">
              <div className="flex size-11 items-center justify-center rounded-full bg-red-500/10">
                <Trophy className="size-5 text-red-500" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Champion</p>
                <p className="text-sm font-semibold">{champion.name}</p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="size-4 text-primary" />
                <CardTitle className="text-sm">Teams ({currentTournament.teamIds.length})</CardTitle>
              </div>
              {currentTournament.status !== "completed" && (
                <Button size="sm" variant="outline" onClick={() => setShowTeams(true)}>
                  Edit
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {currentTournament.teamIds.length === 0 ? (
              <p className="text-sm text-muted-foreground">Add teams to start building the bracket.</p>
            ) : (
              currentTournament.teamIds.map((teamId) => (
                <div key={teamId} className="text-sm">{teamMap.get(teamId)?.name ?? "Unknown team"}</div>
              ))
            )}
            {currentTournament.teamIds.length >= 2 && currentTournament.fixtures.length === 0 && (
              <div className="pt-2">
                <Button onClick={handleGenerateFixtures}>
                  Generate Fixtures
                </Button>
              </div>
            )}
            {error && <p className="text-xs text-destructive">{error}</p>}
          </CardContent>
        </Card>

        {currentTournament.format === "ROUND_ROBIN" && currentTournament.teamIds.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Standings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="-mx-4 overflow-x-auto">
                <table className="w-full min-w-[620px] px-4 text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="pl-4 pr-2 py-2 text-left">#</th>
                      <th className="px-2 py-2 text-left">Team</th>
                      <th className="px-2 py-2 text-center">P</th>
                      <th className="px-2 py-2 text-center">W</th>
                      <th className="px-2 py-2 text-center">L</th>
                      <th className="px-2 py-2 text-center">Pts</th>
                      <th className="px-2 py-2 text-center">PD</th>
                      <th className="px-2 py-2 text-center">AF</th>
                      <th className="pr-4 pl-2 py-2 text-center">HJ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((standing, index) => (
                      <tr key={standing.teamId} className={cn(index === 0 && "bg-primary/5")}>
                        <td className="pl-4 pr-2 py-2">{index + 1}</td>
                        <td className="px-2 py-2 font-medium">{standing.teamName}</td>
                        <td className="px-2 py-2 text-center">{standing.played}</td>
                        <td className="px-2 py-2 text-center">{standing.won}</td>
                        <td className="px-2 py-2 text-center">{standing.lost}</td>
                        <td className="px-2 py-2 text-center font-bold text-primary">{standing.points}</td>
                        <td className="px-2 py-2 text-center">{standing.pointDiff}</td>
                        <td className="px-2 py-2 text-center">{standing.allFours}</td>
                        <td className="pr-4 pl-2 py-2 text-center">{standing.hangJacks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Fixtures ({currentTournament.fixtures.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {currentTournament.fixtures.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Generate fixtures once you are happy with the team list.
              </p>
            ) : (
              <div className="space-y-3">
                {currentTournament.fixtures.map((fixture) => {
                  const match = fixture.matchId
                    ? matches.find((item) => item.id === fixture.matchId)
                    : undefined
                  const statusLabel = fixtureStatusLabel(fixture)
                  const scheduledDate = fixture.scheduledDate
                    ? toISODate(fixture.scheduledDate)
                    : ""
                  return (
                    <div key={fixture.id} className="space-y-2 rounded-lg border border-border/60 bg-card/50 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold">
                            {teamMap.get(fixture.team1Id)?.name ?? "Team 1"} vs {teamMap.get(fixture.team2Id)?.name ?? "Team 2"}
                          </p>
                          <p className="mt-1 text-[10px] text-muted-foreground">
                            {roundLabel(currentTournament.fixtures, fixture)}
                          </p>
                        </div>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] ${fixtureStatusClass(statusLabel)}`}>
                          {statusLabel}
                        </span>
                      </div>

                      {match && (
                        <p className="text-[11px] text-primary">
                          {match.winnerId === match.team1Id
                            ? `${teamMap.get(match.team1Id)?.name ?? "Team 1"} won ${match.team1Score}-${match.team2Score}`
                            : `${teamMap.get(match.team2Id)?.name ?? "Team 2"} won ${match.team2Score}-${match.team1Score}`}
                        </p>
                      )}

                      <div className="flex items-center gap-2">
                        <Calendar className="size-3.5 shrink-0 text-muted-foreground" />
                        <input
                          type="date"
                          value={scheduledDate}
                          onChange={(event) => handleScheduledDateChange(fixture.id, event.target.value)}
                          className="border-0 bg-transparent p-0 text-xs focus:outline-none"
                        />
                      </div>

                      {!fixture.matchId && fixture.result === null && (
                        <Button
                          size="sm"
                          className="h-7 gap-1 text-xs"
                          onClick={() =>
                            navigate({
                              to: "/trump/matches/new",
                              search: {
                                tournamentId: currentTournament.id,
                                fixtureId: fixture.id,
                              },
                            })
                          }
                        >
                          <Play className="size-3" />
                          Start Match
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <TeamPickerDialog
        open={showTeams}
        onClose={() => setShowTeams(false)}
        tournament={currentTournament}
        teams={teams}
      />
    </div>
  )
}

export const Route = createFileRoute("/trump/tournaments/$tournamentId")({
  component: TrumpTournamentDetailPage,
})

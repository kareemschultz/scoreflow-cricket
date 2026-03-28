import { createFileRoute, useParams, useNavigate } from "@tanstack/react-router"
import { useLiveQuery } from "dexie-react-hooks"
import { ArrowLeft, Trophy, Users, Plus, Calendar, ExternalLink, Play } from "lucide-react"
import { useState } from "react"
import { format } from "date-fns"
import { db } from "@/db/index"
import type { Tournament, Team, TournamentFixture } from "@/types/cricket"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Label } from "@workspace/ui/components/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@workspace/ui/components/dialog"

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/tournaments/$tournamentId")({
  component: TournamentDetailPage,
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusColor(status: Tournament["status"]): string {
  if (status === "live") return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
  if (status === "completed") return "bg-muted text-muted-foreground border-border"
  return "bg-blue-500/20 text-blue-400 border-blue-500/30"
}

function fixtureStatusLabel(fixture: TournamentFixture): "Completed" | "Live" | "Upcoming" {
  if (fixture.result !== null) return "Completed"
  if (fixture.matchId) return "Live"
  return "Upcoming"
}

function fixtureStatusClass(label: "Completed" | "Live" | "Upcoming"): string {
  if (label === "Completed") return "bg-muted text-muted-foreground border-border"
  if (label === "Live") return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
  return "bg-blue-500/20 text-blue-400 border-blue-500/30"
}

// ─── AddTeamsDialog ───────────────────────────────────────────────────────────

function AddTeamsDialog({
  open,
  onClose,
  tournament,
  allTeams,
}: {
  open: boolean
  onClose: () => void
  tournament: Tournament
  allTeams: Team[]
}) {
  const [selected, setSelected] = useState<string[]>(tournament.teamIds)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      await db.tournaments.update(tournament.id, { teamIds: selected })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save teams. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm mx-4 top-16 translate-y-0 max-h-[80dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Select Teams</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 max-h-72 overflow-y-auto py-2">
          {allTeams.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No teams yet. Create teams first.
            </p>
          ) : (
            allTeams.map((team) => (
              <div key={team.id} className="flex items-center gap-3 py-1.5">
                <Checkbox
                  id={team.id}
                  checked={selected.includes(team.id)}
                  onCheckedChange={() => toggle(team.id)}
                />
                <Label htmlFor={team.id} className="text-sm cursor-pointer">
                  {team.name}
                </Label>
              </div>
            ))
          )}
        </div>
        {error && <p className="text-xs text-destructive px-1">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || allTeams.length === 0}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── TournamentDetailPage ─────────────────────────────────────────────────────

function TournamentDetailPage() {
  const { tournamentId } = useParams({ from: "/tournaments/$tournamentId" })
  const navigate = useNavigate()
  const [showAddTeams, setShowAddTeams] = useState(false)

  async function handleScheduledDateChange(fixtureId: string, dateValue: string) {
    try {
      const tournament = await db.tournaments.get(tournamentId)
      if (!tournament) return
      const updatedFixtures = tournament.fixtures.map((f) =>
        f.id === fixtureId
          ? { ...f, scheduledDate: dateValue ? new Date(dateValue) : undefined }
          : f
      )
      await db.tournaments.update(tournamentId, { fixtures: updatedFixtures })
    } catch {
      // Background date update — live query will reflect actual state
    }
  }

  const tournament = useLiveQuery(() => db.tournaments.get(tournamentId), [tournamentId])

  const allTeams = useLiveQuery(() => db.teams.orderBy("name").toArray())

  const teamMap = useLiveQuery(async () => {
    const teams = await db.teams.toArray()
    return Object.fromEntries(teams.map((t) => [t.id, t.name]))
  })

  const fixtureMatches = useLiveQuery(async () => {
    if (!tournament?.fixtures.length) return {}
    const matchIds = tournament.fixtures.map((f) => f.matchId).filter(Boolean) as string[]
    const matches = await db.matches.where("id").anyOf(matchIds).toArray()
    return Object.fromEntries(matches.map((m) => [m.id, m]))
  }, [tournament?.fixtures])

  if (tournament === undefined) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <div className="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!tournament) {
    return (
      <div className="min-h-full flex items-center justify-center px-4">
        <p className="text-sm text-muted-foreground">Tournament not found</p>
      </div>
    )
  }

  const participatingTeams = (allTeams ?? []).filter((t) =>
    tournament.teamIds.includes(t.id)
  )

  return (
    <div className="min-h-full bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => history.back()}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold truncate">{tournament.name}</h1>
            <p className="text-[10px] text-muted-foreground">{tournament.matchFormat}</p>
          </div>
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${statusColor(tournament.status)}`}>
            {tournament.status}
          </Badge>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4 pb-8">
        {/* Teams card */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="size-4 text-primary" />
                <CardTitle className="text-sm">Teams ({tournament.teamIds.length})</CardTitle>
              </div>
              {tournament.status === "upcoming" && (
                <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={() => setShowAddTeams(true)}>
                  <Plus className="size-3" />
                  Edit
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {participatingTeams.length === 0 ? (
              <div className="py-4 text-center">
                <p className="text-sm text-muted-foreground">No teams added yet</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3 gap-1.5"
                  onClick={() => setShowAddTeams(true)}
                >
                  <Plus className="size-3.5" />
                  Add Teams
                </Button>
              </div>
            ) : (
              <div className="space-y-1.5">
                {participatingTeams.map((team) => (
                  <div key={team.id} className="flex items-center gap-2 py-1">
                    <Trophy className="size-3.5 text-primary/60" />
                    <span className="text-sm">{team.name}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Fixtures */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Trophy className="size-4 text-primary" />
              <CardTitle className="text-sm">
                Fixtures ({tournament.fixtures.length})
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {tournament.fixtures.length === 0 ? (
              <div className="py-4 text-center">
                <p className="text-sm text-muted-foreground">No fixtures yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Add at least 2 teams to generate fixtures
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {tournament.fixtures.map((fixture) => {
                  const t1 = teamMap?.[fixture.team1Id] ?? "Team 1"
                  const t2 = teamMap?.[fixture.team2Id] ?? "Team 2"
                  const matchResult = fixture.matchId ? fixtureMatches?.[fixture.matchId] : undefined
                  const statusLabel = fixtureStatusLabel(fixture)
                  const scheduledDateValue = fixture.scheduledDate
                    ? format(new Date(fixture.scheduledDate), "yyyy-MM-dd")
                    : ""
                  const isCompleted = statusLabel === "Completed"
                  return (
                    <div
                      key={fixture.id}
                      className="rounded-lg border border-border/60 bg-card/50 p-3 space-y-2"
                    >
                      {/* Top row: matchup + status badge */}
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold leading-tight">
                          {t1} <span className="text-muted-foreground font-normal">vs</span> {t2}
                        </p>
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 shrink-0 ${fixtureStatusClass(statusLabel)}`}
                        >
                          {statusLabel}
                        </Badge>
                      </div>

                      {/* Result text if completed */}
                      {matchResult?.result && (
                        <p className="text-[11px] text-primary">{matchResult.result}</p>
                      )}

                      {/* Scheduled date row */}
                      <div className="flex items-center gap-2">
                        <Calendar className="size-3.5 text-muted-foreground shrink-0" />
                        <input
                          type="date"
                          value={scheduledDateValue}
                          onChange={(e) => handleScheduledDateChange(fixture.id, e.target.value)}
                          disabled={isCompleted}
                          className="text-xs bg-transparent border-0 p-0 text-foreground disabled:text-muted-foreground focus:outline-none focus:ring-0 cursor-pointer disabled:cursor-default"
                          aria-label="Scheduled date"
                        />
                        {!scheduledDateValue && !isCompleted && (
                          <span className="text-[11px] text-muted-foreground">Set date</span>
                        )}
                      </div>

                      {/* Action buttons */}
                      {(fixture.matchId || (!isCompleted)) && (
                        <div className="flex gap-2 pt-0.5">
                          {fixture.matchId ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1"
                              onClick={() =>
                                navigate({
                                  to: "/scorecard/$matchId",
                                  params: { matchId: fixture.matchId! },
                                })
                              }
                            >
                              <ExternalLink className="size-3" />
                              View Scorecard
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              className="h-7 text-xs gap-1"
                              onClick={() => navigate({ to: "/new-match" })}
                            >
                              <Play className="size-3" />
                              Start Match
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {allTeams && (
        <AddTeamsDialog
          open={showAddTeams}
          onClose={() => setShowAddTeams(false)}
          tournament={tournament}
          allTeams={allTeams}
        />
      )}
    </div>
  )
}

import { createFileRoute, useParams } from "@tanstack/react-router"
import { useLiveQuery } from "dexie-react-hooks"
import { ArrowLeft, Trophy, Users, Plus } from "lucide-react"
import { useState } from "react"
import { db } from "@/db/index"
import type { Tournament, Team } from "@/types/cricket"
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

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  async function handleSave() {
    setSaving(true)
    await db.tournaments.update(tournament.id, { teamIds: selected })
    setSaving(false)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
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
  const [showAddTeams, setShowAddTeams] = useState(false)

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
              <div className="space-y-2">
                {tournament.fixtures.map((fixture) => {
                  const t1 = teamMap?.[fixture.team1Id] ?? "Team 1"
                  const t2 = teamMap?.[fixture.team2Id] ?? "Team 2"
                  const matchResult = fixture.matchId ? fixtureMatches?.[fixture.matchId] : undefined
                  return (
                    <div
                      key={fixture.id}
                      className="flex items-center gap-2 py-2 border-b border-border/40 last:border-0"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium">{t1} vs {t2}</p>
                        {matchResult?.result && (
                          <p className="text-[10px] text-primary mt-0.5">{matchResult.result}</p>
                        )}
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 shrink-0 ${
                          fixture.result
                            ? "bg-muted text-muted-foreground border-border"
                            : "bg-blue-500/20 text-blue-400 border-blue-500/30"
                        }`}
                      >
                        {fixture.result ? "Done" : "Pending"}
                      </Badge>
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

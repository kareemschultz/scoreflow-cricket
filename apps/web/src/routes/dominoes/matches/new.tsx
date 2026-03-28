import { useEffect, useState } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useLiveQuery } from "dexie-react-hooks"
import { todayISO } from "@/lib/date-utils"
import { ArrowLeft, Plus, Minus, AlertCircle, Trophy } from "lucide-react"
import { motion } from "framer-motion"
import { nanoid } from "nanoid"
import { db } from "@/db/index"
import { buildDominoTournamentUpdateFromMatch } from "@/lib/domino-tournaments"
import type { DominoHand } from "@/types/dominoes"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { cn } from "@workspace/ui/lib/utils"

function tournamentRoundLabel(round: number, phase: "league" | "knockout") {
  return phase === "league" ? `League Round ${round}` : `Knockout Round ${round}`
}

function LockedTeamField({
  label,
  teamName,
}: {
  label: string
  teamName: string
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="rounded-2xl border border-border bg-muted/40 px-3 py-2 text-sm font-medium">
        {teamName}
      </div>
    </div>
  )
}

function NewDominoMatchPage() {
  const navigate = useNavigate()
  const search = Route.useSearch()
  const teams = useLiveQuery(() => db.dominoTeams.orderBy("createdAt").toArray())
  const players = useLiveQuery(() => db.dominoPlayers.toArray())
  const matches = useLiveQuery(() => db.dominoMatches.toArray())
  const tournamentContext = useLiveQuery(async () => {
    if (!search.tournamentId || !search.fixtureId) return null
    const tournament = await db.dominoTournaments.get(search.tournamentId)
    if (!tournament) return null
    const fixture = tournament.fixtures.find((candidate) => candidate.id === search.fixtureId)
    return fixture ? { tournament, fixture } : null
  }, [search.tournamentId, search.fixtureId])

  const [team1Id, setTeam1Id] = useState<string | null>(null)
  const [team2Id, setTeam2Id] = useState<string | null>(null)
  const [targetHands, setTargetHands] = useState(6)
  const [date, setDate] = useState(todayISO())
  const [notes, setNotes] = useState("")

  const [hands, setHands] = useState<DominoHand[]>([])
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saveError, setSaveError] = useState<string | null>(null)

  const isLoadingTournamentContext = Boolean(search.tournamentId && search.fixtureId) && tournamentContext === undefined
  const activeTournament = tournamentContext?.tournament
  const activeFixture = tournamentContext?.fixture
  const isTournamentFixture = Boolean(
    activeTournament &&
    activeFixture &&
    activeFixture.result === null &&
    !activeFixture.matchId
  )
  const fixtureUnavailable = Boolean(
    activeTournament &&
    activeFixture &&
    !isTournamentFixture
  )
  const missingTournamentFixture = Boolean(search.tournamentId && search.fixtureId) && tournamentContext === null

  useEffect(() => {
    if (!isTournamentFixture || !activeFixture) return
    setTeam1Id(activeFixture.team1Id)
    setTeam2Id(activeFixture.team2Id)
    setErrors({})
    setSaveError(null)
  }, [activeFixture, isTournamentFixture])

  const teamMap = new Map((teams ?? []).map((team) => [team.id, team]))
  const t1 = team1Id ? teamMap.get(team1Id) : undefined
  const t2 = team2Id ? teamMap.get(team2Id) : undefined

  const team1Score = hands.filter((hand) => hand.winnerId === team1Id).length
  const team2Score = hands.filter((hand) => hand.winnerId === team2Id).length
  const isMatchComplete = team1Score >= targetHands || team2Score >= targetHands

  function addHand(winnerId: string, endType: "domino" | "pose") {
    if (!team1Id || !team2Id) return
    setHands((prev) => [
      ...prev,
      {
        handNumber: prev.length + 1,
        winnerId,
        endType,
        points: 0,
        passes: [],
      },
    ])
  }

  function removeLastHand() {
    setHands((prev) => prev.slice(0, -1))
  }

  function validate() {
    const nextErrors: Record<string, string> = {}
    if (!team1Id) nextErrors.team1 = "Select team 1"
    if (!team2Id) nextErrors.team2 = "Select team 2"
    if (team1Id && team2Id && team1Id === team2Id) nextErrors.team2 = "Can't select the same team twice"
    if (hands.length === 0) nextErrors.hands = "Record at least one hand"
    if (!isMatchComplete) nextErrors.hands = "Match is not complete yet"
    return nextErrors
  }

  async function doSave() {
    const nextErrors = validate()
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setSaving(true)
    setSaveError(null)

    try {
      const winnerId = team1Score >= targetHands ? team1Id! : team2Id!
      const match = {
        id: nanoid(),
        date: new Date(date),
        scoringMode: "hands" as const,
        targetHands,
        targetPoints: 100,
        team1Id: team1Id!,
        team2Id: team2Id!,
        hands,
        team1Score,
        team2Score,
        winnerId,
        status: "completed" as const,
        tournamentId: isTournamentFixture ? activeTournament!.id : undefined,
        tournamentFixtureId: isTournamentFixture ? activeFixture!.id : undefined,
        notes: notes.trim() || undefined,
      }

      await db.transaction("rw", db.dominoMatches, db.dominoTournaments, async () => {
        await db.dominoMatches.add(match)

        if (isTournamentFixture && activeTournament && activeFixture) {
          const latestTournament = await db.dominoTournaments.get(activeTournament.id)
          if (!latestTournament) {
            throw new Error("Tournament no longer exists.")
          }

          const tournamentUpdate = buildDominoTournamentUpdateFromMatch({
            tournament: latestTournament,
            fixtureId: activeFixture.id,
            match,
            teams: teams ?? [],
            matches: [...(matches ?? []).filter((existing) => existing.id !== match.id), match],
          })

          await db.dominoTournaments.update(activeTournament.id, tournamentUpdate)
        }
      })

      if (isTournamentFixture && activeTournament) {
        navigate({
          to: "/dominoes/tournaments/$tournamentId",
          params: { tournamentId: activeTournament.id },
        })
        return
      }

      navigate({ to: "/dominoes" })
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Failed to save match.")
    } finally {
      setSaving(false)
    }
  }

  if (!teams || !players || !matches || isLoadingTournamentContext) {
    return (
      <div className="flex h-32 items-center justify-center">
        <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (teams.length < 2) {
    return (
      <div className="min-h-full bg-background px-4 py-4">
        <Card>
          <CardContent className="space-y-3 py-10 text-center">
            <p className="text-3xl">🁣</p>
            <p className="text-sm font-medium">Not enough teams</p>
            <p className="text-xs text-muted-foreground">You need at least 2 teams to record a match</p>
            <Button onClick={() => navigate({ to: "/dominoes/teams" })} variant="outline" className="mt-2">
              Create Teams
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-background">
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (activeTournament) {
                navigate({
                  to: "/dominoes/tournaments/$tournamentId",
                  params: { tournamentId: activeTournament.id },
                })
                return
              }

              navigate({ to: "/dominoes/matches" })
            }}
            className="flex size-8 items-center justify-center rounded-full bg-muted/50"
          >
            <ArrowLeft className="size-4" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold">Record Match</h1>
            {isTournamentFixture && activeTournament && activeFixture && (
              <p className="truncate text-[10px] text-muted-foreground">
                {activeTournament.name} · {tournamentRoundLabel(activeFixture.round, activeFixture.phase)}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4 px-4 py-4 pb-20">
        {isTournamentFixture && activeTournament && activeFixture && (
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="flex items-start gap-3 py-4">
              <div className="flex size-10 items-center justify-center rounded-full bg-amber-500/10">
                <Trophy className="size-4 text-amber-500" />
              </div>
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Tournament Fixture</p>
                <p className="text-sm font-semibold">{activeTournament.name}</p>
                <p className="text-xs text-muted-foreground">
                  Save this result and the fixture, standings, and bracket will update automatically.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {fixtureUnavailable && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
            <p className="text-xs text-amber-600">
              This fixture already has a saved result. Any match you record here will be saved as a standalone match.
            </p>
          </div>
        )}

        {missingTournamentFixture && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
            <p className="text-xs text-amber-600">
              The tournament fixture could not be loaded, so this screen is in standalone match mode.
            </p>
          </div>
        )}

        <Card>
          <CardContent className="space-y-4 py-4">
            {isTournamentFixture ? (
              <div className="grid grid-cols-2 gap-4">
                <LockedTeamField label="Team 1" teamName={t1?.name ?? "Unknown team"} />
                <LockedTeamField label="Team 2" teamName={t2?.name ?? "Unknown team"} />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Team 1</Label>
                  <Select value={team1Id} onValueChange={(value: string | null) => { setTeam1Id(value); setErrors({}) }}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      {teams.filter((team) => team.id !== team2Id).map((team) => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.team1 && <p className="text-[10px] text-destructive">{errors.team1}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Team 2</Label>
                  <Select value={team2Id} onValueChange={(value: string | null) => { setTeam2Id(value); setErrors({}) }}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      {teams.filter((team) => team.id !== team1Id).map((team) => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.team2 && <p className="text-[10px] text-destructive">{errors.team2}</p>}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>First to (hands)</Label>
              <div className="flex items-center gap-3">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.9 }}
                  className="flex size-8 items-center justify-center rounded-full bg-muted disabled:opacity-40"
                  onClick={() => setTargetHands((value) => Math.max(1, value - 1))}
                  disabled={targetHands <= 1}
                >
                  <Minus className="size-3" />
                </motion.button>
                <span className="w-8 text-center text-lg font-bold tabular-nums">{targetHands}</span>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.9 }}
                  className="flex size-8 items-center justify-center rounded-full bg-primary"
                  onClick={() => setTargetHands((value) => value + 1)}
                >
                  <Plus className="size-3 text-primary-foreground" />
                </motion.button>
              </div>
            </div>
          </CardContent>
        </Card>

        {team1Id && team2Id && (
          <Card>
            <CardContent className="py-5">
              <div className="flex items-center justify-around">
                <div className="text-center">
                  <div
                    className="mx-auto flex size-12 items-center justify-center rounded-full text-sm font-bold text-white"
                    style={{ backgroundColor: t1?.colorHex ?? "#6b7280" }}
                  >
                    {t1?.name.split(" ").map((word) => word[0]).join("").toUpperCase().slice(0, 2)}
                  </div>
                  <p className="mt-1 max-w-[80px] truncate text-xs font-medium">{t1?.name}</p>
                </div>
                <div className="text-center">
                  <motion.div
                    key={`${team1Score}-${team2Score}`}
                    initial={{ scale: 1.2, opacity: 0.6 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-3xl font-bold tabular-nums"
                  >
                    {team1Score} - {team2Score}
                  </motion.div>
                  <p className="mt-1 text-[10px] text-muted-foreground">First to {targetHands}</p>
                  {isMatchComplete && (
                    <p className="mt-1 text-xs font-semibold text-emerald-500">
                      {team1Score >= targetHands ? t1?.name : t2?.name} wins!
                    </p>
                  )}
                </div>
                <div className="text-center">
                  <div
                    className="mx-auto flex size-12 items-center justify-center rounded-full text-sm font-bold text-white"
                    style={{ backgroundColor: t2?.colorHex ?? "#6b7280" }}
                  >
                    {t2?.name.split(" ").map((word) => word[0]).join("").toUpperCase().slice(0, 2)}
                  </div>
                  <p className="mt-1 max-w-[80px] truncate text-xs font-medium">{t2?.name}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {team1Id && team2Id && !isMatchComplete && (
          <Card>
            <CardContent className="space-y-3 py-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Hand {hands.length + 1} - Who won?
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <p className="text-center text-xs font-medium">{t1?.name}</p>
                  <Button variant="outline" className="w-full" onClick={() => addHand(team1Id, "domino")}>
                    Domino
                  </Button>
                  <Button variant="outline" className="w-full" onClick={() => addHand(team1Id, "pose")}>
                    Pose / Lock
                  </Button>
                </div>
                <div className="space-y-2">
                  <p className="text-center text-xs font-medium">{t2?.name}</p>
                  <Button variant="outline" className="w-full" onClick={() => addHand(team2Id, "domino")}>
                    Domino
                  </Button>
                  <Button variant="outline" className="w-full" onClick={() => addHand(team2Id, "pose")}>
                    Pose / Lock
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {hands.length > 0 && (
          <Card>
            <CardContent className="space-y-1 py-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Hand Log</p>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={removeLastHand}>
                  Undo Last
                </Button>
              </div>
              {hands.map((hand) => {
                const winnerTeam = teamMap.get(hand.winnerId!)
                return (
                  <div
                    key={hand.handNumber}
                    className="flex items-center justify-between border-b border-border/30 py-1 text-xs last:border-0"
                  >
                    <span className="text-muted-foreground">Hand {hand.handNumber}</span>
                    <span className="flex items-center gap-1.5">
                      <span className={cn("font-medium", hand.winnerId === team1Id ? "text-emerald-500" : "text-blue-500")}>
                        {winnerTeam?.name}
                      </span>
                      <span className="text-muted-foreground">({hand.endType})</span>
                    </span>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="space-y-3 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                max={todayISO()}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                placeholder="Any notes..."
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {errors.hands && (
          <p className="text-center text-xs text-destructive">{errors.hands}</p>
        )}

        {saveError && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
            <p className="text-xs text-destructive">{saveError}</p>
          </div>
        )}

        <motion.div whileTap={{ scale: 0.98 }}>
          <Button className="h-12 w-full text-base font-semibold" disabled={saving || !isMatchComplete} onClick={doSave}>
            {saving ? "Saving..." : isTournamentFixture ? "Save Result" : "Save Match"}
          </Button>
        </motion.div>
      </div>
    </div>
  )
}

export const Route = createFileRoute("/dominoes/matches/new")({
  validateSearch: (search: Record<string, unknown>) => ({
    tournamentId: typeof search.tournamentId === "string" ? search.tournamentId : undefined,
    fixtureId: typeof search.fixtureId === "string" ? search.fixtureId : undefined,
  }),
  component: NewDominoMatchPage,
})

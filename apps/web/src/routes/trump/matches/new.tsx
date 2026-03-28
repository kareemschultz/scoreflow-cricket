import { useEffect, useState } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useLiveQuery } from "dexie-react-hooks"
import { todayISO } from "@/lib/date-utils"
import { ArrowLeft, Plus, Minus, AlertCircle, Trophy } from "lucide-react"
import { motion } from "framer-motion"
import { nanoid } from "nanoid"
import { db } from "@/db/index"
import { buildTrumpTournamentUpdateFromMatch } from "@/lib/trump-tournaments"
import type { TrumpHand, TrumpSuit } from "@/types/trump"
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

const SUITS: { value: TrumpSuit; label: string; symbol: string; color: string }[] = [
  { value: "hearts", label: "Hearts", symbol: "\u2665", color: "text-red-500" },
  { value: "diamonds", label: "Diamonds", symbol: "\u2666", color: "text-red-500" },
  { value: "clubs", label: "Clubs", symbol: "\u2663", color: "text-foreground" },
  { value: "spades", label: "Spades", symbol: "\u2660", color: "text-foreground" },
]

const TRUMP_CALL_OPTIONS = [
  { value: "stand", label: "Stand", desc: "Accepted trump" },
  { value: "gaveOne", label: "Give One", desc: "Dealer gave 1 point" },
  { value: "kicked", label: "Kick / Run", desc: "Ran the pack" },
] as const

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

function NewTrumpMatchPage() {
  const navigate = useNavigate()
  const search = Route.useSearch()
  const teams = useLiveQuery(() => db.trumpTeams.orderBy("createdAt").toArray())
  const matches = useLiveQuery(() => db.trumpMatches.toArray())
  const tournamentContext = useLiveQuery(async () => {
    if (!search.tournamentId || !search.fixtureId) return null
    const tournament = await db.trumpTournaments.get(search.tournamentId)
    if (!tournament) return null
    const fixture = tournament.fixtures.find((candidate) => candidate.id === search.fixtureId)
    return fixture ? { tournament, fixture } : null
  }, [search.tournamentId, search.fixtureId])

  const [team1Id, setTeam1Id] = useState<string | null>(null)
  const [team2Id, setTeam2Id] = useState<string | null>(null)
  const [targetScore, setTargetScore] = useState(14)
  const [date, setDate] = useState(todayISO())
  const [notes, setNotes] = useState("")

  const [hands, setHands] = useState<TrumpHand[]>([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [handSuit, setHandSuit] = useState<TrumpSuit>("spades")
  const [handDealer, setHandDealer] = useState<string | null>(null)
  const [handCall, setHandCall] = useState<"stand" | "gaveOne" | "kicked">("stand")
  const [handHigh, setHandHigh] = useState<string | null>(null)
  const [handLow, setHandLow] = useState<string | null>(null)
  const [handJack, setHandJack] = useState<string | null>(null)
  const [handGame, setHandGame] = useState<string | null>(null)
  const [handHangJack, setHandHangJack] = useState(false)

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
    setHandDealer(activeFixture.team1Id)
    setSaveError(null)
  }, [activeFixture, isTournamentFixture])

  const teamMap = new Map((teams ?? []).map((team) => [team.id, team]))
  const t1 = team1Id ? teamMap.get(team1Id) : undefined
  const t2 = team2Id ? teamMap.get(team2Id) : undefined

  let team1Score = 0
  let team2Score = 0
  for (const hand of hands) {
    team1Score += hand.team1Points
    team2Score += hand.team2Points
  }
  const isMatchComplete = team1Score >= targetScore || team2Score >= targetScore

  function addHand() {
    if (!team1Id || !team2Id) return

    const team1Points =
      [handHigh, handLow, handJack, handGame].filter((teamId) => teamId === team1Id).length +
      (handHangJack && handDealer === team1Id ? 1 : 0) +
      (handCall === "gaveOne" && handDealer !== team1Id ? 1 : 0)
    const team2Points =
      [handHigh, handLow, handJack, handGame].filter((teamId) => teamId === team2Id).length +
      (handHangJack && handDealer === team2Id ? 1 : 0) +
      (handCall === "gaveOne" && handDealer !== team2Id ? 1 : 0)

    const hand: TrumpHand = {
      handNumber: hands.length + 1,
      trumpSuit: handSuit,
      dealerTeamId: handDealer ?? team1Id,
      begged: handCall !== "stand",
      kicked: handCall === "kicked",
      gaveOne: handCall === "gaveOne",
      highTeamId: handHigh,
      lowTeamId: handLow,
      jackTeamId: handJack,
      gameTeamId: handGame,
      hangJack: handHangJack,
      hangJackTeamId: handHangJack ? (handDealer ?? team1Id) : null,
      team1Points,
      team2Points,
    }

    setHands((prev) => [...prev, hand])
    setHandSuit("spades")
    setHandDealer(handDealer === team1Id ? team2Id : team1Id)
    setHandCall("stand")
    setHandHigh(null)
    setHandLow(null)
    setHandJack(null)
    setHandGame(null)
    setHandHangJack(false)
  }

  function removeLastHand() {
    setHands((prev) => prev.slice(0, -1))
  }

  async function doSave() {
    if (!team1Id || !team2Id || !isMatchComplete) return

    setSaving(true)
    setSaveError(null)

    try {
      const winnerId = team1Score >= targetScore ? team1Id : team2Id
      const match = {
        id: nanoid(),
        date: new Date(date),
        targetScore,
        team1Id,
        team2Id,
        hands,
        team1Score,
        team2Score,
        winnerId,
        status: "completed" as const,
        tournamentId: isTournamentFixture ? activeTournament!.id : undefined,
        tournamentFixtureId: isTournamentFixture ? activeFixture!.id : undefined,
        notes: notes.trim() || undefined,
      }

      await db.transaction("rw", db.trumpMatches, db.trumpTournaments, async () => {
        await db.trumpMatches.add(match)

        if (isTournamentFixture && activeTournament && activeFixture) {
          const latestTournament = await db.trumpTournaments.get(activeTournament.id)
          if (!latestTournament) {
            throw new Error("Tournament no longer exists.")
          }

          const tournamentUpdate = buildTrumpTournamentUpdateFromMatch({
            tournament: latestTournament,
            fixtureId: activeFixture.id,
            match,
            teams: teams ?? [],
            matches: [...(matches ?? []).filter((existing) => existing.id !== match.id), match],
          })

          await db.trumpTournaments.update(activeTournament.id, tournamentUpdate)
        }
      })

      if (isTournamentFixture && activeTournament) {
        navigate({
          to: "/trump/tournaments/$tournamentId",
          params: { tournamentId: activeTournament.id },
        })
        return
      }

      navigate({ to: "/trump" })
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Failed to save match.")
    } finally {
      setSaving(false)
    }
  }

  if (!teams || !matches || isLoadingTournamentContext) {
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
            <p className="text-3xl">{"\u2660"}</p>
            <p className="text-sm font-medium">Not enough teams</p>
            <p className="text-xs text-muted-foreground">You need at least 2 teams to record a match</p>
            <Button onClick={() => navigate({ to: "/trump/teams" })} variant="outline" className="mt-2">
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
                  to: "/trump/tournaments/$tournamentId",
                  params: { tournamentId: activeTournament.id },
                })
                return
              }

              navigate({ to: "/trump/matches" })
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
          <Card className="border-red-500/30 bg-red-500/5">
            <CardContent className="flex items-start gap-3 py-4">
              <div className="flex size-10 items-center justify-center rounded-full bg-red-500/10">
                <Trophy className="size-4 text-red-500" />
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
                  <Select
                    value={team1Id}
                    onValueChange={(value: string | null) => {
                      setTeam1Id(value)
                      setHandDealer(value)
                      setSaveError(null)
                    }}
                  >
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
                </div>
                <div className="space-y-1.5">
                  <Label>Team 2</Label>
                  <Select
                    value={team2Id}
                    onValueChange={(value: string | null) => {
                      setTeam2Id(value)
                      setSaveError(null)
                    }}
                  >
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
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>First to (points)</Label>
              <div className="flex items-center gap-3">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.9 }}
                  className="flex size-8 items-center justify-center rounded-full bg-muted disabled:opacity-40"
                  onClick={() => setTargetScore((value) => Math.max(1, value - 1))}
                  disabled={targetScore <= 1}
                >
                  <Minus className="size-3" />
                </motion.button>
                <span className="w-8 text-center text-lg font-bold tabular-nums">{targetScore}</span>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.9 }}
                  className="flex size-8 items-center justify-center rounded-full bg-primary"
                  onClick={() => setTargetScore((value) => value + 1)}
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
                  <p className="mt-1 text-[10px] text-muted-foreground">First to {targetScore}</p>
                  {isMatchComplete && (
                    <p className="mt-1 text-xs font-semibold text-emerald-500">
                      {team1Score >= targetScore ? t1?.name : t2?.name} wins!
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
            <CardContent className="space-y-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Hand {hands.length + 1}
              </p>

              <div className="space-y-1.5">
                <Label>Trump Suit</Label>
                <div className="flex gap-2">
                  {SUITS.map((suit) => (
                    <button
                      key={suit.value}
                      type="button"
                      onClick={() => setHandSuit(suit.value)}
                      className={cn(
                        "flex-1 rounded-lg border py-2 text-center text-lg transition-colors",
                        handSuit === suit.value ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50",
                        suit.color
                      )}
                    >
                      {suit.symbol}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>How Trump Was Made</Label>
                <div className="space-y-1.5">
                  <div className="mb-2 flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground">Dealer:</Label>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setHandDealer(team1Id)}
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs transition-colors",
                          handDealer === team1Id ? "border-primary bg-primary/10 text-primary" : "border-border"
                        )}
                      >
                        {t1?.name}
                      </button>
                      <button
                        type="button"
                        onClick={() => setHandDealer(team2Id)}
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs transition-colors",
                          handDealer === team2Id ? "border-primary bg-primary/10 text-primary" : "border-border"
                        )}
                      >
                        {t2?.name}
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {TRUMP_CALL_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setHandCall(option.value)}
                        className={cn(
                          "rounded-lg border px-2 py-2 text-center transition-colors",
                          handCall === option.value ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50"
                        )}
                      >
                        <p className="text-xs font-medium">{option.label}</p>
                        <p className="text-[9px] text-muted-foreground">{option.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Points Awarded</Label>
                {[
                  { label: "High", desc: "Highest trump", value: handHigh, setter: setHandHigh },
                  { label: "Low", desc: "Lowest trump captured", value: handLow, setter: setHandLow },
                  { label: "Jack", desc: "Jack of trumps (if in play)", value: handJack, setter: setHandJack },
                  { label: "Game", desc: "Most card points", value: handGame, setter: setHandGame },
                ].map((point) => (
                  <div key={point.label} className="flex items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-medium">{point.label}</span>
                      <span className="ml-1 text-[10px] text-muted-foreground">({point.desc})</span>
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => point.setter(point.value === team1Id ? null : team1Id)}
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-[10px] transition-colors",
                          point.value === team1Id
                            ? "border-emerald-500 bg-emerald-500/10 text-emerald-500"
                            : "border-border text-muted-foreground"
                        )}
                      >
                        {t1?.name?.split(" ")[0]}
                      </button>
                      <button
                        type="button"
                        onClick={() => point.setter(point.value === team2Id ? null : team2Id)}
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-[10px] transition-colors",
                          point.value === team2Id
                            ? "border-blue-500 bg-blue-500/10 text-blue-500"
                            : "border-border text-muted-foreground"
                        )}
                      >
                        {t2?.name?.split(" ")[0]}
                      </button>
                      {point.label === "Jack" && (
                        <button
                          type="button"
                          onClick={() => point.setter(null)}
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-[10px] transition-colors",
                            point.value === null
                              ? "border-amber-500 bg-amber-500/10 text-amber-500"
                              : "border-border text-muted-foreground"
                          )}
                        >
                          N/A
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium">Hang Jack</span>
                  <span className="ml-1 text-[10px] text-muted-foreground">(Jack turned up as trump)</span>
                </div>
                <button
                  type="button"
                  onClick={() => setHandHangJack((value) => !value)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs transition-colors",
                    handHangJack ? "border-amber-500 bg-amber-500/10 text-amber-500" : "border-border text-muted-foreground"
                  )}
                >
                  {handHangJack ? "Yes" : "No"}
                </button>
              </div>

              <Button className="w-full" onClick={addHand}>
                Record Hand {hands.length + 1}
              </Button>
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
                const suitInfo = SUITS.find((suit) => suit.value === hand.trumpSuit)
                return (
                  <div
                    key={hand.handNumber}
                    className="flex items-center justify-between border-b border-border/30 py-1.5 text-xs last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-6 text-muted-foreground">#{hand.handNumber}</span>
                      <span className={cn("text-sm", suitInfo?.color)}>{suitInfo?.symbol}</span>
                      {hand.begged && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[9px]">
                          {hand.kicked ? "Kick" : "Give 1"}
                        </span>
                      )}
                      {hand.hangJack && (
                        <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] text-amber-500">
                          HJ
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 tabular-nums">
                      <span className={cn("font-medium", hand.team1Points > 0 && "text-emerald-500")}>
                        {t1?.name?.split(" ")[0]}: +{hand.team1Points}
                      </span>
                      <span className={cn("font-medium", hand.team2Points > 0 && "text-blue-500")}>
                        {t2?.name?.split(" ")[0]}: +{hand.team2Points}
                      </span>
                    </div>
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

export const Route = createFileRoute("/trump/matches/new")({
  validateSearch: (search: Record<string, unknown>) => ({
    tournamentId: typeof search.tournamentId === "string" ? search.tournamentId : undefined,
    fixtureId: typeof search.fixtureId === "string" ? search.fixtureId : undefined,
  }),
  component: NewTrumpMatchPage,
})

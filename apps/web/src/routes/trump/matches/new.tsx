import { useState } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useLiveQuery } from "dexie-react-hooks"
import { format } from "date-fns"
import { ArrowLeft, Plus, Minus, AlertCircle } from "lucide-react"
import { motion } from "framer-motion"
import { nanoid } from "nanoid"
import { db } from "@/db/index"
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

function NewTrumpMatchPage() {
  const navigate = useNavigate()
  const teams = useLiveQuery(() => db.trumpTeams.orderBy("createdAt").toArray())

  const [team1Id, setTeam1Id] = useState<string | null>(null)
  const [team2Id, setTeam2Id] = useState<string | null>(null)
  const [targetScore, setTargetScore] = useState(14)
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [notes, setNotes] = useState("")

  // Hand recording state
  const [hands, setHands] = useState<TrumpHand[]>([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Current hand being recorded
  const [handSuit, setHandSuit] = useState<TrumpSuit>("spades")
  const [handDealer, setHandDealer] = useState<string | null>(null)
  const [handCall, setHandCall] = useState<"stand" | "gaveOne" | "kicked">("stand")
  const [handHigh, setHandHigh] = useState<string | null>(null)
  const [handLow, setHandLow] = useState<string | null>(null)
  const [handJack, setHandJack] = useState<string | null>(null)
  const [handGame, setHandGame] = useState<string | null>(null)
  const [handHangJack, setHandHangJack] = useState(false)

  const teamMap = new Map((teams ?? []).map((t) => [t.id, t]))
  const t1 = team1Id ? teamMap.get(team1Id) : undefined
  const t2 = team2Id ? teamMap.get(team2Id) : undefined

  // Running scores
  let team1Score = 0
  let team2Score = 0
  for (const h of hands) {
    team1Score += h.team1Points
    team2Score += h.team2Points
  }
  const isMatchComplete = team1Score >= targetScore || team2Score >= targetScore

  function addHand() {
    if (!team1Id || !team2Id) return

    const t1pts = [handHigh, handLow, handJack, handGame].filter((id) => id === team1Id).length
      + (handHangJack && handDealer === team1Id ? 1 : 0)
      + (handCall === "gaveOne" && handDealer !== team1Id ? 1 : 0)
    const t2pts = [handHigh, handLow, handJack, handGame].filter((id) => id === team2Id).length
      + (handHangJack && handDealer === team2Id ? 1 : 0)
      + (handCall === "gaveOne" && handDealer !== team2Id ? 1 : 0)

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
      team1Points: t1pts,
      team2Points: t2pts,
    }

    setHands((prev) => [...prev, hand])
    // Reset hand state, alternate dealer
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
      await db.trumpMatches.add({
        id: nanoid(),
        date: new Date(date),
        targetScore,
        team1Id,
        team2Id,
        hands,
        team1Score,
        team2Score,
        winnerId,
        status: "completed",
        notes: notes.trim() || undefined,
      })
      navigate({ to: "/trump" })
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save match.")
    } finally {
      setSaving(false)
    }
  }

  if (!teams) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin size-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  if (teams.length < 2) {
    return (
      <div className="min-h-full bg-background px-4 py-4">
        <Card>
          <CardContent className="py-10 text-center space-y-3">
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
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate({ to: "/trump/matches" })}
            className="size-8 rounded-full bg-muted/50 flex items-center justify-center"
          >
            <ArrowLeft className="size-4" />
          </button>
          <h1 className="text-lg font-bold">Record Match</h1>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4 pb-20">
        {/* Team Selection */}
        <Card>
          <CardContent className="py-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Team 1</Label>
                <Select value={team1Id} onValueChange={(v: string | null) => { setTeam1Id(v); setHandDealer(v); setSaveError(null) }}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    {teams.filter((t) => t.id !== team2Id).map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Team 2</Label>
                <Select value={team2Id} onValueChange={(v: string | null) => { setTeam2Id(v); setSaveError(null) }}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    {teams.filter((t) => t.id !== team1Id).map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>First to (points)</Label>
              <div className="flex items-center gap-3">
                <motion.button type="button" whileTap={{ scale: 0.9 }}
                  className="size-8 rounded-full bg-muted flex items-center justify-center disabled:opacity-40"
                  onClick={() => setTargetScore((v) => Math.max(1, v - 1))} disabled={targetScore <= 1}
                >
                  <Minus className="size-3" />
                </motion.button>
                <span className="text-lg font-bold tabular-nums w-8 text-center">{targetScore}</span>
                <motion.button type="button" whileTap={{ scale: 0.9 }}
                  className="size-8 rounded-full bg-primary flex items-center justify-center"
                  onClick={() => setTargetScore((v) => v + 1)}
                >
                  <Plus className="size-3 text-primary-foreground" />
                </motion.button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Score Display */}
        {team1Id && team2Id && (
          <Card>
            <CardContent className="py-5">
              <div className="flex items-center justify-around">
                <div className="text-center">
                  <div className="size-12 rounded-full mx-auto flex items-center justify-center font-bold text-white text-sm"
                    style={{ backgroundColor: t1?.colorHex ?? "#6b7280" }}>
                    {t1?.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)}
                  </div>
                  <p className="text-xs font-medium mt-1 truncate max-w-[80px]">{t1?.name}</p>
                </div>
                <div className="text-center">
                  <motion.div key={`${team1Score}-${team2Score}`}
                    initial={{ scale: 1.2, opacity: 0.6 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-3xl font-bold tabular-nums"
                  >
                    {team1Score} - {team2Score}
                  </motion.div>
                  <p className="text-[10px] text-muted-foreground mt-1">First to {targetScore}</p>
                  {isMatchComplete && (
                    <p className="text-xs text-emerald-500 font-semibold mt-1">
                      {team1Score >= targetScore ? t1?.name : t2?.name} wins!
                    </p>
                  )}
                </div>
                <div className="text-center">
                  <div className="size-12 rounded-full mx-auto flex items-center justify-center font-bold text-white text-sm"
                    style={{ backgroundColor: t2?.colorHex ?? "#6b7280" }}>
                    {t2?.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)}
                  </div>
                  <p className="text-xs font-medium mt-1 truncate max-w-[80px]">{t2?.name}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Hand Recording */}
        {team1Id && team2Id && !isMatchComplete && (
          <Card>
            <CardContent className="py-4 space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Hand {hands.length + 1}</p>

              {/* Trump Suit */}
              <div className="space-y-1.5">
                <Label>Trump Suit</Label>
                <div className="flex gap-2">
                  {SUITS.map((s) => (
                    <button key={s.value} type="button"
                      onClick={() => setHandSuit(s.value)}
                      className={cn(
                        "flex-1 py-2 rounded-lg border text-center transition-colors text-lg",
                        handSuit === s.value ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50",
                        s.color
                      )}
                    >
                      {s.symbol}
                    </button>
                  ))}
                </div>
              </div>

              {/* How trump was called */}
              <div className="space-y-1.5">
                <Label>How Trump Was Made</Label>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 mb-2">
                    <Label className="text-xs text-muted-foreground">Dealer:</Label>
                    <div className="flex gap-1">
                      <button type="button"
                        onClick={() => setHandDealer(team1Id)}
                        className={cn("text-xs px-3 py-1 rounded-full border transition-colors",
                          handDealer === team1Id ? "border-primary bg-primary/10 text-primary" : "border-border")}
                      >
                        {t1?.name}
                      </button>
                      <button type="button"
                        onClick={() => setHandDealer(team2Id)}
                        className={cn("text-xs px-3 py-1 rounded-full border transition-colors",
                          handDealer === team2Id ? "border-primary bg-primary/10 text-primary" : "border-border")}
                      >
                        {t2?.name}
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {TRUMP_CALL_OPTIONS.map((opt) => (
                      <button key={opt.value} type="button"
                        onClick={() => setHandCall(opt.value)}
                        className={cn(
                          "py-2 px-2 rounded-lg border text-center transition-colors",
                          handCall === opt.value ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50"
                        )}
                      >
                        <p className="text-xs font-medium">{opt.label}</p>
                        <p className="text-[9px] text-muted-foreground">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Point Awards: High, Low, Jack, Game */}
              <div className="space-y-2">
                <Label>Points Awarded</Label>
                {[
                  { label: "High", desc: "Highest trump", value: handHigh, setter: setHandHigh },
                  { label: "Low", desc: "Lowest trump captured", value: handLow, setter: setHandLow },
                  { label: "Jack", desc: "Jack of trumps (if in play)", value: handJack, setter: setHandJack },
                  { label: "Game", desc: "Most card points", value: handGame, setter: setHandGame },
                ].map((pt) => (
                  <div key={pt.label} className="flex items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-medium">{pt.label}</span>
                      <span className="text-[10px] text-muted-foreground ml-1">({pt.desc})</span>
                    </div>
                    <div className="flex gap-1">
                      <button type="button"
                        onClick={() => pt.setter(pt.value === team1Id ? null : team1Id)}
                        className={cn("text-[10px] px-2.5 py-1 rounded-full border transition-colors",
                          pt.value === team1Id ? "border-emerald-500 bg-emerald-500/10 text-emerald-500" : "border-border text-muted-foreground")}
                      >
                        {t1?.name?.split(" ")[0]}
                      </button>
                      <button type="button"
                        onClick={() => pt.setter(pt.value === team2Id ? null : team2Id)}
                        className={cn("text-[10px] px-2.5 py-1 rounded-full border transition-colors",
                          pt.value === team2Id ? "border-blue-500 bg-blue-500/10 text-blue-500" : "border-border text-muted-foreground")}
                      >
                        {t2?.name?.split(" ")[0]}
                      </button>
                      {pt.label === "Jack" && (
                        <button type="button"
                          onClick={() => pt.setter(null)}
                          className={cn("text-[10px] px-2.5 py-1 rounded-full border transition-colors",
                            pt.value === null ? "border-amber-500 bg-amber-500/10 text-amber-500" : "border-border text-muted-foreground")}
                        >
                          N/A
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Hang Jack */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium">Hang Jack</span>
                  <span className="text-[10px] text-muted-foreground ml-1">(Jack turned up as trump)</span>
                </div>
                <button type="button"
                  onClick={() => setHandHangJack(!handHangJack)}
                  className={cn("text-xs px-3 py-1 rounded-full border transition-colors",
                    handHangJack ? "border-amber-500 bg-amber-500/10 text-amber-500" : "border-border text-muted-foreground")}
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

        {/* Hand Log */}
        {hands.length > 0 && (
          <Card>
            <CardContent className="py-3 space-y-1">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Hand Log</p>
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={removeLastHand}>
                  Undo Last
                </Button>
              </div>
              {hands.map((h) => {
                const suitInfo = SUITS.find((s) => s.value === h.trumpSuit)
                return (
                  <div key={h.handNumber} className="flex items-center justify-between py-1.5 text-xs border-b border-border/30 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground w-6">#{h.handNumber}</span>
                      <span className={cn("text-sm", suitInfo?.color)}>{suitInfo?.symbol}</span>
                      {h.begged && <span className="text-[9px] bg-muted px-1.5 py-0.5 rounded">{h.kicked ? "Kick" : "Give 1"}</span>}
                      {h.hangJack && <span className="text-[9px] bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded">HJ</span>}
                    </div>
                    <div className="flex items-center gap-3 tabular-nums">
                      <span className={cn("font-medium", h.team1Points > 0 && "text-emerald-500")}>
                        {t1?.name?.split(" ")[0]}: +{h.team1Points}
                      </span>
                      <span className={cn("font-medium", h.team2Points > 0 && "text-blue-500")}>
                        {t2?.name?.split(" ")[0]}: +{h.team2Points}
                      </span>
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )}

        {/* Date & Notes */}
        <Card>
          <CardContent className="py-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} max={format(new Date(), "yyyy-MM-dd")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea id="notes" placeholder="Any notes..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
          </CardContent>
        </Card>

        {saveError && (
          <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2">
            <AlertCircle className="size-4 text-destructive shrink-0 mt-0.5" />
            <p className="text-xs text-destructive">{saveError}</p>
          </div>
        )}

        <motion.div whileTap={{ scale: 0.98 }}>
          <Button className="w-full h-12 text-base font-semibold" disabled={saving || !isMatchComplete} onClick={doSave}>
            {saving ? "Saving..." : "Save Match"}
          </Button>
        </motion.div>
      </div>
    </div>
  )
}

export const Route = createFileRoute("/trump/matches/new")({
  component: NewTrumpMatchPage,
})

import { useState } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useLiveQuery } from "dexie-react-hooks"
import { format } from "date-fns"
import { ArrowLeft, Plus, Minus, AlertCircle } from "lucide-react"
import { motion } from "framer-motion"
import { nanoid } from "nanoid"
import { db } from "@/db/index"
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

function NewDominoMatchPage() {
  const navigate = useNavigate()
  const teams = useLiveQuery(() => db.dominoTeams.orderBy("createdAt").toArray())
  const players = useLiveQuery(() => db.dominoPlayers.toArray())

  const [team1Id, setTeam1Id] = useState<string | null>(null)
  const [team2Id, setTeam2Id] = useState<string | null>(null)
  const [targetHands, setTargetHands] = useState(6)
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [notes, setNotes] = useState("")

  // Hand-by-hand recording
  const [hands, setHands] = useState<DominoHand[]>([])
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saveError, setSaveError] = useState<string | null>(null)

  const teamMap = new Map((teams ?? []).map((t) => [t.id, t]))
  const t1 = team1Id ? teamMap.get(team1Id) : undefined
  const t2 = team2Id ? teamMap.get(team2Id) : undefined

  const team1Score = hands.filter((h) => h.winnerId === team1Id).length
  const team2Score = hands.filter((h) => h.winnerId === team2Id).length
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
    const e: Record<string, string> = {}
    if (!team1Id) e.team1 = "Select team 1"
    if (!team2Id) e.team2 = "Select team 2"
    if (team1Id && team2Id && team1Id === team2Id) e.team2 = "Can't select the same team twice"
    if (hands.length === 0) e.hands = "Record at least one hand"
    if (!isMatchComplete) e.hands = "Match is not complete yet"
    return e
  }

  async function doSave() {
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setSaving(true)
    setSaveError(null)
    try {
      const winnerId = team1Score >= targetHands ? team1Id! : team2Id!
      await db.dominoMatches.add({
        id: nanoid(),
        date: new Date(date),
        scoringMode: "hands",
        targetHands,
        targetPoints: 100,
        team1Id: team1Id!,
        team2Id: team2Id!,
        hands,
        team1Score,
        team2Score,
        winnerId,
        status: "completed",
        notes: notes.trim() || undefined,
      })
      navigate({ to: "/dominoes" })
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save match.")
    } finally {
      setSaving(false)
    }
  }

  if (!teams || !players) {
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
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate({ to: "/dominoes/matches" })}
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
                <Select value={team1Id} onValueChange={(v: string | null) => { setTeam1Id(v); setErrors({}) }}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    {teams.filter((t) => t.id !== team2Id).map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.team1 && <p className="text-[10px] text-destructive">{errors.team1}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Team 2</Label>
                <Select value={team2Id} onValueChange={(v: string | null) => { setTeam2Id(v); setErrors({}) }}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    {teams.filter((t) => t.id !== team1Id).map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.team2 && <p className="text-[10px] text-destructive">{errors.team2}</p>}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>First to (hands)</Label>
              <div className="flex items-center gap-3">
                <motion.button type="button" whileTap={{ scale: 0.9 }}
                  className="size-8 rounded-full bg-muted flex items-center justify-center disabled:opacity-40"
                  onClick={() => setTargetHands((v) => Math.max(1, v - 1))} disabled={targetHands <= 1}
                >
                  <Minus className="size-3" />
                </motion.button>
                <span className="text-lg font-bold tabular-nums w-8 text-center">{targetHands}</span>
                <motion.button type="button" whileTap={{ scale: 0.9 }}
                  className="size-8 rounded-full bg-primary flex items-center justify-center"
                  onClick={() => setTargetHands((v) => v + 1)}
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
                  <p className="text-[10px] text-muted-foreground mt-1">First to {targetHands}</p>
                  {isMatchComplete && (
                    <p className="text-xs text-emerald-500 font-semibold mt-1">
                      {team1Score >= targetHands ? t1?.name : t2?.name} wins!
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

        {/* Hand Recording Buttons */}
        {team1Id && team2Id && !isMatchComplete && (
          <Card>
            <CardContent className="py-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Hand {hands.length + 1} - Who won?</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <p className="text-xs text-center font-medium">{t1?.name}</p>
                  <Button variant="outline" className="w-full" onClick={() => addHand(team1Id!, "domino")}>
                    Domino
                  </Button>
                  <Button variant="outline" className="w-full" onClick={() => addHand(team1Id!, "pose")}>
                    Pose / Lock
                  </Button>
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-center font-medium">{t2?.name}</p>
                  <Button variant="outline" className="w-full" onClick={() => addHand(team2Id!, "domino")}>
                    Domino
                  </Button>
                  <Button variant="outline" className="w-full" onClick={() => addHand(team2Id!, "pose")}>
                    Pose / Lock
                  </Button>
                </div>
              </div>
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
                const winnerTeam = teamMap.get(h.winnerId!)
                return (
                  <div key={h.handNumber} className="flex items-center justify-between py-1 text-xs border-b border-border/30 last:border-0">
                    <span className="text-muted-foreground">Hand {h.handNumber}</span>
                    <span className="flex items-center gap-1.5">
                      <span className={cn("font-medium", h.winnerId === team1Id ? "text-emerald-500" : "text-blue-500")}>
                        {winnerTeam?.name}
                      </span>
                      <span className="text-muted-foreground">({h.endType})</span>
                    </span>
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

        {errors.hands && (
          <p className="text-xs text-destructive text-center">{errors.hands}</p>
        )}

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

export const Route = createFileRoute("/dominoes/matches/new")({
  component: NewDominoMatchPage,
})

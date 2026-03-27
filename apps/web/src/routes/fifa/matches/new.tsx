import { useState } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useLiveQuery } from "dexie-react-hooks"
import { format } from "date-fns"
import { ArrowLeft, Minus, Plus } from "lucide-react"
import { motion } from "framer-motion"
import { nanoid } from "nanoid"
import { db } from "@/db/index"
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

function ScoreInput({
  label,
  value,
  onChange,
  playerName,
  playerColor,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  playerName?: string
  playerColor?: string
}) {
  const initials = playerName
    ? playerName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)
    : "?"

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="size-14 rounded-full flex items-center justify-center font-bold text-white text-lg"
        style={{ backgroundColor: playerColor ?? "#6b7280" }}
      >
        {initials}
      </div>
      <p className="text-sm font-medium text-center max-w-[100px] truncate">{playerName ?? label}</p>
      <div className="flex items-center gap-3">
        <motion.button
          whileTap={{ scale: 0.9 }}
          className="size-10 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors disabled:opacity-40"
          onClick={() => onChange(Math.max(0, value - 1))}
          disabled={value <= 0}
          type="button"
        >
          <Minus className="size-4" />
        </motion.button>
        <motion.span
          key={value}
          initial={{ scale: 1.2, opacity: 0.6 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-4xl font-bold tabular-nums w-12 text-center"
        >
          {value}
        </motion.span>
        <motion.button
          whileTap={{ scale: 0.9 }}
          className="size-10 rounded-full bg-primary flex items-center justify-center hover:bg-primary/90 transition-colors"
          onClick={() => onChange(value + 1)}
          type="button"
        >
          <Plus className="size-4 text-primary-foreground" />
        </motion.button>
      </div>
    </div>
  )
}

function NewFifaMatchPage() {
  const navigate = useNavigate()
  const players = useLiveQuery(() => db.fifaPlayers.orderBy("createdAt").toArray())

  const [player1Id, setPlayer1Id] = useState<string | null>(null)
  const [player2Id, setPlayer2Id] = useState<string | null>(null)
  const [player1Score, setPlayer1Score] = useState(0)
  const [player2Score, setPlayer2Score] = useState(0)
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const playerMap = new Map((players ?? []).map((p) => [p.id, p]))

  function validate() {
    const e: Record<string, string> = {}
    if (!player1Id) e.player1 = "Select player 1"
    if (!player2Id) e.player2 = "Select player 2"
    if (player1Id && player2Id && player1Id === player2Id) e.player2 = "Can't select the same player twice"
    return e
  }

  async function doSave() {
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setSaving(true)
    try {
      await db.fifaMatches.add({
        id: nanoid(),
        player1Id: player1Id!,
        player2Id: player2Id!,
        player1Score,
        player2Score,
        date: new Date(date),
        notes: notes.trim() || undefined,
      })
      navigate({ to: "/fifa" })
    } finally {
      setSaving(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    void doSave()
  }

  if (!players) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin size-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  if (players.length < 2) {
    return (
      <div className="min-h-full bg-background px-4 py-4">
        <Card>
          <CardContent className="py-10 text-center space-y-3">
            <p className="text-3xl">👤</p>
            <p className="text-sm font-medium">Not enough players</p>
            <p className="text-xs text-muted-foreground">You need at least 2 players to record a match</p>
            <Button onClick={() => navigate({ to: "/fifa/players" })} variant="outline" className="mt-2">
              Add Players
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const p1 = player1Id ? playerMap.get(player1Id) : undefined
  const p2 = player2Id ? playerMap.get(player2Id) : undefined

  return (
    <div className="min-h-full bg-background relative overflow-hidden">
      {/* Animated background — kick-off energy */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <motion.div
          className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-emerald-500/6"
          animate={{ scale: [1, 1.12, 1], x: [0, -8, 0], y: [0, 10, 0] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-20 -left-16 w-52 h-52 rounded-full bg-blue-500/5"
          animate={{ scale: [1, 1.1, 1], x: [0, 10, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        />
        {/* Goal net grid */}
        <motion.svg
          className="absolute top-8 left-0 right-0 w-full opacity-[0.04]"
          height="80" viewBox="0 0 400 80" preserveAspectRatio="none"
          animate={{ opacity: [0.03, 0.06, 0.03] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        >
          {[0, 25, 50, 75, 100, 125, 150, 175, 200, 225, 250, 275, 300, 325, 350, 375, 400].map((x) => (
            <line key={x} x1={x} y1="0" x2={x} y2="80" stroke="#4ade80" strokeWidth="1" />
          ))}
          {[0, 20, 40, 60, 80].map((y) => (
            <line key={y} x1="0" y1={y} x2="400" y2={y} stroke="#4ade80" strokeWidth="1" />
          ))}
        </motion.svg>
        {/* Bouncing football */}
        <motion.svg
          className="absolute bottom-20 right-8 opacity-[0.08]"
          width="40" height="40" viewBox="0 0 40 40"
          animate={{ y: [0, -18, 0], rotate: [0, 180, 360] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <circle cx="20" cy="20" r="18" fill="white" />
          <polygon points="20,7 24,13 22,20 18,20 16,13" fill="#1a1a1a" />
          <polygon points="8,16 13,13 16,20 13,24 8,23" fill="#1a1a1a" />
          <polygon points="32,16 27,13 24,20 27,24 32,23" fill="#1a1a1a" />
          <polygon points="20,33 16,28 24,28 26,33 20,35" fill="#1a1a1a" />
        </motion.svg>
      </div>
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate({ to: "/fifa/matches" })}
            className="size-8 rounded-full bg-muted/50 flex items-center justify-center"
          >
            <ArrowLeft className="size-4" />
          </button>
          <h1 className="text-lg font-bold">Record Match</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="px-4 py-4 space-y-5 pb-20">
        <Card>
          <CardContent className="py-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="p1">Player 1</Label>
                <Select
                  value={player1Id}
                  onValueChange={(v: string | null) => { setPlayer1Id(v); setErrors((e) => ({ ...e, player1: "" })) }}
                >
                  <SelectTrigger id="p1" className="w-full">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {players.filter((p) => p.id !== player2Id).map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.player1 && <p className="text-[10px] text-destructive">{errors.player1}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="p2">Player 2</Label>
                <Select
                  value={player2Id}
                  onValueChange={(v: string | null) => { setPlayer2Id(v); setErrors((e) => ({ ...e, player2: "" })) }}
                >
                  <SelectTrigger id="p2" className="w-full">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {players.filter((p) => p.id !== player1Id).map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.player2 && <p className="text-[10px] text-destructive">{errors.player2}</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-6">
            <div className="flex items-center justify-around">
              <ScoreInput label="Player 1" value={player1Score} onChange={setPlayer1Score} playerName={p1?.name} playerColor={p1?.colorHex} />
              <div className="flex flex-col items-center gap-1">
                <span className="text-2xl text-muted-foreground font-light">–</span>
                {player1Id && player2Id && (
                  <span className={`text-[10px] font-semibold ${player1Score === player2Score ? "text-amber-500" : "text-emerald-500"}`}>
                    {player1Score === player2Score
                      ? "DRAW"
                      : player1Score > player2Score
                        ? `${p1?.name?.split(" ")[0]} wins`
                        : `${p2?.name?.split(" ")[0]} wins`
                    }
                  </span>
                )}
              </div>
              <ScoreInput label="Player 2" value={player2Score} onChange={setPlayer2Score} playerName={p2?.name} playerColor={p2?.colorHex} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} max={format(new Date(), "yyyy-MM-dd")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea id="notes" placeholder="Any notes about this match..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
          </CardContent>
        </Card>

        <motion.div whileTap={{ scale: 0.98 }}>
          <Button type="submit" onClick={doSave} className="w-full h-12 text-base font-semibold" disabled={saving}>
            {saving ? "Saving…" : "Save Match"}
          </Button>
        </motion.div>
      </form>
    </div>
  )
}

export const Route = createFileRoute("/fifa/matches/new")({
  component: NewFifaMatchPage,
})

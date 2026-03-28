import { motion } from "framer-motion"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useLiveQuery } from "dexie-react-hooks"
import { useState } from "react"
import { formatMatchDateShort } from "@/lib/date-utils"
import { Trophy, Plus, ArrowRight } from "lucide-react"
import { nanoid } from "nanoid"
import { db } from "@/db/index"
import type { Tournament, TournamentFormat, CricketFormat } from "@/types/cricket"
import { DEFAULT_RULES } from "@/types/cricket"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/tournaments/")({
  component: TournamentsPage,
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusBadgeClass(status: Tournament["status"]) {
  if (status === "completed") return "bg-muted text-muted-foreground border-border"
  if (status === "live") return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
  return "bg-blue-500/20 text-blue-400 border-blue-500/30"
}

function formatLabel(fmt: TournamentFormat) {
  const map: Record<TournamentFormat, string> = {
    ROUND_ROBIN: "Round Robin",
    KNOCKOUT: "Knockout",
    GROUP_KNOCKOUT: "Group + Knockout",
  }
  return map[fmt]
}

// ─── TournamentCard ───────────────────────────────────────────────────────────

function TournamentCard({ tournament }: { tournament: Tournament }) {
  const navigate = useNavigate()
  const completed = tournament.fixtures.filter((f) => f.result !== null).length
  const total = tournament.fixtures.length

  return (
    <button
      className="w-full text-left"
      onClick={() => navigate({ to: "/tournaments/$tournamentId", params: { tournamentId: tournament.id } })}
    >
      <Card className="hover:bg-muted/50 active:bg-muted/70 transition-colors">
        <CardContent className="py-3 px-4">
          <div className="flex items-start gap-3">
            <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Trophy className="size-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{tournament.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatLabel(tournament.format)} · {tournament.teamIds.length} teams · {tournament.matchFormat}
              </p>
              {total > 0 && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {completed}/{total} matches played
                </p>
              )}
              <p className="text-[10px] text-muted-foreground mt-1">
                {formatMatchDateShort(tournament.createdAt)}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              <Badge
                variant="outline"
                className={`text-[10px] px-1.5 py-0 ${statusBadgeClass(tournament.status)}`}
              >
                {tournament.status}
              </Badge>
              <ArrowRight className="size-4 text-muted-foreground" />
            </div>
          </div>
        </CardContent>
      </Card>
    </button>
  )
}

// ─── NewTournamentDialog ──────────────────────────────────────────────────────

function NewTournamentDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState("")
  const [tournamentFormat, setTournamentFormat] = useState<TournamentFormat>("ROUND_ROBIN")
  const [matchFormat, setMatchFormat] = useState<CricketFormat>("T20")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    try {
      const tournament: Tournament = {
        id: nanoid(),
        name: name.trim(),
        format: tournamentFormat,
        matchFormat,
        rules: DEFAULT_RULES[matchFormat],
        teamIds: [],
        fixtures: [],
        status: "upcoming",
        pointsPerWin: 2,
        pointsPerTie: 1,
        pointsPerAbandoned: 1,
        createdAt: new Date(),
      }
      await db.tournaments.add(tournament)
      setName("")
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create tournament. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm mx-4 top-16 translate-y-0 max-h-[80dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Tournament</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Tournament name</Label>
            <Input
              placeholder="e.g. Summer League 2025"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              autoFocus
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Tournament format</Label>
            <Select value={tournamentFormat} onValueChange={(v) => v && setTournamentFormat(v as TournamentFormat)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ROUND_ROBIN">Round Robin</SelectItem>
                <SelectItem value="KNOCKOUT">Knockout</SelectItem>
                <SelectItem value="GROUP_KNOCKOUT">Group + Knockout</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Match format</Label>
            <Select value={matchFormat} onValueChange={(v) => v && setMatchFormat(v as CricketFormat)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="T20">T20</SelectItem>
                <SelectItem value="ODI">ODI</SelectItem>
                <SelectItem value="TEST">Test</SelectItem>
                <SelectItem value="CUSTOM">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleCreate} disabled={!name.trim() || saving}>
            {saving ? "Creating…" : "Create Tournament"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── TournamentsPage ──────────────────────────────────────────────────────────

function TournamentsPage() {
  const [showNew, setShowNew] = useState(false)

  const tournaments = useLiveQuery(async () => {
    const all = await db.tournaments.toArray()
    return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  })

  return (
    <div className="min-h-full bg-background relative overflow-hidden">
      {/* Animated background — tournament bracket glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <motion.div
          className="absolute -top-20 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full bg-amber-500/7"
          animate={{ scale: [1, 1.15, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute top-1/3 -left-16 w-48 h-48 rounded-full bg-violet-500/5"
          animate={{ scale: [1, 1.1, 1], x: [0, 10, 0] }}
          transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        />
        <motion.div
          className="absolute bottom-20 -right-16 w-44 h-44 rounded-full bg-emerald-500/5"
          animate={{ scale: [1, 1.12, 1], y: [0, -12, 0] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        />
        {/* Bracket-like intersecting lines */}
        <motion.div
          className="absolute top-[20%] left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/10 to-transparent"
          animate={{ opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute top-[45%] left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/8 to-transparent"
          animate={{ opacity: [0.2, 0.5, 0.2] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
        />
      </div>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Trophy className="size-5 text-primary" />
          <h1 className="text-lg font-bold tracking-tight flex-1">Tournaments</h1>
          <Button size="sm" className="gap-1.5" onClick={() => setShowNew(true)}>
            <Plus className="size-3.5" />
            New
          </Button>
        </div>
      </div>

      <div className="px-4 py-4">
        {tournaments === undefined ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="py-3 px-4">
                  <div className="h-4 bg-muted rounded animate-pulse w-3/4 mb-2" />
                  <div className="h-3 bg-muted rounded animate-pulse w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : tournaments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Trophy className="size-12 text-muted-foreground/40 mb-4" />
            <p className="text-sm font-medium text-muted-foreground">No tournaments yet</p>
            <p className="text-xs text-muted-foreground mt-1 mb-5">
              Create a tournament to manage fixtures, standings, and results
            </p>
            <Button onClick={() => setShowNew(true)} className="gap-1.5">
              <Plus className="size-4" />
              Create Tournament
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {tournaments.map((t) => (
              <TournamentCard key={t.id} tournament={t} />
            ))}
          </div>
        )}
      </div>

      <NewTournamentDialog open={showNew} onClose={() => setShowNew(false)} />
    </div>
  )
}

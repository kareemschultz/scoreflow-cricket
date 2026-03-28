import { useState } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useLiveQuery } from "dexie-react-hooks"
import { formatMatchDateShort } from "@/lib/date-utils"
import { Plus, Trophy } from "lucide-react"
import { motion } from "framer-motion"
import { nanoid } from "nanoid"
import { db } from "@/db/index"
import type { TrumpTournament, TrumpTournamentFormat } from "@/types/trump"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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

function statusBadgeClass(status: TrumpTournament["status"]) {
  if (status === "completed") return "bg-muted text-muted-foreground border-border"
  if (status === "live") return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
  return "bg-blue-500/20 text-blue-400 border-blue-500/30"
}

function formatLabel(formatValue: TrumpTournamentFormat) {
  return formatValue === "ROUND_ROBIN" ? "Round Robin" : "Knockout"
}

function TournamentCard({ tournament }: { tournament: TrumpTournament }) {
  const navigate = useNavigate()
  const completed = tournament.fixtures.filter((fixture) => fixture.result !== null).length

  return (
    <button
      className="w-full text-left"
      onClick={() =>
        navigate({
          to: "/trump/tournaments/$tournamentId",
          params: { tournamentId: tournament.id },
        })
      }
    >
      <Card className="transition-colors hover:bg-muted/40">
        <CardContent className="px-4 py-3">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-red-500/10">
              <Trophy className="size-4 text-red-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{tournament.name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatLabel(tournament.format)} · {tournament.teamIds.length} teams
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {completed}/{tournament.fixtures.length} fixtures complete
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {formatMatchDateShort(tournament.createdAt)}
              </p>
            </div>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] ${statusBadgeClass(tournament.status)}`}>
              {tournament.status}
            </span>
          </div>
        </CardContent>
      </Card>
    </button>
  )
}

function NewTournamentDialog({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [name, setName] = useState("")
  const [formatValue, setFormatValue] = useState<TrumpTournamentFormat>("ROUND_ROBIN")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
    if (!name.trim()) return
    setSaving(true)
    setError(null)

    try {
      const tournament: TrumpTournament = {
        id: nanoid(),
        name: name.trim(),
        format: formatValue,
        teamIds: [],
        fixtures: [],
        status: "upcoming",
        pointsPerWin: 2,
        pointsPerAbandoned: 1,
        createdAt: new Date(),
      }
      await db.trumpTournaments.add(tournament)
      setName("")
      setFormatValue("ROUND_ROBIN")
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create tournament.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="top-16 mx-4 max-h-[80dvh] max-w-sm translate-y-0 overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Trump Tournament</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Tournament name</Label>
            <Input
              placeholder="e.g. Easter Trump Classic"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && handleCreate()}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label>Format</Label>
            <Select
              value={formatValue}
              onValueChange={(value) => value && setFormatValue(value as TrumpTournamentFormat)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ROUND_ROBIN">Round Robin</SelectItem>
                <SelectItem value="KNOCKOUT">Knockout</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">
              Knockout currently supports 2, 4, 8, or 16 teams.
            </p>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleCreate} disabled={!name.trim() || saving}>
            {saving ? "Creating..." : "Create Tournament"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TrumpTournamentIndexPage() {
  const navigate = useNavigate()
  const [showNew, setShowNew] = useState(false)

  const tournaments = useLiveQuery(async () => {
    const all = await db.trumpTournaments.toArray()
    return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  })

  return (
    <div className="min-h-full bg-background relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
        <motion.div
          className="absolute -top-20 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-red-500/7"
          animate={{ scale: [1, 1.15, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <div className="sticky top-0 z-10 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold tracking-tight">Trump Tournaments</h1>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => navigate({ to: "/trump" })}>
              Hub
            </Button>
            <Button size="sm" onClick={() => setShowNew(true)} className="gap-1">
              <Plus className="size-4" />
              New
            </Button>
          </div>
        </div>
      </div>

      <div className="px-4 py-4">
        {!tournaments ? (
          <div className="space-y-2">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-16 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : tournaments.length === 0 ? (
          <Card>
            <CardContent className="space-y-3 py-12 text-center">
              <p className="text-3xl">🏆</p>
              <p className="text-sm font-medium">No tournaments yet</p>
              <p className="text-xs text-muted-foreground">
                Create a tournament to track fixtures, standings, and champions.
              </p>
              <Button onClick={() => setShowNew(true)} variant="outline" className="mt-2">
                <Plus className="mr-2 size-4" />
                Create Tournament
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {tournaments.map((tournament) => (
              <TournamentCard key={tournament.id} tournament={tournament} />
            ))}
          </div>
        )}
      </div>

      <NewTournamentDialog open={showNew} onClose={() => setShowNew(false)} />
    </div>
  )
}

export const Route = createFileRoute("/trump/tournaments/")({
  component: TrumpTournamentIndexPage,
})

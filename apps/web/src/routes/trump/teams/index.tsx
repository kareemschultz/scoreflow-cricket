import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useLiveQuery } from "dexie-react-hooks"
import { Plus, Trash2, AlertCircle } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { nanoid } from "nanoid"
import { db } from "@/db/index"
import { computeTrumpTeamStats } from "@/lib/trump-stats"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@workspace/ui/components/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@workspace/ui/components/alert-dialog"

const PRESET_COLORS = [
  "#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#a855f7", "#06b6d4", "#ec4899", "#14b8a6",
]

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
}

const itemVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.2, ease: "easeOut" as const } },
}

function AddPlayerDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState("")
  const [color, setColor] = useState(PRESET_COLORS[0])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) { onClose(); setError(null); setName(""); setColor(PRESET_COLORS[0]) }
  }

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    try {
      await db.trumpPlayers.add({ id: nanoid(), name: name.trim(), colorHex: color, createdAt: new Date() })
      onClose()
      setName(""); setColor(PRESET_COLORS[0])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save player.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton>
        <DialogHeader><DialogTitle>Add Player</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pname">Name / Alias</Label>
            <Input id="pname" placeholder="e.g. King Pin" value={name} onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSave() }} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>Color</Label>
            <div className="flex gap-2 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className="size-8 rounded-full transition-transform"
                  style={{ backgroundColor: c, transform: color === c ? "scale(1.2)" : "scale(1)", outline: color === c ? `2px solid ${c}` : "none", outlineOffset: "2px" }} />
              ))}
            </div>
          </div>
          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2">
              <AlertCircle className="size-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!name.trim() || saving}>{saving ? "Saving..." : "Add Player"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AddTeamDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const players = useLiveQuery(() => db.trumpPlayers.orderBy("createdAt").toArray())
  const [name, setName] = useState("")
  const [color, setColor] = useState(PRESET_COLORS[0])
  const [player1Id, setPlayer1Id] = useState<string | null>(null)
  const [player2Id, setPlayer2Id] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) { onClose(); setError(null); setName(""); setPlayer1Id(null); setPlayer2Id(null) }
  }

  async function handleSave() {
    if (!name.trim() || !player1Id || !player2Id) return
    setSaving(true)
    setError(null)
    try {
      await db.trumpTeams.add({
        id: nanoid(), name: name.trim(), player1Id, player2Id, colorHex: color, createdAt: new Date(),
      })
      onClose()
      setName(""); setPlayer1Id(null); setPlayer2Id(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save team.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton>
        <DialogHeader><DialogTitle>Create Team</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Team Name</Label>
            <Input placeholder="e.g. Aces High" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Partner 1</Label>
              <Select value={player1Id} onValueChange={(v: string | null) => setPlayer1Id(v)}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {(players ?? []).filter((p) => p.id !== player2Id).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Partner 2</Label>
              <Select value={player2Id} onValueChange={(v: string | null) => setPlayer2Id(v)}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {(players ?? []).filter((p) => p.id !== player1Id).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Team Color</Label>
            <div className="flex gap-2 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className="size-8 rounded-full transition-transform"
                  style={{ backgroundColor: c, transform: color === c ? "scale(1.2)" : "scale(1)", outline: color === c ? `2px solid ${c}` : "none", outlineOffset: "2px" }} />
              ))}
            </div>
          </div>
          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2">
              <AlertCircle className="size-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!name.trim() || !player1Id || !player2Id || saving}>
            {saving ? "Saving..." : "Create Team"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TrumpTeamsPage() {
  const teams = useLiveQuery(() => db.trumpTeams.orderBy("createdAt").toArray())
  const matches = useLiveQuery(() => db.trumpMatches.toArray())
  const players = useLiveQuery(() => db.trumpPlayers.toArray())

  const [showAddPlayer, setShowAddPlayer] = useState(false)
  const [showAddTeam, setShowAddTeam] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const stats = teams && matches && players ? computeTrumpTeamStats(teams, matches, players) : []
  const statsMap = new Map(stats.map((s) => [s.teamId, s]))
  const playerMap = new Map((players ?? []).map((p) => [p.id, p]))

  async function handleDelete() {
    if (!deleteId) return
    await db.trumpTeams.delete(deleteId)
    setDeleteId(null)
  }

  return (
    <div className="min-h-full bg-background">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold">Teams & Players</h1>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowAddPlayer(true)} className="gap-1">
              <Plus className="size-3.5" />
              Player
            </Button>
            <Button size="sm" onClick={() => setShowAddTeam(true)} className="gap-1">
              <Plus className="size-3.5" />
              Team
            </Button>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Players list */}
        {players && players.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Players ({players.length})</h2>
            <div className="flex flex-wrap gap-2">
              {players.map((p) => (
                <div key={p.id} className="flex items-center gap-1.5 bg-muted/50 rounded-full px-3 py-1.5">
                  <div className="size-5 rounded-full shrink-0" style={{ backgroundColor: p.colorHex }} />
                  <span className="text-xs font-medium">{p.name}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Teams list */}
        {!teams ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />)}
          </div>
        ) : teams.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center space-y-3">
              <p className="text-3xl">{"\u2660"}</p>
              <p className="text-sm font-medium">No teams yet</p>
              <p className="text-xs text-muted-foreground">Add players first, then create partner teams</p>
              <div className="flex gap-2 justify-center">
                <Button onClick={() => setShowAddPlayer(true)} variant="outline" size="sm">Add Player</Button>
                <Button onClick={() => setShowAddTeam(true)} size="sm">Create Team</Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Teams ({teams.length})</h2>
            <motion.div className="space-y-2" initial="hidden" animate="visible" variants={containerVariants}>
              <AnimatePresence>
                {teams.map((team) => {
                  const s = statsMap.get(team.id)
                  const p1 = playerMap.get(team.player1Id)
                  const p2 = playerMap.get(team.player2Id)
                  const initials = team.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)

                  return (
                    <motion.div key={team.id} variants={itemVariants} layout exit={{ opacity: 0, x: -20 }} whileTap={{ scale: 0.99 }}>
                      <Card className="hover:bg-muted/40 transition-colors">
                        <CardContent className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="size-10 rounded-full flex items-center justify-center font-bold text-white text-sm shrink-0"
                              style={{ backgroundColor: team.colorHex }}>
                              {initials}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm">{team.name}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {p1?.name ?? "?"} & {p2?.name ?? "?"}
                              </p>
                              {s && s.matchesPlayed > 0 && (
                                <p className="text-[10px] text-muted-foreground">
                                  {s.matchesPlayed} played &middot; {s.matchesWon}W {s.matchesLost}L &middot; {s.winRate}% &middot; {s.allFours} All Fours
                                </p>
                              )}
                            </div>
                            <button
                              className="size-8 rounded-full hover:bg-destructive/10 flex items-center justify-center transition-colors"
                              onClick={() => setDeleteId(team.id)}
                            >
                              <Trash2 className="size-3.5 text-destructive" />
                            </button>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </motion.div>
          </section>
        )}
      </div>

      <AddPlayerDialog open={showAddPlayer} onClose={() => setShowAddPlayer(false)} />
      <AddTeamDialog open={showAddTeam} onClose={() => setShowAddTeam(false)} />

      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Team?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the team. Match history will remain.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-white hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export const Route = createFileRoute("/trump/teams/")({ 
  component: TrumpTeamsPage,
})

import { useState } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useLiveQuery } from "dexie-react-hooks"
import { Plus, Trash2, Pencil, ChevronRight } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { nanoid } from "nanoid"
import { db } from "@/db/index"
import { computeFifaPlayerStats } from "@/lib/fifa-stats"
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
  "#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#a855f7", "#f97316",
]

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
}

const itemVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.2, ease: "easeOut" as const } },
}

function AddEditPlayerDialog({
  open,
  onClose,
  editPlayer,
}: {
  open: boolean
  onClose: () => void
  editPlayer?: { id: string; name: string; colorHex: string } | null
}) {
  const [name, setName] = useState(editPlayer?.name ?? "")
  const [color, setColor] = useState(editPlayer?.colorHex ?? PRESET_COLORS[0])
  const [saving, setSaving] = useState(false)

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) onClose()
    else {
      setName(editPlayer?.name ?? "")
      setColor(editPlayer?.colorHex ?? PRESET_COLORS[0])
    }
  }

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    try {
      if (editPlayer) {
        await db.fifaPlayers.update(editPlayer.id, { name: name.trim(), colorHex: color })
      } else {
        await db.fifaPlayers.add({ id: nanoid(), name: name.trim(), colorHex: color, createdAt: new Date() })
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton>
        <DialogHeader>
          <DialogTitle>{editPlayer ? "Edit Player" : "Add Player"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pname">Name</Label>
            <Input
              id="pname"
              placeholder="Player name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSave() }}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label>Avatar Color</Label>
            <div className="flex gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="size-8 rounded-full transition-transform focus:outline-none"
                  style={{
                    backgroundColor: c,
                    transform: color === c ? "scale(1.2)" : "scale(1)",
                    outline: color === c ? `2px solid ${c}` : "none",
                    outlineOffset: "2px",
                  }}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <div
              className="size-10 rounded-full flex items-center justify-center font-bold text-white text-sm"
              style={{ backgroundColor: color }}
            >
              {name ? name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) : "?"}
            </div>
            <span className="text-sm font-medium">{name || "Preview"}</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} type="button">Cancel</Button>
          <Button onClick={handleSave} disabled={!name.trim() || saving}>
            {saving ? "Saving…" : editPlayer ? "Save Changes" : "Add Player"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function FifaPlayersPage() {
  const navigate = useNavigate()
  const players = useLiveQuery(() => db.fifaPlayers.orderBy("createdAt").toArray())
  const matches = useLiveQuery(() => db.fifaMatches.toArray())

  const [showAdd, setShowAdd] = useState(false)
  const [editPlayer, setEditPlayer] = useState<{ id: string; name: string; colorHex: string } | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const stats = players && matches ? computeFifaPlayerStats(players, matches) : []
  const statsMap = new Map(stats.map((s) => [s.playerId, s]))

  async function handleDelete() {
    if (!deleteId) return
    await db.fifaPlayers.delete(deleteId)
    setDeleteId(null)
  }

  return (
    <div className="min-h-full bg-background relative overflow-hidden">
      {/* Animated background — player jerseys / squad */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <motion.div
          className="absolute -top-16 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full bg-blue-500/5"
          animate={{ scale: [1, 1.1, 1], y: [0, 12, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute top-1/3 -right-12 w-44 h-44 rounded-full bg-emerald-500/5"
          animate={{ scale: [1, 1.08, 1], x: [0, -8, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        />
        <motion.div
          className="absolute bottom-24 -left-10 w-36 h-36 rounded-full bg-violet-500/5"
          animate={{ scale: [1, 1.15, 1], y: [0, -8, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        />
        {/* Jersey number floats */}
        {["7", "10", "9", "1"].map((num, i) => (
          <motion.div
            key={num}
            className="absolute text-4xl font-black text-foreground/[0.03] select-none"
            style={{ top: `${15 + i * 22}%`, left: `${10 + i * 22}%` }}
            animate={{ y: [0, -8, 0], rotate: [-5, 5, -5] }}
            transition={{ duration: 7 + i, repeat: Infinity, ease: "easeInOut", delay: i * 1.2 }}
          >
            {num}
          </motion.div>
        ))}
      </div>
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold">FIFA Players</h1>
          <Button size="sm" onClick={() => setShowAdd(true)} className="gap-1">
            <Plus className="size-4" />
            Add Player
          </Button>
        </div>
      </div>

      <div className="px-4 py-4">
        {!players ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : players.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center space-y-3">
              <p className="text-3xl">👤</p>
              <p className="text-sm font-medium">No players yet</p>
              <p className="text-xs text-muted-foreground">Add your FIFA players to get started</p>
              <Button onClick={() => setShowAdd(true)} variant="outline" className="mt-2">
                <Plus className="size-4 mr-2" />
                Add First Player
              </Button>
            </CardContent>
          </Card>
        ) : (
          <motion.div className="space-y-2" initial="hidden" animate="visible" variants={containerVariants}>
            <AnimatePresence>
              {players.map((player) => {
                const s = statsMap.get(player.id)
                const initials = player.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)
                return (
                  <motion.div
                    key={player.id}
                    variants={itemVariants}
                    layout
                    exit={{ opacity: 0, x: -20 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    <Card className="hover:bg-muted/40 transition-colors cursor-pointer">
                      <CardContent className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="size-10 rounded-full flex items-center justify-center font-bold text-white text-sm shrink-0"
                            style={{ backgroundColor: player.colorHex }}
                          >
                            {initials}
                          </motion.div>

                          <div
                            className="flex-1 min-w-0"
                            onClick={() => navigate({ to: "/fifa/players/$playerId", params: { playerId: player.id } })}
                          >
                            <p className="font-semibold text-sm">{player.name}</p>
                            {s && s.played > 0 ? (
                              <p className="text-[11px] text-muted-foreground">
                                {s.played} played · {s.won}W {s.drawn}D {s.lost}L · {s.winRate}% win rate
                              </p>
                            ) : (
                              <p className="text-[11px] text-muted-foreground">No matches yet</p>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              className="size-8 rounded-full hover:bg-muted flex items-center justify-center transition-colors"
                              onClick={(e) => { e.stopPropagation(); setEditPlayer(player) }}
                            >
                              <Pencil className="size-3.5 text-muted-foreground" />
                            </button>
                            <button
                              className="size-8 rounded-full hover:bg-destructive/10 flex items-center justify-center transition-colors"
                              onClick={(e) => { e.stopPropagation(); setDeleteId(player.id) }}
                            >
                              <Trash2 className="size-3.5 text-destructive" />
                            </button>
                            <button
                              className="size-8 rounded-full hover:bg-muted flex items-center justify-center transition-colors"
                              onClick={() => navigate({ to: "/fifa/players/$playerId", params: { playerId: player.id } })}
                            >
                              <ChevronRight className="size-4 text-muted-foreground" />
                            </button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      <AddEditPlayerDialog
        open={showAdd || !!editPlayer}
        onClose={() => { setShowAdd(false); setEditPlayer(null) }}
        editPlayer={editPlayer}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Player?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the player. Their match history will remain.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-white hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export const Route = createFileRoute("/fifa/players/")({
  component: FifaPlayersPage,
})

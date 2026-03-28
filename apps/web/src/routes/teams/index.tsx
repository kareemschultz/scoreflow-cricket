import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useLiveQuery } from "dexie-react-hooks"
import { useState, useRef, useEffect } from "react"
import { motion } from "framer-motion"
import { Users, Plus, MoreVertical, Pencil, Trash2, AlertCircle } from "lucide-react"

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: "easeOut" as const } },
}
import { nanoid } from "nanoid"
import { db } from "@/db/index"
import type { Team } from "@/types/cricket"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Badge } from "@workspace/ui/components/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@workspace/ui/components/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"

// ─── Team color palette ───────────────────────────────────────────────────────

const TEAM_COLORS = [
  "#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#a855f7",
  "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16",
  "#0ea5e9", "#e11d48", "#16a34a", "#d97706", "#7c3aed",
]

// ─── New Team Dialog ──────────────────────────────────────────────────────────

interface NewTeamDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function NewTeamDialog({ open, onOpenChange }: NewTeamDialogProps) {
  const [name, setName] = useState("")
  const [shortName, setShortName] = useState("")
  const [colorHex, setColorHex] = useState(TEAM_COLORS[0])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setName("")
      setShortName("")
      setColorHex(TEAM_COLORS[0])
      setError(null)
    }
  }, [open])

  async function handleCreate() {
    const trimmed = name.trim()
    if (!trimmed) return
    setSaving(true)
    setError(null)
    try {
      const team: Team = {
        id: nanoid(),
        name: trimmed,
        shortName: shortName.trim() || undefined,
        colorHex,
        createdAt: new Date(),
      }
      await db.teams.add(team)
      onOpenChange(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create team. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm mx-4 top-16 translate-y-0 max-h-[80dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Team</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="team-name">Team Name</Label>
            <Input
              id="team-name"
              placeholder="e.g. Mumbai Indians"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="short-name">
              Short Name{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="short-name"
              placeholder="e.g. MI"
              maxLength={5}
              value={shortName}
              onChange={(e) => setShortName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Team Colour</Label>
            <div className="flex flex-wrap gap-2 pt-0.5">
              {TEAM_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="size-7 rounded-full transition-transform active:scale-90"
                  style={{
                    backgroundColor: c,
                    outline: colorHex === c ? `3px solid ${c}` : "none",
                    outlineOffset: "2px",
                  }}
                  onClick={() => setColorHex(c)}
                />
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
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!name.trim() || saving}>
            {saving ? "Creating…" : "Create Team"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Edit Team Dialog ─────────────────────────────────────────────────────────

interface EditTeamDialogProps {
  team: Team | null
  onClose: () => void
}

function EditTeamDialog({ team, onClose }: EditTeamDialogProps) {
  const [name, setName] = useState(team?.name ?? "")
  const [shortName, setShortName] = useState(team?.shortName ?? "")
  const [colorHex, setColorHex] = useState(team?.colorHex ?? TEAM_COLORS[0])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setName(team?.name ?? "")
    setShortName(team?.shortName ?? "")
    setColorHex(team?.colorHex ?? TEAM_COLORS[0])
    setError(null)
  }, [team?.id])

  async function handleSave() {
    if (!team || !name.trim()) return
    setSaving(true)
    setError(null)
    try {
      await db.teams.update(team.id, {
        name: name.trim(),
        shortName: shortName.trim() || undefined,
        colorHex,
      })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={!!team} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-sm mx-4 top-16 translate-y-0 max-h-[80dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Team</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="edit-team-name">Team Name</Label>
            <Input
              id="edit-team-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-short-name">
              Short Name{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="edit-short-name"
              placeholder="e.g. MI"
              maxLength={5}
              value={shortName}
              onChange={(e) => setShortName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Team Colour</Label>
            <div className="flex flex-wrap gap-2 pt-0.5">
              {TEAM_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="size-7 rounded-full transition-transform active:scale-90"
                  style={{
                    backgroundColor: c,
                    outline: colorHex === c ? `3px solid ${c}` : "none",
                    outlineOffset: "2px",
                  }}
                  onClick={() => setColorHex(c)}
                />
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
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Delete Confirm ───────────────────────────────────────────────────────────

interface DeleteTeamDialogProps {
  team: Team | null
  hasMatches: boolean
  onClose: () => void
}

function DeleteTeamDialog({ team, hasMatches, onClose }: DeleteTeamDialogProps) {
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!team) return
    setDeleting(true)
    try {
      await db.players.where("teamId").equals(team.id).delete()
      await db.teams.delete(team.id)
      onClose()
    } catch {
      // Non-critical — log silently; team list updates reactively so user will see it worked or not
    } finally {
      setDeleting(false)
    }
  }

  return (
    <AlertDialog open={!!team} onOpenChange={(o) => { if (!o) onClose() }}>
      <AlertDialogContent className="max-w-sm mx-4">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {team?.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            {hasMatches
              ? "This team has match history. Deleting will remove the team and all its players, but match records will be kept."
              : "This will permanently delete the team and all its players."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleting ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// ─── Team Card ────────────────────────────────────────────────────────────────

interface TeamCardProps {
  team: Team
  playerCount: number
  onEdit: (team: Team) => void
  onDelete: (team: Team) => void
}

function TeamCard({ team, playerCount, onEdit, onDelete }: TeamCardProps) {
  const navigate = useNavigate()
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const didLongPress = useRef(false)

  function handlePointerDown() {
    didLongPress.current = false
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true
      onEdit(team)
    }, 600)
  }

  function handlePointerUp() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  function handleClick() {
    if (didLongPress.current) return
    navigate({ to: "/teams/$teamId", params: { teamId: team.id } })
  }

  return (
    <motion.div whileTap={{ scale: 0.98 }}>
    <Card
      className="active:bg-muted/50 transition-colors cursor-pointer"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClick={handleClick}
    >
      <CardContent className="py-3 px-4">
        <div className="flex items-center gap-3">
          {/* Color swatch */}
          {team.colorHex ? (
            <div
              className="size-9 rounded-full shrink-0 ring-1 ring-border"
              style={{ backgroundColor: team.colorHex }}
            />
          ) : (
            <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Users className="size-4 text-primary" />
            </div>
          )}

          {/* Name + count */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm truncate">{team.name}</span>
              {team.shortName && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                  {team.shortName}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {playerCount === 0
                ? "No players"
                : `${playerCount} player${playerCount !== 1 ? "s" : ""}`}
            </p>
          </div>

          {/* Kebab menu */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                />
              }
            >
              <MoreVertical className="size-4" />
              <span className="sr-only">Team actions</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  onEdit(team)
                }}
              >
                <Pencil className="size-4 mr-2" />
                Edit name
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(team)
                }}
              >
                <Trash2 className="size-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
    </motion.div>
  )
}

// ─── Teams Page ───────────────────────────────────────────────────────────────

function TeamsPage() {
  const [newTeamOpen, setNewTeamOpen] = useState(false)
  const [editTeam, setEditTeam] = useState<Team | null>(null)
  const [deleteTeam, setDeleteTeam] = useState<Team | null>(null)
  const [deleteHasMatches, setDeleteHasMatches] = useState(false)

  const teams = useLiveQuery(async () => {
    const all = await db.teams.orderBy("name").toArray()
    return all
  })

  const playerCounts = useLiveQuery(async () => {
    const allPlayers = await db.players.toArray()
    const counts: Record<string, number> = {}
    for (const p of allPlayers) {
      counts[p.teamId] = (counts[p.teamId] ?? 0) + 1
    }
    return counts
  }, [], {} as Record<string, number>)

  async function handleDeleteClick(team: Team) {
    const matchCount = await db.matches
      .where("team1Id")
      .equals(team.id)
      .or("team2Id")
      .equals(team.id)
      .count()
    setDeleteHasMatches(matchCount > 0)
    setDeleteTeam(team)
  }

  return (
    <div className="min-h-full bg-background relative overflow-hidden">
      {/* Animated background — multiple team colors */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <motion.div
          className="absolute -top-16 -left-16 w-56 h-56 rounded-full bg-blue-500/6"
          animate={{ scale: [1, 1.12, 1], x: [0, 10, 0], y: [0, 8, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute top-1/4 -right-12 w-44 h-44 rounded-full bg-emerald-500/5"
          animate={{ scale: [1, 1.1, 1], x: [0, -8, 0] }}
          transition={{ duration: 13, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        />
        <motion.div
          className="absolute top-2/3 left-8 w-32 h-32 rounded-full bg-orange-500/5"
          animate={{ scale: [1, 1.15, 1], y: [0, -10, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        />
        <motion.div
          className="absolute bottom-12 -right-8 w-40 h-40 rounded-full bg-violet-500/5"
          animate={{ scale: [1, 1.08, 1], x: [0, -6, 0], y: [0, -6, 0] }}
          transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: 3.5 }}
        />
      </div>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="size-5 text-primary" />
            <h1 className="text-lg font-bold tracking-tight">Teams</h1>
          </div>
          <Button
            size="sm"
            className="h-9 gap-1.5"
            onClick={() => setNewTeamOpen(true)}
          >
            <Plus className="size-4" />
            New Team
          </Button>
        </div>
      </div>

      <div className="px-4 py-4">
        {teams === undefined ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-full bg-muted animate-pulse shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted rounded animate-pulse w-1/2" />
                      <div className="h-3 bg-muted rounded animate-pulse w-1/4" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : teams.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="size-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Users className="size-8 text-muted-foreground/50" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">No teams yet.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Create your first team to start scoring.
            </p>
            <Button
              className="mt-6 gap-2"
              onClick={() => setNewTeamOpen(true)}
            >
              <Plus className="size-4" />
              Create First Team
            </Button>
          </div>
        ) : (
          <motion.div
            className="space-y-2"
            initial="hidden"
            animate="visible"
            variants={containerVariants}
          >
            <p className="text-xs text-muted-foreground mb-3">
              {teams.length} team{teams.length !== 1 ? "s" : ""}
            </p>
            {teams.map((team) => (
              <motion.div key={team.id} variants={itemVariants}>
                <TeamCard
                  team={team}
                  playerCount={playerCounts?.[team.id] ?? 0}
                  onEdit={setEditTeam}
                  onDelete={handleDeleteClick}
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      <NewTeamDialog open={newTeamOpen} onOpenChange={setNewTeamOpen} />

      <EditTeamDialog
        team={editTeam}
        onClose={() => setEditTeam(null)}
      />

      <DeleteTeamDialog
        team={deleteTeam}
        hasMatches={deleteHasMatches}
        onClose={() => setDeleteTeam(null)}
      />
    </div>
  )
}

export const Route = createFileRoute("/teams/")({
  component: TeamsPage,
})

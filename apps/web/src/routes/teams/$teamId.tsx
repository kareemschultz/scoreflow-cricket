import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useLiveQuery } from "dexie-react-hooks"
import { useState, useRef, useEffect } from "react"
import {
  ArrowLeft,
  Plus,
  Trash2,
  Check,
  X,
  Users,
  ClipboardList,
} from "lucide-react"
import { nanoid } from "nanoid"
import { db } from "@/db/index"
import type { Player } from "@/types/cricket"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Separator } from "@workspace/ui/components/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@workspace/ui/components/dialog"

// ─── Types ────────────────────────────────────────────────────────────────────

type PlayerRole = Player["role"]
type BattingStyle = Player["battingStyle"]

const ROLE_LABELS: Record<NonNullable<PlayerRole>, string> = {
  batsman: "Batsman",
  bowler: "Bowler",
  allrounder: "All-rounder",
  wicketkeeper: "Wicketkeeper",
}

const ROLE_COLORS: Record<NonNullable<PlayerRole>, string> = {
  batsman: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  bowler: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  allrounder: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  wicketkeeper: "bg-purple-500/20 text-purple-400 border-purple-500/30",
}

// ─── Inline name editor ───────────────────────────────────────────────────────

interface InlineEditProps {
  value: string
  onSave: (value: string) => void
  className?: string
  inputClassName?: string
}

function InlineEdit({ value, onSave, className = "", inputClassName = "" }: InlineEditProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) {
      setDraft(value)
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing, value])

  function commit() {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== value) onSave(trimmed)
    setEditing(false)
  }

  function cancel() {
    setDraft(value)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        <Input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit()
            if (e.key === "Escape") cancel()
          }}
          onBlur={commit}
          className={`h-7 text-sm py-0 ${inputClassName}`}
        />
        <Button
          size="icon"
          variant="ghost"
          className="size-7 shrink-0"
          onMouseDown={(e) => { e.preventDefault(); commit() }}
        >
          <Check className="size-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="size-7 shrink-0"
          onMouseDown={(e) => { e.preventDefault(); cancel() }}
        >
          <X className="size-3.5" />
        </Button>
      </div>
    )
  }

  return (
    <button
      className={`text-left hover:underline underline-offset-2 decoration-dashed decoration-muted-foreground/50 ${className}`}
      onClick={() => setEditing(true)}
    >
      {value}
    </button>
  )
}

// ─── Player Row ───────────────────────────────────────────────────────────────

interface PlayerRowProps {
  player: Player
  onDelete: (playerId: string) => void
}

function PlayerRow({ player, onDelete }: PlayerRowProps) {
  async function handleNameSave(name: string) {
    await db.players.update(player.id, { name })
  }

  async function handleRoleChange(value: string | null) {
    const role = !value || value === "none" ? undefined : (value as PlayerRole)
    await db.players.update(player.id, { role })
  }

  async function handleBattingStyleChange(value: string | null) {
    const style = !value || value === "none" ? undefined : (value as BattingStyle)
    await db.players.update(player.id, { battingStyle: style })
  }

  return (
    <div className="flex items-center gap-2 py-2.5 border-b border-border last:border-0">
      {/* Name */}
      <div className="flex-1 min-w-0">
        <InlineEdit
          value={player.name}
          onSave={handleNameSave}
          className="text-sm font-medium"
        />
        {player.role && (
          <div className="mt-1">
            <Badge
              variant="outline"
              className={`text-[10px] px-1.5 py-0 ${ROLE_COLORS[player.role]}`}
            >
              {ROLE_LABELS[player.role]}
            </Badge>
          </div>
        )}
      </div>

      {/* Role selector */}
      <Select
        value={player.role ?? "none"}
        onValueChange={handleRoleChange}
      >
        <SelectTrigger className="h-8 w-[110px] text-xs shrink-0">
          <SelectValue placeholder="Role" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">No role</SelectItem>
          <SelectItem value="batsman">Batsman</SelectItem>
          <SelectItem value="bowler">Bowler</SelectItem>
          <SelectItem value="allrounder">All-rounder</SelectItem>
          <SelectItem value="wicketkeeper">Wicketkeeper</SelectItem>
        </SelectContent>
      </Select>

      {/* Batting style */}
      <Select
        value={player.battingStyle ?? "none"}
        onValueChange={handleBattingStyleChange}
      >
        <SelectTrigger className="h-8 w-[80px] text-xs shrink-0">
          <SelectValue placeholder="Hand" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">—</SelectItem>
          <SelectItem value="right">RHB</SelectItem>
          <SelectItem value="left">LHB</SelectItem>
        </SelectContent>
      </Select>

      {/* Delete */}
      <Button
        variant="ghost"
        size="icon"
        className="size-8 text-muted-foreground hover:text-destructive shrink-0"
        onClick={() => onDelete(player.id)}
      >
        <Trash2 className="size-4" />
        <span className="sr-only">Delete player</span>
      </Button>
    </div>
  )
}

// ─── Bulk Import Dialog ───────────────────────────────────────────────────────

interface BulkImportDialogProps {
  teamId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

function BulkImportDialog({ teamId, open, onOpenChange }: BulkImportDialogProps) {
  const [text, setText] = useState("")
  const [saving, setSaving] = useState(false)

  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)

  async function handleImport() {
    if (!lines.length) return
    setSaving(true)
    try {
      const players: Player[] = lines.map((name, i) => ({
        id: nanoid(),
        name,
        teamId,
        createdAt: new Date(Date.now() + i),
      }))
      await db.players.bulkAdd(players)
      setText("")
      onOpenChange(false)
    } catch {
      // bulkAdd partial failures are rare; live query will reflect actual state
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm mx-4">
        <DialogHeader>
          <DialogTitle>Bulk Import Players</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-xs text-muted-foreground">
            Add multiple players at once — one name per line.
          </p>
          <textarea
            className="w-full min-h-[160px] rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            placeholder={"Virat Kohli\nRohit Sharma\nJasprit Bumrah"}
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoFocus
          />
          {lines.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {lines.length} player{lines.length !== 1 ? "s" : ""} will be added
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={lines.length === 0 || saving}>
            {saving ? "Importing…" : `Import ${lines.length > 0 ? lines.length : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Team Roster Page ─────────────────────────────────────────────────────────

function TeamRosterPage() {
  const { teamId } = Route.useParams()
  const navigate = useNavigate()
  const [quickAddName, setQuickAddName] = useState("")
  const [bulkOpen, setBulkOpen] = useState(false)
  const [adding, setAdding] = useState(false)

  const team = useLiveQuery(() => db.teams.get(teamId), [teamId])
  const players = useLiveQuery(
    () => db.players.where("teamId").equals(teamId).sortBy("createdAt"),
    [teamId]
  )

  async function handleTeamNameSave(name: string) {
    await db.teams.update(teamId, { name })
  }

  async function handleQuickAdd() {
    const trimmed = quickAddName.trim()
    if (!trimmed) return
    setAdding(true)
    try {
      const player: Player = {
        id: nanoid(),
        name: trimmed,
        teamId,
        createdAt: new Date(),
      }
      await db.players.add(player)
      setQuickAddName("")
    } catch {
      // IndexedDB errors are rare; the player list updates reactively
    } finally {
      setAdding(false)
    }
  }

  async function handleDeletePlayer(playerId: string) {
    await db.players.delete(playerId)
  }

  if (team === undefined) {
    return (
      <div className="min-h-full bg-background">
        <div className="px-4 py-4 space-y-3">
          <div className="h-6 bg-muted rounded animate-pulse w-1/3" />
          <div className="h-4 bg-muted rounded animate-pulse w-1/4" />
        </div>
      </div>
    )
  }

  if (team === null) {
    return (
      <div className="min-h-full bg-background flex items-center justify-center py-20 text-center px-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Team not found</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => navigate({ to: "/teams" })}
          >
            Back to Teams
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="size-9 shrink-0 -ml-1"
            onClick={() => navigate({ to: "/teams" })}
          >
            <ArrowLeft className="size-5" />
            <span className="sr-only">Back to teams</span>
          </Button>

          <div className="flex-1 min-w-0">
            <InlineEdit
              value={team.name}
              onSave={handleTeamNameSave}
              className="text-lg font-bold tracking-tight"
              inputClassName="text-lg font-bold h-8"
            />
            {team.shortName && (
              <p className="text-xs text-muted-foreground">{team.shortName}</p>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 shrink-0"
            onClick={() => setBulkOpen(true)}
          >
            <ClipboardList className="size-4" />
            Bulk Add
          </Button>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Quick add */}
        <Card>
          <CardContent className="py-3 px-4">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide mb-2 block">
              Add Player
            </Label>
            <div className="flex gap-2">
              <Input
                placeholder="Player name"
                value={quickAddName}
                onChange={(e) => setQuickAddName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleQuickAdd()}
                className="h-10"
              />
              <Button
                className="h-10 px-4 gap-1.5 shrink-0"
                onClick={handleQuickAdd}
                disabled={!quickAddName.trim() || adding}
              >
                <Plus className="size-4" />
                Add
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Player list */}
        <Card>
          <CardHeader className="pb-2 pt-3 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">
                Roster
              </CardTitle>
              <span className="text-xs text-muted-foreground">
                {players === undefined
                  ? "…"
                  : `${players.length} player${players.length !== 1 ? "s" : ""}`}
              </span>
            </div>
          </CardHeader>

          <Separator />

          <CardContent className="px-4 pb-2 pt-0">
            {players === undefined ? (
              <div className="py-4 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3 py-1">
                    <div className="h-4 bg-muted rounded animate-pulse flex-1" />
                    <div className="h-8 bg-muted rounded animate-pulse w-[110px]" />
                    <div className="h-8 bg-muted rounded animate-pulse w-[80px]" />
                    <div className="size-8 bg-muted rounded animate-pulse" />
                  </div>
                ))}
              </div>
            ) : players.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Users className="size-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">No players yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Use the quick-add above or bulk import
                </p>
              </div>
            ) : (
              <div>
                {players.map((player) => (
                  <PlayerRow
                    key={player.id}
                    player={player}
                    onDelete={handleDeletePlayer}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <BulkImportDialog
        teamId={teamId}
        open={bulkOpen}
        onOpenChange={setBulkOpen}
      />
    </div>
  )
}

export const Route = createFileRoute("/teams/$teamId")({
  component: TeamRosterPage,
})

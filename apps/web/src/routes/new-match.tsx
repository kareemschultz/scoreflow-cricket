import { motion } from "framer-motion"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useLiveQuery } from "dexie-react-hooks"
import { useState, useCallback, useEffect } from "react"
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Plus,
  Users,
  Trophy,
} from "lucide-react"
import { nanoid } from "nanoid"
import { db } from "@/db/index"
import type {
  CricketFormat,
  MatchRules,
  Match,
  Team,
  Player,
  Innings,
} from "@/types/cricket"
import { DEFAULT_RULES } from "@/types/cricket"
import { useScoringStore } from "@/stores/scoring"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Badge } from "@workspace/ui/components/badge"
import { Switch } from "@workspace/ui/components/switch"
import { Separator } from "@workspace/ui/components/separator"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"

// ─── Constants ────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 5

const FORMAT_OPTIONS: { value: CricketFormat; label: string; sub: string }[] = [
  { value: "T20", label: "T20", sub: "20 overs" },
  { value: "ODI", label: "ODI", sub: "50 overs" },
  { value: "TEST", label: "Test", sub: "Unlimited" },
  { value: "CUSTOM", label: "Custom", sub: "Configure" },
]

// ─── Step Indicator ───────────────────────────────────────────────────────────

interface StepIndicatorProps {
  current: number
  total: number
}

function StepIndicator({ current, total }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-0 px-6 py-4">
      {Array.from({ length: total }, (_, i) => {
        const step = i + 1
        const done = step < current
        const active = step === current
        return (
          <div key={step} className="flex items-center">
            <div
              className={[
                "size-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors",
                done
                  ? "bg-primary text-primary-foreground"
                  : active
                  ? "bg-primary/20 text-primary ring-2 ring-primary"
                  : "bg-muted text-muted-foreground",
              ].join(" ")}
            >
              {done ? <Check className="size-3.5" /> : step}
            </div>
            {step < total && (
              <div
                className={[
                  "h-0.5 w-8 mx-0.5 transition-colors",
                  done ? "bg-primary" : "bg-muted",
                ].join(" ")}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Step Header ─────────────────────────────────────────────────────────────

interface StepHeaderProps {
  title: string
  subtitle?: string
}

function StepHeader({ title, subtitle }: StepHeaderProps) {
  return (
    <div className="px-4 pb-4">
      <h2 className="text-xl font-bold">{title}</h2>
      {subtitle && (
        <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
      )}
    </div>
  )
}

// ─── Quick Create Team Sheet ──────────────────────────────────────────────────

interface QuickCreateTeamSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (team: Team) => void
}

function QuickCreateTeamSheet({ open, onOpenChange, onCreated }: QuickCreateTeamSheetProps) {
  const [name, setName] = useState("")
  const [saving, setSaving] = useState(false)

  async function handleCreate() {
    const trimmed = name.trim()
    if (!trimmed) return
    setSaving(true)
    try {
      const team: Team = {
        id: nanoid(),
        name: trimmed,
        createdAt: new Date(),
      }
      await db.teams.add(team)
      setName("")
      onCreated(team)
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="top" className="rounded-b-2xl pt-safe pb-6">
        <SheetHeader className="pb-4">
          <SheetTitle>New Team</SheetTitle>
        </SheetHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="quick-team-name">Team Name</Label>
            <Input
              id="quick-team-name"
              placeholder="e.g. Mumbai Indians"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              autoFocus
            />
          </div>
          <Button
            className="w-full h-12"
            onClick={handleCreate}
            disabled={!name.trim() || saving}
          >
            {saving ? "Creating…" : "Create Team"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ─── Step 1: Team Selection ───────────────────────────────────────────────────

interface Step1Props {
  team1Id: string | null
  team2Id: string | null
  onSelectTeam1: (id: string) => void
  onSelectTeam2: (id: string) => void
}

function Step1Teams({ team1Id, team2Id, onSelectTeam1, onSelectTeam2 }: Step1Props) {
  const [quickCreateOpen, setQuickCreateOpen] = useState(false)
  const [createFor, setCreateFor] = useState<1 | 2>(1)

  const teams = useLiveQuery(() => db.teams.orderBy("name").toArray())

  function openQuickCreate(slot: 1 | 2) {
    setCreateFor(slot)
    setQuickCreateOpen(true)
  }

  function handleTeamCreated(team: Team) {
    if (createFor === 1) onSelectTeam1(team.id)
    else onSelectTeam2(team.id)
  }

  const selectedTeam1 = teams?.find((t) => t.id === team1Id)
  const selectedTeam2 = teams?.find((t) => t.id === team2Id)

  return (
    <div className="px-4 space-y-4">
      <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-start">
        {/* Team A */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">
            Team A
          </Label>
          <TeamPicker
            selected={team1Id}
            disabledId={team2Id}
            teams={teams ?? []}
            onSelect={onSelectTeam1}
            onQuickCreate={() => openQuickCreate(1)}
          />
          {selectedTeam1 && (
            <div className="text-center">
              <p className="text-sm font-semibold truncate">{selectedTeam1.name}</p>
              {selectedTeam1.shortName && (
                <p className="text-xs text-muted-foreground">{selectedTeam1.shortName}</p>
              )}
            </div>
          )}
        </div>

        {/* VS divider */}
        <div className="pt-6 flex items-center justify-center">
          <span className="text-xs font-bold text-muted-foreground bg-muted rounded-full size-8 flex items-center justify-center">
            vs
          </span>
        </div>

        {/* Team B */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">
            Team B
          </Label>
          <TeamPicker
            selected={team2Id}
            disabledId={team1Id}
            teams={teams ?? []}
            onSelect={onSelectTeam2}
            onQuickCreate={() => openQuickCreate(2)}
          />
          {selectedTeam2 && (
            <div className="text-center">
              <p className="text-sm font-semibold truncate">{selectedTeam2.name}</p>
              {selectedTeam2.shortName && (
                <p className="text-xs text-muted-foreground">{selectedTeam2.shortName}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {teams !== undefined && teams.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-6 text-center">
            <Users className="size-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No teams yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Create teams using the button below
            </p>
          </CardContent>
        </Card>
      )}

      <QuickCreateTeamSheet
        open={quickCreateOpen}
        onOpenChange={setQuickCreateOpen}
        onCreated={handleTeamCreated}
      />
    </div>
  )
}

interface TeamPickerProps {
  selected: string | null
  disabledId: string | null
  teams: Team[]
  onSelect: (id: string) => void
  onQuickCreate: () => void
}

function TeamPicker({ selected, disabledId, teams, onSelect, onQuickCreate }: TeamPickerProps) {
  return (
    <div className="space-y-1.5">
      {teams.map((t) => {
        const isSelected = t.id === selected
        const isDisabled = t.id === disabledId
        return (
          <button
            key={t.id}
            disabled={isDisabled}
            onClick={() => onSelect(t.id)}
            className={[
              "w-full rounded-lg border px-3 py-2.5 text-sm font-medium text-left transition-colors",
              isSelected
                ? "border-primary bg-primary/10 text-primary"
                : isDisabled
                ? "border-border bg-muted/30 text-muted-foreground opacity-50 cursor-not-allowed"
                : "border-border bg-card hover:bg-muted/50",
            ].join(" ")}
          >
            <span className="block truncate">{t.name}</span>
          </button>
        )
      })}
      <button
        onClick={onQuickCreate}
        className="w-full rounded-lg border border-dashed border-border px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors flex items-center gap-1.5"
      >
        <Plus className="size-3.5" />
        New team
      </button>
    </div>
  )
}

// ─── Step 2: Format & Rules ───────────────────────────────────────────────────

interface Step2Props {
  format: CricketFormat
  rules: MatchRules
  onFormatChange: (format: CricketFormat) => void
  onRulesChange: (rules: MatchRules) => void
}

function Step2Format({ format, rules, onFormatChange, onRulesChange }: Step2Props) {
  const [advancedOpen, setAdvancedOpen] = useState(false)

  function handleFormatSelect(f: CricketFormat) {
    onFormatChange(f)
    onRulesChange({ ...DEFAULT_RULES[f] })
  }

  function patch(partial: Partial<MatchRules>) {
    onRulesChange({ ...rules, ...partial })
  }

  return (
    <div className="px-4 space-y-5">
      {/* Format grid */}
      <div className="grid grid-cols-2 gap-3">
        {FORMAT_OPTIONS.map((opt) => {
          const active = format === opt.value
          return (
            <button
              key={opt.value}
              onClick={() => handleFormatSelect(opt.value)}
              className={[
                "rounded-xl border-2 px-4 py-5 text-left transition-colors",
                active
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card hover:bg-muted/50",
              ].join(" ")}
            >
              <p className={`text-base font-bold ${active ? "text-primary" : ""}`}>
                {opt.label}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{opt.sub}</p>
            </button>
          )
        })}
      </div>

      {/* Players per side — visible for all formats */}
      <Card>
        <CardContent className="py-4 px-4">
          <NumberRule
            label="Players per side"
            sub={`${rules.maxWickets} wickets · up to ${rules.maxWickets + 1} batters per team`}
            value={rules.maxWickets + 1}
            min={2}
            max={15}
            onChange={(v) => patch({ maxWickets: v - 1 })}
          />
        </CardContent>
      </Card>

      {/* Custom rules */}
      {format === "CUSTOM" && (
        <Card>
          <CardContent className="py-4 px-4 space-y-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Custom Rules
            </p>
            <NumberRule
              label="Overs per innings"
              sub="0 = unlimited"
              value={rules.oversPerInnings ?? 0}
              min={0}
              max={999}
              onChange={(v) => {
                const overs = v === 0 ? null : v
                // Auto-clamp maxOversPerBowler if it now exceeds total overs
                const maxPerBowler = rules.maxOversPerBowler
                if (overs !== null && maxPerBowler !== null && maxPerBowler > overs) {
                  patch({ oversPerInnings: overs, maxOversPerBowler: overs })
                } else {
                  patch({ oversPerInnings: overs })
                }
              }}
            />
            <NumberRule
              label="Max overs per bowler"
              sub={
                rules.oversPerInnings !== null
                  ? `0 = no limit · max ${rules.oversPerInnings} (innings overs)`
                  : "0 = no limit"
              }
              value={rules.maxOversPerBowler ?? 0}
              min={0}
              max={rules.oversPerInnings ?? 999}
              onChange={(v) => patch({ maxOversPerBowler: v === 0 ? null : v })}
            />
            <NumberRule
              label="Balls per over"
              value={rules.ballsPerOver}
              min={1}
              max={10}
              onChange={(v) => patch({ ballsPerOver: v })}
            />
          </CardContent>
        </Card>
      )}

      {/* Advanced accordion */}
      <div className="border border-border rounded-xl overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium"
          onClick={() => setAdvancedOpen((v) => !v)}
        >
          Advanced Rules
          <span className="text-muted-foreground text-xs">
            {advancedOpen ? "Hide" : "Show"}
          </span>
        </button>

        {advancedOpen && (
          <div className="border-t border-border px-4 py-3 space-y-4">
            <SwitchRule
              label="Wide re-ball"
              description="Wide counts as extra delivery"
              checked={rules.wideReball}
              onChange={(v) => patch({ wideReball: v })}
            />
            <SwitchRule
              label="No-ball re-ball"
              description="No-ball counts as extra delivery"
              checked={rules.noBallReball}
              onChange={(v) => patch({ noBallReball: v })}
            />
            <SwitchRule
              label="Standard wide runs (1)"
              description="Off = 0 runs for wide"
              checked={rules.wideRuns === 1}
              onChange={(v) => patch({ wideRuns: v ? 1 : 0 })}
            />
            <SwitchRule
              label="Standard no-ball runs (1)"
              description="Off = 0 runs for no-ball"
              checked={rules.noBallRuns === 1}
              onChange={(v) => patch({ noBallRuns: v ? 1 : 0 })}
            />
            <SwitchRule
              label="Free hit on no-ball"
              checked={rules.freeHitOnNoBall}
              onChange={(v) => patch({ freeHitOnNoBall: v })}
            />
            <SwitchRule
              label="Leg byes enabled"
              checked={rules.legByesEnabled}
              onChange={(v) => patch({ legByesEnabled: v })}
            />
            <SwitchRule
              label="Byes enabled"
              checked={rules.byesEnabled}
              onChange={(v) => patch({ byesEnabled: v })}
            />
            <SwitchRule
              label="Last man stands"
              description="Last batter can face alone"
              checked={rules.lastManStands}
              onChange={(v) => patch({ lastManStands: v })}
            />
            <SwitchRule
              label="Super over on tie"
              checked={rules.superOverOnTie}
              onChange={(v) => patch({ superOverOnTie: v })}
            />
            <div className="space-y-3">
              <SwitchRule
                label="Powerplay"
                checked={rules.powerplayEnabled}
                onChange={(v) => patch({ powerplayEnabled: v })}
              />
              {rules.powerplayEnabled && (
                <div className="pl-0">
                  <NumberRule
                    label="Powerplay overs"
                    value={rules.powerplayOvers}
                    min={1}
                    max={rules.oversPerInnings ?? 50}
                    onChange={(v) => patch({ powerplayOvers: v })}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

interface NumberRuleProps {
  label: string
  sub?: string
  value: number
  min: number
  max: number
  onChange: (v: number) => void
}

function NumberRule({ label, sub, value, min, max, onChange }: NumberRuleProps) {
  // Use local string state so typing works freely; clamp and commit on blur
  const [localValue, setLocalValue] = useState(String(value))

  useEffect(() => {
    setLocalValue(String(value))
  }, [value])

  function commit(raw: string) {
    const v = parseInt(raw, 10)
    if (isNaN(v) || v < min) {
      onChange(min)
      setLocalValue(String(min))
    } else if (v > max) {
      onChange(max)
      setLocalValue(String(max))
    } else {
      onChange(v)
      setLocalValue(String(v))
    }
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium leading-none">{label}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
      <Input
        type="number"
        inputMode="numeric"
        className="h-9 w-20 text-center shrink-0"
        value={localValue}
        min={min}
        max={max}
        onChange={(e) => {
          setLocalValue(e.target.value)
          // Fire immediately for in-bounds values so the rest of the UI reacts
          const v = parseInt(e.target.value, 10)
          if (!isNaN(v) && v >= min && v <= max) onChange(v)
        }}
        onBlur={(e) => commit(e.target.value)}
      />
    </div>
  )
}

interface SwitchRuleProps {
  label: string
  description?: string
  checked: boolean
  onChange: (v: boolean) => void
}

function SwitchRule({ label, description, checked, onChange }: SwitchRuleProps) {
  const id = label.replace(/\s+/g, "-").toLowerCase()
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <Label htmlFor={id} className="text-sm font-medium leading-none cursor-pointer">
          {label}
        </Label>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

// ─── Step 3: Toss ─────────────────────────────────────────────────────────────

interface Step3Props {
  team1Id: string
  team2Id: string
  team1Name: string
  team2Name: string
  tossWonBy: string | null
  tossDecision: "bat" | "bowl" | null
  onTossWonBy: (id: string) => void
  onTossDecision: (d: "bat" | "bowl") => void
}

function Step3Toss({
  team1Id,
  team2Id,
  team1Name,
  team2Name,
  tossWonBy,
  tossDecision,
  onTossWonBy,
  onTossDecision,
}: Step3Props) {
  const tossWonByName = tossWonBy === team1Id ? team1Name : tossWonBy === team2Id ? team2Name : null

  return (
    <div className="px-4 space-y-6">
      {/* Who won the toss */}
      <div className="space-y-3">
        <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Who won the toss?
        </p>
        <div className="flex flex-col gap-3">
          {[
            { id: team1Id, name: team1Name },
            { id: team2Id, name: team2Name },
          ].map((team) => (
            <button
              key={team.id}
              onClick={() => onTossWonBy(team.id)}
              className={[
                "w-full rounded-xl border-2 px-4 py-4 text-base font-semibold text-center transition-colors min-h-[56px]",
                tossWonBy === team.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card hover:bg-muted/50",
              ].join(" ")}
            >
              {team.name}
            </button>
          ))}
        </div>
      </div>

      {/* Chose to */}
      {tossWonBy && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Chose to…
          </p>
          <div className="flex gap-3">
            {(["bat", "bowl"] as const).map((d) => (
              <button
                key={d}
                onClick={() => onTossDecision(d)}
                className={[
                  "flex-1 rounded-xl border-2 px-4 py-4 text-base font-semibold text-center transition-colors min-h-[56px] capitalize",
                  tossDecision === d
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card hover:bg-muted/50",
                ].join(" ")}
              >
                {d === "bat" ? "Bat" : "Bowl"}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      {tossWonBy && tossDecision && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-3 px-4 text-center">
            <p className="text-sm font-medium">
              <span className="text-primary font-semibold">{tossWonByName}</span> won the toss
              and elected to{" "}
              <span className="text-primary font-semibold">{tossDecision}</span> first
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ─── Step 4: Playing XI ───────────────────────────────────────────────────────

interface Step4Props {
  team1Id: string
  team2Id: string
  team1Name: string
  team2Name: string
  playingXI1: string[]
  playingXI2: string[]
  maxPlayers: number
  onXI1Change: (ids: string[]) => void
  onXI2Change: (ids: string[]) => void
}

function Step4PlayingXI({
  team1Id,
  team2Id,
  team1Name,
  team2Name,
  playingXI1,
  playingXI2,
  maxPlayers,
  onXI1Change,
  onXI2Change,
}: Step4Props) {
  const [activeTab, setActiveTab] = useState<1 | 2>(1)
  const [newPlayerName, setNewPlayerName] = useState("")
  const [addingPlayer, setAddingPlayer] = useState(false)

  const team1Players = useLiveQuery(
    () => db.players.where("teamId").equals(team1Id).sortBy("createdAt"),
    [team1Id]
  )
  const team2Players = useLiveQuery(
    () => db.players.where("teamId").equals(team2Id).sortBy("createdAt"),
    [team2Id]
  )

  function togglePlayer(playerId: string, current: string[], onChange: (ids: string[]) => void) {
    if (current.includes(playerId)) {
      onChange(current.filter((id) => id !== playerId))
    } else if (current.length < maxPlayers + 1) {
      onChange([...current, playerId])
    }
  }

  async function handleAddPlayer() {
    const name = newPlayerName.trim()
    if (!name) return
    setAddingPlayer(true)
    try {
      const teamId = activeTab === 1 ? team1Id : team2Id
      const id = nanoid()
      await db.players.add({ id, name, teamId, createdAt: new Date() })
      // Auto-select the new player
      const currentXI = activeTab === 1 ? playingXI1 : playingXI2
      const onXIChange = activeTab === 1 ? onXI1Change : onXI2Change
      if (currentXI.length < maxPlayers + 1) {
        onXIChange([...currentXI, id])
      }
      setNewPlayerName("")
    } finally {
      setAddingPlayer(false)
    }
  }

  const displayPlayers = activeTab === 1 ? team1Players : team2Players
  const selectedXI = activeTab === 1 ? playingXI1 : playingXI2
  const onChange = activeTab === 1 ? onXI1Change : onXI2Change

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="px-4 flex gap-2">
        {([1, 2] as const).map((tab) => {
          const name = tab === 1 ? team1Name : team2Name
          const xi = tab === 1 ? playingXI1 : playingXI2
          const active = activeTab === tab
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={[
                "flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              <span className="block truncate">{name}</span>
              <span className="text-xs font-normal">
                {xi.length} / {maxPlayers + 1} selected
              </span>
            </button>
          )
        })}
      </div>

      {/* Inline add player */}
      <div className="px-4 space-y-1.5">
        <Label className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <Plus className="size-3" />
          Add New Player
        </Label>
        <form
          onSubmit={(e) => { e.preventDefault(); handleAddPlayer() }}
          className="flex gap-2"
        >
          <Input
            placeholder="Type player name, then tap Add →"
            value={newPlayerName}
            onChange={(e) => setNewPlayerName(e.target.value)}
            className="flex-1 h-10 text-sm"
          />
          <Button
            type="submit"
            size="sm"
            disabled={!newPlayerName.trim() || addingPlayer}
            onClick={handleAddPlayer}
            className="h-10 px-4 shrink-0"
          >
            <Plus className="size-3.5 mr-1" />
            Add
          </Button>
        </form>
      </div>

      {/* Player list */}
      <div className="px-4">
        {displayPlayers === undefined ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : displayPlayers.length === 0 ? (
          <Card className="border-dashed border-primary/30 bg-primary/5">
            <CardContent className="py-6 text-center">
              <Users className="size-7 text-primary/40 mx-auto mb-2" />
              <p className="text-sm font-medium">No players yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Type a name in the box above, then tap <strong>Add</strong>
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-1.5">
            {displayPlayers.map((player, i) => {
              const isSelected = selectedXI.includes(player.id)
              const atMax = selectedXI.length >= maxPlayers + 1 && !isSelected
              return (
                <button
                  key={player.id}
                  onClick={() => togglePlayer(player.id, selectedXI, onChange)}
                  disabled={atMax}
                  className={[
                    "w-full flex items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors",
                    isSelected
                      ? "border-primary bg-primary/10"
                      : atMax
                      ? "border-border bg-muted/20 opacity-50 cursor-not-allowed"
                      : "border-border bg-card hover:bg-muted/50",
                  ].join(" ")}
                >
                  <div
                    className={[
                      "size-6 rounded-full border-2 flex items-center justify-center shrink-0 text-xs font-bold",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground/30",
                    ].join(" ")}
                  >
                    {isSelected ? <Check className="size-3.5" /> : i + 1}
                  </div>
                  <span className="flex-1 text-sm font-medium">{player.name}</span>
                  {player.role && (
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 shrink-0"
                    >
                      {player.role === "wicketkeeper" ? "WK" : player.role === "allrounder" ? "AR" : player.role.slice(0, 3).toUpperCase()}
                    </Badge>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Step 5: Openers, Captain & Keeper ────────────────────────────────────────

interface Step5Props {
  battingTeamId: string
  bowlingTeamId: string
  battingTeamName: string
  bowlingTeamName: string
  team1Name: string
  team2Name: string
  battingXI: string[]
  bowlingXI: string[]
  playingXI1: string[]
  playingXI2: string[]
  striker: string | null
  nonStriker: string | null
  openingBowler: string | null
  captainTeam1Id: string | null
  captainTeam2Id: string | null
  wicketKeeperTeam1Id: string | null
  wicketKeeperTeam2Id: string | null
  onStriker: (id: string) => void
  onNonStriker: (id: string) => void
  onOpeningBowler: (id: string) => void
  onCaptainTeam1: (id: string) => void
  onCaptainTeam2: (id: string) => void
  onWicketKeeperTeam1: (id: string) => void
  onWicketKeeperTeam2: (id: string) => void
}

function Step5Openers({
  battingTeamId: _battingTeamId,
  bowlingTeamId: _bowlingTeamId,
  battingTeamName,
  bowlingTeamName,
  team1Name,
  team2Name,
  battingXI,
  bowlingXI,
  playingXI1,
  playingXI2,
  striker,
  nonStriker,
  openingBowler,
  captainTeam1Id,
  captainTeam2Id,
  wicketKeeperTeam1Id,
  wicketKeeperTeam2Id,
  onStriker,
  onNonStriker,
  onOpeningBowler,
  onCaptainTeam1,
  onCaptainTeam2,
  onWicketKeeperTeam1,
  onWicketKeeperTeam2,
}: Step5Props) {
  const allPlayers = useLiveQuery(async () => {
    const ids = [...new Set([...battingXI, ...bowlingXI])]
    const players = await db.players.bulkGet(ids)
    const map: Record<string, Player> = {}
    for (const p of players) {
      if (p) map[p.id] = p
    }
    return map
  }, [battingXI, bowlingXI])

  function PlayerSelector({
    title,
    playerIds,
    selected,
    disabledIds,
    onSelect,
  }: {
    title: string
    playerIds: string[]
    selected: string | null
    disabledIds: string[]
    onSelect: (id: string) => void
  }) {
    return (
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {title}
        </p>
        <div className="space-y-1.5">
          {playerIds.map((pid) => {
            const player = allPlayers?.[pid]
            const isSelected = selected === pid
            const isDisabled = disabledIds.includes(pid)
            return (
              <button
                key={pid}
                disabled={isDisabled}
                onClick={() => onSelect(pid)}
                className={[
                  "w-full flex items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors",
                  isSelected
                    ? "border-primary bg-primary/10"
                    : isDisabled
                    ? "border-border bg-muted/20 opacity-50 cursor-not-allowed"
                    : "border-border bg-card hover:bg-muted/50",
                ].join(" ")}
              >
                <div
                  className={[
                    "size-5 rounded-full border-2 shrink-0",
                    isSelected ? "border-primary bg-primary" : "border-muted-foreground/30",
                  ].join(" ")}
                />
                <span className="text-sm font-medium">
                  {player?.name ?? pid}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // Compact chip selector for captain/keeper
  function RoleChipSelector({
    teamName,
    playerIds,
    selected,
    onSelect,
  }: {
    teamName: string
    playerIds: string[]
    selected: string | null
    onSelect: (id: string) => void
  }) {
    return (
      <div className="space-y-1.5">
        <p className="text-[11px] font-medium text-muted-foreground">{teamName}</p>
        <div className="flex flex-wrap gap-1">
          {playerIds.map((pid) => {
            const player = allPlayers?.[pid]
            const firstName = player?.name?.split(" ")[0] ?? "…"
            const isSelected = selected === pid
            return (
              <button
                key={pid}
                onClick={() => onSelect(pid)}
                className={[
                  "px-2 py-1 rounded-md border text-[11px] font-medium transition-colors",
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/40 border-border text-foreground/70 hover:bg-muted/70",
                ].join(" ")}
              >
                {firstName}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 space-y-6">
      <div>
        <p className="text-xs text-muted-foreground mb-1">Batting: <strong>{battingTeamName}</strong></p>
        <PlayerSelector
          title="Striker (on strike)"
          playerIds={battingXI}
          selected={striker}
          disabledIds={nonStriker ? [nonStriker] : []}
          onSelect={onStriker}
        />
      </div>

      <Separator />

      <PlayerSelector
        title="Non-striker"
        playerIds={battingXI}
        selected={nonStriker}
        disabledIds={striker ? [striker] : []}
        onSelect={onNonStriker}
      />

      <Separator />

      <div>
        <p className="text-xs text-muted-foreground mb-1">Bowling: <strong>{bowlingTeamName}</strong></p>
        <PlayerSelector
          title="Opening bowler"
          playerIds={bowlingXI}
          selected={openingBowler}
          disabledIds={[]}
          onSelect={onOpeningBowler}
        />
      </div>

      <Separator />

      {/* Optional: Captains & Wicket-keepers */}
      <div className="space-y-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Captains &amp; Keepers <span className="normal-case font-normal">(optional)</span>
        </p>

        <div className="space-y-1">
          <p className="text-xs font-medium text-foreground/80">Captain (c)</p>
          <div className="grid grid-cols-1 gap-3">
            <RoleChipSelector
              teamName={team1Name}
              playerIds={playingXI1}
              selected={captainTeam1Id}
              onSelect={onCaptainTeam1}
            />
            <RoleChipSelector
              teamName={team2Name}
              playerIds={playingXI2}
              selected={captainTeam2Id}
              onSelect={onCaptainTeam2}
            />
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-medium text-foreground/80">Wicket-keeper (wk)</p>
          <div className="grid grid-cols-1 gap-3">
            <RoleChipSelector
              teamName={team1Name}
              playerIds={playingXI1}
              selected={wicketKeeperTeam1Id}
              onSelect={onWicketKeeperTeam1}
            />
            <RoleChipSelector
              teamName={team2Name}
              playerIds={playingXI2}
              selected={wicketKeeperTeam2Id}
              onSelect={onWicketKeeperTeam2}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Wizard shell ─────────────────────────────────────────────────────────────

function NewMatchPage() {
  const navigate = useNavigate()
  const loadMatch = useScoringStore((s) => s.loadMatch)

  const [step, setStep] = useState(1)

  // Step 1
  const [team1Id, setTeam1Id] = useState<string | null>(null)
  const [team2Id, setTeam2Id] = useState<string | null>(null)

  // Step 2
  const [format, setFormat] = useState<CricketFormat>("T20")
  const [rules, setRules] = useState<MatchRules>({ ...DEFAULT_RULES.T20 })

  // Step 3
  const [tossWonBy, setTossWonBy] = useState<string | null>(null)
  const [tossDecision, setTossDecision] = useState<"bat" | "bowl" | null>(null)

  // Step 4
  const [playingXI1, setPlayingXI1] = useState<string[]>([])
  const [playingXI2, setPlayingXI2] = useState<string[]>([])

  // Step 5
  const [striker, setStriker] = useState<string | null>(null)
  const [nonStriker, setNonStriker] = useState<string | null>(null)
  const [openingBowler, setOpeningBowler] = useState<string | null>(null)
  const [captainTeam1Id, setCaptainTeam1Id] = useState<string | null>(null)
  const [captainTeam2Id, setCaptainTeam2Id] = useState<string | null>(null)
  const [wicketKeeperTeam1Id, setWicketKeeperTeam1Id] = useState<string | null>(null)
  const [wicketKeeperTeam2Id, setWicketKeeperTeam2Id] = useState<string | null>(null)

  const [starting, setStarting] = useState(false)

  // Reactive team data
  const team1 = useLiveQuery(
    async () => (team1Id ? db.teams.get(team1Id) : undefined),
    [team1Id]
  )
  const team2 = useLiveQuery(
    async () => (team2Id ? db.teams.get(team2Id) : undefined),
    [team2Id]
  )

  // Derived: who bats first
  const battingTeamId =
    tossWonBy && tossDecision
      ? tossDecision === "bat"
        ? tossWonBy
        : tossWonBy === team1Id
        ? team2Id!
        : team1Id!
      : null

  const bowlingTeamId =
    battingTeamId === team1Id ? team2Id : battingTeamId === team2Id ? team1Id : null

  const battingXI = battingTeamId === team1Id ? playingXI1 : playingXI2
  const bowlingXI = battingTeamId === team1Id ? playingXI2 : playingXI1

  // Step validation
  const step1Valid = !!team1Id && !!team2Id
  const step2Valid = true // format always selected
  const step3Valid = !!tossWonBy && !!tossDecision
  const step4Valid =
    playingXI1.length >= 2 &&
    playingXI2.length >= 2
  const step5Valid = !!striker && !!nonStriker && !!openingBowler

  function canAdvance() {
    if (step === 1) return step1Valid
    if (step === 2) return step2Valid
    if (step === 3) return step3Valid
    if (step === 4) return step4Valid
    return step5Valid
  }

  function handleNext() {
    if (step < TOTAL_STEPS && canAdvance()) setStep((s) => s + 1)
  }

  function handleBack() {
    if (step > 1) setStep((s) => s - 1)
  }

  const handleStartMatch = useCallback(async () => {
    if (
      !team1Id || !team2Id || !tossWonBy || !tossDecision ||
      !battingTeamId || !bowlingTeamId ||
      !striker || !nonStriker || !openingBowler
    ) return

    setStarting(true)
    try {
      const team1Name = team1?.name ?? ""
      const team2Name = team2?.name ?? ""

      // Build player name map
      const allPlayerIds = [...new Set([...playingXI1, ...playingXI2])]
      const playerObjs = await db.players.bulkGet(allPlayerIds)
      const playerMap: Record<string, Player> = {}
      for (const p of playerObjs) {
        if (p) playerMap[p.id] = p
      }

      const battingXIOrdered = battingTeamId === team1Id ? playingXI1 : playingXI2

      const battingCard = battingXIOrdered.map((playerId, i) => ({
        playerId,
        playerName: playerMap[playerId]?.name ?? playerId,
        position: i + 1,
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        dots: 0,
        strikeRate: 0,
        isOut: false,
        isRetiredHurt: false,
        dismissalText: "not out" as string,
      }))

      const firstInnings: Innings = {
        index: 0,
        battingTeamId,
        bowlingTeamId,
        status: "live",
        totalRuns: 0,
        totalWickets: 0,
        totalOvers: 0,
        totalBalls: 0,
        totalLegalDeliveries: 0,
        extras: { wide: 0, noBall: 0, bye: 0, legBye: 0, penalty: 0, total: 0 },
        battingCard,
        bowlingCard: [],
        ballLog: [],
        fallOfWickets: [],
        partnerships: [],
        isDeclared: false,
      }

      const match: Match = {
        id: nanoid(),
        format,
        rules,
        team1Id,
        team2Id,
        team1Name,
        team2Name,
        playingXI1,
        playingXI2,
        tossWonBy,
        tossDecision,
        innings: [firstInnings],
        currentInningsIndex: 0,
        date: new Date(),
        status: "live",
        isSuperOver: false,
        captainTeam1Id: captainTeam1Id ?? undefined,
        captainTeam2Id: captainTeam2Id ?? undefined,
        wicketKeeperTeam1Id: wicketKeeperTeam1Id ?? undefined,
        wicketKeeperTeam2Id: wicketKeeperTeam2Id ?? undefined,
      }

      await db.matches.add(match)

      // Bootstrap scoring store with opener state
      await loadMatch(match.id)

      // Override store with selected openers & bowler
      useScoringStore.setState({
        onStrikeBatsmanId: striker,
        offStrikeBatsmanId: nonStriker,
        currentBowlerId: openingBowler,
      })

      navigate({ to: "/scoring" })
    } finally {
      setStarting(false)
    }
  }, [
    team1Id, team2Id, team1, team2,
    format, rules,
    tossWonBy, tossDecision,
    battingTeamId, bowlingTeamId,
    playingXI1, playingXI2,
    striker, nonStriker, openingBowler,
    captainTeam1Id, captainTeam2Id,
    wicketKeeperTeam1Id, wicketKeeperTeam2Id,
    loadMatch, navigate,
  ])

  const STEP_TITLES = [
    "Select Teams",
    "Format & Rules",
    "Toss",
    "Playing XI",
    "Openers",
  ]
  const STEP_SUBTITLES = [
    "Choose the two competing teams",
    "Set the match format and rules",
    "Record the toss result",
    `Select ${rules.maxWickets + 1} players per side`,
    "Set opening batsmen and bowler",
  ]

  return (
    <div className="min-h-full bg-background flex flex-col relative overflow-hidden">
      {/* Animated background — fresh match, pitch green */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <motion.div
          className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-emerald-500/6"
          animate={{ scale: [1, 1.12, 1], x: [0, -8, 0], y: [0, 10, 0] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute top-1/3 -left-20 w-52 h-52 rounded-full bg-primary/5"
          animate={{ scale: [1, 1.1, 1], x: [0, 10, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        />
        <motion.div
          className="absolute bottom-16 right-8 w-36 h-36 rounded-full bg-lime-500/5"
          animate={{ scale: [1, 1.18, 1], y: [0, -8, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        />
        {/* Pitch centre circle suggestion */}
        <motion.div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full border border-emerald-500/8"
          animate={{ scale: [1, 1.05, 1], opacity: [0.5, 0.9, 0.5] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center gap-2 px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            className="size-9 -ml-1 shrink-0"
            onClick={() => navigate({ to: "/" })}
          >
            <ChevronLeft className="size-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold truncate">New Match</h1>
            <p className="text-xs text-muted-foreground">
              Step {step} of {TOTAL_STEPS}
            </p>
          </div>
          <Trophy className="size-5 text-primary shrink-0" />
        </div>

        <StepIndicator current={step} total={TOTAL_STEPS} />
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto">
        <div className="pb-40">
          <StepHeader
            title={STEP_TITLES[step - 1]}
            subtitle={STEP_SUBTITLES[step - 1]}
          />

          {step === 1 && (
            <Step1Teams
              team1Id={team1Id}
              team2Id={team2Id}
              onSelectTeam1={setTeam1Id}
              onSelectTeam2={setTeam2Id}
            />
          )}

          {step === 2 && (
            <Step2Format
              format={format}
              rules={rules}
              onFormatChange={setFormat}
              onRulesChange={setRules}
            />
          )}

          {step === 3 && team1Id && team2Id && (
            <Step3Toss
              team1Id={team1Id}
              team2Id={team2Id}
              team1Name={team1?.name ?? "Team A"}
              team2Name={team2?.name ?? "Team B"}
              tossWonBy={tossWonBy}
              tossDecision={tossDecision}
              onTossWonBy={setTossWonBy}
              onTossDecision={setTossDecision}
            />
          )}

          {step === 4 && team1Id && team2Id && (
            <Step4PlayingXI
              team1Id={team1Id}
              team2Id={team2Id}
              team1Name={team1?.name ?? "Team A"}
              team2Name={team2?.name ?? "Team B"}
              playingXI1={playingXI1}
              playingXI2={playingXI2}
              maxPlayers={rules.maxWickets}
              onXI1Change={setPlayingXI1}
              onXI2Change={setPlayingXI2}
            />
          )}

          {step === 5 &&
            battingTeamId &&
            bowlingTeamId &&
            team1Id &&
            team2Id && (
              <Step5Openers
                battingTeamId={battingTeamId}
                bowlingTeamId={bowlingTeamId}
                battingTeamName={
                  battingTeamId === team1Id
                    ? team1?.name ?? "Team A"
                    : team2?.name ?? "Team B"
                }
                bowlingTeamName={
                  bowlingTeamId === team1Id
                    ? team1?.name ?? "Team A"
                    : team2?.name ?? "Team B"
                }
                team1Name={team1?.name ?? "Team A"}
                team2Name={team2?.name ?? "Team B"}
                battingXI={battingXI}
                bowlingXI={bowlingXI}
                playingXI1={playingXI1}
                playingXI2={playingXI2}
                striker={striker}
                nonStriker={nonStriker}
                openingBowler={openingBowler}
                captainTeam1Id={captainTeam1Id}
                captainTeam2Id={captainTeam2Id}
                wicketKeeperTeam1Id={wicketKeeperTeam1Id}
                wicketKeeperTeam2Id={wicketKeeperTeam2Id}
                onStriker={setStriker}
                onNonStriker={setNonStriker}
                onOpeningBowler={setOpeningBowler}
                onCaptainTeam1={setCaptainTeam1Id}
                onCaptainTeam2={setCaptainTeam2Id}
                onWicketKeeperTeam1={setWicketKeeperTeam1Id}
                onWicketKeeperTeam2={setWicketKeeperTeam2Id}
              />
            )}
        </div>
      </div>

      {/* Footer nav */}
      <div className="fixed bottom-[calc(52px+env(safe-area-inset-bottom))] left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border px-4 py-3">
        <div className="flex gap-3">
          {step > 1 && (
            <Button
              variant="outline"
              className="flex-1 h-12 gap-2"
              onClick={handleBack}
              disabled={starting}
            >
              <ChevronLeft className="size-4" />
              Back
            </Button>
          )}

          {step < TOTAL_STEPS ? (
            <Button
              className="flex-1 h-12 gap-2"
              onClick={handleNext}
              disabled={!canAdvance()}
            >
              Next
              <ChevronRight className="size-4" />
            </Button>
          ) : (
            <Button
              className="flex-1 h-12 gap-2 bg-emerald-600 hover:bg-emerald-500 text-white"
              onClick={handleStartMatch}
              disabled={!step5Valid || starting}
            >
              {starting ? (
                "Starting…"
              ) : (
                <>
                  <Trophy className="size-4" />
                  Start Match
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export const Route = createFileRoute("/new-match")({
  component: NewMatchPage,
})

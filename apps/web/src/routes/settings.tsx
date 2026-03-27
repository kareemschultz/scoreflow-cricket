import { motion } from "framer-motion"
import { createFileRoute } from "@tanstack/react-router"
import { useLiveQuery } from "dexie-react-hooks"
import { useState, useEffect } from "react"
import { Settings, Download, Upload, Trash2, Info, Palette, Sliders, Database } from "lucide-react"
import { db, getSettings, saveSettings } from "@/db/index"
import type { AppSettings, CricketFormat } from "@/types/cricket"
import { DEFAULT_RULES } from "@/types/cricket"
import { useTheme } from "@/components/theme-provider"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@workspace/ui/components/card"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Switch } from "@workspace/ui/components/switch"
import { Label } from "@workspace/ui/components/label"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@workspace/ui/components/alert-dialog"
import { Separator } from "@workspace/ui/components/separator"

// ─── Settings Page ────────────────────────────────────────────────────────────

function SettingsPage() {
  const { setTheme } = useTheme()

  const settingsRow = useLiveQuery(async () => {
    return getSettings()
  })

  const [localSettings, setLocalSettings] = useState<AppSettings | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [clearConfirm, setClearConfirm] = useState(false)

  useEffect(() => {
    if (settingsRow && !localSettings) {
      setLocalSettings(settingsRow)
    }
  }, [settingsRow, localSettings])

  async function handleSave(patch: Partial<AppSettings>) {
    setIsSaving(true)
    await saveSettings(patch)
    setIsSaving(false)
  }

  function updateSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setLocalSettings((prev) => (prev ? { ...prev, [key]: value } : null))
    handleSave({ [key]: value })
    if (key === "theme") {
      setTheme(value as AppSettings["theme"])
    }
  }

  // ── Export ───────────────────────────────────────────────────────────────────

  async function handleExport() {
    const [teams, players, matches, tournaments, battingStats, bowlingStats] =
      await Promise.all([
        db.teams.toArray(),
        db.players.toArray(),
        db.matches.toArray(),
        db.tournaments.toArray(),
        db.battingStats.toArray(),
        db.bowlingStats.toArray(),
      ])

    const payload = {
      exportedAt: new Date().toISOString(),
      version: "1.0.0",
      teams,
      players,
      matches,
      tournaments,
      battingStats,
      bowlingStats,
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `cricketbook-backup-${new Date().toISOString().split("T")[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Import ───────────────────────────────────────────────────────────────────

  function handleImport() {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".json,application/json"
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        const data = JSON.parse(text)
        await db.transaction(
          "rw",
          [db.teams, db.players, db.matches, db.tournaments, db.battingStats, db.bowlingStats],
          async () => {
            if (data.teams?.length) await db.teams.bulkPut(data.teams)
            if (data.players?.length) await db.players.bulkPut(data.players)
            if (data.matches?.length) await db.matches.bulkPut(data.matches)
            if (data.tournaments?.length)
              await db.tournaments.bulkPut(data.tournaments)
            if (data.battingStats?.length)
              await db.battingStats.bulkPut(data.battingStats)
            if (data.bowlingStats?.length)
              await db.bowlingStats.bulkPut(data.bowlingStats)
          }
        )
        alert("Import successful!")
      } catch {
        alert("Import failed. Please check the file format.")
      }
    }
    input.click()
  }

  // ── Clear all data ────────────────────────────────────────────────────────────

  async function handleClearData() {
    await db.transaction(
      "rw",
      [db.teams, db.players, db.matches, db.tournaments, db.battingStats, db.bowlingStats],
      async () => {
        await Promise.all([
          db.teams.clear(),
          db.players.clear(),
          db.matches.clear(),
          db.tournaments.clear(),
          db.battingStats.clear(),
          db.bowlingStats.clear(),
        ])
      }
    )
    setClearConfirm(false)
  }

  const settings = localSettings ?? settingsRow

  if (!settings) {
    return (
      <div className="min-h-full bg-background flex items-center justify-center">
        <div className="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const defaultRules = DEFAULT_RULES[settings.defaultFormat]

  return (
    <div className="min-h-full bg-background relative overflow-hidden">
      {/* Animated background — tech grid / cog vibes */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <motion.div
          className="absolute -top-10 -right-10 w-48 h-48 rounded-full border border-border/20"
          animate={{ rotate: 360 }}
          transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="absolute -top-6 -right-6 w-36 h-36 rounded-full border border-border/15"
          animate={{ rotate: -360 }}
          transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="absolute bottom-32 -left-12 w-40 h-40 rounded-full border border-border/15"
          animate={{ rotate: 360 }}
          transition={{ duration: 35, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-slate-500/4"
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-8 left-8 w-28 h-28 rounded-full bg-violet-500/4"
          animate={{ scale: [1, 1.15, 1], x: [0, 4, 0] }}
          transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        />
      </div>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Settings className="size-5 text-primary" />
          <h1 className="text-lg font-bold tracking-tight">Settings</h1>
          {isSaving && (
            <span className="ml-auto text-xs text-muted-foreground animate-pulse">
              Saving…
            </span>
          )}
        </div>
      </div>

      <div className="px-4 py-4 space-y-5 pb-8">
        {/* Default Format */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Sliders className="size-4 text-primary" />
              <CardTitle className="text-sm">Default Format</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Format applied when creating a new match
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select
              value={settings.defaultFormat}
              onValueChange={(v) =>
                v && updateSetting("defaultFormat", v as CricketFormat)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="T20">T20 (20 overs)</SelectItem>
                <SelectItem value="ODI">ODI (50 overs)</SelectItem>
                <SelectItem value="TEST">Test (unlimited)</SelectItem>
                <SelectItem value="CUSTOM">Custom</SelectItem>
              </SelectContent>
            </Select>

            {/* Quick preview of default rules */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              {[
                {
                  label: "Overs",
                  value: defaultRules.oversPerInnings ?? "Unlimited",
                },
                {
                  label: "Max per bowler",
                  value: defaultRules.maxOversPerBowler ?? "No limit",
                },
                {
                  label: "Free hit",
                  value: defaultRules.freeHitOnNoBall ? "Yes" : "No",
                },
                {
                  label: "Innings/side",
                  value: defaultRules.inningsPerSide,
                },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="rounded-md bg-muted/50 px-2 py-1.5"
                >
                  <p className="text-[10px] text-muted-foreground">{label}</p>
                  <p className="text-xs font-medium">{String(value)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Appearance */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Palette className="size-4 text-primary" />
              <CardTitle className="text-sm">Appearance</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            {(
              [
                { value: "dark", label: "Dark" },
                { value: "light", label: "Light" },
                { value: "system", label: "System" },
              ] as { value: AppSettings["theme"]; label: string }[]
            ).map(({ value, label }) => (
              <button
                key={value}
                className="w-full flex items-center justify-between py-2.5 px-0"
                onClick={() => updateSetting("theme", value)}
              >
                <span className="text-sm">{label}</span>
                {settings.theme === value && (
                  <Badge
                    variant="outline"
                    className="text-[10px] text-primary border-primary/30 bg-primary/10"
                  >
                    Active
                  </Badge>
                )}
              </button>
            ))}

            <Separator className="my-1" />

            <div className="flex items-center justify-between py-2.5">
              <div>
                <Label className="text-sm">Haptic feedback</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Vibrate on scoring actions
                </p>
              </div>
              <Switch
                checked={settings.hapticFeedback}
                onCheckedChange={(v) => updateSetting("hapticFeedback", v)}
              />
            </div>

            <div className="flex items-center justify-between py-2.5">
              <div>
                <Label className="text-sm">Keep screen awake</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Prevent sleep during scoring
                </p>
              </div>
              <Switch
                checked={settings.wakeLock}
                onCheckedChange={(v) => updateSetting("wakeLock", v)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Match Defaults */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Sliders className="size-4 text-primary" />
              <CardTitle className="text-sm">Match Defaults</CardTitle>
            </div>
            <CardDescription className="text-xs">
              These are set automatically from the selected format above
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {[
                {
                  label: "Balls per over",
                  value: defaultRules.ballsPerOver,
                },
                {
                  label: "Max wickets",
                  value: defaultRules.maxWickets,
                },
                {
                  label: "Wide runs",
                  value: defaultRules.wideRuns,
                },
                {
                  label: "No-ball runs",
                  value: defaultRules.noBallRuns,
                },
                {
                  label: "Powerplay overs",
                  value: defaultRules.powerplayEnabled
                    ? defaultRules.powerplayOvers
                    : "Off",
                },
                {
                  label: "Super over on tie",
                  value: defaultRules.superOverOnTie ? "Yes" : "No",
                },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-md bg-muted/50 px-2 py-1.5">
                  <p className="text-[10px] text-muted-foreground">{label}</p>
                  <p className="text-xs font-medium">{String(value)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Data Management */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Database className="size-4 text-primary" />
              <CardTitle className="text-sm">Data Management</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={handleExport}
            >
              <Download className="size-4" />
              Export data as JSON
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={handleImport}
            >
              <Upload className="size-4" />
              Import from JSON
            </Button>

            <Separator className="my-2" />

            <AlertDialog open={clearConfirm} onOpenChange={setClearConfirm}>
              <AlertDialogTrigger
                render={
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2 border-destructive/40 text-destructive hover:bg-destructive/10"
                  />
                }
              >
                <Trash2 className="size-4" />
                Clear all data
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear all data?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all matches, teams, players,
                    tournaments and statistics. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={handleClearData}
                  >
                    Delete everything
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>

        {/* About */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Info className="size-4 text-primary" />
              <CardTitle className="text-sm">About</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">App name</span>
              <span className="text-sm font-medium">CricketBook</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Version</span>
              <Badge variant="outline" className="text-xs">
                1.0.0
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Storage</span>
              <span className="text-sm font-medium">IndexedDB (Dexie)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Type</span>
              <span className="text-sm font-medium">Progressive Web App</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
})

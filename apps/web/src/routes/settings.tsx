import { motion } from "framer-motion"
import { createFileRoute } from "@tanstack/react-router"
import { useLiveQuery } from "dexie-react-hooks"
import { useState, useEffect, useCallback } from "react"
import { Settings, Download, Upload, Trash2, Info, Palette, Sliders, Database, AlertTriangle, CheckCircle2, FlaskConical, GitMerge, RefreshCw } from "lucide-react"
import { db, getSettings, saveSettings } from "@/db/index"
import { validateImportPayload, formatValidationErrors } from "@/lib/import-validator"
import { EXPORT_TABLE_KEYS, type ExportPayload, type ImportMode } from "@/types/export"
import { getErrorLog, clearErrorLog, subscribeErrorLog, type ErrorEntry } from "@/lib/error-log"
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

function isArrayOfObjects(v: unknown): v is Record<string, unknown>[] {
  return Array.isArray(v) && v.every((x) => typeof x === "object" && x !== null && !Array.isArray(x))
}

function SettingsPage() {
  const { setTheme } = useTheme()

  const settingsRow = useLiveQuery(async () => {
    return getSettings()
  })

  const [localSettings, setLocalSettings] = useState<AppSettings | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [clearConfirm, setClearConfirm] = useState(false)
  const [importMode, setImportMode] = useState<ImportMode>("replace")

  // ── Dry-run state ─────────────────────────────────────────────────────────
  interface DryRunResult {
    valid: boolean
    counts: Record<string, number>
    errors: ReturnType<typeof validateImportPayload>
  }
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null)

  // ── Import confirmation state ──────────────────────────────────────────────
  const [showImportConfirm, setShowImportConfirm] = useState(false)

  // ── Error log state (reactive via subscription) ───────────────────────────
  const [errorLog, setErrorLog] = useState<ErrorEntry[]>(() => getErrorLog())

  useEffect(() => {
    return subscribeErrorLog(() => setErrorLog(getErrorLog()))
  }, [])

  // ── Export ───────────────────────────────────────────────────────────────────

  async function handleExport() {
    const [
      teams, players, matches, tournaments, battingStats, bowlingStats,
      settingsRows,
    ] = await Promise.all([
      db.teams.toArray(),
      db.players.toArray(),
      db.matches.toArray(),
      db.tournaments.toArray(),
      db.battingStats.toArray(),
      db.bowlingStats.toArray(),
      db.settings.toArray(),
    ])

    const tables = {
      teams, players, matches, tournaments, battingStats, bowlingStats,
      settings: settingsRows,
    }

    // Compute SHA-256 over the canonical JSON of the 17 data tables.
    // Metadata fields (exportedAt, schemaVersion, integrity) are excluded so
    // that re-exporting identical data always produces the same hash.
    const canonical = JSON.stringify(
      Object.fromEntries(EXPORT_TABLE_KEYS.map((k) => [k, tables[k]]))
    )
    const hashBuffer = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(canonical)
    )
    const hash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")

    const payload: ExportPayload = {
      exportedAt: new Date().toISOString(),
      version: "1.0.0",
      schemaVersion: 1,
      integrity: { algorithm: "sha256", hash },
      ...tables,
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `scoreflow-backup-${new Date().toISOString().split("T")[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Import / dry-run ─────────────────────────────────────────────────────────

  const MAX_IMPORT_MB = 25
  const MAX_IMPORT_BYTES = MAX_IMPORT_MB * 1024 * 1024

  // Shared file-picker + parse helper
  const pickAndParseFile = useCallback((
    onResult: (data: Record<string, unknown>) => void,
    onError: (msg: string) => void
  ) => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".json,application/json"
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      if (file.size > MAX_IMPORT_BYTES) {
        onError(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max: ${MAX_IMPORT_MB} MB.`)
        return
      }
      try {
        const raw: unknown = JSON.parse(await file.text())
        if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
          onError("File must contain a JSON object, not an array or primitive.")
          return
        }
        onResult(raw as Record<string, unknown>)
      } catch {
        onError("Invalid JSON — could not parse file.")
      }
    }
    input.click()
  }, [MAX_IMPORT_BYTES])

  function handleDryRun() {
    pickAndParseFile(
      (data) => {
        const errors = validateImportPayload(data)
        const TABLES = [
          "teams", "players", "matches", "tournaments", "battingStats", "bowlingStats",
          "settings",
        ] as const
        const counts = Object.fromEntries(
          TABLES.map((t) => [t, Array.isArray(data[t]) ? (data[t] as unknown[]).length : 0])
        )
        setDryRunResult({ valid: errors.length === 0, counts, errors })
      },
      (msg) => setDryRunResult({ valid: false, counts: {}, errors: [{ table: "file", row: -1, issue: msg }] })
    )
  }

  function handleImportDirect(mode: ImportMode = "replace") {
    pickAndParseFile(
      async (data) => {
        // Warn about schema version mismatch but don't block
        const exportedVersion = typeof data.schemaVersion === "number" ? data.schemaVersion : 1
        if (exportedVersion > 1) {
          const proceed = window.confirm(
            `This backup was exported with schema version ${exportedVersion}. ` +
            `Current app uses version 1. Rows may not import correctly. Continue?`
          )
          if (!proceed) return
        }

        // Integrity hash verification (non-blocking — warn and let user decide)
        if (
          data.integrity &&
          typeof data.integrity === "object" &&
          (data.integrity as Record<string, unknown>).algorithm === "sha256" &&
          typeof (data.integrity as Record<string, unknown>).hash === "string"
        ) {
          const canonical = JSON.stringify(
            Object.fromEntries(EXPORT_TABLE_KEYS.map((k) => [k, data[k] ?? []]))
          )
          const hashBuffer = await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(canonical)
          )
          const computedHash = Array.from(new Uint8Array(hashBuffer))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("")
          const storedHash = (data.integrity as Record<string, unknown>).hash as string
          if (computedHash !== storedHash) {
            const proceed = window.confirm(
              "Warning: this backup's integrity hash does not match its contents. " +
              "The file may have been edited or corrupted. Import anyway?"
            )
            if (!proceed) return
          }
        }

        // Validate each table's data is an array of objects before writing
        for (const table of EXPORT_TABLE_KEYS) {
          if (data[table] !== undefined && !isArrayOfObjects(data[table])) {
            alert(`Import failed: "${table}" must be an array of objects.`)
            return
          }
        }

        // Row-level schema validation — reject before any DB writes
        const rowErrors = validateImportPayload(data)
        if (rowErrors.length > 0) {
          alert(formatValidationErrors(rowErrors))
          return
        }

        try {
          await db.transaction(
            "rw",
            [
              db.teams, db.players, db.matches, db.tournaments, db.battingStats, db.bowlingStats,
              db.settings,
            ],
            async () => {
              // Helper: write records according to the selected import mode.
              // replace = bulkPut (upsert, overwrites existing records by primary key)
              // merge   = bulkAdd only records whose id is not already in the DB
              interface BulkTable {
                bulkPut(items: never[]): Promise<unknown>
                bulkAdd(items: never[]): Promise<unknown>
                toCollection(): { primaryKeys(): Promise<unknown[]> }
              }
              async function writeTable(table: BulkTable, rows: unknown[]) {
                if (!isArrayOfObjects(rows) || rows.length === 0) return
                if (mode === "replace") {
                  await table.bulkPut(rows as never)
                } else {
                  const existingIds = new Set(
                    await table.toCollection().primaryKeys() as string[]
                  )
                  const newRows = (rows as Array<{ id: string }>).filter(
                    (r) => !existingIds.has(r.id)
                  )
                  if (newRows.length) await table.bulkAdd(newRows as never)
                }
              }

              await writeTable(db.teams, (data.teams as unknown[]) ?? [])
              await writeTable(db.players, (data.players as unknown[]) ?? [])
              await writeTable(db.matches, (data.matches as unknown[]) ?? [])
              await writeTable(db.tournaments, (data.tournaments as unknown[]) ?? [])
              await writeTable(db.battingStats, (data.battingStats as unknown[]) ?? [])
              await writeTable(db.bowlingStats, (data.bowlingStats as unknown[]) ?? [])
              await writeTable(db.settings, (data.settings as unknown[]) ?? [])
            }
          )
          alert("Import successful!")
        } catch {
          alert("Import failed. Please check the file format.")
        }
      },
      (msg) => alert(`Import failed: ${msg}`)
    )
  }

  // ── Clear all data ────────────────────────────────────────────────────────────

  async function handleClearData() {
    await db.transaction(
      "rw",
      [
        db.teams, db.players, db.matches, db.tournaments, db.battingStats, db.bowlingStats,
        db.settings,
      ],
      async () => {
        await Promise.all([
          db.teams.clear(),
          db.players.clear(),
          db.matches.clear(),
          db.tournaments.clear(),
          db.battingStats.clear(),
          db.bowlingStats.clear(),
          db.settings.clear(),
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

  async function handleSave(patch: Partial<AppSettings>) {
    setIsSaving(true)
    await saveSettings(patch)
    setIsSaving(false)
  }

  function updateSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setLocalSettings((prev) => {
      const nextSettings: AppSettings = { ...(prev ?? settings), [key]: value } as AppSettings
      return nextSettings
    })
    void handleSave({ [key]: value })
    if (key === "theme") {
      setTheme(value as AppSettings["theme"])
    }
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
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="justify-start gap-1.5 text-sm"
                onClick={() => setShowImportConfirm(true)}
              >
                <Upload className="size-4" />
                Import
              </Button>
              <Button
                variant="outline"
                className="justify-start gap-1.5 text-sm text-muted-foreground"
                onClick={handleDryRun}
              >
                <FlaskConical className="size-4" />
                Validate file
              </Button>
            </div>

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

        {/* Diagnostics */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-primary" />
              <CardTitle className="text-sm">Diagnostics</CardTitle>
              {errorLog.length > 0 && (
                <Badge variant="outline" className="ml-auto text-[10px] border-destructive/40 text-destructive bg-destructive/10">
                  {errorLog.length}
                </Badge>
              )}
            </div>
            <CardDescription className="text-xs">
              Non-fatal errors recorded this session
            </CardDescription>
          </CardHeader>
          <CardContent>
            {errorLog.length === 0 ? (
              <p className="text-xs text-muted-foreground">No errors recorded this session.</p>
            ) : (
              <div className="space-y-1.5">
                {errorLog.map((e, i) => (
                  <div key={i} className="text-xs p-2 rounded-lg bg-destructive/8 border border-destructive/20">
                    <span className="text-muted-foreground">{e.timestamp.slice(11, 19)}</span>
                    {" · "}
                    <span className="font-semibold text-destructive">{e.context}</span>
                    <p className="mt-0.5 text-foreground/80 break-all">{e.message}</p>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-1 text-xs"
                  onClick={() => clearErrorLog()}
                >
                  Clear log
                </Button>
              </div>
            )}
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
              <span className="text-sm font-medium">ScoreFlow Cricket</span>
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

      {/* Import confirmation dialog */}
      <AlertDialog open={showImportConfirm} onOpenChange={(open) => !open && setShowImportConfirm(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Import data</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="block space-y-3">
                {/* Import mode selector */}
                <span className="grid grid-cols-2 gap-2 pt-1 block">
                  <button
                    type="button"
                    onClick={() => setImportMode("replace")}
                    className={`flex items-start gap-2 rounded-lg border p-3 text-left transition-colors ${
                      importMode === "replace"
                        ? "border-primary bg-primary/10"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <RefreshCw className="size-4 shrink-0 mt-0.5 text-primary" />
                    <span>
                      <span className="block text-xs font-semibold text-foreground">Replace</span>
                      <span className="block text-[10px] text-muted-foreground">Overwrite existing records</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportMode("merge")}
                    className={`flex items-start gap-2 rounded-lg border p-3 text-left transition-colors ${
                      importMode === "merge"
                        ? "border-primary bg-primary/10"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <GitMerge className="size-4 shrink-0 mt-0.5 text-primary" />
                    <span>
                      <span className="block text-xs font-semibold text-foreground">Merge</span>
                      <span className="block text-[10px] text-muted-foreground">Add new records only</span>
                    </span>
                  </button>
                </span>
                <span className="block text-xs text-muted-foreground">
                  Creating a backup first lets you restore if anything goes wrong.
                </span>
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowImportConfirm(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-secondary text-secondary-foreground hover:bg-secondary/80"
              onClick={() => {
                setShowImportConfirm(false)
                handleImportDirect(importMode)
              }}
            >
              Skip backup — Import
            </AlertDialogAction>
            <AlertDialogAction
              onClick={() => {
                setShowImportConfirm(false)
                handleExport()
                setTimeout(() => {
                  handleImportDirect(importMode)
                }, 500)
              }}
            >
              Create backup first
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dry-run result dialog */}
      <AlertDialog open={!!dryRunResult} onOpenChange={(open) => !open && setDryRunResult(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {dryRunResult?.valid
                ? <><CheckCircle2 className="size-5 text-emerald-500" /> File is valid</>
                : <><AlertTriangle className="size-5 text-destructive" /> Validation failed</>
              }
            </AlertDialogTitle>
            <AlertDialogDescription>
              <span className="block space-y-2 text-left">
                {dryRunResult?.valid ? (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Ready to import:</p>
                    {Object.entries(dryRunResult.counts)
                      .filter(([, n]) => n > 0)
                      .map(([table, count]) => (
                        <div key={table} className="flex justify-between text-xs px-2 py-1 rounded bg-muted/50">
                          <span className="capitalize">{table}</span>
                          <span className="font-semibold">{count} row{count !== 1 ? "s" : ""}</span>
                        </div>
                      ))
                    }
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">
                      {dryRunResult?.errors.length ?? 0} error(s) — no data was written:
                    </p>
                    {dryRunResult?.errors.slice(0, 8).map((e, i) => (
                      <p key={i} className="text-xs text-destructive break-all">
                        • {e.table}[{e.row}]: {e.issue}
                      </p>
                    ))}
                    {(dryRunResult?.errors.length ?? 0) > 8 && (
                      <p className="text-xs text-muted-foreground">…and {(dryRunResult?.errors.length ?? 0) - 8} more.</p>
                    )}
                  </div>
                )}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDryRunResult(null)}>Close</AlertDialogCancel>
            {dryRunResult?.valid && (
              <AlertDialogAction onClick={() => { setDryRunResult(null); handleImportDirect() }}>
                Import now
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
})

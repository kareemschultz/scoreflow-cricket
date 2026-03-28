import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useLiveQuery } from "dexie-react-hooks"
import { formatDistanceToNow } from "date-fns"
import { Search, Clock, Trophy, Trash2 } from "lucide-react"
import { useState, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: "easeOut" as const } },
}
import { db } from "@/db/index"
import type { Match } from "@/types/cricket"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Badge } from "@workspace/ui/components/badge"
import { Input } from "@workspace/ui/components/input"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatBadgeClass(format: Match["format"]) {
  const map: Record<Match["format"], string> = {
    T20: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    ODI: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    TEST: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    CUSTOM: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  }
  return map[format]
}

function statusBadgeClass(status: Match["status"]) {
  if (status === "abandoned")
    return "bg-red-500/20 text-red-400 border-red-500/30"
  return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
}

function getTeamScore(match: Match, teamId: string): string {
  const innings = match.innings.filter((i) => i.battingTeamId === teamId)
  if (!innings.length) return "—"
  return innings
    .map((i) => `${i.totalRuns}/${i.totalWickets}`)
    .join(" & ")
}

// ─── Match Row ────────────────────────────────────────────────────────────────

function MatchRow({ match }: { match: Match }) {
  const navigate = useNavigate()
  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const team1Score = getTeamScore(match, match.team1Id)
  const team2Score = getTeamScore(match, match.team2Id)

  function startLongPress() {
    longPressTimer.current = setTimeout(() => setShowDelete(true), 500)
  }
  function cancelLongPress() {
    if (longPressTimer.current) clearTimeout(longPressTimer.current)
  }

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    setDeleting(true)
    await db.matches.delete(match.id)
  }

  return (
    <motion.div
      className="w-full relative"
      variants={itemVariants}
      layout
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.button
        className="w-full text-left"
        onClick={() => {
          if (showDelete) { setShowDelete(false); return }
          navigate({ to: "/scorecard/$matchId", params: { matchId: match.id } })
        }}
        onMouseDown={startLongPress}
        onMouseUp={cancelLongPress}
        onMouseLeave={cancelLongPress}
        onTouchStart={startLongPress}
        onTouchEnd={cancelLongPress}
        onTouchMove={cancelLongPress}
        whileTap={{ scale: showDelete ? 1 : 0.98 }}
      >
        <Card className={`hover:bg-muted/50 active:bg-muted/70 transition-colors ${showDelete ? "border-red-500/40" : ""}`}>
          <CardContent className="py-3 px-4">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-semibold text-sm">{match.team1Name}</span>
                  <span className="text-xs text-muted-foreground">vs</span>
                  <span className="font-semibold text-sm">{match.team2Name}</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground tabular-nums">{team1Score}</span>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{team2Score}</span>
                </div>
                {match.result && (
                  <p className="text-xs text-primary font-medium mt-1 leading-tight">{match.result}</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <div className="flex items-center gap-1">
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${formatBadgeClass(match.format)}`}>
                    {match.format}
                  </Badge>
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusBadgeClass(match.status)}`}>
                    {match.status === "abandoned" ? "ABD" : "FIN"}
                  </Badge>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {formatDistanceToNow(new Date(match.date), { addSuffix: true })}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.button>

      {/* Delete button — revealed on long-press */}
      <AnimatePresence>
        {showDelete && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
            onClick={handleDelete}
            disabled={deleting}
            className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-400 text-white text-xs font-semibold shadow-lg"
          >
            <Trash2 className="size-3.5" />
            {deleting ? "Deleting…" : "Delete"}
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── History Page ─────────────────────────────────────────────────────────────

function HistoryPage() {
  const [search, setSearch] = useState("")

  const matches = useLiveQuery(async () => {
    const all = await db.matches
      .where("status")
      .anyOf(["completed", "abandoned"])
      .sortBy("date")
    return all.reverse()
  })

  const filtered =
    search.trim() === ""
      ? (matches ?? [])
      : (matches ?? []).filter(
          (m) =>
            m.team1Name.toLowerCase().includes(search.toLowerCase()) ||
            m.team2Name.toLowerCase().includes(search.toLowerCase())
        )

  return (
    <div className="min-h-full bg-background relative overflow-hidden">
      {/* Animated background — drifting archive orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <motion.div
          className="absolute -top-16 -left-16 w-72 h-72 rounded-full bg-indigo-500/5"
          animate={{ scale: [1, 1.1, 1], x: [0, 10, 0], y: [0, 14, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute top-1/2 -right-20 w-56 h-56 rounded-full bg-purple-500/5"
          animate={{ scale: [1, 1.08, 1], x: [0, -8, 0], y: [0, -12, 0] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut", delay: 3 }}
        />
        <motion.div
          className="absolute bottom-24 left-4 w-36 h-36 rounded-full bg-violet-500/4"
          animate={{ scale: [1, 1.15, 1], y: [0, -10, 0] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
        />
        {/* Fading timeline lines */}
        <motion.div
          className="absolute top-0 left-1/4 w-px h-full bg-gradient-to-b from-transparent via-indigo-500/8 to-transparent"
          animate={{ opacity: [0.4, 0.8, 0.4] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute top-0 right-1/3 w-px h-full bg-gradient-to-b from-transparent via-purple-500/6 to-transparent"
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        />
      </div>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 space-y-3">
        <div className="flex items-center gap-2">
          <Clock className="size-5 text-primary" />
          <h1 className="text-lg font-bold tracking-tight">Match History</h1>
        </div>
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            placeholder="Search by team name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="px-4 py-4">
        {matches === undefined ? (
          /* Loading skeleton */
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Card key={i}>
                <CardContent className="py-3 px-4">
                  <div className="h-4 bg-muted rounded animate-pulse w-3/4 mb-2" />
                  <div className="h-3 bg-muted rounded animate-pulse w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Trophy className="size-12 text-muted-foreground/40 mb-4" />
            {search.trim() !== "" ? (
              <>
                <p className="text-sm font-medium text-muted-foreground">
                  No matches found
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Try a different team name
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-muted-foreground">
                  No match history yet
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Completed matches will appear here
                </p>
              </>
            )}
          </div>
        ) : (
          /* Match list */
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground mb-3">
              {filtered.length} match{filtered.length !== 1 ? "es" : ""}
              {search.trim() !== "" && " found"}
            </p>
            <AnimatePresence initial={false}>
              {filtered.map((match) => (
                <MatchRow key={match.id} match={match} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  )
}

export const Route = createFileRoute("/history")({
  component: HistoryPage,
})

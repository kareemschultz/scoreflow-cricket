import { motion } from "framer-motion"
import type { Innings } from "@/types/cricket"

// ─── Types ────────────────────────────────────────────────────────────────────

interface BatsmanBreakdownChartProps {
  innings: Innings[]
  teamNames: string[]
}

interface BatsmanRow {
  name: string
  runs: number
  dots: number
  fours: number
  sixes: number
  other: number
  total: number
}

// ─── InningsBarsSection ───────────────────────────────────────────────────────

function InningsBarsSection({ batsmen }: { batsmen: BatsmanRow[] }) {
  const maxBalls = Math.max(...batsmen.map((b) => b.total), 1)

  return (
    <>
      {batsmen.map((b, i) => {
        const scale = b.total / maxBalls
        const dotPct   = b.total > 0 ? (b.dots  / b.total) * 100 * scale : 0
        const otherPct = b.total > 0 ? (b.other / b.total) * 100 * scale : 0
        const fourPct  = b.total > 0 ? (b.fours / b.total) * 100 * scale : 0
        const sixPct   = b.total > 0 ? (b.sixes / b.total) * 100 * scale : 0

        return (
          <div key={b.name} className="space-y-0.5">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-foreground/80 truncate max-w-[160px]">{b.name}</span>
              <span className="font-semibold tabular-nums shrink-0 ml-2">{b.runs} runs</span>
            </div>
            <div className="h-2.5 bg-muted/20 rounded-full overflow-hidden flex">
              <motion.div
                className="h-full bg-muted/60"
                initial={{ width: "0%" }}
                animate={{ width: `${dotPct}%` }}
                transition={{ delay: i * 0.06, duration: 0.5, ease: "easeOut" }}
              />
              <motion.div
                className="h-full bg-blue-500/60"
                initial={{ width: "0%" }}
                animate={{ width: `${otherPct}%` }}
                transition={{ delay: i * 0.06 + 0.05, duration: 0.5, ease: "easeOut" }}
              />
              <motion.div
                className="h-full bg-emerald-500/70"
                initial={{ width: "0%" }}
                animate={{ width: `${fourPct}%` }}
                transition={{ delay: i * 0.06 + 0.1, duration: 0.5, ease: "easeOut" }}
              />
              <motion.div
                className="h-full bg-amber-500/70"
                initial={{ width: "0%" }}
                animate={{ width: `${sixPct}%` }}
                transition={{ delay: i * 0.06 + 0.15, duration: 0.5, ease: "easeOut" }}
              />
            </div>
            <div className="flex items-center gap-3 text-[9px] text-muted-foreground">
              <span>{b.dots}d</span>
              <span>{b.fours}×4</span>
              <span>{b.sixes}×6</span>
              <span>{b.other} other</span>
              <span className="ml-auto">{b.total} balls</span>
            </div>
          </div>
        )
      })}
    </>
  )
}

// ─── BatsmanBreakdownChart ────────────────────────────────────────────────────

export function BatsmanBreakdownChart({ innings, teamNames }: BatsmanBreakdownChartProps) {
  const inningsData = innings.map((inn) =>
    inn.battingCard
      .filter((b) => b.balls >= 5 && b.runs > 0)
      .map((b) => ({
        name: b.playerName,
        runs: b.runs,
        dots: b.dots,
        fours: b.fours,
        sixes: b.sixes,
        other: Math.max(0, b.balls - b.dots - b.fours - b.sixes),
        total: b.balls,
      }))
  )

  if (!inningsData.some((d) => d.length > 0)) {
    return <p className="text-xs text-muted-foreground text-center py-4">No data</p>
  }

  return (
    <div className="w-full space-y-5">
      {inningsData.map((batsmen, idx) => {
        if (batsmen.length === 0) return null
        const teamName = teamNames[idx] ?? `Innings ${idx + 1}`

        return (
          <div key={idx} className="space-y-2">
            {innings.length > 1 && (
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {teamName}
              </p>
            )}

            <div className="flex items-center gap-3 text-[9px] text-muted-foreground mb-1">
              <span className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-sm bg-muted/60" />Dot
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-sm bg-blue-500/60" />Other
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-sm bg-emerald-500/70" />4s
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-sm bg-amber-500/70" />6s
              </span>
            </div>

            <InningsBarsSection batsmen={batsmen} />
          </div>
        )
      })}
    </div>
  )
}

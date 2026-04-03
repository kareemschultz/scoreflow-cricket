import { motion } from "framer-motion"
import type { Innings, DismissalType } from "@/types/cricket"
import { DISMISSAL_LABELS, WICKET_DISMISSALS } from "@/types/cricket"

// ─── Types ────────────────────────────────────────────────────────────────────

interface DismissalChartProps {
  innings: Innings[]
  teamNames: string[]
}

// ─── DismissalChart ───────────────────────────────────────────────────────────

export function DismissalChart({ innings, teamNames }: DismissalChartProps) {
  // Build counts per innings
  const inningsData = innings.map((inn) => {
    const counts = new Map<DismissalType, number>()
    for (const batsman of inn.battingCard) {
      if (batsman.dismissalType && WICKET_DISMISSALS.includes(batsman.dismissalType)) {
        counts.set(batsman.dismissalType, (counts.get(batsman.dismissalType) ?? 0) + 1)
      }
    }
    const total = Array.from(counts.values()).reduce((s, v) => s + v, 0)
    const sorted = Array.from(counts.entries())
      .sort(([, a], [, b]) => b - a)
    return { counts, total, sorted }
  })

  const hasAnyData = inningsData.some((d) => d.total > 0)

  if (!hasAnyData) {
    return <p className="text-xs text-muted-foreground text-center py-4">No data</p>
  }

  return (
    <div className="w-full space-y-5">
      {inningsData.map((data, idx) => {
        if (data.total === 0) return null
        const teamName = teamNames[idx] ?? `Innings ${idx + 1}`

        return (
          <div key={idx} className="space-y-2">
            {innings.length > 1 && (
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {teamName}
              </p>
            )}

            {data.sorted.map(([type, count], i) => {
              const pct = data.total > 0 ? (count / data.total) * 100 : 0
              return (
                <div key={type} className="space-y-0.5">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-foreground/80">{DISMISSAL_LABELS[type]}</span>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="font-semibold tabular-nums">{count}</span>
                      <span className="text-muted-foreground tabular-nums">{pct.toFixed(0)}%</span>
                    </div>
                  </div>
                  <div className="h-2.5 bg-muted/40 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-primary/70"
                      initial={{ width: "0%" }}
                      animate={{ width: `${pct}%` }}
                      transition={{ delay: i * 0.08, duration: 0.6, ease: "easeOut" }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

import { motion } from "framer-motion"
import type { Innings } from "@/types/cricket"

// ─── Types ────────────────────────────────────────────────────────────────────

interface BowlerDotBallChartProps {
  innings: Innings[]
  teamNames: string[]
}

// ─── BowlerDotBallChart ───────────────────────────────────────────────────────

export function BowlerDotBallChart({ innings, teamNames }: BowlerDotBallChartProps) {
  const inningsData = innings.map((inn) => {
    const bowlers = inn.bowlingCard
      .filter((b) => b.legalDeliveries >= 6)
      .map((b) => ({
        name: b.playerName,
        dotPct: b.legalDeliveries > 0 ? (b.dots / b.legalDeliveries) * 100 : 0,
        dots: b.dots,
        legalDeliveries: b.legalDeliveries,
      }))
      .sort((a, b) => b.dotPct - a.dotPct)
    return bowlers
  })

  const hasAnyData = inningsData.some((d) => d.length > 0)

  if (!hasAnyData) {
    return <p className="text-xs text-muted-foreground text-center py-4">No data</p>
  }

  return (
    <div className="w-full space-y-5">
      {inningsData.map((bowlers, idx) => {
        if (bowlers.length === 0) return null
        const teamName = teamNames[idx] ?? `Innings ${idx + 1}`

        return (
          <div key={idx} className="space-y-2">
            {innings.length > 1 && (
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {teamName} bowling
              </p>
            )}

            {bowlers.map((b, i) => (
              <div key={b.name} className="space-y-0.5">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-foreground/80 truncate max-w-[160px]">{b.name}</span>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="font-semibold tabular-nums">{b.dotPct.toFixed(1)}%</span>
                    <span className="text-muted-foreground tabular-nums">
                      {b.dots}/{b.legalDeliveries}
                    </span>
                  </div>
                </div>
                <div className="h-2.5 bg-muted/40 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-violet-500/70"
                    initial={{ width: "0%" }}
                    animate={{ width: `${b.dotPct}%` }}
                    transition={{ delay: i * 0.08, duration: 0.6, ease: "easeOut" }}
                  />
                </div>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

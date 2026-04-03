import { motion } from "framer-motion"
import type { Innings } from "@/types/cricket"

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExtrasChartProps {
  innings: Innings[]
  teamNames: string[]
}

type ExtraRow = {
  key: "wide" | "noBall" | "bye" | "legBye"
  label: string
  colorClass: string
}

const EXTRA_ROWS: ExtraRow[] = [
  { key: "wide", label: "Wide", colorClass: "bg-rose-500/60" },
  { key: "noBall", label: "No-ball", colorClass: "bg-orange-500/60" },
  { key: "bye", label: "Bye", colorClass: "bg-blue-500/60" },
  { key: "legBye", label: "Leg-bye", colorClass: "bg-teal-500/60" },
]

// ─── ExtrasChart ──────────────────────────────────────────────────────────────

export function ExtrasChart({ innings, teamNames }: ExtrasChartProps) {
  // Determine which extra types have any value across all innings
  const activeRows = EXTRA_ROWS.filter((row) =>
    innings.some((inn) => inn.extras[row.key] > 0)
  )

  // Scale relative to global max
  const globalMax = Math.max(
    ...innings.flatMap((inn) => activeRows.map((row) => inn.extras[row.key])),
    1,
  )

  if (activeRows.length === 0 || innings.length === 0) {
    return <p className="text-xs text-muted-foreground text-center py-4">No data</p>
  }

  return (
    <div className="w-full space-y-5">
      {innings.map((inn, idx) => {
        const teamName = teamNames[idx] ?? `Innings ${idx + 1}`

        return (
          <div key={idx} className="space-y-2">
            {innings.length > 1 && (
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {teamName}
              </p>
            )}

            {activeRows.map((row, i) => {
              const value = inn.extras[row.key]
              const barPct = (value / globalMax) * 100

              return (
                <div key={row.key} className="space-y-0.5">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-foreground/80">{row.label}</span>
                    <span className="font-semibold tabular-nums shrink-0 ml-2">{value}</span>
                  </div>
                  <div className="h-2.5 bg-muted/40 rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${row.colorClass}`}
                      initial={{ width: "0%" }}
                      animate={{ width: `${barPct}%` }}
                      transition={{ delay: (idx * activeRows.length + i) * 0.06, duration: 0.55, ease: "easeOut" }}
                    />
                  </div>
                </div>
              )
            })}

            <div className="text-[9px] text-muted-foreground text-right">
              Total extras: {inn.extras.total}
            </div>
          </div>
        )
      })}
    </div>
  )
}

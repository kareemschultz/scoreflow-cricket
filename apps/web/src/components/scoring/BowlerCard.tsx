import type { BowlerEntry } from "@/types/cricket"

interface BowlerCardProps {
  bowler: BowlerEntry
  isCaptain?: boolean
}

export function BowlerCard({ bowler, isCaptain }: BowlerCardProps) {
  const figures = `${bowler.overs}.${bowler.balls}-${bowler.maidens}-${bowler.runs}-${bowler.wickets}`
  const eco = bowler.economy.toFixed(2)

  const nameParts = bowler.playerName.split(" ")
  const displayName =
    nameParts.length > 1
      ? `${nameParts[0][0]}. ${nameParts.slice(1).join(" ")}`
      : bowler.playerName

  return (
    <div className="px-3 py-1.5 flex items-center justify-between gap-2 border-b border-border/50 bg-muted/20">
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">Bowling:</span>
        <span className="text-sm font-semibold text-foreground">
          {displayName}
          {isCaptain && <span className="text-muted-foreground text-[10px] font-normal ml-0.5">(c)</span>}
        </span>
      </div>
      <div className="flex items-center gap-2 text-xs tabular-nums text-muted-foreground">
        <span className="font-mono text-foreground/80">{figures}</span>
        <span>
          Eco: <span className="text-foreground font-medium">{eco}</span>
        </span>
      </div>
    </div>
  )
}

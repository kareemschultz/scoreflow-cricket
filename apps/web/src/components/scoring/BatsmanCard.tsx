import { cn } from "@workspace/ui/lib/utils"
import type { BatsmanEntry } from "@/types/cricket"

interface BatsmanCardProps {
  batsman: BatsmanEntry
  isOnStrike: boolean
  onSwapStrike?: () => void
  isCaptain?: boolean
}

export function BatsmanCard({ batsman, isOnStrike, onSwapStrike, isCaptain }: BatsmanCardProps) {
  const sr = batsman.strikeRate.toFixed(1)
  const nameParts = batsman.playerName.split(" ")
  const displayName =
    nameParts.length > 1
      ? `${nameParts[0][0]}. ${nameParts.slice(1).join(" ")}`
      : batsman.playerName

  return (
    <button
      className={cn(
        "w-full text-left px-3 py-2 flex items-center justify-between gap-2 transition-colors",
        "border-b border-border/50 last:border-b-0",
        isOnStrike
          ? "bg-primary/8 hover:bg-primary/12"
          : "bg-transparent hover:bg-muted/30",
        !onSwapStrike && "pointer-events-none"
      )}
      onClick={onSwapStrike}
      disabled={!onSwapStrike}
      aria-label={isOnStrike ? `${batsman.playerName} on strike — tap to swap` : batsman.playerName}
    >
      {/* Name + strike indicator */}
      <div className="flex items-center gap-1.5 min-w-0">
        {isOnStrike && (
          <span className="text-cricket-six text-sm leading-none shrink-0" aria-hidden>
            ★
          </span>
        )}
        <span
          className={cn(
            "text-sm font-semibold truncate",
            isOnStrike ? "text-foreground" : "text-muted-foreground"
          )}
        >
          {displayName}
          {isOnStrike && (
            <span className="text-muted-foreground font-normal ml-0.5">*</span>
          )}
          {isCaptain && <span className="text-muted-foreground text-[10px] font-normal ml-0.5">(c)</span>}
        </span>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3 shrink-0 text-xs tabular-nums">
        <span className={cn("font-bold text-sm", isOnStrike ? "text-foreground" : "text-muted-foreground")}>
          {batsman.runs}
          <span className="text-muted-foreground font-normal text-[11px] ml-0.5">
            ({batsman.balls})
          </span>
        </span>
        <span className="text-muted-foreground hidden xs:block">
          SR: <span className="text-foreground/80">{sr}</span>
        </span>
        <span className="text-muted-foreground">
          4s: <span className="text-cricket-boundary font-medium">{batsman.fours}</span>
        </span>
        <span className="text-muted-foreground">
          6s: <span className="text-cricket-six font-medium">{batsman.sixes}</span>
        </span>
      </div>
    </button>
  )
}

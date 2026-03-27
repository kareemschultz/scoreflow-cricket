import { motion } from "framer-motion"
import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"

interface ScoreHeaderProps {
  battingTeamName: string
  score: string
  overs: string
  crr: string
  rrr?: string
  target?: number
  needed?: number
  ballsRemaining?: number
  isPowerplay: boolean
  powerplayOversTotal: number
  currentOver: number
}

export function ScoreHeader({
  battingTeamName,
  score,
  overs,
  crr,
  rrr,
  target,
  needed,
  ballsRemaining,
  isPowerplay,
  powerplayOversTotal,
  currentOver,
}: ScoreHeaderProps) {
  return (
    <div className="bg-card border-b border-border px-3 py-2.5">
      {/* Top row: team + score + powerplay badge */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-xs font-medium text-muted-foreground truncate max-w-[120px]">
              {battingTeamName}
            </span>
            <motion.span
              key={score}
              className="text-2xl font-bold tracking-tight tabular-nums leading-none"
              initial={{ scale: 1.2, opacity: 0.7 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
            >
              {score}
            </motion.span>
            <span className="text-sm text-muted-foreground font-medium">
              {overs}
            </span>
          </div>
        </div>
        {isPowerplay && (
          <Badge
            className={cn(
              "shrink-0 bg-cricket-powerplay/20 text-cricket-powerplay border-cricket-powerplay/40",
              "animate-pulse text-[10px] font-bold px-2 py-0.5 h-auto"
            )}
            variant="outline"
          >
            POWERPLAY
            <span className="text-[9px] ml-1 opacity-70">
              ({currentOver + 1}/{powerplayOversTotal})
            </span>
          </Badge>
        )}
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
        <span>
          CRR: <span className="text-foreground font-semibold tabular-nums">{crr}</span>
        </span>
        {rrr !== undefined && (
          <>
            <span className="text-border">|</span>
            <span>
              RRR:{" "}
              <span
                className={cn(
                  "font-semibold tabular-nums",
                  parseFloat(rrr) > parseFloat(crr) ? "text-cricket-wicket" : "text-cricket-boundary"
                )}
              >
                {rrr}
              </span>
            </span>
          </>
        )}
      </div>

      {/* Target row (2nd innings only) */}
      {target !== undefined && needed !== undefined && ballsRemaining !== undefined && (
        <div className="mt-1 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Target: {target}</span>
          <span className="mx-1.5 text-border">•</span>
          <span>
            Need{" "}
            <span className="font-semibold text-foreground">{needed}</span> off{" "}
            <span className="font-semibold text-foreground">{ballsRemaining}</span> ball
            {ballsRemaining !== 1 ? "s" : ""}
          </span>
        </div>
      )}
    </div>
  )
}

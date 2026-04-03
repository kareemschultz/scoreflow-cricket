import { cn } from "@workspace/ui/lib/utils"
import type { Ball, BowlerEntry } from "@/types/cricket"

interface OverDisplayProps {
  balls: Ball[]
  lastOverSummary: string
  currentBowler?: BowlerEntry
}

interface BallCircleProps {
  token: string
}

function getBallToken(ball: Ball): string {
  if (ball.isWicket) return "W"
  if (ball.extraType === "wide") return "Wd"
  if (ball.extraType === "noBall") return "NB"
  if (ball.overthrows) return "OT"
  if (ball.runs === 4) return "4"
  if (ball.runs === 6) return "6"
  if (ball.runs === 0) return "•"
  return String(ball.runs)
}

function BallCircle({ token, ball }: BallCircleProps & { ball?: Ball }) {
  const isOT = ball?.overthrows && ball.overthrows > 0

  const styles: Record<string, string> = {
    W: "bg-cricket-wicket/20 border-cricket-wicket text-cricket-wicket font-bold",
    "4": "bg-cricket-boundary/20 border-cricket-boundary text-cricket-boundary font-bold",
    "6": "bg-cricket-six/20 border-cricket-six text-cricket-six font-bold",
    "1": "bg-emerald-500/15 border-emerald-500/50 text-emerald-400 font-medium",
    "2": "bg-emerald-500/20 border-emerald-600/50 text-emerald-300 font-medium",
    "3": "bg-teal-500/20 border-teal-500/60 text-teal-300 font-medium",
    Wd: "bg-cricket-wide/20 border-cricket-wide text-cricket-wide font-semibold",
    NB: "bg-cricket-noball/20 border-cricket-noball text-cricket-noball font-semibold",
    "•": "bg-cricket-dot/10 border-cricket-dot/40 text-muted-foreground",
    OT: "bg-amber-500/20 border-amber-500 text-amber-600 dark:text-amber-400 font-bold",
  }

  const cls = isOT
    ? styles.OT
    : styles[token] ?? "bg-muted/50 border-border text-foreground/80 font-medium"

  const tokenTitle: Record<string, string> = {
    W: "Wicket",
    "4": "Boundary — 4 runs",
    "6": "Six — 6 runs",
    Wd: "Wide",
    NB: "No Ball",
    "•": "Dot ball — no run",
    OT: `${ball?.runs ?? 0} runs (overthrow)`,
  }
  const titleText = isOT
    ? tokenTitle.OT
    : tokenTitle[token] ?? `${token} run${token === "1" ? "" : "s"}`

  return (
    <div
      className={cn(
        "size-8 rounded-full border flex items-center justify-center text-[11px] shrink-0 select-none",
        cls
      )}
      title={titleText}
    >
      {token}
    </div>
  )
}

export function OverDisplay({ balls, lastOverSummary, currentBowler }: OverDisplayProps) {
  return (
    <div className="px-3 py-2 border-b border-border/50">
      {/* Current over balls */}
      <div className="flex items-center gap-1.5 min-h-[2rem]">
        <span className="text-[10px] text-muted-foreground font-medium mr-1 shrink-0">This over:</span>
        {balls.length === 0 && !currentBowler ? (
          <span className="text-xs text-muted-foreground/60 italic">New over</span>
        ) : (
          balls.map((ball, idx) => (
            <BallCircle key={ball.id ?? idx} token={getBallToken(ball)} ball={ball} />
          ))
        )}
      </div>

      {/* Last over summary */}
      {lastOverSummary && (
        <div className="mt-1 text-[10px] text-muted-foreground">
          Last over:{" "}
          <span className="font-mono text-foreground/60">{lastOverSummary}</span>
        </div>
      )}
    </div>
  )
}

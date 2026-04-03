import { useMemo } from "react"
import type { Innings } from "@/types/cricket"
import { rebuildInningsFromBallLog } from "@/lib/scoring-transitions"
import { formatOvers } from "@/lib/cricket-engine"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"

interface UndoPreviewDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: (steps: number) => void
  innings: Innings
  ballsPerOver: number
}

interface UndoStepPreview {
  steps: number
  totalRuns: number
  totalWickets: number
  totalLegalDeliveries: number
}

function buildPreviews(innings: Innings, ballsPerOver: number): UndoStepPreview[] {
  const previews: UndoStepPreview[] = []
  for (let n = 1; n <= 3; n++) {
    if (innings.ballLog.length < n) break
    // Deep-clone only the fields rebuildInningsFromBallLog mutates
    const clone: Innings = {
      ...innings,
      ballLog: innings.ballLog.slice(0, innings.ballLog.length - n),
      battingCard: innings.battingCard.map((e) => ({ ...e })),
      bowlingCard: innings.bowlingCard.map((e) => ({ ...e })),
      extras: { ...innings.extras },
      fallOfWickets: [...innings.fallOfWickets],
      partnerships: [...innings.partnerships],
    }
    rebuildInningsFromBallLog(clone, ballsPerOver)
    previews.push({
      steps: n,
      totalRuns: clone.totalRuns,
      totalWickets: clone.totalWickets,
      totalLegalDeliveries: clone.totalLegalDeliveries,
    })
  }
  return previews
}

export function UndoPreviewDialog({
  open,
  onClose,
  onConfirm,
  innings,
  ballsPerOver,
}: UndoPreviewDialogProps) {
  const previews = useMemo(
    () => buildPreviews(innings, ballsPerOver),
    // Re-run only when ball count or ballsPerOver changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [innings.ballLog.length, ballsPerOver]
  )

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose() }} modal={true}>
      <SheetContent side="bottom" showCloseButton={false} className="rounded-t-2xl pb-safe">
        <SheetHeader className="pb-3 pt-5 px-4">
          <div className="w-10 h-1.5 bg-muted-foreground/30 rounded-full mx-auto mb-3" />
          <SheetTitle className="text-center">Undo Balls</SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-6 space-y-2">
          {previews.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No balls to undo.</p>
          ) : (
            previews.map((p) => (
              <button
                key={p.steps}
                onClick={() => { onConfirm(p.steps); onClose() }}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-border hover:bg-muted/60 active:bg-muted transition-colors text-left"
              >
                <span className="text-sm font-medium">
                  Undo {p.steps} ball{p.steps > 1 ? "s" : ""}
                </span>
                <span className="text-sm font-mono text-muted-foreground">
                  {p.totalRuns}/{p.totalWickets}
                  <span className="text-xs ml-1">
                    ({formatOvers(p.totalLegalDeliveries, ballsPerOver)} ov)
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

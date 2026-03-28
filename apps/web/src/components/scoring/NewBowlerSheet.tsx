import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { cn } from "@workspace/ui/lib/utils"
import type { Player } from "@/types/cricket"

interface BowlerOption {
  player: Player
  oversBowled: number
  maxOvers: number | null
  isDisabled: boolean
}

interface NewBowlerSheetProps {
  open: boolean
  bowlers: BowlerOption[]
  onSelect: (playerId: string) => void
  overSummary?: string
}

export function NewBowlerSheet({ open, bowlers, onSelect, overSummary }: NewBowlerSheetProps) {
  return (
    <Sheet open={open}>
      <SheetContent side="bottom" showCloseButton={false} className="rounded-t-2xl max-h-[70dvh]">
        <SheetHeader className="pb-2 pt-4 px-4">
          <SheetTitle className="text-center">Select Next Bowler</SheetTitle>
          <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto mt-2" />
          {overSummary && (
            <p className="text-xs text-muted-foreground text-center mt-1 font-mono">
              Last over: {overSummary}
            </p>
          )}
        </SheetHeader>

        <div className="overflow-y-auto pb-8 px-2">
          {bowlers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No bowlers available
            </p>
          ) : (
            <div className="space-y-1">
              {bowlers.map(({ player, oversBowled, maxOvers, isDisabled }) => {
                const oversLabel =
                  maxOvers !== null
                    ? `${oversBowled}/${maxOvers} overs`
                    : `${oversBowled} over${oversBowled !== 1 ? "s" : ""}`

                return (
                  <button
                    key={player.id}
                    disabled={isDisabled}
                    onClick={() => onSelect(player.id)}
                    className={cn(
                      "w-full flex items-center justify-between px-4 py-3 rounded-xl transition-colors text-left",
                      isDisabled
                        ? "opacity-40 cursor-not-allowed bg-transparent"
                        : "hover:bg-primary/10 active:bg-primary/15 cursor-pointer"
                    )}
                  >
                    <span className={cn("text-sm font-medium", isDisabled ? "text-muted-foreground" : "text-foreground")}>
                      {player.name}
                    </span>
                    <span className={cn(
                      "text-xs tabular-nums",
                      isDisabled ? "text-muted-foreground/50" : "text-muted-foreground"
                    )}>
                      {oversLabel}
                      {maxOvers !== null && oversBowled >= maxOvers && (
                        <span className="ml-1 text-cricket-wicket">(max)</span>
                      )}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

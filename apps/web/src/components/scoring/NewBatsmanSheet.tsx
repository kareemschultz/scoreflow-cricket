import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import type { Player } from "@/types/cricket"

interface NewBatsmanSheetProps {
  open: boolean
  onClose?: () => void
  availableBatsmen: Player[]
  onSelect: (playerId: string) => void
}

export function NewBatsmanSheet({ open, onClose, availableBatsmen, onSelect }: NewBatsmanSheetProps) {
  return (
    <Sheet open={open} onOpenChange={(isOpen) => { if (!isOpen && onClose) onClose() }}>
      <SheetContent side="bottom" showCloseButton={false} className="rounded-t-2xl max-h-[70dvh] pb-safe">
        <SheetHeader className="pb-3 pt-5 px-4">
          <div className="w-10 h-1.5 bg-muted-foreground/30 rounded-full mx-auto mb-3" />
          <SheetTitle className="text-center text-base">Select Incoming Batsman</SheetTitle>
        </SheetHeader>

        <div className="overflow-y-auto pb-8 px-2">
          {availableBatsmen.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              All out — no batsmen remaining
            </p>
          ) : (
            <div className="space-y-1">
              {availableBatsmen.map((player, i) => (
                <button
                  key={player.id}
                  onClick={() => onSelect(player.id)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-primary/10 active:bg-primary/15 transition-colors text-left"
                >
                  <span className="flex items-center justify-center size-7 rounded-full bg-muted text-xs font-bold text-muted-foreground shrink-0">
                    {i + 3}
                  </span>
                  <span className="text-sm font-medium text-foreground">{player.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

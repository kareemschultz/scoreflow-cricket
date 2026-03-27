import { motion } from "framer-motion"
import type { BatsmanEntry, ExtrasBreakdown } from "@/types/cricket"

const rowVariants = {
  hidden: { opacity: 0, x: -8 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { duration: 0.18, delay: i * 0.04, ease: "easeOut" as const },
  }),
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface BattingCardProps {
  battingCard: BatsmanEntry[]
  extras: ExtrasBreakdown
  totalRuns: number
  totalWickets: number
  oversStr: string
  captainId?: string
  wicketKeeperId?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtSR(sr: number): string {
  return isFinite(sr) ? sr.toFixed(1) : "—"
}

function extrasLabel(e: ExtrasBreakdown): string {
  const parts: string[] = []
  if (e.wide > 0) parts.push(`W:${e.wide}`)
  if (e.noBall > 0) parts.push(`NB:${e.noBall}`)
  if (e.bye > 0) parts.push(`B:${e.bye}`)
  if (e.legBye > 0) parts.push(`LB:${e.legBye}`)
  if (e.penalty > 0) parts.push(`P:${e.penalty}`)
  return parts.length ? `(${parts.join(" ")})` : ""
}

// ─── BattingCard ──────────────────────────────────────────────────────────────

function getRoleSuffix(playerId: string, captainId?: string, wicketKeeperId?: string): string {
  const isCap = playerId === captainId
  const isWk = playerId === wicketKeeperId
  if (isCap && isWk) return " (c)(wk)"
  if (isCap) return " (c)"
  if (isWk) return " (wk)"
  return ""
}

export function BattingCard({ battingCard, extras, totalRuns, totalWickets, oversStr, captainId, wicketKeeperId }: BattingCardProps) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-xs min-w-[340px]">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-1.5 px-2 text-muted-foreground font-medium w-full">Batsman</th>
            <th className="text-left py-1.5 px-2 text-muted-foreground font-medium whitespace-nowrap">Dismissal</th>
            <th className="text-right py-1.5 px-2 text-muted-foreground font-medium">R</th>
            <th className="text-right py-1.5 px-2 text-muted-foreground font-medium">B</th>
            <th className="text-right py-1.5 px-2 text-muted-foreground font-medium">4s</th>
            <th className="text-right py-1.5 px-2 text-muted-foreground font-medium">6s</th>
            <th className="text-right py-1.5 px-2 text-muted-foreground font-medium">SR</th>
          </tr>
        </thead>
        <tbody>
          {battingCard.map((b, i) => (
            <motion.tr
              key={b.playerId}
              custom={i}
              variants={rowVariants}
              initial="hidden"
              animate="visible"
              className="border-b border-border/40 hover:bg-muted/30 transition-colors"
            >
              <td className="py-1.5 px-2">
                {!b.isOut && !b.isRetiredHurt ? (
                  <span className="font-semibold">
                    {b.playerName}*
                    <span className="font-normal text-muted-foreground">{getRoleSuffix(b.playerId, captainId, wicketKeeperId)}</span>
                  </span>
                ) : (
                  <span>
                    {b.playerName}
                    <span className="text-muted-foreground">{getRoleSuffix(b.playerId, captainId, wicketKeeperId)}</span>
                  </span>
                )}
              </td>
              <td className="py-1.5 px-2 text-muted-foreground whitespace-nowrap max-w-[140px] truncate">
                {b.dismissalText || "not out"}
              </td>
              <td className="py-1.5 px-2 text-right font-semibold tabular-nums">{b.runs}</td>
              <td className="py-1.5 px-2 text-right text-muted-foreground tabular-nums">{b.balls}</td>
              <td className="py-1.5 px-2 text-right text-muted-foreground tabular-nums">{b.fours}</td>
              <td className="py-1.5 px-2 text-right text-muted-foreground tabular-nums">{b.sixes}</td>
              <td className="py-1.5 px-2 text-right text-muted-foreground tabular-nums">{fmtSR(b.strikeRate)}</td>
            </motion.tr>
          ))}

          {/* Extras row */}
          <tr className="border-b border-border/40">
            <td className="py-1.5 px-2 text-muted-foreground italic" colSpan={2}>
              Extras {extrasLabel(extras)}
            </td>
            <td className="py-1.5 px-2 text-right font-semibold tabular-nums" colSpan={5}>
              {extras.total}
            </td>
          </tr>

          {/* Total row */}
          <tr className="bg-muted/20">
            <td className="py-2 px-2 font-semibold" colSpan={7}>
              Total: {totalRuns}/{totalWickets}
              <span className="text-muted-foreground font-normal ml-1.5">({oversStr} ov)</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

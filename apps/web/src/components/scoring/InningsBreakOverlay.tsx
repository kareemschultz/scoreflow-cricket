import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@workspace/ui/components/button"

interface InningsBreakOverlayProps {
  open: boolean
  completedInnings: {
    battingTeamName: string
    totalRuns: number
    totalWickets: number
    oversStr: string
  }
  targetTeamName: string
  target: number
  onStartInnings: () => void
}

export function InningsBreakOverlay({
  open,
  completedInnings,
  targetTeamName,
  target,
  onStartInnings,
}: InningsBreakOverlayProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex flex-col items-center justify-between py-safe"
          style={{ backgroundColor: "#0f172a" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          {/* Rotating cricket ball SVG (background watermark) */}
          <motion.svg
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.05] pointer-events-none"
            width="320"
            height="320"
            viewBox="0 0 40 40"
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
            aria-hidden
          >
            <circle cx="20" cy="20" r="18" fill="#ef4444" />
            <path d="M4 20 Q12 12 20 20 Q28 28 36 20" stroke="white" strokeWidth="1.5" fill="none" />
            <path d="M4 20 Q12 28 20 20 Q28 12 36 20" stroke="white" strokeWidth="1.5" fill="none" />
          </motion.svg>

          {/* Top label */}
          <motion.div
            className="w-full flex items-center justify-center pt-12"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.35 }}
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-slate-500">
              Innings Break
            </p>
          </motion.div>

          {/* Scorecard summary box */}
          <motion.div
            className="relative z-10 w-full max-w-sm mx-4 flex flex-col gap-4 px-6 py-7 rounded-2xl border border-slate-700/60 bg-slate-800/70 backdrop-blur-sm"
            initial={{ x: 80, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.18, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Batting team name */}
            <motion.p
              className="text-sm font-semibold text-slate-300 tracking-wide"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.28 }}
            >
              {completedInnings.battingTeamName}
            </motion.p>

            {/* Big score */}
            <motion.div
              className="flex items-baseline gap-3"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.32, type: "spring", stiffness: 200, damping: 22 }}
            >
              <span className="text-[52px] font-black leading-none text-white tabular-nums">
                {completedInnings.totalRuns}/{completedInnings.totalWickets}
              </span>
              <span className="text-base text-slate-400 font-medium">
                ({completedInnings.oversStr} ov)
              </span>
            </motion.div>

            {/* Separator */}
            <div className="w-full h-px bg-slate-700/70" />

            {/* Target line */}
            <motion.p
              className="text-base font-semibold text-sky-400 leading-snug"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.42 }}
            >
              {targetTeamName} need{" "}
              <span className="text-sky-300 font-black">{target}</span> to win
            </motion.p>
          </motion.div>

          {/* Bottom CTA */}
          <motion.div
            className="w-full max-w-sm mx-4 pb-12 px-4"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.35 }}
          >
            <Button
              className="w-full h-14 text-base font-bold gap-2 bg-sky-500 hover:bg-sky-400 text-black border-0"
              onClick={onStartInnings}
            >
              Start 2nd Innings →
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

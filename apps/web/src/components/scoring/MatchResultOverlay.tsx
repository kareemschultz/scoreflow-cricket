import { motion, AnimatePresence } from "framer-motion"
import { ArrowRight } from "lucide-react"
import { Button } from "@workspace/ui/components/button"

interface MatchResultOverlayProps {
  open: boolean
  result: string
  winner: string | undefined
  winnerIsFirstTeam: boolean
  team1Name: string
  team2Name: string
  onViewScorecard: () => void
}

const CONFETTI_COLORS = [
  "bg-emerald-400",
  "bg-amber-400",
  "bg-blue-400",
  "bg-violet-400",
  "bg-rose-400",
]

const CONFETTI_PARTICLES = Array.from({ length: 40 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  delay: Math.random() * 2,
  duration: 2 + Math.random() * 2,
  rotation: Math.random() * 60 - 30,
  opacity: 0.5 + Math.random() * 0.5,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
}))

export function MatchResultOverlay({
  open,
  result,
  winner,
  onViewScorecard,
}: MatchResultOverlayProps) {
  const isTie = winner === "tie" || winner === undefined

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          {/* Dark overlay */}
          <div className="absolute inset-0 bg-black/80" />

          {/* Radial gradient glow */}
          <motion.div
            className={`absolute inset-0 ${isTie ? "bg-amber-500/10" : "bg-emerald-500/10"}`}
            style={{
              background: isTie
                ? "radial-gradient(ellipse at center, rgba(245,158,11,0.18) 0%, transparent 70%)"
                : "radial-gradient(ellipse at center, rgba(16,185,129,0.18) 0%, transparent 70%)",
            }}
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* Confetti particles */}
          {!isTie &&
            CONFETTI_PARTICLES.map((p) => (
              <motion.div
                key={p.id}
                className={`absolute w-[2px] h-[6px] rounded-sm ${p.color}`}
                style={{
                  left: `${p.x}%`,
                  top: 0,
                  opacity: p.opacity,
                  rotate: p.rotation,
                }}
                animate={{ y: ["-10vh", "110vh"] }}
                transition={{
                  duration: p.duration,
                  delay: p.delay,
                  repeat: Infinity,
                  ease: "linear",
                }}
              />
            ))}

          {/* Content card */}
          <motion.div
            className="relative z-10 w-full max-w-sm mx-4 flex flex-col items-center gap-5 px-6 py-8"
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Trophy / handshake */}
            <div className="relative flex items-center justify-center">
              {/* Pulsing glow ring */}
              <motion.div
                className={`absolute w-24 h-24 rounded-full ${isTie ? "bg-amber-400/20" : "bg-emerald-400/20"}`}
                animate={{ scale: [1, 1.35, 1], opacity: [0.5, 0.15, 0.5] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.span
                className="text-7xl select-none relative z-10"
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
              >
                {isTie ? "🤝" : "🏆"}
              </motion.span>
            </div>

            {/* Label */}
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
              Match Result
            </p>

            {/* Winner name */}
            <motion.h1
              className={`text-3xl font-black text-center leading-tight ${isTie ? "text-amber-300" : "text-emerald-300"}`}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 300, damping: 20 }}
            >
              {isTie ? "Match Tied!" : winner}
            </motion.h1>

            {/* Result string */}
            <motion.p
              className="text-sm text-white/60 text-center leading-snug"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35 }}
            >
              {result}
            </motion.p>

            {/* Divider */}
            <div className={`w-full h-px ${isTie ? "bg-amber-500/20" : "bg-emerald-500/20"}`} />

            {/* CTA */}
            <motion.div
              className="w-full"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
            >
              <Button
                className={`w-full h-12 text-base font-semibold gap-2 ${
                  isTie
                    ? "bg-amber-500 hover:bg-amber-400 text-black border-0"
                    : "bg-emerald-500 hover:bg-emerald-400 text-black border-0"
                }`}
                onClick={onViewScorecard}
              >
                View Scorecard
                <ArrowRight className="size-4" />
              </Button>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

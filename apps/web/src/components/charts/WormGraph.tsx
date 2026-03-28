import { useRef, useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import type { Ball } from "@/types/cricket"

// ─── Types ────────────────────────────────────────────────────────────────────

interface WormGraphProps {
  innings1Balls: Ball[]
  innings2Balls?: Ball[]
  ballsPerOver: number
  maxOvers: number
  team1Name: string
  team2Name?: string
  target?: number
  height?: number
}

interface WormPoint {
  over: number
  runs: number
  isWicket: boolean
}

interface TooltipState {
  x: number
  y: number
  over: number
  runs1: number
  runs2?: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeWormPoints(balls: Ball[], ballsPerOver: number): WormPoint[] {
  const points: WormPoint[] = [{ over: 0, runs: 0, isWicket: false }]
  let cumRuns = 0
  let legalCount = 0

  for (const ball of balls) {
    cumRuns += ball.runs
    if (ball.isLegal) {
      legalCount++
      const over = legalCount / ballsPerOver
      points.push({ over, runs: cumRuns, isWicket: ball.isWicket })
    }
  }

  return points
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PADDING = { top: 12, right: 8, bottom: 28, left: 28 }

// ─── WormGraph ────────────────────────────────────────────────────────────────

export function WormGraph({
  innings1Balls,
  innings2Balls,
  ballsPerOver,
  maxOvers,
  team1Name,
  team2Name,
  target,
  height = 160,
}: WormGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(320)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w && w > 0) setWidth(w)
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  const chartW = width - PADDING.left - PADDING.right
  const chartH = height - PADDING.top - PADDING.bottom

  const pts1 = computeWormPoints(innings1Balls, ballsPerOver)
  const pts2 = innings2Balls ? computeWormPoints(innings2Balls, ballsPerOver) : []

  const allRuns = [...pts1.map((p) => p.runs), ...pts2.map((p) => p.runs)]
  const maxRuns = Math.max(...allRuns, 1)

  const yTick = maxRuns <= 50 ? 10 : maxRuns <= 100 ? 20 : maxRuns <= 200 ? 50 : 100
  const yMax = Math.ceil(maxRuns / yTick) * yTick

  const toX = (over: number) => (over / maxOvers) * chartW
  const toY = (runs: number) => chartH - (runs / yMax) * chartH

  const pointsToPath = (pts: WormPoint[]) =>
    pts.length === 0
      ? ""
      : pts
          .map((p, i) => `${i === 0 ? "M" : "L"}${toX(p.over).toFixed(1)},${toY(p.runs).toFixed(1)}`)
          .join(" ")

  const yTicks: number[] = []
  for (let v = 0; v <= yMax; v += yTick) yTicks.push(v)

  const xTicks: number[] = []
  for (let i = 0; i <= maxOvers; i += 5) xTicks.push(i)

  const hasSecond = pts2.length > 0

  const path1 = pointsToPath(pts1)
  const path2 = pointsToPath(pts2)

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const svgX = e.clientX - rect.left - PADDING.left
    if (svgX < 0 || svgX > chartW) {
      setTooltip(null)
      return
    }
    const over = (svgX / chartW) * maxOvers
    if (pts1.length < 2) return

    const nearest1 = pts1.reduce((best, p) =>
      Math.abs(p.over - over) < Math.abs(best.over - over) ? p : best
    )
    const nearest2 =
      pts2.length > 1
        ? pts2.reduce((best, p) =>
            Math.abs(p.over - over) < Math.abs(best.over - over) ? p : best
          )
        : null

    setTooltip({
      x: toX(nearest1.over) + PADDING.left,
      y: toY(nearest1.runs) + PADDING.top,
      over: nearest1.over,
      runs1: nearest1.runs,
      runs2: nearest2?.runs,
    })
  }

  return (
    <div ref={containerRef} className="w-full">
      {/* Legend */}
      <div className="flex items-center gap-4 mb-1 px-1">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-0.5 bg-blue-500" />
          <span className="text-[10px] text-muted-foreground truncate">{team1Name}</span>
        </div>
        {hasSecond && (
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-0.5 bg-amber-500" />
            <span className="text-[10px] text-muted-foreground truncate">{team2Name}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 ml-auto">
          <div className="w-2 h-2 rounded-full border border-current" />
          <span className="text-[10px] text-muted-foreground">Wicket</span>
        </div>
      </div>

      <div className="relative">
        <svg
          width={width}
          height={height}
          aria-label="Worm graph"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setTooltip(null)}
        >
          <g transform={`translate(${PADDING.left},${PADDING.top})`}>
            {/* Y grid + labels */}
            {yTicks.map((v) => (
              <g key={v}>
                <line
                  x1={0} x2={chartW} y1={toY(v)} y2={toY(v)}
                  stroke="currentColor" strokeOpacity={0.08} strokeWidth={1}
                />
                <text
                  x={-4} y={toY(v)} textAnchor="end" dominantBaseline="middle"
                  className="fill-muted-foreground" fontSize={8}
                >
                  {v}
                </text>
              </g>
            ))}

            {/* X ticks */}
            {xTicks.map((ov) => (
              <text
                key={ov}
                x={toX(ov)} y={chartH + 12}
                textAnchor="middle" className="fill-muted-foreground" fontSize={8}
              >
                {ov}
              </text>
            ))}
            <text x={chartW / 2} y={chartH + 22} textAnchor="middle" className="fill-muted-foreground" fontSize={7}>
              Overs
            </text>

            {/* Hover crosshair */}
            {tooltip && (
              <>
                <line
                  x1={tooltip.x - PADDING.left}
                  x2={tooltip.x - PADDING.left}
                  y1={0} y2={chartH}
                  stroke="currentColor" strokeOpacity={0.25} strokeWidth={1}
                  strokeDasharray="2 2"
                />
                <circle
                  cx={tooltip.x - PADDING.left}
                  cy={tooltip.y - PADDING.top}
                  r={3.5}
                  fill="rgb(59,130,246)"
                  stroke="white"
                  strokeWidth={1.5}
                />
              </>
            )}

            {/* Innings 2 line (animated path draw) */}
            {pts2.length > 1 && path2 && (
              <>
                <motion.path
                  d={path2}
                  fill="none"
                  stroke="rgb(245,158,11)"
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 0.9 }}
                  transition={{ duration: 1.5, ease: "easeInOut", delay: 0.2 }}
                />
                {pts2
                  .filter((p) => p.isWicket)
                  .map((p, i) => (
                    <motion.circle
                      key={i}
                      cx={toX(p.over)}
                      cy={toY(p.runs)}
                      r={3}
                      fill="rgb(245,158,11)"
                      stroke="white"
                      strokeWidth={1.5}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 1.7, duration: 0.3 }}
                    />
                  ))}
              </>
            )}

            {/* Innings 1 line (animated path draw) */}
            {pts1.length > 1 && path1 && (
              <>
                <motion.path
                  d={path1}
                  fill="none"
                  stroke="rgb(59,130,246)"
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 0.9 }}
                  transition={{ duration: 1.5, ease: "easeInOut" }}
                />
                {pts1
                  .filter((p) => p.isWicket)
                  .map((p, i) => (
                    <motion.circle
                      key={i}
                      cx={toX(p.over)}
                      cy={toY(p.runs)}
                      r={3}
                      fill="rgb(59,130,246)"
                      stroke="white"
                      strokeWidth={1.5}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 1.5, duration: 0.3 }}
                    />
                  ))}
              </>
            )}

            {/* Target line (chase) */}
            {target !== undefined && target <= yMax && (
              <g>
                <line
                  x1={0} x2={chartW}
                  y1={toY(target)} y2={toY(target)}
                  stroke="rgb(251,191,36)"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  strokeOpacity={0.8}
                />
                <text
                  x={chartW + 2}
                  y={toY(target)}
                  dominantBaseline="middle"
                  className="fill-amber-400"
                  fontSize={7}
                  fontWeight={600}
                >
                  {target}
                </text>
              </g>
            )}

            {/* Axes */}
            <line x1={0} x2={0} y1={0} y2={chartH} stroke="currentColor" strokeOpacity={0.2} strokeWidth={1} />
            <line x1={0} x2={chartW} y1={chartH} y2={chartH} stroke="currentColor" strokeOpacity={0.2} strokeWidth={1} />
          </g>
        </svg>

        {/* Tooltip */}
        <AnimatePresence>
          {tooltip && (
            <motion.div
              key="worm-tooltip"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="absolute pointer-events-none z-10 bg-background/95 backdrop-blur-sm border border-border rounded-lg px-2.5 py-2 shadow-lg min-w-[100px]"
              style={{
                left: Math.max(4, Math.min(tooltip.x - 55, width - 116)),
                top: 4,
              }}
            >
              <p className="text-[10px] font-semibold text-foreground mb-1">
                Ov {Math.floor(tooltip.over)}.{Math.round((tooltip.over % 1) * ballsPerOver)}
              </p>
              <div className="flex items-center gap-1.5 text-[10px]">
                <div className="w-3 h-0.5 bg-blue-500 shrink-0" />
                <span className="text-muted-foreground truncate">{team1Name.slice(0, 12)}</span>
                <span className="font-semibold tabular-nums ml-auto pl-1">{tooltip.runs1}</span>
              </div>
              {tooltip.runs2 !== undefined && (
                <div className="flex items-center gap-1.5 text-[10px] mt-0.5">
                  <div className="w-3 h-0.5 bg-amber-500 shrink-0" />
                  <span className="text-muted-foreground truncate">{(team2Name ?? "").slice(0, 12)}</span>
                  <span className="font-semibold tabular-nums ml-auto pl-1">{tooltip.runs2}</span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

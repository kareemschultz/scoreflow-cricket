import { createRootRoute, Link, Outlet, useRouterState } from "@tanstack/react-router"
import { Home, Activity, Clock, BarChart2, Users, Sword, Grid3x3 } from "lucide-react"
import { useLiveQuery } from "dexie-react-hooks"
import { AnimatePresence, motion } from "framer-motion"
import { useEffect, useState } from "react"
import { db } from "@/db/index"
import { cn } from "@workspace/ui/lib/utils"
import { useScoringStore } from "@/stores/scoring"

// ─── Nav config ───────────────────────────────────────────────────────────────

const CRICKET_NAV = [
  { to: "/", label: "Home", icon: Home, exact: true },
  { to: "/scoring", label: "Score", icon: Activity, exact: false },
  { to: "/history", label: "History", icon: Clock, exact: false },
  { to: "/stats", label: "Stats", icon: BarChart2, exact: false },
  { to: "/teams", label: "Teams", icon: Users, exact: false },
] as const

const FIFA_NAV = [
  { to: "/fifa", label: "Home", icon: Home, exact: true },
  { to: "/fifa/matches", label: "Matches", icon: Sword, exact: false },
  { to: "/fifa/players", label: "Players", icon: Users, exact: false },
] as const

// ─── Sports Menu ──────────────────────────────────────────────────────────────

const SPORTS = [
  { id: "cricket", label: "Cricket", emoji: "🏏", path: "/" },
  { id: "football", label: "Football", emoji: "⚽", path: "/fifa" },
  { id: "volleyball", label: "Volleyball", emoji: "🏐", path: null }, // coming soon
] as const

function SportsMenu({ currentPath, onClose }: { currentPath: string; onClose: () => void }) {
  const activeSport = currentPath.startsWith("/fifa") ? "football" : "cricket"
  return (
    <motion.div
      className="absolute bottom-full right-0 mb-2 mr-1 w-44 bg-background border border-border rounded-2xl shadow-xl overflow-hidden"
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
    >
      <div className="p-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2 pt-1 pb-1.5">Switch Sport</p>
        {SPORTS.map((sport) => {
          const isActive = sport.id === activeSport
          const isSoon = sport.path === null
          return isSoon ? (
            <div
              key={sport.id}
              className="flex items-center gap-2.5 px-2 py-2.5 rounded-xl opacity-40 cursor-not-allowed"
            >
              <span className="text-lg leading-none">{sport.emoji}</span>
              <div>
                <p className="text-sm font-medium">{sport.label}</p>
                <p className="text-[10px] text-muted-foreground">Coming soon</p>
              </div>
            </div>
          ) : (
            <Link
              key={sport.id}
              to={sport.path}
              onClick={onClose}
              className={cn(
                "flex items-center gap-2.5 px-2 py-2.5 rounded-xl transition-colors",
                isActive ? "bg-primary/10 text-primary" : "hover:bg-muted/50 text-foreground"
              )}
            >
              <span className="text-lg leading-none">{sport.emoji}</span>
              <div>
                <p className="text-sm font-medium">{sport.label}</p>
                {isActive && <p className="text-[10px] text-primary/70">Active</p>}
              </div>
            </Link>
          )
        })}
      </div>
    </motion.div>
  )
}

// ─── Bottom Nav ───────────────────────────────────────────────────────────────

function BottomNav() {
  const routerState = useRouterState()
  const currentPath = routerState.location.pathname
  const isFifaMode = currentPath.startsWith("/fifa")
  const [sportsOpen, setSportsOpen] = useState(false)

  const liveMatch = useLiveQuery(() =>
    db.matches.where("status").equals("live").first()
  )

  function isActive(to: string, exact: boolean) {
    if (exact) return currentPath === to
    return currentPath.startsWith(to)
  }

  const navItems = isFifaMode ? FIFA_NAV : CRICKET_NAV

  return (
    <nav
      className="border-t border-border bg-background/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom)] relative"
      style={{ position: "sticky", bottom: 0, zIndex: 50 }}
    >
      <AnimatePresence>
        {sportsOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSportsOpen(false)}
            />
            <div className="absolute bottom-full right-0 z-50">
              <SportsMenu currentPath={currentPath} onClose={() => setSportsOpen(false)} />
            </div>
          </>
        )}
      </AnimatePresence>

      <div className="flex items-stretch">
        {(navItems as typeof CRICKET_NAV | typeof FIFA_NAV).map(({ to, label, icon: Icon, exact }: { to: string; label: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; exact: boolean }) => {
          const active = isActive(to, exact)
          const isScore = to === "/scoring"
          const hasLive = isScore && !!liveMatch

          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 min-h-[52px] py-2 px-1 text-xs font-medium transition-colors select-none",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className="relative">
                <Icon
                  className={cn(
                    "size-5",
                    hasLive && !active && "text-emerald-500",
                    hasLive && active && "text-emerald-400"
                  )}
                  strokeWidth={active ? 2.5 : 2}
                />
                {hasLive && (
                  <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-emerald-500 ring-1 ring-background" />
                )}
              </div>
              <span className={cn(hasLive && !active && "text-emerald-500", hasLive && active && "text-emerald-400")}>
                {label}
              </span>
            </Link>
          )
        })}

        {/* Sports switcher */}
        <button
          onClick={() => setSportsOpen((v) => !v)}
          className={cn(
            "flex flex-1 flex-col items-center justify-center gap-1 min-h-[52px] py-2 px-1 text-xs font-medium transition-colors select-none",
            sportsOpen ? "text-primary" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Grid3x3 className="size-5" strokeWidth={sportsOpen ? 2.5 : 2} />
          <span>Sports</span>
        </button>
      </div>
    </nav>
  )
}

// ─── Root Layout ──────────────────────────────────────────────────────────────

function RootLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const { match, loadMatch } = useScoringStore()

  // Rehydrate scoring store from Dexie on app startup if there's a live match
  useEffect(() => {
    if (match) return // already loaded
    db.matches.where("status").equals("live").first().then((liveMatch) => {
      if (liveMatch) loadMatch(liveMatch.id)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col h-dvh bg-background">
      <main className="flex-1 overflow-y-auto pb-safe">
        <AnimatePresence mode="wait">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
      <BottomNav />
    </div>
  )
}

export const Route = createRootRoute({
  component: RootLayout,
})

import { createRootRoute, Link, Outlet, useRouterState } from "@tanstack/react-router"
import { Home, Activity, Clock, BarChart2, Users } from "lucide-react"
import { useLiveQuery } from "dexie-react-hooks"
import { AnimatePresence, motion } from "framer-motion"
import { useEffect } from "react"
import { db } from "@/db/index"
import { cn } from "@workspace/ui/lib/utils"
import { useScoringStore } from "@/stores/scoring"

// ─── Bottom Nav ───────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { to: "/", label: "Home", icon: Home, exact: true },
  { to: "/scoring", label: "Score", icon: Activity, exact: false },
  { to: "/history", label: "History", icon: Clock, exact: false },
  { to: "/stats", label: "Stats", icon: BarChart2, exact: false },
  { to: "/teams", label: "Teams", icon: Users, exact: false },
] as const

function BottomNav() {
  const routerState = useRouterState()
  const currentPath = routerState.location.pathname

  // Check if there is a live match to highlight the Score tab
  const liveMatch = useLiveQuery(() =>
    db.matches.where("status").equals("live").first()
  )

  function isActive(to: string, exact: boolean) {
    if (exact) return currentPath === to
    return currentPath.startsWith(to)
  }

  return (
    <nav
      className="border-t border-border bg-background/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom)]"
      style={{ position: "sticky", bottom: 0, zIndex: 50 }}
    >
      <div className="flex items-stretch">
        {NAV_ITEMS.map(({ to, label, icon: Icon, exact }) => {
          const active = isActive(to, exact)
          const isScore = to === "/scoring"
          const hasLive = isScore && !!liveMatch

          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 min-h-[52px] py-2 px-1 text-xs font-medium transition-colors select-none",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
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
              <span
                className={cn(
                  hasLive && !active && "text-emerald-500",
                  hasLive && active && "text-emerald-400"
                )}
              >
                {label}
              </span>
            </Link>
          )
        })}
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

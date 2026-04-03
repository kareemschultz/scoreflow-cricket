import { createRootRoute, Link, Outlet, useRouterState } from "@tanstack/react-router"
import { Home, Activity, Clock, BarChart2, Users, Trophy, X, Download } from "lucide-react"
import { useLiveQuery } from "dexie-react-hooks"
import { AnimatePresence, motion } from "framer-motion"
import { useEffect, useRef, useState } from "react"
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
  { to: "/tournaments", label: "Cups", icon: Trophy, exact: false },
] as const

// ─── Bottom Nav ───────────────────────────────────────────────────────────────

function BottomNav() {
  const routerState = useRouterState()
  const currentPath = routerState.location.pathname

  const liveMatch = useLiveQuery(() =>
    db.matches.where("status").equals("live").first()
  )

  function isActive(to: string, exact: boolean) {
    if (exact) return currentPath === to
    return currentPath.startsWith(to)
  }

  return (
    <nav
      className="no-print border-t border-border bg-background/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom)] relative"
      style={{ position: "sticky", bottom: 0, zIndex: 50 }}
    >
      <div className="flex items-stretch">
        {(CRICKET_NAV as typeof CRICKET_NAV).map(({ to, label, icon: Icon, exact }: { to: string; label: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; exact: boolean }) => {
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
      </div>
    </nav>
  )
}

// ─── PWA Install Prompt ───────────────────────────────────────────────────────

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

function PwaInstallPrompt() {
  const [androidPrompt, setAndroidPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIos, setShowIos] = useState(false)
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem("pwa-install-dismissed") === "1" } catch { return false }
  })
  const deferredRef = useRef<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    if (dismissed) return

    // Android: capture the install event
    const handler = (e: Event) => {
      e.preventDefault()
      deferredRef.current = e as BeforeInstallPromptEvent
      setAndroidPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener("beforeinstallprompt", handler)

    // iOS: detect Safari + not already installed
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
    const isStandalone = "standalone" in navigator && !!(navigator as { standalone?: boolean }).standalone
    if (isIos && !isStandalone) {
      // Delay slightly so it doesn't flash on load
      const t = setTimeout(() => setShowIos(true), 2000)
      return () => { clearTimeout(t); window.removeEventListener("beforeinstallprompt", handler) }
    }

    return () => window.removeEventListener("beforeinstallprompt", handler)
  }, [dismissed])

  function dismiss() {
    setAndroidPrompt(null)
    setShowIos(false)
    setDismissed(true)
    try { localStorage.setItem("pwa-install-dismissed", "1") } catch { /* ignore */ }
  }

  async function handleAndroidInstall() {
    if (!deferredRef.current) return
    await deferredRef.current.prompt()
    const { outcome } = await deferredRef.current.userChoice
    if (outcome === "accepted") dismiss()
    else setAndroidPrompt(null)
  }

  const visible = !dismissed && (!!androidPrompt || showIos)

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed bottom-[calc(64px+env(safe-area-inset-bottom))] left-3 right-3 z-50"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
        >
          <div className="bg-background border border-border rounded-2xl shadow-xl p-4">
            {androidPrompt ? (
              <div className="flex items-start gap-3">
                <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Download className="size-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">Install App</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Add to your home screen for the best experience</p>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={handleAndroidInstall}
                      className="flex-1 bg-primary text-primary-foreground text-xs font-semibold py-2 rounded-xl"
                    >
                      Install
                    </button>
                    <button
                      onClick={dismiss}
                      className="px-3 py-2 text-xs text-muted-foreground rounded-xl hover:bg-muted"
                    >
                      Not now
                    </button>
                  </div>
                </div>
                <button onClick={dismiss} className="text-muted-foreground p-0.5">
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 text-xl">
                  📱
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">Add to Home Screen</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Tap the <span className="font-semibold text-foreground">Share</span> button{" "}
                    <span className="inline-flex items-center justify-center size-4 rounded border border-border bg-muted text-[10px]">⬆</span>
                    {" "}then choose{" "}
                    <span className="font-semibold text-foreground">"Add to Home Screen"</span>
                    {" "}for the full app experience.
                  </p>
                  <button
                    onClick={dismiss}
                    className="mt-2 text-xs text-muted-foreground underline"
                  >
                    Dismiss
                  </button>
                </div>
                <button onClick={dismiss} className="text-muted-foreground p-0.5">
                  <X className="size-4" />
                </button>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─── Root Layout ──────────────────────────────────────────────────────────────

function RootLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const { match, loadMatch } = useScoringStore()
  const hasCheckedForLiveMatch = useRef(false)

  // Rehydrate scoring store from Dexie on app startup if there's a live match
  useEffect(() => {
    if (match || hasCheckedForLiveMatch.current) return
    hasCheckedForLiveMatch.current = true
    db.matches.where("status").equals("live").first().then((liveMatch) => {
      if (liveMatch) void loadMatch(liveMatch.id)
    })
  }, [loadMatch, match])

  return (
    <div
      className="flex flex-col h-dvh bg-background"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
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
      <PwaInstallPrompt />
    </div>
  )
}

export const Route = createRootRoute({
  component: RootLayout,
})

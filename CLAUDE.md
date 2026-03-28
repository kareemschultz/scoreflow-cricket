# ScoreFlow — CLAUDE.md

## Project Overview
ScoreFlow (formerly CricketBook) is a **mobile-first live scoring PWA** — client-side only, all data in IndexedDB via Dexie.js. No backend. Deployed to GitHub Pages at `https://kareemschultz.github.io/scoreflow/`.

## Monorepo Structure
```
scoreflow/
├── apps/web/          — Vite + React 19 SPA (main app)
├── packages/ui/       — @workspace/ui shadcn/Maia component library
└── .github/workflows/deploy.yml  — GitHub Actions → GitHub Pages
```

## Tech Stack
| Layer | Tech |
|-------|------|
| Framework | React 19 + Vite 7 + TanStack Router (file-based) |
| UI Library | **shadcn/ui Maia preset** — uses **Base UI** (@base-ui/react), NOT Radix UI |
| CSS | Tailwind CSS v4 (CSS-native config, no tailwind.config.js) |
| Animations | Framer Motion (add: `bun add framer-motion` in apps/web) |
| State | Zustand (live scoring session only) |
| Database | Dexie.js (IndexedDB) + dexie-react-hooks (useLiveQuery) |
| Router | TanStack Router v1 — file-based routes in `apps/web/src/routes/` |
| Package mgr | Bun workspaces |
| PWA | vite-plugin-pwa + workbox |
| Deployment | GitHub Pages via GitHub Actions |

## CRITICAL: Base UI vs Radix
**This project uses Base UI, NOT Radix UI.** Key differences:
- No `asChild` prop — use `render={<Button />}` prop instead
- `onValueChange` in Select gives `string | null` (not just `string`)
- Dexie `db.transaction()` max 5 tables as variadic args — use array form: `db.transaction("rw", [table1, table2, ...], callback)` for 6+ tables
- Dialog/Sheet uses `data-open` attributes, not `data-state`

## Build Commands
```bash
# From apps/web directory:
node ../../node_modules/.bun/vite@*/node_modules/vite/bin/vite.js build
node ../../node_modules/.bun/vite@*/node_modules/vite/bin/vite.js --port 5173   # dev server

# TypeScript check:
node apps/web/node_modules/typescript/bin/tsc --noEmit --project apps/web/tsconfig.app.json
```

## Key Architecture Decisions
1. **Event sourcing**: `ballLog` is source of truth; all stats are derived
2. **Zustand only for live scoring** (`stores/scoring.ts`) — everything else via `useLiveQuery`
3. **Base: "/scoreflow/"** in vite.config.ts — required for GitHub Pages subdirectory
4. **dedupe: ["react", "react-dom", "lucide-react"]** in vite resolve — needed because lucide-react is in apps/web/node_modules but also imported from packages/ui

## Route Structure
```
/                         — Home (active match card + quick stats)
/new-match                — 5-step match setup wizard
/scoring                  — Live scoring interface
/scorecard/$matchId       — Full scorecard + charts
/history                  — Match history list
/stats                    — Leaderboard tabs
/stats/$playerId          — Player profile
/records                  — All-time records
/teams                    — Team list
/teams/$teamId            — Team roster
/tournaments              — Tournament list
/tournaments/$tournamentId — Tournament overview
/settings                 — Settings + data export/import
```

## Critical Scoring Store Pattern

**All post-`await` state reads in `use-scoring-handlers.ts` MUST use `useScoringStore.getState()`**, not `ctx.*` closure values. The `ctx` object is captured at render time and will be stale after any `await recordBall()` call.

Correct pattern (used in `checkPostBall`, `handleWicketConfirm`, `handleEndMatch`):
```ts
const latestState = useScoringStore.getState()
const latestMatch = latestState.match
const latestIdx = latestState.currentInningsIndex
const latestInnings = latestMatch?.innings[latestIdx]
```

**`isLastInnings` must always use rules, never array length:**
```ts
const totalInnings = (latestMatch.rules.inningsPerSide ?? 1) * 2
const isLastInnings = latestIdx >= totalInnings - 1
// NOT: match.innings.length - 1  ← wrong when first innings ends
```

## Critical Architecture: ScoringLoader Pattern

`scoring.tsx` has a `ScoringLoader` wrapper component that handles cold-start (page refresh, Resume Match):

```tsx
// ScoringLoader — ONLY gate on !match, NEVER on isProcessing
if (!match) return <spinner />   // ← correct
// if (!match || isProcessing)   // ← WRONG: unmounts ScoringPage on every ball tap
return <ScoringPage />
```

**Why:** `recordBall` sets `isProcessing:true` during every DB write. Including `isProcessing` in the gate condition unmounts and remounts `ScoringPage` on every single button tap, resetting all dialog state and making scoring non-functional.

`useLiveQuery` null/undefined sentinel pattern:
```ts
// Pass null as default so we can tell loading apart from "not found"
const liveMatch = useLiveQuery(() => db.matches.where("status").equals("live").first(), [], null)
// null = still loading | undefined = query done, not found | Match = found
if (liveMatch === null) return  // loading — wait
if (!liveMatch) navigate("/")   // not found — go home
```

**Why:** Without the `null` default, `useLiveQuery` returns `undefined` for BOTH "loading" and "not found" — the guard `if (liveMatch === undefined) return` exits early even when the DB has no live match, causing infinite spinner.

## Known Bugs

### Bug 1: NewBatsmanSheet may not open after wicket [MEDIUM]
- **Symptom**: After recording a wicket, the bottom sheet to select next batsman sometimes doesn't visually appear
- **Location**: `apps/web/src/routes/scoring.tsx`, `components/scoring/NewBatsmanSheet.tsx`
- **Root cause**: `availableBatsmen` may be empty if `allPlayers` useLiveQuery hasn't loaded; OR Base UI Sheet portal timing
- **Fix approach**: Ensure `allPlayers` is loaded before showing sheet

### Bug 2: Bottom nav overlaps wizard "Next" buttons [LOW]
- **Symptom**: In new-match.tsx wizard, bottom action buttons partially obscured by sticky bottom nav
- **Fix**: Add `pb-20` or `mb-16` to wizard step containers

### Bug 3: "Tap New Over to select a bowler" hint persists when bowler IS set [LOW]
- **Location**: `apps/web/src/routes/scoring.tsx` BowlerCard fallback text
- **Fix**: Guard hint text on `!currentBowler && innings.ballLog.length > 0`

## Completed Features
- ✅ Cricket engine (pure functions, `lib/cricket-engine.ts`)
- ✅ Zustand scoring store with undo, free hit, over management, `lastOverBalls`, `undoNBalls`
- ✅ Full scoring UI (run buttons, extras, wicket dialog, new batsman/bowler sheets, multi-undo)
- ✅ Match setup wizard (5 steps: teams, format/rules, toss, playing XI, openers)
- ✅ Teams + player CRUD
- ✅ Scorecard with batting/bowling cards, FOW, partnerships, `MatchSummaryCard`
- ✅ SVG charts: Manhattan (dual-innings), Worm (dual-innings), RunRate, WagonWheel
- ✅ Scorecard inline collapsible chart section (both innings side-by-side)
- ✅ **InningsBreakOverlay**: animated full-screen innings transition with score + target
- ✅ **MatchResultOverlay**: animated full-screen celebration with confetti + trophy
- ✅ Stats leaderboard + player profiles
- ✅ Records page
- ✅ Tournament list + overview
- ✅ History, Settings with JSON export/import (versioned schema)
- ✅ PWA with service worker + workbox precaching
- ✅ iOS PWA meta tags
- ✅ Share scorecard as image (html2canvas) + text copy

## Verification Protocol

**Always verify deploys are live before reporting to user:**
```bash
gh run list --limit 1   # check deploy succeeded
curl -sI https://kareemschultz.github.io/scoreflow/ | grep last-modified  # confirm bundle timestamp
```
Bundle last-modified should be within 60s of the gh run completed timestamp. JS is minified — can't grep for code strings in the bundle.

## Pending Enhancements
- [ ] Framer Motion page transitions + score counter animation
- [ ] Demo/mock match data seed for first-time users
- [ ] PartnershipBar and RunRateGraph improvements
- [ ] Tournament fixture scheduling
- [ ] Player form chart on stats/$playerId

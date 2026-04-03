# ScoreFlow Cricket — CLAUDE.md

## Project Overview
ScoreFlow Cricket is a cricket-only mobile-first live scoring PWA. Fork of scoreflow/cricketbook. Deployed at https://kareemschultz.github.io/scoreflow-cricket/

Client-side only. All data in IndexedDB via Dexie.js. No backend.

## Monorepo Structure
```
scoreflow-cricket/
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
| Animations | Framer Motion |
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
npx vite --port 5173   # dev server
npx vite build         # production build

# TypeScript check:
bun run typecheck

# Full CI suite (same as GitHub Actions):
bun audit && bun run lint && bun run typecheck
cd apps/web && npx vitest run  # unit tests (214)
cd apps/web && npx playwright test  # E2E
```

## Key Architecture Decisions
1. **Event sourcing**: `ballLog` is source of truth; all stats are derived
2. **Zustand only for live scoring** (`stores/scoring.ts`) — everything else via `useLiveQuery`
3. **Base: "/scoreflow-cricket/"** in vite.config.ts — required for GitHub Pages subdirectory
4. **dedupe: ["react", "react-dom", "lucide-react"]** in vite resolve — needed because lucide-react is in apps/web/node_modules but also imported from packages/ui
5. **Pure scoring transitions** (`lib/scoring-transitions.ts`) — `applyBallToMatch`, `rebuildInningsFromBallLog`, `rederiveStateFromInnings` are pure functions with no Dexie/Zustand deps. Test them without store mocking. `scoring.ts` only handles Zustand state + Dexie persistence.
6. **ExportPayload type** (`types/export.ts`) — canonical interface for all exports. `EXPORT_TABLE_KEYS` const defines the fixed ordering used for SHA-256 integrity hash. Import mode is `"replace"` (bulkPut) or `"merge"` (bulkAdd skipping existing keys). Export schema v1.

## DB Schema
**DB name:** `ScoreFlowCricketDB`
**Dexie schema version:** 1
**Tables (7 total — cricket only):**

| Table | Purpose |
|-------|---------|
| `teams` | Team records |
| `players` | Player records with roles and batting hand |
| `matches` | Match records including innings + ballLog |
| `tournaments` | Tournament records |
| `battingStats` | Derived batting aggregates |
| `bowlingStats` | Derived bowling aggregates |
| `settings` | App settings and export metadata |

No FIFA, Dominoes, or Trump tables exist in this fork.

## Cricket Engine Rules

**Partnership includes ALL runs, not just batsman runs:**
`getCurrentPartnership` sums `b.runs` for every ball while the pair is at the crease — including wides, byes, leg-byes, and no-ball extras. Individual batsman credit is tracked separately via `getBatsmanRuns`. Do NOT filter `!b.isExtra` when computing partnership totals.

**Import validator uses `isFiniteNumber`, not `typeof x === "number"`:**
`isFiniteNumber` rejects `NaN` and `Infinity`. Always use it when validating numeric fields in `import-validator.ts`.

**Man of the Match algorithm (`computeManOfMatch` in `lib/stats-calculator.ts`):**
- Batting points: runs + fours + (sixes × 2) + strike rate bonus
- Bowling points: (wickets × 25) + (maidens × 10) + economy bonus
- Returns ranked player list. MoM card displayed as amber trophy banner below match summary on scorecard.

## Testing Structure
- `lib/cricket-engine.test.ts` — pure engine function tests
- `lib/import-validator.test.ts` — validation tests for all 7 cricket table types
- `lib/scoring-transitions.test.ts` — pure transition tests
- `stores/scoring.test.ts` — Zustand store integration tests (mocked Dexie)
- `e2e/full-match.spec.ts` — Playwright E2E: teams → new match → both innings → export → clear → reimport
- Total: 214 passing unit tests
- Run unit tests: `cd apps/web && npx vitest run`
- Run E2E: `cd apps/web && npx playwright test`

## Route Structure
```
/                                        — Home (active match card + quick stats)
/new-match                               — 5-step match setup wizard
/scoring                                 — Live scoring interface
/scorecard/$matchId                      — Full scorecard + MoM + PDF
/charts/$matchId                         — Full analytics (7 chart tabs)
/history                                 — Match history list
/stats                                   — Leaderboard tabs
/stats/$playerId                         — Player profile
/records                                 — All-time records
/teams                                   — Team list
/teams/$teamId                           — Team roster
/tournaments                             — Cricket tournament list
/tournaments/$tournamentId               — Cricket tournament overview
/settings                                — Settings + data export/import
```

No /fifa/, /dominoes/, or /trump/ routes exist in this fork.

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

## Critical: allPlayers useLiveQuery must use null sentinel

```ts
// WRONG — useLiveQuery ?? [] makes loading look like empty list
const allPlayers = useLiveQuery(..., [match?.id]) ?? []
if (allPlayers.length > 0) setShowNewBatsmanSheet(true) // ← never opens during load

// CORRECT
const allPlayers = useLiveQuery(..., [match?.id], null)
const isPlayersLoading = allPlayers === null
const players = allPlayers ?? []
// Pass disabled: isPlayersLoading into NextActionType for the next-action strip
```

**Why:** During Dexie initialization, `useLiveQuery` returns `undefined`. With `?? []`, this looks like an empty players list, blocking the batsman sheet from opening. Using `null` as the default lets us detect the loading state and show "Loading players..." instead of silently blocking.

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

**Detail page variant** — when the query function itself returns `null` for not-found:
```ts
const data = useLiveQuery(async () => {
  const player = await db.players.get(playerId)
  if (!player) return null   // ← explicit null = not found
  return { player, ... }
})
if (data === undefined) return <spinner />   // loading
if (data === null) return <p>Not found</p>  // not found
```

## Critical: Innings participant IDs must be persisted

`currentStrikerId`, `currentNonStrikerId`, `currentBowlerId` are stored on the `Innings` object (optional fields) and written to IndexedDB on every ball, batsman selection, and bowler selection. `loadMatch` reads them first — falling back to ball-log derivation only if absent.

```ts
// WRONG — participants only in Zustand; lost on page reload
useScoringStore.setState({ currentBowlerId: playerId })

// CORRECT — persist to innings, then sync Zustand
const updated = structuredClone(match)
updated.innings[idx].currentBowlerId = playerId
await db.matches.put(updated)
useScoringStore.setState({ match: updated, currentBowlerId: playerId })
```

**How to apply:** Whenever `handleNewBatsman`, `handleNewBowler`, or `recordBall` mutates participant state, also write it to the innings record before calling `db.matches.put`. `loadMatch` priority: persisted IDs → ball-log derivation → opener positional fallback.

### loadMatch must NOT touch isProcessing

```ts
// WRONG — isProcessing stuck true if loadMatch throws, permanently breaks canScore:
loadMatch: async (id) => {
  set({ isProcessing: true })  // ← REMOVE THIS
  ...
  set({ ..., isProcessing: false })  // ← REMOVE THIS TOO
}

// CORRECT — loadMatch only sets match/store fields, never isProcessing
loadMatch: async (id) => {
  const match = await db.matches.get(id)
  ...
  set({ matchId, match, onStrikeBatsmanId, ... })  // no isProcessing
}
```

**Why:** `RootLayout` calls `loadMatch` on app startup with no error handling. Any exception after `set({ isProcessing: true })` leaves `isProcessing` permanently `true`. Since `canScore = !!striker && !!bowler && !isProcessing`, all score buttons are permanently disabled.

## Team Picker Pattern

Team picker merges `db.teams` (persisted team records) with teams reconstructed from past match records, so teams that appear in match history but were later deleted still show up. Show a loading skeleton while Dexie initializes (use null sentinel on both queries).

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
- ✅ History, Settings with JSON export/import (versioned schema v1, 7 cricket tables)
- ✅ PWA with service worker + workbox precaching
- ✅ iOS PWA meta tags
- ✅ Share scorecard as image (html2canvas) + text copy
- ✅ Score tab shows "No active match" CTA instead of silent redirect
- ✅ `allPlayers` useLiveQuery null sentinel + `isPlayersLoading` guard in ScoringPage
- ✅ Bowler hint text when `!currentBowler && innings.ballLog.length > 0`
- ✅ Partnership calculation includes extras (byes, no-balls)
- ✅ Import validator covers all 7 cricket DB tables with deep MatchRules validation
- ✅ Import validator rejects NaN/Infinity values (`isFiniteNumber` helper)
- ✅ `getTopBowlers` query uses `where("format").equals(format)` + in-memory sort
- ✅ Innings transition label shows ordinal e.g. "start innings 2/2"
- ✅ Scoring UI "why disabled" helper text (match complete, innings complete, processing, missing striker/bowler)
- ✅ `computeBowlerEntry` single-pass O(n) accumulator
- ✅ Store decomposed: `scoring.ts` pure functions in `lib/scoring-transitions.ts`
- ✅ 214 passing unit tests across test files
- ✅ **Full Playwright E2E test** — teams → wizard → 1st innings → innings break → 2nd innings → match result → export → clear → reimport roundtrip
- ✅ **`ExportPayload` TypeScript interface** — canonical schema v1 with 7 cricket tables, `ExportIntegrity`, `ImportMode`, `EXPORT_TABLE_KEYS`
- ✅ **Backup integrity hash** — SHA-256 via `crypto.subtle`; import warns on hash mismatch
- ✅ **Import modes** — `replace` (bulkPut) and `merge` (bulkAdd skipping existing IDs)
- ✅ **Innings participant persistence** — `currentStrikerId`, `currentNonStrikerId`, `currentBowlerId` persisted on `Innings` in IndexedDB
- ✅ **`lastManStands` scoring** — `hasRequiredBatters()` allows scoring with 1 batter at final wicket
- ✅ **CI hardening** — lint + typecheck + unit tests + Playwright all gate before GitHub Pages deploy
- ✅ **Man of the Match auto-calculation** (`computeManOfMatch()` in `lib/stats-calculator.ts`) — batting + bowling point totals, ranked player list
- ✅ **MoM card on scorecard** — amber trophy banner below match summary, shows batting/bowling summary for winner
- ✅ **Undo step preview dialog** (`UndoPreviewDialog.tsx`) — shows score/wickets/overs preview for 1, 2, and 3 undo steps before committing
- ✅ **Captain badges** on BatsmanCard + BowlerCard (`isCaptain` prop renders "(c)" inline)
- ✅ **Over ball color coding** in OverDisplay: 1 run (emerald-light), 2 runs (emerald-medium), 3 runs (teal), plus existing W/4/6/Wd/NB/dot colors
- ✅ **PDF export** via `window.print()` with print CSS — no-print classes hide UI chrome, scorecard-print-area is the only printed region. "Download PDF" button on scorecard.
- ✅ **4 new analytics chart tabs**: Dismissal breakdown, Batsman scoring breakdown, Bowler dot ball %, Extras summary (added to charts page alongside Manhattan/Worm/RunRate)
- ✅ **Team picker merge** — `db.teams` merged with teams reconstructed from past match records; loading skeleton while Dexie initializes

## Known Bugs

### Bug 2: Bottom nav overlaps wizard "Next" buttons [FIXED]
- **Status**: RESOLVED — `pb-24`/`pb-40` applied to wizard step containers
- **Original symptom**: wizard bottom action buttons partially obscured by sticky bottom nav on small screens

## Pending Enhancements
- [ ] Google Play TWA submission — target URL: https://kareemschultz.github.io/scoreflow-cricket/. Use PWABuilder or Bubblewrap CLI. Need Digital Asset Links file.
- [ ] Framer Motion page transitions + score counter animation
- [ ] Demo/mock match data seed for first-time users
- [ ] PartnershipBar and RunRateGraph improvements
- [ ] Player form chart on stats/$playerId

## Verification Protocol

**Always verify deploys are live before reporting:**
```bash
gh run list --limit 1   # check deploy succeeded
curl -sI https://kareemschultz.github.io/scoreflow-cricket/ | grep last-modified  # confirm bundle timestamp
```
Bundle last-modified should be within 60s of the gh run completed timestamp. JS is minified — can't grep for code strings in the bundle.

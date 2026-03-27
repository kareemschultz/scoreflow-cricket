# CricketBook

A mobile-first cricket scoring PWA for tracking matches, stats, tournaments, and more — plus a FIFA match tracker for your squad. All data stays on your device via IndexedDB. No backend, no account required.

**Live:** https://kareemschultz.github.io/cricketbook/

---

## Features

### Cricket
- **Live scoring** — ball-by-ball recording with extras (wide, no-ball, bye, leg-bye), wickets, free hits, and undo
- **Match setup wizard** — 5-step flow: teams → format/rules → toss → playing XI → openers
- **Custom rules** — configure overs, bowler limits, balls per over, wide/NB re-ball, last man stands, and more
- **Scorecard** — full batting/bowling cards, fall of wickets, partnerships, extras breakdown
- **Charts** — dedicated full-screen charts page with Manhattan, Worm, and Run Rate graphs (interactive, hover tooltips)
- **Stats** — leaderboard tabs (top scorers, wicket takers, best average, economy) with format filters
- **Player profiles** — career batting/bowling stats per player
- **Records page** — all-time bests: highest score, best figures, most runs, most wickets, highest partnership
- **Tournaments** — round-robin/knockout brackets, points table with NRR, fixture scheduling
- **Teams & rosters** — create teams, add/edit/bulk-import players with roles and batting hand

### FIFA Tracker
- Track FIFA match results between friends
- Player leaderboard with W/D/L, win rate, and points
- Individual player profiles with match history and head-to-head records
- Demo data to explore before adding real matches

### App
- **PWA** — install to home screen on iOS and Android, works fully offline
- **iOS Dynamic Island** — content respects safe area insets
- **Dark mode** — optimized for outdoor/field use
- **Framer Motion animations** — page transitions, score counters, entry animations

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | React 19 + Vite 7 |
| Routing | TanStack Router v1 (file-based) |
| UI | shadcn/ui — Maia preset (Base UI, not Radix) |
| CSS | Tailwind CSS v4 (CSS-native config) |
| Animations | Framer Motion |
| State | Zustand (live scoring session only) |
| Database | Dexie.js (IndexedDB) + dexie-react-hooks |
| Package manager | Bun workspaces |
| PWA | vite-plugin-pwa + Workbox |
| Deployment | GitHub Pages via GitHub Actions |

---

## Monorepo Structure

```
cricketbook/
├── apps/
│   └── web/                   # Main Vite + React app
│       └── src/
│           ├── routes/        # TanStack file-based routes
│           ├── components/    # UI components (scoring, scorecard, charts)
│           ├── db/            # Dexie database + table definitions
│           ├── lib/           # Cricket engine, stats calculator, helpers
│           ├── stores/        # Zustand stores (scoring session)
│           └── types/         # TypeScript types
└── packages/
    └── ui/                    # @workspace/ui — shared shadcn components
```

---

## Routes

| Path | Page |
|------|------|
| `/` | Home — active match card + recent matches |
| `/new-match` | 5-step match setup wizard |
| `/scoring` | Live scoring interface |
| `/scorecard/$matchId` | Full scorecard with batting/bowling cards |
| `/charts/$matchId` | **Dedicated charts page** — Manhattan, Worm, Run Rate (full-screen, interactive) |
| `/history` | Match history list |
| `/stats` | Leaderboard tabs |
| `/stats/$playerId` | Player career profile |
| `/records` | All-time records |
| `/teams` | Team list |
| `/teams/$teamId` | Team roster — add/edit/bulk-import players |
| `/tournaments` | Tournament list |
| `/tournaments/$tournamentId` | Tournament overview |
| `/settings` | Data export/import, app info |
| `/fifa` | FIFA leaderboard |
| `/fifa/players` | FIFA player list |
| `/fifa/players/$playerId` | FIFA player profile |
| `/fifa/matches` | FIFA match history |
| `/fifa/matches/new` | Record a FIFA match |

---

## Development

**Prerequisites:** [Bun](https://bun.sh) installed.

```bash
# Install dependencies
bun install

# Start dev server (from monorepo root)
cd apps/web
node ../../node_modules/.bun/vite@*/node_modules/vite/bin/vite.js --port 5173

# TypeScript check
node apps/web/node_modules/typescript/bin/tsc --noEmit --project apps/web/tsconfig.app.json

# Build
node ../../node_modules/.bun/vite@*/node_modules/vite/bin/vite.js build
```

---

## Data Architecture

- **Event sourcing**: `ballLog` is the source of truth — all stats are derived from ball events
- **Zustand** is only used for the live scoring session (`stores/scoring.ts`) — everything else reads directly from Dexie via `useLiveQuery`
- **No backend** — all data lives in the browser's IndexedDB. Use Settings → Export to back up your data as JSON.
- **Base path**: `/cricketbook/` — required for GitHub Pages subdirectory deployment

### Key data types

```ts
Ball          // Single delivery event (runs, extras, wicket, overNumber, isLegal…)
Innings       // Full innings: ballLog, battingCard, bowlingCard, fallOfWickets, partnerships
Match         // Top-level match: team names, rules, innings[], status, result
MatchRules    // Per-match config: oversPerInnings, maxOversPerBowler, wideReball, freeHitOnNoBall…
Player        // Cricket player: name, teamId, role, battingStyle
FifaPlayer    // FIFA player: name, colorHex
FifaMatch     // FIFA result: player1Id, player2Id, player1Score, player2Score, date
```

---

## Charts

The dedicated charts page (`/charts/$matchId`) offers three interactive visualizations:

| Chart | What it shows |
|-------|--------------|
| **Manhattan** | Runs per over as vertical bars — wickets marked with red dots |
| **Worm** | Cumulative runs over time — compares both innings; steeper = faster scoring |
| **Run Rate** | CRR vs RRR for 2nd innings chases — shows pressure points over the game |

All charts are SVG-based, fill their container width via `ResizeObserver`, and support hover/touch tooltips for over-by-over breakdowns.

---

## Cricket Rules Engine

`src/lib/cricket-engine.ts` contains pure functions with no side effects:

- `isLegalDelivery(ball)` — wides and no-balls are not legal deliveries
- `isOverComplete(balls, rules)` — counts legal deliveries vs `ballsPerOver`
- `shouldSwapStrike(ball)` — odd run totals or end-of-over strike rotation
- `isMaidenOver(balls)` — all legal deliveries, zero batting runs, no wides/no-balls
- `getRunsForBowler(ball)` — includes wides/no-balls, excludes byes/leg-byes
- `formatOvers(legalDeliveries, ballsPerOver)` — "16.3" display format
- `canBowl(bowlerId, overs, rules)` — consecutive over check + max over limit
- `isInningsComplete(innings, rules)` — all out, overs done, or declared
- `calculatePartnership(ballLog, bat1Id, bat2Id)` — partnership runs and balls

---

## Deployment

The app auto-deploys to GitHub Pages on every push to `main` via `.github/workflows/deploy.yml`.

The Vite config sets `base: '/cricketbook/'` for the subdirectory path. The service worker precaches all assets for offline use.

---

## Known Issues

- **NewBatsmanSheet** may not open after wicket in some edge cases (Base UI Sheet portal timing)
- Bottom nav overlaps wizard "Next" buttons on very small screens (add `pb-20` to affected containers)

---

## Contributing

This is a personal project. If you find a bug, open an issue with the match scenario that triggered it.

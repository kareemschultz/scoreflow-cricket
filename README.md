# ScoreFlow Cricket

[![Live](https://img.shields.io/badge/Live-scoreflow--cricket-blue)](https://kareemschultz.github.io/scoreflow-cricket/)
[![PWA](https://img.shields.io/badge/PWA-offline--ready-green)](https://kareemschultz.github.io/scoreflow-cricket/)
[![Deploy](https://github.com/kareemschultz/scoreflow-cricket/actions/workflows/deploy.yml/badge.svg)](https://github.com/kareemschultz/scoreflow-cricket/actions/workflows/deploy.yml)
[![Tests](https://img.shields.io/badge/tests-214%20passing-brightgreen)]()

Mobile-first cricket live scoring PWA — ball-by-ball scoring, analytics, and tournament tracking. No backend, no account. All data on your device.

---

## Features

### Live Scoring
- Ball-by-ball input with extras: wide, no-ball, bye, leg-bye
- All dismissal types, free hits, overthrows, last-man-stands, super overs
- Multi-ball undo with step preview dialog (see score/wickets/overs before committing)

### Match Setup
- 5-step wizard: teams → format/rules → toss → playing XI → openers/bowler

### Custom Rules
- Overs, bowler limits, balls per over, wide/NB re-ball, free hit on no-ball, powerplay, last man stands, super over on tie

### Scorecard
- Batting and bowling cards, fall of wickets, partnerships, extras breakdown
- Man of the Match auto-calculated (batting points: runs + fours + sixes + SR bonus; bowling points: wickets + maidens + economy bonus)
- Captain badges inline on batting and bowling cards
- PDF export via browser print dialog

### Charts (7 tabs)
- Manhattan, Worm, Run Rate (dual-innings)
- Dismissal breakdown, Batsman scoring breakdown, Bowler dot ball %, Extras summary

### Stats and Records
- Leaderboard: top scorers, wicket takers, best average, economy; format filters
- Player career profiles
- All-time records: highest score, best figures, highest partnership

### Tournaments
- Round-robin fixtures, standings with NRR, champion tracking

### Teams and Rosters
- Create teams, add and edit players with roles and batting hand

### Share
- Export scorecard as image (html2canvas) or copy as text

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | React 19 + Vite 7 |
| Routing | TanStack Router v1 (file-based, hash history) |
| UI | shadcn/ui — Maia preset (Base UI, not Radix) |
| CSS | Tailwind CSS v4 (CSS-native config) |
| Animations | Framer Motion |
| State | Zustand (live scoring session only) |
| Database | Dexie.js v4 (IndexedDB) + dexie-react-hooks |
| Package manager | Bun workspaces |
| PWA | vite-plugin-pwa + Workbox |
| Deployment | GitHub Pages via GitHub Actions |
| Charts | Hand-crafted SVG (no chart library) |

---

## Monorepo Structure

```
scoreflow-cricket/
├── apps/web/
│   └── src/
│       ├── routes/            # TanStack file-based routes
│       │   ├── scoring.tsx    # Live scoring interface
│       │   ├── scorecard.$matchId.tsx
│       │   ├── charts.$matchId.tsx
│       │   ├── new-match.tsx
│       │   ├── history.tsx
│       │   ├── stats/
│       │   ├── teams/
│       │   └── tournaments/
│       ├── components/
│       │   ├── charts/        # Manhattan, Worm, RunRate, Dismissal, Batting, Bowling, Extras
│       │   ├── scorecard/     # BattingCard, BowlingCard, FallOfWickets, PartnershipChart
│       │   └── scoring/       # BatsmanCard, BowlerCard, OverDisplay, UndoPreviewDialog
│       ├── db/                # Dexie schema (v1, 7 tables)
│       ├── lib/               # Cricket engine, stats-calculator, scoring-transitions
│       ├── stores/            # Zustand scoring session store
│       └── types/             # TypeScript types
└── packages/
    └── ui/                    # @workspace/ui — shared shadcn/Base UI components
```

---

## Routes

| Path | Page |
|------|------|
| `/` | Home — active match card + recent matches |
| `/new-match` | 5-step match setup wizard |
| `/scoring` | Live scoring interface |
| `/scorecard/$matchId` | Full scorecard with MoM, charts, PDF |
| `/charts/$matchId` | Full analytics — 7 chart tabs |
| `/history` | Match history |
| `/stats` | Leaderboard tabs |
| `/stats/$playerId` | Player career profile |
| `/records` | All-time records |
| `/teams` | Team list |
| `/teams/$teamId` | Team roster |
| `/tournaments` | Tournament list |
| `/tournaments/$tournamentId` | Tournament overview |
| `/settings` | Export/import, app info |

---

## Development

**Prerequisites:** [Bun](https://bun.sh) installed.

```bash
# Install
bun install

# Dev server
cd apps/web && npx vite --port 5173

# Unit tests (214 tests)
cd apps/web && npx vitest run

# E2E tests
cd apps/web && npx playwright test

# TypeScript check
bun run typecheck

# Build
cd apps/web && npx vite build
```

---

## CI / CD

`.github/workflows/deploy.yml` runs before every deploy to `main`:

1. `bun audit` — dependency vulnerability gate
2. `bun run lint` — ESLint
3. `bun run typecheck` — TypeScript
4. `bun run test` — 214 unit tests (Vitest)
5. `bunx playwright test` — full E2E browser test (teams → match → innings → result → export/import)
6. `bun run build` — production build
7. Deploy to GitHub Pages

---

## Data Architecture

- **Event sourcing** — `ballLog` is the source of truth; all cricket stats are derived
- **Zustand** — only for the live scoring session (`stores/scoring.ts`); everything else via `useLiveQuery`
- **No backend** — all data in the browser's IndexedDB
- **Export schema v1** — `ExportPayload` type in `types/export.ts`; SHA-256 integrity hash; `replace` or `merge` import modes
- **Innings persistence** — `currentStrikerId`, `currentNonStrikerId`, `currentBowlerId` are persisted on the `Innings` object so match state survives page reloads
- **Bundle splitting** — Vite `manualChunks` splits react / router / storage / motion / icons / dates / html2canvas into separate cached chunks; html2canvas is lazy-loaded

### DB tables (Dexie v1, 7 tables)

| Module | Tables |
|--------|--------|
| Cricket | `teams`, `players`, `matches`, `tournaments`, `battingStats`, `bowlingStats` |
| App | `settings` |

---

## Cricket Rules Engine

`src/lib/cricket-engine.ts` — pure functions, no side effects:

- `isLegalDelivery(ball)` — wides and no-balls are not legal deliveries
- `isOverComplete(balls, rules)` — counts legal deliveries vs `ballsPerOver`
- `shouldSwapStrike(ball)` — odd run totals or end-of-over strike rotation
- `isMaidenOver(balls)` — all legal deliveries, zero batting runs
- `computeBowlerEntry(ballLog, bowlerId, rules)` — single-pass O(n) accumulator
- `getCurrentPartnership(ballLog, bat1, bat2)` — includes all extras (byes, wides) while pair is at crease
- `isInningsComplete(innings, rules)` — all out, overs done, or declared
- `computeManOfMatch(match)` — batting + bowling point totals, returns ranked player list

---

## Google Play

ScoreFlow Cricket is being submitted to Google Play as a TWA (Trusted Web Activity).
Target URL: https://kareemschultz.github.io/scoreflow-cricket/

---

## Contributing

Personal project. Open an issue with the match scenario if you find a bug.

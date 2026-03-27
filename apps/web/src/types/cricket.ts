// ─── Formats & Status ────────────────────────────────────────────────────────

export type CricketFormat = "T20" | "ODI" | "TEST" | "CUSTOM"
export type MatchStatus = "setup" | "live" | "completed" | "abandoned"
export type TossDecision = "bat" | "bowl"
export type InningsStatus = "live" | "completed" | "declared"
export type TournamentFormat = "ROUND_ROBIN" | "KNOCKOUT" | "GROUP_KNOCKOUT"
export type TournamentStatus = "upcoming" | "live" | "completed"
export type TournamentStage = "group" | "quarter" | "semi" | "final"
export type FixtureResult = "team1" | "team2" | "tie" | "abandoned" | null

// ─── Dismissals & Extras ─────────────────────────────────────────────────────

export type DismissalType =
  | "bowled"
  | "caught"
  | "lbw"
  | "runOut"
  | "stumped"
  | "hitWicket"
  | "caughtAndBowled"
  | "retiredHurt"      // not a wicket
  | "retiredOut"       // counts as a wicket
  | "obstructingField"
  | "hitBallTwice"
  | "timedOut"
  | "handledBall"

export type ExtraType = "wide" | "noBall" | "bye" | "legBye" | "penaltyBatting" | "penaltyBowling"

export const DISMISSAL_LABELS: Record<DismissalType, string> = {
  bowled: "Bowled",
  caught: "Caught",
  lbw: "LBW",
  runOut: "Run Out",
  stumped: "Stumped",
  hitWicket: "Hit Wicket",
  caughtAndBowled: "Caught & Bowled",
  retiredHurt: "Retired Hurt",
  retiredOut: "Retired Out",
  obstructingField: "Obstructing the Field",
  hitBallTwice: "Hit Ball Twice",
  timedOut: "Timed Out",
  handledBall: "Handled Ball",
}

// Dismissals that count as a wicket (retiredHurt does NOT)
export const WICKET_DISMISSALS: DismissalType[] = [
  "bowled", "caught", "lbw", "runOut", "stumped",
  "hitWicket", "caughtAndBowled", "retiredOut",
  "obstructingField", "hitBallTwice", "timedOut", "handledBall",
]

// On a free hit, only run out is valid
export const FREE_HIT_DISMISSALS: DismissalType[] = ["runOut", "obstructingField", "handledBall"]

// Dismissals that involve a specific fielder
export const FIELDER_REQUIRED: DismissalType[] = ["caught", "runOut", "stumped"]

// Dismissals that involve the bowler (for dismissal text)
export const BOWLER_CREDITED: DismissalType[] = [
  "bowled", "caught", "lbw", "stumped",
  "hitWicket", "caughtAndBowled",
]

// ─── Match Rules ─────────────────────────────────────────────────────────────

export interface MatchRules {
  oversPerInnings: number | null    // null = unlimited (Test/declared)
  maxOversPerBowler: number | null  // null = no limit
  ballsPerOver: number              // default 6
  maxWickets: number                // default 10 (team size - 1)
  wideReball: boolean               // wide = re-bowl? default true
  noBallReball: boolean             // no-ball = re-bowl? default true
  wideRuns: number                  // runs added for wide (default 1)
  noBallRuns: number                // runs added for no-ball (default 1)
  freeHitOnNoBall: boolean          // default true
  legByesEnabled: boolean           // default true
  byesEnabled: boolean              // default true
  lastManStands: boolean            // last batter can bat alone
  superOverOnTie: boolean           // offer super over if tied
  retiredHurtCanReturn: boolean     // can come back to bat?
  penaltyRunsEnabled: boolean       // 5-run penalty support
  inningsPerSide: number            // 1 for limited, 2 for Test
  powerplayEnabled: boolean         // track powerplay overs
  powerplayOvers: number            // how many powerplay overs (default 6)
}

export const DEFAULT_RULES: Record<CricketFormat, MatchRules> = {
  T20: {
    oversPerInnings: 20,
    maxOversPerBowler: 4,
    ballsPerOver: 6,
    maxWickets: 10,
    wideReball: true,
    noBallReball: true,
    wideRuns: 1,
    noBallRuns: 1,
    freeHitOnNoBall: true,
    legByesEnabled: true,
    byesEnabled: true,
    lastManStands: false,
    superOverOnTie: true,
    retiredHurtCanReturn: true,
    penaltyRunsEnabled: true,
    inningsPerSide: 1,
    powerplayEnabled: true,
    powerplayOvers: 6,
  },
  ODI: {
    oversPerInnings: 50,
    maxOversPerBowler: 10,
    ballsPerOver: 6,
    maxWickets: 10,
    wideReball: true,
    noBallReball: true,
    wideRuns: 1,
    noBallRuns: 1,
    freeHitOnNoBall: true,
    legByesEnabled: true,
    byesEnabled: true,
    lastManStands: false,
    superOverOnTie: true,
    retiredHurtCanReturn: true,
    penaltyRunsEnabled: true,
    inningsPerSide: 1,
    powerplayEnabled: true,
    powerplayOvers: 10,
  },
  TEST: {
    oversPerInnings: null,
    maxOversPerBowler: null,
    ballsPerOver: 6,
    maxWickets: 10,
    wideReball: true,
    noBallReball: true,
    wideRuns: 1,
    noBallRuns: 1,
    freeHitOnNoBall: false,
    legByesEnabled: true,
    byesEnabled: true,
    lastManStands: false,
    superOverOnTie: false,
    retiredHurtCanReturn: true,
    penaltyRunsEnabled: true,
    inningsPerSide: 2,
    powerplayEnabled: false,
    powerplayOvers: 0,
  },
  CUSTOM: {
    oversPerInnings: 10,
    maxOversPerBowler: 2,
    ballsPerOver: 6,
    maxWickets: 10,
    wideReball: true,
    noBallReball: true,
    wideRuns: 1,
    noBallRuns: 1,
    freeHitOnNoBall: true,
    legByesEnabled: true,
    byesEnabled: true,
    lastManStands: false,
    superOverOnTie: true,
    retiredHurtCanReturn: true,
    penaltyRunsEnabled: false,
    inningsPerSide: 1,
    powerplayEnabled: false,
    powerplayOvers: 0,
  },
}

// ─── Entities ────────────────────────────────────────────────────────────────

export interface Team {
  id: string
  name: string
  shortName?: string           // e.g. "WI" for display
  colorHex?: string            // team color for charts
  createdAt: Date
}

export interface Player {
  id: string
  name: string
  teamId: string
  battingStyle?: "right" | "left"
  bowlingStyle?: string        // e.g. "Right-arm fast"
  role?: "batsman" | "bowler" | "allrounder" | "wicketkeeper"
  createdAt: Date
}

// ─── Ball event ───────────────────────────────────────────────────────────────

export interface Ball {
  id: string
  inningsIndex: number
  overNumber: number           // 0-indexed
  ballInOver: number           // 0-indexed (legal deliveries only for display)
  deliveryNumber: number       // actual delivery count (including extras)
  batsmanId: string
  bowlerId: string
  runs: number                 // total runs on this ball (batting + extras)
  batsmanRuns: number          // runs credited to batsman
  extraRuns: number            // runs credited to extras
  isExtra: boolean
  extraType?: ExtraType
  isLegal: boolean             // false for wide / no-ball (with reball rule)
  isWicket: boolean
  dismissalType?: DismissalType
  dismissedPlayerId?: string
  fielderId?: string           // catcher, fielder for run out etc.
  dismissalText?: string       // e.g. "c Smith b Jones"
  isFreeHit: boolean           // was THIS delivery a free hit?
  nextIsFreeHit: boolean       // does the NEXT ball get a free hit?
  isNoBallBatRuns: boolean     // batsman ran on a no-ball
  wagonZone?: number           // 1-8 wagon wheel zone (optional)
  overthrows?: number          // runs scored via fielding overthrows (annotation, NOT extras)
  powerplay: boolean           // was this in the powerplay?
  timestamp: Date
}

// ─── Scorecard entries ────────────────────────────────────────────────────────

export interface BatsmanEntry {
  playerId: string
  playerName: string
  position: number             // batting position (1-indexed)
  runs: number
  balls: number
  fours: number
  sixes: number
  dots: number
  strikeRate: number
  isOut: boolean
  isRetiredHurt: boolean
  dismissalType?: DismissalType
  dismissalText: string        // "c Smith b Jones" or "not out" etc.
  comeInOver?: number          // over when they came to bat
  comeInScore?: number         // team score when they came to bat
}

export interface BowlerEntry {
  playerId: string
  playerName: string
  overs: number                // completed overs
  balls: number                // balls in current incomplete over (0-5)
  maidens: number
  runs: number
  wickets: number
  economy: number
  dots: number
  wides: number
  noBalls: number
  legalDeliveries: number
}

// ─── Partnership & Fall of Wickets ───────────────────────────────────────────

export interface Partnership {
  batsman1Id: string
  batsman2Id: string
  runs: number
  balls: number
  batsman1Runs: number
  batsman2Runs: number
  startScore: number
  endScore: number
  wicketNumber: number         // 0 = opening, 1 = 1st wicket partnership, etc.
}

export interface FallOfWicket {
  wicketNumber: number         // 1-indexed
  score: number
  overs: string                // e.g. "16.3"
  playerId: string
  playerName: string
  dismissalText: string
}

// ─── Innings ──────────────────────────────────────────────────────────────────

export interface ExtrasBreakdown {
  wide: number
  noBall: number
  bye: number
  legBye: number
  penalty: number
  total: number
}

export interface Innings {
  index: number                // 0, 1, 2, 3 (for Tests)
  battingTeamId: string
  bowlingTeamId: string
  status: InningsStatus
  totalRuns: number
  totalWickets: number
  totalOvers: number           // completed overs
  totalBalls: number           // balls in current incomplete over
  totalLegalDeliveries: number
  extras: ExtrasBreakdown
  battingCard: BatsmanEntry[]
  bowlingCard: BowlerEntry[]
  ballLog: Ball[]
  fallOfWickets: FallOfWicket[]
  partnerships: Partnership[]
  target?: number              // set for 2nd innings onward
  isDeclared: boolean
}

// ─── Match ────────────────────────────────────────────────────────────────────

export interface Match {
  id: string
  format: CricketFormat
  rules: MatchRules
  team1Id: string
  team2Id: string
  team1Name: string
  team2Name: string
  playingXI1: string[]         // playerIds for team1
  playingXI2: string[]         // playerIds for team2
  tossWonBy: string            // teamId
  tossDecision: TossDecision
  innings: Innings[]
  currentInningsIndex: number
  result?: string              // "Team A won by 44 runs" etc.
  winner?: string              // teamId or "tie"
  manOfMatch?: string          // playerId
  venue?: string
  date: Date
  status: MatchStatus
  tournamentId?: string        // if part of a tournament
  tournamentFixtureId?: string
  isSuperOver: boolean
  parentMatchId?: string       // if this is a super over, the parent match
  captainTeam1Id?: string      // playerId serving as captain for team1 in this match
  captainTeam2Id?: string      // playerId serving as captain for team2 in this match
  wicketKeeperTeam1Id?: string // playerId keeping wicket for team1 in this match
  wicketKeeperTeam2Id?: string // playerId keeping wicket for team2 in this match
}

// ─── Player Stats (aggregated) ───────────────────────────────────────────────

export interface PlayerBattingStats {
  playerId: string
  playerName: string
  format: CricketFormat | "ALL"
  matches: number
  innings: number
  notOuts: number
  runs: number
  highScore: number
  highScoreNotOut: boolean
  average: number
  strikeRate: number
  fifties: number
  hundreds: number
  fours: number
  sixes: number
  ducks: number
  dots: number
  lastUpdated: Date
}

export interface PlayerBowlingStats {
  playerId: string
  playerName: string
  format: CricketFormat | "ALL"
  matches: number
  innings: number
  overs: number
  balls: number
  maidens: number
  runs: number
  wickets: number
  average: number
  economy: number
  strikeRate: number
  bestWickets: number
  bestRuns: number
  threeWicketHauls: number
  fiveWicketHauls: number
  dots: number
  lastUpdated: Date
}

// ─── Tournament ───────────────────────────────────────────────────────────────

export interface TournamentGroup {
  name: string                 // "Group A", "Group B" etc.
  teamIds: string[]
}

export interface TournamentStanding {
  teamId: string
  teamName: string
  played: number
  won: number
  lost: number
  tied: number
  abandoned: number
  points: number
  runsFor: number
  oversFor: number
  runsAgainst: number
  oversAgainst: number
  nrr: number                  // Net Run Rate
}

export interface TournamentFixture {
  id: string
  tournamentId: string
  matchId?: string
  team1Id: string
  team2Id: string
  round: number
  stage: TournamentStage
  groupName?: string
  scheduledDate?: Date
  result: FixtureResult
  pointsTeam1?: number
  pointsTeam2?: number
}

export interface Tournament {
  id: string
  name: string
  format: TournamentFormat
  matchFormat: CricketFormat
  rules: MatchRules
  teamIds: string[]
  groups?: TournamentGroup[]
  fixtures: TournamentFixture[]
  status: TournamentStatus
  pointsPerWin: number         // default 2
  pointsPerTie: number         // default 1
  pointsPerAbandoned: number   // default 1
  createdAt: Date
  completedAt?: Date
}

// ─── App Settings ─────────────────────────────────────────────────────────────

export interface AppSettings {
  defaultFormat: CricketFormat
  defaultRules: Partial<MatchRules>
  theme: "dark" | "light" | "system"
  hapticFeedback: boolean
  wakeLock: boolean
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export type StatFilter = CricketFormat | "ALL"

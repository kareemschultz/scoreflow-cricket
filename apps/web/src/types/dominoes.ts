// ─── Dominoes Types ──────────────────────────────────────────────────────────

export interface DominoPlayer {
  id: string
  name: string
  colorHex: string
  createdAt: Date
}

export interface DominoTeam {
  id: string
  name: string
  player1Id: string
  player2Id: string
  colorHex: string
  createdAt: Date
}

export type DominoScoringMode = "hands" | "points"

export interface DominoMatch {
  id: string
  date: Date
  scoringMode: DominoScoringMode
  /** For "hands" mode: first to this many hands wins (typically 6) */
  targetHands: number
  /** For "points" mode: first to this score wins (typically 100 or 200) */
  targetPoints: number
  team1Id: string
  team2Id: string
  /** Hand-by-hand log */
  hands: DominoHand[]
  /** Final scores */
  team1Score: number
  team2Score: number
  winnerId: string | null
  status: "live" | "completed" | "abandoned"
  notes?: string
}

export interface DominoHand {
  handNumber: number
  winnerId: string | null
  /** How the hand ended */
  endType: "domino" | "pose" | "draw"
  /** Player who played their last tile (if domino win) */
  dominoedByPlayerId?: string
  /** Points scored this hand (pip count of losing tiles) */
  points: number
  /** Which players passed/knocked during this hand */
  passes: string[]
}

// ─── Computed Stats ──────────────────────────────────────────────────────────

export interface DominoPlayerStats {
  playerId: string
  name: string
  colorHex: string
  matchesPlayed: number
  matchesWon: number
  matchesLost: number
  winRate: number
  handsPlayed: number
  handsWon: number
  handWinRate: number
  timesDominoed: number
  posesWon: number
  totalPasses: number
  passesPerHand: number
  sixLoves: number
  totalPointsScored: number
  form: Array<"W" | "L">
  currentStreak: number
  bestStreak: number
}

export interface DominoTeamStats {
  teamId: string
  name: string
  colorHex: string
  player1Name: string
  player2Name: string
  matchesPlayed: number
  matchesWon: number
  matchesLost: number
  winRate: number
  handsWon: number
  handsLost: number
  handWinRate: number
  dominoes: number
  posesWon: number
  sixLoves: number
  totalPointsScored: number
  form: Array<"W" | "L">
  currentStreak: number
  bestStreak: number
}

export interface DominoH2HRecord {
  opponentId: string
  opponentName: string
  opponentColor: string
  won: number
  lost: number
  handsWon: number
  handsLost: number
}

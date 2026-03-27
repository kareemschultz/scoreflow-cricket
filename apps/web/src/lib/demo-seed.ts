import { db } from "@/db/index"
import type {
  Team,
  Player,
  Match,
  Ball,
  BatsmanEntry,
  BowlerEntry,
  FallOfWicket,
  Innings,
} from "@/types/cricket"
import { DEFAULT_RULES } from "@/types/cricket"
import { updatePlayerStatsFromMatch } from "@/lib/stats-calculator"

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

function mkPlayer(name: string, teamId: string): Player {
  return {
    id: uid(),
    name,
    teamId,
    role: "batsman",
    battingStyle: "right",
    createdAt: new Date("2026-01-01"),
  }
}

function mkBall(
  overrides: Partial<Ball> & Pick<Ball, "inningsIndex" | "overNumber" | "batsmanId" | "bowlerId">
): Ball {
  return {
    id: uid(),
    ballInOver: 0,
    deliveryNumber: 0,
    runs: 0,
    batsmanRuns: 0,
    extraRuns: 0,
    isExtra: false,
    isLegal: true,
    isWicket: false,
    isFreeHit: false,
    nextIsFreeHit: false,
    isNoBallBatRuns: false,
    powerplay: false,
    timestamp: new Date("2026-01-15"),
    ...overrides,
  }
}

export async function seedDemoMatch(): Promise<string | null> {
  // Check if demo data already exists
  const existing = await db.teams.where("name").equals("Royals").first()
  if (existing) return null

  // ── Teams ──────────────────────────────────────────────────────────────────
  const royalsId = uid()
  const warriorsId = uid()

  const royals: Team = {
    id: royalsId,
    name: "Royals",
    shortName: "ROY",
    colorHex: "#3b82f6",
    createdAt: new Date("2026-01-01"),
  }
  const warriors: Team = {
    id: warriorsId,
    name: "Warriors",
    shortName: "WAR",
    colorHex: "#f59e0b",
    createdAt: new Date("2026-01-01"),
  }

  // ── Players — Royals ───────────────────────────────────────────────────────
  const royalsPlayers: Player[] = [
    mkPlayer("Dwayne Fletcher",  royalsId),
    mkPlayer("Marcus Brathwaite", royalsId),
    mkPlayer("Andre Ramsaran",   royalsId),
    mkPlayer("Rohan Persad",     royalsId),
    mkPlayer("Keon Charles",     royalsId),
    mkPlayer("Fabian St. Hill",  royalsId),
    mkPlayer("Tyrone Baptiste",  royalsId),
    mkPlayer("Jerome Walcott",   royalsId),
    mkPlayer("Clive Hooper",     royalsId),
    mkPlayer("Ravi Seepersad",   royalsId),
    mkPlayer("Vikram Narine",    royalsId),
  ]

  // ── Players — Warriors ─────────────────────────────────────────────────────
  const warriorsPlayers: Player[] = [
    mkPlayer("Sanjay Ramkhelawan", warriorsId),
    mkPlayer("Darren Phillip",     warriorsId),
    mkPlayer("Curtis Julien",      warriorsId),
    mkPlayer("Anil Beharry",       warriorsId),
    mkPlayer("Shane Cummins",      warriorsId),
    mkPlayer("Devon Mohammed",     warriorsId),
    mkPlayer("Ricardo King",       warriorsId),
    mkPlayer("Omari Pascal",       warriorsId),
    mkPlayer("Dexter Griffith",    warriorsId),
    mkPlayer("Patrick Boodoo",     warriorsId),
    mkPlayer("Lester Ramoutar",    warriorsId),
  ]

  const rp = royalsPlayers
  const wp = warriorsPlayers

  // ── Match ID ───────────────────────────────────────────────────────────────
  const matchId = uid()
  const rules = DEFAULT_RULES.T20

  // ── Ball Log helpers ───────────────────────────────────────────────────────
  // We'll create 2 overs (12 balls) of ball-by-ball data per innings
  // Innings 1 (Royals bat): 167/6 in 20 overs
  // Innings 2 (Warriors bat): 142/8 in 20 overs

  // Innings 1 ball log: over 0 and over 1
  const i1balls: Ball[] = []
  const bowlerId_w1 = wp[0].id // Sanjay
  const bowlerId_w2 = wp[1].id // Darren

  // Over 0 bowled by Sanjay: 1,4,0,1,6,2 → 14 runs
  const over0runs = [1, 4, 0, 1, 6, 2]
  over0runs.forEach((r, idx) => {
    i1balls.push(mkBall({
      inningsIndex: 0,
      overNumber: 0,
      ballInOver: idx,
      deliveryNumber: idx,
      batsmanId: rp[0].id,
      bowlerId: bowlerId_w1,
      runs: r,
      batsmanRuns: r,
      isLegal: true,
      powerplay: true,
    }))
  })

  // Over 1 bowled by Darren: 0,2,W,1,4,1 → 8 runs, 1 wicket (rp[0] out bowled)
  const over1data: Array<{ runs: number; isW: boolean; batsman: string }> = [
    { runs: 0, isW: false, batsman: rp[0].id },
    { runs: 2, isW: false, batsman: rp[0].id },
    { runs: 0, isW: true,  batsman: rp[0].id },
    { runs: 1, isW: false, batsman: rp[1].id },
    { runs: 4, isW: false, batsman: rp[1].id },
    { runs: 1, isW: false, batsman: rp[1].id },
  ]
  over1data.forEach((d, idx) => {
    const ball = mkBall({
      inningsIndex: 0,
      overNumber: 1,
      ballInOver: idx,
      deliveryNumber: 6 + idx,
      batsmanId: d.batsman,
      bowlerId: bowlerId_w2,
      runs: d.runs,
      batsmanRuns: d.runs,
      isLegal: true,
      powerplay: true,
    })
    if (d.isW) {
      ball.isWicket = true
      ball.dismissalType = "bowled"
      ball.dismissedPlayerId = rp[0].id
      ball.dismissalText = `b ${wp[1].name}`
      ball.runs = 0
      ball.batsmanRuns = 0
    }
    i1balls.push(ball)
  })

  // ── Innings 1 batting card ────────────────────────────────────────────────
  const innings1BattingCard: BatsmanEntry[] = [
    { playerId: rp[0].id, playerName: rp[0].name, position: 1, runs: 28, balls: 22, fours: 3, sixes: 1, dots: 8, strikeRate: 127.27, isOut: true, isRetiredHurt: false, dismissalType: "bowled", dismissalText: `b ${wp[1].name}` },
    { playerId: rp[1].id, playerName: rp[1].name, position: 2, runs: 45, balls: 32, fours: 4, sixes: 2, dots: 9, strikeRate: 140.63, isOut: true, isRetiredHurt: false, dismissalType: "caught", dismissalText: `c ${wp[3].name} b ${wp[0].name}` },
    { playerId: rp[2].id, playerName: rp[2].name, position: 3, runs: 38, balls: 29, fours: 3, sixes: 1, dots: 10, strikeRate: 131.03, isOut: true, isRetiredHurt: false, dismissalType: "lbw", dismissalText: `lbw b ${wp[2].name}` },
    { playerId: rp[3].id, playerName: rp[3].name, position: 4, runs: 22, balls: 18, fours: 2, sixes: 0, dots: 7, strikeRate: 122.22, isOut: true, isRetiredHurt: false, dismissalType: "runOut", dismissalText: `run out (${wp[5].name})` },
    { playerId: rp[4].id, playerName: rp[4].name, position: 5, runs: 15, balls: 11, fours: 1, sixes: 1, dots: 4, strikeRate: 136.36, isOut: true, isRetiredHurt: false, dismissalType: "caught", dismissalText: `c ${wp[6].name} b ${wp[1].name}` },
    { playerId: rp[5].id, playerName: rp[5].name, position: 6, runs: 12, balls: 9,  fours: 1, sixes: 0, dots: 4, strikeRate: 133.33, isOut: true, isRetiredHurt: false, dismissalType: "stumped", dismissalText: `st ${wp[7].name} b ${wp[4].name}` },
    { playerId: rp[6].id, playerName: rp[6].name, position: 7, runs: 7,  balls: 6,  fours: 0, sixes: 0, dots: 3, strikeRate: 116.67, isOut: false, isRetiredHurt: false, dismissalText: "not out" },
  ]

  // ── Innings 1 bowling card ─────────────────────────────────────────────────
  const innings1BowlingCard: BowlerEntry[] = [
    { playerId: wp[0].id, playerName: wp[0].name, overs: 4, balls: 0, maidens: 0, runs: 38, wickets: 1, economy: 9.5,  dots: 8,  wides: 2, noBalls: 0, legalDeliveries: 24 },
    { playerId: wp[1].id, playerName: wp[1].name, overs: 4, balls: 0, maidens: 0, runs: 32, wickets: 2, economy: 8.0,  dots: 10, wides: 1, noBalls: 0, legalDeliveries: 24 },
    { playerId: wp[2].id, playerName: wp[2].name, overs: 4, balls: 0, maidens: 1, runs: 28, wickets: 1, economy: 7.0,  dots: 12, wides: 0, noBalls: 0, legalDeliveries: 24 },
    { playerId: wp[3].id, playerName: wp[3].name, overs: 4, balls: 0, maidens: 0, runs: 35, wickets: 1, economy: 8.75, dots: 7,  wides: 3, noBalls: 1, legalDeliveries: 24 },
    { playerId: wp[4].id, playerName: wp[4].name, overs: 4, balls: 0, maidens: 0, runs: 34, wickets: 1, economy: 8.5,  dots: 9,  wides: 1, noBalls: 0, legalDeliveries: 24 },
  ]

  // ── Innings 1 fall of wickets ──────────────────────────────────────────────
  const innings1FOW: FallOfWicket[] = [
    { wicketNumber: 1, score: 46,  overs: "7.3",  playerId: rp[0].id, playerName: rp[0].name, dismissalText: innings1BattingCard[0].dismissalText },
    { wicketNumber: 2, score: 89,  overs: "12.1", playerId: rp[1].id, playerName: rp[1].name, dismissalText: innings1BattingCard[1].dismissalText },
    { wicketNumber: 3, score: 118, overs: "15.4", playerId: rp[2].id, playerName: rp[2].name, dismissalText: innings1BattingCard[2].dismissalText },
    { wicketNumber: 4, score: 138, overs: "17.2", playerId: rp[3].id, playerName: rp[3].name, dismissalText: innings1BattingCard[3].dismissalText },
    { wicketNumber: 5, score: 151, overs: "18.5", playerId: rp[4].id, playerName: rp[4].name, dismissalText: innings1BattingCard[4].dismissalText },
    { wicketNumber: 6, score: 160, overs: "19.3", playerId: rp[5].id, playerName: rp[5].name, dismissalText: innings1BattingCard[5].dismissalText },
  ]

  // ── Innings 2 ball log ─────────────────────────────────────────────────────
  const i2balls: Ball[] = []
  const bowlerId_r1 = rp[8].id // Clive Hooper
  const bowlerId_r2 = rp[9].id // Ravi Seepersad

  // Over 0 bowled by Clive: 2,0,4,1,0,3 → 10 runs
  const i2over0runs = [2, 0, 4, 1, 0, 3]
  i2over0runs.forEach((r, idx) => {
    i2balls.push(mkBall({
      inningsIndex: 1,
      overNumber: 0,
      ballInOver: idx,
      deliveryNumber: idx,
      batsmanId: wp[0].id,
      bowlerId: bowlerId_r1,
      runs: r,
      batsmanRuns: r,
      isLegal: true,
      powerplay: true,
    }))
  })

  // Over 1 bowled by Ravi: 1,W,0,6,2,1 → 10 runs, 1 wicket
  const i2over1data: Array<{ runs: number; isW: boolean; batsman: string }> = [
    { runs: 1, isW: false, batsman: wp[0].id },
    { runs: 0, isW: true,  batsman: wp[0].id },
    { runs: 0, isW: false, batsman: wp[1].id },
    { runs: 6, isW: false, batsman: wp[1].id },
    { runs: 2, isW: false, batsman: wp[1].id },
    { runs: 1, isW: false, batsman: wp[1].id },
  ]
  i2over1data.forEach((d, idx) => {
    const ball = mkBall({
      inningsIndex: 1,
      overNumber: 1,
      ballInOver: idx,
      deliveryNumber: 6 + idx,
      batsmanId: d.batsman,
      bowlerId: bowlerId_r2,
      runs: d.runs,
      batsmanRuns: d.runs,
      isLegal: true,
      powerplay: true,
    })
    if (d.isW) {
      ball.isWicket = true
      ball.dismissalType = "caught"
      ball.dismissedPlayerId = wp[0].id
      ball.dismissalText = `c ${rp[3].name} b ${rp[9].name}`
      ball.runs = 0
      ball.batsmanRuns = 0
    }
    i2balls.push(ball)
  })

  // ── Innings 2 batting card ─────────────────────────────────────────────────
  const innings2BattingCard: BatsmanEntry[] = [
    { playerId: wp[0].id, playerName: wp[0].name, position: 1, runs: 18, balls: 14, fours: 2, sixes: 1, dots: 5, strikeRate: 128.57, isOut: true, isRetiredHurt: false, dismissalType: "caught", dismissalText: `c ${rp[3].name} b ${rp[9].name}` },
    { playerId: wp[1].id, playerName: wp[1].name, position: 2, runs: 41, balls: 30, fours: 3, sixes: 2, dots: 8, strikeRate: 136.67, isOut: true, isRetiredHurt: false, dismissalType: "bowled", dismissalText: `b ${rp[8].name}` },
    { playerId: wp[2].id, playerName: wp[2].name, position: 3, runs: 29, balls: 23, fours: 2, sixes: 1, dots: 7, strikeRate: 126.09, isOut: true, isRetiredHurt: false, dismissalType: "lbw", dismissalText: `lbw b ${rp[10].name}` },
    { playerId: wp[3].id, playerName: wp[3].name, position: 4, runs: 17, balls: 14, fours: 1, sixes: 0, dots: 5, strikeRate: 121.43, isOut: true, isRetiredHurt: false, dismissalType: "caught", dismissalText: `c ${rp[1].name} b ${rp[10].name}` },
    { playerId: wp[4].id, playerName: wp[4].name, position: 5, runs: 14, balls: 12, fours: 1, sixes: 0, dots: 4, strikeRate: 116.67, isOut: true, isRetiredHurt: false, dismissalType: "runOut", dismissalText: `run out (${rp[4].name})` },
    { playerId: wp[5].id, playerName: wp[5].name, position: 6, runs: 9,  balls: 8,  fours: 0, sixes: 1, dots: 3, strikeRate: 112.50, isOut: true, isRetiredHurt: false, dismissalType: "stumped", dismissalText: `st ${rp[6].name} b ${rp[9].name}` },
    { playerId: wp[6].id, playerName: wp[6].name, position: 7, runs: 8,  balls: 7,  fours: 1, sixes: 0, dots: 3, strikeRate: 114.29, isOut: true, isRetiredHurt: false, dismissalType: "bowled", dismissalText: `b ${rp[8].name}` },
    { playerId: wp[7].id, playerName: wp[7].name, position: 8, runs: 4,  balls: 5,  fours: 0, sixes: 0, dots: 3, strikeRate: 80.0,   isOut: true, isRetiredHurt: false, dismissalType: "caught", dismissalText: `c ${rp[0].name} b ${rp[10].name}` },
    { playerId: wp[8].id, playerName: wp[8].name, position: 9, runs: 2,  balls: 4,  fours: 0, sixes: 0, dots: 3, strikeRate: 50.0,   isOut: false, isRetiredHurt: false, dismissalText: "not out" },
  ]

  // ── Innings 2 bowling card ─────────────────────────────────────────────────
  const innings2BowlingCard: BowlerEntry[] = [
    { playerId: rp[8].id,  playerName: rp[8].name,  overs: 4, balls: 0, maidens: 0, runs: 29, wickets: 2, economy: 7.25, dots: 10, wides: 1, noBalls: 0, legalDeliveries: 24 },
    { playerId: rp[9].id,  playerName: rp[9].name,  overs: 4, balls: 0, maidens: 1, runs: 24, wickets: 2, economy: 6.0,  dots: 12, wides: 0, noBalls: 0, legalDeliveries: 24 },
    { playerId: rp[10].id, playerName: rp[10].name, overs: 4, balls: 0, maidens: 0, runs: 31, wickets: 3, economy: 7.75, dots: 9,  wides: 2, noBalls: 0, legalDeliveries: 24 },
    { playerId: rp[7].id,  playerName: rp[7].name,  overs: 4, balls: 0, maidens: 0, runs: 34, wickets: 1, economy: 8.5,  dots: 7,  wides: 1, noBalls: 1, legalDeliveries: 24 },
    { playerId: rp[6].id,  playerName: rp[6].name,  overs: 4, balls: 0, maidens: 0, runs: 24, wickets: 0, economy: 6.0,  dots: 11, wides: 0, noBalls: 0, legalDeliveries: 24 },
  ]

  // ── Innings 2 fall of wickets ──────────────────────────────────────────────
  const innings2FOW: FallOfWicket[] = [
    { wicketNumber: 1, score: 26,  overs: "4.1",  playerId: wp[0].id, playerName: wp[0].name, dismissalText: innings2BattingCard[0].dismissalText },
    { wicketNumber: 2, score: 62,  overs: "9.3",  playerId: wp[1].id, playerName: wp[1].name, dismissalText: innings2BattingCard[1].dismissalText },
    { wicketNumber: 3, score: 86,  overs: "13.2", playerId: wp[2].id, playerName: wp[2].name, dismissalText: innings2BattingCard[2].dismissalText },
    { wicketNumber: 4, score: 102, overs: "15.5", playerId: wp[3].id, playerName: wp[3].name, dismissalText: innings2BattingCard[3].dismissalText },
    { wicketNumber: 5, score: 113, overs: "17.1", playerId: wp[4].id, playerName: wp[4].name, dismissalText: innings2BattingCard[4].dismissalText },
    { wicketNumber: 6, score: 121, overs: "18.2", playerId: wp[5].id, playerName: wp[5].name, dismissalText: innings2BattingCard[5].dismissalText },
    { wicketNumber: 7, score: 131, overs: "19.1", playerId: wp[6].id, playerName: wp[6].name, dismissalText: innings2BattingCard[6].dismissalText },
    { wicketNumber: 8, score: 139, overs: "19.5", playerId: wp[7].id, playerName: wp[7].name, dismissalText: innings2BattingCard[7].dismissalText },
  ]

  // ── Assemble innings ───────────────────────────────────────────────────────
  const innings1: Innings = {
    index: 0,
    battingTeamId: royalsId,
    bowlingTeamId: warriorsId,
    status: "completed",
    totalRuns: 167,
    totalWickets: 6,
    totalOvers: 20,
    totalBalls: 0,
    totalLegalDeliveries: 120,
    extras: { wide: 7, noBall: 1, bye: 0, legBye: 2, penalty: 0, total: 10 },
    battingCard: innings1BattingCard,
    bowlingCard: innings1BowlingCard,
    ballLog: i1balls,
    fallOfWickets: innings1FOW,
    partnerships: [],
    isDeclared: false,
  }

  const innings2: Innings = {
    index: 1,
    battingTeamId: warriorsId,
    bowlingTeamId: royalsId,
    status: "completed",
    totalRuns: 142,
    totalWickets: 8,
    totalOvers: 20,
    totalBalls: 0,
    totalLegalDeliveries: 120,
    extras: { wide: 4, noBall: 1, bye: 0, legBye: 1, penalty: 0, total: 6 },
    battingCard: innings2BattingCard,
    bowlingCard: innings2BowlingCard,
    ballLog: i2balls,
    fallOfWickets: innings2FOW,
    partnerships: [],
    target: 168,
    isDeclared: false,
  }

  const playingXI1 = rp.map((p) => p.id)
  const playingXI2 = wp.map((p) => p.id)

  const match: Match = {
    id: matchId,
    format: "T20",
    rules,
    team1Id: royalsId,
    team2Id: warriorsId,
    team1Name: "Royals",
    team2Name: "Warriors",
    playingXI1,
    playingXI2,
    tossWonBy: royalsId,
    tossDecision: "bat",
    innings: [innings1, innings2],
    currentInningsIndex: 1,
    result: "Royals won by 25 runs",
    winner: royalsId,
    date: new Date("2026-01-15"),
    status: "completed",
    isSuperOver: false,
  }

  // ── Write to DB ────────────────────────────────────────────────────────────
  await db.transaction("rw", [db.teams, db.players, db.matches], async () => {
    await db.teams.bulkAdd([royals, warriors])
    await db.players.bulkAdd([...royalsPlayers, ...warriorsPlayers])
    await db.matches.add(match)
  })

  // Update player stats
  try {
    await updatePlayerStatsFromMatch(match)
  } catch {
    // Non-fatal
  }

  return matchId
}

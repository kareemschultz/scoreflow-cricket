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

// ─── Full ball log generator ──────────────────────────────────────────────────

interface OverSpec {
  bowlerId: string
  ballRuns: number[]  // 6 values; 0 on the wicket ball
  wicketBall: number  // index of wicket ball (-1 = no wicket)
}

function buildInningsBalls(
  inningsIdx: number,
  overSpecs: OverSpec[],
  batQueue: string[],  // batting order — opener1, opener2, #3, #4 …
): Ball[] {
  const result: Ball[] = []
  const queue = [...batQueue]
  let sIdx = 0       // striker index in queue
  let nsIdx = 1      // non-striker index
  let nextIn = 2     // next batsman to come in on wicket
  let delivery = 0

  for (let overNum = 0; overNum < overSpecs.length; overNum++) {
    const { bowlerId, ballRuns, wicketBall } = overSpecs[overNum]

    for (let bi = 0; bi < 6; bi++) {
      const runs = ballRuns[bi]
      const isW = bi === wicketBall

      const ball = mkBall({
        inningsIndex: inningsIdx,
        overNumber: overNum,
        ballInOver: bi,
        deliveryNumber: delivery++,
        batsmanId: queue[sIdx],
        bowlerId,
        runs,
        batsmanRuns: runs,
        isLegal: true,
        powerplay: overNum < 6,
      })

      if (isW) {
        ball.isWicket = true
        ball.dismissalType = "caught"
        ball.dismissedPlayerId = queue[sIdx]
        ball.dismissalText = "c & b (demo)"
        ball.runs = 0
        ball.batsmanRuns = 0
        if (nextIn < queue.length) queue[sIdx] = queue[nextIn++]
      } else if (runs % 2 === 1) {
        ;[sIdx, nsIdx] = [nsIdx, sIdx]  // odd runs = strike rotates
      }

      result.push(ball)
    }
    // End of over: non-striker faces next
    ;[sIdx, nsIdx] = [nsIdx, sIdx]
  }

  return result
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

  // ── Ball Log — full 20 overs per innings ──────────────────────────────────
  // Each bowler bowls overs [n, n+5, n+10, n+15] — no consecutive overs

  // Innings 1 (Royals bat, 167/6): 5 Warriors bowlers × 4 overs each
  // Bowler rotation: over % 5 → wp[0..4]
  const i1BowlerIds = [wp[0].id,wp[1].id,wp[2].id,wp[3].id,wp[4].id]
  const i1OverSpecs: OverSpec[] = [
    // Powerplay overs 0-5 (total 53)
    { bowlerId: i1BowlerIds[0], ballRuns: [0,1,4,2,1,1], wicketBall: -1 }, // 9
    { bowlerId: i1BowlerIds[1], ballRuns: [1,6,0,1,2,2], wicketBall: -1 }, // 12
    { bowlerId: i1BowlerIds[2], ballRuns: [0,2,1,0,2,2], wicketBall: -1 }, // 7
    { bowlerId: i1BowlerIds[3], ballRuns: [2,0,4,0,1,1], wicketBall: -1 }, // 8
    { bowlerId: i1BowlerIds[4], ballRuns: [0,1,2,0,4,2], wicketBall: -1 }, // 9
    { bowlerId: i1BowlerIds[0], ballRuns: [0,4,0,1,2,1], wicketBall: -1 }, // 8
    // Middle overs 6-14 (total 66)
    { bowlerId: i1BowlerIds[1], ballRuns: [2,0,1,1,2,1], wicketBall: -1 }, // 7
    { bowlerId: i1BowlerIds[2], ballRuns: [1,0,0,0,2,2], wicketBall:  2 }, // 5 W
    { bowlerId: i1BowlerIds[3], ballRuns: [0,2,0,2,1,2], wicketBall: -1 }, // 7
    { bowlerId: i1BowlerIds[4], ballRuns: [0,4,0,2,1,1], wicketBall: -1 }, // 8
    { bowlerId: i1BowlerIds[0], ballRuns: [0,2,4,0,1,1], wicketBall: -1 }, // 8
    { bowlerId: i1BowlerIds[1], ballRuns: [0,2,0,2,1,1], wicketBall: -1 }, // 6
    { bowlerId: i1BowlerIds[2], ballRuns: [1,0,2,0,2,2], wicketBall:  1 }, // 7 W
    { bowlerId: i1BowlerIds[3], ballRuns: [2,0,4,0,1,2], wicketBall: -1 }, // 9
    { bowlerId: i1BowlerIds[4], ballRuns: [1,2,0,0,2,4], wicketBall:  3 }, // 9 W
    // Death overs 15-19 (total 48)
    { bowlerId: i1BowlerIds[0], ballRuns: [4,1,0,1,2,1], wicketBall:  2 }, // 9 W
    { bowlerId: i1BowlerIds[1], ballRuns: [2,0,4,0,1,4], wicketBall: -1 }, // 11
    { bowlerId: i1BowlerIds[2], ballRuns: [0,4,1,2,0,1], wicketBall:  4 }, // 8 W
    { bowlerId: i1BowlerIds[3], ballRuns: [1,2,4,0,2,1], wicketBall:  3 }, // 10 W
    { bowlerId: i1BowlerIds[4], ballRuns: [2,1,4,0,2,1], wicketBall: -1 }, // 10
  ]
  // Batting order for innings 1: rp[0]..rp[10]
  const i1balls = buildInningsBalls(0, i1OverSpecs, rp.map(p => p.id))

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

  // Innings 2 (Warriors bat, 142/8): 5 Royals bowlers × 4 overs each
  // Bowler rotation: [rp8,rp9,rp10,rp7,rp6] cycling by over % 5
  const i2BowlerIds = [rp[8].id,rp[9].id,rp[10].id,rp[7].id,rp[6].id]
  const i2OverSpecs: OverSpec[] = [
    // Powerplay overs 0-5 (total 42)
    { bowlerId: i2BowlerIds[0], ballRuns: [2,0,1,0,4,1], wicketBall: -1 }, // 8
    { bowlerId: i2BowlerIds[1], ballRuns: [0,1,0,2,0,4], wicketBall: -1 }, // 7
    { bowlerId: i2BowlerIds[2], ballRuns: [1,2,0,1,0,2], wicketBall: -1 }, // 6
    { bowlerId: i2BowlerIds[3], ballRuns: [0,0,4,0,1,2], wicketBall:  3 }, // 7 W
    { bowlerId: i2BowlerIds[4], ballRuns: [2,0,1,0,2,1], wicketBall: -1 }, // 6
    { bowlerId: i2BowlerIds[0], ballRuns: [0,2,0,4,0,2], wicketBall: -1 }, // 8
    // Middle overs 6-14 (total 62)
    { bowlerId: i2BowlerIds[1], ballRuns: [2,0,2,1,2,1], wicketBall: -1 }, // 8
    { bowlerId: i2BowlerIds[2], ballRuns: [1,0,0,2,2,2], wicketBall:  2 }, // 7 W
    { bowlerId: i2BowlerIds[3], ballRuns: [0,1,2,0,2,0], wicketBall: -1 }, // 5
    { bowlerId: i2BowlerIds[4], ballRuns: [2,0,4,0,2,1], wicketBall: -1 }, // 9
    { bowlerId: i2BowlerIds[0], ballRuns: [0,0,2,4,0,1], wicketBall:  1 }, // 7 W
    { bowlerId: i2BowlerIds[1], ballRuns: [2,0,2,0,2,2], wicketBall: -1 }, // 8
    { bowlerId: i2BowlerIds[2], ballRuns: [0,1,0,0,2,4], wicketBall:  3 }, // 7 W
    { bowlerId: i2BowlerIds[3], ballRuns: [2,0,0,0,1,1], wicketBall: -1 }, // 4
    { bowlerId: i2BowlerIds[4], ballRuns: [1,2,0,2,0,2], wicketBall: -1 }, // 7
    // Death overs 15-19 (total 38)
    { bowlerId: i2BowlerIds[0], ballRuns: [0,0,4,2,0,3], wicketBall:  1 }, // 9 W
    { bowlerId: i2BowlerIds[1], ballRuns: [2,0,0,4,1,2], wicketBall:  2 }, // 9 W
    { bowlerId: i2BowlerIds[2], ballRuns: [1,2,0,0,4,1], wicketBall:  3 }, // 8 W
    { bowlerId: i2BowlerIds[3], ballRuns: [0,2,0,4,0,1], wicketBall:  0 }, // 7 W
    { bowlerId: i2BowlerIds[4], ballRuns: [1,1,2,0,1,0], wicketBall: -1 }, // 5
  ]
  // Batting order for innings 2: wp[0]..wp[10]
  const i2balls = buildInningsBalls(1, i2OverSpecs, wp.map(p => p.id))

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

// ─── FIFA Demo Data ───────────────────────────────────────────────────────────

import type { FifaPlayer, FifaMatch } from "@/types/fifa"

/**
 * Seeds 5 FIFA players + 20 matches of demo data.
 * Returns true if data was inserted, false if already present.
 */
export async function seedDemoFifaData(): Promise<boolean> {
  const existing = await db.fifaPlayers.count()
  if (existing > 0) return false

  const p0 = uid(), p1 = uid(), p2 = uid(), p3 = uid(), p4 = uid()

  const players: FifaPlayer[] = [
    { id: p0, name: "Kareem",  colorHex: "#3b82f6", createdAt: new Date("2025-10-01") },
    { id: p1, name: "Marcus",  colorHex: "#ef4444", createdAt: new Date("2025-10-01") },
    { id: p2, name: "Andre",   colorHex: "#22c55e", createdAt: new Date("2025-10-01") },
    { id: p3, name: "Rohan",   colorHex: "#a855f7", createdAt: new Date("2025-10-01") },
    { id: p4, name: "Sanjay",  colorHex: "#f59e0b", createdAt: new Date("2025-10-01") },
  ]

  // [p1Id, p2Id, p1Score, p2Score, date]
  type MatchRow = [string, string, number, number, string]
  const rows: MatchRow[] = [
    [p0, p1, 3, 1, "2025-11-01"],
    [p2, p3, 2, 2, "2025-11-03"],
    [p1, p2, 4, 2, "2025-11-05"],
    [p0, p3, 5, 3, "2025-11-08"],
    [p4, p1, 2, 3, "2025-11-10"],
    [p0, p2, 1, 1, "2025-11-12"],
    [p3, p4, 4, 1, "2025-11-15"],
    [p1, p4, 3, 2, "2025-11-17"],
    [p2, p0, 1, 4, "2025-11-20"],
    [p4, p3, 2, 2, "2025-11-22"],
    [p0, p4, 6, 2, "2025-11-25"],
    [p1, p3, 2, 3, "2025-11-28"],
    [p2, p4, 3, 1, "2025-12-01"],
    [p0, p1, 2, 4, "2025-12-05"],
    [p3, p2, 3, 3, "2025-12-08"],
    [p4, p0, 1, 3, "2025-12-12"],
    [p1, p2, 2, 2, "2025-12-15"],
    [p3, p0, 1, 2, "2025-12-18"],
    [p4, p2, 4, 3, "2025-12-22"],
    [p0, p3, 3, 1, "2025-12-25"],
  ]

  const matches: FifaMatch[] = rows.map(([player1Id, player2Id, player1Score, player2Score, date]) => ({
    id: uid(),
    player1Id,
    player2Id,
    player1Score,
    player2Score,
    date: new Date(date),
  }))

  await db.transaction("rw", [db.fifaPlayers, db.fifaMatches], async () => {
    await db.fifaPlayers.bulkAdd(players)
    await db.fifaMatches.bulkAdd(matches)
  })

  return true
}

// ─── Dominoes Demo Data ───────────────────────────────────────────────────────

import type { DominoPlayer, DominoTeam, DominoMatch, DominoHand } from "@/types/dominoes"

/**
 * Seeds 4 domino players + 2 teams + 3 completed matches of demo data.
 * Returns true if data was inserted, false if already present.
 */
export async function seedDemoDominoData(): Promise<boolean> {
  const existing = await db.dominoPlayers.count()
  if (existing > 0) return false

  const p0 = uid(), p1 = uid(), p2 = uid(), p3 = uid()

  const players: DominoPlayer[] = [
    { id: p0, name: "Kareem",  colorHex: "#3b82f6", createdAt: new Date("2026-01-01") },
    { id: p1, name: "Marcus",  colorHex: "#ef4444", createdAt: new Date("2026-01-01") },
    { id: p2, name: "Andre",   colorHex: "#22c55e", createdAt: new Date("2026-01-01") },
    { id: p3, name: "Rohan",   colorHex: "#a855f7", createdAt: new Date("2026-01-01") },
  ]

  const t0 = uid(), t1 = uid()

  const teams: DominoTeam[] = [
    { id: t0, name: "Blue Tiles", player1Id: p0, player2Id: p2, colorHex: "#3b82f6", createdAt: new Date("2026-01-01") },
    { id: t1, name: "Red Kings",  player1Id: p1, player2Id: p3, colorHex: "#ef4444", createdAt: new Date("2026-01-01") },
  ]

  const mkHands = (winnerId: string, loserId: string, count: number): DominoHand[] =>
    Array.from({ length: count }, (_, i) => ({
      handNumber: i + 1,
      winnerId: i % 3 === 2 ? loserId : winnerId,
      endType: (i % 2 === 0 ? "domino" : "pose") as DominoHand["endType"],
      points: 10 + (i * 5) % 30,
      passes: [],
    }))

  const matches: DominoMatch[] = [
    {
      id: uid(),
      date: new Date("2026-02-10"),
      scoringMode: "hands",
      targetHands: 6,
      targetPoints: 100,
      team1Id: t0,
      team2Id: t1,
      hands: mkHands(t0, t1, 8),
      team1Score: 6,
      team2Score: 2,
      winnerId: t0,
      status: "completed",
    },
    {
      id: uid(),
      date: new Date("2026-02-17"),
      scoringMode: "hands",
      targetHands: 6,
      targetPoints: 100,
      team1Id: t1,
      team2Id: t0,
      hands: mkHands(t1, t0, 9),
      team1Score: 6,
      team2Score: 3,
      winnerId: t1,
      status: "completed",
    },
    {
      id: uid(),
      date: new Date("2026-02-24"),
      scoringMode: "hands",
      targetHands: 6,
      targetPoints: 100,
      team1Id: t0,
      team2Id: t1,
      hands: mkHands(t0, t1, 7),
      team1Score: 6,
      team2Score: 1,
      winnerId: t0,
      status: "completed",
    },
  ]

  await db.transaction("rw", [db.dominoPlayers, db.dominoTeams, db.dominoMatches], async () => {
    await db.dominoPlayers.bulkAdd(players)
    await db.dominoTeams.bulkAdd(teams)
    await db.dominoMatches.bulkAdd(matches)
  })

  return true
}

// ─── Trump Demo Data ──────────────────────────────────────────────────────────

import type { TrumpPlayer, TrumpTeam, TrumpMatch, TrumpHand } from "@/types/trump"

/**
 * Seeds 4 trump players + 2 teams + 3 completed matches of demo data.
 * Returns true if data was inserted, false if already present.
 */
export async function seedDemoTrumpData(): Promise<boolean> {
  const existing = await db.trumpPlayers.count()
  if (existing > 0) return false

  const p0 = uid(), p1 = uid(), p2 = uid(), p3 = uid()

  const players: TrumpPlayer[] = [
    { id: p0, name: "Kareem",  colorHex: "#3b82f6", createdAt: new Date("2026-01-01") },
    { id: p1, name: "Marcus",  colorHex: "#ef4444", createdAt: new Date("2026-01-01") },
    { id: p2, name: "Sanjay",  colorHex: "#22c55e", createdAt: new Date("2026-01-01") },
    { id: p3, name: "Rohan",   colorHex: "#a855f7", createdAt: new Date("2026-01-01") },
  ]

  const t0 = uid(), t1 = uid()

  const teams: TrumpTeam[] = [
    { id: t0, name: "Spade Force", player1Id: p0, player2Id: p2, colorHex: "#3b82f6", createdAt: new Date("2026-01-01") },
    { id: t1, name: "Heart Club",  player1Id: p1, player2Id: p3, colorHex: "#ef4444", createdAt: new Date("2026-01-01") },
  ]

  const suits: TrumpHand["trumpSuit"][] = ["spades", "hearts", "diamonds", "clubs"]

  const mkTrumpHands = (winner: string, loser: string, count: number): TrumpHand[] =>
    Array.from({ length: count }, (_, i) => ({
      handNumber: i + 1,
      trumpSuit: suits[i % 4],
      dealerTeamId: i % 2 === 0 ? t0 : t1,
      begged: i % 3 === 0,
      kicked: false,
      gaveOne: i % 3 === 0,
      highTeamId: i % 2 === 0 ? winner : loser,
      lowTeamId: i % 2 === 0 ? loser : winner,
      jackTeamId: i % 3 === 0 ? winner : loser,
      gameTeamId: winner,
      hangJack: false,
      hangJackTeamId: null,
      team1Points: winner === t0 ? 3 : 1,
      team2Points: winner === t1 ? 3 : 1,
    }))

  const matches: TrumpMatch[] = [
    {
      id: uid(),
      date: new Date("2026-02-12"),
      targetScore: 14,
      team1Id: t0,
      team2Id: t1,
      hands: mkTrumpHands(t0, t1, 5),
      team1Score: 14,
      team2Score: 7,
      winnerId: t0,
      status: "completed",
    },
    {
      id: uid(),
      date: new Date("2026-02-19"),
      targetScore: 14,
      team1Id: t1,
      team2Id: t0,
      hands: mkTrumpHands(t1, t0, 6),
      team1Score: 14,
      team2Score: 8,
      winnerId: t1,
      status: "completed",
    },
    {
      id: uid(),
      date: new Date("2026-02-26"),
      targetScore: 14,
      team1Id: t0,
      team2Id: t1,
      hands: mkTrumpHands(t0, t1, 4),
      team1Score: 14,
      team2Score: 5,
      winnerId: t0,
      status: "completed",
    },
  ]

  await db.transaction("rw", [db.trumpPlayers, db.trumpTeams, db.trumpMatches], async () => {
    await db.trumpPlayers.bulkAdd(players)
    await db.trumpTeams.bulkAdd(teams)
    await db.trumpMatches.bulkAdd(matches)
  })

  return true
}

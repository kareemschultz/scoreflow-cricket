import { describe, it, expect } from "vitest"
import {
  formatOvers,
  parsedOvers,
  isLegalDelivery,
  isOverComplete,
  getBatsmanRuns,
  getBowlerRuns,
  shouldSwapStrikeAfterBall,
  isMaidenOver,
  canBowl,
  getRemainingBalls,
  getRequiredRunRate,
  getCurrentRunRate,
  getCurrentPartnership,
  buildDismissalText,
  isTied,
  isInningsComplete,
} from "./cricket-engine"
import type { Ball, Innings, MatchRules } from "@/types/cricket"

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BASE_RULES: MatchRules = {
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
}

function makeBall(overrides: Partial<Ball> = {}): Ball {
  return {
    id: "test-id",
    inningsIndex: 0,
    overNumber: 0,
    ballInOver: 0,
    deliveryNumber: 0,
    batsmanId: "bat1",
    bowlerId: "bowl1",
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
    timestamp: new Date(),
    ...overrides,
  }
}

// ─── formatOvers ──────────────────────────────────────────────────────────────

describe("formatOvers", () => {
  it("returns whole number for complete overs", () => {
    expect(formatOvers(6)).toBe("1")   // 6 balls = 1 over
    expect(formatOvers(12)).toBe("2")  // 12 balls = 2 overs
    expect(formatOvers(36)).toBe("6")  // 36 balls = 6 overs
    expect(formatOvers(0)).toBe("0")
  })

  it("returns over.ball notation for partial overs", () => {
    expect(formatOvers(7)).toBe("1.1")
    expect(formatOvers(10)).toBe("1.4")
    expect(formatOvers(98)).toBe("16.2")
  })

  it("respects custom ballsPerOver", () => {
    expect(formatOvers(8, 8)).toBe("1")
    expect(formatOvers(9, 8)).toBe("1.1")
  })
})

// ─── parsedOvers ──────────────────────────────────────────────────────────────

describe("parsedOvers", () => {
  it("parses whole over strings", () => {
    expect(parsedOvers("6")).toBe(36)
    expect(parsedOvers("20")).toBe(120)
    expect(parsedOvers("0")).toBe(0)
  })

  it("parses over.ball notation", () => {
    expect(parsedOvers("16.3")).toBe(99)  // 16*6+3
    expect(parsedOvers("1.1")).toBe(7)
    expect(parsedOvers("0.4")).toBe(4)
  })

  it("handles NaN/invalid gracefully", () => {
    expect(parsedOvers("")).toBe(0)
    expect(parsedOvers("abc")).toBe(0)
    expect(parsedOvers("abc.def")).toBe(0)
  })

  it("is inverse of formatOvers for round-trip", () => {
    for (const balls of [0, 1, 7, 35, 36, 99, 120]) {
      expect(parsedOvers(formatOvers(balls))).toBe(balls)
    }
  })
})

// ─── isLegalDelivery ──────────────────────────────────────────────────────────

describe("isLegalDelivery", () => {
  it("normal delivery is legal", () => {
    const ball = makeBall({ isExtra: false })
    expect(isLegalDelivery(ball, BASE_RULES)).toBe(true)
  })

  it("wide is NOT legal when wideReball=true", () => {
    const ball = makeBall({ isExtra: true, extraType: "wide", isLegal: false })
    expect(isLegalDelivery(ball, BASE_RULES)).toBe(false)
  })

  it("wide IS legal when wideReball=false", () => {
    const rules = { ...BASE_RULES, wideReball: false }
    const ball = makeBall({ isExtra: true, extraType: "wide", isLegal: true })
    expect(isLegalDelivery(ball, rules)).toBe(true)
  })

  it("no-ball is NOT legal when noBallReball=true", () => {
    const ball = makeBall({ isExtra: true, extraType: "noBall", isLegal: false })
    expect(isLegalDelivery(ball, BASE_RULES)).toBe(false)
  })

  it("bye is legal", () => {
    const ball = makeBall({ isExtra: true, extraType: "bye", isLegal: true })
    expect(isLegalDelivery(ball, BASE_RULES)).toBe(true)
  })

  it("leg bye is legal", () => {
    const ball = makeBall({ isExtra: true, extraType: "legBye", isLegal: true })
    expect(isLegalDelivery(ball, BASE_RULES)).toBe(true)
  })
})

// ─── isOverComplete ───────────────────────────────────────────────────────────

describe("isOverComplete", () => {
  it("returns false with fewer than 6 legal balls", () => {
    const log = Array.from({ length: 5 }, (_, i) =>
      makeBall({ overNumber: 0, isLegal: true, deliveryNumber: i })
    )
    expect(isOverComplete(log, 0, BASE_RULES)).toBe(false)
  })

  it("returns true with exactly 6 legal balls", () => {
    const log = Array.from({ length: 6 }, (_, i) =>
      makeBall({ overNumber: 0, isLegal: true, deliveryNumber: i })
    )
    expect(isOverComplete(log, 0, BASE_RULES)).toBe(true)
  })

  it("ignores illegal deliveries (wides) when counting", () => {
    const legal = Array.from({ length: 6 }, (_, i) =>
      makeBall({ overNumber: 0, isLegal: true, deliveryNumber: i })
    )
    const wide = makeBall({ overNumber: 0, isLegal: false, extraType: "wide", deliveryNumber: 6 })
    expect(isOverComplete([...legal, wide], 0, BASE_RULES)).toBe(true)
  })

  it("does not count balls from other overs", () => {
    const log = Array.from({ length: 6 }, (_, i) =>
      makeBall({ overNumber: 1, isLegal: true, deliveryNumber: i })
    )
    expect(isOverComplete(log, 0, BASE_RULES)).toBe(false)
  })
})

// ─── getBatsmanRuns / getBowlerRuns ───────────────────────────────────────────

describe("getBatsmanRuns", () => {
  it("returns batsmanRuns for normal delivery", () => {
    const ball = makeBall({ batsmanRuns: 4, runs: 4 })
    expect(getBatsmanRuns(ball)).toBe(4)
  })

  it("returns 0 for bye", () => {
    const ball = makeBall({ isExtra: true, extraType: "bye", batsmanRuns: 0, runs: 2 })
    expect(getBatsmanRuns(ball)).toBe(0)
  })

  it("returns 0 for leg bye", () => {
    const ball = makeBall({ isExtra: true, extraType: "legBye", batsmanRuns: 0, runs: 1 })
    expect(getBatsmanRuns(ball)).toBe(0)
  })

  it("returns 0 for wide", () => {
    const ball = makeBall({ isExtra: true, extraType: "wide", batsmanRuns: 0, runs: 1 })
    expect(getBatsmanRuns(ball)).toBe(0)
  })
})

describe("getBowlerRuns", () => {
  it("returns full runs for normal delivery", () => {
    const ball = makeBall({ runs: 4, batsmanRuns: 4 })
    expect(getBowlerRuns(ball)).toBe(4)
  })

  it("returns 0 for bye (not charged to bowler)", () => {
    const ball = makeBall({ isExtra: true, extraType: "bye", runs: 2, batsmanRuns: 0 })
    expect(getBowlerRuns(ball)).toBe(0)
  })

  it("returns 0 for leg bye (not charged to bowler)", () => {
    const ball = makeBall({ isExtra: true, extraType: "legBye", runs: 2, batsmanRuns: 0 })
    expect(getBowlerRuns(ball)).toBe(0)
  })

  it("returns runs for wide (charged to bowler)", () => {
    const ball = makeBall({ isExtra: true, extraType: "wide", runs: 1, batsmanRuns: 0 })
    expect(getBowlerRuns(ball)).toBe(1)
  })

  it("returns runs for no-ball (charged to bowler)", () => {
    const ball = makeBall({ isExtra: true, extraType: "noBall", runs: 1, batsmanRuns: 0 })
    expect(getBowlerRuns(ball)).toBe(1)
  })
})

// ─── shouldSwapStrikeAfterBall ────────────────────────────────────────────────

describe("shouldSwapStrikeAfterBall", () => {
  it("swaps for odd bat runs (1)", () => {
    expect(shouldSwapStrikeAfterBall(makeBall({ batsmanRuns: 1, runs: 1 }))).toBe(true)
  })

  it("swaps for odd bat runs (3)", () => {
    expect(shouldSwapStrikeAfterBall(makeBall({ batsmanRuns: 3, runs: 3 }))).toBe(true)
  })

  it("does NOT swap for even bat runs (0)", () => {
    expect(shouldSwapStrikeAfterBall(makeBall({ batsmanRuns: 0, runs: 0 }))).toBe(false)
  })

  it("does NOT swap for even bat runs (4)", () => {
    expect(shouldSwapStrikeAfterBall(makeBall({ batsmanRuns: 4, runs: 4 }))).toBe(false)
  })

  // ── Byes ───────────────────────────────────────────────────────────────────

  it("swaps for 1 bye (batters physically ran 1)", () => {
    const bye = makeBall({ isExtra: true, extraType: "bye", extraRuns: 1, batsmanRuns: 0, runs: 1 })
    expect(shouldSwapStrikeAfterBall(bye)).toBe(true)
  })

  it("does NOT swap for 2 byes (even running)", () => {
    const bye = makeBall({ isExtra: true, extraType: "bye", extraRuns: 2, batsmanRuns: 0, runs: 2 })
    expect(shouldSwapStrikeAfterBall(bye)).toBe(false)
  })

  it("swaps for 3 leg byes", () => {
    const lb = makeBall({ isExtra: true, extraType: "legBye", extraRuns: 3, batsmanRuns: 0, runs: 3 })
    expect(shouldSwapStrikeAfterBall(lb)).toBe(true)
  })

  // ── Wides ──────────────────────────────────────────────────────────────────

  it("does NOT swap for plain wide (penalty=1, no running, extraRuns=1)", () => {
    const wide = makeBall({ isExtra: true, extraType: "wide", extraRuns: 1, batsmanRuns: 0, runs: 1 })
    expect(shouldSwapStrikeAfterBall(wide, 1)).toBe(false)
  })

  it("swaps for wide + 1 extra run (extraRuns=2, 1 physical run)", () => {
    const wide = makeBall({ isExtra: true, extraType: "wide", extraRuns: 2, batsmanRuns: 0, runs: 2 })
    expect(shouldSwapStrikeAfterBall(wide, 1)).toBe(true)
  })

  it("does NOT swap for wide + 2 extra runs (extraRuns=3, 2 physical runs = even)", () => {
    const wide = makeBall({ isExtra: true, extraType: "wide", extraRuns: 3, batsmanRuns: 0, runs: 3 })
    expect(shouldSwapStrikeAfterBall(wide, 1)).toBe(false)
  })

  // ── No-balls ────────────────────────────────────────────────────────────────

  it("swaps for no-ball with 1 bat run", () => {
    const nb = makeBall({ isExtra: true, extraType: "noBall", batsmanRuns: 1, extraRuns: 1, runs: 2 })
    expect(shouldSwapStrikeAfterBall(nb)).toBe(true)
  })

  it("does NOT swap for no-ball with 0 bat runs", () => {
    const nb = makeBall({ isExtra: true, extraType: "noBall", batsmanRuns: 0, extraRuns: 1, runs: 1 })
    expect(shouldSwapStrikeAfterBall(nb)).toBe(false)
  })
})

// ─── isMaidenOver ─────────────────────────────────────────────────────────────

describe("isMaidenOver", () => {
  it("returns true for 6 dot balls", () => {
    const balls = Array.from({ length: 6 }, () => makeBall({ runs: 0, batsmanRuns: 0 }))
    expect(isMaidenOver(balls)).toBe(true)
  })

  it("returns false if any runs scored", () => {
    const balls = [
      ...Array.from({ length: 5 }, () => makeBall({ runs: 0 })),
      makeBall({ runs: 1, batsmanRuns: 1 }),
    ]
    expect(isMaidenOver(balls)).toBe(false)
  })

  it("returns false if wide included (not all legal)", () => {
    const balls = [
      ...Array.from({ length: 6 }, () => makeBall({ runs: 0, isLegal: true })),
      makeBall({ isExtra: true, extraType: "wide", runs: 1, isLegal: false }),
    ]
    expect(isMaidenOver(balls)).toBe(false)
  })
})

// ─── canBowl ──────────────────────────────────────────────────────────────────

describe("canBowl", () => {
  it("prevents consecutive bowling", () => {
    expect(canBowl("bowl1", "bowl1", {}, BASE_RULES)).toBe(false)
  })

  it("allows a different bowler", () => {
    expect(canBowl("bowl2", "bowl1", {}, BASE_RULES)).toBe(true)
  })

  it("blocks bowler at max overs", () => {
    expect(canBowl("bowl2", "bowl1", { bowl2: 4 }, BASE_RULES)).toBe(false)
  })

  it("allows bowler just under max overs", () => {
    expect(canBowl("bowl2", "bowl1", { bowl2: 3 }, BASE_RULES)).toBe(true)
  })

  it("allows unlimited when maxOversPerBowler is null", () => {
    const rules = { ...BASE_RULES, maxOversPerBowler: null }
    expect(canBowl("bowl2", "bowl1", { bowl2: 100 }, rules)).toBe(true)
  })
})

// ─── getRemainingBalls ────────────────────────────────────────────────────────

describe("getRemainingBalls", () => {
  const makeInnings = (legalBalls: number) => ({
    ballLog: Array.from({ length: legalBalls }, () => makeBall({ isLegal: true })),
  } as any)

  it("returns null for unlimited overs (Test)", () => {
    const rules = { ...BASE_RULES, oversPerInnings: null }
    expect(getRemainingBalls(makeInnings(0), rules)).toBeNull()
  })

  it("returns full ball count at start of innings", () => {
    expect(getRemainingBalls(makeInnings(0), BASE_RULES)).toBe(120) // 20*6
  })

  it("decrements as balls are bowled", () => {
    expect(getRemainingBalls(makeInnings(10), BASE_RULES)).toBe(110)
  })

  it("clamps to 0 (never negative)", () => {
    expect(getRemainingBalls(makeInnings(121), BASE_RULES)).toBe(0)
  })
})

// ─── getRequiredRunRate ───────────────────────────────────────────────────────

describe("getRequiredRunRate", () => {
  it("returns Infinity when no balls remaining", () => {
    expect(getRequiredRunRate(50, 0)).toBe(Infinity)
  })

  it("calculates correct RRR", () => {
    // 60 runs needed from 12 balls = 5 runs/ball × 6 = 30 RRR
    expect(getRequiredRunRate(60, 12)).toBe(30)
  })

  it("handles exactly achievable target", () => {
    // 6 runs needed from 6 balls = 1 per ball = 6 RRR
    expect(getRequiredRunRate(6, 6)).toBe(6)
  })
})

// ─── getCurrentRunRate ────────────────────────────────────────────────────────

describe("getCurrentRunRate", () => {
  it("returns 0 when no balls bowled yet", () => {
    expect(getCurrentRunRate(0, 0)).toBe(0)
  })

  it("calculates CRR correctly", () => {
    // 36 runs from 12 balls = 3 per ball × 6 = 18 CRR
    expect(getCurrentRunRate(36, 12)).toBe(18)
  })

  it("works with 6-ball over", () => {
    expect(getCurrentRunRate(6, 6)).toBe(6)
  })
})

// ─── buildDismissalText ───────────────────────────────────────────────────────

describe("buildDismissalText", () => {
  it("bowled format", () => {
    expect(buildDismissalText("bowled", "Jones")).toBe("b Jones")
  })

  it("caught format with fielder", () => {
    expect(buildDismissalText("caught", "Jones", "Smith")).toBe("c Smith b Jones")
  })

  it("caught with unknown fielder", () => {
    expect(buildDismissalText("caught", "Jones")).toBe("c ? b Jones")
  })

  it("caught and bowled", () => {
    expect(buildDismissalText("caughtAndBowled", "Jones")).toBe("c & b Jones")
  })

  it("lbw format", () => {
    expect(buildDismissalText("lbw", "Jones")).toBe("lbw b Jones")
  })

  it("stumped with keeper", () => {
    expect(buildDismissalText("stumped", "Jones", "Patel")).toBe("st Patel b Jones")
  })

  it("run out without fielder", () => {
    expect(buildDismissalText("runOut", "Jones")).toBe("run out")
  })

  it("run out with fielder", () => {
    expect(buildDismissalText("runOut", "Jones", "Smith")).toBe("run out (Smith)")
  })

  it("retired hurt", () => {
    expect(buildDismissalText("retiredHurt", "Jones")).toBe("retired hurt")
  })
})

// ─── isTied ───────────────────────────────────────────────────────────────────

describe("isTied", () => {
  it("returns true when scores are equal", () => {
    expect(isTied(142, 142)).toBe(true)
  })

  it("returns false when scores differ", () => {
    expect(isTied(142, 143)).toBe(false)
    expect(isTied(0, 1)).toBe(false)
  })
})

// ─── getCurrentPartnership ───────────────────────────────────────────────────

describe("getCurrentPartnership", () => {
  it("includes extras in partnership runs", () => {
    const ballLog = [
      makeBall({ batsmanId: "bat1", runs: 1, batsmanRuns: 1 }),
      makeBall({ batsmanId: "bat2", runs: 2, batsmanRuns: 2 }),
      makeBall({
        batsmanId: "bat1",
        runs: 1,
        batsmanRuns: 0,
        extraRuns: 1,
        isExtra: true,
        extraType: "bye",
      }),
      makeBall({
        batsmanId: "bat2",
        runs: 2,
        batsmanRuns: 1,
        extraRuns: 1,
        isExtra: true,
        extraType: "noBall",
        isLegal: false,
      }),
    ]

    const p = getCurrentPartnership(ballLog, "bat1", "bat2", 0, 6)

    expect(p.runs).toBe(6)
    expect(p.batsman1Runs).toBe(1)
    expect(p.batsman2Runs).toBe(3)
    expect(p.balls).toBe(3)
  })
})

// ─── isInningsComplete ────────────────────────────────────────────────────────

function makeInnings(overrides: Partial<Innings> = {}): Innings {
  return {
    index: 0,
    battingTeamId: "t1",
    bowlingTeamId: "t2",
    status: "live",
    totalRuns: 0,
    totalWickets: 0,
    totalOvers: 0,
    totalBalls: 0,
    totalLegalDeliveries: 0,
    extras: { wide: 0, noBall: 0, bye: 0, legBye: 0, penalty: 0, total: 0 },
    battingCard: [],
    bowlingCard: [],
    fallOfWickets: [],
    partnerships: [],
    ballLog: [],
    isDeclared: false,
    ...overrides,
  }
}

describe("isInningsComplete", () => {
  it("returns true when innings is declared", () => {
    const innings = makeInnings({ isDeclared: true })
    expect(isInningsComplete(innings, BASE_RULES)).toBe(true)
  })

  it("returns true when target is reached (chase won)", () => {
    // target of 150, batting team has 150 — exactly equal = won
    const innings = makeInnings({ target: 150, totalRuns: 150 })
    expect(isInningsComplete(innings, BASE_RULES)).toBe(true)
  })

  it("returns true when target is exceeded (chase won)", () => {
    const innings = makeInnings({ target: 150, totalRuns: 151 })
    expect(isInningsComplete(innings, BASE_RULES)).toBe(true)
  })

  it("returns false when target is set but not yet reached", () => {
    const innings = makeInnings({ target: 150, totalRuns: 149 })
    expect(isInningsComplete(innings, BASE_RULES)).toBe(false)
  })

  it("returns true when all wickets fallen (maxWickets reached)", () => {
    // BASE_RULES.maxWickets = 10
    const innings = makeInnings({ totalWickets: 10 })
    expect(isInningsComplete(innings, BASE_RULES)).toBe(true)
  })

  it("returns false when wickets fallen but maxWickets not reached", () => {
    // Let's ensure 2 active batsmen so it stays live
    const innings2 = makeInnings({
      totalWickets: 8,
      battingCard: [
        { playerId: "b1", playerName: "B1", runs: 0, balls: 0, fours: 0, sixes: 0, dots: 0, isOut: false, isRetiredHurt: false, strikeRate: 0, position: 1, dismissalText: "not out" },
        { playerId: "b2", playerName: "B2", runs: 0, balls: 0, fours: 0, sixes: 0, dots: 0, isOut: false, isRetiredHurt: false, strikeRate: 0, position: 2, dismissalText: "not out" },
      ],
    })
    expect(isInningsComplete(innings2, BASE_RULES)).toBe(false)
  })

  it("returns true for T20-style overs completion (20 overs bowled)", () => {
    // 20 overs × 6 balls = 120 legal balls
    const legalBalls = Array.from({ length: 120 }, (_, i) =>
      makeBall({ overNumber: Math.floor(i / 6), isLegal: true, deliveryNumber: i })
    )
    const innings = makeInnings({ ballLog: legalBalls })
    expect(isInningsComplete(innings, BASE_RULES)).toBe(true)
  })

  it("returns false when overs are not yet complete", () => {
    // Only 119 of 120 balls bowled
    const legalBalls = Array.from({ length: 119 }, (_, i) =>
      makeBall({ overNumber: Math.floor(i / 6), isLegal: true, deliveryNumber: i })
    )
    const innings = makeInnings({ ballLog: legalBalls })
    expect(isInningsComplete(innings, BASE_RULES)).toBe(false)
  })

  it("returns false when no completion condition is met (innings still live)", () => {
    const innings = makeInnings({
      totalRuns: 50,
      totalWickets: 3,
      battingCard: [
        { playerId: "b1", playerName: "B1", runs: 30, balls: 20, fours: 2, sixes: 0, dots: 5, isOut: false, isRetiredHurt: false, strikeRate: 150, position: 1, dismissalText: "not out" },
        { playerId: "b2", playerName: "B2", runs: 20, balls: 15, fours: 1, sixes: 0, dots: 4, isOut: false, isRetiredHurt: false, strikeRate: 133, position: 2, dismissalText: "not out" },
      ],
      ballLog: Array.from({ length: 30 }, (_, i) =>
        makeBall({ overNumber: Math.floor(i / 6), isLegal: true, deliveryNumber: i })
      ),
    })
    expect(isInningsComplete(innings, BASE_RULES)).toBe(false)
  })

  it("returns false for unlimited-overs match (Test) even when many balls bowled", () => {
    const testRules: MatchRules = { ...BASE_RULES, oversPerInnings: null }
    const manyBalls = Array.from({ length: 300 }, (_, i) =>
      makeBall({ overNumber: Math.floor(i / 6), isLegal: true, deliveryNumber: i })
    )
    const innings = makeInnings({ totalWickets: 5, ballLog: manyBalls })
    // 5 wickets and no over limit — not complete
    expect(isInningsComplete(innings, testRules)).toBe(false)
  })
})

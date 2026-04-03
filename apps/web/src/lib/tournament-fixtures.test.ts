import { describe, expect, it } from "vitest"
import {
  generateNextKnockoutSeeds,
  generateRoundRobinSeeds,
} from "@/lib/tournament-fixtures"

describe("tournament fixtures", () => {
  it("creates every round-robin pairing once for an odd team count", () => {
    const seeds = generateRoundRobinSeeds(["a", "b", "c"])

    expect(seeds).toHaveLength(3)
    expect(
      new Set(seeds.map((seed) => [seed.team1Id, seed.team2Id].sort().join("-")))
    ).toEqual(new Set(["a-b", "a-c", "b-c"]))
  })

  it("creates the next knockout round once all matches in a round are complete", () => {
    const seeds = generateNextKnockoutSeeds([
      { team1Id: "a", team2Id: "b", round: 1, phase: "knockout", result: "team1" },
      { team1Id: "c", team2Id: "d", round: 1, phase: "knockout", result: "team2" },
    ])

    expect(seeds).toEqual([
      { team1Id: "a", team2Id: "d", round: 2, phase: "knockout" },
    ])
  })
})

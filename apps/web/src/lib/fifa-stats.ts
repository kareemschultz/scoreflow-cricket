import type { FifaMatch, FifaPlayer, FifaPlayerStats, FifaH2HRecord } from "@/types/fifa"

export function computeFifaPlayerStats(
  players: FifaPlayer[],
  matches: FifaMatch[]
): FifaPlayerStats[] {
  const statsMap = new Map<string, Omit<FifaPlayerStats, "form" | "winRate">>()

  for (const player of players) {
    statsMap.set(player.id, {
      playerId: player.id,
      name: player.name,
      colorHex: player.colorHex,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
    })
  }

  const resultsByPlayer = new Map<string, Array<"W" | "D" | "L">>()
  for (const player of players) {
    resultsByPlayer.set(player.id, [])
  }

  const sortedMatches = [...matches].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  )

  for (const match of sortedMatches) {
    const p1 = statsMap.get(match.player1Id)
    const p2 = statsMap.get(match.player2Id)
    if (!p1 || !p2) continue

    p1.played++
    p2.played++
    p1.goalsFor += match.player1Score
    p1.goalsAgainst += match.player2Score
    p2.goalsFor += match.player2Score
    p2.goalsAgainst += match.player1Score

    if (match.player1Score > match.player2Score) {
      p1.won++; p1.points += 3; p2.lost++
      resultsByPlayer.get(match.player1Id)!.push("W")
      resultsByPlayer.get(match.player2Id)!.push("L")
    } else if (match.player1Score < match.player2Score) {
      p2.won++; p2.points += 3; p1.lost++
      resultsByPlayer.get(match.player1Id)!.push("L")
      resultsByPlayer.get(match.player2Id)!.push("W")
    } else {
      p1.drawn++; p1.points += 1; p2.drawn++; p2.points += 1
      resultsByPlayer.get(match.player1Id)!.push("D")
      resultsByPlayer.get(match.player2Id)!.push("D")
    }

    p1.goalDifference = p1.goalsFor - p1.goalsAgainst
    p2.goalDifference = p2.goalsFor - p2.goalsAgainst
  }

  const result: FifaPlayerStats[] = []
  for (const player of players) {
    const base = statsMap.get(player.id)
    if (!base) continue
    const results = resultsByPlayer.get(player.id) ?? []
    const form = results.slice(-5)
    const winRate = base.played > 0 ? Math.round((base.won / base.played) * 100) : 0
    result.push({ ...base, form, winRate })
  }

  result.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference
    return b.goalsFor - a.goalsFor
  })

  return result
}

export function computeFifaH2H(
  playerId: string,
  players: FifaPlayer[],
  matches: FifaMatch[]
): FifaH2HRecord[] {
  const playerMap = new Map(players.map((p) => [p.id, p]))
  const h2hMap = new Map<string, FifaH2HRecord>()

  for (const match of matches) {
    let opponentId: string | null = null
    let scored = 0
    let conceded = 0
    let result: "W" | "D" | "L"

    if (match.player1Id === playerId) {
      opponentId = match.player2Id
      scored = match.player1Score
      conceded = match.player2Score
    } else if (match.player2Id === playerId) {
      opponentId = match.player1Id
      scored = match.player2Score
      conceded = match.player1Score
    } else {
      continue
    }

    result = scored > conceded ? "W" : scored < conceded ? "L" : "D"
    const opponent = playerMap.get(opponentId)
    if (!opponent) continue

    if (!h2hMap.has(opponentId)) {
      h2hMap.set(opponentId, {
        opponentId,
        opponentName: opponent.name,
        opponentColor: opponent.colorHex,
        won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0,
      })
    }

    const record = h2hMap.get(opponentId)!
    record.goalsFor += scored
    record.goalsAgainst += conceded
    if (result === "W") record.won++
    else if (result === "D") record.drawn++
    else record.lost++
  }

  return Array.from(h2hMap.values()).sort((a, b) => a.opponentName.localeCompare(b.opponentName))
}

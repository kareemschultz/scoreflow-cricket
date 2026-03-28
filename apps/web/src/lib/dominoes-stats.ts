import type {
  DominoPlayer,
  DominoTeam,
  DominoMatch,
  DominoPlayerStats,
  DominoTeamStats,
  DominoH2HRecord,
} from "@/types/dominoes"

export function computeDominoTeamStats(
  teams: DominoTeam[],
  matches: DominoMatch[],
  players: DominoPlayer[]
): DominoTeamStats[] {
  const playerMap = new Map(players.map((p) => [p.id, p]))
  const sorted = [...matches]
    .filter((m) => m.status === "completed")
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  const stats: DominoTeamStats[] = teams.map((t) => ({
    teamId: t.id,
    name: t.name,
    colorHex: t.colorHex,
    player1Name: playerMap.get(t.player1Id)?.name ?? "Unknown",
    player2Name: playerMap.get(t.player2Id)?.name ?? "Unknown",
    matchesPlayed: 0,
    matchesWon: 0,
    matchesLost: 0,
    winRate: 0,
    handsWon: 0,
    handsLost: 0,
    handWinRate: 0,
    dominoes: 0,
    posesWon: 0,
    sixLoves: 0,
    totalPointsScored: 0,
    form: [],
    currentStreak: 0,
    bestStreak: 0,
  }))

  const statsMap = new Map(stats.map((s) => [s.teamId, s]))

  for (const match of sorted) {
    const t1 = statsMap.get(match.team1Id)
    const t2 = statsMap.get(match.team2Id)
    if (!t1 || !t2) continue

    t1.matchesPlayed++
    t2.matchesPlayed++

    const t1Won = match.winnerId === match.team1Id
    const t2Won = match.winnerId === match.team2Id

    if (t1Won) {
      t1.matchesWon++; t2.matchesLost++
      t1.form.push("W"); t2.form.push("L")
    } else if (t2Won) {
      t2.matchesWon++; t1.matchesLost++
      t2.form.push("W"); t1.form.push("L")
    }

    // Check for six-love
    if (t1Won && match.team2Score === 0) t1.sixLoves++
    if (t2Won && match.team1Score === 0) t2.sixLoves++

    t1.totalPointsScored += match.team1Score
    t2.totalPointsScored += match.team2Score

    for (const hand of match.hands) {
      if (hand.winnerId === match.team1Id) {
        t1.handsWon++; t2.handsLost++
        if (hand.endType === "domino") t1.dominoes++
        if (hand.endType === "pose") t1.posesWon++
      } else if (hand.winnerId === match.team2Id) {
        t2.handsWon++; t1.handsLost++
        if (hand.endType === "domino") t2.dominoes++
        if (hand.endType === "pose") t2.posesWon++
      }
    }
  }

  for (const s of stats) {
    s.winRate = s.matchesPlayed > 0 ? Math.round((s.matchesWon / s.matchesPlayed) * 100) : 0
    const totalHands = s.handsWon + s.handsLost
    s.handWinRate = totalHands > 0 ? Math.round((s.handsWon / totalHands) * 100) : 0
    s.form = s.form.slice(-5)

    // Compute streaks
    let current = 0
    let best = 0
    for (const r of s.form) {
      if (r === "W") { current++; best = Math.max(best, current) }
      else current = 0
    }
    s.currentStreak = current
    s.bestStreak = best
  }

  stats.sort((a, b) => {
    if (b.matchesWon !== a.matchesWon) return b.matchesWon - a.matchesWon
    if (b.winRate !== a.winRate) return b.winRate - a.winRate
    return b.handsWon - a.handsWon
  })

  return stats
}

export function computeDominoPlayerStats(
  players: DominoPlayer[],
  teams: DominoTeam[],
  matches: DominoMatch[]
): DominoPlayerStats[] {
  const completedMatches = matches.filter((m) => m.status === "completed")
  const sorted = [...completedMatches].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  )

  // Map player to their team(s)
  const playerTeams = new Map<string, string[]>()
  for (const t of teams) {
    for (const pid of [t.player1Id, t.player2Id]) {
      const existing = playerTeams.get(pid) ?? []
      existing.push(t.id)
      playerTeams.set(pid, existing)
    }
  }

  const stats: DominoPlayerStats[] = players.map((p) => ({
    playerId: p.id,
    name: p.name,
    colorHex: p.colorHex,
    matchesPlayed: 0,
    matchesWon: 0,
    matchesLost: 0,
    winRate: 0,
    handsPlayed: 0,
    handsWon: 0,
    handWinRate: 0,
    timesDominoed: 0,
    posesWon: 0,
    totalPasses: 0,
    passesPerHand: 0,
    sixLoves: 0,
    totalPointsScored: 0,
    form: [],
    currentStreak: 0,
    bestStreak: 0,
  }))

  const statsMap = new Map(stats.map((s) => [s.playerId, s]))

  for (const match of sorted) {
    // Find which players are on which team in this match
    const team1 = teams.find((t) => t.id === match.team1Id)
    const team2 = teams.find((t) => t.id === match.team2Id)
    if (!team1 || !team2) continue

    const team1Players = [team1.player1Id, team1.player2Id]
    const team2Players = [team2.player1Id, team2.player2Id]

    for (const pid of [...team1Players, ...team2Players]) {
      const s = statsMap.get(pid)
      if (!s) continue

      const isTeam1 = team1Players.includes(pid)
      const myTeamId = isTeam1 ? match.team1Id : match.team2Id
      const myScore = isTeam1 ? match.team1Score : match.team2Score
      const oppScore = isTeam1 ? match.team2Score : match.team1Score

      s.matchesPlayed++
      s.totalPointsScored += myScore

      if (match.winnerId === myTeamId) {
        s.matchesWon++
        s.form.push("W")
        if (oppScore === 0) s.sixLoves++
      } else {
        s.matchesLost++
        s.form.push("L")
      }

      for (const hand of match.hands) {
        s.handsPlayed++
        if (hand.winnerId === myTeamId) {
          s.handsWon++
          if (hand.endType === "pose") s.posesWon++
        }
        if (hand.dominoedByPlayerId === pid) s.timesDominoed++
        s.totalPasses += hand.passes.filter((p) => p === pid).length
      }
    }
  }

  for (const s of stats) {
    s.winRate = s.matchesPlayed > 0 ? Math.round((s.matchesWon / s.matchesPlayed) * 100) : 0
    s.handWinRate = s.handsPlayed > 0 ? Math.round((s.handsWon / s.handsPlayed) * 100) : 0
    s.passesPerHand = s.handsPlayed > 0 ? Math.round((s.totalPasses / s.handsPlayed) * 100) / 100 : 0
    s.form = s.form.slice(-5)

    let current = 0
    let best = 0
    for (const r of s.form) {
      if (r === "W") { current++; best = Math.max(best, current) }
      else current = 0
    }
    s.currentStreak = current
    s.bestStreak = best
  }

  stats.sort((a, b) => {
    if (b.matchesWon !== a.matchesWon) return b.matchesWon - a.matchesWon
    if (b.winRate !== a.winRate) return b.winRate - a.winRate
    return b.handsWon - a.handsWon
  })

  return stats
}

export function computeDominoH2H(
  teamId: string,
  teams: DominoTeam[],
  matches: DominoMatch[]
): DominoH2HRecord[] {
  const teamMap = new Map(teams.map((t) => [t.id, t]))
  const h2hMap = new Map<string, DominoH2HRecord>()

  for (const match of matches.filter((m) => m.status === "completed")) {
    let opponentId: string | null = null
    let myHandsWon = 0
    let oppHandsWon = 0
    let won = false

    if (match.team1Id === teamId) {
      opponentId = match.team2Id
      won = match.winnerId === teamId
    } else if (match.team2Id === teamId) {
      opponentId = match.team1Id
      won = match.winnerId === teamId
    } else {
      continue
    }

    for (const hand of match.hands) {
      if (hand.winnerId === teamId) myHandsWon++
      else if (hand.winnerId === opponentId) oppHandsWon++
    }

    const opponent = teamMap.get(opponentId)
    if (!opponent) continue

    if (!h2hMap.has(opponentId)) {
      h2hMap.set(opponentId, {
        opponentId,
        opponentName: opponent.name,
        opponentColor: opponent.colorHex,
        won: 0,
        lost: 0,
        handsWon: 0,
        handsLost: 0,
      })
    }

    const record = h2hMap.get(opponentId)!
    if (won) record.won++; else record.lost++
    record.handsWon += myHandsWon
    record.handsLost += oppHandsWon
  }

  return Array.from(h2hMap.values()).sort((a, b) => a.opponentName.localeCompare(b.opponentName))
}

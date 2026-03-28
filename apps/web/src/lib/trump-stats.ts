import type {
  TrumpPlayer,
  TrumpTeam,
  TrumpMatch,
  TrumpPlayerStats,
  TrumpTeamStats,
  TrumpH2HRecord,
} from "@/types/trump"

export function computeTrumpTeamStats(
  teams: TrumpTeam[],
  matches: TrumpMatch[],
  players: TrumpPlayer[]
): TrumpTeamStats[] {
  const playerMap = new Map(players.map((p) => [p.id, p]))
  const sorted = [...matches]
    .filter((m) => m.status === "completed")
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  const stats: TrumpTeamStats[] = teams.map((t) => ({
    teamId: t.id,
    name: t.name,
    colorHex: t.colorHex,
    player1Name: playerMap.get(t.player1Id)?.name ?? "Unknown",
    player2Name: playerMap.get(t.player2Id)?.name ?? "Unknown",
    matchesPlayed: 0,
    matchesWon: 0,
    matchesLost: 0,
    winRate: 0,
    handsPlayed: 0,
    totalPoints: 0,
    pointsPerHand: 0,
    highsWon: 0,
    lowsWon: 0,
    jacksWon: 0,
    gamesWon: 0,
    hangJacks: 0,
    allFours: 0,
    cockGamesWon: 0,
    shutouts: 0,
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
      if (match.team2Score === 0) t1.shutouts++
      // Cock game: won when both teams reached targetScore - 1 at some point
      {
        let running1 = 0, running2 = 0
        for (const h of match.hands) {
          running1 += h.team1Points; running2 += h.team2Points
          if (running1 >= match.targetScore - 1 && running2 >= match.targetScore - 1) {
            t1.cockGamesWon++; break
          }
        }
      }
    } else if (t2Won) {
      t2.matchesWon++; t1.matchesLost++
      t2.form.push("W"); t1.form.push("L")
      if (match.team1Score === 0) t2.shutouts++
      {
        let running1 = 0, running2 = 0
        for (const h of match.hands) {
          running1 += h.team1Points; running2 += h.team2Points
          if (running1 >= match.targetScore - 1 && running2 >= match.targetScore - 1) {
            t2.cockGamesWon++; break
          }
        }
      }
    }

    t1.totalPoints += match.team1Score
    t2.totalPoints += match.team2Score

    for (const hand of match.hands) {
      t1.handsPlayed++
      t2.handsPlayed++

      // High/Low/Jack/Game breakdown
      if (hand.highTeamId === match.team1Id) t1.highsWon++
      if (hand.highTeamId === match.team2Id) t2.highsWon++
      if (hand.lowTeamId === match.team1Id) t1.lowsWon++
      if (hand.lowTeamId === match.team2Id) t2.lowsWon++
      if (hand.jackTeamId === match.team1Id) t1.jacksWon++
      if (hand.jackTeamId === match.team2Id) t2.jacksWon++
      if (hand.gameTeamId === match.team1Id) t1.gamesWon++
      if (hand.gameTeamId === match.team2Id) t2.gamesWon++

      // Hang Jack
      if (hand.hangJack && hand.hangJackTeamId === match.team1Id) t1.hangJacks++
      if (hand.hangJack && hand.hangJackTeamId === match.team2Id) t2.hangJacks++

      // All Fours sweep (all 4 points to one team)
      const t1Points = [hand.highTeamId, hand.lowTeamId, hand.jackTeamId, hand.gameTeamId]
        .filter((id) => id === match.team1Id).length
      const t2Points = [hand.highTeamId, hand.lowTeamId, hand.jackTeamId, hand.gameTeamId]
        .filter((id) => id === match.team2Id).length
      if (t1Points === 4) t1.allFours++
      if (t2Points === 4) t2.allFours++
    }
  }

  for (const s of stats) {
    s.winRate = s.matchesPlayed > 0 ? Math.round((s.matchesWon / s.matchesPlayed) * 100) : 0
    s.pointsPerHand = s.handsPlayed > 0 ? Math.round((s.totalPoints / s.handsPlayed) * 100) / 100 : 0
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
    return b.totalPoints - a.totalPoints
  })

  return stats
}

export function computeTrumpPlayerStats(
  players: TrumpPlayer[],
  teams: TrumpTeam[],
  matches: TrumpMatch[]
): TrumpPlayerStats[] {
  const completedMatches = matches.filter((m) => m.status === "completed")
  const sorted = [...completedMatches].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  )

  const playerTeams = new Map<string, string[]>()
  for (const t of teams) {
    for (const pid of [t.player1Id, t.player2Id]) {
      const existing = playerTeams.get(pid) ?? []
      existing.push(t.id)
      playerTeams.set(pid, existing)
    }
  }

  const stats: TrumpPlayerStats[] = players.map((p) => ({
    playerId: p.id,
    name: p.name,
    colorHex: p.colorHex,
    matchesPlayed: 0,
    matchesWon: 0,
    matchesLost: 0,
    winRate: 0,
    handsPlayed: 0,
    totalPoints: 0,
    pointsPerHand: 0,
    highsWon: 0,
    lowsWon: 0,
    jacksWon: 0,
    gamesWon: 0,
    hangJacks: 0,
    allFours: 0,
    cockGamesWon: 0,
    form: [],
    currentStreak: 0,
    bestStreak: 0,
  }))

  const statsMap = new Map(stats.map((s) => [s.playerId, s]))

  for (const match of sorted) {
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

      s.matchesPlayed++
      s.totalPoints += myScore

      if (match.winnerId === myTeamId) {
        s.matchesWon++
        s.form.push("W")
        // Cock game detection for players
        let r1 = 0, r2 = 0
        for (const h of match.hands) {
          r1 += h.team1Points; r2 += h.team2Points
          if (r1 >= match.targetScore - 1 && r2 >= match.targetScore - 1) {
            s.cockGamesWon++; break
          }
        }
      } else {
        s.matchesLost++
        s.form.push("L")
      }

      for (const hand of match.hands) {
        s.handsPlayed++
        if (hand.highTeamId === myTeamId) s.highsWon++
        if (hand.lowTeamId === myTeamId) s.lowsWon++
        if (hand.jackTeamId === myTeamId) s.jacksWon++
        if (hand.gameTeamId === myTeamId) s.gamesWon++
        if (hand.hangJack && hand.hangJackTeamId === myTeamId) s.hangJacks++

        const pts = [hand.highTeamId, hand.lowTeamId, hand.jackTeamId, hand.gameTeamId]
          .filter((id) => id === myTeamId).length
        if (pts === 4) s.allFours++
      }
    }
  }

  for (const s of stats) {
    s.winRate = s.matchesPlayed > 0 ? Math.round((s.matchesWon / s.matchesPlayed) * 100) : 0
    s.pointsPerHand = s.handsPlayed > 0 ? Math.round((s.totalPoints / s.handsPlayed) * 100) / 100 : 0
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
    return b.totalPoints - a.totalPoints
  })

  return stats
}

export function computeTrumpH2H(
  teamId: string,
  teams: TrumpTeam[],
  matches: TrumpMatch[]
): TrumpH2HRecord[] {
  const teamMap = new Map(teams.map((t) => [t.id, t]))
  const h2hMap = new Map<string, TrumpH2HRecord>()

  for (const match of matches.filter((m) => m.status === "completed")) {
    let opponentId: string | null = null
    let myScore = 0
    let oppScore = 0
    let won = false

    if (match.team1Id === teamId) {
      opponentId = match.team2Id
      myScore = match.team1Score
      oppScore = match.team2Score
      won = match.winnerId === teamId
    } else if (match.team2Id === teamId) {
      opponentId = match.team1Id
      myScore = match.team2Score
      oppScore = match.team1Score
      won = match.winnerId === teamId
    } else {
      continue
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
        pointsFor: 0,
        pointsAgainst: 0,
      })
    }

    const record = h2hMap.get(opponentId)!
    if (won) record.won++; else record.lost++
    record.pointsFor += myScore
    record.pointsAgainst += oppScore
  }

  return Array.from(h2hMap.values()).sort((a, b) => a.opponentName.localeCompare(b.opponentName))
}

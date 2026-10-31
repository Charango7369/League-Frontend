import { Match, StandingRow, Team } from '../types/tournament';

export function calculateStandings(teams: Team[], matches: Match[]): StandingRow[] {
  const standingsMap: { [teamId: string]: StandingRow } = {};

  // Initialize table rows
  teams.forEach((team) => {
    standingsMap[team.id] = {
      teamId: team.id,
      team,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
      form: [],
    };
  });

  // Sort matches chronologically to calculate form properly
  const finishedOrLiveMatches = [...matches]
    .filter((m) => m.homeScore !== null && m.awayScore !== null)
    .sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.time || '00:00'}`).getTime();
      const dateB = new Date(`${b.date}T${b.time || '00:00'}`).getTime();
      return dateA - dateB;
    });

  finishedOrLiveMatches.forEach((m) => {
    const home = standingsMap[m.homeTeamId];
    const away = standingsMap[m.awayTeamId];

    if (!home || !away) return;

    const hs = m.homeScore ?? 0;
    const as = m.awayScore ?? 0;

    home.played += 1;
    away.played += 1;

    home.goalsFor += hs;
    home.goalsAgainst += as;
    home.goalDifference = home.goalsFor - home.goalsAgainst;

    away.goalsFor += as;
    away.goalsAgainst += hs;
    away.goalDifference = away.goalsFor - away.goalsAgainst;

    if (hs > as) {
      home.won += 1;
      home.points += 3;
      home.form.push('W');

      away.lost += 1;
      away.form.push('L');
    } else if (hs < as) {
      away.won += 1;
      away.points += 3;
      away.form.push('W');

      home.lost += 1;
      home.form.push('L');
    } else {
      home.drawn += 1;
      home.points += 1;
      home.form.push('D');

      away.drawn += 1;
      away.points += 1;
      away.form.push('D');
    }
  });

  // Keep only the last 5 match results for form
  Object.values(standingsMap).forEach((row) => {
    row.form = row.form.slice(-5);
  });

  // Rank sorting
  return Object.values(standingsMap).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return a.team.name.localeCompare(b.team.name);
  });
}

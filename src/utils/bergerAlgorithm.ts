import { Match, Team } from '../types/tournament';

/**
 * Berger Algorithm / Round-Robin Tournament Generator
 * Generates an all-against-all fixture calendar for the provided teams.
 */
export function generateBergerFixture(
  teams: Team[],
  includeReturnLeg: boolean = false,
  baseDate: Date = new Date(),
  pitches: string[] = ['Cancha Municipal de Apolo', 'Estadio Franz Tamayo', 'Cancha San Bartolomé']
): Match[] {
  if (teams.length < 2) return [];

  // Work with a copy of teams
  const teamList = [...teams];
  const hasDummy = teamList.length % 2 !== 0;

  if (hasDummy) {
    // Add a ghost team for bye
    teamList.push({
      id: '__bye__',
      name: 'DESCANSO',
      shortName: 'BYE',
      city: '',
      stadium: '',
      coach: '',
      badgeBg: '#334155',
      badgeColor: '#94a3b8',
    });
  }

  const n = teamList.length;
  const totalRounds = n - 1;
  const matchesPerRound = n / 2;
  const generatedMatches: Match[] = [];

  let matchCounter = 1;
  const currentDate = new Date(baseDate);

  // First leg (Ida)
  for (let r = 0; r < totalRounds; r++) {
    const roundNumber = r + 1;
    // Set match weekend dates (e.g. Saturdays/Sundays)
    const matchDateStr = currentDate.toISOString().split('T')[0];

    for (let m = 0; m < matchesPerRound; m++) {
      let homeIdx = (r + m) % (n - 1);
      let awayIdx = (n - 1 - m + r) % (n - 1);

      if (m === 0) {
        awayIdx = n - 1;
      }

      // Alternate home/away for the last team to balance venues
      if (m === 0 && r % 2 === 1) {
        const temp = homeIdx;
        homeIdx = awayIdx;
        awayIdx = temp;
      }

      const homeTeam = teamList[homeIdx];
      const awayTeam = teamList[awayIdx];

      // Skip match if it involves dummy team
      if (homeTeam.id === '__bye__' || awayTeam.id === '__bye__') {
        continue;
      }

      const hours = ['14:00', '15:45', '17:30', '19:15'];
      const time = hours[m % hours.length];
      const pitch = pitches[m % pitches.length];

      generatedMatches.push({
        id: `match_${matchCounter++}`,
        round: roundNumber,
        roundName: `Jornada ${roundNumber}`,
        homeTeamId: homeTeam.id,
        awayTeamId: awayTeam.id,
        homeScore: null,
        awayScore: null,
        status: 'programado',
        date: matchDateStr,
        time: time,
        pitch: homeTeam.stadium || pitch,
        events: [],
      });
    }

    // Advance 7 days for next round
    currentDate.setDate(currentDate.getDate() + 7);
  }

  // Second leg (Vuelta) if requested
  if (includeReturnLeg) {
    const firstLegMatches = [...generatedMatches];
    for (let r = 0; r < totalRounds; r++) {
      const roundNumber = totalRounds + r + 1;
      const legMatches = firstLegMatches.filter((m) => m.round === r + 1);

      legMatches.forEach((m) => {
        generatedMatches.push({
          id: `match_${matchCounter++}`,
          round: roundNumber,
          roundName: `Jornada ${roundNumber} (Vuelta)`,
          homeTeamId: m.awayTeamId,
          awayTeamId: m.homeTeamId,
          homeScore: null,
          awayScore: null,
          status: 'programado',
          date: currentDate.toISOString().split('T')[0],
          time: m.time,
          pitch: pitches[matchCounter % pitches.length],
          events: [],
        });
      });
      currentDate.setDate(currentDate.getDate() + 7);
    }
  }

  return generatedMatches;
}

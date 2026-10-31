export type PlayerPosition = 'Portero' | 'Defensa' | 'Centrocampista' | 'Delantero';

export interface Player {
  id: string;
  teamId: string;
  number: number;
  name: string;
  position: PlayerPosition;
  goals: number;
  assists?: number;
  yellowCards: number;
  redCards: number;
  photoUrl?: string;
  documentId?: string; // C.I. Boliviano o DNI
  birthDate?: string;
  nationality?: string;
  isSuspended?: boolean;
  suspensionReason?: string;
  matchesPlayed?: number;
  passportCode?: string;
}

export interface Team {
  id: string;
  name: string;
  shortName: string;
  city: string;
  stadium: string;
  coach: string;
  badgeBg: string; // e.g. '#1a4fd6'
  badgeColor: string; // e.g. '#f0b429'
  badgeIcon?: string; // e.g. 'sports_soccer' or initials
  stadiumCapacity?: number;
  stadiumSurface?: string;
  president?: string;
  foundedYear?: number;
}

export type EventType = 'gol' | 'penal' | 'autogol' | 'amarilla' | 'roja';

export type RefereeRole = 'Principal' | 'Asistente 1' | 'Asistente 2' | 'Cuarto Árbitro' | 'Veedor';
export type RefereeCategory = 'FIFA' | 'Nacional FBF' | 'Departamental LP' | 'Colegiado Franz Tamayo';
export type RefereeStatus = 'activo' | 'suspendido' | 'licencia';

export interface Referee {
  id: string;
  fullName: string;
  licenseNumber: string;
  category: RefereeCategory;
  association: string;
  rolePrimary: RefereeRole;
  matchesOfficiated: number;
  yellowCardsIssued: number;
  redCardsIssued: number;
  penaltiesAwarded: number;
  status: RefereeStatus;
  photoUrl?: string;
  phone?: string;
  experienceYears?: number;
  city?: string;
  documentId?: string;
}

export interface MatchOfficialAssignment {
  role: RefereeRole;
  refereeId: string;
  refereeName: string;
  licenseNumber?: string;
}

export interface MatchEvent {
  id: string;
  matchId: string;
  type: EventType;
  minute: number;
  playerId?: string;
  playerName: string;
  teamId: string;
  teamName: string;
  notes?: string;
}

export type MatchStatus = 'programado' | 'en_juego' | 'finalizado';

export interface Match {
  id: string;
  round: number;
  roundName?: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
  status: MatchStatus;
  date: string;
  time: string;
  pitch: string;
  currentMinute?: number;
  events: MatchEvent[];
  officials?: MatchOfficialAssignment[];
  refereeNotes?: string;
  isRefereeSigned?: boolean;
  refereeSignatureHash?: string;
  refereeSignedAt?: string;
}

export interface StandingRow {
  teamId: string;
  team: Team;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  form: ('W' | 'D' | 'L')[];
}

export interface BracketMatch {
  id: string;
  stage: 'cuartos' | 'semifinal' | 'final';
  matchNumber: number;
  homeTeamId?: string;
  awayTeamId?: string;
  homeScore?: number;
  awayScore?: number;
  winnerId?: string;
  date?: string;
}

export interface TournamentInfo {
  id: string;
  name: string;
  subtitle: string;
  season: string;
  organizer: string;
  location: string;
  format: 'liga' | 'copa';
  matchDurationMinutes: number;
}

export type SanctionType =
  | 'amarillas_acumuladas'
  | 'roja_directa'
  | 'doble_amarilla'
  | 'conducta_antideportiva'
  | 'sancion_tribunal';

export type SanctionStatus = 'activa' | 'cumplida' | 'apelada' | 'indultada';

export interface DisciplinarySanction {
  id: string;
  code: string; // e.g. "RES-TJD-2026-001"
  playerId: string;
  playerName: string;
  playerNumber?: number;
  teamId: string;
  teamName: string;
  matchId?: string;
  roundNumber?: number;
  sanctionType: SanctionType;
  matchesSuspended: number;
  matchesServed: number;
  financialFineBob?: number;
  resolutionDate: string;
  description: string;
  infractionDetails: string;
  tribunalSigner: string;
  status: SanctionStatus;
}

export type NotificationCategory = 'partido' | 'disciplina' | 'comunicado' | 'clima_cancha' | 'prensa';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  category: NotificationCategory;
  timestamp: string;
  isRead: boolean;
  linkTab?: ActiveTab;
  actionLabel?: string;
  urgent?: boolean;
}

export type ActiveTab =
  | 'dashboard'
  | 'partidos'
  | 'tabla'
  | 'equipos'
  | 'goleadores'
  | 'arbitros'
  | 'disciplina'
  | 'prensa'
  | 'cronicas'
  | 'playoffs'
  | 'configuracion';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  ActiveTab,
  Match,
  MatchEvent,
  Player,
  StandingRow,
  Team,
  TournamentInfo,
  MatchStatus,
  Referee,
  MatchOfficialAssignment,
  DisciplinarySanction,
  AppNotification,
} from '../types/tournament';
import {
  INITIAL_MATCHES,
  INITIAL_PLAYERS,
  INITIAL_TEAMS,
  INITIAL_TOURNAMENT,
  INITIAL_REFEREES,
  INITIAL_SANCTIONS,
  INITIAL_NOTIFICATIONS,
} from '../data/initialData';
import { calculateStandings } from '../utils/standings';
import { generateBergerFixture } from '../utils/bergerAlgorithm';
import { apiClient, BackendMatch, BackendStanding, BackendTeam } from '../services/apiClient';

interface ToastState {
  message: string;
  type: 'success' | 'info' | 'warning';
}

export interface CurrentUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  orgSlug: string | null;
  orgName?: string;
}

interface TournamentContextType {
  tournament: TournamentInfo;
  teams: Team[];
  players: Player[];
  matches: Match[];
  referees: Referee[];
  sanctions: DisciplinarySanction[];
  notifications: AppNotification[];
  standings: StandingRow[];
  currentTab: ActiveTab;
  setCurrentTab: (tab: ActiveTab) => void;
  viewMode: 'desktop' | 'mobile' | 'tv';
  setViewMode: (mode: 'desktop' | 'mobile' | 'tv') => void;
  toast: ToastState | null;
  showToast: (message: string, type?: 'success' | 'info' | 'warning') => void;
  // Notifications
  isNotificationsDrawerOpen: boolean;
  setIsNotificationsDrawerOpen: (open: boolean) => void;
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
  addNotification: (notification: Omit<AppNotification, 'id' | 'timestamp'>) => void;
  clearNotifications: () => void;
  // Modals
  activeMatchModal: Match | null;
  setActiveMatchModal: (match: Match | null) => void;
  activeTeamModal: Team | null;
  setActiveTeamModal: (team: Team | null) => void;
  activeRefereeAssignmentModal: Match | null;
  setActiveRefereeAssignmentModal: (match: Match | null) => void;
  activeOfficialSheetModal: Match | null;
  setActiveOfficialSheetModal: (match: Match | null) => void;
  isShareModalOpen: boolean;
  setIsShareModalOpen: (open: boolean) => void;
  // SaaS Authentication & Multi-Tenancy
  currentUser: CurrentUser | null;
  isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  isBackendOnline: boolean;
  login: (email: string, pass: string) => Promise<void>;
  registerOrg: (data: {
    email: string;
    password: string;
    full_name: string;
    organization_name: string;
    organization_slug: string;
    phone?: string;
  }) => Promise<void>;
  logout: () => void;
  syncWithDatabase: () => Promise<void>;
  // Match actions
  updateMatch: (updated: Match) => void;
  addMatchEvent: (matchId: string, event: Omit<MatchEvent, 'id' | 'matchId'>) => void;
  removeMatchEvent: (matchId: string, eventId: string) => void;
  assignOfficialsToMatch: (matchId: string, officials: MatchOfficialAssignment[]) => void;
  signMatchOfficialSheet: (matchId: string, notes: string, signerName: string) => Promise<void>;
  // Disciplinary actions (Tribunal de Penas)
  addSanction: (sanction: Omit<DisciplinarySanction, 'id' | 'code'>) => void;
  updateSanction: (sanction: DisciplinarySanction) => void;
  deleteSanction: (sanctionId: string) => void;
  serveSanctionMatch: (sanctionId: string) => void;
  pardonSanction: (sanctionId: string) => void;
  // Referee actions
  addReferee: (refData: Omit<Referee, 'id'>) => void;
  updateReferee: (updated: Referee) => void;
  deleteReferee: (refId: string) => void;
  // Team & Player actions
  addTeam: (team: Omit<Team, 'id'>) => void;
  updateTeam: (team: Team) => void;
  deleteTeam: (teamId: string) => void;
  addPlayer: (player: Omit<Player, 'id'>) => void;
  updatePlayer: (player: Player) => void;
  deletePlayer: (playerId: string) => void;
  // Schedule
  generateNewFixture: (includeReturnLeg?: boolean) => void;
  updateTournament: (info: Partial<TournamentInfo>) => void;
  resetAllData: () => void;
}

const STORAGE_KEY = 'apolodigital_league_state_v1';
const USER_KEY = 'apolo_user_session';

const TournamentContext = createContext<TournamentContextType | undefined>(undefined);

export const TournamentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Load from localStorage or use initial data
  const loadInitialState = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Error loading localStorage state', e);
    }
    return null;
  };

  const loadInitialUser = (): CurrentUser | null => {
    try {
      const stored = localStorage.getItem(USER_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Error loading user session', e);
    }
    return null;
  };

  const saved = loadInitialState();

  const [tournament, setTournament] = useState<TournamentInfo>(
    saved?.tournament || INITIAL_TOURNAMENT
  );
  const [teams, setTeams] = useState<Team[]>(saved?.teams || INITIAL_TEAMS);
  const [players, setPlayers] = useState<Player[]>(saved?.players || INITIAL_PLAYERS);
  const [referees, setReferees] = useState<Referee[]>(
    saved?.referees && saved.referees.length > 0 ? saved.referees : INITIAL_REFEREES
  );
  const [sanctions, setSanctions] = useState<DisciplinarySanction[]>(
    saved?.sanctions && saved.sanctions.length > 0 ? saved.sanctions : INITIAL_SANCTIONS
  );
  const [notifications, setNotifications] = useState<AppNotification[]>(
    saved?.notifications && saved.notifications.length > 0 ? saved.notifications : INITIAL_NOTIFICATIONS
  );
  const [isNotificationsDrawerOpen, setIsNotificationsDrawerOpen] = useState<boolean>(false);
  const [matches, setMatches] = useState<Match[]>(() => {
    const rawMatches: Match[] = saved?.matches || INITIAL_MATCHES;
    return rawMatches.map((m) => {
      const init = INITIAL_MATCHES.find((im) => im.id === m.id);
      if (init && (!m.officials || m.officials.length === 0) && init.officials) {
        return {
          ...m,
          officials: init.officials,
          isRefereeSigned: init.isRefereeSigned,
          refereeSignatureHash: init.refereeSignatureHash,
          refereeSignedAt: init.refereeSignedAt,
          refereeNotes: init.refereeNotes,
        };
      }
      return m;
    });
  });

  const [currentTab, setCurrentTab] = useState<ActiveTab>('dashboard');
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile' | 'tv'>('desktop');
  const [activeMatchModal, setActiveMatchModal] = useState<Match | null>(null);
  const [activeTeamModal, setActiveTeamModal] = useState<Team | null>(null);
  const [activeRefereeAssignmentModal, setActiveRefereeAssignmentModal] = useState<Match | null>(null);
  const [activeOfficialSheetModal, setActiveOfficialSheetModal] = useState<Match | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(loadInitialUser);
  const [isBackendOnline, setIsBackendOnline] = useState<boolean>(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  // Periodic Backend Health Check
  const checkHealth = useCallback(async () => {
    const online = await apiClient.checkHealth();
    setIsBackendOnline(online);
  }, []);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 20000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  // Sync state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ tournament, teams, players, matches, referees, sanctions, notifications })
      );
    } catch (e) {
      console.error('Failed to save to localStorage', e);
    }
  }, [tournament, teams, players, matches, referees, sanctions, notifications]);

  const showToast = (message: string, type: 'success' | 'info' | 'warning' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3200);
  };

  // Standings calculation (derived in frontend, can also be supplemented by backend)
  const standings = calculateStandings(teams, matches);

  // --- SaaS Authentication Actions ---
  const openAuthModal = () => setIsAuthModalOpen(true);
  const closeAuthModal = () => setIsAuthModalOpen(false);

  const login = async (email: string, pass: string) => {
    const tokens = await apiClient.login(email, pass);
    const user: CurrentUser = {
      id: tokens.user_id,
      email: tokens.email,
      fullName: tokens.email.split('@')[0].toUpperCase(),
      role: tokens.role,
      orgSlug: tokens.organization_slug,
      orgName: tokens.organization_slug === 'asociacion-apolo' ? 'Asociación Deportiva Apolo' : undefined,
    };
    setCurrentUser(user);
    localStorage.setItem(USER_KEY, JSON.stringify(user));

    // Try to fetch full profile
    try {
      const profile = await apiClient.getProfile();
      const updatedUser: CurrentUser = {
        ...user,
        fullName: profile.full_name || user.fullName,
      };
      setCurrentUser(updatedUser);
      localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
    } catch (e) {
      // Continue with token user
    }

    // Auto-sync with DB
    await syncWithDatabase();
  };

  const registerOrg = async (data: {
    email: string;
    password: string;
    full_name: string;
    organization_name: string;
    organization_slug: string;
    phone?: string;
  }) => {
    const tokens = await apiClient.register(data);
    const user: CurrentUser = {
      id: tokens.user_id,
      email: tokens.email,
      fullName: data.full_name,
      role: tokens.role,
      orgSlug: tokens.organization_slug,
      orgName: data.organization_name,
    };
    setCurrentUser(user);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  };

  const logout = () => {
    apiClient.logout();
    setCurrentUser(null);
    localStorage.removeItem(USER_KEY);
  };

  // --- Sync with PostgreSQL Database ---
  const syncWithDatabase = async () => {
    try {
      const isUp = await apiClient.checkHealth();
      if (!isUp) {
        showToast('El servidor PostgreSQL/FastAPI no está disponible actualmente.', 'warning');
        return;
      }

      const slug = currentUser?.orgSlug || apiClient.getOrgSlug();
      const backendTournaments = await apiClient.listTournaments(slug);

      if (!backendTournaments || backendTournaments.length === 0) {
        showToast('Conectado a la base de datos (sin torneos registrados para este tenant)', 'info');
        return;
      }

      const activeBkendTourney = backendTournaments[0];
      const backendTeams = await apiClient.listTeams(slug);
      const backendMatches = await apiClient.listMatches(activeBkendTourney.id);

      // Map backend tournament
      setTournament((prev) => ({
        ...prev,
        id: activeBkendTourney.id,
        name: activeBkendTourney.name,
        season: 'Temporada Oficial 2026',
        matchDurationMinutes: activeBkendTourney.match_duration,
      }));

      // Map backend teams if available
      if (backendTeams && backendTeams.length > 0) {
        const mappedTeams: Team[] = backendTeams.map((bt: BackendTeam, idx: number) => {
          const existing = teams.find((t) => t.shortName.toUpperCase() === bt.short_code.toUpperCase());
          return {
            id: bt.id,
            name: bt.name,
            shortName: bt.short_code,
            city: bt.city || 'Apolo',
            stadium: bt.stadium_name || 'Estadio Municipal de Apolo',
            coach: bt.coach_name || 'Director Técnico',
            badgeBg: bt.primary_color || existing?.badgeBg || '#1a4fd6',
            badgeColor: bt.secondary_color || existing?.badgeColor || '#ffffff',
            badgeIcon: existing?.badgeIcon || 'sports_soccer',
          };
        });
        setTeams(mappedTeams);

        // Map backend matches if available
        if (backendMatches && backendMatches.length > 0) {
          const mappedMatches: Match[] = backendMatches.map((bm: BackendMatch, idx: number) => {
            const dt = new Date(bm.scheduled_at);
            const statusMap: Record<string, MatchStatus> = {
              SCHEDULED: 'programado',
              LIVE: 'en_juego',
              FINISHED: 'finalizado',
            };

            return {
              id: bm.id,
              round: Math.floor(idx / 4) + 1,
              roundName: `Jornada ${Math.floor(idx / 4) + 1}`,
              homeTeamId: bm.home_team_id,
              awayTeamId: bm.away_team_id,
              homeScore: bm.home_score ?? null,
              awayScore: bm.away_score ?? null,
              status: statusMap[bm.status] || 'programado',
              date: dt.toISOString().split('T')[0],
              time: dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              pitch: bm.venue_name || 'Estadio Municipal de Apolo',
              currentMinute: bm.current_minute || undefined,
              events: [],
            };
          });
          setMatches(mappedMatches);
        }
      }

      showToast('Sincronizado exitosamente con la Base de Datos PostgreSQL 16', 'success');
    } catch (err: any) {
      console.error('Error syncing with database:', err);
      showToast(err.message || 'Error al sincronizar con PostgreSQL', 'warning');
    }
  };

  // Match operations
  const updateMatch = (updated: Match) => {
    setMatches((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    if (activeMatchModal && activeMatchModal.id === updated.id) {
      setActiveMatchModal(updated);
    }

    // If online and match is in backend format, sync status
    if (isBackendOnline) {
      const backendStatusMap: Record<MatchStatus, string> = {
        programado: 'SCHEDULED',
        en_juego: 'LIVE',
        finalizado: 'FINISHED',
      };
      apiClient
        .updateMatchStatus(updated.id, {
          status: backendStatusMap[updated.status],
          home_score: updated.homeScore ?? undefined,
          away_score: updated.awayScore ?? undefined,
          current_minute: updated.currentMinute ?? undefined,
        })
        .catch((e) => console.log('Offline match update logged locally:', e));
    }

    showToast('Partido actualizado correctamente', 'success');
  };

  const addMatchEvent = (matchId: string, eventData: Omit<MatchEvent, 'id' | 'matchId'>) => {
    const targetMatch = matches.find((m) => m.id === matchId);
    if (!targetMatch) return;

    const newEvent: MatchEvent = {
      ...eventData,
      id: `ev_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      matchId,
    };

    // Calculate score updates if event is goal
    let newHomeScore = targetMatch.homeScore ?? 0;
    let newAwayScore = targetMatch.awayScore ?? 0;

    if (newEvent.type === 'gol' || newEvent.type === 'penal') {
      if (newEvent.teamId === targetMatch.homeTeamId) {
        newHomeScore += 1;
      } else {
        newAwayScore += 1;
      }
    } else if (newEvent.type === 'autogol') {
      if (newEvent.teamId === targetMatch.homeTeamId) {
        newAwayScore += 1;
      } else {
        newHomeScore += 1;
      }
    }

    // Update player goal/card counters if applicable
    if (newEvent.playerId) {
      setPlayers((prev) =>
        prev.map((p) => {
          if (p.id !== newEvent.playerId) return p;
          if (newEvent.type === 'gol' || newEvent.type === 'penal') {
            return { ...p, goals: p.goals + 1 };
          }
          if (newEvent.type === 'amarilla') {
            return { ...p, yellowCards: p.yellowCards + 1 };
          }
          if (newEvent.type === 'roja') {
            return { ...p, redCards: p.redCards + 1 };
          }
          return p;
        })
      );
    }

    const updatedMatch: Match = {
      ...targetMatch,
      homeScore: newHomeScore,
      awayScore: newAwayScore,
      events: [...targetMatch.events, newEvent],
    };

    setMatches((prev) => prev.map((m) => (m.id === matchId ? updatedMatch : m)));
    if (activeMatchModal && activeMatchModal.id === matchId) {
      setActiveMatchModal(updatedMatch);
    }

    // Push event to backend if online
    if (isBackendOnline) {
      const typeMap: Record<string, string> = {
        gol: 'GOAL',
        penal: 'PENALTY_GOAL',
        autogol: 'OWN_GOAL',
        amarilla: 'YELLOW_CARD',
        roja: 'RED_CARD',
      };
      apiClient
        .recordMatchEvent(matchId, {
          team_id: newEvent.teamId,
          event_type: typeMap[newEvent.type] || 'GOAL',
          minute: newEvent.minute,
          primary_player_id: newEvent.playerId || undefined,
        })
        .catch((e) => console.log('Offline event recorded locally:', e));
    }

    showToast(`Evento registrado: ${newEvent.playerName} (${newEvent.type.toUpperCase()})`, 'info');
  };

  const removeMatchEvent = (matchId: string, eventId: string) => {
    const targetMatch = matches.find((m) => m.id === matchId);
    if (!targetMatch) return;

    const removedEvent = targetMatch.events.find((e) => e.id === eventId);
    if (!removedEvent) return;

    let newHomeScore = targetMatch.homeScore ?? 0;
    let newAwayScore = targetMatch.awayScore ?? 0;

    if (removedEvent.type === 'gol' || removedEvent.type === 'penal') {
      if (removedEvent.teamId === targetMatch.homeTeamId) {
        newHomeScore = Math.max(0, newHomeScore - 1);
      } else {
        newAwayScore = Math.max(0, newAwayScore - 1);
      }
    } else if (removedEvent.type === 'autogol') {
      if (removedEvent.teamId === targetMatch.homeTeamId) {
        newAwayScore = Math.max(0, newAwayScore - 1);
      } else {
        newHomeScore = Math.max(0, newHomeScore - 1);
      }
    }

    if (removedEvent.playerId) {
      setPlayers((prev) =>
        prev.map((p) => {
          if (p.id !== removedEvent.playerId) return p;
          if (removedEvent.type === 'gol' || removedEvent.type === 'penal') {
            return { ...p, goals: Math.max(0, p.goals - 1) };
          }
          if (removedEvent.type === 'amarilla') {
            return { ...p, yellowCards: Math.max(0, p.yellowCards - 1) };
          }
          if (removedEvent.type === 'roja') {
            return { ...p, redCards: Math.max(0, p.redCards - 1) };
          }
          return p;
        })
      );
    }

    const updatedMatch: Match = {
      ...targetMatch,
      homeScore: newHomeScore,
      awayScore: newAwayScore,
      events: targetMatch.events.filter((e) => e.id !== eventId),
    };

    setMatches((prev) => prev.map((m) => (m.id === matchId ? updatedMatch : m)));
    if (activeMatchModal && activeMatchModal.id === matchId) {
      setActiveMatchModal(updatedMatch);
    }
  };

  // Team CRUD
  const addTeam = (teamData: Omit<Team, 'id'>) => {
    const id = `team_${Date.now()}`;
    const newTeam: Team = { ...teamData, id };
    setTeams((prev) => [...prev, newTeam]);
    showToast(`Equipo "${newTeam.name}" registrado con éxito`, 'success');
  };

  const updateTeam = (updated: Team) => {
    setTeams((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    showToast(`Equipo "${updated.name}" actualizado`, 'success');
  };

  const deleteTeam = (teamId: string) => {
    const team = teams.find((t) => t.id === teamId);
    setTeams((prev) => prev.filter((t) => t.id !== teamId));
    setMatches((prev) => prev.filter((m) => m.homeTeamId !== teamId && m.awayTeamId !== teamId));
    setPlayers((prev) => prev.filter((p) => p.teamId !== teamId));
    showToast(`Equipo "${team?.name || ''}" eliminado`, 'warning');
  };

  // Player CRUD
  const addPlayer = (playerData: Omit<Player, 'id'>) => {
    const id = `p_${Date.now()}`;
    const newPlayer: Player = { ...playerData, id };
    setPlayers((prev) => [...prev, newPlayer]);
    showToast(`Jugador "${newPlayer.name}" añadido a la plantilla`, 'success');
  };

  const updatePlayer = (updated: Player) => {
    setPlayers((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    showToast(`Jugador "${updated.name}" actualizado`, 'success');
  };

  const deletePlayer = (playerId: string) => {
    setPlayers((prev) => prev.filter((p) => p.id !== playerId));
    showToast('Jugador eliminado de la plantilla', 'info');
  };

  // Fixture generator
  const generateNewFixture = (includeReturnLeg: boolean = false) => {
    if (teams.length < 2) {
      showToast('Se necesitan al menos 2 equipos para armar el fixture', 'warning');
      return;
    }
    const newMatches = generateBergerFixture(teams, includeReturnLeg);
    setMatches(newMatches);
    showToast(
      `Fixture generado con éxito: ${newMatches.length} partidos creados (Algoritmo Berger)`,
      'success'
    );
  };

  // Disciplinary Actions (Tribunal de Penas y Justicia Deportiva)
  const addSanction = (data: Omit<DisciplinarySanction, 'id' | 'code'>) => {
    const id = `sanc_${Date.now()}`;
    const codeNum = String(sanctions.length + 1).padStart(3, '0');
    const code = `RES-TJD-2026-${codeNum}`;
    const newSanction: DisciplinarySanction = {
      ...data,
      id,
      code,
    };

    setSanctions((prev) => [newSanction, ...prev]);

    // Apply suspension to player if sanction is active
    if (newSanction.status === 'activa' && newSanction.playerId) {
      setPlayers((prev) =>
        prev.map((p) =>
          p.id === newSanction.playerId
            ? {
                ...p,
                isSuspended: true,
                suspensionReason: `Sanción TJD: ${newSanction.description} (${newSanction.matchesSuspended - newSanction.matchesServed} fecha/s pendiente/s)`,
              }
            : p
        )
      );
    }

    showToast(`Resolución ${code} emitida por el Tribunal de Penas`, 'success');
  };

  const updateSanction = (updated: DisciplinarySanction) => {
    setSanctions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));

    // Reconcile player suspension status
    if (updated.playerId) {
      const remainingActive = sanctions
        .filter((s) => s.id !== updated.id && s.playerId === updated.playerId && s.status === 'activa');
      const isStillSuspended = updated.status === 'activa' || remainingActive.length > 0;

      setPlayers((prev) =>
        prev.map((p) =>
          p.id === updated.playerId
            ? {
                ...p,
                isSuspended: isStillSuspended,
                suspensionReason: isStillSuspended
                  ? updated.status === 'activa'
                    ? `Sanción TJD: ${updated.description}`
                    : remainingActive[0].description
                  : undefined,
              }
            : p
        )
      );
    }

    showToast(`Resolución ${updated.code} actualizada en el expediente`, 'info');
  };

  const deleteSanction = (sanctionId: string) => {
    const target = sanctions.find((s) => s.id === sanctionId);
    setSanctions((prev) => prev.filter((s) => s.id !== sanctionId));

    if (target?.playerId) {
      const remaining = sanctions.filter(
        (s) => s.id !== sanctionId && s.playerId === target.playerId && s.status === 'activa'
      );
      if (remaining.length === 0) {
        setPlayers((prev) =>
          prev.map((p) =>
            p.id === target.playerId ? { ...p, isSuspended: false, suspensionReason: undefined } : p
          )
        );
      }
    }

    showToast(`Resolución ${target?.code || ''} eliminada del registro`, 'warning');
  };

  const serveSanctionMatch = (sanctionId: string) => {
    const target = sanctions.find((s) => s.id === sanctionId);
    if (!target) return;

    const newServed = target.matchesServed + 1;
    const isCompleted = newServed >= target.matchesSuspended;

    const updated: DisciplinarySanction = {
      ...target,
      matchesServed: newServed,
      status: isCompleted ? 'cumplida' : target.status,
    };

    updateSanction(updated);
    showToast(
      isCompleted
        ? `Sanción ${target.code} cumplida totalmente. Jugador habilitado.`
        : `Fecha de castigo computada (${newServed}/${target.matchesSuspended} fechas cumplidas).`,
      isCompleted ? 'success' : 'info'
    );
  };

  const pardonSanction = (sanctionId: string) => {
    const target = sanctions.find((s) => s.id === sanctionId);
    if (!target) return;

    const updated: DisciplinarySanction = {
      ...target,
      status: 'indultada',
    };

    updateSanction(updated);
    showToast(`Indulto federativo concedido para la resolución ${target.code}`, 'success');
  };

  // Notification Actions
  const markNotificationAsRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
  };

  const markAllNotificationsAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    showToast('Todas las notificaciones marcadas como leídas', 'info');
  };

  const addNotification = (data: Omit<AppNotification, 'id' | 'timestamp'>) => {
    const id = `notif_${Date.now()}`;
    const timestamp = new Date().toISOString();
    const newNotif: AppNotification = { ...data, id, timestamp };
    setNotifications((prev) => [newNotif, ...prev]);
    showToast(`Notificación: ${newNotif.title}`, newNotif.urgent ? 'warning' : 'info');
  };

  const clearNotifications = () => {
    setNotifications([]);
    showToast('Historial de notificaciones vaciado', 'info');
  };

  // Referee CRUD
  const addReferee = (refData: Omit<Referee, 'id'>) => {
    const id = `ref_${Date.now()}`;
    const newRef: Referee = { ...refData, id };
    setReferees((prev) => [...prev, newRef]);
    showToast(`Árbitro colegiado "${newRef.fullName}" incorporado al padrón`, 'success');
  };

  const updateReferee = (updated: Referee) => {
    setReferees((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    showToast(`Expediente del árbitro "${updated.fullName}" actualizado`, 'success');
  };

  const deleteReferee = (refId: string) => {
    const ref = referees.find((r) => r.id === refId);
    setReferees((prev) => prev.filter((r) => r.id !== refId));
    showToast(`Árbitro "${ref?.fullName || ''}" desvinculado del padrón`, 'info');
  };

  // Referee Match Designations
  const assignOfficialsToMatch = (matchId: string, officials: MatchOfficialAssignment[]) => {
    setMatches((prev) =>
      prev.map((m) => (m.id === matchId ? { ...m, officials } : m))
    );
    if (activeMatchModal && activeMatchModal.id === matchId) {
      setActiveMatchModal((prev) => (prev ? { ...prev, officials } : null));
    }
    showToast('Terna arbitral oficial designada y notificada para el partido', 'success');
  };

  // Match Sign-Off by Central Referee
  const signMatchOfficialSheet = async (matchId: string, notes: string, signerName: string) => {
    const now = new Date().toISOString();
    const seed = `MATCH:${matchId}|NOTES:${notes}|SIGNER:${signerName}|TIME:${now}|APOLO`;
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash) + seed.charCodeAt(i);
      hash |= 0;
    }
    const signatureHash = 'sig_' + Math.abs(hash).toString(16).padStart(16, '0') + Date.now().toString(16);

    setMatches((prev) =>
      prev.map((m) =>
        m.id === matchId
          ? {
              ...m,
              isRefereeSigned: true,
              refereeNotes: notes,
              refereeSignatureHash: signatureHash,
              refereeSignedAt: now,
            }
          : m
      )
    );

    if (activeMatchModal && activeMatchModal.id === matchId) {
      setActiveMatchModal((prev) =>
        prev
          ? {
              ...prev,
              isRefereeSigned: true,
              refereeNotes: notes,
              refereeSignatureHash: signatureHash,
              refereeSignedAt: now,
            }
          : null
      );
    }

    try {
      if (isBackendOnline) {
        await fetch(`http://localhost:8000/api/v1/referees/matches/${matchId}/sign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ referee_notes: notes, signed_by_name: signerName }),
        });
      }
    } catch (e) {
      console.warn('Backend sign sheet sync failed, preserved in state', e);
    }

    showToast('Acta arbitral sellada, firmada y certificada digitalmente ⚖️', 'success');
  };

  const updateTournament = (info: Partial<TournamentInfo>) => {
    setTournament((prev) => ({ ...prev, ...info }));
    showToast('Ajustes del torneo guardados', 'success');
  };

  const resetAllData = () => {
    setTournament(INITIAL_TOURNAMENT);
    setTeams(INITIAL_TEAMS);
    setPlayers(INITIAL_PLAYERS);
    setMatches(INITIAL_MATCHES);
    setReferees(INITIAL_REFEREES);
    localStorage.removeItem(STORAGE_KEY);
    showToast('Datos reiniciados a los valores oficiales de Apolo League', 'info');
  };

  return (
    <TournamentContext.Provider
      value={{
        tournament,
        teams,
        players,
        matches,
        referees,
        sanctions,
        notifications,
        standings,
        currentTab,
        setCurrentTab,
        viewMode,
        setViewMode,
        toast,
        showToast,
        isNotificationsDrawerOpen,
        setIsNotificationsDrawerOpen,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        addNotification,
        clearNotifications,
        activeMatchModal,
        setActiveMatchModal,
        activeTeamModal,
        setActiveTeamModal,
        activeRefereeAssignmentModal,
        setActiveRefereeAssignmentModal,
        activeOfficialSheetModal,
        setActiveOfficialSheetModal,
        isShareModalOpen,
        setIsShareModalOpen,
        currentUser,
        isAuthModalOpen,
        openAuthModal,
        closeAuthModal,
        isBackendOnline,
        login,
        registerOrg,
        logout,
        syncWithDatabase,
        updateMatch,
        addMatchEvent,
        removeMatchEvent,
        assignOfficialsToMatch,
        signMatchOfficialSheet,
        addSanction,
        updateSanction,
        deleteSanction,
        serveSanctionMatch,
        pardonSanction,
        addReferee,
        updateReferee,
        deleteReferee,
        addTeam,
        updateTeam,
        deleteTeam,
        addPlayer,
        updatePlayer,
        deletePlayer,
        generateNewFixture,
        updateTournament,
        resetAllData,
      }}
    >
      {children}
    </TournamentContext.Provider>
  );
};

export const useTournament = () => {
  const context = useContext(TournamentContext);
  if (!context) {
    throw new Error('useTournament must be used within a TournamentProvider');
  }
  return context;
};

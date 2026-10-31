/**
 * Apolodigital League SaaS Enterprise API Client
 * Seamlessly interfaces with the FastAPI Clean Architecture backend.
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
const WS_BASE = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/api/v1/ws';

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  user_id: string;
  email: string;
  role: string;
  organization_id?: string | null;
  organization_slug: string | null;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: string;
  organization_id: string | null;
  is_active: boolean;
}

export interface BackendTournament {
  id: string;
  season_id: string;
  name: string;
  slug: string;
  sport_format: string;
  match_duration: number;
  points_for_win: number;
  points_for_draw: number;
  points_for_loss: number;
  status: string;
}

export interface BackendTeam {
  id: string;
  organization_id: string;
  name: string;
  short_code: string;
  city?: string;
  stadium_name?: string;
  coach_name?: string;
  logo_url?: string;
  primary_color: string;
  secondary_color: string;
}

export interface BackendMatch {
  id: string;
  tournament_id: string;
  matchday_id?: string;
  home_team_id: string;
  away_team_id: string;
  home_team_name: string;
  away_team_name: string;
  home_team_short: string;
  away_team_short: string;
  home_team_color: string;
  away_team_color: string;
  home_score?: number;
  away_score?: number;
  status: string;
  current_minute?: number;
  scheduled_at: string;
  venue_name?: string;
}

export interface BackendStanding {
  position: number;
  team_id: string;
  team_name: string;
  team_short: string;
  team_color: string;
  team_logo?: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
  form?: string;
}

class ApiClient {
  private token: string | null = null;
  private orgSlug: string = 'asociacion-apolo';

  constructor() {
    this.token = localStorage.getItem('apolo_access_token');
    const storedSlug = localStorage.getItem('apolo_org_slug');
    if (storedSlug) {
      this.orgSlug = storedSlug;
    }
  }

  getToken(): string | null {
    return this.token;
  }

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('apolo_access_token', token);
  }

  getOrgSlug(): string {
    return this.orgSlug;
  }

  setOrgSlug(slug: string) {
    this.orgSlug = slug;
    localStorage.setItem('apolo_org_slug', slug);
  }

  logout() {
    this.token = null;
    localStorage.removeItem('apolo_access_token');
    localStorage.removeItem('apolo_user_profile');
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Organization-Slug': this.orgSlug,
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Error de conexión' }));
      throw new Error(errorData.detail || `Error ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  // --- System Health ---
  async checkHealth(): Promise<boolean> {
    try {
      const base = API_BASE.replace('/api/v1', '');
      const res = await fetch(`${base}/health`, { method: 'GET' });
      return res.ok;
    } catch {
      return false;
    }
  }

  // --- Auth Endpoints ---
  async login(email: string, password: string): Promise<AuthTokens> {
    const res = await this.request<AuthTokens>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(res.access_token);
    if (res.organization_slug) {
      this.setOrgSlug(res.organization_slug);
    }
    return res;
  }

  async register(data: {
    email: string;
    password: string;
    full_name: string;
    organization_name: string;
    organization_slug: string;
    phone?: string;
  }): Promise<AuthTokens> {
    const res = await this.request<AuthTokens>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    this.setToken(res.access_token);
    if (res.organization_slug) {
      this.setOrgSlug(res.organization_slug);
    }
    return res;
  }

  async getProfile(): Promise<UserProfile> {
    const profile = await this.request<UserProfile>('/auth/me');
    localStorage.setItem('apolo_user_profile', JSON.stringify(profile));
    return profile;
  }

  // --- Organization & Branding ---
  async getOrganization(slug: string = this.orgSlug) {
    return this.request(`/organizations/${slug}`);
  }

  // --- Tournaments & Fixtures ---
  async listTournaments(orgSlug: string = this.orgSlug): Promise<BackendTournament[]> {
    return this.request<BackendTournament[]>(`/tournaments/?organization_slug=${encodeURIComponent(orgSlug)}`);
  }

  async generateBergerFixtures(tournamentId: string, includeReturnLeg: boolean = false) {
    return this.request(`/tournaments/${tournamentId}/generate-fixtures?include_return_leg=${includeReturnLeg}`, {
      method: 'POST',
    });
  }

  // --- Teams & Players ---
  async listTeams(orgSlug: string = this.orgSlug): Promise<BackendTeam[]> {
    return this.request<BackendTeam[]>(`/teams/?organization_slug=${encodeURIComponent(orgSlug)}`);
  }

  async listTeamPlayers(teamId: string) {
    return this.request(`/teams/${teamId}/players`);
  }

  // --- Matches & Live Scoring ---
  async listMatches(tournamentId: string, matchStatus?: string): Promise<BackendMatch[]> {
    const query = matchStatus ? `&match_status=${matchStatus}` : '';
    return this.request<BackendMatch[]>(`/matches/?tournament_id=${tournamentId}${query}`);
  }

  async getMatchDetail(matchId: string) {
    return this.request(`/matches/${matchId}`);
  }

  async updateMatchStatus(matchId: string, data: { status?: string; home_score?: number; away_score?: number; current_minute?: number }) {
    return this.request(`/matches/${matchId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async recordMatchEvent(matchId: string, eventData: {
    team_id: string;
    event_type: string;
    minute: number;
    primary_player_id?: string;
  }) {
    return this.request(`/matches/${matchId}/events`, {
      method: 'POST',
      body: JSON.stringify(eventData),
    });
  }

  // --- Standings & Scorers ---
  async getStandings(tournamentId: string): Promise<BackendStanding[]> {
    return this.request<BackendStanding[]>(`/statistics/standings/${tournamentId}`);
  }

  async getTopScorers(tournamentId: string) {
    return this.request(`/statistics/scorers/${tournamentId}`);
  }

  async getWhatsAppShareText(tournamentId: string) {
    return this.request<{ formatted_text: string }>(`/statistics/share-whatsapp/${tournamentId}`);
  }

  // --- AI Sports Journalism ---
  async generateAIChronicle(matchId: string, narrativeStyle: string = 'LATIN_SPORTS_JOURNALIST') {
    return this.request<{
      headline: string;
      subheading: string;
      body_text: string;
      mvp_player: string;
      tactical_highlight: string;
    }>('/ai/chronicle', {
      method: 'POST',
      body: JSON.stringify({ match_id: matchId, narrative_style: narrativeStyle }),
    });
  }

  // --- Real-Time WebSocket Match Hub ---
  connectMatchWebSocket(matchId: string, onEvent: (data: any) => void): WebSocket | null {
    try {
      const ws = new WebSocket(`${WS_BASE}/matches/${matchId}/live`);
      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          onEvent(payload);
        } catch (e) {
          console.error('Error parsing live match payload', e);
        }
      };
      return ws;
    } catch (e) {
      console.warn('WebSocket connection not available:', e);
      return null;
    }
  }
}

export const apiClient = new ApiClient();

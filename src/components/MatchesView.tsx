import React, { useState } from 'react';
import { useTournament } from '../context/TournamentContext';
import { Match, MatchStatus } from '../types/tournament';

export const MatchesView: React.FC = () => {
  const {
    matches,
    teams,
    setActiveMatchModal,
    setActiveRefereeAssignmentModal,
    setActiveOfficialSheetModal,
    generateNewFixture,
    updateMatch,
  } = useTournament();

  const [selectedRound, setSelectedRound] = useState<number | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | MatchStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Extract unique rounds
  const rounds = Array.from(new Set(matches.map((m) => m.round))).sort((a, b) => a - b);

  const getTeam = (teamId: string) => teams.find((t) => t.id === teamId);

  // Filter matches
  const filteredMatches = matches.filter((m) => {
    if (selectedRound !== 'all' && m.round !== selectedRound) return false;
    if (statusFilter !== 'all' && m.status !== statusFilter) return false;

    if (searchQuery.trim()) {
      const home = getTeam(m.homeTeamId)?.name.toLowerCase() || '';
      const away = getTeam(m.awayTeamId)?.name.toLowerCase() || '';
      const query = searchQuery.toLowerCase();
      if (!home.includes(query) && !away.includes(query)) return false;
    }

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Controls Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#0d2347]/80 p-4 rounded-2xl border border-blue-500/20">
        <div className="flex flex-wrap items-center gap-3">
          {/* Round Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-blue-300 uppercase">Jornada:</span>
            <select
              value={selectedRound}
              onChange={(e) =>
                setSelectedRound(e.target.value === 'all' ? 'all' : Number(e.target.value))
              }
              className="bg-[#0a1628] border border-blue-500/30 text-white text-xs font-semibold rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-400"
            >
              <option value="all">Todas las Fechas</option>
              {rounds.map((r) => (
                <option key={r} value={r}>
                  Jornada {r}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-[#0a1628] p-1 rounded-lg border border-blue-500/20">
            {(
              [
                { id: 'all', label: 'Todos' },
                { id: 'en_juego', label: 'En Vivo' },
                { id: 'finalizado', label: 'Jugados' },
                { id: 'programado', label: 'Por Jugar' },
              ] as const
            ).map((st) => (
              <button
                key={st.id}
                onClick={() => setStatusFilter(st.id)}
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-md transition-all ${
                  statusFilter === st.id
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search & Actions */}
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
              search
            </span>
            <input
              type="text"
              placeholder="Buscar equipo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-[#0a1628] border border-blue-500/30 text-white text-xs rounded-lg pl-8 pr-3 py-1.5 focus:outline-none focus:border-blue-400 w-36 sm:w-48"
            />
          </div>

          <button
            onClick={() => {
              if (window.confirm('¿Generar nuevo calendario de partidos con Algoritmo Berger?')) {
                generateNewFixture(false);
              }
            }}
            className="flex items-center gap-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg border border-blue-400/30 transition-all active:scale-95 whitespace-nowrap"
          >
            <span className="material-symbols-outlined text-sm">autorenew</span>
            <span>Nuevo Fixture</span>
          </button>
        </div>
      </div>

      {/* Matches Grid */}
      {filteredMatches.length === 0 ? (
        <div className="bg-[#0d2347]/50 rounded-2xl border border-blue-500/20 p-12 text-center space-y-3">
          <span className="material-symbols-outlined text-slate-500 text-5xl">sports_soccer</span>
          <p className="text-white font-bold text-lg font-syne">No se encontraron partidos</p>
          <p className="text-xs text-blue-200/70 max-w-md mx-auto">
            Prueba cambiando los filtros seleccionados o genera un nuevo fixture con el botón "Nuevo Fixture".
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredMatches.map((match) => {
            const home = getTeam(match.homeTeamId);
            const away = getTeam(match.awayTeamId);
            const isLive = match.status === 'en_juego';
            const isFinished = match.status === 'finalizado';

            return (
              <div
                key={match.id}
                className={`relative rounded-2xl p-4 transition-all border ${
                  isLive
                    ? 'bg-gradient-to-br from-red-950/30 via-[#0d2347] to-[#0a1628] border-red-500/40 shadow-lg'
                    : 'bg-[#0d2347]/70 hover:bg-[#0d2347]/90 border-blue-500/20'
                }`}
              >
                {/* Header: Round & Venue */}
                <div className="flex items-center justify-between pb-3 border-b border-blue-500/15 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-amber-400 font-syne">
                      {match.roundName || `Fecha ${match.round}`}
                    </span>
                    <span className="text-blue-500">•</span>
                    <span className="text-slate-300 truncate max-w-[160px] sm:max-w-none flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs text-blue-400">stadium</span>
                      {match.pitch}
                    </span>
                  </div>

                  {/* Status Indicator */}
                  {isLive ? (
                    <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-600/90 text-white font-extrabold text-[10px] animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-white" />
                      <span>VIVO {match.currentMinute ? `${match.currentMinute}'` : ''}</span>
                    </span>
                  ) : isFinished ? (
                    <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-semibold text-[10px] border border-slate-700">
                      Finalizado
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-900/40 text-blue-300 font-semibold text-[10px] border border-blue-500/30">
                      <span className="material-symbols-outlined text-[10px]">schedule</span>
                      <span>
                        {match.date} {match.time}
                      </span>
                    </span>
                  )}
                </div>

                {/* Score and Teams Lineup */}
                <div className="grid grid-cols-7 items-center py-4 gap-2">
                  {/* Home */}
                  <div className="col-span-3 flex items-center gap-2.5 justify-end text-right">
                    <div className="min-w-0">
                      <p className="font-syne font-bold text-sm text-white truncate">
                        {home?.name || 'Local'}
                      </p>
                      <p className="text-[10px] text-blue-300/70">{home?.city}</p>
                    </div>
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 shadow-md border"
                      style={{ backgroundColor: home?.badgeBg, color: home?.badgeColor }}
                    >
                      {home?.shortName}
                    </div>
                  </div>

                  {/* Score / Middle */}
                  <div className="col-span-1 flex flex-col items-center justify-center">
                    {match.homeScore !== null && match.awayScore !== null ? (
                      <div className="font-syne font-extrabold text-xl sm:text-2xl text-white tracking-wider flex items-center gap-1">
                        <span>{match.homeScore}</span>
                        <span className="text-blue-400 text-sm">:</span>
                        <span>{match.awayScore}</span>
                      </div>
                    ) : (
                      <span className="text-xs font-black text-amber-400/90 font-syne bg-[#0a1628] px-2 py-1 rounded-md border border-blue-500/20">
                        VS
                      </span>
                    )}
                  </div>

                  {/* Away */}
                  <div className="col-span-3 flex items-center gap-2.5 justify-start text-left">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 shadow-md border"
                      style={{ backgroundColor: away?.badgeBg, color: away?.badgeColor }}
                    >
                      {away?.shortName}
                    </div>
                    <div className="min-w-0">
                      <p className="font-syne font-bold text-sm text-white truncate">
                        {away?.name || 'Visitante'}
                      </p>
                      <p className="text-[10px] text-blue-300/70">{away?.city}</p>
                    </div>
                  </div>
                </div>

                {/* Match Events Snippet */}
                {match.events.length > 0 && (
                  <div className="pt-2 pb-1 border-t border-blue-500/10 flex flex-wrap gap-1.5 text-[11px] text-slate-300">
                    {match.events.slice(0, 3).map((ev) => (
                      <span
                        key={ev.id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#0a1628]/60 border border-blue-500/15"
                      >
                        {ev.type === 'gol' && '⚽'}
                        {ev.type === 'penal' && '⚽ (P)'}
                        {ev.type === 'autogol' && '🛑 (AG)'}
                        {ev.type === 'amarilla' && '🟨'}
                        {ev.type === 'roja' && '🟥'}
                        <span>
                          {ev.playerName} ({ev.minute}')
                        </span>
                      </span>
                    ))}
                    {match.events.length > 3 && (
                      <span className="text-[10px] text-blue-400 self-center">
                        +{match.events.length - 3} más
                      </span>
                    )}
                  </div>
                )}

                {/* Referee Officiating Crew Strip */}
                <div className="pt-2 pb-1 border-t border-blue-500/10 flex items-center justify-between text-[11px] gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                    <span className="material-symbols-outlined text-[15px] text-amber-400 shrink-0">sports</span>
                    {match.officials && match.officials.length > 0 ? (
                      <div className="flex items-center gap-1 truncate">
                        <span className="text-slate-200 font-semibold truncate">
                          {match.officials.find((o) => o.role === 'Principal')?.refereeName || match.officials[0].refereeName}
                        </span>
                        <span className="text-[10px] text-blue-300/60 hidden sm:inline">
                          ({match.officials.length} árbitros)
                        </span>
                        {match.isRefereeSigned && (
                          <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30 flex items-center gap-0.5 ml-1">
                            <span className="material-symbols-outlined text-[10px]">verified</span>
                            Sellada
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-amber-400/90 font-medium italic text-[10px]">
                        Terna pendiente de designación
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveRefereeAssignmentModal(match)}
                    className="text-[10px] font-bold text-blue-200 hover:text-white bg-blue-900/50 hover:bg-blue-800 px-2.5 py-1 rounded-lg border border-blue-400/30 transition-all flex items-center gap-1 shrink-0"
                    title="Designar o ver terna arbitral"
                  >
                    <span>{match.officials && match.officials.length > 0 ? 'Ver Terna' : '+ Designar'}</span>
                  </button>
                </div>

                {/* Footer Action */}
                <div className="pt-2.5 mt-1 border-t border-blue-500/15 flex items-center justify-between gap-2">
                  <div className="text-[11px] text-slate-400 flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs">calendar_today</span>
                    <span>{match.date}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setActiveOfficialSheetModal(match)}
                      className="flex items-center gap-1 text-xs font-bold text-amber-300 hover:text-amber-200 bg-amber-400/15 hover:bg-amber-400/25 px-2.5 py-1.5 rounded-lg border border-amber-400/30 transition-all active:scale-95 shadow-sm"
                      title="Generar y descargar Acta Oficial en PDF"
                    >
                      <span className="material-symbols-outlined text-sm text-amber-400">picture_as_pdf</span>
                      <span>Acta PDF</span>
                    </button>

                    <button
                      onClick={() => setActiveMatchModal(match)}
                      className="flex items-center gap-1 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded-lg border border-blue-400/30 transition-all active:scale-95 shadow-sm"
                    >
                      <span className="material-symbols-outlined text-sm">assignment</span>
                      <span>{isLive ? 'Controlar en Vivo' : 'Marcador'}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

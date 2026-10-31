import React from 'react';
import { useTournament } from '../context/TournamentContext';

export const DashboardView: React.FC = () => {
  const {
    tournament,
    teams,
    matches,
    standings,
    players,
    setCurrentTab,
    setActiveMatchModal,
    setIsShareModalOpen,
  } = useTournament();

  const totalMatches = matches.length;
  const finishedMatches = matches.filter((m) => m.status === 'finalizado').length;
  const liveMatch = matches.find((m) => m.status === 'en_juego');
  const nextScheduledMatch = matches.find((m) => m.status === 'programado');

  const totalGoals = matches.reduce((acc, m) => {
    return acc + (m.homeScore || 0) + (m.awayScore || 0);
  }, 0);

  const goalAverage =
    finishedMatches + (liveMatch ? 1 : 0) > 0
      ? (totalGoals / (finishedMatches + (liveMatch ? 1 : 0))).toFixed(1)
      : '0.0';

  // Top Scorers
  const topScorers = [...players]
    .filter((p) => p.goals > 0)
    .sort((a, b) => b.goals - a.goals)
    .slice(0, 5);

  const getTeam = (teamId: string) => teams.find((t) => t.id === teamId);

  return (
    <div className="space-y-6">
      {/* Apolodigital Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0d2347] via-[#102d5e] to-[#0a1628] border border-blue-500/25 p-6 sm:p-8 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-amber-400/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/15 border border-blue-400/30 text-xs font-semibold text-blue-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{tournament.subtitle}</span>
            </div>

            <h1 className="font-syne font-extrabold text-2xl sm:text-4xl text-white tracking-tight leading-tight">
              {tournament.name}
            </h1>

            <p className="text-sm text-blue-200/80 leading-relaxed font-normal">
              Gestor integral de campeonatos estilo 4League adaptado por{' '}
              <a
                href="https://apolodigital.lat"
                target="_blank"
                rel="noreferrer"
                className="text-amber-400 font-bold hover:underline"
              >
                Apolodigital.lat
              </a>
              . Controla fixture automático, actas en vivo, tabla de posiciones y exportación directa
              a WhatsApp.
            </p>
          </div>

          <div className="flex flex-wrap md:flex-col gap-2.5 self-start md:self-auto">
            <button
              onClick={() => setCurrentTab('cronicas')}
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-black px-4 py-2.5 rounded-xl shadow-lg shadow-amber-950/40 transition-all active:scale-95"
            >
              <span className="material-symbols-outlined text-lg">auto_stories</span>
              <span>Crónicas con IA</span>
            </button>
            <button
              onClick={() => setIsShareModalOpen(true)}
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-emerald-950/50 border border-emerald-400/40 transition-all active:scale-95"
            >
              <span className="material-symbols-outlined text-lg">whatsapp</span>
              <span>Reporte WhatsApp</span>
            </button>
            <button
              onClick={() => setCurrentTab('partidos')}
              className="flex items-center justify-center gap-2 bg-blue-600/30 hover:bg-blue-600/50 text-blue-200 text-xs font-bold px-4 py-2.5 rounded-xl border border-blue-400/30 transition-all"
            >
              <span className="material-symbols-outlined text-lg">calendar_month</span>
              <span>Ver Calendario</span>
            </button>
          </div>
        </div>

        {/* Quick Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-blue-500/20">
          <div className="bg-[#0a1628]/60 rounded-xl p-3.5 border border-blue-500/15">
            <p className="text-[11px] font-semibold text-blue-300 uppercase tracking-wider">Equipos</p>
            <p className="font-syne font-bold text-2xl text-white mt-0.5">{teams.length}</p>
          </div>
          <div className="bg-[#0a1628]/60 rounded-xl p-3.5 border border-blue-500/15">
            <p className="text-[11px] font-semibold text-blue-300 uppercase tracking-wider">Partidos</p>
            <p className="font-syne font-bold text-2xl text-white mt-0.5">
              {finishedMatches} <span className="text-xs text-blue-300 font-normal">/ {totalMatches}</span>
            </p>
          </div>
          <div className="bg-[#0a1628]/60 rounded-xl p-3.5 border border-blue-500/15">
            <p className="text-[11px] font-semibold text-amber-300 uppercase tracking-wider">Goles Totales</p>
            <p className="font-syne font-bold text-2xl text-amber-400 mt-0.5">{totalGoals}</p>
          </div>
          <div className="bg-[#0a1628]/60 rounded-xl p-3.5 border border-blue-500/15">
            <p className="text-[11px] font-semibold text-blue-300 uppercase tracking-wider">Promedio / Partido</p>
            <p className="font-syne font-bold text-2xl text-blue-200 mt-0.5">{goalAverage}</p>
          </div>
        </div>
      </div>

      {/* Featured Match: Live or Upcoming */}
      {(liveMatch || nextScheduledMatch) && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-syne font-bold text-lg text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-400">timer</span>
              <span>{liveMatch ? 'Partido en Vivo' : 'Próximo Partido'}</span>
            </h2>
            <button
              onClick={() => setCurrentTab('partidos')}
              className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              <span>Ver todas las jornadas</span>
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          </div>

          {(() => {
            const m = liveMatch || nextScheduledMatch!;
            const home = getTeam(m.homeTeamId);
            const away = getTeam(m.awayTeamId);
            const isLive = m.status === 'en_juego';

            return (
              <div
                className={`relative overflow-hidden rounded-2xl p-5 border transition-all ${
                  isLive
                    ? 'bg-gradient-to-br from-red-950/40 via-[#0d2347] to-[#0a1628] border-red-500/40 shadow-xl shadow-red-950/30'
                    : 'bg-[#0d2347]/80 border-blue-500/25'
                }`}
              >
                {/* Status Badge */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-blue-300 uppercase tracking-wider">
                      {m.roundName || `Jornada ${m.round}`}
                    </span>
                    <span className="text-blue-500">•</span>
                    <span className="text-xs text-slate-300 flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs text-blue-400">stadium</span>
                      {m.pitch}
                    </span>
                  </div>

                  {isLive ? (
                    <div className="flex items-center gap-2 bg-red-600/90 text-white text-xs font-extrabold px-3 py-1 rounded-full animate-pulse border border-red-400/50">
                      <span className="w-2 h-2 rounded-full bg-white" />
                      <span>EN VIVO ({m.currentMinute || 45}')</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 bg-blue-600/20 text-blue-300 text-xs font-semibold px-3 py-1 rounded-full border border-blue-400/20">
                      <span className="material-symbols-outlined text-xs">schedule</span>
                      <span>
                        {m.date} - {m.time}
                      </span>
                    </div>
                  )}
                </div>

                {/* Scoreboard Arena */}
                <div className="grid grid-cols-3 items-center py-2">
                  {/* Home Team */}
                  <div className="flex flex-col items-center text-center space-y-2">
                    <div
                      className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center font-black text-lg shadow-md border-2 border-white/20"
                      style={{ backgroundColor: home?.badgeBg, color: home?.badgeColor }}
                    >
                      {home?.shortName || 'LOC'}
                    </div>
                    <p className="font-syne font-bold text-sm sm:text-base text-white line-clamp-1">
                      {home?.name}
                    </p>
                    <span className="text-[11px] text-blue-300/80">{home?.city}</span>
                  </div>

                  {/* Score or VS */}
                  <div className="flex flex-col items-center justify-center space-y-1">
                    {m.homeScore !== null && m.awayScore !== null ? (
                      <div className="flex items-center gap-3">
                        <span className="font-syne font-extrabold text-3xl sm:text-5xl text-white">
                          {m.homeScore}
                        </span>
                        <span className="font-syne font-bold text-xl text-blue-400">-</span>
                        <span className="font-syne font-extrabold text-3xl sm:text-5xl text-white">
                          {m.awayScore}
                        </span>
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-blue-900/40 border border-blue-500/30 flex items-center justify-center font-black text-amber-400 font-syne text-sm">
                        VS
                      </div>
                    )}

                    <button
                      onClick={() => setActiveMatchModal(m)}
                      className="mt-2 text-xs font-bold text-amber-300 hover:text-amber-200 bg-amber-400/10 hover:bg-amber-400/20 border border-amber-400/30 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 active:scale-95"
                    >
                      <span className="material-symbols-outlined text-sm">edit_note</span>
                      <span>{isLive ? 'Controlar en Vivo' : 'Ficha del Partido'}</span>
                    </button>
                  </div>

                  {/* Away Team */}
                  <div className="flex flex-col items-center text-center space-y-2">
                    <div
                      className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center font-black text-lg shadow-md border-2 border-white/20"
                      style={{ backgroundColor: away?.badgeBg, color: away?.badgeColor }}
                    >
                      {away?.shortName || 'VIS'}
                    </div>
                    <p className="font-syne font-bold text-sm sm:text-base text-white line-clamp-1">
                      {away?.name}
                    </p>
                    <span className="text-[11px] text-blue-300/80">{away?.city}</span>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Main Grid: Standings Preview & Top Scorers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Standings Top 5 (2/3 width) */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-syne font-bold text-lg text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-400">leaderboard</span>
              <span>Tabla de Posiciones (Líderes)</span>
            </h2>
            <button
              onClick={() => setCurrentTab('tabla')}
              className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              <span>Ver tabla completa</span>
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          </div>

          <div className="bg-[#0d2347]/70 rounded-2xl border border-blue-500/20 overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="bg-[#0a1628]/80 text-blue-300/80 font-bold uppercase text-[11px] border-b border-blue-500/20">
                    <th className="py-3 px-3 w-8 text-center">#</th>
                    <th className="py-3 px-4">Club</th>
                    <th className="py-3 px-2 text-center">PJ</th>
                    <th className="py-3 px-2 text-center">G</th>
                    <th className="py-3 px-2 text-center">E</th>
                    <th className="py-3 px-2 text-center">P</th>
                    <th className="py-3 px-2 text-center">DG</th>
                    <th className="py-3 px-4 text-center font-extrabold text-amber-400">PTS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-500/10">
                  {standings.slice(0, 5).map((row, idx) => (
                    <tr
                      key={row.teamId}
                      className="hover:bg-blue-600/10 transition-colors"
                    >
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-flex items-center justify-center w-6 h-6 rounded-md font-black text-xs ${
                            idx === 0
                              ? 'bg-amber-400 text-slate-950 font-bold'
                              : idx < 3
                              ? 'bg-blue-600/30 text-blue-300 border border-blue-400/30'
                              : 'text-slate-400'
                          }`}
                        >
                          {idx + 1}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 shadow-sm"
                            style={{ backgroundColor: row.team.badgeBg, color: row.team.badgeColor }}
                          >
                            {row.team.shortName}
                          </div>
                          <div>
                            <p className="font-semibold text-white line-clamp-1">{row.team.name}</p>
                            <p className="text-[10px] text-blue-300/70">{row.team.stadium}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-2 text-center text-slate-300">{row.played}</td>
                      <td className="py-3 px-2 text-center text-emerald-400 font-semibold">{row.won}</td>
                      <td className="py-3 px-2 text-center text-slate-400">{row.drawn}</td>
                      <td className="py-3 px-2 text-center text-rose-400">{row.lost}</td>
                      <td
                        className={`py-3 px-2 text-center font-bold ${
                          row.goalDifference > 0
                            ? 'text-emerald-400'
                            : row.goalDifference < 0
                            ? 'text-rose-400'
                            : 'text-slate-400'
                        }`}
                      >
                        {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
                      </td>
                      <td className="py-3 px-4 text-center font-black text-amber-400 text-sm">
                        {row.points}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Top Scorers (1/3 width) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-syne font-bold text-lg text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-400">sports_score</span>
              <span>Goleadores</span>
            </h2>
            <button
              onClick={() => setCurrentTab('goleadores')}
              className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              <span>Ver todos</span>
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          </div>

          <div className="bg-[#0d2347]/70 rounded-2xl border border-blue-500/20 p-4 space-y-3 shadow-lg">
            {topScorers.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">Aún no se registraron goles</p>
            ) : (
              topScorers.map((player, idx) => {
                const team = getTeam(player.teamId);
                const medalColor =
                  idx === 0
                    ? 'text-amber-400 bg-amber-400/10 border-amber-400/30'
                    : idx === 1
                    ? 'text-slate-200 bg-slate-300/10 border-slate-300/30'
                    : idx === 2
                    ? 'text-amber-700 bg-amber-700/10 border-amber-700/30'
                    : 'text-blue-300 bg-blue-500/10 border-blue-500/20';

                return (
                  <div
                    key={player.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-[#0a1628]/60 border border-blue-500/10 hover:border-blue-500/30 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-7 h-7 rounded-lg border flex items-center justify-center font-bold text-xs ${medalColor}`}
                      >
                        {idx + 1}
                      </span>
                      <div>
                        <p className="font-bold text-white text-xs sm:text-sm">{player.name}</p>
                        <p className="text-[10px] text-blue-300/70">{team?.name || 'Club'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-syne font-black text-amber-400 text-base">
                        {player.goals}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase">goles</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

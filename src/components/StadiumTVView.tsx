import React, { useState, useEffect } from 'react';
import { useTournament } from '../context/TournamentContext';
import { Match, StandingRow, Team, Player } from '../types/tournament';

type TVChannel = 'scoreboard' | 'standings' | 'scorers' | 'fixtures';

export const StadiumTVView: React.FC = () => {
  const { tournament, teams, matches, standings, players, setViewMode } = useTournament();

  const [activeChannel, setActiveChannel] = useState<TVChannel>('scoreboard');
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [rotateProgress, setRotateProgress] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Digital Stadium Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('es-BO', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
      setCurrentDate(
        now.toLocaleDateString('es-BO', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-Rotation Timer (12 seconds per channel)
  useEffect(() => {
    if (!autoRotate) {
      setRotateProgress(0);
      return;
    }

    const duration = 12000; // 12s
    const tick = 100;
    let elapsed = 0;

    const channels: TVChannel[] = ['scoreboard', 'standings', 'scorers', 'fixtures'];

    const timer = setInterval(() => {
      elapsed += tick;
      setRotateProgress(Math.min(100, (elapsed / duration) * 100));

      if (elapsed >= duration) {
        elapsed = 0;
        setRotateProgress(0);
        setActiveChannel((prev) => {
          const currentIndex = channels.indexOf(prev);
          const nextIndex = (currentIndex + 1) % channels.length;
          return channels[nextIndex];
        });
      }
    }, tick);

    return () => clearInterval(timer);
  }, [autoRotate]);

  // Fullscreen Handler
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // Keyboard shortcut: ESC or 'f'
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.fullscreenElement) {
        setViewMode('desktop');
      }
      if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setViewMode]);

  // Live or featured match for Scoreboard channel
  const liveMatch = matches.find((m) => m.status === 'en_juego') ||
    matches.find((m) => m.status === 'finalizado') ||
    matches[0];

  const homeTeam = teams.find((t) => t.id === liveMatch?.homeTeamId);
  const awayTeam = teams.find((t) => t.id === liveMatch?.awayTeamId);

  // Top Scorers
  const topScorers = [...players]
    .filter((p) => p.goals > 0)
    .sort((a, b) => b.goals - a.goals)
    .slice(0, 6);

  // Next fixtures
  const upcomingMatches = matches
    .filter((m) => m.status === 'programado')
    .slice(0, 4);

  return (
    <div className="fixed inset-0 z-50 bg-[#040812] text-white flex flex-col font-sans select-none overflow-hidden">
      {/* Dynamic Background Glows */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[350px] bg-blue-600/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[350px] bg-amber-500/10 rounded-full blur-[140px] pointer-events-none" />

      {/* TOP BROADCAST OVERLAY BAR */}
      <header className="relative z-20 bg-[#07101e]/90 backdrop-blur-xl border-b border-blue-500/30 px-6 lg:px-10 py-3.5 flex items-center justify-between">
        {/* League & Tenant Brand */}
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900 border-2 border-amber-400 shadow-xl shadow-blue-900/50">
            <span className="material-symbols-outlined text-amber-400 text-3xl">sports_soccer</span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-syne font-black text-2xl tracking-tight text-white">
                Apolo<span className="text-blue-400">Digital</span>
              </span>
              <span className="text-amber-400 font-black text-xs px-2.5 py-0.5 rounded-full bg-amber-400/15 border border-amber-400/40 tracking-wider">
                LEAGUE TV
              </span>
              <span className="text-xs px-2 py-0.5 rounded font-black bg-rose-600 text-white animate-pulse flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-white" />
                <span>SEÑAL EN VIVO</span>
              </span>
            </div>
            <p className="text-xs text-blue-200/80 font-medium">
              {tournament.name} • {liveMatch?.pitch || 'Estadio Municipal de Apolo'} • Bolivia 🇧🇴
            </p>
          </div>
        </div>

        {/* Center: Channel Title Indicator */}
        <div className="hidden md:flex flex-col items-center text-center">
          <span className="text-[11px] font-mono text-amber-400 font-bold uppercase tracking-widest">
            {activeChannel === 'scoreboard' && '⚽ TRANSMISIÓN DEL ENCUENTRO EN VIVO'}
            {activeChannel === 'standings' && '📊 TABLA GENERAL DE POSICIONES'}
            {activeChannel === 'scorers' && '🏆 CUADRO DE HONOR · PICHICHI 2026'}
            {activeChannel === 'fixtures' && '🗓️ FIXTURE & PRÓXIMOS ENCUENTROS'}
          </span>
          <span className="text-xs text-slate-300 font-medium capitalize">
            {currentDate}
          </span>
        </div>

        {/* Right: Digital Clock & Exit TV Mode */}
        <div className="flex items-center gap-4">
          <div className="bg-[#0a1628] border border-blue-500/40 px-4 py-1.5 rounded-2xl text-right shadow-inner">
            <p className="font-mono font-black text-xl lg:text-2xl text-amber-400 leading-none">
              {currentTime}
            </p>
            <span className="text-[10px] text-blue-300 font-mono">Hora Oficial (BO)</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleFullscreen}
              className="p-2.5 rounded-xl bg-blue-950/70 hover:bg-blue-900 border border-blue-500/30 text-blue-300 hover:text-white transition-all shadow"
              title="Alternar Pantalla Completa (F)"
            >
              <span className="material-symbols-outlined text-xl">
                {isFullscreen ? 'fullscreen_exit' : 'fullscreen'}
              </span>
            </button>

            <button
              onClick={() => setViewMode('desktop')}
              className="flex items-center gap-1.5 bg-rose-900/60 hover:bg-rose-800 text-rose-200 border border-rose-500/40 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow active:scale-95"
              title="Volver a la interfaz web estándar (ESC)"
            >
              <span className="material-symbols-outlined text-base">exit_to_app</span>
              <span className="hidden sm:inline">Salir TV</span>
            </button>
          </div>
        </div>
      </header>

      {/* AUTO-ROTATION PROGRESS BAR */}
      {autoRotate && (
        <div className="w-full h-1 bg-blue-950 relative z-30">
          <div
            className="h-full bg-gradient-to-r from-blue-500 via-amber-400 to-amber-300 transition-all duration-100 ease-linear"
            style={{ width: `${rotateProgress}%` }}
          />
        </div>
      )}

      {/* MAIN SCREEN AREA */}
      <main className="flex-1 overflow-hidden p-6 lg:p-10 flex flex-col justify-center relative z-10">
        {/* CHANNEL 1: MARCADOR GIGANTE EN VIVO */}
        {activeChannel === 'scoreboard' && (
          <div className="max-w-6xl w-full mx-auto space-y-6 animate-in fade-in zoom-in-95 duration-500">
            {/* Match Status Bar */}
            <div className="flex items-center justify-between bg-[#0a1628]/80 backdrop-blur-md px-6 py-3 rounded-2xl border border-blue-500/30">
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
                <span className="font-syne font-black text-sm uppercase tracking-wider text-rose-400">
                  {liveMatch?.status === 'en_juego' ? '🔴 EN VIVO' : 'PARTIDO OFICIAL'}
                </span>
                <span className="text-slate-400">•</span>
                <span className="text-xs text-blue-200 font-semibold">
                  {liveMatch?.roundName || `Jornada ${liveMatch?.round}`}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-400 text-base">stadium</span>
                <span className="text-xs font-bold text-white">{liveMatch?.pitch}</span>
              </div>
            </div>

            {/* Giant Arena Scoreboard */}
            <div className="bg-gradient-to-b from-[#0a1c38]/90 via-[#0a1628]/95 to-[#060e1a]/95 rounded-[36px] border-2 border-blue-500/40 p-8 lg:p-12 shadow-2xl relative overflow-hidden">
              <div className="grid grid-cols-11 items-center gap-4">
                {/* Home Team */}
                <div className="col-span-4 flex flex-col items-center text-center space-y-3">
                  <div
                    className="w-28 h-28 lg:w-36 lg:h-36 rounded-3xl flex flex-col items-center justify-center font-black text-3xl lg:text-4xl shadow-2xl border-4 border-white/20 transform hover:scale-105 transition-transform"
                    style={{ backgroundColor: homeTeam?.badgeBg || '#1a4fd6', color: homeTeam?.badgeColor || '#ffffff' }}
                  >
                    <span>{homeTeam?.shortName}</span>
                    <span className="text-xs font-mono opacity-80 mt-1">LOCAL</span>
                  </div>
                  <div>
                    <h2 className="font-syne font-black text-xl lg:text-3xl text-white tracking-tight">
                      {homeTeam?.name}
                    </h2>
                    <p className="text-xs lg:text-sm text-blue-300 font-medium mt-0.5">
                      DT: {homeTeam?.coach} • {homeTeam?.city}
                    </p>
                  </div>
                </div>

                {/* Score & Live Timer */}
                <div className="col-span-3 flex flex-col items-center justify-center space-y-3">
                  {/* Live Minute Pulse Box */}
                  <div className="px-5 py-1.5 rounded-full bg-rose-600/90 border border-rose-400 shadow-lg shadow-rose-900/50 flex items-center gap-2 animate-pulse">
                    <span className="material-symbols-outlined text-sm text-white">timer</span>
                    <span className="font-syne font-black text-sm lg:text-base text-white tracking-widest">
                      {liveMatch?.status === 'en_juego' ? `${liveMatch?.currentMinute || 68}' (2T)` : 'FINALIZADO'}
                    </span>
                  </div>

                  {/* Giant Numbers */}
                  <div className="flex items-center gap-4">
                    <span className="font-syne font-black text-6xl lg:text-9xl text-white tracking-tighter drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)]">
                      {liveMatch?.homeScore ?? 0}
                    </span>
                    <span className="font-syne font-black text-4xl lg:text-6xl text-amber-400 opacity-60">
                      :
                    </span>
                    <span className="font-syne font-black text-6xl lg:text-9xl text-white tracking-tighter drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)]">
                      {liveMatch?.awayScore ?? 0}
                    </span>
                  </div>

                  <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-widest">
                    Marcador Oficial FBF / Apolo
                  </span>
                </div>

                {/* Away Team */}
                <div className="col-span-4 flex flex-col items-center text-center space-y-3">
                  <div
                    className="w-28 h-28 lg:w-36 lg:h-36 rounded-3xl flex flex-col items-center justify-center font-black text-3xl lg:text-4xl shadow-2xl border-4 border-white/20 transform hover:scale-105 transition-transform"
                    style={{ backgroundColor: awayTeam?.badgeBg || '#15803d', color: awayTeam?.badgeColor || '#ffffff' }}
                  >
                    <span>{awayTeam?.shortName}</span>
                    <span className="text-xs font-mono opacity-80 mt-1">VISITA</span>
                  </div>
                  <div>
                    <h2 className="font-syne font-black text-xl lg:text-3xl text-white tracking-tight">
                      {awayTeam?.name}
                    </h2>
                    <p className="text-xs lg:text-sm text-blue-300 font-medium mt-0.5">
                      DT: {awayTeam?.coach} • {awayTeam?.city}
                    </p>
                  </div>
                </div>
              </div>

              {/* Match Events Ticker / Highlights */}
              <div className="mt-8 pt-6 border-t border-blue-500/20">
                <div className="flex flex-wrap items-center justify-center gap-4 text-xs lg:text-sm">
                  {liveMatch?.events && liveMatch.events.length > 0 ? (
                    liveMatch.events.map((ev) => (
                      <div
                        key={ev.id}
                        className="bg-[#040914]/80 border border-blue-500/30 px-3.5 py-1.5 rounded-xl flex items-center gap-2 shadow"
                      >
                        <span className="font-syne font-black text-amber-400">{ev.minute}'</span>
                        <span>{ev.type === 'gol' || ev.type === 'penal' ? '⚽' : ev.type === 'amarilla' ? '🟨' : '🟥'}</span>
                        <span className="font-bold text-white">{ev.playerName}</span>
                        <span className="text-[11px] text-blue-300 font-medium">({ev.teamName})</span>
                      </div>
                    ))
                  ) : (
                    <span className="text-slate-400 italic">
                      Duelo parejo en el mediocampo · Sin amonestaciones registradas
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CHANNEL 2: TABLA DE POSICIONES GIGANTE */}
        {activeChannel === 'standings' && (
          <div className="max-w-6xl w-full mx-auto space-y-4 animate-in fade-in zoom-in-95 duration-500">
            <div className="flex items-center justify-between bg-[#0a1628]/90 px-6 py-3 rounded-2xl border border-blue-500/30">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-amber-400 text-2xl">format_list_numbered</span>
                <h2 className="font-syne font-black text-xl text-white uppercase tracking-wider">
                  Tabla Oficial de Posiciones · Temporada 2026
                </h2>
              </div>
              <span className="text-xs font-mono text-amber-300 font-bold bg-amber-400/10 px-3 py-1 rounded-full border border-amber-400/30">
                Normativa FIFA · 3 Pts por Victoria
              </span>
            </div>

            <div className="bg-[#0a1628]/95 rounded-3xl border-2 border-blue-500/40 overflow-hidden shadow-2xl">
              <table className="w-full text-left text-xs lg:text-sm">
                <thead>
                  <tr className="bg-[#060e1a] text-blue-300 font-bold uppercase text-[11px] border-b border-blue-500/30 tracking-wider">
                    <th className="py-3.5 px-4 text-center w-14">POS</th>
                    <th className="py-3.5 px-4">CLUB / EQUIPO</th>
                    <th className="py-3.5 px-3 text-center">PJ</th>
                    <th className="py-3.5 px-3 text-center">PG</th>
                    <th className="py-3.5 px-3 text-center">PE</th>
                    <th className="py-3.5 px-3 text-center">PP</th>
                    <th className="py-3.5 px-3 text-center">GF</th>
                    <th className="py-3.5 px-3 text-center">GC</th>
                    <th className="py-3.5 px-3 text-center font-bold">DIF</th>
                    <th className="py-3.5 px-5 text-center font-black text-amber-400 text-sm">PTS</th>
                    <th className="py-3.5 px-4 text-center">FORMA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-500/15">
                  {standings.map((row, idx) => {
                    const isLeader = idx === 0;
                    const isPodium = idx < 3;

                    return (
                      <tr
                        key={row.teamId}
                        className={`transition-colors ${
                          isLeader
                            ? 'bg-amber-400/10 font-bold'
                            : isPodium
                            ? 'bg-blue-900/20'
                            : 'hover:bg-blue-600/10'
                        }`}
                      >
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex items-center justify-center w-7 h-7 rounded-xl font-syne font-black text-xs shadow ${
                              idx === 0
                                ? 'bg-amber-400 text-slate-950'
                                : idx === 1
                                ? 'bg-slate-300 text-slate-950'
                                : idx === 2
                                ? 'bg-amber-700 text-white'
                                : 'bg-[#0d2347] text-slate-300 border border-blue-500/20'
                            }`}
                          >
                            {idx + 1}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs shadow"
                              style={{ backgroundColor: row.team.badgeBg, color: row.team.badgeColor }}
                            >
                              {row.team.shortName}
                            </div>
                            <span className="font-bold text-white text-sm lg:text-base">
                              {row.team.name}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center text-slate-300">{row.played}</td>
                        <td className="py-3 px-3 text-center text-emerald-400 font-bold">{row.won}</td>
                        <td className="py-3 px-3 text-center text-amber-300 font-bold">{row.drawn}</td>
                        <td className="py-3 px-3 text-center text-rose-400 font-bold">{row.lost}</td>
                        <td className="py-3 px-3 text-center text-slate-300">{row.goalsFor}</td>
                        <td className="py-3 px-3 text-center text-slate-300">{row.goalsAgainst}</td>
                        <td className="py-3 px-3 text-center font-bold text-white">
                          {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
                        </td>
                        <td className="py-3 px-5 text-center font-syne font-black text-amber-400 text-lg">
                          {row.points}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {row.form && row.form.length > 0 ? (
                              row.form.map((f, i) => (
                                <span
                                  key={i}
                                  className={`w-5 h-5 rounded-full text-[9px] font-black flex items-center justify-center ${
                                    f === 'W'
                                      ? 'bg-emerald-500 text-white'
                                      : f === 'D'
                                      ? 'bg-amber-500 text-slate-950'
                                      : 'bg-rose-500 text-white'
                                  }`}
                                >
                                  {f === 'W' ? 'V' : f === 'D' ? 'E' : 'D'}
                                </span>
                              ))
                            ) : (
                              <span className="text-slate-500">-</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* CHANNEL 3: GOLEADORES (PICHICHI SHOWCASE) */}
        {activeChannel === 'scorers' && (
          <div className="max-w-6xl w-full mx-auto space-y-6 animate-in fade-in zoom-in-95 duration-500">
            <div className="flex items-center justify-between bg-[#0a1628]/90 px-6 py-3 rounded-2xl border border-blue-500/30">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-amber-400 text-2xl">military_tech</span>
                <h2 className="font-syne font-black text-xl text-white uppercase tracking-wider">
                  Goleadores Destacados · Pichichi 2026
                </h2>
              </div>
              <span className="text-xs text-blue-300 font-mono">Estadísticas Oficiales</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {topScorers.map((player, idx) => {
                const team = teams.find((t) => t.id === player.teamId);

                return (
                  <div
                    key={player.id}
                    className={`rounded-3xl p-6 border-2 transition-all relative overflow-hidden ${
                      idx === 0
                        ? 'bg-gradient-to-br from-amber-500/20 via-[#0d2347] to-[#0a1628] border-amber-400 shadow-2xl'
                        : 'bg-[#0a1628]/90 border-blue-500/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <span
                        className={`w-8 h-8 rounded-xl font-syne font-black text-sm flex items-center justify-center shadow ${
                          idx === 0
                            ? 'bg-amber-400 text-slate-950'
                            : 'bg-blue-900/60 text-white border border-blue-400/30'
                        }`}
                      >
                        #{idx + 1}
                      </span>
                      <span className="font-syne font-black text-amber-400 text-3xl">
                        ⚽ {player.goals}
                      </span>
                    </div>

                    <div className="flex items-center gap-4">
                      <div
                        className="w-16 h-16 rounded-2xl flex items-center justify-center font-black text-xl shadow-lg border border-white/20"
                        style={{ backgroundColor: team?.badgeBg || '#1a4fd6', color: team?.badgeColor || '#ffffff' }}
                      >
                        #{player.number}
                      </div>

                      <div className="min-w-0">
                        <h3 className="font-syne font-black text-lg text-white leading-tight truncate">
                          {player.name}
                        </h3>
                        <p className="text-xs text-amber-300 font-bold truncate mt-0.5">
                          {team?.name}
                        </p>
                        <p className="text-[11px] text-blue-200/70 mt-1">
                          {player.position} • {player.nationality || 'Bolivia 🇧🇴'}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* CHANNEL 4: PRÓXIMOS ENCUENTROS / FIXTURE */}
        {activeChannel === 'fixtures' && (
          <div className="max-w-6xl w-full mx-auto space-y-6 animate-in fade-in zoom-in-95 duration-500">
            <div className="flex items-center justify-between bg-[#0a1628]/90 px-6 py-3 rounded-2xl border border-blue-500/30">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-blue-400 text-2xl">calendar_month</span>
                <h2 className="font-syne font-black text-xl text-white uppercase tracking-wider">
                  Fixture & Próximas Jornadas
                </h2>
              </div>
              <span className="text-xs text-amber-300 font-bold">Algoritmo Matemático de Berger</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {upcomingMatches.map((m) => {
                const home = teams.find((t) => t.id === m.homeTeamId);
                const away = teams.find((t) => t.id === m.awayTeamId);

                return (
                  <div
                    key={m.id}
                    className="bg-[#0a1628]/95 rounded-3xl border-2 border-blue-500/30 p-6 space-y-4 shadow-xl"
                  >
                    <div className="flex items-center justify-between text-xs text-blue-300 font-semibold border-b border-blue-500/20 pb-2.5">
                      <span>{m.roundName || `Jornada ${m.round}`}</span>
                      <span>{m.date} · {m.time}</span>
                    </div>

                    <div className="grid grid-cols-7 items-center gap-3">
                      <div className="col-span-3 flex flex-col items-center text-center space-y-1.5">
                        <div
                          className="w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-sm shadow"
                          style={{ backgroundColor: home?.badgeBg, color: home?.badgeColor }}
                        >
                          {home?.shortName}
                        </div>
                        <span className="font-bold text-sm text-white truncate w-full">{home?.name}</span>
                      </div>

                      <div className="col-span-1 text-center font-black text-amber-400 text-sm">
                        VS
                      </div>

                      <div className="col-span-3 flex flex-col items-center text-center space-y-1.5">
                        <div
                          className="w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-sm shadow"
                          style={{ backgroundColor: away?.badgeBg, color: away?.badgeColor }}
                        >
                          {away?.shortName}
                        </div>
                        <span className="font-bold text-sm text-white truncate w-full">{away?.name}</span>
                      </div>
                    </div>

                    <div className="text-center text-[11px] text-slate-400 flex items-center justify-center gap-1">
                      <span className="material-symbols-outlined text-xs text-amber-400">stadium</span>
                      <span>{m.pitch}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* BOTTOM TICKER / CINTILLO HORIZONTAL DEPORTIVO */}
      <footer className="relative z-20 bg-[#07101e]/95 border-t border-blue-500/30 py-2.5 overflow-hidden flex items-center">
        <div className="bg-amber-400 text-slate-950 font-black text-xs px-4 py-1 flex items-center gap-1.5 shrink-0 uppercase tracking-wider z-10 shadow-lg">
          <span className="material-symbols-outlined text-sm">campaign</span>
          <span>NOTICIAS APOLO</span>
        </div>

        <div className="flex-1 overflow-hidden whitespace-nowrap">
          <div className="inline-block animate-marquee text-xs font-semibold text-blue-100 tracking-wide">
            🏆 LIGA DE FÚTBOL APOLODIGITAL 2026 • SEÑAL OFICIAL TRANSMITIDA DESDE EL ESTADIO MUNICIPAL DE APOLO • 8 CLUBES EN COMPETENCIA EN FRANZ TAMAYO • PICHICHI DEL CAMPEONATO: GONZALO VACA ({topScorers[0]?.goals || 7} GOLES) • TABLA LIDERADA POR CLUB APOLO F.C. • SIGUE LAS ESTADÍSTICAS EN VIVO EN APOLODIGITAL.LAT • DEPORTE, PASIÓN Y TECNOLOGÍA EN EL NORTE PACEÑO •
          </div>
        </div>
      </footer>

      {/* FLOATING STADIUM DJ / OPERATOR CONTROLS (Hover or Discrete at Bottom) */}
      <div className="fixed bottom-14 left-1/2 -translate-x-1/2 z-40 bg-[#0a1628]/95 backdrop-blur-xl border border-blue-500/40 p-2 rounded-2xl shadow-2xl flex items-center gap-2 text-xs">
        <button
          onClick={() => setActiveChannel('scoreboard')}
          className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
            activeChannel === 'scoreboard'
              ? 'bg-blue-600 text-white shadow'
              : 'text-slate-300 hover:text-white'
          }`}
        >
          <span>🔴</span>
          <span>Marcador</span>
        </button>

        <button
          onClick={() => setActiveChannel('standings')}
          className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
            activeChannel === 'standings'
              ? 'bg-blue-600 text-white shadow'
              : 'text-slate-300 hover:text-white'
          }`}
        >
          <span>📊</span>
          <span>Posiciones</span>
        </button>

        <button
          onClick={() => setActiveChannel('scorers')}
          className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
            activeChannel === 'scorers'
              ? 'bg-blue-600 text-white shadow'
              : 'text-slate-300 hover:text-white'
          }`}
        >
          <span>🏆</span>
          <span>Goleadores</span>
        </button>

        <button
          onClick={() => setActiveChannel('fixtures')}
          className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
            activeChannel === 'fixtures'
              ? 'bg-blue-600 text-white shadow'
              : 'text-slate-300 hover:text-white'
          }`}
        >
          <span>🗓️</span>
          <span>Fixture</span>
        </button>

        <div className="w-[1px] h-5 bg-blue-500/30 mx-1" />

        <button
          onClick={() => setAutoRotate(!autoRotate)}
          className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all ${
            autoRotate
              ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
              : 'text-slate-400 hover:text-white'
          }`}
          title="Alternar rotación automática de canales cada 12 segundos"
        >
          <span className="material-symbols-outlined text-sm">
            {autoRotate ? 'autorenew' : 'pause'}
          </span>
          <span>{autoRotate ? 'Auto-Rotar' : 'Pausado'}</span>
        </button>
      </div>
    </div>
  );
};

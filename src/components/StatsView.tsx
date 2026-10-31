import React, { useState } from 'react';
import { useTournament } from '../context/TournamentContext';
import { Player } from '../types/tournament';
import { PlayerPassportModal } from './PlayerPassportModal';

export const StatsView: React.FC = () => {
  const { players, teams, matches, standings, tournament } = useTournament();

  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  const getTeam = (teamId: string) => teams.find((t) => t.id === teamId);

  // Scorers sorted
  const scorers = [...players]
    .filter((p) => p.goals > 0)
    .sort((a, b) => b.goals - a.goals);

  // Cards sorted
  const disciplinary = [...players]
    .filter((p) => p.yellowCards > 0 || p.redCards > 0)
    .sort((a, b) => b.redCards * 3 + b.yellowCards - (a.redCards * 3 + a.yellowCards));

  // Best attack & Best defense
  const bestAttack = [...standings].sort((a, b) => b.goalsFor - a.goalsFor)[0];
  const bestDefense = [...standings].filter((r) => r.played > 0).sort((a, b) => a.goalsAgainst - b.goalsAgainst)[0];

  const totalGoals = matches.reduce((acc, m) => acc + (m.homeScore || 0) + (m.awayScore || 0), 0);
  const totalYellows = players.reduce((acc, p) => acc + p.yellowCards, 0);
  const totalReds = players.reduce((acc, p) => acc + p.redCards, 0);

  return (
    <>
      <div className="space-y-6">
        {/* Top Banner */}
        <div className="bg-[#0d2347]/80 p-5 rounded-2xl border border-blue-500/20">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-syne font-extrabold text-xl text-white">Estadísticas & Goleadores</h2>
              <p className="text-xs text-blue-200/70 mt-1">
                {tournament.name} • Rendimiento individual y colectivo con Pasaporte Deportivo
              </p>
            </div>
            <span className="text-xs px-3 py-1 rounded-full font-bold bg-amber-400/10 text-amber-400 border border-amber-400/30">
              Pichichi & Fair Play
            </span>
          </div>

          {/* 4 Cards Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            <div className="bg-[#0a1628]/70 p-3.5 rounded-xl border border-blue-500/20">
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                Total de Goles
              </span>
              <p className="font-syne font-black text-2xl text-white mt-1">⚽ {totalGoals}</p>
            </div>
            <div className="bg-[#0a1628]/70 p-3.5 rounded-xl border border-blue-500/20">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                Mejor Ataque
              </span>
              <p className="font-syne font-bold text-sm text-white truncate mt-1">
                {bestAttack?.team.name || '-'} ({bestAttack?.goalsFor || 0} GF)
              </p>
            </div>
            <div className="bg-[#0a1628]/70 p-3.5 rounded-xl border border-blue-500/20">
              <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">
                Valla Menos Batida
              </span>
              <p className="font-syne font-bold text-sm text-white truncate mt-1">
                {bestDefense?.team.name || '-'} ({bestDefense?.goalsAgainst || 0} GC)
              </p>
            </div>
            <div className="bg-[#0a1628]/70 p-3.5 rounded-xl border border-blue-500/20">
              <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">
                Tarjetas Totales
              </span>
              <p className="font-syne font-black text-lg text-white mt-1">
                🟨 {totalYellows} | 🟥 {totalReds}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Scorers */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-400">military_tech</span>
                <h3 className="font-syne font-bold text-lg text-white">Tabla de Goleadores (Pichichi)</h3>
              </div>
              <span className="text-[11px] text-blue-300">Click en jugador para pasaporte</span>
            </div>

            <div className="bg-[#0d2347]/70 rounded-2xl border border-blue-500/20 overflow-hidden shadow-lg">
              {scorers.length === 0 ? (
                <p className="p-8 text-center text-xs text-slate-400">
                  Aún no hay goleadores registrados en el torneo.
                </p>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-[#0a1628]/80 text-blue-300 font-bold uppercase text-[10px] border-b border-blue-500/20">
                      <th className="py-3 px-3 w-10 text-center">#</th>
                      <th className="py-3 px-3">Goleador</th>
                      <th className="py-3 px-3">Club</th>
                      <th className="py-3 px-4 text-center font-black text-amber-400">Goles</th>
                      <th className="py-3 px-3 text-center">Ficha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-500/10">
                    {scorers.map((player, idx) => {
                      const team = getTeam(player.teamId);
                      const isGold = idx === 0;

                      return (
                        <tr
                          key={player.id}
                          onClick={() => setSelectedPlayer(player)}
                          className={`cursor-pointer hover:bg-blue-600/20 transition-colors ${
                            isGold ? 'bg-amber-400/5' : ''
                          }`}
                        >
                          <td className="py-3 px-3 text-center">
                            <span
                              className={`inline-flex items-center justify-center w-6 h-6 rounded-md font-bold text-xs ${
                                idx === 0
                                  ? 'bg-amber-400 text-slate-950 font-black'
                                  : idx === 1
                                  ? 'bg-slate-300 text-slate-950 font-bold'
                                  : idx === 2
                                  ? 'bg-amber-700 text-white font-bold'
                                  : 'text-slate-400'
                              }`}
                            >
                              {idx + 1}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <p className="font-bold text-white text-xs sm:text-sm">{player.name}</p>
                            <span className="text-[10px] text-blue-300/80">#{player.number} • {player.position}</span>
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2">
                              <span
                                className="w-5 h-5 rounded-md flex items-center justify-center font-bold text-[9px] shadow-sm"
                                style={{ backgroundColor: team?.badgeBg, color: team?.badgeColor }}
                              >
                                {team?.shortName}
                              </span>
                              <span className="text-slate-300 font-medium truncate max-w-[120px]">
                                {team?.name}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="font-syne font-black text-amber-400 text-base">
                              {player.goals}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedPlayer(player);
                              }}
                              className="text-amber-400 hover:text-white p-1 rounded-lg hover:bg-blue-600/30 transition-all"
                              title="Ver pasaporte deportivo"
                            >
                              <span className="material-symbols-outlined text-base">badge</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Disciplinary / Fair Play */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-rose-400">warning</span>
                <h3 className="font-syne font-bold text-lg text-white">Tarjetas & Sanciones (Fair Play)</h3>
              </div>
              <span className="text-[11px] text-rose-300 font-semibold">Regla: 3 amarillas o roja = suspensión</span>
            </div>

            <div className="bg-[#0d2347]/70 rounded-2xl border border-blue-500/20 overflow-hidden shadow-lg">
              {disciplinary.length === 0 ? (
                <p className="p-8 text-center text-xs text-slate-400">
                  ¡Torneo limpio! Aún no se registraron amonestaciones ni expulsiones.
                </p>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-[#0a1628]/80 text-blue-300 font-bold uppercase text-[10px] border-b border-blue-500/20">
                      <th className="py-3 px-3">Jugador</th>
                      <th className="py-3 px-3">Club</th>
                      <th className="py-3 px-3 text-center">🟨 Amarillas</th>
                      <th className="py-3 px-3 text-center">🟥 Rojas</th>
                      <th className="py-3 px-3 text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-500/10">
                    {disciplinary.map((player) => {
                      const team = getTeam(player.teamId);

                      return (
                        <tr
                          key={player.id}
                          onClick={() => setSelectedPlayer(player)}
                          className="cursor-pointer hover:bg-blue-600/20 transition-colors"
                        >
                          <td className="py-3 px-3">
                            <p className="font-bold text-white text-xs">{player.name}</p>
                            <span className="text-[10px] text-blue-300/80">#{player.number} • {player.position}</span>
                          </td>
                          <td className="py-3 px-3 text-slate-300 truncate max-w-[120px]">
                            {team?.name}
                          </td>
                          <td className="py-3 px-3 text-center font-bold text-amber-300">
                            {player.yellowCards}
                          </td>
                          <td className="py-3 px-3 text-center font-bold text-rose-400">
                            {player.redCards}
                          </td>
                          <td className="py-3 px-3 text-center">
                            {player.isSuspended ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                Sancionado
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400">
                                Habilitado
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Embedded Player Passport Modal */}
      {selectedPlayer && (
        <PlayerPassportModal
          player={selectedPlayer}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
    </>
  );
};

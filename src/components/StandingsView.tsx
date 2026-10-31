import React from 'react';
import { useTournament } from '../context/TournamentContext';

export const StandingsView: React.FC = () => {
  const { standings, tournament, setIsShareModalOpen, showToast } = useTournament();

  const handleExportCSV = () => {
    const headers = ['Posición', 'Equipo', 'Ciudad', 'PJ', 'G', 'E', 'P', 'GF', 'GC', 'DG', 'Puntos'];
    const rows = standings.map((row, idx) => [
      idx + 1,
      `"${row.team.name}"`,
      `"${row.team.city}"`,
      row.played,
      row.won,
      row.drawn,
      row.lost,
      row.goalsFor,
      row.goalsAgainst,
      row.goalDifference,
      row.points,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `tabla_posiciones_${tournament.name.toLowerCase().replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('Tabla exportada a CSV exitosamente', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Title & Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0d2347]/80 p-5 rounded-2xl border border-blue-500/20">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-syne font-extrabold text-xl text-white">Tabla de Posiciones</h2>
            <span className="text-amber-400 font-bold text-xs px-2.5 py-0.5 rounded-full bg-amber-400/10 border border-amber-400/30">
              Oficial
            </span>
          </div>
          <p className="text-xs text-blue-200/70 mt-1">
            {tournament.name} • {tournament.subtitle}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsShareModalOpen(true)}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-all shadow-md shadow-emerald-950/40 border border-emerald-400/30 active:scale-95"
          >
            <span className="material-symbols-outlined text-sm">share</span>
            <span>Compartir WhatsApp</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 bg-blue-600/80 hover:bg-blue-600 text-white text-xs font-semibold px-3.5 py-2 rounded-xl border border-blue-400/30 transition-all active:scale-95"
          >
            <span className="material-symbols-outlined text-sm">download</span>
            <span>Descargar CSV</span>
          </button>
        </div>
      </div>

      {/* Main Standings Table */}
      <div className="bg-[#0d2347]/70 rounded-2xl border border-blue-500/20 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="bg-[#0a1628]/90 text-blue-300 font-bold uppercase text-[11px] border-b border-blue-500/20">
                <th className="py-3.5 px-3 w-10 text-center">#</th>
                <th className="py-3.5 px-4">Club</th>
                <th className="py-3.5 px-3 text-center" title="Partidos Jugados">PJ</th>
                <th className="py-3.5 px-3 text-center" title="Partidos Ganados">G</th>
                <th className="py-3.5 px-3 text-center" title="Partidos Empatados">E</th>
                <th className="py-3.5 px-3 text-center" title="Partidos Perdidos">P</th>
                <th className="py-3.5 px-3 text-center" title="Goles a Favor">GF</th>
                <th className="py-3.5 px-3 text-center" title="Goles en Contra">GC</th>
                <th className="py-3.5 px-3 text-center" title="Diferencia de Goles">DG</th>
                <th className="py-3.5 px-4 text-center font-black text-amber-400" title="Puntos Totales">PTS</th>
                <th className="py-3.5 px-4 text-center hidden md:table-cell" title="Últimos 5 Partidos">Forma</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-500/10">
              {standings.map((row, idx) => {
                const isChampion = idx === 0;
                const isPlayoffs = idx >= 1 && idx < 4;
                const isRelegation = idx === standings.length - 1;

                return (
                  <tr
                    key={row.teamId}
                    className={`hover:bg-blue-600/10 transition-colors ${
                      isChampion ? 'bg-amber-400/5' : ''
                    }`}
                  >
                    {/* Position */}
                    <td className="py-3.5 px-3 text-center">
                      <span
                        className={`inline-flex items-center justify-center w-6 h-6 rounded-md font-black text-xs ${
                          isChampion
                            ? 'bg-amber-400 text-slate-950 shadow-md font-bold'
                            : isPlayoffs
                            ? 'bg-emerald-600/40 text-emerald-300 border border-emerald-400/30'
                            : isRelegation
                            ? 'bg-red-600/30 text-red-300 border border-red-500/30'
                            : 'text-slate-400'
                        }`}
                      >
                        {idx + 1}
                      </span>
                    </td>

                    {/* Team Name & Badge */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 shadow-md border border-white/20"
                          style={{ backgroundColor: row.team.badgeBg, color: row.team.badgeColor }}
                        >
                          {row.team.shortName}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-white text-xs sm:text-sm truncate">
                            {row.team.name}
                          </p>
                          <p className="text-[11px] text-blue-300/70 truncate">{row.team.city}</p>
                        </div>
                      </div>
                    </td>

                    {/* Stats */}
                    <td className="py-3.5 px-3 text-center font-medium text-slate-200">{row.played}</td>
                    <td className="py-3.5 px-3 text-center font-bold text-emerald-400">{row.won}</td>
                    <td className="py-3.5 px-3 text-center text-slate-400">{row.drawn}</td>
                    <td className="py-3.5 px-3 text-center text-rose-400">{row.lost}</td>
                    <td className="py-3.5 px-3 text-center text-slate-300">{row.goalsFor}</td>
                    <td className="py-3.5 px-3 text-center text-slate-400">{row.goalsAgainst}</td>
                    <td
                      className={`py-3.5 px-3 text-center font-bold ${
                        row.goalDifference > 0
                          ? 'text-emerald-400'
                          : row.goalDifference < 0
                          ? 'text-rose-400'
                          : 'text-slate-400'
                      }`}
                    >
                      {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
                    </td>

                    {/* Points */}
                    <td className="py-3.5 px-4 text-center font-syne font-black text-amber-400 text-sm sm:text-base">
                      {row.points}
                    </td>

                    {/* Form Pills */}
                    <td className="py-3.5 px-4 text-center hidden md:table-cell">
                      <div className="flex items-center justify-center gap-1">
                        {row.form.length === 0 ? (
                          <span className="text-[10px] text-slate-500">-</span>
                        ) : (
                          row.form.map((res, fIdx) => (
                            <span
                              key={fIdx}
                              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white ${
                                res === 'W'
                                  ? 'bg-emerald-500'
                                  : res === 'D'
                                  ? 'bg-amber-500'
                                  : 'bg-rose-500'
                              }`}
                              title={res === 'W' ? 'Victoria' : res === 'D' ? 'Empate' : 'Derrota'}
                            >
                              {res === 'W' ? 'V' : res === 'D' ? 'E' : 'D'}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Legend & Rules */}
        <div className="p-4 bg-[#0a1628]/80 border-t border-blue-500/20 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm bg-amber-400" />
              <span>1º Puesto: Campeón de Liga</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm bg-emerald-500" />
              <span>2º al 4º: Clasificados a Liguilla</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm bg-rose-500" />
              <span>Último: Zona de Descenso</span>
            </div>
          </div>

          <p className="text-[11px] text-blue-300/70 italic">
            * Criterio: Puntos &gt; Gol Diferencia (DG) &gt; Goles a Favor (GF).
          </p>
        </div>
      </div>
    </div>
  );
};

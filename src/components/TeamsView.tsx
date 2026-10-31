import React, { useState } from 'react';
import { useTournament } from '../context/TournamentContext';
import { Team } from '../types/tournament';

export const TeamsView: React.FC = () => {
  const { teams, players, matches, standings, setActiveTeamModal, deleteTeam, addTeam } = useTournament();

  const [isNewTeamModalOpen, setIsNewTeamModalOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamShort, setNewTeamShort] = useState('');
  const [newTeamCity, setNewTeamCity] = useState('');
  const [newTeamStadium, setNewTeamStadium] = useState('');
  const [newTeamCoach, setNewTeamCoach] = useState('');
  const [newTeamBg, setNewTeamBg] = useState('#1a4fd6');
  const [newTeamColor, setNewTeamColor] = useState('#ffffff');
  const [newTeamCapacity, setNewTeamCapacity] = useState(2500);
  const [newTeamSurface, setNewTeamSurface] = useState('Césped Natural');
  const [newTeamPresident, setNewTeamPresident] = useState('');
  const [newTeamFoundedYear, setNewTeamFoundedYear] = useState(2000);

  const handleCreateTeam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;

    addTeam({
      name: newTeamName.trim(),
      shortName: (newTeamShort.trim() || newTeamName.slice(0, 3)).toUpperCase(),
      city: newTeamCity.trim() || 'Apolo',
      stadium: newTeamStadium.trim() || 'Cancha Municipal',
      coach: newTeamCoach.trim() || 'Por definir',
      badgeBg: newTeamBg,
      badgeColor: newTeamColor,
      stadiumCapacity: Number(newTeamCapacity) || 2500,
      stadiumSurface: newTeamSurface,
      president: newTeamPresident.trim() || 'Directorio del Club',
      foundedYear: Number(newTeamFoundedYear) || 2026,
    });

    // Reset
    setNewTeamName('');
    setNewTeamShort('');
    setNewTeamCity('');
    setNewTeamStadium('');
    setNewTeamCoach('');
    setNewTeamPresident('');
    setIsNewTeamModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Title & Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0d2347]/80 p-5 rounded-2xl border border-blue-500/20">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-syne font-extrabold text-xl text-white">Clubes & Pasaportes Deportivos</h2>
            <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-amber-400/10 text-amber-400 border border-amber-400/30">
              Fase 8 y 9
            </span>
          </div>
          <p className="text-xs text-blue-200/70 mt-1">
            {teams.length} clubes oficiales registrados en la Liga Deportiva Apolodigital 2026
          </p>
        </div>

        <button
          onClick={() => setIsNewTeamModalOpen(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl border border-blue-400/30 transition-all shadow-md active:scale-95 self-start sm:self-auto"
        >
          <span className="material-symbols-outlined text-base">add_circle</span>
          <span>Inscribir Nuevo Club</span>
        </button>
      </div>

      {/* Grid of Teams */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {teams.map((team) => {
          const teamPlayers = players.filter((p) => p.teamId === team.id);
          const teamGoals = teamPlayers.reduce((acc, p) => acc + p.goals, 0);
          const standingIndex = standings.findIndex((s) => s.teamId === team.id);
          const standingRow = standingIndex >= 0 ? standings[standingIndex] : null;
          const suspendedCount = teamPlayers.filter((p) => p.isSuspended).length;

          return (
            <div
              key={team.id}
              className="bg-[#0d2347]/70 hover:bg-[#0d2347]/95 rounded-2xl border border-blue-500/20 p-5 flex flex-col justify-between transition-all group hover:border-blue-400/40 hover:shadow-xl relative"
            >
              <div>
                {/* Badge, Name & Position */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm shadow-md border border-white/20 shrink-0 group-hover:scale-105 transition-transform"
                      style={{ backgroundColor: team.badgeBg, color: team.badgeColor }}
                    >
                      {team.shortName}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-syne font-bold text-white text-base leading-tight truncate">
                        {team.name}
                      </h3>
                      <p className="text-xs text-blue-300/80 flex items-center gap-1 mt-0.5">
                        <span className="material-symbols-outlined text-[12px]">location_on</span>
                        <span className="truncate">{team.city}</span>
                      </p>
                    </div>
                  </div>

                  {standingRow && (
                    <span className="font-syne font-black text-xs px-2 py-0.5 rounded-lg bg-blue-900/60 text-amber-400 border border-blue-400/30">
                      #{standingIndex + 1}
                    </span>
                  )}
                </div>

                {/* Team Info Details */}
                <div className="space-y-2 py-3 border-y border-blue-500/15 text-xs text-slate-300">
                  <div className="flex items-center justify-between">
                    <span className="text-blue-300/70">Estadio / Cancha:</span>
                    <span className="font-semibold text-white truncate max-w-[130px]">{team.stadium}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-blue-300/70">Director Técnico:</span>
                    <span className="font-semibold text-white truncate max-w-[130px]">{team.coach}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-blue-300/70">Plantilla Habilitada:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-amber-400">{teamPlayers.length} jugadores</span>
                      {suspendedCount > 0 && (
                        <span className="text-[10px] bg-rose-500/20 text-rose-300 px-1.5 py-0.2 rounded font-black border border-rose-500/30">
                          {suspendedCount} susp.
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-blue-300/70">Puntos en Torneo:</span>
                    <span className="font-bold text-emerald-400">
                      {standingRow ? `${standingRow.points} pts (DG: ${standingRow.goalDifference > 0 ? `+${standingRow.goalDifference}` : standingRow.goalDifference})` : `${teamGoals} goles`}
                    </span>
                  </div>
                  {standingRow?.form && standingRow.form.length > 0 && (
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-blue-300/70">Forma reciente:</span>
                      <div className="flex items-center gap-1">
                        {standingRow.form.map((f, i) => (
                          <span
                            key={i}
                            className={`w-4 h-4 rounded-full text-[9px] font-black flex items-center justify-center ${
                              f === 'W'
                                ? 'bg-emerald-500 text-white'
                                : f === 'D'
                                ? 'bg-amber-500 text-slate-950'
                                : 'bg-rose-500 text-white'
                            }`}
                          >
                            {f === 'W' ? 'V' : f === 'D' ? 'E' : 'D'}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="pt-4 flex items-center gap-2">
                <button
                  onClick={() => setActiveTeamModal(team)}
                  className="flex-1 bg-blue-600/80 hover:bg-blue-600 text-white font-bold text-xs py-2 px-3 rounded-xl border border-blue-400/30 transition-all flex items-center justify-center gap-1.5 active:scale-95"
                >
                  <span className="material-symbols-outlined text-sm">badge</span>
                  <span>Plantilla & Ficha</span>
                </button>

                <button
                  onClick={() => {
                    if (window.confirm(`¿Eliminar al club "${team.name}" y sus jugadores?`)) {
                      deleteTeam(team.id);
                    }
                  }}
                  className="p-2 text-slate-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-all"
                  title="Eliminar equipo"
                >
                  <span className="material-symbols-outlined text-base">delete</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* New Team Modal */}
      {isNewTeamModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-md bg-[#0d2347] border border-blue-500/30 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-blue-500/20 pb-3">
              <h3 className="font-syne font-bold text-lg text-white">Inscribir Nuevo Club</h3>
              <button
                onClick={() => setIsNewTeamModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateTeam} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Nombre del Club</label>
                <input
                  type="text"
                  required
                  placeholder="ej. Club Deportivo Franz Tamayo"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  className="w-full bg-[#0a1628] border border-blue-500/30 rounded-xl p-2.5 text-white font-medium focus:border-blue-400 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Sigla / Abreviatura</label>
                  <input
                    type="text"
                    maxLength={4}
                    placeholder="ej. DFT"
                    value={newTeamShort}
                    onChange={(e) => setNewTeamShort(e.target.value)}
                    className="w-full bg-[#0a1628] border border-blue-500/30 rounded-xl p-2.5 text-white uppercase font-bold focus:border-blue-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Localidad / Ciudad</label>
                  <input
                    type="text"
                    placeholder="ej. Apolo Centro"
                    value={newTeamCity}
                    onChange={(e) => setNewTeamCity(e.target.value)}
                    className="w-full bg-[#0a1628] border border-blue-500/30 rounded-xl p-2.5 text-white font-medium focus:border-blue-400 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Estadio / Cancha Local</label>
                <input
                  type="text"
                  placeholder="ej. Estadio Municipal de Apolo"
                  value={newTeamStadium}
                  onChange={(e) => setNewTeamStadium(e.target.value)}
                  className="w-full bg-[#0a1628] border border-blue-500/30 rounded-xl p-2.5 text-white font-medium focus:border-blue-400 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Entrenador / DT</label>
                  <input
                    type="text"
                    placeholder="ej. Carlos Morales"
                    value={newTeamCoach}
                    onChange={(e) => setNewTeamCoach(e.target.value)}
                    className="w-full bg-[#0a1628] border border-blue-500/30 rounded-xl p-2.5 text-white font-medium focus:border-blue-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Año de Fundación</label>
                  <input
                    type="number"
                    value={newTeamFoundedYear}
                    onChange={(e) => setNewTeamFoundedYear(Number(e.target.value))}
                    className="w-full bg-[#0a1628] border border-blue-500/30 rounded-xl p-2.5 text-white font-medium focus:border-blue-400 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Color de Fondo</label>
                  <input
                    type="color"
                    value={newTeamBg}
                    onChange={(e) => setNewTeamBg(e.target.value)}
                    className="w-full h-10 bg-transparent rounded cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Color de Letras</label>
                  <input
                    type="color"
                    value={newTeamColor}
                    onChange={(e) => setNewTeamColor(e.target.value)}
                    className="w-full h-10 bg-transparent rounded cursor-pointer"
                  />
                </div>
              </div>

              {/* Preview */}
              <div className="p-3 bg-[#0a1628] rounded-xl flex items-center gap-3 border border-blue-500/20">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm"
                  style={{ backgroundColor: newTeamBg, color: newTeamColor }}
                >
                  {(newTeamShort || newTeamName.slice(0, 3) || 'ESC').toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-white">{newTeamName || 'Nombre del Club'}</p>
                  <p className="text-[11px] text-blue-300/70">{newTeamCity || 'Localidad'}</p>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewTeamModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-5 py-2 rounded-xl shadow border border-blue-400/30"
                >
                  Guardar Club
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

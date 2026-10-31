import React, { useState } from 'react';
import { useTournament } from '../context/TournamentContext';
import { Player, PlayerPosition, Team } from '../types/tournament';
import { PlayerPassportModal } from './PlayerPassportModal';

export const TeamModal: React.FC = () => {
  const {
    activeTeamModal,
    setActiveTeamModal,
    players,
    standings,
    matches,
    updateTeam,
    addPlayer,
    deletePlayer,
    showToast,
  } = useTournament();

  const [activeTab, setActiveTab] = useState<'plantilla' | 'rendimiento' | 'club'>('plantilla');
  const [selectedPlayerForPassport, setSelectedPlayerForPassport] = useState<Player | null>(null);

  // Editing team state
  const [isEditingTeam, setIsEditingTeam] = useState(false);
  const [editName, setEditName] = useState(activeTeamModal?.name || '');
  const [editShort, setEditShort] = useState(activeTeamModal?.shortName || '');
  const [editCity, setEditCity] = useState(activeTeamModal?.city || '');
  const [editStadium, setEditStadium] = useState(activeTeamModal?.stadium || '');
  const [editCoach, setEditCoach] = useState(activeTeamModal?.coach || '');
  const [editBg, setEditBg] = useState(activeTeamModal?.badgeBg || '#1a4fd6');
  const [editColor, setEditColor] = useState(activeTeamModal?.badgeColor || '#ffffff');
  const [editCapacity, setEditCapacity] = useState(activeTeamModal?.stadiumCapacity || 2500);
  const [editSurface, setEditSurface] = useState(activeTeamModal?.stadiumSurface || 'Césped Natural');
  const [editPresident, setEditPresident] = useState(activeTeamModal?.president || 'Directorio del Club');
  const [editFoundedYear, setEditFoundedYear] = useState(activeTeamModal?.foundedYear || 1990);

  // New player form
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerNumber, setNewPlayerNumber] = useState<number>(10);
  const [newPlayerPosition, setNewPlayerPosition] = useState<PlayerPosition>('Delantero');
  const [newPlayerDocId, setNewPlayerDocId] = useState('');
  const [newPlayerBirthDate, setNewPlayerBirthDate] = useState('2001-05-15');

  if (!activeTeamModal) return null;

  const teamPlayers = players.filter((p) => p.teamId === activeTeamModal.id);
  const standingRow = standings.find((s) => s.teamId === activeTeamModal.id);

  // Team matches
  const teamMatches = matches.filter(
    (m) => m.homeTeamId === activeTeamModal.id || m.awayTeamId === activeTeamModal.id
  );
  const finishedTeamMatches = teamMatches.filter((m) => m.status === 'finalizado');

  const topScorer = [...teamPlayers].sort((a, b) => b.goals - a.goals)[0];

  const handleSaveTeamEdit = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: Team = {
      ...activeTeamModal,
      name: editName.trim() || activeTeamModal.name,
      shortName: (editShort.trim() || activeTeamModal.shortName).toUpperCase(),
      city: editCity.trim(),
      stadium: editStadium.trim(),
      coach: editCoach.trim(),
      badgeBg: editBg,
      badgeColor: editColor,
      stadiumCapacity: Number(editCapacity) || 2500,
      stadiumSurface: editSurface,
      president: editPresident.trim(),
      foundedYear: Number(editFoundedYear) || 1990,
    };
    updateTeam(updated);
    setActiveTeamModal(updated);
    setIsEditingTeam(false);
    showToast('Datos del club actualizados', 'success');
  };

  const handleAddPlayer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlayerName.trim()) return;

    addPlayer({
      teamId: activeTeamModal.id,
      name: newPlayerName.trim(),
      number: Number(newPlayerNumber) || 1,
      position: newPlayerPosition,
      goals: 0,
      assists: 0,
      yellowCards: 0,
      redCards: 0,
      documentId: newPlayerDocId.trim() || `${Math.floor(6000000 + Math.random() * 3000000)} LP`,
      birthDate: newPlayerBirthDate,
      nationality: 'Boliviana 🇧🇴',
      matchesPlayed: 0,
      isSuspended: false,
    });

    setNewPlayerName('');
    setNewPlayerDocId('');
    setNewPlayerNumber(newPlayerNumber + 1);
    showToast(`Jugador añadido con Pasaporte Deportivo oficial`, 'success');
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in">
        <div className="relative w-full max-w-3xl bg-[#0d2347] border border-blue-500/30 rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-blue-500/20 bg-[#0a1628]/95">
            <div className="flex items-center gap-3.5">
              <div
                className="w-13 h-13 rounded-2xl flex items-center justify-center font-black text-base shadow-lg border border-white/20"
                style={{ backgroundColor: activeTeamModal.badgeBg, color: activeTeamModal.badgeColor }}
              >
                {activeTeamModal.shortName}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-syne font-black text-xl text-white leading-tight">
                    {activeTeamModal.name}
                  </h3>
                  <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-blue-900/60 text-blue-300 border border-blue-400/30">
                    Fundado en {activeTeamModal.foundedYear || 1990}
                  </span>
                </div>
                <p className="text-xs text-blue-200/70 mt-0.5 flex items-center gap-2">
                  <span>{activeTeamModal.city}</span>
                  <span>•</span>
                  <span>{activeTeamModal.stadium}</span>
                  <span>•</span>
                  <span className="text-amber-300">DT: {activeTeamModal.coach}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsEditingTeam(!isEditingTeam)}
                className="p-2 text-blue-300 hover:text-white hover:bg-blue-800/40 rounded-xl transition-all"
                title="Editar información del club"
              >
                <span className="material-symbols-outlined text-lg">edit</span>
              </button>
              <button
                onClick={() => setActiveTeamModal(null)}
                className="w-8 h-8 rounded-full bg-blue-900/40 hover:bg-blue-800/60 text-slate-300 hover:text-white flex items-center justify-center transition-all"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-blue-500/20 bg-[#0a1628]/80 px-6 pt-2 text-xs">
            <button
              onClick={() => setActiveTab('plantilla')}
              className={`pb-2.5 px-4 font-bold border-b-2 flex items-center gap-1.5 transition-all ${
                activeTab === 'plantilla'
                  ? 'border-blue-500 text-white'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-base">badge</span>
              <span>Plantilla & Pasaportes ({teamPlayers.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('rendimiento')}
              className={`pb-2.5 px-4 font-bold border-b-2 flex items-center gap-1.5 transition-all ${
                activeTab === 'rendimiento'
                  ? 'border-amber-400 text-amber-300'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-base text-amber-400">query_stats</span>
              <span>Rendimiento & Forma</span>
            </button>

            <button
              onClick={() => setActiveTab('club')}
              className={`pb-2.5 px-4 font-bold border-b-2 flex items-center gap-1.5 transition-all ${
                activeTab === 'club'
                  ? 'border-blue-500 text-white'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-base">stadium</span>
              <span>Sede & Directorio</span>
            </button>
          </div>

          {/* Modal Content */}
          <div className="p-6 overflow-y-auto space-y-6">
            {/* Edit Team Form (Conditional) */}
            {isEditingTeam && (
              <form
                onSubmit={handleSaveTeamEdit}
                className="bg-[#0a1628] rounded-2xl border border-blue-500/30 p-5 space-y-4 animate-in fade-in"
              >
                <h4 className="font-syne font-bold text-xs uppercase tracking-wider text-amber-400">
                  Editar Información del Club
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Nombre del Club</label>
                    <input
                      type="text"
                      required
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full bg-[#0d2347] border border-blue-500/30 rounded-xl px-3 py-2 text-white font-medium focus:border-blue-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Sigla / Abreviatura</label>
                    <input
                      type="text"
                      maxLength={4}
                      required
                      value={editShort}
                      onChange={(e) => setEditShort(e.target.value)}
                      className="w-full bg-[#0d2347] border border-blue-500/30 rounded-xl px-3 py-2 text-white font-medium focus:border-blue-400 focus:outline-none font-mono uppercase"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Ciudad / Municipio</label>
                    <input
                      type="text"
                      value={editCity}
                      onChange={(e) => setEditCity(e.target.value)}
                      className="w-full bg-[#0d2347] border border-blue-500/30 rounded-xl px-3 py-2 text-white font-medium focus:border-blue-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Estadio Oficial</label>
                    <input
                      type="text"
                      value={editStadium}
                      onChange={(e) => setEditStadium(e.target.value)}
                      className="w-full bg-[#0d2347] border border-blue-500/30 rounded-xl px-3 py-2 text-white font-medium focus:border-blue-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Director Técnico (DT)</label>
                    <input
                      type="text"
                      value={editCoach}
                      onChange={(e) => setEditCoach(e.target.value)}
                      className="w-full bg-[#0d2347] border border-blue-500/30 rounded-xl px-3 py-2 text-white font-medium focus:border-blue-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Presidente</label>
                    <input
                      type="text"
                      value={editPresident}
                      onChange={(e) => setEditPresident(e.target.value)}
                      className="w-full bg-[#0d2347] border border-blue-500/30 rounded-xl px-3 py-2 text-white font-medium focus:border-blue-400 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsEditingTeam(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-5 py-2 rounded-xl transition-all shadow"
                  >
                    Guardar Club
                  </button>
                </div>
              </form>
            )}

            {/* TAB 1: Plantilla & Pasaportes */}
            {activeTab === 'plantilla' && (
              <div className="space-y-6">
                {/* Players Roster Table */}
                <div className="bg-[#0a1628] rounded-2xl border border-blue-500/20 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-syne font-bold text-sm text-white">
                        Plantilla Habilitada & Pasaportes Deportivos
                      </h4>
                      <p className="text-[11px] text-blue-200/70">
                        Haz clic en cualquier jugador para abrir su carnet oficial y pasaporte.
                      </p>
                    </div>
                    <span className="text-xs text-blue-300 font-semibold font-mono bg-blue-950/60 px-2.5 py-1 rounded-lg border border-blue-500/25">
                      {teamPlayers.length} futbolistas
                    </span>
                  </div>

                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {teamPlayers.map((player) => (
                      <div
                        key={player.id}
                        onClick={() => setSelectedPlayerForPassport(player)}
                        className={`cursor-pointer flex items-center justify-between p-3 rounded-xl border transition-all hover:scale-[1.01] ${
                          player.isSuspended
                            ? 'bg-rose-950/30 border-rose-500/30 hover:border-rose-400'
                            : 'bg-[#0d2347]/60 border-blue-500/20 hover:border-amber-400/50 hover:bg-[#0d2347]'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-syne font-black text-amber-400 text-sm w-7 text-center">
                            #{player.number}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-white">{player.name}</span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-blue-900/60 text-blue-200">
                                {player.position}
                              </span>
                              {player.isSuspended ? (
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-black bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                  🔴 Sancionado
                                </span>
                              ) : (
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                                  🟢 Habilitado
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-400 mt-0.5 font-mono">
                              CI: {player.documentId || 'Sin CI registrado'} • Cód: {player.passportCode || `APL-${player.number}`}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right text-xs">
                            <span className="font-syne font-bold text-amber-400 block">
                              ⚽ {player.goals} goles
                            </span>
                            <span className="text-[10px] text-slate-400">
                              🟨 {player.yellowCards} · 🟥 {player.redCards}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPlayerForPassport(player);
                            }}
                            className="bg-blue-600/80 hover:bg-blue-600 text-white p-1.5 rounded-lg text-xs transition-all"
                            title="Ver Pasaporte Deportivo"
                          >
                            <span className="material-symbols-outlined text-sm">badge</span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm(`¿Eliminar a ${player.name} de la plantilla?`)) {
                                deletePlayer(player.id);
                              }
                            }}
                            className="text-slate-400 hover:text-rose-400 p-1 rounded transition-colors"
                            title="Eliminar jugador"
                          >
                            <span className="material-symbols-outlined text-base">delete</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Add New Player Form */}
                <form
                  onSubmit={handleAddPlayer}
                  className="bg-[#0a1628] rounded-2xl border border-blue-500/20 p-4 space-y-3"
                >
                  <h4 className="font-syne font-bold text-xs uppercase tracking-wider text-white flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-blue-400 text-base">person_add</span>
                    <span>Habilitar Nuevo Jugador con Pasaporte</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Nombre Completo</label>
                      <input
                        type="text"
                        required
                        placeholder="Ej. Milton Torrez"
                        value={newPlayerName}
                        onChange={(e) => setNewPlayerName(e.target.value)}
                        className="w-full bg-[#0d2347] border border-blue-500/30 rounded-xl px-3 py-2 text-white font-medium focus:border-blue-400 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Dorsal</label>
                      <input
                        type="number"
                        min={1}
                        max={99}
                        required
                        value={newPlayerNumber}
                        onChange={(e) => setNewPlayerNumber(Number(e.target.value))}
                        className="w-full bg-[#0d2347] border border-blue-500/30 rounded-xl px-3 py-2 text-white font-medium focus:border-blue-400 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Posición</label>
                      <select
                        value={newPlayerPosition}
                        onChange={(e) => setNewPlayerPosition(e.target.value as PlayerPosition)}
                        className="w-full bg-[#0d2347] border border-blue-500/30 rounded-xl px-3 py-2 text-white font-medium focus:border-blue-400 focus:outline-none"
                      >
                        <option value="Portero">Portero</option>
                        <option value="Defensa">Defensa</option>
                        <option value="Centrocampista">Centrocampista</option>
                        <option value="Delantero">Delantero</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">C.I. Boliviano (Opcional)</label>
                      <input
                        type="text"
                        placeholder="8492019 LP"
                        value={newPlayerDocId}
                        onChange={(e) => setNewPlayerDocId(e.target.value)}
                        className="w-full bg-[#0d2347] border border-blue-500/30 rounded-xl px-3 py-2 text-white font-medium focus:border-blue-400 focus:outline-none font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Fecha de Nacimiento</label>
                      <input
                        type="date"
                        value={newPlayerBirthDate}
                        onChange={(e) => setNewPlayerBirthDate(e.target.value)}
                        className="w-full bg-[#0d2347] border border-blue-500/30 rounded-xl px-3 py-2 text-white font-medium focus:border-blue-400 focus:outline-none"
                      />
                    </div>

                    <div className="flex items-end">
                      <button
                        type="submit"
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded-xl text-xs transition-all shadow"
                      >
                        Registrar Jugador
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            )}

            {/* TAB 2: Rendimiento & Estadísticas del Club */}
            {activeTab === 'rendimiento' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="bg-[#0a1628] p-4 rounded-2xl border border-blue-500/20">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Puntos en Torneo</span>
                    <p className="font-syne font-black text-3xl text-amber-400 mt-1">
                      {standingRow?.points ?? 0} pts
                    </p>
                    <span className="text-[10px] text-blue-300">
                      PJ: {standingRow?.played ?? 0} · PG: {standingRow?.won ?? 0}
                    </span>
                  </div>

                  <div className="bg-[#0a1628] p-4 rounded-2xl border border-blue-500/20">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Diferencia de Gol</span>
                    <p className="font-syne font-black text-3xl text-white mt-1">
                      {standingRow?.goalDifference && standingRow.goalDifference > 0 ? `+${standingRow.goalDifference}` : standingRow?.goalDifference ?? 0}
                    </p>
                    <span className="text-[10px] text-slate-400">
                      GF: {standingRow?.goalsFor ?? 0} · GC: {standingRow?.goalsAgainst ?? 0}
                    </span>
                  </div>

                  <div className="bg-[#0a1628] p-4 rounded-2xl border border-blue-500/20">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Goleador del Club</span>
                    <p className="font-syne font-bold text-base text-amber-300 mt-1 truncate">
                      {topScorer ? topScorer.name : 'Sin goles'}
                    </p>
                    <span className="text-[10px] text-slate-400">
                      {topScorer ? `${topScorer.goals} goles anotados` : '-'}
                    </span>
                  </div>

                  <div className="bg-[#0a1628] p-4 rounded-2xl border border-blue-500/20">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Racha Reciente</span>
                    <div className="flex items-center justify-center gap-1.5 mt-2">
                      {standingRow?.form && standingRow.form.length > 0 ? (
                        standingRow.form.map((res, i) => (
                          <span
                            key={i}
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${
                              res === 'W'
                                ? 'bg-emerald-500 text-white'
                                : res === 'D'
                                ? 'bg-amber-500 text-slate-950'
                                : 'bg-rose-500 text-white'
                            }`}
                          >
                            {res === 'W' ? 'V' : res === 'D' ? 'E' : 'D'}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block">Últimos partidos</span>
                  </div>
                </div>

                {/* Match Results list of this club */}
                <div className="bg-[#0a1628] rounded-2xl border border-blue-500/20 p-5 space-y-3">
                  <h4 className="font-syne font-bold text-xs uppercase tracking-wider text-white">
                    Historial de Partidos en el Campeonato
                  </h4>

                  <div className="space-y-2">
                    {teamMatches.map((m) => {
                      const isHome = m.homeTeamId === activeTeamModal.id;
                      const opponent = teams.find((t) => t.id === (isHome ? m.awayTeamId : m.homeTeamId));

                      return (
                        <div
                          key={m.id}
                          className="flex items-center justify-between p-3 rounded-xl bg-[#0d2347]/60 border border-blue-500/20 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-blue-300">{m.roundName || `J${m.round}`}</span>
                            <span className="text-slate-400">•</span>
                            <span className="font-semibold text-white">
                              {isHome ? 'vs (L)' : '@ (V)'} {opponent?.name}
                            </span>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="font-syne font-black text-sm text-white">
                              {m.homeScore ?? '-'} : {m.awayScore ?? '-'}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                m.status === 'finalizado'
                                  ? 'bg-blue-900/60 text-blue-300'
                                  : m.status === 'en_juego'
                                  ? 'bg-red-600 text-white animate-pulse'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {m.status === 'finalizado' ? 'Finalizado' : m.status === 'en_juego' ? 'En Vivo' : 'Programado'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: Sede & Directorio */}
            {activeTab === 'club' && (
              <div className="space-y-4">
                <div className="bg-[#0a1628] rounded-2xl border border-blue-500/20 p-5 space-y-4">
                  <h4 className="font-syne font-bold text-sm text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-amber-400">stadium</span>
                    <span>Infraestructura Deportiva & Estadio</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="bg-[#0d2347] p-3.5 rounded-xl border border-blue-500/20">
                      <span className="text-slate-400 block font-semibold mb-0.5">Estadio / Cancha Local</span>
                      <p className="font-bold text-white text-sm">{activeTeamModal.stadium}</p>
                      <p className="text-[11px] text-blue-300 mt-1">Ubicación: {activeTeamModal.city}</p>
                    </div>

                    <div className="bg-[#0d2347] p-3.5 rounded-xl border border-blue-500/20">
                      <span className="text-slate-400 block font-semibold mb-0.5">Capacidad Aforo</span>
                      <p className="font-bold text-white text-sm">
                        {activeTeamModal.stadiumCapacity ? `${activeTeamModal.stadiumCapacity.toLocaleString()} espectadores` : '3,000 espectadores'}
                      </p>
                      <p className="text-[11px] text-emerald-400 mt-1">
                        Superficie: {activeTeamModal.stadiumSurface || 'Césped Natural'}
                      </p>
                    </div>

                    <div className="bg-[#0d2347] p-3.5 rounded-xl border border-blue-500/20">
                      <span className="text-slate-400 block font-semibold mb-0.5">Cuerpo Técnico (DT)</span>
                      <p className="font-bold text-white text-sm">{activeTeamModal.coach}</p>
                      <p className="text-[11px] text-slate-400 mt-1">Habilitación FBF 2026</p>
                    </div>

                    <div className="bg-[#0d2347] p-3.5 rounded-xl border border-blue-500/20">
                      <span className="text-slate-400 block font-semibold mb-0.5">Presidencia del Club</span>
                      <p className="font-bold text-white text-sm">
                        {activeTeamModal.president || 'Directorio Deportivo Municipal'}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Fundación: Año {activeTeamModal.foundedYear || 1990}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-3.5 bg-[#0a1628]/95 border-t border-blue-500/20 flex items-center justify-between">
            <p className="text-[11px] text-blue-300/70">
              Ficha oficial registrada en Apolodigital League · Apolo, Bolivia.
            </p>
            <button
              onClick={() => setActiveTeamModal(null)}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow"
            >
              Cerrar Ficha del Club
            </button>
          </div>
        </div>
      </div>

      {/* Embedded Player Passport Modal */}
      {selectedPlayerForPassport && (
        <PlayerPassportModal
          player={selectedPlayerForPassport}
          onClose={() => setSelectedPlayerForPassport(null)}
        />
      )}
    </>
  );
};

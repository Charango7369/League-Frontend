import React, { useState } from 'react';
import { useTournament } from '../context/TournamentContext';
import { Player, Team } from '../types/tournament';

interface PlayerPassportModalProps {
  player: Player | null;
  onClose: () => void;
}

export const PlayerPassportModal: React.FC<PlayerPassportModalProps> = ({ player, onClose }) => {
  const { teams, updatePlayer, showToast, currentUser } = useTournament();

  if (!player) return null;

  const team: Team | undefined = teams.find((t) => t.id === player.teamId);

  // Form edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(player.name);
  const [editNumber, setEditNumber] = useState(player.number);
  const [editPosition, setEditPosition] = useState(player.position);
  const [editDocId, setEditDocId] = useState(player.documentId || '');
  const [editBirthDate, setEditBirthDate] = useState(player.birthDate || '2000-01-01');
  const [editIsSuspended, setEditIsSuspended] = useState(player.isSuspended || false);
  const [editSuspensionReason, setEditSuspensionReason] = useState(player.suspensionReason || '');

  const calculateAge = (dateStr?: string) => {
    if (!dateStr) return 23;
    const birth = new Date(dateStr);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const age = calculateAge(player.birthDate);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: Player = {
      ...player,
      name: editName.trim() || player.name,
      number: Number(editNumber) || player.number,
      position: editPosition,
      documentId: editDocId.trim() || undefined,
      birthDate: editBirthDate,
      isSuspended: editIsSuspended,
      suspensionReason: editIsSuspended ? (editSuspensionReason.trim() || 'Sanción disciplinaria') : undefined,
    };

    updatePlayer(updated);
    setIsEditing(false);
    showToast('Pasaporte deportivo actualizado correctamente', 'success');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto animate-in fade-in">
      <div className="relative w-full max-w-xl bg-[#0d2347] border border-blue-500/30 rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[94vh] flex flex-col">
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-blue-500/20 bg-[#0a1628]/95 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-slate-950 font-black">
              <span className="material-symbols-outlined text-lg">badge</span>
            </div>
            <div>
              <h3 className="font-syne font-bold text-white text-base leading-tight">
                Pasaporte Deportivo Oficial
              </h3>
              <p className="text-[11px] text-blue-200/70">
                Ficha Federativa y Credencial Digital · Franz Tamayo, Bolivia
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="p-1.5 text-blue-300 hover:text-white hover:bg-blue-900/40 rounded-lg transition-all"
              title="Editar ficha federativa"
            >
              <span className="material-symbols-outlined text-lg">edit</span>
            </button>
            <button
              onClick={handlePrint}
              className="p-1.5 text-amber-300 hover:text-amber-200 hover:bg-amber-500/10 rounded-lg transition-all"
              title="Imprimir carnet deportivo"
            >
              <span className="material-symbols-outlined text-lg">print</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-blue-900/40 hover:bg-blue-800/60 text-slate-300 hover:text-white flex items-center justify-center transition-all"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Official Credential / Passport Card */}
          <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-[#0c1f3d] via-[#0d2a54] to-[#071324] border-2 border-amber-400/40 p-6 shadow-2xl space-y-5">
            {/* Holographic Slogan & League Header */}
            <div className="flex items-center justify-between border-b border-amber-400/25 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-400 text-xl">military_tech</span>
                <div>
                  <span className="font-syne font-extrabold text-xs text-white uppercase tracking-wider block">
                    Apolodigital League · Temporada 2026
                  </span>
                  <span className="text-[10px] text-amber-300/80 font-mono">
                    REGISTRO OFICIAL FRANZ TAMAYO 🇧🇴
                  </span>
                </div>
              </div>

              <div className="text-right font-mono text-[10px] text-slate-400">
                <span>CÓD: </span>
                <span className="text-amber-400 font-bold">{player.passportCode || `APL-2026-${player.number.toString().padStart(3, '0')}`}</span>
              </div>
            </div>

            {/* Photo, Club & Main Details */}
            <div className="grid grid-cols-12 gap-4 items-center">
              {/* Photo / Jersey Avatar */}
              <div className="col-span-4 flex flex-col items-center text-center">
                <div
                  className="w-24 h-24 rounded-2xl flex flex-col items-center justify-center font-black text-2xl shadow-xl border-2 border-white/30 relative overflow-hidden"
                  style={{ backgroundColor: team?.badgeBg || '#1a4fd6', color: team?.badgeColor || '#ffffff' }}
                >
                  <span className="text-4xl font-syne font-black">{player.number}</span>
                  <span className="text-[10px] uppercase font-bold tracking-widest opacity-80">
                    {team?.shortName || 'APL'}
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
                </div>

                <span className="mt-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-900/60 text-blue-200 border border-blue-400/30">
                  {player.position}
                </span>
              </div>

              {/* Identity & Legal Data */}
              <div className="col-span-8 space-y-2 text-xs">
                <div>
                  <h2 className="font-syne font-black text-xl text-white leading-tight">
                    {player.name}
                  </h2>
                  <p className="text-xs text-amber-300 font-bold flex items-center gap-1 mt-0.5">
                    <span className="material-symbols-outlined text-sm">shield</span>
                    <span>{team?.name || 'Club de Fútbol'}</span>
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="bg-[#0a1628]/70 p-2 rounded-xl border border-blue-500/20">
                    <span className="text-[10px] text-slate-400 block font-semibold">Cédula de Identidad (CI)</span>
                    <span className="font-mono font-bold text-white text-xs">{player.documentId || '7892104 LP'}</span>
                  </div>

                  <div className="bg-[#0a1628]/70 p-2 rounded-xl border border-blue-500/20">
                    <span className="text-[10px] text-slate-400 block font-semibold">Edad / Nacimiento</span>
                    <span className="font-bold text-white text-xs">{age} años ({player.birthDate || '2000-01-01'})</span>
                  </div>

                  <div className="bg-[#0a1628]/70 p-2 rounded-xl border border-blue-500/20">
                    <span className="text-[10px] text-slate-400 block font-semibold">Nacionalidad</span>
                    <span className="font-semibold text-white text-xs">{player.nationality || 'Boliviana 🇧🇴'}</span>
                  </div>

                  <div className="bg-[#0a1628]/70 p-2 rounded-xl border border-blue-500/20">
                    <span className="text-[10px] text-slate-400 block font-semibold">Municipio Sede</span>
                    <span className="font-semibold text-white text-xs">{team?.city || 'Apolo'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Sanction & Eligibility Banner */}
            <div
              className={`p-3 rounded-2xl border flex items-center justify-between gap-3 text-xs ${
                player.isSuspended
                  ? 'bg-rose-950/60 border-rose-500/50 text-rose-200'
                  : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-xl">
                  {player.isSuspended ? 'gavel' : 'verified'}
                </span>
                <div>
                  <p className="font-black tracking-wide">
                    {player.isSuspended
                      ? '🔴 SUSPENDIDO / INHABILITADO PARA JUGAR'
                      : '🟢 JUGADOR HABILITADO REGLAMENTARIAMENTE'}
                  </p>
                  {player.isSuspended && player.suspensionReason && (
                    <p className="text-[11px] text-rose-300 mt-0.5">{player.suspensionReason}</p>
                  )}
                </div>
              </div>

              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/40 font-bold">
                {player.isSuspended ? 'SANCIÓN ACTIVA' : 'APROBADO'}
              </span>
            </div>

            {/* Hologram / Barcode Simulation */}
            <div className="flex items-center justify-between text-[10px] text-slate-400 border-t border-amber-400/20 pt-2 font-mono">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span>Credencial verificada con firma digital SHA-256</span>
              </div>
              <span className="tracking-widest font-black text-slate-300">||| | |||| | ||| |||| |</span>
            </div>
          </div>

          {/* Performance & Disciplinary Statistics */}
          <div className="bg-[#0a1628] rounded-2xl border border-blue-500/20 p-5 space-y-4">
            <h4 className="font-syne font-bold text-xs uppercase tracking-wider text-white flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-amber-400 text-sm">query_stats</span>
                <span>Rendimiento Deportivo en Temporada 2026</span>
              </span>
              <span className="text-blue-300 font-mono text-[11px]">
                {player.matchesPlayed || 4} partidos jugados
              </span>
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="bg-[#0d2347] p-3 rounded-xl border border-blue-500/20">
                <span className="text-[10px] text-slate-400 block font-semibold">Goles Anotados</span>
                <p className="font-syne font-black text-2xl text-amber-400 mt-0.5">{player.goals}</p>
                <span className="text-[10px] text-slate-400">
                  {((player.goals / Math.max(1, player.matchesPlayed || 4))).toFixed(2)} por partido
                </span>
              </div>

              <div className="bg-[#0d2347] p-3 rounded-xl border border-blue-500/20">
                <span className="text-[10px] text-slate-400 block font-semibold">Asistencias</span>
                <p className="font-syne font-black text-2xl text-blue-300 mt-0.5">{player.assists || 0}</p>
                <span className="text-[10px] text-slate-400">Pases gol</span>
              </div>

              <div className="bg-[#0d2347] p-3 rounded-xl border border-blue-500/20">
                <span className="text-[10px] text-slate-400 block font-semibold">Tarjetas Amarillas</span>
                <p className="font-syne font-black text-2xl text-amber-300 mt-0.5">🟨 {player.yellowCards}</p>
                <span className="text-[10px] text-slate-400">
                  {player.yellowCards >= 3 ? 'Límite alcanzado' : `${3 - player.yellowCards} para sanción`}
                </span>
              </div>

              <div className="bg-[#0d2347] p-3 rounded-xl border border-blue-500/20">
                <span className="text-[10px] text-slate-400 block font-semibold">Tarjetas Rojas</span>
                <p className="font-syne font-black text-2xl text-rose-400 mt-0.5">🟥 {player.redCards}</p>
                <span className="text-[10px] text-slate-400">Expulsiones</span>
              </div>
            </div>
          </div>

          {/* Edit Form (if toggled) */}
          {isEditing && (
            <form onSubmit={handleSave} className="bg-[#0a1628] rounded-2xl border border-amber-400/40 p-5 space-y-4 animate-in fade-in">
              <h4 className="font-syne font-bold text-xs uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">edit</span>
                <span>Modificar Ficha Federativa & Pasaporte</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Nombre Completo</label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-[#0d2347] border border-blue-500/30 rounded-xl px-3 py-2 text-white font-medium focus:border-blue-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Dorsal / Número</label>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    required
                    value={editNumber}
                    onChange={(e) => setEditNumber(Number(e.target.value))}
                    className="w-full bg-[#0d2347] border border-blue-500/30 rounded-xl px-3 py-2 text-white font-medium focus:border-blue-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Posición Reglamentaria</label>
                  <select
                    value={editPosition}
                    onChange={(e) => setEditPosition(e.target.value as any)}
                    className="w-full bg-[#0d2347] border border-blue-500/30 rounded-xl px-3 py-2 text-white font-medium focus:border-blue-400 focus:outline-none"
                  >
                    <option value="Portero">Portero</option>
                    <option value="Defensa">Defensa</option>
                    <option value="Centrocampista">Centrocampista</option>
                    <option value="Delantero">Delantero</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Cédula de Identidad (CI)</label>
                  <input
                    type="text"
                    placeholder="Ej. 8492019 LP"
                    value={editDocId}
                    onChange={(e) => setEditDocId(e.target.value)}
                    className="w-full bg-[#0d2347] border border-blue-500/30 rounded-xl px-3 py-2 text-white font-medium focus:border-blue-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Fecha de Nacimiento</label>
                  <input
                    type="date"
                    value={editBirthDate}
                    onChange={(e) => setEditBirthDate(e.target.value)}
                    className="w-full bg-[#0d2347] border border-blue-500/30 rounded-xl px-3 py-2 text-white font-medium focus:border-blue-400 focus:outline-none"
                  />
                </div>

                <div className="flex flex-col justify-center">
                  <label className="flex items-center gap-2 cursor-pointer mt-2">
                    <input
                      type="checkbox"
                      checked={editIsSuspended}
                      onChange={(e) => setEditIsSuspended(e.target.checked)}
                      className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 bg-[#0d2347] border-blue-500/40"
                    />
                    <span className="text-xs font-bold text-rose-300">
                      Aplicar Sanción / Suspensión Disciplinaria
                    </span>
                  </label>
                </div>

                {editIsSuspended && (
                  <div className="sm:col-span-2">
                    <label className="block text-slate-300 font-semibold mb-1">Motivo de la Suspensión</label>
                    <input
                      type="text"
                      placeholder="Ej. Doble amonestación en J2 o expulsión con informe arbitral"
                      value={editSuspensionReason}
                      onChange={(e) => setEditSuspensionReason(e.target.value)}
                      className="w-full bg-[#0d2347] border border-rose-500/40 rounded-xl px-3 py-2 text-rose-200 font-medium focus:border-rose-400 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-5 py-2 rounded-xl transition-all shadow active:scale-95"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-[#0a1628]/95 border-t border-blue-500/20 flex items-center justify-between print:hidden">
          <p className="text-[11px] text-blue-300/70">
            Acreditación válida para la Liga Oficial Franz Tamayo · Temporada 2026.
          </p>
          <button
            onClick={onClose}
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-5 py-2 rounded-xl transition-all shadow active:scale-95"
          >
            Cerrar Ficha
          </button>
        </div>
      </div>
    </div>
  );
};

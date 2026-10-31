import React, { useState, useEffect } from 'react';
import { useTournament } from '../context/TournamentContext';
import { Match, RefereeRole, MatchOfficialAssignment } from '../types/tournament';

interface Props {
  match: Match;
  onClose: () => void;
}

export const RefereeAssignmentModal: React.FC<Props> = ({ match, onClose }) => {
  const { teams, referees, assignOfficialsToMatch, showToast } = useTournament();

  const homeTeam = teams.find((t) => t.id === match.homeTeamId);
  const awayTeam = teams.find((t) => t.id === match.awayTeamId);

  // Initial state from match.officials or defaults
  const [mainRefId, setMainRefId] = useState<string>('');
  const [assistant1RefId, setAssistant1RefId] = useState<string>('');
  const [assistant2RefId, setAssistant2RefId] = useState<string>('');
  const [fourthRefId, setFourthRefId] = useState<string>('');
  const [errorWarning, setErrorWarning] = useState<string | null>(null);

  useEffect(() => {
    if (match.officials && match.officials.length > 0) {
      match.officials.forEach((off) => {
        if (off.role === 'Principal') setMainRefId(off.refereeId);
        if (off.role === 'Asistente 1') setAssistant1RefId(off.refereeId);
        if (off.role === 'Asistente 2') setAssistant2RefId(off.refereeId);
        if (off.role === 'Cuarto Árbitro') setFourthRefId(off.refereeId);
      });
    }
  }, [match]);

  // Validation: Check for duplicates
  const validateAssignments = (): boolean => {
    const selected = [mainRefId, assistant1RefId, assistant2RefId, fourthRefId].filter(Boolean);
    const unique = new Set(selected);
    if (selected.length !== unique.size) {
      setErrorWarning('Un mismo árbitro no puede ocupar múltiples funciones en el mismo encuentro.');
      return false;
    }
    setErrorWarning(null);
    return true;
  };

  // Auto-Suggest an officiating crew from available referees
  const handleAutoSuggest = () => {
    const activeRefs = referees.filter((r) => r.status === 'activo');
    if (activeRefs.length < 3) {
      showToast('No hay suficientes árbitros activos en el padrón para sugerir terna', 'warning');
      return;
    }

    // Try finding a primary referee
    const primary = activeRefs.find((r) => r.rolePrimary === 'Principal') || activeRefs[0];
    const assistants = activeRefs.filter((r) => r.id !== primary.id);

    setMainRefId(primary.id);
    if (assistants[0]) setAssistant1RefId(assistants[0].id);
    if (assistants[1]) setAssistant2RefId(assistants[1].id);
    if (assistants[2]) setFourthRefId(assistants[2].id);

    setErrorWarning(null);
    showToast('Terna arbitral reglamentaria sugerida automáticamente', 'info');
  };

  const handleSave = () => {
    if (match.isRefereeSigned) {
      showToast('El acta ya se encuentra sellada digitalmente. No se puede modificar la designación.', 'warning');
      return;
    }

    if (!validateAssignments()) return;

    const assignments: MatchOfficialAssignment[] = [];

    if (mainRefId) {
      const ref = referees.find((r) => r.id === mainRefId);
      if (ref) assignments.push({ role: 'Principal', refereeId: ref.id, refereeName: ref.fullName, licenseNumber: ref.licenseNumber });
    }
    if (assistant1RefId) {
      const ref = referees.find((r) => r.id === assistant1RefId);
      if (ref) assignments.push({ role: 'Asistente 1', refereeId: ref.id, refereeName: ref.fullName, licenseNumber: ref.licenseNumber });
    }
    if (assistant2RefId) {
      const ref = referees.find((r) => r.id === assistant2RefId);
      if (ref) assignments.push({ role: 'Asistente 2', refereeId: ref.id, refereeName: ref.fullName, licenseNumber: ref.licenseNumber });
    }
    if (fourthRefId) {
      const ref = referees.find((r) => r.id === fourthRefId);
      if (ref) assignments.push({ role: 'Cuarto Árbitro', refereeId: ref.id, refereeName: ref.fullName, licenseNumber: ref.licenseNumber });
    }

    assignOfficialsToMatch(match.id, assignments);
    onClose();
  };

  const getRefereeBadge = (cat?: string) => {
    switch (cat) {
      case 'FIFA':
        return 'bg-amber-400 text-blue-950 font-black border border-amber-300';
      case 'Nacional FBF':
        return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
      case 'Departamental LP':
        return 'bg-blue-500/20 text-blue-300 border border-blue-500/30';
      default:
        return 'bg-slate-700 text-slate-300 border border-slate-600';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-[#0d2347] border border-blue-500/30 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-blue-950 via-[#0d2347] to-blue-900/80 px-6 py-5 border-b border-blue-500/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400">
              <span className="material-symbols-outlined text-[24px]">sports</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Designación de Terna Arbitral
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  Oficial FBF
                </span>
              </h2>
              <p className="text-xs text-blue-200/70">
                Colegio Oficial de Árbitros · Provincia Franz Tamayo, La Paz 🇧🇴
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-blue-900/50 hover:bg-blue-800 text-blue-200 hover:text-white flex items-center justify-center transition-all"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Match Context Card */}
          <div className="bg-blue-950/60 border border-blue-500/20 rounded-2xl p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black shadow-md"
                style={{ backgroundColor: homeTeam?.badgeBg || '#1a4fd6', color: homeTeam?.badgeColor || '#fff' }}
              >
                {homeTeam?.shortName || 'LOC'}
              </div>
              <div>
                <div className="text-xs font-bold text-white">{homeTeam?.name || 'Local'}</div>
                <div className="text-[10px] text-blue-300/70">{match.pitch}</div>
              </div>
            </div>

            <div className="text-center px-3 py-1 rounded-xl bg-blue-900/40 border border-blue-500/20">
              <div className="text-[10px] font-black text-amber-400 uppercase tracking-widest">{match.roundName || `Jornada ${match.round}`}</div>
              <div className="text-xs text-blue-200 font-semibold">{match.date} · {match.time}</div>
            </div>

            <div className="flex items-center gap-3 text-right">
              <div>
                <div className="text-xs font-bold text-white">{awayTeam?.name || 'Visitante'}</div>
                <div className="text-[10px] text-blue-300/70">{match.status.toUpperCase()}</div>
              </div>
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black shadow-md"
                style={{ backgroundColor: awayTeam?.badgeBg || '#b91c1c', color: awayTeam?.badgeColor || '#fff' }}
              >
                {awayTeam?.shortName || 'VIS'}
              </div>
            </div>
          </div>

          {/* Locked Badge Warning if Signed */}
          {match.isRefereeSigned && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-400/30 flex items-center gap-3">
              <span className="material-symbols-outlined text-amber-400 text-[26px]">verified</span>
              <div>
                <div className="text-xs font-black text-amber-400 uppercase tracking-wide">
                  Acta Oficial Sellada Digitalmente
                </div>
                <div className="text-[11px] text-blue-200/80">
                  Este partido ya cuenta con firma y hash criptográfico registrado. Para preservar la integridad arbitral, los colegiados asignados no pueden alterarse.
                </div>
              </div>
            </div>
          )}

          {/* Duplicate selection warning */}
          {errorWarning && (
            <div className="p-3.5 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center gap-2.5 text-xs text-red-300">
              <span className="material-symbols-outlined text-[20px] text-red-400">error</span>
              <span>{errorWarning}</span>
            </div>
          )}

          {/* Quick Auto-Suggest Button */}
          {!match.isRefereeSigned && (
            <div className="flex items-center justify-between bg-blue-900/20 border border-blue-500/15 rounded-2xl p-3.5">
              <div className="flex items-center gap-2 text-xs text-blue-200">
                <span className="material-symbols-outlined text-[18px] text-amber-400">auto_fix_high</span>
                <span>¿Deseas una asignación rápida según disponibilidad del padrón?</span>
              </div>
              <button
                type="button"
                onClick={handleAutoSuggest}
                className="text-xs font-bold text-amber-400 hover:text-amber-300 bg-amber-400/10 hover:bg-amber-400/20 border border-amber-400/30 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5"
              >
                <span>Sugerir Terna</span>
              </button>
            </div>
          )}

          {/* Role Fields Grid */}
          <div className="space-y-4">
            {/* 1. Main Referee */}
            <div className="bg-blue-950/40 border border-blue-500/20 rounded-2xl p-4 transition-all focus-within:border-amber-400/50">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-400 text-[18px]">sports</span>
                  Árbitro Central (Pito Principal)
                </label>
                <span className="text-[10px] font-bold text-blue-300/80 uppercase">Obligatorio</span>
              </div>
              <select
                disabled={match.isRefereeSigned}
                value={mainRefId}
                onChange={(e) => {
                  setMainRefId(e.target.value);
                  setErrorWarning(null);
                }}
                className="w-full bg-[#0a1628] border border-blue-500/30 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400 disabled:opacity-50"
              >
                <option value="">-- Seleccionar Árbitro Central --</option>
                {referees.map((r) => (
                  <option key={r.id} value={r.id} disabled={r.status !== 'activo'}>
                    {r.fullName} ({r.category}) · Lic: {r.licenseNumber} {r.status !== 'activo' ? '· [LICENCIA]' : ''}
                  </option>
                ))}
              </select>
              {mainRefId && (
                <div className="mt-2.5 flex items-center justify-between text-[11px] text-blue-200/80 bg-blue-900/30 rounded-lg p-2">
                  <span>{referees.find((r) => r.id === mainRefId)?.association}</span>
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${getRefereeBadge(referees.find((r) => r.id === mainRefId)?.category)}`}>
                    {referees.find((r) => r.id === mainRefId)?.category}
                  </span>
                </div>
              )}
            </div>

            {/* 2. Assistant 1 */}
            <div className="bg-blue-950/40 border border-blue-500/20 rounded-2xl p-4 transition-all focus-within:border-blue-400/50">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-400 text-[18px]">flag</span>
                  Árbitro Asistente 1 (Línea Oriente)
                </label>
                <span className="text-[10px] font-bold text-blue-300/80 uppercase">Banda Principal</span>
              </div>
              <select
                disabled={match.isRefereeSigned}
                value={assistant1RefId}
                onChange={(e) => {
                  setAssistant1RefId(e.target.value);
                  setErrorWarning(null);
                }}
                className="w-full bg-[#0a1628] border border-blue-500/30 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-blue-400 disabled:opacity-50"
              >
                <option value="">-- Seleccionar Asistente 1 --</option>
                {referees.map((r) => (
                  <option key={r.id} value={r.id} disabled={r.status !== 'activo'}>
                    {r.fullName} ({r.category}) · Lic: {r.licenseNumber}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Assistant 2 */}
            <div className="bg-blue-950/40 border border-blue-500/20 rounded-2xl p-4 transition-all focus-within:border-blue-400/50">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-400 text-[18px]">flag</span>
                  Árbitro Asistente 2 (Línea Poniente)
                </label>
                <span className="text-[10px] font-bold text-blue-300/80 uppercase">Banda Banco</span>
              </div>
              <select
                disabled={match.isRefereeSigned}
                value={assistant2RefId}
                onChange={(e) => {
                  setAssistant2RefId(e.target.value);
                  setErrorWarning(null);
                }}
                className="w-full bg-[#0a1628] border border-blue-500/30 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-blue-400 disabled:opacity-50"
              >
                <option value="">-- Seleccionar Asistente 2 --</option>
                {referees.map((r) => (
                  <option key={r.id} value={r.id} disabled={r.status !== 'activo'}>
                    {r.fullName} ({r.category}) · Lic: {r.licenseNumber}
                  </option>
                ))}
              </select>
            </div>

            {/* 4. Fourth Official */}
            <div className="bg-blue-950/40 border border-blue-500/20 rounded-2xl p-4 transition-all focus-within:border-blue-400/50">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-400 text-[18px]">assignment_ind</span>
                  Cuarto Árbitro / Veedor Oficial de Mesa
                </label>
                <span className="text-[10px] font-bold text-emerald-400/80 uppercase">Control de Cambios</span>
              </div>
              <select
                disabled={match.isRefereeSigned}
                value={fourthRefId}
                onChange={(e) => {
                  setFourthRefId(e.target.value);
                  setErrorWarning(null);
                }}
                className="w-full bg-[#0a1628] border border-blue-500/30 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-400 disabled:opacity-50"
              >
                <option value="">-- Opcional: Designar Cuarto Árbitro --</option>
                {referees.map((r) => (
                  <option key={r.id} value={r.id} disabled={r.status !== 'activo'}>
                    {r.fullName} ({r.category}) · Lic: {r.licenseNumber}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-[#0a1628] px-6 py-4 border-t border-blue-500/20 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-blue-200 hover:text-white hover:bg-blue-900/40 transition-all"
          >
            Cerrar
          </button>

          {!match.isRefereeSigned && (
            <button
              type="button"
              onClick={handleSave}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 border border-blue-400/40 flex items-center gap-2 transition-all hover:scale-[1.02]"
            >
              <span className="material-symbols-outlined text-[18px]">save</span>
              <span>Guardar Designación Oficial</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

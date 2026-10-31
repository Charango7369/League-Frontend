import React, { useState } from 'react';
import { useTournament } from '../context/TournamentContext';
import { DisciplinarySanction, SanctionStatus, SanctionType } from '../types/tournament';

export const DisciplinaryView: React.FC = () => {
  const {
    sanctions,
    players,
    teams,
    matches,
    addSanction,
    updateSanction,
    deleteSanction,
    serveSanctionMatch,
    pardonSanction,
    showToast,
  } = useTournament();

  const [activeSubTab, setActiveSubTab] = useState<'resoluciones' | 'capilla' | 'fair_play'>('resoluciones');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSanction, setEditingSanction] = useState<DisciplinarySanction | null>(null);
  const [selectedBoletinSanction, setSelectedBoletinSanction] = useState<DisciplinarySanction | null>(null);

  // Form States
  const [formPlayerId, setFormPlayerId] = useState('');
  const [formTeamId, setFormTeamId] = useState('');
  const [formSanctionType, setFormSanctionType] = useState<SanctionType>('roja_directa');
  const [formMatchesSuspended, setFormMatchesSuspended] = useState(1);
  const [formMatchesServed, setFormMatchesServed] = useState(0);
  const [formFineBob, setFormFineBob] = useState(50);
  const [formDescription, setFormDescription] = useState('');
  const [formInfractionDetails, setFormInfractionDetails] = useState('');
  const [formSigner, setFormSigner] = useState('Dr. Hernán Arteaga - Presidente Tribunal de Penas');
  const [formStatus, setFormStatus] = useState<SanctionStatus>('activa');

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingSanction(null);
    const defaultTeam = teams[0]?.id || '';
    setFormTeamId(defaultTeam);
    const teamPlayers = players.filter((p) => p.teamId === defaultTeam);
    setFormPlayerId(teamPlayers[0]?.id || '');
    setFormSanctionType('roja_directa');
    setFormMatchesSuspended(2);
    setFormMatchesServed(0);
    setFormFineBob(100);
    setFormDescription('Suspensión por infracción reglamentaria en encuentro oficial');
    setFormInfractionDetails('Expulsión en el transcurso del partido por conducta antideportiva.');
    setFormSigner('Dr. Hernán Arteaga - Presidente Tribunal de Penas');
    setFormStatus('activa');
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (s: DisciplinarySanction) => {
    setEditingSanction(s);
    setFormPlayerId(s.playerId);
    setFormTeamId(s.teamId);
    setFormSanctionType(s.sanctionType);
    setFormMatchesSuspended(s.matchesSuspended);
    setFormMatchesServed(s.matchesServed);
    setFormFineBob(s.financialFineBob || 0);
    setFormDescription(s.description);
    setFormInfractionDetails(s.infractionDetails);
    setFormSigner(s.tribunalSigner);
    setFormStatus(s.status);
    setIsModalOpen(true);
  };

  // Save Sanction
  const handleSaveSanction = (e: React.FormEvent) => {
    e.preventDefault();
    const player = players.find((p) => p.id === formPlayerId);
    const team = teams.find((t) => t.id === formTeamId);

    if (!player || !team) {
      showToast('Selecciona un jugador y club válidos', 'warning');
      return;
    }

    if (editingSanction) {
      updateSanction({
        ...editingSanction,
        playerId: player.id,
        playerName: player.name,
        playerNumber: player.number,
        teamId: team.id,
        teamName: team.name,
        sanctionType: formSanctionType,
        matchesSuspended: formMatchesSuspended,
        matchesServed: formMatchesServed,
        financialFineBob: formFineBob,
        description: formDescription,
        infractionDetails: formInfractionDetails,
        tribunalSigner: formSigner,
        status: formStatus,
      });
    } else {
      addSanction({
        playerId: player.id,
        playerName: player.name,
        playerNumber: player.number,
        teamId: team.id,
        teamName: team.name,
        sanctionType: formSanctionType,
        matchesSuspended: formMatchesSuspended,
        matchesServed: formMatchesServed,
        financialFineBob: formFineBob,
        resolutionDate: new Date().toISOString().split('T')[0],
        description: formDescription,
        infractionDetails: formInfractionDetails,
        tribunalSigner: formSigner,
        status: formStatus,
      });
    }

    setIsModalOpen(false);
  };

  // Filtered Resolutions
  const filteredSanctions = sanctions.filter((s) => {
    const matchesSearch =
      s.playerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.teamName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.code.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    const matchesType = typeFilter === 'all' || s.sanctionType === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  // Aggregate Metrics
  const activeSuspendedCount = sanctions.filter((s) => s.status === 'activa').length;
  const totalYellows = players.reduce((sum, p) => sum + p.yellowCards, 0);
  const totalReds = players.reduce((sum, p) => sum + p.redCards, 0);
  const totalFinesBob = sanctions.reduce((sum, s) => sum + (s.financialFineBob || 0), 0);

  // Players with Yellow Cards (for Capilla tab)
  const playersWithCards = players
    .filter((p) => p.yellowCards > 0 || p.redCards > 0 || p.isSuspended)
    .sort((a, b) => b.yellowCards - a.yellowCards);

  // Fair Play Ranking calculation (lower points = cleaner play)
  const fairPlayRanking = teams.map((team) => {
    const teamPlayers = players.filter((p) => p.teamId === team.id);
    const yellows = teamPlayers.reduce((s, p) => s + p.yellowCards, 0);
    const reds = teamPlayers.reduce((s, p) => s + p.redCards, 0);
    // Fair play penalty formula: yellow = 1 pt, red = 3 pts
    const penaltyPoints = yellows * 1 + reds * 3;

    return {
      team,
      yellows,
      reds,
      penaltyPoints,
    };
  }).sort((a, b) => a.penaltyPoints - b.penaltyPoints);

  // Badge helpers
  const getStatusBadge = (status: SanctionStatus) => {
    switch (status) {
      case 'activa':
        return 'bg-rose-500/20 text-rose-400 border border-rose-500/30';
      case 'cumplida':
        return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
      case 'apelada':
        return 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
      case 'indultada':
        return 'bg-blue-500/20 text-blue-300 border border-blue-500/30';
      default:
        return 'bg-slate-700 text-slate-300';
    }
  };

  const getTypeLabel = (type: SanctionType) => {
    switch (type) {
      case 'roja_directa':
        return '🟥 Roja Directa';
      case 'amarillas_acumuladas':
        return '🟨 Acumulación (3 Amarillas)';
      case 'doble_amarilla':
        return '🟨🟥 Doble Amonestación';
      case 'conducta_antideportiva':
        return '⚠️ Conducta Antideportiva';
      case 'sancion_tribunal':
        return '⚖️ Resolución de Oficio TJD';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-red-950 via-[#0d2347] to-slate-900 border border-red-500/25 rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-2xl">
        <div className="absolute right-0 top-0 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 shadow-xl shrink-0">
              <span className="material-symbols-outlined text-[36px]">gavel</span>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-xs font-black uppercase tracking-wider text-red-400 bg-red-400/10 border border-red-400/30 px-2.5 py-0.5 rounded-full">
                  Tribunal de Penas & Disciplina Deportiva
                </span>
                <span className="text-xs font-semibold text-blue-200/80">
                  Provincia Franz Tamayo · Apolo
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black font-syne text-white tracking-wide">
                Justicia Deportiva & Control Disciplinario
              </h1>
              <p className="text-xs sm:text-sm text-blue-100/70 max-w-2xl mt-1">
                Registro oficial de amonestaciones, cómputo de tarjetas amarillas acumuladas, inhabilitaciones y resoluciones del Tribunal de Justicia Deportiva.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-400 hover:to-rose-500 text-white font-extrabold text-xs shadow-lg shadow-red-600/25 border border-red-400/40 transition-all active:scale-95 whitespace-nowrap self-start md:self-auto cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">add_moderator</span>
            <span>Dictar Resolución</span>
          </button>
        </div>

        {/* Aggregate KPI Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-red-500/20">
          <div className="bg-[#0a1628]/80 p-3.5 rounded-2xl border border-red-500/20">
            <span className="text-[10px] uppercase font-bold text-rose-400 block">Suspendidos Activos</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-2xl font-black font-syne text-white">{activeSuspendedCount}</span>
              <span className="text-xs text-rose-300">futbolistas</span>
            </div>
          </div>

          <div className="bg-[#0a1628]/80 p-3.5 rounded-2xl border border-blue-500/20">
            <span className="text-[10px] uppercase font-bold text-yellow-400 block">Tarjetas Amarillas</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-2xl font-black font-syne text-yellow-300">{totalYellows}</span>
              <span className="text-xs text-yellow-200/70">amonestaciones</span>
            </div>
          </div>

          <div className="bg-[#0a1628]/80 p-3.5 rounded-2xl border border-blue-500/20">
            <span className="text-[10px] uppercase font-bold text-red-400 block">Tarjetas Rojas</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-2xl font-black font-syne text-red-400">{totalReds}</span>
              <span className="text-xs text-red-200/70">expulsiones</span>
            </div>
          </div>

          <div className="bg-[#0a1628]/80 p-3.5 rounded-2xl border border-blue-500/20">
            <span className="text-[10px] uppercase font-bold text-emerald-400 block">Aranceles / Multas</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-2xl font-black font-syne text-emerald-300">{totalFinesBob}</span>
              <span className="text-xs text-emerald-200/70">BOB total</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-blue-500/20 pb-2 overflow-x-auto scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveSubTab('resoluciones')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap ${
            activeSubTab === 'resoluciones'
              ? 'bg-red-600 text-white shadow-lg shadow-red-700/30 border border-red-400/40'
              : 'text-blue-200 hover:text-white hover:bg-blue-900/40'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">gavel</span>
          <span>Libro de Resoluciones TJD</span>
          <span className="text-[10px] bg-red-950 px-2 py-0.2 rounded-full border border-red-500/30">
            {sanctions.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('capilla')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap ${
            activeSubTab === 'capilla'
              ? 'bg-amber-600 text-white shadow-lg shadow-amber-700/30 border border-amber-400/40'
              : 'text-blue-200 hover:text-white hover:bg-blue-900/40'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">warning</span>
          <span>Semáforo de Acumulación ("En Capilla")</span>
          <span className="text-[10px] bg-amber-950 px-2 py-0.2 rounded-full border border-amber-500/30">
            {playersWithCards.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('fair_play')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap ${
            activeSubTab === 'fair_play'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-700/30 border border-emerald-400/40'
              : 'text-blue-200 hover:text-white hover:bg-blue-900/40'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">verified</span>
          <span>Tabla Fair Play Institucional</span>
        </button>
      </div>

      {/* 1. TAB RESOLUCIONES DEL TRIBUNAL */}
      {activeSubTab === 'resoluciones' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-[#0d2347]/80 p-4 rounded-2xl border border-blue-500/20 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                  search
                </span>
                <input
                  type="text"
                  placeholder="Buscar jugador, club o código..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-[#0a1628] border border-blue-500/30 text-white text-xs rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:border-red-400 w-52 sm:w-64"
                />
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-[#0a1628] border border-blue-500/30 text-white text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-red-400"
              >
                <option value="all">Todos los Estados</option>
                <option value="activa">🔴 Sanción Activa</option>
                <option value="cumplida">🟢 Cumplida / Habilitado</option>
                <option value="apelada">🟡 En Apelación</option>
                <option value="indultada">🔵 Indulto Concedido</option>
              </select>

              {/* Type Filter */}
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="bg-[#0a1628] border border-blue-500/30 text-white text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-red-400"
              >
                <option value="all">Todas las Infracciones</option>
                <option value="roja_directa">🟥 Roja Directa</option>
                <option value="amarillas_acumuladas">🟨 Acumulación de 3</option>
                <option value="doble_amarilla">🟨🟥 Doble Amarilla</option>
                <option value="conducta_antideportiva">⚠️ Conducta Antideportiva</option>
              </select>
            </div>

            <div className="text-xs text-blue-300/70 font-semibold self-end md:self-auto">
              Mostrando {filteredSanctions.length} de {sanctions.length} resoluciones
            </div>
          </div>

          {/* Resolutions Grid */}
          {filteredSanctions.length === 0 ? (
            <div className="text-center py-16 bg-[#0d2347]/40 border border-blue-500/20 rounded-3xl p-8">
              <span className="material-symbols-outlined text-[48px] text-slate-500 mb-2">fact_check</span>
              <h3 className="text-base font-bold text-white font-syne">No se encontraron resoluciones</h3>
              <p className="text-xs text-blue-200/60 mt-1 max-w-md mx-auto">
                No hay sanciones que coincidan con los filtros seleccionados o el libro de actas está al día.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredSanctions.map((sanc) => {
                const isActiva = sanc.status === 'activa';
                const remainingMatches = Math.max(0, sanc.matchesSuspended - sanc.matchesServed);

                return (
                  <div
                    key={sanc.id}
                    className={`rounded-2xl p-5 border transition-all relative overflow-hidden flex flex-col justify-between ${
                      isActiva
                        ? 'bg-gradient-to-br from-red-950/40 via-[#0d2347] to-[#0a1628] border-red-500/30 shadow-lg'
                        : 'bg-[#0d2347]/60 border-blue-500/20'
                    }`}
                  >
                    <div>
                      {/* Top Bar: Code & Status */}
                      <div className="flex items-center justify-between pb-3 border-b border-blue-500/15 mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-black text-amber-400 bg-amber-400/10 border border-amber-400/30 px-2.5 py-0.5 rounded-lg">
                            {sanc.code}
                          </span>
                          <span className="text-[10px] text-blue-300/70 font-mono">
                            {sanc.resolutionDate}
                          </span>
                        </div>

                        <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${getStatusBadge(sanc.status)}`}>
                          {sanc.status}
                        </span>
                      </div>

                      {/* Player & Club */}
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-900/60 border border-blue-400/30 flex items-center justify-center text-white font-black text-xs shrink-0 font-syne">
                          #{sanc.playerNumber || '10'}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-syne font-bold text-sm sm:text-base text-white truncate flex items-center gap-1.5">
                            <span>{sanc.playerName}</span>
                            {isActiva && (
                              <span className="text-[9px] font-bold text-rose-400 bg-rose-950 px-1.5 py-0.2 rounded border border-rose-500/40">
                                INHABILITADO
                              </span>
                            )}
                          </h3>
                          <p className="text-xs text-blue-300 font-medium truncate">{sanc.teamName}</p>
                        </div>
                      </div>

                      {/* Sanction Details Badge */}
                      <div className="bg-[#0a1628]/80 rounded-xl p-3 border border-blue-500/15 space-y-2 mb-3 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-blue-300/70">Tipo de Sanción:</span>
                          <span className="font-bold text-white">{getTypeLabel(sanc.sanctionType)}</span>
                        </div>

                        {/* Progress Bar for matches served */}
                        <div>
                          <div className="flex items-center justify-between text-[11px] mb-1">
                            <span className="text-blue-300/70">Fechas de Suspensión:</span>
                            <span className="font-bold text-amber-300">
                              {sanc.matchesServed} de {sanc.matchesSuspended} cumplida{sanc.matchesSuspended > 1 ? 's' : ''}
                              {isActiva && ` (${remainingMatches} pendiente)`}
                            </span>
                          </div>
                          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-blue-500/20">
                            <div
                              className={`h-full transition-all ${
                                sanc.status === 'cumplida'
                                  ? 'bg-emerald-500'
                                  : 'bg-gradient-to-r from-red-500 to-amber-400'
                              }`}
                              style={{
                                width: `${Math.min(100, (sanc.matchesServed / sanc.matchesSuspended) * 100)}%`,
                              }}
                            />
                          </div>
                        </div>

                        {sanc.financialFineBob && sanc.financialFineBob > 0 ? (
                          <div className="flex items-center justify-between pt-1 border-t border-blue-500/10">
                            <span className="text-blue-300/70">Arancel / Multa Económica:</span>
                            <span className="font-black text-emerald-400 font-mono">
                              {sanc.financialFineBob} BOB
                            </span>
                          </div>
                        ) : null}

                        <p className="text-[11px] text-slate-300 italic pt-1 border-t border-blue-500/10">
                          "{sanc.infractionDetails}"
                        </p>
                      </div>

                      {/* Signer of Tribunal */}
                      <div className="text-[10px] text-blue-200/60 font-medium mb-3 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[13px] text-amber-400">verified_user</span>
                        <span>{sanc.tribunalSigner}</span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-3 border-t border-blue-500/15 flex flex-wrap items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5">
                        {isActiva && (
                          <button
                            type="button"
                            onClick={() => serveSanctionMatch(sanc.id)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600/30 hover:bg-emerald-600 text-emerald-200 hover:text-white font-bold text-xs border border-emerald-400/30 transition-all flex items-center gap-1 cursor-pointer"
                            title="Avanzar 1 fecha cumplida"
                          >
                            <span className="material-symbols-outlined text-[14px]">done_all</span>
                            <span>+1 Fecha</span>
                          </button>
                        )}

                        {isActiva && (
                          <button
                            type="button"
                            onClick={() => pardonSanction(sanc.id)}
                            className="px-2.5 py-1 rounded-lg bg-blue-900/40 hover:bg-blue-800 text-blue-200 hover:text-white font-bold text-xs border border-blue-400/30 transition-all flex items-center gap-1 cursor-pointer"
                            title="Indultar sanción"
                          >
                            <span className="material-symbols-outlined text-[14px]">history_edu</span>
                            <span>Indulto</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setSelectedBoletinSanction(sanc)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs border border-slate-600 transition-all flex items-center gap-1 cursor-pointer"
                          title="Ver boletín oficial de resolución"
                        >
                          <span className="material-symbols-outlined text-[14px]">article</span>
                          <span>Boletín</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(sanc)}
                          className="w-8 h-8 rounded-lg bg-blue-950 hover:bg-blue-900 text-blue-300 hover:text-white flex items-center justify-center border border-blue-500/30 transition-all cursor-pointer"
                          title="Editar resolución"
                        >
                          <span className="material-symbols-outlined text-[15px]">edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`¿Eliminar la resolución ${sanc.code} del expediente?`)) {
                              deleteSanction(sanc.id);
                            }
                          }}
                          className="w-8 h-8 rounded-lg bg-red-950/60 hover:bg-red-900 text-red-300 hover:text-white flex items-center justify-center border border-red-500/30 transition-all cursor-pointer"
                          title="Eliminar resolución"
                        >
                          <span className="material-symbols-outlined text-[15px]">delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 2. TAB SEMÁFORO DE ACUMULACIÓN ("EN CAPILLA") */}
      {activeSubTab === 'capilla' && (
        <div className="bg-[#0d2347]/70 rounded-2xl border border-blue-500/20 p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-blue-500/15">
            <div>
              <h3 className="text-base font-bold text-white font-syne flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-400">warning</span>
                <span>Semáforo Preventivo de Tarjetas Amarillas</span>
              </h3>
              <p className="text-xs text-blue-200/70">
                Reglamento FBF Franz Tamayo: 3 tarjetas amarillas conllevan 1 fecha automática de suspensión.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {playersWithCards.map((p) => {
              const team = teams.find((t) => t.id === p.teamId);
              const yellows = p.yellowCards % 3; // cycle modulo 3
              const isEnCapilla = yellows === 2;
              const isSuspended = p.isSuspended;

              return (
                <div
                  key={p.id}
                  className={`p-4 rounded-xl border transition-all ${
                    isSuspended
                      ? 'bg-red-950/40 border-red-500/40'
                      : isEnCapilla
                      ? 'bg-amber-950/40 border-amber-500/40 shadow-md'
                      : 'bg-[#0a1628]/80 border-blue-500/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-blue-900 border border-blue-400/30 flex items-center justify-center text-white text-xs font-bold font-syne">
                        #{p.number}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white truncate max-w-[140px]">{p.name}</h4>
                        <span className="text-[10px] text-blue-300 block">{team?.name}</span>
                      </div>
                    </div>

                    <span
                      className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                        isSuspended
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          : isEnCapilla
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}
                    >
                      {isSuspended ? 'SUSPENDIDO' : isEnCapilla ? 'EN CAPILLA' : 'HABILITADO'}
                    </span>
                  </div>

                  {/* Cards Breakdown & Progress */}
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Amarillas acumuladas:</span>
                      <span className="font-bold text-yellow-300">
                        {p.yellowCards} tarjeta{p.yellowCards !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {/* 3 Step Visual Traffic Lights */}
                    <div className="flex gap-1.5 pt-1">
                      <div
                        className={`flex-1 h-2.5 rounded-full transition-all ${
                          yellows >= 1 ? 'bg-yellow-400 shadow-sm shadow-yellow-400/50' : 'bg-slate-800'
                        }`}
                        title="1ra Amarilla (Advertencia)"
                      />
                      <div
                        className={`flex-1 h-2.5 rounded-full transition-all ${
                          yellows >= 2 ? 'bg-amber-500 shadow-sm shadow-amber-500/50' : 'bg-slate-800'
                        }`}
                        title="2da Amarilla (En Capilla)"
                      />
                      <div
                        className={`flex-1 h-2.5 rounded-full transition-all ${
                          p.isSuspended || p.yellowCards >= 3
                            ? 'bg-rose-600 shadow-sm shadow-rose-600/50 animate-pulse'
                            : 'bg-slate-800'
                        }`}
                        title="3ra Amarilla (Suspensión)"
                      />
                    </div>

                    {isEnCapilla && !isSuspended && (
                      <p className="text-[10px] text-amber-300/90 font-medium pt-1">
                        ⚠️ A una amonestación de quedar inhabilitado para la siguiente fecha.
                      </p>
                    )}

                    {isSuspended && (
                      <p className="text-[10px] text-rose-300/90 font-medium pt-1">
                        🛑 {p.suspensionReason || 'Inhabilitado por dictamen disciplinario.'}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. TAB TABLA FAIR PLAY INSTITUCIONAL */}
      {activeSubTab === 'fair_play' && (
        <div className="bg-[#0d2347]/70 rounded-2xl border border-blue-500/20 p-5 space-y-4">
          <div className="pb-3 border-b border-blue-500/15">
            <h3 className="text-base font-bold text-white font-syne flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-400">emoji_events</span>
              <span>Trofeo Fair Play (Juego Limpio) Franz Tamayo</span>
            </h3>
            <p className="text-xs text-blue-200/70">
              Cómputo reglamentario: Amarilla = 1 punto de penalización, Roja = 3 puntos. El club con menor puntaje lidera el juego limpio.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0a1628] text-blue-300 uppercase tracking-wider text-[10px] border-b border-blue-500/20">
                <tr>
                  <th className="p-3">Pos</th>
                  <th className="p-3">Club</th>
                  <th className="p-3 text-center">🟨 Amarillas</th>
                  <th className="p-3 text-center">🟥 Rojas</th>
                  <th className="p-3 text-center">Pts Penalización</th>
                  <th className="p-3 text-right">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-500/10">
                {fairPlayRanking.map((row, idx) => (
                  <tr key={row.team.id} className="hover:bg-blue-900/20 transition-all">
                    <td className="p-3 font-bold font-syne text-white">
                      {idx === 0 ? '🥇 1°' : idx === 1 ? '🥈 2°' : idx === 2 ? '🥉 3°' : `${idx + 1}°`}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold"
                          style={{ backgroundColor: row.team.badgeBg, color: row.team.badgeColor }}
                        >
                          {row.team.shortName}
                        </div>
                        <span className="font-bold text-white">{row.team.name}</span>
                      </div>
                    </td>
                    <td className="p-3 text-center font-bold text-yellow-300">{row.yellows}</td>
                    <td className="p-3 text-center font-bold text-red-400">{row.reds}</td>
                    <td className="p-3 text-center font-black font-mono text-white text-sm">
                      {row.penaltyPoints}
                    </td>
                    <td className="p-3 text-right">
                      <span
                        className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                          idx === 0
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : row.penaltyPoints <= 4
                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {idx === 0 ? 'Líder Fair Play' : row.penaltyPoints <= 4 ? 'Ejemplar' : 'Apercibido'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE / EDIT SANCTION MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto animate-in fade-in">
          <div className="bg-[#0d2347] border border-red-500/30 rounded-3xl w-full max-w-xl p-6 shadow-2xl relative my-auto">
            <div className="flex items-center justify-between pb-4 border-b border-blue-500/20 mb-5">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-red-400 text-[24px]">gavel</span>
                <div>
                  <h3 className="text-base font-bold text-white font-syne">
                    {editingSanction ? 'Modificar Resolución Disciplinaria' : 'Dictar Nueva Resolución Sancionatoria'}
                  </h3>
                  <p className="text-xs text-blue-200/70">Tribunal de Justicia Deportiva de Franz Tamayo</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveSanction} className="space-y-4">
              {/* Select Team & Player */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-blue-200 mb-1">Club Sancionado *</label>
                  <select
                    value={formTeamId}
                    onChange={(e) => {
                      setFormTeamId(e.target.value);
                      const tPlayers = players.filter((p) => p.teamId === e.target.value);
                      if (tPlayers[0]) setFormPlayerId(tPlayers[0].id);
                    }}
                    className="w-full bg-[#0a1628] border border-blue-500/30 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-red-400"
                  >
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-blue-200 mb-1">Futbolista Involucrado *</label>
                  <select
                    value={formPlayerId}
                    onChange={(e) => setFormPlayerId(e.target.value)}
                    className="w-full bg-[#0a1628] border border-blue-500/30 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-red-400"
                  >
                    {players
                      .filter((p) => p.teamId === formTeamId)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          #{p.number} {p.name} ({p.position})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Sanction Type & Matches Suspended */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-blue-200 mb-1">Tipo de Infracción</label>
                  <select
                    value={formSanctionType}
                    onChange={(e) => setFormSanctionType(e.target.value as SanctionType)}
                    className="w-full bg-[#0a1628] border border-blue-500/30 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-red-400"
                  >
                    <option value="roja_directa">🟥 Roja Directa</option>
                    <option value="amarillas_acumuladas">🟨 Acumulación de 3</option>
                    <option value="doble_amarilla">🟨🟥 Doble Amarilla</option>
                    <option value="conducta_antideportiva">⚠️ Conducta Antideportiva</option>
                    <option value="sancion_tribunal">⚖️ Dictamen TJD</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-blue-200 mb-1">Fechas Suspendido</label>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={formMatchesSuspended}
                    onChange={(e) => setFormMatchesSuspended(Number(e.target.value))}
                    className="w-full bg-[#0a1628] border border-blue-500/30 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-red-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-blue-200 mb-1">Multa (BOB)</label>
                  <input
                    type="number"
                    min={0}
                    step={10}
                    value={formFineBob}
                    onChange={(e) => setFormFineBob(Number(e.target.value))}
                    className="w-full bg-[#0a1628] border border-blue-500/30 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-red-400 font-mono"
                  />
                </div>
              </div>

              {/* Status & Fechas Cumplidas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-blue-200 mb-1">Estado de la Sanción</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as SanctionStatus)}
                    className="w-full bg-[#0a1628] border border-blue-500/30 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-red-400"
                  >
                    <option value="activa">🔴 Activa (Inhabilitado)</option>
                    <option value="cumplida">🟢 Cumplida (Habilitado)</option>
                    <option value="apelada">🟡 En Apelación</option>
                    <option value="indultada">🔵 Indultada</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-blue-200 mb-1">Fechas Cumplidas</label>
                  <input
                    type="number"
                    min={0}
                    max={formMatchesSuspended}
                    value={formMatchesServed}
                    onChange={(e) => setFormMatchesServed(Number(e.target.value))}
                    className="w-full bg-[#0a1628] border border-blue-500/30 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-red-400"
                  />
                </div>
              </div>

              {/* Infraction Details */}
              <div>
                <label className="block text-xs font-bold text-blue-200 mb-1">Fundamentación Jurídico-Deportiva</label>
                <textarea
                  rows={3}
                  required
                  value={formInfractionDetails}
                  onChange={(e) => setFormInfractionDetails(e.target.value)}
                  placeholder="Detalla los hechos informados por la terna arbitral y el artículo del reglamento aplicado..."
                  className="w-full bg-[#0a1628] border border-blue-500/30 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-red-400"
                />
              </div>

              {/* Signer */}
              <div>
                <label className="block text-xs font-bold text-blue-200 mb-1">Autoridad Firmante (TJD)</label>
                <input
                  type="text"
                  required
                  value={formSigner}
                  onChange={(e) => setFormSigner(e.target.value)}
                  className="w-full bg-[#0a1628] border border-blue-500/30 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-red-400"
                />
              </div>

              <div className="pt-3 border-t border-blue-500/20 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-black text-white bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  {editingSanction ? 'Guardar Cambios' : 'Emitir Resolución'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BOLETÍN OFICIAL DE RESOLUCIÓN MODAL */}
      {selectedBoletinSanction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto animate-in fade-in">
          <div className="bg-white text-slate-900 border border-slate-300 rounded-3xl w-full max-w-xl p-6 sm:p-8 shadow-2xl relative my-auto space-y-4">
            {/* Header Document */}
            <div className="border-b-2 border-red-600 pb-3 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-black uppercase tracking-wider text-red-600">
                  Tribunal de Justicia Deportiva · Franz Tamayo
                </div>
                <h3 className="text-base sm:text-lg font-black font-syne text-slate-900">
                  RESOLUCIÓN OFICIAL {selectedBoletinSanction.code}
                </h3>
                <p className="text-xs text-slate-500">
                  Asociación Provincial de Fútbol de Apolo · La Paz, Bolivia
                </p>
              </div>

              <div className="text-right">
                <span className="text-xs font-bold text-slate-600 block">
                  Fecha: {selectedBoletinSanction.resolutionDate}
                </span>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-red-100 text-red-800">
                  {selectedBoletinSanction.status.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Content */}
            <div className="space-y-3 text-xs text-slate-700">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="font-bold text-slate-500 block">Futbolista Sancionado:</span>
                    <span className="font-black text-slate-900 text-sm">
                      {selectedBoletinSanction.playerName} (#{selectedBoletinSanction.playerNumber})
                    </span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-500 block">Club Afiliado:</span>
                    <span className="font-black text-slate-900 text-sm">{selectedBoletinSanction.teamName}</span>
                  </div>
                </div>
              </div>

              <div>
                <span className="font-bold text-slate-800 block text-[11px] mb-1">I. Considerandos y Hechos:</span>
                <p className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-slate-600 italic">
                  "{selectedBoletinSanction.infractionDetails}"
                </p>
              </div>

              <div className="border-l-4 border-red-500 pl-3 py-1">
                <span className="font-bold text-slate-800 block text-[11px]">II. Disposición Sancionatoria:</span>
                <p className="font-bold text-red-900 mt-1">
                  Se suspende al futbolista por el término de {selectedBoletinSanction.matchesSuspended} fecha{selectedBoletinSanction.matchesSuspended > 1 ? 's' : ''} de inhabilitación oficial en todo torneo avalado.
                </p>
                {selectedBoletinSanction.financialFineBob ? (
                  <p className="text-slate-600 text-[11px] mt-0.5">
                    Arancel pecuniario reglamentario: {selectedBoletinSanction.financialFineBob} Bolivianos (BOB).
                  </p>
                ) : null}
              </div>
            </div>

            {/* Signature Box */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-500 block">Firma y Rúbrica:</span>
                <span className="font-bold text-xs text-slate-900">{selectedBoletinSanction.tribunalSigner}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const text = `⚖️ *RESOLUCIÓN TRIBUNAL DE JUSTICIA DEPORTIVA FRANZ TAMAYO*\n📄 Código: ${selectedBoletinSanction.code}\n⚽ Jugador: ${selectedBoletinSanction.playerName} (${selectedBoletinSanction.teamName})\n🛑 Sanción: ${selectedBoletinSanction.matchesSuspended} fecha(s)\n📌 Causa: ${selectedBoletinSanction.infractionDetails}\n✍️ Por: ${selectedBoletinSanction.tribunalSigner}`;
                    navigator.clipboard.writeText(text);
                    showToast('Boletín disciplinario copiado al portapapeles', 'success');
                  }}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-900 text-white hover:bg-blue-800 transition-all flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px]">content_copy</span>
                  <span>Copiar</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedBoletinSanction(null)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-200 text-slate-800 hover:bg-slate-300 transition-all cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

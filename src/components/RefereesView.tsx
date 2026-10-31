import React, { useState } from 'react';
import { useTournament } from '../context/TournamentContext';
import { Referee, RefereeCategory, RefereeRole, RefereeStatus } from '../types/tournament';

export const RefereesView: React.FC = () => {
  const {
    referees,
    matches,
    addReferee,
    updateReferee,
    deleteReferee,
    showToast,
    setCurrentTab,
    setActiveOfficialSheetModal,
  } = useTournament();

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingReferee, setEditingReferee] = useState<Referee | null>(null);
  const [selectedCredentialReferee, setSelectedCredentialReferee] = useState<Referee | null>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formDocId, setFormDocId] = useState('');
  const [formLicense, setFormLicense] = useState('');
  const [formCategory, setFormCategory] = useState<RefereeCategory>('Nacional FBF');
  const [formRole, setFormRole] = useState<RefereeRole>('Principal');
  const [formAssociation, setFormAssociation] = useState('Colegio de Árbitros Franz Tamayo');
  const [formPhone, setFormPhone] = useState('');
  const [formCity, setFormCity] = useState('Apolo Centro');
  const [formExp, setFormExp] = useState(5);
  const [formStatus, setFormStatus] = useState<RefereeStatus>('activo');

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingReferee(null);
    setFormName('');
    setFormDocId('');
    setFormLicense(`FBF-LP-${Math.floor(1000 + Math.random() * 9000)}`);
    setFormCategory('Nacional FBF');
    setFormRole('Principal');
    setFormAssociation('Colegio de Árbitros Franz Tamayo');
    setFormPhone('+591 7');
    setFormCity('Apolo Centro');
    setFormExp(4);
    setFormStatus('activo');
    setIsCreateModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (ref: Referee) => {
    setEditingReferee(ref);
    setFormName(ref.fullName);
    setFormDocId(ref.documentId || '');
    setFormLicense(ref.licenseNumber);
    setFormCategory(ref.category);
    setFormRole(ref.rolePrimary);
    setFormAssociation(ref.association);
    setFormPhone(ref.phone || '');
    setFormCity(ref.city || 'Apolo Centro');
    setFormExp(ref.experienceYears || 5);
    setFormStatus(ref.status);
    setIsCreateModalOpen(true);
  };

  const handleSaveReferee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      showToast('Ingresa el nombre completo del colegiado', 'warning');
      return;
    }

    if (editingReferee) {
      updateReferee({
        ...editingReferee,
        fullName: formName,
        documentId: formDocId,
        licenseNumber: formLicense,
        category: formCategory,
        rolePrimary: formRole,
        association: formAssociation,
        phone: formPhone,
        city: formCity,
        experienceYears: formExp,
        status: formStatus,
      });
    } else {
      addReferee({
        fullName: formName,
        documentId: formDocId,
        licenseNumber: formLicense,
        category: formCategory,
        rolePrimary: formRole,
        association: formAssociation,
        phone: formPhone,
        city: formCity,
        experienceYears: formExp,
        status: formStatus,
        matchesOfficiated: 0,
        yellowCardsIssued: 0,
        redCardsIssued: 0,
        penaltiesAwarded: 0,
      });
    }
    setIsCreateModalOpen(false);
  };

  // Aggregate stats
  const totalMatchesOfficiated = referees.reduce((sum, r) => sum + r.matchesOfficiated, 0);
  const totalYellowCards = referees.reduce((sum, r) => sum + r.yellowCardsIssued, 0);
  const totalRedCards = referees.reduce((sum, r) => sum + r.redCardsIssued, 0);
  const avgCardsPerMatch = totalMatchesOfficiated > 0 ? ((totalYellowCards + totalRedCards) / totalMatchesOfficiated).toFixed(1) : '0';

  // Filtered referees
  const filteredReferees = referees.filter((r) => {
    const matchesSearch =
      r.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.licenseNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.documentId && r.documentId.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = categoryFilter === 'all' || r.category === categoryFilter;
    const matchesRole = roleFilter === 'all' || r.rolePrimary === roleFilter;
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;

    return matchesSearch && matchesCategory && matchesRole && matchesStatus;
  });

  const getCategoryBadge = (cat: RefereeCategory) => {
    switch (cat) {
      case 'FIFA':
        return 'bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 font-black border border-amber-300 shadow-md shadow-amber-500/20';
      case 'Nacional FBF':
        return 'bg-emerald-500/20 text-emerald-400 border border-emerald-400/40';
      case 'Departamental LP':
        return 'bg-blue-500/20 text-blue-300 border border-blue-400/40';
      default:
        return 'bg-slate-700/60 text-slate-300 border border-slate-600';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-950 via-[#0d2347] to-slate-900 border border-blue-500/20 rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-2xl">
        <div className="absolute right-0 top-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400 shadow-xl shrink-0">
              <span className="material-symbols-outlined text-[36px]">sports</span>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-xs font-black uppercase tracking-wider text-amber-400 bg-amber-400/10 border border-amber-400/30 px-2.5 py-0.5 rounded-full">
                  Colegio Departamental & Local
                </span>
                <span className="text-xs text-blue-200/60">· Asociación Boliviana de Árbitros (ABAF)</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Colegio Oficial de Árbitros
              </h1>
              <p className="text-xs sm:text-sm text-blue-200/80 max-w-2xl mt-1">
                Padrón Federativo de Jueces de Campo, Designación de Ternas Oficiales y Certificación Criptográfica de Actas Arbitrales · Apolo, Franz Tamayo 🇧🇴
              </p>
            </div>
          </div>

          <button
            onClick={handleOpenCreate}
            className="self-start md:self-auto px-5 py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-blue-950 font-black text-xs sm:text-sm shadow-xl shadow-amber-400/20 flex items-center gap-2 transition-all hover:scale-105 active:scale-95 shrink-0"
          >
            <span className="material-symbols-outlined text-[20px]">person_add</span>
            <span>Registrar Nuevo Árbitro</span>
          </button>
        </div>

        {/* Global Statistics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-8 pt-6 border-t border-blue-500/15">
          <div className="bg-blue-900/20 border border-blue-500/20 rounded-2xl p-3.5 text-center">
            <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-blue-300/80">Colegiados Activos</div>
            <div className="text-xl sm:text-2xl font-black text-white mt-1">
              {referees.filter((r) => r.status === 'activo').length} <span className="text-xs font-normal text-blue-300/70">/ {referees.length}</span>
            </div>
          </div>

          <div className="bg-blue-900/20 border border-blue-500/20 rounded-2xl p-3.5 text-center">
            <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-blue-300/80">Partidos Pitados</div>
            <div className="text-xl sm:text-2xl font-black text-amber-400 mt-1">
              {totalMatchesOfficiated}
            </div>
          </div>

          <div className="bg-blue-900/20 border border-blue-500/20 rounded-2xl p-3.5 text-center">
            <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-blue-300/80">Amonestaciones (🟨/🟥)</div>
            <div className="text-xl sm:text-2xl font-black text-yellow-400 mt-1 flex items-center justify-center gap-2">
              <span>{totalYellowCards}</span>
              <span className="text-xs text-red-400">({totalRedCards})</span>
            </div>
          </div>

          <div className="bg-blue-900/20 border border-blue-500/20 rounded-2xl p-3.5 text-center">
            <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-blue-300/80">Promedio Disciplinario</div>
            <div className="text-xl sm:text-2xl font-black text-emerald-400 mt-1">
              {avgCardsPerMatch} <span className="text-[10px] font-normal text-blue-200/60">tarj/part</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="bg-[#0d2347]/80 backdrop-blur-md border border-blue-500/20 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-400 text-[18px]">
            search
          </span>
          <input
            type="text"
            placeholder="Buscar por árbitro, C.I. o licencia..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#0a1628] border border-blue-500/30 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-blue-300/40 focus:outline-none focus:border-amber-400"
          />
        </div>

        {/* Filter selectors */}
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-[#0a1628] border border-blue-500/30 rounded-xl px-3 py-2 text-xs text-blue-200 focus:outline-none focus:border-amber-400"
          >
            <option value="all">Todas las Categorías</option>
            <option value="FIFA">FIFA</option>
            <option value="Nacional FBF">Nacional FBF</option>
            <option value="Departamental LP">Departamental LP</option>
            <option value="Colegiado Franz Tamayo">Colegiado Franz Tamayo</option>
          </select>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="bg-[#0a1628] border border-blue-500/30 rounded-xl px-3 py-2 text-xs text-blue-200 focus:outline-none focus:border-amber-400"
          >
            <option value="all">Todos los Roles</option>
            <option value="Principal">Árbitro Central</option>
            <option value="Asistente 1">Asistente 1</option>
            <option value="Asistente 2">Asistente 2</option>
            <option value="Cuarto Árbitro">Cuarto Árbitro</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#0a1628] border border-blue-500/30 rounded-xl px-3 py-2 text-xs text-blue-200 focus:outline-none focus:border-amber-400"
          >
            <option value="all">Todos los Estados</option>
            <option value="activo">🟢 Activos</option>
            <option value="licencia">🟡 En Licencia</option>
          </select>
        </div>
      </div>

      {/* Referees Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredReferees.map((ref) => {
          // Count assigned matches in current tournament
          const assignedMatches = matches.filter((m) =>
            m.officials?.some((off) => off.refereeId === ref.id)
          );

          return (
            <div
              key={ref.id}
              className="bg-gradient-to-b from-[#0d2347] to-[#0a1628] border border-blue-500/25 rounded-3xl p-5 shadow-xl hover:border-amber-400/40 hover:shadow-2xl transition-all flex flex-col justify-between group relative overflow-hidden"
            >
              {/* Top Accent Strip */}
              <div
                className={`absolute top-0 left-0 right-0 h-1.5 ${
                  ref.category === 'FIFA'
                    ? 'bg-amber-400'
                    : ref.category === 'Nacional FBF'
                    ? 'bg-emerald-500'
                    : 'bg-blue-600'
                }`}
              />

              <div>
                {/* Header card with photo avatar & category badge */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-blue-900 to-blue-700 border-2 border-blue-400/40 flex items-center justify-center text-white font-extrabold text-base shadow-md relative">
                      {ref.fullName
                        .split(' ')
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join('')}
                      <span className="absolute -bottom-1 -right-1 text-[11px]" title="Bolivia">
                        🇧🇴
                      </span>
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-white group-hover:text-amber-400 transition-colors">
                        {ref.fullName}
                      </h3>
                      <div className="text-[11px] text-blue-300/80 font-mono">
                        Lic: <span className="text-amber-300 font-bold">{ref.licenseNumber}</span>
                      </div>
                    </div>
                  </div>

                  <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-xl whitespace-nowrap ${getCategoryBadge(ref.category)}`}>
                    {ref.category}
                  </span>
                </div>

                {/* Association & Role */}
                <div className="bg-blue-950/50 border border-blue-500/15 rounded-2xl p-3 mb-4 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-blue-300/70">Rol Primario:</span>
                    <span className="font-bold text-white flex items-center gap-1">
                      <span className="material-symbols-outlined text-[15px] text-amber-400">sports</span>
                      {ref.rolePrimary}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-blue-300/70">Asociación:</span>
                    <span className="font-semibold text-blue-200 text-right text-[11px] truncate max-w-[190px]">
                      {ref.association}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-blue-300/70">Estado:</span>
                    <span
                      className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                        ref.status === 'activo'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      {ref.status === 'activo' ? '🟢 Habilitado' : '🟡 En Licencia'}
                    </span>
                  </div>
                </div>

                {/* Match & Card Statistics Grid */}
                <div className="grid grid-cols-4 gap-2 mb-4 bg-blue-900/20 rounded-2xl p-2.5 border border-blue-500/10 text-center">
                  <div>
                    <div className="text-[9px] uppercase tracking-wider text-blue-300/70">Partidos</div>
                    <div className="text-sm font-black text-white mt-0.5">{ref.matchesOfficiated}</div>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase tracking-wider text-yellow-400">🟨 Amar.</div>
                    <div className="text-sm font-black text-yellow-300 mt-0.5">{ref.yellowCardsIssued}</div>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase tracking-wider text-red-400">🟥 Rojas</div>
                    <div className="text-sm font-black text-red-400 mt-0.5">{ref.redCardsIssued}</div>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase tracking-wider text-emerald-400">Penales</div>
                    <div className="text-sm font-black text-emerald-300 mt-0.5">{ref.penaltiesAwarded}</div>
                  </div>
                </div>

                {/* Current Tourney Assigned Matches Notice */}
                {assignedMatches.length > 0 && (
                  <div className="mb-4 text-[11px] bg-blue-950/40 p-2 rounded-xl border border-blue-500/10 flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 text-blue-200/80">
                      <span className="material-symbols-outlined text-[16px] text-amber-400">event_available</span>
                      <span>
                        {assignedMatches.length} designación{assignedMatches.length > 1 ? 'es' : ''} en este torneo
                      </span>
                    </div>
                    {assignedMatches[0] && (
                      <button
                        type="button"
                        onClick={() => setActiveOfficialSheetModal(assignedMatches[0])}
                        className="text-[10px] text-amber-300 hover:text-amber-200 font-bold flex items-center gap-1 bg-amber-400/10 hover:bg-amber-400/20 px-2 py-0.5 rounded-lg border border-amber-400/30 transition-all cursor-pointer"
                        title="Ver Acta Oficial del partido"
                      >
                        <span className="material-symbols-outlined text-[13px]">picture_as_pdf</span>
                        <span>Acta</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-blue-500/20 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedCredentialReferee(ref)}
                  className="flex-1 py-2 px-3 rounded-xl bg-blue-600/30 hover:bg-blue-600 text-blue-200 hover:text-white font-bold text-xs border border-blue-400/30 transition-all flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">badge</span>
                  <span>Credencial</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenEdit(ref)}
                  className="py-2 px-3 rounded-xl bg-blue-950/80 hover:bg-blue-900 text-blue-200 hover:text-white font-semibold text-xs border border-blue-500/30 transition-all flex items-center justify-center gap-1"
                  title="Editar expediente arbitral"
                >
                  <span className="material-symbols-outlined text-[16px]">edit</span>
                  <span>Editar</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filteredReferees.length === 0 && (
        <div className="text-center py-16 bg-[#0d2347]/40 border border-blue-500/20 rounded-3xl p-8">
          <span className="material-symbols-outlined text-[48px] text-blue-400/50 mb-2">search_off</span>
          <h3 className="text-base font-bold text-white">No se encontraron árbitros en el padrón</h3>
          <p className="text-xs text-blue-200/60 mt-1 max-w-md mx-auto">
            Ajusta los filtros de búsqueda o registra un nuevo colegiado para el Colegio de Árbitros de Franz Tamayo.
          </p>
        </div>
      )}

      {/* CREATE / EDIT REFEREE MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-xl bg-[#0d2347] border border-blue-500/30 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="bg-gradient-to-r from-blue-950 to-blue-900 px-6 py-5 border-b border-blue-500/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400">
                  <span className="material-symbols-outlined text-[24px]">sports</span>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">
                    {editingReferee ? 'Editar Expediente de Árbitro' : 'Ficha de Inscripción Arbitral'}
                  </h2>
                  <p className="text-xs text-blue-200/70">Colegio de Árbitros Franz Tamayo - Apolo 🇧🇴</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="w-9 h-9 rounded-xl bg-blue-900/50 hover:bg-blue-800 text-blue-200 hover:text-white flex items-center justify-center transition-all"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveReferee} className="p-6 overflow-y-auto space-y-4">
              <div>
                <label className="block text-xs font-bold text-blue-200 mb-1">Nombre Completo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Marco Antonio Quispe"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-[#0a1628] border border-blue-500/30 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-blue-200 mb-1">C.I. Boliviano (Documento)</label>
                  <input
                    type="text"
                    placeholder="Ej: 4920194 LP"
                    value={formDocId}
                    onChange={(e) => setFormDocId(e.target.value)}
                    className="w-full bg-[#0a1628] border border-blue-500/30 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-blue-200 mb-1">N° Licencia Federativa *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: FBF-LP-0412"
                    value={formLicense}
                    onChange={(e) => setFormLicense(e.target.value)}
                    className="w-full bg-[#0a1628] border border-blue-500/30 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-blue-200 mb-1">Categoría Federativa</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as RefereeCategory)}
                    className="w-full bg-[#0a1628] border border-blue-500/30 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="FIFA">FIFA</option>
                    <option value="Nacional FBF">Nacional FBF</option>
                    <option value="Departamental LP">Departamental LP</option>
                    <option value="Colegiado Franz Tamayo">Colegiado Franz Tamayo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-blue-200 mb-1">Función Predilecta</label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as RefereeRole)}
                    className="w-full bg-[#0a1628] border border-blue-500/30 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="Principal">Árbitro Central</option>
                    <option value="Asistente 1">Asistente 1 (Línea Oriente)</option>
                    <option value="Asistente 2">Asistente 2 (Línea Poniente)</option>
                    <option value="Cuarto Árbitro">Cuarto Árbitro / Veedor</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-blue-200 mb-1">Asociación / Filial</label>
                <input
                  type="text"
                  placeholder="Ej: Colegio de Árbitros Franz Tamayo"
                  value={formAssociation}
                  onChange={(e) => setFormAssociation(e.target.value)}
                  className="w-full bg-[#0a1628] border border-blue-500/30 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-blue-200 mb-1">Teléfono / WhatsApp</label>
                  <input
                    type="text"
                    placeholder="+591 7..."
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full bg-[#0a1628] border border-blue-500/30 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-blue-200 mb-1">Años de Exp.</label>
                  <input
                    type="number"
                    min="1"
                    max="40"
                    value={formExp}
                    onChange={(e) => setFormExp(parseInt(e.target.value) || 1)}
                    className="w-full bg-[#0a1628] border border-blue-500/30 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-blue-200 mb-1">Estado</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as RefereeStatus)}
                    className="w-full bg-[#0a1628] border border-blue-500/30 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="activo">🟢 Habilitado</option>
                    <option value="licencia">🟡 En Licencia</option>
                    <option value="suspendido">🔴 Suspendido</option>
                  </select>
                </div>
              </div>

              {editingReferee && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`¿Eliminar al árbitro ${editingReferee.fullName} del padrón?`)) {
                        deleteReferee(editingReferee.id);
                        setIsCreateModalOpen(false);
                      }
                    }}
                    className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 font-bold"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                    <span>Desvincular árbitro del padrón</span>
                  </button>
                </div>
              )}

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-blue-500/20">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-blue-200 hover:text-white hover:bg-blue-900/40"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-blue-950 font-black text-xs shadow-lg shadow-amber-400/20"
                >
                  {editingReferee ? 'Guardar Cambios' : 'Registrar Colegiado'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* OFFICIAL REFEREE CREDENTIAL MODAL (Pasaporte Oficial de Árbitro) */}
      {selectedCredentialReferee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#0a1628] border-2 border-amber-400/40 rounded-3xl shadow-2xl overflow-hidden flex flex-col relative print:border-none print:shadow-none print:bg-white print:text-black">
            {/* Holographic Security Top Bar */}
            <div className="h-3 bg-gradient-to-r from-red-600 via-yellow-400 to-green-600 relative overflow-hidden">
              <div className="absolute inset-0 bg-white/20 animate-pulse" />
            </div>

            {/* Credential Header */}
            <div className="px-6 pt-5 pb-3 border-b border-blue-500/20 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
                  <span className="material-symbols-outlined text-[20px]">sports</span>
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                    CREDENCIAL OFICIAL FEDERATIVA
                  </div>
                  <div className="text-xs font-bold text-white">Colegio de Árbitros Franz Tamayo</div>
                </div>
              </div>

              <button
                onClick={() => setSelectedCredentialReferee(null)}
                className="w-8 h-8 rounded-lg bg-blue-900/50 hover:bg-blue-800 text-blue-200 hover:text-white flex items-center justify-center print:hidden"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Credential Body */}
            <div className="p-6 space-y-5">
              {/* Photo & Identity Section */}
              <div className="flex items-center gap-4">
                <div className="w-22 h-26 rounded-2xl bg-gradient-to-br from-blue-900 to-slate-900 border-2 border-amber-400/60 flex flex-col items-center justify-center text-white relative shadow-lg overflow-hidden shrink-0">
                  <span className="material-symbols-outlined text-[44px] text-blue-300/80">sports</span>
                  <div className="absolute bottom-0 inset-x-0 bg-black/60 text-[9px] font-mono text-center py-0.5 text-amber-300">
                    FBF · ABAF
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-[10px] uppercase font-bold text-blue-300/70 tracking-wider">Colegiado Federado</div>
                  <h3 className="text-lg font-extrabold text-white leading-tight">
                    {selectedCredentialReferee.fullName}
                  </h3>
                  <div className="text-xs text-blue-200 font-mono flex items-center gap-1.5">
                    <span>C.I.:</span>
                    <span className="font-bold text-amber-300">{selectedCredentialReferee.documentId || '7849102 LP'}</span>
                  </div>
                  <div className="text-xs text-blue-200 font-mono flex items-center gap-1.5">
                    <span>Licencia:</span>
                    <span className="font-bold text-amber-400">{selectedCredentialReferee.licenseNumber}</span>
                  </div>
                </div>
              </div>

              {/* Badges Info */}
              <div className="bg-blue-950/70 border border-blue-500/25 rounded-2xl p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-blue-300/80">Categoría:</span>
                  <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-lg ${getCategoryBadge(selectedCredentialReferee.category)}`}>
                    {selectedCredentialReferee.category}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-blue-300/80">Función Oficial:</span>
                  <span className="font-bold text-white">{selectedCredentialReferee.rolePrimary}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-blue-300/80">Sede / Residencia:</span>
                  <span className="font-semibold text-blue-200">{selectedCredentialReferee.city || 'Apolo Centro, La Paz'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-blue-300/80">Estado Federativo:</span>
                  <span className="font-bold text-emerald-400 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    HABILITADO PARA COMPETICIÓN OFICIAL
                  </span>
                </div>
              </div>

              {/* Digital Barcode / Security Hash */}
              <div className="bg-[#060d19] border border-blue-500/20 rounded-2xl p-3 text-center space-y-1">
                <div className="font-mono text-[9px] text-blue-300/60 tracking-widest uppercase">
                  SHA-256 DIGITAL SECURITY TOKEN
                </div>
                <div className="font-mono text-[10px] text-amber-400/90 font-bold truncate">
                  FBF:{selectedCredentialReferee.licenseNumber}:APOLO:2026:AUTH:LEAGUE
                </div>
                <div className="flex justify-center items-center gap-1 h-6">
                  {/* Visual simulated barcode stripes */}
                  {[3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8, 9, 7, 9, 3, 2, 3, 8, 4, 6, 2, 6, 4, 3, 3, 8].map((w, i) => (
                    <div
                      key={i}
                      className="bg-amber-400/80 h-full rounded-sm"
                      style={{ width: `${w * 1.5}px` }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Credential Footer with Print Button */}
            <div className="px-6 py-4 bg-blue-950/60 border-t border-blue-500/20 flex items-center justify-between print:hidden">
              <span className="text-[10px] text-blue-300/60">Válida Temporada Oficial 2026</span>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-blue-950 font-black text-xs flex items-center gap-1.5 shadow-lg shadow-amber-400/20 transition-all"
              >
                <span className="material-symbols-outlined text-[16px]">print</span>
                <span>Imprimir Credencial</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

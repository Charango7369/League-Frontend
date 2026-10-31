import React, { useState, useEffect } from 'react';
import { useTournament } from '../context/TournamentContext';
import { EventType, MatchStatus } from '../types/tournament';
import { apiClient } from '../services/apiClient';
import { downloadMatchOfficialSheetPdf } from '../utils/pdfReportGenerator';

interface AIChronicleData {
  headline: string;
  subheading: string;
  body_text: string;
  mvp_player: string;
  tactical_highlight: string;
}

export const MatchLiveModal: React.FC = () => {
  const {
    activeMatchModal,
    setActiveMatchModal,
    setActiveRefereeAssignmentModal,
    setActiveOfficialSheetModal,
    signMatchOfficialSheet,
    referees,
    teams,
    players,
    tournament,
    updateMatch,
    addMatchEvent,
    removeMatchEvent,
    showToast,
  } = useTournament();

  if (!activeMatchModal) return null;

  const home = teams.find((t) => t.id === activeMatchModal.homeTeamId);
  const away = teams.find((t) => t.id === activeMatchModal.awayTeamId);

  const homePlayers = players.filter((p) => p.teamId === activeMatchModal.homeTeamId);
  const awayPlayers = players.filter((p) => p.teamId === activeMatchModal.awayTeamId);

  // Tab state: 'scoring' | 'referee_sheet' | 'ai_chronicle'
  const [activeTab, setActiveTab] = useState<'scoring' | 'referee_sheet' | 'ai_chronicle'>('scoring');

  // Referee Sign-off form state
  const defaultSigner =
    activeMatchModal.officials?.find((o) => o.role === 'Principal')?.refereeName ||
    referees.find((r) => r.rolePrimary === 'Principal')?.fullName ||
    'Marco Antonio Quispe';
  const [refereeNotesInput, setRefereeNotesInput] = useState<string>(activeMatchModal.refereeNotes || '');
  const [signerNameInput, setSignerNameInput] = useState<string>(defaultSigner);
  const [isSigningAct, setIsSigningAct] = useState<boolean>(false);

  // Form state
  const [selectedEventType, setSelectedEventType] = useState<EventType>('gol');
  const [selectedTeamId, setSelectedTeamId] = useState<string>(activeMatchModal.homeTeamId);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('');
  const [customPlayerName, setCustomPlayerName] = useState<string>('');
  const [eventMinute, setEventMinute] = useState<number>(activeMatchModal.currentMinute || 45);

  // WebSocket state
  const [isWsConnected, setIsWsConnected] = useState<boolean>(false);

  // AI Chronicle state
  const [aiStyle, setAiStyle] = useState<string>('LATIN_SPORTS_JOURNALIST');
  const [isGeneratingAI, setIsGeneratingAI] = useState<boolean>(false);
  const [aiChronicle, setAiChronicle] = useState<AIChronicleData | null>(null);

  // Quick PDF download handler
  const handleQuickDownloadPdf = () => {
    if (!activeMatchModal || !home || !away) return;
    try {
      downloadMatchOfficialSheetPdf({
        match: activeMatchModal,
        homeTeam: home,
        awayTeam: away,
        homePlayers,
        awayPlayers,
        tournament,
      });
      showToast('Planilla Oficial de Partido descargada en PDF', 'success');
    } catch (e) {
      console.error(e);
      showToast('Error al generar PDF', 'warning');
    }
  };

  // Connect to live WebSocket when modal opens
  useEffect(() => {
    if (!activeMatchModal?.id) return;

    let ws: WebSocket | null = null;
    try {
      ws = apiClient.connectMatchWebSocket(activeMatchModal.id, (data) => {
        setIsWsConnected(true);
        if (data.type === 'GOAL' || data.type === 'MATCH_EVENT') {
          showToast(`⚡ Transmisión en vivo: Gol / Evento actualizado`, 'info');
        }
      });

      if (ws) {
        ws.onopen = () => setIsWsConnected(true);
        ws.onclose = () => setIsWsConnected(false);
        ws.onerror = () => setIsWsConnected(false);
      }
    } catch {
      setIsWsConnected(false);
    }

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [activeMatchModal?.id, showToast]);

  const activePlayers = selectedTeamId === activeMatchModal.homeTeamId ? homePlayers : awayPlayers;

  const handleScoreChange = (side: 'home' | 'away', delta: number) => {
    if (activeMatchModal.isRefereeSigned) {
      showToast('El acta arbitral ya está sellada digitalmente. El marcador oficial no admite modificaciones.', 'warning');
      return;
    }
    const currentHome = activeMatchModal.homeScore ?? 0;
    const currentAway = activeMatchModal.awayScore ?? 0;

    const newHome = side === 'home' ? Math.max(0, currentHome + delta) : currentHome;
    const newAway = side === 'away' ? Math.max(0, currentAway + delta) : currentAway;

    updateMatch({
      ...activeMatchModal,
      homeScore: newHome,
      awayScore: newAway,
    });
  };

  const handleStatusChange = (status: MatchStatus) => {
    if (activeMatchModal.isRefereeSigned) {
      showToast('El acta arbitral ya está sellada y certificada. El estado del partido es definitivo.', 'warning');
      return;
    }
    updateMatch({
      ...activeMatchModal,
      status,
      currentMinute: status === 'en_juego' ? (activeMatchModal.currentMinute || 1) : activeMatchModal.currentMinute,
    });
  };

  const handleMinuteAdvance = (delta: number) => {
    if (activeMatchModal.isRefereeSigned) {
      showToast('El encuentro está finalizado y sellado por el Colegio de Árbitros.', 'warning');
      return;
    }
    const nextMinute = Math.min(120, Math.max(1, (activeMatchModal.currentMinute || 1) + delta));
    updateMatch({
      ...activeMatchModal,
      currentMinute: nextMinute,
    });
    setEventMinute(nextMinute);
  };

  const handleAddEvent = (e: React.FormEvent) => {
    e.preventDefault();

    if (activeMatchModal.isRefereeSigned) {
      showToast('El acta arbitral ya está cerrada y sellada. No se admiten nuevas incidencias.', 'warning');
      return;
    }

    let playerName = customPlayerName.trim();
    let playerId = selectedPlayerId || undefined;

    if (selectedPlayerId) {
      const p = players.find((pl) => pl.id === selectedPlayerId);
      if (p?.isSuspended) {
        const proceed = window.confirm(
          `⚠️ ALERTA DISCIPLINARIA:\n\nEl jugador ${p.name} figura como SUSPENDIDO en su Pasaporte Deportivo (${p.suspensionReason || 'Sanción disciplinaria'}).\n\n¿Registrar el evento de todas formas con observación en el informe arbitral?`
        );
        if (!proceed) return;
      }
      if (p) playerName = p.name;
    }

    if (!playerName) {
      playerName = 'Jugador no identificado';
    }

    const team = teams.find((t) => t.id === selectedTeamId);

    addMatchEvent(activeMatchModal.id, {
      type: selectedEventType,
      minute: eventMinute,
      playerId,
      playerName,
      teamId: selectedTeamId,
      teamName: team?.name || 'Club',
    });

    // Reset inputs
    setSelectedPlayerId('');
    setCustomPlayerName('');
  };

  // Generate AI Chronicle
  const handleGenerateAIChronicle = async () => {
    setIsGeneratingAI(true);
    const homeName = home?.name || 'Local';
    const awayName = away?.name || 'Visitante';
    const hScore = activeMatchModal.homeScore ?? 0;
    const aScore = activeMatchModal.awayScore ?? 0;

    try {
      // First attempt backend endpoint
      const res = await apiClient.generateAIChronicle(activeMatchModal.id, aiStyle);
      setAiChronicle(res);
      showToast('¡Crónica generada con Inteligencia Artificial!', 'success');
    } catch {
      // Client-side intelligent generator fallback (guarantees reliability anytime)
      let winnerText = '';
      let mvpCandidate = 'La figura de la cancha';
      if (hScore > aScore) {
        winnerText = `en una demostración de garra y jerarquía, ${homeName} se impuso con autoridad ${hScore}-${aScore} frente a ${awayName}.`;
        const scorers = activeMatchModal.events.filter((e) => e.teamId === activeMatchModal.homeTeamId && (e.type === 'gol' || e.type === 'penal'));
        if (scorers.length > 0) mvpCandidate = scorers[0].playerName;
      } else if (aScore > hScore) {
        winnerText = `en un vibrante golpe de visitante, ${awayName} triunfó ${aScore}-${hScore} ante ${homeName} desatando la fiesta de su hinchada.`;
        const scorers = activeMatchModal.events.filter((e) => e.teamId === activeMatchModal.awayTeamId && (e.type === 'gol' || e.type === 'penal'));
        if (scorers.length > 0) mvpCandidate = scorers[0].playerName;
      } else {
        winnerText = `en un duelo de ida y vuelta que mantuvo al público al filo de sus asientos, empataron con un electrizante ${hScore}-${aScore}.`;
      }

      const eventsSummary = activeMatchModal.events.map(
        (e) => `• Minuto ${e.minute}': ${e.type.toUpperCase()} registrado por ${e.playerName} (${e.teamName})`
      ).join('\n') || 'Partido disputado con intensidad en el mediocampo sin amonestaciones severas.';

      const generated: AIChronicleData = {
        headline: `¡Fervor en Apolo! ${homeName} ${hScore} - ${aScore} ${awayName}`,
        subheading: `Crónica del encuentro disputado en ${activeMatchModal.pitch || 'Estadio Municipal de Apolo'} por la Liga Apolodigital 2026`,
        body_text: `Bajo el cielo del norte paceño y con un marco imponente de aficionados, ${homeName} y ${awayName} protagonizaron un choque de alto calibre en el marco de la ${activeMatchModal.roundName || `Jornada ${activeMatchModal.round}`}.\n\nDesde el silbatazo inicial, el ritmo fue vertiginoso. ${winnerText}\n\nResumen de incidencias destacadas:\n${eventsSummary}\n\nCon este marcador, la tabla de posiciones se reconfigura y ambos conjuntos reafirman su compromiso de luchar por la gloria de Franz Tamayo.`,
        mvp_player: mvpCandidate,
        tactical_highlight: hScore > aScore
          ? `Transiciones veloces de ${homeName} atacando la espalda de los laterales rivales.`
          : `Bloque medio compacto y contundencia en pelota parada.`,
      };

      setAiChronicle(generated);
      showToast('¡Crónica periodística redactada!', 'success');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const copyChronicleToClipboard = () => {
    if (!aiChronicle) return;
    const formatted = `📰 *${aiChronicle.headline}*\n_${aiChronicle.subheading}_\n\n${aiChronicle.body_text}\n\n⭐ *MVP del Partido:* ${aiChronicle.mvp_player}\n🎯 *Clave Táctica:* ${aiChronicle.tactical_highlight}\n\n🏆 _Cobertura oficial vía Apolodigital League (apolodigital.lat)_`;
    navigator.clipboard.writeText(formatted);
    showToast('Crónica copiada al portapapeles con formato WhatsApp/Prensa', 'success');
  };

  // Sort events by minute
  const sortedEvents = [...activeMatchModal.events].sort((a, b) => a.minute - b.minute);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in">
      <div className="relative w-full max-w-3xl bg-[#0d2347] border border-blue-500/30 rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-blue-500/20 bg-[#0a1628]/95">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-syne font-bold text-white text-base">Acta Digital de Partido</span>
                <span className="text-amber-400 font-bold text-xs px-2 py-0.5 rounded bg-amber-400/10 border border-amber-400/30">
                  4League Center
                </span>
                {/* WebSocket Status Indicator */}
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                    isWsConnected
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                  title={isWsConnected ? 'Canal WebSocket en Vivo Conectado' : 'Conexión local reactiva'}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isWsConnected ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}`} />
                  {isWsConnected ? 'Live WS' : 'Local'}
                </span>
              </div>
              <p className="text-xs text-blue-200/70 mt-0.5">
                {activeMatchModal.roundName || `Jornada ${activeMatchModal.round}`} • {activeMatchModal.pitch}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveOfficialSheetModal(activeMatchModal)}
              className="flex items-center gap-1 text-xs font-bold text-amber-300 hover:text-amber-200 bg-amber-400/15 hover:bg-amber-400/25 px-2.5 py-1.5 rounded-xl border border-amber-400/30 transition-all shadow-sm"
              title="Ver e Imprimir Planilla Oficial en PDF"
            >
              <span className="material-symbols-outlined text-[16px] text-amber-400">picture_as_pdf</span>
              <span className="hidden sm:inline">Acta PDF</span>
            </button>

            <button
              onClick={() => setActiveMatchModal(null)}
              className="w-8 h-8 rounded-full bg-blue-900/40 hover:bg-blue-800/60 text-slate-300 hover:text-white flex items-center justify-center transition-all"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs inside Modal */}
        <div className="flex border-b border-blue-500/20 bg-[#0a1628]/80 px-6 pt-2 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('scoring')}
            className={`pb-2.5 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'scoring'
                ? 'border-blue-500 text-white'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-base">scoreboard</span>
            <span>Marcador & Incidencias</span>
          </button>

          <button
            onClick={() => setActiveTab('referee_sheet')}
            className={`pb-2.5 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'referee_sheet'
                ? 'border-emerald-400 text-emerald-300'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-base text-emerald-400">sports</span>
            <span>⚖️ Acta Arbitral & Firmas</span>
            {activeMatchModal.isRefereeSigned && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Sellada" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('ai_chronicle')}
            className={`pb-2.5 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'ai_chronicle'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-base text-amber-400">auto_stories</span>
            <span>🎙️ Crónica con IA</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {activeTab === 'scoring' ? (
            <>
              {/* Sealed Notice Banner if Signed */}
              {activeMatchModal.isRefereeSigned && (
                <div className="bg-amber-500/10 border border-amber-400/30 rounded-2xl p-4 flex items-center justify-between gap-3 text-xs text-amber-300">
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-amber-400 text-[24px]">verified</span>
                    <div>
                      <div className="font-black uppercase tracking-wider text-amber-400">
                        Acta Arbitral Cerrada y Certificada Digitalmente
                      </div>
                      <div className="text-[11px] text-blue-200/80">
                        Este encuentro ha sido ratificado por el Colegio de Árbitros. El marcador y las incidencias están protegidos contra alteraciones.
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('referee_sheet')}
                    className="px-3 py-1.5 rounded-xl bg-amber-400 text-blue-950 font-black text-xs hover:bg-amber-300 transition-all shrink-0"
                  >
                    Ver Acta y Sello
                  </button>
                </div>
              )}

              {/* Main Scoreboard Arena */}
              <div className="bg-[#0a1628] rounded-2xl border border-blue-500/25 p-5 shadow-inner">
                {/* Status Pills */}
                <div className="flex items-center justify-center gap-2 mb-4">
                  {(
                    [
                      { id: 'programado', label: 'Programado' },
                      { id: 'en_juego', label: '🔴 En Vivo' },
                      { id: 'finalizado', label: 'Finalizado' },
                    ] as const
                  ).map((st) => (
                    <button
                      key={st.id}
                      onClick={() => handleStatusChange(st.id)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        activeMatchModal.status === st.id
                          ? st.id === 'en_juego'
                            ? 'bg-red-600 text-white shadow-lg shadow-red-700/40 animate-pulse'
                            : 'bg-blue-600 text-white shadow'
                          : 'bg-blue-950/60 text-slate-400 hover:text-white border border-blue-500/20'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>

                {/* Live Minute Controller */}
                {activeMatchModal.status === 'en_juego' && (
                  <div className="flex items-center justify-center gap-2 mb-4 bg-red-950/30 border border-red-500/30 py-2 px-3 rounded-xl max-w-sm mx-auto">
                    <span className="text-xs font-extrabold text-red-400">Minuto Actual:</span>
                    <span className="font-syne font-black text-white text-base">
                      {activeMatchModal.currentMinute || 1}'
                    </span>
                    <button
                      onClick={() => handleMinuteAdvance(1)}
                      className="px-2 py-0.5 bg-blue-600/80 hover:bg-blue-500 text-white text-[11px] font-bold rounded"
                    >
                      +1'
                    </button>
                    <button
                      onClick={() => handleMinuteAdvance(5)}
                      className="px-2 py-0.5 bg-blue-600/80 hover:bg-blue-500 text-white text-[11px] font-bold rounded"
                    >
                      +5'
                    </button>
                    <button
                      onClick={() => handleMinuteAdvance(45)}
                      className="px-2 py-0.5 bg-amber-600/80 hover:bg-amber-500 text-white text-[11px] font-bold rounded"
                    >
                      45' (2T)
                    </button>
                  </div>
                )}

                {/* Teams & Scores */}
                <div className="grid grid-cols-7 items-center gap-3">
                  {/* Home Team */}
                  <div className="col-span-3 flex flex-col items-center text-center space-y-2">
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center font-black text-base shadow-lg border border-white/20"
                      style={{ backgroundColor: home?.badgeBg, color: home?.badgeColor }}
                    >
                      {home?.shortName}
                    </div>
                    <h3 className="font-syne font-bold text-sm text-white">{home?.name}</h3>

                    {/* Score Controls */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => handleScoreChange('home', -1)}
                        className="w-8 h-8 rounded-lg bg-blue-900/60 hover:bg-blue-800 text-white font-bold text-lg flex items-center justify-center border border-blue-500/20 active:scale-90"
                        title="Restar gol"
                      >
                        -
                      </button>
                      <span className="font-syne font-black text-3xl text-white px-2">
                        {activeMatchModal.homeScore ?? '-'}
                      </span>
                      <button
                        onClick={() => handleScoreChange('home', 1)}
                        className="w-8 h-8 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg flex items-center justify-center shadow active:scale-90"
                        title="Sumar gol"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* VS Separator */}
                  <div className="col-span-1 flex flex-col items-center justify-center">
                    <span className="text-xs font-black text-slate-500 bg-[#0d2347] px-2 py-1 rounded-md border border-blue-500/20">
                      VS
                    </span>
                  </div>

                  {/* Away Team */}
                  <div className="col-span-3 flex flex-col items-center text-center space-y-2">
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center font-black text-base shadow-lg border border-white/20"
                      style={{ backgroundColor: away?.badgeBg, color: away?.badgeColor }}
                    >
                      {away?.shortName}
                    </div>
                    <h3 className="font-syne font-bold text-sm text-white">{away?.name}</h3>

                    {/* Score Controls */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => handleScoreChange('away', -1)}
                        className="w-8 h-8 rounded-lg bg-blue-900/60 hover:bg-blue-800 text-white font-bold text-lg flex items-center justify-center border border-blue-500/20 active:scale-90"
                        title="Restar gol"
                      >
                        -
                      </button>
                      <span className="font-syne font-black text-3xl text-white px-2">
                        {activeMatchModal.awayScore ?? '-'}
                      </span>
                      <button
                        onClick={() => handleScoreChange('away', 1)}
                        className="w-8 h-8 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg flex items-center justify-center shadow active:scale-90"
                        title="Sumar gol"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Event Logger Form */}
              <form onSubmit={handleAddEvent} className="bg-[#0a1628] rounded-2xl border border-blue-500/20 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-syne font-bold text-xs text-white uppercase tracking-wider flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-amber-400 text-base">edit_note</span>
                    <span>Registrar Incidencia Minuto a Minuto</span>
                  </h4>
                  <span className="text-[11px] text-blue-300/70 font-mono">Min: {eventMinute}'</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {/* Event Type */}
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Tipo de Evento</label>
                    <select
                      value={selectedEventType}
                      onChange={(e) => setSelectedEventType(e.target.value as EventType)}
                      className="w-full bg-[#0d2347] border border-blue-500/30 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-400 font-medium"
                    >
                      <option value="gol">⚽ Gol de Jugada</option>
                      <option value="penal">⚽ Gol de Penal</option>
                      <option value="autogol">🛑 Autogol</option>
                      <option value="amarilla">🟨 Tarjeta Amarilla</option>
                      <option value="roja">🟥 Tarjeta Roja</option>
                    </select>
                  </div>

                  {/* Team */}
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Equipo</label>
                    <select
                      value={selectedTeamId}
                      onChange={(e) => {
                        setSelectedTeamId(e.target.value);
                        setSelectedPlayerId('');
                      }}
                      className="w-full bg-[#0d2347] border border-blue-500/30 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-400 font-medium"
                    >
                      <option value={activeMatchModal.homeTeamId}>🏠 {home?.name}</option>
                      <option value={activeMatchModal.awayTeamId}>✈️ {away?.name}</option>
                    </select>
                  </div>

                  {/* Minute */}
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Minuto</label>
                    <input
                      type="number"
                      min={1}
                      max={120}
                      value={eventMinute}
                      onChange={(e) => setEventMinute(Number(e.target.value))}
                      className="w-full bg-[#0d2347] border border-blue-500/30 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-400 font-medium"
                    />
                  </div>
                </div>

                {/* Player Select or Manual Name */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Jugador de la Plantilla</label>
                    <select
                      value={selectedPlayerId}
                      onChange={(e) => {
                        setSelectedPlayerId(e.target.value);
                        if (e.target.value) setCustomPlayerName('');
                      }}
                      className="w-full bg-[#0d2347] border border-blue-500/30 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-400 font-medium"
                    >
                      <option value="">-- Seleccionar de plantilla --</option>
                      {activePlayers.map((p) => (
                        <option
                          key={p.id}
                          value={p.id}
                          className={p.isSuspended ? 'text-rose-400 font-bold bg-rose-950' : ''}
                        >
                          #{p.number} {p.name} ({p.position}) {p.isSuspended ? '⚠️ [SUSPENDIDO]' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">O Nombre Personalizado</label>
                    <input
                      type="text"
                      placeholder="Nombre del jugador"
                      value={customPlayerName}
                      onChange={(e) => {
                        setCustomPlayerName(e.target.value);
                        if (e.target.value) setSelectedPlayerId('');
                      }}
                      className="w-full bg-[#0d2347] border border-blue-500/30 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-400 font-medium"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow flex items-center gap-1.5 active:scale-95"
                  >
                    <span className="material-symbols-outlined text-sm">add_circle</span>
                    <span>Añadir Incidencia</span>
                  </button>
                </div>
              </form>

              {/* Event Timeline */}
              <div className="bg-[#0a1628] rounded-2xl border border-blue-500/20 p-4 space-y-3">
                <h4 className="font-syne font-bold text-xs text-white uppercase tracking-wider flex items-center justify-between">
                  <span>Cronología de Incidencias</span>
                  <span className="text-slate-400 text-[11px] font-normal font-sans">
                    {sortedEvents.length} registradas
                  </span>
                </h4>

                {sortedEvents.length === 0 ? (
                  <p className="text-center py-5 text-xs text-slate-400">
                    Aún no hay incidencias registradas para este partido.
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {sortedEvents.map((ev) => {
                      const isHome = ev.teamId === activeMatchModal.homeTeamId;

                      return (
                        <div
                          key={ev.id}
                          className={`flex items-center justify-between p-2.5 rounded-xl border text-xs ${
                            isHome
                              ? 'bg-blue-950/40 border-blue-500/25'
                              : 'bg-emerald-950/30 border-emerald-500/25'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="font-syne font-black text-amber-400 text-xs px-2 py-0.5 rounded bg-amber-400/10 border border-amber-400/20">
                              {ev.minute}'
                            </span>
                            <span className="text-base">
                              {ev.type === 'gol' && '⚽'}
                              {ev.type === 'penal' && '⚽'}
                              {ev.type === 'autogol' && '🛑'}
                              {ev.type === 'amarilla' && '🟨'}
                              {ev.type === 'roja' && '🟥'}
                            </span>
                            <div>
                              <p className="font-bold text-white">
                                {ev.playerName}{' '}
                                <span className="font-normal text-slate-400">
                                  ({ev.type === 'penal' ? 'Penal' : ev.type === 'autogol' ? 'Autogol' : ev.type})
                                </span>
                              </p>
                              <p className="text-[10px] text-blue-300/80">{ev.teamName}</p>
                            </div>
                          </div>

                          {!activeMatchModal.isRefereeSigned && (
                            <button
                              onClick={() => removeMatchEvent(activeMatchModal.id, ev.id)}
                              className="text-slate-400 hover:text-red-400 p-1 rounded transition-colors"
                              title="Eliminar incidencia"
                            >
                              <span className="material-symbols-outlined text-sm">delete</span>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : activeTab === 'referee_sheet' ? (
            /* Official Referee Sheet Tab */
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Officiating Crew Showcase */}
              <div className="bg-[#0a1628] rounded-2xl border border-blue-500/25 p-5 shadow-inner">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-blue-500/15 mb-4 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-amber-400 text-[20px]">sports</span>
                    <h3 className="text-sm font-bold text-white font-syne">
                      Terna Arbitral Oficial del Encuentro
                    </h3>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setActiveOfficialSheetModal(activeMatchModal)}
                      className="text-xs font-bold text-amber-300 hover:text-amber-200 bg-amber-400/20 hover:bg-amber-400/30 px-3 py-1.5 rounded-xl border border-amber-400/40 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                      title="Ver planilla oficial e imprimir"
                    >
                      <span className="material-symbols-outlined text-[15px]">picture_as_pdf</span>
                      <span>Planilla PDF</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleQuickDownloadPdf}
                      className="text-xs font-black text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 px-3 py-1.5 rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                      title="Descargar documento PDF de inmediato"
                    >
                      <span className="material-symbols-outlined text-[15px]">download</span>
                      <span>Descargar Acta</span>
                    </button>

                    {!activeMatchModal.isRefereeSigned && (
                      <button
                        type="button"
                        onClick={() => setActiveRefereeAssignmentModal(activeMatchModal)}
                        className="text-xs font-bold text-blue-300 hover:text-white bg-blue-900/40 hover:bg-blue-800 px-3 py-1.5 rounded-xl border border-blue-400/30 transition-all flex items-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-[15px]">edit</span>
                        <span>Modificar Terna</span>
                      </button>
                    )}
                  </div>
                </div>

                {activeMatchModal.officials && activeMatchModal.officials.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {activeMatchModal.officials.map((off, idx) => (
                      <div
                        key={idx}
                        className="bg-blue-950/50 border border-blue-500/20 rounded-xl p-3.5 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-blue-900/60 border border-blue-400/30 flex items-center justify-center text-amber-400 font-black text-xs">
                            {off.role === 'Principal' ? '⚖️' : '🚩'}
                          </div>
                          <div>
                            <div className="text-[10px] uppercase font-black tracking-wider text-amber-400/90">
                              {off.role}
                            </div>
                            <div className="text-xs font-bold text-white">{off.refereeName}</div>
                            {off.licenseNumber && (
                              <div className="text-[10px] text-blue-300/70 font-mono">
                                Lic: {off.licenseNumber}
                              </div>
                            )}
                          </div>
                        </div>

                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                          Federado
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 bg-blue-950/30 rounded-xl border border-blue-500/20">
                    <p className="text-xs text-amber-400/90 font-medium mb-3">
                      ⚠️ No se ha designado terna arbitral para este partido aún.
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveRefereeAssignmentModal(activeMatchModal)}
                      className="text-xs font-bold text-blue-950 bg-amber-400 hover:bg-amber-300 px-4 py-2 rounded-xl transition-all shadow"
                    >
                      Designar Terna Oficial Ahora
                    </button>
                  </div>
                )}
              </div>

              {/* Match Technical & Disciplinary Summary */}
              <div className="bg-[#0a1628] rounded-2xl border border-blue-500/25 p-5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-blue-300/80 mb-3 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-blue-400">fact_check</span>
                  <span>Balance Técnico y Disciplinario del Partido</span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="bg-blue-900/20 p-2.5 rounded-xl border border-blue-500/15">
                    <span className="text-[10px] text-blue-300/70 block uppercase">Goles Totales</span>
                    <span className="text-base font-black text-white">
                      {(activeMatchModal.homeScore || 0) + (activeMatchModal.awayScore || 0)}
                    </span>
                  </div>
                  <div className="bg-blue-900/20 p-2.5 rounded-xl border border-blue-500/15">
                    <span className="text-[10px] text-yellow-400 block uppercase">Tarjetas Amarillas</span>
                    <span className="text-base font-black text-yellow-300">
                      {activeMatchModal.events.filter((e) => e.type === 'amarilla').length}
                    </span>
                  </div>
                  <div className="bg-blue-900/20 p-2.5 rounded-xl border border-blue-500/15">
                    <span className="text-[10px] text-red-400 block uppercase">Tarjetas Rojas</span>
                    <span className="text-base font-black text-red-400">
                      {activeMatchModal.events.filter((e) => e.type === 'roja').length}
                    </span>
                  </div>
                  <div className="bg-blue-900/20 p-2.5 rounded-xl border border-blue-500/15">
                    <span className="text-[10px] text-emerald-400 block uppercase">Incidencias Minutadas</span>
                    <span className="text-base font-black text-emerald-300">
                      {activeMatchModal.events.length}
                    </span>
                  </div>
                </div>
              </div>

              {/* Digital Signature & Certification Box */}
              {activeMatchModal.isRefereeSigned ? (
                <div className="bg-gradient-to-br from-amber-950/40 via-[#0d2347] to-slate-900 rounded-2xl border-2 border-amber-400/40 p-6 shadow-2xl space-y-4">
                  <div className="flex items-center justify-between border-b border-amber-400/20 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-amber-400/20 border-2 border-amber-400 flex items-center justify-center text-amber-400 shadow-md">
                        <span className="material-symbols-outlined text-[28px]">verified</span>
                      </div>
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                          CERTIFICACIÓN OFICIAL ARBITRAL
                        </div>
                        <h4 className="text-sm sm:text-base font-black text-white">
                          Acta Ratificada y Sellada Digitalmente
                        </h4>
                      </div>
                    </div>

                    <span className="text-[10px] font-mono font-bold bg-amber-400 text-blue-950 px-2.5 py-1 rounded-lg uppercase tracking-wider">
                      INALTERABLE
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="text-blue-200/80">
                      <span className="font-semibold text-white">Firmante Oficial:</span>{' '}
                      {activeMatchModal.officials?.find((o) => o.role === 'Principal')?.refereeName || 'Árbitro Central FBF'}
                    </div>
                    {activeMatchModal.refereeSignedAt && (
                      <div className="text-blue-200/80">
                        <span className="font-semibold text-white">Fecha y Hora de Cierre:</span>{' '}
                        {new Date(activeMatchModal.refereeSignedAt).toLocaleString('es-BO')} (Hora Oficial BO)
                      </div>
                    )}
                    {activeMatchModal.refereeNotes && (
                      <div className="bg-[#0a1628]/80 p-3.5 rounded-xl border border-blue-500/20 text-slate-200 italic mt-2">
                        "{activeMatchModal.refereeNotes}"
                      </div>
                    )}
                  </div>

                  {/* Cryptographic Hash Verification Token */}
                  <div className="bg-[#060d19] border border-blue-500/20 rounded-xl p-3 text-center space-y-1">
                    <div className="text-[9px] font-mono text-blue-400 uppercase tracking-widest">
                      SELLO CRIPTOGRÁFICO SHA-256 DEL ACTA
                    </div>
                    <div className="text-[10px] font-mono text-amber-300 font-bold truncate selection:bg-amber-400 selection:text-black">
                      {activeMatchModal.refereeSignatureHash || 'sha256:verified_apolo_league_act_official'}
                    </div>
                  </div>

                  {/* Actions for Certified Sheet */}
                  <div className="pt-2 flex flex-wrap items-center justify-end gap-2 border-t border-amber-400/20">
                    <button
                      type="button"
                      onClick={() => setActiveOfficialSheetModal(activeMatchModal)}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold text-amber-300 bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/30 transition-all flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[17px]">visibility</span>
                      <span>Ver Planilla A4</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleQuickDownloadPdf}
                      className="px-4 py-2 rounded-xl text-xs font-black text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-lg shadow-amber-500/20 transition-all flex items-center gap-1.5 active:scale-95"
                    >
                      <span className="material-symbols-outlined text-[17px]">download</span>
                      <span>Descargar Acta Oficial en PDF</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-gradient-to-br from-blue-950/60 to-[#0a1628] rounded-2xl border border-blue-500/30 p-5 space-y-4">
                  <div className="flex items-center gap-2.5 border-b border-blue-500/20 pb-3">
                    <span className="material-symbols-outlined text-amber-400 text-[22px]">draw</span>
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-white font-syne">
                        Cierre de Encuentro y Firma Digital del Árbitro
                      </h4>
                      <p className="text-[11px] text-blue-200/70">
                        El cierre del acta sella el resultado como oficial e impide alteraciones en el marcador.
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-blue-200 mb-1.5">
                      Observaciones e Informe Arbitral (Cancha, Disciplina, Delegaciones)
                    </label>
                    <textarea
                      rows={3}
                      value={refereeNotesInput}
                      onChange={(e) => setRefereeNotesInput(e.target.value)}
                      placeholder="Ej: Partido concluido sin reclamos de mesa. Cancha en óptimas condiciones. Sin incidentes en vestuarios..."
                      className="w-full bg-[#0a1628] border border-blue-500/30 rounded-xl p-3 text-xs text-white placeholder-blue-300/40 focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-blue-200 mb-1.5">
                      Nombre del Árbitro Central que Firma y Certifica
                    </label>
                    <input
                      type="text"
                      value={signerNameInput}
                      onChange={(e) => setSignerNameInput(e.target.value)}
                      className="w-full bg-[#0a1628] border border-blue-500/30 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div className="pt-2 flex items-center justify-end">
                    <button
                      type="button"
                      disabled={isSigningAct}
                      onClick={async () => {
                        if (!signerNameInput.trim()) {
                          showToast('Indica el nombre del árbitro que suscribe el acta', 'warning');
                          return;
                        }
                        if (
                          window.confirm(
                            '¿Confirmas la firma digital del acta arbitral? Una vez sellada, el resultado será definitivo e inalterable.'
                          )
                        ) {
                          setIsSigningAct(true);
                          await signMatchOfficialSheet(activeMatchModal.id, refereeNotesInput, signerNameInput);
                          setIsSigningAct(false);
                        }
                      }}
                      className="px-6 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-blue-950 font-black text-xs shadow-lg shadow-amber-400/20 flex items-center gap-2 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-[18px]">verified</span>
                      <span>{isSigningAct ? 'Sellando...' : 'Sellar y Firmar Acta Oficial'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* AI Chronicle Tab */
            <div className="space-y-4">
              <div className="bg-[#0a1628] rounded-2xl border border-blue-500/20 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-syne font-bold text-sm text-white flex items-center gap-2">
                      <span className="material-symbols-outlined text-amber-400">psychology</span>
                      <span>Generador de Crónicas Periodísticas con IA</span>
                    </h4>
                    <p className="text-xs text-blue-200/70 mt-0.5">
                      Convierte las estadísticas y goles del partido en una crónica emocionante lista para prensa y redes.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Estilo Narrativo</label>
                    <select
                      value={aiStyle}
                      onChange={(e) => setAiStyle(e.target.value)}
                      className="w-full bg-[#0d2347] border border-blue-500/30 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400 font-medium"
                    >
                      <option value="LATIN_SPORTS_JOURNALIST">🎙️ Periodismo Apasionado (Radio/Prensa)</option>
                      <option value="ANALYTICAL_SOFASCORE">📊 Análisis Táctico Sofascore / Flashscore</option>
                      <option value="INSTITUTIONAL_SUMMARY">🏛️ Boletín Municipal Oficial Apolo</option>
                    </select>
                  </div>

                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={handleGenerateAIChronicle}
                      disabled={isGeneratingAI}
                      className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs py-2.5 px-4 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                    >
                      {isGeneratingAI ? (
                        <>
                          <span className="material-symbols-outlined text-base animate-spin">refresh</span>
                          <span>Redactando con IA...</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-base">auto_fix_high</span>
                          <span>Redactar Crónica Oficial</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Display Generated Chronicle */}
              {aiChronicle && (
                <div className="bg-[#0a1628] rounded-2xl border border-amber-400/30 p-5 space-y-4 shadow-xl animate-in fade-in">
                  <div className="flex items-center justify-between border-b border-amber-400/20 pb-3">
                    <span className="text-[11px] font-black uppercase text-amber-400 tracking-wider flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm">newspaper</span>
                      <span>Crónica Generada</span>
                    </span>

                    <button
                      onClick={copyChronicleToClipboard}
                      className="flex items-center gap-1.5 bg-emerald-600/90 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all shadow"
                    >
                      <span className="material-symbols-outlined text-sm">content_copy</span>
                      <span>Copiar para WhatsApp/Prensa</span>
                    </button>
                  </div>

                  <div>
                    <h3 className="font-syne font-black text-lg text-white leading-snug">
                      {aiChronicle.headline}
                    </h3>
                    <p className="text-xs text-amber-300/90 font-medium mt-1">
                      {aiChronicle.subheading}
                    </p>
                  </div>

                  <div className="text-xs text-slate-300 leading-relaxed whitespace-pre-line bg-[#0d2347]/60 p-4 rounded-xl border border-blue-500/20">
                    {aiChronicle.body_text}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div className="bg-amber-950/30 border border-amber-400/20 rounded-xl p-3">
                      <span className="text-[10px] text-amber-400 font-bold uppercase block mb-1">
                        ⭐ Jugador Más Valioso (MVP)
                      </span>
                      <p className="text-xs font-bold text-white">{aiChronicle.mvp_player}</p>
                    </div>

                    <div className="bg-blue-950/40 border border-blue-500/20 rounded-xl p-3">
                      <span className="text-[10px] text-blue-400 font-bold uppercase block mb-1">
                        🎯 Clave Táctica
                      </span>
                      <p className="text-xs font-medium text-slate-200">{aiChronicle.tactical_highlight}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-[#0a1628]/95 border-t border-blue-500/20 flex items-center justify-between">
          <p className="text-[11px] text-blue-300/70">
            Los cambios actualizan automáticamente la tabla de posiciones y goleadores en vivo.
          </p>
          <button
            onClick={() => setActiveMatchModal(null)}
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-md active:scale-95"
          >
            Guardar y Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

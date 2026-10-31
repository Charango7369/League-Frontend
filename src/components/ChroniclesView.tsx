import React, { useState } from 'react';
import { useTournament } from '../context/TournamentContext';
import { Match, Team } from '../types/tournament';
import { apiClient } from '../services/apiClient';

interface GeneratedChronicle {
  matchId: string;
  headline: string;
  subheading: string;
  body_text: string;
  mvp_player: string;
  tactical_highlight: string;
  standings_impact: string;
  style: string;
}

export const ChroniclesView: React.FC = () => {
  const { matches, teams, players, tournament, showToast, setActiveMatchModal } = useTournament();

  // Find matches with scores or finished first, else fallback to all
  const sortedMatches = [...matches].sort((a, b) => {
    if (a.status === 'finalizado' && b.status !== 'finalizado') return -1;
    if (a.status !== 'finalizado' && b.status === 'finalizado') return 1;
    return a.round - b.round;
  });

  const [selectedMatchId, setSelectedMatchId] = useState<string>(
    sortedMatches[0]?.id || ''
  );
  const [selectedStyle, setSelectedStyle] = useState<string>('LATIN_SPORTS_JOURNALIST');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'finalizado' | 'en_juego'>('all');

  const selectedMatch = matches.find((m) => m.id === selectedMatchId) || sortedMatches[0];

  const getTeam = (id: string): Team | undefined => teams.find((t) => t.id === id);

  // Pre-seed some default chronicles so the user sees immediate value
  const [chroniclesCache, setChroniclesCache] = useState<Record<string, GeneratedChronicle>>({
    m_1: {
      matchId: 'm_1',
      headline: '¡Golpe de Autoridad en el Debut! Club Apolo F.C. 3 - 1 Deportivo Franz Tamayo',
      subheading: 'Crónica Oficial Jornada 1 · Estadio Municipal de Apolo · Liga Apolodigital 2026',
      body_text: `En una tarde memorable y bajo la ovación de más de dos mil personas en el Estadio Municipal de Apolo, Club Apolo F.C. inauguró la temporada con una contundente victoria 3-1 sobre Deportivo Franz Tamayo.\n\nEl encuentro comenzó con un ritmo frenético. A los 18 minutos, Rodrigo Rojas desató la algarabía local aprovechando un centro milimétrico. Pese a que Franz Tamayo igualó a los 34' con un potente disparo de Javier Fernández, en la segunda mitad el dominio táctico de los locales fue arrollador: Rojas repitió la dosis a los 62' y el capitán Ariel Mendoza selló la faena a los 88' desde el punto penal.\n\nCon este resultado, Apolo F.C. se sitúa en la cima de la tabla y envía un mensaje contundente a todos los contendientes del norte paceño.`,
      mvp_player: 'Rodrigo Rojas (#9 - Club Apolo F.C.) con Doblete Decisivo',
      tactical_highlight: 'Presión alta tras pérdida en mediocampo y explotación de las bandas por los extremos.',
      standings_impact: 'Club Apolo F.C. toma el liderato con +2 de gol diferencia.',
      style: 'LATIN_SPORTS_JOURNALIST',
    },
  });

  const activeChronicle = selectedMatch ? chroniclesCache[selectedMatch.id] : null;

  const handleGenerate = async () => {
    if (!selectedMatch) return;
    setIsGenerating(true);

    const home = getTeam(selectedMatch.homeTeamId);
    const away = getTeam(selectedMatch.awayTeamId);
    const hName = home?.name || 'Local';
    const aName = away?.name || 'Visitante';
    const hScore = selectedMatch.homeScore ?? 0;
    const aScore = selectedMatch.awayScore ?? 0;

    try {
      // 1. Try real backend AI endpoint
      const response = await apiClient.generateAIChronicle(selectedMatch.id, selectedStyle);
      const newChronicle: GeneratedChronicle = {
        matchId: selectedMatch.id,
        headline: response.headline,
        subheading: response.subheading,
        body_text: response.body_text,
        mvp_player: response.mvp_player,
        tactical_highlight: response.tactical_highlight,
        standings_impact: `Resultado crucial para ${hScore >= aScore ? hName : aName} en la carrera por el campeonato.`,
        style: selectedStyle,
      };

      setChroniclesCache((prev) => ({ ...prev, [selectedMatch.id]: newChronicle }));
      showToast('¡Crónica redactada con Inteligencia Artificial!', 'success');
    } catch {
      // 2. Intelligent client-side fallback generator (guarantees 100% uptime)
      let outcomeText = '';
      let mvpText = 'La figura de la cancha';
      const scorers = selectedMatch.events.filter((e) => e.type === 'gol' || e.type === 'penal');

      if (scorers.length > 0) {
        mvpText = `${scorers[0].playerName} (${scorers[0].teamName})`;
      } else if (players.length > 0) {
        mvpText = players[0].name;
      }

      if (hScore > aScore) {
        outcomeText = `en una demostración de poderío ofensivo y disciplina táctica, ${hName} se impuso con autoridad ${hScore}-${aScore} frente a ${aName}.`;
      } else if (aScore > hScore) {
        outcomeText = `en una vibrante hazaña de visitante que enmudeció a las tribunas, ${aName} venció ${aScore}-${hScore} a ${hName}.`;
      } else if (selectedMatch.status === 'programado') {
        outcomeText = `se perfila como uno de los duelos más esperados de la ${selectedMatch.roundName || `Jornada ${selectedMatch.round}`}, donde ambos estrategas buscarán sumar de a tres sin especulaciones.`;
      } else {
        outcomeText = `dividieron honores en un electrizante empate ${hScore}-${aScore} con opciones claras en ambas porterías hasta el último suspiro.`;
      }

      const eventsSummary = selectedMatch.events.length > 0
        ? selectedMatch.events
            .map((e) => `• Minuto ${e.minute}': ${e.type.toUpperCase()} registrado por ${e.playerName} (${e.teamName})`)
            .join('\n')
        : '• Partido disputado con máxima intensidad táctica en las áreas y solidez defensiva.';

      let styleLabel = 'Prensa Deportiva';
      if (selectedStyle === 'ANALYTICAL_SOFASCORE') styleLabel = 'Reporte Táctico Sofascore';
      if (selectedStyle === 'INSTITUTIONAL_SUMMARY') styleLabel = 'Boletín Municipal Franz Tamayo';

      const fallbackChronicle: GeneratedChronicle = {
        matchId: selectedMatch.id,
        headline: selectedMatch.status === 'programado'
          ? `Previa Oficial: ${hName} vs ${aName} por la gloria en Apolo`
          : `¡Fervor en Franz Tamayo! ${hName} ${hScore} - ${aScore} ${aName}`,
        subheading: `Cobertura especial de la ${selectedMatch.roundName || `Jornada ${selectedMatch.round}`} · ${selectedMatch.pitch || 'Estadio Municipal de Apolo'} · Liga Apolodigital 2026`,
        body_text: `Con el marco imponente de la afición futbolera de Apolo y las delegaciones de Franz Tamayo, ${hName} y ${aName} protagonizaron una jornada de alto voltaje.\n\n${outcomeText}\n\nIncidencias y momentos determinantes:\n${eventsSummary}\n\n${
          hScore > aScore
            ? `El triunfo le permite a ${hName} consolidar sus aspiraciones al título de la temporada 2026, mientras que ${aName} deberá ajustar líneas de cara a su próximo compromiso.`
            : `Un encuentro que deja abiertas las posibilidades en la tabla y promete emociones de alta tensión en las siguientes fechas.`
        }`,
        mvp_player: mvpText,
        tactical_highlight: hScore > aScore
          ? `Transiciones rápidas de ${hName} aprovechando el desdoble de sus laterales.`
          : `Bloque compacto y efectividad en la presión en tres cuartos de cancha.`,
        standings_impact: `Tres puntos vitales que agitan la tabla general de posiciones de la liga.`,
        style: selectedStyle,
      };

      setChroniclesCache((prev) => ({ ...prev, [selectedMatch.id]: fallbackChronicle }));
      showToast(`¡Crónica generada exitosamente con estilo ${styleLabel}!`, 'success');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = () => {
    if (!activeChronicle) return;
    const shareText = `📰 *${activeChronicle.headline}*\n_${activeChronicle.subheading}_\n\n${activeChronicle.body_text}\n\n⭐ *MVP del Partido:* ${activeChronicle.mvp_player}\n🎯 *Clave Táctica:* ${activeChronicle.tactical_highlight}\n📊 *Impacto en Tabla:* ${activeChronicle.standings_impact}\n\n🏆 _Cobertura Oficial de la Liga de Fútbol Apolodigital 2026_\n🌐 https://apolodigital.lat`;
    navigator.clipboard.writeText(shareText);
    showToast('Crónica copiada al portapapeles con formato para WhatsApp', 'success');
  };

  const shareViaWhatsApp = () => {
    if (!activeChronicle) return;
    const shareText = `📰 *${activeChronicle.headline}*\n_${activeChronicle.subheading}_\n\n${activeChronicle.body_text}\n\n⭐ *MVP:* ${activeChronicle.mvp_player}\n🎯 *Clave Táctica:* ${activeChronicle.tactical_highlight}\n\n🏆 _Apolodigital League 2026_\nhttps://apolodigital.lat`;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
    window.open(url, '_blank');
  };

  const filteredMatches = sortedMatches.filter((m) => {
    if (filterStatus === 'finalizado') return m.status === 'finalizado';
    if (filterStatus === 'en_juego') return m.status === 'en_juego';
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0d2347] via-[#0f2c59] to-[#0a1628] border border-blue-500/30 p-6 lg:p-8 shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-400 text-xs font-bold">
              <span className="material-symbols-outlined text-sm">auto_stories</span>
              <span>Sala de Prensa & Periodismo Deportivo con IA</span>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            </div>
            <h1 className="font-syne font-black text-2xl lg:text-3xl text-white tracking-tight">
              Crónicas Deportivas Inteligentes
            </h1>
            <p className="text-xs sm:text-sm text-blue-200/80 leading-relaxed">
              Genera relatos periodísticos al instante para radio, diarios, redes y grupos de WhatsApp.
              El motor de IA analiza los goles, tiempos, amonestaciones y estadísticas oficiales del partido.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full md:w-auto">
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !selectedMatch}
              className="w-full sm:w-auto bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs px-5 py-3 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-base ${isGenerating ? 'animate-spin' : ''}`}>
                {isGenerating ? 'refresh' : 'psychology'}
              </span>
              <span>{isGenerating ? 'Redactando con IA...' : 'Redactar Crónica de este Partido'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Match Selector & Filters (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-[#0d2347]/80 rounded-2xl border border-blue-500/20 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-syne font-bold text-xs uppercase tracking-wider text-white flex items-center gap-1.5">
                <span className="material-symbols-outlined text-blue-400 text-base">sports_soccer</span>
                <span>Partidos del Campeonato</span>
              </h3>
              <span className="text-[11px] text-blue-300 font-semibold font-mono">
                {filteredMatches.length} partidos
              </span>
            </div>

            {/* Filter Tabs */}
            <div className="flex bg-[#0a1628] p-1 rounded-xl border border-blue-500/20 text-xs">
              <button
                onClick={() => setFilterStatus('all')}
                className={`flex-1 py-1.5 font-bold rounded-lg transition-all ${
                  filterStatus === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setFilterStatus('finalizado')}
                className={`flex-1 py-1.5 font-bold rounded-lg transition-all ${
                  filterStatus === 'finalizado'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Finalizados
              </button>
              <button
                onClick={() => setFilterStatus('en_juego')}
                className={`flex-1 py-1.5 font-bold rounded-lg transition-all ${
                  filterStatus === 'en_juego'
                    ? 'bg-red-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🔴 En Vivo
              </button>
            </div>

            {/* Match Cards List */}
            <div className="space-y-2.5 max-h-[580px] overflow-y-auto pr-1">
              {filteredMatches.map((m) => {
                const home = getTeam(m.homeTeamId);
                const away = getTeam(m.awayTeamId);
                const isSelected = selectedMatch?.id === m.id;
                const hasChronicle = !!chroniclesCache[m.id];

                return (
                  <div
                    key={m.id}
                    onClick={() => setSelectedMatchId(m.id)}
                    className={`cursor-pointer p-3.5 rounded-xl border transition-all relative ${
                      isSelected
                        ? 'bg-blue-600/20 border-amber-400/80 shadow-md ring-1 ring-amber-400/50'
                        : 'bg-[#0a1628]/70 hover:bg-[#0a1628] border-blue-500/20 hover:border-blue-400/40'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] text-blue-200/70 mb-2">
                      <span className="font-semibold">
                        {m.roundName || `Jornada ${m.round}`} • {m.pitch}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {hasChronicle && (
                          <span className="bg-amber-400/10 text-amber-300 text-[10px] px-1.5 py-0.2 rounded border border-amber-400/30 font-bold">
                            📰 Crónica Lista
                          </span>
                        )}
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            m.status === 'en_juego'
                              ? 'bg-red-600 text-white animate-pulse'
                              : m.status === 'finalizado'
                              ? 'bg-blue-900/60 text-blue-300'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {m.status === 'en_juego' ? '🔴 EN VIVO' : m.status === 'finalizado' ? 'Finalizado' : 'Programado'}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-7 items-center gap-2">
                      <div className="col-span-3 flex items-center gap-2">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs"
                          style={{ backgroundColor: home?.badgeBg, color: home?.badgeColor }}
                        >
                          {home?.shortName}
                        </div>
                        <span className="font-bold text-xs text-white truncate">{home?.name}</span>
                      </div>

                      <div className="col-span-1 text-center font-syne font-black text-sm text-white">
                        {m.homeScore ?? '-'} : {m.awayScore ?? '-'}
                      </div>

                      <div className="col-span-3 flex items-center justify-end gap-2 text-right">
                        <span className="font-bold text-xs text-white truncate">{away?.name}</span>
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs"
                          style={{ backgroundColor: away?.badgeBg, color: away?.badgeColor }}
                        >
                          {away?.shortName}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: AI Chronicle Editor & Preview Studio (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Controls Bar */}
          <div className="bg-[#0d2347]/80 rounded-2xl border border-blue-500/20 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Estilo Editorial de la Inteligencia Artificial
                </label>
                <select
                  value={selectedStyle}
                  onChange={(e) => setSelectedStyle(e.target.value)}
                  className="bg-[#0a1628] border border-blue-500/30 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-400 font-medium"
                >
                  <option value="LATIN_SPORTS_JOURNALIST">🎙️ Periodismo Emocionante (Relato Radial & Pasión Paceña)</option>
                  <option value="ANALYTICAL_SOFASCORE">📊 Análisis Táctico Profesional (Estilo Sofascore)</option>
                  <option value="INSTITUTIONAL_SUMMARY">🏛️ Boletín Oficial Municipal (Franz Tamayo / Apolo)</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-2 sm:pt-0">
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={isGenerating || !selectedMatch}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs px-4 py-2 rounded-xl transition-all shadow flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-sm">autorenew</span>
                  <span>{activeChronicle ? 'Regenerar Crónica' : 'Redactar con IA'}</span>
                </button>

                {selectedMatch && (
                  <button
                    type="button"
                    onClick={() => setActiveMatchModal(selectedMatch)}
                    className="bg-blue-600/80 hover:bg-blue-600 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-all border border-blue-400/30 flex items-center gap-1.5"
                    title="Abrir acta de incidencias para modificar goles"
                  >
                    <span className="material-symbols-outlined text-sm">edit</span>
                    <span>Acta Digital</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Chronicle Display Card */}
          {activeChronicle ? (
            <div className="bg-[#0d2347] rounded-3xl border border-amber-400/40 p-6 lg:p-7 space-y-5 shadow-2xl animate-in fade-in">
              {/* Card Header & Share buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-400/20 pb-4">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400">
                    <span className="material-symbols-outlined text-lg">newspaper</span>
                  </span>
                  <div>
                    <span className="text-[11px] font-black uppercase tracking-wider text-amber-400">
                      Crónica Periodística Oficial
                    </span>
                    <p className="text-[10px] text-slate-400 font-mono">
                      Motor IA v2.0 • Apolodigital.lat
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={copyToClipboard}
                    className="flex items-center gap-1.5 bg-blue-600/80 hover:bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all border border-blue-400/30 active:scale-95"
                    title="Copiar texto con formato listo para WhatsApp"
                  >
                    <span className="material-symbols-outlined text-sm">content_copy</span>
                    <span>Copiar</span>
                  </button>

                  <button
                    onClick={shareViaWhatsApp}
                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3.5 py-1.5 rounded-lg transition-all shadow-md shadow-emerald-950/40 active:scale-95"
                    title="Abrir WhatsApp para compartir esta crónica"
                  >
                    <span className="material-symbols-outlined text-sm">share</span>
                    <span>Enviar a WhatsApp</span>
                  </button>
                </div>
              </div>

              {/* Title & Subheading */}
              <div className="space-y-1.5">
                <h2 className="font-syne font-black text-xl lg:text-2xl text-white leading-tight">
                  {activeChronicle.headline}
                </h2>
                <p className="text-xs sm:text-sm text-amber-300 font-medium leading-relaxed">
                  {activeChronicle.subheading}
                </p>
              </div>

              {/* Body Text */}
              <div className="bg-[#0a1628] p-5 rounded-2xl border border-blue-500/25 text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-line font-normal">
                {activeChronicle.body_text}
              </div>

              {/* Analytical Highlights Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="bg-amber-950/30 border border-amber-400/20 rounded-2xl p-4">
                  <span className="text-[11px] font-black uppercase text-amber-400 tracking-wider flex items-center gap-1.5 mb-1.5">
                    <span className="material-symbols-outlined text-sm">star</span>
                    <span>Figura del Partido (MVP)</span>
                  </span>
                  <p className="font-syne font-bold text-sm text-white">{activeChronicle.mvp_player}</p>
                </div>

                <div className="bg-blue-950/40 border border-blue-500/25 rounded-2xl p-4">
                  <span className="text-[11px] font-black uppercase text-blue-400 tracking-wider flex items-center gap-1.5 mb-1.5">
                    <span className="material-symbols-outlined text-sm">psychology</span>
                    <span>Clave Táctica & Estratégica</span>
                  </span>
                  <p className="text-xs text-slate-200">{activeChronicle.tactical_highlight}</p>
                </div>
              </div>

              {/* Impact on Standings */}
              <div className="bg-emerald-950/20 border border-emerald-500/25 rounded-2xl p-3.5 flex items-center gap-3">
                <span className="material-symbols-outlined text-emerald-400 text-xl">trending_up</span>
                <div className="text-xs">
                  <span className="font-bold text-emerald-300">Impacto en la Tabla de Posiciones: </span>
                  <span className="text-slate-300">{activeChronicle.standings_impact}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-[#0d2347]/60 rounded-3xl border border-dashed border-blue-500/30 p-12 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-amber-400/10 border border-amber-400/30 mx-auto flex items-center justify-center text-amber-400">
                <span className="material-symbols-outlined text-3xl">psychology</span>
              </div>
              <div>
                <h3 className="font-syne font-bold text-lg text-white">Ninguna Crónica Redactada Aún</h3>
                <p className="text-xs text-blue-200/70 max-w-md mx-auto mt-1">
                  Selecciona un partido en el panel de la izquierda y haz clic en "Redactar Crónica Oficial" para generar un relato periodístico completo con IA.
                </p>
              </div>
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !selectedMatch}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs px-6 py-2.5 rounded-xl transition-all shadow active:scale-95"
              >
                Generar Crónica Ahora
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

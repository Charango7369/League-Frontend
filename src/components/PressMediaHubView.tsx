import React, { useState } from 'react';
import { useTournament } from '../context/TournamentContext';

type PressFormat = 'radio' | 'prensa_escrita' | 'whatsapp' | 'circular_delegados';

export const PressMediaHubView: React.FC = () => {
  const {
    tournament,
    matches,
    teams,
    players,
    standings,
    sanctions,
    showToast,
    addNotification,
  } = useTournament();

  const [selectedFormat, setSelectedFormat] = useState<PressFormat>('radio');
  const [selectedRound, setSelectedRound] = useState<number>(1);
  const [announcerName, setAnnouncerName] = useState('Carlos "El Cóndor" Mendoza');
  const [radioStation, setRadioStation] = useState('Radio Apolo 98.5 FM');
  const [isDispatching, setIsDispatching] = useState(false);

  // Extract rounds
  const rounds = Array.from(new Set(matches.map((m) => m.round))).sort((a, b) => a - b);

  // Round specific matches
  const roundMatches = matches.filter((m) => m.round === selectedRound);

  // Top Scorer
  const topScorers = [...players].sort((a, b) => b.goals - a.goals).slice(0, 3);
  const topScorer = topScorers[0];

  // Active Sanctions
  const activeSanctions = sanctions.filter((s) => s.status === 'activa');

  // Generator for Radio Announcer Script
  const generateRadioScript = (): string => {
    const finishedMatches = roundMatches.filter((m) => m.status === 'finalizado');
    const matchesSummary = finishedMatches.map((m) => {
      const h = teams.find((t) => t.id === m.homeTeamId)?.name;
      const a = teams.find((t) => t.id === m.awayTeamId)?.name;
      return `   • ${h} ${m.homeScore} frente a ${a} ${m.awayScore} en ${m.pitch || 'Estadio Municipal'}.`;
    }).join('\n') || '   • Jornada con encuentros pendientes de disputa en el gramado apoleño.';

    const leaderTeam = standings[0]?.team.name || 'Club Apolo F.C.';
    const leaderPoints = standings[0]?.points || 3;

    return `🎙️ ==============================================================
   GUION RADIAL OFICIAL: ${radioStation.toUpperCase()}
   PROGRAMA: "FÚTBOL DE PRIMERA FRANZ TAMAYO"
   LOCUCIÓN: ${announcerName.toUpperCase()}
   COBERTURA: ${tournament.name.toUpperCase()} (${tournament.season})
==============================================================

[00:00 - 00:08] [AUDIO: CORTINILLA ENÉRGICA MUSICAL CON BOMBO Y PLATILLOS ANDINOS]
[00:08 - 00:25] [LOCUTOR CON VOZ POTENTE Y APASIONADA]:
"¡Muy buenas tardes, Apolo! ¡Un saludo caluroso a las comunidades de Machariapo, Atén, Pauje-Yuyo y todo el norte paceño! Bienvenidos a la señal deportiva de ${radioStation}. Hoy vibramos con las incidencias de la Jornada ${selectedRound} de nuestra fiesta deportiva provincial: ¡la ${tournament.name}!"

[00:25 - 00:45] [EFECTO: PITAZO CORTO DE ÁRBITRO]
[LOCUTOR]:
"Un fin de semana vibrante que dejó huella en el verde del Estadio Municipal. Estos fueron los marcadores oficiales certificados por el Colegio de Árbitros:
${matchesSummary}
¡Emociones al rojo vivo que hicieron cantar a las hinchadas desde las cuatro tribunas!"

[00:45 - 01:10] [AUDIO: SUBE Y BAJA MÚSICA DE FONDO]
[LOCUTOR]:
"Y tras estos noventa minutos de coraje y sudor, la tabla de posiciones tiene a un puntero que marcha con paso firme: ¡${leaderTeam.toUpperCase()} comanda la clasificación con ${leaderPoints} puntos acumulados! Y atención, porque en la tabla de goleadores, ${topScorer ? `${topScorer.name} del club ${teams.find((t) => t.id === topScorer.teamId)?.name}` : 'nuestros artilleros'} sigue inflando las redes con ${topScorer?.goals || 0} tantos en su cuenta personal."

[01:10 - 01:30] [AUDIO: RÁFAGA DISCIPLINARIA]
[LOCUTOR]:
"El Tribunal de Justicia Deportiva recuerda a los clubes afiliados mantener el Fair Play. Se computaron ${activeSanctions.length} resoluciones disciplinarias activas para cuidar la deportividad en nuestra tierra."

[01:30 - 01:45] [AUDIO: CIERRE CON SINTONÍA OFICIAL DE APOLODIGITAL]
[LOCUTOR]:
"¡Siga la pasión del fútbol apoleño minuto a minuto en la plataforma oficial apolodigital.lat! Les acompañó ${announcerName}. ¡Hasta el próximo pitazo final!"`;
  };

  // Generator for Written Press Release
  const generateWrittenPress = (): string => {
    const leaderTeam = standings[0]?.team.name || 'Club Apolo F.C.';
    const leaderPoints = standings[0]?.points || 3;

    return `COMUNICADO DE PRENSA OFICIAL N° 0${selectedRound}-2026/CP-AFT
ASOCIACIÓN PROVINCIAL DE FÚTBOL DE FRANZ TAMAYO · APOLO
SECRETARÍA DE PRENSA, RELACIONES PÚBLICAS Y DIFUSIÓN DEPORTIVA

Apolo, La Paz, Bolivia — ${new Date().toLocaleDateString('es-BO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}

TÍTULO: Fervor deportivo en el norte paceño: Concluye la Jornada ${selectedRound} con ${leaderTeam} en lo más alto

En un marco multitudinario de familias y delegaciones comunales, concluyeron con éxito los compromisos correspondientes a la Jornada ${selectedRound} de la "${tournament.name}", torneo avalado por el Colegio de Árbitros de Franz Tamayo y auspiciado tecnológicamente por Apolodigital.lat.

I. BALANCE COMPETITIVO Y MARCADORES:
Las canchas del municipio acogieron partidos de alto despliegue físico y técnico. Todos los resultados han sido debidamente convalidados mediante actas arbitrales selladas digitalmente con firma criptográfica:

${roundMatches.map((m) => {
  const h = teams.find((t) => t.id === m.homeTeamId)?.name;
  const a = teams.find((t) => t.id === m.awayTeamId)?.name;
  const score = m.homeScore !== null && m.awayScore !== null ? `${m.homeScore} - ${m.awayScore}` : 'POR JUGAR';
  return `• ${h} [${score}] ${a} — Cancha: ${m.pitch || 'Estadio Municipal de Apolo'}`;
}).join('\n')}

II. CUADRO DE HONOR Y POSICIONES:
El representativo de ${leaderTeam} se afianza en el liderato del certamen con ${leaderPoints} unidades, escoltado de cerca por los perseguidores inmediatos en una tabla que promete definición al rojo vivo para la clasificación a la ronda de playoffs.

En la tabla de goleo individual, ${topScorer?.name || 'los delanteros locales'} encabeza la carrera con ${topScorer?.goals || 0} goles convertidos.

III. AVISO A LA AFICIÓN Y MEDIOS:
La Asociación agradece la cobertura periodística de las emisoras locales ${radioStation}, Radio Madidi y los portales digitales provinciales. Se recuerda que las planillas completas de cada partido están disponibles para consulta pública y descarga en formato PDF en el portal oficial.

Comisión de Prensa y Difusión
Asociación Provincial de Fútbol Franz Tamayo
"Por la hermandad y el deporte en el norte de La Paz"`;
  };

  // Generator for WhatsApp / Social Media
  const generateWhatsAppKit = (): string => {
    return `🏆 *BOLETÍN OFICIAL DEPORTIVO — APOLODIGITAL LEAGUE* 🇧🇴
📍 _Provincia Franz Tamayo · Apolo (La Paz)_
📅 *RESUMEN JORNADA ${selectedRound}*

━━━━━━━━━━━━━━━━━━━━
⚔️ *RESULTADOS DE LA FECHA:*
${roundMatches.map((m) => {
  const h = teams.find((t) => t.id === m.homeTeamId)?.name;
  const a = teams.find((t) => t.id === m.awayTeamId)?.name;
  const score = m.homeScore !== null && m.awayScore !== null ? `${m.homeScore} - ${m.awayScore}` : 'VS';
  return `⚽ ${h} *${score}* ${a}`;
}).join('\n')}

━━━━━━━━━━━━━━━━━━━━
📊 *TABLA DE POSICIONES (TOP 4):*
${standings.slice(0, 4).map((s, idx) => {
  const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '4.';
  return `${medal} *${s.team.name}* | ${s.points} pts (PJ:${s.played}, DG:${s.goalDifference > 0 ? `+${s.goalDifference}` : s.goalDifference})`;
}).join('\n')}

━━━━━━━━━━━━━━━━━━━━
🥇 *PICHICHI / MÁXIMO GOLEADOR:*
⚽ *${topScorer?.name || 'Gonzalo Vaca'}* (${teams.find((t) => t.id === topScorer?.teamId)?.name || 'Club Apolo'}) — *${topScorer?.goals || 0} Goles*

⚖️ *TRIBUNAL DE PENAS:*
🛑 ${activeSanctions.length} futbolistas con sanción disciplinaria vigente.

📲 _Consulta las actas oficiales en PDF y marcador en vivo en:_
🌐 *https://apolodigital.lat*
💬 _Contacto delegados: +591 765 09789_`;
  };

  // Generator for Delegate Circular
  const generateDelegateCircular = (): string => {
    return `CIRCULAR TÉCNICA OFICIAL N° 0${selectedRound}/2026
DE: MESA DIRECTIVA Y TRIBUNAL DE PENAS (AFT)
PARA: PRESIDENTES Y DELEGADOS DE LOS 8 CLUBES AFILIADOS
ASUNTO: DISPOSICIONES OBLIGATORIAS PARA LA PRÓXIMA FECHA

Apolo, Franz Tamayo, ${new Date().toLocaleDateString('es-BO')}

Estimados señores delegados:

Por la presente, la Mesa Directiva de la Asociación Provincial de Fútbol de Franz Tamayo recuerda las siguientes disposiciones de estricto cumplimiento:

1. PRESENTACIÓN DE DOCUMENTACIÓN:
Los futbolistas deberán portar obligatoriamente su Cédula de Identidad original o Pasaporte Deportivo emitido por la Liga para la firma en mesa de control 30 minutos antes del pitazo inicial.

2. CUMPLIMIENTO DE SANCIONES DISCIPLINARIAS:
Se recuerda a los delegados que los futbolistas sancionados mediante resoluciones del Tribunal de Justicia Deportiva NO están habilitados para participar. Su inclusión configurará "Alineación Indebida" con pérdida de puntos de conformidad con el Estatuto.

Futbolistas inhabilitados para esta fecha:
${activeSanctions.map((s) => `• ${s.playerName} (${s.teamName}) — Res. ${s.code} (${s.matchesSuspended - s.matchesServed} fecha pendiente)`).join('\n') || '• Ningún jugador registra suspensión vigente.'}

3. ESTADO DE CAMPOS DEPORTIVOS:
En caso de lluvias torrenciales en el valle de Apolo, la inspección oficial de la cancha se efectuará a las 13:00 horas, comunicándose cualquier reprogramación por los canales oficiales.

Atentamente,

Comisión Técnica y Colegio de Árbitros
Asociación Provincial de Fútbol Franz Tamayo`;
  };

  const getActiveContent = (): string => {
    switch (selectedFormat) {
      case 'radio':
        return generateRadioScript();
      case 'prensa_escrita':
        return generateWrittenPress();
      case 'whatsapp':
        return generateWhatsAppKit();
      case 'circular_delegados':
        return generateDelegateCircular();
    }
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(getActiveContent());
    showToast('Boletín copiado al portapapeles con formato oficial', 'success');
  };

  const handleDownloadFile = () => {
    const content = getActiveContent();
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Boletin_Oficial_${selectedFormat}_Jornada_${selectedRound}_Apolo.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Archivo de prensa descargado (.md)', 'success');
  };

  // Dispatch Webhook Notification Simulation
  const handleDispatchBroadcast = () => {
    setIsDispatching(true);
    setTimeout(() => {
      setIsDispatching(false);
      addNotification({
        title: `Boletín de Prensa Jornada ${selectedRound} Despachado`,
        message: `Se envió la pauta oficial a las emisoras ${radioStation}, Radio Madidi y a los 8 delegados de clubes.`,
        category: 'prensa',
        linkTab: 'prensa',
      });
      showToast(
        `¡Despacho masivo completado! 8 delegados y 2 emisoras notificadas vía WhatsApp Webhook.`,
        'success'
      );
    }, 1500);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-950 via-[#0d2347] to-indigo-950 border border-indigo-500/25 rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-2xl">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-indigo-300 shadow-xl shrink-0">
              <span className="material-symbols-outlined text-[36px]">podcasts</span>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-xs font-black uppercase tracking-wider text-indigo-300 bg-indigo-400/10 border border-indigo-400/30 px-2.5 py-0.5 rounded-full">
                  Centro de Prensa & Comunicaciones Oficiales
                </span>
                <span className="text-xs font-semibold text-blue-200/80">
                  Difusión para Radio, Redes y Periódicos de Apolo
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black font-syne text-white tracking-wide">
                Boletines de Prensa & Despacho a Medios
              </h1>
              <p className="text-xs sm:text-sm text-blue-100/70 max-w-2xl mt-1">
                Generador automatizado de guiones para locución radial, comunicados de prensa escrita, kits de difusión para WhatsApp y circulares técnicas para delegados.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 self-start md:self-auto">
            <button
              type="button"
              disabled={isDispatching}
              onClick={handleDispatchBroadcast}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-400 hover:to-blue-500 text-white font-extrabold text-xs shadow-lg shadow-indigo-600/25 border border-indigo-400/40 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-[18px] ${isDispatching ? 'animate-spin' : ''}`}>
                {isDispatching ? 'refresh' : 'send'}
              </span>
              <span>{isDispatching ? 'Despachando...' : 'Despachar a Delegados'}</span>
            </button>
          </div>
        </div>

        {/* Media Partners Strip */}
        <div className="flex items-center gap-3 sm:gap-6 mt-6 pt-5 border-t border-indigo-500/20 text-xs text-indigo-200/80 overflow-x-auto scrollbar-none">
          <span className="font-bold text-white uppercase text-[10px] tracking-wider shrink-0">
            Cadena de Medios Aliados:
          </span>
          <span className="flex items-center gap-1.5 shrink-0">
            <span className="material-symbols-outlined text-[16px] text-amber-400">radio</span>
            <span>Radio Apolo 98.5 FM</span>
          </span>
          <span className="flex items-center gap-1.5 shrink-0">
            <span className="material-symbols-outlined text-[16px] text-emerald-400">radio</span>
            <span>Radio Madidi 101.3 FM</span>
          </span>
          <span className="flex items-center gap-1.5 shrink-0">
            <span className="material-symbols-outlined text-[16px] text-blue-400">newspaper</span>
            <span>Periódico Franz Tamayo</span>
          </span>
          <span className="flex items-center gap-1.5 shrink-0">
            <span className="material-symbols-outlined text-[16px] text-rose-400">cell_tower</span>
            <span>ApoloDigital Streaming</span>
          </span>
        </div>
      </div>

      {/* Main Layout: Controls & Live Document Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Format Selectors & Parameters (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Format Selector Cards */}
          <div className="bg-[#0d2347]/80 rounded-2xl border border-blue-500/20 p-4 space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-300 block mb-2">
              Seleccionar Formato de Difusión
            </span>

            {[
              {
                id: 'radio',
                label: 'Guion Radial & Locución',
                desc: 'Pauta comentada con efectos de sonido para radioemisoras',
                icon: 'mic',
                color: 'text-amber-400',
              },
              {
                id: 'prensa_escrita',
                label: 'Boletín de Prensa Escrita',
                desc: 'Comunicado institucional formal para diarios y webs',
                icon: 'article',
                color: 'text-blue-400',
              },
              {
                id: 'whatsapp',
                label: 'Kit Redes & WhatsApp',
                desc: 'Formato ligero con emojis para grupos de capitanes',
                icon: 'chat',
                color: 'text-emerald-400',
              },
              {
                id: 'circular_delegados',
                label: 'Circular para Delegados',
                desc: 'Instrucciones técnicas de mesa y sanciones vigentes',
                icon: 'assignment_late',
                color: 'text-rose-400',
              },
            ].map((f) => {
              const isSelected = selectedFormat === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSelectedFormat(f.id as PressFormat)}
                  className={`w-full text-left p-3 rounded-xl border transition-all flex items-start gap-3 cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600/30 border-blue-400 shadow-md text-white'
                      : 'bg-[#0a1628]/60 border-blue-500/15 text-blue-200 hover:bg-[#0a1628]'
                  }`}
                >
                  <span className={`material-symbols-outlined text-[24px] ${f.color} shrink-0 mt-0.5`}>
                    {f.icon}
                  </span>
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-white">{f.label}</h4>
                    <p className="text-[10px] text-blue-300/70 mt-0.5 line-clamp-2">{f.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Configuration Parameters */}
          <div className="bg-[#0d2347]/80 rounded-2xl border border-blue-500/20 p-4 space-y-3 text-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-300 block">
              Parámetros de la Emisión
            </span>

            <div>
              <label className="block text-slate-400 mb-1">Jornada a Resumir</label>
              <select
                value={selectedRound}
                onChange={(e) => setSelectedRound(Number(e.target.value))}
                className="w-full bg-[#0a1628] border border-blue-500/30 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-400"
              >
                {rounds.map((r) => (
                  <option key={r} value={r}>
                    Jornada {r} (Fecha Provincial)
                  </option>
                ))}
              </select>
            </div>

            {selectedFormat === 'radio' && (
              <>
                <div>
                  <label className="block text-slate-400 mb-1">Nombre del Locutor / Comentarista</label>
                  <input
                    type="text"
                    value={announcerName}
                    onChange={(e) => setAnnouncerName(e.target.value)}
                    className="w-full bg-[#0a1628] border border-blue-500/30 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-400"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Emisora Radial</label>
                  <input
                    type="text"
                    value={radioStation}
                    onChange={(e) => setRadioStation(e.target.value)}
                    className="w-full bg-[#0a1628] border border-blue-500/30 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-400"
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right Column: Dynamic Live Preview Viewport (8 cols) */}
        <div className="lg:col-span-8 flex flex-col space-y-3">
          {/* Top Actions Bar */}
          <div className="bg-[#0d2347] rounded-2xl border border-blue-500/20 px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-indigo-400 text-[20px]">description</span>
              <span className="text-xs font-bold text-white font-syne uppercase">
                Vista Previa del Documento Oficial
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyText}
                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow cursor-pointer active:scale-95"
              >
                <span className="material-symbols-outlined text-[16px]">content_copy</span>
                <span>Copiar Texto</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadFile}
                className="px-3 py-1.5 rounded-xl bg-[#0a1628] hover:bg-blue-950 text-indigo-200 border border-blue-500/30 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">download</span>
                <span>Descargar</span>
              </button>
            </div>
          </div>

          {/* Terminal / Document Preview Window */}
          <div className="bg-[#060e1b] rounded-2xl border border-blue-500/30 p-5 sm:p-7 shadow-2xl overflow-hidden flex-1 flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-blue-500/20 mb-4 text-[11px] text-blue-300/70 font-mono">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                <span className="ml-2 font-bold text-slate-300">
                  boletin_{selectedFormat}_jornada_{selectedRound}.md
                </span>
              </div>
              <span className="uppercase text-[9px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/30">
                Pauta Oficial
              </span>
            </div>

            <pre className="flex-1 whitespace-pre-wrap font-mono text-xs sm:text-[13px] leading-relaxed text-blue-100/90 overflow-y-auto max-h-[620px] scrollbar-thin select-text">
              {getActiveContent()}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useRef } from 'react';
import { useTournament } from '../context/TournamentContext';
import { Match, MatchOfficialAssignment } from '../types/tournament';
import { downloadMatchOfficialSheetPdf } from '../utils/pdfReportGenerator';

interface Props {
  match: Match;
  onClose: () => void;
}

export const MatchOfficialSheetModal: React.FC<Props> = ({ match, onClose }) => {
  const { teams, players, tournament, showToast } = useTournament();
  const printContainerRef = useRef<HTMLDivElement>(null);

  const home = teams.find((t) => t.id === match.homeTeamId) || {
    id: match.homeTeamId,
    name: 'Equipo Local',
    shortName: 'LOC',
    city: 'Apolo',
    stadium: 'Estadio Municipal',
    coach: 'D.T. Local',
    badgeBg: '#1a4fd6',
    badgeColor: '#ffffff',
  };

  const away = teams.find((t) => t.id === match.awayTeamId) || {
    id: match.awayTeamId,
    name: 'Equipo Visitante',
    shortName: 'VIS',
    city: 'Franz Tamayo',
    stadium: 'Estadio Local',
    coach: 'D.T. Visitante',
    badgeBg: '#f0b429',
    badgeColor: '#0a1628',
  };

  const homePlayers = players.filter((p) => p.teamId === match.homeTeamId);
  const awayPlayers = players.filter((p) => p.teamId === match.awayTeamId);

  const isSigned = !!match.isRefereeSigned;
  const isFinished = match.status === 'finalizado';

  // Handle PDF Download
  const handleDownloadPdf = () => {
    try {
      downloadMatchOfficialSheetPdf({
        match,
        homeTeam: home,
        awayTeam: away,
        homePlayers,
        awayPlayers,
        tournament,
      });
      showToast('Acta Oficial descargada en formato PDF de alta resolución', 'success');
    } catch (err) {
      console.error('Error generating PDF:', err);
      showToast('Error al generar el documento PDF', 'warning');
    }
  };

  // Handle Print Action
  const handlePrint = () => {
    window.print();
  };

  // Handle Copy summary to clipboard
  const handleCopySummary = () => {
    const mainRef =
      match.officials?.find((o) => o.role === 'Principal')?.refereeName || 'Marco Antonio Quispe';
    const goalsSummary = match.events
      .filter((e) => e.type === 'gol' || e.type === 'penal' || e.type === 'autogol')
      .map((e) => `• ${e.minute}' ${e.playerName} (${e.teamName})`)
      .join('\n');

    const summary = `📄 *ACTA OFICIAL DE PARTIDO — APOLODIGITAL LEAGUE* 🇧🇴
🏆 Torneo: ${tournament.name} (${tournament.season})
📍 Sede: ${match.pitch || 'Estadio Municipal de Apolo'}
📅 Fecha: ${match.date} | ${match.time} BO | Jornada ${match.round}

⚔️ *${home.name.toUpperCase()}* ${match.homeScore ?? 0} - ${match.awayScore ?? 0} *${away.name.toUpperCase()}*
Estado: ${isSigned ? '🔒 ACTA CERRADA Y FIRMADA' : isFinished ? '✅ FINALIZADO' : '⏳ PROGRAMADO'}

⚽ *Goles e Incidencias:*
${goalsSummary || 'Sin goles registrados'}

⚖️ *Terna Arbitral:*
Principal: ${mainRef}
${match.officials?.map((o) => `${o.role}: ${o.refereeName} (${o.licenseNumber || 'FBF'})`).join('\n') || ''}

🔐 Sello Digital: ${match.refereeSignatureHash || 'sig_apolo_fbf_official_hash'}`;

    navigator.clipboard.writeText(summary);
    showToast('Resumen del acta oficial copiado al portapapeles', 'info');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-[#0b172a] border border-blue-500/30 rounded-3xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[95vh] overflow-hidden my-auto">
        {/* Modal Top Control Bar */}
        <div className="bg-[#0d2347] px-6 py-4 border-b border-blue-500/20 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-400 shadow-md">
              <span className="material-symbols-outlined text-[22px]">picture_as_pdf</span>
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white font-syne flex items-center gap-2">
                <span>Planilla Oficial de Juego (Acta de Encuentro)</span>
                {isSigned && (
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-400/30">
                    Sello Digital
                  </span>
                )}
              </h2>
              <p className="text-xs text-blue-200/70">
                Formato reglamentario A4 para registro, archivo e impresión oficial
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">download</span>
              <span>Descargar PDF</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-blue-600/50 hover:bg-blue-600 text-white border border-blue-400/30 transition-all cursor-pointer"
              title="Imprimir documento en A4"
            >
              <span className="material-symbols-outlined text-[18px]">print</span>
              <span className="hidden sm:inline">Imprimir</span>
            </button>

            <button
              type="button"
              onClick={handleCopySummary}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-[#0a1628] hover:bg-blue-950 text-blue-200 border border-blue-500/30 transition-all cursor-pointer"
              title="Copiar texto oficial"
            >
              <span className="material-symbols-outlined text-[18px]">content_copy</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-all cursor-pointer ml-1"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        {/* Document Preview Viewport (Formatted like physical Paper A4) */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-slate-900/60 flex justify-center">
          <div
            ref={printContainerRef}
            className="w-full max-w-[800px] bg-white text-slate-900 rounded-xl shadow-2xl p-6 sm:p-8 space-y-4 text-xs font-sans print:p-0 print:m-0 print:shadow-none print:w-full print:rounded-none"
            style={{ minHeight: '1000px' }}
          >
            {/* 1. Header FBF / Apolo */}
            <div className="bg-[#0d2347] text-white p-4 rounded-lg flex items-center justify-between border-b-4 border-amber-400">
              <div>
                <div className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">
                  Federación Boliviana de Fútbol (FBF) · Colegio de Árbitros
                </div>
                <h1 className="text-sm sm:text-base font-black font-syne tracking-wide uppercase">
                  Asociación Provincial de Fútbol Franz Tamayo · Apolo
                </h1>
                <p className="text-[11px] text-blue-200 font-medium">
                  {tournament.name} ({tournament.season}) — Planilla Técnica Oficial
                </p>
              </div>

              <div className="text-right hidden sm:block">
                <div className="bg-blue-700/60 border border-blue-400/40 rounded px-2.5 py-1 text-[10px] font-bold">
                  Sede: Apolo (La Paz)
                </div>
                <div className="text-[9px] text-amber-300 font-bold mt-1 font-mono">
                  ACTA N° {match.id.toUpperCase()}
                </div>
              </div>
            </div>

            {/* 2. Match Details Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-[11px]">
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Jornada</span>
                <span className="font-bold text-slate-800">
                  {match.roundName || `Fecha ${match.round}`}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Fecha y Hora</span>
                <span className="font-bold text-slate-800">
                  {match.date} · {match.time} BO
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Escenario</span>
                <span className="font-bold text-slate-800 truncate block">
                  {match.pitch || 'Estadio Municipal Apolo'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Certificación</span>
                <span
                  className={`inline-block font-black text-[9px] uppercase px-2 py-0.5 rounded ${
                    isSigned
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : isFinished
                      ? 'bg-blue-100 text-blue-800 border border-blue-300'
                      : 'bg-amber-100 text-amber-800 border border-amber-300'
                  }`}
                >
                  {isSigned ? '🔒 Ratificada' : isFinished ? 'Finalizado' : 'Programado'}
                </span>
              </div>
            </div>

            {/* 3. Scoreboard Banner */}
            <div className="bg-[#0a1628] text-white p-3.5 rounded-xl flex items-center justify-between border border-blue-500/20">
              <div className="flex items-center gap-3 w-5/12">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 shadow border"
                  style={{ backgroundColor: home.badgeBg, color: home.badgeColor }}
                >
                  {home.shortName}
                </div>
                <div className="min-w-0">
                  <h3 className="font-black font-syne text-xs sm:text-sm truncate">
                    {home.name.toUpperCase()}
                  </h3>
                  <span className="text-[10px] text-blue-300 block">Club Local</span>
                </div>
              </div>

              <div className="text-center w-2/12">
                <div className="bg-[#060d19] border border-amber-400/50 px-3 py-1 rounded-lg">
                  <span className="text-base sm:text-xl font-black text-amber-400 font-syne tracking-widest">
                    {match.homeScore !== null && match.awayScore !== null
                      ? `${match.homeScore} - ${match.awayScore}`
                      : 'VS'}
                  </span>
                </div>
                <span className="text-[9px] text-slate-400 block mt-0.5">Marcador Oficial</span>
              </div>

              <div className="flex items-center justify-end gap-3 w-5/12 text-right">
                <div className="min-w-0">
                  <h3 className="font-black font-syne text-xs sm:text-sm truncate">
                    {away.name.toUpperCase()}
                  </h3>
                  <span className="text-[10px] text-blue-300 block">Club Visitante</span>
                </div>
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 shadow border"
                  style={{ backgroundColor: away.badgeBg, color: away.badgeColor }}
                >
                  {away.shortName}
                </div>
              </div>
            </div>

            {/* 4. Rosters Side-by-Side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Home Team Roster */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="bg-blue-900 text-white px-3 py-1.5 font-bold text-[11px] flex justify-between">
                  <span>Plantilla: {home.name}</span>
                  <span className="text-[10px] text-blue-200">Local</span>
                </div>
                <table className="w-full text-left text-[10px]">
                  <thead className="bg-slate-100 text-slate-600 border-b border-slate-200 font-semibold">
                    <tr>
                      <th className="p-1 pl-2 w-7">N°</th>
                      <th className="p-1">Jugador</th>
                      <th className="p-1">C.I.</th>
                      <th className="p-1">Pos</th>
                      <th className="p-1 text-center">Inc.</th>
                      <th className="p-1 text-center w-12">Firma</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {homePlayers.slice(0, 11).map((p) => {
                      const goals = match.events.filter(
                        (e) => (e.type === 'gol' || e.type === 'penal') && (e.playerId === p.id || e.playerName === p.name)
                      ).length;
                      const yellow = match.events.some(
                        (e) => e.type === 'amarilla' && (e.playerId === p.id || e.playerName === p.name)
                      );
                      const red = match.events.some(
                        (e) => e.type === 'roja' && (e.playerId === p.id || e.playerName === p.name)
                      );

                      return (
                        <tr key={p.id} className="hover:bg-slate-50">
                          <td className="p-1 pl-2 font-black text-slate-800">{p.number}</td>
                          <td className="p-1 font-semibold text-slate-900 truncate max-w-[120px]">
                            {p.name}
                          </td>
                          <td className="p-1 text-slate-600 font-mono text-[9px]">{p.documentId || 'S/D'}</td>
                          <td className="p-1 text-slate-500 uppercase text-[9px]">
                            {p.position.substring(0, 3)}
                          </td>
                          <td className="p-1 text-center font-bold">
                            {goals > 0 && <span className="text-emerald-600 mr-0.5">⚽{goals > 1 ? goals : ''}</span>}
                            {yellow && <span className="text-amber-500 mr-0.5">🟨</span>}
                            {red && <span className="text-red-500 mr-0.5">🟥</span>}
                            {!goals && !yellow && !red && <span className="text-slate-300">-</span>}
                          </td>
                          <td className="p-1 text-center text-slate-300 text-[8px]">_________</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Away Team Roster */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="bg-amber-600 text-white px-3 py-1.5 font-bold text-[11px] flex justify-between">
                  <span>Plantilla: {away.name}</span>
                  <span className="text-[10px] text-amber-100">Visitante</span>
                </div>
                <table className="w-full text-left text-[10px]">
                  <thead className="bg-slate-100 text-slate-600 border-b border-slate-200 font-semibold">
                    <tr>
                      <th className="p-1 pl-2 w-7">N°</th>
                      <th className="p-1">Jugador</th>
                      <th className="p-1">C.I.</th>
                      <th className="p-1">Pos</th>
                      <th className="p-1 text-center">Inc.</th>
                      <th className="p-1 text-center w-12">Firma</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {awayPlayers.slice(0, 11).map((p) => {
                      const goals = match.events.filter(
                        (e) => (e.type === 'gol' || e.type === 'penal') && (e.playerId === p.id || e.playerName === p.name)
                      ).length;
                      const yellow = match.events.some(
                        (e) => e.type === 'amarilla' && (e.playerId === p.id || e.playerName === p.name)
                      );
                      const red = match.events.some(
                        (e) => e.type === 'roja' && (e.playerId === p.id || e.playerName === p.name)
                      );

                      return (
                        <tr key={p.id} className="hover:bg-slate-50">
                          <td className="p-1 pl-2 font-black text-slate-800">{p.number}</td>
                          <td className="p-1 font-semibold text-slate-900 truncate max-w-[120px]">
                            {p.name}
                          </td>
                          <td className="p-1 text-slate-600 font-mono text-[9px]">{p.documentId || 'S/D'}</td>
                          <td className="p-1 text-slate-500 uppercase text-[9px]">
                            {p.position.substring(0, 3)}
                          </td>
                          <td className="p-1 text-center font-bold">
                            {goals > 0 && <span className="text-emerald-600 mr-0.5">⚽{goals > 1 ? goals : ''}</span>}
                            {yellow && <span className="text-amber-500 mr-0.5">🟨</span>}
                            {red && <span className="text-red-500 mr-0.5">🟥</span>}
                            {!goals && !yellow && !red && <span className="text-slate-300">-</span>}
                          </td>
                          <td className="p-1 text-center text-slate-300 text-[8px]">_________</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 5. Incidencias Minutadas */}
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="bg-[#0d2347] text-white px-3 py-1 font-bold text-[10px] uppercase tracking-wider">
                Incidencias Minuto a Minuto (Goles, Penales y Amonestaciones)
              </div>
              <div className="p-2 bg-slate-50">
                {match.events.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {match.events.map((ev) => (
                      <div
                        key={ev.id}
                        className="bg-white border border-slate-200 rounded px-2.5 py-1 flex items-center justify-between text-[10px]"
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="font-black text-blue-900 font-mono w-7 shrink-0">
                            {ev.minute}'
                          </span>
                          <span>
                            {ev.type === 'gol' && '⚽ Gol'}
                            {ev.type === 'penal' && '⚽ (Penal)'}
                            {ev.type === 'autogol' && '🛑 (Autogol)'}
                            {ev.type === 'amarilla' && '🟨 T. Amarilla'}
                            {ev.type === 'roja' && '🟥 T. Roja'}
                          </span>
                          <span className="font-bold text-slate-800 truncate">{ev.playerName}</span>
                        </div>
                        <span className="text-[9px] text-slate-500 font-medium shrink-0 ml-1">
                          {ev.teamName}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-500 italic text-center py-1">
                    Sin incidencias registradas en este encuentro
                  </p>
                )}
              </div>
            </div>

            {/* 6. Terna Arbitral */}
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="bg-[#0d2347] text-white px-3 py-1 font-bold text-[10px] uppercase tracking-wider">
                Cuerpo Arbitral Oficial (Colegio de Árbitros Franz Tamayo)
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2.5 bg-slate-50 text-[10px]">
                <div>
                  <span className="font-bold text-blue-900 block">ÁRBITRO CENTRAL</span>
                  <span className="font-semibold text-slate-800 block truncate">
                    {match.officials?.find((o) => o.role === 'Principal')?.refereeName ||
                      'Marco Antonio Quispe'}
                  </span>
                  <span className="text-[9px] text-slate-500 font-mono">
                    Lic: {match.officials?.find((o) => o.role === 'Principal')?.licenseNumber || 'FBF-LP-0412'}
                  </span>
                </div>
                <div>
                  <span className="font-bold text-blue-900 block">ASISTENTE 1</span>
                  <span className="font-semibold text-slate-800 block truncate">
                    {match.officials?.find((o) => o.role === 'Asistente 1')?.refereeName ||
                      'Ronald Calle Chuquimia'}
                  </span>
                  <span className="text-[9px] text-slate-500 font-mono">
                    Lic: {match.officials?.find((o) => o.role === 'Asistente 1')?.licenseNumber || 'FBF-LP-0688'}
                  </span>
                </div>
                <div>
                  <span className="font-bold text-blue-900 block">ASISTENTE 2</span>
                  <span className="font-semibold text-slate-800 block truncate">
                    {match.officials?.find((o) => o.role === 'Asistente 2')?.refereeName ||
                      'Grover Mamani Apaza'}
                  </span>
                  <span className="text-[9px] text-slate-500 font-mono">
                    Lic: {match.officials?.find((o) => o.role === 'Asistente 2')?.licenseNumber || 'FBF-LP-0715'}
                  </span>
                </div>
                <div>
                  <span className="font-bold text-blue-900 block">CUARTO ÁRBITRO</span>
                  <span className="font-semibold text-slate-800 block truncate">
                    {match.officials?.find((o) => o.role === 'Cuarto Árbitro')?.refereeName ||
                      'Fernando Vargas Aliaga'}
                  </span>
                  <span className="text-[9px] text-slate-500 font-mono">
                    Lic: {match.officials?.find((o) => o.role === 'Cuarto Árbitro')?.licenseNumber || 'AFT-REF-0104'}
                  </span>
                </div>
              </div>
            </div>

            {/* 7. Observaciones del Árbitro & Sello SHA-256 */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 space-y-1">
              <span className="text-[10px] font-bold text-slate-700 uppercase block">
                Informe Arbitral y Observaciones de Mesa:
              </span>
              <p className="text-[10px] text-slate-600 italic">
                {match.refereeNotes ||
                  'Partido disputado con normalidad dentro del tiempo reglamentario. No se presentaron reclamos ni objeciones a las nóminas en mesa de control.'}
              </p>

              <div className="pt-1 border-t border-slate-200 flex flex-wrap items-center justify-between text-[9px] text-slate-500 font-mono">
                <span>
                  TOKEN CRIPTOGRÁFICO: {match.refereeSignatureHash || 'sig_official_sha256_apolo_league'}
                </span>
                <span>FECHA: {match.refereeSignedAt || match.date}</span>
              </div>
            </div>

            {/* 8. Cuadros de Firmas Oficiales */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
              <div className="border border-slate-300 rounded p-2 text-center h-20 flex flex-col justify-end">
                {isSigned && (
                  <span className="text-[9px] font-black text-emerald-600 block mb-1">
                    ✓ FIRMA DIGITAL
                  </span>
                )}
                <div className="border-t border-slate-400 pt-1">
                  <span className="font-bold text-[9px] text-slate-800 block">ÁRBITRO CENTRAL</span>
                  <span className="text-[8px] text-slate-500 block">Firma y C.I. / FBF</span>
                </div>
              </div>

              <div className="border border-slate-300 rounded p-2 text-center h-20 flex flex-col justify-end">
                <div className="border-t border-slate-400 pt-1">
                  <span className="font-bold text-[9px] text-slate-800 block">CAPITÁN LOCAL</span>
                  <span className="text-[8px] text-slate-500 block truncate">{home.name}</span>
                </div>
              </div>

              <div className="border border-slate-300 rounded p-2 text-center h-20 flex flex-col justify-end">
                <div className="border-t border-slate-400 pt-1">
                  <span className="font-bold text-[9px] text-slate-800 block">CAPITÁN VISITANTE</span>
                  <span className="text-[8px] text-slate-500 block truncate">{away.name}</span>
                </div>
              </div>

              <div className="border border-slate-300 rounded p-2 text-center h-20 flex flex-col justify-end">
                <div className="border-t border-slate-400 pt-1">
                  <span className="font-bold text-[9px] text-slate-800 block">VEEDOR OFICIAL</span>
                  <span className="text-[8px] text-slate-500 block">Comisión Técnica</span>
                </div>
              </div>
            </div>

            {/* 9. Footer Watermark */}
            <div className="pt-2 border-t border-slate-200 text-center text-[9px] text-slate-400 flex items-center justify-between">
              <span>ApoloDigital League Engine (apolodigital.lat) · Validación Oficial FBF</span>
              <span>Documento Deportivo Legal · Impresión A4</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

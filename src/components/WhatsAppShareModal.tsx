import React, { useState } from 'react';
import { useTournament } from '../context/TournamentContext';

export const WhatsAppShareModal: React.FC = () => {
  const {
    isShareModalOpen,
    setIsShareModalOpen,
    tournament,
    standings,
    matches,
    teams,
    players,
    showToast,
  } = useTournament();

  if (!isShareModalOpen) return null;

  const [reportType, setReportType] = useState<'standings' | 'results' | 'fixtures'>('standings');

  const getTeam = (teamId: string) => teams.find((t) => t.id === teamId);

  // Generate text according to type
  const generateReportText = () => {
    const header = `⚽ *${tournament.name.toUpperCase()}* 🇧🇴\n📍 *${tournament.location}*\n🏆 *Organiza: ${tournament.organizer}*\n━━━━━━━━━━━━━━━━━━━━\n`;
    const footer = `\n━━━━━━━━━━━━━━━━━━━━\n📲 *Desarrollado por Apolodigital.lat*\n⚡ Tecnología deportiva desde la Bolivia Real 🇧🇴\n💬 Consultas WhatsApp: +591 765 09789\n🌐 Web: https://apolodigital.lat`;

    if (reportType === 'standings') {
      let body = `📊 *TABLA DE POSICIONES ACTUALIZADA*\n\n`;
      standings.forEach((row, idx) => {
        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
        const diff = row.goalDifference > 0 ? `+${row.goalDifference}` : `${row.goalDifference}`;
        body += `${medal} *${row.team.name}* — ${row.points} pts | PJ:${row.played} (DG: ${diff})\n`;
      });

      const topScorer = [...players].sort((a, b) => b.goals - a.goals)[0];
      if (topScorer && topScorer.goals > 0) {
        const scorerTeam = getTeam(topScorer.teamId);
        body += `\n🎯 *Goleador del Torneo:* ${topScorer.name} (${scorerTeam?.shortName}) con ${topScorer.goals} goles.\n`;
      }

      return header + body + footer;
    }

    if (reportType === 'results') {
      const finishedOrLive = matches.filter((m) => m.status === 'finalizado' || m.status === 'en_juego');
      let body = `🔥 *RESULTADOS Y MARCADORES EN VIVO*\n\n`;

      if (finishedOrLive.length === 0) {
        body += `No hay partidos jugados recientemente.\n`;
      } else {
        finishedOrLive.forEach((m) => {
          const home = getTeam(m.homeTeamId);
          const away = getTeam(m.awayTeamId);
          const status = m.status === 'en_juego' ? `(🔴 EN VIVO ${m.currentMinute || ''}')` : '(Final)';
          body += `⚽ *${home?.name}* ${m.homeScore ?? 0} - ${m.awayScore ?? 0} *${away?.name}* ${status}\n`;
        });
      }

      return header + body + footer;
    }

    // Fixtures
    const scheduled = matches.filter((m) => m.status === 'programado');
    let body = `📅 *PRÓXIMA FECHA Y HORARIOS*\n\n`;

    if (scheduled.length === 0) {
      body += `No hay partidos programados pendientes.\n`;
    } else {
      scheduled.slice(0, 6).forEach((m) => {
        const home = getTeam(m.homeTeamId);
        const away = getTeam(m.awayTeamId);
        body += `🗓️ ${m.date} | ⏰ ${m.time}\n⚔️ *${home?.name}* vs *${away?.name}*\n🏟️ Cancha: ${m.pitch}\n\n`;
      });
    }

    return header + body + footer;
  };

  const reportText = generateReportText();

  const handleCopy = () => {
    navigator.clipboard.writeText(reportText);
    showToast('Reporte copiado al portapapeles listo para pegar en WhatsApp', 'success');
  };

  const handleOpenWhatsApp = () => {
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(reportText)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-lg bg-[#0d2347] border border-blue-500/30 rounded-3xl shadow-2xl p-6 space-y-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-blue-500/20 pb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-400">share</span>
            <h3 className="font-syne font-bold text-lg text-white">Compartir por WhatsApp</h3>
          </div>
          <button
            onClick={() => setIsShareModalOpen(false)}
            className="text-slate-400 hover:text-white"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Report Type Selector */}
        <div className="grid grid-cols-3 gap-2 bg-[#0a1628] p-1 rounded-xl border border-blue-500/20">
          <button
            onClick={() => setReportType('standings')}
            className={`py-2 px-2 rounded-lg text-xs font-bold transition-all ${
              reportType === 'standings' ? 'bg-blue-600 text-white shadow' : 'text-slate-400'
            }`}
          >
            📊 Posiciones
          </button>
          <button
            onClick={() => setReportType('results')}
            className={`py-2 px-2 rounded-lg text-xs font-bold transition-all ${
              reportType === 'results' ? 'bg-blue-600 text-white shadow' : 'text-slate-400'
            }`}
          >
            ⚽ Resultados
          </button>
          <button
            onClick={() => setReportType('fixtures')}
            className={`py-2 px-2 rounded-lg text-xs font-bold transition-all ${
              reportType === 'fixtures' ? 'bg-blue-600 text-white shadow' : 'text-slate-400'
            }`}
          >
            📅 Próximos
          </button>
        </div>

        {/* Text Preview */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <label className="text-xs text-blue-300 font-semibold mb-1">
            Vista previa del mensaje formateado:
          </label>
          <textarea
            readOnly
            value={reportText}
            className="w-full flex-1 min-h-[220px] bg-[#0a1628] border border-blue-500/30 rounded-xl p-3 text-white text-xs font-mono resize-none focus:outline-none focus:border-emerald-400/50"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleCopy}
            className="flex-1 flex items-center justify-center gap-2 bg-blue-600/80 hover:bg-blue-600 text-white font-bold text-xs py-3 rounded-xl border border-blue-400/30 transition-all active:scale-95"
          >
            <span className="material-symbols-outlined text-base">content_copy</span>
            <span>Copiar Mensaje</span>
          </button>

          <button
            onClick={handleOpenWhatsApp}
            className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-3 rounded-xl border border-emerald-400/40 shadow-lg shadow-emerald-950/40 transition-all active:scale-95"
          >
            <span className="material-symbols-outlined text-base">send</span>
            <span>Enviar a WhatsApp</span>
          </button>
        </div>
      </div>
    </div>
  );
};

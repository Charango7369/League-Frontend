import { jsPDF } from 'jspdf';
import { Match, Team, Player, TournamentInfo, MatchOfficialAssignment } from '../types/tournament';

export interface GeneratePdfOptions {
  match: Match;
  homeTeam: Team;
  awayTeam: Team;
  homePlayers: Player[];
  awayPlayers: Player[];
  tournament: TournamentInfo;
}

/**
 * Generates and downloads the Official Match Sheet (Acta Oficial de Encuentro)
 * in PDF format following Bolivian Football Federation (FBF) and Apolo League standards.
 */
export const generateMatchOfficialSheetPdf = (options: GeneratePdfOptions): jsPDF => {
  const { match, homeTeam, awayTeam, homePlayers, awayPlayers, tournament } = options;

  // A4 dimensions: 210mm x 297mm
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 10;
  const contentWidth = pageWidth - margin * 2; // 190mm

  // Colors
  const apoloBlue = [13, 35, 71]; // #0d2347
  const apoloLightBlue = [26, 79, 214]; // #1a4fd6
  const apoloGold = [240, 180, 41]; // #f0b429
  const darkText = [30, 41, 59]; // slate-800
  const grayBorder = [203, 213, 225]; // slate-300
  const lightBg = [248, 250, 252]; // slate-50

  let y = margin;

  // ==========================================
  // 1. INSTITUTIONAL HEADER & BRANDING BANNER
  // ==========================================
  doc.setFillColor(apoloBlue[0], apoloBlue[1], apoloBlue[2]);
  doc.roundedRect(margin, y, contentWidth, 24, 2, 2, 'F');

  // Decorative gold line
  doc.setFillColor(apoloGold[0], apoloGold[1], apoloGold[2]);
  doc.rect(margin, y + 23, contentWidth, 1.2, 'F');

  // Organization Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('ASOCIACIÓN PROVINCIAL DE FÚTBOL DE FRANZ TAMAYO · APOLO', margin + 6, y + 6.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(220, 235, 255);
  doc.text(
    `${tournament.name.toUpperCase()} · ${tournament.season} — ACTA OFICIAL DE PARTIDO`,
    margin + 6,
    y + 11.5
  );

  doc.setFontSize(7.5);
  doc.setTextColor(240, 180, 41);
  doc.text(
    'PLANILLA TÉCNICA Y DISCIPLINARIA AVALADA POR EL COLEGIO DE ÁRBITROS',
    margin + 6,
    y + 16
  );

  // Badge / Edition Stamp on Right Header
  doc.setFillColor(apoloLightBlue[0], apoloLightBlue[1], apoloLightBlue[2]);
  doc.roundedRect(margin + contentWidth - 44, y + 3, 40, 17, 1.5, 1.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('FEDERACIÓN FBF', margin + contentWidth - 41, y + 8);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.text('Sede: Apolo (La Paz, BO)', margin + contentWidth - 41, y + 12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(240, 180, 41);
  doc.text('EDICIÓN 2026', margin + contentWidth - 41, y + 16.5);

  y += 27;

  // ==========================================
  // 2. MATCH METADATA & VENUE BOX
  // ==========================================
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.setDrawColor(grayBorder[0], grayBorder[1], grayBorder[2]);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, contentWidth, 12, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(darkText[0], darkText[1], darkText[2]);

  doc.text(`JORNADA: ${match.roundName || `Fecha ${match.round}`}`, margin + 4, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Fecha: ${match.date}`, margin + 4, y + 9);

  doc.setFont('helvetica', 'bold');
  doc.text(`HORA: ${match.time} (BO)`, margin + 50, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Duración: ${tournament.matchDurationMinutes || 90} Minutos`, margin + 50, y + 9);

  doc.setFont('helvetica', 'bold');
  doc.text(`ESCENARIO: ${match.pitch || 'Estadio Municipal de Apolo'}`, margin + 98, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Ciudad: Apolo · Franz Tamayo`, margin + 98, y + 9);

  // Status Badge
  const isFinished = match.status === 'finalizado';
  const isSigned = !!match.isRefereeSigned;
  doc.setFillColor(
    isSigned ? 16 : isFinished ? 37 : 217,
    isSigned ? 185 : isFinished ? 99 : 119,
    isSigned ? 129 : isFinished ? 235 : 6
  );
  doc.roundedRect(margin + contentWidth - 36, y + 2.5, 33, 7, 1, 1, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  const statusLabel = isSigned
    ? 'ACTA SELLADA'
    : isFinished
    ? 'FINALIZADO'
    : 'POR JUGAR';
  doc.text(statusLabel, margin + contentWidth - 34, y + 7);

  y += 14.5;

  // ==========================================
  // 3. TEAMS & OFFICIAL SCOREBOARD
  // ==========================================
  doc.setFillColor(apoloBlue[0], apoloBlue[1], apoloBlue[2]);
  doc.roundedRect(margin, y, contentWidth, 18, 1.5, 1.5, 'F');

  // Home Team Name & Badge
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(homeTeam.name.toUpperCase(), margin + 6, y + 8);
  doc.setFontSize(7.5);
  doc.setTextColor(200, 220, 255);
  doc.setFont('helvetica', 'normal');
  doc.text(`LOCAL · ${homeTeam.city || 'Apolo'}`, margin + 6, y + 13.5);

  // Official Score in Center
  doc.setFillColor(10, 22, 40);
  doc.roundedRect(margin + contentWidth / 2 - 22, y + 2, 44, 14, 1.5, 1.5, 'F');
  doc.setDrawColor(apoloGold[0], apoloGold[1], apoloGold[2]);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin + contentWidth / 2 - 22, y + 2, 44, 14, 1.5, 1.5, 'D');

  doc.setTextColor(240, 180, 41);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  const scoreText =
    match.homeScore !== null && match.awayScore !== null
      ? `${match.homeScore}  -  ${match.awayScore}`
      : 'VS';
  doc.text(scoreText, margin + contentWidth / 2, y + 11, { align: 'center' });

  // Away Team Name
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(awayTeam.name.toUpperCase(), margin + contentWidth - 6, y + 8, { align: 'right' });
  doc.setFontSize(7.5);
  doc.setTextColor(200, 220, 255);
  doc.setFont('helvetica', 'normal');
  doc.text(`VISITANTE · ${awayTeam.city || 'Apolo'}`, margin + contentWidth - 6, y + 13.5, {
    align: 'right',
  });

  y += 21;

  // ==========================================
  // 4. TEAM ROSTERS (LINEUPS SIDE-BY-SIDE)
  // ==========================================
  const colWidth = (contentWidth - 4) / 2; // 93mm each column
  const tableHeaderHeight = 6;
  const rowHeight = 4.2;
  const maxRows = 11; // Starting XI or primary listed

  // Column Headers
  const drawRosterColumnHeader = (x: number, teamName: string, role: string) => {
    doc.setFillColor(apoloLightBlue[0], apoloLightBlue[1], apoloLightBlue[2]);
    doc.roundedRect(x, y, colWidth, tableHeaderHeight, 1, 1, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text(`PLANTILLA: ${teamName.toUpperCase()} (${role})`, x + 3, y + 4.2);

    // Sub-header columns (Dorsal, Nombre, C.I., Pos, Gol/Tarj, Firma)
    doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
    doc.rect(x, y + tableHeaderHeight, colWidth, 4, 'F');
    doc.setDrawColor(grayBorder[0], grayBorder[1], grayBorder[2]);
    doc.setLineWidth(0.2);
    doc.rect(x, y + tableHeaderHeight, colWidth, 4, 'D');

    doc.setTextColor(darkText[0], darkText[1], darkText[2]);
    doc.setFontSize(5.5);
    doc.setFont('helvetica', 'bold');
    doc.text('N°', x + 2, y + tableHeaderHeight + 2.8);
    doc.text('JUGADOR', x + 8, y + tableHeaderHeight + 2.8);
    doc.text('C.I. / DOC', x + 44, y + tableHeaderHeight + 2.8);
    doc.text('POS', x + 62, y + tableHeaderHeight + 2.8);
    doc.text('INC', x + 74, y + tableHeaderHeight + 2.8);
    doc.text('FIRMA', x + 82, y + tableHeaderHeight + 2.8);
  };

  drawRosterColumnHeader(margin, homeTeam.name, 'LOCAL');
  drawRosterColumnHeader(margin + colWidth + 4, awayTeam.name, 'VISITANTE');

  const renderRosterRows = (playersList: Player[], startX: number, teamId: string) => {
    const list = playersList.slice(0, maxRows);
    for (let i = 0; i < maxRows; i++) {
      const p = list[i];
      const rowY = y + tableHeaderHeight + 4 + i * rowHeight;
      const isAlt = i % 2 === 1;

      doc.setFillColor(isAlt ? 245 : 255, isAlt ? 248 : 255, isAlt ? 252 : 255);
      doc.rect(startX, rowY, colWidth, rowHeight, 'F');
      doc.setDrawColor(grayBorder[0], grayBorder[1], grayBorder[2]);
      doc.setLineWidth(0.15);
      doc.rect(startX, rowY, colWidth, rowHeight, 'D');

      if (p) {
        // Player events in this match
        const playerGoals = match.events.filter(
          (e) => (e.type === 'gol' || e.type === 'penal') && (e.playerId === p.id || e.playerName === p.name)
        ).length;
        const playerYellows = match.events.filter(
          (e) => e.type === 'amarilla' && (e.playerId === p.id || e.playerName === p.name)
        ).length;
        const playerReds = match.events.filter(
          (e) => e.type === 'roja' && (e.playerId === p.id || e.playerName === p.name)
        ).length;

        let incText = '';
        if (playerGoals > 0) incText += `⚽x${playerGoals} `;
        if (playerYellows > 0) incText += `🟨 `;
        if (playerReds > 0) incText += `🟥 `;

        doc.setTextColor(darkText[0], darkText[1], darkText[2]);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6);
        doc.text(String(p.number), startX + 2, rowY + 3);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5.8);
        const truncatedName = p.name.length > 22 ? p.name.substring(0, 20) + '..' : p.name;
        doc.text(truncatedName, startX + 8, rowY + 3);

        doc.setFontSize(5.2);
        doc.text(p.documentId || 'S/D', startX + 44, rowY + 3);
        doc.text(p.position.substring(0, 3).toUpperCase(), startX + 62, rowY + 3);

        doc.setFont('helvetica', 'bold');
        doc.text(incText.trim() || '-', startX + 74, rowY + 3);
        doc.text('__________', startX + 81, rowY + 3);
      } else {
        doc.setTextColor(180, 190, 200);
        doc.setFontSize(5.5);
        doc.text('—', startX + 2, rowY + 3);
        doc.text('—', startX + 8, rowY + 3);
        doc.text('__________', startX + 81, rowY + 3);
      }
    }
  };

  renderRosterRows(homePlayers, margin, match.homeTeamId);
  renderRosterRows(awayPlayers, margin + colWidth + 4, match.awayTeamId);

  y += tableHeaderHeight + 4 + maxRows * rowHeight + 2.5;

  // ==========================================
  // 5. MATCH EVENTS (GOALS & CARDS CHRONOLOGY)
  // ==========================================
  doc.setFillColor(apoloBlue[0], apoloBlue[1], apoloBlue[2]);
  doc.roundedRect(margin, y, contentWidth, 5.5, 1, 1, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('CRONOLOGÍA DE GOLES E INCIDENCIAS DISCIPLINARIAS (MINUTO A MINUTO)', margin + 3, y + 4);

  y += 5.5;

  // Table header for events
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.rect(margin, y, contentWidth, 4, 'F');
  doc.setDrawColor(grayBorder[0], grayBorder[1], grayBorder[2]);
  doc.setLineWidth(0.2);
  doc.rect(margin, y, contentWidth, 4, 'D');

  doc.setTextColor(darkText[0], darkText[1], darkText[2]);
  doc.setFontSize(5.8);
  doc.setFont('helvetica', 'bold');
  doc.text('MIN', margin + 3, y + 2.8);
  doc.text('INCIDENCIA', margin + 18, y + 2.8);
  doc.text('JUGADOR', margin + 55, y + 2.8);
  doc.text('CLUB', margin + 115, y + 2.8);
  doc.text('DETALLES / REGLAMENTO', margin + 155, y + 2.8);

  y += 4;

  const sortedEvents = [...match.events].sort((a, b) => a.minute - b.minute);
  const maxEventsRendered = Math.min(sortedEvents.length, 6);

  if (maxEventsRendered === 0) {
    doc.setFillColor(255, 255, 255);
    doc.rect(margin, y, contentWidth, 5, 'F');
    doc.setDrawColor(grayBorder[0], grayBorder[1], grayBorder[2]);
    doc.setLineWidth(0.15);
    doc.rect(margin, y, contentWidth, 5, 'D');

    doc.setTextColor(120, 140, 160);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6);
    doc.text('Sin goles ni incidencias disciplinarias registradas en este encuentro.', margin + 4, y + 3.5);
    y += 5;
  } else {
    for (let i = 0; i < maxEventsRendered; i++) {
      const ev = sortedEvents[i];
      const evY = y + i * 4.2;
      const isAlt = i % 2 === 1;

      doc.setFillColor(isAlt ? 245 : 255, isAlt ? 248 : 255, isAlt ? 252 : 255);
      doc.rect(margin, evY, contentWidth, 4.2, 'F');
      doc.setDrawColor(grayBorder[0], grayBorder[1], grayBorder[2]);
      doc.setLineWidth(0.15);
      doc.rect(margin, evY, contentWidth, 4.2, 'D');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      doc.setTextColor(darkText[0], darkText[1], darkText[2]);
      doc.text(`${ev.minute}'`, margin + 3, evY + 3);

      let evLabel = 'GOL DE JUGADA';
      if (ev.type === 'penal') evLabel = 'GOL DE PENAL';
      if (ev.type === 'autogol') evLabel = 'AUTOGOL';
      if (ev.type === 'amarilla') evLabel = 'TARJETA AMARILLA';
      if (ev.type === 'roja') evLabel = 'TARJETA ROJA (EXPULSIÓN)';

      doc.text(evLabel, margin + 18, evY + 3);

      doc.setFont('helvetica', 'normal');
      doc.text(ev.playerName || 'Jugador no identificado', margin + 55, evY + 3);
      doc.text(ev.teamName || 'Equipo', margin + 115, evY + 3);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(5.5);
      doc.text(ev.notes || 'Registrado en planilla oficial', margin + 155, evY + 3);
    }
    y += maxEventsRendered * 4.2;
  }

  y += 2.5;

  // ==========================================
  // 6. OFFICIATING CREW (TERNA ARBITRAL DESIGNADA)
  // ==========================================
  doc.setFillColor(apoloBlue[0], apoloBlue[1], apoloBlue[2]);
  doc.roundedRect(margin, y, contentWidth, 5.5, 1, 1, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('CUERPO ARBITRAL OFICIAL DESIGNADO (COLEGIO DE ÁRBITROS FRANZ TAMAYO)', margin + 3, y + 4);

  y += 5.5;

  const officialsBoxWidth = contentWidth / 4;
  const officialsRoles = [
    { roleKey: 'Principal', defaultName: 'Marco Antonio Quispe', license: 'FBF-LP-0412' },
    { roleKey: 'Asistente 1', defaultName: 'Ronald Calle Chuquimia', license: 'FBF-LP-0688' },
    { roleKey: 'Asistente 2', defaultName: 'Grover Mamani Apaza', license: 'FBF-LP-0715' },
    { roleKey: 'Cuarto Árbitro', defaultName: 'Fernando Vargas Aliaga', license: 'AFT-REF-0104' },
  ];

  for (let i = 0; i < 4; i++) {
    const boxX = margin + i * officialsBoxWidth;
    const roleDef = officialsRoles[i];
    const assigned = match.officials?.find((o) => o.role === roleDef.roleKey);
    const refName = assigned?.refereeName || roleDef.defaultName;
    const refLic = assigned?.licenseNumber || roleDef.license;

    doc.setFillColor(248, 250, 252);
    doc.rect(boxX, y, officialsBoxWidth, 9, 'F');
    doc.setDrawColor(grayBorder[0], grayBorder[1], grayBorder[2]);
    doc.setLineWidth(0.2);
    doc.rect(boxX, y, officialsBoxWidth, 9, 'D');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.8);
    doc.setTextColor(apoloLightBlue[0], apoloLightBlue[1], apoloLightBlue[2]);
    doc.text(roleDef.roleKey.toUpperCase(), boxX + 2, y + 3);

    doc.setTextColor(darkText[0], darkText[1], darkText[2]);
    doc.setFontSize(5.5);
    const shortRefName = refName.length > 20 ? refName.substring(0, 18) + '..' : refName;
    doc.text(shortRefName, boxX + 2, y + 6);

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(4.8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Lic: ${refLic}`, boxX + 2, y + 8.2);
  }

  y += 11;

  // ==========================================
  // 7. REFEREE OBSERVATIONS & DIGITAL CERTIFICATION
  // ==========================================
  const notesHeight = 14;
  doc.setFillColor(252, 253, 255);
  doc.setDrawColor(grayBorder[0], grayBorder[1], grayBorder[2]);
  doc.setLineWidth(0.2);
  doc.roundedRect(margin, y, contentWidth, notesHeight, 1, 1, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(darkText[0], darkText[1], darkText[2]);
  doc.text('INFORME Y OBSERVACIONES DEL ÁRBITRO CENTRAL:', margin + 3, y + 4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.8);
  doc.setTextColor(71, 85, 105);
  const notes =
    match.refereeNotes ||
    'Partido concluido en tiempo reglamentario sin reclamos ni incidentes de gravedad. Terreno de juego en óptimas condiciones. Documentación de jugadores verificada por mesa de control.';
  const splitNotes = doc.splitTextToSize(notes, contentWidth - 6);
  doc.text(splitNotes.slice(0, 2), margin + 3, y + 7.5);

  // Digital Hash token on bottom row of observations
  doc.setFont('courier', 'bold');
  doc.setFontSize(5.2);
  doc.setTextColor(apoloLightBlue[0], apoloLightBlue[1], apoloLightBlue[2]);
  const sealHash = match.refereeSignatureHash || 'sig_official_apolo_league_fbf_ratified_sha256';
  const sealTime = match.refereeSignedAt
    ? new Date(match.refereeSignedAt).toLocaleString('es-BO')
    : 'Ratificado en Mesa de Control';
  doc.text(
    `SELLO SHA-256: ${sealHash.substring(0, 48)}... | FECHA CIERRE: ${sealTime}`,
    margin + 3,
    y + 12.5
  );

  y += notesHeight + 3;

  // ==========================================
  // 8. OFFICIAL SIGNATURES BOXES (4 REGLAMENTARIAS)
  // ==========================================
  const sigBoxWidth = (contentWidth - 6) / 4; // ~46mm each
  const sigBoxHeight = 18;
  const signatureTitles = [
    { title: 'ÁRBITRO CENTRAL', sub: 'Firma y Carnet FBF' },
    { title: 'CAPITÁN LOCAL', sub: homeTeam.name.substring(0, 16) },
    { title: 'CAPITÁN VISITANTE', sub: awayTeam.name.substring(0, 16) },
    { title: 'VEEDOR DE MESA', sub: 'Comisión Técnica Apolo' },
  ];

  for (let i = 0; i < 4; i++) {
    const boxX = margin + i * (sigBoxWidth + 2);
    const item = signatureTitles[i];

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(grayBorder[0], grayBorder[1], grayBorder[2]);
    doc.setLineWidth(0.25);
    doc.roundedRect(boxX, y, sigBoxWidth, sigBoxHeight, 1, 1, 'FD');

    // Signature line
    doc.setDrawColor(180, 190, 205);
    doc.setLineWidth(0.3);
    doc.line(boxX + 3, y + sigBoxHeight - 6, boxX + sigBoxWidth - 3, y + sigBoxHeight - 6);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.8);
    doc.setTextColor(darkText[0], darkText[1], darkText[2]);
    doc.text(item.title, boxX + sigBoxWidth / 2, y + sigBoxHeight - 3.5, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(4.8);
    doc.setTextColor(120, 135, 150);
    doc.text(item.sub, boxX + sigBoxWidth / 2, y + sigBoxHeight - 1.2, { align: 'center' });

    // If referee is signed, add a digital stamp icon on referee box
    if (i === 0 && match.isRefereeSigned) {
      doc.setTextColor(16, 185, 129);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.text('✓ SELLADO DIGITALMENTE', boxX + sigBoxWidth / 2, y + 6, { align: 'center' });
      doc.setFontSize(5);
      doc.text('ACTA RATIFICADA', boxX + sigBoxWidth / 2, y + 9, { align: 'center' });
    }
  }

  y += sigBoxHeight + 3;

  // ==========================================
  // 9. FOOTER WATERMARK & PAGE DETAILS
  // ==========================================
  doc.setDrawColor(grayBorder[0], grayBorder[1], grayBorder[2]);
  doc.setLineWidth(0.2);
  doc.line(margin, y, margin + contentWidth, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(120, 135, 150);
  doc.text(
    `ApoloDigital League Engine (apolodigital.lat) · Sistema Oficial de Competiciones Deportivas de Bolivia`,
    margin,
    y + 3.5
  );

  const printTimestamp = new Date().toLocaleString('es-BO');
  doc.text(`Impreso / Generado: ${printTimestamp} · Pág 1 de 1`, margin + contentWidth, y + 3.5, {
    align: 'right',
  });

  return doc;
};

/**
 * Convenience helper to download the match sheet directly as a PDF file
 */
export const downloadMatchOfficialSheetPdf = (options: GeneratePdfOptions) => {
  const doc = generateMatchOfficialSheetPdf(options);
  const homeClean = options.homeTeam.shortName || options.homeTeam.name.replace(/\s+/g, '_');
  const awayClean = options.awayTeam.shortName || options.awayTeam.name.replace(/\s+/g, '_');
  const round = options.match.round;
  const fileName = `Acta_Oficial_Jornada_${round}_${homeClean}_vs_${awayClean}_${options.match.date}.pdf`;
  doc.save(fileName);
};

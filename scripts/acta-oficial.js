/* Acta oficial de Soccer Simulator 2026: eventos, estadísticas e integridad SHA-256. */
(function () {
  'use strict';

  const originalPlay = window.play;
  if (typeof originalPlay === 'function') {
    window.play = function (...args) {
      const result = originalPlay.apply(this, args);
      try {
        const match = matches[matches.length - 1];
        if (match) {
          const randomPool = [
            'El VAR revisó una acción y confirmó la decisión arbitral.',
            'El equipo local encadenó una presión alta durante varios minutos.',
            'El equipo visitante sorprendió con una transición rápida.',
            'El público impulsó una reacción del equipo local.',
            'Un cambio táctico modificó el ritmo del encuentro.',
            'El árbitro añadió tiempo por las interrupciones del partido.'
          ];
          match.randomEvents = Math.random() < 0.35
            ? [randomPool[Math.floor(Math.random() * randomPool.length)]]
            : [];

          const rows = Array.isArray(match.playerStats) ? match.playerStats : [];
          const homeRows = rows.filter(p => p.team === match.home);
          const awayRows = rows.filter(p => p.team === match.away);
          const sum = (list, key) => list.reduce((n, p) => n + (Number(p[key]) || 0), 0);
          const homePasses = sum(homeRows, 'passesCompleted');
          const awayPasses = sum(awayRows, 'passesCompleted');
          const passTotal = homePasses + awayPasses;
          const homePossession = passTotal ? Math.round(homePasses / passTotal * 100) : 50;
          match.statistics = {
            homePossession,
            awayPossession: 100 - homePossession,
            homeShots: sum(homeRows, 'shots'),
            awayShots: sum(awayRows, 'shots'),
            homeShotsOnTarget: sum(homeRows, 'shotsOnTarget'),
            awayShotsOnTarget: sum(awayRows, 'shotsOnTarget')
          };
          match.injuries = (match.events || [])
            .filter(e => e.type === 'Lesión')
            .map(e => ({ minute: e.minute, player: e.player, team: e.team }));
          localStorage.setItem('ss26v21_matches', JSON.stringify(matches));
        }
      } catch (error) {
        console.error('No se pudo completar el acta del partido:', error);
      }
      return result;
    };
  }

  function canonicalMatch(match) {
    return JSON.stringify({
      id: match.id,
      home: match.home,
      away: match.away,
      a: match.a,
      b: match.b,
      competition: match.competition || '',
      date: match.date || '',
      events: match.events || [],
      subs: match.subs || [],
      playerStats: match.playerStats || [],
      mvp: match.mvp || '',
      randomEvents: match.randomEvents || [],
      statistics: match.statistics || null,
      injuries: match.injuries || []
    });
  }

  async function sha256(text) {
    if (!window.crypto || !crypto.subtle) {
      throw new Error('SHA-256 requiere un navegador en un contexto seguro (HTTPS).');
    }
    const bytes = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  }

  function goalsFor(match) {
    return (match.events || []).filter(e => e.type === 'Gol')
      .sort((a, b) => a.minute - b.minute)
      .map(e => {
        const scorer = players.find(p => p.id === e.scorerId);
        const assist = players.find(p => p.id === e.assistId);
        return `> ⚽ **${e.minute}'** ${scorer?.name || e.player} • ${assist ? 'Asist.: *' + assist.name + '*' : 'Sin asistencia'}`;
      }).join('\n') || '> Sin goles.';
  }

  function officialReport(match) {
    const s = match.statistics || {};
    const injuries = match.injuries || [];
    const random = match.randomEvents || [];
    const winner = match.a > match.b ? match.home : match.b > match.a ? match.away : 'Empate';
    const ratings = (match.playerStats || []).slice().sort((a, b) => b.rating - a.rating);
    const goals = (match.events || []).filter(e => e.type === 'Gol').length;
    const totalShots = (s.homeShots || 0) + (s.awayShots || 0);
    const totalOnTarget = (s.homeShotsOnTarget || 0) + (s.awayShotsOnTarget || 0);
    const injuriesText = injuries.length
      ? injuries.map(i => `• ${i.minute}' — ${i.player} (${i.team})`).join('\n')
      : '• Plantillas sin lesiones reportadas.';
    const randomText = random.length ? random.map(x => '• ' + x).join('\n') : '• Sin sucesos especiales en este encuentro.';
    const stats = `Posesión ${s.homePossession ?? 50}%-${s.awayPossession ?? 50}% | Remates ${s.homeShots ?? 0}-${s.awayShots ?? 0} | A puerta ${s.homeShotsOnTarget ?? 0}-${s.awayShotsOnTarget ?? 0}`;
    const best = ratings[0]?.name || match.mvp || 'Sin MVP';
    return `🏆 **ACTA OFICIAL DEL PARTIDO • SOCCER SIMULATOR 2026**
📌 **Competición:** ${match.competition || 'Partido amistoso'}
━━━━━━━━━━━━━━━━━━━━━━━━
🏟️ **${match.home}  ${match.a} — ${match.b}  ${match.away}**
🏅 **Resultado Oficial:** ${winner}
━━━━━━━━━━━━━━━━━━━━━━━━
⚽ **GOLES:**
${goalsFor(match)}

🎲 **EVENTOS RANDOM DEL PARTIDO:**
> ${randomText.replace(/\n/g, '\n> ')}

🚑 **PARTE MÉDICO:**
> ${injuriesText.replace(/\n/g, '\n> ')}

📊 **ESTADÍSTICAS:** ${stats}
📈 **Resumen:** ${goals} goles | ${totalShots} remates | ${totalOnTarget} tiros a puerta
⭐ **MVP:** ${best}
📅 **Fecha:** ${match.date || 'No registrada'}

🔒 **Sello SHA-256:** \`${match.integrityHash || 'Se generará al copiar el acta'}\`
━━━━━━━━━━━━━━━━━━━━━━━━
**SOCCER SIMULATOR 2026**`;
  }

  window.matchReportText = officialReport;

  window.copyMatchReport = async function () {
    const match = matches[matches.length - 1];
    if (!match) return toast('No hay partidos para copiar.');
    try {
      match.integrityHash = await sha256(canonicalMatch(match));
      localStorage.setItem('ss26v21_matches', JSON.stringify(matches));
      const report = officialReport(match);
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(report);
      } else {
        copyFallback(report);
        return;
      }
      toast('Acta oficial copiada con sello SHA-256.');
      if (typeof render === 'function' && page === 'matches') render();
    } catch (error) {
      console.error(error);
      toast(error.message || 'No se pudo generar el sello SHA-256.');
    }
  };

  window.verifyLastMatchIntegrity = async function () {
    const match = matches[matches.length - 1];
    if (!match?.integrityHash) return toast('Este partido aún no tiene sello. Copia primero el acta.');
    try {
      const current = await sha256(canonicalMatch(match));
      toast(current === match.integrityHash
        ? 'Sello válido: el acta no ha cambiado.'
        : 'ALERTA: el acta fue modificada después de sellarse.');
    } catch (error) {
      toast(error.message || 'No se pudo verificar el sello.');
    }
  };

  const addVerifyButton = () => {
    const copyButton = document.querySelector('#view button[onclick="copyMatchReport()"]');
    if (copyButton && !document.getElementById('verifyMatchSeal')) {
      const verify = document.createElement('button');
      verify.id = 'verifyMatchSeal';
      verify.className = 'secondary';
      verify.style.marginLeft = '8px';
      verify.textContent = '🔎 VERIFICAR SELLO SHA-256';
      verify.onclick = window.verifyLastMatchIntegrity;
      copyButton.insertAdjacentElement('afterend', verify);
    }
  };
  if (typeof MutationObserver !== 'undefined') {
    new MutationObserver(addVerifyButton).observe(document.getElementById('view'), { childList: true, subtree: true });
    addVerifyButton();
  }
})();

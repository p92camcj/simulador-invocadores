// js/panel-historial.js
//
// Panel "Historial y ranking" de la pantalla de inicio (1.42.0): el perfil
// de este dispositivo (el mismo nombre que se usa online), el ranking por
// nombre y las últimas partidas. Los datos los guarda y calcula
// js/perfiles.js; aquí solo se pintan.

import { leerHistorial, borrarHistorial, calcularRanking, leerPerfil, guardarPerfil, normalizarNombre } from './perfiles.js';
import { MODOS_JUEGO } from './utils.js';

const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ULTIMAS = 8;
let abierto = false;
let conAutomatas = true;
let confirmandoBorrar = false;

function fechaCorta(iso) {
  try {
    return new Date(iso).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

function filaPartida(r, yo) {
  const ganan = r.jugadoras.filter(j => j.gana);
  const titulo = !r.objetivoCumplido ? 'Nadie gana'
    : ganan.length === 1 ? `Gana ${ganan[0].tipo === 'central' ? 'la autómata central' : ganan[0].nombre}`
    : `Empate: ${ganan.map(j => j.nombre).join(', ')}`;
  const mia = yo && r.jugadoras.find(j => j.tipo === 'humano' && normalizarNombre(j.nombre) === yo);
  const marca = mia ? (mia.gana ? ' 🏆' : ` · ${mia.puesto}.º`) : '';
  const quienes = r.jugadoras.map(j => `${j.tipo === 'auto' ? '🤖 ' : ''}${esc(j.nombre)} ${j.gemas}`).join(' · ');
  const modo = MODOS_JUEGO[r.modo]?.nombre || '';
  return `<li><div class="ph-partida-cab"><strong>${esc(titulo)}${marca}</strong><span>${esc(fechaCorta(r.fecha))}</span></div>
    <div class="ph-partida-det">${r.online ? '🌐 ' : ''}${esc(modo)}${modo ? ' · ' : ''}${r.invocaciones} ${r.invocaciones === 1 ? 'invocación' : 'invocaciones'} · 💎 ${quienes}</div></li>`;
}

/** Pinta (o repinta) el panel. Se llama desde initSetup(). */
export function pintarPanelHistorial() {
  const panel = document.getElementById('panelHistorial');
  if (!panel) return;
  const historial = leerHistorial();
  const perfil = leerPerfil();
  const yo = normalizarNombre(perfil);
  const ranking = calcularRanking(historial, { conAutomatas });
  const resumen = historial.length
    ? `${historial.length} ${historial.length === 1 ? 'partida guardada' : 'partidas guardadas'} en este dispositivo`
    : 'Aún no hay partidas: se guardan solas al terminar cada una (también las online).';
  const tabla = ranking.length ? `<table class="ph-ranking">
      <thead><tr><th>#</th><th>Nombre</th><th title="Partidas">Part.</th><th title="Victorias">Vict.</th><th>%</th><th title="Gemas de media">💎 media</th></tr></thead>
      <tbody>${ranking.map((e, i) => `<tr class="${!e.automata && yo && normalizarNombre(e.nombre) === yo ? 'yo' : ''}">
        <td>${i + 1}</td><td>${e.automata ? '🤖 ' : ''}${esc(e.nombre)}</td><td>${e.partidas}</td><td>${e.victorias}</td><td>${e.porcentaje}</td><td>${e.gemasMedias}</td></tr>`).join('')}</tbody>
    </table>` : '';
  panel.innerHTML = `
    <button type="button" class="ph-cabecera" data-ph="abrir" aria-expanded="${abierto}">
      <strong>🏆 Historial y ranking</strong><span>${esc(resumen)}</span><span class="ph-flecha" aria-hidden="true">${abierto ? '▴' : '▾'}</span>
    </button>
    <div class="ph-cuerpo${abierto ? '' : ' hidden'}">
      <label class="ph-perfil">Tu perfil en este dispositivo:
        <input id="inpPerfil" type="text" maxlength="24" placeholder="Tu nombre" value="${esc(perfil)}" autocomplete="nickname" />
      </label>
      <p class="ph-nota">Es el mismo nombre que usas para jugar online. Tus partidas se marcan en el ranking y en el historial.</p>
      ${ranking.length ? `<button type="button" class="ph-filtro" data-ph="bots" aria-pressed="${conAutomatas}">🤖 Autómatas en el ranking: ${conAutomatas ? 'sí' : 'no'}</button>${tabla}` : ''}
      ${historial.length ? `<h3>Últimas partidas</h3><ol class="ph-partidas">${historial.slice(0, ULTIMAS).map(r => filaPartida(r, yo)).join('')}</ol>
      <button type="button" class="btn" data-ph="descargar">Descargar historial</button>
      <button type="button" class="btn" data-ph="borrar">${confirmandoBorrar ? '¿Seguro? Pulsa otra vez para borrarlo' : 'Borrar historial'}</button>` : ''}
    </div>`;
  panel.onclick = e => {
    const accion = e.target.closest('[data-ph]')?.dataset.ph;
    if (accion === 'abrir') { abierto = !abierto; confirmandoBorrar = false; pintarPanelHistorial(); }
    if (accion === 'bots') { conAutomatas = !conAutomatas; pintarPanelHistorial(); }
    if (accion === 'descargar') descargar(historial);
    if (accion === 'borrar') {
      if (confirmandoBorrar) { borrarHistorial(); confirmandoBorrar = false; } else confirmandoBorrar = true;
      pintarPanelHistorial();
    }
  };
  const inp = panel.querySelector('#inpPerfil');
  if (inp) inp.onchange = () => { guardarPerfil(inp.value); pintarPanelHistorial(); };
}

function descargar(historial) {
  try {
    const blob = new Blob([JSON.stringify(historial, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `invocadores-historial-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  } catch (e) { console.warn('No se pudo descargar el historial:', e); }
}

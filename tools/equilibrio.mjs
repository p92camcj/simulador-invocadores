// tools/equilibrio.mjs
// Análisis de equilibrio de Invocadores por simulación masiva (sin navegador).
// Usa el mismo motor (js/motor/) y las mismas autómatas que la web y que
// tools/arena.mjs, y añade:
//
// - Dos perfiles de jugadora que NO existen en la web, solo para el análisis:
//   · 'caotico'    → "niña de 5 años": juega una carta al azar en un Portal al
//                    azar y, la mitad de las veces, activa una habilidad al azar
//                    con objetivos al azar. Siempre jugadas legales.
//   · 'saboteador' → no quiere ganar: quiere que NADIE gane Gemas. Prueba cada
//                    jugada (Fase A + Fase B) en varios mundos posibles, como la
//                    Experta, y elige la que deja la invocación más lejos y
//                    reparte menos Gemas.
// - Juego restringido (Jaffe et al., 2012): 'dificil-sin:Cronista' es la
//   autómata Difícil que nunca activa la Cronista ('sin:todas' = nunca activa
//   nada). La diferencia de victorias con la autómata sin restricción mide
//   cuánto aporta esa habilidad.
// - Métricas por partida: posición en el turno, Gemas por personaje, bonus de
//   Pícaro/Maestro, Entusiasta, duplicados, Gemas perdidas en Portales
//   centrales, habilidades usadas, cómo acaba la partida, empates, etc.
//
// Uso:
//   node tools/equilibrio.mjs --mesa dificil,dificil,dificil [--partidas 1000]
//        [--modo normal] [--set normal] [--entusiasta 1] [--madain 1]
//        [--cantidades '{"Pícaro":4}'] [--apartar 0] [--semilla 1]
//        [--rotar 1] [--perfiles '{...}'] [--etiqueta texto]
//
// Asientos: 'normal' | 'dificil' | 'experta' | 'caotico' | 'saboteador',
// opcionalmente con '@perfil' (pesos, como en arena.mjs) y '-sin:A+B'.
// Con --rotar 1 (por defecto) los asientos rotan en cada partida; la
// posición 0 es siempre la que empieza.
// Saca un JSON con el resumen (intervalos de confianza al 95 %).

import { estado } from '../js/motor/estado.js';
import { jugarCarta, terminarTurno, pasarTurno, comprobarFinPorManoVacia, completarActivacion, invocacionActiva } from '../js/motor/acciones.js';
import { aplicarHabilidad } from '../js/motor/habilidades.js';
import {
  calcularResultadoFinal, sumaGemas, configPartida, MODOS_JUEGO, resultadoFinalExperto,
  jugadorasConMenosPuntos, convieneIntercambioAutomata, opcionesActivarHabilidad, todosLosPortales,
} from '../js/utils.js';
import { decidirYJugarTurno, crearEjecutorMotor } from '../js/bot.js';
import { PESOS } from '../js/bot-estrategia.js';
import { VARIANTES, reiniciarVariantes } from '../js/motor/variantes.js';
import { INVOCATION_SETS, composicionMazoTotal } from '../js/utils.js';
import { BUSQUEDA, determinizar, enumerarFasesB, aplicarConGuion } from '../js/bot-busqueda.js';
import { sembrarAzar, prepararPartida, gestionarClarividente } from './arena.mjs';

const clonar = obj => JSON.parse(JSON.stringify(obj));
const azar = lista => lista[Math.floor(Math.random() * lista.length)];

/** 'dificil@b-sin:Cronista+Maestro' → { nivel, perfil, prohibidas } */
export function leerAsiento(spec) {
  const [base, sin] = spec.split('-sin:');
  const [nivel, perfil] = base.split('@');
  return { spec, nivel, perfil: perfil || null, prohibidas: sin ? sin.split('+') : [] };
}

// ---------- Perfil 'caotico' ----------

function destinosDe(partida, idx) {
  const out = [];
  partida.players.forEach((p, i) => p.portals.forEach((_, k) => out.push(i === idx ? `p:${k}` : `a:${i}:${k}`)));
  partida.neutrals.forEach((_, k) => out.push(`n:${k}`));
  return out;
}

const uiAlAzar = {
  pedir(peticion, responder, cancelar) {
    const ops = peticion.opciones.filter(o => !o.disabled);
    if (!ops.length) { cancelar?.(); return; }
    responder(azar(ops).val);
  },
  avisar() {},
};

function pilaOrigen(partida, idx, origen) {
  const [t, k] = origen.split(':');
  return t === 'own' ? partida.players[idx].portals[+k] : partida.neutrals[+k];
}

/** Turno de la "niña de 5 años": todo al azar, pero legal. */
function turnoCaotico(partida, idx, registro, probB = 0.5, sinPagar = false) {
  const p = partida.players[idx];
  const cartaIdx = Math.floor(Math.random() * p.hand.length);
  const destino = azar(destinosDe(partida, idx));
  registro.jugada(idx, { usaConocida: p.hand[cartaIdx].vis?.owner === true, destKey: destino });
  jugarCarta(partida, { cartaIdx, destino });
  gestionarClarividente(partida);
  if (Math.random() >= probB) return;
  const ops = opcionesActivarHabilidad(idx, partida.players, partida.neutrals);
  if (!ops.length) return;
  const o = azar(ops);
  const pila = pilaOrigen(partida, idx, o.val);
  const personaje = pila.at(-1).name;
  // 'peque': regla de casa en la que la jugadora pequeña no paga Gemas.
  const gemasAntes = sinPagar ? p.gems.map(g => ({ ...g })) : null;
  aplicarHabilidad(partida, { personaje, jugadora: idx, pila }, uiAlAzar, () => {
    registro.habilidad(idx, personaje, o.val);
    completarActivacion(partida, { origen: o.val, personaje, usarAsterisco: false });
  });
  if (gemasAntes) p.gems = gemasAntes;
  partida.cronomantePortalInvestigado = null;
}

// ---------- Perfil 'saboteador' ----------

/**
 * Cartas que le faltan a la invocación activa para cerrarse, contando solo
 * jugadas de carta (cota inferior): max(Portales sin carta visible,
 * requisitos que no se ven en ningún Portal).
 */
export function distanciaACierre(partida) {
  const inv = invocacionActiva(partida);
  if (!inv) return 0;
  const portales = todosLosPortales(partida.players, partida.neutrals);
  const visibles = portales.filter(({ stack }) => stack.length && stack.at(-1).vis?.public)
    .map(({ stack }) => stack.at(-1).aspecto || stack.at(-1).name);
  const vacios = portales.length - visibles.length;
  const faltan = inv.need.filter(k => !visibles.includes(k)).length;
  return Math.max(vacios, faltan);
}

// Gemas GANADAS por todas (las que alguien gasta no cuentan como "menos
// Gemas en juego": si no, la saboteadora quemaría las suyas a propósito).
const quienes = partida => [...partida.players, ...(partida.automataCentral ? [partida.automataCentral] : [])];
const gemasGanadas = (antes, despues) => quienes(despues)
  .reduce((s, p, i) => s + Math.max(0, sumaGemas(p.gems) - sumaGemas(quienes(antes)[i].gems)), 0);

/** Lo malo (para la saboteadora) de cómo queda el mundo al acabar su turno. */
function costeSabotaje(antes, despues) {
  const gemas = gemasGanadas(antes, despues);
  const cerradas = despues.invocacionesCompletadas.length - antes.invocacionesCompletadas.length;
  return 100 * cerradas + 5 * gemas - (despues.juegoTerminado ? 0 : 3 * distanciaACierre(despues));
}

const MUNDOS_SABOTAJE = 4;

function turnoSaboteador(partida, idx, registro) {
  const mano = partida.players[idx].hand;
  const cartas = [true, false].filter(c => mano.some(x => (x.vis?.owner === true) === c));
  const cands = cartas.flatMap(usaConocida => destinosDe(partida, idx).map(destKey => ({ usaConocida, destKey })));
  const mundos = Array.from({ length: MUNDOS_SABOTAJE }, () => determinizar(partida, idx));
  const coste = cands.map(() => 0);
  mundos.forEach(m => cands.forEach((c, ci) => {
    const t = clonar(m);
    const ix = t.players[idx].hand.findIndex(x => (x.vis?.owner === true) === c.usaConocida);
    jugarCarta(t, { cartaIdx: ix, destino: c.destKey });
    let mejor = Infinity;
    enumerarFasesB(t, idx).forEach(b => {
      const u = clonar(t);
      if (b && !aplicarConGuion(u, idx, b.origen, b.guion)) return;
      terminarTurno(u);
      mejor = Math.min(mejor, costeSabotaje(m, u));
    });
    coste[ci] += mejor;
  }));
  let bi = 0;
  coste.forEach((v, i) => { if (v < coste[bi] - 1e-9) bi = i; });
  const elegida = cands[bi];
  registro.jugada(idx, elegida);
  jugarCarta(partida, { cartaIdx: mano.findIndex(x => (x.vis?.owner === true) === elegida.usaConocida), destino: elegida.destKey });
  gestionarClarividente(partida);

  // Fase B con la carta ya jugada.
  const mundosB = Array.from({ length: MUNDOS_SABOTAJE }, () => determinizar(partida, idx));
  const acciones = enumerarFasesB(mundosB[0], idx);
  if (acciones.length === 1) return;
  const costeB = acciones.map(() => 0);
  mundosB.forEach(m => acciones.forEach((b, i) => {
    const u = clonar(m);
    if (b && !aplicarConGuion(u, idx, b.origen, b.guion)) { costeB[i] += 1e6; return; }
    terminarTurno(u);
    costeB[i] += costeSabotaje(m, u);
  }));
  let mb = 0;
  costeB.forEach((v, i) => { if (v < costeB[mb] - 1e-9) mb = i; });
  const b = acciones[mb];
  if (!b) return;
  const personaje = pilaOrigen(partida, idx, b.origen)?.at(-1)?.name;
  if (aplicarConGuion(partida, idx, b.origen, b.guion)) registro.habilidad(idx, personaje, b.origen);
}

// ---------- Una partida con métricas ----------

function instantaneaPortales(partida) {
  return todosLosPortales(partida.players, partida.neutrals).map(({ stack, playerIdx }) => {
    const top = stack.at(-1);
    const vis = !!(top && top.vis?.public);
    return { dueña: playerIdx, aparente: vis ? (top.aspecto || top.name) : null, real: vis ? top.name : null };
  });
}

/**
 * Juega una partida. `asientos` = specs por posición (0 empieza).
 * Devuelve un registro con todo lo que se mide.
 */
export function jugarPartidaAnalisis(asientos, opciones, perfiles = {}) {
  const info = asientos.map(leerAsiento);
  const base = { ...PESOS };
  const baseBusqueda = { ...BUSQUEDA };
  const solo = (obj, ref) => Object.fromEntries(Object.entries(obj || {}).filter(([k]) => k in ref));
  const pesosDe = info.map(a => ({ ...base, ...solo(perfiles[a.perfil], base) }));
  const busqDe = info.map(a => ({ ...baseBusqueda, ...solo(perfiles[a.perfil], baseBusqueda) }));
  const niveles = info.map(a => (['normal', 'dificil', 'experta'].includes(a.nivel) ? a.nivel : 'normal'));
  const partida = prepararPartida(niveles, opciones);
  // Las 3 Gemas de partida (para la variante gemasInicialesNoPuntuan).
  partida.players.forEach(p => p.gems.forEach(g => { g.inicial = true; }));
  if (ganchosRequisitos) ganchosRequisitos.inicio(partida);
  estado.partida = partida;
  const n = asientos.length;

  const r = {
    asientos, n,
    habilidades: Array.from({ length: n }, () => ({})),
    pagosCentral: Array(n).fill(0),
    jugadas: Array.from({ length: n }, () => ({ propio: 0, ajeno: 0, central: 0, oculta: 0, total: 0 })),
    gemasPorPersonaje: {}, // personaje → Gemas de invocación cobradas por una jugadora
    duplicados: 0, centralPerdidas: 0, centralAutomata: 0,
    bonusPicaro: 0, bonusMaestro: 0, entusiastaPierde: 0, entusiastaSinEfecto: 0,
    invocaciones: [], // { nivel, turno, ganadasPor: [idx...] }
    lideresTrasInvocacion: [],
  };
  const registro = {
    jugada(idx, d) {
      const j = r.jugadas[idx];
      j.total++;
      if (!d.usaConocida) j.oculta++;
      if (d.destKey.startsWith('p:')) j.propio++; else if (d.destKey.startsWith('n:')) j.central++; else j.ajeno++;
    },
    habilidad(idx, personaje, origen) {
      r.habilidades[idx][personaje] = (r.habilidades[idx][personaje] || 0) + 1;
      if (String(origen).startsWith('central')) r.pagosCentral[idx]++;
    },
  };
  const motor = crearEjecutorMotor();
  const ejecutor = {
    ...motor,
    jugar(players, botIdx, decision) { registro.jugada(botIdx, decision); return motor.jugar(players, botIdx, decision); },
    activar(players, neutrals, botIdx, levelIdx, need, decision, vista) {
      const prohib = info[botIdx].prohibidas;
      if (prohib.includes('todas') || prohib.includes(decision.name)) return '';
      registro.habilidad(botIdx, decision.name, decision.val);
      return motor.activar(players, neutrals, botIdx, levelIdx, need, decision, vista);
    },
  };

  let turnos = 0;
  let fin = 'mano';
  if (comprobarFinPorManoVacia(partida).length) partida.juegoTerminado = true;
  while (!partida.juegoTerminado && turnos < 500) {
    const t = partida.turn;
    Object.assign(PESOS, pesosDe[t]);
    Object.assign(BUSQUEDA, busqDe[t]);
    const nivel = info[t].nivel;
    if (nivel === 'caotico') turnoCaotico(partida, t, registro);
    else if (nivel === 'peque') turnoCaotico(partida, t, registro, 0.5, true);
    else if (nivel === 'saboteador') turnoSaboteador(partida, t, registro);
    else decidirYJugarTurno(partida.players, partida.neutrals, t, configPartida(partida), ejecutor);
    gestionarClarividente(partida);
    if (!partida.played) throw new Error(`El asiento ${t} (${asientos[t]}) no jugó carta`);

    const inv = invocacionActiva(partida);
    const foto = instantaneaPortales(partida);
    const gemasAntes = partida.players.map(p => p.gems.length);
    const eventos = terminarTurno(partida);
    gestionarClarividente(partida);
    const ev = eventos.find(e => e.tipo === 'invocacionCompletada');
    if (ev) {
      inv.need.forEach(k => {
        const con = foto.filter(f => f.aparente === k);
        if (con.length > 1) r.duplicados++;
        else if (con.length === 1) {
          if (con[0].dueña === null) { if (partida.automataCentral) r.centralAutomata++; else r.centralPerdidas++; }
          else r.gemasPorPersonaje[k] = (r.gemasPorPersonaje[k] || 0) + 1;
        }
      });
      const picaros = foto.filter(f => f.real === 'Pícaro').length;
      r.bonusPicaro += picaros;
      const maestros = foto.filter(f => f.real === 'Maestro').length;
      if (inv.need.includes('Maestro') && !picaros && maestros === 1) r.bonusMaestro++;
      ev.entusiastas.forEach(e => { if (e.perdida) r.entusiastaPierde++; else r.entusiastaSinEfecto++; });
      r.invocaciones.push({ nivel: ev.nivel, turno: turnos, ganadasPor: partida.players.map((p, i) => p.gems.length - gemasAntes[i]) });
      const pts = partida.players.map(p => sumaGemas(p.gems));
      const max = Math.max(...pts);
      r.lideresTrasInvocacion.push(pts.map((v, i) => (v === max ? i : -1)).filter(i => i >= 0));
      if (partida.juegoTerminado) fin = 'ultimaInvocacion';
      else if (ganchosRequisitos) ganchosRequisitos.siguiente(partida);
    }
    if (!partida.juegoTerminado) pasarTurno(partida);
    turnos++;
  }
  if (turnos >= 500) fin = 'limite';
  Object.assign(PESOS, base);
  Object.assign(BUSQUEDA, baseBusqueda);

  const ultimas = partida.automataCentral ? jugadorasConMenosPuntos(partida.players) : [];
  // Variantes del intercambio con la autómata central (opciones.intercambio):
  // 'siempre' (reglamento), 'siAutomataGana' (solo si la autómata va
  // primera, sin empate) o 'mitad' (solo con menos de la mitad de sus puntos).
  const ptsAut = partida.automataCentral ? sumaGemas(partida.automataCentral.gems) : 0;
  const permitido = i => {
    if (opciones.intercambio === 'siAutomataGana') return partida.players.every(p => sumaGemas(p.gems) < ptsAut);
    if (opciones.intercambio === 'mitad') return sumaGemas(partida.players[i].gems) < ptsAut / 2;
    return true;
  };
  const cambian = ultimas.filter(i => permitido(i) && convieneIntercambioAutomata(partida.players, partida.automataCentral, i));
  const res = partida.automataCentral
    ? resultadoFinalExperto(partida.players, partida.automataCentral, partida.invocacionesCompletadas, cambian)
    : calcularResultadoFinal(partida.players, partida.invocacionesCompletadas);
  r.puntos = partida.players.map(p => sumaGemas(p.gems));
  r.puntosAutomata = partida.automataCentral ? sumaGemas(partida.automataCentral.gems) : null;
  r.ganaAutomata = res.ganadores.some(g => g.esAutomataCentral);
  r.intercambios = cambian.length;
  r.ganaQuienIntercambia = cambian.some(i => res.ganadores.some(g => !g.esAutomataCentral && (g.idx ?? partida.players.findIndex(p => p.name === g.nombre)) === i));
  r.ganadoras = res.ganadores.filter(g => !g.esAutomataCentral)
    .map(g => g.idx ?? partida.players.findIndex(p => p.name === g.nombre));
  r.turnos = turnos;
  r.fin = fin;
  r.cartasMazoAlFinal = partida.deck.length;
  return r;
}

// ---------- Resumen estadístico ----------

const ic95 = (exitos, total) => {
  if (!total) return null;
  const p = exitos / total;
  return [+(p - 1.96 * Math.sqrt(p * (1 - p) / total)).toFixed(3), +(p + 1.96 * Math.sqrt(p * (1 - p) / total)).toFixed(3)];
};
const media = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const red = (x, d = 3) => +x.toFixed(d);

export function resumir(registros) {
  const N = registros.length;
  const n = registros[0].n;
  const porAgente = {};
  const porPosicion = Array.from({ length: n }, () => ({ victorias: 0, partidas: 0, puntos: 0 }));
  const porMesa = Array.from({ length: n }, () => ({ victorias: 0, partidas: 0, puntos: 0 }));
  const habilidadesPorAgente = {};
  const jugadasPorAgente = {};
  const conHab = {}; // personaje → { usaron:{v,n}, noUsaron:{v,n} }
  let empates = 0; let empateTotal = 0; let ceroInv = 0; let margen = 0; let liderGana = 0; let conLider = 0;
  let remontadas = 0;
  const distInv = {}; const nivelAlcanzado = {}; const fines = {};
  const gemasPersonaje = {};
  let ganaAutomata = 0; let intercambios = 0; let puntosAutomata = 0; let ganaIntercambio = 0; let conIntercambio = 0;
  const tot = { duplicados: 0, centralPerdidas: 0, centralAutomata: 0, bonusPicaro: 0, bonusMaestro: 0, entusiastaPierde: 0, entusiastaSinEfecto: 0 };
  const turnos = []; const ptsGanador = [];
  registros.forEach(r => {
    const share = 1 / r.ganadoras.length;
    if (r.ganadoras.length > 1) empates++;
    if (r.ganadoras.length === n) empateTotal++;
    if (!r.invocaciones.length) ceroInv++;
    distInv[r.invocaciones.length] = (distInv[r.invocaciones.length] || 0) + 1;
    r.invocaciones.forEach(i => { nivelAlcanzado[i.nivel] = (nivelAlcanzado[i.nivel] || 0) + 1; });
    fines[r.fin] = (fines[r.fin] || 0) + 1;
    turnos.push(r.turnos);
    const ord = [...r.puntos].sort((a, b) => b - a);
    margen += ord[0] - ord[1];
    ptsGanador.push(ord[0]);
    if (r.lideresTrasInvocacion.length) {
      conLider++;
      const lider = r.lideresTrasInvocacion[0];
      if (lider.some(i => r.ganadoras.includes(i))) liderGana++;
      else remontadas++;
    }
    Object.entries(r.gemasPorPersonaje).forEach(([k, v]) => { gemasPersonaje[k] = (gemasPersonaje[k] || 0) + v; });
    Object.keys(tot).forEach(k => { tot[k] += r[k]; });
    if (r.ganaAutomata) ganaAutomata++;
    intercambios += r.intercambios;
    if (r.intercambios) { conIntercambio++; if (r.ganaQuienIntercambia) ganaIntercambio++; }
    puntosAutomata += r.puntosAutomata || 0;
    r.asientos.forEach((spec, i) => {
      const gana = r.ganadoras.includes(i) ? share : 0;
      porAgente[spec] ??= { victorias: 0, partidas: 0, puntos: 0, ganaSola: 0 };
      porAgente[spec].victorias += gana; porAgente[spec].partidas++; porAgente[spec].puntos += r.puntos[i];
      if (r.ganadoras.length === 1 && r.ganadoras[0] === i) porAgente[spec].ganaSola++;
      porPosicion[i].victorias += gana; porPosicion[i].partidas++; porPosicion[i].puntos += r.puntos[i];
      const m = porMesa[r.mesaIdx ? r.mesaIdx[i] : i];
      m.victorias += gana; m.partidas++; m.puntos += r.puntos[i];
      habilidadesPorAgente[spec] ??= {};
      Object.entries(r.habilidades[i]).forEach(([k, v]) => { habilidadesPorAgente[spec][k] = (habilidadesPorAgente[spec][k] || 0) + v; });
      habilidadesPorAgente[spec]._pagosCentral = (habilidadesPorAgente[spec]._pagosCentral || 0) + r.pagosCentral[i];
      jugadasPorAgente[spec] ??= { propio: 0, ajeno: 0, central: 0, oculta: 0, total: 0 };
      Object.keys(jugadasPorAgente[spec]).forEach(k => { jugadasPorAgente[spec][k] += r.jugadas[i][k]; });
      ['Ocultista', 'Cronista', 'Cronomante', 'Estratega', 'Aprendiz', 'Metamorfo', 'Maestro'].forEach(h => {
        conHab[h] ??= { usaron: { v: 0, n: 0 }, noUsaron: { v: 0, n: 0 } };
        const g = r.habilidades[i][h] ? conHab[h].usaron : conHab[h].noUsaron;
        g.v += gana; g.n++;
      });
    });
  });
  const agentes = {};
  Object.entries(porAgente).forEach(([k, s]) => {
    agentes[k] = {
      victorias: red(s.victorias / s.partidas), ic95: ic95(s.victorias, s.partidas), ganaSola: red(s.ganaSola / s.partidas),
      puntos: red(s.puntos / s.partidas, 2),
      habilidadesPorPartida: Object.fromEntries(Object.entries(habilidadesPorAgente[k]).map(([h, v]) => [h, red(v / s.partidas, 2)])),
      jugadas: Object.fromEntries(Object.entries(jugadasPorAgente[k]).filter(([h]) => h !== 'total')
        .map(([h, v]) => [h, red(v / Math.max(1, jugadasPorAgente[k].total))])),
    };
  });
  return {
    partidas: N, jugadoras: n,
    agentes,
    posicion: porPosicion.map((s, i) => ({ posicion: i + 1, victorias: red(s.victorias / s.partidas), ic95: ic95(s.victorias, s.partidas), puntos: red(s.puntos / s.partidas, 2) })),
    // Por asiento de la mesa original (útil con una saboteadora en el asiento 1:
    // el asiento 2 juega justo después de ella).
    asientoMesa: porMesa.map((s, i) => ({ asiento: i + 1, spec: registros[0].asientos[(registros[0].mesaIdx || []).indexOf(i)] ?? null, victorias: red(s.victorias / s.partidas), puntos: red(s.puntos / s.partidas, 2) })),
    invocacionesPorPartida: red(media(registros.map(r => r.invocaciones.length)), 2),
    distribucionInvocaciones: Object.fromEntries(Object.entries(distInv).map(([k, v]) => [k, red(v / N)])),
    nivelesCompletados: Object.fromEntries(Object.entries(nivelAlcanzado).map(([k, v]) => [k, red(v / N)])),
    fin: Object.fromEntries(Object.entries(fines).map(([k, v]) => [k, red(v / N)])),
    turnosMedios: red(media(turnos), 1),
    victoriaCompartida: red(empates / N), empateTotal: red(empateTotal / N),
    margenMedio: red(margen / N, 2), puntosGanadorMedio: red(media(ptsGanador), 2),
    liderTrasPrimeraInvocacionGana: conLider ? red(liderGana / conLider) : null,
    gemasInvocacionPorPersonajePorPartida: Object.fromEntries(Object.entries(gemasPersonaje).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, red(v / N)])),
    porPartida: Object.fromEntries(Object.entries(tot).map(([k, v]) => [k, red(v / N)])),
    victoriasSegunUsoHabilidad: Object.fromEntries(Object.entries(conHab).map(([h, g]) => [h, {
      usaron: g.usaron.n ? red(g.usaron.v / g.usaron.n) : null, n: g.usaron.n,
      noUsaron: g.noUsaron.n ? red(g.noUsaron.v / g.noUsaron.n) : null,
    }])),
    ...(registros[0].puntosAutomata !== null ? {
      automataCentral: { gana: red(ganaAutomata / N), ic95: ic95(ganaAutomata, N), puntosMedios: red(puntosAutomata / N, 2), intercambiosPorPartida: red(intercambios / N, 2), partidasConIntercambio: red(conIntercambio / N), ganaQuienIntercambiaSiHay: conIntercambio ? red(ganaIntercambio / conIntercambio) : null },
    } : {}),
  };
}

/**
 * Requisitos al azar (ideas de Julio, 2026-11-08). Cada invocación C, B y A
 * pide 3 personajes distintos (nunca Metamorfo ni Entusiasta); Gemas como el
 * set normal. Formas de sortearlos (`aleatorias`):
 * - 'uniforme' (o '1'): 9 personajes distintos al azar, cada uno igual de
 *   probable, sin repetir entre invocaciones.
 * - 'ordenada': como 'uniforme', pero el trío con más copias en el mazo va a
 *   la C y el de menos a la A.
 * - 'fichas': una ficha por cada copia del personaje en el mazo; cada
 *   invocación saca fichas hasta tener 3 personajes distintos y las
 *   devuelve después (un personaje puede repetirse entre invocaciones).
 * - 'fichasSinRepetir': igual, pero las fichas de los personajes ya elegidos
 *   salen de la bolsa para las invocaciones siguientes.
 * - 'cartas': al empezar cada invocación se roban cartas del mazo hasta
 *   tener 3 personajes distintos (las repetidas, Metamorfo y Entusiasta
 *   vuelven al mazo barajado); esas 3 cartas salen del juego.
 * - 'cartasVuelven': igual, pero al completarse la invocación sus 3 cartas
 *   vuelven al mazo barajado antes de robar las de la siguiente.
 * - 'escalonada': la C sale solo de las fichas de los personajes frecuentes
 *   (4 copias o más; si no llegan a 3, los 3 con más copias); la B y la A,
 *   de toda la bolsa, y cada una se saca al completarse la anterior
 *   ("la C desbloquea el resto de fichas").
 * - 'escalonadaA': igual, pero la A lleva al menos un personaje de los más
 *   escasos (los de menos copias del mazo).
 * Las de fichas y las uniformes se deciden al empezar la partida (la bolsa
 * no depende del juego); las de cartas y las escalonadas, al empezar cada
 * invocación.
 */
export const FORMAS_ALEATORIAS = ['uniforme', 'ordenada', 'fichas', 'fichasSinRepetir', 'cartas', 'cartasVuelven', 'escalonada', 'escalonadaA'];
const NIVELES_ALEATORIOS = ['C', 'B', 'A'];
const elegible = n => n !== 'Metamorfo' && n !== 'Entusiasta';
const barajar = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const composicionElegible = opciones => Object.fromEntries(Object.entries(composicionMazoTotal({ ...opciones, entusiasta: false })).filter(([n]) => elegible(n)));
const setVacio = () => Object.fromEntries(NIVELES_ALEATORIOS.map(nv => [nv, { nombre: `${nv} al azar`, need: [], gemas: INVOCATION_SETS.normal[nv].gemas }]));

/** Saca de `bolsa` (nombres con repetición) 3 personajes distintos. */
function sacarTrio(bolsa) {
  const b = barajar([...bolsa]);
  const trio = [];
  for (const n of b) { if (!trio.includes(n)) trio.push(n); if (trio.length === 3) return trio; }
  return null;
}

/** Set completo decidido al empezar (formas uniformes y de fichas), o null. */
export function setAleatorio(opciones, forma = 'uniforme') {
  const comp = composicionElegible(opciones);
  const nombres = Object.keys(comp);
  const set = setVacio();
  if (forma === 'uniforme' || forma === 'ordenada') {
    if (nombres.length < 9) return null;
    const bolsa = barajar([...nombres]).slice(0, 9);
    const trios = [bolsa.slice(0, 3), bolsa.slice(3, 6), bolsa.slice(6, 9)];
    if (forma === 'ordenada') {
      const copias = t => t.reduce((a, n) => a + comp[n], 0);
      trios.sort((x, y) => copias(y) - copias(x));
    }
    NIVELES_ALEATORIOS.forEach((nv, i) => { set[nv].need = trios[i]; });
    return set;
  }
  if (forma === 'fichas' || forma === 'fichasSinRepetir') {
    let bolsa = Object.entries(comp).flatMap(([n, k]) => Array(k).fill(n));
    for (const nv of NIVELES_ALEATORIOS) {
      const trio = sacarTrio(bolsa);
      if (!trio) return null;
      set[nv].need = trio;
      if (forma === 'fichasSinRepetir') bolsa = bolsa.filter(n => !trio.includes(n));
    }
    return set;
  }
  return null;
}

/**
 * Formas de cartas: roba del mazo real de `partida` las cartas requisito de
 * la invocación `nivel` (las deja en `partida.cartasRequisito`, públicas, que
 * la Experta descuenta al imaginar mundos). Devuelve false si el mazo no da
 * 3 personajes distintos (la invocación queda imposible).
 */
function robarRequisitos(partida, set, nivel, acumular) {
  const trio = [];
  const devolver = [];
  while (trio.length < 3 && partida.deck.length) {
    const c = partida.deck.pop();
    if (elegible(c.name) && !trio.some(t => t.name === c.name)) trio.push(c); else devolver.push(c);
  }
  partida.deck.push(...devolver);
  barajar(partida.deck);
  partida.cartasRequisito = [...(acumular ? partida.cartasRequisito || [] : []), ...trio.map(c => c.name)];
  partida._cartasRequisito = trio;
  set[nivel].need = trio.length === 3 ? trio.map(c => c.name) : ['(imposible)'];
  return trio.length === 3;
}

/** Trío de la invocación `nivel` en las formas escalonadas. */
function trioEscalonado(comp, nivel, forma) {
  const fichas = nombres => nombres.flatMap(n => Array(comp[n]).fill(n));
  const todos = Object.keys(comp);
  if (nivel === 'C') {
    let frec = todos.filter(n => comp[n] >= 4);
    if (frec.length < 3) frec = [...todos].sort((a, b) => comp[b] - comp[a]).slice(0, 3);
    return sacarTrio(fichas(frec));
  }
  if (nivel === 'A' && forma === 'escalonadaA') {
    const min = Math.min(...todos.map(n => comp[n]));
    const escaso = barajar(todos.filter(n => comp[n] === min))[0];
    const resto = sacarTrio(fichas(todos.filter(n => n !== escaso)));
    return [escaso, ...resto.slice(0, 2)];
  }
  return sacarTrio(fichas(todos));
}

/** Ganchos de la partida para las formas escalonadas. */
function ganchosEscalonados(forma, set) {
  return {
    inicio(partida) {
      const comp = composicionElegible(partida);
      NIVELES_ALEATORIOS.forEach(nv => { set[nv].need = trioEscalonado(comp, nv, forma); });
    },
    siguiente(partida) {
      const nivel = NIVELES_ALEATORIOS[partida.levelIdx];
      if (nivel) set[nivel].need = trioEscalonado(composicionElegible(partida), nivel, forma);
    },
  };
}

/** Ganchos de la partida para las formas de cartas (o null para las demás). */
function ganchosCartas(forma, set) {
  if (forma === 'escalonada' || forma === 'escalonadaA') return ganchosEscalonados(forma, set);
  if (forma !== 'cartas' && forma !== 'cartasVuelven') return null;
  // Mientras no se roban, las invocaciones futuras muestran una suposición
  // (para que la Experta, si mira más allá de un cierre, no vea vacío).
  return {
    inicio(partida) { NIVELES_ALEATORIOS.forEach(nv => { set[nv].need = sacarTrio(Object.entries(composicionElegible(partida)).flatMap(([n, k]) => Array(k).fill(n))); }); robarRequisitos(partida, set, 'C', false); },
    siguiente(partida) {
      if (forma === 'cartasVuelven') { partida.deck.push(...(partida._cartasRequisito || [])); barajar(partida.deck); }
      partida._cartasRequisito = [];
      const nivel = NIVELES_ALEATORIOS[partida.levelIdx];
      if (nivel) robarRequisitos(partida, set, nivel, forma === 'cartas');
    },
  };
}
let ganchosRequisitos = null;

export function experimento({ mesa, partidas = 1000, opciones = { modo: 'normal' }, semilla = 1, rotar = true, perfiles = {}, cantidades = null, apartar = null, variantes = null, aleatorias = false }) {
  const modo = MODOS_JUEGO[opciones.modo || 'normal'];
  if (variantes) Object.assign(VARIANTES, variantes);
  const setsOrig = modo.sets;
  const forma = aleatorias === true || aleatorias === '1' ? 'uniforme' : aleatorias;
  if (forma && !FORMAS_ALEATORIAS.includes(forma)) throw new Error(`Forma de requisitos desconocida: ${forma}`);
  if (aleatorias) { modo.sets = [...modo.sets, 'aleatorio']; opciones = { ...opciones, invocationSet: 'aleatorio' }; }
  const cantOrig = modo.cantidades; const apartarOrig = modo.apartar;
  if (cantidades) modo.cantidades = Object.fromEntries(Object.entries({ ...modo.cantidades, ...cantidades }).filter(([, v]) => v > 0));
  if (apartar !== null) modo.apartar = apartar;
  sembrarAzar(semilla);
  const regs = [];
  try {
    for (let g = 0; g < partidas; g++) {
      const asientos = rotar ? mesa.map((_, i) => mesa[(i + g) % mesa.length]) : mesa;
      if (aleatorias) {
        const cfg = { ...opciones, invocationSet: 'normal' };
        const set = forma.startsWith('cartas') || forma.startsWith('escalonada') ? setVacio() : setAleatorio(cfg, forma);
        if (!set) throw new Error(`Este modo no tiene personajes suficientes para requisitos '${forma}'`);
        INVOCATION_SETS.aleatorio = set;
        ganchosRequisitos = ganchosCartas(forma, set);
      }
      const reg = jugarPartidaAnalisis(asientos, opciones, perfiles);
      // Asiento de la mesa original (`--mesa`) que ocupa cada posición: con
      // la rotación, el asiento j de la mesa siempre tiene al j+1 detrás.
      reg.mesaIdx = asientos.map((_, i) => (rotar ? (i + g) % mesa.length : i));
      regs.push(reg);
    }
  } finally {
    modo.cantidades = cantOrig; modo.apartar = apartarOrig; modo.sets = setsOrig;
    delete INVOCATION_SETS.aleatorio;
    ganchosRequisitos = null;
    reiniciarVariantes();
  }
  return resumir(regs);
}

// ---------- Línea de comandos ----------
const esPrincipal = import.meta.url === `file://${process.argv[1]}`;
if (esPrincipal) {
  const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1]]);
    return acc;
  }, []));
  const t0 = Date.now();
  const opciones = { modo: args.modo || 'normal', invocationSet: args.set, entusiasta: args.entusiasta === '1', madain: args.madain === '1', intercambio: args.intercambio || 'siempre' };
  const res = experimento({
    mesa: (args.mesa || 'dificil,dificil,dificil').split(','),
    partidas: +(args.partidas || 1000),
    opciones,
    semilla: +(args.semilla || 1),
    rotar: args.rotar !== '0',
    perfiles: args.perfiles ? JSON.parse(args.perfiles) : {},
    cantidades: args.cantidades ? JSON.parse(args.cantidades) : null,
    apartar: args.apartar !== undefined ? +args.apartar : null,
    variantes: args.variantes ? JSON.parse(args.variantes) : null,
    aleatorias: args.aleatorias || false,
  });
  console.log(JSON.stringify({ etiqueta: args.etiqueta || null, mesa: args.mesa, opciones, cantidades: args.cantidades || null, apartar: args.apartar ?? null, variantes: args.variantes || null, aleatorias: args.aleatorias || false, ...res, segundos: (Date.now() - t0) / 1000 }, null, 1));
}

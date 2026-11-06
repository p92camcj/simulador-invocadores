// aprendizaje.js
// Aprendizaje AUTÓNOMO de las autómatas a partir de partidas con personas.
// Sin servidor: todo ocurre en el navegador de quien juega.
//
// Idea (aprendizaje por imitación / "modelo de la oponente"):
// 1. Cada vez que una persona juega su carta (Fase A), se guarda un
//    EJEMPLO: lo que esa persona sabía en ese momento (la misma vista
//    saneada que usan las autómatas, construida desde SU asiento y sin
//    nombres) y la jugada que eligió.
// 2. Al acabar cada partida se AJUSTA un modelo: los pesos de
//    js/bot-estrategia.js (rival, posicion, amenaza), una temperatura
//    `beta` y un sesgo por jugar la carta conocida, de forma que la
//    evaluación de Difícil, pasada por un softmax, explique lo mejor
//    posible las jugadas que hicieron las personas (máxima verosimilitud,
//    búsqueda por coordenadas en una rejilla).
// 3. La Experta usa ese modelo para PREVER a las personas cuando simula
//    sus turnos en los mundos posibles (js/bot-busqueda.js), en vez de
//    suponer que juegan como una autómata Difícil.
//
// Todo es puro: sin DOM, sin `window`, sin localStorage (eso vive en
// js/aprendizaje-navegador.js). Nunca recibe la partida real.

import { evaluarJugadasFaseA, PESOS } from './bot-estrategia.js';

export const VERSION_ALMACEN = 1;
/** Ejemplos guardados como máximo (los más recientes). */
export const MAX_EJEMPLOS = 300;
/** Ejemplos mínimos para usar el modelo en vez de suponer una autómata Difícil. */
export const MIN_EJEMPLOS_MODELO = 15;

const CLAVES_PESOS = ['rival', 'posicion', 'amenaza'];
const REJILLA = {
  rival: [0, 0.25, 0.5, 0.75, 1, 1.5],
  posicion: [0, 0.2, 0.4, 0.7, 1],
  amenaza: [0, 0.4, 0.8, 1.2],
};
const REJILLA_BETA = [0.25, 0.5, 1, 2, 4, 8];
const REJILLA_SESGO = [-1, -0.5, 0, 0.5, 1, 2];

export function crearAlmacenVacio() {
  return { version: VERSION_ALMACEN, partidas: 0, ejemplos: [], modelo: null };
}

/** Valida y normaliza un almacén leído (de localStorage o de un archivo importado). */
export function normalizarAlmacen(datos) {
  const vacio = crearAlmacenVacio();
  if (!datos || typeof datos !== 'object' || datos.version !== VERSION_ALMACEN) return vacio;
  const ejemplos = Array.isArray(datos.ejemplos) ? datos.ejemplos.filter(esEjemploValido) : [];
  return {
    version: VERSION_ALMACEN,
    partidas: Number.isFinite(datos.partidas) ? datos.partidas : 0,
    ejemplos: ejemplos.slice(-MAX_EJEMPLOS),
    modelo: datos.modelo && typeof datos.modelo === 'object' ? datos.modelo : null,
  };
}

function esEjemploValido(e) {
  return e && typeof e === 'object' && e.vista && Array.isArray(e.vista.jugadoras)
    && Array.isArray(e.need) && typeof e.destKey === 'string' && typeof e.usaConocida === 'boolean';
}

/**
 * Ejemplo de entrenamiento a partir de la vista saneada de la persona que
 * juega (`construirEstadoVisibleParaBot(players, neutrals, suIdx)`) y de lo
 * que eligió. Se quitan los nombres: no hacen falta para aprender.
 */
export function crearEjemplo({ vista, need, valorGemaNivel, probabilidadPorNombre, usaConocida, destKey }) {
  const copia = JSON.parse(JSON.stringify(vista));
  copia.jugadoras.forEach(j => { delete j.nombre; });
  return { vista: copia, need: [...need], valorGemaNivel, probs: { ...probabilidadPorNombre }, usaConocida, destKey };
}

/** Añade ejemplos al almacén, conservando solo los MAX_EJEMPLOS más recientes. */
export function anadirEjemplos(almacen, ejemplos) {
  almacen.ejemplos = almacen.ejemplos.concat(ejemplos.filter(esEjemploValido)).slice(-MAX_EJEMPLOS);
  return almacen;
}

/** Ejecuta `fn` con los PESOS de bot-estrategia.js cambiados temporalmente. */
export function conPesos(pesos, fn) {
  const previos = { ...PESOS };
  Object.assign(PESOS, pesos);
  try {
    return fn();
  } finally {
    Object.assign(PESOS, previos);
  }
}

/** Puntuación (antes del softmax) de cada candidata según el modelo. */
function puntosCandidatas(candidatas, beta, sesgoConocida) {
  return candidatas.map(c => beta * c.valor + (c.usaConocida ? sesgoConocida : 0));
}

/** Candidatas de cada ejemplo con los pesos dados, y el índice de la elegida. */
function prepararEjemplos(ejemplos, pesos) {
  return conPesos(pesos, () => ejemplos.map(e => {
    const candidatas = evaluarJugadasFaseA(e.vista, e.need, e.valorGemaNivel, e.probs);
    const elegida = candidatas.findIndex(c => c.usaConocida === e.usaConocida && c.destKey === e.destKey);
    return { candidatas, elegida };
  }).filter(p => p.elegida >= 0 && p.candidatas.length > 1));
}

/** Log-verosimilitud media de las elecciones con un softmax de temperatura `beta`. */
function logVerosimilitudPreparada(preparados, beta, sesgoConocida) {
  if (!preparados.length) return 0;
  let total = 0;
  preparados.forEach(({ candidatas, elegida }) => {
    const puntos = puntosCandidatas(candidatas, beta, sesgoConocida);
    const max = Math.max(...puntos);
    const z = puntos.reduce((s, p) => s + Math.exp(p - max), 0);
    total += puntos[elegida] - max - Math.log(z);
  });
  return total / preparados.length;
}

/** Log-verosimilitud media de `ejemplos` bajo `modelo` (para tests y diagnóstico). */
export function logVerosimilitud(ejemplos, modelo) {
  const pesos = Object.fromEntries(CLAVES_PESOS.map(k => [k, modelo[k]]));
  return logVerosimilitudPreparada(prepararEjemplos(ejemplos, pesos), modelo.beta, modelo.sesgoConocida);
}

/** Mejor (beta, sesgo) para unas candidatas ya calculadas. */
function mejorTemperatura(preparados) {
  let mejor = { beta: 1, sesgoConocida: 0, lv: -Infinity };
  REJILLA_BETA.forEach(beta => REJILLA_SESGO.forEach(sesgoConocida => {
    const lv = logVerosimilitudPreparada(preparados, beta, sesgoConocida);
    if (lv > mejor.lv) mejor = { beta, sesgoConocida, lv };
  }));
  return mejor;
}

/**
 * Ajusta el modelo de las personas a los ejemplos (máxima verosimilitud por
 * búsqueda por coordenadas: cada peso recorre su rejilla con los demás
 * fijos, dos pasadas). Devuelve `null` si no hay ejemplos suficientes.
 * `acierto` es la fracción de jugadas en que la favorita del modelo es la
 * que hizo la persona.
 */
export function ajustarModelo(ejemplos) {
  if (ejemplos.length < MIN_EJEMPLOS_MODELO) return null;
  const pesos = { rival: PESOS.rival, posicion: PESOS.posicion, amenaza: PESOS.amenaza };
  let mejor = { ...mejorTemperatura(prepararEjemplos(ejemplos, pesos)), pesos: { ...pesos } };
  for (let pasada = 0; pasada < 2; pasada++) {
    CLAVES_PESOS.forEach(clave => {
      REJILLA[clave].forEach(valor => {
        if (valor === mejor.pesos[clave]) return;
        const prueba = { ...mejor.pesos, [clave]: valor };
        const t = mejorTemperatura(prepararEjemplos(ejemplos, prueba));
        if (t.lv > mejor.lv + 1e-9) mejor = { ...t, pesos: prueba };
      });
    });
  }
  const preparados = prepararEjemplos(ejemplos, mejor.pesos);
  const aciertos = preparados.filter(({ candidatas, elegida }) => {
    const puntos = puntosCandidatas(candidatas, mejor.beta, mejor.sesgoConocida);
    return puntos[elegida] >= Math.max(...puntos) - 1e-9;
  }).length;
  return {
    ...mejor.pesos,
    beta: mejor.beta,
    sesgoConocida: mejor.sesgoConocida,
    logVerosimilitud: +mejor.lv.toFixed(4),
    acierto: preparados.length ? +(aciertos / preparados.length).toFixed(3) : 0,
    ejemplos: ejemplos.length,
  };
}

/** ¿Hay un modelo con datos suficientes para usarlo? */
export function modeloUtilizable(modelo) {
  return !!modelo && modelo.ejemplos >= MIN_EJEMPLOS_MODELO
    && CLAVES_PESOS.every(k => Number.isFinite(modelo[k]))
    && Number.isFinite(modelo.beta) && Number.isFinite(modelo.sesgoConocida);
}

/**
 * Jugada de Fase A "como lo haría una persona" según el modelo: se evalúan
 * las candidatas con los pesos aprendidos y se SORTEA una con el softmax
 * (las personas no siempre eligen la mejor jugada). Devuelve la candidata
 * `{ usaConocida, destKey, valor, cierra }`.
 */
export function elegirJugadaComoPersona(vista, need, valorGemaNivel, probabilidadPorNombre, modelo, azar = Math.random) {
  const pesos = Object.fromEntries(CLAVES_PESOS.map(k => [k, modelo[k]]));
  const candidatas = conPesos(pesos, () => evaluarJugadasFaseA(vista, need, valorGemaNivel, probabilidadPorNombre));
  const puntos = puntosCandidatas(candidatas, modelo.beta, modelo.sesgoConocida);
  const max = Math.max(...puntos);
  const pesosSorteo = puntos.map(p => Math.exp(p - max));
  let r = azar() * pesosSorteo.reduce((a, b) => a + b, 0);
  for (let i = 0; i < candidatas.length; i++) {
    r -= pesosSorteo[i];
    if (r <= 0) return candidatas[i];
  }
  return candidatas.at(-1);
}

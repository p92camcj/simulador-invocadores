// aprendizaje-navegador.js
// Adaptador web del aprendizaje de las autómatas (js/aprendizaje.js):
// guarda en el navegador (localStorage) las jugadas de las personas, ajusta
// el modelo al acabar cada partida, se lo da a las autómatas
// (`establecerModeloPersonas` de js/bot.js) y pinta el panel de la pantalla
// de configuración (descargar / importar / borrar lo aprendido).
//
// Privacidad: solo se guarda lo que la persona veía en la mesa y la jugada
// que hizo, sin nombres, y nunca sale del dispositivo salvo que se descargue.

import {
  crearAlmacenVacio, normalizarAlmacen, crearEjemplo, anadirEjemplos, ajustarModelo,
  modeloUtilizable, MIN_EJEMPLOS_MODELO,
} from './aprendizaje.js';
import { construirEstadoVisibleParaBot, establecerModeloPersonas } from './bot.js';
import { estimarProbabilidadesPersonajes, valorMedioGemaNivel } from './bot-probabilidad.js';
import { configPartida, invocacionDePartida } from './utils.js';

const CLAVE = 'invocadores.aprendizaje';
let almacen = crearAlmacenVacio();
let ejemplosEnEstaPartida = 0;

function leer() {
  try {
    const texto = localStorage.getItem(CLAVE);
    return normalizarAlmacen(texto ? JSON.parse(texto) : null);
  } catch {
    return crearAlmacenVacio();
  }
}

function guardar() {
  try { localStorage.setItem(CLAVE, JSON.stringify(almacen)); } catch { /* sin espacio o bloqueado: se sigue sin guardar */ }
}

function aplicarModelo() {
  establecerModeloPersonas(modeloUtilizable(almacen.modelo) ? almacen.modelo : null);
}

/** Carga lo aprendido, se lo da a las autómatas y prepara el panel de configuración. */
export function initAprendizaje() {
  almacen = leer();
  aplicarModelo();
  conectarPanel();
  pintarPanel();
}

/**
 * Antes de jugar una carta: si quien juega es una persona, prepara el
 * ejemplo de entrenamiento con lo que ella sabe (vista saneada desde su
 * asiento). Devuelve `null` para las autómatas.
 */
export function prepararEjemploPersona(partida, cartaIdx, destKey) {
  try {
    const idx = partida.turn;
    const jugadora = partida.players[idx];
    if (!jugadora || jugadora.tipo === 'auto' || partida.played) return null;
    const carta = jugadora.hand[cartaIdx];
    if (!carta) return null;
    const cfg = configPartida(partida);
    const inv = invocacionDePartida(cfg);
    if (!inv) return null;
    const lvl = inv.nivel;
    const need = inv.need;
    const vista = construirEstadoVisibleParaBot(partida.players, partida.neutrals, idx);
    const probabilidades = estimarProbabilidadesPersonajes(vista, { portales: {} }, cfg);
    return crearEjemplo({
      vista, need,
      valorGemaNivel: valorMedioGemaNivel(cfg, lvl),
      probabilidadPorNombre: probabilidades.probabilidadPorNombre,
      usaConocida: carta.vis?.owner === true,
      destKey,
    });
  } catch {
    return null; // el aprendizaje nunca debe romper una partida
  }
}

/** Tras una jugada válida de una persona: guarda su ejemplo. */
export function guardarEjemploPersona(ejemplo) {
  if (!ejemplo) return;
  anadirEjemplos(almacen, [ejemplo]);
  ejemplosEnEstaPartida++;
  guardar();
}

/** Al terminar la partida: si jugaron personas, vuelve a ajustar el modelo. */
export function aprenderAlTerminarPartida() {
  if (!ejemplosEnEstaPartida) return;
  ejemplosEnEstaPartida = 0;
  almacen.partidas++;
  guardar();
  // El ajuste tarda uno o dos segundos con muchas jugadas: se hace después
  // de mostrar el resultado de la partida, sin bloquearlo.
  setTimeout(reajustar, 50);
}

function reajustar() {
  try {
    almacen.modelo = ajustarModelo(almacen.ejemplos);
  } catch {
    almacen.modelo = null;
  }
  guardar();
  aplicarModelo();
  pintarPanel();
}

// ---------- Panel de la pantalla de configuración ----------

function textoPanel() {
  const n = almacen.ejemplos.length;
  if (!n) return 'Las autómatas aprenden de cómo juegan las personas en este dispositivo. Aún no hay jugadas registradas.';
  const base = `Han observado ${n} jugadas de personas en ${almacen.partidas} partidas.`;
  if (!modeloUtilizable(almacen.modelo)) {
    return `${base} Empezarán a usarlo a partir de ${MIN_EJEMPLOS_MODELO} jugadas.`;
  }
  const pct = Math.round(almacen.modelo.acierto * 100);
  return `${base} La Experta ya lo usa para prever vuestras jugadas (acierta la jugada exacta el ${pct} % de las veces).`;
}

function pintarPanel() {
  const texto = document.getElementById('txtAprendizaje');
  if (texto) texto.textContent = textoPanel();
  const hayDatos = almacen.ejemplos.length > 0;
  ['btnAprendizajeDescargar', 'btnAprendizajeBorrar'].forEach(id => {
    const b = document.getElementById(id);
    if (b) b.disabled = !hayDatos;
  });
}

function conectarPanel() {
  document.getElementById('btnAprendizajeDescargar')?.addEventListener('click', descargar);
  document.getElementById('btnAprendizajeBorrar')?.addEventListener('click', () => {
    if (!confirm('¿Borrar todo lo que las autómatas han aprendido en este dispositivo?')) return;
    almacen = crearAlmacenVacio();
    guardar();
    aplicarModelo();
    pintarPanel();
  });
  const archivo = document.getElementById('fileAprendizaje');
  document.getElementById('btnAprendizajeImportar')?.addEventListener('click', () => archivo?.click());
  archivo?.addEventListener('change', () => {
    const f = archivo.files?.[0];
    if (!f) return;
    f.text().then(texto => {
      const importado = normalizarAlmacen(JSON.parse(texto));
      if (!importado.ejemplos.length) throw new Error('vacío');
      anadirEjemplos(almacen, importado.ejemplos);
      almacen.partidas += importado.partidas;
      reajustar();
      alert(`Importadas ${importado.ejemplos.length} jugadas.`);
    }).catch(() => alert('Ese archivo no es un registro de aprendizaje válido.'))
      .finally(() => { archivo.value = ''; });
  });
}

function descargar() {
  const blob = new Blob([JSON.stringify(almacen)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `invocadores-aprendizaje-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

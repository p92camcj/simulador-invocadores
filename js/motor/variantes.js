// js/motor/variantes.js
// Variantes de reglas que SOLO se usan para medirlas en el simulador de
// partidas (tools/equilibrio.mjs). Todas están apagadas: con estos valores
// el juego es exactamente el del reglamento. La web nunca las cambia.
// Son propuestas para que Adrián decida (análisis de equilibrio,
// 2026-11-08); si alguna se adopta, debe pasar al reglamento y al código
// normal, y salir de aquí.
export const VARIANTES = {
  // Las 3 Gemas de partida (marcadas `inicial`) sirven para pagar pero no
  // puntúan; al pagar se gastan primero.
  gemasInicialesNoPuntuan: false,
  // Un requisito duplicado da una Gema de valor 1 a la dueña de cada copia
  // (en vez de que nadie cobre).
  duplicadoDaGema: false,
  // La transformación del Metamorfo es gratis en un Portal propio (en un
  // Portal central se sigue pagando todo).
  metamorfoGratisPropio: false,
  // El bonus del Maestro solo lo anula un Pícaro visible en un Portal de la
  // misma dueña que el Maestro (no cualquiera de la mesa).
  maestroSoloPicaroPropio: false,
};

const BASE = { ...VARIANTES };

/** Vuelve a dejar todas las variantes como en el reglamento. */
export function reiniciarVariantes() {
  Object.assign(VARIANTES, BASE);
}

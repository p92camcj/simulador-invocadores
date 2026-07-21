// bot-probabilidad.js
//
// Motor de conteo de cartas y valor esperado para la dificultad 'dificil'
// del autómata (ver js/bot.js). Toda función de aquí es PURA (sin DOM, sin
// `window`, sin `alert`/`picker`) y opera ÚNICAMENTE sobre la vista saneada
// que ya construye `construirEstadoVisibleParaBot()` (js/bot.js) más la
// memoria propia de ESE autómata (`memoriaBot`) — nunca sobre `players`/
// `neutrals`/`window.deck` reales. Esto es deliberado y auditable: ni
// siquiera hay una firma de función en este archivo que acepte el estado
// real del juego, así que no hay forma de que la heurística 'dificil' haga
// trampa aunque cambie en el futuro.
//
// Diseño (ver el prompt original de esta tarea, "Bloque 3"):
// 1. `actualizarMemoriaBot()` — registra, por Portal (clave absoluta
//    "playerIdx:portalIdx" o "n:k", el mismo formato que ya usan
//    `stackFrom()`/`portalesConEstado()` en utils.js), qué personaje ha
//    visto el bot en su cima a lo largo de la partida, aunque ahora esté
//    tapado por una carta posterior. Solo se añade una entrada nueva cuando
//    el nombre visible en la cima CAMBIA respecto a la última vez que este
//    bot miró — así una Centinela que se oculta y se vuelve a revelar sin
//    cambiar de identidad no se cuenta dos veces.
// 2. `estimarProbabilidadesPersonajes()` — conteo de cartas: composición
//    total del mazo (dato público, `composicionMazoTotal()` en utils.js)
//    menos lo ya contabilizado (Portales vistos —ahora o en el pasado—,
//    manos con carta pública, la propia carta conocida). El resto son
//    personajes de ubicación desconocida (mazo de robo, la propia carta
//    oculta, o la carta privada de otra jugadora); se reparte su
//    probabilidad de forma UNIFORME entre el nº de huecos desconocidos —
//    simplificación deliberada, no una certeza (ver el prompt original).
// 3. `valorEsperadoDeAccion()` — dada una acción candidata (qué personaje
//    se juega/mueve, con certeza total o como distribución de
//    probabilidad, y en qué Portal) y el contexto de la invocación activa,
//    estima el valor esperado en Gemas de esa acción. No es un cálculo
//    perfecto a varios turnos vista — es una aproximación honesta, como
//    pide el prompt original: qué tan probable es que ayude a completar la
//    invocación activa, ponderado por si el Portal destino es propio
//    (la Gema del personaje que complete ese hueco es para su dueño),
//    central/neutral (esa Gema no la cobra nadie — ver `actions.js`,
//    `arr[0] !== null`) o de otra jugadora (le beneficia a ELLA, no al
//    bot, se pondera bajo pero no a cero porque aun así puede acercar el
//    cierre de la invocación).

import { INVOCATION_SETS, composicionMazoTotal } from './utils.js';

// Cuánto vale, en términos relativos, que el personaje jugado/movido acabe
// en un Portal PROPIO (se cobra la Gema entera), uno de OTRA jugadora
// (ella cobra esa Gema, no el bot — pero completar la invocación sigue
// beneficiando indirectamente si el bot ya tiene otras piezas puestas) o
// uno central/neutral (nadie cobra esa Gema en concreto, ver
// `actions.js`: `arr[0] !== null`). No son valores de las reglas del juego,
// son un peso heurístico de esta tarea — documentado aquí para que sea
// fácil de ajustar sin rebuscar en la lógica.
const FACTOR_DESTINO_PROPIO = 1;
const FACTOR_DESTINO_AJENO = 0.3;
const FACTOR_DESTINO_CENTRAL = 0;

// Peso adversarial (Bloque 3 de esta tarea): fracción del valor de Gema del
// nivel activo que el bot "gana" por perjudicar a una rival — denegándole
// por duplicado un requisito que hoy solo ella tiene visible, o tapando
// directamente el Portal donde lo tiene. NOTA sobre el prompt original de
// esta tarea: describía esto como "generalizar el desempate YA EXISTENTE
// basado en contarGemasPorNivel" — pero ese desempate nunca llegó a
// implementarse en la ronda anterior (quedó documentado como
// deliberadamente omitido, ver el comentario en `decidirJugadaFaseADificil`,
// `js/bot.js`); no existía nada que generalizar. Este término adversarial
// es, por tanto, nuevo por completo, no una extensión de algo previo — la
// discrepancia se documenta aquí siguiendo la "Nota general" del prompt.
// Ponderado por debajo del beneficio propio directo (`FACTOR_DESTINO_*`)
// porque el objetivo primario del bot sigue siendo su propio avance, no la
// guerra total contra las rivales — valor elegido, no derivado de ninguna
// regla del juego.
const PESO_ADVERSARIAL = 0.5;

// Bonus (en unidades de "valor medio de Gema del nivel activo") que se suma
// cuando una acción, con certeza, deja la invocación activa completa AHORA
// MISMO (todos los Portales del tablero ocupados y visibles, y los 3
// personajes de `need` presentes) — cerrar una invocación siempre es
// deseable, más allá de la Gema concreta de este hueco.
const BONUS_COMPLETAR_INVOCACION = 2;

/**
 * Registra en `memoriaBot` (objeto `{ portales: { [clave]: string[] } }`,
 * uno por autómata, vive en `window.memoriaBots[botIdx]` — ver `bot.js`)
 * qué personaje ve el bot ahora mismo en la cima de cada Portal, con clave
 * absoluta `"playerIdx:portalIdx"` / `"n:k"` (mismo formato que
 * `stackFrom()`/`portalesConEstado()` en utils.js, para que
 * `estimarProbabilidadesPersonajes()` pueda cruzarlo directamente con las
 * opciones de una habilidad sin convertir formatos). Solo añade una entrada
 * nueva si el nombre visible cambia respecto a la última vez que ESTE bot
 * miró — evita contar dos veces la misma carta si solo cambia su
 * visibilidad (p. ej. Ocultista ocultándola y revelándola de nuevo sin que
 * cambie su identidad).
 */
export function actualizarMemoriaBot(memoriaBot, vista) {
  const verPortal = (clave, estado) => {
    if (!estado || estado.hidden || !estado.name) return;
    const historial = memoriaBot.portales[clave] || (memoriaBot.portales[clave] = []);
    if (historial.at(-1) !== estado.name) historial.push(estado.name);
  };
  vista.jugadoras.forEach(j => {
    j.portales.forEach((estado, idx) => verPortal(`${j.idx}:${idx}`, estado));
  });
  vista.neutrales.forEach((estado, idx) => verPortal(`n:${idx}`, estado));
}

/**
 * Conteo de cartas: para cada personaje, copias totales en el mazo
 * configurado (`composicionMazoTotal()`, dato público) menos las ya
 * contabilizadas por este bot — visibles ahora en cualquier Portal Y
 * memorizadas de Portales ya vistos (ambas cosas viven juntas en
 * `memoriaBot.portales`, ver `actualizarMemoriaBot()`), en manos con carta
 * pública (`cartaOcultaPublica` de cualquier OTRA jugadora), y la propia
 * carta conocida. El resto son personajes de ubicación desconocida
 * (reparto de mazo, la propia carta oculta, o la carta privada de otra
 * jugadora): su probabilidad se reparte de forma UNIFORME entre el nº de
 * huecos desconocidos que queden — simplificación razonable y deliberada,
 * no una certeza (documentado también en el prompt original de esta
 * tarea).
 *
 * Devuelve `{ contabilizadas, desconocidos, totalHuecosDesconocidos,
 * probabilidadPorNombre }`.
 */
export function estimarProbabilidadesPersonajes(vista, memoriaBot, invocationSet) {
  const composicion = composicionMazoTotal(invocationSet);
  const contabilizadas = {};
  const contar = nombre => {
    if (!nombre) return;
    contabilizadas[nombre] = (contabilizadas[nombre] || 0) + 1;
  };

  Object.values(memoriaBot.portales).forEach(historial => historial.forEach(contar));
  vista.jugadoras.forEach(j => {
    if (j.esUnoMismo) contar(vista.propiaCartaConocida?.name);
    else contar(j.cartaOcultaPublica);
  });

  const desconocidos = {};
  let totalHuecosDesconocidos = 0;
  Object.entries(composicion).forEach(([nombre, total]) => {
    const restante = total - (contabilizadas[nombre] || 0);
    if (restante > 0) {
      desconocidos[nombre] = restante;
      totalHuecosDesconocidos += restante;
    }
  });

  const probabilidadPorNombre = {};
  Object.entries(desconocidos).forEach(([nombre, cantidad]) => {
    probabilidadPorNombre[nombre] = totalHuecosDesconocidos > 0 ? cantidad / totalHuecosDesconocidos : 0;
  });

  return { contabilizadas, desconocidos, totalHuecosDesconocidos, probabilidadPorNombre };
}

/** Valor medio de Gema del nivel `lvl` de la invocación activa (dato público, ya está en INVOCATION_SETS). */
export function valorMedioGemaNivel(invocationSet, lvl) {
  const { gemas } = INVOCATION_SETS[invocationSet][lvl];
  return gemas.reduce((a, b) => a + b, 0) / gemas.length;
}

/**
 * ¿Qué personaje ve el bot (con certeza) en la clave de Portal absoluta
 * `clave` ("playerIdx:portalIdx" / "n:k")? Si el Portal está oculto AHORA
 * pero `memoriaBot` recuerda su última identidad conocida, se trata como
 * determinista (ya está "contabilizada" en `estimarProbabilidadesPersonajes`,
 * así que también debe tratarse como determinista aquí, no como una
 * incógnita más — mismo criterio, sin contradecirse). Si nunca se ha visto,
 * devuelve `null` (identidad genuinamente desconocida para este bot).
 */
export function personajeMemorizadoEnPortal(memoriaBot, clave) {
  const historial = memoriaBot.portales[clave];
  return historial && historial.length ? historial.at(-1) : null;
}

/**
 * Personajes de `need` que HOY están visibles como única copia en toda la
 * mesa Y en un Portal de una RIVAL (nunca del propio bot) — "vulnerables":
 * denegárselos (por duplicado en cualquier otro sitio, o tapando
 * directamente ese Portal) le quita a esa rival una recompensa con la que
 * ya contaba. Devuelve `{ nombre: destKey }` con `destKey` en el MISMO
 * formato `"a:<playerIdx>:<portalIdx>"` que usa `listaPortalesConDestino()`
 * (Fase A) para que `valorEsperadoDeAccion()` pueda comparar directamente
 * el destino de una acción candidata contra este destino sin convertir
 * formatos. Generaliza, para la dificultad 'dificil', el mismo criterio
 * "único requisito visible de esa jugadora" que ya usa la heurística
 * 'normal' (`decidirJugadaAdversarialNormal`, `js/bot.js`) — Bloque 3 de
 * esta tarea.
 */
export function calcularNecesariosUnicosDeRivales(vista, need) {
  const conteo = {};
  const ubicacion = {};
  vista.jugadoras.forEach(j => {
    j.portales.forEach((estado, idx) => {
      if (!estado?.name) return;
      conteo[estado.name] = (conteo[estado.name] || 0) + 1;
      ubicacion[estado.name] = { esPropio: j.esUnoMismo, destKey: `a:${j.idx}:${idx}` };
    });
  });
  const resultado = {};
  need.forEach(nombre => {
    const u = ubicacion[nombre];
    if (u && !u.esPropio && conteo[nombre] === 1) resultado[nombre] = u.destKey;
  });
  return resultado;
}

/**
 * Valor esperado en Gemas de una acción candidata (jugar o mover un
 * personaje a un Portal). `personaje` es `string` si su identidad es
 * CIERTA (carta conocida, o Portal ya memorizado) o `null` si es una
 * distribución de probabilidad (carta oculta propia, o Portal nunca visto
 * por este bot — en ese caso se usa `probabilidades.probabilidadPorNombre`
 * completo). No es un cálculo perfecto a varios turnos vista — una
 * aproximación honesta: cuánto ayuda a completar el combo activo,
 * ponderado por quién se queda la Gema de ese hueco concreto si se
 * completa la invocación (`FACTOR_DESTINO_*`), más un bonus fuerte si esta
 * acción, con certeza, deja la invocación completa ahora mismo.
 *
 * Término ADVERSARIAL (Bloque 3 de esta tarea, `PESO_ADVERSARIAL` arriba):
 * además de lo anterior, suma valor propio por perjudicar a una rival —
 * `contexto.necesariosUnicosDeRivales` (ver `calcularNecesariosUnicosDeRivales`)
 * y `accionCandidata.destKey`/`cubreNecesarioUnicoRival` identifican los dos
 * mecanismos posibles: (a) esta acción, jugada en OTRO Portal, crea un
 * segundo ejemplar visible de un personaje que hoy solo tiene una rival
 * (denegación por duplicado, ponderada por la probabilidad si la identidad
 * no es cierta); (b) esta acción se juega EXACTAMENTE en el Portal donde
 * una rival tiene su único ejemplar visible, tapándolo — deterministamente,
 * porque cualquier carta que se juegue ahí lo oculta, sea cual sea.
 */
export function valorEsperadoDeAccion(accionCandidata, probabilidades, contexto) {
  const { personaje, esPropio, esCentral, completaInvocacionSiSeJuega, destKey, cubreNecesarioUnicoRival } = accionCandidata;
  const { need, cumplidos, valorGemaNivel, necesariosUnicosDeRivales } = contexto;

  const distribucion = personaje ? { [personaje]: 1 } : probabilidades.probabilidadPorNombre;
  const factorDestino = esCentral ? FACTOR_DESTINO_CENTRAL : esPropio ? FACTOR_DESTINO_PROPIO : FACTOR_DESTINO_AJENO;

  let ev = 0;
  need.forEach(nombre => {
    if (cumplidos.includes(nombre)) return;
    const prob = distribucion[nombre] || 0;
    if (prob > 0) ev += prob * valorGemaNivel * factorDestino;
  });

  if (completaInvocacionSiSeJuega) ev += valorGemaNivel * BONUS_COMPLETAR_INVOCACION;

  if (necesariosUnicosDeRivales) {
    Object.entries(necesariosUnicosDeRivales).forEach(([nombre, destKeyRival]) => {
      if (destKey !== undefined && destKey === destKeyRival) return; // eso es "tapar" (mecanismo b), no "duplicar" — no sumar dos veces
      const prob = distribucion[nombre] || 0;
      if (prob > 0) ev += prob * valorGemaNivel * PESO_ADVERSARIAL;
    });
  }
  if (cubreNecesarioUnicoRival) ev += valorGemaNivel * PESO_ADVERSARIAL;

  return ev;
}

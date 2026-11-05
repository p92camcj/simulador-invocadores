# Separación del motor de juego y la interfaz

> **Última actualización:** 2026-11-05 18:40 (Europe/Madrid)

Plan acordado con Julio el 2026-11-05. Objetivo: que las reglas de
Invocadores vivan en un núcleo puro (sin DOM, sin `window`, testable en
Node) y que cualquier interfaz sea una "piel" encima: la web actual, el
modo espectáculo, una futura interfaz de terminal, una 3D o un cliente de
multijugador en red.

## Por qué

- Las reglas están repartidas entre `abilities.js`, `actions.js` y
  `utils.js`, mezcladas con la pantalla: las habilidades abren `picker()`
  y lanzan `alert()` a mitad de la lógica, y el fin de turno vive dentro del
  `onclick` de `#btnEndTurn`.
- El estado vivía suelto en `window.*`.
- El autómata juega simulando clics (`#btnEndTurn`, `#pickerOk`): no puede
  funcionar sin navegador.
- Terminal, 3D y multijugador necesitan lo mismo: un motor que reciba
  acciones y devuelva estado + eventos, sin saber quién está al otro lado.

## Fases

Cada fase deja el juego funcionando igual que antes y con tests.

### Fase 1: estado serializable (hecha, 1.26.2)

- `js/motor/estado.js`: `estado.partida` (todo lo de la partida, JSON
  puro) y `estado.ui` (selección, picker abierto, callbacks: nunca se
  serializa).
- `serializarPartida()` / `cargarPartida()`.
- `window.players`, `window.turn`, etc. siguen funcionando como alias
  getter/setter (`instalarAliasGlobales`), así que ningún otro módulo tuvo
  que cambiar de golpe.
- Tests: `node tests/motor-estado.mjs`.

Limitación conocida: `initActions(players, neutrals)` guarda las
referencias a los arrays al empezar la partida. `cargarPartida()` a mitad
de una partida en curso dejaría esos cierres apuntando a los arrays viejos.
Se resuelve en la fase 2, cuando las acciones lean siempre del estado.

### Fase 2: acciones y eventos

- Un módulo `js/motor/` con funciones `aplicarAccion(partida, accion)` para
  `jugarCarta`, `activarHabilidad`, `terminarTurno`. Validan, mutan el
  estado y devuelven una lista de eventos (`cartaJugada`,
  `habilidadAplicada`, `invocacionCompletada`, `gemasRepartidas`,
  `partidaTerminada`, `accionInvalida` con su motivo).
- Se mueve aquí la lógica que hoy vive en los `onclick` de `actions.js`
  (validar Fase A, comprobar invocación, repartir Gemas, robar, pasar
  turno).
- La UI y el modo espectáculo se suscriben a los eventos en vez de que el
  motor los llame (`anunciarCartaJugada`, `anunciarInvocacion`...).
- Los `alert()` de error pasan a ser eventos `accionInvalida`; la web los
  sigue mostrando como hoy.

### Fase 3: decisiones como peticiones

- Cuando una habilidad necesita una elección (Portal, jugadora, carta,
  transformación), el motor no abre ventanas: emite una petición
  `{ tipo, pregunta, opciones }` y espera la respuesta (promesa o paso de
  máquina de estados).
- Quien conteste da igual: el `picker()` del navegador, el teclado en una
  terminal o el autómata.
- Afecta a todos los `case` de `abilities.js` y a la elección inmediata de
  Clarividente.

### Fase 4: adaptadores

- La web actual se convierte en un adaptador más (`render.js`,
  `actions.js` solo traducen clics a acciones y peticiones a `picker()`).
- El autómata llama al motor directamente, sin pulsar botones. Coordinar
  con el trabajo en `js/bot.js` / `js/bot-estrategia.js`.
- Se quitan los alias `window.*`.

### Fase 5 (opcional): interfaz de terminal

- Un `node tools/terminal.mjs` mínimo como prueba de que la separación es
  real: si se puede jugar una partida completa por texto, el motor está
  limpio.

## Reglas para el código nuevo

- Nada dentro de `js/motor/` toca el DOM, `window`, `alert`, `confirm`,
  `setTimeout` ni `localStorage`.
- Estado nuevo de partida: se añade a `CLAVES_PARTIDA` en
  `js/motor/estado.js`, nunca como un `window.*` suelto. Estado de
  interfaz: `CLAVES_UI`.
- El estado de partida debe poder pasar por `JSON.stringify` sin perder
  nada (sin funciones, sin referencias circulares, sin `Map`/`Set`).

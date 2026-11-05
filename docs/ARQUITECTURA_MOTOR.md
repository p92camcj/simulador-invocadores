# Separación del motor de juego y la interfaz

> **Última actualización:** 2026-11-05 19:36 (Europe/Madrid)

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
Las reglas del turno ya leen siempre de `estado.partida` (fase 2), pero
`render()` y las habilidades siguen recibiendo esos arrays: se resuelve del
todo en la fase 4, al convertir `actions.js` en adaptador.

### Fase 2: acciones y eventos (hecha, 1.26.4)

- `js/motor/acciones.js`: funciones puras sobre `partida` que validan,
  cambian el estado y devuelven una lista de eventos. No tocan el DOM ni
  `window` (los tests lo comprueban: corren sin `window`).
  - `jugarCarta(partida, { cartaIdx, destino })`: Fase A, incluido el
    efecto pasivo de Centinela.
  - `terminarTurno(partida)`: repone manos y resuelve la invocación
    (`resolverInvocacion`: combinación, Gemas, bonus de Pícaro y Maestro,
    Portal central nuevo, subida de nivel, fin de partida tras la última).
  - `pasarTurno(partida)`: siguiente jugadora y limpieza de campos de
    turno; fin de partida si no tiene cartas (`comprobarFinPorManoVacia`).
    Va separado de `terminarTurno` para que la interfaz pueda esperar a
    que acaben las escenas antes de enseñar la mano de la siguiente.
  - `validarFaseB`, `opcionesFaseB`, `completarActivacion`: límites de la
    Fase B (haber jugado, una habilidad por turno) y cobro del acceso a un
    Portal central. Lo que hace cada habilidad sigue en `abilities.js`
    hasta la fase 3.
- Eventos: `accionInvalida { motivo }`, `cartaJugada`, `manosRepuestas`,
  `invocacionCompletada { nivel, nombre, need, recompensas }`,
  `partidaTerminada { motivo }`, `habilidadAplicada`.
- `js/actions.js` ya no contiene reglas: llama al motor y traduce los
  eventos a `alert()`, `render()` y escenas del modo espectáculo.
  `js/game.js` pregunta al motor si la partida acaba por mano vacía.
- `draw()` y `reponerManoSiFalta()` (`utils.js`) aceptan el mazo como
  argumento (por defecto, `window.deck`), para que el motor robe del mazo
  de la partida que recibe.
- Se descartó un bus de eventos con suscripciones: devolver la lista de
  eventos es más simple y basta para una sola interfaz. Si el multijugador
  en red lo necesita, se añade encima sin cambiar el motor.
- Tests: `node tests/motor-acciones.mjs`.
- Pendiente para la fase 4: el autómata (`bot.js`) sigue pulsando
  `#btnEndTurn` y cobra él mismo el acceso central en su Fase B en vez de
  llamar a `completarActivacion`.

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

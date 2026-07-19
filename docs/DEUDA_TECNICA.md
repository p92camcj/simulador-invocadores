# Deuda técnica detectada

> Este documento recoge problemas de **calidad de código**: bugs latentes,
> duplicación, falta de red de seguridad (tests), manejo de errores y
> patrones frágiles. **No es** el lugar para el desfase entre el código y
> las reglas del juego — eso vive en la sección "⚠️ Read this before
> touching game logic" de [`CLAUDE.md`](../CLAUDE.md) y en
> [`docs/reglamento/REGLAMENTO.md`](reglamento/REGLAMENTO.md). Para alcance
> nuevo (funcionalidad que no existe todavía), ver
> [`MEJORAS_FUTURAS.md`](MEJORAS_FUTURAS.md).
>
> Regla de prioridad entre este documento y `MEJORAS_FUTURAS.md`: ver
> "Regla de prioridad: deuda técnica antes que alcance nuevo" en
> `CLAUDE.md`.
>
> Auditoría realizada el 2026-07-19 leyendo `js/*.js` completo con ojo
> crítico de calidad de código (no solo lo ya anotado en `CLAUDE.md`).

---

## Prioridad Alta

### 1. `window.picker` no existe — el Metamorfo rompe el fin de turno

- **Dónde**: `js/utils.js`, función `gestionarMetamorfos()`, línea con
  `window.picker('¿En qué personaje quieres transformarlo?', opciones, v => resolve(v));`.
- **Descripción**: `picker()` se define y se exporta como binding normal de
  módulo ES en `js/render.js` (`export function picker(...)`), y solo se
  importa por nombre en `js/abilities.js`
  (`import { picker, render } from './render.js';`). **Nunca se asigna a
  `window.picker` en ningún archivo del proyecto** (se comprobó con grep en
  todo `js/*.js` e `index.html`). `js/utils.js` no importa `picker` de
  `render.js` en absoluto.
- **Impacto real**: cuando una jugadora tiene un Metamorfo visible en el
  top de un portal y gemas > 0, y pulsa "Terminar turno", `gestionarMetamorfos()`
  le pregunta con `confirm()` si quiere activarlo. Si responde que sí, la
  siguiente línea ejecuta `window.picker(...)`, que es `undefined` →
  `TypeError: window.picker is not a function`. Esto ocurre **dentro** del
  handler `async` del botón "Terminar turno", antes de que se compruebe la
  invocación o se avance el turno, dejando la partida en un estado
  inconsistente (turno no avanzado, excepción no capturada). Es el mismo
  tipo de bug que los tres `ReferenceError` ya corregidos (ver
  `CHANGELOG.md` `1.3.1.22`), pero no se detectó en aquella auditoría.
- **Corrección propuesta**: en `js/utils.js`, importar `picker` de
  `./render.js` (`import { picker } from './render.js';`) y usar `picker(...)`
  en vez de `window.picker(...)`. Cuidado con la dependencia circular
  potencial: `render.js` no importa nada de `utils.js` actualmente para
  `picker`, así que el import directo debería ser seguro, pero conviene
  revisarlo al tocarlo.
- **Prioridad**: **Alta** — rompe una habilidad de personaje jugable, con
  una excepción no capturada en pleno flujo de turno.

### 2. `js/version-check.js` compara versiones por desigualdad, no por orden

- **Dónde**: `js/version-check.js`, función `base()` y la condición
  `if (release.tag_name && base(release.tag_name) !== base(currentVersion))`.
- **Descripción**: la comparación normaliza ambas versiones a `X.Y.Z` y
  solo comprueba que **sean distintas**, no cuál es mayor. Detectado
  durante la tarea del README y confirmado en la práctica: ahora mismo
  `version.json` está en `1.3.2.x` y la última Release de GitHub sigue
  siendo `v1.2.0` (no se ha cortado una release desde entonces), así que el
  banner "¡Nueva versión disponible!" aparece señalando una versión que en
  realidad es **más antigua** que la que se está ejecutando.
- **Impacto real**: confunde al usuario (incluido el propio propietario) —
  el aviso no significa "hay algo nuevo", solo significa "el número no
  coincide exactamente con el de la última release", en cualquier
  dirección. No rompe nada, pero la señal no es fiable.
- **Corrección propuesta**: comparar como semver real en vez de
  desigualdad de string — parsear `[X, Y, Z]` de ambos lados a números y
  solo mostrar el banner si la release de GitHub es estrictamente mayor
  que `version.json` (`release > actual`, no `release !== actual`).
- **Prioridad**: **Alta** — cosmético pero engañoso de forma sistemática
  mientras no se corte una nueva release; documentado también en el README
  para que se entienda el porqué mientras no se arregla.

---

## Prioridad Media

### 3. `js/render.js` usa la variable global `turn` sin el prefijo `window.`

- **Dónde**: `js/render.js`, función `render()`, líneas con
  `['player-red', ...][turn % 4]` y `if (i === turn) return;`.
- **Descripción**: en la misma función, la línea anterior sí usa
  `players[window.turn]` correctamente, pero estas dos usan la variable
  bare `turn`. Funciona *hoy* porque `window.turn` ya está inicializado
  como global por `index.js` antes de que `render()` se ejecute nunca, y en
  el navegador las propiedades de `window` son legibles como identificador
  global aunque el módulo esté en modo estricto — pero es exactamente el
  mismo patrón de fragilidad que causó el `ReferenceError` de `levelIdx` ya
  corregido (ver `CLAUDE.md`, sección Architecture). Si `render()` se
  llamara alguna vez antes de que `window.turn` exista (tests, SSR,
  refactor futuro que retrase la inicialización), lanzaría
  `ReferenceError: turn is not defined`.
- **Impacto real**: ninguno observado hoy, pero es deuda latente e
  inconsistente dentro de la misma función.
- **Corrección propuesta**: cambiar ambas ocurrencias a `window.turn`,
  igual que la línea de al lado.
- **Prioridad**: **Media** — no rompe nada ahora mismo, pero es el mismo
  patrón que ya causó un bug real; barato de arreglar.

### 4. Iteración "todos los portales de todas las jugadoras + neutrales" duplicada en al menos 6 sitios

- **Dónde**: `js/utils.js` (`gestionarMetamorfos`), `js/actions.js` (el
  bloque de comprobación de invocación en el handler de "Terminar turno",
  dos veces: una para construir `map` y otra para `allPortals`),
  `js/render.js` (tres veces: zona activa, zona de otras jugadoras y zona
  neutral), y `js/abilities.js` (caso `Centinela`, caso `Metamorfo`).
- **Descripción**: el proyecto ya tiene `listPortals()`, `stackFrom()` y
  `portalesConEstado()` en `js/utils.js` pensados exactamente para
  centralizar "recorre todos los portales de jugadoras + neutrales", pero
  se usan solo en los `picker()` de habilidades. El resto del código
  repite manualmente `players.forEach(p => p.portals.forEach(...))` seguido
  de `neutrals.forEach(...)`, con pequeñas variaciones cada vez.
- **Impacto real**: cualquier cambio en cómo se representan los portales
  (p. ej. al implementar el reparto correcto por nº de jugadoras, o el modo
  Avanzado con autómata central) obliga a tocar la misma lógica de
  recorrido en 6+ sitios en vez de uno, con riesgo real de que alguno se
  quede desactualizado.
- **Corrección propuesta**: añadir un helper único en `utils.js` (p. ej.
  `todosLosPortales(players, neutrals)` devolviendo `{stack, playerIdx, portalIdx}[]`)
  y usarlo en los 6 sitios en vez de repetir el doble `forEach`.
- **Prioridad**: **Media** — no es un bug hoy, pero es el sitio más
  probable de introducir uno al tocar reglas relacionadas con portales
  (que es justo el trabajo pendiente más grande, ver `MEJORAS_FUTURAS.md`).

### 5. Nombres de jugadora sin escapar insertados vía `innerHTML`

- **Dónde**: `js/render.js` (`zoneActive.innerHTML += \`<h3>${pl.name}...\``,
  y el equivalente para `zoneOthers`), y `js/setup.js`
  (`form.innerHTML += \`<input ... value="${nombre}" ...>\`` al
  regenerar el formulario de nombres).
- **Descripción**: el nombre de cada jugadora se toma de un `<input>` sin
  ningún tipo de escapado y se reinserta directamente vía `innerHTML` en
  varios sitios. Un nombre como `"><img src=x onerror=alert(1)>` rompería
  el atributo `value` en `setup.js` al regenerar el formulario, o
  ejecutaría HTML/JS arbitrario al renderizarse en `render.js`.
- **Impacto real**: bajo en la práctica actual — es una app local, de una
  sola pestaña, sin usuarios remotos ni backend, así que el único que
  podría "atacarse" es la propia partida en la misma pantalla. Pero es un
  patrón de inyección HTML/JS real y barato de evitar, y se vuelve más
  relevante si algún día existe el multijugador por red mencionado en
  "Future direction" de `CLAUDE.md` (ver también `MEJORAS_FUTURAS.md`),
  donde el nombre sí vendría de otro dispositivo.
- **Corrección propuesta**: usar `textContent` / `createElement` en vez de
  concatenar `innerHTML` para cualquier valor que incluya `pl.name`, o como
  mínimo pasar los nombres por una función de escape de HTML antes de
  interpolarlos.
- **Prioridad**: **Media** — impacto bajo hoy, pero crece si se construye
  la dirección de multijugador; arreglo barato.

### 6. Sin tests automatizados ni ninguna verificación no manual

- **Dónde**: todo el repo — no hay `package.json`, ni framework de test, ni
  linter, ni CI. `CLAUDE.md` ya documenta esto en "Commands" como hecho
  consumado ("Verificación es manual").
- **Descripción**: toda la lógica de reglas (combos de invocación,
  habilidades, visibilidad de cartas, condición de fin de partida) depende
  de jugar manualmente una partida completa para detectar regresiones. Los
  tres `ReferenceError` corregidos en `1.3.1.22`, y el `window.picker`
  roto de este mismo documento (ítem 1), son exactamente el tipo de bug
  que un test unitario simple sobre `applyAbility()` o `gestionarMetamorfos()`
  habría detectado sin necesidad de jugar una partida entera.
- **Impacto real**: alto coste acumulado de "no se sabe si algo se rompió
  hasta que se juega", especialmente según crece el alcance (modos nuevos,
  personajes nuevos — ver `MEJORAS_FUTURAS.md`).
- **Corrección propuesta**: no hace falta un framework pesado dado que no
  hay build step — algo tan simple como un script Node con `assert` que
  importe los módulos ES directamente y simule unas pocas jugadas de cada
  habilidad ya cubriría los bugs de tipo `ReferenceError`/`TypeError` que
  se han dado hasta ahora. Introducir tests de verdad (Vitest u otro sin
  build) es una decisión de mayor calado que merece discutirse aparte, no
  asumirse aquí.
- **Prioridad**: **Media** — no es un bug puntual, es la causa raíz de que
  los bugs de los ítems 1 y 3 pasaran desapercibidos.

---

## Prioridad Baja

### 7. `switch` de `applyAbility()` sin bloques `{}` por `case`

- **Dónde**: `js/abilities.js`, función `applyAbility()`.
- **Descripción**: los `case` del `switch` declaran `const`/`let` (p. ej.
  `const opciones`, `const opcionesCronista`, `const need`) sin envolver
  cada `case` en `{ }`, así que todas comparten el mismo bloque léxico del
  `switch`. Hoy no hay colisión de nombres entre los distintos `case`, pero
  es un patrón frágil: añadir un `case` nuevo que reutilice un nombre ya
  usado en otro (p. ej. otro `const need`) sería un `SyntaxError` de
  redeclaración, y el error señalado por el motor no siempre es obvio a
  primera vista.
- **Impacto real**: ninguno hoy; friccción futura al añadir personajes
  nuevos (Entusiasta, Animales — ver `MEJORAS_FUTURAS.md`).
- **Corrección propuesta**: envolver cada `case` en `{ }`.
- **Prioridad**: **Baja**.

### 8. Nombres de personaje como strings mágicos repetidos sin roster centralizado

- **Dónde**: `js/utils.js` (claves de `iconos`, `COMBOS`), `js/game.js`
  (array `chars` en `initGame()`), `js/abilities.js` (cada `case` del
  `switch`), `js/actions.js` (array `personajesConHabilidad`).
- **Descripción**: la lista de "qué personajes tienen habilidad activable"
  vive por duplicado — una vez como los `case` reales de `abilities.js`, y
  otra vez como el array literal `personajesConHabilidad` en `actions.js`
  (`['Ocultista', 'Cronista', 'Cronomante', 'Estratega', 'Aprendiz', 'Metamorfo']`).
  No hay ninguna relación estructural entre ambos: añadir un `case` nuevo
  en `abilities.js` sin acordarse de añadir el nombre también en
  `actions.js` significa que la habilidad nunca se ofrece a activar (el
  `confirm()` de activación nunca se dispara), en silencio.
  `iconos` en `utils.js` sí sirve como roster de nombres válidos, pero no
  se usa para validar ni derivar la otra lista.
- **Impacto real**: bajo hoy (las dos listas están sincronizadas
  actualmente), pero es una trampa exacta para cuando se añadan Entusiasta
  y Animales (ver `MEJORAS_FUTURAS.md`).
- **Corrección propuesta**: derivar `personajesConHabilidad` de los
  `case` reales de `abilities.js` (p. ej. exportando un `Set` o array desde
  ese módulo) en vez de mantener una copia manual en `actions.js`.
- **Prioridad**: **Baja**.

### 9. `hasClari()` en `utils.js` es código muerto

- **Dónde**: `js/utils.js`, función `hasClari(player)`.
- **Descripción**: está `export`ada pero no se importa ni se usa en ningún
  otro archivo del proyecto (confirmado con grep). La lógica equivalente
  vive duplicada inline dentro de `actualizarClarividente()` en el mismo
  archivo.
- **Impacto real**: ninguno, solo ruido.
- **Corrección propuesta**: eliminarla, o si se mantiene por claridad de
  API, usarla desde `actualizarClarividente()` en vez de duplicar la
  condición.
- **Prioridad**: **Baja**.

### 10. `alert()` / `confirm()` bloqueantes para todo el flujo de juego

- **Dónde**: repartido por `js/actions.js`, `js/game.js`, `js/utils.js`
  (`gestionarMetamorfos`) y `js/abilities.js` — 11 llamadas a `alert()`/
  `confirm()` en total (cambio de turno, activar habilidad, activar
  Metamorfo, invocación completa, fin de partida, validaciones de
  formulario).
- **Descripción**: cada aviso de turno, cada confirmación de habilidad y
  el mensaje de fin de partida usan diálogos nativos del navegador, que
  bloquean el hilo de JS y no dejan rastro visual de lo ocurrido una vez
  cerrados.
- **Impacto real**: funcional (no rompe nada), pero intrusivo para jugar
  y sin historial de lo que ha pasado en la partida — un problema de
  calidad/mantenibilidad de código más que de reglas. La alternativa (UI
  propia con historial de eventos) es alcance nuevo de UX, no una
  corrección, así que la propuesta concreta de reemplazo vive en
  `MEJORAS_FUTURAS.md` — se anota aquí solo como debe técnica de "esto ya
  no debería depender de diálogos nativos para su flujo principal".
- **Prioridad**: **Baja** (como deuda de código; ver `MEJORAS_FUTURAS.md`
  para la mejora de UX en sí).

### 11. `fetch` de la Release de GitHub sin `.catch()`

- **Dónde**: `js/version-check.js`, la segunda cadena `fetch(...)` (la de
  `releases/latest`).
- **Descripción**: la primera petición (`fetch('./version.json')`) sí tiene
  `.catch(err => console.error(...))`, pero la petición a la API de
  GitHub no tiene ningún manejo de error. Si la API falla, da rate limit,
  o el dispositivo está offline, queda como rechazo de promesa no
  gestionado (visible solo en consola del navegador, nunca para la
  usuaria).
- **Impacto real**: bajo — en el peor caso simplemente no aparece el
  banner de actualización, que ya de por sí es poco fiable (ítem 2).
- **Corrección propuesta**: añadir `.catch()` simétrico al de la primera
  petición.
- **Prioridad**: **Baja**.

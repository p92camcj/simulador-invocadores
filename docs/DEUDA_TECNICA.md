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

## Resueltos

### ~~1. `window.picker` no existe — el Metamorfo rompe el fin de turno~~ (resuelto)

- **Qué era**: `gestionarMetamorfos()` en `js/utils.js` llamaba a
  `window.picker(...)`, que nunca se asignaba en ningún archivo del
  proyecto (`picker()` solo existía como export de módulo ES en
  `js/render.js`), causando un `TypeError` no capturado dentro del handler
  de "Terminar turno" en cuanto una jugadora aceptaba transformar su
  Metamorfo.
- **Cómo se resolvió**: al implementar la Fase B independiente de la
  secuencia de turno (activar habilidad como acción propia, una vez por
  turno, solo para la jugadora activa — ver `CLAUDE.md`), se eliminó por
  completo `gestionarMetamorfos()` y el mecanismo ad-hoc de fin de turno que
  dejaba a *cualquier* jugadora con un Metamorfo visible transformarlo. El
  Metamorfo ahora se activa exactamente igual que Ocultista/Cronista/etc.,
  a través de `applyAbility()` desde `js/actions.js`, usando el `picker()`
  importado correctamente de `render.js`. El bug desaparece porque la
  función rota ya no existe.

### ~~3. `js/render.js` usaba la variable global `turn` sin el prefijo `window.`~~ (resuelto)

- **Qué era**: en `render()`, dos líneas usaban la variable bare `turn` en
  vez de `window.turn`, funcionando solo porque `window.turn` ya estaba
  inicializado como global antes de la primera llamada a `render()`.
- **Cómo se resolvió**: corregido de paso al reescribir `render()` para el
  reparto real de Gemas (ambas ocurrencias usan ahora `window.turn`).

### ~~2. `js/version-check.js` comparaba versiones por desigualdad, no por orden~~ (resuelto)

- **Qué era**: la condición `base(release.tag_name) !== base(currentVersion)`
  normalizaba ambas versiones a `X.Y.Z` y solo comprobaba que **fueran
  distintas**, no cuál era mayor. En la práctica, si `version.json` ya iba
  por delante de la última Release publicada en GitHub (justo lo que
  pasaba), el banner "¡Nueva versión disponible!" aparecía señalando una
  versión que en realidad era **más antigua**.
- **Cómo se resolvió**: la comparación ahora parsea ambos lados a `[X, Y, Z]`
  numérico (`parseVersion()`) y solo muestra el banner si la Release es
  **estrictamente mayor** que `version.json` (`esVersionMayor()`), campo a
  campo (X, luego Y, luego Z). Si `tag_name` no es parseable como `X.Y.Z`,
  no se muestra el banner y se deja un `console.warn` en vez de arriesgar
  un falso positivo.

---

## Prioridad Media

### 4. Iteración "todos los portales de todas las jugadoras + neutrales" duplicada en al menos 5 sitios

- **Dónde**: `js/actions.js` (el bloque de comprobación de invocación en el
  handler de "Terminar turno", dos veces: una para construir `map` y otra
  para `allPortals`), `js/render.js` (tres veces: zona activa, zona de
  otras jugadoras y zona neutral), y `js/abilities.js` (caso `Centinela`,
  caso `Metamorfo`).
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
  tres `ReferenceError` corregidos en `1.3.1.22`, y el `window.picker` roto
  que existió hasta que se eliminó `gestionarMetamorfos()` (ver
  "Resueltos" al principio de este documento), son exactamente el tipo de
  bug que un test unitario simple sobre `applyAbility()` habría detectado
  sin necesidad de jugar una partida entera.
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
  esos bugs pasaran desapercibidos.

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

### 8. Nombres de personaje como strings mágicos repetidos sin roster centralizado (parcialmente mitigado)

- **Dónde**: `js/utils.js` (claves de `iconos`, `INVOCATION_SETS`),
  `js/game.js` (cantidades por personaje en `cantidadesModoNormal` dentro
  de `initGame()`), `js/abilities.js` (cada `case` del `switch`).
- **Descripción**: la lista de "qué personajes tienen habilidad activable"
  vivía por duplicado — los `case` reales de `abilities.js` y, aparte, un
  array literal repetido en `actions.js`. Esa duplicación concreta ya se
  resolvió: ahora existe `PERSONAJES_CON_HABILIDAD` en `js/utils.js` como
  única fuente, usada tanto por `opcionesActivarHabilidad()` (Fase B) como
  por cualquier otro sitio que necesite la lista. Lo que **sigue** sin
  resolver es que ese array sigue siendo mantenido a mano — no se deriva
  automáticamente de los `case` reales de `abilities.js` — así que añadir
  un `case` nuevo sin añadir el nombre a `PERSONAJES_CON_HABILIDAD` seguiría
  siendo un fallo silencioso (la habilidad nunca aparecería como activable
  en el picker de Fase B). Por otro lado, el roster de "los 10 personajes
  no-animales" también estaba duplicado (el array de nombres de
  `charsBase` en `game.js`, y de forma implícita en el `case 'Metamorfo'`
  de `abilities.js` antes de la revisión de 2026-07-19 de esa habilidad) —
  esa duplicación **sí** se resolvió: ambos sitios ahora importan la misma
  constante `PERSONAJES_NO_ANIMALES` de `js/utils.js`; `game.js` solo
  mantiene aparte el mapa de cantidades por personaje
  (`cantidadesModoNormal`), que no tiene un origen único razonable del que
  derivarse.
- **Impacto real**: bajo hoy (listas manuales en vez de duplicadas, pero
  siguen siendo manuales), y sigue siendo relevante para cuando el Maestro
  tenga su habilidad activa (ver `MEJORAS_FUTURAS.md`).
- **Corrección propuesta**: derivar `PERSONAJES_CON_HABILIDAD` de los
  `case` reales de `abilities.js` (p. ej. exportando un `Set` o array desde
  ese módulo) en vez de mantener una copia manual en `utils.js`.
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
  (pago de Gemas en `pagarActivacionPortalCentral`) y `js/abilities.js` —
  varias llamadas a `alert()`/`confirm()` en total (cambio de turno,
  activar habilidad, pagar coste de Portal central, invocación completa,
  fin de partida, validaciones de formulario).
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
  banner de actualización (su fiabilidad como comparación de versiones ya
  se corrigió, ver "Resueltos" al principio de este documento).
- **Corrección propuesta**: añadir `.catch()` simétrico al de la primera
  petición.
- **Prioridad**: **Baja**.

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
> Auditoría inicial realizada el 2026-07-19 leyendo `js/*.js` completo con
> ojo crítico de calidad de código (no solo lo ya anotado en `CLAUDE.md`).
> Ítems 12 y 13 añadidos el 2026-07-20 desde
> [`docs/AUDITORIA_REGLAS.md`](AUDITORIA_REGLAS.md), que cruza el
> reglamento contra el código con foco en interacciones entre
> habilidades — el detalle largo de ambos vive ahí, no aquí. Ítem 14
> añadido el 2026-07-20 tras confirmar el dueño del proyecto que la
> apariencia del Metamorfo no debe conceder ningún efecto del personaje
> imitado (ver la nueva nota de interpretación en
> [`docs/reglamento/REGLAMENTO.md`](reglamento/REGLAMENTO.md), sección
> "Metamorfo").

---

## Resueltos

### ~~7. `switch` de `applyAbility()` sin bloques `{}` por `case`~~ (resuelto de rebote)

- **Qué era**: los `case` del `switch` de `applyAbility()` (`js/abilities.js`)
  declaraban `const`/`let` sin envolver cada `case` en `{ }`, compartiendo
  todos el mismo bloque léxico del `switch` — patrón frágil ante colisión
  de nombres entre `case`s futuros.
- **Verificado 2026-07-21 (sesión de deuda técnica)**: al releer
  `js/abilities.js` completo para esta sesión, los 6 `case` con
  declaraciones (`Ocultista`, `Cronista`, `Cronomante`, `Estratega`,
  `Aprendiz`, `Metamorfo`) ya envuelven su cuerpo en `{ }` — confirmado con
  grep, sin ninguna excepción. No hay commit específico que documente este
  cambio como corrección de este ítem; se resolvió como efecto colateral
  de alguna de las ediciones de `abilities.js` de rondas anteriores (los
  `case` reescritos para los ítems 12/14 ya se escribieron con bloque desde
  el principio). No fue necesario ningún cambio de código en esta sesión,
  solo actualizar este documento.
- **Prioridad**: era **Baja**.

### ~~5. Nombres de jugadora sin escapar insertados vía `innerHTML`~~ (resuelto)

- **Qué era**: el nombre de cada jugadora se toma de un `<input>` sin
  ningún tipo de escapado. `js/setup.js` (`form.innerHTML += ...` al
  regenerar el formulario de nombres) ya se había resuelto en una ronda
  anterior (2026-07-21, al añadir la UI de autómatas: se sustituyó por
  `createElement` + asignación de propiedades). Seguía abierto en
  `js/render.js`: `renderBoardGrid()` construía el HTML del tablero como
  una única plantilla de string con `${p.name}` interpolado directamente
  (`html += \`<h4>${p.name}...\``) antes de asignarla de una vez vía
  `grid.innerHTML = html` — un nombre con marcado HTML embebido se
  ejecutaría/renderizaría como HTML real en vez de mostrarse como texto.
- **Cómo se resolvió**: se añadió `escapeHtml()` a `js/utils.js`
  (reutilizable por cualquier módulo ES del proyecto) y se aplicó a
  `p.name` en el único punto de `render.js` que lo necesitaba. Se revisó
  el resto de interpolaciones de nombre del archivo (`h.name`/`c.aspecto`
  de cartas, títulos de `picker()`) — todas usan `textContent` o son
  nombres de personaje fijos del propio juego, no texto introducido por
  una jugadora, así que no necesitaban cambio.
- **Verificado manualmente**: un nombre con `<b>bold</b>` embebido se
  muestra como texto literal (sin crear ningún elemento `<b>` real);
  nombres normales (incluida la marca 🤖 de autómata y el desglose de
  Gemas) se siguen mostrando igual que antes.
- **Prioridad**: era **Media**.

### ~~9. `hasClari()` en `utils.js` es código muerto~~ (resuelto)

- **Qué era**: `export`ada en `js/utils.js` pero no importada ni usada en
  ningún otro archivo (confirmado con grep). La lógica equivalente vivía
  duplicada inline dentro de `actualizarClarividente()` en el mismo
  archivo.
- **Detalle no anotado en la descripción original**: no era ni siquiera un
  duplicado exacto — `hasClari` comprobaba `stack.at(-1).vis` (cualquier
  objeto `vis` truthy), mientras que `actualizarClarividente()` comprueba
  específicamente `stack.at(-1).vis?.public === true` (la condición
  correcta según la nota de interpretación de Clarividente del
  reglamento). Reutilizarla tal cual en vez de eliminarla habría
  introducido un comportamiento sutilmente distinto.
- **Cómo se resolvió**: se eliminó la función (no se fusionó), y la fila
  correspondiente en `Documentacion_Simulador_Invocadores.md`.
- **Verificado manualmente**: sin referencias restantes (`grep`), la app
  carga con normalidad.
- **Prioridad**: era **Baja**.

### ~~11. `fetch` de la Release de GitHub sin `.catch()`~~ (resuelto)

- **Qué era**: `js/version-check.js`, la segunda cadena `fetch(...)` (la de
  `releases/latest`, anidada dentro del `.then()` de `fetch('./version.json')`)
  no tenía ningún `.catch()` propio. Si la API fallaba, daba rate limit, o
  el dispositivo estaba offline, quedaba como rechazo de promesa no
  gestionado, visible solo en consola del navegador.
- **Cómo se resolvió**: se añadió `.catch(err => console.error(...))`
  simétrico al de la primera petición, al final de la cadena de la
  segunda `fetch`.
- **Verificado manualmente**: simulando un fallo de red en el navegador,
  el error se captura y registra en consola sin generar ningún
  `unhandledrejection`; el caso normal (banner de nueva versión, número de
  versión mostrado) sigue funcionando igual.
- **Prioridad**: era **Baja**.

### ~~13. `window.cronomanteOnComplete` no se resetea junto a `cronomantePortalInvestigado`~~ (resuelto)

- **Qué era**: `window.cronomantePortalInvestigado` sí se reseteaba a
  `null` en los 3 puntos de entrada relevantes (`initGame()`, `nextTurn()`,
  `resetJuego()` en `js/game.js`); el callback guardado en paralelo
  `window.cronomanteOnComplete` no, ni tampoco en la inicialización de
  estado global de `js/index.js`.
- **Impacto real**: ninguno confirmado — solo se lee dentro de
  `if (window.cronomantePortalInvestigado)`, que sí queda correctamente
  cerrado, así que la referencia obsoleta nunca se ejecutaba.
- **Cómo se resolvió**: se añadió `window.cronomanteOnComplete = null;`
  junto a los 4 resets existentes (los 3 de `game.js` más el de
  `index.js`).
- **Prioridad**: Baja (impacto real), documentado en la sección Media por
  agruparse con el resto de esa sección en la auditoría original.

### ~~15. Service Worker con caché first-y-para-siempre: código servido podía quedar desactualizado indefinidamente~~ (resuelto)

- **Qué era**: `service-worker.js` tenía `CACHE_NAME` fijo
  (`'invocadores-v1.5.0'`, sin relación con `version.json`) y una
  estrategia cache-first para **toda** petición, incluidos los módulos de
  lógica de juego (`js/game.js`, `js/actions.js`, `js/render.js`...). Un
  Service Worker solo repite su paso `install` (el único momento en que
  repuebla la caché) cuando el contenido en BYTES de `service-worker.js`
  cambia — tocar `version.json` o cualquier archivo de `js/` nunca lo
  dispara. Con `CACHE_NAME` fijo y sin ningún archivo del propio Service
  Worker cambiando en el trabajo normal del proyecto, cualquier jugadora
  que ya tuviera la PWA instalada podía quedarse ejecutando indefinidamente
  el `js/*.js` de la versión que tenía cacheada la primera vez, sin
  ninguna vía para refrescarse sola — indistinguible desde fuera de un
  "bug" que en el código real ya llevaba tiempo corregido. `js/bot.js`
  (añadido después de la última vez que se tocó la lista de cacheo)
  tampoco estaba incluido en `urlsToCache`.
- **Cómo se detectó**: investigando el reporte de "el contador de cartas
  del mazo no baja en partidas 2vs2 de autómatas" (ver
  `docs/AUDITORIA_REGLAS.md` y `CHANGELOG.md`, v1.13.4.59). Se verificó
  primero, construyendo el estado a mano y jugando partidas reales de 2
  autómatas contra el código servido en local sin ningún Service Worker de
  por medio, que `js/game.js` (`nextTurn()`) SÍ recalcula y pinta
  `window.deck.length` en cada turno, sea humano o bot — el código real no
  tenía el bug. La causa quedó en el propio Service Worker.
- **Cómo se resolvió**: dos cambios independientes en `service-worker.js`:
  1. **Estrategia network-first** para el "app shell" (documento
     HTML/JS/CSS/JSON — todo lo que cambia con cada versión): intenta red
     primero y actualiza la caché con la respuesta fresca; solo cae a la
     caché si no hay conexión. Esto es lo que arregla el problema de
     verdad — con red disponible, la app SIEMPRE ejecuta el código real
     del servidor, sin depender de que el propio Service Worker se
     reinstale. Los assets de cartas (`assets/cards/*.png`, que no cambian
     entre versiones) mantienen cache-first.
  2. `CACHE_NAME` derivado de `version.json` (ya obligatorio subir en cada
     cambio shippeado, ver `CLAUDE.md`) + purga de cachés de versiones
     anteriores en `activate` + `skipWaiting()`/`clients.claim()`: mantiene
     razonablemente al día la caché de reserva que solo se usa sin
     conexión, sin necesitar cerrar todas las pestañas para tomar el
     control. Se añadió también `js/bot.js` (y `js/pwa-install.js`, que
     tampoco estaba) a `urlsToCache`.
- **Verificado manualmente**: con el Service Worker activo y SIN volver a
  reinstalarlo (sin tocar `service-worker.js`), se bumpeó `version.json` en
  disco y se confirmó que una petición a través del Service Worker ya
  activo devolvía el contenido fresco (`fetch('./version.json')` y
  `fetch('./js/game.js')` reflejaban el cambio real en disco de
  inmediato) — la vía network-first no depende del ciclo de vida de
  instalación del propio Service Worker.
- **Prioridad**: era **Alta** (afecta a cualquier jugadora que reabra la
  PWA tras una actualización, no solo al caso de 2 autómatas donde se
  detectó).

### ~~14. Metamorfo transformado se trataba como el personaje real en protecciones/restricciones/bonus~~ (resuelto)

- **Qué era**: `case 'Metamorfo'` (`js/abilities.js`) sobrescribía
  directamente `stack.at(-1).name = v`, así que a partir de ese momento la
  carta transformada **era**, a todos los efectos del código, el personaje
  imitado — no había ningún campo separado que distinguiera "identidad real
  (Metamorfo)" de "apariencia (el personaje imitado)". Un Metamorfo
  transformado en Centinela pasaba la comprobación
  `jugadoraProtegidaPorCentinela()`/`esCentinelaVisible()` y protegía
  Portales (o bloqueaba a Ocultista) sin ser una Centinela real; un
  Metamorfo transformado en Pícaro/Maestro habría disparado sus bonus
  pasivos si esta ronda no lo hubiera corregido antes de que se pudiera
  observar.
- **Cómo se resolvió**: se separó identidad de apariencia en el modelo de
  datos de la carta. `case 'Metamorfo'` ahora escribe `stack.at(-1).aspecto
  = v` en vez de sobrescribir `.name` — `.name` sigue siendo `'Metamorfo'`
  siempre. Se auditó cada sitio de `js/abilities.js`/`js/utils.js` que
  compara `.name` contra un personaje concreto y se decidió caso a caso:
  - **Sigue mirando `.name`** (identidad real, sin cambios de código):
    protección de Centinela (`jugadoraProtegidaPorCentinela`,
    `estaProtegidoParaActivar`), restricción propia de Ocultista
    (`esCentinelaVisible`), auto-giro de Centinela
    (`ocultarOtrasCentinelas`), Clarividente (`hasClari`,
    `actualizarClarividente`), bonus pasivo de Pícaro
    (`js/actions.js`), qué habilidad ofrece `opcionesActivarHabilidad`
    (un Metamorfo transformado en Ocultista solo puede volver a
    transformarse, no usar la habilidad de Ocultista).
  - **Pasa a mirar `.aspecto || .name`** (apariencia, cambio de código):
    cumplimiento de la combinación de la invocación y reparto de sus
    Gemas (`js/actions.js`, función `add()`), el indicador de estado de
    la invocación en pantalla (`js/render.js`, `invStatus`), y lo que se
    muestra en cualquier carta (`mostrarCarta()` en `js/utils.js`,
    `cartaImgHtml()` en `js/render.js`).
  - **Reescrito con identidad real, ya no reutiliza el `map` de la
    invocación**: el bonus pasivo de 3 Gemas del Maestro (`js/actions.js`)
    — un Metamorfo transformado en Maestro cuenta para completar el combo
    de la invocación, pero no otorga este bonus, que es propio del
    Maestro real.
  - `.aspecto` se propaga explícitamente en los dos sitios donde una carta
    se reconstruye como objeto nuevo (`case 'Cronista'` en
    `js/abilities.js`, y `jugarCartaSeleccionadaEn()` en `js/actions.js`),
    para no perderlo silenciosamente si una carta transformada vuelve a
    una mano y se rejuega.
- **Verificado manualmente** (sesión de navegador, no solo lectura de
  código): transformar un Metamorfo en Centinela no lo protege ni bloquea a
  Ocultista; un Metamorfo transformado cuenta para completar una invocación
  y reparte su Gema con normalidad; un Metamorfo transformado en Maestro NO
  recibe el bonus pasivo de 3 Gemas (un Maestro real, en el mismo
  escenario, sí lo recibe); la etiqueta de "Activar habilidad" para un
  Metamorfo transformado sigue mostrando "Metamorfo", no el personaje
  imitado.
- **Prioridad**: era **Alta**.
- **Pendiente, fuera de esta corrección**: la representación visual con
  ficha superpuesta semitransparente (ver `docs/MEJORAS_FUTURAS.md`,
  "Metamorfo: representación visual de la transformación") — hoy la
  imagen de la carta muestra directamente `.aspecto` sin ninguna indicación
  de que es "en realidad" un Metamorfo.

### ~~12. Ocultista puede revelar una Centinela oculta sin re-disparar el auto-giro — dos Centinelas visibles a la vez~~ (resuelto)

- **Qué era**: en `case 'Ocultista'` (`js/abilities.js`), tras alternar
  `carta.vis.public`, no se comprobaba si la carta recién revelada era una
  Centinela real. Una Centinela ocultada por el auto-giro
  (`ocultarOtrasCentinelas()`, al aparecer una segunda Centinela) podía
  volver a hacerse visible vía Ocultista sin que nada re-disparase ese
  auto-giro, permitiendo dos Centinelas visibles a la vez en mesa. Repro
  completo en `docs/AUDITORIA_REGLAS.md` §3.1.
- **Cómo se resolvió**: `case 'Ocultista'` ahora comprueba, tras alternar la
  visibilidad, si `carta.name === 'Centinela' && carta.vis.public` (identidad
  real, no apariencia de Metamorfo) y, si es así, llama también a
  `ocultarOtrasCentinelas(st, players, neutrals)` — la misma función que ya
  usa Fase A al jugar una Centinela nueva.
- **Prioridad**: era **Alta**.

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

## Prioridad Alta

Sin ítems abiertos ahora mismo — los ítems 12 y 14 (Ocultista/Centinela,
identidad vs. apariencia del Metamorfo) se resolvieron el 2026-07-21, ver
"Resueltos" más arriba.

---

## Prioridad Media

### 4. Iteración "todos los portales de todas las jugadoras + neutrales" duplicada en varios sitios

- **Dónde**: `js/actions.js` (el bloque de comprobación de invocación en el
  handler de "Terminar turno", dos veces: una para construir `map` y otra
  para `allPortals`), y `js/abilities.js` (caso `Centinela` —
  `ocultarOtrasCentinelas()` — y caso `Metamorfo`).
- **Actualización 2026-07-20**: la duplicación en `js/render.js` (antes
  "zona activa, zona de otras jugadoras y zona neutral" por separado) se
  redujo de forma significativa al unificar el tablero en
  `renderBoardGrid()` (un único bucle sobre `players` + un bloque aparte
  para `neutrals`, en vez de 3 bloques independientes) — no queda como
  ítem pendiente para ese archivo.
- **Descripción**: el proyecto ya tiene `listPortals()`, `stackFrom()` y
  `portalesConEstado()` en `js/utils.js` pensados exactamente para
  centralizar "recorre todos los portales de jugadoras + neutrales", pero
  se usan solo en los `picker()` de habilidades. El resto del código
  repite manualmente `players.forEach(p => p.portals.forEach(...))` seguido
  de `neutrals.forEach(...)`, con pequeñas variaciones cada vez.
- **Impacto real**: cualquier cambio en cómo se representan los portales
  (p. ej. al implementar el modo Avanzado/Experto con autómata central,
  ver `docs/AUDITORIA_REGLAS.md`) obliga a tocar la misma lógica de
  recorrido en varios sitios en vez de uno, con riesgo real de que alguno
  se quede desactualizado.
- **Corrección propuesta**: añadir un helper único en `utils.js` (p. ej.
  `todosLosPortales(players, neutrals)` devolviendo `{stack, playerIdx, portalIdx}[]`)
  y usarlo en los 6 sitios en vez de repetir el doble `forEach`.
- **Prioridad**: **Media** — no es un bug hoy, pero es el sitio más
  probable de introducir uno al tocar reglas relacionadas con portales
  (que es justo el trabajo pendiente más grande, ver `MEJORAS_FUTURAS.md`).

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

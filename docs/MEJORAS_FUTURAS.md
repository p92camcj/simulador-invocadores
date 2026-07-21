# Mejoras futuras

> Backlog de **alcance nuevo** — funcionalidad que hoy no existe, no bugs
> ni deuda de calidad de código. Para eso, ver
> [`DEUDA_TECNICA.md`](DEUDA_TECNICA.md). Ningún bloque de este documento
> tiene fecha ni compromiso: es una lista de trabajo pendiente, no una
> promesa.
>
> Regla de prioridad entre este documento y `DEUDA_TECNICA.md`: ver
> "Regla de prioridad: deuda técnica antes que alcance nuevo" en
> [`CLAUDE.md`](../CLAUDE.md).

---

## Resuelto recientemente (2026-07-21, Bloque 3 — estrategia adversarial en Fase A)

Hasta ahora el autómata jugaba bien para sí mismo pero nunca tenía en
cuenta el efecto de sus jugadas sobre el resto (tapar personajes visibles
ajenos, o duplicar a propósito para anular una invocación ajena) — legítimo
dentro de las reglas, pura cuestión de estrategia. Ambos niveles de
dificultad lo consideran ahora en Fase A (jugar carta):

- **`'normal'`** (`decidirJugadaAdversarialNormal`, `js/bot.js`): ajuste
  ligero de bajo coste sobre la heurística greedy de siempre, solo con
  información visible AHORA MISMO (sin memoria ni probabilidad) y solo con
  la carta conocida (nunca arriesga la oculta propia en una jugada
  defensiva): (1) denegación GRATUITA por duplicado, si la carta conocida
  es requisito activo, ya está visible en un Portal ajeno, y el propio bot
  no la tenía ya (no pierde nada); (2) si no, tapar un Portal ajeno que
  muestre, como única copia visible en toda la mesa, un requisito de la
  invocación activa.
- **`'dificil'`** (`valorEsperadoDeAccion()`, `js/bot-probabilidad.js`):
  término adversarial explícito y generalizado (no solo un desempate entre
  opciones ya iguales) — `calcularNecesariosUnicosDeRivales()` identifica
  qué requisitos de la invocación activa hoy solo tiene visible una rival;
  `valorEsperadoDeAccion()` suma valor propio, ponderado por
  `PESO_ADVERSARIAL` (0.5, valor elegido y documentado, no derivado de
  ninguna regla), tanto por denegar por duplicado en cualquier otro sitio
  como por tapar directamente el Portal de esa rival.
- **Discrepancia con el prompt original de esta tarea, documentada en el
  propio código** (`bot-probabilidad.js`): el prompt asumía que ya existía
  un desempate basado en `contarGemasPorNivel` ("para no ayudar a quien va
  ganando") al que solo había que "generalizar" — pero esa pieza nunca se
  implementó en la ronda anterior (quedó anotada como deliberadamente
  omitida, ver más abajo, "Jugador autómata: niveles de dificultad"). El
  término adversarial de este bloque es nuevo por completo, no una
  extensión de algo previo.
- **Sigue sin implementarse** (mismo motivo que antes: señal débil frente a
  la complejidad añadida): el desempate opcional contra la estimación de
  Gemas de rivales para "no ayudar en exceso a quien va ganando" — es una
  idea DISTINTA de la denegación/tapado de este bloque (esa mira el
  personaje concreto en juego; aquella miraría el marcador agregado de cada
  rival), sigue siendo una oportunidad de refinamiento futura, no cubierta
  por esta tarea.

## Resuelto recientemente (2026-07-21, tras incorporar el jugador autómata)

- **Clarividente: corte inmediato con elección propia (bug (a) de "dos
  bugs reales confirmados", más abajo)**: `actualizarClarividente()`
  (`js/utils.js`) ya no gestiona ningún "periodo de gracia" —
  `haTenidoClarividente` se ha eliminado por completo. `render.js` añade
  `gestionarTransicionesClarividente()`, llamada al principio de cada
  `render()`: detecta, para CUALQUIER jugadora (no solo en su propio
  turno), la transición `hasClariActivo` de `true` a `false` y dispara de
  inmediato `resolverEleccionClarividente()` — picker con etiquetas
  neutras ("Mi carta de la izquierda"/"de la derecha", sin revelar el
  personaje) para una jugadora humana, heurística mínima (se queda con la
  carta requerida por la invocación activa si aplica, si no al azar) para
  una autómata. Si ya hay un picker en curso se pospone y se reintenta en
  el siguiente `render()`. El bug (b) de la misma entrada sigue sin
  reproducirse — no tocado en este cambio, ver más abajo.

- **Jugador autómata ("bot")**: se pueden combinar jugadoras humanas y
  autómatas (controladas por la app) dentro del límite de 2-5 jugadoras.
  Nuevo módulo `js/bot.js`: `construirEstadoVisibleParaBot()` construye una
  vista saneada del estado (sin la carta oculta propia del bot ni el mazo)
  de la que parten TODAS las decisiones, para que quede auditable que el
  bot nunca hace trampa; `decidirYJugarTurno()` ejecuta el turno completo
  (Fases A-E) reutilizando exactamente las mismas funciones/controles que
  usa una jugadora humana (`window.tryPlayOnPortal`, `applyAbility()`, el
  propio botón "Terminar turno") — no duplica ninguna lógica de reglas.
  `js/setup.js` añade un campo "Autómatas (bots)" en la configuración
  (0..jugadoras) con nombres temáticos únicos terminados en "bot"
  (`nombresDisponiblesParaBots()`); `js/game.js` (`nextTurn()`) detecta
  `player.tipo === 'auto'` y dispara el turno del bot tras un breve
  `setTimeout`; `js/render.js` oculta siempre la carta "visible" (propia)
  de una autómata, incluso durante su propio turno — nunca tiene "su
  propia pantalla" que la vea, a diferencia de una jugadora humana activa
  en este simulador de una sola pantalla compartida. Ver "niveles de
  dificultad del autómata" más abajo para lo que queda pendiente.

## Resuelto recientemente (2026-07-19)

Implementado en el mismo bloque de trabajo que separó la Fase B del turno
(activar habilidad ya no depende de jugar carta — ver `CLAUDE.md`,
"Architecture"):

- **Economía real de Gemas**: `player.gems` pasó de número plano a array de
  `{ valor, nivel, esAsterisco? }`; el reparto tras invocación roba de un
  pool real de 5 Gemas por invocación (`construirPoolGemas` en
  `js/utils.js`), y activar la habilidad de un Portal central cuesta 1 Gema
  unitaria (con cambio automático de una Gema de mayor valor si hace
  falta) o, gratis, revelando una Gema de asterisco ya ganada
  (`pagarActivacionPortalCentral`).
- **Sets de invocación con nombre**: `INVOCATION_SETS.introductorio/normal/floral`
  en `js/utils.js` sustituyen al `COMBOS` genérico; se elige uno en la
  pantalla de configuración (`#selInvocationSet` en `index.html`).
- **Cantidades del mazo**: `game.js` ahora usa las cantidades reales de
  "Modo normal" del reglamento (32 cartas: 2 Maestro, 2 Clarividente, 2
  Ocultista, 3 Cronomante, 3 Estratega, 4 Cronista, 4 Aprendiz, 4 Centinela,
  6 Pícaro, 2 Metamorfo), añadiendo los 9 Animales (3 Reena/Sora/Lumo) solo
  cuando el set elegido es `introductorio` — no siempre los 43 componentes
  físicos totales, ver la nota en `CLAUDE.md`. El set `floral` reutiliza el
  mismo mazo de 32 cartas que `normal` (no es una tercera variante de
  mazo); una versión anterior de este cambio agrupaba mal `floral` con
  `introductorio`, lo que hacía imposible completar sus invocaciones — bug
  corregido en la versión siguiente, ver `CHANGELOG.md`. Entusiasta sigue
  sin entrar nunca en el mazo (es la expansión aparte).
- **Maestro, bonus pasivo**: la comprobación ahora exige que Maestro sea
  requisito de la invocación **activa** (cualquier nivel, no solo `'A'`) y
  que no haya ningún Pícaro visible **en cualquier parte de la mesa** (no
  solo fuera del combo). La habilidad activa nueva del Maestro sigue sin
  implementar (ver más abajo).

## Resuelto recientemente (2026-07-20)

- **Reparto de Portales por número de jugadoras**: `js/setup.js` ahora
  sigue exactamente la tabla del reglamento (2 jugadoras → 2 portales/jugadora
  + 1 central; 3 → 1 + 2 centrales; 4 → 1 + 1 central; 5 → 1 + 0 centrales),
  y el formulario admite de 2 a 5 jugadoras (antes tope de 4). La zona de
  Portales neutrales (`#zoneNeutral`) se muestra/oculta en cada `render()`
  según `neutrals.length` en vez de fijarse solo al preparar la partida —
  de paso se corrigió que `#neutralArea` tenía su propia clase `hidden`
  que nunca se quitaba en ningún sitio, así que los Portales centrales no
  llegaban a verse nunca, independientemente del nº de jugadoras.
- **Cancelar una habilidad a medias ya no la marca como usada ni cobra
  Gemas**: `applyAbility()` (`js/abilities.js`) admite un callback
  `onComplete` que cada `case` invoca solo al mutar el estado de verdad;
  `js/actions.js` mueve ahí el cobro del coste de Portal central y el
  marcado de `window.habilidadUsadaEsteTurno`.
- **Metamorfo, restricción y persistencia**: `case 'Metamorfo'`
  (`js/abilities.js`) ya no limita la transformación al personaje que
  faltase para completar la invocación activa — ofrece los 9 personajes de
  `PERSONAJES_NO_ANIMALES` (`js/utils.js`, nueva constante) menos el propio
  Metamorfo, en cualquier momento del turno. La persistencia ya funcionaba
  (nada revertía `.name`); solo faltaba quitar la restricción para poder
  observarla. Sigue pendiente la representación visual (ficha superpuesta),
  ver más abajo.

---

## ~~Jugador autómata: niveles de dificultad~~ (resuelto 2026-07-21 — nivel 'dificil')

Ya existen DOS niveles: `'normal'` (heurística greedy sin cambios) y
`'dificil'`, nuevo módulo `js/bot-probabilidad.js` (conteo de cartas +
valor esperado en Gemas, ver el prompt original "Bloque 3" de esta tarea).
El punto de extensión de "memoria de lo visto públicamente en turnos
anteriores" que quedaba comentado en `js/bot.js` es ahora una estructura de
datos real: `window.memoriaBots[botIdx].portales`, un historial por Portal
(clave absoluta `"playerIdx:portalIdx"`/`"n:k"`) de qué personaje se ha
visto en su cima a lo largo de la partida, aunque ahora esté tapado —
solo vive en memoria JS de la partida en curso, nunca se persiste.

- **Conteo de cartas**: `composicionMazoTotal(invocationSet)` (nueva en
  `js/utils.js`, factorizada de la constante que antes vivía duplicada
  dentro de `initGame()`) da la composición total pública del mazo;
  `estimarProbabilidadesPersonajes()` resta lo ya contabilizado (Portales
  vistos/memorizados, manos con carta pública, la propia carta conocida) y
  reparte la probabilidad de cada personaje desconocido de forma uniforme
  entre los huecos de ubicación desconocida restantes — simplificación
  deliberada, documentada como tal en el propio código.
- **Valor esperado**: `valorEsperadoDeAccion()` pondera si el Portal
  destino es propio (Gema completa), ajeno (factor bajo — la Gema es para
  esa jugadora, no para el bot) o central/neutral (factor 0: nadie cobra
  esa Gema, ver `actions.js`, `arr[0] !== null`), más un bonus si la
  acción, con certeza, deja la invocación activa completa ahora mismo.
- **Fase A**: evalúa TODAS las combinaciones carta(conocida/oculta) ×
  Portal por valor esperado, en vez del atajo greedy de `'normal'`.
- **Fase B**: además de Ocultista/Cronista (ahora ponderados por la
  distribución de probabilidad real del Portal oculto en cuestión, no un
  "cualquiera vale"), el nivel `'dificil'` también sabe usar la habilidad
  activa del Maestro (Bloque 2) — determinista, porque la carta objetivo
  (`cartaOcultaPublica`) ya es una identidad conocida con certeza.
  **Actualización 2026-07-21 (Bloque 4 de la tarea "Marcador final,
  redacción de mensajes y estrategia del autómata")**: Estratega,
  Cronomante, Aprendiz y Metamorfo ya no están fuera de ningún nivel —
  las 7 habilidades activas (`PERSONAJES_CON_HABILIDAD`) tienen uso
  estratégico en AMBAS dificultades, con condición simple en `'normal'` y
  valor esperado (incluyendo un matiz adversarial por habilidad) en
  `'dificil'`. Detalle completo en `CHANGELOG.md` (versiones 1.18.0.77 a
  1.24.0.83) y en `Documentacion_Simulador_Invocadores.md`.
- **UI**: selector de dificultad en `js/setup.js`/`index.html`
  (`#selDificultadBots`), pero **GLOBAL para todos los autómatas de la
  partida**, no uno por autómata — decisión deliberada de esta tarea para
  no complicar la fila de nombres por jugadora, documentada en
  `CHANGELOG.md`.
- **No implementado, anotado como posible mejora futura**: el desempate
  opcional con la estimación de Gemas de rivales (`contarGemasPorNivel`,
  "para no facilitar en exceso a quien va ganando") que sugería el prompt
  original — la señal es débil frente a la complejidad añadida, ver el
  comentario en `decidirJugadaFaseADificil` (`js/bot.js`). Tampoco modela
  todavía "evitar tapar un Portal propio con una carta útil (p. ej. un
  Maestro o un Ocultista visible)" al decidir dónde jugar en Fase A — el
  valor esperado de la carta oculta es hoy el mismo en cualquier Portal
  propio, así que puede (al azar, en un empate) cubrir una habilidad ya
  visible que convenía dejar libre para Fase B. Verificado manualmente que
  esto no rompe nada — solo es una oportunidad de refinamiento futura.

## Ponerse al día con el reglamento actual

Estos bloques ya estaban descritos como prosa en la sección "⚠️ Read this
before touching game logic" de `CLAUDE.md`; aquí quedan como unidades de
trabajo concretas. La fuente de verdad de cómo debe comportarse cada una es
[`docs/reglamento/REGLAMENTO.md`](reglamento/REGLAMENTO.md) — antes de
tocar cualquiera de estos bloques, releer la sección correspondiente del
reglamento, no fiarse de esta descripción resumida.

### Personajes que faltan: Entusiasta

Falta por implementar el personaje **Entusiasta** por completo: la carta ni
siquiera entra en el mazo hoy (es la expansión aparte descrita en
"Variantes y modos de juego" — se baraja aparte justo antes de empezar,
no forma parte de la preparación normal del mazo), y su habilidad pasiva
(perder una Gema de valor 1 o superior cuando se completa cualquier
invocación con el Entusiasta bocarriba en un Portal) no existe en
`js/abilities.js`. Los **Animales** (Reena, Sora, Lumo) ya están
integrados — sin habilidad propia, que es fiel al reglamento ("no tienen
ninguna habilidad") — y entran en el mazo solo cuando el set de invocación
elegido es `introductorio` (el único que los necesita; `floral` reutiliza
el mazo normal sin Animales, ver `js/game.js`). Tamaño **S–M**: necesita
un toggle nuevo en la configuración (la expansión es opt-in), añadirlo al
mazo condicionalmente, y la penalización pasiva reutilizando
`gastarGemaUnitaria()` (`js/utils.js`) para el "toma el cambio" — ver
`docs/AUDITORIA_REGLAS.md`, sección 2.1.

### ~~Maestro: habilidad activa nueva~~ (resuelto 2026-07-21)

El bonus pasivo del Maestro (3 Gemas unitarias si es requisito de la
invocación activa y no hay ningún Pícaro visible en la mesa) ya estaba
corregido. La **habilidad activa** que añadió la revisión del reglamento de
2026-07-19 (elegir una carta que se vea en la mano de otra jugadora —la que
esa jugadora tiene oculta para sí misma pero visible para el resto— y
bajarla al Portal de **esa misma jugadora**) ya está implementada:
`case 'Maestro'` en `js/abilities.js`, con la lógica pura extraída a
`candidatosObjetivoMaestro()`/`bajarCartaMaestro()` (testables sin DOM, ver
`tests/run-tests.mjs`), y `'Maestro'` añadido a `PERSONAJES_CON_HABILIDAD`
(`js/utils.js`).

**Corrección de interpretación respecto a lo escrito aquí antes**: esta
misma sección decía que la carta bajaba "directamente al propio Portal del
Maestro" — eso resultó ser una lectura errónea de una nota de cambio
contradictoria dentro del propio `docs/reglamento/REGLAMENTO.md` (su
párrafo principal siempre dijo "al Portal de ese mismo jugador
seleccionado"). Confirmado con el propietario del proyecto: la carta baja
al Portal de la jugadora AFECTADA (dueña de la mano), nunca al del
Maestro — se corrigió también la nota de cambio del reglamento para
eliminar la contradicción. Como la jugadora objetivo puede tener más de un
Portal propio (2 jugadoras → 2 Portales cada una), se añadió un tercer paso
de selección de Portal destino cuando aplica, no contemplado explícitamente
en el diseño original de esta tarea.

### Metamorfo: representación visual de la transformación

La restricción antigua ("solo el personaje concreto que falta para
completar la invocación activa") y la falta de persistencia ya están
corregidas (`js/abilities.js`, `case 'Metamorfo'`, ver `CLAUDE.md`): el
picker ahora ofrece `PERSONAJES_NO_ANIMALES` (`js/utils.js`) completo menos
el propio Metamorfo, en cualquier momento del turno, y la transformación ya
era persistente en la práctica (nada del código revertía `.name`) — solo
hacía falta quitar la restricción para que se pudiera observar. El coste en
Gemas ya usa el modelo real (`gastarGemaUnitaria` en `js/utils.js`) y, si
el Metamorfo está en un Portal central, se suma al coste normal de activar
un Portal central (2 Gemas en total, ver `docs/reglamento/REGLAMENTO.md`) —
eso ya funciona.

**Actualización 2026-07-21**: el ítem 14 de `docs/DEUDA_TECNICA.md`
(identidad real vs. apariencia del Metamorfo) ya está resuelto — existe un
campo `.aspecto` separado de `.name`, y `cartaImgHtml()`/`portalCardHtml()`
(`js/render.js`) ya resuelven la imagen a partir de `card.aspecto ||
card.name`, así que un Metamorfo transformado ya muestra la imagen del
personaje imitado (`.name` se mantiene siempre en `'Metamorfo'` para
protección/restricciones/bonus, ver `CLAUDE.md`). Lo que sigue pendiente es
puramente el matiz visual: hoy no queda ningún rastro en la UI de que esa
carta "es en realidad" un Metamorfo — se ve exactamente igual que el
personaje imitado real. **Solución de diseño concreta pedida por el dueño
del proyecto**: superponer la imagen/icono del personaje imitado sobre la
carta del Metamorfo, pero con transparencia/opacidad reducida, de forma
que a través de ella se siga viendo que la carta base es un Metamorfo — no
ocultar del todo su identidad visual real (a diferencia de, por ejemplo,
una ficha opaca que tapase por completo el arte original). Ya no está
bloqueada por nada: solo hace falta cambiar `cartaImgHtml()`/
`portalCardHtml()` para pintar la imagen base de Metamorfo con la imagen de
`.aspecto` superpuesta a media opacidad encima, en vez de resolver una sola
imagen a partir de `.aspecto || .name`.

### Clarividente: bug (b) pendiente de reproducir (bug (a) ya resuelto)

**Actualización 2026-07-21**: esta entrada sustituía a una anterior que
concluía que no hacía falta implementar nada (con el argumento de que el
invariante "una carta visible y una oculta" nunca se rompía de verdad). El
dueño del proyecto probó la partida y confirmó dos bugs reales y distintos.
El **bug (a)** (sin picker ni elección real, periodo de gracia que no
cortaba el efecto cuando otra jugadora tapaba la Clarividente) ya está
**resuelto** — ver "Resuelto recientemente (2026-07-21, tras incorporar el
jugador autómata)" más arriba. Queda pendiente únicamente el bug (b):

**b. Reportado por el dueño del proyecto tras jugar una partida: al robar
carta al final de turno, la jugadora pierde la visibilidad de AMBAS
cartas de su mano, en vez de mantener la que normalmente vería (su carta
`vis.owner === true`) y perder solo la que veía de más gracias a la
Clarividente.** Esta sesión intentó reproducir el escenario jugando
directamente en el navegador (ver commits de esta ronda) en varias
variantes — grace period ya activo al jugar una carta ajena a la
Clarividente, y Clarividente genuinamente activa durante todo el turno
seguida de robo de reposición — y en ambos casos el resultado observado
fue el invariante normal (una carta visible, una oculta), no la pérdida de
ambas. **No se ha localizado la causa raíz todavía**: queda como bug
reportado, pendiente de reproducir con más detalle (número de jugadoras,
en qué punto exacto del turno, qué acción concreta lo dispara) antes de
poder señalar una línea de código concreta — no asumir que es el mismo
mecanismo que el bug (a) sin verificarlo primero.

### ~~Marcador final y desempate~~ (resuelto 2026-07-21 — cálculo, sin pantalla dedicada)

`finalizarPartida()` (`js/game.js`) ya muestra el recuento final de Gemas
por jugadora y resuelve el ganador (o empate) con la cadena de desempate
completa del reglamento — `calcularResultadoFinal()`, nueva en
`js/utils.js`, función pura y testada (`tests/run-tests.mjs`). Sigue
usando `alert()`/`confirm()` como el resto de la app (ver `DEUDA_TECNICA.md`
ítem 10) en vez de una pantalla de resultados dedicada — eso queda como
mejora de UX pendiente, ver "Sustituir `alert()`/`confirm()`..." más abajo.
Detalle completo en `docs/AUDITORIA_REGLAS.md`, sección 4.

### Modos Introductorio, Avanzado y Experto

Solo existe la preparación de mazo de "Modo normal" (ya al día con el
reglamento: sin Entusiasta/Animales salvo que el set de invocación los
requiera, Metamorfo incluido desde el principio, 2 cartas apartadas al
azar). Faltan el modo Introductorio como variante de preparación de mazo
completa (hoy solo existe su set de invocación, no su lista de personajes
propia: Reena, Sora, Lumo, Pícaro, Aprendiz, Cronista, Estratega y
Cronomante — roster real de **29 cartas**, no las 41 que produce hoy el
código al elegir el set `introductorio`, ver `docs/AUDITORIA_REGLAS.md`
sección 1.1 para el cálculo exacto), el modo Avanzado (tamaño S–M: su
composición de 41 cartas coincide, por casualidad, con lo que el código
ya produce hoy para `introductorio` — es más renombrar/reutilizar que
construir desde cero) y el modo Experto (tamaño L: autómata central sin
mano ni turno propio, 4ª invocación "Asterisco"/Madain ya definida como
`INVOCATION_ASTERISCO` en `js/utils.js` pero sin conectar a ningún flujo,
restricción de Metamorfo en forma natural, intercambio de Gemas al
final) — cada uno como variante seleccionable antes de empezar, no como
modos separados de código.

### Variante 2 contra 2

Falta la variante de equipos 2vs2 descrita en el reglamento. Más pequeña
de lo que parece (tamaño S–M, ver `docs/AUDITORIA_REGLAS.md` sección 1.4):
el reglamento no cambia el orden de turnos (lo resuelve la disposición
física en la mesa), así que solo hace falta etiquetar jugadoras por
equipo en la configuración y sumar Gemas por equipo en el marcador final.
**Actualización 2026-07-21**: el marcador final individual ya existe
(`calcularResultadoFinal()`, `js/utils.js`, ver el bloque anterior) — esta
variante sigue bloqueada, pero ahora específicamente porque esa función
suma y desempata por JUGADORA, no por equipo; haría falta una variante
(o un parámetro de agrupación) que sume `sumaGemas()` por equipo antes de
aplicar la misma cadena de desempate, no partir de cero.

---

## Multijugador por red (una jugadora, un móvil)

Bloque de mayor alcance de todo este documento — **sin fecha ni prioridad
asignada todavía**, a diferencia de los bloques anteriores que sí son
trabajo concreto de "ponerse al día". Ya se menciona como dirección a
futuro en la sección "Future direction" de `CLAUDE.md`; se recoge aquí como
un bloque más del backlog, no como plan activo:

Cada jugadora usaría su propio móvil en vez de mirar todas a la misma
pantalla compartida, uniéndose a una "sala" bien por la misma red Wi-Fi o
bien a través de un pequeño servidor. Hoy nada del código lo soporta: el
simulador entero asume una sola pestaña compartida y confía en que cada
jugadora aparte la vista en los momentos de carta oculta. Implica decisiones
de arquitectura no tomadas todavía (protocolo de sincronización, cómo se
reparte qué ve cada dispositivo, qué pasa con `window.*` como fuente de
estado — ver la nota de arquitectura en `CLAUDE.md` sobre no acoplar la
lógica de juego al DOM más de lo necesario). No empezar a construir nada de
esto de forma especulativa hasta que se decida acotar el alcance.

---

## Mejoras de UX

Ideas recogidas visitando el propio simulador, no bugs. Cuando una mejora
tiene también un componente de deuda técnica, se referencia el ítem
correspondiente de `DEUDA_TECNICA.md` en vez de duplicar la descripción.

### Sustituir `alert()`/`confirm()` por UI propia con historial de eventos

El uso masivo de diálogos nativos bloqueantes para turnos, habilidades y
fin de partida está documentado como deuda de código en el ítem 10 de
`DEUDA_TECNICA.md`. Aquí se anota el lado de **alcance nuevo**: una vez que
se decida sustituirlos, la oportunidad es construir una zona de UI propia
con un registro visual de lo ocurrido en la partida (qué jugadora jugó qué
carta, qué habilidad se activó, qué invocación se completó) — algo que hoy
no existe en absoluto, porque los `alert()` desaparecen sin dejar rastro en
pantalla una vez cerrados.

### Abandonar/reiniciar la partida en curso sin tener que forzar el final

Hoy la única forma de volver a la pantalla de configuración es completar
la última invocación o quedarse sin cartas (lo que dispara
`finalizarPartida()` en `js/game.js`, que sí ofrece "jugar otra vez"). No
hay ningún botón visible durante la partida para abandonarla o reiniciarla
a medias si, por ejemplo, alguien se equivocó configurando el número de
jugadoras.

### Hacer más visible el aviso de nueva versión / número de versión

El número de versión (`js/version-check.js`) aparece en una esquina
pequeña y con poco contraste; fácil de no ver en un móvil durante la
partida. Si además se corrige el ítem 2 de `DEUDA_TECNICA.md` (comparación
de versión por orden real), podría valer la pena que el aviso de
actualización sea más notorio, ya que dejaría de ser un falso positivo
frecuente.

### Vista de mesa ovalada con jugadora activa siempre al frente

Idea del propietario: visualizar a las jugadoras dispuestas en un óvalo
(como una mesa física), con la jugadora activa siempre en la posición
más cercana/destacada, girando la disposición en cada cambio de turno en
vez de tener una lista fija. Dos enfoques posibles a valorar cuando se
aborde: (a) barato — reordenar lógicamente la lista de jugadoras en cada
render para que la activa vaya siempre primero/destacada, sin geometría
real; (b) currado — posicionamiento real en óvalo vía CSS
(transform/posición absoluta) con animación de "giro" al cambiar de
turno. Requiere diseño visual dedicado antes de implementar, no es un
ajuste menor de CSS.

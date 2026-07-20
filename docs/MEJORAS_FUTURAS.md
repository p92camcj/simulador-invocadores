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

### Maestro: habilidad activa nueva

El bonus pasivo del Maestro (3 Gemas unitarias si es requisito de la
invocación activa y no hay ningún Pícaro visible en la mesa) ya está
corregido. Falta por completo la **habilidad activa** que añadió la
revisión del reglamento de 2026-07-19: elegir una carta que se vea en la
mano de otra jugadora (la que esa jugadora tiene oculta para sí misma pero
visible para el resto) y bajarla directamente al propio Portal del
Maestro; la jugadora afectada repone mano robando del mazo. Esto es
trabajo nuevo en `js/abilities.js` (nuevo `case 'Maestro'`) y en
`PERSONAJES_CON_HABILIDAD` (`js/utils.js`, añadir `'Maestro'` a la lista
de personajes con habilidad activable en Fase B). Tamaño **S** (patrón ya
establecido, similar a Cronista) — selecciona una carta de una mano
ajena, no un Portal, así que no encaja con el clic-en-grid de
`pickerPortal()` (igual que Aprendiz), se queda con el `picker()` normal.

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

### Clarividente: dos bugs reales confirmados tras probar la partida

**Actualización 2026-07-21**: esta entrada sustituye a una anterior que
concluía que no hacía falta implementar nada (con el argumento de que el
invariante "una carta visible y una oculta" nunca se rompía de verdad). El
dueño del proyecto ha probado la partida y confirmado que sí hay dos bugs
reales y distintos por resolver — además, la nota de interpretación de
`docs/reglamento/REGLAMENTO.md` ("Clarividente") ya no acepta ningún
"periodo de gracia" como diseño válido: la pérdida de visibilidad debe ser
inmediata, siempre.

**a. No existe ningún picker ni elección real de la jugadora al perder la
Clarividente visible.** El efecto "ver ambas cartas" depende únicamente de
los flags automáticos `hasClariActivo`/`haTenidoClarividente`
(`actualizarClarividente()`, `js/utils.js`), sin que la jugadora elija
nunca qué carta prefiere dejar de ver — el texto de la sección
"Clarividente" pide explícitamente que "el jugador debe voltear una carta
a su elección". Además, el único sitio que hoy corta el efecto
(`js/actions.js`, `jugarCartaSeleccionadaEn()`: `if (!pl.hasClariActivo) {
pl.haTenidoClarividente = false; }`) solo se ejecuta cuando la jugadora
ACTIVA juega una carta — así que si la Clarividente de otra jugadora deja
de estar visible por una habilidad ajena (Cronista, Estratega, Cronomante,
Ocultista actuando sobre su Portal), el efecto no se corta hasta que esa
jugadora vuelva a jugar una carta en su propio turno, violando la regla
corregida de "inmediato, sin excepción". Corrección necesaria: disparar un
picker exactamente en el instante en que `hasClariActivo` pasa de `true` a
`false` para una jugadora (sea cual sea la causa), preguntándole qué carta
de las dos quiere que pase a estar oculta para ella — no un sitio único
como hoy, sino cualquier punto del código que pueda hacer que la
Clarividente deje de estar visible.

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

### Marcador final y desempate

No existe ninguna pantalla de resultados ni lógica de desempate al acabar
la partida — `finalizarPartida()` (`js/game.js`) hoy solo pregunta si se
quiere jugar otra vez, sin mostrar gemas finales por jugadora ni resolver
empates según las reglas. **Prioridad Alta** (bloquea la variante 2vs2 de
abajo y es literalmente cómo se decide quién gana la partida) — ver
`docs/AUDITORIA_REGLAS.md`, sección 4, para el detalle de qué falta
exactamente y una estimación de tamaño (M: el cálculo en sí es sencillo
con los datos ya existentes en `player.gems`, la pieza grande es sustituir
`alert()`/`confirm()` por una pantalla de resultados real).

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
equipo en la configuración y sumar Gemas por equipo en el marcador final
— por eso está bloqueada por el bloque anterior (no hay marcador del que
sumar).

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

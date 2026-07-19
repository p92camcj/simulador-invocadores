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

---

## Ponerse al día con el reglamento actual

Estos bloques ya estaban descritos como prosa en la sección "⚠️ Read this
before touching game logic" de `CLAUDE.md`; aquí quedan como unidades de
trabajo concretas. La fuente de verdad de cómo debe comportarse cada una es
[`docs/reglamento/REGLAMENTO.md`](reglamento/REGLAMENTO.md) — antes de
tocar cualquiera de estos bloques, releer la sección correspondiente del
reglamento, no fiarse de esta descripción resumida.

### Reparto de portales por número de jugadoras

El reparto actual (`js/setup.js`) no coincide con la tabla del reglamento
para 3/4/5 jugadoras, y el propio formulario de configuración limita el
número de jugadoras a 2-4 (`index.html`, input `numPlayers`), sin
contemplar la partida de 5. Implica revisar tanto `setup.js` como el límite
del formulario.

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
el mazo normal sin Animales, ver `js/game.js`).

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
de personajes con habilidad activable en Fase B).

### Metamorfo: quitar restricción y hacer persistente la transformación

Desde la revisión del reglamento de 2026-07-19, el Metamorfo (`js/abilities.js`,
`case 'Metamorfo'`) debe actualizarse en dos aspectos: (1) ya no puede
transformarse solo en "el personaje concreto que falta para completar la
invocación activa" — ahora puede transformarse en cualquier personaje que
no sea animal, en cualquier momento de su turno; (2) la transformación debe
persistir hasta que la carta se tape con otra o se vuelva a pagar el coste
para transformarla en otra cosa, en vez de revertir como hoy. También habría
que representar visualmente que la carta transformada "es en realidad" un
Metamorfo (el reglamento usa una ficha superpuesta con la cara del
personaje imitado), no solo cambiar el nombre internamente sin dejar
rastro. El coste en Gemas ya usa el modelo real (`gastarGemaUnitaria` en
`js/utils.js`) y, si el Metamorfo está en un Portal central, se suma al
coste normal de activar un Portal central (2 Gemas en total, ver
`docs/reglamento/REGLAMENTO.md`) — eso ya funciona; lo pendiente es solo la
restricción y la persistencia de la transformación en sí.

### Marcador final y desempate

No existe ninguna pantalla de resultados ni lógica de desempate al acabar
la partida — `finalizarPartida()` (`js/game.js`) hoy solo pregunta si se
quiere jugar otra vez, sin mostrar gemas finales por jugadora ni resolver
empates según las reglas.

### Modos Introductorio, Avanzado y Experto

Solo existe la preparación de mazo de "Modo normal" (ya al día con el
reglamento: sin Entusiasta/Animales salvo que el set de invocación los
requiera, Metamorfo incluido desde el principio, 2 cartas apartadas al
azar). Faltan el modo Introductorio como variante de preparación de mazo
completa (hoy solo existe su set de invocación, no su lista de personajes
propia: Reena, Sora, Lumo, Pícaro, Aprendiz, Cronista, Estratega y
Cronomante), el modo Avanzado y el modo Experto (este último con el
autómata central y la 4ª invocación "Asterisco"/Madain, ya definida como
`INVOCATION_ASTERISCO` en `js/utils.js` pero sin conectar a ningún flujo)
— cada uno como variante seleccionable antes de empezar, no como modos
separados de código.

### Variante 2 contra 2

Falta la variante de equipos 2vs2 descrita en el reglamento — probablemente
implica repensar cómo se agrupan `window.players` en equipos para el
recuento de victoria/gemas, no solo la UI de selección.

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

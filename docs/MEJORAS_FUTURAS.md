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

### Economía real de gemas

Sustituir el número plano `REWARD = { C:1, B:2, A:3 }` (`js/utils.js`) por
el sistema real de gemas del reglamento: robo de una gema de valor
aleatorio por invocación completada, y la economía de "Gema unitaria"
(pagar una gema de valor 1, o la de menor valor ya ganada, para usar la
habilidad de un Portal central). Toca el modelo de datos de `player.gems`
(hoy un número simple) para pasar a representar gemas individuales con
valor.

### Sets de invocación con nombre (introductorio / normal / floral)

Hoy `COMBOS.C/B/A` en `js/utils.js` es un único combo genérico por nivel.
El reglamento define varios sets de invocación con nombre propio entre los
que elegir al preparar la partida, no uno fijo.

### Personajes que faltan: Entusiasta y Animales

Faltan por implementar el personaje **Entusiasta** y los **Animales**
(Reena, Sora, Lumo) — habilidades, cartas y su integración en
`js/abilities.js`, `js/game.js` (mazo) y `js/utils.js` (`iconos`, combos
que los incluyan). Al añadirlos, tener en cuenta el ítem 8 de
`DEUDA_TECNICA.md` (roster de personajes duplicado entre `abilities.js` y
`actions.js`) para no repetir el mismo error de sincronización manual con
un personaje nuevo.

### Maestro: bonus pasivo y habilidad activa nueva

`js/actions.js` comprueba si Pícaro forma parte del combo actual
(`!map.has('Pícaro')`) y solo lo hace para el nivel `'A'`. Según el
reglamento debería comprobar si hay algún Pícaro **visible en cualquier
parte de la mesa**, y aplicarse en el nivel que corresponda, no solo en
`'A'`.

Además, desde la revisión del reglamento de 2026-07-19 el Maestro tiene una
**habilidad activa** que hoy no existe en absoluto en el código: elegir una
carta que se vea en la mano de otra jugadora (la que esa jugadora tiene
oculta para sí misma pero visible para el resto) y bajarla directamente al
propio Portal del Maestro; la jugadora afectada repone mano robando del
mazo. Esto es trabajo nuevo en `js/abilities.js` (nuevo `case 'Maestro'`) y
`js/actions.js` (añadir `'Maestro'` a la lista de personajes con habilidad
activable), no solo una corrección del bonus pasivo existente.

### Metamorfo: quitar restricción y hacer persistente la transformación

Desde la revisión del reglamento de 2026-07-19, el Metamorfo (`js/utils.js`
y `js/abilities.js`) debe actualizarse en dos aspectos: (1) ya no puede
transformarse solo en "el personaje concreto que falta para completar la
invocación activa" — ahora puede transformarse en cualquier personaje que
no sea animal, en cualquier momento de su turno; (2) la transformación debe
persistir hasta que la carta se tape con otra o se vuelva a pagar el coste
para transformarla en otra cosa, en vez de revertir como hoy. También habría
que representar visualmente que la carta transformada "es en realidad" un
Metamorfo (el reglamento usa una ficha superpuesta con la cara del
personaje imitado), no solo cambiar el nombre internamente sin dejar
rastro.

### Cantidades del mazo de personajes desactualizadas (43 vs. 64 cartas)

El array `chars` de `initGame()` en `js/game.js` todavía refleja la versión
anterior del mazo (64 cartas). El reglamento actual especifica 43 cartas:
2× Maestro, 2× Clarividente, 2× Ocultista, 3× Cronomante, 3× Estratega, 4×
Cronista, 4× Aprendiz, 4× Centinela, 6× Pícaro, 2× Metamorfo, 2×
Entusiasta, 9× Animales (3 de cada). Bajan las cantidades de casi todos los
personajes salvo Maestro, Metamorfo y Entusiasta, que se mantienen igual.

### Marcador final y desempate

No existe ninguna pantalla de resultados ni lógica de desempate al acabar
la partida — `finalizarPartida()` (`js/game.js`) hoy solo pregunta si se
quiere jugar otra vez, sin mostrar gemas finales por jugadora ni resolver
empates según las reglas.

### Modos Introductorio, Avanzado y Experto

Solo existe (una versión simplificada de) el modo normal. Faltan el modo
Introductorio, el modo Avanzado y el modo Experto (este último con el
autómata central que menciona el reglamento) — cada uno como variante
seleccionable antes de empezar, no como modos separados de código.

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

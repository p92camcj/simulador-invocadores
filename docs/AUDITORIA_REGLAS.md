# Auditoría de reglas — reglamento vs. código real

> **Última actualización:** 2026-07-21 (Europe/Madrid)
>
> Informe de auditoría, no una tarea de código. Cruza
> [`docs/reglamento/REGLAMENTO.md`](reglamento/REGLAMENTO.md) contra el
> estado real de `js/*.js` en la versión `1.13.11.67` (tras el autómata
> `js/bot.js`, la corrección del ítem 16 de `DEUDA_TECNICA.md` y toda la
> ronda de deuda técnica del 2026-07-21). No sustituye a
> `docs/MEJORAS_FUTURAS.md` ni a `docs/DEUDA_TECNICA.md` — los complementa;
> el detalle largo de cada hallazgo vive aquí, esos otros documentos solo
> se actualizan con la conclusión accionable (ver el final de cada
> sección).
>
> **Reauditoría 2026-07-21 (2)**: se releyó el informe completo contra el
> código real posterior al autómata y a la ronda de deuda técnica. Ver
> sección 7 (nueva) para el resultado de revisar específicamente cómo
> interactúa `js/bot.js` con cada mecánica que esta sección 3 ya señalaba
> como conflictiva. Conclusión corta: **ningún bug nuevo encontrado**; los
> hallazgos de las secciones 1-6 siguen con el mismo estado que ya tenían
> (los marcados "Corregido" siguen corregidos, los "Pendiente" siguen
> pendientes) — se han refrescado únicamente las referencias de versión de
> este encabezado.

---

## 1. Modos de juego no implementados

Solo existe hoy la preparación de "Modo normal" (`js/game.js`,
`initGame()`): 32 cartas (10 personajes no-animales, cantidades reales de
`cantidadesModoNormal`), + 9 Animales si el set de invocación elegido es
`introductorio`, apartando 2 cartas al azar sin mirar. Los 3 **sets de
invocación** (`introductorio`/`normal`/`floral`, `INVOCATION_SETS` en
`utils.js`) sí están completos y correctos — lo que falta es que
"Introductorio" también sea una variante completa de **preparación de
mazo**, y los modos Avanzado y Experto no existen en absoluto.

### 1.1 Introductorio como variante completa de mazo

**Hallazgo cuantificado** (no estaba precisado en `MEJORAS_FUTURAS.md`):
el roster real de "Modo introductorio" (`REGLAMENTO.md`, "Preparación del
mazo de personajes") es Reena, Sora, Lumo, Pícaro, Aprendiz, Cronista,
Estratega y Cronomante — **sin** Maestro, Clarividente, Ocultista,
Centinela ni Metamorfo, y **sin apartar ninguna carta** (a diferencia de
"Modo normal", que sí aparta 2 al azar). Usando las cantidades físicas de
`Componentes` (3 Reena + 3 Sora + 3 Lumo + 6 Pícaro + 4 Aprendiz + 4
Cronista + 3 Estratega + 3 Cronomante), el mazo real de Introductorio son
**29 cartas**, no las 41 que produce hoy el código.

Hoy, elegir el set de invocación `introductorio` en la pantalla de
configuración **no** cambia el roster de personajes — solo le añade los 9
Animales al mazo completo de "Modo normal" (32 + 9 = 41 cartas), lo cual
es en realidad más parecido a la composición de **Modo Avanzado** (ver
1.2) que a la de Introductorio. Esto no es un bug de las tareas de esta
ronda — es el hueco ya documentado en `CLAUDE.md`, aquí simplemente
cuantificado con números exactos.

- **Archivos**: `js/game.js` (`initGame()`, nueva rama de cantidades para
  Introductorio), `js/setup.js` (probablemente conviene una opción de
  configuración explícita "modo de preparación" separada de "set de
  invocación", ya que hoy ambos conceptos están fusionados en
  `#selInvocationSet`).
- **Tamaño estimado**: **M**. No es solo añadir una constante de
  cantidades — implica decidir si "modo de preparación" y "set de
  invocación" deben ser selectores independientes en la UI (hoy son el
  mismo `<select>`), porque nada impide combinar a día de hoy, por
  ejemplo, "mazo Introductorio" con "invocaciones Floral" según el
  reglamento (los sets de invocación son ortogonales al modo de
  preparación del mazo).

### 1.2 Modo Avanzado

Mazo completo (43 − 2 Entusiasta = 41 cartas: los 10 personajes no
animales + 9 Animales), apartando 2 cartas al azar. **Coincide en tamaño
y composición** con lo que el código de hoy produce (por accidente) para
`introductorio`, así que gran parte de la lógica de deck-building ya
existe, solo mal etiquetada — implementar Avanzado de verdad es más bien
_reutilizar/renombrar_ el camino de código actual y dejar Introductorio
(1.1) con su propio roster reducido, en vez de construir Avanzado desde
cero.

- **Archivos**: `js/game.js` (nueva rama, esencialmente la lógica que hoy
  cuelga de `necesitaAnimales`), `js/setup.js` (opción de modo).
- **Tamaño estimado**: **S–M**.

### 1.3 Modo Experto

El de mayor alcance de los tres. Necesita: mazo completo sin Entusiasta y
**sin apartar cartas**; una 4ª invocación "Asterisco" (ya definida como
`INVOCATION_ASTERISCO` en `utils.js` — Metamorfo + los 3 Animales, gemas
11/12/12/12/13 — pero sin conectar a ningún flujo real, ni siquiera
referenciada fuera de su propia declaración); un **jugador autómata**
central (estado nuevo, no es un `window.players[i]` normal: no tiene mano
ni turno propio, solo Portales centrales y acumula Gemas); la regla de que
el autómata se lleva las Gemas de cualquier invocación donde tuviera un
personaje participante y no duplicado en sus Portales, incluidas las
**pasivas** de Pícaro/Maestro (pero no la activa nueva del Maestro, que no
tiene sentido para un jugador sin turno); y, al final de la partida, la
opción de que quien va last cambie TODAS sus Gemas por las del autómata.
También la restricción específica de que, para la invocación Asterisco,
el Metamorfo debe estar en su forma natural (no transformado) — algo que
`case 'Metamorfo'` no comprueba hoy en absoluto (ni falta que le hace,
porque `need` ya se pasa a `applyAbility()` sin usarse, previsto
justamente para esto).

- **Archivos**: `js/game.js` (deck + autómata), `js/actions.js`
  (comprobación de invocación con 4 niveles en vez de 3, reparto de Gemas
  al autómata), `js/abilities.js` (restricción de Metamorfo natural para
  Asterisco), `js/utils.js` (ya tiene `INVOCATION_ASTERISCO`, falta
  conectarlo a `LEVELS`/`INVOCATION_SETS` de alguna forma — hoy `LEVELS`
  es un array fijo `['C','B','A']`, habría que extenderlo condicionalmente
  a `['C','B','A','Asterisco']` solo en este modo), pantalla de fin de
  partida (intercambio de Gemas).
- **Tamaño estimado**: **L**. Es el único modo que no es solo
  "cantidades de mazo distintas" — introduce un actor nuevo en el modelo
  de datos (`window.players` asume hoy que todo jugador tiene mano y
  turno) y una cuarta invocación con reglas propias.

### 1.4 Variante 2 contra 2

Más pequeña de lo que parece a primera vista tras leer el texto con
detalle: "Las reglas básicas del juego no cambian. Los Portales siguen
perteneciendo a cada jugador... Al final de la partida, se suman las
Gemas... de ambos integrantes de cada equipo." El orden de turnos no
necesita ningún cambio de código — el reglamento resuelve la alternancia
por equipos con la disposición física en la mesa ("se sientan alternos"),
no con lógica de turno especial. Lo único que hace falta:

1. Etiquetar cada jugadora con un equipo (`window.players[i].team`, o un
   `window.teams` aparte) en la pantalla de configuración.
2. En el recuento final (`finalizarPartida()`, ver sección 4), sumar
   Gemas por equipo en vez de por jugadora individual cuando la variante
   está activa.

- **Archivos**: `js/setup.js` (UI de asignación de equipo, probablemente
  solo tiene sentido con nº de jugadoras par), `js/game.js`
  (`finalizarPartida()`, una vez exista lógica de marcador — ver sección
  4, con la que este modo está acoplado).
- **Tamaño estimado**: **S–M** — pequeño en sí mismo, pero bloqueado por
  la sección 4 (no hay ningún marcador final del que "sumar por equipo").

---

## 2. Personajes y habilidades incompletos

### 2.1 Entusiasta

No entra en el mazo bajo ninguna circunstancia hoy (confirmado: `game.js`
nunca referencia `'Entusiasta'` en `cantidadesModoNormal` ni en ninguna
otra construcción de mazo), y no tiene ninguna lógica de habilidad en
`abilities.js` ni en el bloque de comprobación de invocación de
`actions.js`. Su habilidad pasiva ("si se ejecuta una invocación con éxito
y un Entusiasta está bocarriba en un Portal, el jugador que lo tenga
**pierde** una Gema de valor 1 o mayor, tomando el cambio") encajaría de
forma natural en el mismo bloque de `actions.js` donde ya se procesan los
bonus pasivos de Pícaro/Maestro tras una invocación exitosa, reutilizando
`gastarGemaUnitaria()` (`utils.js`) para el "toma el cambio" (ya sabe
convertir una Gema de mayor valor en unitarias).

- **Archivos**: `js/game.js` (añadir al mazo solo si la expansión está
  activada — necesita un toggle de configuración nuevo, ver
  `docs/reglamento/REGLAMENTO.md`, "Expansión: el Entusiasta" — se baraja
  con el mazo, no se reparte aparte), `js/setup.js` (toggle), `js/actions.js`
  (penalización pasiva, junto al bloque de Pícaro/Maestro).
- **Tamaño estimado**: **S–M**.

### 2.2 Maestro: habilidad activa (resuelto 2026-07-21)

El bonus pasivo (3 Gemas si Maestro es requisito y no hay Pícaro visible
en la mesa) ya estaba corregido desde una ronda anterior. La habilidad
activa (elegir una carta visible-para-otros de la mano de otra jugadora y
bajarla al Portal de **esa misma jugadora** — no a uno propio del Maestro,
ver la corrección de interpretación más abajo) ya está implementada:
`case 'Maestro'` en `js/abilities.js`, con la lógica pura (selección de
candidatas + movimiento de la carta) extraída a `candidatosObjetivoMaestro()`/
`bajarCartaMaestro()`, testables sin DOM (`tests/run-tests.mjs`). Como en
Aprendiz, esta habilidad selecciona una **jugadora** (y, si tiene más de un
Portal propio, también el Portal destino), no un Portal ajeno como
objetivo directo — se queda con `picker()` normal, no `pickerPortal()`.
Respeta la protección de Centinela reutilizando el mismo helper que ya
usaba Aprendiz (renombrado de `jugadorProtegidoContraAprendiz` a
`jugadorProtegidoComoObjetivo`, ya no es específico de una sola
habilidad).

**Corrección de interpretación**: el borrador original de este hallazgo
(y el de `docs/MEJORAS_FUTURAS.md`) decía que la carta bajaba "a un Portal
propio" (del Maestro) — una lectura de una nota de cambio del reglamento
que contradecía a su propio párrafo principal ("al Portal de ese mismo
jugador seleccionado"). Confirmado con el propietario del proyecto: la
lectura correcta es que la carta baja al Portal de la jugadora AFECTADA,
nunca al del Maestro — corregido también en
`docs/reglamento/REGLAMENTO.md` para eliminar la contradicción interna.

- **Archivos**: `js/abilities.js` (`case 'Maestro'`,
  `candidatosObjetivoMaestro()`, `bajarCartaMaestro()`), `js/utils.js`
  (`'Maestro'` en `PERSONAJES_CON_HABILIDAD`, nuevo helper
  `reponerManoSiFalta()` compartido con el fin de turno de `actions.js`).
- **Tamaño real**: **S**, como se estimaba — patrón ya establecido (similar
  en forma a Cronista), sin necesidad de UI nueva más allá de un tercer
  picker opcional para elegir Portal cuando la jugadora objetivo tiene más
  de uno (2 jugadoras → 2 Portales cada una), no anticipado en la
  estimación original.

---

## 3. Conflictos e interacciones entre habilidades

Esta sección es el resultado de leer `js/abilities.js` completo con ojo
crítico, no solo repasar la lista de escenarios sugerida — se incluye esa
lista y hallazgos adicionales.

### 3.1 🔴 BUG REAL ENCONTRADO: Ocultista puede revelar una Centinela oculta sin re-disparar el auto-giro, permitiendo dos Centinelas visibles a la vez

**Reproducción, verificada leyendo el código (no de memoria):**

1. Jugadora A tiene una Centinela visible en su Portal 1 (protegiendo
   todos sus Portales).
2. Cualquier jugadora juega una **segunda** Centinela en un Portal
   central. `js/actions.js` (`jugarCartaSeleccionadaEn`) detecta
   `card.name === 'Centinela'` y llama a `ocultarOtrasCentinelas()`
   (`js/abilities.js`), que oculta la Centinela de A (`vis.public =
   false`) — correcto, "solo puede haber una Centinela visible en mesa".
3. La Centinela de A sigue siendo la carta superior de su Portal 1, pero
   ahora **oculta**. Como ya no es un `vis.public === true`,
   `jugadoraProtegidaPorCentinela()` deja de proteger a A, y
   `esCentinelaVisible()` (la restricción propia de Ocultista) también
   deja de bloquear ese Portal, porque ambas comprueban
   `st.at(-1).vis?.public`.
4. Cualquier jugadora activa Ocultista sobre el Portal 1 de A —ya no está
   protegido ni es "una Centinela visible"— y lo alterna de vuelta a
   visible: `carta.vis.public = !carta.vis.public`.
5. **Resultado**: ahora hay DOS Centinelas visibles en mesa a la vez (la
   de A, recién revelada, y la que se jugó en el paso 2), violando "solo
   puede haber una Centinela visible en mesa" — y el `case 'Ocultista'`
   de `applyAbility()` **no** llama a `ocultarOtrasCentinelas()` tras
   alternar la visibilidad, así que nada corrige la situación hasta que
   se juegue una Centinela nueva.

**Por qué es alcanzable en una partida real**: Modo normal tiene 4 cartas
de Centinela en el mazo — nada impide que dos (o más) acaben en juego a
la vez, ni que alguien decida usar Ocultista sobre un Portal cuyo
contenido oculto desconoce (de hecho el propio reglamento anima a esto:
"¿Puedo usar habilidades sobre una carta oculta sobre un Portal que no
veo cuál es? Sí").

**Por qué NO es lo mismo que el caso ya cubierto** (Ocultista no puede
tocar una Centinela **visible**): esa restricción (`esCentinelaVisible`)
bloquea correctamente revelar→ocultar una Centinela que ya está a la
vista; el hueco está en el sentido contrario, ocultar→revelar una
Centinela que ya NO está a la vista (porque el propio auto-giro la tapó).

- **Corrección propuesta** (no aplicada en esta ronda, ver más abajo):
  en `case 'Ocultista'`, tras `carta.vis.public = !carta.vis.public`,
  comprobar si `carta.name === 'Centinela' && carta.vis.public` y, si es
  así, llamar también a `ocultarOtrasCentinelas(st, players, neutrals)`
  (ya `export`ada desde el mismo archivo).
- **Prioridad**: era **Alta** — requiere una secuencia específica de 3
  acciones de al menos dos jugadoras distintas, pero es completamente
  alcanzable sin trucos ni estados imposibles.
- **Actualización 2026-07-21 — resuelto**: `case 'Ocultista'`
  (`js/abilities.js`) ahora llama a `ocultarOtrasCentinelas(st, players,
  neutrals)` justo después de alternar la visibilidad, si la carta recién
  revelada es una Centinela real (`carta.name === 'Centinela'`). Ver
  `docs/DEUDA_TECNICA.md` ítem 12 (movido a "Resueltos").

### 3.2 Centinela + Ocultista/Cronista/Cronomante/Estratega/Aprendiz — protección uniforme (verificado, sin hueco)

Los 4 casos que seleccionan un **Portal** como objetivo (Ocultista,
Cronista, el primer picker de Cronomante, y los dos pickers de Estratega)
usan literalmente la misma `estaProtegidoParaActivar()` de `utils.js` vía
`portalesConEstado()`, con la misma exención para la propia dueña actuando
sobre sus propios Portales. Aprendiz (que selecciona **jugadoras**, no
Portales) usa `jugadorProtegidoContraAprendiz()` → `jugadoraProtegidaPorCentinela()`
— una función distinta pero equivalente en efecto, con la misma exención.
Metamorfo no necesita ninguna comprobación de protección porque su
"objetivo" es siempre el propio Portal donde ya está el Metamorfo (nunca
se elige un Portal ajeno), y la protección no bloquea a una jugadora
actuando sobre sí misma. **Conclusión: las 6 habilidades están cubiertas
de forma uniforme, sin ninguna quedarse fuera.**

### 3.3 Centinela + auto-giro — orden de operaciones (verificado, sin hueco)

Trazado el código exacto de `jugarCartaSeleccionadaEn()`: la nueva
Centinela se empuja al Portal **como visible** (`generarVis('portal', {})`
siempre devuelve `{public: true}`) **antes** de llamar a
`ocultarOtrasCentinelas()`, así que el orden es correcto (aparece visible
primero, luego se ocultan las demás). El auto-giro deliberadamente **no**
comprueba `estaProtegidoParaActivar()` — y eso es correcto, no un hueco:
el auto-giro no es una "habilidad" sujeta a la protección de Centinela
(que bloquea habilidades activadas en Fase B contra un Portal ajeno), es
una regla automática de Fase A al mismo nivel que "se puede jugar una
carta sobre una Centinela visible" (explícitamente permitido por el
reglamento). Ver también 3.1 para el hueco relacionado pero distinto que
sí existe.

### 3.4 Cronomante + fin de partida a medio investigar (verificado, sin hueco)

`window.cronomantePortalInvestigado` y `window.cronomanteOnComplete` solo
se leen dentro de `#btnAbility.onclick` (`actions.js`), y el primero se
resetea a `null` en `nextTurn()`, `initGame()` y `resetJuego()` — cubre
los 3 puntos de entrada reales:

- Fin de partida por mano vacía (`nextTurn()` detecta `hand.length===0`
  **antes** de resetear investigar — pero en ese momento el jugador con
  mano vacía es quien EMPIEZA turno, no quien tiene la investigación
  pendiente, así que no hay conflicto real; y aunque lo hubiera,
  `finalizarPartida()` → `resetJuego()` limpia el estado igualmente si se
  elige jugar otra vez).
- Fin de partida por última invocación completada (`actions.js`,
  `#btnEndTurn.onclick`): no resetea `cronomantePortalInvestigado`
  directamente en esa rama, pero solo importa si se elige "jugar otra
  vez" (`resetJuego()` sí lo limpia) — si no, la partida sustituye
  `document.body.innerHTML` por completo, así que no queda ningún control
  con el que interactuar el estado colgado, y `location.reload()` (botón
  "Volver a empezar") borra toda la memoria JS de todos modos.
- Terminar turno voluntariamente con una investigación pendiente sin
  resolver (nada en `#btnEndTurn.onclick` lo impide): al avanzar turno,
  `nextTurn()` limpia el estado — abandonar una investigación a medias
  simplemente la pierde para el turno siguiente, coherente con "una
  mirada por turno".

**Nota menor, no un bug — resuelta 2026-07-21**: `window.cronomanteOnComplete`
(el callback guardado para poder completar tras un cancel) no se reseteaba
explícitamente en ninguno de esos 3 sitios — era inofensivo porque solo se
lee dentro de la rama `if (window.cronomantePortalInvestigado)`, y esa
variable sí se resetea siempre correctamente, así que la referencia
obsoleta nunca llegaba a ejecutarse. Cerrado de todos modos como limpieza
de higiene de estado — ver `docs/DEUDA_TECNICA.md` ítem 13 (movido a
"Resueltos").

### 3.5 Metamorfo transformado + movido por Cronista/Aprendiz/Estratega/Cronomante (verificado, sin hueco de código — sí una ambigüedad de reglamento nueva)

El nombre transformado (`stack.at(-1).name = v`) es simplemente el campo
`.name` del objeto-carta, mutado in-place. Como no existe ningún campo
paralelo tipo `.nombreOriginal` en ningún sitio del código, **no hay nada
que pueda desincronizarse**: allá donde vaya ese objeto (a una mano vía
Cronista, entre dos manos vía Aprendiz, entre dos Portales vía Estratega,
reordenado dentro de una misma pila vía Cronomante), su `.name` sigue
siendo el que tenía tras la transformación, y es literalmente el único
campo que el resto del código consulta para tratar la carta como uno u
otro personaje (imagen, pertenencia a una invocación, activabilidad de
habilidad). Verificado leyendo los 4 `case` relevantes — ninguno copia o
pierde `.name` de forma distinta a como trataría una carta normal.

**Ambigüedad nueva del reglamento, no un bug de código**: el texto dice
que la transformación se mantiene "hasta que el Metamorfo sea tapado por
otra carta, o vuelva a transformarse" — no dice qué pasa si la carta
transformada **sale del sistema de Portales por completo** (por ejemplo,
Cronista se la lleva a una mano). El código actual simplemente la deja
transformada para siempre en ese caso (no hay ningún trigger de
reversión), lo cual es una lectura razonable pero no la única posible.
Se recomienda decidir con el diseñador si esto debe anotarse como nota de
interpretación en `REGLAMENTO.md` (mismo patrón que las notas ya
existentes al principio del documento) — no se ha tocado el reglamento en
esta tarea de auditoría, queda como recomendación.

**Actualización 2026-07-21**: el mismo `stack.at(-1).name = v` de raíz de
esta sección resultó tener un problema más amplio y ya confirmado (no una
ambigüedad abierta): al no separar identidad real de apariencia, un
Metamorfo transformado también se colaba como el personaje real en
comprobaciones de protección de Centinela, en la restricción propia de
Ocultista, y en el bonus pasivo del Maestro. Ver la nota de interpretación
en `docs/reglamento/REGLAMENTO.md` ("Metamorfo") y el ítem 14 de
`docs/DEUDA_TECNICA.md` (ahora en "Resueltos") para el detalle completo.

**Actualización 2026-07-21 (2) — resuelto**: `case 'Metamorfo'`
(`js/abilities.js`) ya no sobrescribe `.name`; escribe `.aspecto` en su
lugar. `.name` sigue siendo `'Metamorfo'` siempre (identidad real, usada
por protección de Centinela, restricción de Ocultista, bonus pasivos);
`.aspecto` cuenta para completar la invocación, repartir sus Gemas y para
lo que se muestra en pantalla. La ambigüedad de esta sección (qué pasa si
la carta transformada sale del sistema de Portales, p. ej. vía Cronista) se
resolvió en el sentido más conservador: `.aspecto` se propaga junto con
`.name` en cualquier sitio donde el código reconstruye el objeto-carta
(`case 'Cronista'`, `jugarCartaSeleccionadaEn()` en `js/actions.js`), así
que la transformación sigue sin revertirse nunca automáticamente — mismo
comportamiento de fondo que antes, solo que ahora modelado con el campo
correcto.

### 3.6 Clarividente (mano oculta al resto) + intercambio de Aprendiz (verificado, sin hueco)

**Actualización 2026-07-21**: el bug (a) descrito en `MEJORAS_FUTURAS.md`
("Clarividente: dos bugs reales confirmados tras probar la partida") está
resuelto. `hasClariActivo` es una propiedad del objeto **jugadora** (no de
las cartas ni de la mano), recalculada en cada `render()` a partir de sus
Portales (`actualizarClarividente()`, `utils.js`) — nunca a partir del
contenido de la mano. La transición `true → false` se detecta para
CUALQUIER jugadora en CUALQUIER `render()` (comparando contra
`player._clariVisiblePrev`, no solo en el turno de su dueña) y dispara de
inmediato `resolverEleccionClarividente()` (`render.js`): picker con
etiquetas neutras para una jugadora humana, heurística mínima para una
autómata. Ya no existe ningún "periodo de gracia" — `haTenidoClarividente`
se ha eliminado por completo del código.

Como Aprendiz intercambia únicamente los arrays de mano (`players[v1].hand`
↔ `players[v2].hand`) sin tocar Portales, el efecto de ocultación sigue
correctamente ligado a **quien tiene la Clarividente visible**, no a qué
cartas concretas tenga en la mano en cada momento — así que tras un
intercambio de Aprendiz, la jugadora que sigue teniendo su Clarividente
visible sigue viendo oculta su mano actual (aunque ahora sean físicamente
las cartas que antes eran de la otra jugadora) para el resto, exactamente
como pide la regla ("mientras esta jugadora tenga la Clarividente
visible...").

El bug (b) (pérdida de visibilidad de AMBAS cartas al robar, reportado tras
jugar una partida) sigue sin reproducirse ni confirmarse — ver
`MEJORAS_FUTURAS.md`, no se ha tocado nada relacionado con el robo de
cartas en esta ronda de cambios.

### 3.7 Hallazgo adicional — Estratega puede reubicar la protección de una Centinela a otra jugadora (verificado como correcto, no un bug)

Estratega intercambia el **contenido completo** de dos Portales
(`s1.splice(0, s1.length, ...s2)` y viceversa) — no solo la carta
superior. Si uno de los dos Portales tiene una Centinela visible, tras el
intercambio esa Centinela pasa a proteger a la propietaria del OTRO
Portal (la protección se calcula por dueña del Portal, no por identidad
de la carta). Confirmado que esto coincide exactamente con el texto del
reglamento ("intercambia su posición en la mesa **junto con las pilas de
todas las cartas jugadas sobre ellos**") — no es un hueco, es una mecánica
legítima (Estratega puede robar o ceder la protección de una Centinela) y
el código la implementa correctamente con el intercambio completo de
pilas, no solo de la carta superior.

---

## 4. Final de partida

`finalizarPartida(motivo)` (`js/game.js`) hoy:

1. Pregunta `confirm("...¿Quieres jugar otra vez?")`.
2. Si sí → `resetJuego()` (vuelve a la pantalla de configuración).
3. Si no → sustituye `document.body.innerHTML` por un mensaje de
   despedida genérico y un botón "Volver a empezar" (`location.reload()`).

**No existe ninguna otra lógica de final de partida.** Específicamente,
falta TODO lo siguiente del reglamento ("Final de la partida"):

- No se muestra el recuento de Gemas de cada jugadora (bocarriba, como
  pide el reglamento) — ni siquiera el total, que hoy solo la propia
  jugadora activa puede ver durante la partida (`sumaGemas()`/
  `desgloseGemasPropio()` en `render.js`, deliberadamente ocultado a las
  demás mientras la partida está en curso).
- No se calcula ni se anuncia quién gana.
- No existe ninguna lógica de desempate: (1) nº de invocaciones distintas
  en las que se ha participado, (2) Gema de mayor valor de la última
  invocación, (3) repetir con invocaciones anteriores, (4) empate
  compartido si persiste. Nada de esto está ni siquiera parcialmente
  esbozado en el código.
- La variante 2vs2 (sección 1.4) depende directamente de que exista este
  marcador, para sumar por equipo en vez de por jugadora.

- **Tamaño estimado**: **M** — el cálculo en sí (sumar `sumaGemas()` por
  jugadora, ordenar, aplicar los 3 niveles de desempate) es sencillo con
  los datos que ya existen (`player.gems` ya registra `nivel` y `valor`
  de cada Gema, así que "nº de invocaciones distintas" y "Gema de mayor
  valor de la última invocación" son derivables sin cambiar el modelo de
  datos), pero sustituir el `alert()`/`confirm()` actual por una pantalla
  de resultados real es una pieza de UI nueva no trivial.

---

## 5. Reparto de Portales / roster del mazo

**Cerrado.** Verificado contra el código real de esta versión:

- `js/setup.js` reparte Portales exactamente según la tabla del
  reglamento para 2–5 jugadoras (2→2+1, 3→1+2, 4→1+1, 5→1+0) — corregido
  en una ronda anterior (`1.5.2.31`), sin regresiones detectadas en esta
  auditoría.
- El mazo de "Modo normal"/`floral` (32 cartas, cantidades exactas del
  reglamento) está correcto y verificado programáticamente en su momento
  (`1.4.1.27`) para que las 9 invocaciones de los 3 sets sean
  completables.
- El único pendiente relacionado con "roster" es el de la sección 1.1
  (Introductorio como variante de mazo propia) — no es una regresión de
  lo ya cerrado, es alcance todavía no construido.

No queda ningún ítem abierto en este bloque más allá de lo ya recogido en
la sección 1.

---

## 6. Tabla resumen

| Personaje / modo / mecánica | Estado | Prioridad sugerida |
|---|---|---|
| Reparto de Portales por nº de jugadoras (2–5) | ✅ Implementado | — |
| Mazo "Modo normal" / `floral` (32 cartas) | ✅ Implementado | — |
| Fase A/B independientes, economía de Gemas | ✅ Implementado | — |
| Protección de Centinela (Ocultista/Cronista/Cronomante/Estratega/Aprendiz) | ✅ Implementado | — |
| Auto-giro al aparecer una 2ª Centinela (Fase A) | ✅ Implementado | — |
| Ocultista puede revelar una Centinela oculta sin re-disparar el auto-giro (bug, sección 3.1) | ✅ Corregido | — |
| Metamorfo: transformación libre y persistente | ✅ Implementado | — |
| Metamorfo: apariencia separada de identidad real (protección/restricción/bonus no siguen al disfraz) | ✅ Corregido | — |
| Metamorfo: disfraz visual con ficha superpuesta semitransparente (solo cosmético, ver [`MEJORAS_FUTURAS.md`](MEJORAS_FUTURAS.md)) | ❌ Pendiente | Baja |
| Clarividente: mano completa oculta al resto | ✅ Implementado (decisión de mesa) | — |
| Clarividente: corte inmediato + elección activa al perder visibilidad (bug a) | ✅ Corregido (2026-07-21) | — |
| Clarividente: pérdida de ambas cartas al robar (bug b, sin reproducir) | ❓ Sin confirmar | — |
| Cronomante: reintento tras cancelar, mismo Portal | ✅ Implementado | — |
| Maestro: bonus pasivo (3 Gemas) | ✅ Implementado | — |
| Maestro: habilidad activa (mover carta de mano ajena a un Portal de la propia jugadora afectada) | ✅ Implementado (2026-07-21) | — |
| Entusiasta: en el mazo + habilidad pasiva | ❌ Pendiente | Media |
| Introductorio: variante completa de preparación de mazo | ❌ Pendiente | Media |
| Modo Avanzado | ❌ Pendiente | Media |
| Modo Experto (autómata + invocación Asterisco) | ❌ Pendiente | Baja (mayor esfuerzo, menor demanda probable) |
| Variante 2 contra 2 | ❌ Pendiente (bloqueada por marcador final) | Media |
| Marcador final y desempate | ❌ Pendiente | **Alta** (bloquea 2vs2 y cierra el objetivo del juego: "ver quién gana") |
| Jugar carta: 3 métodos coexistentes (clic/drag&drop/panel) | ✅ Implementado | — |
| Grid único interactivo con visibilidad real | ✅ Implementado | — |
| Bloqueo de objetivo de habilidad en el grid | ✅ Implementado | — |

---

## 7. Reauditoría 2026-07-21 — el autómata (`js/bot.js`) frente a las mecánicas conflictivas de la sección 3

Motivo: la sección 3 se escribió pensando solo en jugadoras humanas, antes
de que existiera `js/bot.js`. Esta sección revisa, mecánica a mecánica, si
la incorporación del autómata (y de las correcciones posteriores: escape
de nombres, `todosLosPortales()`, el cobro real de Gemas de Portal central
del ítem 16) abre algún hueco nuevo.

### 7.1 Centinela + autómata (verificado, sin hueco)

El autómata solo activa habilidades vía `activarHabilidadFaseB()` →
`applyAbility()`, exactamente la misma función que usa un clic humano, y
solo elige el PORTAL ORIGEN (dónde está la carta cuya habilidad se activa)
a través de `opcionesActivarHabilidad()` (`utils.js`) — la misma fuente que
alimenta el picker humano de "¿Qué habilidad quieres activar?". La
protección de Centinela no se comprueba ahí porque no hace falta: un
Portal de OTRA jugadora nunca es una fuente de activación válida (solo los
propios, gratis, o un central, pagando) — eso ya era así antes del bot.
Cuando la habilidad en sí elige un Portal OBJETIVO (Ocultista/Cronista, las
únicas que la heurística `'normal'` activa — ver `CLAUDE.md`), esa elección
pasa por el mismo `portalesConEstado(..., estaProtegidoParaActivar(...))`
que ya usa el picker humano; `resolverPickersAbiertos()` (`bot.js`) solo
filtra entre las opciones YA no deshabilitadas del `<select>` real
(`o.disabled` respetado por `elegirOpcionPicker()`), nunca por su cuenta.
**Conclusión: la protección de Centinela se aplica al bot exactamente
igual que a una jugadora humana, sin ninguna vía de bypass.**

### 7.2 Cronomante + autómata (verificado, no aplicable en este MVP)

La heurística `'normal'` filtra explícitamente `c.name === 'Ocultista' ||
c.name === 'Cronista'` en `decidirHabilidadFaseB()` — Cronomante nunca se
activa por un autómata en ese nivel (decisión de alcance ya documentada en
`CLAUDE.md` y en el propio `bot.js`). Por tanto
`window.cronomantePortalInvestigado`/`window.cronomanteOnComplete` nunca se
fijan desde una jugada de autómata; el único punto de entrada real sigue
siendo `#btnAbility.onclick` (`actions.js`), accionado solo por clic
humano. Sin hueco porque no hay código alcanzable que lo cree.

**Actualización 2026-07-21 (Bloque 3, motor probabilístico)**: ya existe
una segunda dificultad, `'dificil'` (`js/bot.js`/`js/bot-probabilidad.js`),
pero también deja Cronomante fuera a propósito — solo amplía Fase B con
Maestro además de Ocultista/Cronista (ver `CHANGELOG.md`). Esta sección
sigue sin hueco: Cronomante sigue sin ningún camino alcanzable desde
ninguna dificultad de autómata existente. Cronomante/Estratega/Aprendiz/
Metamorfo quedan como trabajo futuro si se añade una dificultad más
agresiva todavía.

### 7.3 Metamorfo persistente + autómata (verificado, sin hueco)

Mismo razonamiento que 7.2: ninguna dificultad de autómata existente activa
Metamorfo, así que un autómata nunca transforma una carta. Lo que SÍ puede
pasarle a un autómata es HEREDAR una carta ya transformada por una
jugadora humana anterior (vía Cronista a su propia mano, o simplemente
viendo/jugando sobre un Portal donde ya hay un Metamorfo disfrazado). Se
verificó que ningún camino del bot lee `.name` donde debería leer
`.aspecto` o viceversa:
`estadoPortalVisible()` (la vista saneada) expone `top.aspecto || top.name`
— la APARIENCIA, igual que vería una jugadora humana mirando el tablero,
nunca la identidad real de un Metamorfo disfrazado. `objetivosHabilidadDisponibles()`
(la lista de fuentes de habilidad) usa `stack.at(-1).name` — la IDENTIDAD
real, consistente con `opcionesActivarHabilidad()` (que decide qué
habilidad se dispara de verdad, no qué parece la carta). Ambos coinciden
exactamente con el criterio ya establecido para humanas en la corrección
del ítem 14 de `DEUDA_TECNICA.md`. **Conclusión: el autómata nunca podría
"destransformar" ni "recolorear" un Metamorfo ajeno por error — ni falta
que hace, porque tampoco activa su habilidad.**

### 7.4 Clarividente + autómata (verificado, sin hueco de bot; comportamiento pre-existente sin relación con bots anotado por completitud)

`gestionarTransicionesClarividente()` (`render.js`) es agnóstica de
`player.tipo` — recalcula `hasClariActivo` para cualquier jugadora en
cualquier `render()`, y `resolverEleccionClarividente()` sí discrimina por
`player.tipo === 'auto'` para no abrir un `picker()` de UI real (usaría una
heurística mínima: queda con la carta que sea el personaje requerido por la
invocación activa si aplica, si no al azar) — evitando así que el turno de
un autómata se quede bloqueado esperando un clic que nunca llega. Se
revisó el único caso límite real: si DOS jugadoras (de cualquier
combinación humana/autómata) pierden visibilidad de Clarividente en la
misma llamada a `render()`, `pickerEnCurso` se calcula UNA vez al principio
del `forEach`, así que abrir el picker real de la primera jugadora (si es
humana) no impide que la segunda (aunque también sea humana) se resuelva
en la misma pasada, sin esperar a que se cierre el primer picker — dos
pickers de Clarividente podrían, en teoría, competir por el mismo `#picker`
del DOM. **Esto no es un hueco introducido por el bot** (una autómata
nunca abre ese `picker()` real, así que no puede ser una de las dos partes
en conflicto) — es un caso general preexistente entre dos jugadoras
HUMANAS que ya existía antes de que se escribiera `js/bot.js`, no detectado
en la sección 3.6 original. Se anota aquí por completitud (surgió al
revisar Clarividente para esta ronda) pero se deja fuera del alcance de
esta auditoría de bot: no se ha confirmado que sea alcanzable en la práctica
(la disciplina de "solo la jugadora activa juega carta o activa
habilidad en su turno" reduce mucho la ventana), y arreglarlo bien exigiría
encolar en vez de solo comprobar `pickerEnCurso` una vez. Se deja documentado
como candidato a `docs/DEUDA_TECNICA.md` si se decide investigar, no se
añade todavía como ítem porque no se ha podido confirmar una secuencia de
juego real que lo dispare (los picker de Clarividente solo se disparan al
CUBRIR o MOVER una Clarividente visible, algo que en la práctica ocurre una
vez por jugada, no simultáneamente para dos jugadoras distintas en el
99% de las partidas reales).

### 7.5 Conclusión general de la sección 7

No se ha encontrado ningún bug real nuevo causado por la interacción entre
`js/bot.js` y las mecánicas de Centinela/Cronomante/Metamorfo/Clarividente.
El diseño de "vista saneada + reutilizar exactamente las mismas funciones
que un clic humano" (documentado en `CLAUDE.md`) resulta, tras esta
revisión, tan robusto en la práctica como se pretendía en el diseño
original: no hay ningún atajo del bot que se salte una comprobación de
protección o de identidad real vs. apariencia.

---

## Notas de proceso

- No se ha modificado ninguna lógica de juego en esta tarea, salvo la
  creación de este documento. El bug de la sección 3.1 se deja
  documentado, no corregido — a la espera de decidir si se aborda como
  tarea propia en una ronda futura.
- Se han añadido referencias cruzadas a este informe en
  `docs/DEUDA_TECNICA.md` (bug 3.1 y nota menor 3.4) y en
  `docs/MEJORAS_FUTURAS.md` (tamaños S/M/L de la sección 1 y 2, y el
  marcador final de la sección 4) — el detalle largo vive aquí, esos
  documentos solo enlazan la conclusión.
- **Reauditoría 2026-07-21 (2)**: releído el informe completo contra el
  código real posterior al autómata (`js/bot.js`) y a toda la ronda de
  deuda técnica del mismo día. Tampoco en esta pasada se ha modificado
  ninguna lógica de juego — es de nuevo un informe, no una tarea de
  código. Ver sección 7 (nueva) para el detalle de bot vs. Centinela/
  Cronomante/Metamorfo/Clarividente; ningún ítem de las secciones 1-6
  cambió de estado. El único hallazgo nuevo (7.4, un posible solape de dos
  `picker()` de Clarividente simultáneos entre dos jugadoras HUMANAS, sin
  relación con bots) se deja anotado ahí mismo, sin promover a
  `docs/DEUDA_TECNICA.md` por falta de una secuencia de juego real
  confirmada que lo dispare.

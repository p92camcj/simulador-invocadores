# Auditoría de reglas — reglamento vs. código real

> **Última actualización:** 2026-07-21 01:39 (Europe/Madrid)
>
> Informe de auditoría, no una tarea de código. Cruza
> [`docs/reglamento/REGLAMENTO.md`](reglamento/REGLAMENTO.md) contra el
> estado real de `js/*.js` en la versión `1.12.0.47` (tras las tareas C y D
> de esta misma ronda: el grid único interactivo y la restauración del
> panel de jugar carta). No sustituye a `docs/MEJORAS_FUTURAS.md` ni a
> `docs/DEUDA_TECNICA.md` — los complementa; el detalle largo de cada
> hallazgo vive aquí, esos otros documentos solo se actualizan con la
> conclusión accionable (ver el final de cada sección).

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

### 2.2 Maestro: habilidad activa

El bonus pasivo (3 Gemas si Maestro es requisito y no hay Pícaro visible
en la mesa) ya está corregido desde una ronda anterior. Falta por
completo la habilidad activa: elegir una carta visible-para-otros de la
mano de otra jugadora y bajarla directamente a un Portal propio; la
jugadora afectada repone mano robando del mazo. A diferencia de
Ocultista/Cronista/Cronomante/Estratega, esta habilidad no elige un
Portal como objetivo sino una **carta de una mano ajena** — mismo tipo de
selección que Aprendiz (juega sobre jugadoras/manos, no sobre Portales),
así que no encaja de forma natural con el mecanismo de clic-en-grid de
`pickerPortal()` (Tarea D de esta ronda) — se quedaría con un `picker()`
normal, igual que Aprendiz y Metamorfo.

- **Archivos**: `js/abilities.js` (nuevo `case 'Maestro'`), `js/utils.js`
  (añadir `'Maestro'` a `PERSONAJES_CON_HABILIDAD`).
- **Tamaño estimado**: **S** — patrón ya establecido (similar en forma a
  Cronista, que también mueve una carta entre mano y Portal), sin
  necesidad de UI nueva.

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

**Nota menor, no un bug**: `window.cronomanteOnComplete` (el callback
guardado para poder completar tras un cancel) no se resetea explícitamente
en ninguno de esos 3 sitios — pero es inofensivo porque solo se lee dentro
de la rama `if (window.cronomantePortalInvestigado)`, y esa variable sí se
resetea siempre correctamente, así que la referencia obsoleta nunca llega
a ejecutarse. Añadido como ítem de limpieza menor en
`docs/DEUDA_TECNICA.md`.

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

`hasClariActivo`/`haTenidoClarividente` son propiedades del objeto
**jugadora** (no de las cartas ni de la mano), recalculadas en cada
`render()` a partir de sus Portales (`actualizarClarividente()`,
`utils.js`) — nunca a partir del contenido de la mano. Como Aprendiz
intercambia únicamente los arrays de mano (`players[v1].hand` ↔
`players[v2].hand`) sin tocar Portales, el efecto de ocultación sigue
correctamente ligado a **quien tiene la Clarividente visible**, no a
qué cartas concretas tenga en la mano en cada momento — así que tras un
intercambio de Aprendiz, la jugadora que sigue teniendo su Clarividente
visible sigue viendo oculta su mano actual (aunque ahora sean físicamente
las cartas que antes eran de la otra jugadora) para el resto, exactamente
como pide la regla ("mientras esta jugadora tenga la Clarividente
visible..."). Verificado también que el "periodo de gracia"
(`haTenidoClarividente`) sigue el mismo patrón (ligado a la jugadora, no
a las cartas), así que tampoco se pierde ni se transfiere por error en un
intercambio.

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
| **Clarividente: corte inmediato + elección activa al perder visibilidad (dos bugs confirmados, ver [`MEJORAS_FUTURAS.md`](MEJORAS_FUTURAS.md), "Clarividente: dos bugs reales confirmados tras probar la partida")** | 🔴 Bug | **Media** |
| Cronomante: reintento tras cancelar, mismo Portal | ✅ Implementado | — |
| Maestro: bonus pasivo (3 Gemas) | ✅ Implementado | — |
| Maestro: habilidad activa (mover carta de mano ajena) | ❌ Pendiente | Media |
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

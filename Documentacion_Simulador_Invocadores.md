# Documentación del Simulador «Invocadores»

Este documento sirve como **guía de referencia** para el código modularizado del simulador de juego de mesa **«Invocadores»**. Aquí encontrarás:

- Un **resumen** de cada archivo (módulo) con su propósito y responsabilidades.
- Un **listado** de las **exportaciones** (funciones y constantes) de cada módulo.
- Una **descripción detallada** de cada función/constante.
- **Hipervínculos internos** para navegar rápidamente entre módulos.

---

## Índice de contenidos

- [js/utils.js](#jsutilsjs)
- [js/abilities.js](#jsabilitiesjs)
- [js/bot.js](#jsbotjs)
- [js/bot-probabilidad.js](#jsbot-probabilidadjs)
- [js/setup.js](#jssetupjs)
- [js/render.js](#jsrenderjs)
- [js/actions.js](#jsactionsjs)
- [js/game.js](#jsgamejs)
- [js/index.js](#jsindexjs)

---

## js/utils.js
**Propósito:** Contiene constantes globales, iconos y funciones auxiliares puras que otros módulos utilizan.

### Exportaciones

| Nombre            | Tipo      | Descripción                                                                 |
|-------------------|-----------|-----------------------------------------------------------------------------|
| `LEVELS`          | `const`   | Niveles de invocación: `['C','B','A']`.                                      |
| `INVOCATION_SETS` | `const`   | Mapea `introductorio\|normal\|floral` → nivel → `{ nombre, need, gemas }`. Sustituye al antiguo `COMBOS` genérico. |
| `INVOCATION_ASTERISCO` | `const` | 4ª invocación de Modo Experto (`Madain`), definida pero **no conectada** a ningún flujo real todavía. |
| `PERSONAJES_CON_HABILIDAD` | `const` | Personajes activables en Fase B (`Ocultista`, `Cronista`, `Cronomante`, `Estratega`, `Aprendiz`, `Metamorfo`, `Maestro`). Única fuente para `opcionesActivarHabilidad()`. |
| `PERSONAJES_NO_ANIMALES` | `const` | Roster de los 10 personajes no-animales del mazo base "Modo normal". Usado por `game.js` para construir `charsBase` y por `abilities.js` (`case 'Metamorfo'`) para las opciones de transformación, sin depender de si esa carta sigue en el mazo o fue apartada al preparar la partida. |
| `CANTIDADES_MODO_NORMAL` | `const` | Cantidades reales de "Modo normal" por personaje no-animal (32 cartas en total). Única fuente — antes vivía como literal duplicado dentro de `initGame()` (`game.js`). |
| `CANTIDADES_ANIMALES` | `const` | Cantidades de los 3 Animales (Reena/Sora/Lumo: 3 cada uno), solo presentes en el mazo si el set de invocación es `introductorio`. |
| `composicionMazoTotal(invocationSet)` | `función` | Devuelve `{ nombrePersonaje: cantidad }` de la composición TOTAL del mazo configurado (dato público de las reglas) — `CANTIDADES_MODO_NORMAL` más `CANTIDADES_ANIMALES` si `invocationSet === 'introductorio'`. Usada por `game.js` (`initGame()`) para construir el mazo real y por `js/bot-probabilidad.js` (conteo de cartas del autómata en dificultad `'dificil'`). |
| `iconos`          | `const`   | Mapa nombre→emoji para representar cartas (incluye Reena/Sora/Lumo). Se usa en `selCard`/`picker()` (texto) y en el estado de invocación; ya no en mano/Portales, que usan `cardImages`. |
| `mostrarCarta(card)` | `función` | Devuelve la cadena `"<icono> <nombre>"` para mostrar en la UI (selects/pickers y estado de invocación), usando `card.aspecto \|\| card.name` — la apariencia (disfraz del Metamorfo transformado), no la identidad real. |
| `cardImages`      | `const`   | Mapa nombre de personaje → ruta de imagen real (`assets/cards/*.png`), 14 personajes con habilidad + Reena/Sora/Lumo. El Metamorfo siempre usa `metamorfo.png` tal cual (no hay disfraz visual todavía, ver TODO en el propio archivo). |
| `CARTA_OCULTA_IMG`| `const`   | Ruta del reverso genérico (`assets/cards/carta-oculta-reverso.png`) usado por `render.js` para cualquier carta oculta para quien mira, sin filtrar el nombre real en el `alt`. |
| `$`               | `función` | Atajo para `document.querySelector(selector)`.                               |
| `escapeHtml(str)` | `función` | Escapa `&`/`<`/`>` de texto de origen no confiable (p. ej. nombres de jugadora) antes de interpolarlo en una plantilla de string asignada vía `innerHTML`. Usada por `render.js` para `p.name` en `renderBoardGrid()`. |
| `shuffle(array)`  | `función` | Mezcla un array _in place_ (algoritmo Fisher–Yates).                        |
| `draw(player, visible)` | `función` | Robo de carta del mazo global (`window.deck`) a la mano de un jugador.      |
| `reponerManoSiFalta(player)` | `función` | Repone la mano de `player` a las 2 cartas habituales (una visible para su dueña, una oculta) robando lo que falte con `draw()` — misma lógica que ya usaba `#btnEndTurn.onclick` (`actions.js`), centralizada aquí porque la habilidad activa del Maestro (`abilities.js`, `bajarCartaMaestro()`) la necesita también. |
| `listPortals(players, neutrals)` | `función` | Devuelve array de `{val, lbl}` para poblar selectores de portales (propios, ajenos, neutrales). |
| `todosLosPortales(players, neutrals)` | `función` | Devuelve array plano de `{stack, playerIdx, portalIdx}` (todos los Portales de jugadoras + neutrales; `playerIdx` es `null` para un Portal neutral). Centraliza el patrón `players.forEach(p => p.portals.forEach(...))` + `neutrals.forEach(...)`, usado en `actions.js` (comprobación de invocación, bonus de Pícaro/Maestro) y `abilities.js` (`ocultarOtrasCentinelas()`). |
| `stackFrom(key, players, neutrals)` | `función` | Dada clave `"i:j"` o `"n:k"`, devuelve la pila de cartas (portal) correspondiente. |
| `portalesConEstado(players, neutrals, esInvalido)` | `función` | Como `listPortals()` pero añade `disabled` según `esInvalido(stack, val)` — usado por `picker()` para bloquear opciones. |
| `jugadoraProtegidaPorCentinela(player)` | `función` | `true` si esa jugadora tiene una Centinela visible en cualquiera de sus Portales — la protección cubre TODOS sus Portales, no solo el que la contiene. |
| `estaProtegidoParaActivar(stackKey, stack, players, actingPlayerIdx)` | `función` | `true` si ese Portal es un objetivo inválido para que `actingPlayerIdx` dirija una habilidad contra él: protegido por Centinela, salvo que `actingPlayerIdx` sea la propia dueña del Portal (la Centinela protege de las demás, no de una misma). Usado por Ocultista, Cronista, Cronomante y Estratega en `abilities.js`. |
| `opcionesActivarHabilidad(playerIdx, players, neutrals)` | `función` | Fase B: opciones activables para `players[playerIdx]` — sus propios portales (`own:<idx>`, gratis) y los centrales/neutrales (`central:<idx>`, con coste). Una opción central solo se ofrece si `sumaGemas(player.gems)` cubre el coste real (1, o 2 si el personaje es el propio Metamorfo, cuya transformación tiene un coste propio independiente) — evita ofrecer una activación que luego no se podría pagar. La etiqueta usa la identidad real (`top.name`), no `mostrarCarta()`/apariencia — a propósito: un Metamorfo transformado solo puede volver a transformarse, nunca usar la habilidad del personaje imitado. |
| `sumaGemas(gems)` | `función` | Suma los `valor` de un array de Gemas — solo se muestra a la propia dueña en `render()` (secreto de Gemas). |
| `contarGemasPorNivel(gems)` | `función` | Devuelve `{nivel: cantidad}` sin revelar valores reales — usado por `js/bot.js` (`construirEstadoVisibleParaBot()`) para el recuento de Gemas por nivel de cualquier jugadora en la vista saneada del bot. `render.js` ya no lo usa: desde la Tarea 5 (círculos de color) agrupa por nivel con su propia lógica en `gemDotsHtml()`, que también necesita sumar valores reales para la jugadora activa. |
| `tieneGemaAsterisco(player)` | `función` | `true` si el jugador tiene alguna Gema con `esAsterisco: true`. |
| `gastarGemaAsterisco(player)` | `función` | Revela y descarta la Gema de asterisco del jugador; `false` si no tenía ninguna. |
| `gastarGemaUnitaria(player)` | `función` | Gasta 1 Gema de valor 1; si no tiene ninguna suelta, cambia su Gema de menor valor por Gemas unitarias. `false` solo si no tiene ninguna Gema. |
| `pagarActivacionPortalCentral(player)` | `función` | Cobra el coste de activar la habilidad de un Portal central: gratis con Gema de asterisco, o 1 Gema unitaria. `false` si no pudo pagar. |
| `construirPoolGemas(valores)` | `función` | Construye y mezcla el pool de 5 Gemas de una invocación, marcando la de menor valor como `esAsterisco`. |
| `calcularResultadoFinal(players, invocacionesCompletadas)` | `función` | Clasificación final de la partida (REGLAMENTO.md, "Final de la partida"): ordena a las jugadoras por mayor `sumaGemas()`, desempatando con (1) nº de invocaciones DISTINTAS en las que participó (niveles de `LEVELS` presentes en `player.gems`, sin contar Gemas `nivel: 'unitaria'`), (2) Gema de mayor valor en la ÚLTIMA invocación de `invocacionesCompletadas` (orden real en que se completaron en esa partida, no siempre C→B→A), (3) repetir con la anterior, y así hacia atrás; empate compartido si persiste. Función pura (usada por `js/game.js`, `finalizarPartida()`), devuelve `{ stats, ganadores, motivoDesempate }`. |
| `generarVis(destino, opciones)` | `función` | Genera el objeto de visibilidad de una carta según su origen y destino. |
| `actualizarClarividente(players)` | `función` | Actualiza `hasClariActivo` de cada jugador (solo el flag, nunca muta `carta.vis`) — sin periodo de gracia, ver `render.js` (`gestionarTransicionesClarividente`) para la reacción inmediata a la transición true→false. |

**Modelo de datos de Gemas**: `player.gems` es un array de
`{ valor: number, nivel: 'C'|'B'|'A'|'experto'|'unitaria', esAsterisco?: boolean }`,
no un número plano. Usar siempre los helpers de arriba para leerlo/gastarlo
en vez de asumir su forma directamente.

**Modelo de datos de cartas**: una carta es `{ name: string, vis, aspecto?:
string }`. `.name` es la identidad REAL, nunca se sobrescribe (para un
Metamorfo transformado sigue siendo siempre `'Metamorfo'`) — la usan
protección de Centinela, restricción de Ocultista, auto-giro de Centinela,
Clarividente y los bonus pasivos de Pícaro/Maestro. `.aspecto` solo existe
en una carta transformada por Metamorfo (`abilities.js`, `case
'Metamorfo'`) y es la APARIENCIA — la usan el cumplimiento de la
combinación de la invocación y el reparto de sus Gemas (`actions.js`), y
todo lo que se muestra en pantalla (`mostrarCarta()`, `cartaImgHtml()` en
`render.js`), siempre como `card.aspecto || card.name`. Se propaga
explícitamente en los pocos sitios donde una carta se reconstruye como
objeto nuevo (`case 'Cronista'` en `abilities.js`,
`jugarCartaSeleccionadaEn()` en `actions.js`) para no perderse si una carta
transformada vuelve a una mano y se rejuega.

---

## js/abilities.js
**Propósito:** Implementa la lógica de las habilidades especiales de los personajes, aislando el `switch` de cada caso.

### Exportaciones

| Nombre             | Tipo      | Descripción                                                                                                                   |
|--------------------|-----------|-------------------------------------------------------------------------------------------------------------------------------|
| `applyAbility(name, ownerIdx, stack, players, neutrals, levelIdx, need = [])` | `función` | Aplica la habilidad de `name` al portal `stack` propiedad de `players[ownerIdx]`, con acceso a `players`, `neutrals` y `levelIdx`. `need` es el array de personajes requeridos por la invocación activa — pásalo explícitamente desde quien llame, no lo recalcules dentro del módulo. Actualmente ningún `case` lo usa (Metamorfo dejó de necesitarlo tras la revisión de reglamento de 2026-07-19); se mantiene en la firma para el futuro Modo Experto/invocación Asterisco. Incluye casos solo para las habilidades activables en Fase B (`PERSONAJES_CON_HABILIDAD`): **Ocultista** (tras alternar visibilidad, si la carta revelada es una Centinela real —`.name`, no apariencia— re-dispara `ocultarOtrasCentinelas()`, ver DEUDA_TECNICA.md ítem 12), Cronista (propaga `.aspecto` si la carta que se lleva a la mano era un Metamorfo transformado), Cronomante, Estratega, Aprendiz, **Maestro** (elige jugadora objetivo y, si tiene más de un Portal propio, también el Portal — delega la lógica pura en `candidatosObjetivoMaestro()`/`bajarCartaMaestro()`, ver abajo) y **Metamorfo** (transformación libre en cualquier personaje de `PERSONAJES_NO_ANIMALES` menos el propio Metamorfo, persistente hasta que la carta se tape o se vuelva a transformar; escribe `stack.at(-1).aspecto`, NUNCA `.name` — ver "Modelo de datos de cartas" más abajo y DEUDA_TECNICA.md ítem 14). No hay `case 'Centinela'` ni `case 'Clarividente'`: ambas son pasivas/automáticas, ver `ocultarOtrasCentinelas` abajo y `actualizarClarividente` en `utils.js`. |
| `ocultarOtrasCentinelas(stackJugada, players, neutrals)` | `función` | Oculta (`vis.public = false`) cualquier otra Centinela visible en el top de cualquier Portal (de cualquier jugadora o central) distinto de `stackJugada`, según la regla "solo puede haber una Centinela visible en mesa". Llamada desde `actions.js` en Fase A, justo tras `stack.push(...)`, cuando la carta jugada es una Centinela, y desde `case 'Maestro'`/`bajarCartaMaestro()` cuando la carta movida resulta ser una Centinela — en ninguno de los dos casos es una habilidad de Fase B en sí misma. |
| `candidatosObjetivoMaestro(players, ownerIdx)` | `función` | Jugadoras candidatas como objetivo del Maestro: cualquiera que no sea `ownerIdx`, tenga una carta oculta-para-sí-visible-para-el-resto (`vis.others === true`) y no esté protegida por su propia Centinela visible (reutiliza `jugadorProtegidoComoObjetivo()`, antes `jugadorProtegidoContraAprendiz`, renombrada porque ahora la usan dos habilidades). Función pura, sin DOM — testable directamente en `tests/run-tests.mjs`. |
| `bajarCartaMaestro(players, neutrals, targetIdx, portalIdx)` | `función` | Efecto real de la habilidad del Maestro: mueve la carta oculta-para-el-resto de `players[targetIdx]` al `portalIdx` de sus PROPIOS Portales (nunca a un Portal del Maestro), re-dispara `ocultarOtrasCentinelas()` si la carta movida es una Centinela, y repone la mano de la jugadora objetivo con `reponerManoSiFalta()` (`utils.js`). Función pura, sin DOM — testable directamente. |

---

## js/bot.js
**Propósito:** Lógica de decisión de jugadoras autómatas ("bots"). Ninguna
función de decisión lee `players`/`neutrals`/`window.deck` directamente —
todas parten de la vista saneada de `construirEstadoVisibleParaBot()`, para
que quede auditable que el bot no puede hacer trampa aunque cambie la
heurística en el futuro. Las acciones en sí (jugar carta, activar
habilidad, terminar turno) reutilizan exactamente los mismos puntos de
entrada que usa una jugadora humana (`window.tryPlayOnPortal`,
`applyAbility()` de `abilities.js`, el propio botón `#btnEndTurn`) — no
duplica ninguna lógica de reglas.

### Exportaciones

| Nombre | Tipo | Descripción |
|--------|------|-------------|
| `nombresDisponiblesParaBots(cantidad)` | `función` | Devuelve `cantidad` nombres únicos (sin repetir dentro de la misma partida) de un pool temático de 10 nombres terminados en "bot" (`Arcanobot`, `Nigrobot`, ...), barajado con `shuffle()` (`utils.js`). |
| `construirEstadoVisibleParaBot(players, neutrals, botIdx)` | `función` | Vista saneada del estado para la bot `botIdx`: su propia carta "visible" conocida (nunca la oculta — ese campo directamente no existe en la vista), la carta "oculta" de cualquier OTRA jugadora (pública por reglamento), el estado de cada Portal (`null` vacío, `{hidden:true}` oculto, `{name}` visible — `name` ya resuelve `aspecto \|\| name`, la apariencia, igual que vería una jugadora humana), y recuentos de Gemas por nivel de cualquier jugadora (más el total exacto propio). No incluye nunca el mazo de robo. |
| `listaPortalesConDestino(vista)` | `función` | (exportada solo para tests) Lista de Portales como destinos jugables con una etiqueta EN TERCERA PERSONA ("su propio Portal N" / "el Portal N de X" / "el Portal Neutral N") — nunca en segunda persona ("tu Portal"), porque el resumen de turno del bot lo lee quien observa la partida, nunca la propia autómata (bug corregido, ver `CHANGELOG.md`). |
| `describirObjetivoHabilidad(name, valoresElegidos, vista)` | `función` | (exportada solo para tests) Traduce los valores REALMENTE elegidos en el/los `picker()` de una activación de habilidad (los que devuelve `resolverPickersAbiertos`, función interna) a una frase en tercera persona para el resumen de turno, identificando de quién es cada Portal/mano afectada. Cubre, por ahora, Ocultista/Cronista/Maestro — el resto de habilidades se documenta aquí a la vez que la Fase B del autómata les da uso real. |
| `candidatosCronomante(vista, memoriaBot)` / `decidirCronomanteNormal(vista, memoriaBot, need)` | `función` | (Bloque 4, exportadas solo para tests) `candidatosCronomante` lista los Portales donde la MEMORIA del bot (ahora compartida por ambas dificultades, ver más abajo) recuerda al menos una alternativa distinta de lo que se ve ahora en su cima — sin eso, Cronomante no tiene sentido "a ciegas". `decidirCronomanteNormal` (heurística `'normal'`): SOLO beneficio propio, solo con certeza (la memoria ya vio ese nombre en ese Portal PROPIO) — nunca el matiz adversarial (sustituir el requisito visible de una rival por algo inútil para ella), reservado a `'dificil'` (dentro de `decidirHabilidadFaseBDificil`, interna, vía el mismo `cubreNecesarioUnicoRival` que ya usa Fase A). |
| `decidirEstrategaNormal(vista, need)` / `decidirEstrategaDificil(vista, need, probabilidades, contexto)` | `función` | (Bloque 4, 4.2, exportadas solo para tests) Estratega intercambia Portales COMPLETOS (con su pila) — la propiedad del personaje visible resultante pasa a quien sea dueña de cada posición. `'normal'`: SOLO beneficio propio y con certeza — el primer par (Portal propio, cualquier otro Portal que muestre un requisito de `need` que el bot no tenga ya en un Portal PROPIO). `'dificil'`: evalúa pares candidatos (interna `candidatosEstrategaDificil` — todos los que involucran un Portal propio, más el par Portal-ajeno-vulnerable/Portal-central para denegación pura; no hace falta más poda con el nº de Portales típico del juego) por el valor esperado RESULTANTE de intercambiar sus contenidos (interna `valorPosicion`, que deliberadamente NO pasa `necesariosUnicosDeRivales` a `valorEsperadoDeAccion()` — el mecanismo de denegación por duplicado de esa función asume que el personaje se AÑADE en un sitio nuevo mientras sigue en el antiguo, falso en un intercambio donde se RELOCALIZA; solo aplica el mecanismo de "tapar", calculado aparte). |
| `decidirCronistaAdversarialNormal(vista, need)` | `función` | (Bloque 4, 4.3, exportada solo para tests) A diferencia de Ocultista, Cronista puede actuar sobre un Portal YA VISIBLE (se lleva su carta superior a la mano, no solo la oculta) — heurística `'normal'` ADICIONAL a la compartida con Ocultista: denegación GRATUITA, se lleva a la mano el único ejemplar visible en toda la mesa de un requisito de `need` que hoy tiene una RIVAL. El beneficio propio especulativo ("recuperar una carta conocida para jugarla mejor más tarde") se deja fuera de `'normal'` — depende de predecir jugadas futuras. `'dificil'` (dentro de `decidirHabilidadFaseBDificil`, interna) sí evalúa ese mismo uso adversarial sobre Portales visibles (antes solo consideraba ocultos), vía el mismo `cubreNecesarioUnicoRival`, ponderado a la baja igual que el resto de Cronista (`* 0.5`). |
| `decidirMaestroNormal(vista, need)` / `completariaLaInvocacionConMaestro(vista, need, personaje)` | `función` | (Bloque 4, 4.7, exportadas solo para tests) La habilidad activa del Maestro ya existía (ver `abilities.js`); esta es la primera vez que algún nivel de dificultad la USA. `'normal'`: SOLO beneficio propio, con certeza (`cartaOcultaPublica` ya es una identidad conocida) — baja a su Portal la carta pública conocida de la primera rival cuya carta sea un requisito activo aún no cumplido. `'dificil'` (dentro de `decidirHabilidadFaseBDificil`) añade dos cosas sobre la evaluación ya existente: bonus por completar la invocación AHORA MISMO (`completariaLaInvocacionConMaestro`, variante de `completariaLaInvocacion` que aproxima el Portal de destino exacto — desconocido hasta un picker interno de `abilities.js` — con "como mucho un Portal del tablero sin ocupar-y-visible"), y el matiz adversarial (provocar a propósito un duplicado del único requisito visible de OTRA rival) que sale solo de que `contexto.necesariosUnicosDeRivales` ya está presente en la llamada a `valorEsperadoDeAccion()` — sin caso especial. |
| `decidirMetamorfoNormal(vista, need)` / `decidirMetamorfoDificil(vista, need, esPropio, probabilidades, contexto)` | `función` | (Bloque 4, 4.6, exportadas solo para tests) El Metamorfo visible se transforma pagando 1 Gema unitaria (`COSTE_GEMA_METAMORFO`, interna). `'normal'`: SOLO beneficio propio, se transforma en el primer requisito de `need` aún no cumplido en la mesa, si `vista.gemasPropiasTotalExacto > 0` (proxy de "tiene con qué pagar"). `'dificil'`: evalúa CADA personaje de `need` restando siempre el coste de la Gema — reutiliza `valorEsperadoDeAccion()` sin ningún parámetro nuevo: si el personaje aún no está cumplido, el mecanismo normal de beneficio propio ya lo valora; si SÍ lo está porque una rival lo tiene como único ejemplar visible, el mecanismo de "denegación por duplicado" de esa misma función ya aplica (transformar el Metamorfo crea un segundo ejemplar en un Portal distinto al suyo) — el matiz adversarial sale solo de reusar la misma maquinaria con `need` completo, sin caso especial. |
| `decidirOcultistaAdversarialNormal(vista, need)` | `función` | (Bloque 4, 4.5, exportada solo para tests) Ocultista puede alternar la visibilidad de un Portal YA VISIBLE (excepto una Centinela visible, restricción ya aplicada en `abilities.js`), no solo revelar uno oculto — heurística `'normal'` ADICIONAL a la compartida con Cronista: denegación GRATUITA, esconde el único ejemplar visible en toda la mesa de un requisito que hoy tiene una RIVAL. Comparte el criterio de selección de objetivo con `decidirCronistaAdversarialNormal` (interna `primerRequisitoUnicoDeRivalComoClaveHabilidad`) — solo cambia el efecto real, que decide `abilities.js`. `'dificil'` (dentro de `decidirHabilidadFaseBDificil`) evalúa el mismo uso adversarial sobre Portales visibles, sin el descuento `* 0.5` de Cronista (esconder deniega de inmediato, no a futuro). |
| `decidirAprendizNormal(vista, need)` / `decidirAprendizPropioDificil(vista, need, cumplidos, valorGemaNivel)` / `decidirAprendizAjenoAjenoDificil(vista, need, cumplidos, valorGemaNivel)` | `función` | (Bloque 4, 4.4, exportadas solo para tests) Aprendiz intercambia manos COMPLETAS de dos jugadoras, manteniendo la orientación de cada carta. `'normal'`: SOLO beneficio propio incluyéndose a sí mismo — si su propia carta conocida ya es útil no la cambia a ciegas; si no, busca una rival cuya carta pública conocida sí lo sea. `'dificil'` combina dos casos independientes (el de mayor valor esperado gana): (a) `decidirAprendizPropioDificil`, incluyéndose, comparando el valor de recibir la carta pública de cada rival frente a ceder la propia (`valorCartaEnManoPropia`, interna — mismo descuento "a futuro, en mano" `* 0.5` que ya usa Cronista; deliberadamente NO reutiliza `valorEsperadoDeAccion()`, pensada para cartas que acaban VISIBLES en un Portal, no para un simple cambio de mano); (b) `decidirAprendizAjenoAjenoDificil`, intercambio puramente adversarial de las manos de DOS RIVALES (el bot no se incluye) para desbaratar a la que va mejor posicionada, estimada por el recuento de Gemas por nivel (`gemasPorNivel`, nunca el valor exacto) — solo con al menos 2 rivales y si a la líder se le puede quitar algo que de verdad le convenía. |
| `decidirJugadaFaseA(vista, need)` / `decidirJugadaFaseADificil(vista, memoriaBot, need, invocationSet, lvl)` | `función` | (exportadas solo para tests) Decisión de Fase A por dificultad. `'normal'` prioriza completar la invocación activa con un único Portal bloqueante; si no, aplica el ajuste adversarial de bajo coste del Bloque 3 (`decidirJugadaAdversarialNormal`, interna): (1) denegación GRATUITA por duplicado si la carta conocida es requisito activo, ya está visible en Portal AJENO, y el propio bot no la tiene ya (no pierde nada); (2) si no, tapar un Portal ajeno que muestre, como única copia visible en toda la mesa, un requisito de la invocación activa. Solo con información visible ahora mismo, nunca memoria/probabilidad. `'dificil'` evalúa TODAS las combinaciones carta×Portal por `valorEsperadoDeAccion()` (`js/bot-probabilidad.js`), que desde el Bloque 3 incluye el mismo término adversarial generalizado (no solo como desempate) vía `calcularNecesariosUnicosDeRivales()`. |
| `decidirYJugarTurno(players, neutrals, botIdx, contexto)` | `función` | Punto de entrada único: despacha por `players[botIdx].dificultad` (`HEURISTICAS_POR_DIFICULTAD`: `'normal'` o `'dificil'`) y ejecuta el turno completo (Fases A-E) de la bot. `contexto = { levelIdx, invocationSet }`. Desde el Bloque 4, la MEMORIA (`window.memoriaBots[botIdx]`, historial bruto de nombres vistos por Portal) la mantienen AMBAS dificultades (antes solo `'dificil'`) — la necesita Cronomante para decidir con sentido en cualquier nivel; el conteo de cartas/probabilidad (`js/bot-probabilidad.js`) sigue siendo exclusivo de `'dificil'`. Fase B: desde el Bloque 4, AMBAS dificultades saben usar las 7 habilidades activas (`PERSONAJES_CON_HABILIDAD`, `utils.js`). `'normal'` con una condición simple y de bajo riesgo por habilidad (solo información visible ahora mismo o memoria bruta, nunca probabilidad): Ocultista/Cronista comparten la comprobación "falta algo del combo Y hay un Portal oculto legal", y cada una además por su cuenta puede denegar gratis el único requisito visible de una rival (`decidirOcultistaAdversarialNormal`/`decidirCronistaAdversarialNormal`, ambas actúan también sobre un Portal YA VISIBLE, no solo oculto); Cronomante (`decidirCronomanteNormal`), Estratega (`decidirEstrategaNormal`), Aprendiz (`decidirAprendizNormal`), Metamorfo (`decidirMetamorfoNormal`) y Maestro (`decidirMaestroNormal`) — todas arriba — solo por beneficio propio, nunca el matiz adversarial más elaborado (reservado a `'dificil'`). `'dificil'` decide por valor esperado en Gemas: además del beneficio propio, cada habilidad incorpora su propio matiz adversarial (denegar/tapar/duplicar el único requisito visible de una rival, con el mismo mecanismo `cubreNecesarioUnicoRival`/`necesariosUnicosDeRivales` que ya usa Fase A) salvo Aprendiz, que además puede intercambiar las manos de DOS rivales sin beneficio propio directo. Ambos niveles resuelven los `picker()`/`pickerPortal()` que abre `applyAbility()` programáticamente (mismo `#pickerSelect`/`#pickerOk` que usaría un clic humano; el objetivo ya calculado se pasa como `objetivoPreferido` — un único valor o un ARRAY alineado por paso, para habilidades de varios pasos como Cronomante) y el resumen de turno (`alert()`) siempre se redacta en tercera persona, incluyendo de quién es el Portal/mano afectado por la habilidad activada (`describirObjetivoHabilidad`, arriba). Termina simulando el clic en `#btnEndTurn`, que ya comprueba invocación, reparte Gemas, roba y avanza turno con la misma lógica que una jugadora humana. |

---

## js/bot-probabilidad.js
**Propósito:** Motor de conteo de cartas y valor esperado para la
dificultad `'dificil'` del autómata. Toda función es PURA (sin DOM, sin
`window`, sin `players`/`neutrals` reales) — opera únicamente sobre la
vista saneada (`construirEstadoVisibleParaBot()`, `js/bot.js`) más la
memoria propia del bot, para que quede auditable que no puede hacer trampa.

### Exportaciones

| Nombre | Tipo | Descripción |
|--------|------|-------------|
| `actualizarMemoriaBot(memoriaBot, vista)` | `función` | Registra en `memoriaBot.portales` (clave absoluta `"playerIdx:portalIdx"`/`"n:k"`) qué personaje ve el bot ahora en la cima de cada Portal. Solo añade una entrada nueva si el nombre visible CAMBIA respecto a la última vez que este bot miró — evita contar dos veces la misma carta si solo cambia su visibilidad. |
| `estimarProbabilidadesPersonajes(vista, memoriaBot, invocationSet)` | `función` | Conteo de cartas: `composicionMazoTotal()` (dato público, `utils.js`) menos lo ya contabilizado (memoria de Portales, manos con carta pública, la propia carta conocida). El resto son personajes de ubicación desconocida; su probabilidad se reparte de forma UNIFORME entre el nº de huecos desconocidos — simplificación deliberada, documentada como tal. Devuelve `{ contabilizadas, desconocidos, totalHuecosDesconocidos, probabilidadPorNombre }`. |
| `valorMedioGemaNivel(invocationSet, lvl)` | `función` | Valor medio de Gema del nivel `lvl` (media de los 5 valores de `INVOCATION_SETS[...][lvl].gemas`). |
| `personajeMemorizadoEnPortal(memoriaBot, clave)` | `función` | Última identidad conocida por este bot para el Portal `clave`, o `null` si nunca se ha visto. Un Portal oculto AHORA con memoria previa se trata como determinista (ya está contabilizado). |
| `calcularNecesariosUnicosDeRivales(vista, need)` | `función` | (Bloque 3) Personajes de `need` visibles HOY como única copia en toda la mesa y en un Portal de una RIVAL (nunca del propio bot) — denegárselos (duplicado en otro sitio, o tapando ese Portal) le quita una recompensa con la que ya contaba. Devuelve `{ nombre: destKey }` con `destKey` en formato `"a:<playerIdx>:<portalIdx>"` (mismo que usa `listaPortalesConDestino()` en `js/bot.js`), para comparar directamente contra el destino de una acción candidata. |
| `valorEsperadoDeAccion(accionCandidata, probabilidades, contexto)` | `función` | Valor esperado en Gemas de jugar/mover un personaje (`accionCandidata.personaje`: `string` si es CIERTO, `null` si es una distribución de probabilidad) a un Portal propio (factor 1), ajeno (factor 0.3 — la Gema es para esa jugadora) o central (factor 0 — nadie la cobra, ver `actions.js`). Suma un bonus fuerte si `completaInvocacionSiSeJuega` es cierto. Desde el Bloque 3 (estrategia adversarial), suma también valor propio por perjudicar a una rival: si `distribucion` incluye un personaje de `contexto.necesariosUnicosDeRivales` y el destino (`accionCandidata.destKey`) NO es el Portal exacto de esa rival (denegación por duplicado en otro sitio), o si `accionCandidata.cubreNecesarioUnicoRival` es cierto (esta acción se juega EXACTAMENTE en el Portal donde una rival tiene su único ejemplar visible, tapándolo pase lo que pase) — ambos ponderados por `PESO_ADVERSARIAL` (0.5, valor elegido, no derivado de ninguna regla). No es un cálculo perfecto a varios turnos vista, una aproximación honesta. |

---

## js/setup.js
**Propósito:** Gestiona la pantalla de **configuración inicial** y lanza la partida.

### Exportaciones

| Nombre       | Tipo      | Descripción                                                                                       |
|--------------|-----------|---------------------------------------------------------------------------------------------------|
| `initSetup()`| `función` | - Configura `#cfgNext.onclick` para generar inputs de nombres según número de jugadoras Y número de autómatas (`#numBots`, 0..jugadoras, validado). Los últimos `nBots` puestos son autómatas (nombre de solo lectura vía `nombresDisponiblesParaBots()` de `bot.js`), el resto humanas (input editable); cada `<input>` lleva `dataset.tipo` (`'humano'`\|`'auto'`). Construye los `<input>` con `createElement`/propiedades, no interpolando en `innerHTML` (`DEUDA_TECNICA.md` ítem 5, resuelto en este archivo). Si `nBots > 0`, muestra `#lblDificultadBots` (`#selDificultadBots`, `'normal'`\|`'dificil'`) — dificultad GLOBAL para todos los autómatas de la partida, no una por autómata (decisión deliberada, ver `CHANGELOG.md`). <br>- Configura `#btnStart.onclick` para leer nombres y `#selInvocationSet` (`window.invocationSet`), inicializar `window.players` (cada uno con `tipo: 'humano'\|'auto'`, `dificultad` = valor de `#selDificultadBots` solo si es autómata, y 3 Gemas unitarias iniciales) y `window.neutrals`, mostrar `#btnAbility`, ocultar la UI de setup y llamar a `initGame()`. |

---

## js/render.js
**Propósito:** Renderiza toda la interfaz de juego en el DOM, sin gestionar eventos.

### Exportaciones

| Nombre     | Tipo      | Descripción                                                                                          |
|------------|-----------|------------------------------------------------------------------------------------------------------|
| `picker(title, options, cb, onCancel?)` | `función` | Muestra un modal `<div id="picker">` con un `<select>` y botones OK/Cancelar; invoca `cb(valor)` al aceptar, o `onCancel()` (si se pasó) al cancelar — por defecto cancelar solo cierra el modal sin llamar a nada. Las opciones siguen siendo texto (no imágenes) — un `<select>` nativo no aloja `<img>` de forma fiable. |
| `pickerPortal(title, opciones, cb, onCancel?)` | `función` | Como `picker()`, pero además habilita clicar directamente los Portales válidos del tablero (`#boardGrid`) como alternativa al modal — mismo criterio que jugar carta: ambos métodos coexisten. `opciones` debe tener el formato de `portalesConEstado()` (`val` = `"playerIdx:portalIdx"` o `"n:idx"`, con `disabled` ya calculado por la regla real de la habilidad). Fija `window.pickerObjetivoPortal = { opciones, cb }` mientras el picker está abierto (lo consume `renderBoardGrid()` para pintar `.target-portal`/`.target-portal-disabled`, y `window.selectPortalObjetivo` en `actions.js` para resolver el clic) y lo limpia al aceptar o cancelar, en ambos casos con un `render()` de por medio. Usada por Ocultista, Cronista, el primer picker de Cronomante, y los dos pickers de Estratega — no por el segundo picker de Cronomante (elige una carta dentro de la pila, no un Portal), ni por Aprendiz (elige jugadoras) ni Metamorfo (elige un nombre de personaje), que se quedan con `picker()` normal. |
| `render(players, neutrals, levelIdx)` | `función` | Llama a la función interna `gestionarTransicionesClarividente()` (actualiza `hasClariActivo` vía `actualizarClarividente()` y, si alguna jugadora acaba de perder la visibilidad, dispara de inmediato su elección de carta — ver más abajo), muestra/oculta `#btnPlayCancel` según haya o no una carta seleccionada, llama a la función interna `renderBoardGrid()` para dibujar el tablero, y actualiza el estado y componentes de la invocación activa (`#lblInv`/`#invStatus`), resuelta desde `INVOCATION_SETS[window.invocationSet][lvl]` (nombre y `need`). |
| *(interna)* `gestionarTransicionesClarividente(players)` | `función` | Corte inmediato de Clarividente, sin periodo de gracia (ver `docs/reglamento/REGLAMENTO.md`, nota de interpretación): llama a `actualizarClarividente()` y, para cada jugadora cuyo `hasClariActivo` acaba de pasar de `true` a `false` (comparado contra `player._clariVisiblePrev`, guardado en la llamada anterior), dispara `resolverEleccionClarividente()` — a menos que ya haya un picker en curso (`#picker` visible o `window.pickerObjetivoPortal` activo), en cuyo caso se pospone y se reintenta en la siguiente llamada a `render()` sin tocar `_clariVisiblePrev`. Se llama para CUALQUIER jugadora en CUALQUIER momento, no solo en su propio turno — cualquier acción que tape su Clarividente (jugada propia o ajena, habilidad de otra jugadora) dispara la reacción en la siguiente `render()`. |
| *(interna)* `resolverEleccionClarividente(player)` | `función` | Aplica la elección real de qué carta de mano seguir viendo (`card.vis = {owner,others,public}` de las dos cartas, invertido según la elección) en el instante de la transición. Jugadora humana: `picker()` con etiquetas neutras ("Mi carta de la izquierda"/"de la derecha", sin revelar el nombre del personaje); cancelar reabre el mismo picker (no hay forma válida de no elegir). Autómata: heurística mínima, se queda con la carta que sea el personaje requerido por la invocación activa si aplica, si no al azar. Tras aplicar, limpia `player._clariEligiendo`/`_clariVisiblePrev` y llama a `render()`. |
| *(interna)* `renderBoardNeutrals(neutrals)` | `función` | Dibuja la fila de Portales centrales/neutrales en `#boardNeutrals` (Tarea 2), **separada** del grid de columnas de jugadoras y por encima de él — a lo ancho de todo el contenedor, con su propio fondo/borde (`.board-neutrals` en `style.css`) y el título "Portales centrales", para que no se confunda con la columna de ninguna jugadora. Si `neutrals.length === 0` (partidas de 5 jugadoras, ver `js/setup.js`), oculta el contenedor entero (`classList.add('hidden')`) y lo vacía — no deja un hueco vacío ni un mensaje placeholder. Cada Portal se pinta con la misma función interna `portalCardHtml()` que usan las columnas de jugadoras. Llamada desde `renderBoardGrid()`, no exportada aparte. |
| *(interna)* `renderBoardGrid(players, neutrals)` | `función` | Llama primero a `renderBoardNeutrals(neutrals)` y luego dibuja el grid de columnas de **jugadoras únicamente** en `#boardGrid` — los Portales centrales ya no forman parte de este grid (ver `renderBoardNeutrals` arriba). Una columna por jugadora en orden fijo por índice, con `grid-template-columns: repeat(N, minmax(240px, 1fr))` (N = nº de jugadoras): cada columna crece para llenar el ancho disponible cuando cabe, y `.board-grid` solo hace scroll horizontal (`overflow-x: auto`) cuando de verdad no caben todas — no hay ninguna vista alternativa ni modo de depuración aparte. Visibilidad SIEMPRE real (nunca "todo visible"): los Portales de cualquier columna según `vis?.public` de su carta superior (con `aspecto \|\| name` para la imagen, ver DEUDA_TECNICA.md ítem 14); la mano de la jugadora activa (`window.turn`) según `c.vis?.owner \|\| pl.hasClariActivo` **solo si es humana** (`esHumanaActiva = esActiva && p.tipo !== 'auto'`); la mano de cualquier otra jugadora, Y la de una autómata en su propio turno (nunca tiene "su propia pantalla" que la vea, ver `js/bot.js`), según `h.vis?.others`, salvo que esa jugadora tenga `hasClariActivo`, en cuyo caso se oculta su mano COMPLETA al resto (decisión de mesa, ver nota de Clarividente en `docs/reglamento/REGLAMENTO.md`). Sin periodo de gracia: en cuanto `hasClariActivo` pasa a `false`, `gestionarTransicionesClarividente()` (más arriba) ya ha resuelto la elección real de la jugadora, así que `card.vis` refleja de inmediato el estado correcto. Por el mismo motivo, el desglose exacto de Gemas también se restringe a `esHumanaActiva`: ambos casos usan la misma función interna `gemDotsHtml(gems, {mostrarValorReal})` (Tarea 5 — círculos de color `.gem-dot`/`.gem-dot--unitaria`/`--c`/`--b`/`--a` en `style.css`, según nivel/color de invocación: azul = unitaria, amarillo = C, rojo = B, morado = A), con `mostrarValorReal: true` solo para `esHumanaActiva` (añade entre paréntesis la suma de valores reales de cada grupo, junto a `sumaGemas()` para el total) — una autómata activa se muestra con `mostrarValorReal: false`, igual que cualquier jugadora no activa, y su nombre lleva un icono 🤖. La columna de la jugadora activa recibe la clase `.turno-activo` (resaltada); el resto `.turno-inactivo` (atenuada), sin perder su color de identidad fijo por índice. Cada carta de la mano activa lleva `draggable="true"` y `onclick="window.selectHandCard(idx)"`/`ondragstart="window.handleCardDragStart(...)"` (definidos en `actions.js`); recibe `.selected` si es `window.selectedCardIdx`. Cada Portal, vía la función interna `portalCardHtml()`: si `window.pickerObjetivoPortal` está activo (selección de objetivo de habilidad en curso), se resuelve como objetivo clicable (`onclick="window.selectPortalObjetivo(keyObjetivo)"`, `.target-portal`) o bloqueado (`.target-portal-disabled`, sin `onclick`, etiqueta con 🚫) según `opcion.disabled`; si no, modo normal "jugar carta" con `portalPlayAttrs(destKeyJugar)` y `.target-portal` mientras haya una carta seleccionada. Mano y Portales usan la función interna `cartaImgHtml(name, visible)`, que renderiza un `<img>` con `cardImages[name]` si la carta es visible para quien mira, o siempre `CARTA_OCULTA_IMG` (con `alt="Carta oculta"`, sin el nombre real) si no lo es. |

---

## js/actions.js
**Propósito:** Gestiona la **interacción** de la UI: selección de cartas, jugar carta (Fase A), activar habilidad (Fase B) y fin de turno.

### Exportaciones

| Nombre              | Tipo      | Descripción                                                                                                                                        |
|---------------------|-----------|----------------------------------------------------------------------------------------------------------------------------------------------------|
| `initActions(players, neutrals)` | `función` | Jugar carta (Fase A) admite TRES métodos que coexisten siempre y comparten el mismo estado (`window.selectedCardIdx`) y la misma función interna `jugarCartaSeleccionadaEn(destKey)` — ninguno duplica validación ni puede desincronizar a los otros: <br>- **Clic directo**: `window.selectHandCard(idx)` selecciona/deselecciona (toggle) una carta de la mano; `window.tryPlayOnPortal(destKey)` la juega al clicar un Portal (`destKey` = `'p:<idx>'` \| `'n:<idx>'` \| `'a:<pi>:<pj>'`). <br>- **Drag&drop**: `window.handleCardDragStart`/`handlePortalDragOver`/`handlePortalDrop`, mismo efecto final. <br>- **Panel con `<select>`** (`#ctrlPlay`, botón `#btnCtrlPlay` en la cabecera): `abrirPanelJugarCarta()` (interna) puebla `#selCard`/`#selDest` y preselecciona `window.selectedCardIdx` si ya había una carta elegida por clic; `#btnPlay.onclick` fija `window.selectedCardIdx` al valor del `<select>` y llama a `jugarCartaSeleccionadaEn()`; `#ctrlPlayCancel.onclick` cierra el panel y limpia la selección. <br>- `#btnPlayCancel.onclick` (cabecera): limpia `window.selectedCardIdx`, cierra `#ctrlPlay` si estaba abierto, y refresca. <br>- `window.selectPortalObjetivo(key)`: clic en un Portal objetivo de una habilidad en curso (ver `pickerPortal()` en `render.js`); no hace nada si `window.pickerObjetivoPortal` no está activo o si esa opción está `disabled`. <br>- `#btnAbility.onclick`: Fase B, una vez por turno. Si hay una investigación de Cronomante pendiente (`window.cronomantePortalInvestigado` con valor), SALTA el picker de nivel superior y llama directamente a `applyAbility('Cronomante', ...)` con el `onComplete` guardado en `window.cronomanteOnComplete` — no se puede elegir otra habilidad hasta completar o que cambie el turno. Si no, construye opciones con `opcionesActivarHabilidad()`; al elegir una, cobra el coste con `pagarActivacionPortalCentral()` si la fuente es un Portal central, marca `window.habilidadUsadaEsteTurno` y llama a `applyAbility()` — si la habilidad es Cronomante, guarda ese `onComplete` en `window.cronomanteOnComplete` antes de llamar, por si hace falta reintentar tras un cancel (ver `abilities.js`). <br>- `#btnEndTurn.onclick`: valida jugada, reparte robo si <2 cartas, comprueba invocación contra `INVOCATION_SETS[window.invocationSet][lvl]` (el combo cuenta `card.aspecto \|\| card.name` — un Metamorfo transformado cumple la combinación), reparte Gemas reales (`construirPoolGemas` + bonus de Pícaro/Maestro — ambos bonus pasivos miran identidad real, `card.name`, no apariencia: un Metamorfo transformado en Maestro NUNCA da el bonus de 3 Gemas, ver DEUDA_TECNICA.md ítem 14), empuja el nivel recién completado a `window.invocacionesCompletadas` (orden real de invocaciones completadas en esta partida, lo necesita el desempate del marcador final — `calcularResultadoFinal()` en `utils.js`), añade portal neutral, avanza turno y refresca. |

---

## js/game.js
**Propósito:** Control central del **flujo de la partida**: creación de mazo, reparto y gestión de turnos.

### Exportaciones

| Nombre          | Tipo      | Descripción                                                                                                     |
|-----------------|-----------|-----------------------------------------------------------------------------------------------------------------|
| `initGame()`    | `función` | - Construye el mazo `window.deck` a partir de `composicionMazoTotal(window.invocationSet)` (`utils.js`): las cantidades reales de "Modo normal" (32 cartas), añadiendo los 9 Animales solo si `window.invocationSet` es `introductorio` (41 cartas) — `floral` reutiliza el mismo mazo de 32 cartas que `normal`, no es una tercera variante; baraja y aparta 2 al azar sin mirar. <br>- Reparte 1 carta visible + 1 oculta a cada jugador. <br>- Inicializa `window.levelIdx`, `window.turn`, `window.played`, `window.habilidadUsadaEsteTurno`, `window.selectedCardIdx`, `window.cronomantePortalInvestigado`, `window.pickerObjetivoPortal`, `window.memoriaBots` (array vacío — memoria del autómata en dificultad `'dificil'`, ver `js/bot-probabilidad.js`), `window.invocacionesCompletadas` (array vacío — orden real en que se completan las invocaciones en esta partida, necesario para el desempate del marcador final, ver `calcularResultadoFinal()` en `utils.js`). <br>- Llama a `initActions()`. <br>- Inicia primer turno con `nextTurn()`. |
| `nextTurn()`    | `función` | - `window.played = false`, `window.habilidadUsadaEsteTurno = false`, `window.selectedCardIdx = null`, `window.cronomantePortalInvestigado = null` (una investigación de Cronomante pendiente no sobrevive a un cambio de turno). <br>- Si la jugadora activa no tiene cartas en mano, termina la partida vía `finalizarPartida()`. <br>- Si `players[turn].tipo === 'auto'`, oculta `#btnCtrlPlay`/`#btnAbility`/`#btnEndTurn` (para que ninguna humana interfiera a mitad del turno del bot) y alerta "🤖 {nombre} está pensando…"; si no, los muestra y alerta "Turno de X" como siempre. <br>- Actualiza `#lblTurn`. <br>- Llama a `render()`. <br>- Si es autómata, tras un `setTimeout` de 500ms llama a `decidirYJugarTurno()` (`js/bot.js`), que ejecuta el turno completo y termina simulando el clic en `#btnEndTurn` — eso ya vuelve a llamar a `nextTurn()` internamente (mismo mecanismo que un clic humano), encadenando automáticamente turnos de autómatas consecutivos hasta que le toque a una jugadora humana. |
| `finalizarPartida(motivo)` | `función` | Construye el recuento final de Gemas y el veredicto (ganadora, o empate compartido con el motivo del desempate) con la función interna `construirMensajeResultadoFinal()`, que llama a `calcularResultadoFinal()` (`utils.js`) sobre `window.players`/`window.invocacionesCompletadas`, y lo muestra junto al `motivo` en el mismo `alert()`/`confirm()` de "¿Quieres jugar otra vez?" (REGLAMENTO.md, "Final de la partida" — sin pantalla de resultados dedicada, ver `docs/MEJORAS_FUTURAS.md`). Si sí, llama a `resetJuego()`; si no, bloquea la interfaz con un mensaje de cierre. Llamada desde `game.js` (mano vacía) y desde `actions.js` (última invocación completada) — por eso debe permanecer `export`ada. |
| `resetJuego()`  | `función` | Oculta la UI de juego, muestra la de configuración, limpia el estado global (`window.players`, `window.deck`, `window.invocacionesCompletadas`, etc.) y vuelve a llamar a `initSetup()`. |

---

## js/index.js
**Propósito:** **Entry point** con `<script type="module">` que expone variables globales y arranca la aplicación.

### Contenido principal

```js
import { initSetup } from './setup.js';
import { LEVELS, INVOCATION_SETS } from './utils.js';

// Estado global
window.players = [];
window.neutrals = [];
window.deck = [];
window.levelIdx = 0;
window.turn = 0;
window.played = false;
window.habilidadUsadaEsteTurno = false;
window.invocationSet = 'normal';

// Exponer constantes
window.LEVELS = LEVELS;
window.INVOCATION_SETS = INVOCATION_SETS;

// Arrancar UI
document.addEventListener('DOMContentLoaded', () => {
  initSetup();
});
```

---

**Flujo de carga**  
1. Carga de `index.js` como módulo.  
2. Llamada a `initSetup()`: muestra form de configuración (jugadoras, nombres, set de invocación).  
3. Pulsar **Continuar** y **Iniciar** reúne datos y llama a `initGame()`.  
4. `initGame()` construye el mazo según el set elegido, reparte cartas y llama a `nextTurn()`.  
5. Cada turno: Fase A (jugar carta, obligatoria), Fase B opcional (activar como mucho una habilidad, propia gratis o central pagando), comprobación de invocaciones y reparto real de Gemas, robo y cambio de turno.


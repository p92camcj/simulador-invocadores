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
- [js/bot-estrategia.js](#jsbot-estrategiajs)
- [js/bot-busqueda.js](#jsbot-busquedajs)
- [tools/arena.mjs](#toolsarenamjs)
- [tools/equilibrio.mjs](#toolsequilibriomjs)
- [js/setup.js](#jssetupjs)
- [js/render.js](#jsrenderjs)
- [js/actions.js](#jsactionsjs)
- [js/game.js](#jsgamejs)
- [js/partida-guardada.js](#jspartida-guardadajs)
- [js/index.js](#jsindexjs)
- [js/espectaculo.js](#jsespectaculojs)
- [js/vista-mesa.js](#jsvista-mesajs)
- [js/mesa3d.js](#jsmesa3djs)
- [js/motor/estado.js](#jsmotorestadojs)
- [js/motor/acciones.js](#jsmotoraccionesjs)
- [js/motor/habilidades.js](#jsmotorhabilidadesjs)
- [js/motor/variantes.js](#jsmotorvariantesjs)

---

## js/utils.js
**Propósito:** Contiene constantes globales, iconos y funciones auxiliares puras que otros módulos utilizan.

### Exportaciones

| Nombre            | Tipo      | Descripción                                                                 |
|-------------------|-----------|-----------------------------------------------------------------------------|
| `LEVELS`          | `const`   | Niveles de invocación: `['C','B','A']`.                                      |
| `INVOCATION_SETS` | `const`   | Mapea `introductorio\|normal\|floral` → nivel → `{ nombre, need, gemas }`. Sustituye al antiguo `COMBOS` genérico. |
| `INVOCATION_ASTERISCO` | `const` | Cuarta invocación (`Madain`: Reena, Metamorfo sin transformar, Sora y Lumo; Gemas 11-13), nivel `NIVEL_ASTERISCO` (`'*'`). Obligatoria en Modo Experto, opcional en Avanzado. |
| `NIVEL_ASTERISCO`, `NIVELES_CON_GEMAS` | `const` | `'*'` y `['C','B','A','*']` (niveles cuyas Gemas cuentan como invocación en el desempate). |
| `CANTIDADES_MODO_INTRODUCTORIO`, `CANTIDADES_ENTUSIASTA` | `const` | Mazo de 29 cartas del Modo introductorio; los 2 Entusiastas de la expansión. |
| `MODOS_JUEGO` | `const` | `introductorio`/`normal`/`avanzado`/`experto` → `{ nombre, sets, apartar, madain: 'nunca'\|'opcional'\|'siempre', automata, cantidades, descripcion }`. |
| `modoDe(cfg)` | `función` | Modo de una partida/configuración; sin `modo` (partidas guardadas antiguas o un set suelto) lo deduce del set: introductorio → avanzado, resto → normal. |
| `configPartida(partida)` | `función` | `{ levelIdx, invocationSet, modo, entusiasta, madain }`: lo público de la configuración; es el `contexto` que reciben las autómatas. |
| `nivelesPartida(cfg)`, `datosInvocacion(cfg, nivel)`, `invocacionDePartida(cfg)` | `función` | Niveles de la partida (C, B, A y `'*'` con Madain), datos `{ nombre, need, gemas }` de un nivel e invocación activa `{ nivel, ... }` o `null`. Usar siempre estas en vez de `INVOCATION_SETS[set][LEVELS[i]]`. |
| `prepararMazo(cfg)` | `función` | Mazo de robo de una partida nueva: composición del modo (+ Entusiastas), barajada, menos las cartas que el modo aparta (los Entusiastas pueden quedar fuera). Única fuente para `game.js` y `tools/arena.mjs`. |
| `aplicarEntusiastas(players, neutrals)` | `función` | Expansión: cada Entusiasta real bocarriba en un Portal de jugadora le quita una Gema de valor 1 (sin cambio). Devuelve `[{ jugadora, perdida }]`. Lo último de `resolverInvocacion()`. |
| `crearAutomataCentral()`, `jugadorasConMenosPuntos(players)`, `convieneIntercambioAutomata(players, automata, idx)` | `función` | Autómata central del Modo Experto (`{ gems }`), las últimas (con empate) y si a una autómata jugadora le conviene el cambio. |
| `resultadoFinalExperto(players, automata, invocacionesCompletadas, cambian)` | `función` | Final del Modo Experto: las últimas que aceptan (`cambian`) puntúan con las Gemas de la autómata; la autómata entra en la clasificación (`idx === players.length`, `esAutomataCentral`) con el desempate habitual. Pura. Añade `intercambios` al resultado de `calcularResultadoFinal()`. |
| `PERSONAJES_CON_HABILIDAD` | `const` | Personajes activables en Fase B (`Ocultista`, `Cronista`, `Cronomante`, `Estratega`, `Aprendiz`, `Metamorfo`, `Maestro`). Única fuente para `opcionesActivarHabilidad()`. |
| `PERSONAJES_NO_ANIMALES` | `const` | Roster de los 10 personajes no-animales del mazo base "Modo normal". Usado por `game.js` para construir `charsBase` y por `abilities.js` (`case 'Metamorfo'`) para las opciones de transformación, sin depender de si esa carta sigue en el mazo o fue apartada al preparar la partida. |
| `CANTIDADES_MODO_NORMAL` | `const` | Cantidades reales de "Modo normal" por personaje no-animal (32 cartas en total). Única fuente — antes vivía como literal duplicado dentro de `initGame()` (`game.js`). |
| `CANTIDADES_ANIMALES` | `const` | Cantidades de los 3 Animales (Reena/Sora/Lumo: 3 cada uno), solo presentes en el mazo si el set de invocación es `introductorio`. |
| `composicionMazoTotal(cfg)` | `función` | `{ nombrePersonaje: cantidad }` de la composición TOTAL del mazo (dato público): `MODOS_JUEGO[modoDe(cfg)].cantidades` más los Entusiastas si `cfg.entusiasta`. Acepta la partida, `configPartida()` o un set suelto (compatibilidad). La usan `prepararMazo()` y el conteo de cartas de las autómatas. |
| `iconos`          | `const`   | Mapa nombre→emoji para representar cartas (incluye Reena/Sora/Lumo). Se usa en `selCard`/`picker()` (texto) y en el estado de invocación; ya no en mano/Portales, que usan `cardImages`. |
| `mostrarCarta(card)` | `función` | Devuelve la cadena `"<icono> <nombre>"` para mostrar en la UI (selects/pickers y estado de invocación), usando `card.aspecto \|\| card.name` — la apariencia (disfraz del Metamorfo transformado), no la identidad real. |
| `cardImages`      | `const`   | Mapa nombre de personaje → ruta de imagen real (`assets/cards/*.png`), 14 personajes con habilidad + Reena/Sora/Lumo. El Metamorfo siempre usa `metamorfo.png` tal cual (no hay disfraz visual todavía, ver TODO en el propio archivo). |
| `CARTA_OCULTA_IMG`| `const`   | Ruta del reverso genérico (`assets/cards/carta-oculta-reverso.png`) usado por la mesa para cualquier carta oculta para quien mira, sin filtrar el nombre real en el `alt`. |
| `$`               | `función` | Atajo para `document.querySelector(selector)`.                               |
| `escapeHtml(str)` | `función` | Escapa `&`/`<`/`>` de texto de origen no confiable (p. ej. nombres de jugadora) antes de interpolarlo en una plantilla de string asignada vía `innerHTML`. Usada por la mesa y las escenas para los nombres de jugadora. |
| `shuffle(array)`  | `función` | Mezcla un array _in place_ (algoritmo Fisher–Yates).                        |
| `draw(player, visible, mazo = window.deck)` | `función` | Roba la primera carta de `mazo` a la mano de un jugador. El motor (`js/motor/acciones.js`) pasa el mazo de la partida; sin argumento usa `window.deck`. |
| `reponerManoSiFalta(player, mazo = window.deck)` | `función` | Repone la mano de `player` a las 2 cartas habituales (una visible para su dueña, una oculta) robando lo que falte de `mazo` con `draw()` — misma lógica que usa `terminarTurno()` (`js/motor/acciones.js`), centralizada aquí porque la habilidad activa del Maestro (`abilities.js`, `bajarCartaMaestro()`) la necesita también. |
| `listPortals(players, neutrals)` | `función` | Devuelve array de `{val, lbl}` para poblar selectores de portales (propios, ajenos, neutrales). |
| `todosLosPortales(players, neutrals)` | `función` | Devuelve array plano de `{stack, playerIdx, portalIdx}` (todos los Portales de jugadoras + neutrales; `playerIdx` es `null` para un Portal neutral). Centraliza el patrón `players.forEach(p => p.portals.forEach(...))` + `neutrals.forEach(...)`, usado en `actions.js` (comprobación de invocación, bonus de Pícaro/Maestro) y `abilities.js` (`ocultarOtrasCentinelas()`). |
| `retirarFichaMetamorfo(carta)` | `función` | Devuelve la ficha de transformación a la reserva (borra `carta.aspecto`). Se llama cuando un Metamorfo transformado se pone bocabajo (Ocultista). |
| `apilarEnPortal(stack, carta)` | `función` | Apila `carta` sobre `stack`; si la carta tapada era un Metamorfo transformado, pierde su ficha. La usan Fase A (`actions.js`), Maestro y Cronomante. |
| `transformacionesDisponiblesMetamorfo(players, neutrals, cartaMetamorfo)` | `función` | Personajes no animales en los que puede transformarse `cartaMetamorfo`: excluye al propio Metamorfo y las fichas que ya usa otro Metamorfo en mesa (cada ficha es única). |
| `stackFrom(key, players, neutrals)` | `función` | Dada clave `"i:j"` o `"n:k"`, devuelve la pila de cartas (portal) correspondiente. |
| `portalesConEstado(players, neutrals, esInvalido)` | `función` | Como `listPortals()` pero añade `disabled` según `esInvalido(stack, val)` — usado por `picker()` para bloquear opciones. |
| `jugadoraProtegidaPorCentinela(player)` | `función` | `true` si esa jugadora tiene una Centinela visible en cualquiera de sus Portales — la protección cubre TODOS sus Portales, no solo el que la contiene. |
| `estaProtegidoParaActivar(stackKey, stack, players, actingPlayerIdx)` | `función` | `true` si ese Portal es un objetivo inválido para que `actingPlayerIdx` dirija una habilidad contra él: protegido por Centinela, salvo que `actingPlayerIdx` sea la propia dueña del Portal (la Centinela protege de las demás, no de una misma). Usado por Ocultista, Cronista, Cronomante y Estratega en `abilities.js`. |
| `opcionesActivarHabilidad(playerIdx, players, neutrals)` | `función` | Fase B: opciones activables para `players[playerIdx]` — sus propios portales (`own:<idx>`, gratis) y los centrales/neutrales (`central:<idx>`, con coste). Una opción central solo se ofrece si `sumaGemas(player.gems)` cubre el coste real (1, o 2 si el personaje es el propio Metamorfo, cuya transformación tiene un coste propio independiente) — evita ofrecer una activación que luego no se podría pagar. La etiqueta usa la identidad real (`top.name`), no `mostrarCarta()`/apariencia — a propósito: un Metamorfo transformado solo puede volver a transformarse, nunca usar la habilidad del personaje imitado. |
| `sumaGemas(gems)` | `función` | Suma los `valor` de un array de Gemas — solo se muestra a la propia dueña en `render()` (secreto de Gemas). |
| `contarGemasPorNivel(gems)` | `función` | Devuelve `{nivel: cantidad}` sin revelar valores reales — usado por `js/bot.js` (`construirEstadoVisibleParaBot()`) para el recuento de Gemas por nivel de cualquier jugadora en la vista saneada del bot. `render.js` ya no lo usa: desde la Tarea 5 (círculos de color) agrupa por nivel con su propia lógica en `gemDotsHtml()`, que también necesita sumar valores reales para la jugadora activa. |
| `tieneGemaAsterisco(player)` | `función` | `true` si el jugador tiene alguna Gema con `esAsterisco: true` todavía sin revelar (`revelada` no es `true`). |
| `gastarGemaAsterisco(player)` | `función` | Revela una Gema de asterisco sin revelar (`revelada = true`): **no se descarta**, sigue sumando puntos, su valor pasa a ser público (`render.js` lo muestra a todas) y no puede reutilizarse. `false` si no tenía ninguna sin revelar. |
| `contarGemasUnitarias(player)` | `función` | Nº de Gemas de valor 1 sin asterisco: las únicas con las que se paga un coste (no se da cambio). |
| `gastarGemaUnitaria(player)` | `función` | Gasta 1 Gema de valor 1 (sin asterisco). **No da cambio**: si no tiene ninguna suelta devuelve `false` sin tocar nada, aunque tenga Gemas de valor superior. |
| `puedePagarActivacionCentral(player, esMetamorfo = false)` | `función` | ¿Puede pagar un Portal central sin cambio? 1 Gema de valor 1 o un asterisco; si es el Metamorfo, además otra Gema de valor 1. Lo usa `opcionesActivarHabilidad()`. |
| `pagarActivacionPortalCentral(player, opciones = {})` | `función` | Cobra el coste de activar la habilidad de un Portal central: gratis revelando la Gema de asterisco, o 1 Gema de valor 1 (sin cambio). Si tiene ambas opciones pregunta con `confirm()`, salvo que se pase `opciones.usarAsterisco` (el autómata pasa `false`). Si solo tiene una, usa esa. `false` si no pudo pagar. |
| `construirPoolGemas(valores)` | `función` | Construye y mezcla el pool de 5 Gemas de una invocación, marcando la de menor valor como `esAsterisco`. |
| `aplicarBonusPasivosInvocacion(players, neutrals, need, automata?)` | `función` | Bonus pasivos al completar una invocación, llamada desde `terminarTurno()` (motor, vía `actions.js`) tras repartir las Gemas de la invocación. Primero el Maestro (3 Gemas de valor 1 a la dueña del único Maestro real visible, si es requisito y no hay ningún Pícaro real visible en toda la mesa), después el Pícaro (1 Gema de valor 1 por cada Pícaro real visible en un Portal de jugadora, que luego se voltea bocabajo; el de un Portal central ni cobra ni se voltea). El orden importa: si se volteaba antes a los Pícaros, el Maestro cobraba aunque hubiera uno visible. Con `automata` (Modo Experto) los Portales centrales son suyos: cobra el Maestro y el Pícaro centrales (y ese Pícaro se voltea). Función pura, testable. |
| `calcularResultadoFinal(players, invocacionesCompletadas)` | `función` | Clasificación final de la partida (REGLAMENTO.md, "Final de la partida"): ordena a las jugadoras por mayor `sumaGemas()`, desempatando con (1) nº de invocaciones DISTINTAS en las que participó (niveles de `LEVELS` presentes en `player.gems`, sin contar Gemas `nivel: 'unitaria'`), (2) Gema de mayor valor en la ÚLTIMA invocación de `invocacionesCompletadas` (orden real en que se completaron en esa partida, no siempre C→B→A), (3) repetir con la anterior, y así hacia atrás; empate compartido si persiste. Función pura (usada por `js/game.js`, `finalizarPartida()`), devuelve `{ stats, ganadores, motivoDesempate }`. |
| `generarVis(destino, opciones)` | `función` | Genera el objeto de visibilidad de una carta según su origen y destino. |
| `actualizarClarividente(players)` | `función` | Actualiza `hasClariActivo` de cada jugador (solo el flag, nunca muta `carta.vis`) — sin periodo de gracia, ver `render.js` (`gestionarTransicionesClarividente`) para la reacción inmediata a la transición true→false. |
| `tieneClarividenteVisible(player)` | `función` | `true` si la jugadora tiene una Clarividente real visible en la cima de algún Portal (calculado en el momento). Lo usan `actualizarClarividente()`, `candidatosObjetivoMaestro()` y `construirEstadoVisibleParaBot()`. |

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
**Propósito:** Adaptador web de las habilidades (fase 3 de la separación motor / interfaz). Las reglas están en `js/motor/habilidades.js`; este módulo solo contesta sus peticiones con los `picker()` del navegador y sus avisos con `alert()`.

### Exportaciones

| Nombre             | Tipo      | Descripción |
|--------------------|-----------|-------------|
| `applyAbility(name, ownerIdx, stack, players, neutrals, levelIdx, need = [], onComplete)` | `función` | Aplica la habilidad de `name` desde el Portal `stack` de `players[ownerIdx]` llamando a `aplicarHabilidad()` del motor con `estado.partida` y `uiNavegador`. `onComplete` se llama una sola vez, cuando la habilidad tiene efecto de verdad. Firma sin cambios por compatibilidad con `actions.js` y `bot.js` (`players`, `neutrals`, `levelIdx` y `need` ya no se usan: el motor lee `estado.partida`, que son los mismos arrays). |
| `uiNavegador` | `objeto` | Interfaz web para el motor: `pedir()` abre `pickerPortal()` para peticiones de tipo `'portal'` (también se puede clicar el Portal en el tablero) y `picker()` para `'eleccion'`; `avisar()` muestra el motivo de un `accionInvalida` con `alert()`. |
| `ocultarOtrasCentinelas`, `girarOtrasCentinelasSiAparece`, `candidatosObjetivoMaestro` | `funciones` | Re-exportadas de `js/motor/habilidades.js` (ver allí). |
| `bajarCartaMaestro(players, neutrals, targetIdx, portalIdx, mazo = window.deck)` | `función` | La de `js/motor/habilidades.js`, pero si no se le pasa mazo roba de `window.deck`. |

---

## js/bot.js
**Propósito:** Lógica de decisión de jugadoras autómatas ("bots"). Ninguna
función de decisión lee `players`/`neutrals`/`window.deck` directamente —
todas parten de la vista saneada de `construirEstadoVisibleParaBot()`, para
que quede auditable que el bot no puede hacer trampa aunque cambie la
heurística en el futuro. Las acciones en sí (jugar carta, activar
habilidad, terminar turno) usan el motor directamente, sin pulsar botones
del DOM (fase 4 de `docs/ARQUITECTURA_MOTOR.md`): `ejecutarJugada()` y
`ejecutarFinDeTurno()` de `actions.js` (las mismas que los clics humanos),
y `aplicarHabilidad()` de `js/motor/habilidades.js` contestada por
`crearUiAutomata()`. La memoria de cada autómata vive en
`estado.partida.memoriaBots`. No duplica ninguna lógica de reglas.

### Exportaciones

| Nombre | Tipo | Descripción |
|--------|------|-------------|
| `crearUiAutomata(vista, preferidosPorPaso)` | `función` | Interfaz de autómata para `aplicarHabilidad()` del motor: `pedir()` contesta en el acto con la opción habilitada cuyo valor (o etiqueta, para el 2º paso de Cronomante) coincide con la preferencia de la heurística para ese paso; si no hay, prefiere un Portal oculto o elige al azar; sin opciones, cancela. Guarda lo elegido en `elegidos` (para el resumen del turno) y los avisos en `avisos`. |
| `nombresDisponiblesParaBots(cantidad)` | `función` | Devuelve `cantidad` nombres únicos (sin repetir dentro de la misma partida) de un pool temático de 10 nombres terminados en "bot" (`Arcanobot`, `Nigrobot`, ...), barajado con `shuffle()` (`utils.js`). |
| `construirEstadoVisibleParaBot(players, neutrals, botIdx)` | `función` | Vista saneada del estado para la bot `botIdx`: su propia carta "visible" conocida (nunca la oculta — ese campo directamente no existe en la vista), la carta "oculta" de cualquier OTRA jugadora (pública por reglamento), el estado de cada Portal (`null` vacío, `{hidden:true}` oculto, `{name}` visible — `name` ya resuelve `aspecto \|\| name`, la apariencia, igual que vería una jugadora humana), y recuentos de Gemas por nivel de cualquier jugadora (más el total exacto propio). No incluye nunca el mazo de robo. Incluye `gemasUnitariasPropias` (Gemas de valor 1, las únicas con las que se paga) y `transformacionesOcupadas` (fichas de Metamorfo en uso, información pública); `cartaOcultaPublica` es `null` para una jugadora con la Clarividente visible. Incluye además `tieneCartaOcultaPropia` (solo sí/no) y, por jugadora, `protegidaPorCentinela` (información pública: una Centinela real visible en sus Portales la protege de las habilidades de las demás; siempre `false` para la propia bot). Maestro, Aprendiz y todas las habilidades que apuntan a un Portal (`listaPortalesFormatoHabilidad`) descartan a las rivales protegidas. |
| `listaPortalesConDestino(vista)` | `función` | (exportada solo para tests) Lista de Portales como destinos jugables con una etiqueta EN TERCERA PERSONA ("su propio Portal N" / "el Portal N de X" / "el Portal Neutral N") — nunca en segunda persona ("tu Portal"), porque el resumen de turno del bot lo lee quien observa la partida, nunca la propia autómata (bug corregido, ver `CHANGELOG.md`). |
| `describirObjetivoHabilidad(name, valoresElegidos, vista)` | `función` | (exportada solo para tests) Traduce los valores REALMENTE elegidos en el/los `picker()` de una activación de habilidad (los que devuelve `resolverPickersAbiertos`, función interna) a una frase en tercera persona para el resumen de turno, identificando de quién es cada Portal/mano afectada. Cubre, por ahora, Ocultista/Cronista/Maestro — el resto de habilidades se documenta aquí a la vez que la Fase B del autómata les da uso real. |
| `candidatosCronomante(vista, memoriaBot)` / `decidirCronomanteNormal(vista, memoriaBot, need)` | `función` | (Bloque 4, exportadas solo para tests) `candidatosCronomante` lista los Portales donde la MEMORIA del bot (ahora compartida por ambas dificultades, ver más abajo) recuerda al menos una alternativa distinta de lo que se ve ahora en su cima — sin eso, Cronomante no tiene sentido "a ciegas". `decidirCronomanteNormal` (heurística `'normal'`): SOLO beneficio propio, solo con certeza (la memoria ya vio ese nombre en ese Portal PROPIO) — nunca el matiz adversarial (sustituir el requisito visible de una rival por algo inútil para ella), reservado a `'dificil'` (dentro de `decidirHabilidadFaseBDificil`, interna, vía el mismo `cubreNecesarioUnicoRival` que ya usa Fase A). |
| `decidirEstrategaNormal(vista, need)` / `decidirEstrategaDificil(vista, need, probabilidades, contexto)` | `función` | (Bloque 4, 4.2, exportadas solo para tests) Estratega intercambia Portales COMPLETOS (con su pila) — la propiedad del personaje visible resultante pasa a quien sea dueña de cada posición. `'normal'`: SOLO beneficio propio y con certeza — el primer par (Portal propio, cualquier otro Portal que muestre un requisito de `need` que el bot no tenga ya en un Portal PROPIO). `'dificil'`: evalúa pares candidatos (interna `candidatosEstrategaDificil` — todos los que involucran un Portal propio, más el par Portal-ajeno-vulnerable/Portal-central para denegación pura; no hace falta más poda con el nº de Portales típico del juego) por el valor esperado RESULTANTE de intercambiar sus contenidos (interna `valorPosicion`, que deliberadamente NO pasa `necesariosUnicosDeRivales` a `valorEsperadoDeAccion()` — el mecanismo de denegación por duplicado de esa función asume que el personaje se AÑADE en un sitio nuevo mientras sigue en el antiguo, falso en un intercambio donde se RELOCALIZA; solo aplica el mecanismo de "tapar", calculado aparte). |
| `decidirCronistaAdversarialNormal(vista, need)` | `función` | (Bloque 4, 4.3, exportada solo para tests) A diferencia de Ocultista, Cronista puede actuar sobre un Portal YA VISIBLE (se lleva su carta superior a la mano, no solo la oculta) — heurística `'normal'` ADICIONAL a la compartida con Ocultista: denegación GRATUITA, se lleva a la mano el único ejemplar visible en toda la mesa de un requisito de `need` que hoy tiene una RIVAL. El beneficio propio especulativo ("recuperar una carta conocida para jugarla mejor más tarde") se deja fuera de `'normal'` — depende de predecir jugadas futuras. `'dificil'` (dentro de `decidirHabilidadFaseBDificil`, interna) sí evalúa ese mismo uso adversarial sobre Portales visibles (antes solo consideraba ocultos), vía el mismo `cubreNecesarioUnicoRival`, ponderado a la baja igual que el resto de Cronista (`* 0.5`). |
| `decidirMaestroNormal(vista, need)` / `completariaLaInvocacionConMaestro(vista, need, personaje)` | `función` | (Bloque 4, 4.7, exportadas solo para tests) La habilidad activa del Maestro ya existía (ver `abilities.js`); esta es la primera vez que algún nivel de dificultad la USA. `'normal'`: SOLO beneficio propio, con certeza (`cartaOcultaPublica` ya es una identidad conocida) — baja a su Portal la carta pública conocida de la primera rival cuya carta sea un requisito activo aún no cumplido. `'dificil'` (dentro de `decidirHabilidadFaseBDificil`) añade dos cosas sobre la evaluación ya existente: bonus por completar la invocación AHORA MISMO (`completariaLaInvocacionConMaestro`, variante de `completariaLaInvocacion` que aproxima el Portal de destino exacto — desconocido hasta un picker interno de `abilities.js` — con "como mucho un Portal del tablero sin ocupar-y-visible"), y el matiz adversarial (provocar a propósito un duplicado del único requisito visible de OTRA rival) que sale solo de que `contexto.necesariosUnicosDeRivales` ya está presente en la llamada a `valorEsperadoDeAccion()` — sin caso especial. |
| `decidirMetamorfoNormal(vista, need)` / `decidirMetamorfoDificil(vista, need, esPropio, probabilidades, contexto)` | `función` | (Bloque 4, 4.6, exportadas solo para tests) El Metamorfo visible se transforma pagando 1 Gema unitaria (`COSTE_GEMA_METAMORFO`, interna). `'normal'`: SOLO beneficio propio, se transforma en el primer requisito de `need` aún no cumplido en la mesa, si `vista.gemasPropiasTotalExacto > 0` (proxy de "tiene con qué pagar"). `'dificil'`: evalúa CADA personaje de `need` restando siempre el coste de la Gema — reutiliza `valorEsperadoDeAccion()` sin ningún parámetro nuevo: si el personaje aún no está cumplido, el mecanismo normal de beneficio propio ya lo valora; si SÍ lo está porque una rival lo tiene como único ejemplar visible, el mecanismo de "denegación por duplicado" de esa misma función ya aplica (transformar el Metamorfo crea un segundo ejemplar en un Portal distinto al suyo) — el matiz adversarial sale solo de reusar la misma maquinaria con `need` completo, sin caso especial. Solo se activa con al menos una Gema de valor 1 (`vista.gemasUnitariasPropias`) y nunca elige una ficha ya ocupada (`vista.transformacionesOcupadas`). |
| `decidirOcultistaAdversarialNormal(vista, need)` | `función` | (Bloque 4, 4.5, exportada solo para tests) Ocultista puede alternar la visibilidad de un Portal YA VISIBLE (excepto una Centinela visible, restricción ya aplicada en `abilities.js`), no solo revelar uno oculto — heurística `'normal'` ADICIONAL a la compartida con Cronista: denegación GRATUITA, esconde el único ejemplar visible en toda la mesa de un requisito que hoy tiene una RIVAL. Comparte el criterio de selección de objetivo con `decidirCronistaAdversarialNormal` (interna `primerRequisitoUnicoDeRivalComoClaveHabilidad`) — solo cambia el efecto real, que decide `abilities.js`. `'dificil'` (dentro de `decidirHabilidadFaseBDificil`) evalúa el mismo uso adversarial sobre Portales visibles, sin el descuento `* 0.5` de Cronista (esconder deniega de inmediato, no a futuro). |
| `decidirAprendizNormal(vista, need)` / `decidirAprendizPropioDificil(vista, need, cumplidos, valorGemaNivel)` / `decidirAprendizAjenoAjenoDificil(vista, need, cumplidos, valorGemaNivel)` | `función` | (Bloque 4, 4.4, exportadas solo para tests) Aprendiz intercambia manos COMPLETAS de dos jugadoras, manteniendo la orientación de cada carta. `'normal'`: SOLO beneficio propio incluyéndose a sí mismo — si su propia carta conocida ya es útil no la cambia a ciegas; si no, busca una rival cuya carta pública conocida sí lo sea. `'dificil'` combina dos casos independientes (el de mayor valor esperado gana): (a) `decidirAprendizPropioDificil`, incluyéndose, comparando el valor de recibir la carta pública de cada rival frente a ceder la propia (`valorCartaEnManoPropia`, interna — mismo descuento "a futuro, en mano" `* 0.5` que ya usa Cronista; deliberadamente NO reutiliza `valorEsperadoDeAccion()`, pensada para cartas que acaban VISIBLES en un Portal, no para un simple cambio de mano); (b) `decidirAprendizAjenoAjenoDificil`, intercambio puramente adversarial de las manos de DOS RIVALES (el bot no se incluye) para desbaratar a la que va mejor posicionada, estimada por el recuento de Gemas por nivel (`gemasPorNivel`, nunca el valor exacto) — solo con al menos 2 rivales y si a la líder se le puede quitar algo que de verdad le convenía. |
| `decidirJugadaFaseA(vista, need)` / `decidirJugadaFaseADificil(vista, memoriaBot, need, invocationSet, lvl)` | `función` | (exportadas solo para tests) Decisión de Fase A por dificultad. `'normal'` prioriza completar la invocación activa con un único Portal bloqueante; si no, aplica el ajuste adversarial de bajo coste del Bloque 3 (`decidirJugadaAdversarialNormal`, interna): (1) denegación GRATUITA por duplicado si la carta conocida es requisito activo, ya está visible en Portal AJENO, y el propio bot no la tiene ya (no pierde nada); (2) si no, tapar un Portal ajeno que muestre, como única copia visible en toda la mesa, un requisito de la invocación activa. Solo con información visible ahora mismo, nunca memoria/probabilidad. `'dificil'` (desde 1.26.3) evalúa TODAS las combinaciones carta×Portal con `evaluarJugadasFaseA()` (`js/bot-estrategia.js`): reparto real de Gemas si la jugada cierra la invocación (propio menos la mejor rival), riesgo de dejar el cierre servido a la siguiente jugadora y valor de posición. Nunca propone jugar la carta oculta si `vista.tieneCartaOcultaPropia === false` (final de partida). |
| `decidirYJugarTurno(players, neutrals, botIdx, contexto, ejecutor?)` | `función` | Punto de entrada único: despacha por `players[botIdx].dificultad` (`HEURISTICAS_POR_DIFICULTAD`: `'normal'`, `'dificil'` o `'experta'`) y ejecuta el turno completo (Fases A-E) de la bot. `contexto = { levelIdx, invocationSet }`. Desde el Bloque 4, la MEMORIA (`window.memoriaBots[botIdx]`, historial bruto de nombres vistos por Portal) la mantienen AMBAS dificultades (antes solo `'dificil'`) — la necesita Cronomante para decidir con sentido en cualquier nivel; el conteo de cartas/probabilidad (`js/bot-probabilidad.js`) sigue siendo exclusivo de `'dificil'`. Fase B: desde el Bloque 4, AMBAS dificultades saben usar las 7 habilidades activas (`PERSONAJES_CON_HABILIDAD`, `utils.js`). `'normal'` con una condición simple y de bajo riesgo por habilidad (solo información visible ahora mismo o memoria bruta, nunca probabilidad): Ocultista/Cronista comparten la comprobación "falta algo del combo Y hay un Portal oculto legal", y cada una además por su cuenta puede denegar gratis el único requisito visible de una rival (`decidirOcultistaAdversarialNormal`/`decidirCronistaAdversarialNormal`, ambas actúan también sobre un Portal YA VISIBLE, no solo oculto); Cronomante (`decidirCronomanteNormal`), Estratega (`decidirEstrategaNormal`), Aprendiz (`decidirAprendizNormal`), Metamorfo (`decidirMetamorfoNormal`) y Maestro (`decidirMaestroNormal`) — todas arriba — solo por beneficio propio, nunca el matiz adversarial más elaborado (reservado a `'dificil'`). `'dificil'` decide por valor esperado en Gemas: además del beneficio propio, cada habilidad incorpora su propio matiz adversarial (denegar/tapar/duplicar el único requisito visible de una rival, con el mismo mecanismo `cubreNecesarioUnicoRival`/`necesariosUnicosDeRivales` que ya usa Fase A) salvo Aprendiz, que además puede intercambiar las manos de DOS rivales sin beneficio propio directo. Ambos niveles resuelven los `picker()`/`pickerPortal()` que abre `applyAbility()` programáticamente (mismo `#pickerSelect`/`#pickerOk` que usaría un clic humano; el objetivo ya calculado se pasa como `objetivoPreferido` — un único valor o un ARRAY alineado por paso, para habilidades de varios pasos como Cronomante) y lo que hace se describe siempre en tercera persona, incluyendo de quién es el Portal/mano afectado por la habilidad activada (`describirObjetivoHabilidad`, arriba). Termina simulando el clic en `#btnEndTurn`, que ya comprueba invocación, reparte Gemas, roba y avanza turno con la misma lógica que una jugadora humana. `ejecutor` (opcional, desde 1.29.0) lleva a cabo lo decidido: `{ jugar, activar, resumen, terminar }`; por defecto el de la web (`ejecutarJugada`, `aplicarHabilidad` + `crearUiAutomata`, sin resumen en `alert()` desde 1.32.0 porque cada paso se narra desde el historial, `ejecutarFinDeTurno`). Desde 1.32.0 cada heurística es un generador que se detiene (`yield 'faseA'`/`'faseB'`) tras cada acción; `decidirYJugarTurno` lo recorre del tirón (arena, simulaciones). |
| `jugarTurnoAutomataPasoAPaso(players, neutrals, botIdx, contexto, esperar)` | `función` | (1.32.0) El turno de la web, paso a paso: tras cada acción llama a `esperar(fase, seguir, abortar)`, que `nextTurn()` (`game.js`) usa para dejar ver cada jugada antes de la siguiente. |
| `establecerModeloPersonas(modelo)` / `obtenerModeloPersonas()` | `función` | (1.30.0) Modelo aprendido de cómo juegan las personas (`js/aprendizaje.js`). Si está fijado, la Experta simula los turnos de las personas con `decidirYJugarTurnoComoPersona` en vez de con la heurística Difícil. |
| `crearEjecutorMotor({ alJugar? })` | `función` | (1.29.0) Ejecutor sin interfaz, solo con el motor sobre `estado.partida`: juega con `jugarCarta`, aplica la habilidad con `aplicarHabilidad` + `crearUiAutomata` + `completarActivacion`, no muestra nada y no termina el turno (lo hace quien orquesta). Lo usa `tools/arena.mjs`. |

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

## js/bot-estrategia.js
**Propósito:** Evaluación estratégica de las jugadas de Fase A para la
dificultad `'dificil'` (desde 1.26.3). Funciones PURAS sobre la vista
saneada (`construirEstadoVisibleParaBot()`) y la distribución del conteo de
cartas (`estimarProbabilidadesPersonajes()`); nunca leen el estado real.
Pesos ajustables en el objeto mutable exportado `PESOS` (`rival`,
`posicion`, `amenaza`, y `costeCentral`, que resta la Fase B de
`'dificil'` en `js/bot.js` al activar un Portal central); el simulador `tools/arena.mjs` los cambia por
asiento para enfrentar ajustes distintos. Los usa también `'experta'`
(`js/bot-busqueda.js`) para puntuar cada mundo.

### Exportaciones

| Nombre | Tipo | Descripción |
|--------|------|-------------|
| `tableroDesdeVista(vista)` | `función` | Un elemento por Portal: `{ destKey, dueña, nombre, bloqueado }` (`destKey` en el formato de `listaPortalesConDestino()`, `dueña` = índice de jugadora o `null` si es central). |
| `aplicarJugadaEnTablero(tablero, destKey, nombre)` | `función` | Copia del tablero tras jugar `nombre` boca arriba en `destKey`; si es una Centinela, gira las demás Centinelas visibles. |
| `invocacionCerrada(tablero, need)` | `función` | Todos los Portales visibles y los requisitos presentes. |
| `recompensasSiCierra(tablero, need, valorGemaNivel, nJugadoras)` | `función` | Gemas por jugadora si se cierra: requisito único en Portal con dueña (valor medio del nivel), Maestro (+3 si es requisito, único y sin Pícaro visible), Pícaro (+1). Usa la apariencia (la vista no sabe si un personaje es un Metamorfo transformado). |
| `valorRelativo(ganancias, idx)` | `función` | `ganancias[idx] − PESO_RIVAL × máx(rivales)`. |
| `valorPosicional(tablero, need, valorGemaNivel, nJugadoras, idx)` | `función` | Requisitos únicos ya colocados (propios menos la mejor rival) × `FACTOR_POSICION`. |
| `valorAmenazaSiguiente(tablero, need, valorGemaNivel, nJugadoras, botIdx, siguienteIdx, probabilidadPorNombre)` | `función` | Valor esperado, para la bot, del cierre que podría hacer la siguiente jugadora con su carta privada (solo si le conviene a ella), × `FACTOR_AMENAZA`. |
| `valorJugadaCierta(tablero, destKey, nombre, ctx)` / `valorJugadaOculta(tablero, destKey, ctx)` | `función` | Valor de jugar una carta conocida, o media sobre las identidades posibles de la carta oculta. |
| `evaluarJugadasFaseA(vista, need, valorGemaNivel, probabilidadPorNombre)` | `función` | Lista `{ usaConocida, destKey, valor, cierra }` para cada carta × Portal. La usa `decidirJugadaFaseADificil()` (`js/bot.js`). |

---

## js/bot-busqueda.js
**Propósito:** Dificultad `'experta'` (1.29.0): búsqueda del turno
completo (Fase A + Fase B) con el motor real sobre mundos posibles
(determinización / PIMC). La única función que recibe la partida real es
`determinizar()`, que la copia y vuelve a repartir todo lo oculto.

### Exportaciones

| Nombre | Tipo | Descripción |
|--------|------|-------------|
| `BUSQUEDA` | `objeto` | `{ mundos: 8, ronda: 1, rival: 0.5 }`: mundos posibles por decisión; si se simula la ronda de las rivales tras el turno propio; y el `PESOS.rival` que usa la experta (lo aplica `bot.js` solo durante su turno). |
| `determinizar(partida, botIdx)` | `función` | Copia de la partida con la carta oculta de la bot, las cartas privadas de las rivales (y su mano entera si tienen la Clarividente visible) y el mazo repartidos al azar entre los personajes que la bot aún no ha visto (composición menos todas las cartas de los Portales, las de mano que ve y, en el análisis de equilibrio, las de `partida.cartasRequisito`), y las Gemas ajenas con el valor medio de su nivel. `tests/bot-busqueda.mjs` comprueba que no filtra nada oculto. |
| `enumerarFasesB(partida, botIdx)` | `función` | `[null, { origen, guion }...]`: no activar nada, o cada habilidad activable (`opcionesActivarHabilidad`) con cada combinación de elecciones, descubiertas recorriendo las peticiones `ui.pedir` del motor en copias desechables. |
| `aplicarConGuion(partida, botIdx, origen, guion, descubrir?)` | `función` | Aplica en `partida` la habilidad del origen (`'own:j'`/`'central:k'`) siguiendo las elecciones `guion` y cobra la activación; `false` si el guion no es aplicable. Exportada (1.34.1) para la saboteadora de `tools/equilibrio.mjs`. |
| `puntuarMundo(antes, despues, botIdx, construirVista, probabilidadPorNombre)` | `función` | Gemas ganadas por la bot − `PESOS.rival` × las de la rival que más gana, más `valorPosicional` y `valorAmenazaSiguiente` (`bot-estrategia.js`) sobre la mesa que queda. |
| `elegirFaseAExperta(partida, botIdx, candidatas, construirVista, probabilidadPorNombre, jugarRival)` | `función` | Media, entre mundos, del mejor turno (mejor Fase B) tras cada candidata de Fase A; devuelve la mejor con su `valor`. Con `BUSQUEDA.ronda`, tras ese turno juega en el mundo el turno de cada rival con `jugarRival(mundo, idx)` (en `bot.js`, la heurística `'dificil'`) y puntúa toda la ronda: Gemas propias − `PESOS.rival` × las de la mejor rival, más `valorPosicional`. |
| `elegirFaseBExperta(partida, botIdx, construirVista, probabilidadPorNombre)` | `función` | Con la Fase A ya jugada: la Fase B (o ninguna) con mejor media entre mundos, como `{ origen, guion, valor }` o `null`. `bot.js` pasa `guion` como `objetivoPreferido` a `crearUiAutomata`. |

---

## js/aprendizaje.js
**Propósito:** Aprendizaje autónomo de las autómatas a partir de las
jugadas de las personas (1.30.0), sin servidor. Puro: sin DOM, `window` ni
localStorage, y nunca recibe la partida real (solo vistas saneadas).

| Nombre | Tipo | Descripción |
|--------|------|-------------|
| `VERSION_ALMACEN`, `MAX_EJEMPLOS` (300), `MIN_EJEMPLOS_MODELO` (15) | `constante` | Formato del almacén, ejemplos guardados como máximo y mínimos para usar el modelo. |
| `crearAlmacenVacio()` / `normalizarAlmacen(datos)` | `función` | Almacén `{ version, partidas, ejemplos, modelo }`; `normalizarAlmacen` valida lo leído o importado y descarta lo corrupto. |
| `crearEjemplo({ vista, need, valorGemaNivel, probabilidadPorNombre, usaConocida, destKey })` | `función` | Ejemplo de entrenamiento: copia de la vista desde el asiento de la persona, sin nombres, y su jugada. |
| `anadirEjemplos(almacen, ejemplos)` | `función` | Añade y recorta a los `MAX_EJEMPLOS` más recientes. |
| `conPesos(pesos, fn)` | `función` | Ejecuta `fn` con `PESOS` (bot-estrategia.js) cambiados temporalmente. |
| `ajustarModelo(ejemplos)` | `función` | Máxima verosimilitud de las jugadas con `evaluarJugadasFaseA` + softmax: `{ rival, posicion, amenaza, beta, sesgoConocida, logVerosimilitud, acierto, ejemplos }`, o `null` si hay pocos ejemplos. |
| `logVerosimilitud(ejemplos, modelo)` | `función` | Log-verosimilitud media (diagnóstico y tests). |
| `modeloUtilizable(modelo)` | `función` | Si el modelo tiene datos suficientes y es válido. |
| `elegirJugadaComoPersona(vista, need, valorGemaNivel, probabilidadPorNombre, modelo, azar)` | `función` | Sortea una jugada de Fase A con el softmax del modelo. |

## js/aprendizaje-navegador.js
**Propósito:** Adaptador web de `js/aprendizaje.js`: localStorage
(`invocadores.aprendizaje`), panel `#panelAprendizaje` de la configuración y
entrega del modelo a `bot.js`.

| Nombre | Tipo | Descripción |
|--------|------|-------------|
| `initAprendizaje()` | `función` | Carga lo aprendido, llama a `establecerModeloPersonas` y conecta el panel (descargar, importar, borrar). Desde `index.js`. |
| `prepararEjemploPersona(partida, cartaIdx, destKey)` | `función` | Antes de `jugarCarta` en `ejecutarJugada()`: ejemplo si juega una persona, `null` si es autómata. |
| `guardarEjemploPersona(ejemplo)` | `función` | Tras una jugada válida: lo guarda. |
| `aprenderAlTerminarPartida()` | `función` | Desde `finalizarPartida()`: si jugaron personas, reajusta el modelo (diferido con `setTimeout`). |

---

## tools/arena.mjs
**Propósito:** Simulador de partidas sin navegador (1.29.0) para medir y
afinar la IA. Reparte como `setup.js` + `initGame()`, juega con
`decidirYJugarTurno(..., crearEjecutorMotor())` y `terminarTurno`/
`pasarTurno`, y resuelve la elección de la Clarividente como `render.js`.
Azar con semilla (`sembrarAzar`).

| Nombre | Tipo | Descripción |
|--------|------|-------------|
| `gestionarClarividente(partida)` | `función` | Exportada en 1.34.1: elección de la Clarividente al dejar de estar visible, como `render.js` (la usa también `tools/equilibrio.mjs`). |
| `sembrarAzar(semilla)` | `función` | Sustituye `Math.random` por un generador con semilla (mulberry32). |
| `prepararPartida(dificultades, invocationSet)` | `función` | Partida nueva sin DOM, una autómata por dificultad. |
| `jugarPartida(asientos, invocationSet, perfiles)` | `función` | Partida completa; asiento `'nivel'` o `'nivel@perfil'` (con `perfiles[perfil]` como `PESOS` y `BUSQUEDA` en sus turnos). Devuelve `{ puntos, ganadoras, invocaciones, turnos }`. |
| `torneo({ partidas, mesa, set, semilla, perfiles, aprender })` | `función` | Varias partidas rotando asientos; % de victorias y puntos medios por asiento. CLI: `node tools/arena.mjs --partidas 1000 --mesa experta,dificil,dificil`. Asiento `'persona@perfil'`: persona simulada (`tipo: 'humano'`, juega Difícil con esos pesos). Con `aprender` (CLI `--aprender 1`) registra sus jugadas y reajusta el modelo de las personas tras cada partida. |

`tools/ajustar-pesos.mjs`: búsqueda aleatoria de `PESOS` enfrentando cada
candidata a los pesos actuales en 2 y 3 jugadoras.

---

## tools/equilibrio.mjs
**Propósito:** (1.34.1) análisis de equilibrio por simulación masiva, sin
navegador, con el motor y las autómatas de la web. Añade dos perfiles que
solo existen aquí: `'caotico'` (carta y Portal al azar; la mitad de los
turnos, una habilidad al azar) y `'saboteador'` (prueba cada jugada en 4
mundos posibles con `determinizar`/`enumerarFasesB`/`aplicarConGuion` y
elige la que deja la invocación más lejos y reparte menos Gemas). Asiento
`'nivel-sin:A+B'` = juego restringido (nunca activa esas habilidades;
`'sin:todas'` = ninguna). Informe de resultados: Claude Doc «Invocadores:
análisis de equilibrio por simulación» (2026-11-07). Desde 1.34.2 también
el perfil `'peque'` (como `'caotico'`, pero no paga Gemas al activar: regla
de casa para una niña pequeña) y variantes de reglas que solo existen en el
análisis (`js/motor/variantes.js`): CLI `--variantes '{"duplicadoDaGema":true}'`,
`--aleatorias 1|ordenada|fichas|fichasSinRepetir|cartas|cartasVuelven|escalonada|escalonadaA` (requisitos al azar) e `--intercambio siempre|siAutomataGana|mitad`
(límite al intercambio con la autómata central de Experto).
Desde 1.34.5, `--derrota N` (derrota colectiva: con menos de N invocaciones
no gana nadie; mientras no se llega a N, las Expertas cooperan con
`PESOS.rival`/`BUSQUEDA.rival` a 0) y el perfil `'oportunista'` (bloqueadora
racional: juega como la Experta y bloquea como la saboteadora cuando va
primera y ya no arriesga la derrota colectiva). El resumen añade
`derrotaColectiva` y `turnosBloqueandoPorPartida`.

| Nombre | Tipo | Descripción |
|--------|------|-------------|
| `leerAsiento(spec)` | `función` | `'dificil@b-sin:Cronista'` → `{ nivel, perfil, prohibidas }`. |
| `distanciaACierre(partida)` | `función` | Cota inferior de cartas que faltan para cerrar la invocación activa: `max(Portales sin carta visible, requisitos sin ver)`. |
| `jugarPartidaAnalisis(asientos, opciones, perfiles)` | `función` | Una partida con métricas: puntos, ganadoras, invocaciones (nivel y turno), Gemas por personaje, bonus de Pícaro/Maestro, Entusiasta, duplicados, Gemas perdidas en Portales centrales, habilidades y jugadas por asiento, autómata central e intercambio. |
| `resumir(registros)` | `función` | Resumen con IC 95 %: victorias por perfil, por posición en el turno y por asiento de la mesa, invocaciones, niveles alcanzados, cómo acaba, victorias compartidas, margen, si gana la líder tras la primera invocación, victorias según uso de cada habilidad. |
| `FORMAS_ALEATORIAS` | `array` | (1.34.3) Formas de sortear requisitos: `'uniforme'`, `'ordenada'` (el trío con más copias va a la C), `'fichas'` (una ficha por copia; 3 personajes distintos por invocación, se pueden repetir entre invocaciones), `'fichasSinRepetir'`, `'cartas'` (al empezar cada invocación se roban del mazo hasta 3 personajes distintos, que salen del juego; quedan en `partida.cartasRequisito`, que `determinizar` descuenta) `'cartasVuelven'` (al completarse vuelven al mazo), `'escalonada'` (la C de las fichas de los personajes con 4 copias o más; la B y la A de toda la bolsa, cada una al completarse la anterior) y `'escalonadaA'` (igual, con un personaje de los más escasos en la A). |
| `setAleatorio(opciones, forma = 'uniforme')` | `función` | Set de requisitos decidido al empezar (formas uniformes y de fichas): 3 personajes distintos para C, B y A (sin Metamorfo ni Entusiasta) con las Gemas del set normal; `null` si no hay personajes suficientes. Las formas de cartas se resuelven con ganchos al empezar la partida y tras cada invocación. |
| `experimento({ mesa, partidas, opciones, semilla, rotar, perfiles, cantidades, apartar, variantes, aleatorias })` | `función` | Varias partidas rotando asientos; `cantidades` cambia copias de personajes del modo y `apartar` las cartas apartadas, solo durante el experimento; `variantes` activa interruptores de `VARIANTES` y `aleatorias` usa `setAleatorio()` en cada partida (todo se restaura al terminar). CLI: `node tools/equilibrio.mjs --mesa saboteador,experta,experta --partidas 120 --modo normal`. |

---

## js/setup.js
**Propósito:** Gestiona la pantalla de **configuración inicial** y lanza la partida.

### Exportaciones

| Nombre       | Tipo      | Descripción                                                                                       |
|--------------|-----------|---------------------------------------------------------------------------------------------------|
| `initSetup()`| `función` | - Si hay una partida guardada (`leerPartidaGuardada()`, `js/partida-guardada.js`), muestra `#panelRetomar` con "Retomar partida" (`retomarPartida()` de `game.js`) y "Descartar" (`borrarPartidaGuardada()`, con confirmación). <br>- Desde 1.33.0 pinta en `#listaJugadores` una fila por asiento (según `#numPlayers`, al momento, sin botón "Continuar"): interruptor 👤 Persona / 🤖 Autómata; una persona escribe su nombre, una autómata muestra su nombre (de `nombresDisponiblesParaBots()`, `bot.js`) y un `<select>` de nivel (`NIVELES_AUTOMATA`), uno por autómata. Todo con `createElement`, sin `innerHTML` con datos (`DEUDA_TECNICA.md` ítem 5). `#lblRitmoBots` solo se ve si hay alguna autómata. La configuración se recuerda en `localStorage['invocadores.menuInicio']`. <br>- `#btnStart.onclick`: `window.players = crearJugadoras(...)`, lee el modo (`#selModo`, que solo deja los sets que su mazo puede completar), `#selInvocationSet`, `#chkMadain` (solo en Avanzado; fijo en Experto) y `#chkEntusiasta` en `window.modo`/`invocationSet`/`madain`/`entusiasta`, reparte los Portales, `mostrarTablero()` (`game.js`) e `initGame()`. |
| `normalizarAsientos(previos)` | `función` | Devuelve siempre 5 asientos `{ tipo, nombre, dificultad, nombreBot }` saneados (lo leído de `localStorage` puede venir roto), con nombres de autómata únicos. |
| `crearJugadoras(asientos)` | `función` | Jugadoras de la partida a partir de los asientos: `{ name, tipo, hand, portals, gems }` + `dificultad` si es autómata; 3 Gemas de valor 1 cada una. Un nombre vacío toma uno por defecto no usado; nombres repetidos se numeran ("Ana 2"). |
| `NIVELES_AUTOMATA` | `const` | Niveles del selector: `'normal'`, `'dificil'`, `'experta'` con su etiqueta. |

---

## js/render.js
**Propósito:** Punto único de repintado y de preguntas a la jugadora. Desde 1.32.3 la única vista es la Mesa 3D (`js/mesa3d.js`): `render()` le pide que se pinte y `picker()` abre su hoja inferior. Aquí vive también la elección de la Clarividente, que se dispara al repintar.

### Exportaciones

| Nombre     | Tipo      | Descripción                                                                                          |
|------------|-----------|------------------------------------------------------------------------------------------------------|
| `picker(title, options, cb, onCancel?)` | `función` | Pregunta con varias opciones (`{ val, lbl, disabled? }`): delega en `pickerMesa()` (hoja inferior con botones grandes). Llama a `cb(valor)` al elegir, o a `onCancel()` (si se pasó) al cancelar. |
| `pickerPortal(title, opciones, cb, onCancel?)` | `función` | Como `picker()`, pero además los Portales válidos se pueden tocar en la mesa (`tocarPortal()` en `mesa3d.js` → `elegirPortalObjetivo()` en `actions.js`). `opciones` tiene el formato de `portalesConEstado()` (`val` = `"playerIdx:portalIdx"` o `"n:idx"`, con `disabled` ya calculado por la regla real de la habilidad). Fija `window.pickerObjetivoPortal = { opciones, cb }` mientras está abierto y lo limpia al aceptar o cancelar. Usada por Ocultista, Cronista, el primer paso del Cronomante y los dos de la Estratega. |
| `render(players, neutrals, levelIdx)` | `función` | Llama a `gestionarTransicionesClarividente()` y después a `renderMesa3D()`. Los parámetros se mantienen por compatibilidad; la mesa lee `estado.partida`. |
| *(interna)* `gestionarTransicionesClarividente(players)` | `función` | Corte inmediato de Clarividente, sin periodo de gracia (ver `docs/reglamento/REGLAMENTO.md`, nota de interpretación): llama a `actualizarClarividente()` y, para cada jugadora cuyo `hasClariActivo` acaba de pasar de `true` a `false` (comparado contra `player._clariVisiblePrev`), dispara `resolverEleccionClarividente()`, salvo que ya haya una pregunta abierta (`hayPickerMesaAbierto()` o `window.pickerObjetivoPortal`): entonces se reintenta en el siguiente `render()`. Vale para cualquier jugadora en cualquier momento, no solo en su turno. |
| *(interna)* `resolverEleccionClarividente(player)` | `función` | Aplica la elección real de qué carta de mano seguir viendo (`aplicarEleccionClarividente()` del motor). Humana: `picker()` con etiquetas neutras ("Mi carta de la izquierda"/"de la derecha"); cancelar reabre la pregunta. Autómata: se queda con la carta requerida por la invocación activa si la hay, si no al azar. |

---

## js/actions.js
**Propósito:** Acciones de la interfaz durante el turno: seleccionar y jugar carta (Fase A), activar habilidad (Fase B) y terminar turno. No tiene reglas: llama al motor (`js/motor/acciones.js`) y presenta sus eventos. Las usa la Mesa 3D, y el autómata usa `ejecutarJugada()`/`ejecutarFinDeTurno()`.

### Exportaciones

| Nombre              | Tipo      | Descripción                                                                                                                                        |
|---------------------|-----------|----------------------------------------------------------------------------------------------------------------------------------------------------|
| `ejecutarJugada(cartaIdx, destKey)` | `función` | Fase A: llama a `jugarCarta()` del motor y, si es válida, la anota en el historial de jugadas (con su estela de la mano al Portal), guarda el ejemplo de aprendizaje, limpia la selección, avisa al modo espectáculo y refresca. `destKey` = `'p:<idx>'` \| `'n:<idx>'` \| `'a:<pi>:<pj>'`. Devuelve `true`/`false`. |
| `conHistorialHabilidad(personaje, jugadora, origen, { detalle, elegidos }, onComplete)` | `función` | (1.32.0) Envuelve el `onComplete` de una habilidad (Fase B humana y del autómata) para anotarla en el historial de jugadas con los Portales que cambiaron (foto antes/después), la frase de lo elegido y sus estelas. |
| `ejecutarFinDeTurno()` | `función` | Botón "Terminar turno" de la mesa; también lo llama el autómata. `terminarTurno()` del motor y presentación de sus eventos (`accionInvalida` → aviso, `invocacionCompletada` → escena o aviso, `partidaTerminada` → `finalizarPartida()` al acabar las escenas); si la partida sigue, al acabar las escenas `pasarTurno()` y `nextTurn()`. |
| `seleccionarCartaMano(idx)` | `función` | Toque en una carta de la mano: la selecciona o la deselecciona (`window.selectedCardIdx`). No hace nada si ya se jugó carta. |
| `jugarEnPortal(destKey)` | `función` | Juega la carta seleccionada en ese Portal (`ejecutarJugada()`). |
| `cancelarSeleccion()` | `función` | Deshace la selección de carta. |
| `elegirPortalObjetivo(key)` | `función` | Toque en el Portal objetivo de una habilidad en curso (ver `pickerPortal()`); no hace nada si no hay ninguna o si esa opción está `disabled`. |
| `activarHabilidad()` | `función` | Fase B, una vez por turno. Comprueba los límites con `validarFaseB()` y avisa si no se puede. Con una investigación de Cronomante pendiente (`window.cronomantePortalInvestigado`) salta directamente a completarla con el `onComplete` guardado en `window.cronomanteOnComplete`. Si no, pregunta con `picker()` las opciones de `opcionesFaseB()` y llama a `applyAbility()` con un `onComplete` que cobra con `completarActivacion()` (en un Portal central, si hay Gema de asterisco y Gemas de 1, pregunta con `preguntarMesa()` cuál usar). |

---

## js/game.js
**Propósito:** Control central del **flujo de la partida**: creación de mazo, reparto y gestión de turnos.

### Exportaciones

| Nombre          | Tipo      | Descripción                                                                                                     |
|-----------------|-----------|-----------------------------------------------------------------------------------------------------------------|
| `initGame()`    | `función` | - Construye `window.deck` con `prepararMazo(estado.partida)` (`utils.js`): mazo del modo elegido (29 Introductorio, 32 Normal, 41 Avanzado/Experto, +2 Entusiastas si se eligió la expansión), barajado y sin las cartas que el modo aparta (2 en Normal y Avanzado). En Modo Experto crea `automataCentral`. <br>- Reparte 1 carta visible + 1 oculta a cada jugador. <br>- Inicializa `window.levelIdx`, `window.turn`, los campos de turno, `window.memoriaBots` y `window.invocacionesCompletadas`. <br>- Inicia primer turno con `nextTurn()`. |
| `nextTurn()`    | `función` | - Si `comprobarFinPorManoVacia()` (`js/motor/acciones.js`) devuelve fin de partida, llama a `finalizarPartida()` con su motivo. <br>- Si no, guarda la foto de la partida con `guardarPartidaEnCurso()` (`js/partida-guardada.js`), la que se retoma desde el menú de inicio. <br>- Llama a `reiniciarCamposDeTurno()` (`js/motor/estado.js`): `played`, `habilidadUsadaEsteTurno`, `selectedCardIdx`, `cronomantePortalInvestigado`, `cronomanteOnComplete` y `pickerObjetivoPortal` vuelven a su valor inicial (una investigación de Cronomante pendiente no sobrevive a un cambio de turno). <br>- Si la jugadora activa no tiene cartas en mano, termina la partida vía `finalizarPartida()`. <br>- Anuncia el turno en la mesa con `anunciarTurnoMesa()` (telón con varias humanas, rótulo si no; el turno de una autómata además se narra, `js/narrador.js`). Anota el inicio del turno en el historial de jugadas (`registrarEnHistorial()`, `js/historial.js`), después de guardar la foto para no duplicarlo al retomar. <br>- Llama a `render()`. <br>- Si es autómata, tras `pausaAntesDeJugar()` llama a `jugarTurnoAutomataPasoAPaso()` (`js/bot.js`) con una función `esperar` que, tras cada paso (carta jugada, habilidad), espera a que acaben las escenas y hace la pausa `pausaTrasPaso()` (`js/narrador.js`) antes de seguir, o abandona el turno si se salió de la partida. El turno termina con `ejecutarFinDeTurno()` — eso ya vuelve a llamar a `nextTurn()` internamente (mismo camino que el botón humano), encadenando automáticamente turnos de autómatas consecutivos hasta que le toque a una jugadora humana. |
| `finalizarPartida(motivo)` | `función` | Borra la partida guardada, deja que las autómatas aprendan de la partida (`aprenderAlTerminarPartida()`), marca `window.juegoTerminado` y muestra el marcador final de la mesa (`mostrarFinMesa()`) con la clasificación de `calcularResultadoFinal()` (`utils.js`, REGLAMENTO.md "Final de la partida") y el botón de jugar otra vez (`resetJuego()`). En Modo Experto antes pregunta a cada persona empatada en la puntuación más baja si cambia sus Gemas con la autómata central (`preguntarMesa()`; una autómata jugadora cambia si le conviene) y clasifica con `resultadoFinalExperto()`. Llamada desde `game.js` (mano vacía) y desde `actions.js` (última invocación completada) — por eso debe permanecer `export`ada. |
| `resetJuego()`  | `función` | Muestra la pantalla de configuración (y cierra `#helpModal`), limpia la mesa con `salirDeMesa()`, vacía el estado de partida con `reiniciarPartida()` (`js/motor/estado.js`, conserva el set de invocación elegido) y vuelve a llamar a `initSetup()`. |
| `mostrarTablero()` | `función` | Oculta el menú de inicio; la mesa aparece con el primer `render()`. La usan el botón Iniciar (`setup.js`) y `retomarPartida()`. |
| `salirAlMenu()` | `función` | "Salir al menú de inicio" del menú ☰ de la mesa. Pide confirmación con `preguntarMesa()` ( avisa si lo hecho en este turno se perderá) y vuelve al menú: sube un contador interno para que el `setTimeout` pendiente de una autómata no juegue en la partida abandonada, corta las escenas con `detenerEspectaculo()` y llama a `resetJuego()`. La partida queda guardada por `nextTurn()`. |
| `retomarPartida()` | `función` | Botón "Retomar partida" del menú de inicio: carga la foto de `leerPartidaGuardada()` con `cargarPartida()` (`js/motor/estado.js`), muestra la mesa y llama a `nextTurn()`, que repite el turno guardado desde el principio. Devuelve `false` si no había partida guardada. |

---

## js/partida-guardada.js
**Propósito:** Salir de la partida y retomarla después. Al empezar cada turno (`nextTurn()`) se guarda una foto de `estado.partida` (`serializarPartida()`) en `localStorage['invocadores.partidaGuardada']`, con una copia en memoria por si el navegador no deja guardar. Se guarda al **empezar** el turno porque ahí la partida está completa (sin pickers, escenas ni habilidades a medias): quien sale a mitad de turno lo repite desde el principio al volver. Sobrevive a recargar la página. Sin DOM.

### Exportaciones

| Nombre | Tipo | Descripción |
|--------|------|-------------|
| `guardarPartidaEnCurso(partida)` | `función` | Guarda `{ partida (JSON), fecha, nombres, turnoDe, invocaciones }`. No guarda partidas vacías ni terminadas. |
| `leerPartidaGuardada()` | `función` | Devuelve ese registro, o `null` si no hay uno válido (o la partida ya había terminado). |
| `borrarPartidaGuardada()` | `función` | Lo olvida. La llaman `finalizarPartida()` (una partida terminada no se retoma) y el botón "Descartar" del menú de inicio. |
| `describirPartidaGuardada(registro)` | `función` | Texto del aviso "Tienes una partida a medias" (`#panelRetomar` en `setup.js`): jugadoras, a quién le toca, invocaciones completadas y fecha. |

---

## js/historial.js
**Propósito:** (1.32.0) Historial de jugadas de la partida en frases para leer en la mesa: inicio de turno, carta jugada, habilidad activada (con lo elegido y cómo quedan los Portales que cambiaron) e invocación completada. Vive en `estado.partida.historial` (se guarda y se retoma con la partida; `determinizar()` no lo copia a sus mundos). Solo nombra cartas públicas. Sin DOM.

### Exportaciones

| Nombre | Tipo | Descripción |
|--------|------|-------------|
| `registrarEnHistorial(partida, { tipo, jugadora, personaje, texto, portales, trazos })` | `función` | Añade una entrada (`tipo`: `'turno'`, `'jugada'`, `'habilidad'`, `'invocacion'`) con su número de turno y avisa a quien escuche. `trazos` (`[{ desde, hacia, motivo }]`) no se guarda, solo se pasa a los oyentes. Máximo `MAX_ENTRADAS` (400). |
| `escucharHistorial(fn)` | `función` | `fn(entrada, partida)` con cada entrada nueva; devuelve cómo dejar de escuchar. |
| `turnoActual(partida)` | `función` | Número del turno en curso. |
| `claveDeDestino(destKey, jugadora)` / `claveDeOrigenHabilidad(origen, jugadora)` / `pilaDeClave(partida, clave)` | `función` | Pasan de los formatos de jugar (`p:`/`a:`/`n:`) y de habilidad (`own:`/`central:`) a la clave absoluta `"i:j"`/`"n:k"`, y de ahí a la pila. |
| `etiquetaPortal(partida, clave, actorIdx)` / `nombreVisible(carta)` / `describirCima(partida, clave)` | `función` | Piezas de texto en tercera persona ("su Portal 2", "el Portal 1 de Ana", "el Portal central 1"; "Metamorfo (como X)"; "muestra X" / "queda bocabajo" / "queda vacío"). |
| `fotoPortales(partida)` / `portalesCambiados(antes, despues)` | `función` | Firma pública de cada Portal y qué Portales cambiaron entre dos fotos. |
| `textoJugada` / `textoHabilidad` / `textoInvocacion` | `función` | Frases de cada tipo de entrada. |
| `trazosHabilidad(partida, { personaje, jugadora, origen, cambiados, elegidos })` | `función` | Movimientos de una habilidad para sus estelas (Estratega: ida y vuelta entre los dos Portales; Cronista: del Portal a la mano; Maestro: de la mano al Portal; Aprendiz: entre las dos manos; resto: del Portal de origen a los que cambiaron). |

---

## js/narrador.js
**Propósito:** (1.32.0) Hace legible lo que pasa en la mesa, sobre todo en los turnos de las autómatas. Solo presentación. Escucha el historial y: narra cada paso de una autómata en un rótulo (`.narrador`) que se queda mientras ella hace pausa; resalta los Portales afectados en el turno con el color del motivo y el número de paso; dibuja estelas de polvo mágico de origen a destino (`.traza-capa`, colores en `COLOR_MOTIVO`), después de las escenas del modo espectáculo; y abre la ventana del historial.

### Exportaciones

| Nombre | Tipo | Descripción |
|--------|------|-------------|
| `initNarrador()` | `función` | Al cargar la página (`index.js`): escucha el historial y conecta `#selRitmoBots` (el historial se abre desde la mesa). |
| `atributosDestacado(clave)` | `función` | `{ clase, attrs }` para pintar un Portal resaltado; la usan `render.js` (`portalCardHtml`) y `mesa3d.js` (`portalHtml`). |
| `abrirHistorial()` | `función` | Ventana con todas las jugadas, por turno y la más reciente arriba. También desde 📜 en la Mesa 3D y su menú ☰. |
| `reiniciarNarrador()` | `función` | Al salir, retomar o empezar otra partida: quita rótulo, resaltados, estelas y ventana. |
| `ritmoAutomatas()` / `fijarRitmoAutomatas(r)` / `RITMOS` | `función` / `const` | Ritmo de las autómatas (`rapido`/`normal`/`pausado`), en `localStorage['invocadores.ritmoAutomatas']`. |
| `pausaTrasPaso(fase)` / `pausaAntesDeJugar(base)` | `función` | Pausas (ms) del turno de una autómata, según el ritmo. |
| `COLOR_MOTIVO` / `colorMotivo(motivo)` | `const` / `función` | Color de estela y resaltado: carta jugada, o el personaje de la habilidad. |

---

## js/index.js
**Propósito:** **Entry point** con `<script type="module">` que expone variables globales y arranca la aplicación.

### Contenido principal

```js
import { instalarAliasGlobales } from './motor/estado.js';

// Estado global: un único objeto serializable (js/motor/estado.js).
// window.players, window.turn, etc. son alias (getter/setter) de ese objeto.
instalarAliasGlobales(window);

// Exponer constantes
window.LEVELS = LEVELS;
window.INVOCATION_SETS = INVOCATION_SETS;

document.addEventListener('DOMContentLoaded', () => {
  initSetup();
  initEspectaculo();
});
```

---

**Flujo de carga**  
1. Carga de `index.js` como módulo.  
2. Llamada a `initSetup()`: muestra form de configuración (jugadoras, nombres, set de invocación).  
3. Pulsar **Iniciar partida** reúne asientos, modo y opciones y llama a `initGame()`.  
4. `initGame()` construye el mazo según el modo elegido, reparte cartas y llama a `nextTurn()`.  
5. Cada turno: Fase A (jugar carta, obligatoria), Fase B opcional (activar como mucho una habilidad, propia gratis o central pagando), comprobación de invocaciones y reparto real de Gemas, robo y cambio de turno.

---

## js/escenas3d.js

Los dos modos de ver la partida (1.36.0): **Mesa** (cartas en perspectiva
con escenas 2D) y **Escenario** (todo en 3D, `js/personajes3d/tablero.js`).
Solo presentación; no toca reglas.

- `escenarioActivo()` / `fijarEscenario(valor)`: modo elegido, guardado en
  `localStorage['invocadores.personajes3d']` ('1' = Escenario; la Mesa es lo
  normal). Se cambia en `#chk3D` (inicio) o en el menú ☰ en plena partida.
- `cargarTablero()` / `tablero()`: carga perezosa del Escenario (Three.js y
  `js/personajes3d/` solo se descargan al elegirlo) y el módulo ya cargado.
- `escenarioEnUso()`: elegido, cargado y en pantalla.
- `anunciarEscenario(evento)`: `espectaculo.js` cuenta lo que ha pasado
  (`{ tipo: 'carta' | 'habilidad' | 'invocacion', ... }`, solo datos públicos).
- `escenarioOcupado()` / `cuandoLibreEscenario()`: el turno espera a que
  terminen las animaciones (los usa `cuandoTermineEspectaculo()`).
- `reiniciarEscenario()`: partida nueva o salida al menú.
- `sonido3dActivo()` / `fijarSonido3D(valor)`: sonido sintetizado
  (`localStorage['inv3d.sonido']`, apagado por defecto).
- `initEscenas3D()`: enlaza `#chk3D` de la pantalla de inicio.

## js/personajes3d/

Motor 3D (Three.js vendorizado en `vendor/three`). Lo usan el Escenario de
la partida (`tablero.js`) y la maqueta `prototipos/personajes-3d.html`
(`main.js` + `escenas.js`).

- `tablero.js` (1.36.0): el Escenario jugable. `actualizar({ vista,
  interaccion, margenes })` recibe la vista pública de `construirVistaMesa()`
  (una carta que no se puede ver llega sin nombre y se dibuja como un
  encapuchado opaco sin modelo dentro) y qué Portales brillan
  ('destino' | 'objetivo' | 'bloqueado' | 'activable'); compara con lo que
  enseña y lo escenifica (la figura camina y sube la escalinata, se quita el
  manto, se voltea, el Metamorfo gira, el Estratega intercambia, llega la
  criatura y reparte Gemas, un Portal nuevo se alza). `anunciar(evento)`,
  `ocupado()`, `cuandoLibre()`, `mostrar()`, `ocultar()`, `reiniciar()`,
  `fijarAlTocar(fn)` (toques: `{ tipo: 'portal', clave, doble }` o
  `{ tipo: 'mano', jugadora, k, cv }`), `reencuadrar()`,
  `recolocarPortales()`, `fijarSonido()`, y para pruebas
  `puntoEnPantalla()` / `queHayEn()`. Gestos: arrastrar gira, pellizco o
  rueda acercan, dos dedos (o clic derecho / mayúsculas) desplazan, mantener
  pulsado un Portal lo mueve (`localStorage['inv3d.tablero']`), doble toque
  en un hueco vuelve a ver toda la mesa.
- `escenas.js`: `ESCENAS` (escenas de la maqueta), `reproducir(id)`,
  `ponerNombres(nombres)`, `montarEscenario()`, `configurar()`,
  `modoColocar()`, `restablecerPortales()`.
- `modelos.js`: `construirModelo(nombre)` (personajes, animales y criaturas
  hechos por código, con telas pintadas y articulaciones).
- `personajes.js`: actores (`crearActor(nombre, pos, { capa, rumbo, fijo })`,
  `quitarActor`, `caminar`, `conjurar`, `quitarCapa`, `aclararCapa`,
  `opacarCapa`, `transformar`…), `INFO`, `POSES`.
- `portales.js`: `crearPortal`, `encender`, `nombrarPortal`, `pergamino`.
- `efectos.js`: partículas (`chispas`, `absorber`, `humo`, `onda`), `rayo`,
  `destello`, `gema`.
- `mundo.js`: renderizador, cámara, tweens, `pausar()` / `reanudar()`,
  `siempre(fn)` (devuelve con qué darlo de baja).
- `sonido.js`: sonidos sintetizados con Web Audio (`S`).

## js/espectaculo.js
**Propósito:** **Modo espectáculo**: capa de presentación que escenifica a pantalla completa lo que ya ha pasado en la partida (bajar una carta a un Portal, aplicar una habilidad, completar una invocación). No decide nada ni cambia reglas. Usa el arte original de `assets/personajes/*.svg` (personajes de cuerpo entero, la carta del Portal y las criaturas de Cirelia, Baelorith y Aelgorth), convertido con `node tools/rasterizar_svg.cjs && python3 tools/generar_figuras.py` en `assets/figuras/*.webp`, `assets/invocaciones/*.webp` y `assets/portal.jpg`, y los estilos de `espectaculo.css`. Solo muestra la cara de una carta si es pública en la mesa (o lo era antes de la acción); manos y cartas tapadas se dibujan siempre con el reverso. Las escenas van en cola, se aceleran si se acumulan (turnos seguidos de autómatas) y se saltan con un clic o Escape. Respeta `prefers-reduced-motion`.

### Exportaciones

| Nombre | Tipo | Descripción |
|--------|------|-------------|
| `initEspectaculo()` | `función` | Conecta el interruptor de la cabecera (`#btnEspectaculo`) y la casilla de la configuración (`#chkEspectaculo`). La preferencia se guarda en `localStorage` (`invocadores.espectaculo`); por defecto está activado. Llamada desde `index.js`. |
| `espectaculoActivo()` / `fijarEspectaculo(bool)` | `función` | Lee / cambia el interruptor. Al desactivarlo se descartan las escenas pendientes. |
| `anunciarCartaJugada(jugadoraIdx, destKey)` | `función` | Fase A, llamada desde `jugarCartaSeleccionadaEn()` (`actions.js`) justo después de apilar la carta. Escena: el Portal se abre, el personaje sale de él y lo que había antes encima "pasa al pasado". Centinela añade su onda de escudo. |
| `envolverHabilidad(name, ownerIdx, stack, onComplete)` | `función` | Fase B. Devuelve un `onComplete` envuelto: hace una foto pública de la mesa al activar y, cuando la habilidad se aplica de verdad, la compara con la de después y lanza la escena propia de cada personaje (Metamorfo se transforma conservando su humo y su silueta; Maestro hace bajar la carta de la otra jugadora a su Portal; Cronomante trae una carta de la pila —el pasado— al Portal —el presente—; Cronista, Ocultista, Estratega, Aprendiz). Si se cancela un picker, no hay escena. La usan `actions.js` y `bot.js`. |
| `anunciarInvocacion({ nivel, nombre, need, recompensas })` | `función` | Escena de invocación completada (los personajes requeridos convergen en el círculo y aparece el nombre de la invocación con las Gemas que recibe cada jugadora, solo el número, nunca el valor). Devuelve `true` si se escenificó, en cuyo caso `actions.js` no muestra el `alert()` de texto. |
| `rutaFigura(nombre)` / `rutaCriatura(nombreInvocacion)` | `función` | Ruta del arte de cuerpo entero de un personaje, o de la criatura de una invocación (solo Cirelia, Baelorith y Aelgorth tienen); `null` si no hay. Las usa también `render.js` para los retratos pequeños del panel de la invocación activa. |
| `detenerEspectaculo()` | `función` | Corta la escena en curso y vacía la cola al salir al menú. Las esperas de `cuandoTermineEspectaculo()` se descartan sin resolverse, para que no avance el turno de una partida abandonada. |
| `hayEspectaculoEnCurso()` / `cuandoTermineEspectaculo()` | `función` | Para esperar a la cola de escenas: `ejecutarFinDeTurno()` retrasa el avance de turno (y su aviso "Turno de ...") hasta que terminan, con `window.avanceTurnoPendiente` como guarda contra un doble clic; la última invocación espera antes de mostrar el marcador final. |

---

## js/vista-mesa.js
**Propósito:** Modelo de la vista **Mesa 3D**: traduce `estado.partida` a lo que cada asiento enseña en la pantalla compartida. Puro (sin DOM ni `window`), probado en `tests/vista-mesa.mjs`. Misma regla que `render.js`: una carta que quien mira no puede ver sale con `nombre: null`, así que su nombre nunca llega al DOM.

### Exportaciones

| Nombre | Tipo | Descripción |
|--------|------|-------------|
| `construirVistaMesa(partida, { asientoPropio })` | `función` | Cada carta visible lleva `nombre` (identidad real), `apariencia` (`aspecto \|\| name`, lo que cuenta para la invocación) y, si es un Metamorfo transformado, `ficha` (el personaje de la ficha que tiene encima: se pinta la carta del Metamorfo con un medallón, no la del personaje). Vista completa: invocación activa con el estado de cada personaje requerido, asiento propio (abajo), rivales en orden de turno, Portales centrales, mazo y fase del turno. El asiento propio ve sus cartas "de dueña" solo si es humana y es su turno, o si es la única humana de la partida. Una Clarividente visible oculta la mano entera al resto. Gemas: total exacto solo para quien ve como dueña; el resto, por nivel y las de asterisco reveladas. Con la partida terminada, todas las Gemas de todas salen bocarriba (`gemas.valores`: valor y nivel de cada una) con su total. |
| `elegirAsientoPropio(players, turno, ultimaHumana)` | `función` | Qué jugadora va abajo: la activa si es humana; en el turno de una autómata, la última humana (contra autómatas la humana no se mueve). |
| `contarHumanas(players)` | `función` | Número de jugadoras humanas (decide si hace falta el telón para pasar el móvil). |
| `estadoInvocacion(partida)` | `función` | Nivel, nombre y estado (`falta` / `esta` / `repetido`) de cada personaje requerido, contado por apariencia como el motor. |
| `claveJugar(turno, jugadora, portal)` / `claveObjetivo(jugadora, portal)` | `función` | Claves de Portal en los formatos de `jugarCarta` (`p:j`, `a:i:j`, `n:k`) y de `portalesConEstado` (`i:j`, `n:k`). |
| `firmaPortal(portalVista)` / `cambioPortal(antes, ahora)` | `función` | Firma pública de un Portal y tipo de cambio entre dos pintados (`entra`, `voltea`, `sale`, `transforma` si el mismo Metamorfo cambia de ficha), para animarlo. |
| `pistaTurno(vista, { haySeleccion, eligiendoObjetivo })` | `función` | Texto de ayuda de la barra de acciones. |

---

## js/mesa3d.js
**Propósito:** Vista **Mesa 3D**, la interfaz del simulador (la vista clásica en columnas se retiró en 1.32.3), pensada para jugar con el dedo en el móvil y también usada en ordenador (estilos en `mesa3d.css`, solo CSS 3D, sin librerías; `body.vista-mesa` es una clase fija en `index.html`). Mesa en perspectiva con cartas 3D (cara y dorso), tu mano abajo en abanico, rivales arriba y Portales centrales en medio. No contiene reglas: actúa con las acciones exportadas de `actions.js` (`seleccionarCartaMano`, `jugarEnPortal`, `elegirPortalObjetivo`, `activarHabilidad`, `cancelarSeleccion`, `ejecutarFinDeTurno`) y `salirAlMenu()` de `game.js`. Borra al cargar la antigua preferencia `invocadores.vista`.

Interacción: tocar una carta de la mano la levanta y los Portales brillan; tocar un Portal la juega (la carta vuela hasta él). También se puede arrastrar con el dedo. Tocar un Portal sin carta elegida lo amplía; en la Fase B los Portales con habilidad activable llevan un ✦ y, al tocarlos, ofrecen activarla. Los `picker()` se convierten en hojas inferiores con botones grandes; si piden un Portal, la hoja es compacta y los Portales válidos se pueden tocar en la mesa. `alert()` se muestra como aviso flotante que no bloquea. Desde 1.28 cada cambio se celebra con efectos en una capa aparte (`.m-efectos`): onda y chispas al entrar o aterrizar una carta, destello al voltear o transformar, salto del contador de Gemas al ganar, chip de requisito que se ilumina al cumplirse y, al completar una invocación (sin el modo Escenas), rayos, la criatura y temblor de la mesa. La pantalla de inicio también se rediseña en esta vista (cabecera con las criaturas, botones redondeados, selectores + / −). Con varias humanas, cada cambio de turno muestra un telón para pasar el móvil sin enseñar la mano. El menú ☰ de la barra superior incluye "Salir al menú de inicio" (`salirAlMenu()` en `game.js`).

### Exportaciones

| Nombre | Tipo | Descripción |
|--------|------|-------------|
| `initMesa3D()` | `función` | Prepara la pantalla de inicio, conecta los toques y el arrastre y envuelve `alert()` (aviso flotante durante la partida). Llamada desde `index.js`. |
| `renderMesa3D()` | `función` | Pinta la mesa. La llama `render()` en cada pintado. Solo reescribe el DOM si el HTML cambia, y anima los Portales que cambian (`cambioPortal`). |
| `pickerMesa(titulo, opciones, cb, onCancel)` | `función` | Hoja inferior de `picker()`; `render.js` delega siempre en ella. |
| `hayPickerMesaAbierto()` | `función` | Para que la elección de la Clarividente (`render.js`) espere si ya hay una pregunta abierta. |
| `anunciarTurnoMesa(jugadora, esAutomata)` | `función` | Cambio de turno en la mesa (telón o rótulo). La llama `nextTurn()`. |
| `retardoAutomata()` | `función` | Pausa antes de que juegue una autómata (1,3 s, para poder seguir su jugada). |
| `mostrarAviso(texto)` | `función` | Aviso flotante. |
| `preguntarMesa(titulo, opciones, responder)` | `función` | Pregunta de varias opciones en hoja inferior (sustituye a `confirm()`; la usa `actions.js` para elegir entre revelar la Gema de asterisco o pagar una Gema de 1). |
| `mostrarFinMesa({ motivo, resultado }, alJugarOtra)` | `función` | Marcador final con confeti (clasificación de `calcularResultadoFinal`), botón para jugar otra vez y opción de ver cómo ha quedado la mesa. Lo llama `finalizarPartida()` después de repintar la mesa (así se ven las Gemas repartidas en la última invocación). |
| `salirDeMesa()` | `función` | Limpia la mesa al volver al menú (`resetJuego()`). |

---

## js/motor/estado.js
**Propósito:** Fase 1 de la separación motor / interfaz (ver `docs/ARQUITECTURA_MOTOR.md`). Reúne todo el estado de una partida en un único objeto plano y serializable (`estado.partida`) y separa aparte el estado propio de la interfaz (`estado.ui`). Sin DOM ni `window`: funciona igual en Node. Los nombres antiguos (`window.players`, `window.turn`...) siguen funcionando como alias.

### Exportaciones

| Nombre | Tipo | Descripción |
|--------|------|-------------|
| `estado` | `objeto` | Contenedor único: `estado.partida` (reglas, serializable) y `estado.ui` (interfaz, puede contener funciones). Accesible también como `window.estado`. |
| `CLAVES_PARTIDA` | `constante` | Claves de `estado.partida`: `players`, `neutrals`, `deck`, `levelIdx`, `turn`, `played`, `habilidadUsadaEsteTurno`, `invocationSet`, `juegoTerminado`, `cronomantePortalInvestigado`, `invocacionesCompletadas`, `memoriaBots`. |
| `CLAVES_UI` | `constante` | Claves de `estado.ui`: `selectedCardIdx`, `cronomanteOnComplete`, `pickerObjetivoPortal`, `avanceTurnoPendiente`. Nunca se serializan. |
| `crearEstadoPartida(invocationSet)` | `función` | Devuelve un estado de partida vacío. |
| `crearEstadoUi()` | `función` | Devuelve un estado de interfaz vacío. |
| `reiniciarCamposDeTurno()` | `función` | Restablece los campos que se limpian al empezar cada turno (usada por `initGame()` y `nextTurn()`). |
| `reiniciarPartida()` | `función` | Vacía la partida y la interfaz, conservando `invocationSet` (usada por `resetJuego()`). |
| `serializarPartida(partida?)` | `función` | Devuelve `estado.partida` como texto JSON. |
| `cargarPartida(json)` | `función` | Sustituye el estado de partida por un JSON (o un objeto) generado con `serializarPartida`; rellena claves que falten, descarta las desconocidas y reinicia la interfaz. |
| `instalarAliasGlobales(destino)` | `función` | Define en `destino` (en el navegador, `window`) una propiedad getter/setter por cada clave de partida y de interfaz, que lee y escribe en `estado`. Llamada desde `index.js`. Los tests la usan con un objeto cualquiera. |

---

## js/motor/acciones.js
**Propósito:** Fase 2 de la separación motor / interfaz (ver `docs/ARQUITECTURA_MOTOR.md`). Las reglas del turno como funciones puras sobre `partida` (el objeto `estado.partida` de `js/motor/estado.js`): validan la acción, cambian la partida y devuelven una lista de eventos. Sin DOM, sin `window`, sin avisos. Eventos: `accionInvalida { motivo }` (la partida no cambia), `cartaJugada { jugadora, destino, carta }`, `manosRepuestas`, `invocacionCompletada { nivel, nombre, need, recompensas }`, `partidaTerminada { motivo }`, `habilidadAplicada { jugadora, origen, personaje }`.

### Exportaciones

| Nombre | Tipo | Descripción |
|--------|------|-------------|
| `pilaDeDestino(partida, jugadora, destino)` | `función` | Traduce `'p:<j>'` (Portal propio), `'n:<k>'` (central) o `'a:<i>:<j>'` (Portal de otra jugadora) a su pila, o `null` si no existe. |
| `invocacionActiva(partida)` | `función` | `{ nivel, nombre, need, gemas }` de la invocación activa según `levelIdx` e `invocationSet`, o `null` si ya no queda ninguna. |
| `jugarCarta(partida, { cartaIdx, destino })` | `función` | Fase A: valida (partida en curso, no haber jugado, carta y Portal existentes), apila la carta bocarriba con `apilarEnPortal()`, aplica el efecto pasivo de Centinela (`ocultarOtrasCentinelas()`) y marca `played`. |
| `resolverInvocacion(partida)` | `función` | Si todos los Portales tienen la carta de arriba visible y están todos los personajes de `need` (por apariencia: `aspecto \|\| name`), reparte Gemas (solo al personaje que esté en un único Portal; si es central se pierde, salvo en Modo Experto, donde la cobra `partida.automataCentral`), aplica `aplicarBonusPasivosInvocacion()` y, lo último, `aplicarEntusiastas()`; el evento lleva además `gemasAutomata` y `entusiastas`, guarda el nivel en `invocacionesCompletadas`, abre un Portal central nuevo y sube `levelIdx`. Tras la última invocación (`nivelesPartida()`: A, o Madain si se juega con ella) marca `juegoTerminado` y añade `partidaTerminada`. Devuelve `[]` si no se cumple. |
| `terminarTurno(partida)` | `función` | Exige haber jugado; repone las manos de todas desde `partida.deck` y llama a `resolverInvocacion()`. No pasa el turno. |
| `pasarTurno(partida)` | `función` | Pasa a la siguiente jugadora, limpia `played`, `habilidadUsadaEsteTurno` y `cronomantePortalInvestigado`, y llama a `comprobarFinPorManoVacia()`. |
| `comprobarFinPorManoVacia(partida)` | `función` | Si la jugadora activa no tiene cartas, marca `juegoTerminado` y devuelve `partidaTerminada`. |
| `validarFaseB(partida)` | `función` | `[]` si la jugadora activa puede activar una habilidad (ha jugado carta y no ha usado ninguna este turno), o `accionInvalida` con el motivo. |
| `opcionesFaseB(partida)` | `función` | `{ opciones }` (de `opcionesActivarHabilidad()`, `utils.js`) o `{ eventos }` con `accionInvalida` si no se puede o no hay ninguna. |
| `completarActivacion(partida, { origen, personaje, usarAsterisco = false })` | `función` | Tras aplicar una habilidad: cobra el acceso con `pagarActivacionPortalCentral()` si `origen` es `'central:<k>'` (revelando la Gema de asterisco si `usarAsterisco` y también tiene Gemas de 1; la web lo pregunta antes, el autómata pasa `false`) y marca `habilidadUsadaEsteTurno`. |

---

## js/motor/habilidades.js
**Propósito:** Fase 3 de la separación motor / interfaz (ver `docs/ARQUITECTURA_MOTOR.md`). Lo que hace cada habilidad activable en Fase B y los efectos pasivos de Centinela y Clarividente, sin DOM, sin `window` y sin avisos. Las elecciones se piden a una interfaz inyectada: `ui.pedir({ tipo: 'portal' | 'eleccion', pregunta, opciones: [{ val, lbl, disabled? }] }, responder, cancelar)`; los errores llegan por `ui.avisar({ tipo: 'accionInvalida', motivo })`. Las respuestas son callbacks, no promesas, para que una interfaz que contesta en el acto (autómata, tests) recorra todos los pasos de forma síncrona.

### Exportaciones

| Nombre | Tipo | Descripción |
|--------|------|-------------|
| `aplicarHabilidad(partida, { personaje, jugadora, pila }, ui, alAplicar)` | `función` | Aplica la habilidad de `personaje` para la jugadora `jugadora`. `pila` es el Portal de origen (solo lo usa Metamorfo; puede ser `null` al retomar un Cronomante). `alAplicar()` se llama una vez, solo si la habilidad tiene efecto: cancelar un paso no cuesta nada. Devuelve `false` si el personaje no tiene habilidad activable (Centinela, Clarividente...). Habilidades: **Ocultista** (gira la carta de arriba de un Portal no vacío y no protegido, nunca una Centinela visible; revelar una Centinela real gira las demás; tapar un Metamorfo le quita la ficha), **Cronista** (se lleva a la mano la carta de arriba, con la orientación que le falte a la mano y sin `.aspecto`), **Cronomante** (elige Portal con más de una carta y luego qué carta sube; si se cancela el segundo paso, el Portal queda en `partida.cronomantePortalInvestigado` y al volver a activar se retoma directamente), **Estratega** (intercambia dos Portales enteros, respetando la protección de Centinela), **Aprendiz** (intercambia las manos de dos jugadoras no protegidas e invierte quién ve cada carta), **Maestro** (baja la carta que el resto ve de otra jugadora a un Portal propio de esa jugadora; pregunta el Portal si tiene más de uno), **Metamorfo** (cobra una Gema de 1 y escribe solo `.aspecto`, nunca `.name`). |
| `esCentinelaVisible(stack)` | `función` | ¿La carta de arriba es una Centinela visible? |
| `jugadorProtegidoComoObjetivo(jugadorIdx, players, actingPlayerIdx)` | `función` | ¿Protege su Centinela a esa jugadora como objetivo de Aprendiz o Maestro? Nunca bloquea a quien activa. |
| `ocultarOtrasCentinelas(stackJugada, players, neutrals)` | `función` | Gira cualquier otra Centinela visible distinta de `stackJugada` ("solo puede haber una Centinela visible en mesa"). La usan `jugarCarta()` (Fase A), Ocultista y el Maestro. |
| `girarOtrasCentinelasSiAparece(stack, players, neutrals)` | `función` | Si la cima de `stack` es una Centinela real visible, gira las demás. La usan Cronista y Cronomante. |
| `candidatosObjetivoMaestro(players, ownerIdx)` | `función` | Jugadoras objetivo del Maestro: otra jugadora con una carta que el resto ve (`vis.others`), sin Clarividente visible y sin Centinela que la proteja. |
| `bajarCartaMaestro(players, neutrals, targetIdx, portalIdx, mazo = [])` | `función` | Efecto del Maestro ya decidido: mueve la carta al Portal propio `portalIdx` de esa jugadora, re-dispara Centinela si hace falta y repone su mano desde `mazo`. |
| `aplicarEleccionClarividente(player, idxElegida)` | `función` | Al dejar de ver su Clarividente, la jugadora se queda viendo la carta `idxElegida` (0 o 1) y la otra la ve el resto. Devuelve `false` si no tiene dos cartas. La decisión (picker humano o heurística del autómata) está en `render.js`. |

---

## js/motor/variantes.js
**Propósito:** (1.34.2) interruptores de variantes de reglas que solo usa
`tools/equilibrio.mjs` para medir propuestas. Todos apagados: así el juego
es el del reglamento, y la web nunca los cambia. Los leen
`sumaGemas`/`gastarGemaUnitaria`/`aplicarBonusPasivosInvocacion`
(`utils.js`), `resolverInvocacion` (`acciones.js`) y el Metamorfo
(`habilidades.js`).

| Nombre | Tipo | Descripción |
|--------|------|-------------|
| `VARIANTES` | `objeto` | `gemasInicialesNoPuntuan` (las 3 Gemas de partida, marcadas `inicial`, pagan pero no puntúan), `duplicadoDaGema` (cada copia de un requisito duplicado da 1 Gema a su dueña), `metamorfoGratisPropio` (transformarse en un Portal propio no cuesta), `maestroSoloPicaroPropio` (el bonus del Maestro solo lo anula un Pícaro de la misma dueña). |
| `reiniciarVariantes()` | `función` | Devuelve todas a su valor del reglamento (apagadas). |

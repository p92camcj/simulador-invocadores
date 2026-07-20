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
| `PERSONAJES_CON_HABILIDAD` | `const` | Personajes activables en Fase B (`Ocultista`, `Cronista`, `Cronomante`, `Estratega`, `Aprendiz`, `Metamorfo`). Única fuente para `opcionesActivarHabilidad()`. |
| `PERSONAJES_NO_ANIMALES` | `const` | Roster de los 10 personajes no-animales del mazo base "Modo normal". Usado por `game.js` para construir `charsBase` y por `abilities.js` (`case 'Metamorfo'`) para las opciones de transformación, sin depender de si esa carta sigue en el mazo o fue apartada al preparar la partida. |
| `iconos`          | `const`   | Mapa nombre→emoji para representar cartas (incluye Reena/Sora/Lumo). Se usa en `selCard`/`picker()` (texto) y en el estado de invocación; ya no en mano/Portales, que usan `cardImages`. |
| `mostrarCarta(card)` | `función` | Devuelve la cadena `"<icono> <nombre>"` para mostrar en la UI (selects/pickers y estado de invocación), usando `card.aspecto \|\| card.name` — la apariencia (disfraz del Metamorfo transformado), no la identidad real. |
| `cardImages`      | `const`   | Mapa nombre de personaje → ruta de imagen real (`assets/cards/*.png`), 14 personajes con habilidad + Reena/Sora/Lumo. El Metamorfo siempre usa `metamorfo.png` tal cual (no hay disfraz visual todavía, ver TODO en el propio archivo). |
| `CARTA_OCULTA_IMG`| `const`   | Ruta del reverso genérico (`assets/cards/carta-oculta-reverso.png`) usado por `render.js` para cualquier carta oculta para quien mira, sin filtrar el nombre real en el `alt`. |
| `$`               | `función` | Atajo para `document.querySelector(selector)`.                               |
| `shuffle(array)`  | `función` | Mezcla un array _in place_ (algoritmo Fisher–Yates).                        |
| `draw(player, visible)` | `función` | Robo de carta del mazo global (`window.deck`) a la mano de un jugador.      |
| `hasClari(player)`| `función` | `true` si el jugador tiene una **Clarividente** visible en alguno de sus portales. |
| `listPortals(players, neutrals)` | `función` | Devuelve array de `{val, lbl}` para poblar selectores de portales (propios, ajenos, neutrales). |
| `stackFrom(key, players, neutrals)` | `función` | Dada clave `"i:j"` o `"n:k"`, devuelve la pila de cartas (portal) correspondiente. |
| `portalesConEstado(players, neutrals, esInvalido)` | `función` | Como `listPortals()` pero añade `disabled` según `esInvalido(stack, val)` — usado por `picker()` para bloquear opciones. |
| `jugadoraProtegidaPorCentinela(player)` | `función` | `true` si esa jugadora tiene una Centinela visible en cualquiera de sus Portales — la protección cubre TODOS sus Portales, no solo el que la contiene. |
| `estaProtegidoParaActivar(stackKey, stack, players, actingPlayerIdx)` | `función` | `true` si ese Portal es un objetivo inválido para que `actingPlayerIdx` dirija una habilidad contra él: protegido por Centinela, salvo que `actingPlayerIdx` sea la propia dueña del Portal (la Centinela protege de las demás, no de una misma). Usado por Ocultista, Cronista, Cronomante y Estratega en `abilities.js`. |
| `opcionesActivarHabilidad(playerIdx, players, neutrals)` | `función` | Fase B: opciones activables para `players[playerIdx]` — sus propios portales (`own:<idx>`, gratis) y los centrales/neutrales (`central:<idx>`, con coste). La etiqueta usa la identidad real (`top.name`), no `mostrarCarta()`/apariencia — a propósito: un Metamorfo transformado solo puede volver a transformarse, nunca usar la habilidad del personaje imitado. |
| `sumaGemas(gems)` | `función` | Suma los `valor` de un array de Gemas — solo se muestra a la propia dueña en `render()` (secreto de Gemas). |
| `contarGemasPorNivel(gems)` | `función` | Devuelve `{nivel: cantidad}` sin revelar valores reales — usado en `render()` para el desglose de las jugadoras que no son la activa. |
| `tieneGemaAsterisco(player)` | `función` | `true` si el jugador tiene alguna Gema con `esAsterisco: true`. |
| `gastarGemaAsterisco(player)` | `función` | Revela y descarta la Gema de asterisco del jugador; `false` si no tenía ninguna. |
| `gastarGemaUnitaria(player)` | `función` | Gasta 1 Gema de valor 1; si no tiene ninguna suelta, cambia su Gema de menor valor por Gemas unitarias. `false` solo si no tiene ninguna Gema. |
| `pagarActivacionPortalCentral(player)` | `función` | Cobra el coste de activar la habilidad de un Portal central: gratis con Gema de asterisco, o 1 Gema unitaria. `false` si no pudo pagar. |
| `construirPoolGemas(valores)` | `función` | Construye y mezcla el pool de 5 Gemas de una invocación, marcando la de menor valor como `esAsterisco`. |
| `generarVis(destino, opciones)` | `función` | Genera el objeto de visibilidad de una carta según su origen y destino. |
| `actualizarClarividente(players)` | `función` | Actualiza `hasClariActivo`/`haTenidoClarividente` de cada jugador (solo flags, nunca muta `carta.vis`). |

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
| `applyAbility(name, ownerIdx, stack, players, neutrals, levelIdx, need = [])` | `función` | Aplica la habilidad de `name` al portal `stack` propiedad de `players[ownerIdx]`, con acceso a `players`, `neutrals` y `levelIdx`. `need` es el array de personajes requeridos por la invocación activa — pásalo explícitamente desde quien llame, no lo recalcules dentro del módulo. Actualmente ningún `case` lo usa (Metamorfo dejó de necesitarlo tras la revisión de reglamento de 2026-07-19); se mantiene en la firma para el futuro Modo Experto/invocación Asterisco. Incluye casos solo para las habilidades activables en Fase B (`PERSONAJES_CON_HABILIDAD`): **Ocultista** (tras alternar visibilidad, si la carta revelada es una Centinela real —`.name`, no apariencia— re-dispara `ocultarOtrasCentinelas()`, ver DEUDA_TECNICA.md ítem 12), Cronista (propaga `.aspecto` si la carta que se lleva a la mano era un Metamorfo transformado), Cronomante, Estratega, Aprendiz y **Metamorfo** (transformación libre en cualquier personaje de `PERSONAJES_NO_ANIMALES` menos el propio Metamorfo, persistente hasta que la carta se tape o se vuelva a transformar; escribe `stack.at(-1).aspecto`, NUNCA `.name` — ver "Modelo de datos de cartas" más abajo y DEUDA_TECNICA.md ítem 14). No hay `case 'Centinela'` ni `case 'Clarividente'`: ambas son pasivas/automáticas, ver `ocultarOtrasCentinelas` abajo y `actualizarClarividente` en `utils.js`. |
| `ocultarOtrasCentinelas(stackJugada, players, neutrals)` | `función` | Oculta (`vis.public = false`) cualquier otra Centinela visible en el top de cualquier Portal (de cualquier jugadora o central) distinto de `stackJugada`, según la regla "solo puede haber una Centinela visible en mesa". Llamada desde `actions.js` en Fase A, justo tras `stack.push(...)`, cuando la carta jugada es una Centinela — no es una habilidad de Fase B. |

---

## js/setup.js
**Propósito:** Gestiona la pantalla de **configuración inicial** y lanza la partida.

### Exportaciones

| Nombre       | Tipo      | Descripción                                                                                       |
|--------------|-----------|---------------------------------------------------------------------------------------------------|
| `initSetup()`| `función` | - Configura `#cfgNext.onclick` para generar inputs de nombres según número de jugadoras. <br>- Configura `#btnStart.onclick` para leer nombres y `#selInvocationSet` (`window.invocationSet`), inicializar `window.players` (cada uno con 3 Gemas unitarias iniciales) y `window.neutrals`, mostrar `#btnAbility`, ocultar la UI de setup y llamar a `initGame()`. |

---

## js/render.js
**Propósito:** Renderiza toda la interfaz de juego en el DOM, sin gestionar eventos.

### Exportaciones

| Nombre     | Tipo      | Descripción                                                                                          |
|------------|-----------|------------------------------------------------------------------------------------------------------|
| `picker(title, options, cb, onCancel?)` | `función` | Muestra un modal `<div id="picker">` con un `<select>` y botones OK/Cancelar; invoca `cb(valor)` al aceptar, o `onCancel()` (si se pasó) al cancelar — por defecto cancelar solo cierra el modal sin llamar a nada. Las opciones siguen siendo texto (no imágenes) — un `<select>` nativo no aloja `<img>` de forma fiable. |
| `pickerPortal(title, opciones, cb, onCancel?)` | `función` | Como `picker()`, pero además habilita clicar directamente los Portales válidos del tablero (`#boardGrid`) como alternativa al modal — mismo criterio que jugar carta: ambos métodos coexisten. `opciones` debe tener el formato de `portalesConEstado()` (`val` = `"playerIdx:portalIdx"` o `"n:idx"`, con `disabled` ya calculado por la regla real de la habilidad). Fija `window.pickerObjetivoPortal = { opciones, cb }` mientras el picker está abierto (lo consume `renderBoardGrid()` para pintar `.target-portal`/`.target-portal-disabled`, y `window.selectPortalObjetivo` en `actions.js` para resolver el clic) y lo limpia al aceptar o cancelar, en ambos casos con un `render()` de por medio. Usada por Ocultista, Cronista, el primer picker de Cronomante, y los dos pickers de Estratega — no por el segundo picker de Cronomante (elige una carta dentro de la pila, no un Portal), ni por Aprendiz (elige jugadoras) ni Metamorfo (elige un nombre de personaje), que se quedan con `picker()` normal. |
| `render(players, neutrals, levelIdx)` | `función` | Actualiza `hasClariActivo`/`haTenidoClarividente` (`actualizarClarividente`), muestra/oculta `#btnPlayCancel` según haya o no una carta seleccionada, llama a la función interna `renderBoardGrid()` para dibujar el tablero, y actualiza el estado y componentes de la invocación activa (`#lblInv`/`#invStatus`), resuelta desde `INVOCATION_SETS[window.invocationSet][lvl]` (nombre y `need`). |
| *(interna)* `renderBoardNeutrals(neutrals)` | `función` | Dibuja la fila de Portales centrales/neutrales en `#boardNeutrals` (Tarea 2), **separada** del grid de columnas de jugadoras y por encima de él — a lo ancho de todo el contenedor, con su propio fondo/borde (`.board-neutrals` en `style.css`) y el título "Portales centrales", para que no se confunda con la columna de ninguna jugadora. Si `neutrals.length === 0` (partidas de 5 jugadoras, ver `js/setup.js`), oculta el contenedor entero (`classList.add('hidden')`) y lo vacía — no deja un hueco vacío ni un mensaje placeholder. Cada Portal se pinta con la misma función interna `portalCardHtml()` que usan las columnas de jugadoras. Llamada desde `renderBoardGrid()`, no exportada aparte. |
| *(interna)* `renderBoardGrid(players, neutrals)` | `función` | Llama primero a `renderBoardNeutrals(neutrals)` y luego dibuja el grid de columnas de **jugadoras únicamente** en `#boardGrid` — los Portales centrales ya no forman parte de este grid (ver `renderBoardNeutrals` arriba). Una columna por jugadora en orden fijo por índice, con `grid-template-columns: repeat(N, minmax(240px, 1fr))` (N = nº de jugadoras): cada columna crece para llenar el ancho disponible cuando cabe, y `.board-grid` solo hace scroll horizontal (`overflow-x: auto`) cuando de verdad no caben todas — no hay ninguna vista alternativa ni modo de depuración aparte. Visibilidad SIEMPRE real (nunca "todo visible"): los Portales de cualquier columna según `vis?.public` de su carta superior; la mano de la jugadora activa (`window.turn`) según `c.vis?.owner \|\| pl.hasClariActivo \|\| pl.haTenidoClarividente`; la mano de cualquier otra jugadora según `h.vis?.others`, salvo que esa jugadora tenga `hasClariActivo \|\| haTenidoClarividente`, en cuyo caso se oculta su mano COMPLETA al resto (decisión de mesa, ver nota de Clarividente en `docs/reglamento/REGLAMENTO.md`). La columna de la jugadora activa recibe la clase `.turno-activo` (resaltada); el resto `.turno-inactivo` (atenuada), sin perder su color de identidad fijo por índice. Cada carta de la mano activa lleva `draggable="true"` y `onclick="window.selectHandCard(idx)"`/`ondragstart="window.handleCardDragStart(...)"` (definidos en `actions.js`); recibe `.selected` si es `window.selectedCardIdx`. Cada Portal, vía la función interna `portalCardHtml()`: si `window.pickerObjetivoPortal` está activo (selección de objetivo de habilidad en curso), se resuelve como objetivo clicable (`onclick="window.selectPortalObjetivo(keyObjetivo)"`, `.target-portal`) o bloqueado (`.target-portal-disabled`, sin `onclick`, etiqueta con 🚫) según `opcion.disabled`; si no, modo normal "jugar carta" con `portalPlayAttrs(destKeyJugar)` y `.target-portal` mientras haya una carta seleccionada. Mano y Portales usan la función interna `cartaImgHtml(name, visible)`, que renderiza un `<img>` con `cardImages[name]` si la carta es visible para quien mira, o siempre `CARTA_OCULTA_IMG` (con `alt="Carta oculta"`, sin el nombre real) si no lo es. |

---

## js/actions.js
**Propósito:** Gestiona la **interacción** de la UI: selección de cartas, jugar carta (Fase A), activar habilidad (Fase B) y fin de turno.

### Exportaciones

| Nombre              | Tipo      | Descripción                                                                                                                                        |
|---------------------|-----------|----------------------------------------------------------------------------------------------------------------------------------------------------|
| `initActions(players, neutrals)` | `función` | Jugar carta (Fase A) admite TRES métodos que coexisten siempre y comparten el mismo estado (`window.selectedCardIdx`) y la misma función interna `jugarCartaSeleccionadaEn(destKey)` — ninguno duplica validación ni puede desincronizar a los otros: <br>- **Clic directo**: `window.selectHandCard(idx)` selecciona/deselecciona (toggle) una carta de la mano; `window.tryPlayOnPortal(destKey)` la juega al clicar un Portal (`destKey` = `'p:<idx>'` \| `'n:<idx>'` \| `'a:<pi>:<pj>'`). <br>- **Drag&drop**: `window.handleCardDragStart`/`handlePortalDragOver`/`handlePortalDrop`, mismo efecto final. <br>- **Panel con `<select>`** (`#ctrlPlay`, botón `#btnCtrlPlay` en la cabecera): `abrirPanelJugarCarta()` (interna) puebla `#selCard`/`#selDest` y preselecciona `window.selectedCardIdx` si ya había una carta elegida por clic; `#btnPlay.onclick` fija `window.selectedCardIdx` al valor del `<select>` y llama a `jugarCartaSeleccionadaEn()`; `#ctrlPlayCancel.onclick` cierra el panel y limpia la selección. <br>- `#btnPlayCancel.onclick` (cabecera): limpia `window.selectedCardIdx`, cierra `#ctrlPlay` si estaba abierto, y refresca. <br>- `window.selectPortalObjetivo(key)`: clic en un Portal objetivo de una habilidad en curso (ver `pickerPortal()` en `render.js`); no hace nada si `window.pickerObjetivoPortal` no está activo o si esa opción está `disabled`. <br>- `#btnAbility.onclick`: Fase B, una vez por turno. Si hay una investigación de Cronomante pendiente (`window.cronomantePortalInvestigado` con valor), SALTA el picker de nivel superior y llama directamente a `applyAbility('Cronomante', ...)` con el `onComplete` guardado en `window.cronomanteOnComplete` — no se puede elegir otra habilidad hasta completar o que cambie el turno. Si no, construye opciones con `opcionesActivarHabilidad()`; al elegir una, cobra el coste con `pagarActivacionPortalCentral()` si la fuente es un Portal central, marca `window.habilidadUsadaEsteTurno` y llama a `applyAbility()` — si la habilidad es Cronomante, guarda ese `onComplete` en `window.cronomanteOnComplete` antes de llamar, por si hace falta reintentar tras un cancel (ver `abilities.js`). <br>- `#btnEndTurn.onclick`: valida jugada, reparte robo si <2 cartas, comprueba invocación contra `INVOCATION_SETS[window.invocationSet][lvl]` (el combo cuenta `card.aspecto \|\| card.name` — un Metamorfo transformado cumple la combinación), reparte Gemas reales (`construirPoolGemas` + bonus de Pícaro/Maestro — ambos bonus pasivos miran identidad real, `card.name`, no apariencia: un Metamorfo transformado en Maestro NUNCA da el bonus de 3 Gemas, ver DEUDA_TECNICA.md ítem 14), añade portal neutral, avanza turno y refresca. |

---

## js/game.js
**Propósito:** Control central del **flujo de la partida**: creación de mazo, reparto y gestión de turnos.

### Exportaciones

| Nombre          | Tipo      | Descripción                                                                                                     |
|-----------------|-----------|-----------------------------------------------------------------------------------------------------------------|
| `initGame()`    | `función` | - Construye el mazo `window.deck` con las cantidades reales de "Modo normal" (32 cartas), añadiendo los 9 Animales solo si `window.invocationSet` es `introductorio` (41 cartas) — `floral` reutiliza el mismo mazo de 32 cartas que `normal`, no es una tercera variante; baraja y aparta 2 al azar sin mirar. <br>- Reparte 1 carta visible + 1 oculta a cada jugador. <br>- Inicializa `window.levelIdx`, `window.turn`, `window.played`, `window.habilidadUsadaEsteTurno`, `window.selectedCardIdx`, `window.cronomantePortalInvestigado`, `window.pickerObjetivoPortal`. <br>- Llama a `initActions()`. <br>- Inicia primer turno con `nextTurn()`. |
| `nextTurn()`    | `función` | - `window.played = false`, `window.habilidadUsadaEsteTurno = false`, `window.selectedCardIdx = null`, `window.cronomantePortalInvestigado = null` (una investigación de Cronomante pendiente no sobrevive a un cambio de turno). <br>- Si la jugadora activa no tiene cartas en mano, termina la partida vía `finalizarPartida()`. <br>- Alerta “Turno de X”. <br>- Actualiza `#lblTurn`. <br>- Llama a `render()`. |
| `finalizarPartida(motivo)` | `función` | Pregunta si se quiere jugar otra partida. Si sí, llama a `resetJuego()`; si no, bloquea la interfaz con un mensaje de cierre. Llamada desde `game.js` (mano vacía) y desde `actions.js` (última invocación completada) — por eso debe permanecer `export`ada. |
| `resetJuego()`  | `función` | Oculta la UI de juego, muestra la de configuración, limpia el estado global (`window.players`, `window.deck`, etc.) y vuelve a llamar a `initSetup()`. |

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


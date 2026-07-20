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
| `mostrarCarta(card)` | `función` | Devuelve la cadena `"<icono> <nombre>"` para mostrar en la UI (selects/pickers y estado de invocación).              |
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
| `opcionesActivarHabilidad(playerIdx, players, neutrals)` | `función` | Fase B: opciones activables para `players[playerIdx]` — sus propios portales (`own:<idx>`, gratis) y los centrales/neutrales (`central:<idx>`, con coste). |
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

---

## js/abilities.js
**Propósito:** Implementa la lógica de las habilidades especiales de los personajes, aislando el `switch` de cada caso.

### Exportaciones

| Nombre             | Tipo      | Descripción                                                                                                                   |
|--------------------|-----------|-------------------------------------------------------------------------------------------------------------------------------|
| `applyAbility(name, ownerIdx, stack, players, neutrals, levelIdx, need = [])` | `función` | Aplica la habilidad de `name` al portal `stack` propiedad de `players[ownerIdx]`, con acceso a `players`, `neutrals` y `levelIdx`. `need` es el array de personajes requeridos por la invocación activa — pásalo explícitamente desde quien llame, no lo recalcules dentro del módulo. Actualmente ningún `case` lo usa (Metamorfo dejó de necesitarlo tras la revisión de reglamento de 2026-07-19); se mantiene en la firma para el futuro Modo Experto/invocación Asterisco. Incluye casos para: Ocultista, Centinela, Cronista, Cronomante, Estratega, Aprendiz y Metamorfo (transformación libre en cualquier personaje de `PERSONAJES_NO_ANIMALES` menos el propio Metamorfo, persistente hasta que la carta se tape o se vuelva a transformar). |

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
| `render(players, neutrals, levelIdx)` | `función` | Dibuja: <br>- Zona activa (jugadora actual, portales, mano, suma de Gemas vía `sumaGemas()`). <br>- Zona de otros jugadores (portales + sus cartas ocultas). <br>- Portales neutrales. <br>- Estado y componentes de la invocación activa, resuelta desde `INVOCATION_SETS[window.invocationSet][lvl]` (nombre y `need`). <br>Mano y Portales (propios, ajenos y centrales) ya no muestran emoji/texto: usan la función interna `cartaImgHtml(name, visible)`, que renderiza un `<img>` con `cardImages[name]` si la carta es visible para quien mira, o siempre `CARTA_OCULTA_IMG` (con `alt="Carta oculta"`, sin el nombre real) si no lo es. |

---

## js/actions.js
**Propósito:** Gestiona la **interacción** de la UI: selección de cartas, jugar carta (Fase A), activar habilidad (Fase B) y fin de turno.

### Exportaciones

| Nombre              | Tipo      | Descripción                                                                                                                                        |
|---------------------|-----------|----------------------------------------------------------------------------------------------------------------------------------------------------|
| `initActions(players, neutrals)` | `función` | - Define `window.selectCard(i)` para poblar selectores y mostrar el panel de juego. <br>- `#btnPlayCancel.onclick`: oculta el panel. <br>- `#btnPlay.onclick`: juega carta (Fase A) y refresca `render()` — **ya no** activa ninguna habilidad automáticamente. <br>- `#btnAbility.onclick`: Fase B, una vez por turno; construye opciones con `opcionesActivarHabilidad()`, cobra el coste con `pagarActivacionPortalCentral()` si la fuente es un Portal central, marca `window.habilidadUsadaEsteTurno` y llama a `applyAbility()`. <br>- `#btnEndTurn.onclick`: valida jugada, reparte robo si <2 cartas, comprueba invocación contra `INVOCATION_SETS[window.invocationSet][lvl]`, reparte Gemas reales (`construirPoolGemas` + bonus de Pícaro/Maestro), añade portal neutral, avanza turno y refresca. |

---

## js/game.js
**Propósito:** Control central del **flujo de la partida**: creación de mazo, reparto y gestión de turnos.

### Exportaciones

| Nombre          | Tipo      | Descripción                                                                                                     |
|-----------------|-----------|-----------------------------------------------------------------------------------------------------------------|
| `initGame()`    | `función` | - Construye el mazo `window.deck` con las cantidades reales de "Modo normal" (32 cartas), añadiendo los 9 Animales solo si `window.invocationSet` es `introductorio` (41 cartas) — `floral` reutiliza el mismo mazo de 32 cartas que `normal`, no es una tercera variante; baraja y aparta 2 al azar sin mirar. <br>- Reparte 1 carta visible + 1 oculta a cada jugador. <br>- Inicializa `window.levelIdx`, `window.turn`, `window.played`, `window.habilidadUsadaEsteTurno`. <br>- Llama a `initActions()`. <br>- Inicia primer turno con `nextTurn()`. |
| `nextTurn()`    | `función` | - `window.played = false`, `window.habilidadUsadaEsteTurno = false`. <br>- Si la jugadora activa no tiene cartas en mano, termina la partida vía `finalizarPartida()`. <br>- Alerta “Turno de X”. <br>- Actualiza `#lblTurn`. <br>- Llama a `render()`. |
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


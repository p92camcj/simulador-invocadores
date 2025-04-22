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
| `COMBOS`          | `const`   | Mapea nivel → combinación de personajes requeridos.                         |
| `REWARD`          | `const`   | Gemas que da cada nivel: `{ C:1, B:2, A:3 }`.                                |
| `iconos`          | `const`   | Mapa nombre→emoji para representar cartas.                                   |
| `mostrarCarta(card)` | `función` | Devuelve la cadena `"<icono> <nombre>"` para mostrar en la UI.              |
| `$`               | `función` | Atajo para `document.querySelector(selector)`.                               |
| `shuffle(array)`  | `función` | Mezcla un array _in place_ (algoritmo Fisher–Yates).                        |
| `draw(player, visible)` | `función` | Robo de carta del mazo global (`window.deck`) a la mano de un jugador.      |
| `hasClari(player)`| `función` | `true` si el jugador tiene una **Clarividente** visible en alguno de sus portales. |
| `listPortals(players, neutrals)` | `función` | Devuelve array de `{val, lbl}` para poblar selectores de portales (propios, ajenos, neutrales). |
| `stackFrom(key, players, neutrals)` | `función` | Dada clave `"i:j"` o `"n:k"`, devuelve la pila de cartas (portal) correspondiente. |

---

## js/abilities.js
**Propósito:** Implementa la lógica de las habilidades especiales de los personajes, aislando el `switch` de cada caso.

### Exportaciones

| Nombre             | Tipo      | Descripción                                                                                                                   |
|--------------------|-----------|-------------------------------------------------------------------------------------------------------------------------------|
| `applyAbility(name, ownerIdx, stack, players, neutrals, levelIdx)` | `función` | Aplica la habilidad de `name` al portal `stack` propiedad de `players[ownerIdx]`, con acceso a `players`, `neutrals` y `levelIdx`. Incluye casos para: Ocultista, Centinela, Cronista, Cronomante, Estratega, Aprendiz y Metamorfo. |

---

## js/setup.js
**Propósito:** Gestiona la pantalla de **configuración inicial** y lanza la partida.

### Exportaciones

| Nombre       | Tipo      | Descripción                                                                                       |
|--------------|-----------|---------------------------------------------------------------------------------------------------|
| `initSetup()`| `función` | - Configura `#cfgNext.onclick` para generar inputs de nombres según número de jugadoras. <br>- Configura `#btnStart.onclick` para leer nombres, inicializar `window.players` y `window.neutrals`, ocultar la UI de setup y llamar a `initGame()`. |

---

## js/render.js
**Propósito:** Renderiza toda la interfaz de juego en el DOM, sin gestionar eventos.

### Exportaciones

| Nombre     | Tipo      | Descripción                                                                                          |
|------------|-----------|------------------------------------------------------------------------------------------------------|
| `picker(title, options, cb)` | `función` | Muestra un modal `<div id="picker">` con un `<select>` y botones OK/Cancelar; invoca `cb(valor)` o cierra. |
| `render(players, neutrals, levelIdx)` | `función` | Dibuja: <br>- Zona activa (jugadora actual, portales, mano). <br>- Zona de otros jugadores (portales + sus cartas ocultas). <br>- Portales neutrales. <br>- Estado y componentes de la invocación actual. |

---

## js/actions.js
**Propósito:** Gestiona la **interacción** de la UI: selección de cartas, botones de juego y fin de turno.

### Exportaciones

| Nombre              | Tipo      | Descripción                                                                                                                                        |
|---------------------|-----------|----------------------------------------------------------------------------------------------------------------------------------------------------|
| `initActions(players, neutrals)` | `función` | - Define `window.selectCard(i)` para poblar selectores y mostrar el panel de juego. <br>- `#btnPlayCancel.onclick`: oculta el panel. <br>- `#btnPlay.onclick`: juega carta, pregunta por habilidad, aplica `applyAbility` y refresca `render()`. <br>- `#btnEndTurn.onclick`: valida jugada, reparte robo si <2 cartas, comprueba invocación, reparte gemas, añade portal neutral, avanza turno y refresca. |

---

## js/game.js
**Propósito:** Control central del **flujo de la partida**: creación de mazo, reparto y gestión de turnos.

### Exportaciones

| Nombre          | Tipo      | Descripción                                                                                                     |
|-----------------|-----------|-----------------------------------------------------------------------------------------------------------------|
| `initGame()`    | `función` | - Construye el mazo `window.deck` con personajes. <br>- Reparte 1 carta visible + 1 oculta a cada jugador. <br>- Inicializa `window.levelIdx`, `window.turn`, `window.played`. <br>- Llama a `initActions()`. <br>- Inicia primer turno con `nextTurn()`. |
| `nextTurn()`    | `función` | - `window.played = false`. <br>- Alerta “Turno de X”. <br>- Actualiza `#lblTurn`. <br>- Llama a `render()`.                                           |

---

## js/index.js
**Propósito:** **Entry point** con `<script type="module">` que expone variables globales y arranca la aplicación.

### Contenido principal

```js
import { initSetup } from './setup.js';
import { LEVELS, COMBOS, REWARD } from './utils.js';

// Estado global
window.players = [];
window.neutrals = [];
window.deck = [];
window.levelIdx = 0;
window.turn = 0;
window.played = false;

// Exponer constantes
window.LEVELS = LEVELS;
window.COMBOS = COMBOS;
window.REWARD = REWARD;

// Arrancar UI
document.addEventListener('DOMContentLoaded', () => {
  initSetup();
});
```

---

**Flujo de carga**  
1. Carga de `index.js` como módulo.  
2. Llamada a `initSetup()`: muestra form de configuración.  
3. Pulsar **Continuar** y **Iniciar** reúne datos y llama a `initGame()`.  
4. `initGame()` reparte cartas y llama a `nextTurn()`.  
5. Cada turno: selección de cartas, aplicación de habilidades, comprobación de invocaciones, robo y cambio de turno.


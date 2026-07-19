# Changelog

Todas las versiones importantes del simulador de Invocadores.

---

## [1.4.1.27] - 2026-07-19

### Corregido
- **Bug de `1.4.0.26`: el set de invocación `floral` era imposible de completar.** `js/game.js` agrupaba `floral` junto a `introductorio` para decidir si añadir los Animales (Reena/Sora/Lumo) al mazo, pero `floral` no necesita Animales en absoluto — necesita personajes (Ocultista, Centinela, Maestro, Clarividente...) que **no existen** en el mazo de "Modo introductorio". El mazo de `floral` debe ser el mismo que el de `normal` (32 cartas, sin Animales): `floral` no es una tercera variante de mazo, solo cambia el nombre/combo de las cartas de invocación (`INVOCATION_SETS.floral`). Corregido: `necesitaAnimales` ahora solo es `true` para `invocationSet === 'introductorio'`.
- Verificado programáticamente que las 9 invocaciones de nivel C/B/A (3 sets × 3 niveles) son completables con el mazo real que se prepara para su set correspondiente.

---

## [1.4.0.26] - 2026-07-19

### Añadido
- **Fase B independiente de la secuencia de turno**: activar la habilidad de un personaje ya no depende de jugar una carta. Es una acción propia (botón "Activar habilidad"), como mucho una vez por turno (`window.habilidadUsadaEsteTurno`, reseteado en `nextTurn()`), sobre el personaje visible de **cualquiera de tus propios Portales** (gratis) o de un **Portal central** (pagando 1 Gema unitaria, con cambio automático de una Gema de mayor valor si hace falta, o gratis revelando una Gema de asterisco ya ganada). Sustituye por completo el antiguo `confirm()` disparado al jugar carta.
- **Economía real de Gemas**: `player.gems` pasa de número plano a array de `{ valor, nivel, esAsterisco? }`. El reparto tras una invocación exitosa roba en secreto de un pool real de 5 Gemas por invocación (`construirPoolGemas` en `js/utils.js`), marcando la de menor valor como Gema de asterisco. Pícaro y Maestro siguen dando siempre Gemas unitarias (valor 1). Cada jugadora empieza con 3 Gemas unitarias (antes: `gems: 1`, un número sin sentido).
- **Sets de invocación con nombre** (`INVOCATION_SETS.introductorio/normal/floral` en `js/utils.js`, sustituyen al `COMBOS` genérico): cada nivel indica nombre de criatura, personajes requeridos y sus 5 valores de Gema reales. Seleccionable en la pantalla de configuración (`#selInvocationSet`).
- `INVOCATION_ASTERISCO` (Madain, 4ª invocación de Modo Experto) definida en `js/utils.js`, sin conectar todavía a ningún flujo real.
- Cantidades reales del mazo de "Modo normal" en `js/game.js` (32 cartas: 2 Maestro, 2 Clarividente, 2 Ocultista, 3 Cronomante, 3 Estratega, 4 Cronista, 4 Aprendiz, 4 Centinela, 6 Pícaro, 2 Metamorfo), añadiendo los 9 Animales (3 Reena, 3 Sora, 3 Lumo) solo si el set de invocación elegido es `introductorio` o `floral` — fiel a la sección "Preparación del mazo de personajes" del reglamento, que excluye Animales y Entusiasta del mazo de "Modo normal". Entusiasta sigue sin entrar en el mazo (expansión aparte, sin habilidad implementada).

### Corregido
- Bonus pasivo del Maestro: ahora comprueba si hay algún Pícaro visible **en cualquier parte de la mesa** (no solo si Pícaro forma parte del combo activo) y se aplica en el nivel donde Maestro sea requisito (antes hardcodeado a nivel `'A'`).
- `window.picker` roto (`docs/DEUDA_TECNICA.md`, ítem resuelto): `gestionarMetamorfos()` en `js/utils.js`, el mecanismo ad-hoc que dejaba a cualquier jugadora con Metamorfo visible transformarlo al terminar turno, se elimina por completo. El Metamorfo se activa ahora igual que el resto de habilidades, dentro de la Fase B unificada (una vez por turno, solo la jugadora activa), usando el `picker()` real importado de `render.js`.
- Uso de la variable bare `turn` en vez de `window.turn` en `js/render.js` (`docs/DEUDA_TECNICA.md`, ítem resuelto).
- Duplicación del roster "personajes con habilidad" entre `abilities.js` y `actions.js`: ahora vive una sola vez como `PERSONAJES_CON_HABILIDAD` en `js/utils.js`.

### Notas
- El Metamorfo conserva la restricción antigua (solo puede transformarse en un personaje que falte para completar la invocación activa) y sigue sin ser persistente — eso es trabajo aparte, ya documentado en `docs/MEJORAS_FUTURAS.md`. Solo se actualizó su coste en Gemas al nuevo modelo.
- La habilidad activa nueva del Maestro (mover una carta visible de la mano de otra jugadora a su propio Portal) no se implementa en esta tarea.

---

## [1.3.3.24] - 2026-07-19

### Añadido
- `docs/DEUDA_TECNICA.md`: auditoría de calidad de código de `js/*.js`. Incluye un bug real no detectado hasta ahora — `js/utils.js` llama a `window.picker(...)` dentro de `gestionarMetamorfos()`, pero `picker` nunca se asigna a `window` (solo se exporta como binding de módulo desde `render.js` y se importa por nombre en `abilities.js`), por lo que activar un Metamorfo al terminar turno lanza `TypeError: window.picker is not a function` y rompe el flujo — junto con el uso de `turn` sin `window.` en `render.js`, duplicación de la iteración de portales en 6+ sitios, nombres de jugadora sin escapar insertados vía `innerHTML`, ausencia de tests, y el bug de comparación de versiones de `version-check.js` ya documentado en el README (aquí con la corrección propuesta: semver real en vez de desigualdad).
- `docs/MEJORAS_FUTURAS.md`: backlog de alcance nuevo — los bloques de "ponerse al día con el reglamento" ya listados en `CLAUDE.md` como bloques de trabajo concretos (reparto de portales, economía de gemas, sets de invocación con nombre, Entusiasta y Animales, condición del Maestro, marcador final y desempate, modos Introductorio/Avanzado/Experto, variante 2vs2), el bloque de multijugador por red (sin fecha ni prioridad), y mejoras de UX.
- Sección "Regla de prioridad: deuda técnica antes que alcance nuevo" en `CLAUDE.md`: los ítems de prioridad alta o media de `DEUDA_TECNICA.md` van antes que cualquier bloque de `MEJORAS_FUTURAS.md`, salvo indicación explícita en contra.

### Corregido
- Referencia obsoleta en `CLAUDE.md` a la entrada de changelog `1.3.1.23` (la entrada real quedó en `1.3.1.22` tras un ajuste de última hora en esa tarea) — corregida a `1.3.1.22`.

---

## [1.3.2.23] - 2026-07-19

### Añadido
- `README.md` en la raíz: puerta de entrada rápida al proyecto pensada para el propietario (qué es, cómo probarlo en local, instalación como PWA, aviso de "nueva versión disponible" y de dónde sale, estructura de alto nivel, estado del reglamento y créditos). Verificado en la práctica que el juego requiere servirse por HTTP (no `file://`, por las restricciones CORS de los módulos ES) y documentado el comportamiento real del aviso de actualización de `js/version-check.js` (compara contra la última Release de GitHub, no contra `main`, y no distingue si esa release es más antigua que la versión actual).

---

## [1.3.1.22] - 2026-07-19

### Corregido
- `ReferenceError` al jugar cualquier carta con habilidad (Ocultista, Cronista, Cronomante, Estratega, Aprendiz, Metamorfo): `applyAbility` recibía una variable `levelIdx` que no existía en el scope de `actions.js` (solo existía `window.levelIdx`).
- `ReferenceError` al completar cualquier invocación: `finalizarPartida` no estaba exportada desde `game.js`, por lo que `actions.js` no podía usarla.
- La partida terminaba (y mostraba el mensaje "invocación A") al completar **cualquier** invocación (C, B o A), en vez de continuar hasta la última invocación del set. Ahora solo finaliza al completar la última invocación de `LEVELS`, y el mensaje refleja el nivel realmente completado.
- El aviso de "nueva versión disponible" comparaba la versión completa `X.Y.Z.W` contra el tag de la última release de GitHub, lo que disparaba el aviso en cada commit (W cambia constantemente). Ahora solo se compara `X.Y.Z`.

### Cambiado
- Esquema de versionado: se adopta el formato `X.Y.Z.W` (ver `CLAUDE.md`), donde W es el nº de commits del repositorio en el momento del build. `version.json` pasa de `"v1.3.0"` a `"1.3.1.22"`.

---

## [v1.3.0] - 2025-04-24

### Añadido
- Final de partida automático: la partida termina si se completa la invocación A o si una jugadora comienza su turno sin cartas.
- Al finalizar la partida, se pregunta si se quiere volver a jugar. Si se elige que no, se bloquea la interfaz y se muestra un mensaje de cierre.
- Indicador visual del número de cartas restantes en el mazo, mostrado junto al nombre del turno.
- Asignación automática de nombres si no se introducen: Julio, Adrián, Javi, Isa.
- Rediseño de la pantalla de configuración:
  - Campo "número de jugadoras" más compacto y en línea con su etiqueta.
  - Campos de nombres colocados horizontalmente, con anchura adaptada.
  - Validación visual del número de jugadoras.
- Nuevo título inicial "Simulador «Invocadores»" y subtítulo con enlace a [elmeepleazul.es](https://www.elmeepleazul.es).
- Opción de reiniciar el juego sin recargar la página (flujo más suave tipo app).
- Ocultación completa de la interfaz de juego (manos, portales, invocación) hasta que comience la partida.

### Corregido
- El mazo inicial ahora se construye correctamente: se descartan 4 cartas aleatorias (excluyendo metamorfos), se añaden los 2 metamorfos y luego se baraja.
- Se evita que el juego continúe tras un final si el jugador elige no volver a jugar.


---

## [v1.2.0] - 2024-04-23

### Añadido
- Botón azul flotante "Jugar una carta" en la cabecera para abrir el panel de juego.
- Comportamiento coherente del botón azul con la selección de carta (usa la misma lógica que clickar en una carta).
- Botón "Jugar carta" visible solo cuando comienza la partida.
- Panel flotante "Jugar carta" rediseñado: compacto, con botones alineados, y botón de cierre ("X").
- Panel de juego ahora reutiliza lógica existente (`selectCard(0)`), evitando duplicación de código.

### Corregido
- Eliminado botón duplicado `btnEndTurn` en el HTML.
- Corregido error en `setup.js` y `actions.js` por elementos no disponibles al cargar.
- Se evita mostrar el botón azul antes de que comience el juego.
- Ajustado comportamiento de `btnCtrlPlay` para evitar errores si no hay cartas en la mano.

---

## [v1.1.0] - 2025-04-23

### Añadido
- Detección automática de versión desde `manifest.json`.
- Aviso de nueva versión disponible con botón para actualizar la app al instante.
- Enlace desde la interfaz al `CHANGELOG.md` del repositorio.

---


## [v1.0.0] - 2025-04-22

### Añadido
- Primera versión funcional y jugable del simulador.
- Interfaz visual adaptada para escritorio y móvil.
- Sistema completo de turnos y portales.
- Habilidades activas de personajes: Cronista, Clarividente, Centinela, Ocultista, Aprendiz, Metamorfo, etc.
- Sistema de visibilidad por carta según jugador y estado.
- Gestión de puntuación por objetivos invocados.
- Iconografía de personajes.
- Registro y activación de Service Worker para funcionamiento offline.
- Archivo `manifest.json` con nombre, colores e iconos.
- Botón flotante de instalación PWA para Android.
- Instrucciones de instalación para iOS.

---

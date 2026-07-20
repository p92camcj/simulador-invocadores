# Changelog

Todas las versiones importantes del simulador de Invocadores.

---

## [1.7.2.39] - 2026-07-20

### Corregido
- **Cancelar el segundo picker de Cronomante (qué carta subir al top) no costaba nada, permitiendo "reintentar" con otro Portal.** `js/abilities.js`, `case 'Cronomante'`: al cancelar ese segundo paso no se movía ninguna carta ni se marcaba la habilidad como usada, así que la jugadora podía volver a pulsar "Activar habilidad" y examinar un Portal DISTINTO gratis, viendo el contenido de varios Portales en el mismo turno — pero la "investigación" (examinar la pila) ya había ocurrido al abrir ese picker, según `docs/reglamento/REGLAMENTO.md` ("Cronomante"), independientemente de si luego se reordena algo.
- `picker()` (`js/render.js`) admite ahora un cuarto parámetro opcional `onCancel`, invocado al pulsar "Cancelar" en vez de no hacer nada. El segundo picker de Cronomante lo usa para llamar a `onComplete()` sin mover ninguna carta (queda marcada como usada, y se cobra igualmente la Gema si el Portal era central). Es una EXCEPCIÓN deliberada al patrón general de "cancelar nunca cuesta" — documentada con un comentario en el propio código para que no se "corrija" por error en el futuro. El PRIMER picker (elegir qué Portal investigar) sigue el patrón general sin cambios: cancelarlo no cuesta nada.

---

## [1.7.1.38] - 2026-07-20

### Corregido
- **`estaProtegido()` solo comprobaba el Portal concreto donde estaba la Centinela, no todos los Portales de esa jugadora.** `js/abilities.js`: según `docs/reglamento/REGLAMENTO.md` ("Centinela") y su FAQ de la variante a 2 jugadoras ("protege ambos Portales del jugador"), mientras una Centinela esté visible en un Portal de una jugadora, ninguna habilidad puede afectar a NINGUNO de sus Portales, no solo al que contiene la Centinela. Nueva `jugadoraProtegidaPorCentinela(player)` en `js/utils.js` (usada también para simplificar `jugadorProtegidoContraAprendiz`, que antes tenía lógica aparte para partidas a 2 jugadoras — ya innecesaria, la regla general la cubre).
- **La protección bloqueaba también a la propia dueña de la Centinela dirigiendo su propia habilidad contra sus propios Portales.** Según indicación del diseñador del juego, la Centinela protege frente a las **demás** jugadoras, no frente a una misma — ver la nueva nota de interpretación añadida en `docs/reglamento/REGLAMENTO.md` sobre la ambigüedad de la FAQ correspondiente. Nueva `estaProtegidoParaActivar(stackKey, stack, players, actingPlayerIdx)` en `js/utils.js`, que combina la protección con esta excepción; sustituye a `estaProtegido()` en los 4 `case` que la usaban (Ocultista, Cronista, Cronomante, Estratega) y en el Aprendiz (permite elegirse a sí misma aunque esté protegida, sigue bloqueando elegir a otra jugadora protegida). `portalesConEstado()` ahora pasa también la clave del Portal (`val`) a `esInvalido`, necesaria para saber de quién es cada Portal.
- La restricción independiente del Ocultista ("no puede aplicarse sobre una Centinela que esté visible") se mantiene como comprobación separada (`esCentinelaVisible`), y sigue aplicando siempre, incluso sobre la Centinela de la propia jugadora que activa la habilidad.

---

## [1.7.0.37] - 2026-07-20

### Corregido
- **`render()` mostraba el total real de puntos de Gemas de TODAS las jugadoras, incluidas las rivales.** Según `docs/reglamento/REGLAMENTO.md`, las Gemas se roban al azar y en secreto, y solo se muestran bocarriba al final de la partida — mostrar la suma exacta de puntos de las demás en todo momento era una fuga de información que no debía existir.

### Añadido
- Nueva `contarGemasPorNivel(gems)` en `js/utils.js`: devuelve `{nivel: cantidad}` sin revelar valores reales. `render.js` la usa para el desglose de cada jugadora que no es la activa (p. ej. "C×2, B×1, unitaria×3"), sin total de puntos.
- Para la jugadora activa se mantiene y se amplía el desglose: además del total (`sumaGemas`), ahora se ve el detalle agrupado por nivel y valor real de cada Gema (p. ej. "C×1 (v.3 c/u), unitaria×2 (v.1 c/u)").

---

## [1.6.0.36] - 2026-07-20

### Añadido
- **El selector de Portal destino al jugar una carta ahora muestra qué hay en su top.** `js/actions.js`, `window.selectCard`: cada opción de `#selDest` (tus Portales, los neutrales y los de otras jugadoras) añade entre paréntesis 'Vacío', el nombre del personaje si la carta superior es pública, o 'Carta Oculta' si no — mismo criterio de visibilidad que ya usaba `render.js`. Ejemplo: "Tu portal 1 (Vacío)", "Neutral 2 (Carta Oculta)", "Ana P1 (🛡️ Centinela)".

---

## [1.5.5.35] - 2026-07-20

### Corregido
- **`actualizarVisibilidad()` corrompía el estado real de la mano al simular el efecto de Clarividente, rompiendo el intercambio de manos del Aprendiz.** `js/utils.js`: esta función, llamada dentro de cada `render()`, sobrescribía directamente `carta.vis.owner/others/public` de TODAS las cartas en mano de cualquier jugadora con Clarividente activa o reciente — no solo para representarlo visualmente, sino persistiendo el cambio en el propio modelo de datos. Cuando después el Aprendiz intercambiaba esa mano con la de otra jugadora e invertía `owner`/`others` (`case 'Aprendiz'`, `js/abilities.js`), invertía el dato ya corrompido, y las dos cartas recibidas acababan con la misma orientación en vez de una visible y una oculta. De paso corregía también, de forma incorrecta, la visibilidad para el **resto** de jugadoras (`others: false` en ambas cartas) cuando el reglamento solo pide que la Clarividente afecte a lo que ve su **dueña** (`owner`), sin tocar lo que ven las demás.
- Eliminada `actualizarVisibilidad()` por completo: `carta.vis` ahora refleja siempre la orientación real de la carta (una visible y una oculta), y el efecto de Clarividente se decide en el momento de renderizar/seleccionar, con la comprobación de solo lectura `pl.hasClariActivo || pl.haTenidoClarividente` que ya existía en `render.js` y `actions.js`.
- Revisado si seguía haciendo falta implementar "al dejar de tener visible a la Clarividente, voltear una carta a elección" (`docs/reglamento/REGLAMENTO.md`, "Clarividente"): con el dato real intacto, el invariante "una visible y una oculta" nunca llega a romperse, así que no hace falta esa acción manual para mantenerlo — no se ha implementado. Queda anotada en `docs/MEJORAS_FUTURAS.md` una desviación menor y preexistente (el "periodo de gracia" de `haTenidoClarividente` no es un corte inmediato como pide el reglamento).

---

## [1.5.4.34] - 2026-07-20

### Corregido
- **Cronista orientaba la carta robada según cómo estaba en el Portal, no según lo que le faltaba a la mano.** `js/abilities.js`, `case 'Cronista'`: usaba `carta.vis?.public` (visibilidad de la carta en el Portal de origen) para decidir si la carta llegaba visible u oculta a la mano — sin relación con el invariante de mano exigido por `docs/reglamento/REGLAMENTO.md` ("Cronista": siempre una carta visible y una oculta). Ahora se calcula a partir de la única carta que queda en la mano del jugador activo en ese momento (Fase B, tras jugar en Fase A): si esa carta restante es visible para su dueña, la robada entra oculta, y viceversa.

---

## [1.5.3.32] - 2026-07-20

### Corregido
- **Metamorfo ya no restringe la transformación al personaje que falta para completar la invocación activa.** `js/abilities.js`, `case 'Metamorfo'`: eliminado el cálculo de `present`/`miss` a partir de `need` (regla antigua, ya no vigente desde la revisión del reglamento de 2026-07-19 — ver `docs/reglamento/REGLAMENTO.md`, "Metamorfo"). El picker ahora ofrece los 9 personajes no-animales restantes (todo `PERSONAJES_NO_ANIMALES` menos el propio Metamorfo), en cualquier momento del turno, sin depender de qué invocación esté activa ni de qué quede en el mazo — puede imitar incluso a un personaje cuyas dos copias se apartaron al azar al preparar la partida.
- De paso, si la jugadora no tiene ninguna Gema con la que pagar la transformación, ahora se avisa con `alert()` en vez de fallar en silencio (`return` sin mensaje).
- Nueva constante `PERSONAJES_NO_ANIMALES` en `js/utils.js` (roster de los 10 personajes no-animales del mazo base), reutilizada tanto por el nuevo `case 'Metamorfo'` como por `js/game.js` para construir `charsBase` en `initGame()`, eliminando una lista de nombres duplicada (ver `docs/DEUDA_TECNICA.md`, ítem 8).
- La transformación del Metamorfo ya era persistente en la práctica (nada en el código revertía `stack.at(-1).name`); solo la restricción antigua impedía que se pudiera observar en la mayoría de casos. Sigue pendiente la representación visual (ficha superpuesta con la cara del personaje imitado, en vez de solo sobrescribir el nombre) — ver `docs/MEJORAS_FUTURAS.md`.

---

## [1.5.2.31] - 2026-07-20

### Corregido
- **Reparto de Portales centrales por nº de jugadoras no seguía la tabla del reglamento.** `js/setup.js`: 2 jugadoras no creaba ningún Portal central (debía ser 1), 3 jugadoras creaba solo 1 (debían ser 2), y 4 jugadoras caía en la misma rama que 5 y tampoco creaba ninguno (debía ser 1). Corregido a los 4 casos exactos de la tabla (2→2+1, 3→1+2, 4→1+1, 5→1+0), verificado programáticamente.
- El formulario de configuración admite ahora de 2 a 5 jugadoras (antes tope de 4), para poder probar la partida de 5.
- La zona de Portales neutrales (`#zoneNeutral`) se muestra u oculta en cada `render()` según `neutrals.length`, no solo al preparar la partida — necesario porque pueden aparecer Portales centrales nuevos durante la partida (al completar una invocación). De paso se corrigió que `#neutralArea` tenía su propia clase `hidden` que ningún código quitaba nunca, así que los Portales centrales no llegaban a mostrarse en la práctica para ningún nº de jugadoras; verificado en navegador real.

---

## [1.5.1.30] - 2026-07-20

### Corregido
- **Cancelar una habilidad a medias la marcaba como usada igualmente.** El handler de "Activar habilidad" (`js/actions.js`) marcaba `window.habilidadUsadaEsteTurno = true` y cobraba la Gema de Portal central en cuanto se elegía QUÉ habilidad activar, antes de que se resolvieran los `picker()` internos (Cronomante: portal + carta; Estratega: dos portales; Aprendiz: dos jugadoras; Metamorfo: personaje objetivo). Si el jugador cancelaba cualquiera de esos pasos, perdía igualmente el turno de habilidad y, en Portal central, la Gema ya cobrada.
- `applyAbility()` (`js/abilities.js`) admite ahora un `onComplete` que cada `case` invoca una sola vez, justo en el punto de la mutación real — nunca antes. `actions.js` mueve dentro de ese callback el cobro del coste de Portal central y el marcado de la habilidad como usada, en ese orden. El coste propio del Metamorfo (independiente del coste de Portal central) se sigue cobrando dentro de su propio `case`, antes de llamar a `onComplete`, así que en Portal central se cobran las 2 Gemas correctas solo si la transformación se completa de verdad.

---

## [1.5.0.29] - 2026-07-20

### Añadido
- **Imágenes reales de cartas** en vez de emoji + texto, en todos los sitios donde se muestra una carta: mano de la jugadora activa, carta superior visible de cada Portal (propio, de otras jugadoras y central). Nuevo `assets/cards/` con 17 PNG (362×504): los 11 personajes con habilidad, Reena/Sora/Lumo, el reverso genérico de carta oculta, y el anverso/reverso de la carta de ayuda.
- `cardImages` y `CARTA_OCULTA_IMG` en `js/utils.js`: mapeo nombre de personaje → ruta de imagen. Las cartas ocultas para quien mira siempre usan el reverso genérico, con `alt="Carta oculta"` (nunca el nombre real, para no filtrar información oculta a quien inspeccione el DOM).
- `js/render.js`: nueva función interna `cartaImgHtml(name, visible)` sustituye los `mostrarCarta()`/"Carta Oculta" de mano y Portales por `<img>` reales. Los `<select>`/`picker()` de habilidades siguen usando texto (un `<select>` nativo no aloja imágenes de forma fiable).
- `style.css`: `.card` ahora es un contenedor flex con `.card-label` + `.card-img`/`.card-empty`, manteniendo la proporción real de las cartas (362:504) sin deformarlas; ajuste de tamaño en la media query móvil existente (768px).
- Botón "Ver ayuda" en la cabecera (visible en cualquier momento, no solo en partida) que abre un modal simple con `ayuda-anverso.png` y `ayuda-reverso.png` — la carta de ayuda física, referencia rápida de habilidades y secuencia de turno.
- `service-worker.js`: añadidos los 17 assets nuevos a `urlsToCache` y subido `CACHE_NAME` a `invocadores-v1.5.0` para invalidar el caché de quienes ya tengan la PWA instalada (si no, seguirían viendo la versión sin imágenes).

---

## [1.4.2.28] - 2026-07-20

### Corregido
- `docs/DEUDA_TECNICA.md` ítem 2: el aviso "¡Nueva versión disponible!" (`js/version-check.js`) comparaba `X.Y.Z` por **desigualdad**, no por orden — si `version.json` ya iba por delante de la última Release publicada en GitHub (el caso real de este repo, sin release nueva desde `v1.2.0`), el banner aparecía igualmente señalando una versión en realidad más antigua. Ahora la comparación es numérica y direccional: parsea ambos lados a `[X, Y, Z]` y solo muestra el banner si la Release es estrictamente mayor que `version.json`. Si el tag de la Release no es parseable como `X.Y.Z`, no se muestra el banner y se deja un `console.warn` en vez de arriesgar un falso positivo.
- Actualizado `README.md` (sección "El aviso de nueva versión disponible") para reflejar el comportamiento corregido, en vez de documentar el bug como "comportamiento esperado".

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

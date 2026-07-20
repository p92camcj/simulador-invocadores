# Changelog

Todas las versiones importantes del simulador de Invocadores.

---

## [1.12.0.47] - 2026-07-20

### Añadido
- **Se restaura el panel con `<select>` (`#ctrlPlay`, botón "Jugar una carta") eliminado en una tarea anterior: los TRES métodos de jugar carta (panel, clic directo, drag&drop) coexisten siempre, sin ningún ajuste para elegir uno.** Los tres comparten el mismo estado (`window.selectedCardIdx`) y la misma función interna `jugarCartaSeleccionadaEn()` en `js/actions.js` — ninguno duplica validación ni puede dejar a los otros dos en un estado inconsistente (abrir el panel preselecciona la carta ya elegida por clic; cancelar desde cualquiera de los dos limpia la selección en ambos).
- **El bloqueo de "acción no permitida" se extiende a la selección de OBJETIVO de habilidad, cuando ese objetivo es un Portal**: Ocultista, Cronista, el primer picker de Cronomante (elegir Portal a investigar) y los dos pickers de Estratega. Nueva `pickerPortal()` en `js/render.js` — mismo modal `picker()` de siempre, pero además habilita clicar directamente el Portal válido en el tablero como alternativa (`window.pickerObjetivoPortal`, consumido por `renderBoardGrid()` y `window.selectPortalObjetivo` en `actions.js`); los Portales NO válidos (mismo cálculo real de cada habilidad, incluida la protección de Centinela) se ven atenuados, con 🚫 en la etiqueta, y no responden al clic. El segundo picker de Cronomante (elige una carta dentro de la pila, no un Portal), Aprendiz (elige jugadoras) y Metamorfo (elige un nombre de personaje) se quedan solo con el modal — no tienen una representación de "Portal" natural que clicar en el grid.

---

## [1.11.0.46] - 2026-07-20

### Cambiado
- **La "vista de depuración" (botón 🔧, todo visible, sin interacción) deja de ser un modo aparte: el grid de N columnas pasa a ser la ÚNICA vista de juego, con visibilidad real e interactiva.** Eliminados `#btnDebugView`, el banner "MODO PRUEBAS", `renderDebugGrid()` y las antiguas zonas `zoneActive`/`zoneOthers`/`neutralArea`/`#sectionflex`/`#zoneNeutral` (ya sin uso, quitadas también del HTML). `js/render.js`: nueva `renderBoardGrid()` interna, invocada siempre por `render()`, con las mismas reglas de secreto de información que antes tenían las zonas separadas — Portales según `vis?.public`; mano de la jugadora activa según `vis?.owner`/Clarividente; mano de cualquier otra jugadora según `vis?.others`, salvo ocultación total por Clarividente (decisión de mesa de una tarea anterior, portada sin cambios).
- La columna de la jugadora con el turno se resalta (`.turno-activo`, borde/resplandor); el resto se atenúa (`.turno-inactivo`, opacidad reducida) sin perder su color de identidad fijo por índice.
- Las cartas de la mano activa y los Portales del grid son los mismos elementos clicables/arrastrables ya implementados en la tarea anterior (clic para seleccionar/jugar, drag&drop nativo) — no se recrean, se portan directamente a la nueva `renderBoardGrid()`.
- Responsive: en móvil el grid usa scroll horizontal manteniendo las N columnas visibles (columnas de ancho fijo, `grid-auto-columns: minmax(260px, 1fr)`) en vez de colapsar a una sola columna.
- Los Portales centrales se mantienen como columna final "Neutrales", igual que en la vista de depuración de la tarea anterior.

---

## [1.10.1.45] - 2026-07-20

### Cambiado
- **Cronomante: cancelar el segundo picker ("qué carta subir al top") ya no cuesta nada, pero ahora permite reintentar SIN poder elegir un Portal distinto al ya investigado.** Cambia a propósito el comportamiento de `1.7.2.39` (indicación explícita del dueño del proyecto): antes, cancelar ese segundo paso consumía la habilidad sin más (marcaba `habilidadUsadaEsteTurno` y cobraba si aplicaba, sin mover ninguna carta). Ahora cancelar no cuesta nada ni marca la habilidad como usada, pero el Portal ya investigado (`window.cronomantePortalInvestigado`, nuevo estado de turno reseteado en `nextTurn()`) queda fijado: "Activar habilidad" sigue disponible y lleva DIRECTO al segundo picker de ese mismo Portal, saltando el picker de nivel superior — no se puede investigar otro Portal gratis. Solo se cobra el coste y se marca la habilidad como usada cuando la jugadora selecciona de verdad una carta (aunque sea la que ya está en el top).
- `js/actions.js` guarda el `onComplete` de la activación en `window.cronomanteOnComplete` cuando la habilidad es Cronomante, para poder completarla más tarde con el mismo coste pendiente (Portal central) sin reabrir el picker de nivel superior.

---

## [1.10.0.44] - 2026-07-20

### Añadido
- **Jugar carta por clic directo (carta → Portal), sustituyendo el panel con dos `<select>` + botón "Jugar".** Clic en una carta de la propia mano la selecciona (`window.selectHandCard`, clase `.selected`); con una carta seleccionada, todos los Portales (propios, centrales y de otras jugadoras) se muestran como objetivo clicable (clase `.target-portal`) — clic en uno de ellos juega la carta ahí (`window.tryPlayOnPortal`), mismo resultado final (`stack.push(...)`) y mismas reglas de Fase A de siempre (incluido el hook de Centinela). Un segundo clic sobre la misma carta la deselecciona; el nuevo botón "Cancelar selección" (`#btnPlayCancel`, en la cabecera) hace lo mismo y solo es visible mientras hay una carta elegida.
- **Drag & drop nativo como alternativa que coexiste con el clic**: `draggable="true"` en las cartas de la mano, `dragstart`/`dragover`/`drop` en los Portales objetivo — arrastrar una carta hasta un Portal tiene el mismo efecto que seleccionarla y hacer clic en él.
- Eliminado el panel `#ctrlPlay` (los `<select>` de carta/destino) y el botón de cabecera "Jugar una carta" (`#btnCtrlPlay`), ya innecesarios: la mano ya se muestra siempre en pantalla durante el turno, así que seleccionar directamente sustituye por completo a abrir un panel aparte.
- La vista de depuración (Tarea C) sigue siendo solo de inspección: no lleva seleccción/clic para jugar cartas, hay que volver a la vista normal para jugar.

---

## [1.9.0.43] - 2026-07-20

### Añadido
- **Vista de depuración**, solo para pruebas del propio dueño del proyecto — nunca para partidas reales, ya que muestra toda la información oculta a la vez. Nuevo botón `#btnDebugView` ("🔧 Vista de pruebas") en la cabecera, visible mientras hay partida en curso, que alterna entre la vista compartida normal y esta nueva vista.
- `js/render.js`: nueva `renderDebugGrid(players, neutrals)`, un grid CSS con una columna por jugadora (`grid-template-columns: repeat(N, 1fr)`, adaptado a 2-5 jugadoras) más una columna final para los Portales centrales si los hay. Cada columna muestra los Portales de esa jugadora arriba y su mano en un sub-grid de 2 columnas debajo, siempre con el nombre real de cada carta (ignora `vis.public`/`owner`/`others` por completo). `render()` decide automáticamente qué vista mostrar según `window.debugViewActive` (nuevo flag de turno, reseteado en `initGame()`/`resetJuego()`), así que la vista de depuración se mantiene actualizada sin lógica adicional en cada acción.
- `style.css`: nuevas clases `.debug-view` (borde rojo llamativo + banner "MODO PRUEBAS"), `.debug-grid`/`.debug-col`/`.debug-hand`. En móvil, si las N columnas no caben razonablemente, se usa scroll horizontal con columnas de ancho fijo en vez de forzar el layout.

---

## [1.8.2.42] - 2026-07-20

### Cambiado
- **Clarividente ahora oculta la mano COMPLETA de su dueña al resto de jugadoras, no solo revela la carta antes oculta a su propia dueña.** Decisión de mesa más estricta que el texto literal del glosario "Carta oculta" de `docs/reglamento/REGLAMENTO.md` (que no dice explícitamente que la carta deje de ser visible para el resto) — indicación directa del dueño del proyecto, documentada como nueva nota de interpretación en el propio reglamento. `js/render.js`, `zoneOthers`: mientras `p.hasClariActivo || p.haTenidoClarividente` sea cierto para una jugadora, sus DOS cartas se muestran como "Carta oculta" al resto, sobrescribiendo (no combinando con OR) la visibilidad normal por carta (`h.vis?.others`).
- `actualizarClarividente(players)` (`utils.js`) ya calculaba estos flags para TODAS las jugadoras en cada `render()`, no solo la activa — confirmado que sigue así tras los cambios de tareas anteriores, así que el ocultamiento se aplica de inmediato al jugar la carta, sin esperar al turno de la jugadora afectada.
- **Nota sobre por qué la propia dueña solo ve su "mano doble" cuando es su turno**: esto NO es un bug de estado — es una limitación inherente al diseño de pantalla compartida de este simulador (ver "Future direction" en `CLAUDE.md`). `zoneActive` solo renderiza la mano de `players[window.turn]`; mostrar el efecto de Clarividente de otra jugadora fuera de su turno filtraría esa información a todas las demás, que miran la misma pantalla. Se resolverá de forma honesta solo con el futuro multijugador por dispositivo, no "arreglando" el renderizado actual.

---

## [1.8.1.41] - 2026-07-20

### Corregido
- **El auto-giro de otras Centinelas visibles nunca se disparaba: `case 'Centinela'` en `js/abilities.js` era código muerto.** Centinela está fuera de `PERSONAJES_CON_HABILIDAD` (`utils.js`) a propósito — su efecto es pasivo — así que ese `case` nunca se alcanzaba vía Fase B (`opcionesActivarHabilidad()` nunca lo ofrece como opción). Como tampoco había ningún otro disparador, podían coexistir varias Centinelas visibles en mesa a la vez, contra `docs/reglamento/REGLAMENTO.md` ("solo puede haber una Centinela visible en mesa").
- Extraída la lógica a `ocultarOtrasCentinelas(stackJugada, players, neutrals)`, exportada desde `js/abilities.js`, y enganchada directamente en `js/actions.js` (Fase A), justo después de `stack.push(...)` al jugar una carta: si la carta jugada es una Centinela, oculta cualquier otra Centinela visible en cualquier Portal de cualquier jugadora o central. El `case 'Centinela'` muerto se elimina de `applyAbility()` (queda un comentario explicando por qué no debe volver a añadirse).
- Verificado programáticamente: jugar una Centinela con otra ya visible en el Portal de otra jugadora la oculta automáticamente, sin necesidad de activar ninguna habilidad manualmente.

---

## [1.8.0.40] - 2026-07-20

### Añadido
- **Modal de "Novedades" in-page**, abierto al pulsar el número de versión (`#version-info`) o el aviso "¡Nueva versión disponible!" — antes ambos abrían `CHANGELOG.md` en GitHub en pestaña nueva; ahora ninguno lo hace, los dos abren el mismo modal sin salir de la app. `js/version-check.js`: fetch perezoso de `NOVEDADES.md` (solo en el primer clic, cacheado en una variable de módulo para clics siguientes), parser de Markdown propio sin librerías externas (reconoce `## `, `- ` con continuación multilínea, `**negrita**` y `---`), y modal construido dinámicamente (overlay + caja con scroll interno) usando nuevas clases `.modal-overlay`/`.modal-box`/`.modal-content` en `style.css`, coherentes con la convención visual ya usada por `.section`/`.play-title`/`.close-btn`.
- Nuevo `NOVEDADES.md` en la raíz: una entrada por cada versión de `CHANGELOG.md`, en lenguaje sin jerga de programación para quien juega y usa la app. **Nueva norma en `CLAUDE.md`**: a partir de ahora, cualquier tarea que añada una entrada a `CHANGELOG.md` debe añadir también la entrada equivalente a `NOVEDADES.md` en el mismo commit.

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

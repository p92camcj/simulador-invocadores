# Changelog

Todas las versiones importantes del simulador de Invocadores.

---

## [1.17.0.76] - 2026-07-21

### Añadido
- **Estrategia adversarial del autómata en Fase A (Bloque 3)**: hasta
  ahora el autómata jugaba bien para sí mismo pero nunca tenía en cuenta
  el efecto de sus jugadas sobre el resto — tapar un personaje visible
  ajeno o duplicar a propósito para anular una invocación de otra
  jugadora son jugadas completamente legales que no se contemplaban.
  - `'normal'`: nueva `decidirJugadaAdversarialNormal()` (`js/bot.js`),
    ajuste ligero sobre la heurística greedy de siempre, solo con
    información visible ahora mismo (sin memoria/probabilidad) y solo con
    la carta conocida: denegación GRATUITA por duplicado (la carta
    conocida es requisito activo, ya visible en Portal ajeno, y el propio
    bot no la tenía) o, si no, tapar un Portal ajeno con la única copia
    visible de un requisito activo.
  - `'dificil'`: `valorEsperadoDeAccion()` (`js/bot-probabilidad.js`) suma
    ahora un término adversarial explícito y generalizado (no solo un
    desempate entre opciones ya iguales) — nueva
    `calcularNecesariosUnicosDeRivales()` identifica qué requisitos de la
    invocación activa hoy solo tiene visible una rival, ponderado por
    `PESO_ADVERSARIAL` (0.5, documentado en el propio código).
  - Discrepancia con el prompt original documentada en el código: se
    asumía que ya existía un desempate por `contarGemasPorNivel` al que
    solo había que "generalizar" — nunca se implementó en la ronda
    anterior, así que este término es nuevo por completo, no una extensión.
- 4 tests nuevos en `tests/run-tests.mjs`: `calcularNecesariosUnicosDeRivales`,
  'normal' prefiriendo la denegación gratuita y el tapado sobre una jugada
  neutra equivalente, y `valorEsperadoDeAccion` demostrando que el término
  adversarial permite preferir perjudicar a una rival aunque el beneficio
  propio directo sea nulo.

---

## [1.16.0.75] - 2026-07-21

### Añadido
- **Marcador final y desempate (Bloque 2)**: `finalizarPartida(motivo)`
  (`js/game.js`) ahora calcula y muestra, antes de preguntar "¿jugar otra
  vez?", el recuento final de Gemas de cada jugadora y quién gana — según
  REGLAMENTO.md, "Final de la partida". Nueva `calcularResultadoFinal(players,
  invocacionesCompletadas)` (`js/utils.js`, función pura): (1) mayor suma
  total de Gemas; en empate, (2) más invocaciones DISTINTAS en las que se
  ha participado (nº de niveles de `LEVELS` presentes en `player.gems` —
  las Gemas unitarias sueltas de Pícaro/Maestro, `nivel: 'unitaria'`, no
  cuentan); en empate, (3) Gema de mayor valor en la ÚLTIMA invocación
  completada en esa partida; en empate, (4) se repite con la invocación
  completada inmediatamente anterior, y así hacia atrás; si el empate
  persiste tras agotar todas las completadas, victoria compartida.
- Nuevo `window.invocacionesCompletadas` (inicializado en
  `initGame()`/`resetJuego()`, `js/game.js`): registra, en orden real, los
  niveles de invocación completados en la partida en curso — se empuja en
  `js/actions.js` justo donde ya se reparten las Gemas de esa invocación.
  Necesario porque la partida puede terminar antes de completar todas las
  invocaciones (mano vacía), así que no se puede asumir siempre C→B→A.
- Sigue usando `alert()`/`confirm()` (como el resto de la app hoy, ver
  `docs/DEUDA_TECNICA.md` ítem 10) para mostrar el resultado — no hay
  pantalla de resultados dedicada en este bloque, alcance deliberado (ver
  `docs/MEJORAS_FUTURAS.md`).
- 5 tests nuevos en `tests/run-tests.mjs` cubriendo la cadena de desempate
  completa: suma distinta, suma igual con distinto nº de invocaciones,
  suma e invocaciones iguales con distinto valor en la última invocación,
  empate que se resuelve retrocediendo a la invocación anterior, y empate
  total tras agotar todos los niveles.
- Marcada como resuelta la sección 4 de `docs/AUDITORIA_REGLAS.md`; la
  variante 2vs2 (`docs/MEJORAS_FUTURAS.md`) sigue pendiente, ahora
  específicamente porque necesita sumar por EQUIPO, no por jugadora — el
  marcador individual no lo contempla.

---

## [1.15.1.74] - 2026-07-21

### Corregido
- **Mensajes del autómata en tercera persona (Bloque 1 de la tarea de
  marcador final/estrategia)**: `listaPortalesConDestino()` (`js/bot.js`)
  generaba la etiqueta de un Portal propio como "tu Portal N" — segunda
  persona, como si la autómata se hablase a sí misma, cuando en realidad el
  resumen de turno (`alert()`) lo lee siempre la persona humana observando
  la partida compartida. Ahora usa "su propio Portal N" (Portal de la
  propia autómata) / "el Portal N de {nombre}" (Portal ajeno) / "el Portal
  Neutral N" — siempre en tercera persona, sin excepción.
- **Resumen de habilidad con el objetivo real**: hasta ahora el resumen de
  turno solo decía "Activó su habilidad: Ocultista." sin decir sobre qué
  Portal/mano actuó. `resolverPickersAbiertos()` (`js/bot.js`) ahora
  devuelve los valores REALMENTE elegidos en el/los `picker()` resueltos
  (antes no devolvía nada), y la nueva `describirObjetivoHabilidad()`
  los traduce a una frase en tercera persona que identifica correctamente
  de quién es cada Portal/mano afectado (p. ej. "Activó su habilidad de
  Cronista: se llevó a la mano la carta superior del Portal 2 de Ana.") —
  cubre, por ahora, Ocultista/Cronista/Maestro (las únicas habilidades que
  la Fase B del autómata sabe usar hoy); el resto se documenta a la vez que
  se les da uso real. `resolverPickersAbiertos()` también admite ahora un
  array de valores preferidos por paso (no solo el primero), preparado para
  las habilidades de varios pasos que se añadirán más adelante en esta
  misma tarea.
- Añadidos dos tests nuevos en `tests/run-tests.mjs` (exportando
  `listaPortalesConDestino`/`describirObjetivoHabilidad` desde `js/bot.js`
  solo para poder probarlos sin DOM) para que una regresión futura a
  segunda persona, o una descripción de objetivo mal atribuida, falle el
  test en vez de descubrirse jugando.

---

## [1.15.0.73] - 2026-07-21

### Añadido
- **Motor probabilístico de conteo de cartas para el autómata, nivel
  "Difícil" (Bloque 3)**: nuevo módulo `js/bot-probabilidad.js`, con
  funciones puras (sin DOM) que solo operan sobre la vista saneada del bot
  y su propia memoria — nunca sobre `players`/`neutrals`/`window.deck`
  reales, igual que el resto de `js/bot.js`. `composicionMazoTotal()`
  (nueva en `js/utils.js`, factorizada de un literal que antes vivía
  duplicado dentro de `initGame()` en `js/game.js`) da la composición
  pública total del mazo configurado; `estimarProbabilidadesPersonajes()`
  resta lo ya contabilizado por el bot (una memoria nueva por autómata,
  `window.memoriaBots[botIdx]`, que recuerda qué personaje ha visto pasar
  por cada Portal aunque ahora esté tapado — solo en memoria JS de la
  partida en curso, nunca se persiste) y reparte la probabilidad de los
  personajes de ubicación desconocida de forma uniforme entre los huecos
  restantes; `valorEsperadoDeAccion()` estima el valor esperado en Gemas de
  jugar o mover un personaje a un Portal propio, ajeno o central/neutral
  (ponderado por quién cobraría esa Gema en cada caso, y con un bonus si la
  jugada completa la invocación activa ahora mismo). La dificultad
  `'dificil'` (`js/bot.js`) usa este motor tanto en Fase A (evalúa TODAS
  las combinaciones carta×Portal por valor esperado, en vez del atajo
  greedy de `'normal'`) como en Fase B (Ocultista/Cronista ponderados por
  la distribución de probabilidad real del Portal oculto en cuestión, y
  también la nueva habilidad activa del Maestro — determinista, ya que su
  carta objetivo es una identidad conocida con certeza). La dificultad
  `'normal'` sigue exactamente igual, sin tocar.
- **Selector de dificultad de autómatas** en la pantalla de configuración
  (`index.html`/`js/setup.js`, `#selDificultadBots`): "Normal" o "Difícil",
  visible solo si se configura al menos un autómata. Decisión deliberada
  de esta tarea: la dificultad es GLOBAL para todos los autómatas de la
  partida, no una por autómata — evita complicar la fila de nombres por
  jugadora con un selector adicional por fila.
- Verificado manualmente en el navegador (consola, dos escenarios con
  estado inyectado para eliminar el azar): (1) con `need =
  ['Aprendiz','Pícaro','Centinela']`, Pícaro ya satisfecho en el tablero y
  la propia carta CONOCIDA del bot siendo también Pícaro (duplicado
  confirmado, valor esperado 0 en cualquier Portal), el bot en "Difícil"
  jugó su carta OCULTA en vez del duplicado conocido — resultó ser
  Aprendiz, avanzando de verdad la invocación en vez de desperdiciar el
  turno, algo que la heurística "Normal" (que solo mira si hay un único
  Portal bloqueante, no si la carta conocida ya es inútil) habría jugado
  igualmente aunque fuera un duplicado confirmado. (2) Con Aprendiz y
  Pícaro ya satisfechos y solo faltando Centinela, sabiendo que Ana lo
  tenía oculto en su mano y con Maestro visible en un Portal central, el
  bot activó Maestro, pagó la Gema del coste de Portal central y bajó el
  Centinela de Ana a su propio Portal, reponiendo su mano correctamente.
  Añadidos 6 casos a `tests/run-tests.mjs` cubriendo el conteo de cartas,
  que la estimación nunca necesita ni acepta el estado real (mismo
  resultado si el contenido real de un Portal oculto cambia, dado el mismo
  `(vista, memoria)`), la deduplicación de memoria, y el valor esperado por
  tipo de Portal destino.
- **No implementado, documentado como decisión de alcance**: el desempate
  opcional con la estimación de Gemas de rivales que sugería el diseño
  original de esta tarea (señal débil, complejidad no justificada — ver el
  comentario en `decidirJugadaFaseADificil`, `js/bot.js`), y la
  consideración de "no tapar un Portal propio con una habilidad ya
  visible" al elegir dónde jugar en Fase A (hoy el valor esperado de la
  carta oculta es el mismo en cualquier Portal propio).

---

## [1.14.0.72] - 2026-07-21

### Añadido
- **Habilidad activa del Maestro (Bloque 2)**: hasta ahora el Maestro solo
  tenía su bonus pasivo de 3 Gemas; se añade la habilidad activa que
  introdujo la revisión del reglamento de 2026-07-19 — en su turno, quien
  tenga a Maestro visible en su Portal puede elegir una carta que vea en la
  mano de otra jugadora (la única carta de esa mano oculta para su dueña
  pero visible para el resto) y bajarla directamente al Portal de **esa
  misma jugadora** (nunca a uno propio del Maestro); la jugadora afectada
  repone mano robando del mazo. Nuevo `case 'Maestro'` en `js/abilities.js`
  (con la lógica pura de selección/movimiento extraída a
  `candidatosObjetivoMaestro()`/`bajarCartaMaestro()`, testable sin DOM) y
  `'Maestro'` añadido a `PERSONAJES_CON_HABILIDAD` (`js/utils.js`). Respeta
  la protección de Centinela reutilizando el mismo helper que ya usaba
  Aprendiz (renombrado de `jugadorProtegidoContraAprendiz` a
  `jugadorProtegidoComoObjetivo`, ya no es específico de una sola
  habilidad) y re-dispara el auto-giro de Centinela si la carta movida
  resulta ser una. Se añade también `reponerManoSiFalta()` (`js/utils.js`),
  factorizada de la lógica de robo que ya usaba el fin de turno en
  `js/actions.js`, para no duplicarla. Corrección de paso: el propio
  `docs/reglamento/REGLAMENTO.md` tenía una contradicción interna (su
  párrafo principal decía que la carta baja al Portal de la jugadora
  afectada; su nota de cambio decía "a su propio Portal" del Maestro) —
  confirmado con el propietario del proyecto que la lectura correcta es la
  del párrafo principal, se corrige la nota de cambio para eliminar la
  contradicción. Verificado manualmente en el navegador (consola,
  inyectando el estado exacto para evitar depender del azar del mazo): el
  Maestro puede coger la carta oculta-para-el-resto de otra jugadora y
  bajarla a un Portal propio de esa jugadora (eligiendo cuál si tiene más
  de uno, caso de 2 jugadoras con 2 Portales cada una), la jugadora
  afectada repone mano correctamente a 2 cartas, y si esa jugadora tiene
  una Centinela visible la acción queda bloqueada (con aviso, sin marcar
  la habilidad como usada). Añadidos 4 casos a `tests/run-tests.mjs`
  cubriendo la lógica pura.

---

## [1.13.11.67] - 2026-07-21

### Corregido
- **Bug real descubierto al evaluar `docs/DEUDA_TECNICA.md` ítem 10 — activar la habilidad de un Portal central era gratis si la jugadora no tenía Gemas con las que pagar**: `pagarActivacionPortalCentral()` (`js/utils.js`) ya devolvía `false` y mostraba un `alert()` cuando la jugadora no podía pagar, pero su valor de retorno nunca se comprobaba en el `onComplete` de `js/actions.js` que la llama — la habilidad ya se había aplicado de verdad en ese punto (el patrón `onComplete` de `applyAbility()` cobra el coste DESPUÉS del efecto, nunca antes), así que un fallo de pago no revertía nada: la jugadora se quedaba con el efecto de la habilidad sin pagar el coste, pese al aviso. Peor aún, `opcionesActivarHabilidad()` ni siquiera comprobaba si la jugadora podía pagar antes de ofrecer la opción "(cuesta 1 Gema)". Se añade la comprobación en origen: la opción de un Portal central solo se ofrece si `sumaGemas(player.gems)` cubre el coste real — 1 para cualquier personaje, pero **2** para el propio Metamorfo, cuya transformación ya cuesta 1 Gema unitaria propia e independiente del coste de activar el Portal central que la contiene (ambos costes se cobran por separado, ver el comentario ya existente en `case 'Metamorfo'` de `abilities.js`) — antes de este arreglo, una jugadora con exactamente 1 Gema podía transformar un Metamorfo central pagando solo ese coste propio y obtener la activación del Portal central gratis. Se usa `sumaGemas()` en vez de `.length` porque una única Gema de valor≥2 sí puede cubrir un coste de 2 (parte el cambio, ver `gastarGemaUnitaria()`). Verificado en el navegador con 4 escenarios: sin Gemas + Ocultista central (ya no se ofrece), Metamorfo central con 1 Gema de valor 1 (sigue sin ofrecerse, coste total 2), Metamorfo central con una Gema de valor 2 (sí se ofrece), y Ocultista central con 1 Gema (sí se ofrece) — además de confirmar que las opciones gratis de Portales propios no se ven afectadas por no tener Gemas.

---

## [1.13.10.66] - 2026-07-21

### Cambiado
- **`docs/DEUDA_TECNICA.md` ítem 4 — iteración duplicada de "todos los portales de jugadoras + neutrales" centralizada en un helper único**: se añade `todosLosPortales(players, neutrals)` a `js/utils.js`, devolviendo `{ stack, playerIdx, portalIdx }[]` (`playerIdx` es `null` para un Portal neutral). Sustituye el patrón manual `players.forEach(p => p.portals.forEach(...))` seguido de `neutrals.forEach(...)` en 4 sitios: `js/actions.js` (construcción de `map`/`allPortals` en la comprobación de invocación, el bonus pasivo de Pícaro, y el recuento de Maestros reales visibles) y `js/abilities.js` (`ocultarOtrasCentinelas()`). Sin cambio de comportamiento en ningún caso — el filtrado por `playerIdx !== null` donde el código original solo miraba Portales de jugadora (nunca centrales) se preserva explícitamente. Verificado en el navegador simulando 3 escenarios completos tras el refactor: invocación de nivel A con bonus de Maestro (3 Gemas unitarias extra para su dueña, sin Pícaro visible), invocación de nivel C con Pícaro presente (Gema unitaria de bonus + su carta se oculta tras cobrarla), y `ocultarOtrasCentinelas()` con Centinelas en ambas jugadoras y en un Portal central (solo la recién jugada permanece visible) — los tres coinciden con el comportamiento esperado antes del refactor.

---

## [1.13.9.64] - 2026-07-21

### Corregido
- **`docs/DEUDA_TECNICA.md` ítem 5 — nombres de jugadora sin escapar interpolados vía `innerHTML` en `js/render.js`**: `renderBoardGrid()` interpolaba `p.name` directamente en la plantilla de string del tablero (`html += \`<h4>${p.name}...\``) antes de asignarla de una vez vía `grid.innerHTML = html` — un nombre con marcado HTML embebido se ejecutaría/renderizaría como HTML real en vez de mostrarse como texto. La parte equivalente en `js/setup.js` ya se había resuelto en una ronda anterior al construir el formulario de nombres con `createElement` en vez de concatenar `innerHTML`. Se añade `escapeHtml()` a `js/utils.js` (reutilizable por cualquier módulo ES del proyecto) y se aplica a `p.name` en el único punto de `render.js` que lo necesitaba — se revisó el resto de interpolaciones de nombre del archivo (`h.name`/`c.aspecto` de cartas, títulos de `picker()`) y todas usan `textContent` o son nombres de personaje fijos del propio juego, no texto introducido por una jugadora. Verificado en el navegador: un nombre con `<b>bold</b>` embebido se muestra como texto literal (sin crear ningún elemento `<b>` real), y nombres normales (incluida la marca 🤖 de autómata y el desglose de Gemas) se siguen mostrando igual que antes.

---

## [1.13.8.63] - 2026-07-21

### Eliminado
- **`docs/DEUDA_TECNICA.md` ítem 9 — `hasClari()` código muerto en `js/utils.js`**: `export`ada pero no importada ni usada en ningún otro archivo (confirmado con grep). Su lógica no era siquiera un duplicado exacto de la usada realmente en `actualizarClarividente()` (`hasClari` comprobaba `stack.at(-1).vis` truthy; `actualizarClarividente` comprueba específicamente `vis?.public === true`, la condición correcta), así que reutilizarla tal cual habría introducido un comportamiento distinto — se elimina directamente en vez de intentar fusionarla. Se quita también la fila correspondiente de `Documentacion_Simulador_Invocadores.md`. Verificado que no queda ninguna referencia (`grep`) y que la app sigue cargando con normalidad.

---

## [1.13.7.62] - 2026-07-21

### Corregido
- **`docs/DEUDA_TECNICA.md` ítem 11 — `fetch` de la última Release de GitHub sin `.catch()`**: `js/version-check.js` ya gestionaba el fallo de `fetch('./version.json')` con su propio `.catch()`, pero la segunda cadena (`fetch('.../releases/latest')`, anidada dentro del `.then()` de la primera) no tenía ningún manejo de error propio — un fallo de red, rate limit de la API de GitHub, o estar offline quedaba como rechazo de promesa no gestionado, invisible para la usuaria. Se añade `.catch(err => console.error(...))` simétrico al de la primera petición. Verificado en el navegador simulando un fallo de red: el error se captura y se registra en consola sin generar ningún `unhandledrejection`; en el caso normal, el banner de nueva versión y el número de versión mostrado siguen funcionando igual que antes.

---

## [1.13.6.61] - 2026-07-21

### Corregido
- **`docs/DEUDA_TECNICA.md` ítem 13 — `window.cronomanteOnComplete` no se reseteaba junto a `window.cronomantePortalInvestigado`**: `js/game.js` (`initGame()`, `nextTurn()`, `resetJuego()`) y `js/index.js` (inicialización de estado global) ya reseteaban `window.cronomantePortalInvestigado = null` en los 3 puntos de entrada relevantes, pero dejaban el callback guardado en paralelo (`window.cronomanteOnComplete`, usado por Cronomante para completar una investigación tras un cancel) como referencia obsoleta. Sin impacto funcional real (solo se lee dentro de `if (window.cronomantePortalInvestigado)`, que sí queda correctamente cerrado), pero es higiene de estado que convenía cerrar antes de que algún cambio futuro dependiera implícitamente de ese acoplamiento. Se añade `window.cronomanteOnComplete = null;` junto a los 4 resets existentes.

---

## [1.13.5.60] - 2026-07-21

### Cambiado
- **Estética del desglose de Gemas: círculos de color en vez de texto plano**: `js/render.js` sustituye `desgloseGemasPropio()`/`desgloseGemasAjeno()` (texto tipo "C×2, B×1, unitaria×3") por una única función `gemDotsHtml(gems, {mostrarValorReal})`, que agrupa por nivel y pinta un `<span class="gem-dot gem-dot--X">` (círculo CSS, sin icono cargado) seguido del recuento — mapeo de colores fijo según las reglas del juego: azul = Gemas unitarias de valor 1, amarillo = primera invocación completada (nivel C), rojo = siguiente invocación (nivel B), morado = última invocación (nivel A). Para la jugadora activa (`mostrarValorReal: true`) se añade entre paréntesis la suma de los valores reales de cada grupo, junto al total ya existente (`sumaGemas`); para el resto, solo el recuento por nivel, sin ningún valor real — misma regla de no fuga de información que ya existía. Nuevas clases en `style.css` (`.gem-breakdown`, `.gem-dot`, `.gem-dot--unitaria`/`--c`/`--b`/`--a`), con `flex-wrap` para seguir cabiendo bien en el grid de columnas por jugadora en móvil. Verificado manualmente con Gemas de varios niveles para la jugadora activa y para otra jugadora, y que no aparece scroll horizontal añadido en un viewport de 380px.

---

## [1.13.4.59] - 2026-07-21

### Corregido
- **Service Worker con caché desactualizada indefinidamente (causa real del "contador de mazo congelado" en partidas 2vs2 de autómatas)**: investigado el reporte de que el indicador de cartas restantes (`#lblTurn`, actualizado en `nextTurn()` de `js/game.js`) no bajaba en una partida de 2 jugadoras ambas autómatas. Verificado, construyendo el estado a mano y jugando partidas reales de 2 bots contra el código servido sin ningún Service Worker de por medio, que `js/game.js` SÍ recalcula y pinta `window.deck.length` en cada turno, sea humano o bot — mismo camino de código para ambos, sin ninguna rama que se salte la actualización. La causa real estaba en `service-worker.js`: `CACHE_NAME` fijo (`invocadores-v1.5.0`, nunca actualizado) y estrategia cache-first para todo, incluida la lógica de juego — un Service Worker solo repuebla su caché cuando su PROPIO contenido en bytes cambia, así que tocar `js/game.js`/`version.json` nunca disparaba un refresco, y cualquier jugadora con la PWA ya instalada podía quedar ejecutando indefinidamente una versión antigua del código sin ninguna vía para refrescarse sola (ver `docs/DEUDA_TECNICA.md` ítem 15 para el detalle completo). Arreglo: estrategia network-first para documento/JS/CSS/JSON (cae a caché solo sin conexión), `CACHE_NAME` derivado de `version.json` con purga de cachés antiguas en `activate`, `skipWaiting()`/`clients.claim()`, y `js/bot.js`/`js/pwa-install.js` añadidos a la lista de cacheo (faltaban). Verificado manualmente que, sin reinstalar el Service Worker, una petición a través de él ya devuelve el contenido fresco del servidor tras bumpear `version.json` en disco.

---

## [1.13.3.58] - 2026-07-21

### Corregido
- **`#selDest` truncaba sin elipsis las opciones largas en móvil**: la funcionalidad de mostrar entre paréntesis qué hay en el top de cada Portal ("Tu portal 1 (Vacío)", "Neutral 1 (✍️ Cronista)", "Beto P1 (Carta Oculta)") seguía intacta en `js/actions.js` (`topLabel()`/`abrirPanelJugarCarta()`, restaurada en v1.12.0.47) — el problema real, confirmado tras probar en un viewport de 380px real (iframe, no simulado), era puramente de CSS: `#ctrlPlay select`/`.play-line select` (`style.css`, `@media (max-width: 768px)`) capaban el `<select>` a `max-width: 160px`, y un `<select>` nativo no añade elipsis al desbordar — simplemente cortaba el texto ("Beto P1 (Carta Ocult" sin más), perdiendo justo la información que el selector existe para mostrar. Se sube el tope a `max-width: 100%`: cada `<select>` ya ocupa su propia fila dentro del panel gracias al `flex-wrap` existente de `.play-line`, así que hay margen de sobra. Verificado con el nombre de autómata más largo del pool (`Místicobot`) combinado con el personaje más largo (`Ocultista`): "Místicobot P1 (🙈 Ocultista)" se muestra completo, sin desbordar el panel ni el viewport de 380px.

---

## [1.13.2.57] - 2026-07-21

### Corregido
- **Botones de cabecera desbordaban en móvil**: `.header-bar` (`style.css`) usaba `display: flex` sin `flex-wrap`, así que en viewports estrechos (~360-400px) la fila de botones ("Jugar una carta", "Cancelar selección", "Activar habilidad", "Terminar turno", "Ver ayuda") no cabía y desbordaba la página entera, obligando a hacer scroll horizontal de toda la pantalla para pulsarlos todos. Se añade `flex-wrap: wrap` a la regla general (sin efecto en escritorio, donde ya cabían en una fila) y, dentro del `@media (max-width: 768px)` ya existente, `justify-content: center` para que las filas envueltas queden compactas en vez de con los huecos grandes de `space-between`. Verificado con una iframe de 380px de ancho (viewport real, no simulado) sirviendo la app: los botones envuelven en varias filas contenidas dentro de la propia barra, sin scroll horizontal de la página; a 1000px de ancho el comportamiento de escritorio no cambia.

---

## [1.13.1.56] - 2026-07-21

### Corregido
- **Clarividente: corte de visibilidad inmediato, con elección real de la jugadora (bug (a) de `docs/MEJORAS_FUTURAS.md`, "Clarividente: dos bugs reales confirmados tras probar la partida")**: se elimina por completo el "periodo de gracia" (`player.haTenidoClarividente`, `actualizarClarividente()` en `js/utils.js`). En su lugar, `js/render.js` añade `gestionarTransicionesClarividente()`, llamada al principio de cada `render()`: detecta, para CUALQUIER jugadora (no solo en su propio turno), la transición de `hasClariActivo` de `true` a `false` — comparando contra `player._clariVisiblePrev`, guardado tras cada `render()` — y dispara de inmediato `resolverEleccionClarividente()`. Antes, el único sitio que cortaba el efecto (`jugarCartaSeleccionadaEn()` en `js/actions.js`) solo se ejecutaba cuando la propia jugadora activa jugaba una carta, así que si otra jugadora (o un bot) tapaba su Clarividente, el efecto sobrevivía hasta que ella volviera a jugar. Ahora: jugadora humana → `picker()` con etiquetas neutras ("Mi carta de la izquierda"/"de la derecha", sin revelar el personaje, para no filtrar información en la pantalla compartida) que invierte de verdad `vis.owner`/`vis.others` de las dos cartas de mano según la elección; autómata → heurística mínima (se queda con la carta requerida por la invocación activa si aplica, si no al azar), sin picker. Si ya hay un picker en curso (de otra habilidad, o de otra elección de Clarividente), se pospone y se reintenta en el siguiente `render()`. Verificado manualmente construyendo el estado a mano y llamando a `render()`/`picker()` directamente: transición humana abre el picker de inmediato e invierte la visibilidad correctamente; transición de autómata se resuelve sola sin abrir ningún picker; una transición que llega con otro picker ya abierto se pospone y se dispara en cuanto ese otro picker se cierra.

---

## [1.13.0.55] - 2026-07-21

### Añadido
- **Jugador autómata ("bot")**: se pueden combinar jugadoras humanas y autómatas controladas por la app, dentro del límite de 2-5 jugadoras. Nuevo campo "Autómatas (bots)" en la pantalla de configuración (`js/setup.js`, 0..jugadoras, validado); los últimos `nBots` puestos reciben un nombre único de un pool temático de 10 nombres terminados en "bot" (`Arcanobot`, `Nigrobot`, `Rúnabot`, `Encantobot`, `Oráculobot`, `Hechizobot`, `Conjurobot`, `Místicobot`, `Videntebot`, `Brujobot`), mostrado en un campo de solo lectura; el resto de puestos siguen pidiendo nombre editable como hasta ahora. De paso se resolvió la mitad de `DEUDA_TECNICA.md` ítem 5 en este archivo: los `<input>` del formulario de nombres se construyen ahora con `createElement`/propiedades en vez de interpolar en `innerHTML`.
- **Nuevo `js/bot.js`**: toda la lógica de decisión de las autómatas. `construirEstadoVisibleParaBot()` construye una vista saneada del estado (la propia carta "visible", nunca la "oculta"; la carta "oculta" de cualquier otra jugadora, pública por reglamento; el estado de cada Portal; recuentos de Gemas) de la que parte cualquier decisión — auditable de un vistazo que el bot no puede hacer trampa. `decidirYJugarTurno()` ejecuta el turno completo (Fases A-E) reutilizando exactamente los mismos puntos de entrada que usa una jugadora humana (`window.tryPlayOnPortal`, `applyAbility()` de `abilities.js`, resolviendo programáticamente el/los `picker()` que abra, y terminando con un clic simulado en `#btnEndTurn`) — no duplica ninguna lógica de reglas. Heurística del único nivel implementado (`'normal'`, guardado en `player.dificultad`): en Fase A prioriza la carta conocida si completa la invocación activa, si no la juega donde razonablemente ayuda; en Fase B solo activa Ocultista o Cronista, y solo si falta algún personaje del combo por revelar y hay un Portal oculto donde intentarlo (Estratega/Cronomante/Aprendiz/Metamorfo quedan para dificultades futuras, ver `docs/MEJORAS_FUTURAS.md`).
- **`js/game.js` (`nextTurn()`)**: detecta `players[turn].tipo === 'auto'`, oculta los controles de acción humanos durante su turno y, tras un breve `setTimeout`, dispara `decidirYJugarTurno()`. Como el bot termina su turno simulando el mismo clic en "Terminar turno" que usaría una humana, los turnos de varias autómatas consecutivas se encadenan automáticamente hasta que le toca a una jugadora humana.
- **`js/render.js`**: una autómata nunca revela su propia carta "visible" ni el desglose exacto de sus Gemas, ni siquiera durante su propio turno — a diferencia de una jugadora humana activa (simplificación ya asumida de este simulador de una sola pantalla compartida), un bot no tiene "su propia pantalla" a la que mostrárselo, así que se trata siempre como cualquier jugadora no activa (solo su carta "oculta", pública, y el recuento de Gemas por nivel). Su nombre lleva un icono 🤖 junto a las Gemas.

Verificado manualmente en navegador: nombres de bot únicos y sin colisión con nombres humanos; la carta "visible" del bot nunca aparece en el HTML renderizado, ni siquiera en el instante exacto en que empieza su turno; combinaciones de 1 humana+1 bot y 2 humanas+2 bots completan turnos correctamente, incluyendo activación real de Ocultista con resolución del picker y encadenado de varias autómatas seguidas sin quedarse bloqueado ningún modal; el flujo de turno humano no se ve afectado tras el turno de un bot.

---

## [1.12.5.54] - 2026-07-21

### Corregido
- **El Metamorfo transformado ya no engaña a las protecciones, restricciones ni bonus pasivos (`DEUDA_TECNICA.md` ítem 14)**: `case 'Metamorfo'` (`js/abilities.js`) sobrescribía directamente `stack.at(-1).name = v`, así que a partir de ahí la carta transformada era, a todos los efectos del código, el personaje imitado — un Metamorfo transformado en Centinela protegía Portales y bloqueaba a Ocultista como si fuera una Centinela real, y transformarse en Maestro habría disparado su bonus pasivo. Se separó identidad de apariencia: la carta ahora tiene `.name` (identidad real, nunca sobrescrito — sigue siendo `'Metamorfo'` siempre) y `.aspecto` (el personaje imitado). Protección de Centinela, restricción de Ocultista, auto-giro de Centinela, Clarividente y los bonus pasivos de Pícaro/Maestro (`js/actions.js`, este último reescrito para buscar un Maestro real en vez de reutilizar el mapa de la invocación) siguen mirando `.name`; el cumplimiento de la combinación de la invocación, el reparto de sus Gemas y todo lo que se muestra en pantalla (`mostrarCarta()`, `cartaImgHtml()`) pasan a mirar `card.aspecto || card.name`. La única excepción a propósito: la etiqueta del menú de "Activar habilidad" sigue mostrando la identidad real, porque activarla siempre dispara la habilidad de Metamorfo (volver a transformarse), nunca la del personaje imitado. Verificado manualmente contra el código real (navegador): protección/restricción/bonus ya no siguen al disfraz, invocación y Gemas sí.

---

## [1.12.4.53] - 2026-07-21

### Corregido
- **Ocultista ya no puede dejar dos Centinelas visibles a la vez (`DEUDA_TECNICA.md` ítem 12)**: en `case 'Ocultista'` (`js/abilities.js`), tras alternar la visibilidad de la carta superior de un Portal, si la carta recién revelada es una Centinela real, ahora se llama también a `ocultarOtrasCentinelas()` — la misma función que ya se dispara en Fase A al jugar una Centinela nueva. Antes, una Centinela que el auto-giro había ocultado podía volver a hacerse visible vía Ocultista sin re-disparar ese auto-giro, dejando dos Centinelas visibles en mesa hasta que se jugara una Centinela nueva. Repro completo en `docs/AUDITORIA_REGLAS.md` §3.1.

---

## [1.12.3.49] - 2026-07-20

### Corregido
- **Portales centrales en fila propia, no como columna del grid**: `renderBoardGrid()` (`js/render.js`) pintaba los Portales centrales como una columna final más dentro del mismo grid de N columnas de jugadoras, fácil de pasar por alto entre las demás. Ahora `renderBoardNeutrals()` (nueva función interna) los pinta aparte, en `#boardNeutrals` (`index.html`), una fila a lo ancho de todo el contenedor por encima del grid de jugadoras, con fondo y borde propios y el título "Portales centrales" — `renderBoardGrid()` ya solo genera columnas de jugadoras (`grid-template-columns: repeat(nºJugadoras, minmax(240px, 1fr))`, sin el `+1` que antes sumaba por los neutrales). Cuando la partida no tiene Portales centrales (5 jugadoras), la fila se oculta por completo en vez de dejar un hueco vacío. `js/setup.js` y `js/game.js` muestran/ocultan `#boardNeutrals` junto con `#boardGrid` en los mismos puntos donde ya lo hacían para este último.

---

## [1.12.2.48] - 2026-07-20

### Corregido
- **Grid de N columnas sin scroll horizontal forzado**: `renderBoardGrid()` (`js/render.js`) fijaba `grid-template-columns` con `1fr` fijo, lo que en la práctica dejaba el ancho mínimo de cada columna (`min-width: 220px` en `.board-col`, `style.css`) forzando scroll horizontal incluso en pantallas de escritorio con espacio de sobra. Ahora usa `repeat(N, minmax(240px, 1fr))`: cada columna crece para llenar el ancho disponible cuando cabe, y el scroll horizontal de `.board-grid` solo entra en juego cuando de verdad no caben todas las columnas (pantallas estrechas o muchas jugadoras a la vez) — mismo criterio para cualquier tamaño de pantalla, sin rama de código distinta para escritorio/móvil. Se eliminó la regla redundante `.board-col { min-width: 220px }` (ya cubierta por el `minmax()` del propio grid) y la rama `@media (max-width: 768px)` que forzaba `grid-auto-flow: column` con un ancho fijo por columna, ahora innecesaria y potencialmente conflictiva con la regla base.

---

## [1.12.1.48] - 2026-07-20

### Añadido
- **Nuevo `docs/AUDITORIA_REGLAS.md`**: informe de auditoría cruzando `docs/reglamento/REGLAMENTO.md` contra el estado real de `js/*.js`. Cubre modos de juego pendientes (Introductorio como variante de mazo propia — roster real de 29 cartas, no las 41 que produce hoy el set `introductorio`; Avanzado; Experto) con estimación de tamaño S/M/L, personajes incompletos (Entusiasta, Maestro activo), final de partida (sin marcador ni desempate), y un análisis dedicado de conflictos entre habilidades (protección de Centinela, estado de Cronomante entre turnos, identidad del Metamorfo transformado al moverse entre manos/Portales, Clarividente + intercambio de Aprendiz), con tabla resumen de prioridades.

### Corregido (documentación, no código)
- **Hallazgo de la auditoría**: `case 'Ocultista'` puede revelar una Centinela que el auto-giro había ocultado, sin volver a disparar ese auto-giro — permite dos Centinelas visibles a la vez. Documentado con reproducción completa en `docs/AUDITORIA_REGLAS.md` (sección 3.1) y como ítem nuevo en `docs/DEUDA_TECNICA.md` (ítem 12); **no se corrige en esta tarea**, queda pendiente para una ronda futura.
- `docs/DEUDA_TECNICA.md` ítem 4 actualizado: la duplicación de "recorrer todos los Portales" en `js/render.js` (antes 3 bloques separados) se redujo al unificar el tablero en `renderBoardGrid()`.
- `docs/MEJORAS_FUTURAS.md` y `CLAUDE.md` actualizados con los tamaños S/M/L y la prioridad (marcador final: Alta) que confirma la auditoría.

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

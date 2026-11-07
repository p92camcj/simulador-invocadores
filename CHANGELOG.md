# Changelog

Todas las versiones importantes del simulador de Invocadores.

---

## [1.32.4.143] - 2026-11-07

### Corregido
- Mesa 3D, final de la partida: "Ver cómo ha quedado la mesa" no
  enseñaba las Gemas repartidas en la última invocación, porque la mesa no
  se repintaba después de `terminarTurno()`. `finalizarPartida()`
  (`js/game.js`) llama ahora a `render()` antes de mostrar el marcador.

### Cambiado
- Con la partida terminada, todas las Gemas de todas las jugadoras se ven
  bocarriba con su valor y su total: `construirVistaMesa()`
  (`js/vista-mesa.js`) añade `gemas.valores` cuando `juegoTerminado`, y
  `gemasHtml()` (`js/mesa3d.js`) pinta cada Gema con el color de su nivel y
  su valor. Test nuevo en `tests/vista-mesa.mjs`.

## [1.32.3.88] - 2026-11-07

### Eliminado
- **Vista clásica** (congelada en 1.32.1, resuelve el ítem 17 de
  `docs/DEUDA_TECNICA.md`). `render.js` pierde el tablero en columnas
  (`renderBoardGrid`, `renderBoardNeutrals`, `portalCardHtml`, Gemas por
  nivel, panel de la invocación) y el `picker()` de `<select>`: ahora
  `render()` solo resuelve la Clarividente y llama a `renderMesa3D()`, y
  `picker()` siempre usa `pickerMesa()`. `actions.js` pierde el panel de
  jugar carta con `<select>`, el arrastre nativo y `initActions()`.
  `index.html` pierde los botones de partida de la cabecera (`#btnCtrlPlay`,
  `#btnPlayCancel`, `#btnAbility`, `#btnEndTurn`, `#btnSalir`,
  `#btnHistorial`, `#btnVista`) y los bloques `#ctrlPlay`, `#picker`,
  `#info`, `#boardNeutrals` y `#boardGrid`; `style.css` sus estilos (de 684
  a unas 350 líneas). `?vista=clasica` ya no hace nada.

### Cambiado
- La Mesa 3D ya no pulsa botones ocultos: llama a las nuevas funciones
  exportadas de `actions.js` (`seleccionarCartaMano`, `jugarEnPortal`,
  `elegirPortalObjetivo`, `activarHabilidad`, `cancelarSeleccion`,
  `ejecutarFinDeTurno`) y a `salirAlMenu()` (`game.js`). `vistaMesaActiva()`
  y `fijarVista()` desaparecen; `body.vista-mesa` es una clase fija en
  `index.html`. `finalizarPartida()`, `salirAlMenu()` y el pago con Gema de
  asterisco usan siempre el marcador y las hojas de la mesa (sin
  `confirm()`), y `nextTurn()` siempre anuncia el turno con
  `anunciarTurnoMesa()`.
## [1.32.2.82] - 2026-11-07

### Corregido
- Mesa 3D: tras cancelar la elección de carta del Cronomante, los Portales
  seguían brillando como "activables" y al tocar otro (p. ej. un Maestro)
  se ofrecía "Activar: Maestro", pero el botón llevaba de vuelta al
  Cronomante pendiente. El adaptador web (`uiNavegador` en
  `js/abilities.js`) vuelve a llamar a `render()` después de cualquier
  cancelación, así la mesa se redibuja con el Portal del Cronomante ya
  fijado y solo ofrece retomarlo. La regla no cambia: el Portal elegido
  con el Cronomante no se puede cambiar, y la Gema del Portal central se
  cobra solo al subir una carta.

## [1.32.1.83] - 2026-11-07

### Cambiado
- **La Mesa 3D es la única vista mantenida, también en ordenador.** La
  vista clásica (tablero en columnas) queda congelada (deprecated): se
  quitan el selector "Vista de juego" del setup y la opción "Cambiar a la
  vista clásica" del menú ☰; `vistaPorDefecto()` (`js/mesa3d.js`) devuelve
  siempre `'mesa'` salvo con `?vista=clasica` en la URL, y ya no se guarda
  la preferencia (se borra la clave `invocadores.vista`). En la clásica,
  `#btnVista` pasa a "📱 Volver a la Mesa 3D". Su código se borrará más
  adelante (`docs/DEUDA_TECNICA.md` ítem 17).

## [1.32.0.78] - 2026-11-07

### Añadido
- **Turnos de las autómatas paso a paso.** Cada heurística de `bot.js`
  (`normal`, `dificil`, `experta` y la persona simulada) es ahora un
  generador que se detiene tras jugar carta (`yield 'faseA'`) y tras
  activar habilidad (`yield 'faseB'`). En la web, `nextTurn()` usa el nuevo
  `jugarTurnoAutomataPasoAPaso()` y entre paso y paso espera a que acaben
  las escenas y hace una pausa (`pausaTrasPaso()`: 2,6 s tras la carta,
  3,4 s tras la habilidad, por el ritmo elegido). `decidirYJugarTurno()`
  los recorre del tirón, así que la arena y las simulaciones de la Experta
  no cambian (misma salida de `tools/arena.mjs` que en `main`).
- **Ritmo de los autómatas** en el menú de inicio (`#selRitmoBots`:
  Rápido / Normal / Pausado), guardado en
  `localStorage['invocadores.ritmoAutomatas']`.
- Nuevo `js/historial.js` (puro): historial de jugadas en
  `estado.partida.historial` (nueva clave de `CLAVES_PARTIDA`; se guarda y
  se retoma con la partida, `determinizar()` no lo copia). Anota inicio de
  turno, carta jugada (también si era la carta oculta y cuál resultó ser),
  habilidad con lo elegido y cómo quedan los Portales que cambiaron, e
  invocación con su reparto de Gemas. Lo alimentan `ejecutarJugada()`,
  `ejecutarFinDeTurno()` y el nuevo `conHistorialHabilidad()`
  (`actions.js`), que envuelve el `onComplete` de la Fase B humana y del
  autómata. `applyAbility()` (`abilities.js`) apunta lo elegido en los
  picker() (`eleccionesUltimaHabilidad()`) para describir también las
  habilidades de las personas.
- Nuevo `js/narrador.js` (solo presentación): rótulo que narra cada paso de
  una autómata y se queda en pantalla durante la pausa (sustituye al
  `alert()` del resumen del turno y al de "está pensando…" de la vista
  clásica); Portales afectados resaltados con el color del motivo y el
  número de paso (`atributosDestacado()`, leído por `render.js` y
  `mesa3d.js`) hasta que la persona juega; estelas de polvo mágico de
  origen a destino, con un color por motivo (`COLOR_MOTIVO`: carta jugada,
  Estratega, Cronista, Ocultista, Cronomante, Maestro, Aprendiz,
  Metamorfo), tras las escenas del modo espectáculo; y ventana de
  historial (`abrirHistorial()`) desde `#btnHistorial` en la clásica y 📜
  (barra y menú ☰) en la Mesa 3D.
- `tests/historial.mjs`.

### Cambiado
- Las etiquetas de Portal central de los textos del autómata dicen "Portal
  central N" (antes "Portal Neutral N"), como el resto de la interfaz.
- `service-worker.js` cachea los dos módulos nuevos.
## [1.31.1.77] - 2026-11-06

### Corregido
- Escena de la Estratega (modo espectáculo): el personaje que cruza del
  Portal izquierdo al derecho se veía detrás del Portal de destino y medio
  cortado. `.esp-ranura--par` (`espectaculo.css`) ya no usa `transform`
  para centrarse (ahora `margin-left` negativo), así no crea su propio
  contexto de apilamiento y las dos figuras que se cruzan pasan por delante
  de ambos Portales.

## [1.31.0.75] - 2026-11-06

### Añadido
- **Salir de la partida y retomarla.** Nuevo botón `#btnSalir` ("🚪 Salir")
  en la cabecera de la vista clásica y opción "Salir al menú de inicio" en
  el menú ☰ de la Mesa 3D (`salirAlMenu()` en `game.js`, con confirmación).
  Vuelve al menú de inicio, que muestra `#panelRetomar` ("Tienes una partida
  a medias") con "Retomar partida" (`retomarPartida()`) o "Descartar"; la
  configuración de siempre debajo empieza una nueva, que sustituye a la
  guardada.
- Nuevo `js/partida-guardada.js`: `nextTurn()` guarda una foto de
  `estado.partida` (`serializarPartida()`) en
  `localStorage['invocadores.partidaGuardada']` al empezar cada turno, así
  que la partida también se puede retomar tras recargar o cerrar la página.
  Se retoma desde el principio del turno guardado (si se sale a mitad de
  turno, se avisa de que esa jugada se repite). `finalizarPartida()` borra
  la foto.
- Al salir se invalida el `setTimeout` pendiente de una autómata (contador
  de generación en `game.js`) y se cortan las escenas con el nuevo
  `detenerEspectaculo()` (`espectaculo.js`), cuyas esperas se descartan sin
  avanzar el turno de la partida abandonada.
- `mostrarTablero()` (`game.js`) reúne lo que hacía el botón Iniciar para
  mostrar el tablero; `service-worker.js` cachea el módulo nuevo.
## [1.30.2.74] - 2026-11-06

### Corregido
- La hoja "Invocación" de la Mesa 3D (`verInvocacion()` en `js/mesa3d.js`)
  explicaba la condición de la invocación sin la mitad de la regla: además
  de los personajes requeridos, todos los Portales (también los centrales)
  deben tener un personaje bocarriba. El motor (`resolverInvocacion()`), los
  autómatas (`invocacionCerrada()`, `decidirJugadaFaseA()`,
  `completariaLaInvocacionConMaestro()`) y el reglamento ya lo exigían; solo
  fallaba el texto.

### Añadido
- Aviso público de cuántos Portales siguen vacíos o boca abajo: en la hoja de
  la Mesa 3D (`portalesSinPersonajeHtml()`) y junto a los requisitos de la
  vista clásica (`avisoPortalesSinPersonaje()` en `js/render.js`).
- Test en `tests/motor-acciones.mjs`: un Portal central vacío impide la
  invocación aunque estén los tres requisitos.

---

## [1.30.1.73] - 2026-11-06

### Cambiado
- **Cartas nuevas de Adrián** (PDF "Invocadores 4.0 junio 2026"): las 14
  cartas de personaje de `assets/cards/*.png` se regeneran desde ese PDF con
  el nuevo `tools/cartas_desde_pdf.py`. El número de la esquina ahora es el
  de copias de cada carta en el mazo (Maestro 2, Clarividente 2, Ocultista
  2, Cronomante 3, Estratega 3, Cronista 4, Aprendiz 4, Centinela 4, Pícaro
  6, Metamorfo 2, Entusiasta 2, Reena/Sora/Lumo 3), que ya coincidía con
  `CANTIDADES_MODO_NORMAL`/`CANTIDADES_ANIMALES`: no cambia ninguna regla.
  El Maestro estrena icono de su habilidad activa (bajar la carta visible de
  otra persona a su Portal). El reverso y las cartas de ayuda no cambian.
- Los SVG de `assets/cartas/` quedan desfasados hasta que lleguen los
  nuevos; no relanzar `tools/generar_cartas.py` con ellos o se perderían las
  cartas nuevas.

## [1.30.0.119] - 2026-11-06

### Añadido
- **Las autómatas aprenden de las personas, solas y sin servidor**
  (`js/aprendizaje.js`, `js/aprendizaje-navegador.js`). Cada jugada de
  Fase A de una persona (`ejecutarJugada()`) se guarda en el navegador
  (`localStorage`, últimas 300, sin nombres): lo que esa persona veía y lo
  que eligió. Al acabar la partida (`finalizarPartida()`) se ajusta por
  máxima verosimilitud un modelo de cómo juegan las personas (pesos de
  `bot-estrategia.js`, temperatura y preferencia por la carta conocida).
  Con 15 jugadas o más, la Experta lo usa para simular los turnos de las
  personas (`decidirYJugarTurnoComoPersona`, `establecerModeloPersonas`
  en `js/bot.js`). En la arena, contra "personas" simuladas que juegan
  distinto a Difícil, la Experta pasa del 50 % al 61 % de victorias al
  aprender; el modelo recupera exactamente sus pesos.
- Panel "Aprendizaje de las autómatas" en la configuración: cuántas
  jugadas lleva observadas, y botones para descargar, importar (juntar lo
  aprendido en varios dispositivos) o borrar.
- `tools/arena.mjs`: asientos `persona@perfil` (personas simuladas) y
  `--aprender 1`. Nuevos tests en `tests/aprendizaje.mjs`.

## [1.29.1.117] - 2026-11-06

### Mejorado
- **Difícil ya no malgasta Gemas.** Su Fase B (`decidirHabilidadFaseBDificil`,
  `js/bot.js`) resta `PESOS.costeCentral` (3) al activar un Portal central,
  que cuesta una Gema de valor 1. Antes lo ignoraba y acababa las partidas
  con 1,6 Gemas de media. En la arena: Difícil contra dos Normal pasa del
  46 % al 78 % de victorias; contra tres Normal, al 52 %.
- **Experta anticipa a cada rival.** Con `BUSQUEDA.ronda` (activo por
  defecto), tras su mejor turno en cada mundo posible juega el turno de
  cada rival con la heurística Difícil (`simularTurnoRival`, `js/bot.js`)
  y puntúa la ronda entera (`puntuarRonda`, `js/bot-busqueda.js`). Usa
  `BUSQUEDA.rival` = 0,5 como peso de rival: igual de fuerte y cierra más
  invocaciones. Contra dos Difícil (ya mejoradas) gana el 48 %; en sus
  partidas se completan 1,1 invocaciones de media con 3 jugadoras (antes
  0,7).
- `tools/arena.mjs`: los perfiles por asiento también cambian `BUSQUEDA`,
  y hay opción `--busqueda`.
- Nuevo `docs/ESTRATEGIA_AUTOMATAS.md`: estrategias del reglamento que
  usan las autómatas, resultados y opciones para aprender de partidas
  reales.

## [1.29.0.115] - 2026-11-06

### Añadido
- **Nueva dificultad de autómatas: Experta** (`js/bot-busqueda.js`). En
  cada turno genera 8 "mundos posibles": copias de la partida en las que
  todo lo que la autómata no puede saber (su carta oculta, las cartas
  privadas de las rivales, el mazo y el valor de las Gemas ajenas) se
  reparte al azar entre los personajes que aún no ha visto. En cada mundo
  prueba cada carta × Portal seguida de cada habilidad con cada objetivo,
  usando el motor de reglas real (`jugarCarta`, `aplicarHabilidad`,
  `terminarTurno`), y elige la jugada con mejor media. Puntúa con las Gemas
  ganadas menos las de la mejor rival, más el valor de posición y la
  amenaza de la siguiente jugadora (`bot-estrategia.js`). Tarda entre 30 y
  300 ms por turno. Se elige en `#selDificultadBots`.
- **Simulador de partidas sin navegador** (`tools/arena.mjs`): juega
  partidas completas de autómatas en Node con el motor (cientos por
  segundo con Normal y Difícil), con azar con semilla y asientos rotados.
  `tools/ajustar-pesos.mjs` busca pesos mejores para `bot-estrategia.js`
  enfrentando cada candidata a los actuales.
- `js/bot.js`: las decisiones se separan de quién las ejecuta
  (`decidirYJugarTurno(..., ejecutor)`). Por defecto se usa el ejecutor de
  la web, y `crearEjecutorMotor()` juega solo con el motor.
  `elegirOpcionPeticion` respeta un objetivo preferido aunque repita el
  valor de un paso anterior (Maestro con dos Portales).
- `js/bot-estrategia.js`: los pesos pasan al objeto `PESOS`
  (`rival`, `posicion`, `amenaza`), con los mismos valores.
- Tests nuevos en `tests/bot-busqueda.mjs`. Entre ellos, uno comprueba que
  dos partidas que solo difieren en información oculta producen los mismos
  mundos posibles, es decir, que la Experta no hace trampa.

### Medido con el simulador
- Experta contra dos Difíciles: gana el 60 % de las partidas (lo esperado
  por azar sería el 33 %). Mano a mano contra Difícil gana el 67 %, y
  contra tres Difíciles el 51 %.
- Difícil contra dos Normales: 46 %.
- Ajuste de pesos: 15 candidatas de 2.000 partidas en 2 y 3 jugadoras.
  La mejor (+1-2 %) no mejoró al validarla con 5.000 partidas por mesa
  (50,3 %, 32,8 % y 25,6 %), así que los pesos actuales se mantienen.
- Con autómatas se completan pocas invocaciones: entre 0,3 y 0,8 de 3 por
  partida con 3-4 jugadoras.

## [1.28.0.113] - 2026-11-06

### Añadido
- **Botones y pantalla de inicio renovados en la vista Mesa 3D** (`mesa3d.css`,
  `prepararPantallaInicio()` en `js/mesa3d.js`): cabecera con las tres
  criaturas sobre un portal giratorio, título dorado, botones en píldora con
  brillo, tarjeta de configuración translúcida, selectores oscuros y
  contadores + / − para jugadoras y autómatas. Los botones de la cabecera
  pasan a "❓ Ayuda" y "📖 Reglamento".
- **Efectos en la mesa** (`lanzarEfectos()` en `js/mesa3d.js`, capa
  `.m-efectos`): onda y chispas al entrar o aterrizar una carta, destellos
  al voltear, transformar o retirar, salto del contador de Gemas al ganar,
  chip de requisito que se ilumina al cumplirse y, al completar una
  invocación sin el modo Escenas, rayos, la criatura, rótulo y temblor de
  la mesa (con vibración en el móvil). Respeta `prefers-reduced-motion`.
- **Marcador final en la mesa** (`mostrarFinMesa()`): clasificación con
  corona y confeti, "Jugar otra vez" y "Ver cómo ha quedado la mesa", en
  lugar del `confirm()` del navegador.
- **Pregunta de la Gema de asterisco como hoja** (`preguntarMesa()`):
  `preguntarUsoAsterisco()` en `js/actions.js` pasa a callback y, en la
  mesa, ofrece dos botones grandes en lugar de `confirm()`.

### Cambiado
- **Metamorfo transformado: se ve que sigue siendo un Metamorfo.** Antes se
  pintaba como el personaje imitado. Ahora, como en la mesa real, es la
  carta del Metamorfo con la ficha del personaje encima (medallón con su
  cara, cinta "como X" y borde iridiscente), en la Mesa 3D (`ficha` en
  `construirVistaMesa()`, cambio `transforma` en `cambioPortal()`) y en la
  vista clásica (`metamorfoConFichaHtml()` en `js/render.js`). Al
  ampliarlo se explica qué es.
- **Escena de transformación del Metamorfo rehecha** (`escenaMetamorfo()` en
  `js/espectaculo.js`, `espectaculo.css`): la ficha cae girando, un barrido
  de luz convierte al Metamorfo en el disfraz, queda su silueta rosa detrás
  y la ficha se posa a un lado, con onda de choque y chispas.

---

## [1.27.0.111] - 2026-11-06

### Añadido
- **Vista "Mesa 3D", pensada para jugar en el móvil.** Una interfaz nueva,
  seleccionable en la configuración (`#selVista`) o desde la cabecera
  (`#btnVista`), que convive con la clásica y con el modo Escenas. Solo CSS
  3D (`mesa3d.css`), sin librerías ni dependencias nuevas:
  - Mesa en perspectiva con cartas 3D (cara y dorso), pilas con grosor
    según su altura y círculos rúnicos animados bajo cada Portal. Tu mano va
    abajo en abanico, las rivales arriba (en orden de turno) y los Portales
    centrales en medio.
  - Jugar una carta: tocarla (se levanta y los Portales brillan) y tocar un
    Portal, o arrastrarla con el dedo. La carta vuela hasta su Portal.
  - Fase B: los Portales con habilidad activable llevan un ✦ y, al
    tocarlos, ofrecen activarla; el botón Habilidad se desactiva si no hay
    ninguna. Los `picker()` pasan a ser hojas inferiores con botones
    grandes; si piden un Portal, la hoja es compacta y se puede tocar el
    Portal en la mesa.
  - Tocar un Portal o una carta visible la amplía; tocar la invocación
    muestra la criatura y sus requisitos.
  - Los `alert()` se muestran como avisos flotantes que no bloquean. Con
    varias humanas, cada turno empieza con un telón para pasar el móvil sin
    enseñar la mano; contra autómatas, un rótulo, y la humana no se mueve de
    su sitio (y ve su carta también durante el turno de las autómatas).
  - Animaciones de carta que entra, se voltea, se reparte o aterriza;
    respeta `prefers-reduced-motion`.
  - En pantallas táctiles es la vista por defecto; la preferencia se guarda
    en `localStorage` (`invocadores.vista`).
- `js/vista-mesa.js`: modelo puro de lo que enseña cada asiento (sin DOM).
  Tests nuevos: `node tests/vista-mesa.mjs` (11), que comprueban que ninguna
  carta oculta llega a la vista.

### Cambiado
- `render()` llama a `renderMesa3D()` y `picker()` delega en la hoja de la
  mesa cuando está activa; `nextTurn()` usa `anunciarTurnoMesa()` en vez del
  `alert()` y espera algo más antes de que juegue una autómata en la mesa
  (`retardoAutomata()`); `resetJuego()` limpia la mesa.
- `index.html`: `viewport-fit=cover` para respetar las zonas seguras del
  móvil.

## [1.26.7.109] - 2026-11-05

### Cambiado
- **Fase 4 de la separación motor / interfaz** (plan en
  `docs/ARQUITECTURA_MOTOR.md`). Los autómatas ya no pulsan botones ni
  contestan `picker()` del DOM:
  - Fase A y fin de turno con `ejecutarJugada()` y `ejecutarFinDeTurno()`,
    nuevas funciones exportadas de `js/actions.js` que también usan los
    clics humanos.
  - Fase B con `aplicarHabilidad()` del motor contestada por
    `crearUiAutomata()` (`js/bot.js`) y `completarActivacion()`. Desaparece
    `resolverPickersAbiertos()`.
  - Su memoria pasa a `estado.partida.memoriaBots`.
- `initActions()` ya no recibe arrays: lee siempre `estado.partida`.
- `completarActivacion()` recibe `usarAsterisco`; la pregunta de revelar la
  Gema de asterisco la hace la web antes de llamar al motor.
- Tests nuevos: `node tests/motor-adaptadores.mjs` (7).

## [1.26.6.107] - 2026-11-05

### Corregido
- **Las autómatas elegían como objetivo a rivales protegidas por su
  Centinela.** El Maestro (en Normal y en Difícil), el Aprendiz y las
  habilidades que apuntan a un Portal (Estratega, Cronomante, Cronista,
  Ocultista) no miraban esa protección. Cuando la rival elegida no era un
  objetivo legal, la habilidad acababa en otro objetivo o daba el aviso
  "No hay ninguna jugadora con una carta visible-para-el-resto que puedas
  bajar". La vista saneada de `js/bot.js` incluye ahora
  `protegidaPorCentinela` por jugadora, que es información pública.
  `decidirMaestroNormal`, la evaluación del Maestro en Difícil, las tres
  decisiones del Aprendiz y `listaPortalesFormatoHabilidad` descartan a las
  rivales protegidas.
- Tests nuevos en `tests/run-tests.mjs`.

## [1.26.5.105] - 2026-11-05

### Cambiado
- **Fase 3 de la separación motor / interfaz** (plan en
  `docs/ARQUITECTURA_MOTOR.md`). Nuevo `js/motor/habilidades.js`: lo que
  hace cada habilidad (Ocultista, Cronista, Cronomante, Estratega,
  Aprendiz, Maestro, Metamorfo), los efectos de Centinela y la elección de
  la Clarividente, sin DOM ni `window`. Cuando hace falta elegir, el motor
  pide la elección a una interfaz inyectada
  (`ui.pedir(peticion, responder, cancelar)`) en vez de abrir un `picker()`.
- `js/abilities.js` pasa a ser el adaptador web (`uiNavegador`):
  `applyAbility()` mantiene su firma, así que `actions.js` y los autómatas
  no cambian.
- `bajarCartaMaestro()` del motor recibe el mazo como argumento; la de
  `abilities.js` sigue usando `window.deck` por defecto.
- `render.js` aplica la elección de la Clarividente con
  `aplicarEleccionClarividente()` del motor.
- `service-worker.js` cachea `js/motor/habilidades.js`.
- Tests nuevos: `node tests/motor-habilidades.mjs` (16).

## [1.26.4.103] - 2026-11-05

### Cambiado
- **Fase 2 de la separación motor / interfaz** (plan en
  `docs/ARQUITECTURA_MOTOR.md`). Nuevo `js/motor/acciones.js`: las reglas
  del turno pasan a funciones puras sobre `estado.partida` que devuelven
  eventos (`jugarCarta`, `terminarTurno` con `resolverInvocacion`,
  `pasarTurno`, `comprobarFinPorManoVacia`, `validarFaseB`,
  `opcionesFaseB`, `completarActivacion`). Sin DOM ni `window`.
- `js/actions.js` deja de contener reglas: jugar carta, activar habilidad
  y terminar turno llaman al motor y traducen sus eventos a avisos,
  `render()` y escenas del modo espectáculo. `js/game.js` pregunta al
  motor si la partida acaba por mano vacía.
- `draw()` y `reponerManoSiFalta()` (`js/utils.js`) aceptan el mazo como
  argumento (por defecto `window.deck`).
- `service-worker.js` cachea `js/motor/acciones.js`.
- Tests nuevos: `node tests/motor-acciones.mjs` (16).

## [1.26.3.99] - 2026-11-05

### Mejorado
- **Autómatas en dificultad Difícil: jugada de Fase A con criterio
  estratégico.** Nuevo módulo puro `js/bot-estrategia.js`, usado por
  `decidirJugadaFaseADificil()` (`js/bot.js`) en lugar de
  `valorEsperadoDeAccion()`. Para cada carta × Portal simula el tablero
  resultante y:
  - si cierra la invocación, calcula el reparto real de Gemas (requisito
    único en Portal con dueña, Pícaro +1, Maestro +3) y puntúa lo que gana
    la bot menos 0,75 × lo que gana la mejor rival. Antes cerrar siempre
    sumaba un bonus, aunque solo cobrasen las rivales;
  - si no cierra, suma el valor de posición (requisitos únicos ya
    colocados, propios menos la mejor rival) y el resultado esperado de que
    la siguiente jugadora cierre con su carta privada si le conviene;
  - la carta oculta se puntúa como media sobre sus identidades posibles
    (conteo de cartas).
- Plan por fases para seguir mejorando los autómatas en
  `docs/MEJORAS_FUTURAS.md`.

### Corregido
- **La partida podía quedarse bloqueada al final con autómatas en
  Difícil.** Sin mazo y con una sola carta (la que ve), la bot podía elegir
  "jugar la carta oculta" sin tenerla; la jugada fallaba y nunca terminaba
  el turno. La vista saneada incluye ahora `tieneCartaOcultaPropia` (solo
  sí/no) y esa jugada ya no se propone.
- `service-worker.js` cachea el módulo nuevo. Tests nuevos en
  `tests/run-tests.mjs`.

## [1.26.2.98] - 2026-11-05

### Cambiado
- **Fase 1 de la separación motor / interfaz** (plan en
  `docs/ARQUITECTURA_MOTOR.md`). Todo el estado de partida pasa a un único
  objeto serializable, `estado.partida`, en el nuevo `js/motor/estado.js`
  (sin DOM ni `window`). El estado de interfaz (carta seleccionada, picker
  abierto, callbacks) va aparte en `estado.ui` y nunca se serializa.
- Nuevas `serializarPartida()` / `cargarPartida()` (base para guardar
  partidas y para el futuro multijugador en red).
- `window.players`, `window.turn`, etc. siguen funcionando: ahora son alias
  getter/setter de ese objeto (`instalarAliasGlobales()`, llamada desde
  `js/index.js`). Ningún otro módulo cambia de comportamiento.
- `js/game.js`: los bloques repetidos que limpiaban el estado en
  `initGame()`, `nextTurn()` y `resetJuego()` pasan a
  `reiniciarCamposDeTurno()` / `reiniciarPartida()`.
- `service-worker.js` cachea `js/motor/estado.js`.
- Tests nuevos: `node tests/motor-estado.mjs`.

## [1.26.1.90] - 2026-11-05

### Corregido
- **El Maestro cobraba su bonus aunque hubiera un Pícaro visible.** Al
  completar una invocación, `#btnEndTurn.onclick` (`js/actions.js`)
  volteaba primero a los Pícaros de las jugadoras y solo después miraba si
  quedaba alguno visible, así que no los veía. Los dos bonus pasivos pasan
  a `aplicarBonusPasivosInvocacion()` (`js/utils.js`, función pura), que
  evalúa el Maestro antes de voltear a los Pícaros.
- **Podían quedar dos Centinelas visibles a la vez** si la Cronista se
  llevaba la carta que tapaba una Centinela o el Cronomante subía una
  Centinela enterrada en la pila. Nueva `girarOtrasCentinelasSiAparece()`
  (`js/abilities.js`), llamada desde `case 'Cronista'` y `case 'Cronomante'`.
- Tests nuevos en `tests/run-tests.mjs` para ambos casos.

## [1.26.0.87] - 2026-11-05

### Añadido
- **Modo espectáculo (prototipo)**: nueva capa de presentación
  (`js/espectaculo.js` + `espectaculo.css`) que escenifica a pantalla
  completa lo que pasa en la partida, sin tocar ninguna regla.
  - Fase A: al bajar una carta, el Portal se abre y el personaje sale de
    él; lo que había antes encima "pasa al pasado". Centinela añade su
    onda de escudo.
  - Fase B, una escena por habilidad: Metamorfo se transforma conservando
    rasgos propios (borde iridiscente, su humo y su silueta, que se
    transparenta); Maestro hace bajar la carta de la otra jugadora a su
    Portal; Cronomante trae una carta de la pila (el pasado) al Portal (el
    presente); Cronista, Ocultista, Estratega y Aprendiz también tienen la
    suya. Se detecta qué ha cambiado comparando una foto pública de la mesa
    antes y después (`envolverHabilidad()`), igual para humanas y autómatas.
  - Invocación completada: los personajes requeridos convergen en un
    círculo y aparece el nombre de la invocación con cuántas Gemas recibe
    cada jugadora (nunca su valor). Sustituye al `alert()` de texto.
  - Solo se muestra la cara de una carta si es pública en la mesa; manos y
    cartas tapadas, siempre con reverso.
  - Cola de escenas que se acelera si se acumulan, se salta con un clic o
    Escape, y respeta "reducir movimiento" del sistema. El avance de turno
    espera a que terminen (`window.avanceTurnoPendiente` evita un doble
    clic en "Terminar turno").
  - Interruptor "✨ Escenas" en la cabecera y casilla en la configuración
    (se recuerda en el navegador).
- Arte original de Adrián en `assets/personajes/*.svg`: los 14 personajes
  de cuerpo entero, la carta del Portal y las criaturas de Cirelia,
  Baelorith y Aelgorth. `tools/rasterizar_svg.cjs` (Playwright) y
  `tools/generar_figuras.py` (Pillow) los convierten en
  `assets/figuras/*.webp`, `assets/invocaciones/*.webp` y
  `assets/portal.jpg`: quitan la pastilla del nombre y el fondo blanco
  (Aprendiz y Ocultista) y los pasan a WebP (1,1 MB los 14 personajes). No
  se ha dibujado ningún personaje nuevo.
  - En las escenas, cada personaje aparece de cuerpo entero, de pie sobre
    la ilustración del Portal, y al completar Cirelia, Baelorith o
    Aelgorth aparece la criatura invocada tras el destello.
  - Versión de siempre: el panel de la invocación activa muestra un
    retrato pequeño de cada personaje requerido y de la criatura (si
    tiene arte).
- **Cartas nuevas**: los SVG de las cartas completas (`assets/cartas/`,
  nuevo diseño con fondo claro) sustituyen a `assets/cards/*.png`, que
  tenían rectángulos negros tapando parte del dibujo. El reverso
  (`carta-oculta-reverso.png`) sale de `assets/cartas/portal.svg`. Se
  regeneran con `node tools/rasterizar_svg.cjs cartas && python3
  tools/generar_cartas.py`. Mismos nombres de archivo y tamaño (362x504),
  así que no cambia nada en el código. El número de copias impreso en
  varias cartas es el de una versión antigua del mazo (más de 60 cartas);
  el simulador sigue las reglas actuales (`CANTIDADES_MODO_NORMAL` /
  `CANTIDADES_ANIMALES` en `utils.js`) y no se ha tocado, confirmado por
  el propietario del proyecto.
- `service-worker.js`: cachea los archivos nuevos y también
  `js/bot-probabilidad.js`, que faltaba en la lista.

---
## [1.25.0.86] - 2026-11-05

### Añadido
- **Botón "Reglamento"** en la barra superior (`#btnReglamento`,
  `index.html`, estilo `a.btn` en `style.css`): abre en una pestaña nueva
  el PDF maquetado `docs/reglamento/reglamento-invocadores.pdf`.
- PDF del reglamento exportado de Canva el 2026-11-05, con las reglas
  confirmadas con el autor (sin cambio de Gemas, Gema de asterisco que se
  conserva, ficha del Metamorfo, Maestro frente a Clarividente,
  Entusiasta). Se publica siempre con el mismo nombre de archivo.

### Cambiado
- Las 18 imágenes de `docs/reglamento/img/` se han regenerado desde el
  PDF nuevo. `REGLAMENTO.md` enlaza el PDF.

## [1.24.2.85] - 2026-11-05

### Cambiado (confirmado con el autor)
- **La Gema de asterisco ya no se descarta al revelarla.** `gastarGemaAsterisco()`
  (`js/utils.js`) la marca `revelada: true`: la jugadora se la queda y sigue
  sumando sus puntos, pero no puede volver a usarla
  (`tieneGemaAsterisco()` solo cuenta las no reveladas). `render.js`
  muestra a todas las jugadoras el valor de las Gemas de asterisco reveladas
  (`reveladasTxt()`), porque ya están bocarriba en mesa.
- Reglamento: fase B (qué pasa con la Gema revelada) y Entusiasta (sin Gema
  de valor 1 no se aplica el efecto).
- Tests actualizados (71 en total).

## [1.24.1.83] - 2026-11-05

### Cambiado (reglas confirmadas por el dueño del proyecto)
- **No se da cambio de Gemas.** `gastarGemaUnitaria()` (`js/utils.js`) ya
  no parte una Gema de valor superior en unidades: sin Gema de valor 1
  suelta devuelve `false`. Nuevas `contarGemasUnitarias()` y
  `puedePagarActivacionCentral()`. `opcionesActivarHabilidad()` solo ofrece
  un Portal central si se puede pagar sin cambio (1 Gema de valor 1 o un
  asterisco; Metamorfo central: 2 de valor 1, o asterisco + 1 de valor 1).
  `pagarActivacionPortalCentral()` usa el asterisco directamente si es lo
  único que hay y acepta `opciones.usarAsterisco` para decidir sin
  `confirm()`. El autómata pasa `false`, así que ya no abre un diálogo en
  su turno.
- **Ficha de transformación del Metamorfo.** `.aspecto` se borra cuando el
  Metamorfo queda tapado (nueva `apilarEnPortal()`, usada en Fase A,
  Maestro y Cronomante), cuando el Ocultista lo pone bocabajo
  (`retirarFichaMetamorfo()`) y cuando la Cronista se lo lleva a la mano.
  Si se destapa después, vuelve a ser un Metamorfo original. Estratega lo
  conserva. Nueva `transformacionesDisponiblesMetamorfo()`: dos Metamorfos
  no pueden tener la misma transformación a la vez. La transformación solo
  se paga con una Gema de valor 1.
- **Maestro + Clarividente.** `candidatosObjetivoMaestro()` excluye a la
  jugadora que tenga la Clarividente visible, porque su mano está oculta
  al resto. Nueva `tieneClarividenteVisible()`.
- **Autómata.** `construirEstadoVisibleParaBot()` ya no expone
  `cartaOcultaPublica` de una jugadora con la Clarividente visible (antes
  la bot "veía" una carta que nadie ve en mesa). Añade
  `gemasUnitariasPropias` y `transformacionesOcupadas`, que usan
  `decidirMetamorfoNormal/Dificil`.
- Reglamento (fase B, nota del Metamorfo, FAQ de pago, Maestro, Entusiasta
  pendiente), `Documentacion_Simulador_Invocadores.md` y `CLAUDE.md`
  actualizados. 7 tests nuevos o reescritos en `tests/run-tests.mjs`
  (71 en total).

## [1.24.0.83] - 2026-07-21

### Añadido
- **Uso estratégico de Maestro por el autómata (Bloque 4, 4.7 — última
  habilidad del bloque)**: la habilidad activa del Maestro ya existía
  (Bloque 2 de una ronda anterior); `'dificil'` ya sabía usarla de forma
  determinista, pero `'normal'` nunca la había usado.
  - `'normal'` (`decidirMaestroNormal`, `js/bot.js`): SOLO beneficio
    propio, con certeza — baja a Portal la carta pública conocida de la
    primera rival cuya carta sea un requisito activo aún no cumplido.
  - `'dificil'`: se añaden dos matices sobre la evaluación ya existente —
    bonus por completar la invocación AHORA MISMO
    (`completariaLaInvocacionConMaestro`, nueva variante de
    `completariaLaInvocacion` que aproxima el Portal de destino exacto,
    desconocido hasta un picker interno de `abilities.js`), y el uso
    ADVERSARIAL (provocar a propósito un duplicado del único requisito
    visible de OTRA rival) — este último sale solo de que
    `contexto.necesariosUnicosDeRivales` ya estaba presente en la llamada
    a `valorEsperadoDeAccion()`, sin necesidad de ningún caso especial.
- Con esta habilidad se completa el Bloque 4 de esta tarea: las 7
  habilidades activas del juego (`PERSONAJES_CON_HABILIDAD`, `utils.js`)
  tienen ya uso estratégico en AMBOS niveles de dificultad del autómata.
- 4 tests nuevos en `tests/run-tests.mjs`.

---

## [1.23.0.82] - 2026-07-21

### Añadido
- **Uso estratégico de Metamorfo por el autómata (Bloque 4, 4.6)**: hasta
  ahora ningún nivel de dificultad usaba esta habilidad.
  - `'normal'` (`decidirMetamorfoNormal`, `js/bot.js`): SOLO beneficio
    propio, se transforma en el primer requisito de la invocación activa
    aún no cumplido en la mesa, si tiene con qué pagar la Gema.
  - `'dificil'` (`decidirMetamorfoDificil`): evalúa cada personaje
    requisito restando siempre el coste real de la Gema pagada
    (`COSTE_GEMA_METAMORFO`) — reutiliza `valorEsperadoDeAccion()` sin
    ningún parámetro nuevo: el matiz adversarial (transformarse
    deliberadamente en el mismo personaje que una rival tiene visible en
    exclusiva, para crear un duplicado que le anule la recompensa) sale
    solo de evaluar `need` completo con esa misma función, sin caso
    especial.
- 5 tests nuevos en `tests/run-tests.mjs`.

---

## [1.22.0.81] - 2026-07-21

### Añadido
- **Uso adversarial de Ocultista sobre Portales visibles (Bloque 4, 4.5)**:
  Ocultista siempre pudo alternar la visibilidad de un Portal YA VISIBLE
  (excepto una Centinela visible), no solo revelar uno oculto — pero
  ningún nivel de dificultad lo aprovechaba para esconder algo, ambos solo
  consideraban revelar Portales ocultos.
  - `'normal'` (`decidirOcultistaAdversarialNormal`, `js/bot.js`):
    denegación GRATUITA, esconde el único ejemplar visible en toda la
    mesa de un requisito que hoy tiene una RIVAL — comparte el criterio
    de selección de objetivo con Cronista (interna
    `primerRequisitoUnicoDeRivalComoClaveHabilidad`, factorizada de
    `decidirCronistaAdversarialNormal`).
  - `'dificil'`: evalúa el mismo uso adversarial sobre Portales visibles,
    sin el descuento `* 0.5` de Cronista — esconder deniega la recompensa
    de inmediato, no a futuro.
- 3 tests nuevos en `tests/run-tests.mjs`.

---

## [1.21.0.80] - 2026-07-21

### Añadido
- **Uso estratégico de Aprendiz por el autómata (Bloque 4, 4.4)**: hasta
  ahora ningún nivel de dificultad usaba esta habilidad.
  - `'normal'` (`decidirAprendizNormal`, `js/bot.js`): SOLO beneficio
    propio incluyéndose a sí mismo — si su propia carta conocida ya es un
    requisito útil no la cambia a ciegas; si no, se intercambia con la
    primera rival cuya carta pública conocida sí lo sea.
  - `'dificil'` combina dos casos (gana el de mayor valor esperado):
    incluyéndose (`decidirAprendizPropioDificil`, comparando recibir vs.
    ceder con el mismo descuento "a futuro, en mano" que ya usa Cronista)
    y puramente adversarial SIN el bot
    (`decidirAprendizAjenoAjenoDificil`, intercambia las manos de las DOS
    rivales para desbaratar a la que va mejor posicionada, estimada por
    el recuento de Gemas por nivel — nunca el valor exacto de cada una).
- Nuevo `PESO_ADVERSARIAL` exportado desde `js/bot-probabilidad.js` (antes
  interno) para que `js/bot.js` lo reutilice sin duplicar el valor.
- 5 tests nuevos en `tests/run-tests.mjs`.

---

## [1.20.0.79] - 2026-07-21

### Añadido
- **Uso estratégico de Cronista por el autómata (Bloque 4, 4.3)**: Cronista,
  a diferencia de Ocultista, siempre pudo actuar sobre un Portal YA
  VISIBLE (se lleva su carta superior a la mano) — pero ningún nivel de
  dificultad lo aprovechaba, ambos solo consideraban Portales ocultos.
  - `'normal'` (`decidirCronistaAdversarialNormal`, `js/bot.js`): además de
    la comprobación compartida con Ocultista, denegación GRATUITA — se
    lleva a la mano el único ejemplar visible en toda la mesa de un
    requisito que hoy tiene una RIVAL.
  - `'dificil'` (dentro de `decidirHabilidadFaseBDificil`): evalúa el mismo
    uso adversarial sobre Portales visibles (antes solo ocultos), con el
    mismo `cubreNecesarioUnicoRival` y la misma ponderación a la baja
    (`* 0.5`) que ya aplicaba a Cronista.
- 3 tests nuevos en `tests/run-tests.mjs`.

---

## [1.19.0.78] - 2026-07-21

### Añadido
- **Uso estratégico de Estratega por el autómata (Bloque 4, 4.2)**: hasta
  ahora ningún nivel de dificultad usaba esta habilidad.
  - `'normal'` (`decidirEstrategaNormal`, `js/bot.js`): SOLO beneficio
    propio y con certeza — intercambia su primer Portal propio disponible
    por el primer Portal (ajeno o central) que muestre un requisito de la
    invocación activa que el bot no tenga ya en un Portal PROPIO.
  - `'dificil'` (`decidirEstrategaDificil`): evalúa un conjunto de pares
    candidatos (`candidatosEstrategaDificil` — todos los que involucran un
    Portal propio, más el par "Portal ajeno vulnerable + Portal central"
    para denegación pura sin beneficio propio) por el valor esperado
    RESULTANTE de intercambiar sus contenidos.
- Corregido durante el desarrollo de este bloque (nunca llegó a
  publicarse en una versión anterior): al reutilizar `valorEsperadoDeAccion()`
  para las DOS posiciones de un intercambio de Estratega, el mecanismo de
  "denegación por duplicado" (que asume que un personaje se AÑADE en un
  sitio nuevo mientras sigue existiendo donde estaba) contaba dos veces la
  misma denegación, porque en un intercambio el personaje se RELOCALIZA
  (deja de estar en el origen en la misma acción). `valorPosicion()`
  (interna) ahora evalúa cada posición sin ese mecanismo, dejando solo el
  de "tapar" (`cubreNecesarioUnicoRival`), calculado aparte por posición.
- 3 tests nuevos en `tests/run-tests.mjs`.

---

## [1.18.0.77] - 2026-07-21

### Añadido
- **Uso estratégico de Cronomante por el autómata (Bloque 4, 4.1)**: hasta
  ahora ningún nivel de dificultad usaba esta habilidad. La MEMORIA del
  bot (`window.memoriaBots[botIdx]`, historial de qué personaje ha visto
  pasar por cada Portal) ahora la mantienen AMBAS dificultades (antes solo
  `'dificil'`) — Cronomante la necesita para decidir con sentido en
  cualquier nivel; el conteo de cartas/probabilidad de
  `js/bot-probabilidad.js` sigue siendo exclusivo de `'dificil'`.
  - `'normal'` (`decidirCronomanteNormal`, `js/bot.js`): activa SOLO por
    beneficio propio, solo con certeza — un Portal PROPIO cuya memoria
    recuerda un requisito de la invocación activa aún no cumplido en
    ningún sitio de la mesa. Nunca el matiz adversarial.
  - `'dificil'`: evalúa además sustituir, en un Portal AJENO, el único
    ejemplar visible de un requisito por otra alternativa memorizada —
    denegándoselo a esa rival — con el mismo `cubreNecesarioUnicoRival` y
    `PESO_ADVERSARIAL` que ya usa Fase A (Bloque 3).
- `resolverPickersAbiertos()`/`elegirOpcionPicker()` (`js/bot.js`) ahora
  también emparejan por TEXTO de la etiqueta, no solo por valor —
  necesario para el segundo picker de Cronomante (elige un índice dentro
  de la pila, no una clave de Portal; solo el nombre en la etiqueta
  identifica cuál es la carta deseada).
- 4 tests nuevos en `tests/run-tests.mjs`.

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

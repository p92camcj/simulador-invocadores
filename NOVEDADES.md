# Novedades

Resumen en lenguaje sencillo de lo que ha ido cambiando en el simulador,
pensado para quien juega y usa la app (no para programadoras). Para el
detalle técnico completo, mira `CHANGELOG.md`.

---

## 1.19.0.78 - 2026-07-21

- **Los autómatas ya saben usar a Estratega**: antes nunca activaban esta
  habilidad. Ahora intercambian uno de sus Portales por el de otra
  jugadora (o uno central) cuando eso les trae un personaje que
  necesitaban. En dificultad "Difícil" también saben usarla para
  quitarle a una rival el crédito de un personaje que ya casi tenía
  conseguido, cambiándoselo por un Portal menos útil.

## 1.18.0.77 - 2026-07-21

- **Los autómatas ya saben usar a Cronomante**: antes nunca activaban esta
  habilidad. Ahora, si recuerdan haber visto un personaje que les hace
  falta pasar por uno de sus Portales, lo recuperan a la cima. En
  dificultad "Difícil" también pueden usarla para "estropear" el Portal de
  una rival, sustituyendo el personaje que le convenía por otro que
  recuerden de ese mismo Portal.

## 1.17.0.76 - 2026-07-21

- **Los autómatas ahora juegan también "contra" el resto**: antes solo
  pensaban en avanzar su propia partida. Ahora, si detectan que puede
  interesarles, también juegan cartas en el Portal de otra jugadora para
  tapar un personaje que le hacía falta, o duplican a propósito un
  personaje para anular su recompensa — jugadas totalmente legales que
  antes nunca se les ocurrían. En dificultad "Difícil" esta decisión se
  calcula con más matiz, sopesando cuánto perjudica a la rival frente a
  cuánto le beneficia a él mismo.

## 1.16.0.75 - 2026-07-21

- **¡Ya hay marcador final!** Al terminar la partida (se complete la
  última invocación o alguien se quede sin cartas), ahora se muestra
  cuántas Gemas tiene cada jugadora y quién ha ganado. Si hay empate en la
  suma total, se decide igual que en el reglamento físico: primero por
  quién ha participado en más invocaciones distintas, luego por la Gema
  de mayor valor de la última invocación conseguida, y así hacia atrás si
  hace falta; si el empate se mantiene del todo, se comparte la victoria.

## 1.15.1.74 - 2026-07-21

- **Mensajes de los autómatas corregidos**: cuando un autómata jugaba una
  carta en su propio Portal, el aviso decía algo como "...en tu Portal",
  como si te hablase directamente a ti. Ahora los mensajes están escritos
  como los leería alguien mirando la partida desde fuera: "...en su propio
  Portal" o "...en el Portal de Ana", según a quién pertenezca. Además, al
  activar una habilidad ahora se cuenta también sobre qué Portal o mano
  actuó, no solo el nombre de la habilidad.

## 1.15.0.73 - 2026-07-21

- **Nuevo nivel de dificultad "Difícil" para los autómatas**: al configurar
  una partida con autómatas, ahora puedes elegir entre "Normal" (la
  heurística de siempre) y "Difícil". En "Difícil", cada autómata lleva la
  cuenta de qué personajes ha visto pasar por cada Portal a lo largo de la
  partida y calcula, para cada jugada posible, cuántas Gemas espera ganar
  con ella — en vez de jugar simplemente "lo primero razonable", compara
  todas las opciones y elige la de mayor valor esperado, incluyendo cuándo
  merece la pena usar la nueva habilidad del Maestro. La dificultad se
  elige una sola vez para todos los autómatas de la partida, no una por
  autómata.

## 1.14.0.72 - 2026-07-21

- **Nueva habilidad activa del Maestro**: hasta ahora el Maestro solo daba
  su bonus de 3 Gemas. Ahora, en su turno, quien tenga al Maestro visible
  en su Portal puede además coger la carta que le veas a otra jugadora (la
  que ella tiene oculta para sí misma pero visible para el resto) y
  bajarla directamente a uno de los Portales de **esa misma jugadora**; a
  cambio, ella repone su mano robando una carta nueva del mazo. Si esa
  jugadora tiene una Centinela visible, la habilidad no puede usarse contra
  ella, igual que con el resto de habilidades.

## 1.13.11.67 - 2026-07-21

- **Arreglado que se pudiera activar gratis la habilidad de un personaje
  en un Portal central sin tener Gemas para pagarla**: ahora esa opción
  solo aparece si de verdad puedes pagar su coste (incluyendo el caso del
  Metamorfo, cuya propia transformación ya tiene un coste aparte).

## 1.13.10.66 - 2026-07-21

- Revisión interna de calidad de código (unificación de cómo se recorren
  los Portales de la mesa), sin cambios visibles para las jugadoras.

## 1.13.9.64 - 2026-07-21

- Revisión interna de seguridad del código (nombres de jugadora en el
  tablero), sin cambios visibles para las jugadoras.

## 1.13.8.63 - 2026-07-21

- Revisión interna de calidad de código (limpieza de una función interna
  sin uso), sin cambios visibles para las jugadoras.

## 1.13.7.62 - 2026-07-21

- Revisión interna de calidad de código (manejo de errores al comprobar
  actualizaciones), sin cambios visibles para las jugadoras.

## 1.13.6.61 - 2026-07-21

- Revisión interna de calidad de código (limpieza de estado de la
  habilidad del Cronomante), sin cambios visibles para las jugadoras.

## 1.13.5.60 - 2026-07-21

- **Las Gemas ahora se muestran con círculos de color** en vez de texto:
  azul para las unitarias, amarillo para las de la primera invocación,
  rojo para la segunda y morado para la última. Para ti (la jugadora
  activa) se sigue mostrando también el valor real de cada grupo entre
  paréntesis; para el resto, solo se ve cuántas tiene de cada color, como
  hasta ahora.

## 1.13.4.59 - 2026-07-21

- **Arreglado que la app pudiera quedarse "atascada" en una versión
  antigua**: si tenías la app instalada desde hace tiempo, a veces podías
  seguir jugando con código viejo sin darte cuenta (por ejemplo, el
  contador de cartas del mazo podía no bajar en partidas con autómatas).
  Ahora la app comprueba siempre la versión real del servidor cuando hay
  conexión, así que esto no debería volver a pasar.

## 1.13.3.58 - 2026-07-21

- **Arreglado el selector de destino al jugar carta en móvil**: el
  desplegable que indica qué hay en cada Portal (vacío, carta oculta o
  personaje) cortaba el texto sin más en pantallas estrechas cuando el
  nombre era largo (por ejemplo, con nombres de autómata). Ahora se
  muestra completo.

## 1.13.2.57 - 2026-07-21

- **Arreglados los botones de la cabecera en el móvil**: antes, en
  pantallas estrechas, los botones de arriba (jugar carta, activar
  habilidad, terminar turno...) se salían de la pantalla y había que
  desplazarla entera para llegar a todos. Ahora esos botones se acomodan en
  varias filas si hace falta, sin tener que mover nada más que la propia
  barra.

## 1.13.1.56 - 2026-07-21

- **Arreglado un fallo de la Clarividente**: antes, si tenías la
  Clarividente visible (viendo tus dos cartas) y otra jugadora o un
  autómata jugaba una carta encima tapándola, seguías viendo ambas cartas
  hasta que te tocaba jugar a ti otra vez. Ahora, en el instante exacto en
  que dejas de tener la Clarividente visible (la tapes tú o cualquier
  otra), se te pregunta de inmediato cuál de tus dos cartas prefieres
  seguir viendo — sin revelar qué personaje es cada una en la pregunta,
  para no dar pistas a quien mire la pantalla. Si es un autómata quien
  pierde la Clarividente, decide solo, sin preguntar nada.

## 1.13.0.55 - 2026-07-21

- **¡Ya puedes jugar con autómatas!** En la pantalla de configuración,
  además de elegir cuántas jugadoras sois (2 a 5), ahora puedes decidir
  cuántas de esas plazas las ocupa la app en modo automático. Cada
  autómata recibe un nombre único y temático (Arcanobot, Nigrobot,
  Rúnabot...) y juega su turno sola: elige qué carta jugar y dónde, y a
  veces activa la habilidad de un personaje si le conviene, todo con una
  pequeña pausa de "pensando..." para que no se sienta instantáneo.
- Las autómatas juegan limpio: nunca "hacen trampa" mirando cartas que no
  deberían conocer (ni su propia carta oculta, ni la carta que solo tú
  puedes ver de tu mano), y en pantalla nunca se revela su propia carta
  visible — ni siquiera durante su turno, para que la partida siga siendo
  justa para el resto de personas jugando desde la misma pantalla.
- De momento solo existe un nivel de autómata (el "normal"); niveles más
  listos o más agresivos quedan para una próxima versión.

## 1.12.5.54 - 2026-07-21

- Arreglado otro fallo de reglas con el Metamorfo: transformarse en otro
  personaje ya no da protección de Centinela, ni bloquea a la Ocultista, ni
  da el bonus de Gemas del Maestro, como si de verdad fuera ese personaje —
  el Metamorfo transformado sigue contando para completar invocaciones y
  repartir sus Gemas (eso no cambia), pero ya no puede "hacer trampa"
  copiando efectos que no le corresponden por ser solo un disfraz.

## 1.12.4.53 - 2026-07-21

- Arreglado un fallo de reglas: en ciertas situaciones era posible dejar dos
  Centinelas visibles en mesa a la vez usando la habilidad de la Ocultista.
  Ahora, si la Ocultista revela una Centinela, las demás Centinelas se
  ocultan automáticamente, como debe ser: solo puede haber una Centinela
  visible en cada momento.

## 1.12.3.49 - 2026-07-20

- Los Portales centrales ahora se ven en su propia franja, arriba del
  todo, en vez de mezclados entre las columnas de las jugadoras — así es
  más difícil que se te pasen por alto. Si en tu partida no hay ningún
  Portal central (con 5 jugadoras), esa franja no aparece.

## 1.12.2.48 - 2026-07-20

- El tablero ya no obliga a hacer scroll horizontal cuando la pantalla
  tiene sitio de sobra: en un ordenador con varias jugadoras, las columnas
  ahora aprovechan todo el ancho disponible. El scroll lateral solo
  aparece si de verdad no caben todas las columnas (pantallas pequeñas o
  muchas jugadoras a la vez).

## 1.12.1.48 - 2026-07-20

- Cambio interno, sin novedades visibles para quien juega: se ha escrito
  un informe detallado repasando qué partes del reglamento todavía no
  están implementadas, para planificar mejor las próximas novedades.

## 1.12.0.47 - 2026-07-20

- Ha vuelto el panel con listas desplegables para jugar carta: ahora puedes
  elegir cómo jugar cada vez (panel, tocar directamente, o arrastrar),
  como prefieras en cada turno.
- Al activar una habilidad que apunta a un Portal (Ocultista, Cronista,
  Cronomante, Estratega), ahora también puedes tocar directamente el
  Portal en el tablero en vez de usar solo la lista desplegable. Los
  Portales que no se pueden elegir (por ejemplo, protegidos por Centinela)
  se ven apagados y no responden al toque.

## 1.11.0.46 - 2026-07-20

- Nuevo diseño del tablero: ahora todas las jugadoras se ven a la vez en
  columnas, una junto a otra, cada una con su color y con la que tiene el
  turno destacada. El secreto de la partida (qué cartas ves y cuáles no)
  sigue funcionando exactamente igual que antes, solo cambia cómo se
  distribuye en pantalla.
- En el móvil, si no caben todas las columnas se puede desplazar
  horizontalmente para verlas todas, en vez de apretujarlas.

## 1.10.1.45 - 2026-07-20

- Ajustado el comportamiento de Cronomante al cancelar por accidente el
  paso de "qué carta subir arriba del todo": ahora se puede reintentar sin
  penalización, pero siempre sobre el mismo Portal que ya se había mirado
  — no se puede usar el cancelar para espiar Portales distintos gratis.

## 1.10.0.44 - 2026-07-20

- Jugar una carta es ahora más directo: toca la carta de tu mano y luego
  toca el Portal donde quieras jugarla, sin pasar por un panel con listas
  desplegables. Puedes tocar de nuevo la carta para deshacer la selección.
- En dispositivos con ratón, también puedes arrastrar la carta hasta el
  Portal (drag & drop) como alternativa a tocar.

## 1.9.0.43 - 2026-07-20

- Nueva "Vista de pruebas" (botón 🔧 en la cabecera), pensada solo para
  quien está probando la app: muestra toda la partida a la vez, con todas
  las cartas boca arriba. No debe usarse en una partida real, porque
  arruina la sorpresa y el secreto de la información entre jugadoras.

## 1.8.2.42 - 2026-07-20

- Cuando una jugadora tiene la Clarividente visible, ahora su mano
  completa queda oculta para el resto (antes, una de sus dos cartas se
  podía seguir viendo). Es una decisión de mesa para reforzar el secreto
  de la información mientras dura el efecto.

## 1.8.1.41 - 2026-07-20

- Corregido: podían llegar a estar visibles varias Centinelas a la vez en
  la mesa. Ahora, al jugar una Centinela, cualquier otra que estuviera
  visible se gira automáticamente boca abajo, como debe ser.

## 1.8.0.40 - 2026-07-20

- Nuevo: al pulsar el número de versión (esquina inferior izquierda) o el
  aviso de "nueva versión disponible", ahora se abre esta misma lista de
  novedades dentro de la propia app, sin salir a GitHub.

## 1.7.2.39 - 2026-07-20

- Corregido un truco con Cronomante: cancelar el paso de "qué carta subir
  al top" ya no permite volver a intentarlo mirando un Portal distinto
  gratis. Mirar el Portal ya gasta tu única "mirada" del turno.

## 1.7.1.38 - 2026-07-20

- La Centinela ahora protege **todos** tus Portales, no solo el que tiene
  a la Centinela encima.
- La protección de la Centinela ya no te bloquea a ti misma: solo protege
  frente a las demás jugadoras, nunca frente a tus propias habilidades
  sobre tus propios Portales.

## 1.7.0.37 - 2026-07-20

- Ya no se muestra el número exacto de puntos de Gemas de las demás
  jugadoras (antes se podía ver su puntuación real en todo momento). Ahora
  solo se ve cuántas Gemas tienen por tipo; tu propio desglose completo
  sigue siendo visible para ti.

## 1.6.0.36 - 2026-07-20

- Al elegir dónde jugar una carta, ahora se ve qué hay encima de cada
  Portal de destino (vacío, un personaje visible, o "carta oculta") antes
  de confirmar.

## 1.5.5.35 - 2026-07-20

- Corregido un fallo en el que usar la habilidad de Clarividente y luego
  intercambiar manos con el Aprendiz podía dejar las dos cartas recibidas
  con la misma orientación (las dos ocultas o las dos visibles), rompiendo
  una regla básica del juego.

## 1.5.4.34 - 2026-07-20

- Corregido que la carta robada con la habilidad de Cronista a veces
  llegaba a la mano con la orientación equivocada (visible cuando debía
  estar oculta, o al revés).

## 1.5.3.32 - 2026-07-20

- El Metamorfo ya puede transformarse en cualquier personaje no animal en
  cualquier momento de tu turno, sin estar ya limitado solo al personaje
  que falta para completar la invocación en curso.
- Si intentas transformarte sin Gemas para pagar, ahora se avisa con un
  mensaje claro en vez de no pasar nada sin explicación.

## 1.5.2.31 - 2026-07-20

- Corregido el número de Portales centrales que se creaban para partidas
  de 3 y 4 jugadoras, que no coincidía con el reglamento.
- Ya se puede jugar hasta con 5 jugadoras (antes el tope era 4).
- Corregido que los Portales centrales a veces no llegaban a aparecer en
  pantalla.

## 1.5.1.30 - 2026-07-20

- Corregido que cancelar a mitad de activar una habilidad igualmente
  gastaba tu activación del turno (y, si era un Portal central, te
  cobraba la Gema) aunque no hubiera pasado nada de verdad.

## 1.5.0.29 - 2026-07-20

- Las cartas ahora muestran su ilustración real en vez de un emoji con
  texto, en todos los sitios donde aparece una carta (mano y Portales).
- Nuevo botón "Ver ayuda" en la cabecera, siempre disponible, con la carta
  de ayuda física (resumen de habilidades y secuencia de turno).

## 1.4.2.28 - 2026-07-20

- Corregido que el aviso de "nueva versión disponible" a veces aparecía
  aunque ya tuvieras la versión más reciente.

## 1.4.1.27 - 2026-07-19

- Corregido que el set de invocación "Floral" era imposible de completar:
  pedía personajes que en realidad no estaban en su mazo.

## 1.4.0.26 - 2026-07-19

- Actualización grande para acercarse más al reglamento real: activar la
  habilidad de un personaje es ahora una acción independiente de jugar una
  carta (antes se activaba automáticamente al jugarla). Solo se puede
  activar una habilidad por turno, gratis en tus propios Portales o
  pagando una Gema en un Portal central.
- Las Gemas pasan a ser un sistema real, repartidas en secreto y con
  distintos valores, en vez de ser solo un número.
- Las invocaciones ahora tienen nombre propio y requisitos según el set de
  invocación elegido al configurar la partida (Introductorio / Normal /
  Floral).
- Corregido que el bonus del Maestro solo funcionaba en la invocación de
  nivel "A" en vez de en el nivel que realmente lo necesitara.

## 1.3.3.24 - 2026-07-19

- Revisión interna de calidad de código, sin cambios visibles para las
  jugadoras.

## 1.3.2.23 - 2026-07-19

- Añadida documentación de introducción rápida al proyecto (sin cambios en
  el juego en sí).

## 1.3.1.22 - 2026-07-19

- Corregidos varios cuelgues: activar cualquier habilidad rompía la
  partida, completar una invocación rompía la partida, y la partida
  terminaba al completar CUALQUIER invocación en vez de continuar hasta la
  última.
- Corregido que el aviso de "nueva versión disponible" aparecía en cada
  actualización aunque no hubiera novedades reales que anunciar.

## v1.3.0 - 2025-04-24

- La partida ahora termina automáticamente al completar la última
  invocación o si una jugadora empieza su turno sin cartas en la mano.
- Al terminar la partida se pregunta si se quiere jugar otra vez.
- Se muestra cuántas cartas quedan en el mazo.
- Se rellenan nombres por defecto si se dejan en blanco.
- Rediseñada la pantalla de configuración inicial.

## v1.2.0 - 2024-04-23

- Nuevo botón flotante "Jugar una carta" en la cabecera para acceder más
  rápido.
- Pequeñas correcciones en la pantalla de configuración.

## v1.1.0 - 2025-04-23

- La app ahora muestra su número de versión y avisa si hay una versión más
  nueva disponible, con acceso al historial de cambios.

## v1.0.0 - 2025-04-22

- Primera versión jugable: sistema completo de turnos y Portales,
  habilidades de personajes (Cronista, Clarividente, Centinela, Ocultista,
  Aprendiz, Metamorfo, etc.), puntuación por objetivos invocados, e
  instalación como app para jugar sin conexión.

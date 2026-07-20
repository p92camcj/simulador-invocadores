# Novedades

Resumen en lenguaje sencillo de lo que ha ido cambiando en el simulador,
pensado para quien juega y usa la app (no para programadoras). Para el
detalle técnico completo, mira `CHANGELOG.md`.

---

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

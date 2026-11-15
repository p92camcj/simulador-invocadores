# Prototipos

Páginas de prueba que **no forman parte del juego** (no las carga
`index.html` ni las cachea el service worker).

- `personajes-3d.html` — maqueta de la fase 1 de «dar vida 3D a los
  personajes»: escenas cortas y predefinidas (manos, jugar carta, tapar,
  Portales, una habilidad por personaje, invocación) con Three.js
  (`vendor/three`, MIT) y sonido sintetizado con Web Audio (sin archivos de
  audio). Código en `../js/personajes3d/` (el mismo que usa el juego con la opción «Personajes 3D»). Los modelos de `modelos.js` son
  provisionales (geometría por código); la idea es sustituirlos por modelos
  GLB generados a partir del arte original.
  Publicada en https://p92camcj.github.io/simulador-invocadores/prototipos/personajes-3d.html
- `figuras-bloques.html` — boceto de estilo «figuritas de bloques de
  juguete» (inspirado en los videojuegos de bloques, sin marcas): seis
  personajes (Clarividente, Cronomante, Centinela, Ocultista, Entusiasta,
  Estratega) con un cuerpo común y piezas, estampados y accesorios propios,
  sobre Portales de ladrillos como los del Escenario y una placa con tetones
  hexagonales (no redondos, para no imitar a ninguna marca). Orbes y llamas
  levitan por su cuenta y siguen las manos. Todo por código en el propio HTML
  (Three.js de `vendor/three`). Preparada para móvil: deslizar gira,
  pellizcar acerca, tocar un personaje lo muestra solo; botones por personaje
  y animaciones (reposo, andar, saludar, habilidad). Parámetros: `?quien=a,b`, `ver`, `anim`, `dist`, `alt`,
  `ang`, `quieto`, `invocar`. Botón «✦ Invocar»: invocación de Baelorith
  (Estratega + Cronomante + Cronista), reparto de Gemas y nuevo Portal central
  montándose pieza a pieza. No toca el juego.
  Publicada en https://p92camcj.github.io/simulador-invocadores/prototipos/figuras-bloques.html

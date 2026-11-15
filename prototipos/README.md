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
  sobre Portales y una placa con tetones. Todo por código en el propio HTML
  (Three.js de `vendor/three`). Parámetros: `?quien=a,b`, `dist`, `alt`,
  `ang`, `quieto`. No toca el juego.
  Publicada en https://p92camcj.github.io/simulador-invocadores/prototipos/figuras-bloques.html

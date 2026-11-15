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
  juguete» (inspirado en los videojuegos de bloques, sin marcas): los 14
  personajes (11 con cuerpo común y piezas, estampados y accesorios propios,
  y los animales Reena, Sora y Lumo) sobre Portales de ladrillos como los del
  Escenario y una placa con tetones hexagonales (no redondos, para no imitar a
  ninguna marca). Cada Portal lleva delante la mano de su jugador: un
  personaje que ven los demás y otro encapuchado. Orbes y llamas levitan por
  su cuenta y siguen las manos. Todo por código en el propio HTML (Three.js de
  `vendor/three`); Portales y manos se funden en pocas mallas (`fundir()`)
  para que vaya fluido en móvil. Preparada para móvil: deslizar gira,
  pellizcar acerca, tocar un personaje lo muestra solo; botones por personaje
  y animaciones (reposo, andar, saludar, habilidad). Parámetros: `?quien=a,b`,
  `ver`, `anim`, `dist`, `alt`, `ang`, `quieto`, `sep`, `invocar=<criatura>`.
  «✦ Invocar» abre un selector con las 10 invocaciones (Cilast, Burnio y
  Aspir con aspecto inventado, aún sin arte): runas, criatura levitando,
  reparto de Gemas y nuevo Portal central montándose pieza a pieza.
  «Habilidad» lanza una escena propia por personaje, sin cartas en ninguna.
  No toca el juego.
  Publicada en https://p92camcj.github.io/simulador-invocadores/prototipos/figuras-bloques.html

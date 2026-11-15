# Manual de modelado 3D de personajes (Invocadores)

Última actualización: 2026-11-15 17:28 (Europe/Madrid)

Manual práctico, escrito mientras aprendemos, para pasar un personaje de
Invocadores de **una ilustración** a **un modelo 3D animado** que se pueda
usar en el Escenario del juego (Three.js). Está pensado para poder repetirlo
dentro de unos meses sin recordar nada, y para usarlo como material de clase.

Cada sección dice **qué** se hace, **por qué** y **con qué herramienta**. Las
partes marcadas como *(pendiente)* aún no se han probado de verdad.

---

## 0. El mapa completo en una imagen mental

```
Ilustración 2D ──► (1) Generar malla 3D ──► (2) Limpiar y preparar ──► (3) Esqueleto (rig)
                     TRELLIS / Hunyuan3D      Blender                    Mixamo o Blender
                                                                              │
     (6) Usar en el juego ◄── (5) Exportar GLB ◄── (4) Pesos + animaciones ◄──┘
         Three.js               Blender              Blender (+ Mixamo)
```

Vocabulario mínimo:

| Palabra | Qué significa |
|---|---|
| **Malla** (mesh) | La "piel" del modelo: miles de puntos (vértices) unidos en triángulos. |
| **Textura** | La imagen que se "pega" sobre la malla para darle color. |
| **UV** | El "patrón de costura": dice qué trozo de la textura va en cada triángulo. |
| **Esqueleto / rig** | Huesos invisibles dentro de la malla que permiten moverla. |
| **Pesos** (skin weights) | Cuánto sigue cada vértice a cada hueso (0 = nada, 1 = del todo). |
| **Animación** | Lista de posiciones de los huesos a lo largo del tiempo. |
| **T-pose** | Postura de referencia con los brazos en cruz; se usa para riggear. |
| **GLB / glTF** | Formato 3D "para la web": malla + textura + huesos + animaciones en un archivo. |
| **FBX / OBJ** | Otros formatos. OBJ solo guarda malla (+ material MTL); FBX guarda también huesos y animaciones. |

---

## 1. Generar la malla a partir de la ilustración

### ¿Puede Blender hacerlo solo?

**No.** Blender es una herramienta de modelado *manual*: tiene todo para
esculpir, pintar, riggear y animar, pero no "lee" una imagen y fabrica el
modelo. Eso lo hacen modelos de inteligencia artificial de *imagen a 3D*
(TRELLIS de Microsoft, Hunyuan3D de Tencent...). La web trellis3d.co no es
más que una página que ejecuta TRELLIS en sus servidores.

Así que, para hacerlo todo en local, hay dos caminos:

1. **Ejecutar la IA en tu propio PC** (TRELLIS o Hunyuan3D) y luego abrir el
   resultado en Blender. Es gratis y sin depender de nadie, pero necesita una
   **tarjeta gráfica NVIDIA** con bastante memoria (VRAM). Orientativo, a
   confirmar al instalar:
   - Hunyuan3D 2 *mini*: la forma cabe en unos 6 GB de VRAM; con textura,
     bastante más (unos 12-16 GB).
   - TRELLIS: el oficial pide unos 16 GB de VRAM. Hay versiones adaptadas
     para Windows y para menos memoria, más lentas.
   - Sin NVIDIA (o con poca VRAM) no merece la pena: se usa la web y se hace
     en local todo lo demás.
   - **Cómo saber qué gráfica tienes (Windows):** `Ctrl+Mayús+Esc` ▸
     *Rendimiento* ▸ *GPU*. Arriba a la derecha sale el nombre y abajo la
     *Memoria de GPU dedicada*. Otra forma: `Win+R`, escribir `dxdiag`,
     pestaña *Pantalla*.
   - **Nuestro caso:** el Minisforum lleva una **AMD Radeon 760M**, una
     gráfica *integrada* (comparte la RAM del PC, sin memoria propia) y
     sin CUDA de NVIDIA. TRELLIS y Hunyuan3D no van en ella de forma
     práctica, así que la generación de la malla se sigue haciendo en la
     web y todo lo demás (Blender, pesos, animaciones) en local. Blender sí
     funciona bien con esa gráfica.
   Hunyuan3D trae además un complemento de Blender que llama a la IA
   instalada en tu PC, así que se puede lanzar desde el propio Blender.
2. **Modelar a mano en Blender** usando la ilustración como plantilla de
   fondo. Es lo más lento, pero es lo que más se aprende y lo que da un
   modelo limpio desde el principio (ideal para clase). Los personajes
   "por código" que ya tiene el juego son, en el fondo, esta idea.

### Dónde usar TRELLIS gratis: Hugging Face

Las webs tipo trellis3d.co cobran: el modelo es gratis (código abierto,
licencia MIT), pero la tarjeta gráfica que lo ejecuta cuesta dinero, y esas
webs revenden ese tiempo de máquina. La alternativa gratuita es
**Hugging Face** (huggingface.co), "el GitHub de la IA". Allí hay dos cosas
con el mismo nombre que conviene distinguir:

| En el buscador | Qué es | Para qué sirve |
|---|---|---|
| **Models** (p. ej. `microsoft/TRELLIS-image-large`) | Los archivos del modelo: el "cerebro" entrenado, varios GB | Descargarlo y ejecutarlo en tu propio ordenador o en Colab. No tiene botones. |
| **Spaces** (p. ej. `microsoft/TRELLIS`) | Una página web con una aplicación ya montada que usa ese modelo | Subir imágenes y descargar el 3D desde el navegador, sin instalar nada. |

Analogía para clase: el *Model* es la receta y los ingredientes; el *Space*
es un restaurante que ya la cocina por ti.

**Para pasar imágenes 2D a 3D se elige el Space `microsoft/TRELLIS`:**

1. Entrar en huggingface.co (mejor con una cuenta gratuita: da más cuota
   diaria de GPU) y buscar `microsoft/TRELLIS`; en el apartado **Spaces**.
2. Subir la imagen frontal. Si hay varias vistas del mismo personaje, usar
   la pestaña de varias imágenes (*Multiple Images*).
3. Pulsar **Generate** y esperar (puede haber cola).
4. Revisar la vista previa y pulsar **Extract GLB**; descargar el `.glb`.
   Con *Simplify* se reduce el número de triángulos y con *Texture Size*
   el tamaño de la textura (1024 basta para el juego).

`microsoft/TRELLIS.2` es la versión nueva, con más detalle; merece la pena
probarla con la misma imagen y comparar.

### Lo que hemos hecho hasta ahora (2026-11-15)

- Ilustración usada: personaje con capa y túnica larga.
- **trellis3d.co/es**: dio un **GLB con textura** de unos **1,7 MB** y
  **unos 14.000 vértices**. Buen resultado para empezar.
- **Hunyuan3D en Hugging Face (Spaces)**: solo daba una **malla blanca sin
  textura de 25 MB**. Descartado por ahora.

**Consejos para la imagen de entrada:** personaje entero, de frente, fondo
liso (mejor blanco o transparente), brazos algo separados del cuerpo y sin
objetos que tapen las piernas. Cuanto más se parezca a una T-pose, mejor se
riggeará después.

---

## 2. Preparar la malla en Blender *(pendiente)*

Pasos que haremos cada vez:

1. `Archivo ▸ Importar ▸ glTF 2.0` y abrir el GLB.
2. Comprobar escala (el personaje debe medir ~1,7 unidades = 1,7 m) y que
   mire hacia **-Y** (el "frente" de Blender). Aplicar con `Ctrl+A ▸ Todo`.
3. Poner los pies en el suelo (origen del objeto entre los pies).
4. Limpiar: `Malla ▸ Limpiar ▸ Fusionar por distancia` para quitar
   vértices duplicados.
5. Si hay demasiados triángulos, modificador **Decimate**. Para el juego en
   móvil, apuntar a **5.000-15.000 triángulos** por personaje.

---

## 3. El esqueleto (rig)

### Mixamo (web gratuita de Adobe)

- **Problema 1:** Mixamo rechazó el GLB con el error *"unable to map your
  existing skeleton"*. Mixamo no acepta bien los GLB de estas IA.
- **Solución:** convertir el modelo a **OBJ + MTL + PNG** (malla, material y
  textura) y subirlos **juntos en un ZIP**. Con eso Mixamo sí hizo el
  auto-rig. (Copia del ZIP usado: carpeta del proyecto
  `personajes3d/mixamo/personaje-mixamo.zip`.)
  En Blender: `Archivo ▸ Exportar ▸ Wavefront (.obj)`, marcar *Materiales*,
  y meter en un ZIP el `.obj`, el `.mtl` y la textura `.png`.
- En Mixamo se colocan los marcadores (barbilla, muñecas, codos, rodillas,
  ingle). Con túnica larga, la ingle y las rodillas se ponen "donde
  estarían" bajo la tela.

### Qué descargar de Mixamo

| Archivo | Opciones de descarga |
|---|---|
| T-pose del personaje | FBX, **With Skin** |
| Idle (reposo) | FBX, **Without Skin**, 30 fps |
| Walking (andar) | FBX, **Without Skin**, marcar **In Place** |

"Without skin" = solo los huesos en movimiento, sin repetir la malla (pesa
menos). "In Place" = anda sin desplazarse; el juego ya lo mueve por el
escenario.

---

## 4. Pesos y animaciones en Blender *(pendiente)*

### Problema detectado: la capa sigue al brazo

El auto-rig de Mixamo reparte los pesos por cercanía: los vértices de la
capa que están cerca del brazo quedan "pegados" a los huesos del brazo, y
al moverlo la capa se estira con él.

**Solución prevista:**

1. Importar el FBX de la T-pose (`Archivo ▸ Importar ▸ FBX`).
2. Seleccionar la malla, pasar a modo **Pintura de pesos** (*Weight Paint*).
3. Elegir los huesos del brazo (`mixamorig:LeftArm`, `LeftForeArm`...) y
   **restar peso** (pincel *Restar* o peso 0) en toda la capa.
4. Elegir `Spine`, `Spine1`, `Spine2` y `Neck` y **sumar peso** en la capa,
   para que siga solo al pecho y a la espalda.
5. Opcional: añadir 2-3 **huesos extra para la capa** colgando de la
   espalda, para que ondee en las animaciones.
6. Normalizar: `Pesos ▸ Normalizar todo` (cada vértice suma 1).

### Juntar las animaciones

1. Importar los FBX de Idle y Walking.
2. En el **Editor de acciones** (*Dope Sheet ▸ Action Editor*) asignar cada
   acción al esqueleto de la T-pose y renombrarlas `reposo` y `andar`.
3. Pulsar *Push Down* para guardarlas como pistas NLA; así se exportan todas.

---

## 5. Exportar para el juego *(pendiente)*

`Archivo ▸ Exportar ▸ glTF 2.0`, formato **GLB**, con:
*Incluir ▸ Objetos seleccionados*, *Animación ▸ acciones NLA*,
*Malla ▸ Aplicar modificadores*, y compresión de texturas a 1K o 2K.
Objetivo: **menos de 3 MB** por personaje.

## 6. Usarlo en el Escenario del juego *(pendiente)*

Los GLB irán en `assets/modelos3d/` y el juego los cargará con
`GLTFLoader` de Three.js, reproduciendo `reposo` y `andar` con un
`AnimationMixer`. Se probará primero con un par de personajes; si el estilo
convence, se aplica al resto.

---

## 7. Hacerlo todo en local: herramientas

| Herramienta | Para qué | Notas |
|---|---|---|
| **Blender** (gratis) | Todo lo de las secciones 2, 4 y 5 | blender.org |
| **Blender MCP** (complemento gratis) | Que Claude maneje Blender por ti desde una sesión en tu PC | Hay que instalarlo en Blender y en Claude |
| **TRELLIS / Hunyuan3D** en local | Sección 1 sin web | Depende de tu tarjeta gráfica |
| **Mixamo** (web gratis) | Rig y animaciones rápidas | Única dependencia online que queda; se puede sustituir riggeando en Blender (complemento *Rigify*) |

---

## Registro de avances

- **2026-11-15** — Primer personaje: GLB de trellis3d.co (1,7 MB, ~14.000
  vértices). Mixamo rechaza el GLB; con OBJ+MTL+PNG en ZIP sí riggea. Capa
  mal pesada (sigue al brazo). Siguiente: descargar T-pose, Idle y Walking
  de Mixamo y arreglar pesos en Blender. Gráfica del PC: AMD Radeon 760M
  integrada, así que la IA de imagen a 3D no se ejecuta en local.
- **2026-11-15 (tarde)** — trellis3d.co pasa a pedir suscripción. Se
  cambia al Space gratuito `microsoft/TRELLIS` de Hugging Face. Julio
  prepara con Gemini vistas en T-pose (frontal, trasera y laterales) con
  los brazos separados de la capa.

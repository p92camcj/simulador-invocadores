# Historia del proyecto

> Reconstruida el 2026-11-27 a partir de lo que hay en el repositorio: `git log`,
> `README.md`, `CLAUDE.md`, `CHANGELOG.md`, `docs/` y el código de `js/`.
> No existía `docs/DIARIO.md` en el momento de escribirla. Donde algo no se
> deduce con seguridad del repo, se indica.

## 1. Qué es

**Simulador Invocadores** es el simulador digital de *playtest* de
«Invocadores», un juego de mesa físico de un diseñador externo (créditos en
el `README.md`). Sirve para probar y ajustar las reglas jugando alrededor de
una mesa, con todas las jugadoras mirando una misma pantalla compartida
(2 a 5 jugadoras, humanas o autómatas). No hay multijugador en red.

Tecnología: HTML/CSS/JavaScript plano con módulos ES, sin framework, sin
build y sin `package.json`. Todo el estado vive en memoria del navegador
(`window.*`); recargar la página pierde la partida. Es instalable como PWA
(`manifest.json`, `service-worker.js`, `js/pwa-install.js`). La fuente de
verdad de las reglas es `docs/reglamento/REGLAMENTO.md` (más el PDF maquetado
`docs/reglamento/reglamento-invocadores.pdf`).

## 2. Lo hecho, por fechas

### Abril de 2025: primera versión jugable (v1.0.0 → v1.3.0)

- **22-04-2025** — «primera subida»: simulador jugable con turnos, Portales,
  habilidades de personajes, visibilidad de cartas por jugadora, puntuación
  por invocaciones e iconos. Ese mismo día: botón de instalación PWA,
  `CHANGELOG.md`, `version.json` y aviso de «nueva versión» con botón de
  actualizar (v1.1.0).
- **23-04-2025** — botón flotante «Jugar una carta» y panel de juego
  rediseñado (v1.2.0). Nota: en `CHANGELOG.md` esta versión aparece fechada
  «2024-04-23», pero el commit es de 2025; parece una errata.
- **24/25-04-2025** — v1.3: mazo inicial bien construido, contador de cartas
  restantes, límite de jugadoras, pantalla de inicio rediseñada, fin de
  partida automático y opción de volver a jugar, nombres por defecto.

Después hay un parón de **casi 15 meses** sin commits (abril 2025 → julio 2026).

### 19-07-2026: puesta al día con el reglamento revisado

- Auditoría de bugs, nuevo esquema de versión `X.Y.Z.W` (W = nº de commits) y
  reglamento editable en Markdown (`1.3.1.22`). Se corrigen varios
  `ReferenceError` que rompían habilidades e invocaciones.
- `README.md`, `docs/DEUDA_TECNICA.md` y `docs/MEJORAS_FUTURAS.md`.
- Reglamento actualizado a la revisión del diseñador.
- **Fase B independiente del turno** (activar habilidad es una acción aparte,
  una vez por turno) y **economía real de Gemas** (Gemas con valor y nivel,
  Gema de asterisco, sets de invocación con nombre) — `1.4.0.26`.
- Corrección del set «floral», cuyas invocaciones eran imposibles de completar.

### 20-07-2026: ronda de correcciones e interfaz

- Comparación de versiones correcta en el aviso de actualización.
- Imágenes reales de carta en mano y Portales (`assets/cards`).
- Muchas correcciones de reglas: cancelar una habilidad ya no la gasta,
  reparto de Portales centrales según nº de jugadoras (2-5), Metamorfo sin la
  restricción antigua, Cronista, Centinela (alcance de la protección y
  auto-giro), Cronomante, Clarividente (oculta la mano de su dueña).
- Modal de «Novedades» dentro de la app (`NOVEDADES.md`).
- Vista de depuración con todo visible (solo para pruebas).
- Jugar carta con clic o arrastrar; el tablero pasa a ser una rejilla de N
  columnas interactiva, con los Portales centrales en fila propia.
- `docs/AUDITORIA_REGLAS.md`: cruce del reglamento con el código real.

### 21-07-2026: autómatas, deuda técnica y estrategia

- Madrugada: corrección del bug Ocultista/Centinela (dos Centinelas visibles a
  la vez) y separación de identidad real (`.name`) y apariencia (`.aspecto`)
  del Metamorfo.
- **Jugadoras autómatas (bots)** combinables con humanas (`js/bot.js`).
- Clarividente con corte de visibilidad inmediato; arreglos de móvil
  (cabecera, selector); el Service Worker deja de servir código desactualizado;
  las Gemas se muestran como círculos de color por nivel.
- Sesión de deuda técnica: varios ítems de `DEUDA_TECNICA.md` cerrados (escapar
  nombres en HTML, `.catch()` en la consulta de Releases, código muerto,
  `todosLosPortales()`), un bug real corregido (activar gratis la habilidad
  de un Portal central sin Gemas) y un **runner de tests sin dependencias**
  (`tests/run-tests.mjs`).
- Tarde: habilidad activa del **Maestro**; nivel de dificultad **«Difícil»**
  del autómata con motor probabilístico de conteo de cartas
  (`js/bot-probabilidad.js`).
- Noche: mensajes del autómata en tercera persona, **marcador final con
  desempate completo** del reglamento (`calcularResultadoFinal()`),
  estrategia adversarial en Fase A y uso estratégico por el autómata de
  Cronomante, Estratega, Cronista, Aprendiz, Ocultista, Metamorfo y Maestro
  (`1.24.0.83`).

### 05-11-2026: reglas confirmadas con el autor y PDF del reglamento

- Sin cambio de Gemas (solo se paga con Gemas de valor 1); ficha de
  transformación del Metamorfo que se pierde al taparlo/ocultarlo; Maestro no
  puede apuntar a quien tiene la Clarividente visible (`1.24.1.83`).
- Redacción final del reglamento confirmada con el autor.
- La Gema de asterisco revelada se conserva y sigue puntuando; Entusiasta sin
  Gema de 1 no aplica su efecto (`1.24.2.85`).
- PDF del reglamento publicado en el repo y botón «Reglamento» en la app
  (`1.25.0.86`). Todo esto entró en `main` con el PR #1.

## 3. Estado actual (versión `1.25.0.86`)

**Funciona** (según `CHANGELOG.md`, `CLAUDE.md` y las docs):
- Partidas de 2 a 5 jugadoras, humanas y/o autómatas (niveles «normal» y
  «difícil»), con sets de invocación introductorio, normal y floral.
- Secuencia de turno Fase A (jugar carta) / Fase B (activar habilidad), economía
  de Gemas real, habilidades de Ocultista, Cronista, Cronomante, Estratega,
  Aprendiz, Metamorfo y Maestro; Centinela y Clarividente como pasivas.
- Marcador final con desempate (mostrado con `alert()`, sin pantalla propia).
- PWA instalable con aviso de versión basado en las Releases de GitHub.

**A medias o simplificado:**
- El código **no implementa el reglamento completo** (lo dicen el README y
  `CLAUDE.md`): faltan el Entusiasta, los modos Introductorio (como mazo
  propio de 29 cartas), Avanzado y Experto (la 4ª invocación «Asterisco» está
  definida pero sin conectar) y la variante 2 contra 2.
- El Metamorfo transformado se ve igual que el personaje imitado; falta la
  superposición semitransparente pedida.
- Tests: solo la lógica pura de `js/utils.js` y parte de `js/abilities.js`
  (71 casos según `CHANGELOG.md` de `1.24.2.85`). No cubren
  `actions.js`/`game.js`/`render.js` ni los flujos con selector de UI. Al
  reconstruir esta historia no se pudieron ejecutar (el entorno pidió
  aprobación para lanzar `node`), así que su estado actual no está verificado aquí.

**Fallos conocidos:**
- **Clarividente, bug (b)**: reportado que al robar al final del turno se
  pierde la visibilidad de las dos cartas de la mano. No se ha conseguido
  reproducir y no se conoce la causa (`docs/MEJORAS_FUTURAS.md`).
- Flujo basado en `alert()`/`confirm()` nativos, sin historial de eventos
  (deuda baja, ítem 10).

## 4. Pendiente

De `docs/MEJORAS_FUTURAS.md`, `docs/DEUDA_TECNICA.md` y `CLAUDE.md`:

- Ponerse al día con el reglamento: Entusiasta (expansión opcional), modos
  Introductorio/Avanzado/Experto, variante 2vs2 (necesita sumar el marcador
  por equipo).
- Reproducir y corregir el bug (b) de la Clarividente.
- Representación visual del Metamorfo transformado.
- Autómata «difícil»: desempate opcional por Gemas estimadas de rivales y no
  tapar su propia carta con habilidad en Fase A (no implementados).
- UX: sustituir `alert()`/`confirm()` por UI propia con historial, pantalla de
  resultados, botón para abandonar/reiniciar la partida, aviso de versión más
  visible, vista de mesa ovalada.
- Deuda técnica: ítem 6 (tests, alcance parcial), ítem 8
  (`PERSONAJES_CON_HABILIDAD` mantenido a mano, evaluado y aparcado),
  ítem 10 (diálogos nativos). No hay ítems de prioridad alta abiertos.
- Comentarios `TODO` en el código: `js/render.js` (Modo Experto) y
  `js/utils.js` (imagen del Metamorfo transformado).
- A largo plazo, sin fecha: multijugador en red (cada jugadora con su móvil).
- No se ven issues de GitHub en el repo; si los hay, no constan aquí.

## 5. Cómo se publica y se prueba

- **Probar en local**: servir la carpeta por HTTP (p. ej.
  `python -m http.server 8123` y abrir `http://localhost:8123/index.html`);
  abrir `index.html` con `file://` no funciona por los módulos ES. Tests de
  lógica pura: `node tests/run-tests.mjs`. El resto se verifica jugando a mano.
- **Versionado**: cada cambio de código sube `version.json` (`X.Y.Z.W`, con W
  = `git rev-list --count HEAD`) y añade entrada en `CHANGELOG.md` y en
  `NOVEDADES.md` (para jugadoras). Las Releases de GitHub se etiquetan `vX.Y.Z`
  y son lo que dispara el aviso de actualización en la app.
- **Publicación**: `CLAUDE.md` dice que se *presume* GitHub Pages sirviendo
  directamente desde `main`, sin build, y que hay que confirmarlo con el
  propietario. No hay workflows de CI (`.github/` no existe), así que el
  mecanismo real de despliegue no se puede confirmar desde el repo.

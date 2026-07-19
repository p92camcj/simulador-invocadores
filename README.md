# Simulador Invocadores

**Invocadores** es un juego de mesa físico diseñado por Adrián Jiménez Valle
([@elmeepleazul](https://www.elmeepleazul.es)). Este repositorio es su
**simulador digital de playtest**: una app web que reproduce el desarrollo de
una partida física para probar y ajustar las reglas alrededor de una mesa,
todos mirando la misma pantalla compartida (todavía no hay multijugador en
red — ver "Estado actual").

## Cómo probarlo en local

Es HTML/CSS/JS plano, sin build ni dependencias — pero **no basta con abrir
`index.html` haciendo doble clic**. El juego carga sus módulos con
`<script type="module">` y registra un Service Worker, y ambas cosas
requieren que el navegador vea el sitio servido por HTTP (protocolo
`file://` no vale: los navegadores bloquean los módulos ES por CORS bajo
ese esquema). Hace falta un servidor estático simple:

```bash
# desde la raíz del repo, con Python instalado
python -m http.server 8123
```

y abrir `http://localhost:8123/index.html`. Sirve cualquier servidor
estático equivalente (`npx serve`, la extensión Live Server de VS Code,
etc.) — lo único que importa es que sea HTTP, no `file://`.

Verificado: con este método la app carga sin errores en consola, el
Service Worker se registra (`SW registrado ✔️`) y la partida se juega con
normalidad.

## Instalarlo como app en el móvil (PWA)

El manifest (`manifest.json`) y `js/pwa-install.js` habilitan instalación
como PWA:

- **Android/Chrome**: al visitar el sitio aparece un botón flotante
  "Instalar esta app" abajo a la derecha (capturando el evento
  `beforeinstallprompt`). Al pulsarlo, Chrome lanza el diálogo nativo de
  instalación.
- **iOS/Safari**: no existe `beforeinstallprompt` en iOS, así que en su
  lugar aparece un botón "¿Quieres instalar esta app?" que muestra
  instrucciones manuales (Compartir → Añadir a pantalla de inicio). Ese
  botón se oculta si la app ya se abrió en modo standalone (ya instalada).
- Una vez instalada, abre en pantalla completa (`display: standalone`),
  con el icono y colores definidos en `manifest.json`.
- El **Service Worker** (`service-worker.js`) cachea los archivos base
  (HTML, CSS, JS, `version.json`) en la instalación, así que la app abre
  aunque no haya conexión — pero solo sirve la versión cacheada en ese
  momento; no vuelve a comprobar actualizaciones del caché automáticamente.

### El aviso de "nueva versión disponible"

En la esquina inferior izquierda siempre se ve el número de versión actual
(leído de `version.json`, formato `X.Y.Z.W` — ver más abajo). Al cargar,
`js/version-check.js` compara ese `X.Y.Z` contra el `X.Y.Z` del **tag de la
última release publicada en GitHub** (vía la API pública de releases). Si
son distintos, muestra un banner amarillo arriba a la derecha con un botón
"Actualizar ahora".

Puntos a tener en cuenta dentro de un año:

- Esta comparación **no mira commits ni `main`, solo Releases de GitHub**.
  Si no se ha publicado una release nueva, el banner sigue comparando
  contra la última que exista, por antigua que sea.
- La comparación solo detecta que los números **son distintos**, no cuál es
  mayor. Es decir: si `version.json` está *por delante* de la última
  release (como ocurre ahora mismo — código en `1.3.1.x` sin release nueva
  publicada desde `v1.2.0`), el banner igualmente aparece, aunque en
  realidad no haya nada más nuevo que instalar. No es un bug que haya que
  arreglar a ciegas si vuelve a pasar: es el comportamiento esperado del
  código tal y como está.
- El propio número de versión y el banner son clicables y abren
  `CHANGELOG.md` en GitHub.

## Estructura del proyecto

Sin build ni framework: `index.html` como shell, módulos ES en `js/`
(`index.js` como entrada, `setup.js`, `game.js`, `actions.js`,
`abilities.js`, `render.js`, `utils.js`), estado global en memoria colgado
de `window.*`, más `manifest.json`/`service-worker.js`/`pwa-install.js`
para la parte PWA. El detalle de arquitectura, responsabilidad de cada
módulo y advertencias de diseño (p. ej. el uso de `window.*` en vez de
variables de módulo) está en **[`CLAUDE.md`](CLAUDE.md)**. El catálogo
función por función de cada módulo está en
**[`Documentacion_Simulador_Invocadores.md`](Documentacion_Simulador_Invocadores.md)**.

## Estado actual del proyecto

El simulador **todavía no implementa el reglamento vigente al completo**.
**[`docs/reglamento/REGLAMENTO.md`](docs/reglamento/REGLAMENTO.md)** es la
fuente de verdad de cómo se juega realmente hoy en día en mesa; el código
en `js/` implementa una versión más simple y desfasada de esas reglas
(faltan sets de invocación, la economía real de gemas, personajes y modos
de juego enteros, entre otras cosas). El listado detallado y actualizado de
qué falta por implementar, como bloques de trabajo concretos, vive en
**[`docs/MEJORAS_FUTURAS.md`](docs/MEJORAS_FUTURAS.md)** (y de forma
resumida en `CLAUDE.md`). Los problemas de calidad de código (bugs,
deuda técnica) en vez de reglas del juego están en
**[`docs/DEUDA_TECNICA.md`](docs/DEUDA_TECNICA.md)**.

## Historial de cambios

Cada cambio publicado queda registrado en **[`CHANGELOG.md`](CHANGELOG.md)**.
La versión sigue el esquema `X.Y.Z.W` (mayor / funcionalidad / corrección /
nº de commit) — las reglas exactas de cuándo sube cada número están en
`CLAUDE.md`.

## Créditos

Juego de mesa diseñado por **Adrián Jiménez Valle**
([@elmeepleazul](https://www.elmeepleazul.es)). Este repositorio es
únicamente el simulador digital de playtest, no el juego físico.

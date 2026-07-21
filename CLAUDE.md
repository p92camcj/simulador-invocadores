# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Simulador Invocadores** is a client-side web app (plain HTML/CSS/JS, ES
modules, no framework, no build step, no package manager) that simulates a
physical playtest of "Invocadores", a board game designed by Adrián Jiménez
Valle (@elmeepleazul). It runs entirely in the browser, is installable as a
PWA (`manifest.json` + `service-worker.js`), and is meant to be played
around a table with each participant looking at the same shared screen
(there is no networking yet — see "Future direction" below).

## ⚠️ Read this before touching game logic

**The code and the rulebook are not currently in sync.** `docs/reglamento/REGLAMENTO.md`
is the source of truth for how the game is actually meant to be played today;
`js/*.js` implements an older, simplified prototype of the rules. Known gaps
as of the last audit (2026-07-19), updated after implementing turn-sequence
Fase B and the real Gem economy (also 2026-07-19 — see `CHANGELOG.md` for
the version that shipped this):

- Missing characters entirely: **Entusiasta** (not in the deck at all — it's
  the optional expansion described in "Variantes y modos de juego", never
  shuffled in by default) and its passive ability (lose a Gem on a
  successful invocation). **Animales** (Reena, Sora, Lumo) *are* now in the
  deck, but only when the `introductorio` invocation set is selected (see
  `game.js`). **Not** for `floral`: floral reuses the exact same "Modo
  normal" deck as the `normal` set (32 cards) — it isn't a third deck
  variant, it only renames/recombines the invocation cards
  (`INVOCATION_SETS.floral`). Floral's required characters (Ocultista,
  Centinela, Maestro, Clarividente, ...) don't even exist in the
  introductorio deck, so grouping floral with introductorio for deck
  purposes made its invocations uncompletable — a real bug that shipped in
  `1.4.0.26` and was fixed in the very next version, see `CHANGELOG.md`.
  So: `game.js`'s deck is **32 cards for `normal` and `floral`**, **41 for
  `introductorio`** — not the 43-card full component count, which is total
  physical cards across all modes, not what goes in a single deck.
- Missing modes: Introductorio (as a full selectable deck-prep variant, not
  just its invocation set), Avanzado, Experto (with the central autómata),
  the 2v2 team variant, and the Entusiasta expansion. Note: today's
  `introductorio` invocation-set deck (32 base + 9 Animales = 41 cards) is
  actually closer in size/composition to what real **Avanzado** mode
  should be — real **Introductorio** mode has its own much smaller roster
  (Reena/Sora/Lumo/Pícaro/Aprendiz/Cronista/Estratega/Cronomante only, **29
  cards**, no cards set aside) that doesn't exist in code yet. See
  `docs/AUDITORIA_REGLAS.md` §1 for the exact numbers and per-mode size
  estimates (S/M/L).
- No tiebreak logic or final scoreboard at game end — this is the
  highest-priority gap of the ones tracked in `docs/MEJORAS_FUTURAS.md`,
  since it also blocks the 2v2 variant (team score needs a scoreboard to
  sum into) and it's literally how the game decides a winner.
- **Fixed 2026-07-21**: `case 'Ocultista'` in `abilities.js` used to be able
  to reveal a Centinela that the auto-hide (`ocultarOtrasCentinelas`, Fase
  A) had turned face-down, without re-triggering that auto-hide —
  reachable sequence ending with two simultaneously-visible Centinelas.
  Now fixed: after toggling visibility, if the revealed card's real
  identity (`.name`, not appearance — see the Metamorfo note below) is
  `'Centinela'`, it calls `ocultarOtrasCentinelas()` too. Full repro and
  resolution note in `docs/AUDITORIA_REGLAS.md` §3.1 and
  `docs/DEUDA_TECNICA.md` (moved to "Resueltos").
- Maestro is missing the rulebook's new **active** ability entirely (moving
  a card another player can see — their hidden-to-self card — straight to
  the Maestro's own Portal, then that player draws a replacement). The
  passive three-Gem bonus exists and its condition bug is fixed (see
  CHANGELOG), but the active ability is separate, unimplemented work.
- Metamorfo in `abilities.js` now matches the current rulebook: the old
  restriction ("only the character that completes the invocation") is gone
  — the picker offers all of `PERSONAJES_NO_ANIMALES` (`utils.js`) minus
  Metamorfo itself, any time on the player's turn, independent of `need` or
  what's still in the deck. The transformation was already persistent in
  practice (nothing in the codebase ever reverted `stack.at(-1).name` back),
  it just hadn't been exercised because the old restriction made most
  transformations unreachable.
- **Fixed 2026-07-21 (DEUDA_TECNICA.md item 14)**: the transformation used
  to overwrite `stack.at(-1).name = v` directly, so a transformed Metamorfo
  was treated as the real imitated character everywhere `.name` was
  compared — including Centinela protection, Ocultista's own restriction,
  and passive bonuses, none of which the rulebook's interpretation note
  allows apparence to trigger. Card objects now carry two separate fields:
  `.name` (real identity, never overwritten — stays `'Metamorfo'` forever)
  and `.aspecto` (the imitated character, set by `case 'Metamorfo'`).
  Protection/restriction/passive-bonus checks (`jugadoraProtegidaPorCentinela`,
  `estaProtegidoParaActivar`, `esCentinelaVisible`, `ocultarOtrasCentinelas`,
  Clarividente, Pícaro's bonus, the Maestro bonus rewritten in `actions.js`
  to scan for a real `.name === 'Maestro'` instead of reusing the
  aspecto-based invocation `map`) all read `.name`. Invocation-combo
  fulfillment/Gem distribution (`actions.js`) and everything rendered on
  screen (`mostrarCarta()` in `utils.js`, `cartaImgHtml()` calls in
  `render.js`) read `card.aspecto || card.name` instead — a transformed
  Metamorfo's card art already shows the imitated character (it just
  doesn't have the "psst, it's really a Metamorfo" overlay badge yet, see
  `docs/MEJORAS_FUTURAS.md`). The one deliberate exception:
  `opcionesActivarHabilidad()` (`utils.js`) labels the Fase-B ability menu
  with real identity, not appearance — clicking that option always
  triggers Metamorfo's own re-transform ability, never the imitated
  character's, so the label has to say so.
- Modo Experto's 4th invocation ("Asterisco"/Madain, 4 characters incl.
  Metamorfo + all 3 Animales) is defined as `INVOCATION_ASTERISCO` in
  `utils.js` but deliberately **not** wired into any real game flow yet.

Do not assume any given piece of game logic is correct just because it's
already in the code — check it against `docs/reglamento/REGLAMENTO.md`
first. When you fix or extend a rule, update both the code and, if the
rulebook text itself changes, the rulebook doc in the same commit.

## Architecture

No backend, no database — all state lives in memory in the browser tab as
plain JS objects hung off `window` (`window.players`, `window.neutrals`,
`window.deck`, `window.levelIdx`, `window.turn`, `window.played`,
`window.habilidadUsadaEsteTurno`, `window.invocationSet`, `window.LEVELS`,
`window.INVOCATION_SETS`). Refreshing the page loses the game. This
global-state pattern is deliberate for a small single-file-per-concern app,
but it means **module-local variables of the same name (e.g. a bare
`levelIdx`) do not exist unless explicitly imported — always reference
`window.levelIdx` etc. outside of the module that owns the constant.** A
previous bug (`ReferenceError` on every ability use) came from exactly this
mistake — see `CHANGELOG.md` entry `1.3.1.22`. A second instance
(`window.picker`, never actually assigned, called from the now-removed
`gestionarMetamorfos()` in `utils.js`) was fixed by deleting that function
entirely — Metamorfo activation is now unified into the same Fase B flow as
every other ability (see below), so the broken call site no longer exists.

Turn sequence is split into two independent, explicit steps (Fase A / Fase
B in the rulebook's "Secuencia del turno"): playing a card
(`#btnPlay`/`btnCtrlPlay` in `actions.js`) never auto-triggers an ability
anymore. Activating an ability is a separate action (`#btnAbility`) the
active player may use **at most once per turn**, on either the top card of
one of their own Portals (free) or a central/neutral Portal (costs 1 unit
Gem, or free by revealing a previously-earned asterisk Gem) —
`window.habilidadUsadaEsteTurno` tracks the once-per-turn limit and is reset
in `nextTurn()`.

- **`index.html`** — the single page/shell. Loads `style.css`, registers the
  service worker, and loads `js/index.js` as an ES module plus
  `js/pwa-install.js` and `js/version-check.js` as plain scripts.
- **`js/index.js`** — entry point. Initializes the global `window.*` state,
  exposes `LEVELS`/`INVOCATION_SETS` on `window`, and calls `initSetup()` on
  `DOMContentLoaded`.
- **`js/setup.js`** — the player-count (2-5)/name-entry/invocation-set
  screen. Builds `window.players` / `window.neutrals` (Portal distribution
  by player count lives here, matching the rulebook's table for 2-5
  players), reads `window.invocationSet` from `#selInvocationSet`, gives
  each player their starting 3 unit Gems, and calls `initGame()`. Also
  handles the "Autómatas (bots)" field (0..player count, validated): the
  last `nBots` name slots become read-only autómata names (from
  `bot.js`'s `nombresDisponiblesParaBots()`), the rest stay editable human
  inputs; each `window.players[i]` gets `tipo: 'humano'|'auto'` (plus
  `dificultad: 'normal'` for bots — the only level this MVP implements, see
  `js/bot.js`).
- **`js/bot.js`** — autómata ("bot") decision logic, added 2026-07-21. No
  decision function ever reads `players[botIdx].hand`/`window.deck`
  directly — everything starts from `construirEstadoVisibleParaBot()`, a
  sanitized view (own known card only, no own hidden card, any other
  player's public hidden card, per-Portal visibility, Gem counts) so it's
  auditable at a glance that the bot can't cheat even as the heuristic
  changes. `decidirYJugarTurno(players, neutrals, botIdx, contexto)` is the
  single entry point, dispatching on `players[botIdx].dificultad`
  (`HEURISTICAS_POR_DIFICULTAD`, only `'normal'` exists today) — it reuses
  the exact same legal actions a human uses (`window.tryPlayOnPortal`,
  `applyAbility()`, a simulated click on `#btnEndTurn`), including
  programmatically resolving whatever `picker()`/`pickerPortal()` modal
  `applyAbility()` opens (same `#pickerSelect`/`#pickerOk` a human click
  would use) — it never duplicates rules logic. The `'normal'` heuristic
  only ever activates Ocultista or Cronista in Fase B (Estratega,
  Cronomante, Aprendiz, Metamorfo are deliberately left for future,
  harder difficulty levels — see `docs/MEJORAS_FUTURAS.md`).
- **`js/game.js`** — builds the character deck (`initGame`, sized and
  composed per `window.invocationSet`, see the gap above), turn advancement
  and the "no cards left" end condition (`nextTurn`), and end-of-game
  handling (`finalizarPartida`, `resetJuego`). `finalizarPartida` must stay
  `export`ed — it's called from `actions.js`. `nextTurn()` also branches on
  `current.tipo === 'auto'`: hides the human action buttons and, after a
  short `setTimeout`, calls `bot.js`'s `decidirYJugarTurno()` — which ends
  its own turn by clicking `#btnEndTurn`, so consecutive bot turns chain
  automatically until a human player is up.
- **`js/actions.js`** — wires up the UI controls: card selection, playing a
  card onto a Portal (Fase A only — the one exception is Centinela's
  passive auto-hide effect, see below, which fires right here as a direct
  side effect of `stack.push(...)`, not as an ability), the "Activar
  habilidad" button (Fase B: picks a source Portal, charges the central-Portal
  Gem cost if applicable, then calls `applyAbility`), and the "end turn"
  button, which also runs the invocation-success check and the real Gem
  distribution (drawing from `INVOCATION_SETS[...].gemas` via
  `construirPoolGemas`).
- **`js/abilities.js`** — `applyAbility(name, ownerIdx, stack, players, neutrals, levelIdx, need)`,
  one `switch` case per character ability activated via Fase B (Ocultista,
  Cronista, Cronomante, Estratega, Aprendiz, Metamorfo — exactly
  `PERSONAJES_CON_HABILIDAD` in `utils.js`). Centinela and Clarividente are
  deliberately **not** cases here: both are passive/automatic, so there's
  no reachable `case 'Centinela'`/`case 'Clarividente'` in this `switch` —
  don't add one back. Centinela's actual logic lives in the exported
  `ocultarOtrasCentinelas(stackJugada, players, neutrals)` (also in this
  file), called directly from `actions.js` right after `stack.push(...)` in
  Fase A, every time the played card is a Centinela — not through
  `applyAbility()`. `need` is the active invocation's required-character
  array; pass it explicitly from the caller, don't recompute it here from
  globals. It's currently unused by every case (Metamorfo dropped its use
  of it — see the rulebook-sync note above) but stays in the signature for
  Modo Experto's future Asterisco invocation. Always call this with
  `window.levelIdx` explicitly from outside the module.
- **`js/render.js`** — pure-ish DOM rendering (`render()`, which draws the
  single interactive board grid into `#boardGrid` — one column per player
  in fixed index order plus a final "Neutrales" column, always with real
  visibility rules, never an "everything visible" mode) and the generic
  `picker()` modal used by several abilities, plus `pickerPortal()` (same
  modal, but also lets the matching Portal in the grid itself be clicked as
  an alternative — used by the ability cases that target a Portal:
  Ocultista, Cronista, Cronomante's first picker, Estratega's both
  pickers). Does not own game state. A column's own "visible" hand card
  (owner-only) only ever renders for a HUMAN active player
  (`esHumanaActiva = esActiva && p.tipo !== 'auto'`) — an autómata never
  has "its own screen" watching this single shared display, so it's always
  treated like a non-active player's hand (only its public "oculta" card
  shows, no click/drag handlers), even on its own turn. Same flag gates the
  exact-Gem-total breakdown vs. the by-level-only one.
- **`js/utils.js`** — constants (`LEVELS`, `INVOCATION_SETS`,
  `INVOCATION_ASTERISCO`, `PERSONAJES_CON_HABILIDAD`,
  `PERSONAJES_NO_ANIMALES`, `iconos`) and
  stateless helpers (`shuffle`, `draw`, visibility helpers, the Gem-economy
  helpers `sumaGemas`/`gastarGemaUnitaria`/`gastarGemaAsterisco`/
  `pagarActivacionPortalCentral`/`construirPoolGemas`). This is where the
  rulebook gaps above are most visible — start here when bringing a rule up
  to date. `player.gems` is an array of `{ valor, nivel, esAsterisco? }`
  objects, not a plain number — see the Gem-economy helpers for how to
  read/spend it.
- **`js/pwa-install.js`** / **`service-worker.js`** / **`manifest.json`** —
  PWA install prompt and offline caching. Not game logic.
- **`js/version-check.js`** — reads `version.json`, shows the current
  version in the corner, and compares against the latest GitHub release to
  show an "update available" banner (see Versioning below for how the
  comparison works).

## Docs worth reading before larger changes

- **`docs/reglamento/REGLAMENTO.md`** — the current rulebook, source of
  truth for game rules. Images in `docs/reglamento/img/` are rasterized
  pages from the original PDF, kept for visual reference; the Markdown text
  is what's authoritative and editable.
- **`Documentacion_Simulador_Invocadores.md`** — function-level reference
  for each `js/` module (what each export does). Update it when you add,
  rename, or remove an exported function/constant.
- **`docs/DEUDA_TECNICA.md`** — known code-quality problems (bugs, latent
  fragility, duplication, missing tests) as opposed to rulebook gaps.
- **`docs/MEJORAS_FUTURAS.md`** — backlog of new scope: catching up with
  the rulebook, the future networked-multiplayer direction, and UX ideas.
- **`docs/AUDITORIA_REGLAS.md`** — point-in-time audit (2026-07-20)
  cross-referencing the rulebook against the real code, with size
  estimates (S/M/L) per missing mode/character and a deep dive into
  ability-interaction edge cases (Centinela protection, Cronomante state
  across turn/game boundaries, Metamorfo identity surviving being moved by
  other abilities, Clarividente + Aprendiz). Where it disagrees with a
  summary above, trust the audit — it was produced by reading the actual
  code, this summary is prose that can drift.
- **`CHANGELOG.md`** — full version history.

## Regla de prioridad: deuda técnica antes que alcance nuevo

Los ítems de prioridad **alta o media** de `docs/DEUDA_TECNICA.md` van
antes que cualquier bloque nuevo de `docs/MEJORAS_FUTURAS.md`, salvo que el
propietario del proyecto indique explícitamente lo contrario para una
tarea concreta. Ante la duda de qué atacar primero en una sesión sin
instrucción específica, esta es la regla por defecto.

## Keep the rulebook and module docs in sync

If a task changes game behavior described in `docs/reglamento/REGLAMENTO.md`
or the function catalog in `Documentacion_Simulador_Invocadores.md`, update
the relevant section in the same commit. Both docs should always reflect
the real state of the game/code — don't let them drift like the rulebook
and the code have until now.

## Keep documentation "last updated" headers current

Any doc in this repo with a header line like "Última actualización: ..."
(currently `docs/reglamento/REGLAMENTO.md`) must have that date/time updated
every time the file is edited, however small the change. Use date **and**
time, in `Europe/Madrid`, taken from the real system clock at the moment of
the edit — never invented or copied from a previous edit. If a new document
with this kind of header is created in the future, this rule applies to it
from its first version.

## Commands

No build/lint/test tooling — this is plain static HTML/CSS/JS. Verification
is manual: open `index.html` (or serve the folder locally) and play through
the scenario being changed.

```bash
git add -A
git commit -m "..."
git push
```

Deployment is presumed to be GitHub Pages serving directly from `main` (no
build step needed) — confirm this with the project owner if setting up CI,
since there's no workflow file in the repo yet.

## Version bump + changelog (mandatory on every shipped code change)

Whenever a task's changes are committed and pushed (i.e. it touched anything
under `js/`, `index.html`, `style.css`, `manifest.json`, or
`service-worker.js`):

1. Bump the version in `version.json` (the single source of truth,
   read dynamically by `js/version-check.js`), following the versioning
   rules below. For `W`, run `git rev-list --count HEAD` **right before
   committing** and use that literal number — don't compute or increment it
   yourself.
2. Add a new entry to `CHANGELOG.md` at the repo root with that version, the
   date, and what changed.
3. **Also add the equivalent entry to `NOVEDADES.md`, in the same commit.**
   `NOVEDADES.md` is the in-app "what's new" modal shown when a player
   clicks the version number or the update banner (`js/version-check.js`,
   `abrirNovedades()`) — it must stay in sync with `CHANGELOG.md` the same
   way the rulebook and `Documentacion_Simulador_Invocadores.md` must stay
   in sync with the code (see "Keep the rulebook and module docs in sync"
   above). Same header format (`## X.Y.Z.W - YYYY-MM-DD` followed by short
   bullets), but written for a player, not a programmer: **no file names,
   function names, or code jargon** — synthesize what changed and why it
   matters to someone playing, don't translate the technical changelog
   entry line by line, and don't invent changes that aren't in the real
   `CHANGELOG.md` entry.
4. If you cut a GitHub Release for a milestone, tag it `vX.Y.Z` (no `W` —
   releases are compared against `version.json` ignoring `W`, see
   `js/version-check.js`).

### Reglas de versionado (`version.json`, formato `X.Y.Z.W`)

- **W**: no se incrementa manualmente. Justo antes de cada commit, ejecuta
  `git rev-list --count HEAD` y usa ese número literal — no lo calcules de
  memoria ni lo incrementes tú mismo, usa siempre el valor real que
  devuelva el comando en ese momento.
- **Z**: incrementa cuando la tarea es una corrección o mejora interna sin
  funcionalidad nueva visible (la mayoría de las tareas de deuda técnica,
  como cerrar el desfase con el reglamento).
- **Y**: incrementa cuando la tarea añade una funcionalidad nueva visible
  para el usuario (p. ej. implementar un modo de juego nuevo); al subir Y,
  reinicia Z a 0.
- **X**: nunca lo incrementes salvo que el usuario lo indique explícitamente.

Si tienes dudas sobre cuál de los tres (X, Y, Z) corresponde a una tarea
concreta, pregúntalo antes de decidir por tu cuenta.

## Future direction (context, not yet implemented)

The long-term goal is a multiplayer digital version where each player uses
their own phone, joining a "room" either over the same Wi-Fi network or via
a small hosted server. Nothing in the current codebase supports this yet —
today's app assumes one shared screen and trusts every player to look away
during hidden-card moments. Keep this in mind when making architectural
decisions (e.g. don't couple game logic too tightly to direct DOM
manipulation if it can reasonably be avoided), but don't build networking
speculatively until it's actually scoped.

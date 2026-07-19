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
as of the last audit (2026-07-19):

- No selection of invocation **sets** (introductorio / normal / floral); the
  code hardcodes one generic combo per level (`COMBOS.C/B/A` in `utils.js`).
- Gem rewards are a flat number per level (`REWARD = { C:1, B:2, A:3 }`)
  instead of drawing a real, randomly-assigned gem of the values described
  in the rulebook's Components/Secuencia de juego sections. There is no
  "Gema unitaria" economy (paying a value-1 gem, or a previously-earned
  lowest-value gem, to use a central Portal's ability).
- Missing characters entirely: **Entusiasta**, **Animales** (Reena, Sora,
  Lumo).
- Missing modes: Introductorio, Avanzado, Experto (with the central
  autómata), the 2v2 team variant, and the Entusiasta expansion.
- Portal distribution by player count doesn't match the rulebook's table for
  3/4/5 players (see `setup.js`).
- Maestro's bonus condition checks the wrong thing (whether Pícaro is part
  of the current combo, not whether any Pícaro is visible anywhere on the
  table) and is hardcoded to level `'A'` only.
- No tiebreak logic or final scoreboard at game end.

Do not assume any given piece of game logic is correct just because it's
already in the code — check it against `docs/reglamento/REGLAMENTO.md`
first. When you fix or extend a rule, update both the code and, if the
rulebook text itself changes, the rulebook doc in the same commit.

## Architecture

No backend, no database — all state lives in memory in the browser tab as
plain JS objects hung off `window` (`window.players`, `window.neutrals`,
`window.deck`, `window.levelIdx`, `window.turn`, `window.played`,
`window.LEVELS`, `window.COMBOS`, `window.REWARD`). Refreshing the page
loses the game. This global-state pattern is deliberate for a small
single-file-per-concern app, but it means **module-local variables of the
same name (e.g. a bare `levelIdx`) do not exist unless explicitly imported —
always reference `window.levelIdx` etc. outside of the module that owns
the constant.** A previous bug (`ReferenceError` on every ability use) came
from exactly this mistake — see `CHANGELOG.md` entry `1.3.1.23`.

- **`index.html`** — the single page/shell. Loads `style.css`, registers the
  service worker, and loads `js/index.js` as an ES module plus
  `js/pwa-install.js` and `js/version-check.js` as plain scripts.
- **`js/index.js`** — entry point. Initializes the global `window.*` state,
  exposes `LEVELS`/`COMBOS`/`REWARD` on `window`, and calls `initSetup()` on
  `DOMContentLoaded`.
- **`js/setup.js`** — the player-count/name-entry screen. Builds
  `window.players` / `window.neutrals` (Portal distribution by player
  count lives here — see the gap noted above) and calls `initGame()`.
- **`js/game.js`** — builds the character deck (`initGame`), turn
  advancement and the "no cards left" end condition (`nextTurn`), and
  end-of-game handling (`finalizarPartida`, `resetJuego`). `finalizarPartida`
  must stay `export`ed — it's called from `actions.js`.
- **`js/actions.js`** — wires up the UI controls: card selection, playing a
  card onto a Portal, ability confirmation, and the "end turn" button, which
  also runs the invocation-success check and gem distribution.
- **`js/abilities.js`** — `applyAbility(name, ownerIdx, stack, players, neutrals, levelIdx)`,
  one `switch` case per character ability (Ocultista, Centinela, Cronista,
  Cronomante, Estratega, Aprendiz, Metamorfo). Always call this with
  `window.levelIdx` explicitly from outside the module.
- **`js/render.js`** — pure-ish DOM rendering (`render()`) and the generic
  `picker()` modal used by several abilities. Does not own game state.
- **`js/utils.js`** — constants (`LEVELS`, `COMBOS`, `REWARD`, `iconos`) and
  stateless helpers (`shuffle`, `draw`, visibility helpers, Metamorfo
  negotiation flow). This is where the rulebook gaps above are most visible
  — start here when bringing a rule up to date.
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
- **`CHANGELOG.md`** — full version history.

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
3. If you cut a GitHub Release for a milestone, tag it `vX.Y.Z` (no `W` —
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

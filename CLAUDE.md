# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Feestrun: four single-file browser games (canvas + Web Audio, no dependencies, no bundler) built
for the webshop J-Martens.nl. Platformer, flappy, snake and tetris, each with three levels of
rising difficulty. All player-facing text is Dutch and the visual identity is fixed
(Grandstander/Roboto, red `#D20000`, the real logo in `src/img/`).

This repo has a **GitHub remote** (`marvinm2/feestrun-jmartens`, currently private, served via
GitHub Pages from `docs/` on `main`) even though it sits inside the private `Prive/` tree. Treat it
as public: nothing from the household documents may end up here. English for code and commits,
Dutch for anything a player or the shop owner reads (UI strings, `LEESMIJ.txt`, README).

## Commands

```
python3 build_site.py                                            # concatenate src/*.part → artifact.html + dist/
node --test tools/test/static.test.js tools/test/levels.test.js  # quick suite (~2 min): shape, maps, every level playable
node --test tools/test/solver.test.js                            # slow (minutes): platformer maps proven + replayed
node tools/solve_final.js [SEGS_P2]                              # solver report for all (or one) platformer map
```

Always build before testing: the harness refuses a stale `artifact.html`. There is no linter or
dev server; to play a build, serve `dist/feestrun-jmartens/feestrun/` over HTTP (e.g.
`python3 -m http.server`) and open `index.html`, or use the GitHub Pages site after a push. Fonts come from Google Fonts.

## Build pipeline (build_site.py)

The game is written as fragments in `src/` concatenated **in this fixed order**: `head.part`
(HTML + CSS + markup), `js1.part` (shared: constants, categories, audio, music, effects, drawing
helpers, shared state), `segs.part` (platformer maps), `levels.part` (`GAMES`, `LEVELS`,
`FIXED_GAME`), `js2_platform`, `js3_flappy`, `js4_snake`, `js5_tetris`, `js6_flow.part` (game
loop, input, navigation, boot). Everything after `head.part` lives inside one `<script>` IIFE, so
the parts share one lexical scope. `levels.part` references `SEGS_*` at parse time, so it must
follow `segs.part`.

Outputs from that one concatenation:

1. `artifact.html` – the raw join with `FIXED_GAME=null`: all four games on one page with a game
   switcher in the nav bar. Keeps the `window.claude.hot` hooks and the `window.__feest` debug
   handle (used by the test harness).
2. `dist/…/feestrun/<game>.html` – one page per game. The build replaces the single
   `const FIXED_GAME=null;` line with the game id (asserted exactly once) after stripping the
   artifact-only lines (asserted: no `window.claude` or `__feest` survives).
3. `dist/…/feestrun/<game>-embed.html` – iframe version. Site chrome (top bar, brand bar, level
   cards, USP row, footer) is removed by regexes that each **must match exactly once**; if you
   restructure those blocks in `head.part`, update `EMBED_STRIP` in `build_site.py`.
4. `dist/…/feestrun/index.html` – the hub: the `<style>` block of `head.part` plus the static
   `src/hub.part`. The build asserts every page the hub links to exists.

`LEESMIJ.txt` (upload instructions for the shop owner) is an inline string in `build_site.py`
with hand-maintained `VERSION`/`DATE`. The zip is rebuilt with fresh timestamps every run, so it
shows as modified after every build; commit it only when the content changed.

## Runtime architecture

**Games and levels (`levels.part`).** `GAMES` is the list of four games; each has `id`, `name`,
`style`, `type` (mode key), `song/bpm/tr`, `hint`, `blurb` and three `levels`, each with `name`,
`sub` (makkelijk/gemiddeld/moeilijk), a `diff` object of difficulty knobs, and for the platformer
`segs` + `night`. `LEVELS` is the flat list the flow code uses (game fields merged with level
fields, plus `game`, `gi`, `li`). `ACTIVE_GAMES` is one game when `FIXED_GAME` is set.

**Difficulty knobs** are read by each mode in `init()` from `LV.diff` into a module-level `D`:
platformer `enemySpd`, `moverRate`; flappy `gapH`, `gapStep`, `gapMin`, `gateDx`, `speed0`,
`speedInc`, `speedMax`; snake `speed0`, `speedMin`, `pinsPerItem`, `coinEvery`; tetris
`interval0`, `intervalMin`, `intervalStep`, `lockDelay`, `garbage`. `static.test.js` asserts they
are monotonic across the three levels. Physics constants (`G`, `JUMP`, …) are **not** per level.

**Shared state in `js1.part`.** `state` (`title`/`play`/`win`/`over`), `lvIdx`, `LV`, `MODE`,
`lives`, `coinsGot`, `collected`, `items[]`, `tot`, `keys{l,r,u,d,j}`, `deadT`, `invT` and the
particle/shake state are module-level `let`s shared by all modes. Modes call the shared
`collectItem`, `collectCoin`, `die` and `afterDeath` rather than touching these directly; `win()`
in `js6` builds the receipt from `items` and `MODE.stats()`.

**Mode interface.** Each mode file returns an object registered in `MODES` in `js6`:

- `buttons` – touch buttons `{id,label,side:'l'|'r',cls?}`
- `init()`, `respawn()`, `step()` (fixed 60 Hz), `draw(tick)`
- `key(code,down)`, `touch(id,down)`, optional `tap()` for canvas taps
- `stats()` – `[label, value]` pairs for the receipt
- `debug()` – internal state for the harness/bots (`P,L` / `F` / `SN` / `TZ` plus constants)

**Flow (`js6`).** `play(idx,fresh)` resets shared state, calls `MODE.init()` and `renderNav()`;
`restart()` and `nextOrAgain()` stay within the current game (after level 3 they wrap to level 1
of the same game). All keyboard input goes through `onKey(code,down)`, which the harness also
calls. The hot-reload snapshot stores `{game, li}`.

**Platformer maps (`segs.part`).** `SEGS_P1/P2/P3` are arrays of screen-wide segments, each up
to 17 rows of 30 characters (tile 32 px, 960×544 canvas). Legend:

| char | meaning |
|---|---|
| `#` | solid block |
| `-` | one-way platform (jump through from below) |
| `^` | pins (lethal) |
| `@` | player start |
| `o` | coin ("ballonnetje") |
| `0`–`9` | category card, index into `CATS` (each exactly once) |
| `S` | spring |
| `P` | patrolling enemy |
| `M` / `N` | horizontal / vertical moving platform (deterministic phase `index·π/2`) |
| `F` | checkpoint flag |
| `K` | kassa (level exit) |

Segments are not composable across maps (a segment's edge completes its neighbour), so edit in
place. After editing a map or the physics: build, then `node tools/solve_final.js`.

## Test harness (`tools/`)

- `harness.js` runs the built script in a `vm` context with a stubbed `document`, canvas
  `Proxy`, inert timers and a seeded `Math.random`, and returns `window.__feest`
  (`play`, `step`, `draw`, `keys`, `key`, `debug`, `LEVELS`, `GAMES`, getters). Bots read plain
  objects only; never use `instanceof` or `deepEqual` on values from the vm (other realm).
- `bots.js`: flappy plans exact flap frames per gate with a layered (frame, height, speed) search;
  snake BFSes to the food/kassa with a flood-fill survival fallback; tetris scores every
  rotation×column (lines, height, holes, bumpiness) and hard-drops; `platformReplay` feeds a
  solver input sequence through `onKey`.
- `solver.js` duplicates the platformer physics of `js2_platform.part` step for step (movers and
  enemies are precomputed from the frame number) and searches goal by goal (cards by x, then the
  kassa) with a proximity-weighted heuristic. **Any change to the physics or the step order in
  `js2` must be mirrored there**; `solver.test.js` replays the route in the real game and fails
  on the first diverging frame.

## Conventions specific to this repo

- Category ids in `CATS` double as image filenames (`src/img/<id>.jpg`, 320×320);
  `logo-origineel-*` is source material and is excluded from `dist/`.
- Keyboard: arrows/WASD move, Space/Z jump or flap or hard-drop, R restarts, M mutes, Enter
  advances overlays. Touch buttons only show on coarse pointers.
- All sound is synthesised in Web Audio (no audio files); the `AudioContext` is created on the
  first user gesture.

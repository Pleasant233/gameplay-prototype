# 灵地复苏 — project instructions

## Product and current direction

- Answer the owner in Chinese. This is a single-player, offline tile placement game: placement and tile combinations increase the score and produce resources.
- Preserve the bright cartoon miniature landscape. Terrain transitions reference Civilization/TerraScape; rounded, readable cloud masses surround the map instead of extra green land. Bloom and aperture depth of field reference Tiny Glade.
- Keep the existing square grid and gameplay unless a task explicitly changes them. Do not interpret visual references as instructions to copy assets or convert the grid to hexagons.
- Start with `docs/PROJECT-CONTEXT.md`, `README.md`, and the relevant source. The owner's local Claude memories and plan are not available in cloud tasks; the handoff in the repository replaces that dependency.

## Architecture

- Pure static HTML/JavaScript, no build step, backend, runtime npm dependencies, or runtime CDN. Three.js r128 is vendored in `lib/`; retain its license.
- `data.js`: definitions, recipes and rule parameters. `game.js`: deterministic state, actions, scoring and receipt events; can run under Node without a browser.
- `view.js`: Three.js terrain, cartoon models, clouds, picking and transient effects. `postfx.js`: render targets, bloom, depth of field and quality fallback. `tokens.js`: DOM resource flights and delayed HUD counters. `index.html`: UI, action dispatch and synthesized sound.
- Keep gameplay mutation in `game.js`; effects and delayed counters must settle to the authoritative state. Browser-test probes are injected into requests, never shipped as debug APIs.

## Setup and commands

- Node.js 24 is recommended (`.nvmrc`), Node.js 22+ and Python 3.10+ are required for tooling. There is no production build command.
- Linux/Codex setup: `bash .codex/setup.sh`. This installs pinned Python test tools in `.venv`, Chromium and Linux browser libraries, then runs fast checks and a real WebGL smoke test.
- Start a preview: `npm run dev`, port 8080 on `0.0.0.0`. Browser tests start and stop their own localhost servers.
- `npm test`: JavaScript syntax, game rules, whole-game simulations, continuous terrain and cloud geometry.
- `npm run test:smoke`: quick browser/WebGL initialization check.
- `npm run test:ui`: desktop/mobile input, selection, particles, resource flights, HUD and cleanup.
- `npm run test:crystal`: ordinary and large crystals, AP, stock and round invariants.
- `npm run test:atmosphere`: rendered bloom/DOF comparisons, focus, quality tiers, resizing and depth fallback.
- `npm run test:browser`: the three browser suites sequentially; `npm run test:all`: fast tests followed by all browser suites. Do not run software WebGL browser suites in parallel.
- The Node wrapper selects `.venv` without needing shell activation. Default browser is Playwright's bundled Chromium. To use an installed Windows Edge, set `PLAYWRIGHT_BROWSER_CHANNEL=msedge`.
- Screenshots and JSON reports go in ignored `artifacts/`. Test failures must remain failures; fix the cause instead of suppressing assertions or skipping software WebGL.

## Acceptance and delivery

- Run `npm test` after code changes. For UI/rendering changes, run the affected browser suite and inspect desktop/mobile screenshots; JavaScript syntax alone does not verify visuals. For rules affecting the UI, also run the relevant browser test.
- Crystals are free: ordinary +1 and large +2 to the selected element, consuming only their matching inventory; no AP, placement or round change. Feeding/casting and other paid actions retain their own costs.
- Each round has 3 AP and must include a placement; the last AP is reserved for placement if none was made. There are 85 playable cells, initially 5. Preserve these invariants and receipt accounting unless requested otherwise.
- Keep shared terrain edges continuous in height and color, and clouds clear of all playable cells. Retain mobile quality reductions, reduced-motion behavior, target disposal and depth-texture fallback.
- Visual changes should include comparison captures and describe what was checked. Software WebGL/mobile emulation does not establish physical device performance or the owner's visual acceptance.
- Scope commits to the task and retain unrelated local work. Update concise project docs when behavior or tooling changes. Existing release reports are historical evidence; do not overwrite them with new test results.
- Normal cloud iteration produces reviewable changes or a PR. Deploy to production only when the active request authorizes it. Development/tests need no OpenAI API key or Vercel token. Do not commit local credentials, `.env*`, `.vercel/`, `.venv/`, or browser caches.
- CI is currently an example in `docs/ci-example.yml`, not an enabled workflow. Do not report it as active. Vercel publishing also checks the commit author's verified account email; see the release documentation when a deployment is requested.

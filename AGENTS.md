# AGENTS.md

Compiler from source code to Plazma Burst 2 map triggers (XML and editor text). Start with `README.md`; game facts and research: `docs/game-facts.md`; code layout: `docs/architecture.md`.

## Rules

- Commit only when the user asks. No `Co-Authored-By` lines. Small commits; docs in separate commits.
- Before every commit: lint, type check and tests pass.
- American English in code, docs and messages.
- Code style: no single-letter names, no comments, no magic values (named constants), feature flags for optional behavior.
- `~/Projects/plazma-burst-2` is a separate repo: read from it, do not edit it, except writing test maps into its `data/maps/` (never committed there). Never edit its `game/`. Never print anything from its `data/credentials.json*` or `data/netlogs/`.
- Facts about the game come from the client code, not from the community manual. When a fact is new, add it to `docs/game-facts.md` with its source.

## Stack

TypeScript on Node ≥ 22.18 (runs `.ts` directly), tests with `node:test`.

## Commands

- `npm run verify`: lint, type check, tests. Must pass before every commit.
- `npm run snapshot-opcodes`: rebuilds `src/opcodes/snapshot.json` from `plazma-burst-2/data/opcodes.js`.
- `npm run compile -- <file.ptc|file.pasm> [--run]`: compiles to `out/`; `--run` simulates.
- `npm run convert -- <map.xml> [--check] [--raw]`: turns a saved map into `.ptc`; `--check` compiles it again and compares with the map.
- `npm run site -- <login|logout|maps|pull|push|new>`: maps on plazmaburst2.com (`docs/site.md`). `push` replaces a real map: only on maps the user names.
- `npm run live-check`: runs `examples/live/*`, `examples/tutorial/*` and `examples/syntax/*` in the game (own app build in `/tmp/ptc-pb2-live`) and compares with the simulator. Opens a game window for about a minute. `-- --direct-index` and `-- --pcode` check those modes; `-- --only <name>` picks programs.
- `npm run web`: builds the web page into `site/` (deployed by `.github/workflows/pages.yml`).
- `npm run lsp` / `bin/ptc-lsp.js`: the language server; Neovim files are in `editors/nvim/`.
- `npm run emit-sample`: writes the hand-built M1 sample to `out/` (`--game-map` also writes it into `plazma-burst-2/data/maps/`).

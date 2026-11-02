# AGENTS.md

Compiler from source code to Plazma Burst 2 map triggers (XML and editor text). Plan and all research: `PLAN.md`.

## Rules

- Commit only when the user asks. No `Co-Authored-By` lines. Small commits; docs in separate commits.
- Before every commit: lint, type check and tests pass.
- American English in code, docs and messages.
- Code style: no single-letter names, no comments, no magic values (named constants), feature flags for optional behavior.
- `~/Projects/plazma-burst-2` is a separate repo: read from it, do not edit it, except writing test maps into its `data/maps/` (never committed there). Never edit its `game/`. Never print anything from its `data/credentials.json*` or `data/netlogs/`.
- Facts about the game come from the client code, not from the community manual. When a fact is new, add it to `PLAN.md` §1 with its source.

## Stack

TypeScript on Node ≥ 22.18 (runs `.ts` directly), tests with `node:test`.

## Commands

- `npm run verify`: lint, type check, tests. Must pass before every commit.
- `npm run snapshot-opcodes`: rebuilds `src/opcodes/snapshot.json` from `plazma-burst-2/data/opcodes.js`.
- `npm run emit-sample`: writes the hello sample to `out/` (`--game-map` also writes it into `plazma-burst-2/data/maps/`).

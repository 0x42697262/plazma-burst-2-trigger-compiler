# Name-shortening and map-integrity plan

Status: **design only, partly built.** This document lets a fresh session continue the work
without the prior conversation. Read it top to bottom, then check the "Already built" section
against the code before writing anything new.

## What this is

A build option that shrinks and protects a compiled program once it is in a map, in the same
category as a JavaScript minifier (terser, Closure Compiler, ProGuard): it renames and
restructures the author's own content and can verify it has not been altered after publishing. The
output runs only inside the game's own trigger interpreter.

The option name used in discussion is `--obfuscate`. The author's decisions:

- `--obfuscate` turns on **everything** at once. No per-layer sub-flags to choose.
- `--obfuscate-seed <n>` makes a build reproducible; a new seed per release also changes all
  generated names so two releases do not line up.
- The integrity check **reports visibly** (the map clearly stops working when a protected trigger
  is changed by someone else).
- The **web page offers it too** (a checkbox plus a seed field, mirroring `--name-seed`/`--replace`).
- The private build record (`.build.json` / the source map) maps the short names back to the
  source, for the author's own debugging.

## Who this helps

| Who | What they can do | What helps |
|---|---|---|
| A player in a match | read the map file, watch it run in the dev console or a simulator; **cannot change the map** | layers 1–5 and secrets; this is the common case (keeps the map unreadable and stops cheating by running triggers directly) |
| Someone republishing the map | copy the whole map and **change it**: remove a password check, remove the credit/license line, republish as their own | the integrity layer, so such edits break the map visibly |

The author treats the second case as partially defensible: the goal is that a casual editor cannot
quietly strip credit or checks and republish, not that the map is unbreakable.

## What a build cannot hide (state this plainly in the docs)

- **Action type numbers** stay in the map. Grouping actions only hides *which* trigger does what.
- **Object uids** (doors, regions, characters) and their positions stay visible.
- **What players see**: text must be readable at the moment it is shown.
- **Behavior at run time**: anyone can run the map in a simulator or the dev console and record
  which actions fire and how variables change. Shortening the map only affects *reading the file*;
  paths that never run stay unseen until something triggers them.
- The compiler is public, so the techniques are known. Each seed still gives different names and
  different jump math, so making sense of one map means studying that map, not reading a table.

## Already built (foundations to reuse, do not redo)

- **Seeded, source-independent prefix**: `seededPrefix(seed)` in `src/compiler/names.ts`, flag
  `--name-seed` (CLI) and the "name seed" field (web). Produces `#z...` names. Deterministic
  (FNV-1a with `Math.imul`).
- **In-place update across renamed builds**: `.build.json` manifest records the uids a build added;
  `--replace` removes the previous build's elements first (`removeOwned`/`replaceInMap` in
  `src/emit/merge.ts`, `names.ownsUid` in `src/compiler/names.ts`). Web keeps the per-file uid
  record in localStorage. This is what makes "recompile and update the map" work when names change,
  so renamed rebuilds already update cleanly.
- **p-code target** (`src/pcode/`, `--target pcode`): the whole program as data that a fixed set of
  triggers runs, using action 362 to jump to a handler by computed index. The index base comes from
  a trigger uid at map load (F18), so it survives host triggers placed before it. About 18x slower
  (measured, F37). This is the basis for the deepest layer and for computed-jump control flow.
- **Compile-time constants + secrets** (`src/lang/comptime.ts`, `secret const`, `env()`): values
  are worked out while compiling and only the result reaches the map. This is how encoded texts and
  fixed-but-non-obvious constants get computed without putting their inputs in the map.
- **direct-index** (`--direct-index`): element names built from pieces at run time instead of a
  scan; p-code turns this on. Relevant because shortening must keep runtime-built names consistent.

## The layers, in order

Cost is run-time overhead. Layers 1–5 together are roughly 1.5–3x; layer 6 alone ~18x.

| # | Layer | Effect | Run-time cost |
|---|---|---|---|
| 1 | Names | variables, internal names, trigger uids become short seed-derived tokens; **exports, externs and object uids stay real** | none |
| 2 | Texts | every literal stored encoded, decoded once at map start; `say` texts decoded only where used | one-time decode at start |
| 3 | Control flow | each block is its own trigger with a short uid, order shuffled; jumps go through a state variable and action 362, with the next state computed (`state * k + c`) | ~3 actions per jump |
| 4 | Action grouping | one trigger holds many skip-guarded actions; selectors computed elsewhere; one logical step split across several triggers; unused branches whose selector value never occurs | 2–12 actions per guarded action |
| 5 | Fixed-outcome checks | conditions that always resolve the same way, built from compile-time values | 2–4 actions each |
| 6 | Encoded p-code | `--target pcode` with the code text encoded | ~18x |
| — | Integrity check | see below | a few actions per trigger |

### Layer 1 — names (next concrete step; "stem renaming")

The seeded **prefix** is done. What remains is shortening the user-visible **stems** (`_count`,
`_list`, function labels) so `~zefwnq4_count~` becomes `~zefwnq4_a7~`.

Approach: do the shortening at the point names are formed, not as a substring post-pass over the
final XML (that is fragile — names appear inside concatenated text and inside element names built
at run time like `~p_list[` + index + `]~`). Options:

- Add a name map to `createNames` (or wrap it): `variable(name)`, `internalVariable(name)`,
  `triggerUid(label)` return tokens for a seeded mapping of the stem, and `elementName` /
  `elementOpening` / `stackOpening` (in `src/lang/symbols.ts`) must use the same mapped stem for
  the array base. Keep the `~...~` and `#...` marks so F9 name replacement still works.
- Must NOT rename: `export` names and their uids (host map depends on them), `extern` host names,
  and object uids (user-chosen, `#door*1`). `ownsVariable`/`ownsUid` must still recognize owned
  names after shortening (they match on the prefix marks, which are preserved).
- Fresh/continuation labels are already short and non-descriptive; leave them or fold into the seed.

Gotchas:
- Element names are built at run time (direct-index path and `elementName`). The base stem there
  must be the shortened one, consistently.
- Template strings (`"{x}"`) resolve to a variable's game name at compile time; that path already
  goes through `names`, so it follows automatically if the mapping is at the `names` layer.
- Number-text protection (F36) and entity escaping (F26) still apply to any emitted literals.

### Layer 2 — texts

Store each literal once, encoded (for example a per-seed character map), in a variable set at map
start, and build the shown text from it. Compile-time evaluation already does the encoding math;
the map gets only the encoded form plus a small decode routine (one array split + per-character map,
like `std/hash.ptc`'s alphabet table). Decode once into plain variables at start; `say` reads the
decoded variable. Watch the 2048-char sync limit and the 99-action trigger cap.

### Layer 3 — control flow

Reuse the p-code idea without going full p-code: give every basic block a trigger, shuffle the
order, and replace direct `363`/`switchToTrigger` jumps with "set a state variable to a computed
value, then jump by 362 to `base + f(state)`". The base is a trigger uid resolved at load (F18).
This is lower overhead than p-code because only the control transfer is indirected, not every
instruction.

### Layer 4 — action grouping (one step split across triggers)

A single game action cannot be split (it runs once with its parameters baked in), but everything
around it can be:

- its **inputs** are built in pieces by several triggers;
- **whether it runs** is a selector in a grouping trigger (a row of skip-guarded actions, the same
  shape the compiler already uses for object-array dispatch — 2 actions per guarded element);
- **where control goes next** is a computed 362 jump.

So no single trigger holds a whole logical step. Add branches whose selector value never occurs;
they are indistinguishable from real-but-rare branches without running them.

### Layer 5 — fixed-outcome checks

Conditions computed at compile time that always take the same branch but read like real checks.
Cheap; built from compile-time constants.

### Integrity check (reports visibly)

Make the triggers depend on each other so a later edit to one is detectable, the way a checksum
detects a changed file:

- **Positions**: 362 jumps are offsets from a base uid; adding or removing a trigger in the block
  shifts everything, so jumps land wrong.
- **A running check value**: each trigger mixes something into a state variable as it runs; later
  triggers compute selectors/jump targets from that state. Remove or change a trigger and the state
  is wrong downstream.
- **Committed values**: fold a hash of the credit/license text and of the password into the check
  value, so removing the credit line or the password check changes the state the rest of the map
  needs. The value a check produces is required later, so dropping the check leaves the map broken.

Limit: a trigger cannot read its own action list, so the check covers *what ran and what values
came out*, not the literal action text. Someone who edits a comparison but keeps every value the
same is not detected. And an editor can always add a brand-new trigger that does something directly
(for example open a door with `MovableTo`); the check covers the existing triggers, not additions.

## Implementation strategy

1. One option flows through `CompileOptions` (e.g. `obfuscate: boolean` plus a seed; reuse
   `--name-seed`'s seed, or add `--obfuscate-seed`). Thread it like `target`/`directIndex` do.
2. Layers attach at natural points:
   - Layer 1 at the `Names` layer (`src/compiler/names.ts`, `src/lang/symbols.ts`).
   - Layer 2 as a lowering/codegen pass over literals, using `comptime` to precompute encodings.
   - Layers 3–5 as passes over the IR/layout (`src/compiler/lower.ts`, `src/compiler/layout.ts`)
     and/or in `src/pcode/` for the computed-jump machinery.
3. Keep exports/externs/object uids real throughout; `--into`/`--replace`/manifest already handle
   the renamed-update story.
4. Web: add the checkbox + seed field next to "replace"/"name seed" in `src/web/index.html`,
   `src/web/keys.ts`, `src/web/main.ts`, `src/web/pipeline.ts`; persist like the others.

## Testing strategy (same bar as p-code)

- **Equivalence**: a test compiles every example in `examples/{live,tutorial,syntax}` both plain
  and shortened, runs both in the simulator, and asserts identical chat, errors and user variables
  (ignore internal names). Model it on `src/pcode/pcode.test.ts`.
- **Reproducibility**: same seed → byte-identical output; different seed → different.
- **In place**: shortened rebuild with a new seed + `--replace` updates the map with no stale
  elements (manifest-driven; already works, add a case).
- **In game**: `npm run live-check` with the flag runs the shortened maps and compares against the
  simulator, like `-- --pcode`.
- **Integrity (when built)**: a test that deletes/edits one trigger in a built map and asserts the
  simulated output visibly diverges.

## Game limits to respect

- 99 actions per trigger (F33): these layers add actions; keep blocks under the cap (layout already
  splits, but grouping rows and decode routines must be counted).
- Number conversion (F36) and entity escaping (F26) apply to any emitted literal; reuse the
  existing protections.
- F9 name replacement: generated names must stay `~...~`-delimited and must not be substrings that
  collide; the mark-delimited scheme already prevents this.
- Exports/externs/object uids must keep their real names or host maps break.

## Suggested order for the next session

1. Layer 1 stem renaming (no run-time cost, immediately useful). ~2–4 h with tests and the
   equivalence harness.
2. Layer 2 texts. ~2–3 h.
3. Layers 3–5. Each a pass; measure cost in the simulator as you go.
4. Integrity check last — it is the most invasive and ties the other layers together, so it is
   easiest once the structure from layers 3–4 exists.

# Architecture

```
source ──parse──► AST ──generate──► IR ──loop guard──► IR ──lower──► actions + labels ──layout──► triggers ──emit──► XML / text
```

| Stage | Code | Job |
|---|---|---|
| Opcode table | `src/opcodes/` | Snapshot of the editor's `lib_params.js` (531 actions: number, alias, param kinds; map element parameters, value lists, engine mark types and the editor's per-element rules) plus compiler flags: template-replaced params (F9, F15), how skips compare (F8, F19), avoided actions (F6) |
| Front end: language | `src/lang/` | `.ptc`: lexer, parser (AST in `ast.ts`), code generator (`codegen.ts`) with frames for locals and temporaries (`symbols.ts`) and a call graph for recursion (`calls.ts`) |
| Front end: assembler | `src/asm/` | `.pasm`: one line, one instruction or directive |
| IR | `src/compiler/ir.ts` | Labels, actions, jumps, conditional branches, calls, returns, timers |
| Loop guard | `src/compiler/guard.ts` | Counts every jump back per event and stops at the limit (F5); entries reset the count |
| Lowering | `src/compiler/lower.ts` | Branches to skip actions and switches (361/364/365/123 + 363) |
| Layout | `src/compiler/layout.ts` | Every jump target starts a trigger; blocks over 100 actions continue in the next trigger (F1) without separating a skip from what it skips; fallthrough becomes a 363; empty exits become a stop (F20) |
| Checks | `src/compiler/check.ts`, `host.ts` | Warnings: unknown targets, 362, text-format limits, XML entities (F26), host variable names inside replaced text (F9, F29) |
| Names | `src/compiler/names.ts` | Variables `~<prefix>_name~`, internal `~<prefix>:name~`; triggers `#<prefix>_label`, internal `#<prefix>:label`; with a seed, the names become short seeded tokens |
| Emitters | `src/emit/` | XML elements (grid placement, `maxcalls -1`), editor text (F12, F14), appending to a map |
| Simulator | `src/sim/` | The game's trigger runner for the actions the compiler uses, with load-time conversion (F18) and XML escaping (F26) |
| CLI | `src/cli/` | `npm run compile` |
| Map converter | `src/convert/` | `npm run convert`: saved map XML to `.ptc` (`map-file.ts` reads elements, `convert.ts` plans and writes the source, `names.ts` makes names); `check.ts` compiles the source again and `compare.ts` lists the differences from the map ([convert.md](convert.md)) |
| Language service | `src/service/` | Diagnostics, completion, hover, definitions, references, symbols; shared by the language server and the web page |
| Reference | `src/reference/` | One model of everything the language and the game offer (actions with categories and colors, parameter kinds, map objects and properties, values, engine marks, builtins, keywords), with links and search; read by the web page's sidebar and `actions-doc` |
| Language server | `src/lsp/`, `bin/ptc-lsp.js` | LSP over stdio for any editor; Neovim files in `editors/nvim/` |
| Compile-time constants | `src/lang/comptime.ts` | `const` values worked out in the simulator, `secret` checks, `env()` |
| Map blocks | `src/lang/mapblock.ts`, `src/objects/`, `src/emit/place.ts` | `map { }` runs in the simulator while compiling (constructors log the objects they create); properties are checked against the editor's tables (`properties.ts`, `value-check.ts`); `place.ts` writes new objects and rewrites existing ones in the host map |
| Standard library | `std/` | `.ptc` files for `import "std/..."` (`hash.ptc`); read by `src/cli/sources.ts`, bundled into the web page |
| P-code target | `src/pcode/` | `--target pcode`: instructions as text plus one trigger per kind of instruction ([pcode.md](pcode.md)) |
| Obfuscation | `src/obfuscate/` | `--obfuscate`: encoded texts and a start routine with the integrity check, dispatched jumps, grouped actions and fixed-outcome checks around the layout ([obfuscation.md](obfuscation.md)) |
| Tamper check | `src/tamper/` | `--tamper-check`: flow tokens on the program's own jumps (a layout control), entry checks after entry labels, `protected var` mirrors in the code generator, a watchdog timer, finding handlers and the delayed reaction as machine triggers ([tamper-check.md](tamper-check.md)) |
| Web page | `src/web/`, `src/tools/build-web/` | CodeMirror editor (Vim mode), compiler and simulator in the browser; toolbar, dockable panels with window controls (`dock.ts`, on dockview), command palette and option chips (`commands.ts`), reference panel (`reference-panel.ts`), blueprint of the map (`blueprint-model.ts` geometry and hit testing, `blueprint.ts` drawing and scratch moves); built into `site/` |
| Tools | `src/tools/` | `live-check`, `snapshot-opcodes`, `actions-doc` (writes `docs/actions.md`), `emit-sample` (the hand-built M1 sample), the repository's lint rules |

## Testing

1. Unit tests next to the code (`*.test.ts`), run with `npm test`.
2. The simulator runs compiled programs in the tests, without the game.
3. The tutorial and syntax tests run every program in `examples/tutorial/` and `examples/syntax/` and checks its chat output, and
   checks that `docs/tutorial.md` quotes the files exactly.
4. `npm run live-check` runs `examples/live/*`, `examples/tutorial/*` and `examples/syntax/*` in the real game and compares every variable with
   the simulator (type and value); it must stay at all programs matching. Last run: 59 of 59
   (2026-11-02), with the `map { }` objects placed in the map; with `-- --tamper-check report` and
   `-- --tamper-check enforce --obfuscate`: 60 of 60 (2026-11-03). Steps: [game-facts.md](game-facts.md#the-live-check).

## History

Built in milestones M0–M5 (opcode table, emitters, assembler, simulator and live check,
language, extras), then three review rounds: language, compiler core and simulator fidelity,
then documentation claims and random-program stress tests (about 35,000 programs in total).

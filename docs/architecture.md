# Architecture

```
source ──parse──► AST ──generate──► IR ──loop guard──► IR ──lower──► actions + labels ──layout──► triggers ──emit──► XML / text
```

| Stage | Code | Job |
|---|---|---|
| Opcode table | `src/opcodes/` | Snapshot of the editor's `lib_params.js` (531 actions: number, alias, param kinds) plus compiler flags: template-replaced params (F9, F15), how skips compare (F8, F19), avoided actions (F6) |
| Front end: language | `src/lang/` | `.ptc`: lexer, parser (AST in `ast.ts`), code generator (`codegen.ts`) with frames for locals and temporaries (`symbols.ts`) and a call graph for recursion (`calls.ts`) |
| Front end: assembler | `src/asm/` | `.pasm`: one line, one instruction or directive |
| IR | `src/compiler/ir.ts` | Labels, actions, jumps, conditional branches, calls, returns, timers |
| Loop guard | `src/compiler/guard.ts` | Counts every jump back per event and stops at the limit (F5); entries reset the count |
| Lowering | `src/compiler/lower.ts` | Branches to skip actions and switches (361/364/365/123 + 363) |
| Layout | `src/compiler/layout.ts` | Every jump target starts a trigger; blocks over 100 actions continue in the next trigger (F1) without separating a skip from what it skips; fallthrough becomes a 363; empty exits become a stop (F20) |
| Checks | `src/compiler/check.ts`, `host.ts` | Warnings: unknown targets, 362, text-format limits, XML entities (F26), host variable names inside replaced text (F9, F29) |
| Names | `src/compiler/names.ts` | Variables `~<prefix>_name~`, internal `~<prefix>:name~`; triggers `#<prefix>_label`, internal `#<prefix>:label` |
| Emitters | `src/emit/` | XML elements (grid placement, `maxcalls -1`), editor text (F12, F14), appending to a map |
| Simulator | `src/sim/` | The game's trigger runner for the actions the compiler uses, with load-time conversion (F18) and XML escaping (F26) |
| CLI | `src/cli/` | `npm run compile` |
| Tools | `src/tools/` | `live-check`, `snapshot-opcodes`, `actions-doc` (writes `docs/actions.md`), `emit-sample` (the hand-built M1 sample), the repository's lint rules |

## Testing

1. Unit tests next to the code (`*.test.ts`), run with `npm test`.
2. The simulator runs compiled programs in the tests, without the game.
3. The tutorial test runs every program in `examples/tutorial/` and checks its chat output, and
   checks that `docs/tutorial.md` quotes the files exactly.
4. `npm run live-check` runs `examples/live/*` and `examples/tutorial/*` in the real game and compares every variable with
   the simulator (type and value); it must stay at all programs matching. Last run: 40 of 40
   (2026-11-02). Steps: [game-facts.md](game-facts.md#the-live-check).

## History

Built in milestones M0–M5 (opcode table, emitters, assembler, simulator and live check,
language, extras), then three review rounds: language, compiler core and simulator fidelity,
then documentation claims and random-program stress tests (about 35,000 programs in total).

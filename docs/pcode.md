# The p-code target

`--target pcode` (web page: "target: pcode") compiles a program to p-code: one long text that a
fixed set of triggers reads and runs. `--target triggers`, the default, compiles every statement
to trigger actions directly. Both run the same programs with the same results; p-code is
experimental and much slower.

## How it runs

- **Code:** each instruction is 4 fields (handler number and up to 3 operands) joined by U+241F
  into one text, set once with one action. On the first event, a loader splits it (action 349)
  and stores every field in its own variable, `~<prefix>:vm.<n>.o~`, `.a~`, `.b~`, `.c~`.
- **Loop:** the `vm.loop` trigger builds the name of the current instruction's fields, reads the
  handler number with action 294 (no scan of all variables, F37), adds it to the index of the first
  handler and switches there with action 362. The first handler's index comes from its uid when
  the map loads (F18), so it is right even after a host map's triggers.
- **Handlers:** one trigger per kind of instruction: an action with its fixed parameters, set,
  jump, call, return or a comparison. A handler reads its operands' names from the fields, the
  values with 294, runs the same action on its own variables and writes the result back with 342.
  More statements of a kind cost no more triggers: 200 `x += 1;` need as many triggers as one.
- **Events:** every entry (start, chat, join, timers, exported functions, `wait` continuations)
  keeps its usual uid; that trigger runs the loader once, saves the running instruction, runs the
  loop from the entry and restores it, so events can start inside other events.
- **Calls** use a stack in `~<prefix>:vm.s<n>~`; recursion is not limited to 2048 (F3).

## Cost

Measured in the simulator, which counts the same actions as the game (F37: about 1 µs each):

| Program | `--target triggers` | `--target pcode` |
|---|---|---|
| `tutorial/11-infix.ptc`, one chat line | 1,334 actions | 24,392 actions (18×) |
| `tutorial/01-hello.ptc`, whole run | 28 actions | 706 actions, most of it loading |
| `tutorial/11-infix.ptc`, map size | 56 triggers, 424 actions | 40 triggers, 427 actions, 12,316 characters of code |
| `tutorial/22-dsa-binary-tree.ptc`, map size | 33 triggers, 427 actions | 31 triggers, 344 actions, 16,395 characters |

So an event that takes 1 ms compiled takes about 20 ms as p-code: fine for chat commands, too slow
for code that runs every frame. The map is not smaller for these programs; the gain is that its
trigger count stops growing with the program.

## Limits

- Actions that switch the running trigger (362, 363) are refused. Actions that stop the running
  trigger (the "continue only if" family, the loop guard) return from the current function.
- An action that fails ends the whole event; compiled, it ends only its trigger.
- The target turns on `--direct-index` and turns off the number-text protection (F36): the code
  text is one value that the website editor does not change.
- Text may not contain U+241F.
- With `--obfuscate`, the handlers are shuffled and the code text holds handler numbers shifted by
  the integrity check value ([obfuscation.md](obfuscation.md)).
- A uid of one of the program's own labels used as a value gives the index of its entry trigger.

## Checks

- `src/pcode/pcode.test.ts` runs every example in `examples/live`, `examples/tutorial` and
  `examples/syntax` with both targets and compares chat, errors and variables.
- `npm run live-check -- --pcode` runs them in the game (loop guard 1000, so the endless-loop
  examples stay short); `--only <part of a file name>` picks some. Verified 2026-11-02: all 51
  match, the 5 timer programs when run without the other 46 (with all 51 in one map, loading them
  delays the first frames).

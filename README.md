# pb2-trigger-compiler

Compiles readable code into Plazma Burst 2 map triggers.

```
npm install
npm run compile -- examples/hello.ptc --run
```

That writes, in `out/`:

| File | What it is |
|---|---|
| `hello.xml` | `<trigger>` and `<timer>` elements to append to a map |
| `hello.txt` | the same triggers in the editor's "Edit as text" format, one block per trigger |
| `hello.map.json` | source lines of every action, per trigger uid |
| `hello-map.xml` | with `--into <map.xml>`: the map with the elements appended |

`--run` also runs the program in the simulator and prints its variables and chat.

## Getting the triggers into a map

The website editor cannot import XML into an open map; it can only replace the whole map.

1. In the editor, download your map as XML.
2. `npm run compile -- game.ptc --into downloaded-map.xml`
3. Replace the map with `out/game-map.xml`.

The compiler refuses uids that the map already uses. The map's own timers come first in the file,
so a host timer with delay 0 runs before the program's start code in the first frame.

The `.txt` output (for "Edit trigger as text") holds triggers only, not timers: add the listed
timers in the editor yourself (the CLI prints them). If one value cannot be written as text, no
`.txt` is written; use the XML.

## Which actions

Every one of the game's 531 actions can be used: in `.ptc` with `action(op, a, b)`, in `.pasm` by
alias or `op<N>`. The language has builtins for variables, text, arrays, timing, players and
sync; the simulator runs 63 actions (all the compiler emits) and skips the others, listing them.

## Learn it

[docs/tutorial.md](docs/tutorial.md): 23 programs, from a first loop to chat commands, player
selection, a calculator, three parsers and data structures (linked list, binary tree, sorts).
Each is in `examples/tutorial/`.

[docs/actions.md](docs/actions.md): all 531 actions, how to call each one, and which the
simulator runs.

## Two source languages

- `.ptc`: a small C-like language. Reference: [docs/language.md](docs/language.md).
- `.pasm`: an assembler, one line per action. Reference: [docs/assembly.md](docs/assembly.md).

## Options

| Option | Effect |
|---|---|
| `--prefix <name>` | prefix of every variable and trigger uid (default: the file name). Two programs in one map need different prefixes |
| `--guard <n>` / `--no-guard` | stop a loop after n jumps back per event (default 100000); an endless loop would freeze the game |
| `--no-start` | no start timer: the start code (variable values, `on join`, `on start`) runs only if the map runs `#<prefix>:start` |
| `--extern <uid>` | a uid the host map has, so it is not reported as unknown |
| `--out <dir>` | output folder |
| `--at <x>,<y>` | where the first trigger goes in the map (default 0,0; then a grid of 10 per row, 60 apart) |
| `--run`, `--frames <n>` | simulate the program for n frames and print variables, chat and errors |
| `--no-sync-mark` | do not add the Var Sync engine mark that a program with sync actions needs (with `--into`, a map that has one keeps it and gets no second one) |
| `--help` | all options |

## Development

| Command | What it does |
|---|---|
| `npm run verify` | lint, type check, tests |
| `npm run live-check` | runs `examples/live/*` in the real game and compares every variable with the simulator |
| `npm run actions-doc` | rebuilds `docs/actions.md` from the action table |
| `npm run snapshot-opcodes` | rebuilds the action table from `plazma-burst-2/data/opcodes.js` |

More: [docs/game-facts.md](docs/game-facts.md) (every game fact this relies on, with its source,
and the checks that still need a player) and [docs/architecture.md](docs/architecture.md).

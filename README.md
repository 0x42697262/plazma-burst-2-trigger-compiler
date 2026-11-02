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

The compiler refuses uids that the map already uses.

## Two source languages

- `.ptc`: a small C-like language. Reference: [docs/language.md](docs/language.md).
- `.pasm`: an assembler, one line per action. Reference: [docs/assembly.md](docs/assembly.md).

## Options

| Option | Effect |
|---|---|
| `--prefix <name>` | prefix of every variable and trigger uid (default: the file name). Two programs in one map need different prefixes |
| `--guard <n>` / `--no-guard` | stop a loop after n jumps back per event (default 100000); an endless loop would freeze the game |
| `--no-start` | no start timer; nothing runs at map start |
| `--extern <uid>` | a uid the host map has, so it is not reported as unknown |
| `--out <dir>` | output folder |

## Development

| Command | What it does |
|---|---|
| `npm run verify` | lint, type check, tests |
| `npm run live-check` | runs `examples/live/*` in the real game and compares every variable with the simulator |
| `npm run snapshot-opcodes` | rebuilds the action table from `plazma-burst-2/data/opcodes.js` |

The plan, and every fact about the game this relies on, are in [PLAN.md](PLAN.md).

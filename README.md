# pb2-trigger-compiler

Compiles readable code into Plazma Burst 2 map triggers.

**In the browser:** https://0x42697262.github.io/plazma-burst-2-trigger-compiler/ (editor with
errors, completion and Vim mode; compile and run without installing anything).

**Locally:**

```
npm install
npm run compile -- examples/hello.ptc --run
```

**Editors:** a language server for Neovim and any LSP editor; see [docs/editors.md](docs/editors.md).

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

The compiler refuses uids that the map already uses, adds declared map objects the map lacks,
and warns when the map uses one of the program's variables that is not `export var`. To update a
map that already holds an older build of the program, add `--replace`: it removes the program's
own triggers and timers (found by the prefix) before adding the new ones, and leaves everything
else (your objects and other triggers) in place. The map's own timers come first in the file,
so a host timer with delay 0 runs before the program's start code in the first frame.

The `.txt` output (for "Edit trigger as text") holds triggers only, not timers: add the listed
timers in the editor yourself (the CLI prints them). If one value cannot be written as text, no
`.txt` is written; use the XML.

## Which actions

Every one of the game's 531 actions can be used: in `.ptc` with `action(op, a, b)`, in `.pasm` by
alias or `op<N>`. The language has builtins for variables, text, arrays, timing, players and
sync; the simulator runs 63 actions (all the compiler emits) and skips the others, listing them.

## Learn it

[docs/syntax.md](docs/syntax.md): a short tour of the language syntax, one idea per section.

[docs/tutorial.md](docs/tutorial.md): 27 programs, from a first loop to chat commands, player
selection, a calculator, three parsers, data structures (linked list, binary tree, sorts) and
secrets (a password, an admin login, a per-account key).
Each is in `examples/tutorial/`.

[docs/challenges/game-of-life.md](docs/challenges/game-of-life.md): a challenge for developers,
Conway's Game of Life in a map.

[docs/passwords.md](docs/passwords.md): a chat password whose text is nowhere in the map
(compile-time constants, `secret`, `env()` and `std/hash.ptc`).

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
| `--no-create` | with `--into`: do not add declared map objects the map lacks; warn instead |
| `--replace` | with `--into`: remove this program's old triggers and timers from the map first, to update it in place |
| `--target <name>` | `triggers` (default) compiles to triggers; `pcode` compiles to p-code run by a fixed set of triggers: about 20× slower, experimental ([docs/pcode.md](docs/pcode.md)) |
| `--direct-index` | build array element names from pieces instead of scanning every variable: 2 more actions per array access, faster in maps with many variables (F37) |
| `--no-number-text` | write number-like text such as `"007"` as it is, for map editors other than the website one; by default it is kept safe from the website editor, which turns it into a number (F36) |
| `--help` | all options |

## Development

| Command | What it does |
|---|---|
| `npm run verify` | lint, type check, tests |
| `npm run live-check` | runs `examples/live/*` in the real game and compares every variable with the simulator (`-- --direct-index` or `-- --pcode` compiles them that way; `-- --only <name>` picks some) |
| `npm run web` | builds the web page into `site/` |
| `npm run lsp` | starts the language server on stdio |
| `npm run actions-doc` | rebuilds `docs/actions.md` from the action table |
| `npm run snapshot-opcodes` | rebuilds the action table from `plazma-burst-2/data/opcodes.js` |

More: [docs/game-facts.md](docs/game-facts.md) (every game fact this relies on, with its source,
and the checks that still need a player) and [docs/architecture.md](docs/architecture.md).

## License

[GNU General Public License v3.0](LICENSE.md).

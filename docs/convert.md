# Converting a map to source

`npm run convert -- <map.xml> [--out <dir>] [--raw] [--check] [--prefix <name>]` reads a saved map
(XML from the website editor or `plazma-burst-2/data/maps/`) and writes `<dir>/<map>.ptc`
(default `out/`). The notes it prints are also at the top of the file.

## What the source looks like

- Every object is in one `map { }` block, in the map's order (the order of each kind is kept, so
  index-based actions still find the same object). Only attributes that differ from the editor
  default are written. List values use their short names (`side: Left`), or the qualified form
  when a program name clashes.
- A trigger becomes a **function** when that keeps its meaning: it is enabled, has `maxcalls` -1 or
  at least 1, uses only listed actions, and its uid appears nowhere except where a trigger goes
  (actions that run it, region `use_target`, `ondeath`, song `callback`, timer `target`). Its name
  comes from the uid (`#trigger*stop` → `stop`, `#trigger*1` → `trigger1`). `maxcalls 1` becomes a
  `fooDone` guard, `maxcalls N` a `fooCalls` counter. References to it become `@foo`.
- Every other trigger stays a raw `Trigger(uid) { action(...); }` block with its own uid, and keeps
  `-1` actions in the middle so skip-next actions still skip the same one. Triggers turned on, off
  or given calls by other triggers (19, 20, 21, 22), disabled ones, and ones named in text are raw.
- An enabled timer with one call whose target is a function and that nothing else names becomes a
  line of `on start { wait(delay); f(); }`; the same with `maxcalls -1` becomes `every delay { f(); }`.
  A timer whose target can stop itself (a "continue only if" action or 363) stays raw, so that it
  cannot cut the rest of `on start` short. Every other timer stays `Timer(...)`.
- `--raw` keeps every trigger and timer raw. A map that picks triggers **by position** (action 362,
  or a number where a trigger goes) is always converted this way (F6).
- Text is decoded once (`&quot;` → `"`), and the compiler encodes it again, so the game reads the
  same characters (F26).

## Things that change, on purpose

| Change | Why |
|---|---|
| An object without a uid gets `#<tag>*N` (a number no text in the map uses) | Constructors need a uid; nothing could refer to the object before |
| A repeated uid gets `*N` added; references keep meaning the first object | The game resolves a uid to the first object that has it (F18) |
| Uids of walls, backgrounds, engine marks and images are dropped | The game never reads them (F48) |
| Decoration `at`, `addx`, `addy` are dropped | The game never reads them (F45) |
| A decoration whose model draws in front without `f` gets `f: "1"` | The compiler writes `f: 0` by default |
| A repeated engine mark is commented out; the last one is kept | Its loader assigns the value, so the last one wins (`frame2.js` `inf` loader) |
| An unknown element (`<widget>`) is commented out | No constructor makes it |
| Values the editor would not make (`w: "0"`, `upg: "10"`, `flare: "0"`) are quoted | A quoted value is written exactly as typed |
| Functions get the program's trigger uids and run through the compiler's call code | They are compiled |
| A start timer moves into `on start`: `wait(n)` resumes after n or n - 1 frames | `wait` timing |
| A trigger that nothing runs is left out, with a compiler warning | Unused functions are dropped |

## `--check`

`--check` compiles the source (without a host map) and compares the result with the map:

- Kept objects, raw triggers and raw timers are matched per kind, in order, and compared
  attribute by attribute. A difference counts as expected when the converter recorded it (the
  table above), when the added attribute is the editor default, or when it is the position the
  compiler gives triggers, timers and engine marks that had none.
- For each function, every action of the original trigger must be in the compiled triggers the
  function reaches (references to other functions are matched through their new uids).
- It prints the counts of expected differences and every unexpected one, and exits with 1 when
  there are any, or when the source does not compile.

All 30 maps in `plazma-burst-2/data/maps/` convert and pass the check (`src/convert/convert.test.ts`
runs them when that folder exists). `examples/convert/convert-map.xml` is converted into
`examples/live/convert-map.ptc`, which `npm run live-check` runs in the game.

## Limits

- A trigger reached through a uid built at run time (`"#trigger*" + n` in a variable) is not seen;
  if that trigger became a function, the built uid no longer finds it. Use `--raw` for such maps.
- `--check` compares structure, not behavior: two maps can match and still differ in timing
  within one frame (functions run through the compiler's entry and return code).
- Unlisted actions are written by number (`action(424, 1, 2)`) and are not checked.

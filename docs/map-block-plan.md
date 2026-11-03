# Map block plan

Status: **built** (steps 0–5). The user documentation is `docs/language.md` ("Map objects", "Map
block"); this file keeps the design record. Differences found while building:

- Open checks 1–4 were answered from the client code (F44–F47): `moving`/`tarx`/`tary` are a Bool
  and the door's target position; `at`/`addx`/`addy` are never read; of the marks without a value
  type, the four hero gun marks read `forteam` as a team, `fix_gun_desynchronization` is not in the
  client, the rest ignore it; custom `char` is a whole number or `c` + number, custom decoration
  `model` and background `m` are `c` + number.
- Short names are added next to the existing full-label names (`Behavior.DoNothing` and
  `Behavior.DoNothingControllableWithTriggers` both work), so older programs keep compiling.
- `at x, y` on old declarations is an error that shows the `map { }` line to write.
- Decision 16 changed afterwards: `Trigger(uid) { action(...); }` and `Timer(uid, ...)` make raw
  triggers and timers (at most 100 actions, written as given), for old-school maps kept as source
  (`docs/language.md`, "Triggers and timers in a map block").
- The live check places the `map { }` objects of every program in its map (`examples/live/lang-map-objects.ptc`
  reads region positions back in the game).

## Goal

Split what the map file **contains** (built into the XML while compiling) from what the triggers
**do** (while the map runs). A `map { }` block creates and configures map objects; everything else
stays as it is.

```
map {
  gate = Door("#door*1", maxspeed: 9999);
  gate.x ?= 0;                                     // only when created; drag freely after
  gate.y ?= 10;
  guard = Actor("#enemy*1", botaction: DoNothing, char: c53013);
  guard.hmax = 500;
  slots = [];
  for (let i = 1; i <= 16; i += 1) {
    push(slots, Player("#player*{i}", x: i * 40, y: 0, team: Alpha));
  }
  Wall(0, 300, 2000, 30, m: DarkPlate);
  EngineMark(var_sync);                            // a mark with no value
  EngineMark(he_nades_count, forteam: 3);          // a mark with a value (see Engine marks)
}

region exit = "#exit";                             // old form: the map already has it

on start {
  action(MovableTo, gate, exit);
  action(SetCharHP, slots[3], 50);
}
```

## For a new session: where to look

This plan was written from the sources below; nothing here needs the earlier conversation.

### This repository

| What | Where |
|---|---|
| Rules (commits, style, verify) | `AGENTS.md` |
| Object kinds today | `src/objects/keys.ts` (`OBJECT_KINDS`), `src/objects/objects.ts` (`checkObjects`, `objectElement`) |
| Old object declarations | `src/lang/parser.ts` (`objectDeclaration`, `objectTree`, `uids` for `{a..b}` ranges), `src/lang/symbols.ts`, `src/lang/codegen.ts` (`rawOperand`, `objectSelection`) |
| Named values (`Behavior.*`, ...) | `src/opcodes/values.ts`, group list `VALUE_GROUPS` in `src/opcodes/keys.ts`, data in `src/opcodes/snapshot.json` |
| Snapshot tool to extend | `src/tools/snapshot-opcodes/` (`npm run snapshot-opcodes`) |
| Compile-time engine | `src/lang/comptime.ts` |
| Object creation in outputs | `src/cli/main.ts`, `src/web/pipeline.ts` (`--objects`, `--no-create`, staging row from `stagingPosition` in `src/emit/xml-emitter.ts`) |
| Map merging, manifest | `src/emit/merge.ts`, `.build.json` written in `src/cli/main.ts` |
| Language server | `src/service/` (completion, hover, symbols) |
| Docs to update | `docs/language.md` (Map objects), `docs/syntax.md` (07), `README.md` (options), `docs/game-facts.md` |
| Example and tests | `examples/syntax/07-map-objects.ptc`, `src/lang/objects.test.ts`, `src/web/web.test.ts`, `src/cli/main.test.ts` |

### Sister repository `~/Projects/plazma-burst-2` (read only)

| What | Where |
|---|---|
| Parameter table, dropdown lists, engine mark value types | `data/opcodes.js`: global `PB2_OPCODES` with `params` (rows `{ cls, name, title, desc, kind }`; `cls` is a tag or `*` for shared attributes), `values` (`kind → { raw value: label }`), `markPairs` (`mark → value kind`) |
| Editor defaults, hidden game attributes, which tags have a uid | `src/features/map_editor/domain/keys.ts` (`DEFAULTS`, `GAME_ONLY`, `NO_UID`, `TAG`, `PICKS`) |
| Which attributes a tag has (uid, position, size) | `src/features/map_editor/domain/params.ts` (`paramsOf`), `src/features/map_editor/domain/kinds.ts` (rectangle or point per tag) |
| Real maps (attribute use, values) | `data/maps/*.xml` (22 maps) |

Do not read `data/credentials.json*` or `data/netlogs/`. Never edit the sister repository except
test maps in `data/maps/` (not committed there).

### Recipes

Per-tag property list (the table in "Property reference"): for each tag, `uid` (unless in
`NO_UID`), `x`, `y`, `w`/`h` for rectangle tags (`box door region bg water pushf`), then the keys of
`DEFAULTS[tag]` and `GAME_ONLY[tag]`. Each attribute's type is the `params` row with `cls === tag`,
else `GAME_ONLY[tag][attr]`, else the row with `cls === '*'`.

```
node -e 'require("vm").runInThisContext(require("fs").readFileSync(
  process.env.HOME + "/Projects/plazma-burst-2/data/opcodes.js", "utf8"));
  const t = globalThis.PB2_OPCODES; console.log(Object.keys(t.values), t.markPairs)'
```

Attributes used in real maps, per tag:

```
cd ~/Projects/plazma-burst-2/data/maps && grep -ho '<door [^>]*>' *.xml | grep -o ' [a-z_]*=' | sort | uniq -c
```

Engine marks in real maps: `grep -ho '<inf [^>]*>' *.xml | sort | uniq -c`.

Short value names: label → drop `(...)` → split on non-alphanumerics → CamelCase; on a clash use
the full label; still a clash, add `_` and the raw value. Check it gives no duplicates over the
lists in "Values" (436 names at the time of writing).

### Checking in the game

Open questions about attribute meaning (below) are answered in the game, not from the editor:
build a test map with the attribute set, put it in `~/Projects/plazma-burst-2/data/maps/`, and run
it with the live-check runner (`npm run live-check`, see `docs/game-facts.md` "The live check") or
by hand with the dev console (`pb2dev.run("vars")`). Record each answer in `docs/game-facts.md`
with its source.

## Decisions (from the discussion)

1. **Keyword `map`.** One or more `map { }` blocks at the top level, run in file order.
2. **Build time only.** The block runs while compiling (the compile-time engine of `const`). It
   cannot act on the game. Its objects are typed handles (uids) once the map runs.
3. **Properties are build-time.** `gate.x = 5` outside a `map` block is a compile error that says
   how to change it while the map runs (the matching action, e.g. `MovableTo`).
4. **Constructors carry the kind.** `Door(...)`, `Region(...)`, `Player(...)`, `Actor(...)`...
   replace the kind keyword inside the block. `action` keeps checking kinds as today.
4a. **Actors, not characters.** The kind for non-player characters (`<enemy>`) is `actor`, as in
   the editor (commit `ea40048` named it `character`; rename it before this work, step 0).
5. **Arrays hold one kind.** `[Door(...), Region(...)]` is an error at the first element of another
   kind (an index that changes at run time could otherwise land on the wrong kind).
6. **Syntax stays C-like.** Only named arguments are added (`x: 0`, as in Swift, C#, Kotlin, Dart).
7. **The code wins for what it writes.** `=` and named arguments set the attribute on every build,
   also on an object the map already has. Attributes the code does not write are left as they are
   in the map.
8. **`?=` sets only when the object is created** (meaning as in GNU Make). Statement form only:
   `gate.x ?= 0;`. Not inside calls (`?:` would read as Kotlin's Elvis operator or a TypeScript
   optional property).
9. **Every change to an existing object is printed:** `#door*1: x 500 → 0, maxspeed 10 → 9999`.
10. **Old declarations mean "the map already has this".** `door gate = "#door*1";` is never created;
    with `--into`, a missing one is an error that suggests moving it into `map { }`.
11. **`--objects` and the web "objects" box are removed.** A `map` block is the request to create.
    `--no-create` is removed too (old declarations no longer create anything).
12. **Plugin passes for obfuscation** stay out of scope (see `docs/obfuscation.md` later section).
13. **Raw attribute names only:** `maxspeed`, `hea`, `char`, `botaction`, exactly as in the map
    file. No friendly aliases.
14. **Values by short name, raw always accepted.** A property whose type has a list (dropdown in the
    editor) takes the short name of an entry (`botaction = DoNothing`) or the raw value
    (`botaction = 4`). Model lists also take values that are not in the list (custom decorations
    and skins such as `c53013`).
15. **`map { }` is allowed in imported files.** Blocks run in import order, then the main file.
16. ~~**No triggers or timers in `map { }`:** the program makes its own.~~ Changed: `Trigger(uid) { actions }` and `Timer(uid, ...)` make raw ones (see Status).

## Current state (check before building)

- Object kinds: `src/objects/keys.ts` (`OBJECT_KINDS`: param kind, map tags, tag to create, editor
  defaults). `player` and `character` are separate kinds (`character` to be renamed `actor`).
- Named values: `src/opcodes/values.ts` builds `Group.Name` values from `snapshot.json` `values`
  (group list in `src/opcodes/keys.ts` `VALUE_GROUPS`).
- Old declarations: parser `objectDeclaration` / `objectTree` in `src/lang/parser.ts` (uid ranges
  `{a..b}` expand there); symbols `object` / `objectArray` in `src/lang/symbols.ts`; use in
  `action(...)` in `src/lang/codegen.ts` (`rawOperand`, `objectSelection`).
- Creation today: `checkObjects` / `objectElement` (`src/objects/objects.ts`), called from
  `src/cli/main.ts` and `src/web/pipeline.ts` (`--objects`, `--no-create`, staging positions from
  `stagingPosition` in `src/emit/xml-emitter.ts`).
- Compile-time engine: `src/lang/comptime.ts` (runs `const` values in the simulator).
- Build manifest: `.build.json` (uids a build added), read by `--replace` (`src/emit/merge.ts`).

## Property reference

Source: `plazma-burst-2/data/opcodes.js` (`PB2_OPCODES.params`: element class, attribute, title,
value type; `values`: the dropdown lists; `markPairs`: the value type of each engine mark) and the
editor's per-tag rules in `plazma-burst-2/src/features/map_editor/domain/keys.ts` (`DEFAULTS`,
`GAME_ONLY`, uid / position / size per tag). Step 1 extends `npm run snapshot-opcodes` to store
`params`, `markPairs` and these per-tag rules in `src/opcodes/snapshot.json`, so nothing below is
typed by hand. Record the source in `docs/game-facts.md`.

Names are the raw attributes of the map file. `uid` is the constructor's first argument. Editor
bookkeeping attributes (`__id`, `__zIndex`, `__priority`) are never written.

| Constructor | Tag | Properties: type = editor default |
|---|---|---|
| `Door` | `<door>` | `x` number (editor rounds to 10); `y` number (editor rounds to 10); `w` number > 0 (editor rounds to 10); `h` number > 0 (editor rounds to 10); `moving` see note = false; `tarx` see note = 0; `tary` see note = 0; `maxspeed` number ≥ 0 = 10; `vis` Bool = true; `attach` a Door (or None) = -1; `mute` Bool = false |
| `Region` | `<region>` | `x` number (editor rounds to 10); `y` number (editor rounds to 10); `w` number > 0 (editor rounds to 10); `h` number > 0 (editor rounds to 10); `use_target` `@function` (or NoTrigger) = -1; `use_on` Activation = 0; `attach` a Door (or None) = -1; `uses_timer` Bool = false |
| `Player` | `<player>` | `x` number (editor rounds to 10); `y` number (editor rounds to 10); `tox` number = 0; `toy` number = 0; `hea` whole number = 130; `hmax` whole number = 130; `team` Team = 0; `side` Direction = 1; `char` Skin, or any raw value = 1; `incar` InVehicle (or a Vehicle) = -1; `botaction` Behavior = 0; `ondeath` `@function` (or NoTrigger) = -1 |
| `Actor` | `<enemy>` | `x` number (editor rounds to 10); `y` number (editor rounds to 10); `tox` number = 0; `toy` number = 0; `hea` whole number = 130; `hmax` whole number = 130; `team` Team = 0; `side` Direction = 1; `char` Skin, or any raw value = 1; `incar` InVehicle (or a Vehicle) = -1; `botaction` Behavior = 0; `ondeath` `@function` (or NoTrigger) = -1 |
| `Gun` | `<gun>` | `x` number (editor rounds to 10); `y` number (editor rounds to 10); `model` GunModel, or any raw value = gun_rifle; `command` Team (+ AnyTeam) = -1; `upg` Upgrade = 0 |
| `Barrel` | `<barrel>` | `x` number (editor rounds to 10); `y` number (editor rounds to 10); `model` BarrelModel = bar_orange; `tox` number = 0; `toy` number = 0 |
| `Vehicle` | `<vehicle>` | `x` number (editor rounds to 10); `y` number (editor rounds to 10); `side` Direction = 1; `model` VehicleModel = veh_jeep; `tox` number = 0; `toy` number = 0; `hpp` number ≥ 0 = 100 |
| `Decor` | `<decor>` | `x` number (editor rounds to 10); `y` number (editor rounds to 10); `model` DecorModel, or any raw value = stone; `attach` a Door (or None) = -1; `u` number = 0; `v` number = 0; `f` DrawInFront = 0; `r` number = 0; `sx` number = 1; `sy` number = 1; `text` text |
| `Pusher` | `<pushf>` | `x` number (editor rounds to 10); `y` number (editor rounds to 10); `w` number > 0 (editor rounds to 10); `h` number > 0 (editor rounds to 10); `tox` number = 0; `toy` number = 0; `stab` number ≥ 0 = 0; `damage` PusherDamage = 0; `attach` a Door (or None) = -1 |
| `Light` | `<lamp>` | `x` number (editor rounds to 10); `y` number (editor rounds to 10); `power` number = 0.4; `flare` Bool = 1 |
| `Water` | `<water>` | `x` number (editor rounds to 10); `y` number (editor rounds to 10); `w` number > 0 (editor rounds to 10); `h` number > 0 (editor rounds to 10); `damage` number ≥ 0 = 0; `friction` Bool = true; `attach` a Door (or None) = -1 |
| `Wall` | `<box>` | `x` number (editor rounds to 10); `y` number (editor rounds to 10); `w` number > 0 (editor rounds to 10); `h` number > 0 (editor rounds to 10); `m` Material = 0 |
| `Background` | `<bg>` | `x` number (editor rounds to 10); `y` number (editor rounds to 10); `w` number > 0 (editor rounds to 10); `h` number > 0 (editor rounds to 10); `m` BackgroundModel = 0; `c` text; `a` a Door (or None) = -1; `u` number = 0; `v` number = 0; `f` DrawInFront = 0; `s` Bool = true |
| `Song` | `<song>` | `x` number (editor rounds to 10); `y` number (editor rounds to 10); `url` text; `volume` number ≥ 0 = 1; `loop` Bool = true; `callback` `@function` (or NoTrigger) = -1 |
| `EngineMark` | `<inf>` | `x` number (editor rounds to 10); `y` number (editor rounds to 10); `mark` EngineMark = hero1_guns |

Notes:

- `Door`: `moving`, `tarx`, `tary` have editor defaults but no row in the parameter table (no
  title or type). Accept `moving` as Bool and `tarx`/`tary` as numbers; confirm in the game
  (open check 1).
- `mute` (door), `uses_timer` (region), `text` (decor) are read by the game but not shown by the
  editor (`GAME_ONLY`).
- `Light.flare` is a Bool with editor default `1`; write `true`/`false`, accept `1`/`0`.
- `Pusher.damage`: `NoDamage`, a positive number (basic damage) or a negative number (slicing
  damage), from the list's `[val]` / `-[val]` entries.
- `Wall`, `Background` and `EngineMark` have no uid: they cannot be used in `action(...)`.
- Seen in saved maps but in neither table: `decor` `at`, `addx`, `addy` (open check 2). Not
  accepted until confirmed.
- `Song` is a new object kind (actions take `song+none`).

### Engine marks

An engine mark (`<inf mark="..." forteam="..."/>`) switches one map-wide setting on. `mark` says
which setting; `forteam` holds that setting's value, and its type depends on the mark (the editor's
`markPairs`). So `EngineMark(...)` takes the mark first and, for marks that have one, the value as
`forteam:`:

```
EngineMark(var_sync);                                  // no value
EngineMark(nopsi);                                     // no value
EngineMark(sky, forteam: Space);                       // a Sky entry (raw: 5)
EngineMark(gamescale, forteam: 1.5);                   // number ≥ 0
EngineMark(he_nades_count, forteam: 3);                // whole number ≥ 0
EngineMark(watercolor, forteam: "#4f5370");           // text (hex color)
EngineMark(dm_slots_on_spawn, forteam: "1,3,6");      // text (slot list)
```

`mark` takes the raw mark name (`sky`, `var_sync`) or its short name (`ChangeSky`, `EnableVarSyncTriggerActions`).

| Mark | Editor label | `forteam` |
|---|---|---|
| `sky` | Change sky | Sky |
| `shadowmap_size` | Shadowmap size | number > 0, whole |
| `casual` | Enable casual mode | none |
| `nobase` | Disable base noise | none |
| `game2` | Alternative gameplay | none |
| `strict_casual` | Enable strict casual mode | none |
| `no_auto_revive` | Disable AI revive | none |
| `meat` | Force ragdoll disappearment | none |
| `hero1_guns` | Spawn marine weapons | none |
| `hero2_guns` | Spawn Proxy weapons | none |
| `hero2_guns_nonades` | Spawn Proxy weapons (no nades) | none |
| `hero2_guns_nades` | Spawn Proxy weapons (only nades) | none |
| `nopsi` | Disable psi-swords | none |
| `gamescale` | Change game scale | number ≥ 0 |
| `he_nades_count` | Set start HE nades count (MP only) | number ≥ 0, whole |
| `port_nades_count` | Set start Port nades count (MP only) | number ≥ 0, whole |
| `sh_nades_count` | Set start Shield nades count (MP only) | number ≥ 0, whole |
| `snow` | Enable snow on map | none |
| `watercolor` | Use custom water color # (hex color code) | text |
| `acidcolor` | Use custom acid color # (hex color code) | text |
| `watertitle` | Use custom water title | text |
| `acidtitle` | Use custom acid title | text |
| `dm_slots_on_spawn` | List of slots that can be randomly given to player in DM/TDM modes during respawn | text |
| `dm_max_guns_on_spawn` | Define how many weapons can be randomly given to player in DM/TDM modes during respawn | number ≥ 0, whole |
| `level_errors` | Enable level trigger error reporting | none |
| `var_sync` | Enable Var Sync trigger actions | none (not in the pair table) |
| `no_light_break` | Disallow lamp destruction and collisions | none (not in the pair table) |
| `naive_hit_confirmation` | Enable naive hit confirmation (MP only) | none (not in the pair table) |
| `no_quick_save` | Disallow manual quick saving on a level (HTML5 port only) | none (not in the pair table) |
| `no_dying_weapon_drop` | Disallow enemies occasionally dropping weapons when dying (HTML5 port only) | none (not in the pair table) |
| `no_unstable_weapon_drop` | Disallow enemies occasionally dropping weapons when unstable (HTML5 port only) | none (not in the pair table) |
| `fix_gun_desynchronization` | Enable gun desynchronization fixes (MP only) | none (not in the pair table) |


Rules:

- A mark with no value writes `forteam="0"` when created; an existing one keeps its `forteam` (saved
  maps hold `var_sync` with `0`, `6` and `h2so4`, so the game ignores it there).
- A mark that has a value: the code wins for `forteam`, as for other properties; `?=` works too.
- Identity is the mark name. If the map already has several of the same mark (one saved map has two
  `sky` marks), the build stops and lists them; there is no way to tell which one the code means.
- The compiler's own `var_sync` mark (added when the program syncs) merges with a declared one.
- Marks missing from `markPairs` (the last 7) are treated as "no value" (open check 3).
- A text value starting with `#` (`watercolor`, `acidcolor`) becomes an object index at load if a
  uid matches (F18); the compiler warns, as it does for action values.

## Values

- **Short names.** Each list entry's name is its editor label in CamelCase with the part in
  brackets dropped: `Do nothing (controllable with Triggers)` → `DoNothing`, `Yes and glow
  (decorations only)` → `YesAndGlow`, `Right ►` → `Right`. If two entries would get the same name,
  both keep the full label (`PistolC01p`, `PistolC01pRed`); if the full labels are the same too,
  `_` and the raw value are added. An entry whose raw value is a name also answers to it
  (`gun_rifle`, `stone`, `var_sync`). Tested on the 21 lists map properties use: 436 names, none
  left clashing.
- **Bare or qualified.** In a property, the property's own list is searched first:
  `botaction = DoNothing`. The qualified form always works: `Behavior.DoNothing`. A bare name that
  is also a program name (variable, constant, function) is an error asking for the qualified form.
- **Raw values** are always accepted: `botaction = 4`. Closed lists (Behavior, Direction, Team,
  Material, DrawInFront, Upgrade, Activation, Bool, EngineMark, Sky, BackgroundModel,
  BarrelModel, VehicleModel) refuse a raw value that is not in the list. Open lists (Skin,
  DecorModel, GunModel) take any raw value without a warning, for approved custom content:
  `char = c53013`, `model = c12345`.
- **References:** `attach` takes a `Door` handle or `None`; `use_target`, `ondeath`, `callback` take
  `@function` or `NoTrigger`; `incar` takes a `Vehicle` handle, `No` or `DetectAutomaticly`.
- **Numbers** are checked against the type (`≥ 0`, `> 0`, whole). Positions and sizes are not
  rounded (the editor rounds to 10 only when you drag).
- Named values get groups for the new lists: `Direction`, `Material`, `DrawInFront`, `Upgrade`,
  `Activation`, `BarrelModel`, `VehicleModel`, `BackgroundModel`, `EngineMark`, `InVehicle`, and
  `Skin` (today `CharacterModel`; keep that name as an alias).

## Language

### Grammar additions

```
declaration    = ... | "map" block ;
map-statement  = statement                     (build-time subset, below)
               | identifier "." identifier ( "=" | "?=" ) expression ";" ;
expression     = ... | constructor ;
constructor    = Kind "(" [ argument { "," argument } ] ")" ;
argument       = expression | identifier ":" expression ;
Kind           = "Door" | "Region" | "Player" | "Actor" | "Gun" | "Barrel" | "Vehicle" | "Decor"
               | "Pusher" | "Light" | "Water" | "Song" | "Wall" | "Background" | "EngineMark" ;
```

- `map` becomes a keyword only at the start of a top-level declaration followed by `{` (like the
  object kind words today), so `var map = 1;` keeps working.
- Constructor names are reserved inside `map` blocks only.
- Positional arguments: the uid for kinds with one; `Wall(x, y, w, h)` and `Background(x, y, w, h)`;
  `EngineMark(mark)`. Everything else is named (`forteam:` for a mark's value).

### Build-time subset inside `map { }`

Allowed: `let`, assignments, `if`, `while`, `for`, `push`, `len`, arithmetic, text, constants,
calls to the program's functions that the compile-time engine accepts (same rule as `const`).
Not allowed: `say`, `action`, `wait`, players, chat, `random`, `time` (as for `const`). Names
assigned an object or an array of objects at the top level of the block become global object
symbols (`gate`, `slots`); other names stay local to the block.

## Compiler

1. **Parse** `map` blocks into a new declaration kind `{ kind: 'map', body }`.
2. **Evaluate** each block with the compile-time engine, extended with object values
   `{ kind, uid | null, set: Map<attribute, value>, initial: Map<attribute, value> }`. Result: a list
   of map objects (in order) and the global symbols they bind.
3. **Symbols:** bound names become `object` / `objectArray` entries (kind from the constructor), so
   `action(...)`, `len` and indexes work unchanged.
4. **Run-time property use** (`gate.x` anywhere outside `map`): compile error with the action hint.
5. **Old declarations:** become reference-only (`create: false` on the object record).
6. **Result:** `CompileResult.objects` gains `{ tag, uid, set, initial, line }` per map object.

## Output

| Situation | Map object with a uid | Wall (no uid) |
|---|---|---|
| No map | written with defaults, `set` and `initial` applied; the uid list is printed (a map that already has one would get it twice) | written |
| `--into`, uid missing | added like above | added |
| `--into`, uid present, same tag | `set` attributes rewritten in place, `initial` ignored; changes printed | (no identity) |
| `--into`, uid present, other tag | error (as today) | — |
| `--into --replace` | as above | walls recorded in `.build.json` by the previous build are removed first, then added again |

- Rewriting an element keeps its other attributes and their order (`src/emit/merge.ts`, new
  `updateElement`). Values go through `escapeXml` and the number-text rule (F36).
- Without `--replace`, an `--into` build that adds walls warns that a rebuild adds them again.
- Objects without `x`/`y` keep today's staging row below the triggers.
- `.build.json` gains `walls: [element text]` for exact removal.
- The simulator gets region rectangles from `Region(...)` with `x y w h`, so `--run` can use them.

## Tooling

- Language server (`src/service/`): completion of constructors and properties, hover with the
  params description and value kind, symbols for objects bound in `map` blocks, diagnostics.
- Web page: remove the "objects" box; highlight constructors; the change list goes to the notes.
- Neovim files (`editors/nvim/`): highlight `map` and constructors.

## Migration

- `examples/syntax/07-map-objects.ptc` and the docs: show `map { }` for created objects and the old
  form for host objects.
- Programs that relied on old declarations being created with `--into`: the error names the object
  and shows the `map { }` line to write.

## Testing

- Parser: grammar, `?=` only as a statement, `map` still usable as a name.
- Build-time evaluation: loops, functions, arrays of one kind, mixed-kind error, forbidden actions.
- Properties: every kind's table, each value type, short and qualified and raw values, open list
  accepts custom values, closed list refuses unknown ones, bare name clashing with a program name,
  unknown attribute, `attach` / `ondeath` / `incar` references, engine mark value types.
- Output: no map, `--into` add / update / `?=` ignored / other tag, `--replace` with walls, change
  list text, attribute order kept.
- Run-time property use is an error with the action hint.
- Existing suites stay green; the equivalence and obfuscation tests are unaffected (no trigger
  changes).
- In the game: a test map built from `map { }` (16 player slots, doors with speed, a wall) opened
  with the live-check runner; read the objects through the dev console.

## Docs

- `docs/language.md`: new "Map block" section; old declarations described as host objects.
- `docs/syntax.md`: one section with the example above.
- README options: remove `--objects` and `--no-create`.
- `docs/game-facts.md`: source of the property tables; editor attributes not shown by the editor
  (`mute`, `uses_timer`).

## Order and estimate

0. Rename the `character` kind to `actor` (keyword, docs, tests, example). ~1 hour.
1. Snapshot `params`, `markPairs` and the per-tag rules; property tables; short value names and the
   new groups. ~half a day.
2. Parser and build-time evaluation with object values, symbols, run-time property error. ~1 day.
3. Output: create, update in place, `?=`, change list, walls and the manifest. ~half a day.
4. Language server, web page, removal of `--objects` / `--no-create`, migration. ~half a day.
5. Docs and the in-game check. ~half a day.

Total: about 3 to 3.5 days.

## Open checks (need the game)

1. `Door` `moving`, `tarx`, `tary`: confirm their meaning and types (no parameter row).
2. `decor` `at`, `addx`, `addy` seen in saved maps: what they do; accept them once known.
3. The 7 engine marks missing from `markPairs`: confirm they take no value.
4. Custom content: a `char` / decor `model` value outside the lists (`c53013`) loads in the game.

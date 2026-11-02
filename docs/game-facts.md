# Game facts

What the compiler relies on about Plazma Burst 2, each with its source. Facts come from the game
client code (`plazma-burst-2/game/scripts/`, build v1769098419), from live runs, or from the user
for the website editor; not from the community manual. A new fact gets the next number here.

Action numbers are always the client's. The community manual is off by one around 348–365.

## Facts

| # | Fact | Source | Consequence |
|---|---|---|---|
| F1 | A trigger loads at most 100 actions (`for i = 1..100`) | `frame2.js:11278` | Long code chains to the next trigger |
| F2 | 99 "Execute trigger" pushes a new frame; it runs right away and returns | `actions.js:2268` | Real CALL / RET |
| F3 | Frame stack deeper than 2048 throws; the error is caught, that frame is dropped | `actions.js:~68` | Recursion depth ≤ 2048 |
| F4 | 363 / 362 "Switch execution" replace the current frame (no push) | case 362/363 | Real JMP; loops cost no stack |
| F5 | No iteration limit on 363 loops | runner loop | An endless loop freezes the game: the compiler must guard |
| F6 | 362 takes a trigger **index** (load order), not a uid | case 362 | Avoid 362: index depends on the host map |
| F7 | 342 `vars[vars[A]] = vars[B]`, 294 `vars[A] = vars[vars[B]]` | case 342/294 | Indirect store / load: RAM |
| F8 | 361 skip-next if A == B (as strings), 364 if A > B, 365 if A < B (as numbers), 123 skip-next if A != value (`""+vars[A] === ""+B`, as strings) | cases 123/361/364/365 | Conditional jumps |
| F9 | 325/326/350/352 replace every variable *name found inside* B with its value, longest first, scanning all variables. 325 replaces inside the value of variable B; 326/350/352 inside the literal B. Each found name is listed twice, so it is replaced twice: `~a[~a[1]~]~` with `~a[1]~` = 1 becomes `~a[1]~`, then the value of that. Names not set are not replaced; a name set to `undefined` is replaced by `,` | `frame2.js:43646`, cases 325/326/350/352 | Mangle names with delimiters; cost grows with variable count |
| F10 | 508 "all active slots" builds a string (`[] + 0 + 3` = `"03"`) | case 508 | Slots ≥ 10 ambiguous: do not use for player loops |
| F11 | In XML, trigger targets are uids (`#trigger*14`, `#Unlock_admin_room`); the loader turns them into indexes | saved maps | Emit uids; custom uids are allowed |
| F12 | Trigger text: header lines `uid:` `enabled:` `maxcalls:`, then `Name( "A", "B" );`; actions without an alias are `op<N>`; no quote escaping | `plazma-burst-2/src/features/triggers/script.ts` | A value containing `", "` or `" );` cannot be written as text |
| F13 | The website editor cannot import XML into an open map. It can only replace the whole map with XML. Players download the map as XML, append the compiled triggers, and replace | user, website map editor | XML output = elements to append; `appendToMap` refuses uid clashes |
| F14 | The editor's "Edit as text" writes aliases exactly (`next if VarA == ValueB( "0", "0" );`) and `op<N>` only for actions without alias; header `uid: #trigger*1`, `enabled: true`, `maxcalls: 10`, blank line, actions | user, website map editor | Text emitter mirrors the editor: alias when present, else `op<N>` |
| F15 | 42 ShowText replaces variable names inside A (F9 function) before showing it | `frame2.js:43718` (show-text function calls the F9 function on A) | `ShowText( "count = ~x~" )` prints the value |
| F16 | `<timer uid x y enabled maxcalls target delay />`; `target` starting with `#` is a uid, else an index | `frame2.js` timer loader (`charAt(0)` check), saved maps | A start timer (delay 0, 1 call) runs the entry trigger at map start |
| F17 | Live check: 99 returns to the caller; actions after a 363 never run | live run of `ptc-hello`, 2026-11-02 | Confirms F2 and F4 |
| F18 | At load, every action's A and B go through one function: text starting with `#` becomes the index of the first object with that uid (one registry for all kinds; unknown uids stay text); text equal to `String(parseInt(text))` becomes a number (`"5"` → 5, `"-3"` → -3, `"1.5"`, `"007"` and `""` stay text) | `frame2.js` loader loop over triggers (`$cIсA1`) | Literal text that looks like a whole number is a number in the game; `===` actions (112, 113, 116, 117) are avoided |
| F19 | `actions.js` shadows `Number` with `parseFloat`; 364/365 compare two **variables** as floats; 110/111/114/115 also use `parseFloat`; 361 uses `String(a) == String(b)` | top of `actions.js`, cases | Comparisons: `<` `>` numeric, `==` `!=` text |
| F20 | 110 with A = B always stops the trigger (`x > x` is false, also for NaN); a stop still counts as a finished call | case 110, runner | Used as the "stop" action |
| F21 | 104 (`vars[A] += parseFloat(vars[B])`) and 152 use `+=`: text in A concatenates (`"5.5"` + 5 = `"5.55"`); 102 uses `parseFloat` on both | cases; live `arith.pasm` | The compiler emits 102 A 0 before 104 |
| F22 | 99, 19, 20, 22 read A with `parseInt` (NaN → 0): an unknown uid there means trigger index 0. 363 uses `Math.floor` (NaN → error, frame dropped) | cases 99/19/20/22/363 | The checker warns about unknown targets |
| F23 | A frame starts only if its trigger is enabled and has calls left (-1 = unlimited); calls drop by 1 when a frame ends normally, not when 363 replaces it | runner in `actions.js` | `maxcalls -1` on every compiled trigger |
| F24 | Timers: each frame, in element order, an enabled timer with calls left adds the game speed to its counter; at counter ≥ delay it resets to 0, drops a call (disabled at 0) and runs its target. 44 resets the counter | `frame2.js` timer loop, case 44 | `wait(n)`: 44 + 25 on a disabled timer, the continuation runs 26 first |
| F25 | 508 lists no slot in single player, also 60 frames after start; it checks a per-character field against two values | live `lang-players.ptc`; case 508 | `for player` works in multiplayer only |
| F26 | The game's XML reader copies attribute text as it is, without decoding entities; only ShowText turns `&lt; &gt; &quot;` back into `< > "` for display. A value typed as `a<b&c` in the editor is `a&lt;b&amp;c` (11 characters) in the game | `libs/xml.js` (attribute loop), `libs/tools.js:554` (`$оeoce`); live `entities.pasm` | The simulator loads XML-escaped text; the compiler warns about such values |
| F27 | 348 gives `Date.now()` (milliseconds since 1970), not time since start | case 348, `flash.js` (`getTimer=()=>Date.now()`) | `time()` is a wall clock |
| F28 | 185 gives `"Empty"` for an inactive slot; 188 reads `chars[vars[B]]` with no active check (an unknown slot throws, and the frame is dropped) | cases 185/188, `_strings.js` | Simulator matches |
| F29 | In 22 saved maps (765 variable names), map makers mostly name variables `var_name` (333); none wrap names in `~…~`; 44 names lie inside other names (`~level` in `~levelBox`) | `plazma-burst-2/data/maps/*.xml`, 2026-11-02 | `~<prefix>_name~` cannot lie inside a host name, but a plain host name (`level`) can lie inside ours: with `--into` the compiler warns about that |
| F30 | Sync actions 223–227 throw when the map has no Var Sync engine mark (`<inf mark="var_sync">`; the flag is set by the loader and never cleared), so the rest of the trigger is dropped. With the mark they send the variable only in multiplayer; a name or value over 2048 characters also throws. 6 of the 22 saved maps use them, each with one mark | `actions.js` cases 223–227, `frame2.js:12062`; saved maps; live `lang-sync.ptc` (with the mark the trigger goes on) | The XML gets the mark when a program syncs; the simulator throws without it |
| F31 | 156 sets one trigger as the map's chat receiver; the game runs it for every chat line, with the writer's slot and text kept for 159 (slot), 160 (text), 158 (displayed name, `Empty` when no character) and 157 (login) | `actions.js` cases 156–160, `frame2.js:10478` (`$HТс1I`) | `on chat` registers with 156 at start; a second receiver replaces the first |
| F32 | "Edit as text" (editor, `lib_gui.js` `CompileTrigger`): one trigger at a time, the selected one; lines split at `\n`; an action line needs `( "`, `", "` and `" );`, and the text before the first `(` must be an alias exactly or `op<N>` (leading spaces are not trimmed); `uid:`, `enabled:` and `maxcalls:` are trimmed and applied, a pasted uid with no duplicate check; at most 100 actions; Apply replaces all actions of the trigger | editor code, read with the user's account, 2026-11-02 | Paste each text block into its own new trigger; timers and engine marks must be added by hand |
| F33 | Saving in the editor keeps only actions 1–99 of a trigger (`compi_obj`: `action_id < trigger_actions_limit`, which is 100) | `lib_onenterframe.js` `compi_obj` | The layout fills triggers to 99 actions; the checker warns about a 100th |
| F34 | Saving decodes `&quot; &lt; &gt; &amp;` in every text parameter, then encodes `& " < >` again, so the game sees the same escaped text as from a local map | `lib_onenterframe.js` `compi_obj` | F26 holds on the website path too |
| F35 | The editor's object clipboard (Ctrl+C / Ctrl+V) renames a pasted uid only if the map already has it, and then updates references to it among the pasted objects only | `lib_controlevents.js` paste, `lib_classes.js` `RandomizeName` | Copying compiled triggers between maps keeps their uids unless they clash |
| F36 | The website editor turns a parameter that looks like a number into that number when it loads a map: `0123456789.` shows as `123456789`. The stored map keeps the text until the next save from the editor, which writes the number. The exact rule is in editor code the account cannot read; the compiler treats any text that parses as a number but is not written as one (`007`, `1.50`, `1e3`, ` 5`, `0x10`, `0123456789.`) as affected | user, website map editor, 2026-11-02 (tutorial 8 stopped reading `0` after a save) | The compiler writes such text as `_` + text followed by "remove the first character" (action 372); the check warns about any left, e.g. in `.pasm`; `--no-number-text` turns the protection off for other map editors |

## Open checks (need a player)

1. Website path end to end: replace a map with compiled XML on the site's map page, play it, and
   see the program run. The editor code (F32–F35) says it works; the replace step itself runs on
   the server, whose code cannot be read, and it changes a map on the account.
2. `for player` (action 508) in a multiplayer match with 2 or more players (F25).
3. `sync(x)` in a multiplayer match: the other players get the value (F30).
4. `on chat` in the game: write `= 3 + 4 * 2` with `examples/tutorial/11-infix.ptc` in a map; the
   chat answers `3 4 2 * + = 11`.

## Where things are in the client

| What | Where |
|---|---|
| Sister repo (Electron wrapper + dev console) | `~/Projects/plazma-burst-2` (read its `AGENTS.md`; never edit its `game/`; never commit its `data/`) |
| Game client the facts were checked on | `plazma-burst-2/game/scripts/` build v1769098419 ("January 22, 2026 version"). Names are obfuscated and change per build: find code by `grep -n '^case 363:' game/scripts/actions.js`, not by line number |
| Trigger runner | `actions.js`: the function holding `if(…length>2048)` and the big `switch` on action type |
| Map loader (100-action cap) | `frame2.js`: `let …=100; for(i=1;i<=…;i++)` near `actions_` parsing |
| Template replace (F9) | `frame2.js`: function with `for(var key in …)` + `str.split(key).join(…)` |
| Opcode table (all actions, aliases, param kinds) | Public: `https://www.plazmaburst2.com/level_editor/editor_scripts/lib_params.js`. Ready-made snapshot: `plazma-burst-2/data/opcodes.js` (`npm run fetch-opcodes` there regenerates it) |
| Trigger-text parser that already works | `plazma-burst-2/src/features/triggers/script.ts` + `keys.ts` (tokens `( "`, `", "`, `" );`, headers `uid enabled maxcalls`, `op<N>`) |
| Real saved maps (XML examples, 100-action triggers) | `plazma-burst-2/data/maps/*.xml` |
| Community manual | `https://eaglepb2.gitbook.io/pb2-editor-manual` (`.md` after any page URL gives markdown). Says 10 actions per trigger: outdated. Numbers off by one around 348–365 |
| Map editor | `https://www.plazmaburst2.com/level_editor/map_edit.php`: needs a logged-in account (the agent cannot open it; ask the user) |

## The live check

`npm run live-check` (`src/tools/live-check/`) does this; verified 2026-11-02:

1. It builds its own copy of the app in `/tmp/ptc-pb2-live` once (`--rebuild` again): `src`, `editions`, `hooks`, `test` and the package files copied, `node_modules` and `game` linked, `data/names.js` and `data/opcodes.js` copied, no logins. Reason: the sister repo's `dist/` was rebuilt at 09:16 without the dev console, and with that build local maps stayed at "Loading...". The copy is never written back.
2. The map goes to `/tmp/ptc-pb2-live/data/maps/ptc-live.xml` (map ID `local-ptc-live`).
3. `electron . --remote-debugging-port=9333` in the copy; on the launcher page `pb2servers.list().then((list) => pb2servers.play(list.official.id))`.
4. On the game page, wait for `stage.currentFrameLabel === "menu"` (a message during `startup` is ignored), then `window.postMessage("rt:local-ptc-live:sp", "*")` opens Campaign › Choose difficulty.
5. If the game asks "Enter your name" (frame `name_prompt`, when the app profile has no name), type a guest name and press Enter.
6. Press SPACE (Normal); wait for `stage.currentFrameLabel === "gaming"`, then 8 seconds.
7. Read `globalThis[PB2_NAMES.mapVars]`.

By hand with the console edition: `pb2dev.run("vars")`, `pb2dev.run("triggers")`; a single trigger runs with `pb2dev.run("triggers exec <trigger text>")`.

Caution: `pb2dev.run("reset")` clears the user's saved console settings in `plazma-burst-2/data/dev-overrides.json`. Do not run it.

## Trigger text notes

- Some aliases contain spaces, e.g. `next if VarA == ValueB`, `continue if VarA > VarB ` (trailing space). The text emitter writes aliases exactly as the editor does (F14).
- Values are not escaped: `""1""` means the value `"1"` with quotes.
- Whole numbers become numbers when loaded; uids become trigger/region indexes.

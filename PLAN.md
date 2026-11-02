# pb2-trigger-compiler: plan

Compile readable source code into Plazma Burst 2 map triggers.

Output, the end goal, both from the same compile:
1. **XML**: `<trigger …/>` elements a player appends to a downloaded map XML, then loads with the editor's "replace map with XML" (F13).
2. **Trigger text**: one block per trigger, in the map editor's "Edit trigger as text" format, to copy and paste.

Status: M0–M5 done in code, then three review rounds with fixes (2026-11-02). `npm run live-check`: 16 of 16 test programs give the same variables in the game and in the simulator. Left: the website-editor checks of M1 (§4), which need the user.

**New session? Read this file, then `AGENTS.md`, `README.md` and `docs/`, then continue from Status.** Everything learned so far is in here; nothing else carries over.

---

## 1. Facts this design rests on

Each was checked in the game client (`plazma-burst-2/game/scripts/actions.js`, `frame2.js`), not only in the editor descriptions.

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

Action numbers: always the client's. The gitbook manual is off by one around 348–365.

---

## 2. Architecture

```
source ──parse──► AST ──lower──► IR (instructions + labels) ──layout──► triggers ──emit──► XML / text
```

| Stage | Job |
|---|---|
| Opcode table | Snapshot of `lib_params.js` (public): number, alias, param kinds. Plus our own flags: "B is template-replaced" (F9), "compares as string/number" (F8) |
| Front end 1: assembler | One line = one action or pseudo-op. Labels, `jmp`, `jcc`, `call`, `ret` |
| Front end 2: high-level language | Later. Compiles to the same IR |
| Lowering | Pseudo-ops → real actions (e.g. `jne a b L` → `361 a b` + `363 L`) |
| Layout | Every jump target starts a trigger (363 lands only on a trigger start). Split blocks over 100 actions, chain with 363. Fall-through = trailing 363 |
| Names | Variables → `~<prefix>_<name>~` (F9). Triggers → `#<prefix>_<label>`. One prefix per program so two programs in one map never clash |
| Emitters | XML (uid, x/y grid, enabled, maxcalls = -1 unless set) and text. Text emitter refuses values breaking F12 |
| Checker | Static: ≤ 100 actions, every target exists, no 362, loops have a guard (F5) |

Language for the tool: TypeScript on Node (≥ 22.18, runs `.ts` directly), `node:test`, same style rules as `plazma-burst-2/AGENTS.md`.

---

## 3. Testing

1. **Unit + golden files**: parser, lowering, layout, both emitters.
2. **Simulator**: small interpreter of the trigger runner for the actions we emit (frames, 99 push, 363 replace, skip, template replace). Fast tests without the game.
3. **Live check**: `npm run live-check` compiles every program in `examples/live/`, appends all of them to one map, runs it in the game, reads the map variables object (`PB2_NAMES.mapVars` from `plazma-burst-2/data/names.js`) through CDP, and compares every variable of every program with the simulator (type and value). `--simulate-only` skips the game.
4. The simulator must agree with the live check on every test program. Last run: 16 of 16 (2026-11-02).

---

## 4. Milestones

| # | Milestone | Done when | Time |
|---|---|---|---|
| M0 ✅ | Repo setup, opcode snapshot | `npm test` runs; table has all 531 actions | 1–2 h |
| M1 ⏳ | Emitters from hand-built IR | A hand-built 3-trigger program imports as XML **and** pastes as text in the real editor, and runs | ½ day |
| M2 ✅ | Assembler | Labels, jumps, calls, 100-action chaining, name mangling; test programs pass in the simulator | 2–3 days |
| M3 ✅ | Simulator + live harness | Same results in simulator and game for every test program | 1–2 days |
| M4 ✅ | High-level language | `if/else`, `while`, `for each player`, functions, arrays, string ops | 1–2 weeks |
| M5 ✅ | Extras | Loop yield via timers (F5), standard library (contains-in-list, substring), source line comments in output | ongoing |

M1 comes first on purpose: it proves the end goal (import / paste) before any compiler work.

What M4/M5 became: the `.ptc` language in `docs/language.md` (functions with recursion, arrays, `for player`, `wait`, `every`, `on join`, builtins `len contains charAt drop text number floor round random slot initiator name time push say action`), and the assembler in `docs/assembly.md`. Loop yield = `wait(frames)`; source lines = `out/<name>.map.json`.

M1 state: `npm run emit-sample` writes `out/ptc-hello.xml` (elements), `out/ptc-hello.txt` (text blocks), `out/ptc-hello-map.xml` (base map + elements; `--into <map.xml>` uses a downloaded map; `--game-map` also writes `plazma-burst-2/data/maps/ptc-hello.xml`). The game run passed (F17). Left, in the website editor (user):
1. Replace a map with `out/ptc-hello-map.xml`, test it: chat shows `ptc hello: count = 2`.
2. Paste each block of `out/ptc-hello.txt` into a new trigger: the custom `uid:` stays (open question 2).

---

## 5. Assembler (M2)

Done; reference in `docs/assembly.md`. The draft it grew from:

```
start:
    set   $i, 0
loop:
    add   $i, 1
    jgt   $i, 10, @done
    jmp   @loop
done:
    say   "finished"
```

`set`/`add`/`say` map 1:1 to actions; `jgt`/`jmp` lower to 364/363. Any action is also reachable by its alias or `op<N>`.

---

## 6. Open questions

1. ~~**XML import**~~: answered, F13.
2. **Text paste**: format answered (F14). Still open: does the editor keep a *custom* `uid:` (e.g. `#ptc_hello_add`) from pasted text? Jumps between triggers depend on it.
3. ~~**High-level syntax**~~: chose a small C-like language (`docs/language.md`). Say if you want another syntax; only the parser changes.
4. **Variable prefix**: `~<prefix>_name~` is kept: the `~` on both ends stops one name from matching inside another (F9). Still open whether the community uses another convention.
5. ~~**Trigger placement**~~: an option (`Layout` in `src/emit/xml-emitter.ts`: origin, spacing, columns).

---

## 7. Resources

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

### Live check in the game (M3)

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

### Text-format notes

- Some aliases contain spaces, e.g. `next if VarA == ValueB`, `continue if VarA > VarB ` (trailing space). The text emitter writes aliases exactly as the editor does (F14).
- Values are not escaped: `""1""` means the value `"1"` with quotes.
- Whole numbers become numbers when loaded; uids become trigger/region indexes.

---

## Appendix: actions the compiler will use

Generated from the opcode snapshot; numbers are the client's.

| # | Alias in text | A | B | What it does |
|---|---|---|---|---|
| 99 | ExecTrigger | trigger | nochange | Execute trigger 'A' |
| 363 | op363 | trigger | nochange | Switch execution to trigger 'A' |
| 362 | op362 | string | nochange | Switch execution to trigger ID in variable 'A' |
| 19 | TriggerDisable | trigger | nochange | Deactivate Trigger 'A' |
| 20 | TriggerEnable | trigger | nochange | Activate Trigger 'A' |
| 22 | TriggerSetCallsValue | trigger | maxcalls | Set number of remain calls of Trigger 'A' to value 'B' |
| 100 | VarSetValue | string | string | Set variable 'A' value to value 'B' |
| 101 | VarSetValueIfUndefined | string | string | Set variable 'A' value to value 'B' if 'A' is not defined |
| 102 | VarAddValue | string | string | Add value 'B' to value of variable 'A' |
| 103 | VarMultValue | string | string | Multiply value of variable 'A' by value 'B' |
| 104 | VarAddVar | string | string | Add value of variable 'B' to value of variable 'A' |
| 105 | VarMultVar | string | string | Multiply value of variable 'A' by value of variable 'B' |
| 124 | VarSetModuloDivValue | string | string | Set variable 'A' value to remainder after division by value 'B' (only positive numbers) |
| 125 | VarSetVar | string | string | Set variable 'A' value to value of variable 'B' |
| 127 | VarSetModuloDivVar | string | string | Set variable 'A' value to remainder after division by value of variable 'B' (only positive numbers) |
| 131 | VarDivValue | string | string | Divide variable 'A' by value 'B' |
| 132 | VarDivVar | string | string | Divide variable 'A' by value of variable 'B' |
| 152 | AddString | string | string | Add string-value of variable 'B' at the end of string-value of variable 'A' |
| 151 | CountLength | string | string | Set value of variable 'A' to length of string-value of variable 'B' |
| 149 | SetIsAContainsValueB | string | string | Set value of variable 'A' to 1 if string-value of variable 'A' contains string-value 'B' and to 0 in else case |
| 150 | SetIsAContainsVarB | string | string | Set value of variable 'A' to 1 if string-value of variable 'A' contains string-value of variable 'B' and to 0 in else case |
| 294 | VarSetValueOfVarNamed | string | string | Set value of variable 'A' to value of variable with name of string-value of variable 'B' |
| 342 | op342 | string | string | Set value of variable in variable 'A' to value of variable 'B' |
| 325 | op325 | string | string | Replace variables with their values in string-value of variable 'B' and save result to variable 'A' |
| 123 | next if VarA == ValueB | string | string | Skip next trigger action if value of variable 'A' does not equals value 'B' |
| 361 | op361 | string | string | Skip next trigger action if value of variable 'A' is equal to the value of variable 'B' |
| 364 | op364 | string | string | Skip next trigger action if value of variable 'A' is greater than value of variable 'B' |
| 365 | op365 | string | string | Skip next trigger action if value of variable 'A' is less than value of variable 'B' |
| 110 | continue if VarA > VarB | string | string | Continue trigger actions execution only if variable 'A' is greater than variable 'B' |
| 111 | continue if VarA < VarB | string | string | Continue trigger actions execution only if variable 'A' is less than variable 'B' |
| 112 | continue if VarA == VarB | string | string | Continue trigger actions execution only if variable 'A' equals variable 'B' |
| 113 | continue if VarA != VarB | string | string | Continue trigger actions execution only if variable 'A' does not equals to variable 'B' |
| 114 | continue if VarA > ValueB | string | string | Continue trigger actions execution only if variable 'A' has greater value than value 'B' |
| 115 | continue if VarA < ValueB | string | string | Continue trigger actions execution only if value of variable 'A' is less than value 'B' |
| 116 | continue if VarA == ValueB | string | string | Continue trigger actions execution only if value of variable 'A' equals value 'B' |
| 117 | continue if VarA != ValueB | string | string | Continue trigger actions execution only if value of variable 'A' does not equals to value 'B' |
| 349 | op349 | string | string | Split variable 'A' by string-value 'B' |
| 350 | op350 | string | string | Get index 'B' of variable 'A' and store into variable 'A' |
| 352 | op352 | string | string | Add element 'B'(can be variable) to array 'A' |
| 354 | op354 | string | nochange | Create array at variable 'A' |
| 399 | op399 | string | string | Split variable 'A' by value of variable 'B' |
| 405 | op405 | string | string | Join variable 'A' by value of variable 'B' |
| 372 | op372 | string | string | Remove beginning 'A' characters from variable 'B' (-/+) |
| 42 | ShowText | string | textmsg | Show text 'A' in chat with color 'B' |
| 508 | op508 | string | nochange | Get all active player slots and save result to Array 'A' |
| 185 | op185 | string | string | Set value of variable 'A' to displayed name of player with slot 'B' |
| 188 | op188 | string | string | Set value of variable 'A' to displayed name of player with slot-value of variable 'B' |
| 137 | SetACurrentPlayerSlot | string | string | Set value of variable 'A' to slot of current player |
| 180 | op180 | string | nochange | Set value of variable 'A' to player-initiator slot |
| 228 | op228 | trigger | nochange | Call trigger 'A' each time new player joins the match |
| 288 | op288 | trigger | string | Bind Trigger 'A' execution to key 'B' press event |
| 25 | TimerEnable | timer | nochange | Activate Timer 'A' |
| 26 | TimerDisable | timer | nochange | Deactivate Timer 'A' |
| 27 | TimerSetFrequency | timer | int | Set the frequency of calls of Timer 'A' to value 'B' |

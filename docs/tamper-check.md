# Tamper check

`--tamper-check` (CLI) or "Tamper check" (web page, Settings › Protection) builds checks into the
program so that the map notices when a player changes it while playing, and stops its scripts when
that happens. The case in mind is a desktop helper tool that can run any trigger at any time, set
any variable and turn triggers and timers on or off.

```
npm run compile -- game.ptc --tamper-check enforce --obfuscate-seed release-3
```

This does not make cheating impossible. The player's machine runs the whole game, so every check is
visible to someone who studies it. The goal is to make cheating slow, to give the analyst less to
work with, and to never stop the game for an honest player.

| Who changes the game | What they can do | What the checks do |
|---|---|---|
| A helper tool | run triggers, set variables, turn triggers and timers on or off (19, 20, 25, 26), set call counts (21, 22, 46) | notice most of it: the tool cannot change the actions themselves |
| Script access (dev console, a changed client) | anything, also editing actions | only slow it down |

F-numbers such as (F52) point to [game-facts.md](game-facts.md).

## Options

| Option | Effect |
|---|---|
| `--tamper-check <mode>` | `off` (default): nothing is added, the build is the same as without the option. `report`: findings are counted, `on tamper { }` runs after each new one, nothing stops. `enforce`: on firm evidence, a delay, then `on tamper { }`, then the program turns itself off |
| `--tamper-seed <s>` | seed for the token, mask and delay values. Default: the obfuscation seed with `--obfuscate`, else a new random seed, printed at each build (`random` asks for one too). The web page uses the obfuscation seed, the name seed or the prefix |
| `--tamper-layers <list>` | the checks to add, comma separated: `flow,entry,value,watchdog` (default: all). For finding a false alarm: turn layers off one at a time |

It works with or without `--obfuscate`, and is stronger with it: names and texts then do not show in
the XML, and the flow tokens are computed from the obfuscation check value. It works only with
`--target triggers`; with `--target pcode` it is an error (one dispatch trigger runs every p-code
handler, so a jump cannot carry a token).

Use `report` first, with real players, to find false alarms. The compiler prints the name of the
findings variable (`Tamper check: findings are counted in ~game:tc.findings~ ...`), which the dev
console or the host map can read.

## The checks

| Layer | What it adds | What it notices | Strength |
|---|---|---|---|
| `flow` | every jump and call into one of the program's own triggers sets a token to the target's number; the target checks it first and spends it | a trigger of the program run outside the program's own flow | firm |
| `entry` | `on start` runs once; a timer target checks with 454 that its timer's counter is 0, which holds only while the timer runs it (F52); a `wait` continuation also checks that its `wait` started | a second start, a timer target or `wait` continuation run directly | firm |
| `value` | `protected var` (below): a mirror and a moving mask follow every write; every read checks them | a protected variable set from outside | firm |
| `watchdog` | a check timer every 150 frames (about 5 seconds, F50) records a heartbeat; the program's fastest `every` block (at most 75 frames) counts its runs between heartbeats; other entries (`on join`, `on chat`, exported functions) check that the last heartbeat is less than a minute old | the check timer turned off (partner counts too high), the partner timer turned off (no runs between heartbeats), all timers turned off (old heartbeat) | soft |

The entries that the game or a host map calls (`on start`, `every`, `on join`, `on chat`,
`export function`, functions used as `@f`) take no token: the game calls them. Region, death and chat
triggers get no entry check: the game offers no action that tells which event started a trigger, and
the initiator and chat values are never cleared (F54).

The timer checks compare timers with timers, not with the clock: timers stop during a pause, slow
down under Time Warp or at low frame rates, and all by the same amount (F50, F51). Only the
heartbeat age at events uses the wall clock (348), with a minute of margin; it can fire once after
a long pause, and at most once per minute.

### Protected values

```
protected var gold = 100;

on chat {
  gold += 10;
  say("gold: {gold}");
}
```

- `protected` is a word only before `var` (and `export var`, which is refused); elsewhere it is an
  ordinary name.
- Every write also moves a mask on by a seeded step and writes `mirror = gold + mask`; every read
  (also `{gold}` in `say`) first checks `gold + mask == mirror`. The arithmetic is the same on both
  sides, so number and text values both work.
- Refused, because something outside the program's code would write the value: `export var`,
  arrays, `sync(gold)`, `action(..., gold, ...)` (also `{gold}` in an action's text) and map block
  triggers that use it.
- Without `--tamper-check` (or without the `value` layer), `protected` changes nothing and the
  compiler warns that nothing checks the value.

## Findings and the reaction

| Kind | `tamperFinding()` | Strength | Meaning |
|---|---|---|---|
| flow | 1 | firm | flow token mismatch |
| value | 2 | firm | protected value mismatch |
| start | 3 | firm | `on start` ran twice |
| timer | 4 | firm | a timer target ran while its timer's counter was not 0 |
| wait | 5 | firm | a `wait` continuation ran without its `wait` |
| stalled | 6 | soft | the partner `every` block ran too often without a heartbeat |
| idle | 7 | soft | a heartbeat came with no partner run since the last one |
| late | 8 | soft | an event saw a heartbeat older than a minute |

`tamperFinding()` gives the kind of the last finding and `tamperCount()` the number of findings.
Each finding also turns the check timer back on, so that turning it off does not stop the reaction.

In `report`, the check timer runs `on tamper { }` once after each new finding (as its own event, at
the next heartbeat). Nothing else changes.

In `enforce`, a firm finding is proof; soft findings count as proof when 3 come within a minute.
Then:

1. The program marks the session and waits a delay picked from the seed (20 to 90 seconds of wall
   time), so the effect is not next to its cause.
2. At the next heartbeat after the delay, `on tamper { }` runs (for example a message).
3. The program sets every variable it made to 0 (user variables, internal ones, also the
   obfuscation ones), turns off every trigger the game or a host map calls and every timer of the
   program. The tamper state itself is kept at "done", so the entries stay stopped even if a tool
   turns them on again.
4. `export var` values (and an exported array's elements and length) and `extern` names are never
   touched: the host map and other programs keep working. Array elements with a changing index are
   not reset (their names are computed while the map runs).

Restarting the match is not possible in multiplayer (307 is single player only), so the program
turns off only itself. `wait()` is refused in `on tamper { }`: in enforce, the program is off right
after the block.

## Cost

Measured in the simulator on the examples (`examples/live`, `examples/tutorial`, `examples/syntax`,
60 frames, 2026-11-03), compared with the plain build:

| Layers | Actions run | Program size |
|---|---|---|
| `flow` | 1.5× (median 1.4×, up to 2.3×) | 1.6× |
| `entry` | about the same (up to 3.5× for a program that only runs a few timer actions) | 1.2× |
| `watchdog` | about the same | 1.1× |
| `value`, every top-level `var` protected | 1.1× (up to 4× for a program that mostly reads and writes them) | 1.25× |
| all | 1.5× to 1.6× (median 1.6×–1.9×) | 1.8× to 2× |

Per check: 1 action at each jump or call into an own trigger and 4 at the start of each such trigger
(5 with `--obfuscate`); 4 at each read of a protected value and 3 after each write; 4 to 9 at the
start of a timer target, 6 at the start of other entries; in `enforce`, 2 more at every entry. The
program gets about 10 to 25 small triggers of its own (finding handlers, the check timer's trigger,
the reaction) and one timer.

## False alarms

The rules the checks were built to:

- `src/tamper/tamper.test.ts` runs every example in `examples/live`, `examples/tutorial` and
  `examples/syntax` in `report` and `enforce`, plain and obfuscated, with every top-level `var` that
  can be protected made `protected`, and requires zero findings and the same chat, errors and
  variables as the plain build. It also runs them in `enforce` with timers at 0.4 and 2 times their
  speed (the lag test).
- A loop stopped by the loop guard gives no finding.
- `npm run live-check -- --tamper-check report` and `-- --tamper-check enforce --obfuscate` run
  the examples in the real game: verified 2026-11-03, 60 of 60 matching in both, with zero findings.

## Limits

- Multiplayer: every player's game runs its own triggers, and a changed client can write any
  variable or run any trigger on the other players' games (F53). Such a player can make the
  checks fire on an honest player's game. `enforce` is tested in single player only.
- Single-player chat cheats that change the game speed, and Time Warp, slow or speed up all timers
  together, so they give no finding.
- A tool that knows the checks can pass them: set the token before running a trigger, write the
  mirror with the value, keep the heartbeat going. That takes study of the map, which is the point.
- Kind B (script access) can remove the checks; `--obfuscate` makes that slower.
- Functions called by a host map and region, death and chat triggers are legitimate outside callers:
  they are never a finding by themselves.
- A host map or another program that reads a protected value reads it without the check.

## Tests

`src/tamper/tamper.test.ts` also covers: the build with `off` is the same byte for byte; the same
seed gives the same build; each layer adds its actions only when asked; the refused combinations; a
helper tool that runs an internal trigger, sets a protected value, turns off the check timer or the
partner timer, runs a timer target, a second start or a `wait` continuation directly; `enforce`
reaching the reset after the delay and `report` never resetting; the CLI help. The web page tests
cover the setting and its chip.

Code: `src/tamper/` (`tamper.ts` the passes and the machine triggers, `protect.ts` the protected value
actions for the code generator, `options.ts` the option parsing), hooks in `src/compiler/compile.ts`,
`src/compiler/layout.ts` (the layout control's `enter` and `call`) and `src/lang/codegen.ts`.

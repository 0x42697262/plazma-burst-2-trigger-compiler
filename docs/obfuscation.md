# Obfuscation

`--obfuscate` (CLI) or the "obfuscate" box (web page) builds a program so that the map file is
hard to read and a changed copy stops working. It is the same kind of tool as a JavaScript
minifier: it renames and restructures the program's own content. Everything is on at once; there
are no per-part options.

```
npm run compile -- game.ptc --obfuscate-seed release-3 --into map.xml --replace
```

| Option | Effect |
|---|---|
| `--obfuscate` | turn it on; the seed is the `--name-seed` if given, else the prefix |
| `--obfuscate-seed <s>` | turn it on with this seed. The same seed gives the same build; a new seed per release changes every generated name, so two releases do not line up |

Unless `--prefix` or `--name-seed` is given, the prefix also comes from the seed (`z...`, like
`--name-seed`). `--replace` with the `.build.json` record updates a map in place across seeds.

## What it does

| Part | In the map | Run-time cost |
|---|---|---|
| Names | variables, internal names and trigger uids become short seeded tokens: `~zab12_count~` becomes `~zab12_qf~` | none |
| Texts | every text value, compared text and `say` text is stored once, encoded, and decoded into variables at map start | once, at start |
| Control flow | the triggers are shuffled; every jump sets a state value and goes through one dispatch trigger that computes the target index with action 362 from the state, a per-trigger running value, the check value, the block size and its first index | 7 actions per jump |
| Action grouping | some actions move into shared triggers where each runs only if a selector, computed from the check value, matches; rows with selectors that never match sit beside them | about 10 actions per moved action |
| Fixed-outcome checks | tests computed from the check value that always skip, followed by a jump or an action that never runs | 3 actions each |
| P-code | with `--target pcode`: the handlers are shuffled and the code text stores handler numbers shifted by the check value | 2 actions per instruction |
| Integrity check | see below | 5 actions per entry run |

Measured in the simulator on the examples: loops run about 2.5 to 3.5 times as many actions as the
plain build, and the program has about 2 to 2.5 times as many actions. Map start costs about 20
actions per distinct character of the texts.

Kept as they are, or host maps break: `export var` names (and an exported array's elements and
length), `export function` uids with their parameters and return value, `extern` host names, object
uids, and `.entry` labels in `.pasm`.

## Integrity check

At map start (the first time any entry runs) the program:

1. decodes its texts and folds a checksum of the decoding steps and the text lengths into a check
   value;
2. reads the index of its first and last trigger and computes how many triggers lie between them.

If either differs from what the compiler worked out, the chat shows "This map was changed after it
was published. Its scripts are turned off." and every entry stops right after the check. Every
dispatched jump, every grouped action and every fixed-outcome check also uses the check value and
the trigger count, so removing the message or the stop alone does not bring the map back: jumps
land in the wrong trigger.

What it catches: adding or removing a trigger inside the program's block, moving triggers, and
changing an encoded text (for example a credit or license line, or a stored password hash).
Deleting a running-value update inside a trigger makes that trigger's jumps land wrong.

What it does not catch: an edit that keeps every computed value the same (for example removing a
comparison but keeping all other actions), a trigger added outside the block that acts directly
(for example opens a door), or someone who works out the check value and sets it. The goal is that
a casual editor cannot quietly strip a credit or a check and republish, not that the map cannot be
broken.

## What it cannot hide

- Action numbers and object uids (doors, regions, characters) and their positions.
- What players see: a text is readable when it is shown.
- Behavior: anyone can run the map in a simulator or the dev console and record which actions run
  and how variables change. Obfuscation only affects reading the file; code that never runs stays
  unseen until something runs it.
- The method: the compiler is public. Each seed gives other names, other jump values and other
  encodings, so understanding one map means studying that map.

## Files

| File | What it is |
|---|---|
| `<name>.names.json` | the seed, the prefix and every generated name with the source name it stands for. Keep it private: it undoes the renaming |
| `<name>.map.json` | source lines per action, as usual (under the generated uids) |
| `<name>.txt` | trigger text. The jumps depend on trigger order, so create the triggers in the listed order, after all other triggers. The XML keeps the order by itself |

## Limits

- The program's triggers must stay together and in order in the map. `--into` appends them that
  way; triggers added to the map later go after them and do no harm.
- A `say` text that writes a host variable's name inside its literal text (not through `extern`)
  no longer has that name replaced (F9): only the program's own variables and its externs are kept
  as names.
- A text that shows `<`, `>` or `"` keeps that part unencoded (the game only decodes them in the
  shown text, F41).
- A secret written into a text is still reported (the compiler checks the decoded texts too).

## Checks

- `src/obfuscate/obfuscate.test.ts` runs every example in `examples/live`, `examples/tutorial` and
  `examples/syntax` plain and obfuscated, with both targets, and compares chat, errors and the
  program's variables (mapped back to their source names). It also checks reproducibility, that
  names and texts are gone from the XML, exports, host triggers before the program, the 99-action
  limit, secrets, and the alarm after a removed trigger, a removed p-code handler and a changed
  text.
- `npm run live-check -- --obfuscate` runs the examples in the game. Verified 2026-11-02: 57 of 57
  (also with `--direct-index`). With `--pcode`: 57 of 57 in three runs (`--only examples/live/`,
  `--only examples/tutorial/0 --only examples/tutorial/1`, `--only examples/tutorial/2 --only
  examples/syntax/`); with all 57 in one map, the first frame runs about 2 million actions and 32000
  scans of 32000 variables (action 350, F37), and the timer programs run out of time, as for plain
  p-code.

Code: `src/obfuscate/` (`texts.ts` encodes texts, `init.ts` builds the start routine and the check
plan, `flow.ts` the jump, grouping and fixed-outcome passes, `obfuscate.ts` ties them together),
`src/compiler/names.ts` (short names), hooks in `src/compiler/layout.ts` and `src/pcode/pcode.ts`.

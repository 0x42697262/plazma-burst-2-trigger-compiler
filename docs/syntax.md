# Learn the syntax

A short tour of the `.ptc` language, one idea per section. Every example is a file in
[`examples/syntax/`](../examples/syntax/), and a test runs each one and checks the output shown
here. Run one yourself:

```
npm run compile -- examples/syntax/02-values.ptc --run
```

When you know the syntax, the [tutorial](tutorial.md) builds real programs, and the
[reference](language.md) lists every rule.

## Contents

1. [The shape of a program](#1-the-shape-of-a-program)
2. [Values and variables](#2-values-and-variables)
3. [Operators](#3-operators)
4. [Choosing and repeating](#4-choosing-and-repeating)
5. [Functions](#5-functions)
6. [Arrays and dictionaries](#6-arrays-and-dictionaries)
7. [Map objects and named values](#7-map-objects-and-named-values)
8. [Events and time](#8-events-and-time)
9. [Files and sharing](#9-files-and-sharing)
10. [Common mistakes](#10-common-mistakes)

## 1. The shape of a program

<!-- file: 01-shape.ptc -->
```ptc
// A program is a list of declarations. Code runs inside blocks such as "on start".
// Comments start with // or sit between /* and */.

var greeting = "hello";   /* a global variable */

on start {
  say(greeting);           // every statement ends with ;
  say("from the map");
}
```
```
hello
from the map
```

- At the top level a file only declares things: variables, constants, functions, map objects,
  event blocks such as `on start { ... }`. Statements (`say(...)`, assignments, loops) live
  inside blocks `{ }`.
- Every statement ends with `;`. Spaces and line breaks do not matter.
- Text is in double quotes only: `"hello"`.

## 2. Values and variables

<!-- file: 02-values.ptc -->
```ptc
// Values: numbers, text, true/false. No type names: a variable holds whatever you put in it.
var count = 3;             // global: lives for the whole map
const LIMIT = 10;          // constant: written into the actions, never changes
var label = "items";

on start {
  let half = count / 2;    // local: lives in this block
  let flag = true;         // true is 1, false is 0
  let nothing;             // no value yet
  say("{count} {label}, half is {half}, limit {LIMIT}, flag {flag}");
  say("text and numbers mix: " .. count .. " + 1 = " .. (count + 1));
  label = 42;              // the same variable can hold a number later
  say("label is now {label}");
}
```
```
3 items, half is 1.5, limit 10, flag 1
text and numbers mix: 3 + 1 = 4
label is now 42
```

| Declaration | Lives | Changes |
|---|---|---|
| `var name = value;` (top level) | the whole map | yes |
| `let name = value;` (in a block) | until the block ends | yes |
| `const NAME = value;` | the whole program | no; written into the actions |

- There are no type names. A value is a number (`3`, `1.5`, `-2`), text (`"items"`), or `true` /
  `false` (which are `1` and `0`). A variable can hold any of them, one after the other.
- `{expression}` inside text inserts a value; `..` joins text.
- A variable that is never set has no value; give every variable a starting value.

## 3. Operators

<!-- file: 03-operators.ptc -->
```ptc
// Operators, from lowest to highest precedence:
//   ||   &&   == != < <= > >=   ..   + -   * / %   unary - !
on start {
  say("2 + 3 * 4 = {2 + 3 * 4}");
  say("(2 + 3) * 4 = {(2 + 3) * 4}");
  say("7 / 2 = {7 / 2}, 7 % 2 = {7 % 2}");
  say("the text 4 plus 1 = {"4" + 1}: text is read as a number");
  say("a joined with 1 = {"a" .. 1}");
  say("5 equals the text 5: {5 == "5"}; 3 is less than 5: {3 < 5}");
  say("true and false: {true && false}; not false: {!false}");
  let total = 10;
  total += 5;
  total *= 2;
  let word = "ab";
  word ..= "c";
  say("total {total}, word {word}");
}
```
```
2 + 3 * 4 = 14
(2 + 3) * 4 = 20
7 / 2 = 3.5, 7 % 2 = 1
the text 4 plus 1 = 5: text is read as a number
a joined with 1 = a1
5 equals the text 5: 1; 3 is less than 5: 1
true and false: 0; not false: 1
total 30, word abc
```

| Operator | Does |
|---|---|
| `+ - * / %` | arithmetic; text is read as a number (`"4"` is 4) |
| `..` | joins text: `"a" .. 1` is `"a1"` |
| `== !=` | compare as text: `5 == "5"` is true |
| `< <= > >=` | compare as numbers |
| `&& \|\| !` | and, or, not; the right side runs only when needed |
| `= += -= *= /= %= ..=` | assign; `x += 5` is `x = x + 5` |

Comparisons give `1` or `0`. Parentheses change the order. In chat text, write words instead of
`"`, `<`, `>` and `&`: text built while the map runs shows them as `&quot;`, `&lt;`, `&gt;`,
`&amp;` (a game rule, F26).

## 4. Choosing and repeating

<!-- file: 04-control.ptc -->
```ptc
// Choosing and repeating: if / else if / else, while, for, break, continue, match.
on start {
  let score = 72;
  if (score >= 90) { say("A"); } else if (score >= 70) { say("B"); } else { say("C"); }

  let n = 1;
  while (n < 100) { n *= 3; }
  say("first power of 3 from 100: {n}");

  let odds = "";
  for (let i = 0; i < 10; i += 1) {
    if (i == 7) { break; }
    if (i % 2 == 0) { continue; }
    odds ..= i .. " ";
  }
  say("odd numbers before 7: {odds}");

  let command = "-hi";
  match (command) {
    "-hi", "-hello" => say("hello!");
    "-bye" => say("bye!");
    _ => say("unknown {command}");
  }
}
```
```
B
first power of 3 from 100: 243
odd numbers before 7: 1 3 5 
hello!
```

- `if (condition) { } else if (condition) { } else { }`: the braces are required.
- A condition is false when it is `0` or empty text; anything else is true.
- `while (condition) { }` repeats while it holds; `for (start; condition; step) { }` is the
  counting form.
- `break` leaves the loop; `continue` goes to its next round.
- `match (value) { pattern => statement; ... _ => statement; }` picks the first arm whose pattern
  equals the value (as text). Patterns are fixed values; `_` is "anything else" and comes last.
- A loop that never ends would freeze the game; the compiler adds a guard that stops it after
  100000 rounds per event.

## 5. Functions

<!-- file: 05-functions.ptc -->
```ptc
// Functions: parameters, return values, recursion. "export" gives a fixed trigger uid.
function area(width, height) {
  return width * height;
}

function factorial(n) {
  if (n <= 1) { return 1; }
  return n * factorial(n - 1);
}

function greet(name) {
  say("hi {name}");
}

export function button() {
  say("someone pressed the button");
}

on start {
  say("area {area(3, 4)}, 5! = {factorial(5)}");
  greet("ann");
}
```
```
area 12, 5! = 120
hi ann
```

- `function name(parameters) { ... }`; `return value;` gives a result, `return;` just ends.
  A function without `return value` gives empty text.
- Functions may call themselves (recursion), as `factorial` does.
- `export function` gets the fixed trigger uid `#<prefix>_<name>`: set it as a region's
  "Activation Trigger" in the editor and the function runs when a player uses the region.
- Functions see the global variables; their parameters and `let` variables are their own.

## 6. Arrays and dictionaries

<!-- file: 06-arrays.ptc -->
```ptc
// Arrays (lists): push, pop, len, clear, list[i]. Text indexes make dictionaries.
var list[];
var ages[];

on start {
  push(list, "a");
  push(list, "b");
  push(list, "c");
  list[1] = "B";
  say("{len(list)} items: {list[0]} {list[1]} {list[2]}");
  say("popped {pop(list)}, {len(list)} left");
  clear(list);
  say("after clear: {len(list)}");

  ages["ann"] = 31;
  ages["bob"] = 27;
  say("bob is {ages["bob"]}");
}
```
```
3 items: a B c
popped c, 2 left
after clear: 0
bob is 27
```

| Write | Does |
|---|---|
| `var list[];` | declares an array (top level only) |
| `push(list, v)` / `pop(list)` | add to the end / take from the end |
| `list[i]` / `list[i] = v` | read / write element `i` (from 0) |
| `len(list)` / `clear(list)` | count / empty |
| `ages["bob"] = 27` | a text index: the array works as a dictionary |

## 7. Map objects and named values

<!-- file: 07-map-objects.ptc -->
```ptc
// Map objects: a map { } block creates them while compiling; a declaration outside one names
// an object the map already has. Both are used in action(...).
// Named values (Color.*, Team.*...) come from the editor's own lists.
region spawn = "#spawn";                 // the map already has it
map {
  exits = [];
  for (let i = 1; i <= 3; i += 1) {
    push(exits, Region("#exit{i}", x: i * 200, y: -100, w: 60, h: 100));
  }
  guard = Actor("#guard", team: Team.BlueTeam, botaction: DoNothing);
  guard.x ?= 0;                          // only when created: drag it freely afterwards
  Wall(0, 0, 1000, 30, m: DarkPlate);
}
const BIG = 500;
var color = Color.NoirLime;   // never changes, so it counts as a fixed value

export function heal() {
  action(SetCharHP, guard, BIG);
  say("healed", color);
}

export function leave(which) {
  action(TeleportInitiatorFromTo, spawn, exits[which]);
}

on start {
  say("{len(exits)} exits", Color.Proxy);
}
```
```
3 exits
```

- Declare each map object with its kind and uid: `region`, `door`, `player` (a player slot),
  `actor` (any other character), `gun`, `barrel`, `vehicle`, `decor`, `pusher`, `light`, `water`, `timer`, `trigger`. `at x, y` is where the
  compiler puts it if the map lacks it (with `--into`).
- `exits[]` is an object array; `exits[which]` picks one, even with a changing index.
  A range writes many uids at once: `door doors[] = ["#door*{0..9}", "#Bullet*{1..6}"];` is 16
  doors, and `doors[10]` is `#Bullet*1`.
- `action(name or number, a, b)` runs any game action; [actions.md](actions.md) lists all 531 and
  what each parameter takes. Passing the wrong kind is a compile error, like a strict cast.
- `Color.NoirLime`, `Team.RedTeam`, `Behavior.FollowThePlayer` are named values from the editor's
  lists. Places such as a `say` color need a fixed value: a literal, a named value, a constant, or
  a variable that never changes (`color` here).

## 8. Events and time

<!-- file: 08-events.ptc -->
```ptc
// Events and time: on start, on chat, on join, every N frames, wait(frames).
var ticks = 0;
var steps = "";

on start {
  steps = "a";
  wait(3);
  steps ..= "b";
}

on chat {
  say("{talkerName()} said {chatText()}");
}

every 10 {
  if (ticks < 3) { ticks += 1; }
}
```

After a player named `ann` writes `hello`: `ann said hello`. After 40 frames, `ticks` is 3 and
`steps` is `ab`.

| Block | Runs |
|---|---|
| `on start { }` | once, when the map starts |
| `on chat { }` | for every chat line; `chatText()`, `talker()`, `talkerName()` say what and who |
| `on join { }` | each time a player joins |
| `every 30 { }` | every 30 frames |
| `wait(frames);` | inside `on` and `every` blocks: continue later |

Everything between two waits runs inside one game frame.

## 9. Files and sharing

<!-- file: 09-files.ptc -->
```ptc
// Files and sharing: import another file, export variables, use the host map's variables.
import "lib/greetings.ptc";

export var score = 0;    // meant to be read by the host map
extern lives;            // the host map's own variable "lives"

on start {
  score = 10;
  lives = 3;
  say(shout("score {score}, lives {lives}"));
}
```
<!-- file: lib/greetings.ptc -->
```ptc
// A small library: imported by 09-files.ptc.
function shout(text) {
  return text .. "!";
}
```
```
score 10, lives 3!
```

- `import "file.ptc";` adds another file's declarations; the path is relative to this file.
- `export var` marks a variable that the host map (or another program) may read or write.
- `extern lives;` is the host map's own variable `lives`, used by its own name.

## 10. Common mistakes

<!-- file: 10-mistakes.ptc -->
```ptc
// Ten common mistakes are shown in the syntax guide with the compiler's message.
// This file compiles: it shows the fixed version of each.
const RED = "#FF0000";
var list[];

function double(x) { return x * 2; }

on start {
  let total = 0;            // declare before use
  total = double(4);        // a function with one parameter gets one argument
  push(list, total);        // arrays are used through push, list[i], len
  say("total {total}", RED); // the color is a fixed value
  say("first {list[0]}");
}
```
```
total 8
first 8
```

What the compiler says for the usual slips, and the fix:

| You write | The compiler says | Fix |
|---|---|---|
| `total = 1;` (never declared) | `unknown variable "total"` | `let total = 1;` or `var total = 1;` |
| `double(1, 2)` for `double(x)` | `"double" takes 1 argument(s), got 2` | pass one argument |
| `list = 5;` for `var list[];` | `the array "list" cannot be used as a value; use list[i] or len(list)` | `list[0] = 5;` or `push(list, 5);` |
| `say("hi", c)` with a changing `c` | `the color of say(...) must be a fixed value: ...` | `const C = 2;` or `Color.NoirLime` |
| `say('hi');` | `unexpected character "'"` | double quotes: `"hi"` |
| `say("hi") }` | `expected ";", got "}"` | end the statement with `;` |
| `action(SetCharHP, spawn, 100)` with `region spawn` | `action 23 takes character as A, but "spawn" is a region` | pass a `player` or `actor` |
| `say("hi", Team.RedTeam)` | `action 42 takes textmsg as B, not a Team value` | a `Color` value |
| `wait(30);` in a function | `"wait" works only in "on" and "every" blocks, not in functions` | move the wait into the event block |

Errors give the line (and the file, for imported files). `while (true) { }` is not an error: the
loop guard stops it.

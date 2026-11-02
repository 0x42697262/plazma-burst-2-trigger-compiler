# The .ptc language

A program is a list of declarations. Statements end with `;`. Comments: `//` and `/* */`.

```
var count = 0;
var scores[];
const LIMIT = 10;
extern score;

function add(points) {
  push(scores, points);
  return len(scores);
}

on start {
  while (count < LIMIT) { count += 1; }
  say("count: {count}");
}
```

## Declarations

| Form | Meaning |
|---|---|
| `var x;` / `var x = expr;` | global variable, set at map start |
| `var list[];` | array (see below) |
| `const NAME = 5;` | constant: a number, text, `true` or `false`; written into the actions |
| `extern score;` / `extern s = "host name";` | a variable of the host map, used by its own name |
| `function f(a, b) { ... }` | function |
| `export function f() { ... }` | function with a stable uid `#<prefix>_f`, for the map's own triggers and regions |
| `on start { ... }` | runs at map start (a start timer); several blocks run in order |
| `on join { ... }` | runs each time a player joins (action 228) |
| `every 30 { ... }` | runs every 30 frames (a timer) |

## Statements

`let x = expr;`, `x = expr;`, `x += expr;` (also `-=`, `*=`, `/=`, `%=`, `..=`),
`if (c) { } else if (c) { } else { }`, `while (c) { }`, `for (let i = 0; i < n; i += 1) { }`,
`for player p { }`, `break;`, `continue;`, `return expr;`, `wait(frames);`, `{ ... }`.

## Expressions

| Operators | Meaning |
|---|---|
| `+ - * / %` | numbers (text is read as a number, like `parseFloat`) |
| `..` | joins text: `"a" .. 1` is `"a1"` |
| `== !=` | compare as text: `5 == "5"` is true |
| `< <= > >=` | compare as numbers; text that is no number compares false for `<` and `>` |
| `&& \|\| !` | logic with short-circuit |
| `"x = {x + 1}"` | text with values inside `{ }` |

A condition is false when its value is `0` or empty text. Comparisons used as values give 1 or 0.

## Builtins

| Builtin | Gives |
|---|---|
| `say(text)` / `say(text, color)` | shows text in the chat; color as in action 42 |
| `len(x)` | length of text, or the element count of an array |
| `contains(text, part)` | 1 or 0 |
| `charAt(text, i)` | the character at `i` |
| `drop(text, n)` | text without the first `n` characters (`n` < 0: without the last); `n` must be a number literal |
| `text(x)`, `number(x)` | x as text, x as a number |
| `floor(x)`, `round(x)`, `random(n)` | `random(n)`: whole number 0 .. n-1 |
| `slot()`, `initiator()`, `name(slot)`, `time()` | current player slot, player-initiator slot, displayed name, milliseconds since the game started (the simulator counts frames) |
| `push(list, value)` | adds to the end of an array |
| `action(op, a, b)` | any action, by number or alias. A name argument gives that variable's game name, `@f` gives function `f`'s uid, text gives itself; `{x}` inside text gives x's game name |

## Arrays

`var list[];` declares an array. `list[i]` reads and writes element i, `push(list, v)` appends,
`len(list)` counts. Elements are game variables named `~<prefix>_list[i]~`, so they can be set
and read with any index. Arrays are global and cannot be passed as values.

## Functions

Parameters and locals are game variables of their own (`~<prefix>_f.a~`), so a function's
values stay after it returns. Recursion works: before a call that can come back into the same
function, its variables are saved on a stack in game variables (cost: 3 actions per variable
per call, both ways). Calls deeper than 2048 are skipped by the game (F3).

## Timing

`wait(frames)` stops the block and continues after that many frames (a timer per `wait`). It
works only in `on` and `every` blocks, not in functions. Everything else in a block runs in one
game frame. Each event may jump back at most `--guard` times (default 100000); then its loops stop.

## Limits

- `for player p` uses action 508, which lists only players with a login: it lists nobody in single
  player (F25), and a slot of 10 or more reads as two slots (F10).
- A game variable whose name appears inside a text that is shown, or used with `{ }`, is replaced
  by its value (F9). Avoid short variable names in the host map.
- Whole numbers written as text load as numbers; `"007"` stays text (F18).

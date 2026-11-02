# The .ptc language

F-numbers such as (F9) point to [game-facts.md](game-facts.md).

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

## Values and types

The language has no type declarations, and a variable needs none. Every value is a game variable,
and the game stores whatever JavaScript value an action puts there. Each operator decides how it
reads its operands:

| Kind of value | How it appears | Read as |
|---|---|---|
| number | `5`, `-3`, `2.5`, results of `+ - * / %`, `len`, `random` | `+ - * / % < >` read numbers (text like `parseFloat`) |
| text | `"abc"`, results of `..`, `chatText()`, `name(slot)` | `..` and `== !=` read text (`5 == "5"` is true) |
| boolean | none of its own: `true` is 1, `false` is 0; comparisons give 1 or 0 | false is `0` or empty text |
| no value | a variable never set, an array element never written | `undefined`: NaN in arithmetic, `"undefined"` in `..` |

Types are not needed because nothing needs to know them ahead of time: the game keeps one table of
variables with no types, every action reads the variable it names in its own way, and the
compiler picks the action from the operator (`+` makes "add", `..` makes "append text"). The cost:
mistakes show up when the program runs (`"abc" + 1` is NaN), not when it compiles.

Collections:

- **Arrays (lists, vectors)**: `var list[];` with `list[i]`, `push`, `pop`, `len`, `clear`. They
  grow as needed. Each element is a game variable of its own.
- **Dictionaries**: the same arrays with text indexes, `counts["cat"]` (tutorial 17). There is no
  list of keys; keep one in another array if you need to walk them.
- **Records and objects**: none. Use one array per field and an index per record (`value[node]`,
  `next[node]`; tutorials 21 and 22).
- Arrays are global and cannot be passed to functions or returned; a function works on the arrays
  it names.

## Declarations

| Form | Meaning |
|---|---|
| `var x;` / `var x = expr;` | global variable, set at map start, in file order (`var a = b + 1; var b = 2;` reads `b` before it is set) |
| `var list[];` | array (see below) |
| `const NAME = 5;` | constant: a number, text, `true` or `false`; written into the actions |
| `extern score;` / `extern s = "host name";` | a variable of the host map, used by its own name |
| `function f(a, b) { ... }` | function; builtin names cannot be used |
| `export function f() { ... }` | function with a stable uid `#<prefix>_f`, for the map's own triggers and regions |
| `on start { ... }` | runs at map start (a start timer, before every other timer); several blocks run one after the other, each with its own scope (`return` ends only its block) |
| `on join { ... }` | runs each time a player joins (action 228). One per program; the game keeps one join trigger for the whole map, so the host map's own, or a second compiled program's, replaces it |
| `on chat { ... }` | runs for every chat line (action 156); `chatText()`, `talker()` and `talkerName()` tell what was said and by whom. One chat receiver per map (F31) |
| `every 30 { ... }` | runs every 30 frames (a timer) |

## Statements

`let x = expr;`, `x = expr;`, `x += expr;` (also `-=`, `*=`, `/=`, `%=`, `..=`),
`if (c) { } else if (c) { } else { }`, `while (c) { }`, `for (let i = 0; i < n; i += 1) { }`,
`for player p { }`, `break;`, `continue;`, `return expr;`, `wait(frames);`, `{ ... }`.

## Expressions

| Operators | Meaning |
|---|---|
| `+ - * / %` | numbers; text is read like `parseFloat` (`"4x"` is 4, `""` is NaN) |
| `..` | joins text: `"a" .. 1` is `"a1"` |
| `== !=` | compare as text: `5 == "5"` is true |
| `< <= > >=` | compare as numbers; with text that is no number `<` and `>` are false, so `<=` and `>=` ("not greater", "not less") are true |
| `&& \|\| !` | logic with short-circuit |
| `"x = {x + 1}"` | text with values inside `{ }` |

A condition is false when its value is `0` or empty text (`"0.0"` is true). Comparisons and `&& || !`
used as values give 1 or 0 (`0 || "x"` is 1).
Number literals are written in their shortest form (`5.0` is `5`).
A variable declared without a value (`var x;`, `let x;`) has no value until set: `x + 1` is NaN,
`x .. "a"` is `"undefineda"`, `if (x)` is true, and `"{x}"` in shown text shows the variable's game name.

Text escapes: `\" \\ \n \{ \}`.

## Builtins

| Builtin | Gives |
|---|---|
| `say(text)` / `say(text, color)` | shows text in the chat; color as in action 42 (a literal or constant) |
| `len(x)` | length of text, or the element count of an array |
| `contains(text, part)` | 1 or 0 |
| `charAt(text, i)` | the character at `i` |
| `drop(text, n)` | text without the first `n` characters (`n` < 0: without the last); `n` must be a whole-number literal or constant |
| `text(x)`, `number(x)` | x as text, x as a number |
| `floor(x)`, `round(x)`, `random(n)` | `random(n)`: whole number 0 .. n-1 |
| `slot()`, `initiator()`, `name(slot)`, `time()` | current player slot, player-initiator slot, displayed name, milliseconds since 1970 (a wall clock: compare two readings) |
| `sync(x)` / `sync(x, mode)` | sends variable (or fixed array element) `x` to every player in a multiplayer match. Modes: `replace` (default, 223), `default` (224, only where unset), `max` (225), `min` (226), `longest` (227). The map needs a Var Sync engine mark: the XML output adds one (F30) |
| `push(list, value)` | writes `value` at index `len(list)` and adds 1 to the length |
| `pop(list)` | takes 1 from the length and gives the element there (nothing when the array is empty) |
| `clear(list)` | sets the length to 0 |
| `chatText()`, `talker()`, `talkerName()` | in `on chat`: the text, the writer's slot, the writer's displayed name |
| `team(slot)` | the team number of the player in a slot |
| `action(op, a, b)` | any action, by number or alias. A name argument gives that variable's game name, `@f` gives function `f`'s uid, text gives itself; `{x}` inside text gives x's game name |

## Arrays

`var list[];` declares an array. `list[i]` reads and writes element i, `push(list, v)` appends,
`len(list)` counts the pushes: writing `list[5]` does not change the length, and the next `push`
writes at index `len(list)` even if that element was set by index. Elements are game variables
named `~<prefix>_list[i]~`, so they can be set and read with any index; an index must have a value
(an unset index makes a different element name), and it is used as text: `list[k]` with `k = "1.0"`
is not `list[1]`. Arrays are global and cannot be passed as values.

## Functions

Parameters and locals are game variables of their own (`~<prefix>_f.a~`), so a function's
values stay after it returns. Recursion works: before a call that can come back into the same
function, its variables are saved on a stack in game variables (cost: 3 actions per variable
per call, both ways). Calls deeper than 2048 are skipped by the game (F3), with no error: the
result is silently wrong. A function that nothing calls (and is not exported) is left out, with a warning.

## Timing

`wait(frames)` stops the block and continues `frames` or `frames - 1` frames later (a timer per
`wait`; the game ticks timers in element order, so when a `wait` starts while an earlier timer
runs, its own timer already counts that frame). A `wait` in one `on start` block also delays the later ones. It
works only in `on` and `every` blocks, not in functions. If the block runs again while it waits
(an `every` shorter than the wait, a second join), the wait starts over and the first run does
not continue. Everything else in a block runs in one
game frame. Each event may jump back at most `--guard` times (default 100000); then the trigger that
jumped stops (the rest of that event's code does not run; a caller of a function continues).

## Limits

- `for player p` uses action 508, which lists only players with a login: it lists nobody in single
  player (F25), and a slot of 10 or more reads as two slots (F10).
- A game variable whose name appears inside a text that is shown, or used with `{ }`, is replaced
  by its value (F9): with `extern score;`, `say("your score: {score}")` shows `your 5: 5`. Avoid
  short variable names in the host map.
- `name(s)` with a variable `s` stops the event when slot `s` has no character; `name(5)` with a
  number gives `"Empty"`.
- `drop(text, n)` with `n` below minus the length wraps around (`drop("hello", -9)` is `"h"`).
- Whole numbers written as text load as numbers; `"007"` stays text (F18).
- The game reads `& < > "` and line breaks in literal text as XML entities (`&amp; &lt; &gt; &quot; &#10;`, F26);
  `say` shows `< > "` correctly. The compiler warns about such values.
- An array index is used as text: `list[k]` with `k = "1.0"` is not `list[1]`.

## Grammar (EBNF)

Notation: `=` defines, `|` or, `[ ]` optional, `{ }` zero or more, `( )` grouping, `"x"` literal
text, `;` ends a rule. Spaces, line breaks, `// line` and `/* block */` comments may stand between
any two tokens. Words in the keyword list are not identifiers.

```ebnf
program        = { declaration } ;

declaration    = "var" identifier ( "[" "]" | [ "=" expression ] ) ";"
               | "const" identifier "=" expression ";"
               | "extern" identifier [ "=" string ] ";"
               | [ "export" ] "function" identifier "(" [ identifier { "," identifier } ] ")" block
               | "on" ( "start" | "join" | "chat" ) block
               | "every" number block ;

block          = "{" { statement } "}" ;

statement      = block
               | "let" identifier [ "=" expression ] ";"
               | "if" "(" expression ")" block [ "else" ( if-rest | block ) ]
               | "while" "(" expression ")" block
               | "for" "(" [ for-init ] ";" [ expression ] ";" [ simple ] ")" block
               | "for" "player" identifier block
               | "break" ";"
               | "continue" ";"
               | "return" [ expression ] ";"
               | "wait" "(" expression ")" ";"
               | simple ";" ;

if-rest        = "if" "(" expression ")" block [ "else" ( if-rest | block ) ] ;
for-init       = "let" identifier [ "=" expression ] | simple ;
simple         = expression [ assign-op expression ] ;
assign-op      = "=" | "+=" | "-=" | "*=" | "/=" | "%=" | "..=" ;

expression     = or ;
or             = and { "||" and } ;
and            = compare { "&&" compare } ;
compare        = join { ( "==" | "!=" | "<" | "<=" | ">" | ">=" ) join } ;
join           = sum { ".." sum } ;
sum            = product { ( "+" | "-" ) product } ;
product        = unary { ( "*" | "/" | "%" ) unary } ;
unary          = ( "-" | "!" ) unary | primary ;
primary        = number
               | string
               | "true" | "false"
               | "@" identifier
               | "(" expression ")"
               | identifier "(" [ expression { "," expression } ] ")"
               | identifier "[" expression "]"
               | identifier ;

identifier     = letter { letter | digit } ;
letter         = "A" … "Z" | "a" … "z" | "_" ;
digit          = "0" … "9" ;
number         = digit { digit } [ "." digit { digit } ] ;
string         = '"' { character | escape | "{" expression "}" } '"' ;
escape         = "\" ( '"' | "\" | "n" | "{" | "}" ) ;
character      = ? any character except '"', "\", "{", "}" and a line break ? ;

keyword        = "var" | "const" | "let" | "extern" | "function" | "export" | "on" | "every"
               | "if" | "else" | "while" | "for" | "player" | "break" | "continue" | "return"
               | "true" | "false" | "wait" ;
```

Rules the grammar does not show:

- The left side of an `assign-op` must be an `identifier` or `identifier "[" expression "]"`.
- Binary operators of the same level group from the left: `a - b - c` is `(a - b) - c`.
- `"@" identifier` (a function's trigger) is allowed only as an argument of `action(...)`.
- In `every`, `wait` and `drop`, the number must be a whole number above 0 (for `drop`: any whole
  number); `wait` and `drop` also accept a constant.

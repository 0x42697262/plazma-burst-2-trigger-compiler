# The .ptc language

The full reference. For a gentle start, read [syntax.md](syntax.md) first.

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

## Map objects

Declare each map object the program uses with its kind and uid:

| Kind | Map element | Actions that take it (parameter kind in [actions.md](actions.md)) |
|---|---|---|
| `region` | region | region |
| `door` | movable (door) | door |
| `character` | player or enemy | character |
| `gun` | gun | gun |
| `barrel` | barrel | barrel |
| `vehicle` | vehicle | vehicle |
| `decor` | decoration | decor |
| `pusher` | pusher | pushf |
| `light` | light | lamp |
| `water` | water | water |
| `timer` | timer | timer |
| `trigger` | a trigger of the host map | trigger (also `@function`) |

- An object can only be an argument of `action(...)`, and only where that action takes its kind:
  anything else is a compile error. Where an action takes an object, a variable is an error too;
  uid text (`"#door*1"`) is still accepted, without the check.
- `at x, y` is the position used if the compiler adds the object (below).
- With `--into map.xml`, each declared object is looked up in the map: a missing one is added with
  the editor's default settings (at `at x, y`, or in a row below the program's triggers), a uid
  used by another kind is an error. Objects the map has are never changed. `--no-create` warns
  instead of adding.
- The kind words are not reserved: `var water = 1;` still works.

### Object arrays

```
region spawns[] = ["#SPAWN1", "#SPAWN2", "#SPAWN3"];
decor board[][] = [["#c00", "#c01"], ["#c10", "#c11"]];

action(TeleportInitiatorFromTo, zone, spawns[random(len(spawns))]);
action(299, board[row][column], 1);
```

- Indexes start at 0. `len(spawns)` and `len(board[0])` are known when compiling.
- A fixed index (literal, constant, never-changing variable) puts that element's uid straight into
  the action.
- A changing index cannot pick an object while the map runs (targets are fixed at load), so the
  compiler writes one guarded copy of the action per element, and only the matching one runs. With
  several changing indexes, or object arrays in both parameters, it combines the indexes into one
  key, so each copy is checked once. Cost: 2 actions per element, no extra triggers; keep arrays
  small where an index changes.
- An index outside the array does nothing; a fixed one outside is a compile error.
- The element kind is checked like a single object, and create-if-missing adds each missing
  element (named `spawns[0]`, `board[1][0]`...).
- Object arrays work only as `action(...)` arguments and in `len`.

## Named values

The editor's value lists are named values, written `Group.Name`: `Color.NoirLime` is `2`,
`Team.RedTeam` is `12`, `Behavior.FollowThePlayer` is `1`. Where the editor's value is already a
name, that is the name: `GunModel.gun_rifle`, `Sound.hp_warn`, `Voice.marine`, `DecorModel.stone`,
`Bool.true`; the label form (`GunModel.AssaultRifleC01r`) works too. Plain numbers such as a call
count of 1 have no name: write `1`. Groups: `Color`, `Team`, `Behavior`, `Bool`, `Toggle`, `Calls`, `PusherDamage`,
`GunModel`, `Sound`, `Sky`, `Voice`, `CharacterModel`, `DecorModel`, `Song`; all names and values
are in [actions.md](actions.md#named-values).

- A named value is a fixed value: it works in `say`, `match` patterns, comparisons and any action.
- Like object kinds, it is checked: a `Team` value where an action takes a color is a compile error.
- The raw value (`2`, `12`) still works.

## Fixed values

Some places need a value the game reads from the action itself, not from a variable: the color
of `say`, the count of `drop`, the sync mode, and the number, color or team parameters of
`action(...)`. There you can write:

- a literal: `say("hi", "#FF0000")`
- a constant: `const RED = "#FF0000";`
- a variable that never changes: `var RED = "#FF0000";` or `let size = 450;`, with a fixed value
  and never assigned again anywhere (not exported, not written by an `action`). The compiler
  writes its value into the action.

A variable that can change there is a compile error: the game would get the variable's name, not
its value. Where an action reads a variable (`action(VarAddValue, hits, 10)`), the name is passed
as before. For text parameters whose role the action list leaves unclear, a changing variable
passes its name with a warning.

An array index that is fixed this way also picks the element when compiling: `list[i]` with a
never-changing `i` is as cheap as `list[2]`.

## Files and visibility

- `import "file.ptc";` pulls in another file's declarations, as if they were written in this one.
  Everything shares one prefix and one namespace, so two files cannot declare the same name.
  Errors name the file: `lib/tools.ptc line 4: ...`. Unused functions of imported files are left
  out silently.
- Every variable and trigger is visible to the whole map: the game has one variable table. The
  prefix keeps programs apart; `export` marks what is meant to be shared:
  - `export function f()` gets the fixed trigger uid `#<prefix>_f`.
  - `export var score;` is listed after compiling (`score = ~<prefix>_score~`). With `--into`, the
    compiler warns when the host map uses one of the program's variables that is not exported:
    those names can change when the program changes.
- There is no private/public/protected: the game could not enforce them.
- `import "std/name.ptc";` imports from the standard library that comes with the compiler
  (`std/` in this repository; the web page has it built in). `std/hash.ptc` gives `hash(text)`.

## Compile-time constants

A `const` is worked out while compiling: its value may be any expression, also calls to the
program's own functions, as long as nothing in it acts on the game (no `say`, no map objects, no
players, no `random`, no `time`, no chat). The compiler runs it in the simulator and writes only
the result into the actions; a function used only this way is not written into the map.

```
function square(n) { return n * n; }
const AREA = square(7);                 // the map gets 49
const LABEL = "area {AREA}";            // the map gets "area 49"
```

A constant can use the constants declared before it and the starting values of variables. Anything
that acts on the game, or does not finish, is a compile error: `cannot compute R while compiling`.
The simulator matches the game (`npm run live-check`, including `examples/live/lang-hash.ptc`), so a
value worked out here equals the one the map would compute.

`env("NAME")` works only in a `const` and gives the value of an environment variable while
compiling (`MAP_PASSWORD=... npm run compile -- map.ptc`); the web page has none.

### Secrets

`secret const NAME = value;` marks a value that must not reach the map, like a password:

- Any expression that uses a secret is worked out while compiling, wherever it stands:
  `var pass = hash(PASSWORD);` writes only the hash.
- After compiling, every action of the map is searched for the secret's text. If it is there, for
  example from `chatText() == PASSWORD`, `var copy = PASSWORD;` or a function that returns its
  argument, compiling fails and names the trigger and line.
- A secret needs at least 4 characters, so the search means something. It finds the text as it is;
  a secret changed on purpose (written backwards) is not found.

`secret` is a word only before `const`; elsewhere it is an ordinary name. See
[passwords.md](passwords.md) for a complete example.

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
| `const NAME = 5;` / `const AREA = square(7);` | constant, worked out while compiling and written into the actions (see Compile-time constants) |
| `secret const PASSWORD = env("MAP_PASSWORD");` | a constant that may only feed other constants: compiling fails if its text would be written into the map |
| `extern score;` / `extern s = "host name";` | a variable of the host map, used by its own name |
| `water pool = "#water*1";` / `door gate = "#door*3" at 400, -120;` | a map object (see below) |
| `region spawns[] = ["#S1", "#S2"];` / `decor grid[][] = [["#a", "#b"], ["#c", "#d"]];` | an array of map objects, nested to any depth |
| `export var score = 0;` / `export var list[];` | a variable meant for the host map or other programs: listed after compiling; with `--into`, using a non-exported one from the host map is warned about |
| `import "lib/tools.ptc";` | adds every declaration of that file (path relative to this file; each file once) |
| `function f(a, b) { ... }` | function; builtin names cannot be used |
| `export function f() { ... }` | function with a stable uid `#<prefix>_f`, for the map's own triggers and regions |
| `on start { ... }` | runs at map start (a start timer, before every other timer); several blocks run one after the other, each with its own scope (`return` ends only its block) |
| `on join { ... }` | runs each time a player joins (action 228). One per program; the game keeps one join trigger for the whole map, so the host map's own, or a second compiled program's, replaces it |
| `on chat { ... }` | runs for every chat line (action 156); `chatText()`, `talker()` and `talkerName()` tell what was said and by whom. One chat receiver per map (F31) |
| `every 30 { ... }` | runs every 30 frames (a timer) |

## Statements

`let x = expr;`, `x = expr;`, `x += expr;` (also `-=`, `*=`, `/=`, `%=`, `..=`),
`if (c) { } else if (c) { } else { }`, `while (c) { }`, `for (let i = 0; i < n; i += 1) { }`,
`for player p { }`, `break;`, `continue;`, `return expr;`, `wait(frames);`, `{ ... }`, and `match`:

```
match (command) {
  "-help", "-h" => say("commands: ...");
  QUIT => { save(); return; }
  _ => say("unknown {command}");
}
```

- The value is computed once and compared as text, like `==`: `5` matches `"5"`.
- Each pattern is a fixed value: a literal, a constant, a named value or a never-changing variable.
  An arm may list several patterns.
- The first matching arm runs; arms do not fall through. `_` is the default and must be last;
  without it, an unmatched value does nothing.
- An arm is one statement or a `{ }` block. `break` and `continue` inside an arm act on the loop
  around the `match`.

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
| `say(text)` / `say(text, color)` | shows text in the chat; color 0–4 or `"#rrggbb"`, as in action 42 (a fixed value: see below) |
| `len(x)` | length of text, or the element count of an array |
| `contains(text, part)` | 1 or 0 |
| `charAt(text, i)` | the character at `i` |
| `drop(text, n)` | text without the first `n` characters (`n` < 0: without the last); `n` must be a fixed whole number |
| `text(x)`, `number(x)` | x as text, x as a number |
| `floor(x)`, `round(x)`, `random(n)` | `random(n)`: whole number 0 .. n-1 |
| `slot()`, `initiator()`, `name(slot)`, `time()` | current player slot, player-initiator slot, displayed name, milliseconds since 1970 (a wall clock: compare two readings) |
| `sync(x)` / `sync(x, mode)` | sends variable (or fixed array element) `x` to every player in a multiplayer match. Modes: `replace` (default, 223), `default` (224, only where unset), `max` (225), `min` (226), `longest` (227). The map needs a Var Sync engine mark: the XML output adds one (F30) |
| `push(list, value)` | writes `value` at index `len(list)` and adds 1 to the length |
| `pop(list)` | takes 1 from the length and gives the element there (nothing when the array is empty) |
| `clear(list)` | sets the length to 0 |
| `chatText()`, `talker()`, `talkerName()` | in `on chat`: the text, the writer's slot, the writer's displayed name |
| `team(slot)` | the team number of the player in a slot |
| `env("NAME")` | in a `const` only: an environment variable while compiling |
| `action(op, a, b)` | any action, by number or alias. A name argument gives that variable's game name, `@f` gives function `f`'s uid, text gives itself; `{x}` inside text gives x's game name |

## Arrays

`var list[];` declares an array. `list[i]` reads and writes element i, `push(list, v)` appends,
`len(list)` counts the pushes: writing `list[5]` does not change the length, and the next `push`
writes at index `len(list)` even if that element was set by index. Elements are game variables
named `~<prefix>_list[i]~`, so they can be set and read with any index; an index must have a value
(an unset index makes a different element name), and it is used as text: `list[k]` with `k = "1.0"`
is not `list[1]`. Arrays are global and cannot be passed as values.

With a changing index, the element name is built at run time. By default one action does it
(326, which scans every variable name in the map, F9 and F37). `--direct-index` (web page: "direct
index") builds it from pieces instead: 2 more actions per access, but the cost no longer grows
with the number of variables, and a host map variable name inside an index cannot be replaced by
mistake. The same goes for `push`, `pop` and the recursion stack. `charAt` and `for (c of text)`
still use action 350, which scans either way.

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
- Text that looks like a number but is not written as one (`"007"`, `"1.50"`, `"0123456789."`)
  would become a number after a save in the website editor (F36). The compiler stores it as `"_007"`
  and removes the `_` when the program runs (one more action), so it stays text. For other map
  editors, `--no-number-text` (web page: untick "site editor") writes the text as it is, with a warning.
- The game reads `& < > "` and line breaks in literal text as XML entities (`&amp; &lt; &gt; &quot; &#10;`, F26);
  `say` shows `< > "` correctly. The compiler warns about such values.
- An array index is used as text: `list[k]` with `k = "1.0"` is not `list[1]`.

## Grammar (EBNF)

Notation: `=` defines, `|` or, `[ ]` optional, `{ }` zero or more, `( )` grouping, `"x"` literal
text, `;` ends a rule. Spaces, line breaks, `// line` and `/* block */` comments may stand between
any two tokens. Words in the keyword list are not identifiers.

```ebnf
program        = { import | declaration } ;

import         = "import" string ";" ;

declaration    = [ "export" ] "var" identifier ( "[" "]" | [ "=" expression ] ) ";"
               | [ "secret" ] "const" identifier "=" expression ";"
               | "extern" identifier [ "=" string ] ";"
               | object-kind identifier "=" string [ "at" signed "," signed ] ";"
               | object-kind identifier "[" "]" { "[" "]" } "=" uid-list ";"
               | [ "export" ] "function" identifier "(" [ identifier { "," identifier } ] ")" block
               | "on" ( "start" | "join" | "chat" ) block
               | "every" number block ;

object-kind    = "region" | "door" | "character" | "gun" | "barrel" | "vehicle" | "decor"
               | "pusher" | "light" | "water" | "timer" | "trigger" ;
signed         = [ "-" ] number ;
uid-list       = "[" [ ( string | uid-list ) { "," ( string | uid-list ) } ] "]" ;

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
               | "match" "(" expression ")" "{" { match-arm } "}"
               | simple ";" ;

match-arm      = ( "_" | expression { "," expression } ) "=>" statement ;
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
               | identifier "[" expression "]" { "[" expression "]" }
               | identifier "." identifier
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
               | "true" | "false" | "wait" | "import" | "match" ;
```

Rules the grammar does not show:

- The left side of an `assign-op` must be an `identifier` or `identifier "[" expression "]"`.
- `object-kind` words are keywords only at the start of a declaration followed by a name; elsewhere
  they are ordinary identifiers.
- Binary operators of the same level group from the left: `a - b - c` is `(a - b) - c`.
- `"@" identifier` (a function's trigger) is allowed only as an argument of `action(...)`.
- `"secret"` is a word only right before `"const"`; elsewhere it is an identifier. `env(...)` is allowed
  only inside a `const` expression, with one string in quotes.
- A `const` expression must be computable while compiling: no actions on the game.
- In `every`, `wait` and `drop`, the number must be a whole number above 0 (for `drop`: any whole
  number); `wait` and `drop` also accept a constant.

# Tutorial

This tutorial builds 23 small programs in the `.ptc` language, from a first loop to parsers and
classic algorithms. Every program is in [`examples/tutorial/`](../examples/tutorial/), and a test
runs each one and checks the chat output shown here, so what you read is what the game does.

New to the language? Start with [syntax.md](syntax.md). Reference while reading: [language.md](language.md). Game facts such as (F9): [game-facts.md](game-facts.md).

## Contents

1. [Getting started](#1-getting-started)
2. [Variables, loops and chat output](#2-variables-loops-and-chat-output)
3. [Talking to the map: buttons, regions, doors](#3-talking-to-the-map-buttons-regions-doors)
4. [Chat commands](#4-chat-commands)
5. [Players: random picks, selection, teams](#5-players-random-picks-selection-teams)
6. [Arithmetic](#6-arithmetic)
7. [A chat calculator](#7-a-chat-calculator)
8. [Parsers: postfix, prefix, infix](#8-parsers-postfix-prefix-infix)
9. [Data structures and algorithms](#9-data-structures-and-algorithms)
10. [Cost, limits and pitfalls](#10-cost-limits-and-pitfalls)

---

## 1. Getting started

A program compiles into triggers (and timers) that you add to a map.

```
npm run compile -- examples/tutorial/01-hello.ptc --run
```

- `out/01-hello.xml`: elements to append to a map XML.
- `out/01-hello.txt`: the same triggers in the editor's "Edit trigger as text" format.
- `--run` runs the program in the simulator and prints its variables and chat lines.

To put a program into your map:

1. In the map editor, download the map as XML.
2. `npm run compile -- game.ptc --into downloaded-map.xml`
3. In the editor, replace the map with `out/game-map.xml`.

Every variable and trigger gets a prefix, taken from the file name (`--prefix` sets another), so
two programs in one map never mix: `count` in `game.ptc` is the game variable `~game_count~`.

## 2. Variables, loops and chat output

<!-- file: 01-hello.ptc -->
```ptc
// The smallest useful program: a variable, a loop, a message.
var count = 0;

on start {
  while (count < 3) {
    count += 1;
    say("count is {count}");
  }
  say("done!", Color.NoirLime);
}
```

Chat output:

```
count is 1
count is 2
count is 3
done!
```

- `var` declares a global variable. Its value is set when the map starts.
- `on start { ... }` runs once, when the map starts.
- `say(text)` shows text in the chat; `say(text, color)` picks a color. `Color.NoirLime` is a
  named value from the editor's color list (it is `2`); every list is in [actions.md](actions.md).
  Inside text, `{expression}` inserts a value.
- `while`, `if`, `for` work as in C or JavaScript. Statements end with `;`.

## 3. Talking to the map: buttons, regions, doors

Objects of the map (regions, doors, characters, guns) are named by their uid, such as `#SPAWN1`.
The game turns uids into objects when the map loads, so an object is fixed in the program. Declare
each one with its kind:

```
region spawn1 = "#SPAWN1";
door gate = "#door*3" at 400, -120;
```

Any of the game's actions runs with `action(name or number, a, b)`. The compiler checks every object
you pass against what the action expects, like a strict type cast: a region where a door belongs is
a compile error. The full list of actions and what each parameter takes: [actions.md](actions.md).

An `export function` gets a fixed trigger uid, `#<prefix>_<name>`. Set a region's "Activation
Trigger" to it in the editor and its "Activation on" to a use key, and the function runs when a
player uses the region: that is a button.

With `--into map.xml`, the compiler also looks the objects up in the map:

- An object the map lacks is added, with the editor's default settings, at its `at x, y` or in a
  row below the program's triggers. Drag it into place in the editor. Compiling again never moves
  or changes an object the map already has.
- A uid that the map uses for another kind of object is an error.
- `--no-create` only warns about missing objects.

### A random respawn

The respawn region calls `respawn()`, which sends the player to one of four spawns:

<!-- file: 03-random-respawn.ptc -->
```ptc
// A respawn region that sends the player to one of four spawn regions at random.
// Object targets (regions, doors, characters) are fixed when the map loads; an object
// array lets the compiler pick the right one with a changing index.
region respawnZone = "#respawn_region";
region spawns[] = ["#SPAWN1", "#SPAWN2", "#SPAWN3", "#SPAWN4"];
var lastSpawn = -1;

export function respawn() {
  lastSpawn = random(len(spawns));
  action(TeleportInitiatorFromTo, respawnZone, spawns[lastSpawn]);
}
```

- `random(len(spawns))` gives a whole number from 0 to 3.
- `spawns` is an object array. The game fixes every object target when the map loads, so
  `spawns[lastSpawn]` cannot be looked up while the map runs; the compiler writes one guarded
  `action` per element instead (4 here), and only the one whose index matches runs.
- `respawnZone` and the elements of `spawns` are declared regions; passing them where action 70
  expects something else would not compile.
- "Player-initiator" is the player who used the region.

### A one-time "god" button

<!-- file: 04-god-mode.ptc -->
```ptc
// A button that makes the player who pressed it a "god" once, and tells everybody.
var godSlot = -1;

export function becomeGod() {
  if (godSlot != -1) {
    say("{name(godSlot)} is already the god");
    return;
  }
  godSlot = initiator();
  action(498, godSlot, 450);
  say("{name(godSlot)} has 450 lifepoints", Color.CivilSecurity);
}
```

Pressed twice by player `bob`:

```
bob has 450 lifepoints
bob is already the god
```

- `initiator()` is the slot number of the player who used the button; `name(slot)` is that
  player's displayed name.
- Action 498 sets the current and maximum hit points of the character in a slot taken from a
  variable. Most character actions have such a "slot-value variable" form: search the action list
  for "slot-value".
- `return;` ends the function early.

### A door every player sees open

<!-- file: 05-shared-doors.ptc -->
```ptc
// Door state that every player shares in multiplayer: "max" keeps the highest value,
// so once any player opens the door it stays open for everybody.
door door1 = "#door1";
region openPlace = "#door1_open";
var doorOpen = 0;
var applied = 0;

export function openDoor() {
  doorOpen = 1;
  sync(doorOpen, "max");
}

every 30 {
  if (doorOpen == 1 && applied == 0) {
    action(MovableTo, door1, openPlace);
    applied = 1;
    say("the door is open");
  }
}
```

- `sync(x, "max")` sends `x` to every player in a multiplayer match; with `max`, the highest
  value wins, so an opened door stays open for everybody. Other modes: `replace`, `default`,
  `min`, `longest`.
- Sync needs the map's Var Sync engine mark; the compiler adds it to the XML (F30).
- `every 30 { ... }` checks the value every 30 frames and moves the door once.

## 4. Chat commands

`on chat { ... }` runs for every chat line. In it, `chatText()` is the text, `talker()` the
slot of the player who wrote it, and `talkerName()` that player's name.

<!-- file: 02-chat-commands.ptc -->
```ptc
// Chat commands: "-help", "-skin 2", "-roll".
// The map's chat receiver runs "on chat" for every chat line.
var skins[];
var lastSkin = "";

function startsWith(text, prefix) {
  for (let i = 0; i < len(prefix); i += 1) {
    if (charAt(text, i) != charAt(prefix, i)) { return 0; }
  }
  return 1;
}

function after(text, count) {
  let rest = "";
  for (let i = count; i < len(text); i += 1) { rest ..= charAt(text, i); }
  return rest;
}

on start {
  push(skins, "c48441");
  push(skins, "c48386");
  push(skins, "c47640");
}

on chat {
  let text = chatText();
  let who = talker();
  if (!startsWith(text, "-")) { return; }

  if (text == "-help") {
    say("commands: -skin 1-{len(skins)}, -roll");
  } else if (startsWith(text, "-skin ")) {
    let choice = floor(number(after(text, 6)));
    if (choice >= 1 && choice <= len(skins)) {
      lastSkin = skins[choice - 1];
      action(347, who, lastSkin);
      say("{talkerName()} got skin {choice}");
    } else {
      say("there is no skin {after(text, 6)}");
    }
  } else if (text == "-roll") {
    say("{talkerName()} rolled {random(6) + 1}");
  } else {
    say("unknown command {text}, try -help");
  }
}
```

Player `bob` writes `-help`, `-skin 2`, `-skin 9`, `hello`, `-dance`:

```
commands: -skin 1-3, -roll
bob got skin 2
there is no skin 9
unknown command -dance, try -help
```

- The language has no `startsWith`, so the program writes it: compare character by character with
  `charAt(text, i)`. `after(text, count)` builds the rest of the text the same way.
- `var skins[];` is an array; `push` adds to its end, `skins[i]` reads element `i`, `len(skins)`
  counts.
- `number(text)` reads a number from text (`"2"` gives 2); `floor` drops the fraction.
- Action 347 sets the skin of the character in the slot held by `who`.
- `hello` does not start with `-`, so `return;` ends the block silently.
- A map has one chat receiver: a second program with `on chat` replaces the first.

## 5. Players: random picks, selection, teams

`for player p { ... }` runs its body once for every player in the match, with `p` holding the
slot. It works in multiplayer only: in single player the game lists no players (F25).

<!-- file: 06-players.ptc -->
```ptc
// Player randomization and selection. "for player" works in multiplayer only.
var players[];
var order = "";
var chosen = -1;
var found = -1;

function collectPlayers() {
  clear(players);
  for player p { push(players, p); }
  return len(players);
}

function randomPlayer() {
  if (collectPlayers() == 0) { return -1; }
  return players[random(len(players))];
}

function shufflePlayers() {
  collectPlayers();
  for (let i = len(players) - 1; i > 0; i -= 1) {
    let j = random(i + 1);
    let keep = players[i];
    players[i] = players[j];
    players[j] = keep;
  }
}

function findPlayer(wanted) {
  for player p {
    if (name(p) == wanted) { return p; }
  }
  return -1;
}

function splitTeams() {
  shufflePlayers();
  for (let i = 0; i < len(players); i += 1) {
    let who = players[i];
    if (i % 2 == 0) {
      action(507, who, Team.RedTeam);
    } else {
      action(507, who, Team.BlueTeam);
    }
    order ..= name(who) .. ";";
  }
}

on start {
  chosen = randomPlayer();
  if (chosen != -1) { say("{name(chosen)} is it!"); }
  found = findPlayer("bob");
  splitTeams();
}
```

With the four players `ann`, `bob`, `cy` and `dee` in slots 0 to 3, one run says `cy is it!`
(the simulator's random numbers are fixed; the game's are not).

- `collectPlayers` fills an array with the slots. `clear(players)` empties it first.
- `randomPlayer` picks one element at random: the simplest "random player".
- `shufflePlayers` is the Fisher–Yates shuffle: walk from the end, swap each element with a random
  one at or before it. Every order is equally likely.
- `splitTeams` shuffles, then puts every other player in `Team.RedTeam` (12) or `Team.BlueTeam` (13)
  with action 507, the "slot-value variable" form of "change team".
- `findPlayer("bob")` selects a player by name. Slots from `for player` are text (`"1"`), which
  every action that takes a slot accepts.
- `team(slot)` gives a player's team number.

## 6. Arithmetic

<!-- file: 07-arithmetic.ptc -->
```ptc
// Arithmetic: whole-number division, remainders, rounding, powers, helpers.
var quotient = 0;
var remainder = 0;
var price = 0;
var power = 0;
var average = 0;
var biggest = 0;
var distance = 0;
var parsed = 0;
var broken = 0;

function abs(x) { if (x < 0) { return -x; } return x; }
function max(a, b) { if (a > b) { return a; } return b; }
function min(a, b) { if (a < b) { return a; } return b; }
function pow(base, exponent) {
  let result = 1;
  for (let i = 0; i < exponent; i += 1) { result *= base; }
  return result;
}
function roundTo(x, places) {
  let scale = pow(10, places);
  return round(x * scale) / scale;
}

on start {
  quotient = floor(17 / 5);
  remainder = 17 % 5;
  price = roundTo(19.99 * 3 * 0.85, 2);
  power = pow(2, 10);
  average = (4 + 8 + 15 + 16 + 23 + 42) / 6;
  biggest = max(min(7, 3), 5);
  distance = abs(3 - 10);
  parsed = number("12.5kg") + 1;
  broken = number("kg12") + 1;
  say("17 / 5 = {quotient} remainder {remainder}");
  say("price {price}, 2^10 = {power}, average {average}");
  if (broken == "NaN") { say("kg12 is not a number"); }
}
```

Chat output:

```
17 / 5 = 3 remainder 2
price 50.97, 2^10 = 1024, average 18
kg12 is not a number
```

- `/` divides exactly: `floor(17 / 5)` is the whole-number quotient, `%` the remainder.
- `round(x * 100) / 100` rounds to 2 places; `roundTo` does it for any number of places.
- There is no power operator in the language, so `pow` multiplies in a loop.
- Text becomes a number the way JavaScript's `parseFloat` reads it: `"12.5kg"` is 12.5; text
  that starts with no number is NaN, which shows as the text `NaN`. `==` compares as text, so
  `x == "NaN"` tests for it.
- Functions can call functions, and `return` gives their value.

## 7. A chat calculator

Players write `= 12 * 3` in the chat; the map answers.

<!-- file: 08-chat-calculator.ptc -->
```ptc
// A chat calculator: "= 12 * 3" answers "12 * 3 = 36". One operator, two numbers.
var lastResult = "";

function isDigit(c) { return contains("0123456789.", c); }

function calculate(text) {
  let i = 0;
  let a = "";
  let b = "";
  while (i < len(text) && (charAt(text, i) == " " || charAt(text, i) == "=")) { i += 1; }
  while (i < len(text) && isDigit(charAt(text, i))) { a ..= charAt(text, i); i += 1; }
  while (i < len(text) && charAt(text, i) == " ") { i += 1; }
  let operator = charAt(text, i);
  i += 1;
  while (i < len(text) && charAt(text, i) == " ") { i += 1; }
  while (i < len(text) && isDigit(charAt(text, i))) { b ..= charAt(text, i); i += 1; }
  if (a == "" || b == "") { return "write it like: = 12 * 3"; }
  let x = number(a);
  let y = number(b);
  if (operator == "+") { return x + y; }
  if (operator == "-") { return x - y; }
  if (operator == "*") { return x * y; }
  if (operator == "/") {
    if (y == 0) { return "cannot divide by zero"; }
    return x / y;
  }
  if (operator == "%") { return x % y; }
  return "unknown operator {operator}";
}

on chat {
  let text = chatText();
  if (charAt(text, 0) != "=") { return; }
  lastResult = calculate(text);
  say("{drop(text, 1)} = {lastResult}");
}

on start {
  say("12 * 3 = {calculate("12 * 3")}");
}
```

At start, and after the chat lines `= 7 / 2`, `=10%4`, `= 1 / 0`, `= 2 ^ 3`, `not for me`:

```
12 * 3 = 36
 7 / 2 = 3.5
10%4 = 2
 1 / 0 = cannot divide by zero
 2 ^ 3 = unknown operator ^
```

The calculator reads the text by hand: skip spaces, collect digits, take one operator, collect
digits again. That works for one operator. For `3 + 4 * 2` with the right order of operations,
the text needs a parser: next section.

## 8. Parsers: postfix, prefix, infix

The same expression can be written three ways:

| Notation | Example | Means |
|---|---|---|
| infix (the usual one) | `(3 + 4) * 2` | operators between their numbers; needs precedence and parentheses |
| postfix (reverse Polish) | `3 4 + 2 *` | operator after its two numbers |
| prefix (Polish) | `* + 3 4 2` | operator before its two numbers |

Postfix and prefix need no parentheses and no precedence: the order of the text is the order of
the work. That makes them easy to compute, and infix is usually turned into postfix first.

### 8.1 Tokens

A parser first cuts the text into tokens: numbers (`12`, `3.5`) and single characters (`+`, `(`).
All parsers below share this part, kept in its own file and pulled in with
`import "lib/tokenizer.ptc";`:

<!-- file: lib/tokenizer.ptc -->
```ptc
var tokens[];

function isDigit(c) { return contains("0123456789.", c); }

function tokenize(text) {
  clear(tokens);
  let i = 0;
  while (i < len(text)) {
    let c = charAt(text, i);
    if (c == " ") {
      i += 1;
    } else if (isDigit(c)) {
      let digits = "";
      while (i < len(text) && isDigit(charAt(text, i))) { digits ..= charAt(text, i); i += 1; }
      push(tokens, digits);
    } else {
      push(tokens, c);
      i += 1;
    }
  }
  return len(tokens);
}

function isOperator(t) { return t == "+" || t == "-" || t == "*" || t == "/" || t == "^"; }

function pow(base, exponent) {
  let result = 1;
  for (let i = 0; i < exponent; i += 1) { result *= base; }
  return result;
}

function apply(operator, a, b) {
  if (operator == "+") { return a + b; }
  if (operator == "-") { return a - b; }
  if (operator == "*") { return a * b; }
  if (operator == "/") { return a / b; }
  return pow(a, b);
}
```

- `tokens` is filled with text pieces: `"3 + 12"` gives `3`, `+`, `12`.
- `contains("0123456789.", c)` is 1 when `c` is a digit or a dot.
- `apply` computes one operator on two numbers; `^` is a power.
- `import` adds every declaration of that file to the program, as if written there; the path is
  relative to the importing file, and a file imported twice counts once. Unused functions of an
  imported file are left out without a warning.

### 8.2 Postfix

Read left to right. A number goes on a stack. An operator takes the top two numbers (the second
one first), computes, and puts the result back. At the end, one number is left: the result.

<!-- file: 09-postfix.ptc -->
```ptc
// Postfix (reverse Polish) notation: "3 4 + 2 *" means (3 + 4) * 2.
// Numbers go on a stack; an operator takes the top two and puts the result back.
import "lib/tokenizer.ptc";

var stack[];

function evaluatePostfix(text) {
  tokenize(text);
  clear(stack);
  for (let i = 0; i < len(tokens); i += 1) {
    let t = tokens[i];
    if (isOperator(t)) {
      if (len(stack) < 2) { return "error: {t} needs two numbers"; }
      let b = pop(stack);
      let a = pop(stack);
      push(stack, apply(t, a, b));
    } else {
      push(stack, number(t));
    }
  }
  if (len(stack) != 1) { return "error: {len(stack)} numbers left"; }
  return pop(stack);
}

on start {
  say("3 4 + 2 * = {evaluatePostfix("3 4 + 2 *")}");
  say("5 1 2 + 4 * + 3 - = {evaluatePostfix("5 1 2 + 4 * + 3 -")}");
  say("2 3 ^ = {evaluatePostfix("2 3 ^")}");
  say("1 + = {evaluatePostfix("1 +")}");
}
```

```
3 4 + 2 * = 14
5 1 2 + 4 * + 3 - = 14
2 3 ^ = 8
1 + = error: + needs two numbers
```

`push(stack, v)` puts a value on the stack, `pop(stack)` takes the last one off and gives it, and
`len(stack)` says how many are on it.

### 8.3 Prefix

Read right to left, and it works like postfix with the two numbers taken the other way round.
Or read left to right with recursion: an operator reads two whole expressions after it.

<!-- file: 10-prefix.ptc -->
```ptc
// Prefix (Polish) notation: "* + 3 4 2" means (3 + 4) * 2.
// Two ways: a stack, reading from the right; and recursion, reading from the left.
import "lib/tokenizer.ptc";

var stack[];
var position = 0;

function evaluateWithStack(text) {
  tokenize(text);
  clear(stack);
  for (let i = len(tokens) - 1; i >= 0; i -= 1) {
    let t = tokens[i];
    if (isOperator(t)) {
      let a = pop(stack);
      let b = pop(stack);
      push(stack, apply(t, a, b));
    } else {
      push(stack, number(t));
    }
  }
  return pop(stack);
}

function readExpression() {
  let t = tokens[position];
  position += 1;
  if (isOperator(t)) {
    let a = readExpression();
    let b = readExpression();
    return apply(t, a, b);
  }
  return number(t);
}

function evaluateWithRecursion(text) {
  tokenize(text);
  position = 0;
  return readExpression();
}

on start {
  say("* + 3 4 2 = {evaluateWithStack("* + 3 4 2")}");
  say("- 10 / 6 3 = {evaluateWithStack("- 10 / 6 3")}");
  say("* + 3 4 2 = {evaluateWithRecursion("* + 3 4 2")} (recursive)");
  say("+ * 2 3 ^ 2 4 = {evaluateWithRecursion("+ * 2 3 ^ 2 4")} (recursive)");
}
```

```
* + 3 4 2 = 14
- 10 / 6 3 = 8
* + 3 4 2 = 14 (recursive)
+ * 2 3 ^ 2 4 = 22 (recursive)
```

`readExpression` calls itself. Each call keeps its own `t`, `a` and `b`: the compiler saves them
on a stack around the recursive call.

### 8.4 Infix with the shunting-yard algorithm

The shunting-yard algorithm reads infix tokens and writes postfix:

- A number goes straight to the output.
- An operator first moves waiting operators to the output while they bind at least as tightly
  (`*` before `+`); `^` groups from the right, so an equal `^` waits.
- `(` waits; `)` moves operators to the output until its `(`.
- At the end, the waiting operators go to the output.

<!-- file: 11-infix.ptc -->
```ptc
// Infix notation, the usual one: "3 + 4 * 2". The shunting-yard algorithm turns it
// into postfix (operators by precedence, parentheses, ^ grouping from the right),
// then the postfix evaluator from 09 computes it.
import "lib/tokenizer.ptc";

var output[];
var operators[];
var stack[];

function precedence(op) {
  if (op == "^") { return 3; }
  if (op == "*" || op == "/") { return 2; }
  if (op == "+" || op == "-") { return 1; }
  return 0;
}

function popsBefore(waiting, incoming) {
  if (waiting == "(") { return 0; }
  if (precedence(waiting) > precedence(incoming)) { return 1; }
  return precedence(waiting) == precedence(incoming) && incoming != "^";
}

function waiting() { return operators[len(operators) - 1]; }

function toPostfix(text) {
  tokenize(text);
  clear(output);
  clear(operators);
  for (let i = 0; i < len(tokens); i += 1) {
    let t = tokens[i];
    if (isDigit(charAt(t, 0))) {
      push(output, t);
    } else if (t == "(") {
      push(operators, t);
    } else if (t == ")") {
      while (len(operators) > 0 && waiting() != "(") { push(output, pop(operators)); }
      if (len(operators) == 0) { return "error: ) without ("; }
      pop(operators);
    } else {
      while (len(operators) > 0 && popsBefore(waiting(), t)) { push(output, pop(operators)); }
      push(operators, t);
    }
  }
  while (len(operators) > 0) {
    if (waiting() == "(") { return "error: ( without )"; }
    push(output, pop(operators));
  }
  let joined = "";
  for (let i = 0; i < len(output); i += 1) {
    if (i > 0) { joined ..= " "; }
    joined ..= output[i];
  }
  return joined;
}

function evaluatePostfix(text) {
  tokenize(text);
  clear(stack);
  for (let i = 0; i < len(tokens); i += 1) {
    let t = tokens[i];
    if (isOperator(t)) {
      let b = pop(stack);
      let a = pop(stack);
      push(stack, apply(t, a, b));
    } else {
      push(stack, number(t));
    }
  }
  return pop(stack);
}

function calculate(text) {
  let postfix = toPostfix(text);
  if (contains(postfix, "error")) { return postfix; }
  return "{postfix} = {evaluatePostfix(postfix)}";
}

on start {
  say(calculate("3 + 4 * 2"));
  say(calculate("(3 + 4) * 2"));
  say(calculate("2 ^ 3 ^ 2"));
  say(calculate("3 + 4 * 2 / (1 - 5) ^ 2 ^ 3"));
  say(calculate("(1 + 2"));
}

on chat {
  let text = chatText();
  if (charAt(text, 0) == "=") { say(calculate(drop(text, 1))); }
}
```

At start, and after the chat line `=(1+2)*3`:

```
3 4 2 * + = 11
3 4 + 2 * = 14
2 3 2 ^ ^ = 512
3 4 2 * 1 5 - 2 3 ^ ^ / + = 3.0001220703125
error: ( without )
1 2 + 3 * = 9
```

### 8.5 Infix with recursive descent

A recursive-descent parser has one function per rule of the grammar. Lower-precedence rules call
higher ones, so precedence comes from the structure:

<!-- file: 12-recursive-descent.ptc -->
```ptc
// Infix again, with a recursive-descent parser: one function per grammar rule.
//   expression = term { ("+" | "-") term }
//   term       = factor { ("*" | "/") factor }
//   factor     = number | "(" expression ")" | "-" factor
import "lib/tokenizer.ptc";

var position = 0;

function peek() {
  if (position < len(tokens)) { return tokens[position]; }
  return "";
}

function factor() {
  let t = peek();
  position += 1;
  if (t == "-") { return -factor(); }
  if (t == "(") {
    let inside = expression();
    position += 1;
    return inside;
  }
  return number(t);
}

function term() {
  let value = factor();
  while (peek() == "*" || peek() == "/") {
    let op = peek();
    position += 1;
    value = apply(op, value, factor());
  }
  return value;
}

function expression() {
  let value = term();
  while (peek() == "+" || peek() == "-") {
    let op = peek();
    position += 1;
    value = apply(op, value, term());
  }
  return value;
}

function calculate(text) {
  tokenize(text);
  position = 0;
  return expression();
}

on start {
  say("2 * (3 + 4) - -5 = {calculate("2 * (3 + 4) - -5")}");
  say("10 / 4 - 1 = {calculate("10 / 4 - 1")}");
  say("-(2 + 3) * 4 = {calculate("-(2 + 3) * 4")}");
}
```

```
2 * (3 + 4) - -5 = 19
10 / 4 - 1 = 1.5
-(2 + 3) * 4 = -20
```

- `expression`, `term` and `factor` call each other; `position` is the next token.
- `factor` also handles a minus sign before a number or parenthesis, which the shunting-yard
  version above does not.
- Shunting-yard is shorter for plain operators; recursive descent grows more easily (functions,
  comparisons, variables).

## 9. Data structures and algorithms

Arrays are global: a function works on the array it names. To reuse an algorithm on another
array, copy the function, or copy the data into the array the function uses.

### Level 1: walking through an array

<!-- file: 13-dsa-basics.ptc -->
```ptc
// Level 1: walking through an array. Sum, average, biggest, search, reverse,
// FizzBuzz, greatest common divisor, and the primes below 50 (sieve).
var numbers[];
var flags[];

function fill() {
  clear(numbers);
  push(numbers, 5); push(numbers, 3); push(numbers, 9); push(numbers, 1); push(numbers, 7);
}

function sum() {
  let total = 0;
  for (let i = 0; i < len(numbers); i += 1) { total += numbers[i]; }
  return total;
}

function biggest() {
  let best = numbers[0];
  for (let i = 1; i < len(numbers); i += 1) {
    if (numbers[i] > best) { best = numbers[i]; }
  }
  return best;
}

function indexOf(wanted) {
  for (let i = 0; i < len(numbers); i += 1) {
    if (numbers[i] == wanted) { return i; }
  }
  return -1;
}

function reverse() {
  let left = 0;
  let right = len(numbers) - 1;
  while (left < right) {
    let keep = numbers[left];
    numbers[left] = numbers[right];
    numbers[right] = keep;
    left += 1;
    right -= 1;
  }
}

function listText() {
  let text = "";
  for (let i = 0; i < len(numbers); i += 1) {
    if (i > 0) { text ..= ","; }
    text ..= numbers[i];
  }
  return text;
}

function fizzBuzz(limit) {
  let text = "";
  for (let n = 1; n <= limit; n += 1) {
    if (n % 15 == 0) { text ..= "FizzBuzz "; }
    else if (n % 3 == 0) { text ..= "Fizz "; }
    else if (n % 5 == 0) { text ..= "Buzz "; }
    else { text ..= n .. " "; }
  }
  return text;
}

function gcd(a, b) {
  while (b != 0) {
    let rest = a % b;
    a = b;
    b = rest;
  }
  return a;
}

function primesBelow(limit) {
  clear(flags);
  for (let n = 0; n < limit; n += 1) { push(flags, 1); }
  let text = "";
  for (let n = 2; n < limit; n += 1) {
    if (flags[n] == 1) {
      text ..= n .. " ";
      for (let multiple = n * n; multiple < limit; multiple += n) { flags[multiple] = 0; }
    }
  }
  return text;
}

on start {
  fill();
  say("sum {sum()}, average {sum() / len(numbers)}, biggest {biggest()}, 9 is at {indexOf(9)}");
  reverse();
  say("reversed: {listText()}");
  say(fizzBuzz(15));
  say("gcd(48, 18) = {gcd(48, 18)}");
  say("primes: {primesBelow(50)}");
}
```

```
sum 25, average 5, biggest 9, 9 is at 2
reversed: 7,1,9,3,5
1 2 Fizz 4 Buzz Fizz 7 8 Fizz Buzz 11 Fizz 13 14 FizzBuzz 
gcd(48, 18) = 6
primes: 2 3 5 7 11 13 17 19 23 29 31 37 41 43 47 
```

- `reverse` swaps from both ends toward the middle.
- `gcd` is Euclid's algorithm: replace `(a, b)` by `(b, a % b)` until `b` is 0. Parameters can be
  changed like local variables.
- `primesBelow` is the sieve of Eratosthenes: mark every multiple of each prime as "not prime".

### Level 2: sorting and searching

<!-- file: 14-dsa-sorting.ptc -->
```ptc
// Level 2: sorting and binary search.
var numbers[];

function fill() {
  clear(numbers);
  push(numbers, 29); push(numbers, 3); push(numbers, 17); push(numbers, 8);
  push(numbers, 42); push(numbers, 15); push(numbers, 4); push(numbers, 23);
}

function listText() {
  let text = "";
  for (let i = 0; i < len(numbers); i += 1) {
    if (i > 0) { text ..= ","; }
    text ..= numbers[i];
  }
  return text;
}

function bubbleSort() {
  let swapped = 1;
  while (swapped) {
    swapped = 0;
    for (let i = 1; i < len(numbers); i += 1) {
      if (numbers[i - 1] > numbers[i]) {
        let keep = numbers[i];
        numbers[i] = numbers[i - 1];
        numbers[i - 1] = keep;
        swapped = 1;
      }
    }
  }
}

function insertionSort() {
  for (let i = 1; i < len(numbers); i += 1) {
    let current = numbers[i];
    let j = i - 1;
    while (j >= 0 && numbers[j] > current) {
      numbers[j + 1] = numbers[j];
      j -= 1;
    }
    numbers[j + 1] = current;
  }
}

function binarySearch(wanted) {
  let low = 0;
  let high = len(numbers) - 1;
  let steps = 0;
  while (low <= high) {
    steps += 1;
    let middle = floor((low + high) / 2);
    if (numbers[middle] == wanted) { return "{wanted} at {middle} in {steps} steps"; }
    if (numbers[middle] < wanted) { low = middle + 1; } else { high = middle - 1; }
  }
  return "{wanted} not found";
}

on start {
  fill();
  bubbleSort();
  say("bubble sort: {listText()}");
  fill();
  insertionSort();
  say("insertion sort: {listText()}");
  say(binarySearch(23));
  say(binarySearch(5));
}
```

```
bubble sort: 3,4,8,15,17,23,29,42
insertion sort: 3,4,8,15,17,23,29,42
23 at 5 in 2 steps
5 not found
```

- Bubble sort swaps neighbors until a full pass swaps nothing.
- Insertion sort takes each element and shifts bigger ones right until its place is free.
- Binary search halves the range every step: 8 elements need at most 4 steps. It needs sorted data.

### Level 2: stack and queue

<!-- file: 15-dsa-stack-queue.ptc -->
```ptc
// Level 2: a stack and a queue. The stack checks brackets and palindromes;
// the queue is a ring buffer of 4 places that wraps around.
var stack[];
var queue[];
var head = 0;
var size = 0;
const CAPACITY = 4;

function balanced(text) {
  clear(stack);
  for (let i = 0; i < len(text); i += 1) {
    let c = charAt(text, i);
    if (c == "(" || c == "[") { push(stack, c); }
    if (c == ")" || c == "]") {
      if (len(stack) == 0) { return 0; }
      let open = pop(stack);
      if ((c == ")" && open != "(") || (c == "]" && open != "[")) { return 0; }
    }
  }
  return len(stack) == 0;
}

function palindrome(text) {
  clear(stack);
  for (let i = 0; i < len(text); i += 1) { push(stack, charAt(text, i)); }
  for (let i = 0; i < len(text); i += 1) {
    if (pop(stack) != charAt(text, i)) { return 0; }
  }
  return 1;
}

function enqueue(value) {
  if (size == CAPACITY) { return 0; }
  queue[(head + size) % CAPACITY] = value;
  size += 1;
  return 1;
}

function dequeue() {
  let value = queue[head];
  head = (head + 1) % CAPACITY;
  size -= 1;
  return value;
}

on start {
  say("([]) balanced: {balanced("([])")}, ([)] balanced: {balanced("([)]")}");
  say("level: {palindrome("level")}, lever: {palindrome("lever")}");
  enqueue("a"); enqueue("b"); enqueue("c");
  let out = dequeue() .. dequeue();
  enqueue("d"); enqueue("e"); enqueue("f");
  let full = enqueue("g");
  while (size > 0) { out ..= dequeue(); }
  say("queue order: {out}, accepted g: {full}");
}
```

```
([]) balanced: 1, ([)] balanced: 0
level: 1, lever: 0
queue order: abcdef, accepted g: 0
```

- A stack (last in, first out) checks brackets: each closing bracket must match the last open one.
- Reading a word onto a stack and back reverses it: a palindrome reads the same.
- The queue (first in, first out) is a ring buffer: `(head + size) % CAPACITY` wraps the end
  back to index 0, so 4 places serve any number of values, at most 4 at a time.

### Level 3: quicksort

<!-- file: 16-dsa-quicksort.ptc -->
```ptc
// Level 3: quicksort, a recursive divide-and-conquer sort.
// Each call keeps its own low/high: the compiler saves them around recursive calls.
var numbers[];
var calls = 0;

function swap(i, j) {
  let keep = numbers[i];
  numbers[i] = numbers[j];
  numbers[j] = keep;
}

function partition(low, high) {
  let pivot = numbers[high];
  let i = low;
  for (let j = low; j < high; j += 1) {
    if (numbers[j] < pivot) {
      swap(i, j);
      i += 1;
    }
  }
  swap(i, high);
  return i;
}

function quicksort(low, high) {
  calls += 1;
  if (low >= high) { return; }
  let middle = partition(low, high);
  quicksort(low, middle - 1);
  quicksort(middle + 1, high);
}

function listText() {
  let text = "";
  for (let i = 0; i < len(numbers); i += 1) {
    if (i > 0) { text ..= ","; }
    text ..= numbers[i];
  }
  return text;
}

on start {
  for (let i = 0; i < 12; i += 1) { push(numbers, (i * 37 + 11) % 50); }
  say("before: {listText()}");
  quicksort(0, len(numbers) - 1);
  say("after: {listText()} ({calls} calls)");
}
```

```
before: 11,48,35,22,9,46,33,20,7,44,31,18
after: 7,9,11,18,20,22,31,33,35,44,46,48 (17 calls)
```

`partition` puts everything smaller than the last element (the pivot) before it; then each side is
sorted the same way. Recursion depth stays small here; a call deeper than 2048 is skipped by the
game (F3).

### Level 3: a dictionary

<!-- file: 17-dsa-dictionary.ptc -->
```ptc
// Level 3: a dictionary. Array indexes can be text, so counts["cat"] is its own
// variable: counting words needs no search.
var counts[];
var known[];
var keys[];

function countWords(text) {
  let word = "";
  for (let i = 0; i <= len(text); i += 1) {
    let c = charAt(text, i);
    if (i == len(text) || c == " ") {
      if (word != "") {
        if (known[word] != 1) {
          known[word] = 1;
          counts[word] = 0;
          push(keys, word);
        }
        counts[word] += 1;
      }
      word = "";
    } else {
      word ..= c;
    }
  }
}

on start {
  countWords("the cat saw the dog and the dog saw the cat");
  let text = "";
  for (let i = 0; i < len(keys); i += 1) { text ..= keys[i] .. "=" .. counts[keys[i]] .. " "; }
  say(text);
}
```

```
the=4 cat=2 saw=2 dog=2 and=1 
```

An index can be text: `counts["the"]` is a variable of its own. `known` remembers which words were
seen, because reading an element that was never set gives no value. `keys` keeps the words in the
order they came.

### Level 3: shortest path in a maze

<!-- file: 18-dsa-maze.ptc -->
```ptc
// Level 3: shortest path through a maze with breadth-first search.
// The maze is text rows ("x" is a wall); "seen" is a dictionary keyed by "x,y".
var rows[];
var queueX[];
var queueY[];
var seen[];
var steps[];

function cell(x, y) {
  if (y < 0 || y >= len(rows) || x < 0 || x >= len(rows[0])) { return "x"; }
  return charAt(rows[y], x);
}

function visit(x, y, distance) {
  let key = x .. "," .. y;
  if (cell(x, y) == "x" || seen[key] == 1) { return; }
  seen[key] = 1;
  steps[key] = distance;
  push(queueX, x);
  push(queueY, y);
}

function shortestPath(startX, startY) {
  clear(queueX);
  clear(queueY);
  visit(startX, startY, 0);
  let head = 0;
  while (head < len(queueX)) {
    let x = queueX[head];
    let y = queueY[head];
    head += 1;
    let distance = steps[x .. "," .. y];
    if (cell(x, y) == "E") { return distance; }
    visit(x + 1, y, distance + 1);
    visit(x - 1, y, distance + 1);
    visit(x, y + 1, distance + 1);
    visit(x, y - 1, distance + 1);
  }
  return -1;
}

on start {
  push(rows, "S.x...");
  push(rows, ".xx.x.");
  push(rows, "...x..");
  push(rows, ".x...x");
  push(rows, "...x.E");
  say("shortest path: {shortestPath(0, 0)} steps");
}
```

```
shortest path: 9 steps
```

Breadth-first search visits cells in order of distance: the queue holds cells to look at, and each
cell's neighbors get distance + 1. The first time it reaches `E`, that distance is the shortest.
`x .. "," .. y` makes a text key for the dictionaries `seen` and `steps`.

### Level 3: a heap

<!-- file: 19-dsa-heap.ptc -->
```ptc
// Level 3: a binary min-heap (priority queue) and heap sort.
// The smallest value is always at index 0; children of i are 2i+1 and 2i+2.
var heap[];

function swap(i, j) {
  let keep = heap[i];
  heap[i] = heap[j];
  heap[j] = keep;
}

function insert(value) {
  push(heap, value);
  let i = len(heap) - 1;
  while (i > 0) {
    let parent = floor((i - 1) / 2);
    if (heap[parent] <= heap[i]) { return; }
    swap(i, parent);
    i = parent;
  }
}

function removeSmallest() {
  let smallest = heap[0];
  let last = pop(heap);
  if (len(heap) == 0) { return smallest; }
  heap[0] = last;
  let i = 0;
  while (1) {
    let left = 2 * i + 1;
    let right = left + 1;
    let pick = i;
    if (left < len(heap) && heap[left] < heap[pick]) { pick = left; }
    if (right < len(heap) && heap[right] < heap[pick]) { pick = right; }
    if (pick == i) { return smallest; }
    swap(i, pick);
    i = pick;
  }
}

on start {
  let input = "31 4 15 9 2 6 53 5";
  let digits = "";
  for (let i = 0; i <= len(input); i += 1) {
    if (i == len(input) || charAt(input, i) == " ") {
      insert(number(digits));
      digits = "";
    } else {
      digits ..= charAt(input, i);
    }
  }
  let sorted = "";
  while (len(heap) > 0) { sorted ..= removeSmallest() .. " "; }
  say("heap sort: {sorted}");
}
```

```
heap sort: 2 4 5 6 9 15 31 53 
```

A binary heap keeps the smallest value at index 0. `insert` adds at the end and swaps up past
bigger parents; `removeSmallest` moves the last value to the top and swaps it down past smaller
children. Taking the smallest until the heap is empty sorts the values.

### Level 3: union-find

<!-- file: 20-dsa-union-find.ptc -->
```ptc
// Level 3: union-find (disjoint sets), e.g. which players are in the same squad.
// parent[i] == i means i leads its group; find() also shortens the path.
var parent[];

function find(i) {
  while (parent[i] != i) {
    parent[i] = parent[parent[i]];
    i = parent[i];
  }
  return i;
}

function join(a, b) {
  let rootA = find(a);
  let rootB = find(b);
  if (rootA != rootB) { parent[rootB] = rootA; }
}

on start {
  for (let i = 0; i < 8; i += 1) { push(parent, i); }
  join(0, 1); join(2, 3); join(1, 3); join(5, 6);
  let groups = 0;
  for (let i = 0; i < 8; i += 1) {
    if (find(i) == i) { groups += 1; }
  }
  say("{groups} groups; 0 and 2 together: {find(0) == find(2)}; 4 and 5 together: {find(4) == find(5)}");
}
```

```
4 groups; 0 and 2 together: 1; 4 and 5 together: 0
```

Each element points to a parent; a group's leader points to itself. `join` links two leaders.
`find` also makes every element on its way point to its grandparent, so later searches are short.

### Level 3: a linked list

Nodes are indexes. Parallel arrays hold each node's fields: `value[node]` and `next[node]`. This
is how any record ("struct") is built in the language: one array per field, one index per record.

<!-- file: 21-dsa-linked-list.ptc -->
```ptc
// Level 3: a singly linked list. Each node is an index into two arrays:
// value[node] holds the data, next[node] the following node (-1 ends the list).
var value[];
var next[];
var head = -1;

function newNode(data) {
  push(value, data);
  push(next, -1);
  return len(value) - 1;
}

function addFront(data) {
  let node = newNode(data);
  next[node] = head;
  head = node;
}

function addBack(data) {
  let node = newNode(data);
  if (head == -1) { head = node; return; }
  let last = head;
  while (next[last] != -1) { last = next[last]; }
  next[last] = node;
}

function remove(data) {
  if (head == -1) { return 0; }
  if (value[head] == data) { head = next[head]; return 1; }
  let previous = head;
  while (next[previous] != -1) {
    let node = next[previous];
    if (value[node] == data) {
      next[previous] = next[node];
      return 1;
    }
    previous = node;
  }
  return 0;
}

function reverse() {
  let previous = -1;
  let node = head;
  while (node != -1) {
    let following = next[node];
    next[node] = previous;
    previous = node;
    node = following;
  }
  head = previous;
}

function middle() {
  let slow = head;
  let fast = head;
  while (fast != -1 && next[fast] != -1) {
    slow = next[slow];
    fast = next[next[fast]];
  }
  return value[slow];
}

function listText() {
  let text = "";
  let node = head;
  while (node != -1) {
    text ..= value[node] .. " → ";
    node = next[node];
  }
  return text .. "end";
}

on start {
  addBack("b"); addBack("c"); addFront("a"); addBack("d"); addBack("e");
  say("list: {listText()}, middle {middle()}");
  remove("c");
  remove("a");
  say("without a and c: {listText()}");
  reverse();
  say("reversed: {listText()}");
}
```
```
list: a → b → c → d → e → end, middle c
without a and c: b → d → e → end
reversed: e → d → b → end
```

- `remove` relinks the node before around the removed one; the removed node stays in the arrays,
  unused.
- `reverse` walks once and turns every `next` around, keeping three nodes in hand: previous,
  current, following.
- `middle` moves `slow` one step and `fast` two: when `fast` reaches the end, `slow` is halfway.
- The arrow is `→`: a `>` stored in a variable reaches the game as `&gt;` (F26).

### Level 3: a binary search tree, and mirroring it

<!-- file: 22-dsa-binary-tree.ptc -->
```ptc
// Level 3: a binary search tree. Nodes are indexes into key[], left[] and right[]
// (-1 means no child). Smaller keys go left, bigger keys right.
var key[];
var left[];
var right[];
var root = -1;
var visited = "";

function insert(newKey) {
  push(key, newKey);
  push(left, -1);
  push(right, -1);
  let node = len(key) - 1;
  if (root == -1) { root = node; return; }
  let at = root;
  while (1) {
    if (newKey < key[at]) {
      if (left[at] == -1) { left[at] = node; return; }
      at = left[at];
    } else {
      if (right[at] == -1) { right[at] = node; return; }
      at = right[at];
    }
  }
}

function has(wanted) {
  let at = root;
  while (at != -1) {
    if (key[at] == wanted) { return 1; }
    if (wanted < key[at]) { at = left[at]; } else { at = right[at]; }
  }
  return 0;
}

function inOrder(node) {
  if (node == -1) { return; }
  inOrder(left[node]);
  visited ..= key[node] .. " ";
  inOrder(right[node]);
}

function preOrder(node) {
  if (node == -1) { return; }
  visited ..= key[node] .. " ";
  preOrder(left[node]);
  preOrder(right[node]);
}

function height(node) {
  if (node == -1) { return 0; }
  let leftHeight = height(left[node]);
  let rightHeight = height(right[node]);
  if (leftHeight > rightHeight) { return leftHeight + 1; }
  return rightHeight + 1;
}

function mirror(node) {
  if (node == -1) { return; }
  let keep = left[node];
  left[node] = right[node];
  right[node] = keep;
  mirror(left[node]);
  mirror(right[node]);
}

function walk(order) {
  visited = "";
  if (order == "in") { inOrder(root); } else { preOrder(root); }
  return visited;
}

on start {
  let input = "50 30 70 20 40 60 80 35";
  let digits = "";
  for (let i = 0; i <= len(input); i += 1) {
    if (i == len(input) || charAt(input, i) == " ") {
      insert(number(digits));
      digits = "";
    } else {
      digits ..= charAt(input, i);
    }
  }
  say("in order: {walk("in")}");
  say("pre order: {walk("pre")}");
  say("height {height(root)}, has 35: {has(35)}, has 36: {has(36)}");
  mirror(root);
  say("mirrored, in order: {walk("in")}");
}
```
```
in order: 20 30 35 40 50 60 70 80 
pre order: 50 30 20 40 35 70 60 80 
height 4, has 35: 1, has 36: 0
mirrored, in order: 80 70 60 50 40 35 30 20 
```

- Every key in a node's left subtree is smaller, every key in its right subtree bigger, so
  `has` follows one path down, and an in-order walk (left, node, right) gives sorted keys.
- `inOrder`, `preOrder`, `height` and `mirror` are recursive; each call keeps its own `node`.
- `mirror` swaps the children of every node: the tree is reversed, and the in-order walk now gives
  the keys from biggest to smallest.
- `-1` stands for "no child", like `null` in other languages.

### Level 3: more sorting algorithms

<!-- file: 23-dsa-more-sorting.ptc -->
```ptc
// Level 3: four more sorts on the same data, each from a fresh copy.
// selection sort, merge sort (recursive), counting sort (small whole numbers), shell sort.
var numbers[];
var merged[];
var counts[];

function fill() {
  clear(numbers);
  let input = "5 2 9 1 5 6 3 8 0 7 4 2";
  for (let i = 0; i < len(input); i += 2) { push(numbers, number(charAt(input, i))); }
}

function listText() {
  let text = "";
  for (let i = 0; i < len(numbers); i += 1) { text ..= numbers[i]; }
  return text;
}

function swap(i, j) {
  let keep = numbers[i];
  numbers[i] = numbers[j];
  numbers[j] = keep;
}

function selectionSort() {
  for (let i = 0; i < len(numbers) - 1; i += 1) {
    let smallest = i;
    for (let j = i + 1; j < len(numbers); j += 1) {
      if (numbers[j] < numbers[smallest]) { smallest = j; }
    }
    swap(i, smallest);
  }
}

function mergeSort(low, high) {
  if (high - low < 1) { return; }
  let middle = floor((low + high) / 2);
  mergeSort(low, middle);
  mergeSort(middle + 1, high);
  let a = low;
  let b = middle + 1;
  clear(merged);
  while (a <= middle || b <= high) {
    if (b > high || (a <= middle && numbers[a] <= numbers[b])) {
      push(merged, numbers[a]);
      a += 1;
    } else {
      push(merged, numbers[b]);
      b += 1;
    }
  }
  for (let i = 0; i < len(merged); i += 1) { numbers[low + i] = merged[i]; }
}

function countingSort(largest) {
  clear(counts);
  for (let v = 0; v <= largest; v += 1) { push(counts, 0); }
  for (let i = 0; i < len(numbers); i += 1) { counts[numbers[i]] += 1; }
  let at = 0;
  for (let v = 0; v <= largest; v += 1) {
    for (let k = 0; k < counts[v]; k += 1) {
      numbers[at] = v;
      at += 1;
    }
  }
}

function shellSort() {
  let gap = floor(len(numbers) / 2);
  while (gap > 0) {
    for (let i = gap; i < len(numbers); i += 1) {
      let current = numbers[i];
      let j = i;
      while (j >= gap && numbers[j - gap] > current) {
        numbers[j] = numbers[j - gap];
        j -= gap;
      }
      numbers[j] = current;
    }
    gap = floor(gap / 2);
  }
}

on start {
  fill();
  say("input:     {listText()}");
  selectionSort();
  say("selection: {listText()}");
  fill();
  mergeSort(0, len(numbers) - 1);
  say("merge:     {listText()}");
  fill();
  countingSort(9);
  say("counting:  {listText()}");
  fill();
  shellSort();
  say("shell:     {listText()}");
}
```
```
input:     529156380742
selection: 012234556789
merge:     012234556789
counting:  012234556789
shell:     012234556789
```

| Sort | Idea | Work for n values |
|---|---|---|
| selection | find the smallest of the rest, put it next | about n² compares |
| merge | sort both halves, then merge them through `merged` | about n·log n |
| counting | count each value, write the values back in order; whole numbers in a small range only | about n + range |
| shell | insertion sort over elements `gap` apart, then smaller gaps | between the two |
| bubble, insertion (level 2) | swap neighbors / shift into place | about n² |
| quicksort (level 3) | partition around a pivot, sort both sides | about n·log n on average |
| heap sort (level 3) | take the smallest from a heap until empty | about n·log n |

In this game every array access costs a scan of all variables (section 10), so fewer accesses
matter more than in other languages: for a few dozen values, any of these is fine.

## 10. Cost, limits and pitfalls

- **Everything in one event runs in one frame.** A long loop does not slow down over time: it
  freezes the game until it ends. The loop guard stops an event after 100000 jumps back
  (`--guard`); use `wait(frames)` in `on` and `every` blocks to spread work over frames.
- **Array access is expensive.** Each `list[i]` with a variable index makes the game search all
  variables for names inside a text (F9). Keep arrays small; prefer plain variables in hot loops.
- **A trigger holds 100 actions.** Longer code continues in the next trigger automatically; the
  compiler reports how many triggers and actions a program uses.
- **Text in a variable that contains another variable's name** is replaced inside shown text and
  array indexes (F9). Avoid short names in the host map; `--into` warns about clashes.
- **`& < > "` in literal text** reach the game as `&amp; &lt; &gt; &quot;` (F26); `say` shows
  `< > "` correctly. The compiler warns.
- **Arrays are global**, `wait` works only in `on` and `every` blocks, and one map has one chat
  receiver and one join trigger.
- **`for player`** works in multiplayer only.
- **Test before you play:** `--run` simulates; add `--frames 300` for timers and `wait`.

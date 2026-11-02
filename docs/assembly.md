# The .pasm assembler

One instruction per line. `;` or `//` start a comment.

```
start:
    set   $i, 0
loop:
    add   $i, 1
    jgt   $i, 10, @done
    jmp   @loop
done:
    say   "count: {$i}"
```

## Operands

| Form | Meaning |
|---|---|
| `$name` | program variable `~<prefix>_name~` |
| `@label` | the trigger that starts at `label` |
| `"text"` | text; escapes `\" \\ \n \{ \}`; `{$name}` inside gives the variable's game name |
| anything else | written as is: numbers, host variable names, uids such as `#trigger*5` |

## Instructions

| Instruction | Becomes |
|---|---|
| `jmp @L` | 363 |
| `call @L` | 99; the called code returns when its trigger chain ends |
| `ret` | ends the current trigger |
| `jeq jne jlt jle jgt jge a, b, @L` | skip actions (361, 364, 365, 123) and 363; `jle`/`jge` are "not greater"/"not less" |
| `set $x, v` | 100, or 125 when `v` is a variable |
| `add $x, v` | 102, or 102 + 104 when `v` is a variable |
| `say text[, color]` | 42 |
| `<alias> a, b` / `op<N> a, b` | any action |

## Directives

| Directive | Meaning |
|---|---|
| `.prefix name` | the prefix (the command line `--prefix` wins) |
| `.start label` | where the start timer starts (default: the first label) |
| `.entry label ...` | labels the map calls itself; they get a stable uid |
| `.extern #uid ...` | uids of the host map |
| `.timer name @label delay [calls] [disabled]` | a timer element |

Every label that is jumped to starts a new trigger. Code longer than 100 actions continues in
the next trigger; a skip action is never separated from the action it skips.

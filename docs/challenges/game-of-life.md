# Challenge: Conway's Game of Life

Build Conway's Game of Life in `.ptc`, running inside a Plazma Burst 2 map. No solution is given
here: this page sets the rules, the levels and the tests. Everything you need is in
[language.md](../language.md), [tutorial.md](../tutorial.md) and [actions.md](../actions.md).

Fair warning: a big board can freeze the game or make the map file too large. Finding where those
limits are is part of the challenge.

## The rules of Life

The board is a grid of cells, each alive or dead. Every generation, all cells change at once:

1. A live cell with 2 or 3 live neighbors stays alive.
2. A dead cell with exactly 3 live neighbors becomes alive.
3. Every other cell is dead in the next generation.

Neighbors are the 8 cells around a cell. Decide, and write down, what happens at the edges: dead
cells beyond the border, or a board that wraps around (the right edge touches the left).

## Levels

| Level | Goal |
|---|---|
| 1. Text board | A 10 × 10 board shown in chat, one line per row (for example `.` dead, `O` alive). One generation every 2 seconds (`every`). |
| 2. Commands | Chat commands: `-glider`, `-blinker`, `-random`, `-clear` to set the board; `-pause`, `-play`, `-step`; `-speed N`. |
| 3. On the map | Show the board with map objects instead of chat: one decoration, light or region per cell, declared with `decor` / `light` / `region` and created by `--into`. |
| 4. Big board | 20 × 20 or larger without freezing the game: spread one generation over several frames. |
| 5. Multiplayer | Every player sees the same board: one player's game computes, `sync` shares the result. |

## Tests your program must pass

Run them with `npm run compile -- life.ptc --run --frames N`, and in the game with the live check.

| Pattern | Start | Expected |
|---|---|---|
| Block (still life) | 2 × 2 live square | never changes |
| Blinker (oscillator) | 3 live cells in a row | turns into a column, then back: period 2 |
| Glider (spaceship) | the standard 5-cell glider | after 4 generations, the same shape one cell down and one right |
| Empty board | all dead | stays empty |
| Lonely cell | 1 live cell | dead after 1 generation |

## Constraints that will bite

- **One event runs in one frame.** All the work of one `every` run happens before the game draws
  again; a long one freezes the game.
- **The loop guard** stops an event after 100000 jumps back (`--guard` changes it). A 20 × 20 board
  with 8 neighbor reads per cell is 3200 reads per generation, before any other work.
- **Array reads cost a scan of all variables** (F9): each `cells[i]` with a variable index makes the
  game look for every variable name inside a short text. More cells means more variables means
  slower reads: the cost grows faster than the board.
- **Objects are fixed at load time.** There is no "decoration number i": showing cell `i` on the map
  means one `action` per cell, chosen with `if` or a long chain. Count how many actions and
  triggers that makes (the CLI prints both).
- **Map size.** Every created object and every trigger is a line in the map XML. Hundreds of cells
  times several actions each adds up.
- **Text and entities:** `<` and `>` stored in variables reach the game as `&lt;` `&gt;` (F26); pick
  other characters for the board.

## Hints (no code)

- Keep two boards: read the current one, write the next one, then swap. Writing in place changes
  neighbors before they are counted.
- A cell's index can be `y * width + x`; text keys `"x,y"` work too (tutorial 17), at a cost.
- Rows of text (`"..O.."`) are cheap to show and to read with `charAt`; arrays are easier to change.
  Try both and measure.
- Count only around live cells, or keep a list of cells that changed, to skip dead areas.
- Measure with `--run`: the simulator prints how many actions ran. Compare designs by that number.
- `wait(frames)` inside an `on` or `every` block continues the work later; a generation can be split
  into row bands.

## Deliverables

1. `life.ptc` (and `life.xml` / `life-map.xml` from the compiler).
2. A short note: board size, edge rule, how many actions one generation runs (from `--run`), how many
   triggers and objects the map gets, and the biggest board that did not freeze the game.
3. The tests above, passing in the simulator and in the game.

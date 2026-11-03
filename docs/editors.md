# Editors

Three ways to write `.ptc` with errors, completion and docs as you type.

## In the browser

The web page runs the compiler and the simulator in the browser: nothing to install, nothing is
sent anywhere. Files are kept in the browser's local storage.

The layout follows the system's light or dark appearance. Shortcuts use ⌘ on a Mac and Ctrl
elsewhere.

- **Toolbar:** Examples and Files open searchable lists (Files is also ⌘P). Run (⌘⇧↩) runs the
  program in the simulator; Build (⌘↩) writes the XML and the trigger text. The field next to them
  shows the result (triggers, actions, timers) and a chip for every setting that is not the default
  (`pcode`, `obfuscated`, `replace`, `env 2`...); a click on a chip opens Settings at that setting.
- **Panels:** every file, Output, Reference and Settings is a tab. Drag a tab to reorder it, onto
  the edge of another panel to split the view, or out to float it; drag the lines between panels to
  resize them. The layout is saved; "Reset the layout" in the command list puts it back. Closing a
  file's tab keeps the file (⌘P opens it again); "Delete file" in the command list removes it. `+`
  in a file group adds a file (for `import`); an example loads with the files it imports.
- **Editor:** highlighting, errors and warnings underlined as you type, completion (names,
  builtins, `Color.` values, actions inside `action(`, constructors and properties in `map { }`),
  docs on hover, F12 or Ctrl+B to go to a definition. The file whose editor was used last is the one
  Build and Run compile.
- **Output:** Problems, XML, Trigger text, Map, Run. Copy and Download act on the shown tab. Build
  and Run open the panel again if it was closed.
- **Map…:** choose a map downloaded from the editor; the Map tab shows it with the program added
  (and the objects of `map { }` blocks added or updated; the changes are listed in Problems). `×`
  forgets it.
- **Blueprint:** a drawing of the map: the objects of `map { }` blocks in the editor's colors, and
  the chosen map's own objects dimmed behind them. It starts as a small card in the bottom-right
  corner; a click expands it.
  - Scroll to zoom, drag empty space to pan, F or "Fit" shows everything; the bar shows the
    coordinates under the pointer, snapped to 10 like the editor (Alt: exact).
  - Click an object to select it: the editor shows the line that made it. Put the code cursor on a
    constructor line and its objects light up (all of them for a line inside a loop). Hover shows
    the uid, kind and values.
  - Drag an object, or a handle of a rectangle, to try another place or size. This is a scratchpad:
    the code is not changed, and the next compile (any edit) puts everything back. A moved object
    shows its code position as a dashed outline; "N moved · Reset" undoes all moves, arrow keys
    nudge the selected object by 10 (Shift: 1).
  - The card of the selected object shows its current values (`x: 420, y: -60, w: 200, h: 30`) with
    Copy and "Insert at cursor". Double-click an empty spot to insert `x: …, y: …` at the code
    cursor; Shift+drag a rectangle to insert `x: …, y: …, w: …, h: …`.
- **Window controls** in the tab bar of Blueprint, Settings and Reference: `–` shrinks the panel to
  a card in a corner (drag it near another corner and it snaps there; cards in the same corner
  stack), `⤢` expands it again, `⇲` puts a floating panel back into the layout, `⧉` opens it in its
  own browser window. A minimized Settings card shows the settings that differ from the defaults.
- **Settings (⚙, ⌘,):** opens as a floating window (drag it by its tab, or dock it like any panel).
  - Output: target `Triggers` (default) or `P-code` (`--target`, [pcode.md](pcode.md)); "Protect text
    from the site editor" (on by default) keeps text like `"007"` as text when the map is saved in
    the website editor (F36; off is `--no-number-text`); "Direct array index" (`--direct-index`).
  - Names: prefix, and name seed (`--name-seed`: reproducible, source-independent names).
  - Protection: obfuscate and its seed (`--obfuscate`, `--obfuscate-seed`; New picks one).
  - Map: "Replace the previous build" (`--replace`): remove the program's old triggers, timers,
    walls and backgrounds from the chosen map first. The page remembers the uids and walls of the
    last map build (per file), so this works across renamed builds.
  - Advanced: loop guard, frames to run, Vim keys, and `env("NAME")` values, one `NAME=value` per
    line. These are not saved: the box is empty when the page opens again ([passwords.md](passwords.md)).
- **Commands (⌘K):** every button and setting, the output tabs, files and examples, by typing words
  of the name (or letters in order). ↑ ↓ choose, ↩ runs, Esc closes.
- **Reference (⌘\\):** a panel (docked on the right at first) with everything the language and the game offer: actions by the
  editor's categories (with its colors), map objects and their properties, value lists, engine
  marks, builtins, keywords, parameter kinds. Every type is a link (an action's `door` leads to the
  `Door` object and back to every action that takes a door); search finds names first, then
  descriptions and action numbers. "Insert at cursor" and `+` write the code into the editor.
  "Follow" (on by default) shows the page of the word at the cursor. "This program" lists the
  file's declarations; each shows where it is used (also inside `"{x}"` and in imported files),
  and a click jumps there.


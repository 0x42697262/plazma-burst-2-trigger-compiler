# Editors

Three ways to write `.ptc` with errors, completion and docs as you type.

## In the browser

The web page runs the compiler and the simulator in the browser: nothing to install, nothing is
sent anywhere. Files are kept in the browser's local storage.

The layout follows the system's light or dark appearance. Shortcuts use ⌘ on a Mac and Ctrl
elsewhere.

- **Toolbar:** Run (⌘⇧↩) runs the program in the simulator; Build (⌘↩) writes the XML and the
  trigger text. The field next to them shows the result (triggers, actions, timers) and a chip for
  every setting that is not the default (`pcode`, `obfuscated`, `replace`, `env 2`...); click a chip
  to open the settings.
- **Editor:** highlighting, errors and warnings underlined as you type, completion (names,
  builtins, `Color.` values, actions inside `action(`, constructors and properties in `map { }`),
  docs on hover, F12 or Ctrl+B to go to a definition. Several files: `+` adds one (for `import`); an
  example loads with the files it imports.
- **Output** under the editor: Problems, XML, Trigger text, Map, Run. Drag the line above it to
  resize; Copy and Download act on the shown tab.
- **Map…:** choose a map downloaded from the editor; the Map tab shows it with the program added
  (and the objects of `map { }` blocks added or updated; the changes are listed in Problems). `×`
  forgets it.
- **Settings (⚙, ⌘,):**
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
- **Commands (⌘K):** every button and setting, the output tabs and all examples, by typing part of
  the name. ↑ ↓ choose, ↩ runs, Esc closes.
- **Reference (⌘\\):** a sidebar with everything the language and the game offer: actions by the
  editor's categories (with its colors), map objects and their properties, value lists, engine
  marks, builtins, keywords, parameter kinds. Every type is a link (an action's `door` leads to the
  `Door` object and back to every action that takes a door); search finds names first, then
  descriptions and action numbers. "Insert at cursor" and `+` write the code into the editor.
  "Follow" (on by default) shows the page of the word at the cursor. "This program" lists the
  file's declarations; each shows where it is used (also inside `"{x}"` and in imported files),
  and a click jumps there.

Build it locally with `npm run web` (writes `site/`; serve that folder with any static server). On
GitHub, `.github/workflows/pages.yml` builds and deploys it on every push to `master`; turn it on
once in the repository settings: Pages → Source → GitHub Actions.

## Neovim (0.11 or newer)

Add the plugin folder of this repository to the runtime path, for example with lazy.nvim:

```lua
{ dir = '/path/to/plazma-burst-2-trigger-compiler/editors/nvim' }
```

or in `init.lua`:

```lua
vim.opt.rtp:append('/path/to/plazma-burst-2-trigger-compiler/editors/nvim')
```

It sets the `ptc` and `pasm` filetypes, highlighting, comments, and starts the language server
(`node bin/ptc-lsp.js --stdio`, Node 22.18 or newer, after `npm install` in the repository). Then
the usual LSP keys work: `K` hover, `gd` / `<C-]>` definition, `grr` references, `<C-x><C-o>` or
your completion plugin, `]d` next diagnostic, `gO` document symbols.

## Other editors

`ptc-lsp` is a standard language server over stdio. Point any LSP client at
`node /path/to/plazma-burst-2-trigger-compiler/bin/ptc-lsp.js --stdio` for files ending in `.ptc`
and `.pasm`. For example Helix (`languages.toml`):

```toml
[language-server.ptc-lsp]
command = "node"
args = ["/path/to/plazma-burst-2-trigger-compiler/bin/ptc-lsp.js", "--stdio"]

[[language]]
name = "ptc"
scope = "source.ptc"
file-types = ["ptc", "pasm"]
comment-token = "//"
language-servers = ["ptc-lsp"]
```

What the server offers: diagnostics (compile errors and warnings, also for imported files),
completion, hover, go to definition (also into imported files), find references (globals across
imported files and inside `"{x}"` text, locals in their own function), document symbols.

# Editors

Three ways to write `.ptc` with errors, completion and docs as you type.

## In the browser

The web page runs the compiler and the simulator in the browser: nothing to install, nothing is
sent anywhere. Files are kept in the browser's local storage.

- Editor: highlighting, errors and warnings underlined as you type, completion (names, builtins,
  `Color.` values, actions inside `action(`), docs on hover, F12 or Ctrl+B to go to a definition.
- Vim mode: tick "Vim".
- "site editor" (on by default): keeps text like `"007"` as text when the map is saved in the
  website editor (F36 in `docs/game-facts.md`). Untick it for other map editors; same as
  `--no-number-text`.
- "direct index" (off by default): same as `--direct-index`, for maps with many variables.
- Several files: `+` adds one (for `import`); an example loads with the files it imports.
- Compile (Ctrl+Enter): XML, trigger text, and problems. Run (Ctrl+Shift+Enter): the simulator's
  chat lines and variables.
- "map XML": choose a map downloaded from the editor; the Map tab shows it with the program appended
  (and declared objects the map lacks added). Download saves the shown output.

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
the usual LSP keys work: `K` hover, `gd` / `<C-]>` definition, `<C-x><C-o>` or your completion
plugin, `]d` next diagnostic, `gO` document symbols.

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
completion, hover, go to definition (also into imported files), document symbols.

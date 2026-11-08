# Maps on plazmaburst2.com

`npm run site -- <command>` opens and saves maps on the website from the terminal, so a build
goes into the game without the browser. The web page will get the same later.

| Command | What it does |
|---|---|
| `login [<login>]` | asks for the password, checks it with the site and remembers the sign-in |
| `logout` | forgets it |
| `maps` | lists your maps |
| `pull <map id> [--out <dir>] [--ptc]` | writes `<dir>/<map id>.xml` (default `out/`); `--ptc` also converts it to `<map id>.ptc` ([convert.md](convert.md)) |
| `push <map.xml> <map id> [--backup] [--backup-dir <dir>]` | replaces one of your maps with the file |
| `new <name>` | creates the empty map `<login>-<name>` |

A typical round:

```bash
npm run site -- login
npm run site -- pull krulyuno-arena
npm run compile -- game.ptc --into out/krulyuno-arena.xml
npm run site -- push out/game-map.xml krulyuno-arena
```

## Rules

- **Your maps** can be pulled and pushed. **Other players' maps** can only be pulled, and only when
  their owner set sharing to Open; any other map is refused ("not yours and not open source, or it
  does not exist"). Map ids are typed in; there is no list of open maps.
- `push` replaces the whole map without asking, like the website's "Replace with .xml file". The
  map's settings (name, description, published, mode, sharing, preview) are sent back as they are.
  The site removes the map's "Approval" flag on every source save.
- `--backup` (off by default) first saves the map as it is on the site to
  `<dir>/<map id>-<time>.xml` (default `backups/`), so the replaced version can be pushed back.
- After a push the map is downloaded again and compared with the file; a difference is a warning.
- `push` takes map XML only. `npm run compile -- <file.ptc> --into <map.xml>` writes the whole map
  (`out/<name>-map.xml`); the plain `.xml` output holds only the program.

## Signing in

- The site knows a player by two cookies: `login` and `password`, the md5 of the password. The
  password itself is never stored or sent; only its md5 is.
- `login` keeps the login and the md5 in `$XDG_CONFIG_HOME/pb2-trigger-compiler/site-session.json`
  (`~/.config/…`, or `%APPDATA%\…` on Windows), readable only by you. The md5 works as the
  password on the site, so treat the file like one.
- `PB2_LOGIN` and `PB2_PASSWORD` (the password or its md5) win over the file and save nothing,
  for scripts and CI.

## Why the web page cannot do it yet

The site sends no CORS headers and its cookies are `SameSite=Lax`, and it takes the sign-in only
as cookies (the same values in the body or URL are refused). A page on another site therefore can
neither send a signed-in request nor read the answer. Only code running on plazmaburst2.com itself
(a userscript, for example) or outside the browser can.

## How it talks to the site

Facts: [game-facts.md](game-facts.md) F56. Code: `src/site/` (`client.ts` the requests,
`protocol.ts` cookies and page parsing, `main.ts` the commands).

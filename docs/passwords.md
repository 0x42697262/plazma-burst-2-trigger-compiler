# Map passwords

A chat password whose text is nowhere in the map: the map holds only its hash, and the compiler
checks that the password itself never gets in.

```
import "std/hash.ptc";

secret const PASSWORD = env("MAP_PASSWORD");
const PASSWORD_HASH = hash(PASSWORD);

on chat {
  if (hash(chatText()) == PASSWORD_HASH) {
    say("{talkerName()} knows the password");
  }
}
```

Compile it with the password in the environment, so it is not in the source file either:

```
MAP_PASSWORD='open sesame' npm run compile -- vault.ptc
```

## How it works

1. `env("MAP_PASSWORD")` reads the password while compiling; the source file does not contain it.
2. `secret` marks it: compiling fails if its text would be written into the map.
3. `hash(PASSWORD)` runs while compiling; the map gets three numbers such as
   `23762524-31648875-43034097`.
4. In the game, `hash(chatText())` runs the same function on what the player wrote and compares.

On the web page, click "env…" and write `MAP_PASSWORD=open sesame` in the box. The box is not
saved: it is empty again when the page is opened next time, and the password is in neither the
source nor the map.

## What it protects, and what not

- Reading the map, in the editor or as XML, shows the hash, not the password.
- `hash` cannot be turned back into the text. But any text with the same three numbers is
  accepted too. Each number is below 2^26, so finding such a text by trying is far out of reach
  for casual players; people who know how polynomial hashes are attacked could still find one.
- Players see what a correct password does. Do not use the password for anything else.

## Rules for the password

- At least 4 characters.
- Letters, digits, spaces and `!#$%'()*+,-./:;=?@[\]^_`{|}~` count as themselves. `& < > "` and
  characters outside this list all count as one and the same character: leave them out.
- Each character costs about 30 actions when a player writes in chat.

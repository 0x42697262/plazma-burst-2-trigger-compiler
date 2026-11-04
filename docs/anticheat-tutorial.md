# Anti-cheat tutorial

This tutorial adds the anti-cheat library (`std/anticheat/`) to a map step by step. Part 1 uses
one check at a time, Part 2 mixes several, and Part 3 turns everything on. Each step is a complete
program you can compile. The [anti-cheat reference](anticheat.md) lists every setting and explains
what the library cannot check.

## Contents

0. [Before you start](#0-before-you-start)
1. [One check at a time](#part-1-one-check-at-a-time)
   1. [Movement](#11-movement)
   2. [Teleport](#12-teleport)
   3. [Health](#13-health)
   4. [Zoom](#14-zoom)
   5. [Guns](#15-guns)
   6. [Zones](#16-zones)
   7. [Triggers and variables](#17-triggers-and-variables)
   8. [Calibrate](#18-calibrate)
2. [Mixing checks](#part-2-mixing-checks)
   1. [A deathmatch arena](#21-a-deathmatch-arena)
   2. [A parkour map](#22-a-parkour-map)
   3. [A co-op map with a vault](#23-a-co-op-map-with-a-vault)
3. [Everything at once](#part-3-everything-at-once)
   1. [The full import](#31-the-full-import)
   2. [Reacting to violations](#32-reacting-to-violations)
   3. [Your own check](#33-your-own-check)
4. [Maps that change players themselves](#part-4-maps-that-change-players-themselves)
   1. [A new map tells the library](#41-a-new-map-tells-the-library)
   2. [A saw map: hooks in old triggers](#42-a-saw-map-hooks-in-old-triggers)
   3. [A zombie co-op map](#43-a-zombie-co-op-map)
5. [Adding it to an existing map](#part-5-adding-it-to-an-existing-map)
6. [When honest players get reported](#part-6-when-honest-players-get-reported)

## 0. Before you start

The library is a set of `.ptc` files: you import the checks you want into your own program, set
a few values in `on start`, and compile the program into your map:

```
npm run compile -- ac.ptc --into my-map.xml
```

That writes `out/ac-map.xml`: your map with the program's triggers, its timers, the probe
region `#acProbe` and the Var Sync engine mark added. On the website, replace the map with that
file (the editor cannot import into an open map). Without `--into`, `out/ac.xml` holds the same
elements to append by hand. The `.txt` output holds triggers only, so use the XML.

Three words used all through:

- A **strike** is one suspicious thing a check saw. Strikes fade: one is forgotten every
  `acStrikeDecay` ticks (150, about 5 seconds).
- A **violation** is `acStrikeLimit` strikes (3) adding up. It is reported in the chat:
  ```
  [anticheat] ann (ann) slot 2: speed, jump (jump speed -15.2)
  ```
  the name, the login, the slot, the checks that gave strikes, and the last detail.
- A **punishment** follows a violation when `acPunishment` asks for one. It acts only on the
  player's own game, because only that game can change the player for everyone.

A tick is one timer run: about 30 per second.

`--run` does not show detections: the simulator does not run the actions that read characters.
Try the programs in the game.

## Part 1: one check at a time

### 1.1 Movement

`movement.ptc` watches each player's speed. It reports running faster than `acMaxSpeedX` for half a
second, a jump that starts faster than `acMaxJumpSpeed`, and rising for several ticks without
gravity slowing the player down (flying).

<!-- file: ac-movement.ptc -->
```ptc
import "std/anticheat/movement.ptc";

on start {
  acSlots = 8;            // the map has 8 <player> elements
  acMaxSpeedX = 20;       // a little above the fastest run in this map
  acMaxJumpSpeed = 12;    // a normal jump starts at 8, 10 without a gun
}
```

- `acSlots` is the number of player slots to check in multiplayer. Set it in every program.
- Leave `acGravity` at 0.5 unless the map changes the gravity (engine mark or action 5); then set
  it to the map's value.
- A map that raises mobility, scale or the jump multiplier makes legal jumps faster: raise
  `acMaxJumpSpeed` to match.

### 1.2 Teleport

`teleport.ptc` compares how far each player moved in one tick with how fast they were moving. A
map's own teleporter moves players just as far, so the map has to say when it does that.

<!-- file: ac-teleport.ptc -->
```ptc
import "std/anticheat/teleport.ptc";

region padIn = "#pad_in";
region padOut = "#pad_out";

export function teleporter() {
  acExempt(initiator(), 15);                         // no strikes for this player for 15 ticks
  action(TeleportInitiatorFromTo, padIn, padOut);
}

on start {
  acSlots = 8;
  acAddSafeBox(2000, -600, 300, 200);                // a lift: no movement checks inside it
}
```

- `export function teleporter()` gets the uid `#ac-teleport_teleporter`. Set it as the region's
  "Activation Trigger" in the editor.
- `acExempt(slot, ticks)` gives one player a grace period. `acExemptAll(ticks)` gives one to
  everyone, for example when a round starts and every player is moved to a spawn.
- `acAddSafeBox(left, top, width, height)` turns the checks off inside an area, in map units: the
  x, y, w and h of a region drawn over it. Use it where triggers cannot call `acExempt`, such as
  pushers and lifts.
- Respawns and joins have their own grace period already (`acRespawnGrace`, `acJoinGrace`).

### 1.3 Health

`health.ptc` reads each player's hitpoints. It reports:

- hitpoints above the map's maximum;
- hitpoints jumping up by a lot in one tick;
- a dead player standing up where they fell instead of respawning;
- a player whose hitpoints do not go down when set lower.

<!-- file: ac-health.ptc -->
```ptc
import "std/anticheat/health.ptc";

export function healingStation() {
  acExempt(initiator(), 5);
  action(254, 60, 0);         // heal the player who used the region by 60 hitpoints
}

on start {
  acSlots = 8;
  acMaxHp = 150;              // the hea and hmax of this map's <player> elements
  acMaxHealStep = 40;         // this map has no healing guns
}
```

- `acMaxHp` must be the map's real maximum. The editor's default for a player is 130.
- The game regenerates about 1 hitpoint per tick and a healing gun adds about 15 per hit, so
  `acMaxHealStep` (50) leaves room for both. A map that heals in big steps calls `acExempt` first,
  as `healingStation` does.
- Revives are not checked in co-op matches, where teammates can revive each other. Set
  `acReviveInCoop = 1` if your co-op map has no healing guns.

### 1.4 Zoom

`zoom.ptc` checks the camera of the player on each game. A camera zoomed out further than the map
allows shows more of the map than the other players see.

<!-- file: ac-zoom.ptc -->
```ptc
import "std/anticheat/zoom.ptc";

on start {
  acMinZoom = 80;             // this map zooms out to 80 % in its big hall
}
```

- With `acMinZoom = 0` (the default), the library learns the zoom 30 ticks after the start, which
  fits a map that never changes its zoom.
- A map that zooms out by itself sets `acMinZoom` to its smallest zoom.
- With `acZoomRestore = 1` (the default), the zoom is also set back right away.

### 1.5 Guns

`guns.ptc` reads the gun each player holds and reports a model the map never hands out. On the
player's own game it also drops their guns.

<!-- file: ac-guns.ptc -->
```ptc
import "std/anticheat/guns.ptc";

on start {
  acSlots = 8;
  acAllowGun(GunModel.gun_rifle);
  acAllowGun(GunModel.gun_pistol);
  acAllowGun(GunModel.gun_shotgun);
}
```

- List every model a player can get: the guns placed in the map, the hero gun engine marks, guns
  given by triggers. A missing one makes honest players drop their guns.
- With no `acAllowGun`, the check is off.
- `acGunDrop = 0` reports without dropping.

### 1.6 Zones

`zones.ptc` reports a living player inside a place no player can reach: inside a wall, in a sealed
room, outside the map. Being there means the player went through something solid.

<!-- file: ac-zones.ptc -->
```ptc
import "std/anticheat/zones.ptc";

on start {
  acSlots = 8;
  acForbidBox(400, -300, 200, 300);         // the thick wall in the middle
  acForbidBox(1800, -900, 400, 250);        // the sealed control room
  acForbidBox(-5000, 1000, 15000, 3000);    // below the map
}
```

- The boxes are in map units: draw a region over the place in the editor and copy its x, y, w
  and h.
- Keep the boxes a little inside the walls, so a player pressed against a wall is not inside one.

### 1.7 Triggers and variables

`triggers.ptc` catches triggers started by hand, regions used from far away and variables written
from outside the map.

<!-- file: ac-triggers.ptc -->
```ptc
import "std/anticheat/triggers.ptc";

door vaultDoor = "#vault_door";
region vaultOpen = "#vault_open";

export function openVault() {
  if (!acGuardUse(1200, -340, 150)) { return; }   // the vault's button is at 1200, -340
  action(MovableTo, vaultDoor, vaultOpen);
}

on start {
  acSlots = 8;
}
```

- `acGuardUse(x, y, radius)` returns 0, and gives a strike, when the player who used the region is
  more than `radius` map units from `x, y`. Put it first in every exported function a region
  starts.
- The bait triggers (`adminGiveAllGuns`, `adminGodMode`, `debugUnlockAll`) come with the import.
  Nothing in the map runs them, so whoever runs one is reported, by name.
- The bait variables (`is_admin`, `godmode`, `infinite_ammo`, `vip_level`) hold 0. A change is
  reported without a name, because a synced value does not say who sent it.
- To protect your own values, compile with `--tamper-check` and declare them `protected var`
  ([tamper-check.md](tamper-check.md)).

### 1.8 Calibrate

The limits depend on the map. `calibrate.ptc` prints the highest values your own player reaches,
so you can set them from real play:

<!-- file: ac-calibrate.ptc -->
```ptc
import "std/anticheat/calibrate.ptc";
```

Play the map normally: run, jump, fall, take damage, use the teleporters, pushers and vehicles.
The chat shows, whenever a value grows:

```
[calibrate] speed x 14.2, jump -9.6, step 23, hp 130, zoom 100
```

Set the limits a little above those values:

- `acMaxSpeedX` above `speed x`;
- `acMaxJumpSpeed` above the size of `jump`;
- `acTeleportMargin` above `step`;
- `acMaxHp` to `hp`;
- `acMinZoom` to `zoom`.

Remove the import before you publish the map.

## Part 2: mixing checks

Import several files: each is added once, and they all share the same players, strikes and
settings.

### 2.1 A deathmatch arena

Players fight with the guns on the floor, and a jump pad launches them to the upper floor. The
goals: no speed or flying, no teleporting, no extra hitpoints, no guns from outside. Violators
freeze for 5 seconds.

<!-- file: ac-arena.ptc -->
```ptc
import "std/anticheat/movement.ptc";
import "std/anticheat/teleport.ptc";
import "std/anticheat/health.ptc";
import "std/anticheat/guns.ptc";

region jumpPadIn = "#jump_pad";
region jumpPadOut = "#upper_floor";

export function jumpPad() {
  acExempt(initiator(), 20);
  action(TeleportInitiatorFromTo, jumpPadIn, jumpPadOut);
}

on start {
  acSlots = 10;
  acMaxSpeedX = 18;
  acMaxHp = 130;
  acAllowGun(GunModel.gun_rifle);
  acAllowGun(GunModel.gun_shotgun);
  acAllowGun(GunModel.gun_rl);
  acPunishment = AC_PUNISH_FREEZE;
  acPunishFrames = 150;
}
```

- `GunModel.gun_rl` explosions push players fast. If rocket jumps get reported, raise
  `acMaxSpeedX` and `acMaxJumpSpeed`, or `acStrikeLimit`.
- Freeze sets the player's mobility to 0 and gives it back (`acNormalMobility`, 1) after
  `acPunishFrames` ticks.

### 2.2 A parkour map

A race over platforms, with checkpoints that move the player back when they fall. Here every
shortcut matters, so the limits are strict and a violation kills the player.

<!-- file: ac-parkour.ptc -->
```ptc
import "std/anticheat/movement.ptc";
import "std/anticheat/teleport.ptc";
import "std/anticheat/zones.ptc";

region fallZone = "#fall";
region checkpoint = "#checkpoint";

export function fell() {
  acExempt(initiator(), 15);
  action(TeleportInitiatorFromTo, fallZone, checkpoint);
}

on start {
  acSlots = 6;
  acMaxSpeedX = 14;
  acMaxJumpSpeed = 10.5;
  acFlyFrames = 6;
  acForbidBox(3000, -1200, 600, 900);       // the inside of the big tower
  acForbidBox(-2000, -3000, 1500, 2500);    // the sky above the start
  acPunishment = AC_PUNISH_KILL;
  acStrikeLimit = 2;
}
```

- `acStrikeLimit = 2` reports faster: two strikes within `acStrikeDecay` ticks.
- Kill sets the player's hitpoints to 0 on their own game, so they respawn at the start.

### 2.3 A co-op map with a vault

Players work together through levels and open a vault at the end. Teammates revive each other.
Each game checks only its own player (`AC_SCOPE_OWN`), so the checks cost the same however many
players join.

<!-- file: ac-coop.ptc -->
```ptc
import "std/anticheat/health.ptc";
import "std/anticheat/zones.ptc";
import "std/anticheat/triggers.ptc";

door vaultDoor = "#vault_door";
region vaultOpen = "#vault_open";

export function openVault() {
  if (!acGuardUse(5200, -800, 120)) { return; }
  action(MovableTo, vaultDoor, vaultOpen);
}

on start {
  acScope = AC_SCOPE_OWN;
  acMaxHp = 200;
  acForbidBox(5100, -1100, 300, 250);       // inside the vault, before it opens
}
```

- `acScope = AC_SCOPE_OWN`: a player who stops the triggers on their own game is not checked by
  anyone else. Use it only when the cost matters more than that.
- Revives are not checked here: in co-op matches teammates revive each other.

## Part 3: everything at once

### 3.1 The full import

`std/anticheat/all.ptc` imports every check except `calibrate.ptc`. Set what your map needs and
leave the rest at the defaults:

<!-- file: ac-all.ptc -->
```ptc
import "std/anticheat/all.ptc";

region teleportIn = "#tp_in";
region teleportOut = "#tp_out";

export function teleporter() {
  acExempt(initiator(), 15);
  action(TeleportInitiatorFromTo, teleportIn, teleportOut);
}

on start {
  acSlots = 10;
  acStrikeLimit = 3;
  acPunishment = AC_PUNISH_FREEZE;

  acMaxSpeedX = 18;
  acMaxJumpSpeed = 12;

  acMaxHp = 130;
  acMaxHealStep = 50;

  acMinZoom = 100;

  acAllowGun(GunModel.gun_rifle);
  acAllowGun(GunModel.gun_pistol);

  acForbidBox(400, -300, 200, 300);
  acAddSafeBox(2000, -600, 300, 200);
}
```

The whole library adds about 240 triggers and 2300 actions. If your map has many variables,
compile with `--direct-index`:

```
npm run compile -- ac-all.ptc --into my-map.xml --direct-index
```

To turn single checks off without changing the imports, set their switch to 0:
`acMovementEnabled`, `acTeleportEnabled`, `acHealthEnabled`, `acZoomEnabled`, `acGunEnabled`,
`acZoneEnabled`, `acBaitEnabled`. `acEnabled = 0` turns everything off.

### 3.2 Reacting to violations

After each violation the library updates four exported values:

- `acViolationCount`: the number of violations so far;
- `acLastViolationSlot`: the slot (-1 for a bait variable);
- `acLastViolationCode`: the check, one of the `AC_*` codes;
- `acLastViolationText`: the chat line.

A program can watch them and do more. This one closes the shop for everyone after a violation by
the player on this game, and keeps a count of teleport violations:

<!-- file: ac-react.ptc -->
```ptc
import "std/anticheat/all.ptc";

door shopDoor = "#shop_door";
region shopClosed = "#shop_closed";

var seenViolations = 0;
var teleportViolations = 0;

every 30 {
  if (acViolationCount == seenViolations) { return; }
  seenViolations = acViolationCount;
  if (acLastViolationCode == AC_TELEPORT) { teleportViolations += 1; }
  if (acLastViolationSlot == slot()) {
    action(MovableTo, shopDoor, shopClosed);
    say("The shop closed: a cheat was noticed on this game.", Color.NoirLime);
  }
}

on start {
  acSlots = 8;
}
```

The codes are `AC_SPEED`, `AC_JUMP`, `AC_FLY`, `AC_TELEPORT`, `AC_HP_ABOVE_MAX`, `AC_HEAL`, `AC_GOD`,
`AC_REVIVE`, `AC_ZOOM`, `AC_GUN`, `AC_ZONE`, `AC_BAIT_VARIABLE`, `AC_BAIT_TRIGGER` and
`AC_REMOTE_USE`.

### 3.3 Your own check

`acFlag(slot, code, weight, detail)` gives a player strikes from your own rule. They count, fade and
lead to reports and punishments like the library's own. Use a code of 16 or more, so it does not
clash with the library's. The report names it `check <code>`.

This map has a key card: a player without it must not reach the server room.

<!-- file: ac-own-check.ptc -->
```ptc
import "std/anticheat/all.ptc";

const CODE_NO_KEY_CARD = 16;
var keyCards[];

export function takeKeyCard() {
  keyCards[initiator()] = 1;
}

export function enterServerRoom() {
  let who = initiator();
  if (keyCards[who] != 1) {
    acFlag(who, CODE_NO_KEY_CARD, acStrikeLimit, "reached the server room without the key card");
  }
}

on start {
  acSlots = 8;
  for (let index = 0; index < 8; index += 1) { keyCards[index] = 0; }
}
```

`acStrikeLimit` as the weight makes one time enough for a violation. Use 1 for a rule that honest
players can break by accident.

## Part 4: maps that change players themselves

Many maps teleport, heal, resize, lift or revive players on purpose. The checks only see the
result, and a map's teleport looks just like a cheater's: no action tells which trigger moved a
player. So the map tells the library, at the moment it acts:

- `acExempt(slot, ticks)` for a moment: a teleport, a heal, a launch;
- an allowance for a state that lasts: `acSetMaxHp`, `acAllowFlight`, `acSetMoveScale`,
  `acAllowRevive` (until `acResetAllowances`, or until another login takes the slot);
- a safe box for a place: a trap room, a teleport exit, a lift.

The reference has the table of which checks respect what
([Map changes or cheats](anticheat.md#map-changes-or-cheats)).

### 4.1 A new map tells the library

A map with power-ups: a giant potion, a jetpack, a boss who gets 1000 hitpoints. Each function
tells the library before it changes the player.

<!-- file: ac-powerups.ptc -->
```ptc
import "std/anticheat/movement.ptc";
import "std/anticheat/teleport.ptc";
import "std/anticheat/health.ptc";

const GIANT_SCALE = 2;
const BOSS_HP = 1000;

export function giantPotion() {
  let who = initiator();
  acSetMoveScale(who, GIANT_SCALE);        // twice the speed and jump limits from now on
  let size = GIANT_SCALE;
  action(533, who, size);                  // the map makes the player twice as big
}

export function jetpackOn() {
  acAllowFlight(initiator(), 1);           // the jetpack timers push this player up
}

export function jetpackOff() {
  acAllowFlight(initiator(), 0);
}

export function becomeBoss() {
  let who = initiator();
  acExempt(who, 5);                        // the jump to 1000 hitpoints is not a heal
  acSetMaxHp(who, BOSS_HP);                // and 1000 is this player's new maximum
  action(498, who, BOSS_HP);
}

export function powerUpsEnd() {
  let who = initiator();
  acResetAllowances(who);
  let size = 1;
  action(533, who, size);
}

on start {
  acSlots = 8;
}
```

- Tell the library in the same trigger that changes the player. Nothing runs between two actions
  of one trigger (F55 in [game-facts.md](game-facts.md)), so the checks never see the change
  without the allowance.
- Allowances belong to the player's login. When someone else takes the slot, they start with the
  map-wide limits.

### 4.2 A saw map: hooks in old triggers

A saw map from before the library: its traps teleport players into rooms and back. Its triggers
cannot call `acExempt(slot, ticks)`, since a trigger in the editor has no way to pass arguments.
`hooks.ptc` adds triggers without parameters that act on the player who started the map's
trigger (the initiator):

<!-- file: saw.ptc -->
```ptc
import "std/anticheat/movement.ptc";
import "std/anticheat/teleport.ptc";
import "std/anticheat/health.ptc";
import "std/anticheat/hooks.ptc";

on start {
  acSlots = 10;
  acHookFrames = 20;
  acAddSafeBox(3000, -900, 800, 400);      // the crusher room: players get thrown around
}
```

Compiled with `--into saw-map.xml`, the program's hooks get the uids `#saw_acHookExempt`,
`#saw_acHookAllowRevive` and so on. In the editor, open each trap trigger that moves a player and
put one action before the move: "Execute trigger" with `#saw_acHookExempt`. As trigger text:

```
uid: #trigger*12
enabled: true
maxcalls: -1

ExecTrigger( "#saw_acHookExempt", "0" );
TeleportInitiatorFromTo( "#region*5", "#region*9" );
```

Or rewrite those triggers from the program instead of the editor. A `map { }` block with
`--into` replaces a trigger's actions; copy the original actions and settings and add the hook
first:

<!-- file: saw-rewrite.ptc -->
```ptc
import "std/anticheat/teleport.ptc";
import "std/anticheat/hooks.ptc";

map {
  Trigger("#trigger*12", maxcalls: Infinite) {
    action(ExecTrigger, @acHookExempt);
    action(TeleportInitiatorFromTo, "#region*5", "#region*9");
  }
}

on start {
  acSlots = 10;
}
```

To find the triggers that need a hook, look for the actions that move, heal, resize or revive
players. The reference lists them, with a `grep` line that prints their uids
([Finding the triggers that change players](anticheat.md#finding-the-triggers-that-change-players)).

Hooks act on the initiator. A trigger started by a timer, or by another player's action, has the
wrong initiator or none. Give those places a safe box, or use `acHookExemptAll`.

### 4.3 A zombie co-op map

Humans who die stand up again where they fell, as zombies, on the other team, with more
hitpoints, a little bigger and faster. Without the library knowing, that is a revive, hitpoints
above max, a heal and speed all at once. This map turns players itself, so it tells the library
for each zombie:

<!-- file: ac-zombies.ptc -->
```ptc
import "std/anticheat/movement.ptc";
import "std/anticheat/health.ptc";
import "std/anticheat/zoom.ptc";
import "std/anticheat/triggers.ptc";

const ZOMBIE_HP = 400;
const ZOMBIE_SCALE = 1.3;
const ZOMBIE_REVIVE_TICKS = 60;
var zombies[];

function turnIntoZombie(who) {
  acAllowRevive(who, ZOMBIE_REVIVE_TICKS);   // standing up in place is the map's doing
  acExempt(who, 30);                         // so is the jump in hitpoints
  acSetMaxHp(who, ZOMBIE_HP);
  acSetMoveScale(who, ZOMBIE_SCALE);
  action(507, who, Team.BlueTeam);
  action(498, who, ZOMBIE_HP);               // then the map's own revive actions
  zombies[who] = 1;
}

export function cure() {
  let who = initiator();
  acResetAllowances(who);
  zombies[who] = 0;
}

every 15 {
  for player p {
    let dying = 0;
    action(544, dying, p);
    if (dying == 1 && zombies[p] != 1) { turnIntoZombie(p); }
  }
}

on start {
  acSlots = 12;
  acMaxHp = 130;                             // humans
  acReviveInCoop = 1;                        // check revives even in co-op: the map allows its own
}
```

- `acReviveInCoop = 1` turns the revive check on in co-op matches. That only works because the
  map allows each of its own revives first. Without that, leave it at 0.
- The checks that no map mechanic can trip still apply to everyone, zombies included: refused
  damage, the bait triggers and variables, zoom.

The same map made before the library would use hooks in its resurrection trigger, when that
trigger is started by the zombie itself: set `~<prefix>_acHookMaxHp~` to 400 with "Set variable",
then "Execute trigger" `#<prefix>_acHookAllowRevive` and `#<prefix>_acHookSetMaxHp`.

## Part 5: adding it to an existing map

The library needs nothing from the map: it reads players by slot and brings its own probe
region. To add it to a map you already have:

1. Download the map as XML.
2. Write a program for it (Part 1 to 3), with `acSlots` and `acMaxHp` taken from the map's
   `<player>` elements and the guns it hands out in `acAllowGun`.
3. Compile it into the map: `npm run compile -- ac.ptc --into old-map.xml`. The compiler refuses uids
   the map already has, such as a second `#acProbe`. To update the map later, compile again with
   `--replace`.
4. Replace the map with `out/ac-map.xml`, and play it with `calibrate.ptc` first.

The old map's own triggers do not know about the library. Tell it what they do with hooks
([4.2](#42-a-saw-map-hooks-in-old-triggers)) or safe boxes (`acAddSafeBox`). Leave out the checks
that do not fit: a map that hands out random guns should not import `guns.ptc`.

## Part 6: when honest players get reported

| Report | Usual cause | Fix |
|---|---|---|
| `speed` | explosions, pushers, vehicles, a map with higher mobility, bigger players | `acSetMoveScale` for resized players; raise `acMaxSpeedX`; safe boxes over pushers and vehicle routes |
| `jump` | rocket jumps, jump pads, higher mobility or scale | raise `acMaxJumpSpeed`; `acExempt` in jump pad triggers |
| `fly` | lifts, upward pushers, water, flight powers | safe boxes over them; `acAllowFlight` for flight powers; set `acGravity` to the map's gravity |
| `teleport` | the map's teleporters, vehicles, lag (seen from another game) | `acExempt` in the teleport trigger; safe boxes; raise `acTeleportMargin` |
| `hp above max` | `acMaxHp` lower than the map's players, triggers that raise max hitpoints | `acSetMaxHp` for players the map raises; `acMaxHp` for everyone else |
| `heal` | the map's healing triggers, medkits | `acExempt` before healing; raise `acMaxHealStep` |
| `revive` | the map revives players itself | `acAllowRevive` / `acExempt` / `acHookAllowRevive` before it; `acReviveRadius = 0` turns the check off |
| `zoom` | the map's own zoom-out | set `acMinZoom` to the map's smallest zoom |
| `gun` | a gun model missing from the list | add it with `acAllowGun` |
| `forbidden zone` | a box touching the walkable area | shrink the box |
| `remote use` | `radius` smaller than the region | raise the `radius` of `acGuardUse` |

Reports from other games (synced, in `AC_SHARED_COLOR`) can be faked by a player. Trust the reports
your own game makes.

# Anti-cheat library

`std/anticheat/*.ptc` lets a map notice players whose game breaks the map's rules: moving,
jumping, healing or zooming in ways the game itself never allows. It reports them in the chat
and can punish them. Pick the checks you want by importing their files, or import
`std/anticheat/all.ptc` for all of them.

```ptc
import "std/anticheat/movement.ptc";
import "std/anticheat/health.ptc";
import "std/anticheat/zoom.ptc";

on start {
  acSlots = 8;                          // player slots in this map
  acMaxHp = 150;                        // the hea/hmax of the map's <player> elements
  acPunishment = AC_PUNISH_FREEZE;      // 0 report, 1 freeze, 2 kill
}
```

| File | Checks |
|---|---|
| `core.ptc` | players, strikes, reports, punishments, grace periods (imported by every check) |
| `slots.ptc` | per-slot helpers for actions that take a fixed character (imported by `core.ptc`) |
| `movement.ptc` | run speed, jump speed, rising against gravity |
| `teleport.ptc` | moves longer than the speed allows |
| `health.ptc` | hitpoints above max, sudden heals, revives in place, refused damage |
| `zoom.ptc` | camera zoomed out past the map's zoom |
| `guns.ptc` | held guns the map does not give |
| `zones.ptc` | players inside solid or closed places |
| `triggers.ptc` | bait triggers, bait variables, region use from afar |
| `calibrate.ptc` | while testing: prints the values to set the limits from |
| `all.ptc` | every check except `calibrate.ptc` |

Compile it into your map with `--into map.xml` as usual. The XML output already has the timers,
the probe region `#acProbe` and the Var Sync engine mark (reports are synced). The trigger
text output does not have them: add the listed timers, the region and the mark by hand.

Facts come from the game client (build v1769098419, the build `docs/game-facts.md` was checked
on). F-numbers point to `docs/game-facts.md`.

## How it works

### Players, strikes and reports (`core.ptc`)

- Every game in a match runs its own copy of the map's triggers (F53). Each game checks the
  players in `acPlayers[]`. In single player that is itself. In multiplayer it is every used slot
  below `acSlots` (`acScope = AC_SCOPE_ALL`, the default), or only its own player
  (`acScope = AC_SCOPE_OWN`). A slot is used when its name (action 185) is not `Empty`. The
  list is rebuilt every 30 ticks, and a new login in a slot starts that slot over.
- A player's own game sees its exact values. The other games see the player through the state
  the network sends (position, speed, hitpoints, held gun), so they check the player too, even
  when the player stops the checks on their own game.
- Checks give **strikes**. `acStrikeLimit` strikes (default 3) make a **violation**, and one strike
  is forgotten every `acStrikeDecay` ticks. A violation is said in the chat on that game. When the
  violator is the player on that game, it is also synced to every game (`acShare`), and
  `acPunishment` is applied. After a violation the player is ignored for `acCooldown` ticks.
- Some things are measured exactly on the player's own game: a teleport, hitpoints above max,
  refused damage, a revive, a gun, a zone. Those are a full violation at once. The same thing seen
  through the network is 1 or 2 strikes (`ac*OtherWeight`), because a late packet can look like
  a jump.
- **Punishments** act only on the player's own game, because a game can only change its own
  character for everyone. With `AC_PUNISH_FREEZE`, mobility is set to 0 (action 521) for
  `acPunishFrames` ticks, then back to `acNormalMobility`. With `AC_PUNISH_KILL`, hitpoints are set
  to 0 and the body is damaged (actions 513, 529).
- **Grace periods** give no strikes:
  - while a player is dying (action 544), and `acRespawnGrace` ticks after;
  - for `acJoinGrace` ticks after a player shows up in a slot;
  - when the map calls `acExempt(slot, ticks)` or `acExemptAll(ticks)`;
  - inside safe boxes (`acAddSafeBox(left, top, width, height)`).
- Some actions read a character only by a fixed index written into the action: hitpoints (122),
  position (80), name (185), login (184) and drop guns (60). The character index is the player
  slot, so `slots.ptc` keeps one guarded copy of each action per slot, 0 to 31.

### Movement (`movement.ptc`)

The game moves a living character by its speed every tick, and adds the gravity (0.5 unless the
map changes it) to its vertical speed every tick. A jump starts at a vertical speed of -8 (-10
without a gun), times the character's mobility, scale and jump multiplier. Each tick, for each
player:

- **Speed:** the horizontal speed (action 427) above `acMaxSpeedX` for `acSpeedFrames` ticks in a
  row is a strike. Short pushes such as explosions end before that.
- **Jump:** the vertical speed (action 428) going from at most falling slowly to faster upwards
  than `acMaxJumpSpeed` in one tick is a strike.
- **Rising against gravity:** while a character rises, gravity slows it down every tick. Rising
  for `acFlyFrames` ticks in a row without slowing down by at least 40 % of `acGravity` is a
  strike. This catches flying, a gravity that does not act on the player, and a gravity lower
  than the map's.

### Teleport (`teleport.ptc`)

Each tick the probe region is moved onto the character (action 80) and its position read
(actions 118, 119). The distance moved since the last tick (x plus y) is compared with
`acTeleportMargin + (|speed x| + |speed y|) * acTeleportSpeedShare`. Moving farther is a teleport:
a violation on the player's own game, `acTeleportOtherWeight` strikes on the others.

### Health (`health.ptc`)

Each tick, for each player, the hitpoints are read (action 122):

- **Above max:** more than `acMaxHp` (+1) is a violation on the own game, 2 strikes elsewhere.
- **Heal:** a rise of more than `acMaxHealStep` in one tick is a strike. The game's regeneration
  gives about 1 per tick and a healing gun about 15 per hit.
- **Revive:** when a dying character stands up again, its position is compared with where it
  fell. Respawning puts it somewhere else; within `acReviveRadius` it was stood up in place. Off
  in co-op matches (action 177 gives 2), where a teammate can revive players
  (`acReviveInCoop = 1` turns it on).
- **Refused damage**, own player only, every `acGodProbeFrames` ticks: the hitpoints are set 1
  lower (action 513) and read back. The game always takes a lower value, so a value that stays
  the same means the character refuses damage, which is a violation. The old hitpoints are put
  back in the same tick, so nothing shows. Action 513 keeps whole numbers only, so a probe can
  round the hitpoints down by less than 1.

### Zoom (`zoom.ptc`)

The camera belongs to each game, so only the own player is checked. Action 369 gives the camera
zoom in percent. `acMinZoom` is the smallest allowed zoom. 0 means it is learned `acZoomLearnAt`
ticks after the start, after the gamescale mark and the start triggers. A zoom below
`acMinZoom * acZoomTolerance` for `acZoomFrames` ticks is a strike. With `acZoomRestore = 1` the
zoom is also set back to `acMinZoom` (action 370, which only changes the own camera).

### Guns (`guns.ptc`)

The map lists every gun model it hands out with `acAllowGun(model)`. Every `acGunFrames` ticks,
each player's held gun model is read (action 555). A model that is not on the list is a violation
on the own game, 2 strikes elsewhere. With `acGunDrop = 1`, the player's own game also drops all
its guns (action 60). With no model allowed, the check is off.

### Zones (`zones.ptc`)

The map marks places no player can reach with `acForbidBox(left, top, width, height)`: the inside
of walls, closed rooms, the space outside the map. Every `acZoneFrames` ticks, a living player
whose position is strictly inside one is a violation on the own game, 2 strikes elsewhere.

### Triggers and variables (`triggers.ptc`)

- **Bait triggers:** `adminGiveAllGuns`, `adminGodMode` and `debugUnlockAll` are exported
  (`#<prefix>_adminGiveAllGuns`…) and nothing in the map runs them. When one runs, its initiator
  (action 180) is the player who started it, also when the run came over the network: the game
  makes the sender the initiator (F53). That player gets a violation.
- **Bait variables:** `is_admin`, `godmode`, `infinite_ammo` and `vip_level` (plain names) are set
  to 0 at the start, and nothing in the map writes them. Every 30 ticks they are compared with 0;
  a change is reported and set back. The report has no player name, because a synced value
  does not carry its sender (F53).
- **`acGuardUse(x, y, radius)`:** call it first in an exported function that a region starts. It
  reads the initiator's position, and when that is more than `radius` from `x, y` on either
  axis, it gives a strike and returns 0, so the function can stop.

## Settings

Set them in your `on start` block, after the imports: the library sets its own values first, in
file order. Every setting is an `export var`, so the host map can also read or change it as
`~<prefix>_name~`.

| Setting | Default | File | Meaning |
|---|---|---|---|
| `acEnabled` | 1 | core | 0 turns every check off |
| `acSlots` | 16 | core | slots 0 to acSlots-1 are checked in multiplayer (at most 32); set it to the number of `<player>` elements |
| `acScope` | `AC_SCOPE_ALL` | core | `AC_SCOPE_OWN`: each game checks only its own player |
| `acStrikeLimit` | 3 | core | strikes per violation |
| `acStrikeDecay` | 150 | core | ticks per forgotten strike |
| `acCooldown` | 90 | core | ticks a player is ignored after a violation |
| `acPunishment` | `AC_PUNISH_REPORT` | core | `AC_PUNISH_FREEZE` or `AC_PUNISH_KILL` (own player only) |
| `acPunishFrames` | 150 | core | how long a freeze lasts |
| `acNormalMobility` | 1 | core | mobility given back after a freeze |
| `acShare` | 1 | core | sync own violations so every game shows them |
| `acRespawnGrace`, `acJoinGrace` | 90, 90 | core | grace ticks after dying and after joining |
| `acMovementEnabled` | 1 | movement | 0 turns the movement checks off |
| `acMaxSpeedX` | 25 | movement | horizontal speed limit (calibrate) |
| `acSpeedFrames` | 15 | movement | ticks above the limit per strike |
| `acMaxJumpSpeed` | 12 | movement | upward launch speed limit; raise it on maps that raise mobility (up to 2×), scale or jump multipliers |
| `acGravity` | 0.5 | movement | the map's gravity (engine mark or action 5) |
| `acFlyFrames` | 8 | movement | rising ticks without slowing down per strike |
| `acTeleportEnabled` | 1 | teleport | 0 turns the check off |
| `acTeleportMargin`, `acTeleportSpeedShare` | 90, 3 | teleport | allowed move per tick: margin + (\|vx\| + \|vy\|) × share |
| `acTeleportOtherWeight` | 1 | teleport | strikes when seen through the network |
| `acHealthEnabled` | 1 | health | 0 turns the health checks off |
| `acMaxHp` | 130 | health | the map's player max hitpoints (0: off) |
| `acMaxHealStep` | 50 | health | hitpoints gained per tick before it counts as a heal |
| `acReviveRadius`, `acReviveInCoop` | 60, 0 | health | revive distance; 1 checks co-op matches too |
| `acGodProbeFrames` | 90 | health | ticks between refused-damage probes (0: off) |
| `acHealthOtherWeight` | 2 | health | strikes when seen through the network |
| `acZoomEnabled` | 1 | zoom | 0 turns the check off |
| `acMinZoom` | 0 (learn) | zoom | smallest allowed zoom in percent |
| `acZoomTolerance`, `acZoomFrames`, `acZoomRestore`, `acZoomLearnAt` | 0.95, 15, 1, 30 | zoom | share of the minimum still allowed, ticks per strike, set the zoom back, when to learn |
| `acGunEnabled`, `acGunFrames`, `acGunDrop`, `acGunOtherWeight` | 1, 10, 1, 2 | guns | on, check interval, drop all guns of an own violator, strikes elsewhere |
| `acZoneEnabled`, `acZoneFrames`, `acZoneOtherWeight` | 1, 5, 2 | zones | on, check interval, strikes elsewhere |
| `acBaitEnabled`, `acRemoteUseOtherWeight` | 1, 2 | triggers | bait triggers and variables on; region-use strikes elsewhere |
| `acCalibrateFrames` | 150 | calibrate | ticks between prints |

Functions:
- `acExempt(slot, ticks)`, `acExemptAll(ticks)`: grace periods.
- `acAddSafeBox(left, top, width, height)`, `acForbidBox(left, top, width, height)`: map areas.
- `acAllowGun(model)`: guns the map hands out.
- `acGuardUse(x, y, radius)`: region use from afar.
- `acFlag(slot, code, weight, detail)`: your own checks.

Results for the host map: `acViolationCount`, `acLastViolationSlot`, `acLastViolationCode` (the
`AC_SPEED`… constants in `core.ptc`) and `acLastViolationText`.

## Calibrating

Limits depend on the map. Mobility, scale, pushers, vehicles, water and explosions all change
how fast players move. Import `std/anticheat/calibrate.ptc` while testing, play the map normally,
and set the limits a little above what it prints. Then:

- call `acExempt(slot, ticks)` in triggers that teleport, launch or heal players
  (`acExemptAll` for everyone);
- put safe boxes over pushers, water, lifts and vehicle routes;
- set `acMinZoom` if the map zooms out by itself.

## Cost

All checks together add about 200 triggers and 2000 actions to the map. Every timer tick, each
checked player costs about 150 actions. An array with a changing index scans every variable of
the map (F37), so compile with `--direct-index` when the map has many variables. A map with 8
players runs a little over 1000 actions per tick, well inside a frame (about 1 µs per action,
F37).

## Not supported

These cannot be checked with trigger actions. Each entry says why.

| Not supported | Why |
|---|---|
| Fire rate, pellets per shot, spread, recoil | No action reads a held gun's settings. Action 334 (frames since a gun's last shot) works only for guns placed in the map, by their fixed index, and no action tells which player holds which of them |
| Bullet damage, speed, lifetime, penetration | No action reads projectiles. A stronger hit only shows as lost hitpoints, which explosions also cause |
| Dropping guns where the map forbids it | No action tells a drop apart from switching to an empty slot; action 555 only reads the held gun |
| Hovering in place | A character held still in the air has a vertical speed of 0, like a character standing on the ground, and no action tells whether a character stands on something |
| Faster horizontal flying below `acMaxSpeedX` | Flying sideways at a normal speed reads like running; only the rise and speed limits apply |
| Seeing hidden information (positions, names, distances, map uids) | Reading values on one's own game changes nothing the map can see. Keep secrets out of reach instead: spawn hidden things late, use `secret const` and `--obfuscate` |
| Reading the map file (triggers, passwords, logic) | Every game downloads the whole map. Use `secret const`, `std/hash.ptc` and `--obfuscate` (docs/passwords.md, docs/obfuscation.md) |
| Walls changed only on one game | Walls have no uid and no action reads them. `zones.ptc` catches a player inside a place you marked, not the changed wall |
| A game that stops its own triggers | A player can stop or change the map's triggers on their own game (F53). Their own reports and punishments stop with them; only the other games' checks of that player remain |
| Kicking or banning | No action removes a chosen player from a match. Action 311 removes only the killer of a death event. Punishments are freeze and kill, on the player's own game |
| Punishing a player from another game | Changing another player's character changes it on this game only; that player's own game keeps its values |
| Who wrote a synced variable | A synced value carries no sender (F53), so bait variables are reported without a name. A player can also sync a fake report: trust the reports your own game makes (`AC_COLOR`) over synced ones (`AC_SHARED_COLOR`) |
| Characters in vehicles | No action tells whether a character is in a vehicle; give vehicle routes safe boxes |
| Enemies and bots | In multiplayer, slots below `acSlots` are checked whatever they hold, so set `acSlots` to the number of `<player>` elements. In single player only the own player is checked |
| Hitpoints above max on maps with different player maximums | `acMaxHp` is one number for all players; no action reads a character's max hitpoints. Set it to the highest, or 0 to turn the check off |
| The trigger text output | `.txt` holds triggers only: add the timers, the `#acProbe` region and the Var Sync engine mark by hand, or use the XML output |
| The web page | The web page bundles only the files directly in `std/`, not `std/anticheat/`. Use the command line, or copy the files next to your program and import them by relative path |

Other limits:

- Chat reports replace any host variable name found inside them by its value (F9). A host map
  with a variable called `speed` or `zoom` gets garbled report text; the checks still work.
- More than 32 player slots: `slots.ptc` covers slots 0 to 31.

## Not tested yet

The library compiles, and its logic was run in the simulator with the character actions replaced
by scripted values. Every check fired on its cheat, and normal jumps, falls, regeneration, death
and respawn, and an exempted teleport gave no report. The simulator does not run the character
actions themselves, so these still need a live game:

1. The real speeds from actions 427 and 428, at 60 and 30 fps, for the own player and for another
   player seen through the network.
2. The refused-damage probe against a character that refuses damage, and that the restore leaves
   nothing visible.
3. Action 80 with 118 and 119 as a player's position (region centered on the character).
4. Synced reports seen by the other players in a real match.
5. Each punishment, freeze and kill, on the player's own game in a match.

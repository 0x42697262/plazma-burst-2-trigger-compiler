# Actions

All 531 trigger actions of the game, generated from the editor's action list
(`src/opcodes/snapshot.json`) by `npm run actions-doc`; do not edit by hand.

Every action can be used:

- in `.ptc`: `action(42, "hello", 0)` or `action(ShowText, "hello", 0)` (alias, or the number;
  an alias with spaces works as text: `action("next if VarA == ValueB", x, 1)`). A variable name as
  an argument gives that variable's game name, `@f` a function's trigger uid, text gives itself.
- in `.pasm`: `ShowText "hello", 0` or `op42 "hello", 0`.
- in the trigger text: the name in the "Text name" column.

Objects (regions, doors, characters, guns...) are given by uid, such as `"#door*1"`; the game
turns uids into objects when the map loads (F18), so they are fixed text in a program.

Notes: **sim** the simulator runs it (others are skipped and listed by `--run`);
**skips** it skips the next action; **replaces A/B** variable names inside that text are
replaced by their values (F9); **avoid** the compiler warns about it; **needs var_sync** the map
needs the Var Sync engine mark (F30).

## Parameter kinds

| Kind | Meaning |
|---|---|
| `barrel` | a barrel uid |
| `bool` | `true` or `false` |
| `botaction` | an AI behavior number |
| `char` | a character model or skin |
| `character` | a character uid (`#player*0`...) |
| `decor` | a decoration uid |
| `decor_model` | a decoration model name |
| `door` | a movable (door) uid |
| `enable-disable` | 1 enable, 0 disable |
| `gun` | a gun uid |
| `gun_model` | a gun model name |
| `int` | a whole number |
| `lamp` | a light uid |
| `maxcalls` | a call count, -1 for unlimited |
| `nochange` | not used; write 0 |
| `pushf` | a pusher uid |
| `pushf_damage` | a pusher damage type |
| `region` | a region uid |
| `sky_model` | a sky model name |
| `song+none` | a song name, or -1 for silence |
| `sound` | a sound name |
| `string` | a variable name or text (see the description) |
| `team` | a team number (12 red, 13 blue, ...) |
| `textmsg` | a chat color: 0 to 4, or `#rrggbb` |
| `timer` | a timer uid |
| `trigger` | a trigger uid |
| `value` | a number |
| `value>0` | a number above 0 |
| `value>=0` | a number, 0 or more |
| `vehicle` | a vehicle uid |
| `voice_preset` | a voice preset |
| `water` | a water uid |

## AI (1)

| # | Text name | A | B | Description | Notes |
|---|---|---|---|---|---|
| 174 | `op174` | string | nochange | Set global AI difficulty (easy = 1, normal = 2, hard = 3) |  |

## Array (7)

| # | Text name | A | B | Description | Notes |
|---|---|---|---|---|---|
| 349 | `op349` | string | string | Split variable 'A' by string-value 'B' | sim |
| 350 | `op350` | string | string | Get index 'B' of variable 'A' and store into variable 'A' | sim, replaces B |
| 352 | `op352` | string | string | Add element 'B'(can be variable) to array 'A' | sim, replaces B |
| 354 | `op354` | string | nochange | Create array at variable 'A' | sim |
| 399 | `op399` | string | string | Split variable 'A' by value of variable 'B' | sim |
| 405 | `op405` | string | string | Join variable 'A' by value of variable 'B' | sim |
| 508 | `op508` | string | nochange | Get all active player slots and save result to Array 'A' | sim |

## Barrel (3)

| # | Text name | A | B | Description | Notes |
|---|---|---|---|---|---|
| 16 | `MoveBarrelToReguin` | barrel | region | Move Barrel 'A' to the Region 'B' (if Barrel not exploded) |  |
| 460 | `op460` | barrel | string | Set Barrel 'A' hitpoints to variable 'B' |  |
| 461 | `op461` | barrel | region | Clone Barrel 'A' and spawn it at centre of Region 'B' |  |

## Character (119)

| # | Text name | A | B | Description | Notes |
|---|---|---|---|---|---|
| 4 | `ChangeCharHPPerc` | character | value | Change the number of hit points of Character 'A' to 'B' percents |  |
| 13 | `PutCharInVeh` | character | vehicle | Put Character 'A' into the Vehicle 'B' |  |
| 14 | `MoveCharToReguin` | character | region | Move Character 'A' to the region 'B' (if Character alive) |  |
| 23 | `SetCharHP` | character | int | Set current hit points of Character 'A' to 'B' hit points (not sets hit points of each limb) |  |
| 28 | `CloneCharInRegionCentre` | character | region | Clone Character 'A' and spawn it in the centre of Region 'B' |  |
| 32 | `SetAIBehavior` | character | botaction | Set ''AI Behavior'' parameter of computer-controlled Character 'A' to value 'B' |  |
| 33 | `SetCharTeam` | character | team | Change team of Character 'A' to value 'B' |  |
| 48 | `MultCharCurrentMaxHPPercent` | character | value | Multiply maximal and current hit points of Character 'A' by 'B' percents. Not for multiplayer |  |
| 52 | `SetCharNickname` | character | string | Change Character 'A' nickname to 'B' |  |
| 53 | `CloneCharToRegionRandomY` | character | region | Clone Character 'A' and spawn it in random place in Region 'B' |  |
| 58 | `SetCharSkin` | character | char | Change Character 'A' skin to 'B' |  |
| 59 | `SetCharCurrentMaxHPValue` | character | value | Set Character 'A' current and max hit points to value 'B' |  |
| 60 | `MakeCharDropGuns` | character | nochange | Force Character 'A' to drop all weapons |  |
| 61 | `MultCharSpeed` | character | value | Multiply Character 'A' speed by value 'B' |  |
| 88 | `SetCharMobility` | character | value | Change Character 'A' mobility factor to 'B' |  |
| 89 | `SetCharArmor` | character | int | Change Character 'A' armor type to 'B' (0, 1 or 2) |  |
| 90 | `SetCharBloodColor` | character | string | Change blood color of Character 'A' to HEX color 'B' |  |
| 91 | `op91` | character | int | Set horizontal movement on idle Character 'A' to value 'B' (0, -1 or 1) |  |
| 92 | `op92` | character | int | Set vertical movement on idle Character 'A' to value 'B' (0, -1 or 1) |  |
| 93 | `op93` | character | int | Set shoot action on idle Character 'A' to value 'B' (0 or 1) |  |
| 94 | `op94` | character | region | Force Character 'A' to look at random point in Region 'B' |  |
| 97 | `op97` | character | character | Force Character 'A' to hunt Character 'B' |  |
| 141 | `DamageHead` | character | value | Damage player 'A' head hitpoints by value 'B' |  |
| 142 | `DamageArms` | character | value | Damage player 'A' arms hitpoints by value 'B' |  |
| 143 | `DamageBody` | character | value | Damage player 'A' body hitpoints by value 'B' |  |
| 144 | `DamageLegs` | character | value | Damage player 'A' legs hitpoints by value 'B' |  |
| 164 | `op164` | character | char | Change head model of Character 'A' to model 'B' |  |
| 165 | `op165` | character | char | Change body model of Character 'A' to model 'B' |  |
| 166 | `op166` | character | char | Change arms model of Character 'A' to model 'B' |  |
| 167 | `op167` | character | char | Change legs model of Character 'A' to model 'B' |  |
| 168 | `op168` | character | string | Set Character 'A' color pattern (4 small letters for each body sections, each represents first symbol of color in lowercase. - disables color change for specific section) |  |
| 220 | `op220` | character | string | Set Character 'A' scale to value 'B' |  |
| 221 | `op221` | character | string | Set Character 'A' scale to value of variable 'B' |  |
| 222 | `op222` | character | string | Set Character 'A' zoom to value 'B' |  |
| 254 | `op254` | string | nochange | Attempt healing of player-initiator by 'A' hit points. Stop trigger execution if player-initiator has maximum hit points or died |  |
| 255 | `op255` | character | string | Heal player 'A' by 'B' hit points |  |
| 256 | `op256` | character | string | Heal player 'A' by value of variable 'B'  |  |
| 270 | `SetPassivePushIntens` | character | string | Set intensity scale of entity pushing force for player 'A' (default 0) |  |
| 271 | `SetPassivePushRadius` | character | string | Set radius of entity pushing force for player 'A' (default 200) |  |
| 272 | `SetVoicePreset` | character | voice_preset | Set Character 'A' voice preset to 'B' |  |
| 273 | `StartGhost` | character | nochange | Add ghost effect to Character 'A' |  |
| 274 | `StopGhost` | character | nochange | Remove ghost effect from Character 'A' |  |
| 281 | `op281` | string | string | Apply damage-over-time effect to player-initiator with power 'A' and duration 'B' (30 duration = 1 second) |  |
| 282 | `op282` | nochange | nochange | Remove all effects from player-initiator |  |
| 297 | `op297` | character | string | Set jump multiplier for player 'A' to value 'B' |  |
| 312 | `op312` | character | gun | Set Character 'A' active weapon to Gun 'B' |  |
| 313 | `op313` | character | nochange | Make Character 'A' drop weapon at current slot |  |
| 317 | `op317` | nochange | team | Set player-initiator team to 'B' |  |
| 318 | `op318` | character | nochange | Make Character 'A' unhittable |  |
| 319 | `op319` | character | nochange | Make Character 'A' hittable |  |
| 320 | `op320` | character | string | Switch singleplayer control to Character 'A'. Set parameter 'B' to 1 if sound needs to be played |  |
| 321 | `op321` | character | nochange | Disallow weapon drop for Character 'A' |  |
| 322 | `op322` | character | nochange | Allow weapon drop for Character 'A' |  |
| 346 | `op346` | character | bool | Enable or Disable Nametag visibility of Character 'A' using parameter 'B' |  |
| 351 | `op351` | string | region | Move Character of slot-value variable 'A' to region 'B' |  |
| 374 | `op374` | character | string | Set Character 'A' stability to value 'B' |  |
| 375 | `op375` | character | string | Set Character 'A' stability to value of variable 'B' |  |
| 402 | `op402` | string | nochange | Move Character slot-value variable 'A' to start position |  |
| 411 | `op411` | character | gun | Make Character 'A' drop Gun 'B' |  |
| 429 | `op429` | character | string | Set X speed of Character 'A' to value of variable 'B' |  |
| 430 | `op430` | character | string | Set Y speed of Character 'A' to value of variable 'B' |  |
| 446 | `op446` | character | value | Set Character 'A' Health bar GUI opacity to value 'B' |  |
| 447 | `op447` | character | string | Set Character 'A' Health bar GUI opacity to variable 'B' |  |
| 451 | `op451` | character | string | Change Character 'A' sword life to variable 'B' |  |
| 455 | `op455` | character | string | Change Character 'A' nickname to variable 'B' |  |
| 456 | `op456` | character | string | Change Character 'A' nametag text to variable 'B' |  |
| 458 | `op458` | character | bool | Set disabling of Character 'A' psi swords to parameter 'B' |  |
| 459 | `op459` | string | bool | Set disabling of Character slot-value variable 'A' psi swords to parameter 'B' |  |
| 464 | `op464` | character | string | Set Character 'A' current and max hit points to variable 'B' |  |
| 482 | `op482` | string | character | Show text bubble above Character 'B' with text 'A' |  |
| 484 | `op484` | string | character | Set variable 'A' to active weapon of Character 'B' |  |
| 485 | `op485` | character | string | Set Character 'A' active weapon slot to slot 'B' |  |
| 495 | `op495` | string | string | Save shoot intention of Character slot-value variable 'B' to variable 'A' |  |
| 496 | `op496` | string | string | Save horizontal movement intention of Character slot-value variable 'B' to variable 'A' |  |
| 497 | `op497` | string | string | Save vertical movement intention of Character slot-value variable 'B' to variable 'A' |  |
| 498 | `op498` | string | string | Set Character slot-value variable 'A' current and max hit points to value 'B' |  |
| 505 | `op505` | character | string | Change team of Character 'A' to variable 'B' |  |
| 506 | `op506` | string | string | Change team of Character slot-value variable 'A' to variable 'B' |  |
| 507 | `op507` | string | string | Change team of Character slot-value variable 'A' to value 'B' |  |
| 511 | `op511` | string | string | Change the number of hit points of Character slot-value variable 'A' to varible 'B' percents |  |
| 512 | `op512` | string | region | Kill all Characters at Region 'B' which are not allied to Character slot-value variable 'A' |  |
| 513 | `op513` | string | string | Set current hit points of Character slot-value variable 'A' to value of variable 'B' hit points (not set points of each limb) |  |
| 514 | `op514` | string | region | Clone Character slot-value variable 'A' and spawn it in the centre of Region 'B' |  |
| 515 | `op515` | string | region | Clone Character slot-value variable 'A' and spawn it in random place of Region 'B' |  |
| 516 | `op516` | string | region | Force all enemies of Character slot-value variable 'A' who located in region 'B' hunt for Character slot-value variable 'A' |  |
| 517 | `op517` | string | string | Set 'AI Behavior' parameter of computer-controlled Character slot-value variable 'A' to value 'B' |  |
| 518 | `op518` | string | string | Change Character slot-value variable 'A' nickname to variable 'B' |  |
| 519 | `op519` | string | nochange | Force Character slot-value variable 'A' to drop all weapons |  |
| 520 | `op520` | string | string | Multiply Character slot-value variable 'A' speed by variable 'B' |  |
| 521 | `op521` | string | string | Change Character slot-value variable 'A' mobility factor to variable 'B' |  |
| 522 | `op522` | string | string | Change Character slot-value variable 'A' armor type to value 'B' |  |
| 523 | `op523` | string | string | Change blood color of Character slot-value variable 'A' to HEX color 'B' |  |
| 525 | `op525` | string | region | Force Character slot-value variable 'A' to look at random point in Region 'B' |  |
| 526 | `op526` | string | string | Force Character slot-value variable 'A' to hunt Character slot-value variable 'B' |  |
| 527 | `op527` | string | string | Damage Character slot-value variable 'A' head hitpoints by variable 'B' |  |
| 528 | `op528` | string | string | Damage Character slot-value variable 'A' arms hitpoints by variable 'B' |  |
| 529 | `op529` | string | string | Damage Character slot-value variable 'A' body hitpoints by variable 'B' |  |
| 530 | `op530` | string | string | Damage Character slot-value variable 'A' legs hitpoints by variable 'B' |  |
| 533 | `op533` | string | string | Set Character slot-value variable 'A' scale to variable 'B' |  |
| 534 | `op534` | string | string | Heal Character slot-value variable 'A' by variable 'B' |  |
| 535 | `op535` | string | string | Set intensity of entity pushing force for Character slot-value variable 'A' to variable 'B' (default 0) |  |
| 536 | `op536` | string | string | Set radius of entity pushing force for Character slot-value variable 'A' to variable 'B' |  |
| 537 | `op537` | string | voice_preset | Set Character slot-value variable 'A' voice preset to 'B' |  |
| 538 | `op538` | string | string | Apply damage-over-time-effect to Character slot-value variable 'A' with power 'B' and duration 'B' (separated by commas) |  |
| 539 | `op539` | string | nochange | Remove all effects from Character slot-value variable 'A' |  |
| 541 | `op541` | string | string | Set jump multiplier for Character slot-value variable 'A' to variable 'B' |  |
| 542 | `op542` | string | gun | Set Character slot-value variable 'A' active weapon to Gun 'B' |  |
| 543 | `op543` | string | nochange | Make Character slot-value variable 'A' drop weapon at current slot |  |
| 545 | `op545` | string | nochange | Make Character slot-value variable 'A' unhittable |  |
| 546 | `op546` | string | nochange | Make Character slot-value variable 'A' hittable |  |
| 547 | `op547` | string | nochange | Disallow weapon drop for Character slot-value variable 'A' |  |
| 548 | `op548` | string | nochange | Allow weapon drop for Character slot-value variable 'A' |  |
| 550 | `op550` | string | string | Show text bubble above Character slot-value variable 'B' with text 'A' |  |
| 551 | `op551` | string | string | Set Character slot-value variable 'A' active weapon to slot 'B' |  |
| 552 | `op552` | string | string | Set variable 'A' to active weapon of Character slot-value variable 'B' |  |
| 553 | `op553` | string | gun | Make Character slot-value variable 'A' drop Gun 'B' |  |
| 554 | `op554` | string | string | Change Character slot-value variable 'A' sword life to variable 'B' |  |
| 555 | `op555` | string | string | Set variable 'A' to active gun model of Character slot-value variable 'B' |  |
| 556 | `op556` | string | region | Move Character slot-value variable 'A' to random place in Region 'B' |  |

## Decoration (18)

| # | Text name | A | B | Description | Notes |
|---|---|---|---|---|---|
| 34 | `SetDecorModel` | decor | decor_model | Change model of Decoration 'A' to model named 'B' |  |
| 231 | `op231` | decor | string | Set text placeholder decoration text |  |
| 232 | `op232` | decor | string | Set decoration HEX color multiplier |  |
| 233 | `op233` | decor | string | Set decoration scale to value 'B' |  |
| 234 | `op234` | decor | string | Set decoration scale to value of variable 'B' |  |
| 267 | `op267` | decor | string | Set decoration X scale to value 'B' |  |
| 268 | `op268` | decor | string | Set decoration Y scale to value 'B' |  |
| 293 | `op293` | decor | decor | Mask Decoration 'A' with Decoration 'B' (Flash Player only) |  |
| 298 | `op298` | decor | string | Set decoration 'A' visibility multiplier to value 'B' (0...1) |  |
| 300 | `op300` | decor | gun | Move, rotate and flip Decoration 'A' to position of Gun 'B' |  |
| 343 | `op343` | decor | string | Attach decoration 'A' to current player's camera. Param 'B' will determine which part of the camera (left, center..) the decoration will be attached to. |  |
| 345 | `op345` | decor | region | Change top-left position of decor 'A' to top-left position of region 'B' |  |
| 408 | `op408` | decor | string | Set Decor 'A' color matrix to Array 'B' (array must have 4x5 items) |  |
| 437 | `op437` | decor | vehicle | Move, rotate and flip Decoration 'A' to position of Vehicle 'B' |  |
| 462 | `op462` | decor | barrel | Move, rotate and flip Decoration 'A' to Barrel 'B' |  |
| 466 | `op466` | decor | string | Set decoration 'A' X scale to variable 'B' |  |
| 467 | `op467` | decor | string | Set decoration 'A' Y scale to variable 'B' |  |
| 478 | `op478` | decor | string | Change Decoration 'A' blend mode to Mode 'B' |  |

## Environment (5)

| # | Text name | A | B | Description | Notes |
|---|---|---|---|---|---|
| 192 | `op192` | sky_model | nochange | Change sky image |  |
| 193 | `op193` | string | nochange | Change sky color HEX multiplier |  |
| 195 | `op195` | string | nochange | Change sky color Red multiplier to value of variable 'A' |  |
| 196 | `op196` | string | nochange | Change sky color Green multiplier to value of variable 'A' |  |
| 197 | `op197` | string | nochange | Change sky color Blue multiplier to value of variable 'A' |  |

## Experience (2)

| # | Text name | A | B | Description | Notes |
|---|---|---|---|---|---|
| 285 | `op285` | nochange | nochange | Reward player with experience points for level completion (singleplayer) |  |
| 286 | `op286` | nochange | nochange | Reward player-initiator with experience points for level completion (multiplayer) |  |

## Gameplay (46)

| # | Text name | A | B | Description | Notes |
|---|---|---|---|---|---|
| 39 | `SetGameSpeed` | value>=0 | nochange | Set game speed to 'A' frames per second (default game speed is 30. Does not influence rendering) |  |
| 40 | `SetStrictCasualMode` | enable-disable | nochange | Change Strict Casual Mode status |  |
| 45 | `SetAIHeal` | enable-disable | nochange | Allow or disallow usage of defibrillators by allies with value of parameter 'A' |  |
| 49 | `SetSwords` | enable-disable | nochange | Set Disabling of psi swords to value of parameter 'A' |  |
| 51 | `Zoom` | value>0 | nochange | Zoom game camera to 'A' % (percents) |  |
| 73 | `SetBulletSpeed` | value | nochange | Change bullet speed to value 'A' (default value is 60) |  |
| 74 | `SetBulletPenetration` | value | nochange | Change bullet penetration factor to value 'A' (default value is 1) |  |
| 75 | `SetBulletMaxLife` | value | nochange | Change max bullet life value 'A' (default value is 30) |  |
| 194 | `op194` | string | nochange | Set respawn speed multiplier (defaults to 1, but 1.5 in ranked) |  |
| 207 | `op207` | nochange | nochange | Enable anonymous mode (disable player overheads, chat messages are not show in chat) |  |
| 208 | `op208` | nochange | nochange | Disable anonymous mode (enable player overheads, chat messages are show in chat) |  |
| 209 | `op209` | string | nochange | Set regeneration speed multiplier to value 'A' (defaults to 1) |  |
| 210 | `op210` | string | nochange | Set regeneration speed multiplier to value of variable 'A' |  |
| 211 | `op211` | string | nochange | Set regeneration delay multiplier to value 'A' (defaults to 1, but 2 in ranked) |  |
| 212 | `op212` | string | nochange | Set regeneration delay multiplier to value of variable 'A' |  |
| 213 | `op213` | string | nochange | Set physical player impact damage multiplier to 'A' (default is 1) |  |
| 214 | `op214` | string | nochange | Set physical player impact damage threshold to 'A' (higher values increase chance to receive any impact damage. Default for approved maps is 0.9, in else cases it is 1) |  |
| 215 | `op215` | string | nochange | Set self-boost force multiplier (default is 1) |  |
| 216 | `op216` | string | nochange | Set unstable self-boost force multiplier for HIGH physics setting (default for approved maps is 2.8, in else cases it is 1) |  |
| 217 | `op217` | string | nochange | Set unstable self-boost force multiplier for LOW physics setting (default is 1) |  |
| 240 | `op240` | string | nochange | Set rocket projetiles' speed multiplier to value 'A' |  |
| 241 | `op241` | string | nochange | Set grenade projetiles' speed multiplier to value 'A' |  |
| 242 | `op242` | string | nochange | Set plasma projetiles' speed multiplier to value 'A' |  |
| 245 | `op245` | region | string | Lock camera at region 'A' (region size must be 800x400 for zoom of 100%) with intensity multiplier 'B' (0..1) |  |
| 246 | `op246` | nochange | nochange | Unlock camera from any region |  |
| 250 | `op250` | nochange | nochange | Enable kinetic module |  |
| 251 | `op251` | nochange | nochange | Disable kinetic module |  |
| 261 | `op261` | nochange | nochange | Allow Time Warp |  |
| 262 | `op262` | nochange | nochange | Disallow Time Warp |  |
| 291 | `op291` | nochange | nochange | Disable automatic disabling of offscreen entities (automatic disabling is enabled by default) |  |
| 292 | `op292` | nochange | nochange | Enable automatic disabling of offscreen entities (automatic disabling is enabled by default) |  |
| 307 | `op307` | nochange | nochange | Restart map (singleplayer) |  |
| 308 | `op308` | nochange | nochange | Reset game termination logic (for example if game is about to end due to player's death) |  |
| 309 | `op309` | nochange | nochange | Make all players leave map or multiplayer match |  |
| 310 | `op310` | nochange | nochange | Make player-initiator leave map or multiplayer match |  |
| 311 | `op311` | nochange | nochange | Make player-killer leave map or multiplayer match |  |
| 380 | `op380` | string | nochange | Set list of slots that can be randomly given to player during respawn using variable 'A' |  |
| 381 | `op381` | string | nochange | Set max amount of weapons that can be given to player during respawn using variable 'A' |  |
| 441 | `op441` | bool | nochange | Enable kinetic module through walls using Parameter 'A' |  |
| 450 | `op450` | value>=0 | nochange | Set range of bullet mirroring to value 'A' (default value is 30) |  |
| 453 | `op453` | bool | nochange | Set disabling of global player collision to parameter 'A' |  |
| 468 | `op468` | bool | nochange | Set disabling of global limb breaking to parameter 'A' |  |
| 477 | `op477` | bool | nochange | Set disabling of global fall impact instability using parameter 'A' |  |
| 479 | `op479` | value | nochange | Change global fall impact instability height multiplier to value 'A' |  |
| 483 | `op483` | bool | nochange | Set Disabling of ambient sounds using parameter 'A' |  |
| 500 | `op500` | string | nochange | Set game speed to variable 'A' frames per second (default game speed is 30. Does not influence rendering) |  |

## Graphics (12)

| # | Text name | A | B | Description | Notes |
|---|---|---|---|---|---|
| 382 | `op382` | region | region | Draw line on current graphic from top-left of region 'A' to top-left of region 'B' |  |
| 383 | `op383` | string | string | Create graphic with name 'A' at layer 'B' (1 is lowest, 3 is highest) |  |
| 384 | `op384` | string | nochange | Select graphic to draw on with name 'A' |  |
| 385 | `op385` | string | string | Begin fill of graphic with name 'A' using hex-colour 'B' |  |
| 386 | `op386` | string | nochange | End fill of graphic with name 'A' |  |
| 387 | `op387` | region | string | Draw circle on current graphic at top-left of region 'A' with radius 'B' |  |
| 388 | `op388` | string | nochange | Clear graphic with name 'A' |  |
| 389 | `op389` | string | string | Set line style of current graphic to thickness 'A' and hex-colour 'B' |  |
| 390 | `op390` | string | region | Set starting position of graphic with name 'A' to region 'B' |  |
| 391 | `op391` | string | region | Draw line from current position of graphic with name 'A' to top-left region 'B' |  |
| 433 | `op433` | string | string | Set opacity of graphic with name 'A' to variable 'B' (percent) |  |
| 443 | `op443` | string | string | Set line style of current graphic to thickness of variable 'A' and hex-colour of variable 'B' |  |

## Gravitator Area Field (4)

| # | Text name | A | B | Description | Notes |
|---|---|---|---|---|---|
| 35 | `SetPusherAccelX` | pushf | value | Set X acceleration of Gravitator Area Field 'A' to value 'B' |  |
| 36 | `SetPusherAccelY` | pushf | value | Set Y acceleration of Gravitator Area Field 'A' to value 'B' |  |
| 37 | `SetPusherStabilityDmg` | pushf | value>=0 | Set stability damage of Gravitator Area Field 'A' to value 'B' (0 for disable) |  |
| 38 | `SetPusherHPDmg` | pushf | pushf_damage | Set damage of Gravitator Area Field 'A' to value 'B' (0 for disable) |  |

## Gravity (1)

| # | Text name | A | B | Description | Notes |
|---|---|---|---|---|---|
| 5 | `SetGravity` | value | nochange | Change the gravity to the value 'A' (Default is 0.5) |  |

## Gun (39)

| # | Text name | A | B | Description | Notes |
|---|---|---|---|---|---|
| 15 | `MoveGunToReguin` | gun | region | Move Gun 'A' to the Region 'B' |  |
| 62 | `SetGunProjectileCount` | gun | value | Force Gun 'A' spawn 'B' projectiles per shot |  |
| 63 | `SetGunAccuracy` | gun | value | Change Gun 'A' accuracy to 'B' degress |  |
| 64 | `SetGunPower` | gun | value | Change Gun 'A' projectile power to 'B' |  |
| 65 | `TurnGunProjectileBullets` | gun | nochange | Convert Gun 'A' projectiles into bullets |  |
| 66 | `TurnGunProjectileRails` | gun | nochange | Convert Gun 'A' projectiles into rails |  |
| 67 | `TurnGunProjectileGrenades` | gun | nochange | Convert Gun 'A' projectiles into grenades |  |
| 68 | `TurnGunProjectileEnergy` | gun | nochange | Convert Gun 'A' projectiles into energy |  |
| 69 | `TurnGunProjectileRockets` | gun | nochange | Convert Gun 'A' projectiles into rockets |  |
| 76 | `SetGunForChars` | gun | nochange | Allow Gun 'A' only for characters |  |
| 77 | `SetGunForVehicles` | gun | nochange | Allow Gun 'A' only for vehicles |  |
| 78 | `SetGunSlot` | gun | int | Set Gun 'A' slot to 'B' |  |
| 81 | `MakeGunExecTriggerOnFire` | gun | trigger | Call Trigger 'B' when Gun 'A' fired |  |
| 170 | `op170` | gun | string | Change Gun 'A' speed multiplier to value 'B' |  |
| 172 | `op172` | gun | string | Change Gun 'A' recoil multiplier to value 'B' |  |
| 175 | `op175` | gun | string | Change Gun 'A' projectile model to model with index 'B' |  |
| 218 | `op218` | gun | string | Change Gun 'A' target knockback multiplier to value 'B' |  |
| 219 | `op219` | gun | string | Change Gun 'A' target knockback multiplier to value of variable 'B' |  |
| 237 | `op237` | gun | string | Change Gun 'A' max spread accuracy to value 'B' (in radians) |  |
| 238 | `op238` | gun | string | Change Gun 'A' added spread accuracy to value 'B' (in radians) per shot |  |
| 239 | `op239` | gun | string | Change Gun 'A' subtracted spread accuracy to value 'B' (in radians) over time |  |
| 260 | `op260` | gun | sound | Assign sound 'B' as firing sound for weapon 'A' |  |
| 287 | `op287` | gun | gun_model | Override existing Gun 'A' with a new gun with model 'B' |  |
| 301 | `op301` | gun | string | Set Gun 'A' projectile scale to value 'B' |  |
| 303 | `op303` | gun | string | Set Gun 'A' arm 1 hold offset to 'B' (0..1) |  |
| 304 | `op304` | gun | string | Set Gun 'A' arm 2 hold offset to 'B' (0..1) |  |
| 305 | `op305` | gun | string | Set Gun 'A' holstered attachment to 'B' (0 = on leg, 1 = on back) |  |
| 306 | `op306` | gun | string | Set Gun 'A' length to value 'B' |  |
| 324 | `op324` | gun | trigger | Call Trigger 'B' when Gun 'A' was fully reloaded while being held by some character |  |
| 355 | `op355` | gun | string | Change Gun 'A' cursor/crosshair to value 'B' |  |
| 377 | `op377` | gun | string | Set gun 'A' upgrade level to string-value/variable 'B' |  |
| 378 | `op378` | gun | string | Change Gun 'A' color to 'B' |  |
| 403 | `op403` | gun | string | Set gun 'A' color matrix to array 'B' (4 rows, 5 columns, first 4 columns are multiplicative, last column is additive) |  |
| 444 | `op444` | gun | string | Change Gun 'A' bullet life multiplier to variable 'B' |  |
| 469 | `op469` | gun | string | Set Gun 'A' rotation to variable 'B' |  |
| 470 | `op470` | gun | string | Set Gun 'A' X scale to variable 'B' |  |
| 473 | `op473` | gun | string | Set Gun 'A' Y scale to variable 'B' |  |
| 486 | `op486` | gun | string | Change Gun 'A' bullet speed multiplier to variable 'B' |  |
| 494 | `op494` | gun | region | Clone Gun 'A' at center of region 'B' |  |

## Interface (9)

| # | Text name | A | B | Description | Notes |
|---|---|---|---|---|---|
| 42 | `ShowText` | string | textmsg | Show text 'A' in chat with color 'B' | sim, replaces A |
| 43 | `SetHint` | string | nochange | Show hint with text 'A'. Leave 'A' as empty to force hint dissapear |  |
| 190 | `op190` | nochange | nochange | Enable multiplayer frag/death messages |  |
| 191 | `op191` | nochange | nochange | Disable multiplayer frag/death messages |  |
| 330 | `op330` | string | string | Set interface visibility multiplier to value 'A' and cursor visibility multiplier to value 'B' |  |
| 338 | `op338` | nochange | nochange | Prevent alive players from seeing chat from dead players |  |
| 339 | `op339` | nochange | nochange | Let alive players see chat from dead players |  |
| 340 | `op340` | nochange | nochange | Disable leader board details (such as alive state, score, team) |  |
| 341 | `op341` | nochange | nochange | Enable leader board details (such as alive state, score, team) |  |

## Light (3)

| # | Text name | A | B | Description | Notes |
|---|---|---|---|---|---|
| 54 | `LightOn` | lamp | nochange | Turn light 'A' on |  |
| 55 | `LightOff` | lamp | nochange | Turn light 'A' off |  |
| 379 | `op379` | lamp | string | Change Light 'A' color to 'B' |  |

## Map preview (1)

| # | Text name | A | B | Description | Notes |
|---|---|---|---|---|---|
| 243 | `op243` | region | string | Create Map Preview from Region 'A' (only owner can execute this. Prevent execution for other players in order to prevent lag) |  |

## Movable (6)

| # | Text name | A | B | Description | Notes |
|---|---|---|---|---|---|
| 0 | `MovableTo` | door | region | Force Movable 'A' move to region 'B' |  |
| 1 | `SetMovableSpeed` | door | value>=0 | Change Speed of Movable 'A' to value 'B' |  |
| 71 | `SetMovableColor` | door | string | Change color of Movable 'A' to HEX color 'B' |  |
| 82 | `MakeMovableExecTriggerOnDamage` | door | trigger | Call Trigger 'B' when Movable 'A' got damage |  |
| 85 | `MuteMovable` | door | nochange | Mute Movable 'A' |  |
| 86 | `UnmuteMovable` | door | nochange | Unmute Movable 'A' |  |

## Other (1)

| # | Text name | A | B | Description | Notes |
|---|---|---|---|---|---|
| -1 | `op-1` | nochange | nochange | Do nothing |  |

## Region (37)

| # | Text name | A | B | Description | Notes |
|---|---|---|---|---|---|
| 2 | `RegionToRegion` | region | region | Quickly move Region with name 'A' to the position of the region with name 'B' |  |
| 6 | `DamageRegion` | value | region | Make damage in Region 'B' with power of 'A' hit points |  |
| 10 | `StabilityDamageRegion` | value | region | Harm the stability with power 'A' of all Characters located at Region with the name 'B' |  |
| 11 | `KillUnaliedInRegion` | character | region | Kill all Characters at Region 'B' which are not allied to Character 'A' |  |
| 12 | `DestroyVehsInRegion` | region | nochange | Destroy all vehicles in Region 'A' |  |
| 18 | `RegionToRegionCenter` | region | region | Move Region 'A' to the Region 'B' (centres will be located in the same point) |  |
| 24 | `ExplosionRegion` | value>=0 | region | Make an explosion with power 'A' at Region 'B' |  |
| 29 | `ForceRegionHuntForChar` | character | region | Force all enemies of Character 'A' who located in region 'B' hunt for Character 'A' |  |
| 30 | `TeleportFromRegionToRegion` | region | region | Teleport all players from Region 'A' to Region 'B' |  |
| 31 | `TeleportFromRegionToRegionFlip` | region | region | Teleport all players from Region 'A' to Region 'B' and invert speed by X axis (used to avoid loop teleportation) |  |
| 56 | `FlipXVelocityRegion` | nochange | region | Flip X speed for all players in region 'B' |  |
| 57 | `FlipYVelocityRegion` | nochange | region | Flip Y speed for all players in region 'B' |  |
| 70 | `TeleportInitiatorFromTo` | region | region | Teleport player-initiator from Region 'A' to Region 'B' |  |
| 72 | `MultCharsSpeedsAtRegion` | region | value | Multiply speed of players in Region 'A' by value 'B' |  |
| 79 | `MoveRegionToCharInitiator` | region | nochange | Move Region 'A' to player-initiator |  |
| 80 | `MoveRegionToChar` | region | character | Move Region 'A' to player 'B' |  |
| 83 | `AddRegionPosX` | region | value | Move Region 'A' relative to current position along X |  |
| 84 | `AddRegionPosY` | region | value | Move Region 'B' relative to current position along Y |  |
| 87 | `MoveRegionToInitiatorCursor` | region | nochange | Move Region 'A' to player-initiator's cursor |  |
| 98 | `op98` | region | door | Move Region 'A' to Movable 'B' |  |
| 259 | `op259` | region | character | Move region 'A' to cursor of player 'B' |  |
| 279 | `SilentlyTeleportInitiatorFromTo` | region | region | Silently teleport player-initiator from Region 'A' to Region 'B' |  |
| 283 | `op283` | character | region | Spawn damage particles of Character 'A' at the center of Region 'B' |  |
| 323 | `op323` | region | gun | Move Region 'A' to Gun 'B' |  |
| 353 | `op353` | region | character | Move Region 'A' to lower body of player 'B' |  |
| 396 | `op396` | region | nochange | Move region 'A' to game camera |  |
| 440 | `op440` | region | character | Initiate region 'A' using character 'B' as initiator |  |
| 480 | `op480` | region | string | Move region 'A' relative to current position along variable 'B' X |  |
| 481 | `op481` | region | string | Move region 'A' relative to current position along variable 'B' Y |  |
| 487 | `op487` | region | nochange | Destroy all projectiles in region 'A' |  |
| 488 | `op488` | region | region | Move projectiles in region 'A' to region 'B' |  |
| 491 | `op491` | region | string | Multiply all projectiles' speed in region 'A' to value 'B' |  |
| 499 | `op499` | region | string | Initiate region 'A' using Character slot-value variable 'B' as initiator |  |
| 540 | `op540` | string | region | Spawn damage particles of Character slot-value variable 'A' at the center of Region 'B' |  |
| 557 | `op557` | string | region | Teleport Character slot-value variable 'A' to Region 'B' and invert speed by X axis (used to avoid loop teleportation) |  |
| 558 | `op558` | string | region | Teleport Character slot-value variable 'A' to Region 'B' |  |
| 559 | `op559` | string | region | Silently teleport Character slot-value variable 'A' to Region 'B' |  |

## Scenario (2)

| # | Text name | A | B | Description | Notes |
|---|---|---|---|---|---|
| 9 | `EndMission` | string | nochange | End mission with reason 'A' |  |
| 50 | `NextMap` | string | nochange | Mission complete and switch to level with ID 'A' |  |

## Session vars (3)

| # | Text name | A | B | Description | Notes |
|---|---|---|---|---|---|
| 161 | `op161` | nochange | nochange | Clear all session variables |  |
| 162 | `op162` | string | string | Save value of regular variable 'B' to session variable 'A' |  |
| 163 | `op163` | string | string | Load value for regular variable 'B' from session variable 'A' |  |

## Sound (3)

| # | Text name | A | B | Description | Notes |
|---|---|---|---|---|---|
| 41 | `PlaySound` | sound | nochange | Play sound 'A' from library |  |
| 229 | `op229` | song+none | nochange | Play song |  |
| 284 | `PlaySoundAtRegion` | sound | region | Play sound 'A' at Region 'B' (volume and stereo effect won't be updated once sound starts) |  |

## Text-to-speech (7)

| # | Text name | A | B | Description | Notes |
|---|---|---|---|---|---|
| 198 | `op198` | string | nochange | Create Voice object and save it as variable 'A' |  |
| 199 | `op199` | string | string | Set volume 'B' for Voice object 'A' |  |
| 200 | `op200` | string | string | Set pitch 'B' for Voice object 'A' |  |
| 201 | `op201` | string | string | Set voice model 'B' for Voice object 'A' |  |
| 202 | `op202` | string | string | Speak text 'B' with Voice object 'A' |  |
| 203 | `op203` | string | string | Speak text-value of variable 'B' with Voice object 'A' |  |
| 244 | `op244` | string | string | Set rate 'B' for Voice object 'A' |  |

## Timer (6)

| # | Text name | A | B | Description | Notes |
|---|---|---|---|---|---|
| 25 | `TimerEnable` | timer | nochange | Activate Timer 'A' | sim |
| 26 | `TimerDisable` | timer | nochange | Deactivate Timer 'A' | sim |
| 27 | `TimerSetFrequency` | timer | int | Set the frequency of calls of Timer 'A' to value 'B' |  |
| 44 | `ResetTimerPhase` | timer | nochange | Reset current phase of between-call waiting of Timer 'A' | sim |
| 46 | `SetTimerCalls` | timer | maxcalls | Set remain calls number of Timer 'A' to value 'B' |  |
| 454 | `op454` | string | timer | Set variable 'A' to time elapsed of Timer 'B' |  |

## Trigger (8)

| # | Text name | A | B | Description | Notes |
|---|---|---|---|---|---|
| 19 | `TriggerDisable` | trigger | nochange | Deactivate Trigger 'A' | sim |
| 20 | `TriggerEnable` | trigger | nochange | Activate Trigger 'A' | sim |
| 21 | `TriggerSetCalls0` | trigger | nochange | Set number of remain calls of Trigger 'A' to 0 |  |
| 22 | `TriggerSetCallsValue` | trigger | maxcalls | Set number of remain calls of Trigger 'A' to value 'B' | sim |
| 156 | `SetChatInputCallback` | trigger | nochange | Set trigger 'A' as player chat message receiver | sim |
| 228 | `op228` | trigger | nochange | Call trigger 'A' each time new player joins the match | sim |
| 288 | `op288` | trigger | string | Bind Trigger 'A' execution to key 'B' press event |  |
| 289 | `op289` | trigger | string | Bind Trigger 'A' execution to key 'B' release event |  |

## Trigger execution (12)

| # | Text name | A | B | Description | Notes |
|---|---|---|---|---|---|
| 95 | `op95` | region | region | Continue execution of this trigger only if tracing from center of Region 'A' to center of Region 'B' is possible |  |
| 96 | `op96` | region | region | Continue execution of this trigger only if tracing from center of Region 'A' to center of Region 'B' is impossible |  |
| 99 | `ExecTrigger` | trigger | nochange | Execute trigger 'A' | sim |
| 230 | `op230` | string | string | Continue trigger actions execution only if value of session variable 'A' was set by map with ID 'B' (list of map IDs can be used, separated with commas without spaces) |  |
| 275 | `op275` | nochange | nochange | Continue trigger actions execution only if loading of custom images has been finished |  |
| 276 | `op276` | nochange | nochange | Continue trigger actions execution only if all custom images have been successfully loaded (any error will prevent execution until map is restarted) |  |
| 362 | `op362` | string | nochange | Switch execution to trigger ID in variable 'A' | sim, avoid |
| 363 | `op363` | trigger | nochange | Switch execution to trigger 'A' | sim |
| 406 | `op406` | region | region | Continue execution of this trigger only if tracing from center of Region 'A' to center of Region 'B'  doesn't intersect a character |  |
| 407 | `op407` | region | region | Continue execution of this trigger only if tracing from center of Region 'A' to center of Region 'B' intersects a character |  |
| 492 | `op492` | region | nochange | Continue execution of this trigger only if Region 'A' contains projectiles |  |
| 493 | `op493` | region | nochange | Continue execution of this trigger only if Region 'A' doesn't contain projectiles |  |

## URL (1)

| # | Text name | A | B | Description | Notes |
|---|---|---|---|---|---|
| 169 | `op169` | string | string | Request webpage with URL stored in variable 'A' and save response to variable 'B' once loaded (variable 'B' will be equal to ''loading...'' for some period of time) |  |

## Var (168)

| # | Text name | A | B | Description | Notes |
|---|---|---|---|---|---|
| 100 | `VarSetValue` | string | string | Set variable 'A' value to value 'B' | sim |
| 101 | `VarSetValueIfUndefined` | string | string | Set variable 'A' value to value 'B' if 'A' is not defined | sim |
| 102 | `VarAddValue` | string | string | Add value 'B' to value of variable 'A' | sim |
| 103 | `VarMultValue` | string | string | Multiply value of variable 'A' by value 'B' | sim |
| 104 | `VarAddVar` | string | string | Add value of variable 'B' to value of variable 'A' | sim |
| 105 | `VarMultVar` | string | string | Multiply value of variable 'A' by value of variable 'B' | sim |
| 106 | `VarRand1` | string | string | Set value of variable 'A' to random number with floating point in range 0..B | sim |
| 107 | `VarRandRange` | string | string | Set value of variable 'A' to random integer number in range 0..B-1 | sim |
| 108 | `VarRound` | string | nochange | Round value of variable 'A' | sim |
| 109 | `VarFloor` | string | nochange | Floor value of variable 'A' | sim |
| 110 | `continue if VarA > VarB ` | string | string | Continue trigger actions execution only if variable 'A' is greater than variable 'B' | sim |
| 111 | `continue if VarA < VarB ` | string | string | Continue trigger actions execution only if variable 'A' is less than variable 'B' |  |
| 112 | `continue if VarA == VarB ` | string | string | Continue trigger actions execution only if variable 'A' equals variable 'B' |  |
| 113 | `continue if VarA != VarB ` | string | string | Continue trigger actions execution only if variable 'A' does not equals to variable 'B' |  |
| 114 | `continue if VarA > ValueB ` | string | string | Continue trigger actions execution only if variable 'A' has greater value than value 'B' |  |
| 115 | `continue if VarA < ValueB ` | string | string | Continue trigger actions execution only if value of variable 'A' is less than value 'B' | sim |
| 116 | `continue if VarA == ValueB ` | string | string | Continue trigger actions execution only if value of variable 'A' equals value 'B' |  |
| 117 | `continue if VarA != ValueB ` | string | string | Continue trigger actions execution only if value of variable 'A' does not equals to value 'B' |  |
| 118 | `VarSetRegionX` | string | region | Set value of variable 'A' to value of region 'B' X position of left-top corner point |  |
| 119 | `VarSetRegionY` | string | region | Set value of variable 'A' to value of region 'B' Y position of left-top corner point |  |
| 120 | `RegionXSetVar` | region | string | Set X position of 'A' region left-top corner point to value of variable 'B' |  |
| 121 | `RegionYSetVar` | region | string | Set Y position of 'A' region left-top corner point to value of variable 'B' |  |
| 122 | `VarSetCharHP` | string | character | Set value of variable 'A' to hitpoints value of player 'B' |  |
| 123 | `next if VarA == ValueB` | string | string | Skip next trigger action if value of variable 'A' does not equals value 'B' | sim, skips |
| 124 | `VarSetModuloDivValue` | string | string | Set variable 'A' value to remainder after division by value 'B' (only positive numbers) | sim |
| 125 | `VarSetVar` | string | string | Set variable 'A' value to value of variable 'B' | sim |
| 126 | `ExplosionVarRegion` | string | region | Make an explosion with power of value of variable 'A' at Region 'B' |  |
| 127 | `VarSetModuloDivVar` | string | string | Set variable 'A' value to remainder after division by value of variable 'B' (only positive numbers) | sim |
| 128 | `op128` | gun | string | Force Gun 'A' spawn value of variable 'B' projectiles per shot |  |
| 129 | `op129` | gun | string | Change Gun 'A' accuracy to value of variable 'B' degress |  |
| 130 | `op130` | gun | string | Change Gun 'A' projectile power to value of variable 'B' |  |
| 131 | `VarDivValue` | string | string | Divide variable 'A' by value 'B' | sim |
| 132 | `VarDivVar` | string | string | Divide variable 'A' by value of variable 'B' | sim |
| 133 | `VarPowVar` | string | string | Set value of variable 'A' to result of power function with value of variable 'A' and power of value of variable 'B' | sim |
| 134 | `VarPowValue` | string | string | Set value of variable 'A' to result of power function with value of variable 'A' and power of value 'B' | sim |
| 135 | `VarSinVar` | string | string | Set value of variable 'A' to result of sin function with value of variable 'B' (in radians) as parameter |  |
| 136 | `VarCosVar` | string | string | Set value of variable 'A' to result of cos function with value of variable 'B' (in radians) as parameter |  |
| 137 | `SetACurrentPlayerSlot` | string | string | Set value of variable 'A' to slot of current player | sim |
| 138 | `SetIsMP` | string | string | Set value of variable 'A' to 1 if game is in multiplyer mode and to 0 in else case |  |
| 139 | `SetIsSpectator` | string | string | Set value of variable 'A' to 1 if my player is spectating this match as spectator and to 0 in else case |  |
| 140 | `SetIsLowPhys` | string | string | Set value of variable 'A' to 1 if LOW PHYSICS setting is enabled and to 0 in else case |  |
| 145 | `SetCountAliveInRegion` | string | region | Set value of variable 'A' to number of alive players in region 'B' |  |
| 146 | `SetLoginOfInitiator` | string | nochange | Set string-value of variable 'A' to login name of player-initiator |  |
| 147 | `SetNicknameOfInitiator` | string | nochange | Set string-value of variable 'A' to displayed name of player-initiator |  |
| 148 | `SetMPMode` | string | nochange | Set string-value of variable 'A' to multiplayer match name |  |
| 149 | `SetIsAContainsValueB` | string | string | Set value of variable 'A' to 1 if string-value of variable 'A' contains string-value 'B' and to 0 in else case | sim |
| 150 | `SetIsAContainsVarB` | string | string | Set value of variable 'A' to 1 if string-value of variable 'A' contains string-value of variable 'B' and to 0 in else case | sim |
| 151 | `CountLength` | string | string | Set value of variable 'A' to length of string-value of variable 'B' | sim |
| 152 | `AddString` | string | string | Add string-value of variable 'B' at the end of string-value of variable 'A' | sim |
| 153 | `OneMinusA` | string | nochange | Set value of variable 'A' to 1-A |  |
| 154 | `MinusA` | string | nochange | Set value of variable 'A' to -A | sim |
| 155 | `GetGSPEED` | string | nochange | Set value of variable 'A' to current frame time |  |
| 157 | `GetTalkerLogin` | string | nochange | Set string-value of variable 'A' to login name of player who says text | sim |
| 158 | `GetTalkerNickname` | string | nochange | Set string-value of variable 'A' to displayed name of player who says text | sim |
| 159 | `GetTalkerID` | string | nochange | Set value of variable 'A' to slot index of player who says text | sim |
| 160 | `GetChatInput` | string | nochange | Set string-value of variable 'A' to text being said | sim |
| 171 | `op171` | gun | string | Change Gun 'A' speed multiplier to value of variable 'B' |  |
| 173 | `op173` | gun | string | Change Gun 'A' recoil multiplier to value of variable 'B' |  |
| 176 | `op176` | gun | string | Change Gun 'A' projectile model to model with index-value of variable 'B' |  |
| 177 | `op177` | string | nochange | Set value of variable 'A' to id of type of current multiplayer mode (0 = singleplayer, 1 = DM, 2 = COOP, 3 = TDM) |  |
| 178 | `op178` | string | character | Save inventory info of Character 'B' to variable 'A' |  |
| 179 | `op179` | string | character | Spawn all weapons stored in variable 'A' at position of Character 'B' |  |
| 180 | `op180` | string | nochange | Set value of variable 'A' to player-initiator slot | sim |
| 181 | `op181` | string | nochange | Set value of variable 'A' to player-killer slot |  |
| 182 | `op182` | string | nochange | Set value of variable 'A' to login name of player-killer |  |
| 183 | `op183` | string | nochange | Set value of variable 'A' to displayed name of player-killer |  |
| 184 | `op184` | string | string | Set value of variable 'A' to login name of player with slot 'B' |  |
| 185 | `op185` | string | string | Set value of variable 'A' to displayed name of player with slot 'B' | sim |
| 186 | `op186` | string | string | Set value of variable 'A' to team ID of player with slot 'B' | sim |
| 187 | `op187` | string | string | Set value of variable 'A' to login name of player with slot-value of variable 'B' |  |
| 188 | `op188` | string | string | Set value of variable 'A' to displayed name of player with slot-value of variable 'B' | sim |
| 189 | `op189` | string | string | Set value of variable 'A' to team ID of player with slot-value of variable 'B' | sim |
| 204 | `op204` | string | string | Set value of variable 'A' to result of asin function with value of variable 'B' as parameter |  |
| 205 | `op205` | string | string | Set value of variable 'A' to result of acos function with value of variable 'B' as parameter |  |
| 206 | `op206` | string | string | Set value of variable 'A' to result of atan2 function with values of variables 'A' and 'B' as parameters |  |
| 223 | `op223` | string | nochange | Synchronize value of variable 'A' through overriding value for all connected players (requires Var Sync engine mark) | sim, needs var_sync |
| 224 | `op224` | string | nochange | Synchronize value of variable 'A' through keeping defined value (requires Var Sync engine mark) | sim, needs var_sync |
| 225 | `op225` | string | nochange | Synchronize value of variable 'A' through keeping maximum value (requires Var Sync engine mark) | sim, needs var_sync |
| 226 | `op226` | string | nochange | Synchronize value of variable 'A' through keeping minimum value (requires Var Sync engine mark) | sim, needs var_sync |
| 227 | `op227` | string | nochange | Synchronize value of variable 'A' through keeping longest String value (requires Var Sync engine mark) | sim, needs var_sync |
| 235 | `op235` | string | nochange | Set variable 'A' value to of projectile power (this trigger should receive damage from Movable) |  |
| 236 | `op236` | string | nochange | Subtract projectile power from value of variable 'A' (this trigger should receive damage from Movable) |  |
| 247 | `op247` | string | character | Save horizontal movement intention of character 'B' to variable 'A' |  |
| 248 | `op248` | string | character | Save vertical movement intention of character 'B' to variable 'A' |  |
| 249 | `op249` | string | character | Save shoot intention of character 'B' to variable 'A' |  |
| 252 | `op252` | decor | string | Rotate decoration to angle-value of variable 'B' (in degrees) |  |
| 253 | `op253` | decor | string | Rotate decoration to angle-value 'B' (in degrees) |  |
| 257 | `op257` | decor | string | Rotate decoration to angle-value of variable 'B' (in radians) |  |
| 258 | `op258` | decor | string | Rotate decoration to angle-value 'B' (in radians) |  |
| 263 | `op263` | string | nochange | Save energy value to variable 'A' (gameplay) |  |
| 264 | `op264` | string | nochange | Load energy value from variable 'A' (gameplay) |  |
| 265 | `op265` | string | nochange | Set max energy value to value of variable 'A' (gameplay) |  |
| 266 | `op266` | string | nochange | Save current AI difficulty to variable 'A' (easy = 1, normal = 2, hard = 3) |  |
| 277 | `op277` | string | nochange | Save current number of loaded custom images to variable 'A' |  |
| 278 | `op278` | string | nochange | Save number of expected custom images on current level to variable 'A' |  |
| 280 | `op280` | string | nochange | Set variable 'A' to 1 if compromised song should play (if non-dying enemy is hunting player or player is hunting non-dying enemy). Sets to value 0.5 in case if song should be played more quietly (if there are non-dying enemies within radius of 400px). In else case sets to 0 |  |
| 290 | `op290` | character | string | Set Character 'A' color pattern to string-value of variable 'B' (4 small letters for each limb, each represents first symbol of color in lowercase) |  |
| 294 | `VarSetValueOfVarNamed` | string | string | Set value of variable 'A' to value of variable with name of string-value of variable 'B' | sim |
| 295 | `VarSetStringReplaceVarWithVarValues` | string | string | Set string-value of variable 'A' to string-value 'B' while replacing all variable names found in string-value with corresponding variable values | sim, replaces B |
| 296 | `op296` | gun | string | Override existing Gun 'A' with a new gun with model by string-value of variable 'B' |  |
| 299 | `op299` | decor | string | Set decoration 'A' visibility multiplier to value of variable 'B' (0...1) |  |
| 302 | `op302` | gun | string | Set Gun 'A' projectile scale to value of variable 'B' |  |
| 314 | `op314` | string | character | Set variable 'A' to 1 if Character 'B' is dying (variable 'A' becomes 0 in else case) |  |
| 315 | `op315` | string | nochange | Set variable 'A' to 1 if Character-initiator is dying (variable 'A' becomes 0 in else case) |  |
| 316 | `op316` | string | nochange | Set variable 'A' to 1 if Character-killer is dying (variable 'A' becomes 0 in else case) |  |
| 325 | `op325` | string | string | Replace variables with their values in string-value of variable 'B' and save result to variable 'A' | sim, replaces B |
| 326 | `op326` | string | string | Replace variables with their values in string-value 'B' and save result to variable 'A' | sim, replaces B |
| 327 | `op327` | string | string | Set variable 'A' value to random number with floating point in range 0..X, where X is value of variable 'B' | sim |
| 328 | `op328` | string | string | Set variable 'A' value to random integer number in range 0..X-1, where X is value of variable 'B' |  |
| 329 | `op329` | string | string | Set interface visibility multiplier to value of variable 'A' and cursor visibility multiplier to value of variable 'B' |  |
| 331 | `op331` | string | nochange | Set variable 'A' string-value to string-value of ''Gameplay modifications'' field from match starting screen |  |
| 332 | `op332` | string | gun | Set variable 'A' to value 1 if Gun 'B' is not in owner's active slot, set to value 0 in else case |  |
| 333 | `op333` | string | gun | Set variable 'A' to value 1 if Gun 'B' has owner, set to value 0 in else case |  |
| 334 | `op334` | string | gun | Set variable 'A' to number of frames passed since last attack of Gun 'B' |  |
| 335 | `op335` | string | gun | Set variable 'A' to value 1 if Gun 'B' is ready to fire, set to value 0 in else case |  |
| 336 | `op336` | string | gun | Set variable 'A' to X direction of Gun 'B' |  |
| 337 | `op337` | string | character | Set variable 'A' to X direction of Character 'B' |  |
| 342 | `op342` | string | string | Set value of variable in variable 'A' to value of variable 'B' | sim |
| 344 | `op344` | string | decor | Set Variable 'A' to value of degrees rotation of Decoration 'B' |  |
| 347 | `op347` | string | string | Change Character skin of slot-value variable 'A' to value of variable 'B' |  |
| 348 | `op348` | string | nochange | Set variable 'A' to time (in milliseconds) since START of game | sim |
| 356 | `op356` | string | string | Change head model of Character slot-value variable 'A' to value of variable 'B' |  |
| 357 | `op357` | string | string | Change body model of Character slot-value variable 'A' to value of variable 'B' |  |
| 358 | `op358` | string | string | Change arms model of Character slot-value variable 'A' to value of variable 'B' |  |
| 359 | `op359` | string | string | Set Character slot-value variable 'A' color pattern to value of variable 'B' (4 small letters for each body sections, each represents first symbol of color in lowercase. - disables color change for specific section) |  |
| 360 | `op360` | string | string | Change legs model of Character slot-value variable 'A' to value of variable 'B' |  |
| 361 | `op361` | string | string | Skip next trigger action if value of variable 'A' is equal to the value of variable 'B' | sim, skips |
| 364 | `op364` | string | string | Skip next trigger action if value of variable 'A' is greater than value of variable 'B' | sim, skips |
| 365 | `op365` | string | string | Skip next trigger action if value of variable 'A' is less than value of variable 'B' | sim, skips |
| 366 | `op366` | door | string | Change Speed of Movable 'A' to variable 'B' |  |
| 367 | `op367` | timer | string | Set the frequency of calls of Timer 'A' to variable 'B' |  |
| 368 | `op368` | character | string | Set Character 'A' zoom to variable 'B' |  |
| 369 | `op369` | string | nochange | Set variable 'A' to zoom of game camera |  |
| 370 | `op370` | string | string | Set Character slot-value variable 'A' zoom to variable 'B' |  |
| 371 | `op371` | character | region | Move Character 'A' to random place in region 'B' |  |
| 372 | `op372` | string | string | Remove beginning 'A' characters from variable 'B' (-/+) | sim |
| 373 | `op373` | string | string | Set variable 'A' to degrees between regions in 'B' (seperated by commas) |  |
| 376 | `op376` | string | character | Set variable 'A' to stability of Character 'B' |  |
| 393 | `op393` | string | nochange | Set variable 'A' to value of time in miliseconds (since January 1 1970) |  |
| 394 | `op394` | string | string | Set variable 'A' to value of time between January 1 1970 and variable 'B' (year, month, day) in miliseconds |  |
| 397 | `op397` | string | nochange | Set variable 'A' to value of 1 if mouse is held down and to 0 if else case |  |
| 398 | `op398` | string | string | Set variable 'A' to distance between 2 regions in 'B' (separated by commas) |  |
| 400 | `op400` | string | nochange | Add ghost effect to Character slot-value variable 'A' |  |
| 401 | `op401` | string | nochange | Remove ghost effect from Character slot-value variable 'A' |  |
| 404 | `op404` | string | string | Set Character slot-value variable 'A' properties to properties of Character slot-value variable 'B' (hitpoints, max hitpoints, mobility, voice, model) |  |
| 410 | `op410` | string | character | Set variable 'A' to active gun model of Character 'B' |  |
| 425 | `op425` | string | character | Set variable 'A' value to X speed of Character 'B' |  |
| 426 | `op426` | string | character | Set variable 'A' value to Y speed of Character 'B' |  |
| 427 | `op427` | string | string | Set variable 'A' value to X speed of Character slot-value variable 'B' |  |
| 428 | `op428` | string | string | Set variable 'A' value to Y speed of Character slot-value variable 'B' |  |
| 431 | `op431` | string | string | Set X speed of Character slot-value variable 'A' to value of variable 'B' |  |
| 432 | `op432` | string | string | Set Y speed of Character slot-value variable 'A' to value of variable 'B' |  |
| 434 | `op434` | string | character | Set variable 'A' value to speed of Character 'B' |  |
| 435 | `op435` | string | string | Set variable 'A' value to speed of Character slot-value variable 'B' |  |
| 436 | `op436` | string | nochange | Set variable 'A' to map ID of current game |  |
| 448 | `op448` | string | value | Set Character slot-value variable 'A' Health bar GUI opacity to value 'B' |  |
| 449 | `op449` | string | string | Set Character slot-value variable 'A' Health bar GUI opacity to variable 'B' |  |
| 452 | `op452` | string | string | Change Character slot-value variable 'A' sword life to variable 'B' |  |
| 463 | `op463` | string | nochange | Set variable 'A' to value of chatting status (0 = off, 1 = chat, 2 = team chat) |  |
| 465 | `op465` | string | string | Set Character slot-value variable 'A' current and max hit points to variable 'B' |  |
| 471 | `op471` | string | gun | Set variable 'A' to rotation of Gun 'B' |  |
| 472 | `op472` | string | gun | Set variable 'A' to X scale of Gun 'B' |  |
| 474 | `op474` | string | gun | Set variable 'A' to Y scale of Gun 'B' |  |
| 509 | `op509` | string | gun | Set variable 'A' to length of Gun 'B' |  |
| 510 | `op510` | string | nochange | Set variable 'A' to value of current framerate |  |
| 531 | `op531` | string | string | Save inventory info of Character slot-value variable 'B' to variable 'A' |  |
| 532 | `op532` | string | string | Spawn all weapons stored in variable 'A' at position of Character slot-value variable 'B' |  |
| 544 | `op544` | string | string | Set variable 'A' to 1 if Character slot-value variable 'B' is dying |  |

## Vehicle (4)

| # | Text name | A | B | Description | Notes |
|---|---|---|---|---|---|
| 3 | `ChangeVehHPPerc` | vehicle | value | Change the number of hit points of Vehicle 'A' to 'B' percents |  |
| 438 | `op438` | vehicle | bool | Enable or Disable visibility of Vehicle 'A' using parameter 'B' |  |
| 439 | `op439` | vehicle | trigger | Call Trigger 'B' when Vehicle 'A' destroyed |  |
| 476 | `op476` | vehicle | string | Change Vehicle 'A' nickname to variable 'B' |  |

## Water (3)

| # | Text name | A | B | Description | Notes |
|---|---|---|---|---|---|
| 392 | `op392` | water | region | Move Water 'A' to Region 'B' |  |
| 395 | `op395` | water | string | Set water 'A' damage to string-value/variable 'B' |  |
| 409 | `op409` | water | string | Change water 'A' color to string-value/variable 'B' |  |

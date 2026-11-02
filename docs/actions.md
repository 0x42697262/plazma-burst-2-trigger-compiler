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

## Named values

Fixed values from the editor's own lists, written `Group.Name`: `say("hi", Color.NoirLime)`,
`action(SetCharTeam, hero, Team.RedTeam)`. The compiler writes the value into the action and
refuses a value from another group where a parameter has its own list. The raw value (`2`,
`12`) works too.

### Color (`textmsg`, 5)

| Name | Value | Editor label |
|---|---|---|
| `EXOS` | `0` | EXOS |
| `MainHeroPlayersNicknameIsDisplayed` | `1` | Main Hero (Player's nickname is displayed) |
| `NoirLime` | `2` | Noir Lime |
| `Proxy` | `3` | Proxy |
| `CivilSecurity` | `4` | Civil Security |

### Team (`team`, 24)

| Name | Value | Editor label |
|---|---|---|
| `Alpha` | `0` | Alpha |
| `Beta` | `1` | Beta |
| `Gamma` | `2` | Gamma |
| `Delta` | `3` | Delta |
| `Zeta` | `4` | Zeta |
| `Lambda` | `5` | Lambda |
| `Sigma` | `6` | Sigma |
| `Omega` | `7` | Omega |
| `CounterTerrorists` | `8` | Counter-Terrorists |
| `Terrorists` | `9` | Terrorists |
| `UsurpationForces` | `10` | Usurpation Forces |
| `CitizenSecurity` | `11` | Citizen Security |
| `RedTeam` | `12` | Red Team |
| `BlueTeam` | `13` | Blue Team |
| `GreenTeam` | `14` | Green Team |
| `WhiteTeam` | `15` | White Team |
| `BlackTeam` | `16` | Black Team |
| `SpecialANoFriendlyFire` | `-1` | Special A (no friendly fire) |
| `SpecialBNoFriendlyFire` | `-2` | Special B (no friendly fire) |
| `SpecialCNoFriendlyFire` | `-3` | Special C (no friendly fire) |
| `SpecialDNoFriendlyFire` | `-4` | Special D (no friendly fire) |
| `SpecialENoFriendlyFire` | `-5` | Special E (no friendly fire) |
| `SpecialFNoFriendlyFire` | `-6` | Special F (no friendly fire) |
| `AnyTeam` | `-1` | Any Team |

### Behavior (`botaction`, 5)

| Name | Value | Editor label |
|---|---|---|
| `Default` | `0` | Default |
| `FollowThePlayer` | `1` | Follow the player |
| `LookAround` | `2` | Look around |
| `Investigate` | `3` | Investigate |
| `DoNothingControllableWithTriggers` | `4` | Do nothing (controllable with Triggers) |

### Bool (`bool`, 2)

| Name | Value | Editor label |
|---|---|---|
| `Yes` | `true` | Yes |
| `No` | `false` | No |

### Toggle (`enable-disable`, 2)

| Name | Value | Editor label |
|---|---|---|
| `Disable` | `0` | Disable |
| `Enable` | `1` | Enable |

### Calls (`maxcalls`, 2)

| Name | Value | Editor label |
|---|---|---|
| `N1Call` | `1` | 1 call |
| `Infinite` | `-1` | Infinite |

### PusherDamage (`pushf_damage`, 1)

| Name | Value | Editor label |
|---|---|---|
| `NoDamage` | `0` | No damage |

### GunModel (`gun_model`, 99)

| Name | Value | Editor label |
|---|---|---|
| `AssaultRifleC01r` | `gun_rifle` | Assault Rifle C-01r |
| `AssaultRifleC01rRed` | `gun_rifle_b` | Assault Rifle C-01r (Red) |
| `PistolC01p` | `gun_pistol` | Pistol C-01p |
| `PistolC01pRed` | `gun_pistol_b` | Pistol C-01p (Red) |
| `PistolCSPro` | `gun_pistol2` | Pistol CS-Pro |
| `VehicleRocketLauncherCorvette` | `gun_vehgun` | Vehicle Rocket Launcher (Corvette) |
| `GrenadeLauncherCSSpamThemBaby` | `gun_gl` | Grenade Launcher CS-SpamThemBaby |
| `RocketLauncherCSLitBro` | `gun_rl` | Rocket Launcher CS-LitBro |
| `LiteRailgunV01CSHShot` | `gun_railgun` | Lite Railgun v01 CS-HShot |
| `HeavyRailgunV04CSOneSOneK` | `gun_railgun2` | Heavy Railgun v04 CS-OneSOneK |
| `ShotgunC01s` | `gun_shotgun` | Shotgun C-01s |
| `ShotgunC01sBlue` | `gun_shotgun_b` | Shotgun C-01s (Blue) |
| `AlienPistol` | `gun_apistol` | Alien Pistol |
| `AlienRifle` | `gun_arifle` | Alien Rifle |
| `AlienShotgun` | `gun_arifle2` | Alien Shotgun |
| `VehicleCannonHoundWalkerCS` | `gun_vehcannon` | Vehicle Cannon (Hound Walker-CS) |
| `Defibrillator` | `gun_defibrillator` | Defibrillator |
| `CSBNG` | `gun_bfg` | CS-BNG |
| `RayGunC01y` | `gun_raygun` | Ray Gun C-01y |
| `RayRifleTCoRR` | `gun_rayrifle` | Ray Rifle TCoRR |
| `VehicleMinigunDrone` | `gun_vehminigun` | Vehicle Minigun (Drone) |
| `VehicleGrenadeLauncherDrone` | `gun_vehminigl` | Vehicle Grenade Launcher (Drone) |
| `ShotgunCSDAZ` | `gun_real_shotgun` | Shotgun CS-DAZ |
| `AssaultRifleCSRC` | `gun_real_rifle` | Assault Rifle CS-RC |
| `CombatRifleCSOICW` | `gun_oicw` | Combat Rifle CS-OICW |
| `PlasmagunCSBloom` | `gun_plasmagun` | Plasmagun CS-Bloom |
| `MinigunC02m` | `gun_minigun` | Minigun C-02m |
| `DroneGunCSVirus` | `gun_vgun` | Drone Gun CS-Virus |
| `SniperRifleCSYippeeKiYay` | `gun_sniper` | Sniper Rifle CS-YippeeKiYay |
| `GrenadeC00n` | `item_grenade` | Grenade C-00n |
| `TeleportGrenadeV03CSPortNade` | `item_port` | Teleport Grenade v03 CS-PortNade |
| `PortableShieldV07CSQuarium` | `item_shield` | Portable Shield v07 CS-Quarium |
| `PortableShieldV07CSQuariumAsWeaponSlot7` | `gun_sp_sh` | Portable Shield v07 CS-Quarium (as weapon slot 7) |
| `GlockUnfinishedWeapon` | `gun_glock` | Glock (unfinished weapon) |
| `M4A1UnfinishedWeapon` | `gun_m4a1` | M4A1 (unfinished weapon) |
| `StarDefenderRifle` | `gun_pixel_rifle` | Star Defender Rifle |
| `StarDefenderRocketLauncher` | `gun_pixel_rl` | Star Defender Rocket Launcher |
| `CPAssaultRifleByDarkstar1` | `darkstar_1_assault_rifle` | CP-Assault Rifle by darkstar 1 |
| `CSGaussRifleByDarkstar1` | `darkstar_1_gauss_rifle` | CS-GaussRifle by darkstar 1 |
| `LightMachineGunCSLMGByDarkstar1` | `darkstar_1_minigun` | Light Machine Gun CS-LMG by darkstar 1 |
| `PHANX92FalconetByDarkstar1` | `darkstar_1_phanx_rifle` | PHANX-92 Falconet by darkstar 1 |
| `AlienSniperRifleByDarkstar1` | `darkstar_1_usniper` | Alien Sniper Rifle by darkstar 1 |
| `AssaultRifleAV135ByLostmydollar` | `lostmydollar_av135` | Assault Rifle AV-135 by lostmydollar |
| `NeedleByLostmydollar` | `lostmydollar_needle` | Needle by lostmydollar |
| `QCcV50LittleBastardByLostmydollar` | `lostmydollar_qccv50` | QCcV-50 Little Bastard by lostmydollar |
| `RMK36ByLostmydollar` | `lostmydollar_rmk36` | RMK-36 by lostmydollar |
| `RPGByLostmydollar` | `lostmydollar_rpg` | RPG by lostmydollar |
| `AlienLaserRifleByLazyRain` | `lazyrain_alien_laser_rifle` | Alien Laser Rifle by LazyRain |
| `AlienHeaterRifleByLazyRain` | `lazyrain_alien_laser_rifle2` | Alien Heater Rifle by LazyRain |
| `CSAutocannonByLazyRainForVehicles` | `lazyrain_cannon` | CS-Autocannon by LazyRain (for vehicles) |
| `CSAutocannonByLazyRainSmallerHandHeld` | `lazyrain_cannon2` | CS-Autocannon by LazyRain (smaller, hand-held) |
| `CrossfireCR45PhantomByMoonhawk` | `moonhawk_phantom` | Crossfire CR-45 Phantom by Moonhawk |
| `CrossfireCR45PhantomDarkVersionByMoonhawk` | `moonhawk_phantom2` | Crossfire CR-45 Phantom (dark version) by Moonhawk |
| `CrossfireCR42GhostByMoonhawk` | `moonhawk_smg` | Crossfire CR-42 Ghost by Moonhawk |
| `EnergyRifleByDitzy` | `ditzy_energy_rifle` | Energy Rifle by Ditzy |
| `FalkonianMarksmanRifleByRoxxar` | `roxxar_marksman_rifle` | Falkonian Marksman Rifle by Roxxar |
| `FalkonianPistolByRoxxar` | `roxxar_pistol` | Falkonian Pistol by Roxxar |
| `FalkonianShotgunByRoxxar` | `roxxar_rifle` | Falkonian Shotgun by Roxxar |
| `FalkonianGrenadeLauncherByRoxxar` | `roxxar_shotgun` | Falkonian Grenade Launcher by Roxxar |
| `CrossfireCR145VortexByMoonhawk` | `moonhawk_crossfire` | Crossfire CR-145 Vortex by Moonhawk |
| `FalkonianPSICutterByLazyRain` | `lazyrain_psi_cutter` | Falkonian PSI Cutter by LazyRain |
| `AndroidSniperRifleByMrJaksNes` | `mrjaksnes_android_sniper` | Android Sniper Rifle by Mr jaks nes |
| `OEDACR30RifleByIncompetence` | `incompetence_cr30` | OEDA CR-30 Rifle by Incompetence |
| `HeavySniperRifleRQ10ByDarkstar1` | `darkstar_1_cs_ragequit` | Heavy Sniper Rifle RQ-10 by darkstar 1 |
| `PBFTTPVehicleCannon` | `gun_fttp_vehgun` | PB:FTTP Vehicle Cannon |
| `ShotgunNXS25ByThetoppestkek` | `thetoppestkek_shotgun_nxs25` | Shotgun NXS-25 by thetoppestkek |
| `Archetype27XXByIncompetence` | `incompetence_archetype_27xx` | Archetype 27XX by Incompetence |
| `MarksmanRifleCSRMByPhsc` | `phsc_aug` | Marksman Rifle CS-RM by phsc |
| `CrossfireCR34MarauderBrightByMoonhawk` | `moonhawk_railgun` | Crossfire CR-34 Marauder (bright) by Moonhawk |
| `CrossfireCR34MarauderDarkByMoonhawk` | `moonhawk_railgun2` | Crossfire CR-34 Marauder (dark) by Moonhawk |
| `MedicPistolByLazyRain` | `lazyrain_heal_pistol` | Medic Pistol by LazyRain |
| `GrenadeLauncherCSGLHFByIncompetence` | `incompetence_glhf` | Grenade Launcher CS-GLHF by Incompetence |
| `OEDAEA109HLauncherByIncompetence` | `incompetence_glhf2` | OEDA EA-109H Launcher by Incompetence |
| `FalkonianAntiGravityRocketLauncherYellowByLazyRain` | `lazyrain_gravy_rl` | Falkonian Anti-Gravity Rocket Launcher (yellow) by LazyRain |
| `FalkonianAntiGravityRocketLauncherRedByLazyRain` | `lazyrain_gravy_rl2` | Falkonian Anti-Gravity Rocket Launcher (red) by LazyRain |
| `RocketLauncherCSBarrageByDarkstar1` | `darkstar_1_owo_rl` | Rocket Launcher CS-Barrage by darkstar 1 |
| `PlasmaShotgunByPhsc` | `phsc_plasma_shotgun` | Plasma Shotgun by phsc |
| `AndroidShotgunByPhsc` | `phsc_android_shotgun` | Android Shotgun by phsc |
| `AssaultRifleCSIKByDitzy` | `ditzy_cs_ik` | Assault Rifle CS-IK by Ditzy |
| `AssaultRifleNXR17CByDitzy` | `ditzy_cs_ik2` | Assault Rifle NXR-17C by Ditzy |
| `CrossfireCR54ViperByPhsc` | `phsc_ph01` | Crossfire CR-54 Viper by phsc |
| `CrossfireCR54ViperVersion2ByPhsc` | `phsc_ph01b` | Crossfire CR-54 Viper (version 2) by phsc |
| `PHANX230CobraByDarkstar1` | `darkstar_1_railgun` | PHANX-230 Cobra by darkstar 1 |
| `EosToxicRailgunByDarkstar1` | `darkstar_1_railgun2` | Eos Toxic Railgun by darkstar 1 |
| `AlienRailShotgunByDarkstar1` | `darkstar_1_alien_rail_sg` | Alien Rail Shotgun by darkstar 1 |
| `GrenadeLauncherC00tByDarkstar1` | `darkstar_1_nade_c9` | Grenade Launcher C-00t by darkstar 1 |
| `GrenadeLauncherC00tRedByDarkstar1` | `darkstar_1_nade_c9b` | Grenade Launcher C-00t (red) by darkstar 1 |
| `EosRocketLauncherByDarkstar1` | `darkstar_1_rl` | Eos Rocket Launcher by darkstar 1 |
| `PHANX150BisonByDarkstar1` | `darkstar_1_bison` | PHANX-150 Bison by darkstar 1 |
| `EosAutoShotgunByDarkstar1` | `darkstar_1_auto_sg` | Eos Auto Shotgun by darkstar 1 |
| `ReakhohshaFocusBeamByDitzy` | `ditzy_focus_beam` | Reakhohsha Focus Beam by Ditzy |
| `RevolverMK1ByBoom5` | `boom5_revolver` | Revolver MK1 by boom5 |
| `ScavengerShotgunByThetoppestkek` | `thetoppestkek_scavenger_sg` | Scavenger Shotgun by thetoppestkek |
| `AlienAcidGrenadeLauncherByLazyRain` | `lazyrain_acid_gl` | Alien Acid Grenade Launcher by LazyRain |
| `AlienPlasmaPistolWhiteByLazyRain` | `lazyrain_plasma_smg` | Alien Plasma Pistol (white) by LazyRain |
| `AlienPlasmaPistolYellowByLazyRain` | `lazyrain_plasma_smg2` | Alien Plasma Pistol (yellow) by LazyRain |
| `AndroidRailgunByRoxxar` | `roxxar_android_railgun` | Android Railgun by Roxxar |
| `InvisibleGun` | `gun_invisgun` | Invisible gun |
| `SharkDoesNothing` | `gun_sharkgun` | Shark (does nothing) |

### Sound (`sound`, 280)

| Name | Value | Editor label |
|---|---|---|
| `SilenceForGunsOnly` | `null` | - silence - (for guns only) |
| `BattlesuitLowHealth` | `hp_warn` | Battlesuit - Low health |
| `BattlesuitDeath` | `hp_dead` | Battlesuit - Death |
| `WeaponPickedUp` | `wea_pickup` | Weapon - Picked up |
| `WeaponImpact1` | `wea2` | Weapon - Impact 1 |
| `WeaponImpact2` | `wea1` | Weapon - Impact 2 |
| `VehicleMinigunDrone` | `wea_vehminigun` | Vehicle minigun (Drone) |
| `SniperRifleCSYippeeKiYay` | `wea_sniper` | Sniper Rifle CS-YippeeKiYay |
| `AlienShotgun` | `wea_shotgun_alt` | Alien Shotgun |
| `ShotgunC01s` | `wea_shotgun` | Shotgun C-01s |
| `AlienRifle` | `wea_rifle_alt` | Alien Rifle |
| `AssaultRifleC01r` | `wea_rifle` | Assault Rifle C-01r |
| `ShotgunCSDAZReloading` | `wea_real_shotgun_r` | Shotgun CS-DAZ - Reloading |
| `ShotgunCSDAZ` | `wea_real_shotgun` | Shotgun CS-DAZ |
| `AssaultRifleCSRC` | `wea_real_rifle` | Assault Rifle CS-RC |
| `HeavyRailgunV04CSOneSOneK` | `wea_rail_alt` | Heavy Railgun v04 CS-OneSOneK |
| `PistolCSPro` | `wea_pistol2` | Pistol CS-Pro |
| `PistolC01p` | `wea_pistol` | Pistol C-01p |
| `PlasmagunCSBloom` | `wea_plasmagun` | Plasmagun CS-Bloom |
| `MinigunC02m` | `wea_mingun2` | Minigun C-02m |
| `WeaMinigunUnused` | `wea_mingun` | wea_minigun (unused) |
| `WeaImpulseUnused` | `wea_impulse` | wea_impulse (unused) |
| `CSBNG` | `wea_evil_shot` | CS-BNG |
| `RayGunC01y` | `wea_energy` | Ray Gun C-01y |
| `Defibrillator` | `wea_defibrillator` | Defibrillator |
| `AlienPistol` | `wea_apistol` | Alien Pistol |
| `WaterSplash3` | `water_splash3` | Water splash 3 |
| `WaterSplash2` | `water_splash2` | Water splash 2 |
| `WaterSplash1` | `water_splash1` | Water splash 1 |
| `HoundWalkerCSStep` | `walker_step` | Hound Walker-CS - Step |
| `HoundWalkerCSPhase2` | `walker_phase2` | Hound Walker-CS - Phase 2 |
| `HoundWalkerCSPhase1` | `walker_phase1` | Hound Walker-CS - Phase 1 |
| `HoundWalkerCSTermination` | `walker_die` | Hound Walker-CS - Termination |
| `VehicleCannonHoundWalkerCS` | `wea_vehcannon` | Vehicle Cannon (Hound Walker-CS) |
| `UsurpationDestroyerHurt` | `usurpation_hurt` | Usurpation Destroyer - Hurt |
| `UsurpationDestroyerDying` | `usurpation_dying` | Usurpation Destroyer - Dying |
| `UsurpationDestroyerDeath3` | `usurpation_death3` | Usurpation Destroyer - Death 3 |
| `UsurpationDestroyerDeath2` | `usurpation_death2` | Usurpation Destroyer - Death 2 |
| `UsurpationDestroyerAlert` | `usurpation_alert` | Usurpation Destroyer - Alert |
| `VehicleRocketLauncherCorvetteReloading` | `test_sound` | Vehicle Rocket Launcher (Corvette) - Reloading |
| `Teleport` | `teleport_spawn` | Teleport |
| `HeroChange` | `team_switch` | Hero change |
| `PanelBoardActivation` | `t_switch2` | Panel Board - Activation |
| `PanelBoardActivation2Unused` | `t_switch1` | Panel Board - Activation 2 (unused) |
| `PanelBoardDenied` | `t_switch_denied` | Panel Board - Denied |
| `MovableStart` | `t_door1_stop` | Movable - Start |
| `MovableStop` | `t_door1_start` | Movable - Stop |
| `Footstep4` | `step4` | Footstep 4 |
| `Footstep3` | `step3` | Footstep 3 |
| `Footstep2` | `step2` | Footstep 2 |
| `Footstep1` | `step1` | Footstep 1 |
| `VehicleCollisionMedium` | `steel_med` | Vehicle collision - Medium |
| `VehicleCollisionLow` | `steel_low` | Vehicle collision - Low |
| `VehicleCollisionFriction` | `steel_hor` | Vehicle collision - Friction |
| `VehicleCollisionHard` | `steel_hard` | Vehicle collision - Hard |
| `BattlesuitSlowmotionDisabled` | `slow_up` | Battlesuit - Slowmotion disabled |
| `BattlesuitSlowmotionEnabled` | `slow_down` | Battlesuit - Slowmotion enabled |
| `CivilSecurityGhostDeath` | `slicer_die` | Civil Security Ghost - Death |
| `CivilSecurityGhostAlert` | `slicer_alert` | Civil Security Ghost - Alert |
| `PortableShieldV07CSQuariumExplosion` | `shnade_offline` | Portable Shield v07 CS-Quarium - Explosion |
| `PortableShieldV07CSQuariumHitLow` | `shnade_hit_low` | Portable Shield v07 CS-Quarium - Hit low |
| `PortableShieldV07CSQuariumHitHard` | `shnade_hit` | Portable Shield v07 CS-Quarium - Hit hard |
| `PortableShieldV07CSQuariumActivation` | `shnade_explode` | Portable Shield v07 CS-Quarium - Activation |
| `PortableShieldV07CSQuariumBlip` | `shnade_act` | Portable Shield v07 CS-Quarium - Blip |
| `ShipIncome` | `ship_incoming` | Ship - Income |
| `ShipExplosion` | `ship_explosion` | Ship - Explosion |
| `LiteRailgunV01CSHShotReload` | `reload` | Lite Railgun v01 CS-HShot - Reload |
| `RocketLauncherCSLitBro` | `wea_rocket_launch` | Rocket Launcher CS-LitBro |
| `RoboticFootstep4` | `robo_step4` | Robotic footstep 4 |
| `RoboticFootstep3` | `robo_step3` | Robotic footstep 3 |
| `RoboticFootstep2` | `robo_step2` | Robotic footstep 2 |
| `RoboticFootstep1` | `robo_step1` | Robotic footstep 1 |
| `DroneGunCSVirusShot` | `robo_bug_launch` | Drone Gun CS-Virus - Shot |
| `DroneGunCSVirusJump` | `robo_bug_jump` | Drone Gun CS-Virus - Jump |
| `DroneGunCSVirusHit` | `robo_bug_hit` | Drone Gun CS-Virus - Hit |
| `RocketLauncherCSLitBroReload` | `rl_reload` | Rocket Launcher CS-LitBro - Reload |
| `LiteRailgunV01CSHShot` | `wea_railgun` | Lite Railgun v01 CS-HShot |
| `TeleportGrenadeV03CSPortNadeDetonation` | `portnade_explode` | Teleport Grenade v03 CS-PortNade - Detonation |
| `TeleportGrenadeV03CSPortNadeBlip` | `portnade_act2` | Teleport Grenade v03 CS-PortNade - Blip |
| `PlasmaExplosion` | `plasma_explosion` | Plasma explosion |
| `NoirLimeHurt2` | `noir_hurt2` | Noir Lime - Hurt 2 |
| `NoirLimeHurt1` | `noir_hurt1` | Noir Lime - Hurt 1 |
| `NoirLimeDeath` | `noir_die` | Noir Lime - Death |
| `NadeThrow` | `nade_throw` | Nade throw |
| `MissionComplete` | `mission_done` | Mission complete |
| `MetalHard` | `metal_ver3` | Metal - Hard |
| `MetalMedium` | `metal_ver2` | Metal - Medium |
| `MetalLow` | `metal_ver1` | Metal - Low |
| `MetalFriction` | `metal_hor` | Metal - Friction |
| `MetalHit` | `metal_hit` | Metal - Hit |
| `MetalDestruction` | `metal_gib` | Metal - Destruction |
| `LastTeleport` | `last_teleport` | Last teleport |
| `MenuButtonOnMouseDown` | `s_info_off` | Menu button - onMouseDown |
| `MenuButtonOnClick` | `s_info_act` | Menu button - onClick |
| `MenuButtonOnMouseOver` | `s_info` | Menu button - onMouseOver |
| `HintDisappear` | `hint_disappear` | Hint - Disappear |
| `HintAppear` | `hint_appear` | Hint - Appear |
| `GrenadeLauncherCSSpamThemBaby` | `wea_gl` | Grenade Launcher CS-SpamThemBaby |
| `GrenadeC00nBlip` | `grenade_act` | Grenade C-00n - Blip |
| `GrenadeBounce` | `grenade` | Grenade bounce |
| `BarrelHit1` | `glass2` | Barrel - Hit 1 |
| `BarrelHit2` | `glass1` | Barrel - Hit 2 |
| `CyberGrubDeath1` | `g_death1` | Cyber Grub - Death 1 |
| `CyberGrubDeath2` | `g_death2` | Cyber Grub - Death 2 |
| `CyberGrubDeath3` | `g_death3` | Cyber Grub - Death 3 |
| `CyberGrubHurt1` | `g_pain1` | Cyber Grub - Hurt 1 |
| `CyberGrubHurt2` | `g_pain2` | Cyber Grub - Hurt 2 |
| `CyberGrubHurt3` | `g_pain3` | Cyber Grub - Hurt 3 |
| `CyberGrubAlert` | `g_welcome1` | Cyber Grub - Alert |
| `PhoenixFalkokAlert` | `fp_welcome1` | Phoenix Falkok - Alert |
| `PhoenixFalkokHurt4` | `fp_pain4` | Phoenix Falkok - Hurt 4 |
| `PhoenixFalkokHurt3` | `fp_pain3` | Phoenix Falkok - Hurt 3 |
| `PhoenixFalkokHurt2` | `fp_pain2` | Phoenix Falkok - Hurt 2 |
| `PhoenixFalkokDeath3` | `fp_death3` | Phoenix Falkok - Death 3 |
| `PhoenixFalkokDeath2` | `fp_death2` | Phoenix Falkok - Death 2 |
| `PhoenixFalkokDeath1` | `fp_death1` | Phoenix Falkok - Death 1 |
| `ImpactShot` | `fail_shot` | Impact shot |
| `FalkokAlert` | `f_welcome1` | Falkok - Alert |
| `FalkokHurt4` | `f_pain4` | Falkok - Hurt 4 |
| `FalkokHurt3` | `f_pain3` | Falkok - Hurt 3 |
| `FalkokHurt2` | `f_pain2` | Falkok - Hurt 2 |
| `FalkokDeath3` | `f_death3` | Falkok - Death 3 |
| `FalkokDeath2` | `f_death2` | Falkok - Death 2 |
| `FalkokDeath1` | `f_death1` | Falkok - Death 1 |
| `Explosion2` | `explode2` | Explosion 2 |
| `Explosion1` | `explode1` | Explosion 1 |
| `ExplosionUnderwater` | `explode_underwater` | Explosion underwater |
| `UsurpationSoldierHurt` | `enemy_hurt1` | Usurpation Soldier - Hurt |
| `UsurpationSoldierHurt3` | `enemy_hurt_3` | Usurpation Soldier - Hurt 3 |
| `UsurpationSoldierHurt2` | `enemy_hurt_2` | Usurpation Soldier - Hurt 2 |
| `UsurpationSoldierHurt1` | `enemy_hurt_1` | Usurpation Soldier - Hurt 1 |
| `UsurpationSoldierDeath` | `enemy_die1` | Usurpation Soldier - Death |
| `UsurpationSoldierDeath4` | `enemy_die_4` | Usurpation Soldier - Death 4 |
| `UsurpationSoldierDeath3` | `enemy_die_3` | Usurpation Soldier - Death 3 |
| `UsurpationSoldierDeath2` | `enemy_die_2` | Usurpation Soldier - Death 2 |
| `UsurpationSoldierDeath1` | `enemy_die_1` | Usurpation Soldier - Death 1 |
| `UsurpationSoldierAlert` | `enemy_alert` | Usurpation Soldier - Alert |
| `DroneHurt` | `drone_hurt` | Drone - Hurt |
| `DroneDeath` | `drone_die` | Drone - Death |
| `CorvetteDeath` | `corvett_die` | Corvette - Death |
| `CoolbuddyLogo` | `coolbuddy2` | Coolbuddy logo |
| `ChatMessage` | `chat` | Chat message |
| `LifeCapsuleHit2` | `capsule_hit2` | Life-Capsule - Hit 2 |
| `LifeCapsuleHit1` | `capsule_hit1` | Life-Capsule - Hit 1 |
| `CrateHard` | `box_ver3` | Crate - Hard |
| `CrateMedium` | `box_ver2` | Crate - Medium |
| `CrateLow` | `box_ver1` | Crate - Low |
| `CrateFriction` | `box_hor` | Crate - Friction |
| `CrateDestruction` | `box_die` | Crate - Destruction |
| `BodyHard` | `body3` | Body - Hard |
| `BodyMedium` | `body2` | Body - Medium |
| `BodyLow` | `body1` | Body - Low |
| `BodyFriction` | `body0` | Body - Friction |
| `BodyFall` | `body_fall` | Body - Fall |
| `BodyLimbBroke` | `blood_leg_arm` | Body - Limb broke |
| `BodyHitSword` | `blood_hit_sword` | Body - Hit sword |
| `BodyHit` | `blood_hit` | Body - Hit |
| `BodyHeadBroke2` | `blood_head2` | Body - Head broke 2 |
| `BodyHeadBroke1` | `blood_head` | Body - Head broke 1 |
| `BodySpineBroke2` | `blood_body2` | Body - Spine broke 2 |
| `BodySpineBroke1` | `blood_body` | Body - Spine broke 1 |
| `SwordsSwing3` | `sou_blade_swing3` | Swords swing 3 |
| `SwordsSwing2` | `sou_blade_swing2` | Swords swing 2 |
| `SwordsSwing1` | `sou_blade_swing1` | Swords swing 1 |
| `CSBNGExplosion` | `explode_bfg` | CS-BNG - Explosion |
| `BarrelExplosion2` | `barrel2` | Barrel - Explosion 2 |
| `BarrelExplosion1` | `barrel` | Barrel - Explosion 1 |
| `Achievement` | `badge_earned` | Achievement |
| `AndroidAlert3` | `android_welcome3` | Android - Alert 3 |
| `AndroidAlert2` | `android_welcome2` | Android - Alert 2 |
| `AndroidAlert1` | `android_welcome1` | Android - Alert 1 |
| `AndroidAlert` | `android_welcome` | Android - Alert |
| `AndroidHurt` | `android_hurt` | Android - Hurt |
| `AndroidCelebrate` | `android_enemy_down1` | Android - Celebrate |
| `AndroidDeath1` | `android_die_1` | Android - Death 1 |
| `AndroidDeath` | `android_die` | Android - Death |
| `SilencerShot` | `silenced` | Silencer shot |
| `ChargedShot` | `charged_explosion` | Charged shot |
| `MarineDeath1` | `hero_death1` | Marine - Death 1 |
| `MarineDeath2` | `hero_death2` | Marine - Death 2 |
| `MarineHurt1` | `hero_pain1` | Marine - Hurt 1 |
| `MarineHurt2` | `hero_pain2` | Marine - Hurt 2 |
| `MarineHurt3` | `hero_pain3` | Marine - Hurt 3 |
| `MarineHurt4` | `hero_pain4` | Marine - Hurt 4 |
| `MarineAlert1` | `hero_welcome1` | Marine - Alert 1 |
| `MarineAlert2` | `hero_welcome2` | Marine - Alert 2 |
| `MarineAlert3` | `hero_welcome3` | Marine - Alert 3 |
| `CivilSecurityDeath1` | `marine_death1` | Civil Security - Death 1 |
| `CivilSecurityDeath2` | `marine_death2` | Civil Security - Death 2 |
| `CivilSecurityDeath3` | `marine_death3` | Civil Security - Death 3 |
| `CivilSecurityDying` | `marine_dying` | Civil Security - Dying |
| `CivilSecurityHurt1` | `marine_hurt1` | Civil Security - Hurt 1 |
| `CivilSecurityHurt2` | `marine_hurt2` | Civil Security - Hurt 2 |
| `CivilSecurityHurt3` | `marine_hurt3` | Civil Security - Hurt 3 |
| `CivilSecurityAlert1` | `marine_alert` | Civil Security - Alert 1 |
| `CivilSecurityAlert2` | `marine_alert2` | Civil Security - Alert 2 |
| `CivilSecurityAlert3` | `marine_alert3` | Civil Security - Alert 3 |
| `CivilSecurityAlert4` | `marine_alert4` | Civil Security - Alert 4 |
| `RayRifleTCoRR` | `s_gun_rayrifle` | Ray Rifle TCoRR |
| `LMG` | `wea_lmg` | LMG |
| `RealRifleAlt` | `wea_ditzy_cs_ik2` | Real rifle alt |
| `AndroidShotgun` | `wea_android_shotgun` | Android shotgun |
| `AndroidSniper` | `wea_android_sniper` | Android sniper |
| `StarDefenderDeath` | `sd_death` | Star Defender - Death |
| `StarDefenderAlert` | `sd_welcome2` | Star Defender - Alert |
| `StarDefenderHurt2` | `sd_hurt2` | Star Defender - Hurt 2 |
| `StarDefenderHurt1` | `sd_hurt1` | Star Defender - Hurt 1 |
| `HitReportFrag` | `hit_frag` | Hit report - frag |
| `HitReportHigh` | `hit_dmg3` | Hit report - high |
| `HitReportMedium` | `hit_dmg2` | Hit report - medium |
| `HitReportLow` | `hit_dmg` | Hit report - low |
| `PlasmaShotgun` | `wea_plasma_smg` | Plasma shotgun |
| `AndroidRailgun` | `wea_android_railgun` | Android railgun |
| `BisonRifle` | `wea_bison` | Bison rifle |
| `C9ImpactNade` | `wea_rifle_nade` | C9 impact nade |
| `AcidGrenadeBounce` | `grenade_wet` | Acid grenade bounce |
| `AcidGrenadeLauncher` | `wea_acid_gl3` | Acid grenade launcher |
| `Revolver` | `wea_revolver5` | Revolver |
| `AlienRailShotgun` | `wea_alien_rail_sg` | Alien rail shotgun |
| `SmallerRocket` | `wea_darkstar_rl3` | Smaller rocket |
| `FastShotgun` | `wea_auto_sg2` | Fast shotgun |
| `ToxicRailgun` | `wea_rail_toxic2` | Toxic railgun |
| `EnergyRifle` | `wea_ditzy_energy_rifle` | Energy Rifle |
| `FalkonianShotgun` | `wea_roxxar_rifle` | Falkonian Shotgun |
| `ReakhohshaFocusBeamRechargeOld` | `beam5_recharge` | Reakhohsha Focus Beam recharge (old) |
| `ReakhohshaFocusBeamRechargeNew` | `beam5_rechargeB` | Reakhohsha Focus Beam recharge (new) |
| `ReakhohshaFocusBeam` | `beam5` | Reakhohsha Focus Beam |
| `AlienLaserHeaterRifleRechargeOld` | `beam1_recharge` | Alien Laser/Heater Rifle recharge (old) |
| `AlienLaserHeaterRifleRechargeNew` | `beam1_rechargeB` | Alien Laser/Heater Rifle recharge (new) |
| `AlienLaserHeaterRifle` | `beam1` | Alien Laser/Heater Rifle |
| `PHANX92Falconet` | `wea_phanx` | PHANX-92 Falconet |
| `CrossfireCR42Ghost` | `wea_moonhawk_smg2` | Crossfire CR-42 Ghost |
| `CrossfireSentinelHurt3` | `crossfire_sentinel_hurt3` | Crossfire Sentinel - Hurt 3 |
| `CrossfireSentinelHurt2` | `crossfire_sentinel_hurt2` | Crossfire Sentinel - Hurt 2 |
| `CrossfireSentinelHurt1` | `crossfire_sentinel_hurt1` | Crossfire Sentinel - Hurt 1 |
| `CrossfireSentinelCelebrate1` | `crossfire_sentinel_celebrate1` | Crossfire Sentinel - Celebrate 1 |
| `CrossfireSentinelCelebrate2` | `crossfire_sentinel_celebrate2` | Crossfire Sentinel - Celebrate 2 |
| `CrossfireSentinelDeath2` | `crossfire_sentinel_death2` | Crossfire Sentinel - Death 2 |
| `CrossfireSentinelDeath1` | `crossfire_sentinel_death1` | Crossfire Sentinel - Death 1 |
| `CrossfireSentinelDying` | `crossfire_sentinel_dying` | Crossfire Sentinel - Dying |
| `CrossfireSentinelAlert3` | `crossfire_sentinel_welcome3` | Crossfire Sentinel - Alert 3 |
| `CrossfireSentinelAlert2` | `crossfire_sentinel_welcome2` | Crossfire Sentinel - Alert 2 |
| `CrossfireSentinelAlert1` | `crossfire_sentinel_welcome1` | Crossfire Sentinel - Alert 1 |
| `CrossfireSentinelDeath` | `crossfire_sentinel_death3` | Crossfire Sentinel - Death |
| `VultureDeath2` | `vulture_death2` | Vulture - Death 2 |
| `VultureDeath1` | `vulture_death1` | Vulture - Death 1 |
| `VultureDying` | `vulture_dying` | Vulture - Dying |
| `VultureHurt4` | `vulture_hurt4` | Vulture - Hurt 4 |
| `VultureHurt3` | `vulture_hurt3` | Vulture - Hurt 3 |
| `VultureHurt2` | `vulture_hurt2` | Vulture - Hurt 2 |
| `VultureHurt1` | `vulture_hurt1` | Vulture - Hurt 1 |
| `VultureCelebrate3` | `vulture_celebrate3` | Vulture - Celebrate 3 |
| `VultureCelebrate2` | `vulture_celebrate2` | Vulture - Celebrate 2 |
| `VultureCelebrate1` | `vulture_celebrate1` | Vulture - Celebrate 1 |
| `VultureAlert3` | `vulture_welcome3` | Vulture - Alert 3 |
| `VultureAlert2` | `vulture_welcome2` | Vulture - Alert 2 |
| `VultureAlert1` | `vulture_welcome1` | Vulture - Alert 1 |
| `CivilianHurt4` | `civilian_male_hurt4` | Civilian - Hurt 4 |
| `CivilianHurt3` | `civilian_male_hurt3` | Civilian - Hurt 3 |
| `CivilianHurt2` | `civilian_male_hurt2` | Civilian - Hurt 2 |
| `CivilianHurt1` | `civilian_male_hurt1` | Civilian - Hurt 1 |
| `CivilianDying2` | `civilian_male_dying2` | Civilian - Dying 2 |
| `CivilianDying1` | `civilian_male_dying1` | Civilian - Dying 1 |
| `CivilianAlert3` | `civilian_male_welcome3` | Civilian - Alert 3 |
| `CivilianAlert2` | `civilian_male_welcome2` | Civilian - Alert 2 |
| `CivilianAlert1` | `civilian_male_welcome1` | Civilian - Alert 1 |
| `CivilianCelebrate2` | `civilian_male_celebrate2` | Civilian - Celebrate 2 |
| `CivilianCelebrate1` | `civilian_male_celebrate1` | Civilian - Celebrate 1 |
| `CivilianDeath2` | `civilian_male_death2` | Civilian - Death 2 |
| `CivilianDeath1` | `civilian_male_death1` | Civilian - Death 1 |
| `ReakhohshaOperativeAlert1` | `reakhohsha_welcome1` | Reakhohsha Operative - Alert 1 |
| `ReakhohshaOperativeAlert2` | `reakhohsha_welcome2` | Reakhohsha Operative - Alert 2 |
| `ReakhohshaOperativeDeath` | `reakhohsha_death3` | Reakhohsha Operative - Death |
| `ReakhohshaOperativeHurt3` | `reakhohsha_hurt3` | Reakhohsha Operative - Hurt 3 |
| `ReakhohshaOperativeHurt2` | `reakhohsha_hurt2` | Reakhohsha Operative - Hurt 2 |
| `ReakhohshaOperativeHurt1` | `reakhohsha_hurt1` | Reakhohsha Operative - Hurt 1 |
| `MiningAndroidHurt` | `android_miner_hurt` | Mining Android - Hurt |
| `MiningAndroidAlert` | `android_miner_welcome2` | Mining Android - Alert |
| `MiningAndroidCelebrate` | `android_miner_enemy_down` | Mining Android - Celebrate |
| `MiningAndroidDeath` | `android_miner_die` | Mining Android - Death |

### Sky (`sky_model`, 18)

| Name | Value | Editor label |
|---|---|---|
| `YellowDark` | `1` | Yellow, dark |
| `YellowBright` | `2` | Yellow, bright |
| `AbsolutelyWhite` | `3` | Absolutely white |
| `AbsolutelyBlack` | `4` | Absolutely black |
| `Space` | `5` | Space |
| `Red` | `6` | Red |
| `AtomicWinter` | `7` | Atomic winter |
| `Dawn` | `8` | Dawn |
| `Dune` | `9` | Dune |
| `SandyMist` | `10` | Sandy mist |
| `Night` | `11` | Night |
| `PBFTTPSky` | `12` | PB:FTTP sky |
| `Stormy` | `13` | Stormy |
| `Evening` | `14` | Evening |
| `DarkerClouds` | `15` | Darker clouds |
| `Cumulus` | `16` | Cumulus |
| `BluishSkyWithClouds` | `17` | Bluish sky with clouds |
| `RedSky` | `18` | Red sky |

### Voice (`voice_preset`, 17)

| Name | Value | Editor label |
|---|---|---|
| `Mute` | `mute` | - Mute - |
| `Marine` | `marine` | Marine |
| `Hexagon` | `hexagon` | Hexagon |
| `CivilSecurity` | `cs` | Civil Security |
| `CivilSecurityGhost` | `ghost` | Civil Security Ghost |
| `UsurpationSoldier` | `usurpation` | Usurpation Soldier |
| `UsurpationDestroyer` | `usurpation_destroyer` | Usurpation Destroyer |
| `Android` | `android` | Android |
| `AndroidDeepSounds` | `hum_droid` | Android (deep sounds) |
| `AndroidMiner` | `mine_droid` | Android (miner) |
| `Proxy` | `proxy` | Proxy |
| `NoirLime` | `noir_lime` | Noir Lime |
| `Grub` | `grub` | Grub |
| `Falkok` | `falkok` | Falkok |
| `PhoenixFalkok` | `falkok_phoenix` | Phoenix Falkok |
| `ReakhohshaOperative` | `reakhohsha` | Reakhohsha Operative |
| `StarDefender` | `star_defender` | Star Defender |

### CharacterModel (`char`, 89)

| Name | Value | Editor label |
|---|---|---|
| `CampaignHeroModel` | `1` | Campaign Hero model |
| `UsurpationSoldierMinor` | `2` | Usurpation Soldier Minor |
| `Proxy` | `3` | Proxy |
| `AndroidT01187` | `4` | Android T-01187 |
| `DroneController` | `5` | Drone Controller |
| `AdvancedUsurpationSoldier` | `6` | Advanced Usurpation Soldier |
| `CivilSecurityHeavy` | `7` | Civil Security Heavy |
| `CivilSecurityLite` | `8` | Civil Security Lite |
| `AndroidSLC56` | `9` | Android SLC-56 |
| `CivilSecurityBoss` | `11` | Civil Security Boss |
| `CivilSecurityGhost` | `12` | Civil Security Ghost |
| `NoirLime` | `13` | Noir Lime |
| `Falkok` | `14` | Falkok |
| `PhoenixFalkok` | `15` | Phoenix Falkok |
| `Grub` | `16` | Grub |
| `CivilSecurityGhostVisible` | `17` | Civil Security Ghost (visible) |
| `StarDefender` | `18` | Star Defender |
| `RavenByAConiferousChair` | `19` | Raven by A Coniferous Chair |
| `PBFTTPStarDefender` | `21` | PB:FTTP Star Defender |
| `PBFTTPMarine` | `22` | PB:FTTP Marine |
| `PBFTTPSoldierRank1` | `23` | PB:FTTP Soldier Rank 1 |
| `PBFTTPSoldierRank2` | `24` | PB:FTTP Soldier Rank 2 |
| `PBFTTPSoldierRank3` | `25` | PB:FTTP Soldier Rank 3 |
| `PBFTTPSoldierRank4` | `26` | PB:FTTP Soldier Rank 4 |
| `ArmoredGrub` | `27` | Armored Grub |
| `EliteGrub` | `28` | Elite Grub |
| `FalkokBossByMrDarks` | `29` | Falkok Boss by Mr. Darks |
| `ReakhohshaOperativeByDarkstar1` | `31` | Reakhohsha Operative by darkstar 1 |
| `CivilProtectorByDarkstar1` | `32` | Civil Protector by darkstar 1 |
| `AndroidATM105ByDarkstar1` | `33` | Android ATM-105 by darkstar 1 |
| `AndroidDT148ByDitzy` | `34` | Android DT-148 by Ditzy |
| `ZephyrByDitzy` | `35` | Zephyr by Ditzy |
| `HermesByDarkstar1` | `36` | Hermes by darkstar 1 |
| `HexagonByDarkstar1` | `37` | Hexagon by darkstar 1 |
| `LiteHero` | `40` | Lite Hero |
| `LiteHero2` | `41` | Lite Hero 2 |
| `LiteHero3` | `42` | Lite Hero 3 |
| `LiteHero4` | `43` | Lite Hero 4 |
| `LiteHero5` | `44` | Lite Hero 5 |
| `LiteHero6` | `45` | Lite Hero 6 |
| `LiteHero7` | `46` | Lite Hero 7 |
| `LiteHero8` | `47` | Lite Hero 8 |
| `LiteHero9` | `48` | Lite Hero 9 |
| `HeavyHero` | `49` | Heavy Hero |
| `ProxyNoHelmet` | `61` | Proxy (No helmet) |
| `UsurpationRanger` | `69` | Usurpation Ranger |
| `UsurpationDestroyer` | `70` | Usurpation Destroyer |
| `UsurpationSoldierMajor` | `71` | Usurpation Soldier Major |
| `ProxyWhite` | `72` | Proxy (White) |
| `BluePlayerNoirLime` | `73` | Blue Player (Noir Lime) |
| `RedPlayerNoirLime` | `74` | Red Player (Noir Lime) |
| `BlueProxy` | `75` | Blue Proxy |
| `RedProxy` | `76` | Red Proxy |
| `BlueCivilSecurityLite` | `77` | Blue Civil Security Lite |
| `RedCivilSecurityLite` | `78` | Red Civil Security Lite |
| `BlueUsurpationSoldier` | `79` | Blue Usurpation Soldier |
| `RedUsurpationSoldier` | `80` | Red Usurpation Soldier |
| `BlueAndroidSLC56` | `81` | Blue Android SLC-56 |
| `RedAndroidSLC56` | `82` | Red Android SLC-56 |
| `BlueLiteHero` | `83` | Blue Lite Hero |
| `RedLiteHero` | `84` | Red Lite Hero |
| `BlueFalkok` | `85` | Blue Falkok |
| `RedFalkok` | `86` | Red Falkok |
| `BlueRavenByAConiferousChair` | `87` | Blue Raven by A Coniferous Chair |
| `RedRavenByAConiferousChair` | `88` | Red Raven by A Coniferous Chair |
| `BlueCivilProtectorByDarkstar1` | `89` | Blue Civil Protector by darkstar 1 |
| `RedCivilProtectorByDarkstar1` | `90` | Red Civil Protector by darkstar 1 |
| `MiningAndroidByDarkstar1` | `130` | Mining Android by darkstar 1 |
| `CrossfireSentinelByDitzy` | `131` | Crossfire Sentinel by Ditzy |
| `CrossfireHeadhunterByDitzy` | `132` | Crossfire Headhunter by Ditzy |
| `FederationSoldierByCakeSpider` | `133` | Federation Soldier by CakeSpider |
| `VultureByDarkstar1` | `134` | Vulture by darkstar 1 |
| `SilkArmorlessByDarkstar1` | `135` | Silk (armorless) by darkstar 1 |
| `SilkByDarkstar1` | `136` | Silk by darkstar 1 |
| `CivilSecurityRiotByEru` | `137` | Civil Security Riot by eru_ |
| `AvreByDarkstar1` | `138` | Avre by darkstar 1 |
| `CivilianMale1ByMrnat444` | `139` | Civilian (male 1) by mrnat444 |
| `CivilianMale2ByMrnat444` | `140` | Civilian (male 2) by mrnat444 |
| `CivilianMale3ByMrnat444` | `141` | Civilian (male 3) by mrnat444 |
| `CivilianFemale1ByMrnat444` | `142` | Civilian (female 1) by mrnat444 |
| `CivilianFemale2ByMrnat444` | `143` | Civilian (female 2) by mrnat444 |
| `CivilianFemale3ByMrnat444` | `144` | Civilian (female 3) by mrnat444 |
| `CivilianMale1EquippedByMrnat444` | `145` | Civilian (male 1 equipped) by mrnat444 |
| `CivilianMale2EquippedByMrnat444` | `146` | Civilian (male 2 equipped) by mrnat444 |
| `WorkerMaleByMrnat444` | `147` | Worker (male) by mrnat444 |
| `WorkerFemaleByMrnat444` | `148` | Worker (female) by mrnat444 |
| `SWATDarkByMrnat444` | `149` | S.W.A.T (dark) by mrnat444 |
| `SWATBrighterByMrnat444` | `150` | S.W.A.T (brighter) by mrnat444 |
| `DeathMatchModel` | `-1` | Death Match model |

### DecorModel (`decor_model`, 85)

| Name | Value | Editor label |
|---|---|---|
| `Stone` | `stone` | Stone |
| `SmallStone` | `stone2` | Small stone |
| `BrokenShip` | `ship` | Broken ship |
| `FloorGravitator` | `antigravity` | Floor gravitator |
| `OnWallGravitatorRight` | `antigravity_right` | On-wall gravitator right |
| `OnWallGravitatorLeft` | `antigravity_left` | On-wall gravitator left |
| `FloorTeleport` | `teleport` | Floor teleport |
| `CeilTeleport` | `teleport2` | Ceil teleport |
| `DisabledFloorTeleport` | `teleport_x` | Disabled floor teleport |
| `DisabledCeilTeleport` | `teleport2_x` | Disabled ceil teleport |
| `LeftKillingRay` | `ray_left` | Left killing ray |
| `RightKillingRay` | `ray_right` | Right killing ray |
| `CeilKillingRay` | `ray_ceil` | Ceil killing ray |
| `FloorKillingRay` | `ray_floor` | Floor killing ray |
| `Nothing` | `null` | Nothing |
| `DisabledFloorGravitator` | `antigravity0` | Disabled floor gravitator |
| `IncomingOnceAnimatedShip` | `ship_noir` | Incoming once animated ship |
| `WideTeleportDisabled` | `final_place` | Wide teleport disabled |
| `WideTeleportEnabled` | `final_place2` | Wide teleport enabled |
| `PixelDoor` | `pixel_door` | Pixel door |
| `PixelDoorClosed` | `pixel_door2` | Pixel door (closed) |
| `PixelTeleport` | `pixel_teleport` | Pixel teleport |
| `WallLampRightOffByDarkstar1` | `wall_lamp_right` | Wall lamp right (off) by darkstar 1 |
| `WallLampRightOnByDarkstar1` | `wall_lamp_right_on` | Wall lamp right (on) by darkstar 1 |
| `WallLampLeftOffByDarkstar1` | `wall_lamp_left` | Wall lamp left (off) by darkstar 1 |
| `WallLampLeftOnByDarkstar1` | `wall_lamp_left_on` | Wall lamp left (on) by darkstar 1 |
| `WallLampUpOffByDarkstar1` | `wall_lamp_up` | Wall lamp up (off) by darkstar 1 |
| `WallLampUpOnByDarkstar1` | `wall_lamp_up_on` | Wall lamp up (on) by darkstar 1 |
| `WallLampDownOffByDarkstar1` | `wall_lamp_down` | Wall lamp down (off) by darkstar 1 |
| `WallLampDownOnByDarkstar1` | `wall_lamp_down_on` | Wall lamp down (on) by darkstar 1 |
| `BackLampVerticalOffByDarkstar1` | `back_lamp_vertical` | Back lamp vertical (off) by darkstar 1 |
| `BackLampVerticalOnByDarkstar1` | `back_lamp_vertical_on` | Back lamp vertical (on) by darkstar 1 |
| `BackLampHorizontalOffByDarkstar1` | `back_lamp_horizontal` | Back lamp horizontal (off) by darkstar 1 |
| `BackLampHorizontalOnByDarkstar1` | `back_lamp_horizontal_on` | Back lamp horizontal (on) by darkstar 1 |
| `RedColumnByDoomzerker` | `column_red` | Red column by Doomzerker |
| `GreenColumnByDoomzerker` | `column_green` | Green column by Doomzerker |
| `BlueColumnByDoomzerker` | `column_blue` | Blue column by Doomzerker |
| `MinedBarrelByDoomzerker` | `mined_barrel` | Mined barrel by Doomzerker |
| `MachineByDarkstar1` | `darkstar_device` | Machine by darkstar 1 |
| `MachineDestroyedByDarkstar1` | `darkstar_device_destroyed` | Machine (destroyed) by darkstar 1 |
| `TextPlaceholderOverhead` | `text` | Text placeholder (overhead) |
| `TextPlaceholderScore` | `text2` | Text placeholder (score) |
| `TextPlaceholderChat` | `text3` | Text placeholder (chat) |
| `WallCameraLeftByDarkstar1` | `darkstar_camera_left` | Wall camera (left) by darkstar 1 |
| `WallCameraRightByDarkstar1` | `darkstar_camera_right` | Wall camera (right) by darkstar 1 |
| `FlagBlueByDitzy` | `ditzy_flag_blue` | Flag (blue) by Ditzy |
| `FlagRedByDitzy` | `ditzy_flag_red` | Flag (red) by Ditzy |
| `FlagDarkByDitzy` | `ditzy_flag_dark` | Flag (dark) by Ditzy |
| `FlagEmptyByDitzy` | `ditzy_flag_empty` | Flag (empty) by Ditzy |
| `HealingKitByDarkstar1` | `darkstar_healing_kit` | Healing kit by darkstar 1 |
| `HologramStandEnabledBlueByDarkstar1` | `darkstar_holo_on` | Hologram stand (enabled, blue) by darkstar 1 |
| `HologramStandEnabledRedByDarkstar1` | `darkstar_holo_on_red` | Hologram stand (enabled, red) by darkstar 1 |
| `HologramStandDisabledByDarkstar1` | `darkstar_holo_off` | Hologram stand (disabled) by darkstar 1 |
| `HologramOfEarthByDarkstar1` | `darkstar_holo_earth` | Hologram of Earth by darkstar 1 |
| `HologramOfCorrection9LogoByDarkstar1` | `darkstar_holo_c9` | Hologram of Correction-9 logo by darkstar 1 |
| `OrangeBarrelAsDecoration` | `static_barrel1` | Orange barrel as decoration |
| `BlueBarrelAsDecoration` | `static_barrel2` | Blue barrel as decoration |
| `RedBarrelAsDecoration` | `static_barrel3` | Red barrel as decoration |
| `PBFTTPVehicleRightAsDecoration` | `fttp_vehicle` | PB:FTTP Vehicle (right) as decoration |
| `PBFTTPVehicleLeftAsDecoration` | `fttp_vehicle2` | PB:FTTP Vehicle (left) as decoration |
| `PBFTTPVehicleWheelAsDecoration` | `fttp_wheel` | PB:FTTP Vehicle wheel as decoration |
| `PBFTTPDroneAsDecoration` | `fttp_drone` | PB:FTTP Drone as decoration |
| `XXFRapierIdleRightByDoomzerker` | `doomwrath_rapier_idle` | XXF Rapier (idle, right) by Doomzerker |
| `XXFRapierActiveRightByDoomzerker` | `doomwrath_rapier_active` | XXF Rapier (active, right) by Doomzerker |
| `XXFRapierIdleLeftByDoomzerker` | `doomwrath_rapier_idle2` | XXF Rapier (idle, left) by Doomzerker |
| `XXFRapierActiveLeftByDoomzerker` | `doomwrath_rapier_active2` | XXF Rapier (active, left) by Doomzerker |
| `FalkokShipIdlePilotlessRight` | `falkok_ship1` | Falkok ship (idle, pilotless, right) |
| `FalkokShipIdlePilotedRight` | `falkok_ship2` | Falkok ship (idle, piloted, right) |
| `FalkokShipActivePilotedRight` | `falkok_ship3` | Falkok ship (active, piloted, right) |
| `FalkokShipIdlePilotlessLeft` | `falkok_ship4` | Falkok ship (idle, pilotless, left) |
| `FalkokShipIdlePilotedLeft` | `falkok_ship5` | Falkok ship (idle, piloted, left) |
| `FalkokShipActivePilotedLeft` | `falkok_ship6` | Falkok ship (active, piloted, left) |
| `CrateByDarkstar1` | `darkstar_crate` | Crate by darkstar 1 |
| `WeaponCrateByDarkstar1` | `darkstar_weapon_crate` | Weapon Crate by darkstar 1 |
| `PortableFissionChamberByDarkstar1` | `darkstar_portable_fission` | Portable Fission Chamber by darkstar 1 |
| `PortableFissionChamberDebrisByDarkstar1` | `darkstar_portable_fission_brk` | Portable Fission Chamber debris by darkstar 1 |
| `CeilingCameraByDarkstar1` | `darkstar_ceiling_camera` | Ceiling camera by darkstar 1 |
| `StorageLockerByDoomzerker` | `doomzerker_locker` | Storage locker by Doomzerker |
| `StorageLockerDamagedByDoomzerker` | `doomzerker_locker2` | Storage locker (damaged) by Doomzerker |
| `StorageLockerOpenByDoomzerker` | `doomzerker_locker3` | Storage locker (open) by Doomzerker |
| `TreeSmallByDarkstar1` | `darkstar_tree1` | Tree (small) by darkstar 1 |
| `TreeMediumByDarkstar1` | `darkstar_tree2` | Tree (medium) by darkstar 1 |
| `PotByDarkstar1` | `darkstar_pot` | Pot by darkstar 1 |
| `TreeInPotSmallByDarkstar1` | `darkstar_pot_tree1` | Tree in pot (small) by darkstar 1 |
| `TreeInPotMediumByDarkstar1` | `darkstar_pot_tree2` | Tree in pot (medium) by darkstar 1 |

### Song (`song+none`, 1)

| Name | Value | Editor label |
|---|---|---|
| `Silence` | `-1` | - Silence - |

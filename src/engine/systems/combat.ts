import type { AttackType, EquipmentBonuses, NpcCombatDef } from '../../content/types'
import type { Game } from '../core/game'
import type { Rng } from '../core/rng'
import type { Npc } from '../entities/npc'
import type { PlayerAction } from '../entities/player'
import { chebyshev, type Vec2 } from '../world/vec2'
import type { Equipment } from './equipment'
import { getItemDef } from './itemRegistry'
import type { Skills } from './skills'

/**
 * Why an attack command failed to start or continue. `no_ammo` is emitted
 * when a bow is wielded but the ammo slot is empty.
 */
export type CombatFailReason = 'target_dead' | 'no_ammo'

// Combat events, added via declaration merging (see eventBus.ts).
declare module '../core/eventBus' {
  interface GameEvents {
    /**
     * Emitted on every attack (damage 0 = miss/splash). `targetId` is the
     * NPC def id for player attacks and the literal 'player' for NPC attacks.
     * `npc` is the NPC instance involved (the target of player attacks, the
     * attacker for NPC attacks) so the UI can animate the right entity.
     */
    damageDealt: {
      source: 'player' | 'npc'
      targetId: string
      damage: number
      targetHpAfter: number
      npc: Npc
    }
    /** Emitted when the player's hitpoints reach 0 (payload = death tile). */
    playerDied: { x: number; y: number }
  }
}

/**
 * Melee attack styles. Each grants an invisible +3 to one effective combat
 * level (controlled: +1 to all three) and routes combat xp to that skill.
 */
export type MeleeAttackStyle = 'accurate' | 'aggressive' | 'defensive' | 'controlled'

/**
 * Ranged attack styles (used while a bow is wielded). Accurate grants an
 * invisible +3 to the effective Ranged level for the accuracy roll; Rapid
 * gives no accuracy bonus but fires one tick faster. Both route xp to Ranged.
 * (OSRS also has Longrange; omitted here.)
 */
export type RangedAttackStyle = 'ranged_accurate' | 'ranged_rapid'

/**
 * Every selectable attack style. A bow uses the ranged styles; every other
 * weapon (and unarmed) uses the melee styles. The player stores a single
 * active style; combat coerces to a sensible default when it does not match
 * the wielded weapon class (see performPlayerAttack).
 */
export type AttackStyle = MeleeAttackStyle | RangedAttackStyle

/** True for the ranged attack styles. */
export function isRangedStyle(style: AttackStyle): style is RangedAttackStyle {
  return style === 'ranged_accurate' || style === 'ranged_rapid'
}

/**
 * Effective-level (melee) bonuses per style (OSRS invisible style bonuses).
 * The ranged styles contribute nothing here: their accuracy bonus lives in
 * RANGED_STYLE_ATTACK_BONUS, and they grant no melee attack/strength/defence.
 * They are still listed so `STYLE_BONUSES[player.attackStyle]` is always
 * defined (e.g. the player's defence bonus during an NPC's attack).
 */
export const STYLE_BONUSES: Record<
  AttackStyle,
  { attack: number; strength: number; defence: number }
> = {
  accurate: { attack: 3, strength: 0, defence: 0 },
  aggressive: { attack: 0, strength: 3, defence: 0 },
  defensive: { attack: 0, strength: 0, defence: 3 },
  controlled: { attack: 1, strength: 1, defence: 1 },
  ranged_accurate: { attack: 0, strength: 0, defence: 0 },
  ranged_rapid: { attack: 0, strength: 0, defence: 0 },
}

/** Invisible +Ranged-level bonus to the accuracy roll per ranged style. */
export const RANGED_STYLE_ATTACK_BONUS: Record<RangedAttackStyle, number> = {
  ranged_accurate: 3,
  ranged_rapid: 0,
}

/** Rapid fires this many ticks faster than the bow's base speed (min 1). */
export const RANGED_RAPID_SPEED_REDUCTION = 1

/**
 * The attack styles a weapon offers: the ranged styles when a bow is
 * wielded, otherwise the four melee styles. Used by the UI to present the
 * right buttons.
 */
export const MELEE_ATTACK_STYLES: readonly MeleeAttackStyle[] = [
  'accurate',
  'aggressive',
  'defensive',
  'controlled',
]
export const RANGED_ATTACK_STYLES: readonly RangedAttackStyle[] = [
  'ranged_accurate',
  'ranged_rapid',
]

/** Attack styles selectable for the currently wielded weapon. */
export function attackStylesFor(equipment: Equipment): readonly AttackStyle[] {
  return equipment.isRangedWeapon() ? RANGED_ATTACK_STYLES : MELEE_ATTACK_STYLES
}

/**
 * NPCs fight as if on a style granting +1 to every effective level, so
 * their effective levels come out to `level + 9` (OSRS convention).
 */
export const NPC_STYLE_BONUS = 1

/**
 * OSRS effective level: floor(level * prayerMultiplier) + styleBonus + 8.
 * `prayerMult` is 1 when no combat prayer boosts this stat, or 1 + the
 * highest active prayer bonus for the stat (see systems/prayer.ts). Callers
 * pass the relevant multiplier from `player.prayers`.
 */
export function effectiveLevel(currentLevel: number, styleBonus: number, prayerMult = 1): number {
  return Math.floor(currentLevel * prayerMult) + styleBonus + 8
}

/** OSRS max attack roll: effectiveAttack * (equipmentAttackBonus + 64). */
export function attackRoll(effectiveAttack: number, equipmentAttackBonus: number): number {
  return effectiveAttack * (equipmentAttackBonus + 64)
}

/** OSRS max defence roll: effectiveDefence * (equipmentDefenceBonus + 64). */
export function defenceRoll(effectiveDefence: number, equipmentDefenceBonus: number): number {
  return effectiveDefence * (equipmentDefenceBonus + 64)
}

/**
 * OSRS hit chance from the two max rolls:
 *   attack > defence: 1 - (def + 2) / (2 * (atk + 1))
 *   otherwise:        atk / (2 * (def + 1))
 */
export function hitChance(atkRoll: number, defRoll: number): number {
  if (atkRoll > defRoll) return 1 - (defRoll + 2) / (2 * (atkRoll + 1))
  return atkRoll / (2 * (defRoll + 1))
}

/** OSRS max hit: floor(0.5 + effectiveStrength * (strengthBonus + 64) / 640). */
export function maxHit(effectiveStrength: number, strengthBonus: number): number {
  return Math.floor(0.5 + (effectiveStrength * (strengthBonus + 64)) / 640)
}

/**
 * Ranged accuracy max roll: like the melee attack roll, but driven by the
 * Ranged level (plus the ranged style's accuracy bonus) and the equipment's
 * ranged attack bonus. Ranged has no prayer multipliers in this engine.
 */
export function rangedAccuracyRoll(
  rangedLevel: number,
  style: RangedAttackStyle,
  attackRangedBonus: number,
): number {
  return attackRoll(effectiveLevel(rangedLevel, RANGED_STYLE_ATTACK_BONUS[style]), attackRangedBonus)
}

/**
 * Ranged max hit: like the melee max hit, but driven by the Ranged level and
 * the ammo's ranged-strength bonus. The style does not change the max hit
 * (Rapid only changes attack speed).
 */
export function rangedMaxHit(rangedLevel: number, rangedStrengthBonus: number): number {
  return maxHit(effectiveLevel(rangedLevel, 0), rangedStrengthBonus)
}

/**
 * Roll one attack: first the accuracy roll (hitChance), then — on success —
 * a uniform damage roll in [0, maxHit] (a successful hit can still deal 0,
 * like OSRS). A failed accuracy roll always deals 0.
 */
export function rollDamage(rng: Rng, atkRoll: number, defRoll: number, max: number): number {
  if (!rng.chance(hitChance(atkRoll, defRoll))) return 0
  return rng.nextInt(0, max)
}

/** Damage type of the player's current weapon ('crush' when unarmed). */
export function playerAttackType(equipment: Equipment): AttackType {
  const weapon = equipment.get('weapon')
  if (!weapon) return 'crush'
  return getItemDef(weapon.itemId).equipment?.attackType ?? 'crush'
}

const ATTACK_BONUS_KEY: Record<AttackType, keyof EquipmentBonuses> = {
  stab: 'attackStab',
  slash: 'attackSlash',
  crush: 'attackCrush',
}

const DEFENCE_BONUS_KEY: Record<AttackType, keyof EquipmentBonuses> = {
  stab: 'defenceStab',
  slash: 'defenceSlash',
  crush: 'defenceCrush',
}

/**
 * Grant combat xp for `damage` dealt: 4 xp per damage to the style skill
 * (controlled: 4/3 per damage to each of attack/strength/defence) plus
 * 4/3 per damage to hitpoints. XP is added as exact fractions — Skills
 * stores xp as a number, so no separate fractional accumulator is needed.
 */
export function grantCombatXp(skills: Skills, style: MeleeAttackStyle, damage: number): void {
  if (damage <= 0) return
  if (style === 'controlled') {
    skills.addXp('attack', (4 / 3) * damage)
    skills.addXp('strength', (4 / 3) * damage)
    skills.addXp('defence', (4 / 3) * damage)
  } else {
    const skill = style === 'accurate' ? 'attack' : style === 'aggressive' ? 'strength' : 'defence'
    skills.addXp(skill, 4 * damage)
  }
  skills.addXp('hitpoints', (4 / 3) * damage)
}

/**
 * Grant ranged combat xp for `damage` dealt: 4 xp per damage to Ranged plus
 * 4/3 per damage to Hitpoints (both the Accurate and Rapid ranged styles
 * train Ranged, mirroring OSRS). XP is added as exact fractions.
 */
export function grantRangedXp(skills: Skills, damage: number): void {
  if (damage <= 0) return
  skills.addXp('ranged', 4 * damage)
  skills.addXp('hitpoints', (4 / 3) * damage)
}

/**
 * Execute one player melee attack against `npc`: full OSRS roll using the
 * weapon's attack type vs the NPC's matching defence bonus. Damage is
 * capped at the NPC's remaining hp (xp is granted on the capped amount).
 * The NPC always retaliates (targets the player), even on a miss. Kills
 * trigger `npc.die(game)` (death event + drops + respawn timer).
 */
export function performPlayerAttack(game: Game, npc: Npc): void {
  if (game.player.equipment.isRangedWeapon()) {
    performRangedAttack(game, npc)
    return
  }
  performMeleeAttack(game, npc)
}

/**
 * Execute one player melee attack (the historical `performPlayerAttack`
 * behavior, unchanged). A ranged style set while a melee weapon is wielded
 * coerces to Accurate so the melee formulas stay well-defined.
 */
function performMeleeAttack(game: Game, npc: Npc): void {
  const { player, events, rng } = game
  const style: MeleeAttackStyle = isRangedStyle(player.attackStyle)
    ? 'accurate'
    : player.attackStyle
  const styleBonus = STYLE_BONUSES[style]
  const bonuses = player.equipment.totalBonuses()
  const type = playerAttackType(player.equipment)
  const c = npc.def.combat

  const atk = attackRoll(
    effectiveLevel(
      player.skills.getCurrentLevel('attack'),
      styleBonus.attack,
      player.prayers.attackMultiplier(),
    ),
    bonuses[ATTACK_BONUS_KEY[type]],
  )
  const def = defenceRoll(effectiveLevel(c.defenceLevel, NPC_STYLE_BONUS), c.defenceBonuses[type])
  const max = maxHit(
    effectiveLevel(
      player.skills.getCurrentLevel('strength'),
      styleBonus.strength,
      player.prayers.strengthMultiplier(),
    ),
    bonuses.meleeStrength,
  )

  const damage = npc.takeDamage(rollDamage(rng, atk, def, max))
  grantCombatXp(player.skills, style, damage)
  events.emit('damageDealt', {
    source: 'player',
    targetId: npc.def.id,
    damage,
    targetHpAfter: npc.currentHp,
    npc,
  })
  npc.setTarget(player)
  if (npc.currentHp <= 0) npc.die(game)
}

/**
 * Execute one player ranged attack against `npc` (bow wielded). Consumes one
 * item from the ammo slot, then rolls OSRS-style ranged formulas:
 *   - accuracy: effective Ranged level (+3 on Accurate) vs the NPC's defence
 *     (NPCs carry no ranged-defence bonus, so 0 is used);
 *   - max hit: effective Ranged level and the ammo's ranged-strength bonus.
 * Rapid does not change the max hit — only the attack speed (see
 * Player.markAttacked). XP routes to Ranged + Hitpoints. The caller
 * (AttackAction) guarantees ammo is present before this runs. Retaliation
 * and death handling mirror the melee path.
 */
function performRangedAttack(game: Game, npc: Npc): void {
  const { player, events, rng } = game
  player.equipment.consumeAmmo(1)
  const style: RangedAttackStyle = player.attackStyle === 'ranged_rapid'
    ? 'ranged_rapid'
    : 'ranged_accurate'
  const bonuses = player.equipment.totalBonuses()
  const rangedLevel = player.skills.getCurrentLevel('ranged')
  const c = npc.def.combat

  const atk = attackRoll(
    effectiveLevel(rangedLevel, RANGED_STYLE_ATTACK_BONUS[style]),
    bonuses.attackRanged,
  )
  // NPCs have no ranged defence bonus in this engine, so use 0.
  const def = defenceRoll(effectiveLevel(c.defenceLevel, NPC_STYLE_BONUS), 0)
  const max = maxHit(effectiveLevel(rangedLevel, 0), bonuses.rangedStrength)

  const damage = npc.takeDamage(rollDamage(rng, atk, def, max))
  grantRangedXp(player.skills, damage)
  events.emit('damageDealt', {
    source: 'player',
    targetId: npc.def.id,
    damage,
    targetHpAfter: npc.currentHp,
    npc,
  })
  npc.setTarget(player)
  if (npc.currentHp <= 0) npc.die(game)
}

/**
 * Execute one NPC melee attack against the player using the same formulas:
 * the NPC's attack type (default 'crush') is rolled against the player's
 * matching equipment defence bonus; the player's current attack style
 * contributes its defence bonus to the effective defence level. Damage is
 * a hitpoints drain (hitpoints current level IS current HP); reaching 0
 * triggers `handlePlayerDeath`.
 */
export function performNpcAttack(game: Game, npc: Npc): void {
  const { player, events, rng } = game
  const c: NpcCombatDef = npc.def.combat
  const type = c.attackType ?? 'crush'
  const bonuses = player.equipment.totalBonuses()

  const atk = attackRoll(effectiveLevel(c.attackLevel, NPC_STYLE_BONUS), c.attackBonus)
  const def = defenceRoll(
    effectiveLevel(
      player.skills.getCurrentLevel('defence'),
      STYLE_BONUSES[player.attackStyle].defence,
      player.prayers.defenceMultiplier(),
    ),
    bonuses[DEFENCE_BONUS_KEY[type]],
  )
  const max = maxHit(effectiveLevel(c.strengthLevel, NPC_STYLE_BONUS), c.strengthBonus)

  const hpBefore = player.skills.getCurrentLevel('hitpoints')
  const damage = Math.min(rollDamage(rng, atk, def, max), hpBefore)
  if (damage > 0) player.skills.boost('hitpoints', -damage)
  events.emit('damageDealt', {
    source: 'npc',
    targetId: 'player',
    damage,
    targetHpAfter: hpBefore - damage,
    npc,
  })
  if (hpBefore - damage <= 0) handlePlayerDeath(game)
}

/**
 * OSRS-lite player death: emit `playerDied` (payload = death tile), switch
 * off all active prayers, restore hitpoints to the full base level (clear the
 * drain), release every NPC targeting the player, and teleport to the map
 * spawn. No items are lost.
 */
export function handlePlayerDeath(game: Game): void {
  const { player, events } = game
  events.emit('playerDied', { x: player.x, y: player.y })
  // Prayers switch off on death (they are transient).
  player.prayers.reset()
  const skills = player.skills
  skills.boost('hitpoints', skills.getLevel('hitpoints') - skills.getCurrentLevel('hitpoints'))
  for (const npc of game.npcs) {
    if (npc.target === player) npc.setTarget(null)
  }
  player.teleport(game.spawn.x, game.spawn.y)
}

/**
 * Tick-driven melee combat against one NPC.
 *
 * Started via `player.attack(npc)`, which queues a walk to an adjacent tile
 * and sets this action; Player.update walks the path first and only ticks
 * the action when idle (walk-then-act, same as gathering). Because the NPC
 * moves, each tick re-checks adjacency and re-paths (`player.chase`) when
 * the target has drifted away.
 *
 * Attacks land every `equipment.weaponSpeed()` ticks (the first as soon as
 * the player is adjacent). The attack cooldown is tracked on the Player
 * (canAttack/markAttacked), NOT on this action, so re-issuing attack() —
 * spam-clicking a target or switching targets — cannot reset it and swing
 * early. The action ends when the NPC dies or becomes unreachable.
 */
export class AttackAction implements PlayerAction {
  readonly kind = 'combat'

  constructor(private readonly npc: Npc) {}

  /** The target NPC's live position (it moves). */
  get targetPosition(): Readonly<Vec2> {
    return this.npc.position
  }

  onTick(game: Game): boolean {
    const { player, events } = game
    if (!this.npc.alive) return false
    const range = player.equipment.weaponRange()
    if (range <= 1) {
      // Melee (unchanged): close to adjacency, re-pathing as the NPC moves.
      if (chebyshev(player.position, this.npc.position) > 1) {
        return player.chase(this.npc.position)
      }
    } else if (chebyshev(player.position, this.npc.position) > range) {
      // Ranged: close only to within weapon range (not melee adjacency).
      return player.chaseWithinRange(this.npc.position, range)
    }
    // A bow with an empty ammo slot cannot fire: report and end (no swing,
    // so the cooldown is untouched). Checked before markAttacked.
    if (player.equipment.isRangedWeapon() && !player.equipment.hasAmmo()) {
      events.emit('actionFailed', { reason: 'no_ammo' })
      return false
    }
    // Cooldown lives on the player: re-creating this action (spam-clicking
    // or switching targets) can't bypass it.
    if (!player.canAttack(game.tickCount)) return true
    player.markAttacked(game.tickCount)
    performPlayerAttack(game, this.npc)
    return this.npc.alive
  }
}

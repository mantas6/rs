import type { AttackType, EquipmentBonuses, NpcCombatDef } from '../../content/types'
import type { Game } from '../core/game'
import type { Rng } from '../core/rng'
import type { Npc } from '../entities/npc'
import type { PlayerAction } from '../entities/player'
import { chebyshev, type Vec2 } from '../world/vec2'
import type { Equipment } from './equipment'
import { getItemDef } from './itemRegistry'
import type { Skills } from './skills'

/** Why an attack command failed to start. */
export type CombatFailReason = 'target_dead'

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
export type AttackStyle = 'accurate' | 'aggressive' | 'defensive' | 'controlled'

/** Effective-level bonuses per style (OSRS invisible style bonuses). */
export const STYLE_BONUSES: Record<
  AttackStyle,
  { attack: number; strength: number; defence: number }
> = {
  accurate: { attack: 3, strength: 0, defence: 0 },
  aggressive: { attack: 0, strength: 3, defence: 0 },
  defensive: { attack: 0, strength: 0, defence: 3 },
  controlled: { attack: 1, strength: 1, defence: 1 },
}

/**
 * NPCs fight as if on a style granting +1 to every effective level, so
 * their effective levels come out to `level + 9` (OSRS convention).
 */
export const NPC_STYLE_BONUS = 1

/**
 * OSRS effective level: floor(level * prayerMultiplier) + styleBonus + 8.
 * Prayers are not implemented yet; the multiplier defaults to 1.
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
export function grantCombatXp(skills: Skills, style: AttackStyle, damage: number): void {
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
 * Execute one player melee attack against `npc`: full OSRS roll using the
 * weapon's attack type vs the NPC's matching defence bonus. Damage is
 * capped at the NPC's remaining hp (xp is granted on the capped amount).
 * The NPC always retaliates (targets the player), even on a miss. Kills
 * trigger `npc.die(game)` (death event + drops + respawn timer).
 */
export function performPlayerAttack(game: Game, npc: Npc): void {
  const { player, events, rng } = game
  const style = player.attackStyle
  const styleBonus = STYLE_BONUSES[style]
  const bonuses = player.equipment.totalBonuses()
  const type = playerAttackType(player.equipment)
  const c = npc.def.combat

  const atk = attackRoll(
    effectiveLevel(player.skills.getCurrentLevel('attack'), styleBonus.attack),
    bonuses[ATTACK_BONUS_KEY[type]],
  )
  const def = defenceRoll(effectiveLevel(c.defenceLevel, NPC_STYLE_BONUS), c.defenceBonuses[type])
  const max = maxHit(
    effectiveLevel(player.skills.getCurrentLevel('strength'), styleBonus.strength),
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
 * OSRS-lite player death: emit `playerDied` (payload = death tile), restore
 * hitpoints to the full base level (clear the drain), release every NPC
 * targeting the player, and teleport to the map spawn. No items are lost.
 */
export function handlePlayerDeath(game: Game): void {
  const { player, events } = game
  events.emit('playerDied', { x: player.x, y: player.y })
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
    const { player } = game
    if (!this.npc.alive) return false
    if (chebyshev(player.position, this.npc.position) > 1) {
      // Re-path to the NPC's new position; end when unreachable.
      return player.chase(this.npc.position)
    }
    // Cooldown lives on the player: re-creating this action (spam-clicking
    // or switching targets) can't bypass it.
    if (!player.canAttack(game.tickCount)) return true
    player.markAttacked(game.tickCount)
    performPlayerAttack(game, this.npc)
    return this.npc.alive
  }
}

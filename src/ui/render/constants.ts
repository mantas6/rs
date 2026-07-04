// Shared constants + small types for the renderer modules. Purely visual
// tuning values (camera feel, animation timing) plus the action→pose map.
import type { PlayerActionKind } from '../../engine'
import type { PlayerPose } from '../sprites'

/**
 * Fallback canvas viewport size in pixels. The live canvas is no longer
 * locked to this — GameRenderer observes its container and resizes to fill
 * it (see `resize`) — but these are kept as the initial/aspect fallback and
 * for any code that still wants a nominal size.
 */
export const VIEW_W = 720
export const VIEW_H = 480

// ---- Camera constants (OSRS-style orbit around the player) ----

export const CAM_MIN_DIST = 5
export const CAM_MAX_DIST = 30
export const CAM_MIN_PITCH = 0.35
export const CAM_MAX_PITCH = 1.35
/** Arrow-key rotate speed, radians per second. */
export const KEY_YAW_SPEED = 2.2
export const KEY_PITCH_SPEED = 1.4

// ---- Animation constants shared by the player and NPCs (purely visual;
// see sprites/playerMesh.ts and sprites/npcMesh.ts) ----

/** How long the red flash + flinch lasts after taking damage. */
export const FLINCH_MS = 350
/** Duration of one attack-swing overlay after an attacker deals damage. */
export const ATTACK_SWING_MS = 400
/** Fall-over time and total on-the-ground (corpse) time after dying. */
export const DEATH_FALL_MS = 500
export const DEATH_TOTAL_MS = 1100
/** Facing turn speed, radians per second. */
export const TURN_SPEED = 12
/** World-space height a hitsplat floats at above the player's head. */
export const PLAYER_HITSPLAT_HEIGHT = 1.5
/** Extra height above an NPC's health bar to float its hitsplats. */
export const NPC_HITSPLAT_OFFSET = 0.18

/** Pose used for each engine action kind. */
export const ACTION_POSE: Record<PlayerActionKind, PlayerPose> = {
  woodcutting: 'chop',
  mining: 'chop',
  fishing: 'fish',
  firemaking: 'firemaking',
  cooking: 'cook',
  smithing: 'cook', // stand over the furnace, same stance as cooking
  crafting: 'cook', // tanning at the tannery / sewing leather
  fletching: 'cook', // carving logs with a knife, same seated stance
  herblore: 'cook', // mixing potions from the inventory, same seated stance
  farming: 'cook', // kneeling over the patch, same crouched stance
  banking: 'bank',
  shopping: 'bank',
  pickup: 'bank',
  combat: 'combat',
}

/** Hovered tile in map coordinates (null when the mouse is outside). */
export interface Hover {
  x: number
  y: number
}

/** Tile-position pair used to interpolate one entity between ticks. */
export interface MoverLerp {
  px: number
  py: number
  cx: number
  cy: number
}

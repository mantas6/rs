// Pure pose + facing selection for the player and NPCs. Given the interpolated
// movement state and the relevant engine facts, decide which visual pose to
// play and which tile (if any) to face. No THREE, no side effects — the
// GameRenderer feeds the result into the sprite updaters. Trivially testable.
import type { PlayerActionKind, Vec2 } from '../../engine'
import { yawToward, type NpcPose, type PlayerPose } from '../sprites'
import { ACTION_POSE, type MoverLerp } from './constants'

/** The chosen pose plus the yaw to face (null = keep current facing). */
export interface PoseChoice<Pose> {
  pose: Pose
  faceTarget: number | null
}

/**
 * Pick the player's pose + facing from engine state. Priority: death fall >
 * walking (tick interpolation still in progress) > current action (via its
 * `kind` descriptor) > open bank/shop > idle. Facing turns toward the
 * movement direction or the action's target tile.
 */
export function selectPlayerPose(args: {
  dying: boolean
  walking: boolean
  state: MoverLerp | undefined
  actionKind: PlayerActionKind | undefined
  actionTarget: Readonly<Vec2> | null | undefined
  playerPosition: Vec2
  bankOpen: boolean
  shopOpen: boolean
}): PoseChoice<PlayerPose> {
  const { dying, walking, state } = args
  let pose: PlayerPose = 'idle'
  let faceTarget: number | null = null
  if (dying) {
    pose = 'death'
  } else if (walking && state) {
    pose = 'walk'
    faceTarget = yawToward({ x: state.px, y: state.py }, { x: state.cx, y: state.cy })
  } else if (args.actionKind) {
    pose = ACTION_POSE[args.actionKind]
    if (args.actionTarget) faceTarget = yawToward(args.playerPosition, args.actionTarget)
  } else if (args.bankOpen || args.shopOpen) {
    pose = 'bank'
  }
  return { pose, faceTarget }
}

/**
 * Pick an NPC's pose + facing from engine state. Priority: death fall >
 * walking (tick interpolation in progress, facing the movement direction) >
 * combat stance facing its target > idle.
 */
export function selectNpcPose(args: {
  dying: boolean
  walking: boolean
  state: MoverLerp | undefined
  targetPosition: Vec2 | null
  npcPosition: Vec2
}): PoseChoice<NpcPose> {
  const { dying, walking, state } = args
  let pose: NpcPose = 'idle'
  let faceTarget: number | null = null
  if (dying) {
    pose = 'death'
  } else if (walking && state) {
    pose = 'walk'
    faceTarget = yawToward({ x: state.px, y: state.py }, { x: state.cx, y: state.cy })
  } else if (args.targetPosition) {
    pose = 'combat'
    faceTarget = yawToward(args.npcPosition, args.targetPosition)
  }
  return { pose, faceTarget }
}

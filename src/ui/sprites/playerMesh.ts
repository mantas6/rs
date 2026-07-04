// Player avatar: low-poly articulated humanoid (torso + head + arms + legs
// on shoulder/hip pivot groups) plus `updatePlayerAnimation`, the pure-UI
// procedural animator driven by the renderer's rAF loop. The model faces
// +Z at yaw 0; the renderer supplies a smoothed facing yaw.
import * as THREE from 'three'
import { strike, swing } from './animation'
import { tileGroup, type SpriteResources } from './resources'

const PLAYER_TORSO = 0x3b6ea5
const PLAYER_LIMBS = 0x2c5480
const PLAYER_LEGS = 0x4a4a55
const PLAYER_HEAD = 0xe8d5b5

// Skeleton layout (heights in world units).
const HIP_Y = 0.44
const SHOULDER_Y = 0.86

/** Player scene nodes the animator drives each frame. */
export interface PlayerView {
  /** Picking-tagged tile group; the renderer positions this. */
  group: THREE.Group
  /** Facing + whole-body offsets (bob, lean, lunge, fall) go here. */
  body: THREE.Group
  head: THREE.Mesh
  leftArm: THREE.Group
  rightArm: THREE.Group
  leftLeg: THREE.Group
  rightLeg: THREE.Group
  /** Dedicated (uncached) materials, tinted red for the damage flash. */
  materials: THREE.MeshLambertMaterial[]
}

/** Visual stance the renderer picked from engine state. */
export type PlayerPose =
  | 'idle'
  | 'walk'
  | 'chop' // woodcutting + mining
  | 'fish'
  | 'firemaking'
  | 'cook'
  | 'bank' // banking + item pickup (lean over)
  | 'combat'
  | 'death'

/** Per-frame animation input, all purely visual (see renderer.ts). */
export interface PlayerAnimInput {
  pose: PlayerPose
  /** performance.now() timestamp of this frame. */
  now: number
  /** 0..1 progress through the current engine tick (tick-synced swings). */
  tickPhase: number
  /** Smoothed facing yaw in radians (+Z-facing model). */
  yaw: number
  /** 1 right after taking damage, decaying to 0 (flinch + red flash). */
  flinch: number
  /** 0..1 progress of the death fall, 0 when alive. */
  death: number
  /** 0..1 progress of the player's own attack swing, 1 when finished. */
  attackSwing: number
}

/** An arm or leg: a pivot group at the joint with the limb box hanging down. */
function limb(
  res: SpriteResources,
  material: THREE.Material,
  width: number,
  length: number,
  x: number,
  jointY: number,
): THREE.Group {
  const pivot = new THREE.Group()
  pivot.position.set(x, jointY, 0)
  const mesh = new THREE.Mesh(res.geo(new THREE.BoxGeometry(width, length, width)), material)
  mesh.position.y = -length / 2
  pivot.add(mesh)
  return pivot
}

export function createPlayerMesh(res: SpriteResources, x: number, y: number): PlayerView {
  const group = tileGroup(x, y)
  const body = new THREE.Group()
  // Yaw-then-pitch so leans/falls tip along the facing direction.
  body.rotation.order = 'YXZ'
  group.add(body)

  // Dedicated materials so the red damage flash never tints shared sprites.
  const torsoMat = new THREE.MeshLambertMaterial({ color: PLAYER_TORSO })
  const limbMat = new THREE.MeshLambertMaterial({ color: PLAYER_LIMBS })
  const legMat = new THREE.MeshLambertMaterial({ color: PLAYER_LEGS })
  const headMat = new THREE.MeshLambertMaterial({ color: PLAYER_HEAD })
  const materials = [torsoMat, limbMat, legMat, headMat]
  res.trackMaterial('player:torso', torsoMat)
  res.trackMaterial('player:limbs', limbMat)
  res.trackMaterial('player:legs', legMat)
  res.trackMaterial('player:head', headMat)

  const torso = new THREE.Mesh(res.geo(new THREE.BoxGeometry(0.32, 0.44, 0.2)), torsoMat)
  torso.position.y = (HIP_Y + SHOULDER_Y) / 2 + 0.01
  body.add(torso)

  const head = new THREE.Mesh(res.geo(new THREE.SphereGeometry(0.14, 12, 12)), headMat)
  head.position.y = SHOULDER_Y + 0.18
  body.add(head)

  const leftArm = limb(res, limbMat, 0.09, 0.4, -0.215, SHOULDER_Y)
  const rightArm = limb(res, limbMat, 0.09, 0.4, 0.215, SHOULDER_Y)
  const leftLeg = limb(res, legMat, 0.13, 0.42, -0.09, HIP_Y)
  const rightLeg = limb(res, legMat, 0.13, 0.42, 0.09, HIP_Y)
  body.add(leftArm, rightArm, leftLeg, rightLeg)

  return { group, body, head, leftArm, rightArm, leftLeg, rightLeg, materials }
}

/**
 * Drive the player skeleton for one frame: reset to the neutral stance,
 * apply the pose, then layer the flinch/attack-swing/death overlays.
 */
export function updatePlayerAnimation(view: PlayerView, input: PlayerAnimInput): void {
  const { body, head, leftArm, rightArm, leftLeg, rightLeg } = view
  const { pose, now, tickPhase, yaw, flinch, death, attackSwing } = input

  // Neutral stance.
  body.position.set(0, 0, 0)
  body.rotation.set(0, yaw, 0)
  head.rotation.set(0, 0, 0)
  leftArm.rotation.set(0, 0, 0.05)
  rightArm.rotation.set(0, 0, -0.05)
  leftLeg.rotation.set(0, 0, 0)
  rightLeg.rotation.set(0, 0, 0)

  switch (pose) {
    case 'idle': {
      // Subtle breathing: body bob + arms drifting slightly outward.
      body.position.y = swing(now, 2800, 0.014)
      const breathe = swing(now, 2800, 0.03)
      leftArm.rotation.z = 0.06 + breathe
      rightArm.rotation.z = -0.06 - breathe
      break
    }
    case 'walk': {
      // One stride per tile (600ms tick); bob at double stride frequency.
      const stride = swing(now, 600, 0.6)
      leftLeg.rotation.x = stride
      rightLeg.rotation.x = -stride
      leftArm.rotation.x = -stride * 0.7
      rightArm.rotation.x = stride * 0.7
      body.position.y = Math.abs(swing(now, 300, 0.03))
      break
    }
    case 'chop': {
      // Tick-synced overhead swing (woodcutting/mining): raised at the tick
      // boundary, striking down early in the tick, then winding back up.
      const hit = strike(tickPhase, 0.3)
      rightArm.rotation.x = -2.2 + 1.6 * hit
      leftArm.rotation.x = -0.4 - 0.3 * hit
      body.rotation.x = 0.12 * hit
      break
    }
    case 'fish': {
      // Holding a rod out over the water with a patient bob.
      rightArm.rotation.x = -1.15 + swing(now, 1600, 0.07)
      leftArm.rotation.x = -0.85 + swing(now, 1600, 0.07, 0.8)
      body.rotation.x = 0.06
      body.position.y = swing(now, 1600, 0.012)
      break
    }
    case 'firemaking': {
      // Crouch low and rub hands together quickly over the logs.
      body.position.y = -0.18
      leftLeg.rotation.x = -1.15
      rightLeg.rotation.x = -1.15
      body.rotation.x = 0.22
      const rub = swing(now, 220, 0.16)
      leftArm.rotation.x = -0.85 + rub
      rightArm.rotation.x = -0.85 - rub
      break
    }
    case 'cook': {
      // Lean over the heat, right arm stirring in a slow circle.
      body.rotation.x = 0.15
      rightArm.rotation.x = -1.0 + swing(now, 900, 0.25)
      rightArm.rotation.z = -0.15 + swing(now, 900, 0.25, Math.PI / 2)
      leftArm.rotation.x = -0.3
      break
    }
    case 'bank': {
      // Lean over the booth/item, hands forward, small head nod.
      body.rotation.x = 0.18
      leftArm.rotation.x = -0.75
      rightArm.rotation.x = -0.75
      head.rotation.x = 0.15 + swing(now, 1300, 0.07)
      break
    }
    case 'combat': {
      // Guard stance with a light bounce; the actual hit is the
      // attack-swing overlay below.
      leftArm.rotation.x = -0.55
      rightArm.rotation.x = -0.95
      leftLeg.rotation.x = 0.12
      rightLeg.rotation.x = -0.12
      body.position.y = Math.abs(swing(now, 500, 0.02))
      break
    }
    case 'death':
      break // Fully handled by the death overlay below.
  }

  // Attack swing overlay: weapon arm whips down and the body lunges at the
  // facing direction (triggered by the player's damageDealt events).
  if (attackSwing < 1 && (pose === 'combat' || pose === 'walk')) {
    const hit = strike(attackSwing, 0.35)
    rightArm.rotation.x = -2.1 + 1.9 * strike(attackSwing, 0.25)
    body.position.x += Math.sin(yaw) * 0.14 * hit
    body.position.z += Math.cos(yaw) * 0.14 * hit
  }

  // Flinch overlay: jerk backward + red flash while `flinch` decays.
  if (flinch > 0) {
    body.rotation.x -= 0.22 * flinch
    body.position.x -= Math.sin(yaw) * 0.06 * flinch
    body.position.z -= Math.cos(yaw) * 0.06 * flinch
  }
  for (const material of view.materials) {
    material.emissive.setRGB(0.65 * flinch, 0, 0)
  }

  // Death overlay: fall onto the back and sink slightly.
  if (death > 0) {
    body.rotation.x = (-Math.PI / 2) * death
    body.position.y = -0.12 * death
    leftArm.rotation.set(0, 0, 0.5 * death)
    rightArm.rotation.set(0, 0, -0.5 * death)
  }
}

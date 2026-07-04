// NPC visual dispatcher: picks the per-id variant mesh (falling back to a
// purple humanoid capsule for unknown ids) and attaches the health bar.
//
// Every variant is articulated the same way: a `body` group (rotation order
// YXZ so pitches/leans happen along the facing direction) holding the parts,
// a species-specific `pose` function that resets the parts and applies the
// stance for this frame, and dedicated (uncached) materials for the red
// damage flash. `updateNpcAnimation` orchestrates: facing + species pose,
// then the shared attack-lunge / flinch / death overlays.
import * as THREE from 'three'
import type { Npc } from '../../engine'
import { strike, swing } from './animation'
import { createChickenMesh } from './chickenMesh'
import { createCowMesh } from './cowMesh'
import { createGiantRatMesh } from './giantRatMesh'
import { createGoblinMesh } from './goblinMesh'
import { createHealthBar } from './healthBar'
import { tileGroup, type SpriteResources } from './resources'

const NPC_FALLBACK = 0xc678dd

/** Visual stance the renderer picked from engine state. */
export type NpcPose = 'idle' | 'walk' | 'combat' | 'death'

/** Per-frame animation input, all purely visual (see renderer.ts). */
export interface NpcAnimInput {
  pose: NpcPose
  /** performance.now() timestamp of this frame. */
  now: number
  /** 0..1 progress through the current engine tick (tick-synced strides). */
  tickPhase: number
  /** Smoothed facing yaw in radians (+Z-facing model). */
  yaw: number
  /** 1 right after taking damage, decaying to 0 (flinch + red flash). */
  flinch: number
  /** 0..1 progress of the death fall, 0 while alive. */
  death: number
  /** 0..1 progress of this NPC's own attack lunge, 1 when finished. */
  attackSwing: number
}

/** Articulated body a species factory returns. */
export interface NpcVariant {
  /** Facing + whole-body offsets (bob, lunge, fall) go on this group. */
  body: THREE.Group
  /** How high above the ground the health bar floats. */
  barHeight: number
  /** Dedicated materials, tinted red for the damage flash. */
  materials: THREE.MeshLambertMaterial[]
  /** Reset the parts to neutral and apply the species stance for a frame. */
  pose: (input: NpcAnimInput) => void
}

/** Full per-NPC view: meshes plus the renderer's visual animation state. */
export interface NpcView {
  group: THREE.Group
  hpBar: THREE.Group
  hpFill: THREE.Mesh
  body: THREE.Group
  materials: THREE.MeshLambertMaterial[]
  pose: (input: NpcAnimInput) => void
  // Mutable per-NPC animation state, owned and driven by the renderer.
  yaw: number
  lastHurtAt: number
  lastAttackAt: number
  diedAt: number
}

/** A body group with YXZ rotation order (yaw first, then pitch/roll). */
export function npcBody(): THREE.Group {
  const body = new THREE.Group()
  body.rotation.order = 'YXZ'
  return body
}

/**
 * A limb: a pivot group at the joint with the limb box hanging down.
 * Rotate the pivot's x to stride, z to splay.
 */
export function limb(
  res: SpriteResources,
  material: THREE.Material,
  width: number,
  length: number,
  x: number,
  jointY: number,
  z = 0,
): THREE.Group {
  const pivot = new THREE.Group()
  pivot.position.set(x, jointY, z)
  const mesh = new THREE.Mesh(res.geo(new THREE.BoxGeometry(width, length, width)), material)
  mesh.position.y = -length / 2
  pivot.add(mesh)
  return pivot
}

let fallbackSeq = 0

function createFallbackMesh(res: SpriteResources): NpcVariant {
  const body = npcBody()
  const material = new THREE.MeshLambertMaterial({ color: NPC_FALLBACK })
  res.trackMaterial(`npc:fallback:${fallbackSeq++}`, material)
  const capsule = new THREE.Mesh(res.geo(new THREE.CapsuleGeometry(0.2, 0.4, 4, 10)), material)
  capsule.position.y = 0.42
  body.add(capsule)
  return {
    body,
    barHeight: 1,
    materials: [material],
    pose: ({ now, pose }) => {
      body.position.y = pose === 'walk' ? Math.abs(swing(now, 300, 0.04)) : swing(now, 2800, 0.014)
    },
  }
}

function createVariant(res: SpriteResources, npcId: string): NpcVariant {
  switch (npcId) {
    case 'chicken':
      return createChickenMesh(res)
    case 'cow':
      return createCowMesh(res)
    case 'giant_rat':
      return createGiantRatMesh(res)
    case 'goblin':
      return createGoblinMesh(res)
    default:
      return createFallbackMesh(res)
  }
}

/** Full NPC view: picking-tagged tile group + body + billboarded hp bar. */
export function createNpcMesh(res: SpriteResources, npc: Npc): NpcView {
  const group = tileGroup(npc.x, npc.y)
  const { body, barHeight, materials, pose } = createVariant(res, npc.def.id)
  group.add(body)
  // The hp bar hangs off the outer group so it stays upright during falls.
  const { hpBar, hpFill } = createHealthBar(res, barHeight)
  group.add(hpBar)
  return {
    group,
    hpBar,
    hpFill,
    body,
    materials,
    pose,
    yaw: Math.PI,
    lastHurtAt: -Infinity,
    lastAttackAt: -Infinity,
    diedAt: -Infinity,
  }
}

/**
 * Drive one NPC's skeleton for a frame: facing, species pose, then the
 * shared overlays (attack lunge toward the facing direction, flinch jerk +
 * red flash, death keel-over + sink). Mirrors updatePlayerAnimation.
 */
export function updateNpcAnimation(view: NpcView, input: NpcAnimInput): void {
  const { body } = view
  const { pose, yaw, flinch, death, attackSwing } = input

  body.position.set(0, 0, 0)
  body.rotation.set(0, yaw, 0)
  view.pose(input)

  // Attack lunge overlay: hop toward the target and pitch into the blow.
  if (attackSwing < 1 && pose !== 'death') {
    const hit = strike(attackSwing, 0.3)
    body.position.x += Math.sin(yaw) * 0.18 * hit
    body.position.z += Math.cos(yaw) * 0.18 * hit
    body.rotation.x += 0.3 * hit
  }

  // Flinch overlay: jerk backward + red flash while `flinch` decays.
  if (flinch > 0) {
    body.rotation.x -= 0.18 * flinch
    body.position.x -= Math.sin(yaw) * 0.06 * flinch
    body.position.z -= Math.cos(yaw) * 0.06 * flinch
  }
  for (const material of view.materials) {
    material.emissive.setRGB(0.65 * flinch, 0, 0)
  }

  // Death overlay: keel over sideways and sink a little before despawning.
  if (death > 0) {
    body.rotation.z = (Math.PI / 2) * death
    body.position.y -= 0.1 * death
  }
}

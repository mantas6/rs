// Chicken: plump off-white body with a pecking head (beak + comb) on a neck
// pivot, two flappable wing pivots and stick legs. Pecks while idle, jerks
// its head while strutting, and flaps furiously in combat.
import * as THREE from 'three'
import { clamp01, strike, swing } from './animation'
import { limb, npcBody, type NpcVariant } from './npcMesh'
import type { SpriteResources } from './resources'

const CHICKEN_BODY = 0xf5f0e6
const CHICKEN_BEAK = 0xe8a33d
const CHICKEN_COMB = 0xc0392b

/** Idle peck cycle: one quick peck at the start of every period. */
const PECK_PERIOD_MS = 2600
const PECK_PORTION = 0.22

let seq = 0

export function createChickenMesh(res: SpriteResources): NpcVariant {
  const id = `npc:chicken:${seq++}`
  const body = npcBody()

  const bodyMat = new THREE.MeshLambertMaterial({ color: CHICKEN_BODY })
  const beakMat = new THREE.MeshLambertMaterial({ color: CHICKEN_BEAK })
  const combMat = new THREE.MeshLambertMaterial({ color: CHICKEN_COMB })
  res.trackMaterial(`${id}:body`, bodyMat)
  res.trackMaterial(`${id}:beak`, beakMat)
  res.trackMaterial(`${id}:comb`, combMat)

  const trunk = new THREE.Mesh(res.geo(new THREE.BoxGeometry(0.24, 0.22, 0.32)), bodyMat)
  trunk.position.set(0, 0.24, -0.02)
  body.add(trunk)

  // Head on a neck pivot at the front; rotating x pecks, moving z jerks.
  const headPivot = new THREE.Group()
  headPivot.position.set(0, 0.36, 0.1)
  const head = new THREE.Mesh(res.geo(new THREE.BoxGeometry(0.13, 0.14, 0.13)), bodyMat)
  head.position.set(0, 0.08, 0.03)
  headPivot.add(head)
  const beak = new THREE.Mesh(res.geo(new THREE.ConeGeometry(0.035, 0.09, 4)), beakMat)
  beak.position.set(0, 0.07, 0.13)
  beak.rotation.x = Math.PI / 2
  headPivot.add(beak)
  const comb = new THREE.Mesh(res.geo(new THREE.BoxGeometry(0.04, 0.06, 0.08)), combMat)
  comb.position.set(0, 0.18, 0.02)
  headPivot.add(comb)
  body.add(headPivot)

  // Wings: thin slabs on shoulder pivots; rotating z lifts them outward.
  const wingGeo = res.geo(new THREE.BoxGeometry(0.04, 0.14, 0.24))
  const wings: THREE.Group[] = []
  for (const side of [-1, 1]) {
    const wing = new THREE.Group()
    wing.position.set(side * 0.13, 0.3, -0.02)
    const slab = new THREE.Mesh(wingGeo, bodyMat)
    slab.position.set(side * 0.02, -0.07, 0)
    wing.add(slab)
    wings.push(wing)
    body.add(wing)
  }
  const [leftWing, rightWing] = wings

  const leftLeg = limb(res, beakMat, 0.03, 0.13, -0.06, 0.13)
  const rightLeg = limb(res, beakMat, 0.03, 0.13, 0.06, 0.13)
  body.add(leftLeg, rightLeg)

  return {
    body,
    barHeight: 0.6,
    materials: [bodyMat, beakMat, combMat],
    pose: ({ pose, now }) => {
      headPivot.rotation.set(0, 0, 0)
      headPivot.position.z = 0.1
      leftWing.rotation.set(0, 0, 0)
      rightWing.rotation.set(0, 0, 0)
      leftLeg.rotation.set(0, 0, 0)
      rightLeg.rotation.set(0, 0, 0)

      switch (pose) {
        case 'idle': {
          // Bob gently, then dart the head down for a quick ground peck at
          // the start of each cycle.
          body.position.y = swing(now, 2200, 0.008)
          const cycle = (now % PECK_PERIOD_MS) / PECK_PERIOD_MS
          const peck = strike(clamp01(cycle / PECK_PORTION), 0.45)
          headPivot.rotation.x = 1.1 * peck
          headPivot.position.z = 0.1 + 0.05 * peck
          break
        }
        case 'walk': {
          // Strut: quick little steps with the classic head jerk.
          const stride = swing(now, 300, 0.6)
          leftLeg.rotation.x = stride
          rightLeg.rotation.x = -stride
          headPivot.position.z = 0.1 + Math.abs(swing(now, 300, 0.05))
          body.position.y = Math.abs(swing(now, 300, 0.015))
          break
        }
        case 'combat': {
          // Squawking flurry: wings beat outward, head thrust forward.
          const flap = 0.7 + swing(now, 260, 0.55)
          leftWing.rotation.z = flap
          rightWing.rotation.z = -flap
          headPivot.rotation.x = 0.35
          headPivot.position.z = 0.14
          body.position.y = Math.abs(swing(now, 260, 0.03))
          break
        }
        case 'death':
          // Wings splay flat; the fall is the shared death overlay.
          leftWing.rotation.z = 1.3
          rightWing.rotation.z = -1.3
          headPivot.rotation.x = 0.8
          break
      }
    },
  }
}

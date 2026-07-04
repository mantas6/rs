// Cow: brown quadruped — body box with a cream patch, head on a neck pivot
// (sways when idle, lowers to headbutt in combat), swishing tail and four
// leg pivots striding in diagonal pairs.
import * as THREE from 'three'
import { swing } from './animation'
import { limb, npcBody, type NpcVariant } from './npcMesh'
import type { SpriteResources } from './resources'

const COW_HIDE = 0x8d6e63
const COW_PATCH = 0xf5f0e6

/** Shoulder/hip joint height; legs hang down to the ground from here. */
const JOINT_Y = 0.34

let seq = 0

export function createCowMesh(res: SpriteResources): NpcVariant {
  const id = `npc:cow:${seq++}`
  const body = npcBody()

  const hideMat = new THREE.MeshLambertMaterial({ color: COW_HIDE })
  const patchMat = new THREE.MeshLambertMaterial({ color: COW_PATCH })
  res.trackMaterial(`${id}:hide`, hideMat)
  res.trackMaterial(`${id}:patch`, patchMat)

  const trunk = new THREE.Mesh(res.geo(new THREE.BoxGeometry(0.44, 0.34, 0.7)), hideMat)
  trunk.position.y = 0.5
  body.add(trunk)
  const patch = new THREE.Mesh(res.geo(new THREE.BoxGeometry(0.46, 0.18, 0.3)), patchMat)
  patch.position.set(0, 0.56, -0.12)
  body.add(patch)

  // Head on a neck pivot at the front of the trunk (+Z is forward).
  const headPivot = new THREE.Group()
  headPivot.position.set(0, 0.58, 0.32)
  const head = new THREE.Mesh(res.geo(new THREE.BoxGeometry(0.22, 0.22, 0.24)), patchMat)
  head.position.set(0, 0, 0.13)
  headPivot.add(head)
  const hornGeo = res.geo(new THREE.BoxGeometry(0.05, 0.05, 0.12))
  for (const side of [-1, 1]) {
    const horn = new THREE.Mesh(hornGeo, patchMat)
    horn.position.set(side * 0.12, 0.1, 0.1)
    headPivot.add(horn)
  }
  body.add(headPivot)

  // Tail pivot at the rear, hanging down.
  const tail = new THREE.Group()
  tail.position.set(0, 0.62, -0.35)
  const tailMesh = new THREE.Mesh(res.geo(new THREE.BoxGeometry(0.05, 0.3, 0.05)), hideMat)
  tailMesh.position.y = -0.15
  tail.add(tailMesh)
  body.add(tail)

  const frontLeft = limb(res, hideMat, 0.1, JOINT_Y, -0.15, JOINT_Y, 0.24)
  const frontRight = limb(res, hideMat, 0.1, JOINT_Y, 0.15, JOINT_Y, 0.24)
  const backLeft = limb(res, hideMat, 0.1, JOINT_Y, -0.15, JOINT_Y, -0.24)
  const backRight = limb(res, hideMat, 0.1, JOINT_Y, 0.15, JOINT_Y, -0.24)
  body.add(frontLeft, frontRight, backLeft, backRight)

  return {
    body,
    barHeight: 0.95,
    materials: [hideMat, patchMat],
    pose: ({ pose, now }) => {
      headPivot.rotation.set(0, 0, 0)
      tail.rotation.set(0, 0, 0)
      frontLeft.rotation.set(0, 0, 0)
      frontRight.rotation.set(0, 0, 0)
      backLeft.rotation.set(0, 0, 0)
      backRight.rotation.set(0, 0, 0)

      switch (pose) {
        case 'idle': {
          // Grazing sway: head drifts side to side and dips; tail swishes.
          headPivot.rotation.y = swing(now, 3400, 0.25)
          headPivot.rotation.x = 0.15 + swing(now, 3400, 0.1, Math.PI / 2)
          tail.rotation.z = swing(now, 1900, 0.35)
          body.position.y = swing(now, 3000, 0.008)
          break
        }
        case 'walk': {
          // Diagonal leg pairs, one stride per tile; gentle head nod.
          const stride = swing(now, 600, 0.5)
          frontLeft.rotation.x = stride
          backRight.rotation.x = stride
          frontRight.rotation.x = -stride
          backLeft.rotation.x = -stride
          headPivot.rotation.x = swing(now, 600, 0.06)
          body.position.y = Math.abs(swing(now, 300, 0.02))
          break
        }
        case 'combat': {
          // Head lowered to headbutt, tail flicking fast, front hoof pawing.
          headPivot.rotation.x = 0.55 + swing(now, 700, 0.06)
          tail.rotation.z = swing(now, 700, 0.5)
          frontRight.rotation.x = 0.2 + swing(now, 700, 0.2)
          break
        }
        case 'death':
          // Head and tail go limp; the fall is the shared death overlay.
          headPivot.rotation.x = 0.5
          tail.rotation.z = 0.3
          break
      }
    },
  }
}

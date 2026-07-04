// Goblin: small green humanoid — rag-clad torso, round head with pointy
// ears, and arm/leg pivot groups so it can stride, guard and swing.
import * as THREE from 'three'
import { strike, swing } from './animation'
import { limb, npcBody, type NpcVariant } from './npcMesh'
import type { SpriteResources } from './resources'

const GOBLIN_SKIN = 0x6ab04c
const GOBLIN_RAGS = 0x7a5c3e

const HIP_Y = 0.3
const SHOULDER_Y = 0.56

let seq = 0

export function createGoblinMesh(res: SpriteResources): NpcVariant {
  const id = `npc:goblin:${seq++}`
  const body = npcBody()

  // Dedicated materials so the red damage flash never tints shared sprites.
  const skinMat = new THREE.MeshLambertMaterial({ color: GOBLIN_SKIN })
  const ragsMat = new THREE.MeshLambertMaterial({ color: GOBLIN_RAGS })
  res.trackMaterial(`${id}:skin`, skinMat)
  res.trackMaterial(`${id}:rags`, ragsMat)

  const torso = new THREE.Mesh(res.geo(new THREE.BoxGeometry(0.26, 0.3, 0.16)), ragsMat)
  torso.position.y = (HIP_Y + SHOULDER_Y) / 2 + 0.01
  body.add(torso)

  const head = new THREE.Mesh(res.geo(new THREE.SphereGeometry(0.12, 10, 10)), skinMat)
  head.position.y = SHOULDER_Y + 0.14
  body.add(head)
  const earGeo = res.geo(new THREE.ConeGeometry(0.045, 0.14, 4))
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(earGeo, skinMat)
    ear.position.set(side * 0.13, SHOULDER_Y + 0.18, 0)
    ear.rotation.z = side * -0.9
    body.add(ear)
  }

  const leftArm = limb(res, skinMat, 0.07, 0.28, -0.165, SHOULDER_Y)
  const rightArm = limb(res, skinMat, 0.07, 0.28, 0.165, SHOULDER_Y)
  const leftLeg = limb(res, skinMat, 0.09, 0.3, -0.07, HIP_Y)
  const rightLeg = limb(res, skinMat, 0.09, 0.3, 0.07, HIP_Y)
  body.add(leftArm, rightArm, leftLeg, rightLeg)

  return {
    body,
    barHeight: 0.85,
    materials: [skinMat, ragsMat],
    pose: ({ pose, now, attackSwing }) => {
      // Neutral stance.
      leftArm.rotation.set(0, 0, 0.08)
      rightArm.rotation.set(0, 0, -0.08)
      leftLeg.rotation.set(0, 0, 0)
      rightLeg.rotation.set(0, 0, 0)

      switch (pose) {
        case 'idle': {
          // Hunched breathing bob, arms drifting outward.
          body.position.y = swing(now, 2600, 0.012)
          const breathe = swing(now, 2600, 0.04)
          leftArm.rotation.z = 0.1 + breathe
          rightArm.rotation.z = -0.1 - breathe
          break
        }
        case 'walk': {
          // One scampering stride per tile (600ms tick).
          const stride = swing(now, 600, 0.7)
          leftLeg.rotation.x = stride
          rightLeg.rotation.x = -stride
          leftArm.rotation.x = -stride * 0.8
          rightArm.rotation.x = stride * 0.8
          body.position.y = Math.abs(swing(now, 300, 0.03))
          break
        }
        case 'combat': {
          // Crouched guard, fists up, bouncing on its toes; the shared
          // lunge overlay carries the actual blow.
          leftArm.rotation.x = -0.7
          rightArm.rotation.x = -1.0
          leftLeg.rotation.x = 0.15
          rightLeg.rotation.x = -0.15
          body.position.y = Math.abs(swing(now, 450, 0.025))
          if (attackSwing < 1) {
            rightArm.rotation.x = -1.9 + 1.7 * strike(attackSwing, 0.25)
          }
          break
        }
        case 'death':
          // Arms splay out; the fall itself is the shared death overlay.
          leftArm.rotation.z = 0.6
          rightArm.rotation.z = -0.6
          break
      }
    },
  }
}

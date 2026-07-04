// Giant rat: long low gray quadruped — snout + ears on a head pivot that
// sniffs while idle, a long swaying tail and four stubby leg pivots that
// scurry double-time. Rears up when fighting.
import * as THREE from 'three'
import { swing } from './animation'
import { limb, npcBody, type NpcVariant } from './npcMesh'
import type { SpriteResources } from './resources'

const RAT_FUR = 0x8d8d8d
const RAT_SKIN = 0xb98a7c

let seq = 0

export function createGiantRatMesh(res: SpriteResources): NpcVariant {
  const id = `npc:giant_rat:${seq++}`
  const body = npcBody()

  const furMat = new THREE.MeshLambertMaterial({ color: RAT_FUR })
  const skinMat = new THREE.MeshLambertMaterial({ color: RAT_SKIN })
  res.trackMaterial(`${id}:fur`, furMat)
  res.trackMaterial(`${id}:skin`, skinMat)

  const trunk = new THREE.Mesh(res.geo(new THREE.BoxGeometry(0.32, 0.24, 0.52)), furMat)
  trunk.position.set(0, 0.22, -0.04)
  body.add(trunk)

  // Head pivot at the front: snout box + cone nose + round ears.
  const headPivot = new THREE.Group()
  headPivot.position.set(0, 0.26, 0.22)
  const snout = new THREE.Mesh(res.geo(new THREE.BoxGeometry(0.18, 0.16, 0.2)), furMat)
  snout.position.set(0, 0, 0.08)
  headPivot.add(snout)
  const nose = new THREE.Mesh(res.geo(new THREE.ConeGeometry(0.055, 0.14, 4)), skinMat)
  nose.position.set(0, -0.02, 0.22)
  nose.rotation.x = Math.PI / 2
  headPivot.add(nose)
  const earGeo = res.geo(new THREE.SphereGeometry(0.05, 8, 8))
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(earGeo, skinMat)
    ear.position.set(side * 0.09, 0.1, 0.02)
    headPivot.add(ear)
  }
  body.add(headPivot)

  // Long tail pivot at the rear, pointing backward; rotating y sways it.
  const tail = new THREE.Group()
  tail.position.set(0, 0.16, -0.28)
  const tailMesh = new THREE.Mesh(res.geo(new THREE.BoxGeometry(0.035, 0.035, 0.42)), skinMat)
  tailMesh.position.z = -0.21
  tail.add(tailMesh)
  body.add(tail)

  const frontLeft = limb(res, furMat, 0.06, 0.12, -0.13, 0.12, 0.16)
  const frontRight = limb(res, furMat, 0.06, 0.12, 0.13, 0.12, 0.16)
  const backLeft = limb(res, furMat, 0.06, 0.12, -0.13, 0.12, -0.18)
  const backRight = limb(res, furMat, 0.06, 0.12, 0.13, 0.12, -0.18)
  body.add(frontLeft, frontRight, backLeft, backRight)

  return {
    body,
    barHeight: 0.55,
    materials: [furMat, skinMat],
    pose: ({ pose, now }) => {
      headPivot.rotation.set(0, 0, 0)
      tail.rotation.set(0, 0, 0)
      frontLeft.rotation.set(0, 0, 0)
      frontRight.rotation.set(0, 0, 0)
      backLeft.rotation.set(0, 0, 0)
      backRight.rotation.set(0, 0, 0)

      switch (pose) {
        case 'idle': {
          // Sniffing: quick little nose bobs; tail sweeps slowly.
          headPivot.rotation.x = -0.08 + swing(now, 450, 0.07)
          tail.rotation.y = swing(now, 2400, 0.4)
          body.position.y = swing(now, 2400, 0.006)
          break
        }
        case 'walk': {
          // Scurry: diagonal pairs at double time, tail streaming behind.
          const stride = swing(now, 300, 0.8)
          frontLeft.rotation.x = stride
          backRight.rotation.x = stride
          frontRight.rotation.x = -stride
          backLeft.rotation.x = -stride
          tail.rotation.y = swing(now, 600, 0.25)
          body.position.y = Math.abs(swing(now, 150, 0.012))
          break
        }
        case 'combat': {
          // Reared up on hind legs, forepaws raised, tail lashing.
          body.rotation.x -= 0.35
          body.position.y += 0.06
          frontLeft.rotation.x = -1.1
          frontRight.rotation.x = -1.1
          headPivot.rotation.x = 0.3 + swing(now, 500, 0.05)
          tail.rotation.y = swing(now, 800, 0.6)
          break
        }
        case 'death':
          // Limp: nose drops, tail flat; the fall is the shared overlay.
          headPivot.rotation.x = 0.4
          break
      }
    },
  }
}

// Terrain: walkable tiles as an instanced checkerboard of planes, blocked
// tiles as an instanced field of gray boxes. The instance-index → tile
// arrays let the renderer map raycast hits back to map coordinates.
import * as THREE from 'three'
import type { World } from '../../engine'
import type { SpriteResources, TilePos } from './resources'

const GRASS_A = 0x3d5c33
const GRASS_B = 0x38552f
const BLOCKED = 0x2c3540

export interface GroundTiles {
  groundMesh: THREE.InstancedMesh
  blockedMesh: THREE.InstancedMesh
  groundTiles: TilePos[]
  blockedTiles: TilePos[]
}

/** Walkable tiles: instanced checkerboard planes. Blocked: gray boxes. */
export function createGroundTiles(res: SpriteResources, world: World): GroundTiles {
  const walk: TilePos[] = []
  const block: TilePos[] = []
  for (let y = 0; y < world.height; y++) {
    for (let x = 0; x < world.width; x++) {
      // Node/object tiles render as grass too (the mesh sits on top).
      if (world.isWalkable(x, y) || world.nodeAt(x, y) || world.objectAt(x, y)) {
        walk.push({ x, y })
      } else {
        block.push({ x, y })
      }
    }
  }

  const plane = res.geo(new THREE.PlaneGeometry(1, 1))
  plane.rotateX(-Math.PI / 2)
  const groundMesh = new THREE.InstancedMesh(
    plane,
    new THREE.MeshLambertMaterial({ color: 0xffffff }),
    walk.length,
  )
  const m = new THREE.Matrix4()
  const color = new THREE.Color()
  walk.forEach((tile, i) => {
    m.setPosition(tile.x + 0.5, 0, tile.y + 0.5)
    groundMesh.setMatrixAt(i, m)
    groundMesh.setColorAt(i, color.setHex((tile.x + tile.y) % 2 === 0 ? GRASS_A : GRASS_B))
  })

  const box = res.geo(new THREE.BoxGeometry(1, 0.8, 1))
  const blockedMesh = new THREE.InstancedMesh(
    box,
    new THREE.MeshLambertMaterial({ color: BLOCKED }),
    block.length,
  )
  block.forEach((tile, i) => {
    m.setPosition(tile.x + 0.5, 0.4, tile.y + 0.5)
    blockedMesh.setMatrixAt(i, m)
  })

  // Material of the instanced meshes is not created via res.mat; track it.
  res.trackMaterial('ground', groundMesh.material as THREE.Material)
  res.trackMaterial('blocked', blockedMesh.material as THREE.Material)

  return { groundMesh, blockedMesh, groundTiles: walk, blockedTiles: block }
}

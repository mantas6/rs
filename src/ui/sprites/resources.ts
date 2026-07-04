// Shared GPU-resource bookkeeping for the sprite factories. Every geometry
// and material created through a SpriteResources instance is tracked so a
// single dispose() call frees all GPU memory when the renderer unmounts.
import * as THREE from 'three'

/** A map tile position (matches the renderer's `Hover` shape). */
export interface TilePos {
  x: number
  y: number
}

export class SpriteResources {
  private readonly geometries: THREE.BufferGeometry[] = []
  private readonly materialCache = new Map<string, THREE.Material>()

  /** Track a geometry so dispose() can free it. */
  geo<T extends THREE.BufferGeometry>(geometry: T): T {
    this.geometries.push(geometry)
    return geometry
  }

  /** Cached Lambert material per color/options (freed in dispose). */
  mat(color: number, opts?: { transparent?: boolean; opacity?: number }): THREE.Material {
    const key = `${color}:${opts?.opacity ?? 1}`
    let material = this.materialCache.get(key)
    if (!material) {
      material = new THREE.MeshLambertMaterial({
        color,
        transparent: opts?.transparent ?? false,
        opacity: opts?.opacity ?? 1,
      })
      this.materialCache.set(key, material)
    }
    return material
  }

  /** Track a material created outside `mat` (instanced/line materials). */
  trackMaterial(key: string, material: THREE.Material): void {
    this.materialCache.set(key, material)
  }

  /** A mesh with a cached Lambert material, lifted to the given height. */
  mesh(geometry: THREE.BufferGeometry, color: number, y: number): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, this.mat(color))
    mesh.position.y = y
    return mesh
  }

  /** Free every tracked geometry and material. */
  dispose(): void {
    for (const geometry of this.geometries) geometry.dispose()
    for (const material of this.materialCache.values()) material.dispose()
  }
}

/** A group parked on a tile center, tagged with the tile for picking. */
export function tileGroup(x: number, y: number): THREE.Group {
  const group = new THREE.Group()
  group.position.set(x + 0.5, 0, y + 0.5)
  group.userData.tile = { x, y }
  return group
}

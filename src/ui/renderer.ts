// Pure canvas renderer: reads engine state and draws it. No game logic and
// no React here — GameCanvas.tsx owns the <canvas> element and calls
// renderGame once per tick (and on hover changes).
import type { NpcDef } from '../content/types'
import type { Game, Npc, ResourceNode } from '../engine'
import { getItemDef } from '../engine'

/** Tile size in pixels. */
export const TILE = 24
/** Canvas viewport size in pixels (30 x 20 tiles). */
export const VIEW_W = 720
export const VIEW_H = 480

/** Camera: pixel offset of the viewport's top-left inside the map. */
export interface Camera {
  x: number
  y: number
}

/** Hovered tile in map coordinates (null when the mouse is outside). */
export interface Hover {
  x: number
  y: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/** Camera centered on the player, clamped to the map edges. */
export function computeCamera(game: Game, viewW = VIEW_W, viewH = VIEW_H): Camera {
  const mapW = game.world.width * TILE
  const mapH = game.world.height * TILE
  return {
    x: clamp(game.player.x * TILE + TILE / 2 - viewW / 2, 0, Math.max(0, mapW - viewW)),
    y: clamp(game.player.y * TILE + TILE / 2 - viewH / 2, 0, Math.max(0, mapH - viewH)),
  }
}

/** Convert canvas pixel coordinates to a map tile under the camera. */
export function tileFromPixel(camera: Camera, px: number, py: number): { x: number; y: number } {
  return { x: Math.floor((px + camera.x) / TILE), y: Math.floor((py + camera.y) / TILE) }
}

/**
 * Approximate OSRS combat level for an NPC def (melee-only stats; ranged,
 * magic and prayer terms are omitted because NPCs have none here).
 */
export function npcCombatLevel(def: NpcDef): number {
  const c = def.combat
  const base = 0.25 * (c.defenceLevel + c.hitpoints)
  const melee = 0.325 * (c.attackLevel + c.strengthLevel)
  return Math.max(1, Math.floor(base + melee))
}

const NPC_COLORS: Record<string, string> = {
  goblin: '#6ab04c',
  cow: '#8d6e63',
  chicken: '#f5f0e6',
  giant_rat: '#8d8d8d',
}

const ORE_SPECKLE: Record<string, string> = {
  copper_rock: '#c97e3d',
  tin_rock: '#cfd4dc',
  iron_rock: '#a04a3c',
}

/** One-line description of what sits on a tile (hover tooltip), or null. */
export function describeTile(game: Game, x: number, y: number): string | null {
  const npc = game.npcs.find((n) => n.alive && n.x === x && n.y === y)
  if (npc) return `${npc.def.name} (level ${npcCombatLevel(npc.def)})`
  const node = game.world.nodeAt(x, y)
  if (node) return node.depleted ? `${node.def.name} (depleted)` : node.def.name
  const object = game.world.objectAt(x, y)
  if (object) return object.def.name
  const item = game.groundItems.itemsAt(x, y)[0]
  if (item) return `Take ${getItemDef(item.itemId).name}`
  if (game.fires.fireAt(x, y)) return 'Fire'
  return null
}

/** Draw the whole scene. Pure: reads game state, writes pixels, no ticks. */
export function renderGame(
  ctx: CanvasRenderingContext2D,
  game: Game,
  camera: Camera,
  hover: Hover | null,
): void {
  const viewW = ctx.canvas.width
  const viewH = ctx.canvas.height
  ctx.fillStyle = '#0d0b08'
  ctx.fillRect(0, 0, viewW, viewH)

  const x0 = Math.floor(camera.x / TILE)
  const y0 = Math.floor(camera.y / TILE)
  const x1 = Math.min(game.world.width - 1, Math.ceil((camera.x + viewW) / TILE))
  const y1 = Math.min(game.world.height - 1, Math.ceil((camera.y + viewH) / TILE))

  // Tiles: grass checkerboard for walkable, dark slate for blocked.
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const px = x * TILE - camera.x
      const py = y * TILE - camera.y
      if (game.world.isWalkable(x, y) || game.world.nodeAt(x, y) || game.world.objectAt(x, y)) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#3d5c33' : '#38552f'
      } else {
        ctx.fillStyle = '#2c3540'
      }
      ctx.fillRect(px, py, TILE, TILE)
    }
  }

  // Fires (under items/entities).
  for (const fire of game.fires.fires) {
    const cx = fire.position.x * TILE - camera.x + TILE / 2
    const cy = fire.position.y * TILE - camera.y + TILE / 2
    ctx.fillStyle = '#e25822'
    ctx.beginPath()
    ctx.arc(cx, cy, 7, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#ffb347'
    ctx.beginPath()
    ctx.arc(cx, cy, 3.5, 0, Math.PI * 2)
    ctx.fill()
  }

  // Ground items: yellow dots.
  for (const item of game.groundItems.items) {
    ctx.fillStyle = '#f4d03f'
    ctx.beginPath()
    ctx.arc(item.x * TILE - camera.x + TILE / 2, item.y * TILE - camera.y + TILE / 2, 4, 0, Math.PI * 2)
    ctx.fill()
  }

  // World objects: bank booth gold, cooking range dark red.
  for (const object of game.world.objects) {
    const px = object.position.x * TILE - camera.x
    const py = object.position.y * TILE - camera.y
    ctx.fillStyle = object.def.bank ? '#d4af37' : '#7a2318'
    ctx.fillRect(px + 3, py + 3, TILE - 6, TILE - 6)
    ctx.strokeStyle = '#1a140c'
    ctx.strokeRect(px + 3.5, py + 3.5, TILE - 7, TILE - 7)
  }

  // Resource nodes.
  for (const node of game.world.nodes) drawNode(ctx, node, camera)

  // NPCs (alive only), with a tiny hp bar when damaged.
  for (const npc of game.npcs) {
    if (npc.alive) drawNpc(ctx, npc, camera)
  }

  // Player: blue square with a white border.
  const ppx = game.player.x * TILE - camera.x
  const ppy = game.player.y * TILE - camera.y
  ctx.fillStyle = '#3b6ea5'
  ctx.fillRect(ppx + 4, ppy + 4, TILE - 8, TILE - 8)
  ctx.strokeStyle = '#ffffff'
  ctx.strokeRect(ppx + 4.5, ppy + 4.5, TILE - 9, TILE - 9)

  // Hover: tile highlight plus a name label above it.
  if (hover && game.world.inBounds(hover.x, hover.y)) {
    const hx = hover.x * TILE - camera.x
    const hy = hover.y * TILE - camera.y
    ctx.strokeStyle = '#f4d03f'
    ctx.strokeRect(hx + 0.5, hy + 0.5, TILE - 1, TILE - 1)
    const label = describeTile(game, hover.x, hover.y)
    if (label) {
      ctx.font = '12px system-ui, sans-serif'
      const width = ctx.measureText(label).width + 8
      const lx = clamp(hx + TILE / 2 - width / 2, 2, viewW - width - 2)
      const ly = Math.max(hy - 18, 2)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
      ctx.fillRect(lx, ly, width, 16)
      ctx.fillStyle = '#f4d03f'
      ctx.fillText(label, lx + 4, ly + 12)
    }
  }
}

function drawNode(ctx: CanvasRenderingContext2D, node: ResourceNode, camera: Camera): void {
  const cx = node.position.x * TILE - camera.x + TILE / 2
  const cy = node.position.y * TILE - camera.y + TILE / 2
  const skill = node.def.skill

  if (skill === 'woodcutting') {
    if (node.depleted) {
      // Stump: small brown circle.
      ctx.fillStyle = '#5d4030'
      ctx.beginPath()
      ctx.arc(cx, cy, 5, 0, Math.PI * 2)
      ctx.fill()
      return
    }
    ctx.fillStyle = node.def.id === 'oak_tree' ? '#1e5e2a' : '#2e7d32'
    ctx.beginPath()
    ctx.arc(cx, cy, 9, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#4e342e'
    ctx.fillRect(cx - 1.5, cy + 4, 3, 6)
    return
  }

  if (skill === 'mining') {
    ctx.fillStyle = node.depleted ? '#4c4c4c' : '#767676'
    ctx.beginPath()
    ctx.arc(cx, cy, 8, 0, Math.PI * 2)
    ctx.fill()
    if (!node.depleted) {
      ctx.fillStyle = ORE_SPECKLE[node.def.id] ?? '#ffffff'
      for (const [dx, dy] of [[-3, -2], [2, -3], [0, 2], [-2, 3], [4, 1]] as const) {
        ctx.fillRect(cx + dx, cy + dy, 2, 2)
      }
    }
    return
  }

  // Fishing spot: concentric blue ripples.
  ctx.strokeStyle = '#4fc3f7'
  for (const radius of [3, 6, 9]) {
    ctx.beginPath()
    ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    ctx.stroke()
  }
}

function drawNpc(ctx: CanvasRenderingContext2D, npc: Npc, camera: Camera): void {
  const px = npc.x * TILE - camera.x
  const py = npc.y * TILE - camera.y
  const size = npc.def.id === 'chicken' ? 10 : 14
  const offset = (TILE - size) / 2
  ctx.fillStyle = NPC_COLORS[npc.def.id] ?? '#c678dd'
  ctx.fillRect(px + offset, py + offset, size, size)
  if (npc.def.id === 'cow') {
    // White patch so cows read as brown/white.
    ctx.fillStyle = '#f5f0e6'
    ctx.fillRect(px + offset + 2, py + offset + 2, 5, 5)
  }
  const maxHp = npc.def.combat.hitpoints
  if (npc.currentHp < maxHp) {
    const barW = TILE - 6
    ctx.fillStyle = '#c0392b'
    ctx.fillRect(px + 3, py + 1, barW, 3)
    ctx.fillStyle = '#27ae60'
    ctx.fillRect(px + 3, py + 1, (barW * npc.currentHp) / maxHp, 3)
  }
}

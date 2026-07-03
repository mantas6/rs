/**
 * Stable per-item chip color for inventory/bank slots: hash the item id
 * into a hue so the same item always renders the same color.
 */
export function itemColor(itemId: string): string {
  let hash = 0
  for (let i = 0; i < itemId.length; i++) {
    hash = (hash * 31 + itemId.charCodeAt(i)) >>> 0
  }
  return `hsl(${hash % 360}, 42%, 62%)`
}

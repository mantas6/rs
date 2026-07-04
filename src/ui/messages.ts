// Message log store + engine-event-to-text translation. The store is a
// tiny external store (subscribe/getSnapshot) so MessageLog can use
// useSyncExternalStore; UI code may also push its own lines (examine,
// drop feedback, "can't reach that", ...).
import type { ActionFailReason, Game, SkillName } from '../engine'
import { getItemDef, getNpcDef, getResourceNodeDef } from '../engine'

/** Maximum number of retained log entries. */
export const MESSAGE_CAP = 100

export interface Message {
  id: number
  text: string
}

export class MessageStore {
  private _messages: readonly Message[] = []
  private nextId = 1
  private readonly listeners = new Set<() => void>()

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  readonly getSnapshot = (): readonly Message[] => this._messages

  push(text: string): void {
    const next = [...this._messages, { id: this.nextId++, text }]
    this._messages = next.length > MESSAGE_CAP ? next.slice(next.length - MESSAGE_CAP) : next
    for (const listener of [...this.listeners]) listener()
  }
}

const FAIL_MESSAGES: Record<ActionFailReason, string> = {
  level_too_low: "You don't have a high enough level to do that.",
  missing_tool: "You don't have the right tool for that.",
  inventory_full: "You don't have enough inventory space.",
  node_depleted: 'There is nothing left to gather here.',
  target_dead: 'That has already been killed.',
  missing_ingredient: "You don't have the required items.",
  cannot_light_here: "You can't light a fire here.",
  invalid_source: "You can't use that here.",
  bank_closed: 'You need to open the bank first.',
  shop_closed: 'You need to open the shop first.',
  item_not_stocked: "The shop doesn't stock that.",
  not_enough_coins: "You don't have enough coins to buy that.",
  not_food: "You can't eat that.",
}

const GATHER_VERBS: Record<string, (item: string) => string> = {
  woodcutting: (item) => `You get some ${item.toLowerCase()}.`,
  mining: (item) => `You manage to mine some ${item.toLowerCase()}.`,
  fishing: (item) => `You catch some ${item.toLowerCase().replace(/^raw /, '')}.`,
}

function skillTitle(skill: SkillName): string {
  return skill.charAt(0).toUpperCase() + skill.slice(1)
}

/**
 * Subscribe the store to engine events, translating them into OSRS-ish
 * log lines. Returns an unsubscribe-all cleanup function.
 */
export function connectGameMessages(game: Game, store: MessageStore): () => void {
  const unsubscribes = [
    game.events.on('resourceGathered', ({ nodeId, itemId }) => {
      const skill = getResourceNodeDef(nodeId).skill
      store.push(GATHER_VERBS[skill](getItemDef(itemId).name))
    }),
    game.events.on('levelUp', ({ skill, level }) => {
      store.push(
        `Congratulations, you just advanced a ${skillTitle(skill)} level. ` +
          `Your ${skillTitle(skill)} level is now ${level}.`,
      )
    }),
    game.events.on('itemCooked', ({ rawItemId, resultItemId, burnt }) => {
      store.push(
        burnt
          ? `You accidentally burn the ${getItemDef(rawItemId).name.toLowerCase()}.`
          : `You successfully cook the ${getItemDef(resultItemId).name.toLowerCase()}.`,
      )
    }),
    game.events.on('fireLit', () => {
      store.push('The fire catches and the logs begin to burn.')
    }),
    game.events.on('itemEaten', ({ itemId, healed }) => {
      const name = getItemDef(itemId).name.toLowerCase()
      store.push(healed > 0 ? `You eat the ${name}. It heals some health.` : `You eat the ${name}.`)
    }),
    game.events.on('itemDropped', ({ itemId }) => {
      store.push(`You drop the ${getItemDef(itemId).name.toLowerCase()}.`)
    }),
    game.events.on('itemBought', ({ itemId, quantity, cost }) => {
      const name = getItemDef(itemId).name.toLowerCase()
      const what = quantity > 1 ? `${quantity} x ${name}` : `a ${name}`
      store.push(cost > 0 ? `You buy ${what} for ${cost} coins.` : `You buy ${what}.`)
    }),
    game.events.on('npcDied', ({ npcId }) => {
      store.push(`You have defeated the ${getNpcDef(npcId).name.toLowerCase()}!`)
    }),
    game.events.on('playerDied', () => {
      store.push('Oh dear, you are dead!')
    }),
    game.events.on('actionFailed', ({ reason }) => {
      store.push(FAIL_MESSAGES[reason])
    }),
  ]
  return () => {
    for (const unsubscribe of unsubscribes) unsubscribe()
  }
}

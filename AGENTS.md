# RS Clone — Architecture Conventions

Singleplayer Old School RuneScape clone. Vite + React + Canvas + TypeScript (strict).

## Layout

```
src/
  engine/            Pure TS game engine (no React/DOM)
    core/            Game loop, tick scheduler, event bus, Rng
    world/           Tile map, pathfinding
    entities/        Player, NPC entities
    systems/         Skills, combat, gathering systems
    index.ts         Public engine API barrel — UI imports from here
  content/           Data-only definitions: items, npcs, resource nodes, maps
  ui/                React components + a single <canvas> renderer
```

## CRITICAL RULE: the engine is pure and deterministic

- `src/engine/` and `src/content/` are pure TypeScript. NO imports from
  `react`, DOM APIs, or `vite`. No `Date.now()`, no `Math.random()`.
- Use the engine's seedable `Rng` (src/engine/core/rng.ts) for all randomness
  and the tick counter for all timing. Same seed + same commands = same game.
- Everything in the engine must be drivable and testable headlessly: tests
  construct a `Game` and call `game.tick()` manually.

## Ticks

- The game runs on 600ms ticks (OSRS-style).
- The UI drives ticks in real time; tests drive ticks manually. Engine code
  never schedules its own timers.

## UI rules

- `src/ui/` is React plus a single `<canvas>` renderer that reads engine state.
- The UI never contains game logic. It only calls engine command APIs
  (e.g. `player.walkTo(...)`, `player.interact(...)`) and renders the result.

## Content rules

- `src/content/` holds data-only definitions (items, npcs, resource nodes,
  maps) as plain objects. No logic, no classes, no side effects.

## Testing

- Tests are colocated `*.test.ts` files next to the code under `src/`.
- Run with `npm test` (Vitest). `npm run test:watch` for watch mode.

## Naming

- PascalCase for classes and types, camelCase for functions.
- Files are `camelCase.ts` or `PascalCase.tsx`/`.ts` matching their main
  export (e.g. `rng.ts` exports `Rng` utilities, `App.tsx` exports `App`).
  No kebab-case files.

## Definition of done

Every task must pass `npm test` and `npm run build` before committing.

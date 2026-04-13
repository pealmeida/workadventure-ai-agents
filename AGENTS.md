# AGENTS.md - WorkAdventure Development Guide

## Quick Start
```bash
cp .env.template .env
docker-compose up
# Access: http://play.workadventure.localhost/_/global/maps.workadventure.localhost/starter/map.json
# Test user: User1 / pwd
```

## Build Order (CRITICAL)
1. **Messages first** - all services depend on generated protobuf types
   ```bash
   cd messages && npm install && npm run ts-proto
   ```
2. **Before building play** - generate i18n files:
   ```bash
   cd play && npm run typesafe-i18n
   ```

## Service Commands

| Service | Typecheck | Lint | Test | Prettier |
|---------|-----------|------|------|----------|
| `play/` | `npm run typecheck` | `npm run lint-fix` | `npm test -- --watch=false` | `npm run pretty` |
| `back/` | `npm run typecheck` | `npm run lint-fix` | `npm test -- --watch=false` | `npm run pretty` |
| `map-storage/` | `npm run typecheck` | `npm run lint-fix` | `npm test` | `npm run pretty` |
| `tests/` | - | `npm run lint-fix` | `npm run test-headed-chrome` | `npm run pretty` |

Additional checks for `play/`: `npm run svelte-check`

## Memory Issues
Build may fail with heap out of memory:
```bash
export NODE_OPTIONS=--max-old-space-size=16384
```

## Common Issues

**502 / Bad Gateway on `play.workadventure.localhost`** — Reverse-proxy targets may still be starting or unhealthy. Check `docker compose ps` and logs for `play`, `reverse-proxy`, and dependencies.

**Docker UI vs `play/` source** — Default compose runs `npm run dev` with the repo bind-mounted. The pusher prefers **`play/dist/public` only when `NODE_ENV=production`**; in development it serves root `index.html` (Vite) and `play/public` even if a stale `play/dist` exists from a local build. For a **production-style** play image or `npm run start`, rebuild so `dist` matches source.

**Windows PowerShell** — Windows PowerShell 5.x does not support `&&` like bash. Chain commands with `;`, use separate lines, or run **PowerShell 7+** (`pwsh`) where `&&` works.

**"Cannot find module 'ts-proto-generated'"** - Rebuild messages:
```bash
cd messages && npm run ts-proto
```

**Port conflicts** - Kill processes on ports 3000, 3001, 8080, 9229

## E2E Tests
Requires Docker running:
```bash
cd tests && npm run test-headed-chrome -- tests/<file>.ts
```

## Pre-commit
Husky runs automatically. Install hooks after first clone:
```bash
npm install
```

## Key Paths
- `play/src/front` - Svelte + Phaser frontend
- `play/src/pusher` - WebSocket server
- `back/src` - Backend API
- `messages/protos/` - .proto definitions
- `libs/` - Shared packages (messages, store-utils, map-editor, etc.)

**Architecture & how to extend UI** — See [`docs/developer/application-development-guide.md`](docs/developer/application-development-guide.md) (services map, Svelte/Phaser/pusher/back, finding components, stores, menus, checklists).

**Repo layout (folders & workspaces)** — See [`docs/developer/repository-sections-guide.md`](docs/developer/repository-sections-guide.md) (each major directory, editing vs creating packages/maps/services).

## Services with Custom Runners
- **desktop/** - Uses Yarn (not npm)
- **uploader/** - Uses Jest (not Vitest)

## I18n
Audit missing translations:
```bash
cd play && npm run i18n:diff
# Check specific locale:
cd play && npm run i18n:diff -- fr-FR
```
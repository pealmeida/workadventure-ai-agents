# AGENTS.md - WorkAdventure Development Guide

## Quick Start
```bash
cp .env.template .env
docker-compose up
# Access: http://play.workadventure.localhost
# Test user: User1 / pwd
```

## Build Order (CRITICAL)
1. **Always build messages first** - all services depend on generated protobuf types
   ```bash
   cd messages && npm install && npm run ts-proto
   ```
2. **Before building play** - generate i18n files:
   ```bash
   cd play && npm run typesafe-i18n
   ```

## Service Commands

| Service | Typecheck | Lint | Test | Build |
|---------|-----------|------|------|-------|
| `play/` | `npm run typecheck` | `npm run lint-fix` | `npm test` | `npm run build` |
| `back/` | `npm run typecheck` | `npm run lint-fix` | `npm test` | (no build) |
| `map-storage/` | `npm run typecheck` | `npm run lint-fix` | `npm test` | (no build) |
| `tests/` | - | `npm run lint-fix` | `npm run test-headed-chrome` | - |

## Memory Issues
Build may fail with heap out of memory. Use:
```bash
export NODE_OPTIONS=--max-old-space-size=16384
```

## Protocol Buffer Errors
If you see "Cannot find module 'ts-proto-generated'", rebuild messages:
```bash
cd messages && npm run ts-proto
```

## E2E Tests
Requires Docker running. Run single test:
```bash
cd tests && npm run test-headed-chrome -- tests/<file>.ts
```

## Pre-commit
Husky runs automatically on commit. Install hooks after first clone:
```bash
npm install
```

## Key Paths
- `play/src/front` - Svelte + Phaser frontend
- `play/src/pusher` - WebSocket server
- `back/src` - Backend API
- `messages/protos/` - .proto definitions
- `libs/` - Shared packages (messages, store-utils, map-editor, etc.)

## Services with Custom Runners
- **desktop/** - Uses Yarn (not npm)
- **uploader/** - Uses Jest (not Vitest)

## I18n Check
Audit missing translations:
```bash
cd play && npm run i18n:diff
```
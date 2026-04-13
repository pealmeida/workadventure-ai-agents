# Repository sections guide

This document describes **each major area of the WorkAdventure monorepo**: what it does, how to **edit** it safely, and how to **introduce new** packages, maps, or services. It pairs with [`application-development-guide.md`](./application-development-guide.md) (runtime architecture) and root [`AGENTS.md`](../../AGENTS.md) (commands and tooling).

---

## Quick reference

| Section | Role | Primary language | In npm workspaces? |
|--------|------|------------------|--------------------|
| [`play/`](#play) | Browser client + pusher (HTTP/WS) | TS, Svelte, Phaser | Yes |
| [`back/`](#back) | Game / room server | TS | Yes |
| [`map-storage/`](#map-storage) | Map persistence & API for editor | TS | Yes |
| [`messages/`](#messages-and-libsmessages) | Protobuf sources + code generation | Protobuf, TS tooling | No (separate package) |
| [`libs/messages/`](#messages-and-libsmessages) | Generated + JSON message types consumed by apps | TS | Yes |
| [`maps/`](#maps) | Example / starter map assets | JSON, TS (scripts), PHP host in Docker | Partial (`maps/package.json`) |
| [`libs/*`](#libs) | Shared libraries | TS | Yes (per package) |
| [`tests/`](#tests) | E2E (Playwright) | TS | Yes |
| [`uploader/`](#uploader) | Upload service | TS | Yes |
| [`benchmark/`](#benchmark) | Load / perf tooling | TS | Yes |
| [`desktop/`](#desktop) | Electron desktop wrapper | TS / Yarn subprojects | No |
| [`contrib/`](#contrib) | Docker images, OIDC mock, tools | Mixed | Partial (`contrib/tools/...`) |
| [`docs/`](#docs) | Product & developer documentation | Markdown | No |
| [`cd/`](#cd) | Internal CD/K8s helpers | — | No |

---

## Root

**What it is** — Monorepo orchestration: `package.json` **workspaces**, Husky hooks, shared TypeScript version **overrides**.

**Edit**

- **`package.json`** — Add a folder to `"workspaces"` only if it is a real npm package with its own `package.json`. After adding, run `npm install` from the repo root.
- **`.env.template` / `.env`** — Document new variables here and in service-specific env validators (e.g. `play/.../EnvironmentVariable.ts`).
- **`docker-compose.yaml` (+ variants)** — Add or change services, ports, Traefik labels, and volume mounts; keep in sync with env docs where applicable.

**Create**

- **New workspace package** — Create `your-package/package.json`, add `"name"`, `"version"`, scripts, then add `"your-package"` to root `workspaces`. Prefer placing shared code under **`libs/your-lib`** to match existing layout.
- **New Docker service** — Add a `service:` block, `labels` for Traefik if it must be reachable by hostname, and document URLs in this doc or `AGENTS.md` if developers need them daily.

---

## `play/`

**What it is** — The main **web application**: Vite + Svelte + Phaser **front**, and **pusher** (Express + uWebSockets) in the same repo. In Docker dev, `npm run dev` runs several processes (Vite, pusher, i18n watch, etc.).

**Key paths**

| Path | Purpose |
|------|---------|
| `play/src/front/` | Svelte UI, stores, Phaser game code |
| `play/src/front/Components/` | UI components (`Menu/`, `ActionBar/`, …) |
| `play/src/front/Stores/` | Client-side state |
| `play/src/front/Phaser/` | Scenes, entities, game manager |
| `play/src/pusher/` | HTTP controllers, WS socket controller, static resolution |
| `play/src/i18n/` | Locale modules; run `typesafe-i18n` after edits |
| `play/index.html` | Dev entry (Vite); templated for pusher in dev/prod |
| `play/public/` | Static assets in dev when not using `dist/public` |

**Edit**

- UI: change or add `.svelte` under `Components/`; wire **stores** and **i18n** (`$LL....`).
- Game behavior: `Phaser/` + stores; avoid coupling Phaser imports to Svelte.
- HTTP/WS surface: `pusher/controllers/`, `pusher/services/`, env enums.
- Always run `npm run typecheck` and `npm run svelte-check` from `play/`.

**Create**

- **New screen or overlay** — Prefer a store + conditional block in `GameOverlay.svelte` or `MainLayout.svelte` (see application development guide).
- **New HTTP route** — Add a controller class, register it in `pusher/app.ts`, mirror patterns from existing controllers.
- **New menu section** — `MenuStore`, `SubMenusInterface`, `Menu.svelte`, i18n keys.

---

## `back/`

**What it is** — **Room / game server**: users, groups, variables, communication strategies (WebRTC/LiveKit, etc.), Redis-backed state when configured.

**Key paths**

| Path | Purpose |
|------|---------|
| `back/src/server.ts`, `App.ts` | HTTP server bootstrap |
| `back/src/RoomManager.ts`, `Model/GameRoom.ts` | Room lifecycle |
| `back/src/Services/SocketManager.ts` | WebSocket handling |
| `back/src/Enum/EnvironmentVariable.ts` | Config surface |

**Edit**

- Follow existing patterns in `Model/` and `Services/`; prefer small, testable modules.
- If messages on the wire change, update **`messages/protos`** and regenerate (see below).
- Run `npm run typecheck` and `npm test -- --watch=false` from `back/`.

**Create**

- **New HTTP endpoint** — Add controller + register in `App.ts` (mirror `PingController`, etc.).
- **New game-side behavior** — Usually a new or extended path in `Model/` + tests; consider impact on **pusher** and **play** clients consuming the same protos/events.

---

## `map-storage/`

**What it is** — Service for **storing and serving map/WAM data** used by the inline map editor and related flows; exposed behind `map-storage.workadventure.localhost` in compose.

**Edit**

- Application code under `map-storage/src/`; run `npm run typecheck` / `npm test` from this folder.
- Align with map formats documented under `docs/map-building/` and schemas in `docs/schema/`.

**Create**

- **New API capability** — Add routes/services here, then update **play** (editor UI) and any **Admin** contract if applicable.

---

## `messages/` and `libs/messages/`

**What it is**

- **`messages/`** — **Source `.proto` files** and scripts that run **ts-proto**; output lands in **`libs/messages/src/ts-proto-generated/`** (do not hand-edit generated files).
- **`libs/messages/`** — Package consumed as **`@workadventure/messages`**: generated protos plus **JSON/Zod** message definitions under `src/JsonMessages/` (these *are* edited by hand when adding JSON APIs).

**Edit**

- **Protobuf** — Edit `messages/protos/*.proto`, then from `messages/`: `npm run ts-proto` (or use the `messages` Docker service in compose).
- **JSON API types** — Edit under `libs/messages/src/JsonMessages/` following existing Zod patterns; run package tests/typecheck as configured.

**Create**

- **New proto message or RPC** — Add to `.proto`, regenerate, then update **all** callers in `play`, `back`, and any gRPC clients.
- **New JSON DTO** — Add Zod schema + types in `JsonMessages/`; export from the same places sibling types use.

**Order** — Always **regenerate protos before** typechecking services that import `@workadventure/messages`.

---

## `maps/`

**What it is** — **Map projects** (e.g. Tiled JSON, WAM, scripts) served statically in dev via the **`maps`** compose service. Starter URLs often point at `maps.workadventure.localhost/...`.

**Edit**

- Change map JSON, assets, or **iframe scripts** using the [map building](https://docs.workadventu.re/map-building/) and [map scripting](../map-scripting/index.md) docs.
- `maps/package.json` may include tooling deps for map scripts (e.g. iframe API typings).

**Create**

- **New map** — New folder under `maps/` with the usual `map.json` / WAM layout; publish URL must match how **play** resolves `/_/global/...` paths.
- **New scripted behavior** — TypeScript scripts in the map folder; use `@workadventure/iframe-api-typings` from `play/packages/iframe-api-typings/`.

---

## `libs/`

Shared packages included from the root **workspaces** (except nested paths like `room-api-clients`).

| Package | Typical use |
|---------|-------------|
| `libs/messages` | Protos + JSON messages (`@workadventure/messages`) |
| `libs/shared-utils` | Cross-cutting utilities |
| `libs/store-utils` | Store/helpers for front or editors |
| `libs/map-editor` | Map editor shared code |
| `libs/math-utils` | Math helpers |
| `libs/tailwind` | Shared Tailwind preset/config |
| `libs/eslint-config` | Shared ESLint config |
| `libs/room-api-clients/room-api-client-js` | JS client for Room API |

**Edit**

- Change source under each package; run that package’s scripts (`typecheck`, `test`, `lint`) and **consumers** (`play`, `map-storage`, …).

**Create**

- **New shared library** — `mkdir libs/my-lib`, add `package.json` with a scoped or plain name, `main`/`types`/`exports` as needed, TypeScript config consistent with sibling libs, then add **`"libs/my-lib"`** to root `workspaces`. From `play` or `back`, add a **dependency** with `"workspace:*"` or relative path per existing convention in those `package.json` files.
- **New Room API client** — Rare; extend `room-api-client-js` or add a sibling client package and document it here.

---

## `tests/`

**What it is** — **End-to-end** tests (Playwright) against a running Docker stack.

**Edit**

- Add or change specs under `tests/`; use existing helpers and stable selectors (`data-testid` in `play`).

**Create**

- **New scenario** — New `tests/*.ts` file; run with `npm run test-headed-chrome -- tests/<file>.ts` (see `AGENTS.md`).

---

## `uploader/`

**What it is** — Separate **upload** microservice (Jest-based tests per `AGENTS.md`).

**Edit**

- Source under `uploader/src/` (or as structured in that package); run its `typecheck` / `test` scripts.

**Create**

- New upload flows usually need **play** UI + **uploader** API + env vars; track all three in PRs.

---

## `benchmark/`

**What it is** — **Performance / load** tooling; not required for normal feature work.

**Edit / create** — Follow README in `benchmark/` if present; keep changes isolated from production code paths.

---

## `desktop/`

**What it is** — **Electron** wrapper and related assets; uses **Yarn** in subfolders (not the root npm workspace).

**Edit**

- Use each subproject’s `package.json` and README under `desktop/`; do not assume root `npm install` covers Electron deps.

**Create**

- New desktop-only features should stay inside `desktop/` unless they require shared types from `libs/`.

---

## `contrib/`

**What it is** — **Contributed** Docker images, **OIDC mock**, Helm-related material, and tools such as **`contrib/tools/generate-env-docs`** (in root workspaces).

**Edit**

- **OIDC mock** — `contrib/oidc-server-mock/` for local login flows.
- **generate-env-docs** — Keeps env documentation in sync; run root `npm run generate-env-docs` / `check-env-docs` when changing templates.

**Create**

- Prefer **contrib** for optional or self-hosted-only images; document how compose files reference them.

---

## `docs/`

**What it is** — **User**, **map-building**, **self-hosting**, and **developer** documentation (often published via Docusaurus).

**Edit**

- Add or change Markdown under `docs/`; follow existing folder conventions (`docs/developer/`, `docs/map-building/`, …).
- If the site uses Docusaurus, add entries to the **sidebar** config in the website package when you need a page in the left nav.

**Create**

- New developer guides → `docs/developer/<name>.md`; link from [`application-development-guide.md`](./application-development-guide.md) or `AGENTS.md` when broadly useful.

---

## `cd/`

**What it is** — **Continuous deployment** files tied to the project’s Kubernetes setup; **not** intended for generic reuse (see `cd/README.md`).

**Edit** — Only when working on official deployment pipelines; coordinate with ops/maintainers.

---

## `messages/` container vs folder

The **`messages`** Docker service runs codegen and installs tooling for **ARM-friendly** proto generation. Local developers can run `cd messages && npm run ts-proto` on supported hosts instead.

---

## Checklist: adding a “new section” (decision tree)

1. **Is it only UI?** → `play/src/front/` (+ i18n, stores).
2. **Is it server authority / rooms / variables?** → `back/` (+ protos if wire format changes).
3. **Is it map file or script?** → `maps/` + scripting docs.
4. **Is it shared TS?** → new or existing `libs/*` + workspace entry.
5. **Is it upload-related?** → `uploader/` + `play`.
6. **Is it infra-only?** → `docker-compose`, `contrib/`, `cd/`, env docs.

---

## Related links

- [`AGENTS.md`](../../AGENTS.md) — typecheck/lint/test commands per service, build order, Docker tips.
- [`application-development-guide.md`](./application-development-guide.md) — how Svelte, Phaser, pusher, and back fit together.
- [`docs/others/contributing/communication-between-services.md`](../others/contributing/communication-between-services.md) — cross-service protocols.

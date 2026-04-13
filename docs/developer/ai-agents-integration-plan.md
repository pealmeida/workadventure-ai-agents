# AI Agents Integration Plan

This document describes how WorkAdventure integrates with external agentic frameworks to power the in-world AI agent experience. The **play** app serves as the frontend interface — agents, their models, skills, MCP tools, and harness configurations are provided by the selected backend framework.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│  WorkAdventure Play (Frontend)                   │
│  ┌──────────┐  ┌──────────────┐  ┌───────────┐  │
│  │ ActionBar │  │ Agent Sidebar │  │ Settings  │  │
│  │ Robot Icon│  │ (Chat/Tasks)  │  │ Framework │  │
│  └─────┬─────┘  └──────┬───────┘  └─────┬─────┘  │
│        │               │                │         │
│        └───────────────┼────────────────┘         │
│                        │                          │
│               ┌────────▼─────────┐                │
│               │  AIAgentStore    │                │
│               │  (Svelte Stores) │                │
│               └────────┬─────────┘                │
└────────────────────────┼──────────────────────────┘
                         │ HTTP / WebSocket
          ┌──────────────▼───────────────┐
          │     Pusher (play/src/pusher) │
          │     Proxy / Auth / WS relay  │
          └──────────────┬───────────────┘
                         │
          ┌──────────────▼───────────────┐
          │     Back (back/src)          │
          │     Agent orchestration      │
          │     Framework adapter layer  │
          └──────┬───────┬───────┬───────┘
                 │       │       │
    ┌────────────▼─┐ ┌──▼────┐ ┌▼─────────┐
    │  OpenClaw    │ │LangCh.│ │Hermes/Crew│
    │  Agent API   │ │Graph  │ │AI APIs    │
    └──────────────┘ └───────┘ └───────────┘
```

---

## Framework Interfaces

### Agent Shape (imported from framework)

```typescript
interface AIAgentConfig {
    id: string;
    name: string;
    enabled: boolean;
    responseStyle: "friendly" | "professional" | "casual";
    framework: AgenticFramework;
    provider?: string;       // e.g. "OpenAI", "Anthropic", "Google"
    model?: string;          // e.g. "gpt-4o", "claude-sonnet-4-20250514", "gemini-2.5-pro"
    skills: string[];        // Agent capability tags
    mcpTools: string[];      // MCP tool identifiers this agent can invoke
    harness?: string;        // Harness execution mode
    tasks: AIAgentTask[];
    userId?: number;
}
```

### Framework Connection

```typescript
interface FrameworkConnection {
    framework: AgenticFramework;
    status: "connected" | "disconnected" | "connecting" | "error";
    endpoint?: string;
    version?: string;
    lastPing?: Date;
}
```

---

## Supported Frameworks

### 1. OpenClaw

**Description:** Open-source agentic framework focused on autonomous exploration and reasoning. Agents operate independently, patrolling virtual spaces and responding to user interactions with minimal orchestration overhead.

| Property | Value |
|----------|-------|
| Default Provider | OpenAI |
| Default Model | gpt-4o / gpt-4o-mini |
| Harness Modes | `openclaw-autonomous`, `openclaw-reactive` |
| MCP Tools | `workadventure-map-reader`, `workadventure-zone-watcher`, `workadventure-event-bus` |

**Default Agents:**

| Agent | Role | Skills |
|-------|------|--------|
| Claw Scout | Autonomous exploration, reasoning | map-exploration, reasoning, anomaly-detection |
| Claw Sentinel | Monitoring, alerting | monitoring, summarization, alerting |

**Integration points:**
- REST endpoint: `POST /api/agents/openclaw/discover` — returns available agents
- WebSocket: `/ws/agents/openclaw/chat` — real-time agent chat
- Health: `GET /api/agents/openclaw/health` — connection status

**Backend adapter:** `back/src/Services/AgentFramework/OpenClawAdapter.ts`

---

### 2. LangChain / LangGraph

**Description:** Chain-based orchestration framework using LangGraph stateful graphs for agent coordination. Provides shared memory, tool execution pipelines, and streaming LLM responses.

| Property | Value |
|----------|-------|
| Default Provider | Anthropic |
| Default Model | claude-sonnet-4-20250514 |
| Harness Modes | `langgraph-stateful`, `langgraph-tool-node` |
| MCP Tools | `langchain-retriever`, `langchain-tool-executor`, `workadventure-chat-history`, `workadventure-api-client` |

**Default Agents:**

| Agent | Role | Skills |
|-------|------|--------|
| Chain Router | Query routing, chain orchestration | query-routing, chain-orchestration, memory-recall |
| Chain Worker | Tool execution, streaming | tool-execution, streaming, code-generation |

**Integration points:**
- REST endpoint: `POST /api/agents/langchain/discover` — returns agent graph topology
- WebSocket: `/ws/agents/langchain/chat` — streaming chat with token-level updates
- Health: `GET /api/agents/langchain/health` — graph status

**Backend adapter:** `back/src/Services/AgentFramework/LangChainAdapter.ts`

---

### 3. Hermes Agent

**Description:** Context-synthesis and message relay framework optimized for spatial navigation and multi-agent broadcasting in virtual worlds.

| Property | Value |
|----------|-------|
| Default Provider | Google |
| Default Model | gemini-2.5-pro / gemini-2.5-flash |
| Harness Modes | `hermes-reactive`, `hermes-pubsub` |
| MCP Tools | `hermes-room-index`, `hermes-pubsub`, `workadventure-pathfinder`, `workadventure-event-bus` |

**Default Agents:**

| Agent | Role | Skills |
|-------|------|--------|
| Hermes Guide | Navigation, context synthesis | navigation, context-synthesis, spatial-awareness |
| Hermes Messenger | Message relay, broadcasting | message-relay, broadcasting, notification |

**Integration points:**
- REST endpoint: `POST /api/agents/hermes/discover` — returns agent roster
- WebSocket: `/ws/agents/hermes/chat` — bidirectional relay
- Health: `GET /api/agents/hermes/health` — service heartbeat

**Backend adapter:** `back/src/Services/AgentFramework/HermesAdapter.ts`

---

### 4. CrewAI

**Description:** Role-based crew orchestration where agents form crews with delegated tasks. Sequential or hierarchical execution with structured reporting.

| Property | Value |
|----------|-------|
| Default Provider | OpenAI |
| Default Model | gpt-4o / gpt-4o-mini |
| Harness Modes | `crewai-sequential`, `crewai-researcher` |
| MCP Tools | `crewai-task-manager`, `crewai-knowledge-base`, `workadventure-api-client`, `workadventure-map-reader` |

**Default Agents:**

| Agent | Role | Skills |
|-------|------|--------|
| Crew Lead | Delegation, planning, aggregation | delegation, aggregation, planning |
| Crew Researcher | Research, report writing | research, report-writing, data-extraction |

**Integration points:**
- REST endpoint: `POST /api/agents/crewai/discover` — returns crew definitions
- WebSocket: `/ws/agents/crewai/chat` — crew task updates and chat
- Health: `GET /api/agents/crewai/health` — crew status

**Backend adapter:** `back/src/Services/AgentFramework/CrewAIAdapter.ts`

---

## Integration Flow

### 1. Framework Selection (Settings Menu)

1. User opens **Settings → AI Agents**
2. User enables AI Agents via the toggle
3. A **dropdown** shows available frameworks with connection status
4. Selecting a framework triggers `connectFramework()` which:
   - Sets status to `connecting`
   - Calls the backend health endpoint
   - On success: sets status to `connected`, fetches agents via `/discover`
   - On failure: sets status to `error`
5. Agents are populated from the framework's `/discover` response
6. Framework selection is persisted in localStorage

### 2. Agent Discovery

```
GET /api/agents/{framework}/discover
→ Response: AIAgentConfig[]
```

Each agent includes its `provider`, `model`, `skills[]`, `mcpTools[]`, and `harness`. The frontend renders these read-only in the sidebar settings view.

### 3. Agent Chat

```
WS /ws/agents/{framework}/chat
→ Send: { agentId, content }
← Recv: { agentId, content, isUser, timestamp }
```

The pusher proxies WebSocket messages between the browser and the back service, which routes to the appropriate framework adapter.

### 4. Agent Task Tracking

Agents report task status updates via the WebSocket channel. The frontend displays these in:
- The agent sidebar (tasks view)
- The TodoList integration (`syncAgentsToTodoList()`)

---

## MCP (Model Context Protocol) Tools

Each framework exposes WorkAdventure-specific MCP tools that agents can invoke:

| MCP Tool | Description | Used By |
|----------|-------------|---------|
| `workadventure-map-reader` | Read map layout, tiles, zones | OpenClaw, CrewAI |
| `workadventure-zone-watcher` | Subscribe to zone enter/exit events | OpenClaw |
| `workadventure-event-bus` | Publish/subscribe to world events | OpenClaw, Hermes |
| `workadventure-chat-history` | Access chat conversation history | LangChain |
| `workadventure-api-client` | Call WorkAdventure room/space APIs | LangChain, CrewAI |
| `workadventure-pathfinder` | Compute paths between map positions | Hermes |
| `langchain-retriever` | Retrieve from vector store | LangChain |
| `langchain-tool-executor` | Execute LangChain tools | LangChain |
| `hermes-room-index` | Room metadata index | Hermes |
| `hermes-pubsub` | Inter-agent message bus | Hermes |
| `crewai-task-manager` | Manage crew task lifecycle | CrewAI |
| `crewai-knowledge-base` | Shared crew knowledge | CrewAI |

---

## Harness Execution Modes

The `harness` field defines how the framework executes the agent:

| Harness | Framework | Description |
|---------|-----------|-------------|
| `openclaw-autonomous` | OpenClaw | Agent runs independently, polls for events |
| `openclaw-reactive` | OpenClaw | Agent responds only to triggered events |
| `langgraph-stateful` | LangChain | Stateful LangGraph node with memory |
| `langgraph-tool-node` | LangChain | Tool-execution node in a LangGraph |
| `hermes-reactive` | Hermes | Reacts to navigation/context events |
| `hermes-pubsub` | Hermes | Publish-subscribe relay agent |
| `crewai-sequential` | CrewAI | Sequential crew task execution |
| `crewai-researcher` | CrewAI | Research-focused crew member |

---

## Backend Implementation Plan

### Phase 1: Adapter Interface

Create a shared adapter interface in `back/src/Services/AgentFramework/`:

```typescript
interface AgentFrameworkAdapter {
    discoverAgents(): Promise<AIAgentConfig[]>;
    sendMessage(agentId: string, content: string): AsyncGenerator<string>;
    healthCheck(): Promise<{ status: string; version: string }>;
    getAgentTasks(agentId: string): Promise<AIAgentTask[]>;
}
```

### Phase 2: Pusher Proxy Routes

Add pusher routes in `play/src/pusher/controllers/`:

- `GET /api/agent-frameworks` — list available frameworks with connection status
- `POST /api/agent-frameworks/:framework/connect` — initiate connection
- `GET /api/agent-frameworks/:framework/agents` — discover agents
- WebSocket handler for agent chat

### Phase 3: Framework Implementations

Implement each adapter:
1. **OpenClawAdapter** — REST/WebSocket client to OpenClaw server
2. **LangChainAdapter** — LangGraph SDK integration
3. **HermesAdapter** — gRPC/REST client to Hermes service
4. **CrewAIAdapter** — REST client to CrewAI orchestrator

### Phase 4: Real Agent Discovery

Replace mock agent creation with live discovery:
- `AIAgentStore.selectFramework()` calls backend `/discover`
- Agents are populated from real framework data
- Chat messages route through pusher → back → framework adapter

### Phase 5: MCP Tool Bridge

Implement MCP tool execution:
- Agent requests tool execution via chat WebSocket
- Back service routes to appropriate MCP handler
- Results stream back to agent and user

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `AI_AGENTS_ENABLED` | Global on/off for AI agent features | `false` |
| `OPENCLAW_ENDPOINT` | OpenClaw API base URL | — |
| `OPENCLAW_API_KEY` | OpenClaw authentication key | — |
| `LANGCHAIN_ENDPOINT` | LangChain/LangGraph API URL | — |
| `LANGCHAIN_API_KEY` | LangChain API key | — |
| `HERMES_ENDPOINT` | Hermes Agent API URL | — |
| `HERMES_API_KEY` | Hermes API key | — |
| `CREWAI_ENDPOINT` | CrewAI API URL | — |
| `CREWAI_API_KEY` | CrewAI API key | — |

---

## Security Considerations

- Framework API keys are stored server-side only (never exposed to the client)
- The pusher authenticates all agent chat WebSocket connections
- Agent actions via MCP tools are sandboxed — agents cannot modify maps or access other users' data without explicit permissions
- Framework connection status is read-only on the frontend; actual connections are managed by the back service

---

## File Reference

| File | Role |
|------|------|
| `play/src/front/Stores/AIAgentStore.ts` | Frontend stores, types, framework connection logic |
| `play/src/front/Components/Menu/AIAgentsSubMenu.svelte` | Settings menu with framework dropdown |
| `play/src/front/Components/Chat/AIAgentSidebar.svelte` | Left-side drawer with chat, settings, tasks |
| `play/src/front/Components/ActionBar/MenuIcons/AgentsMenuItem.svelte` | ActionBar robot icon button |
| `play/src/front/Components/Icons/RobotIcon.svelte` | Robot head SVG icon |
| `play/src/front/Stores/AIAgentSpawnSync.ts` | Phaser sprite sync |
| `play/src/front/Phaser/Game/AIAgentSpawner.ts` | Map sprite spawner |
| `play/src/front/Connection/LocalUserStore.ts` | Framework persistence in localStorage |
| `play/src/i18n/en-US/menu.ts` | i18n strings for agents and frameworks |
| `back/src/Services/AgentFramework/` *(planned)* | Backend framework adapters |
| `play/src/pusher/controllers/` *(planned)* | Pusher proxy routes for agent APIs |

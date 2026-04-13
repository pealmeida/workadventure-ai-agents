# Embedding & Integration Best Practices for Agentic Development

Optimized patterns, working code examples, and architectural best practices for building AI-powered integrations on WorkAdventure. This document is the companion to the [External Integration Guide](./external-integration-guide.md) and the [AI Agents Integration Plan](./ai-agents-integration-plan.md).

---

## Table of Contents

- [Guiding Principles](#guiding-principles)
- [Choosing the Right Integration Layer](#choosing-the-right-integration-layer)
- [Pattern 1 — Agent as an Embedded Web App](#pattern-1--agent-as-an-embedded-web-app)
- [Pattern 2 — Agent as a Map Script (NPC)](#pattern-2--agent-as-a-map-script-npc)
- [Pattern 3 — Agent as a Backend Service (Room API)](#pattern-3--agent-as-a-backend-service-room-api)
- [Pattern 4 — Agent via Admin API Webhooks](#pattern-4--agent-via-admin-api-webhooks)
- [Pattern 5 — Hybrid: Script + Backend Agent](#pattern-5--hybrid-script--backend-agent)
- [State & Event Architecture](#state--event-architecture)
- [Phaser Sprite Integration](#phaser-sprite-integration)
- [Svelte Store Integration](#svelte-store-integration)
- [MCP Tool Design Patterns](#mcp-tool-design-patterns)
- [Performance & Scalability](#performance--scalability)
- [Security Checklist](#security-checklist)
- [Testing Your Integration](#testing-your-integration)
- [Complete Working Examples](#complete-working-examples)

---

## Guiding Principles

1. **Keep agents stateless on the frontend.** Use `WA.state` and `WA.event` for shared state; persist real data in your backend via the Room API or Admin API.

2. **Use the narrowest integration surface.** Prefer `WA.event` for real-time pub/sub over WebSocket. Prefer the Room API gRPC for backend-to-backend over REST polling.

3. **Separate the agent brain from the agent body.** The LLM / reasoning / framework adapter lives on your backend. The WorkAdventure frontend only handles presentation and event routing.

4. **Design for offline/resync.** Players disconnect and reconnect. Use `WA.state.onVariableChange()` to re-sync agent state on load rather than assuming a continuous session.

5. **Namespace your events and variables.** Prefix all `WA.event` names and `WA.state` keys with your app identifier (e.g., `myapp:task-update`) to avoid collisions with other scripts.

6. **Leverage the fictive player pattern.** AI agents that need a visual presence in the game world should be registered through `playersStore.addFacticePlayer()` and rendered as `RemotePlayer` sprites. See [Phaser Sprite Integration](#phaser-sprite-integration).

---

## Choosing the Right Integration Layer

```
                    ┌─────────────────────────────────────┐
                    │ What does your agent need to do?     │
                    └──────────────┬──────────────────────┘
                                   │
                    ┌──────────────▼──────────────────────┐
                    │ Does it need LLM/API calls?          │
                    └──────┬──────────────────────┬───────┘
                           │ Yes                  │ No
                           ▼                      ▼
                ┌─────────────────────┐  ┌────────────────────┐
                │ Backend Agent       │  │ Map Script (NPC)   │
                │ (Room API gRPC +    │  │ (WA.event, WA.state│
                │  WA.event bridge)   │  │  WA.chat, WA.room) │
                └──────┬──────────────┘  └────────────────────┘
                       │
            ┌──────────▼───────────┐
            │ Does it need a       │
            │ visual presence?     │
            └──┬───────────────┬───┘
               │ Yes           │ No
               ▼               ▼
    ┌──────────────────┐  ┌──────────────────┐
    │ Embedded Web App │  │ Headless Backend │
    │ (co-website /    │  │ (Room API gRPC   │
    │  UI website +    │  │  + Admin REST)   │
    │  WA scripting)   │  │                  │
    └──────────────────┘  └──────────────────┘
```

| Agent Type | Frontend | Backend | Best For |
|------------|----------|---------|----------|
| Simple NPC | Map script (`WA.*`) | None | Greeter bots, zone triggers, scripted interactions |
| Chat Agent | Co-website / UI website | LLM API (via your server) | Conversational AI, help desk |
| Autonomous Agent | Fictive player sprite | Room API gRPC + framework | Patrol bots, monitors, autonomous NPCs |
| Multi-Agent Crew | Agent sidebar UI | Framework adapter (CrewAI, LangChain) | Task orchestration, research teams |
| Event Processor | None (headless) | Room API `listenToEvent` + `broadcastEvent` | Analytics, moderation, automation |

---

## Pattern 1 — Agent as an Embedded Web App

**When to use:** Your agent has a rich UI (chat interface, dashboard, tool panel) and needs LLM access or external API calls.

**Architecture:**

```
┌─ WorkAdventure ──────────────────────────────┐
│  Map Layer (openWebsiteAllowApi=true)         │
│  ┌──────────────────────────────────────────┐ │
│  │ Your Agent App (iframe)                  │ │
│  │  <script src="/iframe_api.js"></script>  │ │
│  │  ↕ WA.event / WA.state / WA.chat        │ │
│  │  ↕ fetch() to your backend LLM API      │ │
│  └──────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘
```

### Best Practice: Structure Your Agent as a Co-Website

Co-websites give your agent a dedicated side panel with a real browser origin, so `fetch()` and `WebSocket` work without sandbox restrictions.

```html
<!-- agent.html — loaded as a co-website -->
<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <script src="/iframe_api.js"></script>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: system-ui, sans-serif; padding: 16px; background: #1a1a2e; color: #eee; }
        #messages { height: 60vh; overflow-y: auto; }
        .msg { padding: 8px 12px; margin: 4px 0; border-radius: 8px; max-width: 80%; }
        .msg.user { background: #0f3460; margin-left: auto; }
        .msg.agent { background: #16213e; }
        #input-area { display: flex; gap: 8px; margin-top: 12px; }
        #input { flex: 1; padding: 8px 12px; border-radius: 8px; border: 1px solid #333; background: #16213e; color: #eee; }
        button { padding: 8px 16px; border-radius: 8px; border: none; background: #e94560; color: #fff; cursor: pointer; }
    </style>
</head>
<body>
    <h3>🤖 Assistant</h3>
    <div id="messages"></div>
    <div id="input-area">
        <input id="input" placeholder="Ask me anything..." autofocus>
        <button id="send">Send</button>
    </div>

    <script>
        const messagesEl = document.getElementById('messages');
        const inputEl = document.getElementById('input');
        const sendBtn = document.getElementById('send');

        async function init() {
            await WA.onInit();

            // Listen for game events — other systems can trigger the agent
            WA.event.on('myapp:agent-prompt').subscribe((evt) => {
                addMessage('system', evt.data.prompt);
                callAgent(evt.data.prompt);
            });

            // Listen for player state changes — agent can react
            WA.state.onVariableChange('myapp:agent-context').subscribe((ctx) => {
                if (ctx) addMessage('system', `Context updated: ${JSON.stringify(ctx)}`);
            });

            sendBtn.addEventListener('click', handleSend);
            inputEl.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') handleSend();
            });
        }

        function handleSend() {
            const text = inputEl.value.trim();
            if (!text) return;
            addMessage('user', text);
            inputEl.value = '';
            callAgent(text);
        }

        async function callAgent(userMessage) {
            addMessage('agent', '...thinking...');

            try {
                // Call YOUR backend — not the LLM directly from the browser
                const res = await fetch('https://your-backend.example.com/api/agent/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message: userMessage,
                        room: WA.room.id,
                        playerName: WA.player.name,
                        playerTags: WA.player.tags,
                    }),
                });
                const data = await res.json();
                replaceLastMessage(data.reply);

                // Optionally broadcast agent response as a game event
                WA.event.broadcast('myapp:agent-reply', {
                    reply: data.reply,
                    playerName: WA.player.name,
                });
            } catch (err) {
                replaceLastMessage('Error: ' + err.message);
            }
        }

        function addMessage(role, text) {
            const div = document.createElement('div');
            div.className = `msg ${role}`;
            div.textContent = text;
            messagesEl.appendChild(div);
            messagesEl.scrollTop = messagesEl.scrollHeight;
        }

        function replaceLastMessage(text) {
            const msgs = messagesEl.querySelectorAll('.msg.agent');
            if (msgs.length) msgs[msgs.length - 1].textContent = text;
        }

        init();
    </script>
</body>
</html>
```

### Opening the Agent from a Map Script

```javascript
// map-script.js — opens the agent co-website when a player enters the help desk zone
WA.onInit().then(() => {
    let agentCoWebsite = null;

    WA.room.onEnterLayer('helpDeskZone').subscribe(async () => {
        agentCoWebsite = await WA.nav.openCoWebSite(
            'https://your-backend.example.com/agent.html',
            true,   // allowApi — enables WA object in the iframe
            '',     // allowPolicy
            40,     // widthPercent
            0,      // position
            true,   // closable
            false   // lazy
        );

        // Send initial context to the agent
        WA.state.saveVariable('myapp:agent-context', {
            zone: 'helpDesk',
            player: WA.player.name,
            tags: WA.player.tags,
        });
    });

    WA.room.onLeaveLayer('helpDeskZone').subscribe(async () => {
        if (agentCoWebsite) {
            await agentCoWebsite.close();
            agentCoWebsite = null;
        }
    });
});
```

### Best Practices for Embedded Agents

| Practice | Why |
|----------|-----|
| Always `await WA.onInit()` before using any `WA.*` method | The API needs a handshake with the parent frame |
| Never call LLM APIs directly from the browser | Exposes API keys; use your backend as a proxy |
| Use `WA.event` for real-time sync, not polling | Events are pushed instantly via the game WebSocket |
| Set `openWebsiteAllowApi: true` in Tiled | Without this, the iframe cannot access the `WA` object |
| Use a co-website, not an embedded website, for chat UIs | Co-websites have a real origin and can make HTTP requests |
| Clean up subscriptions on unload | Use `subscription.unsubscribe()` in a `beforeunload` handler |

---

## Pattern 2 — Agent as a Map Script (NPC)

**When to use:** Simple reactive behaviors (greeter, guide, quiz master) that don't need external LLM calls.

### NPC Greeter with Zone Detection

```javascript
// greeter.js — map script property
WA.onInit().then(() => {
    WA.room.onEnterLayer('entrance').subscribe(() => {
        WA.chat.sendChatMessage(
            `Welcome ${WA.player.name}! Explore the building using the doors on each side.`,
            'Concierge Bot'
        );

        WA.ui.displayActionMessage({
            message: 'Press SPACE to see the map guide',
            callback: () => {
                WA.nav.openTab('https://example.com/map-guide');
            },
        });
    });
});
```

### NPC Guide That Moves the Player

```javascript
// guide.js — walks the player through zones sequentially
WA.onInit().then(() => {
    const tourSteps = [
        { zone: 'tour-stop-1', message: 'This is the main hall.', nextZone: 'tour-stop-2' },
        { zone: 'tour-stop-2', message: 'Here are the meeting rooms.', nextZone: 'tour-stop-3' },
        { zone: 'tour-stop-3', message: 'This is the lounge area. Tour complete!', nextZone: null },
    ];

    let activeStep = 0;

    WA.event.on('myapp:start-tour').subscribe(() => {
        activeStep = 0;
        startTourStep();
    });

    function startTourStep() {
        const step = tourSteps[activeStep];
        if (!step) return;

        WA.chat.sendChatMessage(step.message, 'Tour Guide');

        if (step.nextZone) {
            WA.room.onEnterLayer(step.nextZone).subscribe(() => {
                activeStep++;
                startTourStep();
            });
        }
    }
});
```

### NPC Quiz Master with Shared State

```javascript
// quiz.js — uses WA.state to share quiz results across all players
WA.onInit().then(() => {
    const quizQuestions = [
        { q: 'What year was WorkAdventure created?', a: '2020' },
        { q: 'What game engine does WA use?', a: 'Phaser' },
    ];

    WA.state.onVariableChange('myapp:quiz:currentQuestion').subscribe((idx) => {
        if (idx === undefined || idx === null) return;
        const question = quizQuestions[idx];
        if (!question) return;

        WA.chat.sendChatMessage(
            `Question ${idx + 1}/${quizQuestions.length}: ${question.q}`,
            'Quiz Master'
        );
    });

    WA.chat.onChatMessage((message) => {
        const currentIdx = WA.state.loadVariable('myapp:quiz:currentQuestion');
        if (currentIdx === undefined) return;

        const question = quizQuestions[currentIdx];
        if (!question) return;

        if (message.toLowerCase().includes(question.a.toLowerCase())) {
            WA.chat.sendChatMessage('Correct! 🎉', 'Quiz Master');
            WA.event.broadcast('myapp:quiz:correct', {
                questionIndex: currentIdx,
                answeredBy: WA.player.name,
            });

            const nextIdx = currentIdx + 1;
            if (nextIdx < quizQuestions.length) {
                setTimeout(() => {
                    WA.state.saveVariable('myapp:quiz:currentQuestion', nextIdx);
                }, 2000);
            } else {
                WA.chat.sendChatMessage('Quiz complete! Great job everyone!', 'Quiz Master');
                WA.state.saveVariable('myapp:quiz:currentQuestion', undefined);
            }
        }
    });
});
```

### Best Practices for NPC Scripts

| Practice | Why |
|----------|-----|
| Always wrap in `WA.onInit().then(...)` | Guarantees the API bridge is ready |
| Use `WA.event.broadcast` for multiplayer sync | Each player runs scripts independently — use events to coordinate |
| Use `WA.state` for persistent room state | Survives page reloads and persists across sessions |
| Unsubscribe from layer observables when done | Prevents memory leaks and duplicate triggers |
| Use a named author in `sendChatMessage` | Makes bot messages visually distinct from player messages |
| Keep logic simple in map scripts | Complex logic belongs in a backend agent (Pattern 3) |

---

## Pattern 3 — Agent as a Backend Service (Room API)

**When to use:** Your agent runs on a server and needs to read/write room state, respond to events, or broadcast messages — without any browser open.

**Architecture:**

```
┌─ Your Backend ──────────────┐     ┌─ WorkAdventure ────────────┐
│                              │     │                             │
│  Agent Service               │     │  Room API (gRPC :50051)     │
│  ├─ listenToEvent()  ◄──────┼─────┼── stream: myapp:*           │
│  ├─ broadcastEvent() ───────┼────►│                              │
│  ├─ saveVariable()  ────────┼────►│  → synced to all players    │
│  ├─ listenVariable() ◄──────┼─────┼── stream: myapp:*           │
│  └─ LLM / Logic / DB        │     │                             │
│                              │     │  Map Scripts                │
│                              │     │  ├─ WA.event.on('myapp:*') │
│                              │     │  └─ WA.state.*             │
└──────────────────────────────┘     └─────────────────────────────┘
```

### Python Agent Service (Full Example)

```python
# agent_service.py — connects to Room API and responds to player events
import grpc
import json
import asyncio
from concurrent import futures
import room_api_pb2 as pb
import room_api_pb2_grpc as pb_grpc

ROOM = "/_/global/maps.example.com/map.json"
SECRET = "your-room-api-secret-key"
METADATA = [("secretKey", SECRET)]

class RoomApiAgent:
    def __init__(self, target="localhost:50051"):
        self.channel = grpc.insecure_channel(target)
        self.stub = pb_grpc.RoomApiStub(self.channel)

    # ── Read / Write State ──────────────────────────────────────

    async def read_variable(self, name: str):
        resp = self.stub.readVariable(
            pb.VariableRequest(room=ROOM, name=name),
            metadata=METADATA,
        )
        return json.loads(resp.value)

    async def save_variable(self, name: str, value):
        from google.protobuf.struct_pb2 import Value
        import json

        val = Value()
        val.string_value = json.dumps(value)
        self.stub.saveVariable(
            pb.SaveVariableRequest(room=ROOM, name=name, value=val),
            metadata=METADATA,
        )

    # ── Broadcast Events ────────────────────────────────────────

    async def broadcast(self, event_name: str, data: dict, target_users=None):
        from google.protobuf.struct_pb2 import Value
        import json

        val = Value()
        val.string_value = json.dumps(data)

        req = pb.DispatchEventRequest(
            room=ROOM,
            name=event_name,
            data=val,
        )
        if target_users:
            req.targetUserIds.extend(target_users)

        self.stub.broadcastEvent(req, metadata=METADATA)

    # ── Listen to Events (streaming) ────────────────────────────

    async def listen_events(self, event_name: str):
        """Yields (data_json, sender_id) tuples in real time."""
        stream = self.stub.listenToEvent(
            pb.EventRequest(room=ROOM, name=event_name),
            metadata=METADATA,
        )
        for event in stream:
            data = json.loads(event.data.string_value) if event.data.HasField("string_value") else {}
            yield data, event.senderId

    # ── Listen to Variable Changes (streaming) ──────────────────

    async def listen_variable(self, name: str):
        stream = self.stub.listenVariable(
            pb.VariableRequest(room=ROOM, name=name),
            metadata=METADATA,
        )
        for value in stream:
            yield json.loads(value.string_value) if value.HasField("string_value") else None

    # ── Agent Logic ─────────────────────────────────────────────

    async def run(self):
        # Start event listeners concurrently
        await asyncio.gather(
            self._handle_chat_commands(),
            self._handle_state_changes(),
        )

    async def _handle_chat_commands(self):
        async for data, sender_id in self.listen_events("myapp:chat-command"):
            command = data.get("command", "")
            args = data.get("args", "")
            player = data.get("player", "Unknown")

            if command == "help":
                await self.broadcast("myapp:agent-reply", {
                    "text": f"Hey {player}! I can: help, status, quiz, tour",
                    "style": "friendly",
                })
            elif command == "status":
                # Read room state to build a status response
                try:
                    visitor_count = await self.read_variable("myapp:visitor-count")
                except Exception:
                    visitor_count = "unknown"
                await self.broadcast("myapp:agent-reply", {
                    "text": f"Room status: {visitor_count} visitors today",
                    "style": "professional",
                })
            elif command == "quiz":
                await self.save_variable("myapp:quiz:currentQuestion", 0)
                await self.broadcast("myapp:agent-reply", {
                    "text": "Quiz started! Check the chat for questions.",
                    "style": "friendly",
                })

    async def _handle_state_changes(self):
        async for value in self.listen_variable("myapp:agent-prompt"):
            if not value:
                continue
            # This is where you'd call your LLM
            reply = f"Processed: {value}"
            await self.broadcast("myapp:agent-reply", {"text": reply})


if __name__ == "__main__":
    agent = RoomApiAgent("room-api.example.com:50051")
    asyncio.run(agent.run())
```

### Map Script Counterpart (Event Bridge)

The map script acts as a thin bridge between player actions and the backend agent:

```javascript
// agent-bridge.js — map script that bridges player actions to the Room API
WA.onInit().then(() => {
    // Parse chat messages as commands and forward to backend
    WA.chat.onChatMessage((message) => {
        if (!message.startsWith('/agent ')) return;

        const parts = message.slice(7).trim().split(' ');
        const command = parts[0];
        const args = parts.slice(1).join(' ');

        WA.event.broadcast('myapp:chat-command', {
            command,
            args,
            player: WA.player.name,
        });
    });

    // Display backend agent replies in chat
    WA.event.on('myapp:agent-reply').subscribe((evt) => {
        WA.chat.sendChatMessage(evt.data.text, '🤖 Agent');
    });

    // Forward zone events to backend for tracking
    WA.room.onEnterLayer('meetingRoom').subscribe(() => {
        WA.event.broadcast('myapp:zone-event', {
            type: 'enter',
            zone: 'meetingRoom',
            player: WA.player.name,
        });
    });
});
```

### Best Practices for Backend Agents

| Practice | Why |
|----------|-----|
| Use gRPC streaming, not polling | `listenToEvent` and `listenVariable` are server-streaming RPCs — events arrive instantly |
| Keep events small (JSON under 1 KB) | Events are broadcast to all clients; large payloads waste bandwidth |
| Namespace all events with a prefix | `myapp:command` avoids collisions with other integrations |
| Handle gRPC reconnection | Network drops happen; wrap streams in retry loops with exponential backoff |
| Authenticate with `ROOM_API_SECRET_KEY` | Every gRPC call must include the secret in metadata |
| Use targeted broadcasts when possible | `targetUserIds` in `DispatchEventRequest` sends to specific players only |

---

## Pattern 4 — Agent via Admin API Webhooks

**When to use:** Your agent needs to react to map lifecycle events (creation, update, deletion) without maintaining a persistent gRPC connection.

```python
# webhook_handler.py — receives map change webhooks and triggers agent actions
from fastapi import FastAPI, Request, HTTPException
import httpx

app = FastAPI()

WEBHOOK_TOKEN = "your-webhook-api-token"
PUSHER_URL = "https://play.example.com"
ADMIN_TOKEN = "your-admin-api-token"


@app.post("/webhook/workadventure")
async def handle_webhook(request: Request):
    # Verify authenticity
    auth = request.headers.get("authorization", "").replace("Bearer ", "")
    if auth != WEBHOOK_TOKEN:
        raise HTTPException(403)

    body = await request.json()
    domain = body["domain"]
    map_path = body["mapPath"]
    action = body["action"]

    if action == "update":
        # Map was updated — notify players in the room
        async with httpx.AsyncClient() as client:
            await client.post(
                f"{PUSHER_URL}/message",
                headers={
                    "admin-token": ADMIN_TOKEN,
                    "Content-Type": "application/json",
                },
                json={
                    "playUri": f"/_/global/{domain}{map_path}",
                    "type": "ban",
                    "message": "Map updated! The room will refresh shortly.",
                },
            )

        # Trigger a room refresh to load new content
        async with httpx.AsyncClient() as client:
            await client.post(
                f"{PUSHER_URL}/room/refresh",
                headers={
                    "admin-token": ADMIN_TOKEN,
                    "Content-Type": "application/json",
                },
                json={"playUri": f"/_/global/{domain}{map_path}"},
            )

    elif action == "delete":
        # Map was deleted — log it, notify admins, etc.
        pass

    return {"status": "ok"}
```

---

## Pattern 5 — Hybrid: Script + Backend Agent

**When to use:** The most common production pattern. A lightweight map script handles UI and event routing, while a backend service handles LLM calls and business logic.

```
┌─ Browser ────────────────────────────────────────────┐
│                                                        │
│  Map Script (agent-bridge.js)                          │
│  ├─ WA.event.broadcast('myapp:user-msg', {...})        │
│  ├─ WA.event.on('myapp:agent-reply').subscribe(...)    │
│  ├─ WA.state.saveVariable('myapp:context', {...})      │
│  └─ WA.chat.sendChatMessage(reply, '🤖 Agent')        │
│       ↕ postMessage                                    │
│  Co-Website (chat-ui.html)                             │
│  └─ Rich chat UI + fetch to your backend               │
│                                                        │
└────────────────────────┬───────────────────────────────┘
                         │ WA.event / WA.state
┌────────────────────────▼───────────────────────────────┐
│  WorkAdventure Backend                                  │
│  └─ Room API gRPC (event relay + variable store)        │
└────────────────────────┬───────────────────────────────┘
                         │ gRPC stream
┌────────────────────────▼───────────────────────────────┐
│  Your Agent Backend                                     │
│  ├─ listenToEvent('myapp:user-msg') → process           │
│  ├─ LLM / RAG / Tools → generate reply                  │
│  ├─ broadcastEvent('myapp:agent-reply', reply)           │
│  └─ saveVariable('myapp:context', updatedContext)        │
└────────────────────────────────────────────────────────┘
```

### Full Working Hybrid Agent

**Step 1: Map script (event bridge)**

```javascript
// bridge.js — set as the map's "script" property
WA.onInit().then(async () => {
    // Initialize agent context
    if (!WA.state.loadVariable('myapp:initialized')) {
        await WA.state.saveVariable('myapp:initialized', true);
        await WA.state.saveVariable('myapp:visitor-count', 0);
        await WA.state.saveVariable('myapp:agent-context', {
            roomName: 'Main Hall',
            activeAgents: [],
            lastActivity: new Date().toISOString(),
        });
    }

    // Track player presence
    WA.players.configureTracking({ players: true, movement: false });
    WA.players.onPlayerEnters.subscribe((player) => {
        WA.event.broadcast('myapp:player-entered', {
            playerId: player.playerId,
            name: player.name,
            uuid: player.uuid,
        });
        WA.chat.sendChatMessage(`${player.name} entered the room`, '🤖 Agent');
    });
    WA.players.onPlayerLeaves.subscribe((player) => {
        WA.event.broadcast('myapp:player-left', {
            playerId: player.playerId,
            name: player.name,
        });
    });

    // Bridge chat commands to backend
    WA.chat.onChatMessage((message, { author }) => {
        if (message.startsWith('/agent ') || message.startsWith('@agent ')) {
            const text = message.replace(/^\/agent |^@agent /, '');
            WA.event.broadcast('myapp:user-msg', {
                text,
                playerName: WA.player.name,
                playerId: WA.player.playerId,
                timestamp: Date.now(),
            });
        }
    });

    // Display agent replies
    WA.event.on('myapp:agent-reply').subscribe((evt) => {
        const { text, type, targetPlayer } = evt.data;

        if (type === 'chat') {
            WA.chat.sendChatMessage(text, '🤖 Agent');
        } else if (type === 'popup') {
            const popup = WA.ui.openPopup('agentPopup', text, [
                { label: 'Got it', className: 'primary', callback: (p) => p.close() },
            ]);
            setTimeout(() => popup.close(), 10000);
        } else if (type === 'action') {
            WA.ui.displayActionMessage({
                message: text,
                callback: () => {
                    WA.event.broadcast('myapp:action-confirmed', {
                        action: text,
                        player: WA.player.name,
                    });
                },
            });
        } else if (type === 'banner') {
            WA.ui.banner.openBanner({
                id: 'agent-banner',
                text,
                bgColor: '#1a1a2e',
                textColor: '#ffffff',
                closable: true,
            });
        }
    });

    // Zone-triggered agent context
    WA.room.onEnterLayer('conferenceZone').subscribe(async () => {
        await WA.state.saveVariable('myapp:agent-context', {
            ...WA.state.loadVariable('myapp:agent-context'),
            currentZone: 'conference',
        });
    });

    // Notify agent that this player is ready
    WA.event.broadcast('myapp:player-ready', {
        name: WA.player.name,
        tags: WA.player.tags,
        isLogged: WA.player.isLogged,
    });

    console.log('Agent bridge initialized');
});
```

**Step 2: Backend agent (Python)**

```python
# hybrid_agent.py — connects via Room API gRPC
import grpc
import json
import asyncio
import room_api_pb2 as pb
import room_api_pb2_grpc as pb_grpc

ROOM = "/_/global/maps.example.com/map.json"
META = [("secretKey", "your-secret-key")]

class HybridAgent:
    def __init__(self):
        channel = grpc.insecure_channel("room-api.example.com:50051")
        self.stub = pb_grpc.RoomApiStub(channel)

    def _broadcast(self, event_name, data):
        from google.protobuf.struct_pb2 import Value
        val = Value(); val.string_value = json.dumps(data)
        self.stub.broadcastEvent(
            pb.DispatchEventRequest(room=ROOM, name=event_name, data=val),
            metadata=META,
        )

    async def handle_messages(self):
        stream = self.stub.listenToEvent(
            pb.EventRequest(room=ROOM, name="myapp:user-msg"),
            metadata=META,
        )
        for event in stream:
            data = json.loads(event.data.string_value)
            text = data.get("text", "")
            player = data.get("playerName", "Unknown")

            # Route to your LLM / logic here
            reply = await self.process_with_llm(text, player)

            self._broadcast("myapp:agent-reply", {
                "text": reply,
                "type": "chat",
                "targetPlayer": player,
            })

    async def handle_presence(self):
        stream = self.stub.listenToEvent(
            pb.EventRequest(room=ROOM, name="myapp:player-entered"),
            metadata=META,
        )
        for event in stream:
            data = json.loads(event.data.string_value)
            self._broadcast("myapp:agent-reply", {
                "text": f"Welcome, {data['name']}! Type /agent <message> to talk to me.",
                "type": "chat",
            })

    async def process_with_llm(self, text, player):
        # Replace with your actual LLM call
        return f"[Echo] {player}: {text}"

    async def run(self):
        await asyncio.gather(
            self.handle_messages(),
            self.handle_presence(),
        )

if __name__ == "__main__":
    asyncio.run(HybridAgent().run())
```

---

## State & Event Architecture

### Event Naming Convention

Use a structured naming scheme for events and variables to avoid collisions and improve discoverability:

```
{appId}:{domain}:{action}

Examples:
  myapp:chat:message
  myapp:player:enter
  myapp:quiz:answer
  myapp:agent:reply
  myapp:system:notification
```

### Variable Scoping Rules

| Variable Type | Scope | Persistence | API |
|---------------|-------|-------------|-----|
| `WA.state.*` | Room — all players | Persists across sessions (Redis) | `saveVariable`, `loadVariable`, `onVariableChange` |
| `WA.player.state.*` | Player — private | Persists for logged-in users | `saveVariable` with `public: true` to share |
| Room API variables | Room — backend | Same as `WA.state` | gRPC `saveVariable`, `readVariable`, `listenVariable` |

### State Design Best Practices

```javascript
// ✅ DO: Store compact, structured data
await WA.state.saveVariable('myapp:quiz', {
    currentQ: 0,
    scores: { alice: 3, bob: 2 },
    status: 'active',
});

// ❌ DON'T: Store large blobs or binary data
await WA.state.saveVariable('myapp:large-data', hugeArrayOf1000Items);

// ✅ DO: Use separate variables for separate concerns
await WA.state.saveVariable('myapp:quiz:state', quizState);
await WA.state.saveVariable('myapp:quiz:metadata', quizMeta);

// ❌ DON'T: Overwrite a single mega-variable
await WA.state.saveVariable('myapp:everything', { quiz, chat, users, config, ... });

// ✅ DO: React to state changes reactively
WA.state.onVariableChange('myapp:quiz:currentQ').subscribe((idx) => {
    renderQuestion(idx);
});

// ❌ DON'T: Poll state in a loop
setInterval(() => {
    const val = WA.state.loadVariable('myapp:quiz:currentQ');
    renderQuestion(val);
}, 1000);
```

---

## Phaser Sprite Integration

When your agent needs a visual in-world presence (a character players can see and click on), use the fictive player pattern from `AIAgentStore` and `AIAgentSpawner`.

### How It Works

```
AIAgentStore.registerAIAgent(config)
    │
    ├─► aiAgentsStore.addAgent(config)              // Svelte store update
    ├─► playersStore.addFacticePlayer(name)          // Creates phantom player with negative ID
    │       returns: userId (negative int)
    │
    └─► AIAgentSpawnSync (auto-subscribed to gameSceneStore)
            │
            └─► AIAgentSpawner.spawnOrUpdateAgent(scene, agent, slotIndex)
                    │
                    ├─► new RemotePlayer(userId, ...) // Phaser sprite
                    ├─► Sets isAIAgent flag
                    └─► Binds click → activeChatAgentStore.set(agentId)
```

### Creating a Custom Agent Sprite

```typescript
// Example: registering a custom agent with a visual presence
import {
    registerAIAgent,
    unregisterAIAgent,
    type AIAgentConfig,
} from "../Stores/AIAgentStore";

const myAgent: AIAgentConfig = {
    id: "guide-agent-001",
    name: "Guide Bot",
    enabled: true,
    responseStyle: "friendly",
    framework: "openclaw",
    provider: "OpenAI",
    model: "gpt-4o",
    skills: ["navigation", "greeting"],
    mcpTools: ["workadventure-map-reader", "workadventure-pathfinder"],
    harness: "openclaw-reactive",
    tasks: [
        {
            id: "task-greet",
            title: "Greet visitors",
            description: "Welcome new players at the entrance",
            status: "inProgress",
        },
    ],
};

registerAIAgent(myAgent);
// Agent now appears as a cat sprite near the local player
// Clicking it opens the agent chat sidebar
```

### Sprite Positioning

Agents are positioned in a row to the right of the local player, spaced by tile dimensions:

```typescript
// From AIAgentSpawner.ts:
function computeSpawnPosition(scene: GameScene, slotIndex: number) {
    const tile = scene.getGameMapFrontWrapper().getTileDimensions();
    const step = Math.max(tile.width, tile.height) * 2;
    return {
        x: currentPlayer.x + step * (slotIndex + 1),
        y: currentPlayer.y,
    };
}
```

To position agents at specific map locations instead, modify `AIAgentSpawner.spawnOrUpdateAgent()` to accept custom coordinates:

```typescript
// Custom positioning example:
const CUSTOM_POSITIONS: Record<string, { x: number; y: number }> = {
    "guide-agent-001": { x: 512, y: 384 },  // Specific map tile
    "quiz-agent-002": { x: 768, y: 640 },
};

// In AIAgentSpawner.spawnOrUpdateAgent, override position:
const customPos = CUSTOM_POSITIONS[agent.id];
const { x, y } = customPos ?? computeSpawnPosition(scene, slotIndex);
```

---

## Svelte Store Integration

The agent system is built on Svelte stores. Here's how to interact with them from custom components.

### Key Stores

```typescript
import {
    // Core
    aiAgentsStore,           // Map<string, AIAgentConfig> — agent registry
    aiAgentsEnabledStore,    // boolean — global toggle
    aiAgentFrameworkStore,   // AgenticFramework — selected framework

    // UI state
    agentsSidebarVisibleStore,  // boolean
    agentsSidebarWidthStore,    // number (pixels)
    activeChatAgentStore,       // string | null — which agent is in chat view

    // Chat
    aiAgentChatStore,         // Map<string, AIAgentMessage[]>

    // Connection
    frameworkConnectionsStore, // Map<AgenticFramework, FrameworkConnection>

    // Derived
    aiAgentsVisibleStore,     // boolean — true when enabled AND agents exist

    // Actions
    registerAIAgent,
    unregisterAIAgent,
    sendMessageToAgent,
    connectFramework,
    disconnectFramework,
    createDefaultAgent,
    createFrameworkDefaults,
    syncAgentsToTodoList,
} from "../Stores/AIAgentStore";
```

### Building a Custom Agent Panel

```svelte
<!-- CustomAgentPanel.svelte -->
<script lang="ts">
    import {
        aiAgentsStore,
        activeChatAgentStore,
        sendMessageToAgent,
    } from "../Stores/AIAgentStore";
    import { aiAgentChatStore } from "../Stores/AIAgentStore";

    let messageText = "";

    $activeAgentId = $activeChatAgentStore;
    $agents = Array.from($aiAgentsStore.values());
    $messages = $activeAgentId ? ($aiAgentChatStore.get($activeAgentId) ?? []) : [];

    function send() {
        if (!$activeAgentId || !messageText.trim()) return;
        sendMessageToAgent($activeAgentId, messageText.trim());
        messageText = "";
    }
</script>

<div class="panel">
    <h3>Select Agent</h3>
    {#each $agents as agent}
        <button
            class:active={$activeAgentId === agent.id}
            on:click={() => $activeChatAgentStore = agent.id}
        >
            {agent.name} ({agent.framework})
        </button>
    {/each}

    {#if $activeAgentId}
        <div class="chat">
            {#each $messages as msg}
                <div class="msg" class:user={msg.isUser}>
                    {msg.content}
                </div>
            {/each}
        </div>
        <input bind:value={messageText} on:keydown={(e) => e.key === 'Enter' && send()} />
        <button on:click={send}>Send</button>
    {/if}
</div>
```

### Mutual Exclusion Pattern

The agent sidebar and chat sidebar are mutually exclusive. Follow this pattern for any new sidebar:

```typescript
// When your custom sidebar opens:
agentsSidebarVisibleStore.set(true);
// This triggers ChatSidebar.svelte to close automatically

// When your custom sidebar closes:
agentsSidebarVisibleStore.set(false);
```

---

## MCP Tool Design Patterns

MCP tools are the bridge between AI agents and the WorkAdventure world. Each tool is a string identifier that maps to a capability.

### Naming Convention

```
workadventure-{domain}-{capability}

Examples:
  workadventure-map-reader       — Read map layout, tiles, zones
  workadventure-zone-watcher     — Subscribe to zone enter/exit
  workadventure-event-bus        — Publish/subscribe to world events
  workadventure-chat-history     — Access chat history
  workadventure-api-client       — Call room/space APIs
  workadventure-pathfinder       — Compute paths between positions
```

### Implementing a Custom MCP Tool

MCP tools are executed on the backend. Here's the planned pattern:

```typescript
// Planned: back/src/Services/AgentFramework/McpTools/MapReaderTool.ts

interface McpToolRequest {
    toolId: string;
    parameters: Record<string, unknown>;
}

interface McpToolResponse {
    success: boolean;
    data: unknown;
    error?: string;
}

class MapReaderTool {
    readonly id = "workadventure-map-reader";

    async execute(request: McpToolRequest): Promise<McpToolResponse> {
        const { roomUrl, layerName } = request.parameters;

        // Fetch the map from map storage
        const map = await this.fetchMap(roomUrl);

        if (layerName) {
            const layer = map.layers.find((l) => l.name === layerName);
            return { success: true, data: layer };
        }

        return { success: true, data: map };
    }

    private async fetchMap(roomUrl: string) {
        // Use map storage API to fetch the Tiled JSON
        const response = await fetch(`${MAP_STORAGE_URL}/${roomUrl}`);
        return response.json();
    }
}
```

### MCP Tool Registration (Planned)

```typescript
// Planned: back/src/Services/AgentFramework/McpToolRegistry.ts

class McpToolRegistry {
    private tools = new Map<string, McpTool>();

    register(tool: McpTool): void {
        this.tools.set(tool.id, tool);
    }

    async execute(toolId: string, params: Record<string, unknown>): Promise<McpToolResponse> {
        const tool = this.tools.get(toolId);
        if (!tool) {
            return { success: false, error: `Unknown tool: ${toolId}` };
        }
        return tool.execute({ toolId, parameters: params });
    }
}

// Register built-in tools
registry.register(new MapReaderTool());
registry.register(new ZoneWatcherTool());
registry.register(new EventBusTool());
registry.register(new ChatHistoryTool());
registry.register(new ApiClientTool());
registry.register(new PathfinderTool());
```

---

## Performance & Scalability

### Event Batching

When your agent needs to send many updates, batch them to avoid flooding the event bus:

```javascript
// ❌ DON'T: Send an event per tile change
for (const tile of changedTiles) {
    WA.event.broadcast('myapp:tile-update', tile);
}

// ✅ DO: Batch into a single event
WA.event.broadcast('myapp:tile-batch-update', { tiles: changedTiles });
```

### Variable Size Limits

Keep variables small. Recommended limits:

| Metric | Limit |
|--------|-------|
| Individual variable size | < 10 KB |
| Total variables per room | < 100 KB |
| Variable save rate | < 1 save per second |
| Event payload size | < 1 KB |
| Event broadcast rate | < 10 per second |

### Connection Management for Backend Agents

```python
# ✅ DO: Reconnect with exponential backoff
import grpc
import time

def create_connection_with_retry(target, max_retries=10):
    for attempt in range(max_retries):
        try:
            channel = grpc.insecure_channel(target)
            # Test connectivity
            grpc.channel_ready_future(channel).result(timeout=5)
            return channel
        except grpc.FutureTimeoutError:
            wait = min(2 ** attempt, 60)
            print(f"Connection failed, retrying in {wait}s...")
            time.sleep(wait)
    raise ConnectionError(f"Could not connect to {target}")
```

### Lazy Loading Co-Websites

Use `lazy: true` when opening co-websites to defer loading until the user actually needs them:

```javascript
const cowebsite = await WA.nav.openCoWebSite(
    'https://heavy-app.example.com',
    true,   // allowApi
    '',     // allowPolicy
    50,     // widthPercent
    0,      // position
    true,   // closable
    true    // lazy — don't load until visible
);
```

---

## Security Checklist

### Before Deploying Your Integration

- [ ] **Never expose API keys in browser code.** All LLM and service API calls go through your backend, not directly from iframes.
- [ ] **Validate all incoming events.** `WA.event.on()` receives data from any player. Validate structure and content before processing.
- [ ] **Use `targetUserIds` for targeted events.** Don't broadcast private data to all players.
- [ ] **Set `ROOM_API_SECRET_KEY` to a strong value.** Rotate it periodically.
- [ ] **Verify webhook tokens.** Always check the `Authorization: Bearer` header on webhook callbacks.
- [ ] **Restrict iframe domains.** Set `EMBEDDED_DOMAINS_WHITELIST` to only domains you control.
- [ ] **Use `openWebsiteAllowApi: true` sparingly.** Only enable it on layers that genuinely need the `WA` API.
- [ ] **Sanitize user input before broadcasting.** Events reach all connected clients — don't relay raw HTML or scripts.
- [ ] **Rate-limit variable saves.** Avoid tight loops calling `WA.state.saveVariable()`.
- [ ] **Use HTTPS in production.** All API calls, webhooks, and iframe URLs should use HTTPS.

### Framework API Key Security

```
┌─ Browser ──────────┐     ┌─ Pusher ─────────┐     ┌─ Back ────────────┐     ┌─ Framework ───┐
│                     │     │                    │     │                    │     │               │
│  Map Script         │     │  Validates JWT    │     │  Stores API keys  │     │  LLM Provider │
│  WA.event.broadcast │────►│  Routes to back   │────►│  Adds API key     │────►│  (OpenAI, etc)│
│  (no secrets here)  │     │                    │     │  Calls framework  │     │               │
└─────────────────────┘     └────────────────────┘     └────────────────────┘     └───────────────┘
                                                         ▲
                                                         │
                                              API keys stored here
                                              (OPENCLAW_API_KEY, etc.)
                                              NEVER in browser code
```

---

## Testing Your Integration

### Manual Testing Checklist

1. Load your map and verify the script initializes (`WA.onInit()`)
2. Test zone enter/leave triggers (`WA.room.onEnterLayer`)
3. Send a chat command and verify the event is broadcast (`WA.event.broadcast`)
4. Check that the backend agent receives the event (gRPC streaming)
5. Verify the reply arrives back in the game (`WA.event.on`)
6. Test with multiple players in the same room
7. Disconnect a player, reconnect, and verify state resyncs (`WA.state.onVariableChange`)
8. Test co-website open/close lifecycle
9. Verify cleanup when leaving the map (subscriptions, co-websites, sprites)

### Automated Testing with the E2E Framework

```bash
# Run the existing E2E test suite
cd tests && npm run test-headed-chrome -- tests/<file>.ts
```

### Mock Agent for Development

Use the built-in mock system during development. The `sendMessageToAgent()` function in `AIAgentStore.ts` returns mock responses based on `responseStyle`:

```typescript
// Mock responses are keyed by responseStyle:
// "friendly"  → ["Hello! How can I help you today?", ...]
// "professional" → ["How can I assist you?", ...]
// "casual" → ["Hey! What's up?", ...]
```

To test with mock agents without a backend:

```typescript
import {
    aiAgentsEnabledStore,
    createFrameworkDefaults,
    registerAIAgent,
    connectFramework,
    agentsSidebarVisibleStore,
} from "../Stores/AIAgentStore";

// Enable agents
aiAgentsEnabledStore.set(true);

// Create mock agents for a framework
const agents = createFrameworkDefaults("openclaw");
agents.forEach(registerAIAgent);

// Simulate framework connection
await connectFramework("openclaw");

// Show the sidebar
agentsSidebarVisibleStore.set(true);
```

---

## Complete Working Examples

### Example 1: Poll/Voting System with Backend Tallying

**Map script:**

```javascript
// poll.js
WA.onInit().then(async () => {
    // Initialize poll if not exists
    if (!WA.state.loadVariable('myapp:poll:active')) {
        await WA.state.saveVariable('myapp:poll:active', true);
        await WA.state.saveVariable('myapp:poll:question', 'What session should we add?');
        await WA.state.saveVariable('myapp:poll:options', {
            'AI Ethics': 0,
            'WebXR Workshop': 0,
            'Open Source Panel': 0,
        });
    }

    // Show voting UI when entering the voting zone
    WA.room.onEnterLayer('votingBooth').subscribe(async () => {
        const question = WA.state.loadVariable('myapp:poll:question');
        const options = WA.state.loadVariable('myapp:poll:options');

        const buttons = Object.keys(options).map((option) => ({
            label: `${option} (${options[option]} votes)`,
            className: 'normal',
            callback: async (popup) => {
                WA.event.broadcast('myapp:poll:vote', {
                    option,
                    voter: WA.player.name,
                });
                popup.close();
                WA.chat.sendChatMessage(`You voted for: ${option}`, '🗳️ Poll');
            },
        }));

        WA.ui.openPopup('votingPopup', question, buttons);
    });

    // Update popup when votes change
    WA.state.onVariableChange('myapp:poll:options').subscribe((options) => {
        // In a real app, you'd update the popup buttons here
        const total = Object.values(options).reduce((a, b) => a + b, 0);
        WA.chat.sendChatMessage(`Total votes: ${total}`, '🗳️ Poll');
    });
});
```

**Backend tallying agent:**

```python
# poll_agent.py — tallies votes via Room API
async def run(self):
    stream = self.stub.listenToEvent(
        pb.EventRequest(room=ROOM, name="myapp:poll:vote"),
        metadata=META,
    )
    for event in stream:
        data = json.loads(event.data.string_value)
        option = data["option"]
        voter = data["playerName"]

        # Read current votes
        current = await self.read_variable("myapp:poll:options")
        current[option] = current.get(option, 0) + 1

        # Save updated votes
        await self.save_variable("myapp:poll:options", current)

        # Broadcast updated totals
        self._broadcast("myapp:poll:updated", {
            "options": current,
            "lastVote": {"option": option, "voter": voter},
        })
```

### Example 2: Live Translation Agent

```javascript
// translate.js — bridges chat messages to a translation backend
WA.onInit().then(() => {
    WA.event.on('myapp:translate:request').subscribe(async (evt) => {
        const { text, targetLang, requester } = evt.data;

        // Show "translating..." indicator
        WA.ui.displayActionMessage({ message: `Translating to ${targetLang}...` });

        // The backend agent handles the actual translation
        // It will broadcast myapp:translate:result when done
    });

    // Display translation results
    WA.event.on('myapp:translate:result').subscribe((evt) => {
        const { original, translated, targetLang } = evt.data;
        WA.chat.sendChatMessage(
            `[${targetLang}] ${translated}`,
            '🌐 Translator'
        );
    });

    // Command: /translate es Hello world
    WA.chat.onChatMessage((message) => {
        if (!message.startsWith('/translate ')) return;
        const parts = message.slice(11).split(' ');
        const targetLang = parts[0];
        const text = parts.slice(1).join(' ');

        WA.event.broadcast('myapp:translate:request', {
            text,
            targetLang,
            requester: WA.player.name,
        });
    });
});
```

### Example 3: Autonomous Patrol Agent

A backend agent that monitors player density across rooms and dynamically opens/closes areas:

```python
# patrol_agent.py
import grpc, json, asyncio
import room_api_pb2 as pb
import room_api_pb2_grpc as pb_grpc
import httpx

PUSHER = "https://play.example.com"
ADMIN_TOKEN = "your-admin-token"
ROOM_API = "room-api.example.com:50051"
SECRET = "your-secret"
META = [("secretKey", SECRET)]

async def patrol_loop():
    channel = grpc.insecure_channel(ROOM_API)
    stub = pb_grpc.RoomApiStub(channel)

    while True:
        # Get room list via admin API
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{PUSHER}/rooms",
                headers={"admin-token": ADMIN_TOKEN},
            )
            rooms = resp.json()

        # Analyze density
        for room in rooms:
            count = room.get("userCount", 0)
            room_url = room.get("roomUrl", "")

            if count > 20:
                # Crowded — broadcast advisory
                from google.protobuf.struct_pb2 import Value
                val = Value()
                val.string_value = json.dumps({
                    "text": f"This area is busy ({count} people). Check out the overflow room!",
                    "type": "banner",
                })
                stub.broadcastEvent(
                    pb.DispatchEventRequest(
                        room=room_url,
                        name="myapp:agent-reply",
                        data=val,
                    ),
                    metadata=META,
                )

        await asyncio.sleep(60)  # Check every minute

asyncio.run(patrol_loop())
```

---

## Quick Reference: Event Bridge Cheat Sheet

Use this table to pick the right API for each agent communication need:

| Need | Client → Server | Server → Client | API |
|------|----------------|-----------------|-----|
| Send data to backend | `WA.event.broadcast('ns:event', data)` | — | Event bus |
| Receive data from backend | — | `RoomApi.broadcastEvent()` → `WA.event.on('ns:event')` | Event bus |
| Persist room state | `WA.state.saveVariable('ns:key', val)` | `RoomApi.saveVariable()` | Variables |
| React to state change | `WA.state.onVariableChange('ns:key')` | `RoomApi.listenVariable()` | Variables |
| Track players | `WA.players.onPlayerEnters` | — | Players API |
| Track zones | `WA.room.onEnterLayer('name')` | — | Room API |
| Send chat from bot | `WA.chat.sendChatMessage(text, author)` | — | Chat API |
| Receive chat | `WA.chat.onChatMessage(cb)` | — | Chat API |
| Open agent UI | `WA.nav.openCoWebSite(url, true, ...)` | — | Nav API |
| Show popup | `WA.ui.openPopup(...)` | — | UI API |
| Show banner | `WA.ui.banner.openBanner(...)` | — | UI API |
| Control player | `WA.player.moveTo(x, y)` | — | Player API |
| Cross-room voice | `WA.spaces.joinSpace(name, ...)` | — | Spaces API |
| Backend→all rooms | — | `POST /global/event` (admin) | Admin REST |
| Backend→one room | — | `POST /message` (admin) | Admin REST |
| Kick users | — | `POST /room/refresh` (admin) | Admin REST |

---

*This document references patterns from the [External Integration Guide](./external-integration-guide.md), the [AI Agents Integration Plan](./ai-agents-integration-plan.md), and the [Map Scripting API Reference](./map-scripting/references/). Refer to those documents for complete API signatures and configuration details.*

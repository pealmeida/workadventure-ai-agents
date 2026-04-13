import { writable, derived, get } from "svelte/store";

import type { TodoTaskInterface } from "@workadventure/shared-utils";
import { AIAgentSpawner } from "../Phaser/Game/AIAgentSpawner";
import { todoListsStore } from "./TodoListStore";
import { playersStore } from "./PlayersStore";
import { localUserStore } from "../Connection/LocalUserStore";

export const INITIAL_AGENTS_SIDEBAR_WIDTH = 335;

export type AgenticFramework = "openclaw" | "langchain" | "hermes" | "crewai";

export const AGENTIC_FRAMEWORKS: AgenticFramework[] = ["openclaw", "langchain", "hermes", "crewai"];

export type FrameworkConnectionStatus = "connected" | "disconnected" | "connecting" | "error";

export interface FrameworkConnection {
    framework: AgenticFramework;
    status: FrameworkConnectionStatus;
    endpoint?: string;
    version?: string;
    lastPing?: Date;
}

export interface AIAgentConfig {
    id: string;
    name: string;
    enabled: boolean;
    responseStyle: "friendly" | "professional" | "casual";
    framework: AgenticFramework;
    provider?: string;
    model?: string;
    skills: string[];
    mcpTools: string[];
    harness?: string;
    tasks: AIAgentTask[];
    userId?: number;
}

export interface AIAgentTask {
    id: string;
    title: string;
    description: string;
    status: "notStarted" | "inProgress" | "completed";
    startedAt?: Date;
}

function createAIAgentStore() {
    const agents = new Map<string, AIAgentConfig>();
    const { subscribe, update } = writable<Map<string, AIAgentConfig>>(agents);

    return {
        subscribe,
        addAgent: (agent: AIAgentConfig) => {
            update((a) => {
                a.set(agent.id, agent);
                return a;
            });
        },
        removeAgent: (agentId: string) => {
            update((a) => {
                a.delete(agentId);
                return a;
            });
        },
        updateAgent: (agentId: string, updates: Partial<AIAgentConfig>) => {
            update((a) => {
                const agent = a.get(agentId);
                if (agent) {
                    a.set(agentId, { ...agent, ...updates });
                }
                return a;
            });
        },
        addTask: (agentId: string, task: AIAgentTask) => {
            update((a) => {
                const agent = a.get(agentId);
                if (agent) {
                    agent.tasks.push(task);
                    a.set(agentId, agent);
                }
                return a;
            });
        },
        updateTask: (agentId: string, taskId: string, updates: Partial<AIAgentTask>) => {
            update((a) => {
                const agent = a.get(agentId);
                if (agent) {
                    const taskIndex = agent.tasks.findIndex((t) => t.id === taskId);
                    if (taskIndex !== -1) {
                        agent.tasks[taskIndex] = { ...agent.tasks[taskIndex], ...updates };
                        a.set(agentId, agent);
                    }
                }
                return a;
            });
        },
        removeTask: (agentId: string, taskId: string) => {
            update((a) => {
                const agent = a.get(agentId);
                if (agent) {
                    agent.tasks = agent.tasks.filter((t) => t.id !== taskId);
                    a.set(agentId, agent);
                }
                return a;
            });
        },
        getAgent: (agentId: string): AIAgentConfig | undefined => {
            return get({ subscribe }).get(agentId);
        },
        getAllAgents: (): AIAgentConfig[] => {
            return Array.from(get({ subscribe }).values());
        },
    };
}

export const aiAgentsStore = createAIAgentStore();

export const aiAgentsEnabledStore = writable(false);

export const aiAgentFrameworkStore = writable<AgenticFramework>(
    localUserStore.getAIAgentFramework()
);

// eslint-disable-next-line svelte/no-ignored-unsubscribe
aiAgentFrameworkStore.subscribe((value) => {
    localUserStore.setAIAgentFramework(value);
});

export const frameworkConnectionsStore = writable<Map<AgenticFramework, FrameworkConnection>>(
    new Map(AGENTIC_FRAMEWORKS.map((fw) => [
        fw,
        { framework: fw, status: "disconnected" as FrameworkConnectionStatus },
    ]))
);

export function updateFrameworkConnection(
    framework: AgenticFramework,
    updates: Partial<FrameworkConnection>
): void {
    frameworkConnectionsStore.update((map) => {
        const existing = map.get(framework);
        if (existing) {
            map.set(framework, { ...existing, ...updates });
        }
        return map;
    });
}

export async function connectFramework(framework: AgenticFramework): Promise<boolean> {
    updateFrameworkConnection(framework, { status: "connecting" });
    await new Promise<void>((resolve) => { setTimeout(resolve, 800 + Math.random() * 600); });
    const success = Math.random() > 0.15;
    if (success) {
        updateFrameworkConnection(framework, {
            status: "connected",
            version: "1.0.0",
            lastPing: new Date(),
        });
    } else {
        updateFrameworkConnection(framework, { status: "error" });
    }
    return success;
}

export function disconnectFramework(framework: AgenticFramework): void {
    updateFrameworkConnection(framework, { status: "disconnected", version: undefined, lastPing: undefined });
}

export const activeChatAgentStore = writable<string | null>(null);

export const agentsSidebarVisibleStore = writable(false);

export const agentsSidebarWidthStore = writable(localUserStore.getAgentsSideBarWidth());

// eslint-disable-next-line svelte/no-ignored-unsubscribe
agentsSidebarWidthStore.subscribe((value) => {
    localUserStore.setAgentsSideBarWidth(value);
});

export interface AIAgentMessage {
    id: string;
    agentId: string;
    content: string;
    timestamp: Date;
    isUser: boolean;
}

function createChatStore() {
    const messages = new Map<string, AIAgentMessage[]>();
    const { subscribe, update } = writable<Map<string, AIAgentMessage[]>>(messages);

    return {
        subscribe,
        addMessage: (agentId: string, message: AIAgentMessage) => {
            update((msgs) => {
                const agentMsgs = msgs.get(agentId) || [];
                agentMsgs.push(message);
                msgs.set(agentId, agentMsgs);
                return msgs;
            });
        },
        getMessages: (agentId: string): AIAgentMessage[] => {
            return get({ subscribe }).get(agentId) || [];
        },
        clearMessages: (agentId: string) => {
            update((msgs) => {
                msgs.delete(agentId);
                return msgs;
            });
        },
    };
}

export const aiAgentChatStore = createChatStore();

const MOCK_RESPONSES: Record<string, string[]> = {
    friendly: [
        "Hello! How can I help you today?",
        "That's a great question! Let me think...",
        "I'm here to help! What would you like to know?",
        "Sure, I'd be happy to assist with that!",
    ],
    professional: [
        "How can I assist you?",
        "Let me provide you with the relevant information.",
        "I'm available to help with your inquiry.",
        "Please specify what you need assistance with.",
    ],
    casual: [
        "Hey! What's up?",
        "Oh, that's cool! Want to know more?",
        "Sure thing! Here's the deal...",
        "Got it! Anything else you need?",
    ],
};

function getMockResponse(style: "friendly" | "professional" | "casual"): string {
    const responses = MOCK_RESPONSES[style];
    return responses[Math.floor(Math.random() * responses.length)];
}

export function sendMessageToAgent(agentId: string, content: string): void {
    const agent = aiAgentsStore.getAgent(agentId);
    if (!agent) return;

    const userMessage: AIAgentMessage = {
        id: `msg-${Date.now()}`,
        agentId,
        content,
        timestamp: new Date(),
        isUser: true,
    };
    aiAgentChatStore.addMessage(agentId, userMessage);

    setTimeout(() => {
        const agentMessage: AIAgentMessage = {
            id: `msg-${Date.now()}`,
            agentId,
            content: getMockResponse(agent.responseStyle),
            timestamp: new Date(),
            isUser: false,
        };
        aiAgentChatStore.addMessage(agentId, agentMessage);
    }, 500 + Math.random() * 1000);
}

export const aiAgentsVisibleStore = derived(
    [aiAgentsEnabledStore, aiAgentsStore],
    ([$enabled, $agents]) => {
        return $enabled && $agents.size > 0;
    }
);

const FRAMEWORK_DEFAULT_AGENTS: Record<
    AgenticFramework,
    {
        name: string;
        provider: string;
        model: string;
        skills: string[];
        mcpTools: string[];
        harness: string;
        tasks: { title: string; description: string }[];
    }[]
> = {
    openclaw: [
        {
            name: "Claw Scout",
            provider: "OpenAI",
            model: "gpt-4o",
            skills: ["map-exploration", "reasoning", "anomaly-detection"],
            mcpTools: ["workadventure-map-reader", "workadventure-zone-watcher"],
            harness: "openclaw-autonomous",
            tasks: [
                { title: "Patrol the map", description: "Autonomously explore and report map activity" },
                { title: "Claw response", description: "Respond to user queries using OpenClaw reasoning" },
            ],
        },
        {
            name: "Claw Sentinel",
            provider: "OpenAI",
            model: "gpt-4o-mini",
            skills: ["monitoring", "summarization", "alerting"],
            mcpTools: ["workadventure-zone-watcher", "workadventure-event-bus"],
            harness: "openclaw-reactive",
            tasks: [
                { title: "Monitor zone events", description: "Watch for zone enter/exit triggers" },
                { title: "Summarize activity", description: "Provide periodic summaries of world events" },
            ],
        },
    ],
    langchain: [
        {
            name: "Chain Router",
            provider: "Anthropic",
            model: "claude-sonnet-4-20250514",
            skills: ["query-routing", "chain-orchestration", "memory-recall"],
            mcpTools: ["langchain-retriever", "workadventure-chat-history"],
            harness: "langgraph-stateful",
            tasks: [
                { title: "Route user queries", description: "Classify and dispatch queries via LangChain chains" },
                { title: "Memory recall", description: "Retrieve conversation context from shared memory" },
            ],
        },
        {
            name: "Chain Worker",
            provider: "Anthropic",
            model: "claude-sonnet-4-20250514",
            skills: ["tool-execution", "streaming", "code-generation"],
            mcpTools: ["langchain-tool-executor", "workadventure-api-client"],
            harness: "langgraph-tool-node",
            tasks: [
                { title: "Execute tool calls", description: "Run LangChain tools on behalf of users" },
                { title: "Stream responses", description: "Deliver streaming LLM responses to chat" },
            ],
        },
    ],
    hermes: [
        {
            name: "Hermes Guide",
            provider: "Google",
            model: "gemini-2.5-pro",
            skills: ["navigation", "context-synthesis", "spatial-awareness"],
            mcpTools: ["hermes-room-index", "workadventure-pathfinder"],
            harness: "hermes-reactive",
            tasks: [
                { title: "Navigate spaces", description: "Guide users between rooms and spaces" },
                { title: "Context synthesis", description: "Synthesize multi-agent outputs into coherent replies" },
            ],
        },
        {
            name: "Hermes Messenger",
            provider: "Google",
            model: "gemini-2.5-flash",
            skills: ["message-relay", "broadcasting", "notification"],
            mcpTools: ["hermes-pubsub", "workadventure-event-bus"],
            harness: "hermes-pubsub",
            tasks: [
                { title: "Relay messages", description: "Forward messages between agents and users" },
                { title: "Broadcast alerts", description: "Send system-wide notifications" },
            ],
        },
    ],
    crewai: [
        {
            name: "Crew Lead",
            provider: "OpenAI",
            model: "gpt-4o",
            skills: ["delegation", "aggregation", "planning"],
            mcpTools: ["crewai-task-manager", "workadventure-api-client"],
            harness: "crewai-sequential",
            tasks: [
                { title: "Delegate tasks", description: "Assign sub-tasks to crew members" },
                { title: "Aggregate results", description: "Collect and merge crew outputs" },
            ],
        },
        {
            name: "Crew Researcher",
            provider: "OpenAI",
            model: "gpt-4o-mini",
            skills: ["research", "report-writing", "data-extraction"],
            mcpTools: ["crewai-knowledge-base", "workadventure-map-reader"],
            harness: "crewai-researcher",
            tasks: [
                { title: "Gather information", description: "Research topics using available tools" },
                { title: "Draft reports", description: "Produce structured reports from findings" },
            ],
        },
    ],
};

export function createDefaultAgent(
    name: string = "Assistant",
    framework: AgenticFramework = "openclaw"
): AIAgentConfig {
    const id = `agent-${Date.now()}`;
    return {
        id,
        name,
        enabled: true,
        responseStyle: "friendly",
        framework,
        provider: "OpenAI",
        model: "gpt-4o",
        skills: [],
        mcpTools: [],
        harness: "default",
        tasks: [
            {
                id: `${id}-task-1`,
                title: "Welcome new users",
                description: "Greet users when they enter the virtual world",
                status: "notStarted",
            },
            {
                id: `${id}-task-2`,
                title: "Answer questions",
                description: "Respond to user questions about the environment",
                status: "notStarted",
            },
        ],
    };
}

export function createFrameworkDefaults(framework: AgenticFramework): AIAgentConfig[] {
    const definitions = FRAMEWORK_DEFAULT_AGENTS[framework];
    return definitions.map((def, i) => {
        const id = `agent-${framework}-${Date.now()}-${i}`;
        return {
            id,
            name: def.name,
            enabled: true,
            responseStyle: "friendly" as const,
            framework,
            provider: def.provider,
            model: def.model,
            skills: def.skills,
            mcpTools: def.mcpTools,
            harness: def.harness,
            tasks: def.tasks.map((t, j) => ({
                id: `${id}-task-${j}`,
                title: t.title,
                description: t.description,
                status: "notStarted" as const,
            })),
        };
    });
}

export function registerAIAgent(agent: AIAgentConfig): void {
    aiAgentsStore.addAgent(agent);

    if (agent.enabled) {
        const userId = playersStore.addFacticePlayer(agent.name);
        aiAgentsStore.updateAgent(agent.id, { userId });
    }
}

export function unregisterAIAgent(agentId: string): void {
    const agent = aiAgentsStore.getAgent(agentId);
    if (agent) {
        AIAgentSpawner.removeAgent(agentId);
        if (agent.userId !== undefined) {
            playersStore.removeFacticePlayer(agent.userId);
        }
        aiAgentsStore.removeAgent(agentId);
        if (get(activeChatAgentStore) === agentId) {
            activeChatAgentStore.set(null);
        }
    }
}

export function syncAgentsToTodoList(): void {
    const agentsList = aiAgentsStore.getAllAgents();
    const enabledAgents = agentsList.filter((a) => a.enabled);

    todoListsStore.update((lists) => {
        lists.set("ai-agents", {
            id: "ai-agents",
            title: "AI AgentsTasks",
            tasks: enabledAgents.flatMap((agent) =>
                agent.tasks.map(
                    (task) =>
                        ({
                            id: task.id,
                            title: `[${agent.name}] ${task.title}`,
                            status: task.status,
                            description: task.description,
                        }) satisfies TodoTaskInterface
                )
            ),
        });
        return lists;
    });
}

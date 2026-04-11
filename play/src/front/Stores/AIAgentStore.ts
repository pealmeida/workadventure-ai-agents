import { writable, derived, get } from "svelte/store";
import type { Writable } from "svelte/store";
import type { TodoTaskInterface } from "@workadventure/shared-utils";
import { todoListsStore } from "./TodoListStore";
import { playersStore } from "./PlayersStore";
import { AIAgentSpawner } from "../Phaser/Game/AIAgentSpawner";

export interface AIAgentConfig {
    id: string;
    name: string;
    enabled: boolean;
    responseStyle: "friendly" | "professional" | "casual";
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
    const { subscribe, set, update } = writable<Map<string, AIAgentConfig>>(agents);

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
                        agent.tasks[tIndex] = { ...agent.tasks[tIndex], ...updates };
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

export const activeChatAgentStore = writable<string | null>(null);

export interface AIAgentMessage {
    id: string;
    agentId: string;
    content: string;
    timestamp: Date;
    isUser: boolean;
}

function createChatStore() {
    const messages = new Map<string, AIAgentMessage[]>();
    const { subscribe, set, update } = writable<Map<string, AIAgentMessage[]>>(messages);

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

export function createDefaultAgent(name: string = "Assistant"): AIAgentConfig {
    const id = `agent-${Date.now()}`;
    return {
        id,
        name,
        enabled: true,
        responseStyle: "friendly",
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

export function registerAIAgent(agent: AIAgentConfig): void {
    aiAgentsStore.addAgent(agent);

    if (agent.enabled) {
        const userId = playersStore.addFacticePlayer(agent.name);
        aiAgentsStore.updateAgent(agent.id, { userId });
        AIAgentSpawner.spawnAgent(agent);
    }
}

export function unregisterAIAgent(agentId: string): void {
    const agent = aiAgentsStore.getAgent(agentId);
    if (agent) {
        AIAgentSpawner.removeAgent(agentId);
        aiAgentsStore.removeAgent(agentId);
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
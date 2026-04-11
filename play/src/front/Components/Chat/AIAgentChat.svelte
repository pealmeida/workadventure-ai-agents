<script lang="ts">
    import { fly } from "svelte/transition";
    import { LL } from "../../i18n/i18n-svelte";
    import {
        aiAgentsStore,
        activeChatAgentStore,
        aiAgentChatStore,
        sendMessageToAgent,
        type AIAgentMessage,
    } from "../../Stores/AIAgentStore";
    import { onMount } from "svelte";

    let currentAgentId: string | null = null;
    let messages: AIAgentMessage[] = [];
    let inputMessage = "";
    let chatContainer: HTMLDivElement;

    activeChatAgentStore.subscribe((value) => {
        currentAgentId = value;
        if (value) {
            messages = aiAgentChatStore.getMessages(value);
        }
    });

    aiAgentChatStore.subscribe((msgs) => {
        if (currentAgentId) {
            messages = msgs.get(currentAgentId) || [];
        }
    });

    function closeChat() {
        activeChatAgentStore.set(null);
    }

    function sendMessage() {
        if (!inputMessage.trim() || !currentAgentId) return;
        sendMessageToAgent(currentAgentId, inputMessage);
        inputMessage = "";
    }

    function onKeyDown(event: KeyboardEvent) {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
        }
    }

    function selectAgent(agentId: string) {
        activeChatAgentStore.set(agentId);
        messages = aiAgentChatStore.getMessages(agentId);
    }

    $: agents = Array.from($aiAgentsStore.values()).filter((a) => a.enabled);
</script>

{#if currentAgentId}
    <div
        class="ai-agent-chat"
        transition:fly={{ y: 200, duration: 300 }}
    >
        <div class="chat-header">
            <button class="back-btn" on:click={closeChat}>←</button>
            <span class="agent-name">
                {$aiAgentsStore.get(currentAgentId)?.name || "Agent"}
            </span>
            <button class="close-btn" on:click={closeChat}>✕</button>
        </div>

        <div class="chat-messages" bind:this={chatContainer}>
            {#if messages.length === 0}
                <div class="empty-chat">
                    {$LL.menu.aiAgents.chatEmpty() ?? "Start a conversation..."}
                </div>
            {:else}
                {#each messages as msg (msg.id)}
                    <div class="message" class:user={msg.isUser} class:agent={!msg.isUser}>
                        <div class="message-content">{msg.content}</div>
                        <div class="message-time">
                            {msg.timestamp.toLocaleTimeString()}
                        </div>
                    </div>
                {/each}
            {/if}
        </div>

        <div class="chat-input">
            <input
                type="text"
                bind:value={inputMessage}
                on:keydown={onKeyDown}
                placeholder={$LL.menu.aiAgents.typeMessage() ?? "Type a message..."}
            />
            <button on:click={sendMessage} disabled={!inputMessage.trim()}>→</button>
        </div>
    </div>
{:else}
    <div
        class="ai-agent-list"
        transition:fly={{ y: 200, duration: 300 }}
    >
        <div class="list-header">
            <span>{$LL.menu.aiAgents.selectAgent() ?? "Select an Agent"}</span>
        </div>

        <div class="agent-items">
            {#each agents as agent (agent.id)}
                <button
                    class="agent-item"
                    on:click={() => selectAgent(agent.id)}
                >
                    <span class="agent-avatar">🤖</span>
                    <span class="agent-name">{agent.name}</span>
                    <span class="agent-status">
                        {agent.enabled ? "●" : "○"}
                    </span>
                </button>
            {/each}

            {#if agents.length === 0}
                <div class="no-agents">
                    {$LL.menu.aiAgents.noAgents() ?? "No AI agents available"}
                </div>
            {/if}
        </div>
    </div>
{/if}

<style>
    .ai-agent-chat,
    .ai-agent-list {
        position: fixed;
        bottom: 80px;
        right: 20px;
        width: 320px;
        height: 400px;
        background: #1a1a2e;
        border: 1px solid #4a4a6a;
        border-radius: 12px;
        display: flex;
        flex-direction: column;
        z-index: 1000;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
    }

    .chat-header,
    .list-header {
        padding: 12px 16px;
        background: #16213e;
        border-radius: 12px 12px 0 0;
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 1px solid #4a4a6a;
    }

    .back-btn,
    .close-btn {
        background: none;
        border: none;
        color: #fff;
        cursor: pointer;
        font-size: 18px;
        padding: 4px 8px;
    }

    .chat-messages {
        flex: 1;
        overflow-y: auto;
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .message {
        max-width: 80%;
        padding: 8px 12px;
        border-radius: 12px;
        font-size: 14px;
    }

    .message.user {
        align-self: flex-end;
        background: #4a4a6a;
    }

    .message.agent {
        align-self: flex-start;
        background: #2a2a4e;
    }

    .message-time {
        font-size: 10px;
        opacity: 0.6;
        margin-top: 4px;
    }

    .chat-input {
        padding: 12px;
        border-top: 1px solid #4a4a6a;
        display: flex;
        gap: 8px;
    }

    .chat-input input {
        flex: 1;
        padding: 8px 12px;
        border-radius: 8px;
        background: #2a2a4e;
        border: 1px solid #4a4a6a;
        color: #fff;
    }

    .chat-input button {
        padding: 8px 16px;
        border-radius: 8px;
        background: #4a4a6a;
        color: #fff;
        border: none;
        cursor: pointer;
    }

    .chat-input button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .agent-items {
        flex: 1;
        overflow-y: auto;
        padding: 8px;
    }

    .agent-item {
        width: 100%;
        padding: 12px;
        background: #2a2a4e;
        border: 1px solid #4a4a6a;
        border-radius: 8px;
        margin-bottom: 8px;
        display: flex;
        align-items: center;
        gap: 12px;
        cursor: pointer;
        color: #fff;
    }

    .agent-item:hover {
        background: #3a3a5e;
    }

    .empty-chat,
    .no-agents {
        text-align: center;
        padding: 20px;
        opacity: 0.6;
    }
</style>
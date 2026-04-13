<script lang="ts">
    import { onDestroy } from "svelte";
    import { fly } from "svelte/transition";
    import {
        agentsSidebarVisibleStore,
        agentsSidebarWidthStore,
        INITIAL_AGENTS_SIDEBAR_WIDTH,
        aiAgentsStore,
        activeChatAgentStore,
        aiAgentChatStore,
        sendMessageToAgent,
    } from "../../Stores/AIAgentStore";
    import { isMediaBreakpointUp } from "../../Utils/BreakpointsUtils";
    import { chatVisibilityStore } from "../../Stores/ChatStore";
    import { IconX } from "@wa-icons";
    import LL from "../../../i18n/i18n-svelte";

    type View = "list" | "chat" | "settings";

    let sideBarWidth: number = 335;
    let currentView: View = "list";
    let selectedAgentId: string | null = null;
    let inputMessage = "";
    let chatContainer: HTMLDivElement;
    let editName = "";

    onDestroy(
        chatVisibilityStore.subscribe((visible) => {
            if (visible) {
                agentsSidebarVisibleStore.set(false);
            }
        })
    );

    const isRTL: boolean = document.documentElement.dir === "rtl";

    $: agents = Array.from($aiAgentsStore.values()).filter((a) => a.enabled);

    $: selectedAgent = selectedAgentId ? $aiAgentsStore.get(selectedAgentId) : null;
    $: messages = selectedAgentId ? $aiAgentChatStore.get(selectedAgentId) ?? [] : [];

    function closeSidebar() {
        agentsSidebarVisibleStore.set(false);
        activeChatAgentStore.set(null);
        currentView = "list";
        selectedAgentId = null;
    }

    function selectAgent(agentId: string) {
        selectedAgentId = agentId;
        activeChatAgentStore.set(agentId);
        currentView = "chat";
        const agent = $aiAgentsStore.get(agentId);
        if (agent) {
            editName = agent.name;
        }
    }

    function showSettings() {
        currentView = "settings";
    }

    function backToList() {
        currentView = "list";
        selectedAgentId = null;
        activeChatAgentStore.set(null);
    }

    function backToChat() {
        currentView = "chat";
    }

    function sendMessage() {
        if (!inputMessage.trim() || !selectedAgentId) return;
        sendMessageToAgent(selectedAgentId, inputMessage);
        inputMessage = "";
        setTimeout(() => {
            if (chatContainer) {
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }
        }, 100);
    }

    function onKeyDown(event: KeyboardEvent) {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
        }
    }

    function updateAgentName() {
        if (selectedAgentId && editName.trim()) {
            aiAgentsStore.updateAgent(selectedAgentId, { name: editName.trim() });
        }
    }

    function reposition() {
        sideBarWidth = sideBarWidth;
    }

    const handleMousedown = (e: MouseEvent) => {
        let dragX = e.clientX;
        const initialWidth = sideBarWidth;

        document.onmousemove = (e) => {
            const vw = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
            const diff = e.clientX - dragX;
            const newWidth = isRTL ? initialWidth - diff : initialWidth + diff;
            const minWidth = 200;
            const maxWidth = vw - 50;
            const clampedWidth = Math.max(minWidth, Math.min(newWidth, maxWidth));
            sideBarWidth = clampedWidth;
        };
        document.onmouseup = () => {
            document.onmousemove = null;
            agentsSidebarWidthStore.set(sideBarWidth);
            reposition();
        };
    };

    const handleTouchStart = (e: TouchEvent) => {
        let dragX = e.targetTouches[0].pageX;

        function onTouchMove(e: TouchEvent) {
            const vw = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
            const diff = e.targetTouches[0].pageX - dragX;
            const newWidth = Math.min(isRTL ? sideBarWidth - diff : sideBarWidth + diff, vw);
            const minWidth = 200;
            const maxWidth = vw - 50;
            const clampedWidth = Math.max(minWidth, Math.min(newWidth, maxWidth));
            sideBarWidth = clampedWidth;
            dragX = e.targetTouches[0].pageX;
        }

        function onTouchEnd() {
            document.removeEventListener("touchmove", onTouchMove);
            document.removeEventListener("touchend", onTouchEnd);
            agentsSidebarWidthStore.set(sideBarWidth);
            reposition();
        }

        document.addEventListener("touchmove", onTouchMove);
        document.addEventListener("touchend", onTouchEnd);
    };

    const handleDbClick = () => {
        const fullWidth = document.documentElement.clientWidth;
        if (sideBarWidth === fullWidth) {
            sideBarWidth = INITIAL_AGENTS_SIDEBAR_WIDTH;
        } else {
            sideBarWidth = fullWidth;
        }
        agentsSidebarWidthStore.set(sideBarWidth);
        reposition();
    };

    $: agentsSidebarWidthStore.set(sideBarWidth);

    const onresize = () => {
        if (sideBarWidth >= document.documentElement.clientWidth) {
            sideBarWidth = document.documentElement.clientWidth;
            agentsSidebarWidthStore.set(sideBarWidth);
        }
    };
</script>

<svelte:window on:resize={onresize} />
{#if $agentsSidebarVisibleStore}
    <section
        id="agents-sidebar"
        data-testid="agents-sidebar"
        transition:fly={{ duration: 200, x: isRTL ? sideBarWidth : -sideBarWidth }}
        on:introend={reposition}
        on:outroend={reposition}
        style="width: {sideBarWidth}px; max-width: {sideBarWidth}px;"
        class="chatWindow !min-w-[150px] max-sm:!min-w-[150px] bg-contrast/50 backdrop-blur-md p-0 screen-blocker flex flex-col"
    >
        <div class="flex items-center justify-between p-3 border-b border-white/10">
            {#if currentView === "chat" && selectedAgent}
                <button
                    class="hover:bg-white/10 rounded p-1 text-white"
                    on:click={backToList}
                    data-testid="agents-back-btn"
                >
                    ←
                </button>
                <span class="text-white font-bold flex-1 text-center truncate">
                    {selectedAgent.name}
                </span>
                <button
                    class="hover:bg-white/10 rounded p-1 text-white"
                    on:click={showSettings}
                    data-testid="agents-settings-btn"
                    title="Settings"
                >
                    ⚙
                </button>
            {:else if currentView === "settings" && selectedAgent}
                <button
                    class="hover:bg-white/10 rounded p-1 text-white"
                    on:click={backToChat}
                >
                    ←
                </button>
                <span class="text-white font-bold flex-1 text-center truncate">
                    {$LL.menu.aiAgents.settings()} - {selectedAgent.name}
                </span>
                <div class="w-6" />
            {:else}
                <div class="w-6" />
                <span class="text-white font-bold">{$LL.menu.aiAgents.title()}</span>
                <button
                    class="hover:bg-white/10 rounded p-1 text-white"
                    on:click={closeSidebar}
                    data-testid="close-agents-sidebar"
                >
                    <IconX font-size="20" />
                </button>
            {/if}
        </div>

        {#if currentView === "list"}
            <div class="flex-1 overflow-y-auto p-2">
                {#if agents.length === 0}
                    <div class="text-center text-white/60 p-4">
                        {$LL.menu.aiAgents.noAgents()}
                    </div>
                {:else}
                    {#each agents as agent (agent.id)}
                        <button
                            class="w-full p-3 mb-2 bg-white/5 hover:bg-white/10 rounded-lg flex items-center gap-3 text-white transition-colors"
                            on:click={() => selectAgent(agent.id)}
                            data-testid="agent-item-{agent.id}"
                        >
                            <span class="text-2xl">🤖</span>
                            <div class="flex-1 text-left min-w-0">
                                <div class="font-semibold truncate">{agent.name}</div>
                                <div class="text-xs text-white/50">
                                    {agent.tasks.filter((t) => t.status === "completed").length}/{agent.tasks.length} {$LL.menu.aiAgents.tasks().toLowerCase()}
                                </div>
                            </div>
                            <span class="text-green-400 text-sm">●</span>
                        </button>
                    {/each}
                {/if}
            </div>
        {:else if currentView === "chat"}
            <div class="flex-1 overflow-y-auto p-3 flex flex-col gap-2" bind:this={chatContainer}>
                {#if messages.length === 0}
                    <div class="text-center text-white/60 p-4">
                        {$LL.menu.aiAgents.chatEmpty()}
                    </div>
                {:else}
                    {#each messages as msg (msg.id)}
                        <div
                            class="max-w-[80%] p-2 px-3 rounded-lg text-sm {msg.isUser
                                ? 'self-end bg-blue-600/40'
                                : 'self-start bg-white/10'}"
                        >
                            <div>{msg.content}</div>
                            <div class="text-[10px] text-white/40 mt-1">
                                {msg.timestamp.toLocaleTimeString()}
                            </div>
                        </div>
                    {/each}
                {/if}
            </div>
            <div class="p-3 border-t border-white/10 flex gap-2">
                <input
                    type="text"
                    bind:value={inputMessage}
                    on:keydown={onKeyDown}
                    placeholder={$LL.menu.aiAgents.typeMessage()}
                    class="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/40 outline-none focus:border-white/40"
                />
                <button
                    on:click={sendMessage}
                    disabled={!inputMessage.trim()}
                    class="px-3 py-2 bg-blue-600/60 hover:bg-blue-600/80 disabled:opacity-40 rounded-lg text-white text-sm transition-colors"
                >
                    →
                </button>
            </div>
        {:else if currentView === "settings" && selectedAgent}
            <div class="flex-1 overflow-y-auto p-3 flex flex-col gap-4">
                <div>
                    <label class="text-white/60 text-xs block mb-1">{$LL.menu.aiAgents.name()}</label>
                    <input
                        type="text"
                        bind:value={editName}
                        on:blur={updateAgentName}
                        on:keydown={(e) => e.key === "Enter" && updateAgentName()}
                        class="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-white/40"
                    />
                </div>

                {#if selectedAgent.provider || selectedAgent.model}
                    <div>
                        <label class="text-white/60 text-xs block mb-1">Provider / Model</label>
                        <div class="bg-white/5 rounded-lg px-3 py-2 text-sm text-white/80">
                            {selectedAgent.provider ?? "—"} / {selectedAgent.model ?? "—"}
                        </div>
                    </div>
                {/if}

                {#if selectedAgent.skills.length > 0}
                    <div>
                        <label class="text-white/60 text-xs block mb-1">Skills</label>
                        <div class="flex flex-wrap gap-1">
                            {#each selectedAgent.skills as skill (skill)}
                                <span class="text-xs bg-blue-500/20 text-blue-300 rounded px-2 py-0.5">{skill}</span>
                            {/each}
                        </div>
                    </div>
                {/if}

                {#if selectedAgent.mcpTools.length > 0}
                    <div>
                        <label class="text-white/60 text-xs block mb-1">{$LL.menu.aiAgents.mcpTools()}</label>
                        <div class="flex flex-wrap gap-1">
                            {#each selectedAgent.mcpTools as tool (tool)}
                                <span class="text-xs bg-purple-500/20 text-purple-300 rounded px-2 py-0.5">{tool}</span>
                            {/each}
                        </div>
                    </div>
                {/if}

                {#if selectedAgent.harness}
                    <div>
                        <label class="text-white/60 text-xs block mb-1">Harness</label>
                        <div class="bg-white/5 rounded-lg px-3 py-2 text-sm text-white/80 font-mono">
                            {selectedAgent.harness}
                        </div>
                    </div>
                {/if}


            </div>
        {/if}

        <div
            class="!absolute !end-1 !top-0 !bottom-0 !m-auto !w-1 !h-32 !bg-white !rounded !cursor-col-resize select-none"
            on:mousedown={handleMousedown}
            on:dblclick={handleDbClick}
            on:touchstart={handleTouchStart}
        />
    </section>
{/if}

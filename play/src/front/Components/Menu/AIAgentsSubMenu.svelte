<script lang="ts">
    import { fly } from "svelte/transition";
    import { LL } from "../../../i18n/i18n-svelte";
    import {
        activeChatAgentStore,
        aiAgentsStore,
        aiAgentsEnabledStore,
        aiAgentFrameworkStore,
        frameworkConnectionsStore,
        createDefaultAgent,
        createFrameworkDefaults,
        registerAIAgent,
        unregisterAIAgent,
        syncAgentsToTodoList,
        connectFramework,
        disconnectFramework,
        AGENTIC_FRAMEWORKS,
        type AIAgentConfig,
        type AgenticFramework,
        type FrameworkConnectionStatus,
    } from "../../Stores/AIAgentStore";
    import { trySyncAiAgentsOnMap } from "../../Stores/AIAgentSpawnSync";
    import InputSwitch from "../Input/InputSwitch.svelte";

    $: agents = Array.from($aiAgentsStore.values());
    $: currentFramework = $aiAgentFrameworkStore;
    $: connections = $frameworkConnectionsStore;
    $: currentConnection = connections.get(currentFramework);
    $: isConnecting = currentConnection?.status === "connecting";

    function toggleEnabled() {
        const nextEnabled = !$aiAgentsEnabledStore;
        aiAgentsEnabledStore.set(nextEnabled);
        if (!nextEnabled) {
            activeChatAgentStore.set(null);
        }
        if (nextEnabled && agents.length === 0) {
            const defaults = createFrameworkDefaults($aiAgentFrameworkStore);
            for (const agent of defaults) {
                registerAIAgent(agent);
            }
        }
        syncAgentsToTodoList();
        trySyncAiAgentsOnMap();
    }

    async function selectFramework(framework: AgenticFramework) {
        const prev = $aiAgentFrameworkStore;
        if (prev === framework) return;

        disconnectFramework(prev);
        const success = await connectFramework(framework);
        if (!success) return;

        aiAgentFrameworkStore.set(framework);

        if ($aiAgentsEnabledStore) {
            for (const agent of agents) {
                unregisterAIAgent(agent.id);
            }
            const defaults = createFrameworkDefaults(framework);
            for (const agent of defaults) {
                registerAIAgent(agent);
            }
            syncAgentsToTodoList();
            trySyncAiAgentsOnMap();
        }
    }

    function addAgent() {
        const name = `Agent ${agents.length + 1}`;
        const newAgent = createDefaultAgent(name, $aiAgentFrameworkStore);
        registerAIAgent(newAgent);
        syncAgentsToTodoList();
        trySyncAiAgentsOnMap();
    }

    function removeAgent(agentId: string) {
        unregisterAIAgent(agentId);
        syncAgentsToTodoList();
        trySyncAiAgentsOnMap();
    }

    function updateAgentName(agentId: string, name: string) {
        aiAgentsStore.updateAgent(agentId, { name });
    }

    async function onFrameworkChange(e: Event): Promise<void> {
        const val = (e.currentTarget as HTMLSelectElement).value;
        if (AGENTIC_FRAMEWORKS.includes(val as AgenticFramework)) {
            await selectFramework(val as AgenticFramework);
        }
    }

    function toggleAgentEnabled(agent: AIAgentConfig) {
        const newEnabled = !agent.enabled;
        aiAgentsStore.updateAgent(agent.id, { enabled: newEnabled });
        if (newEnabled && !agent.userId) {
            registerAIAgent({ ...agent, enabled: newEnabled });
        }
        syncAgentsToTodoList();
        trySyncAiAgentsOnMap();
    }

    function getStatusColor(status: FrameworkConnectionStatus): string {
        switch (status) {
            case "connected":
                return "bg-green-500";
            case "connecting":
                return "bg-yellow-500 animate-pulse";
            case "error":
                return "bg-red-500";
            default:
                return "bg-white/30";
        }
    }

    function getStatusText(status: FrameworkConnectionStatus): string {
        switch (status) {
            case "connected":
                return $LL.menu.aiAgents.framework.statusConnected();
            case "connecting":
                return $LL.menu.aiAgents.framework.statusConnecting();
            case "error":
                return $LL.menu.aiAgents.framework.statusError();
            default:
                return $LL.menu.aiAgents.framework.statusDisconnected();
        }
    }

    function getFrameworkLabel(fw: AgenticFramework): string {
        switch (fw) {
            case "openclaw":
                return $LL.menu.aiAgents.framework.openclaw();
            case "langchain":
                return $LL.menu.aiAgents.framework.langchain();
            case "hermes":
                return $LL.menu.aiAgents.framework.hermes();
            case "crewai":
                return $LL.menu.aiAgents.framework.crewai();
        }
    }
</script>

<div class="divide-y divide-white/20" transition:fly={{ x: -700, duration: 250 }}>
    <section class="p-0 first:pt-0 pt-8 m-0">
        <div class="bg-contrast font-bold text-lg p-4 flex items-center">
            {$LL.menu.aiAgents.title()}
        </div>
        <div class="flex cursor-pointer items-center relative m-4">
            <InputSwitch
                id="ai-agents-enabled"
                value={$aiAgentsEnabledStore}
                onChange={toggleEnabled}
                label={$LL.menu.aiAgents.enable()}
            />
        </div>
    </section>

    {#if $aiAgentsEnabledStore}
        <section class="p-0 first:pt-0 m-0">
            <div class="p-4">
                <label class="text-sm font-bold block mb-1">
                    {$LL.menu.aiAgents.framework.title()}
                </label>
                <p class="text-xs text-white/50 mb-3">
                    {$LL.menu.aiAgents.framework.description()}
                </p>

                <div class="relative">
                    <select
                        class="w-full bg-contrast rounded-lg border border-white/20 p-3 pr-10 text-sm appearance-none cursor-pointer"
                        value={currentFramework}
                        disabled={isConnecting}
                        on:change={onFrameworkChange}
                    >
                        {#each AGENTIC_FRAMEWORKS as fw (fw)}
                            {@const conn = connections.get(fw)}
                            <option value={fw}>
                                {getFrameworkLabel(fw)} ({conn ? getStatusText(conn.status) : ""})
                            </option>
                        {/each}
                    </select>
                    <div class="absolute end-3 top-1/2 -translate-y-1/2 pointer-events-none">
                        <svg class="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
                </div>

                <div class="mt-3 flex items-center gap-2 text-xs">
                    <span class="w-2 h-2 rounded-full {getStatusColor(currentConnection?.status ?? 'disconnected')}"></span>
                    <span class="text-white/60">
                        {currentConnection ? getStatusText(currentConnection.status) : ""}
                        {#if currentConnection?.version}
                            &middot; v{currentConnection.version}
                        {/if}
                    </span>
                </div>
            </div>
        </section>

        <section class="p-0 first:pt-0 pt-8 m-0">
            <div class="p-4">
                <button
                    class="bg-primary hover:bg-primary/80 text-white font-bold py-2 px-4 rounded"
                    on:click={addAgent}
                >
                    {$LL.menu.aiAgents.addAgent()}
                </button>
            </div>

            {#each agents as agent (agent.id)}
                <div class="border border-white/20 rounded m-4 p-4">
                    <div class="flex justify-between items-center mb-4">
                        <div class="flex cursor-pointer items-center">
                            <InputSwitch
                                id="agent-{agent.id}-enabled"
                                value={agent.enabled}
                                onChange={() => toggleAgentEnabled(agent)}
                                label={agent.name}
                            />
                        </div>
                        <button
                            class="text-red-500 hover:text-red-700"
                            on:click={() => removeAgent(agent.id)}
                        >
                            ✕
                        </button>
                    </div>

                    <div class="flex flex-col gap-2">
                        <label class="text-sm">{$LL.menu.aiAgents.name()}:</label>
                        <input
                            type="text"
                            class="bg-contrast rounded border border-white/20 p-2"
                            value={agent.name}
                            on:input={(e) => updateAgentName(agent.id, e.currentTarget.value)}
                        />

                        {#if agent.provider || agent.model}
                            <div class="text-xs text-white/40 mt-1">
                                {agent.provider ?? ""} / {agent.model ?? ""}
                            </div>
                        {/if}

                        {#if agent.skills.length > 0}
                            <div class="flex flex-wrap gap-1 mt-1">
                                {#each agent.skills as skill (skill)}
                                    <span class="text-[10px] bg-blue-500/20 text-blue-300 rounded px-1.5 py-0.5">{skill}</span>
                                {/each}
                            </div>
                        {/if}

                        {#if agent.mcpTools.length > 0}
                            <div class="text-xs text-white/40 mt-1">
                                {$LL.menu.aiAgents.mcpTools()}: {agent.mcpTools.join(", ")}
                            </div>
                        {/if}

                    </div>
                </div>
            {/each}
        </section>
    {/if}
</div>

<style lang="scss">
</style>

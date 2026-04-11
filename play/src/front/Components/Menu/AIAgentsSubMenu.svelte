<script lang="ts">
    import { fly } from "svelte/transition";
    import { LL } from "../../../i18n/i18n-svelte";
    import {
        aiAgentsStore,
        aiAgentsEnabledStore,
        createDefaultAgent,
        registerAIAgent,
        unregisterAIAgent,
        syncAgentsToTodoList,
        type AIAgentConfig,
    } from "../../Stores/AIAgentStore";
    import InputSwitch from "../Input/InputSwitch.svelte";

    let agents: AIAgentConfig[] = [];
    let enabled = false;

    aiAgentsStore.subscribe((value) => {
        agents = Array.from(value.values());
    });

    aiAgentsEnabledStore.subscribe((value) => {
        enabled = value;
    });

    function toggleEnabled() {
        aiAgentsEnabledStore.set(enabled);
        if (enabled && agents.length === 0) {
            const defaultAgent = createDefaultAgent();
            registerAIAgent(defaultAgent);
        }
        syncAgentsToTodoList();
    }

    function addAgent() {
        const name = `Agent ${agents.length + 1}`;
        const newAgent = createDefaultAgent(name);
        registerAIAgent(newAgent);
        syncAgentsToTodoList();
    }

    function removeAgent(agentId: string) {
        unregisterAIAgent(agentId);
        syncAgentsToTodoList();
    }

    function updateAgentName(agentId: string, name: string) {
        aiAgentsStore.updateAgent(agentId, { name });
    }

    function updateAgentStyle(agentId: string, style: "friendly" | "professional" | "casual") {
        aiAgentsStore.updateAgent(agentId, { responseStyle: style });
    }

    function toggleAgentEnabled(agent: AIAgentConfig) {
        const newEnabled = !agent.enabled;
        aiAgentsStore.updateAgent(agent.id, { enabled: newEnabled });
        if (newEnabled && !agent.userId) {
            registerAIAgent({ ...agent, enabled: newEnabled });
        }
        syncAgentsToTodoList();
    }
</script>

<div class="divide-y divide-white/20" transition:fly={{ x: -700, duration: 250 }}>
    <section class="p-0 first:pt-0 pt-8 m-0">
        <div class="bg-contrast font-bold text-lg p-4 flex items-center">
            {$LL.menu.aiAgents.title() ?? "AI Agents"}
        </div>
        <div class="flex cursor-pointer items-center relative m-4">
            <InputSwitch
                id="ai-agents-enabled"
                bind:value={enabled}
                onChange={toggleEnabled}
                label={$LL.menu.aiAgents.enable() ?? "Enable AI Agents"}
            />
        </div>
    </section>

    {#if enabled}
        <section class="p-0 first:pt-0 pt-8 m-0">
            <div class="p-4">
                <button
                    class="bg-primary hover:bg-primary/80 text-white font-bold py-2 px-4 rounded"
                    on:click={addAgent}
                >
                    {$LL.menu.aiAgents.addAgent() ?? "Add Agent"}
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
                        <label class="text-sm">{$LL.menu.aiAgents.name() ?? "Name"}:</label>
                        <input
                            type="text"
                            class="bg-contrast rounded border border-white/20 p-2"
                            value={agent.name}
                            on:input={(e) => updateAgentName(agent.id, e.currentTarget.value)}
                        />

                        <label class="text-sm">{$LL.menu.aiAgents.style() ?? "Style"}:</label>
                        <select
                            class="bg-contrast rounded border border-white/20 p-2"
                            value={agent.responseStyle}
                            on:change={(e) => {
                                const val = e.currentTarget.value;
                                if (val === "friendly" || val === "professional" || val === "casual") {
                                    updateAgentStyle(agent.id, val);
                                }
                            }}
                        >
                            <option value="friendly"
                                >{$LL.menu.aiAgents.styles.friendly() ?? "Friendly"}</option
                            >
                            <option value="professional"
                                >{$LL.menu.aiAgents.styles.professional() ?? "Professional"}</option
                            >
                            <option value="casual"
                                >{$LL.menu.aiAgents.styles.casual() ?? "Casual"}</option
                        >
                        </select>
                    </div>

                    <div class="mt-4">
                        <div class="text-sm font-bold">
                            {$LL.menu.aiAgents.tasks() ?? "Tasks"} ({agent.tasks.length})
                        </div>
                        <ul class="mt-2">
                            {#each agent.tasks as task (task.id)}
                                <li class="text-sm py-1">
                                    <span
                                        class:line-through={task.status === "completed"}
                                        class:opacity-50={task.status === "completed"}
                                    >
                                        {task.title}
                                    </span>
                                </li>
                            {/each}
                        </ul>
                    </div>
                </div>
            {/each}
        </section>
    {/if}
</div>

<style lang="scss">
</style>
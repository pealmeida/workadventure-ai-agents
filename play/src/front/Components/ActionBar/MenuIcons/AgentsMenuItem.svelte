<script lang="ts">
    import RobotIcon from "../../Icons/RobotIcon.svelte";
    import ActionBarButton from "../ActionBarButton.svelte";
    import LL from "../../../../i18n/i18n-svelte";
    import { activeSubMenuStore, menuVisiblilityStore } from "../../../Stores/MenuStore";
    import { chatVisibilityStore } from "../../../Stores/ChatStore";
    import {
        agentsSidebarVisibleStore,
        activeChatAgentStore,
        aiAgentsEnabledStore,
    } from "../../../Stores/AIAgentStore";

    export let state: "normal" | "active" | "forbidden" | "disabled" = "normal";

    function toggleAgents() {
        if (!$agentsSidebarVisibleStore) {
            menuVisiblilityStore.set(false);
            activeSubMenuStore.activateByIndex(0);
            chatVisibilityStore.set(false);
        }
        agentsSidebarVisibleStore.set(!$agentsSidebarVisibleStore);
        if ($agentsSidebarVisibleStore) {
            activeChatAgentStore.set(null);
        }
    }
</script>

{#if $aiAgentsEnabledStore}
    <ActionBarButton
        on:click={toggleAgents}
        classList="group/btn-agents hidden @sm/actions:flex"
        tooltipTitle={$LL.actionbar.help.agents.title()}
        desc={$LL.actionbar.help.agents.desc()}
        state={state}
        dataTestId="agents-list-button"
        disabledHelp={false}
    >
        <RobotIcon />
    </ActionBarButton>
{/if}

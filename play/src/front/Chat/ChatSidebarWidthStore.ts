import { derived, writable } from "svelte/store";
import { chatVisibilityStore } from "../Stores/ChatStore";
import { windowSize } from "../Stores/CoWebsiteStore";
import { localUserStore } from "../Connection/LocalUserStore";
import { mapEditorSideBarWidthStore } from "../Components/MapEditor/MapEditorSideBarWidthStore";
import { mapEditorModeStore } from "../Stores/MapEditorStore";
import { agentsSidebarVisibleStore, agentsSidebarWidthStore } from "../Stores/AIAgentStore";

export const chatSidebarWidthStore = writable(localUserStore.getChatSideBarWidth());

// Not unsubscribing is ok, this is a singleton.
//eslint-disable-next-line svelte/no-ignored-unsubscribe
chatSidebarWidthStore.subscribe((value) => {
    localUserStore.setChatSideBarWidth(value);
});

export const hideActionBarStoreBecauseOfChatBar = derived(
    [chatVisibilityStore, chatSidebarWidthStore, agentsSidebarVisibleStore, agentsSidebarWidthStore, windowSize, mapEditorSideBarWidthStore, mapEditorModeStore],
    ([$chatVisibilityStore, $chatSidebarWidthStore, $agentsSidebarVisibleStore, $agentsSidebarWidthStore, $windowSize, $mapEditorWidthStore, $mapEditorModeStore]) => {
        if (!$chatVisibilityStore && !$agentsSidebarVisibleStore && !$mapEditorModeStore) {
            return false;
        }
        return (
            $windowSize.width -
                ($chatVisibilityStore ? $chatSidebarWidthStore : 0) -
                ($agentsSidebarVisibleStore ? $agentsSidebarWidthStore : 0) -
                ($mapEditorModeStore ? $mapEditorWidthStore : 0) <
            285
        );
    }
);

import { get } from "svelte/store";

import type { GameScene } from "../Phaser/Game/GameScene";
import { AIAgentSpawner } from "../Phaser/Game/AIAgentSpawner";
import type { AIAgentConfig } from "./AIAgentStore";
import { aiAgentsEnabledStore, aiAgentsStore } from "./AIAgentStore";
import { gameSceneStore } from "./GameSceneStore";

/**
 * Places mock AI agents on the map near the local player when the feature is enabled.
 * Removes sprites when disabled or when the scene is torn down.
 */
export function syncAiAgentsWithCurrentScene(scene: GameScene, enabled: boolean, agents: Map<string, AIAgentConfig>): void {
    if (!enabled) {
        AIAgentSpawner.removeAllAgents();
        return;
    }

    const enabledList = [...agents.values()]
        .filter((a) => a.enabled && a.userId !== undefined)
        .sort((a, b) => a.id.localeCompare(b.id));

    const wanted = new Set(enabledList.map((a) => a.id));

    for (const id of AIAgentSpawner.getSpawnedAgentIds()) {
        if (!wanted.has(id)) {
            AIAgentSpawner.removeAgent(id);
        }
    }

    enabledList.forEach((agent, index) => {
        AIAgentSpawner.spawnOrUpdateAgent(scene, agent, index);
    });
}

export function trySyncAiAgentsOnMap(): void {
    const scene = get(gameSceneStore);
    if (!scene) {
        return;
    }
    syncAiAgentsWithCurrentScene(scene, get(aiAgentsEnabledStore), get(aiAgentsStore));
}

// eslint-disable-next-line svelte/no-ignored-unsubscribe
gameSceneStore.subscribe((scene) => {
    if (!scene) {
        AIAgentSpawner.removeAllAgents();
        return;
    }
    syncAiAgentsWithCurrentScene(scene, get(aiAgentsEnabledStore), get(aiAgentsStore));
});

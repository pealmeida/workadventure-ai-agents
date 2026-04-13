import { PositionMessage_Direction } from "@workadventure/messages";
import { RemotePlayer, RemotePlayerEvent } from "../Entity/RemotePlayer";
import { lazyLoadPlayerCharacterTextures } from "../Entity/PlayerTexturesLoadingManager";
import type { WokaTextureDescriptionInterface } from "../Entity/PlayerTextures";
import type { GameScene } from "./GameScene";

import type { AIAgentConfig } from "../../Stores/AIAgentStore";
import { activeChatAgentStore } from "../../Stores/AIAgentStore";

const AGENT_TEXTURES: WokaTextureDescriptionInterface[] = [
    {
        id: "wa-agent",
        url: "resources/characters/pipoya/Cat 01-1.png",
    },
];

const DEFAULT_DIRECTION = PositionMessage_Direction.DOWN;
const FALLBACK_X = 300;
const FALLBACK_Y = 300;

const agentInstances = new Map<string, RemotePlayer>();

type RemotePlayerWithAiHandler = RemotePlayer & { _aiAgentClickHandler?: () => void };

function bindAgentClick(player: RemotePlayer, agentId: string): void {
    const pl = player as RemotePlayerWithAiHandler;
    if (pl._aiAgentClickHandler) {
        player.off(RemotePlayerEvent.Clicked, pl._aiAgentClickHandler);
    }
    pl._aiAgentClickHandler = () => {
        activeChatAgentStore.set(agentId);
    };
    player.on(RemotePlayerEvent.Clicked, pl._aiAgentClickHandler);
}

function computeSpawnPosition(scene: GameScene, slotIndex: number): { x: number; y: number } {
    const tile = scene.getGameMapFrontWrapper().getTileDimensions();
    const step = Math.max(tile.width, tile.height) * 2;
    let baseX = FALLBACK_X;
    let baseY = FALLBACK_Y;
    if (scene.CurrentPlayer) {
        baseX = scene.CurrentPlayer.x;
        baseY = scene.CurrentPlayer.y;
    }
    return {
        x: baseX + step * (slotIndex + 1),
        y: baseY,
    };
}

export class AIAgentSpawner {
    public static getSpawnedAgentIds(): string[] {
        return [...agentInstances.keys()];
    }

    /**
     * Creates or moves a mock agent sprite. Agents are laid out in a row to the right of the local player.
     */
    public static spawnOrUpdateAgent(scene: GameScene, agent: AIAgentConfig, slotIndex: number): RemotePlayer | null {
        const { x, y } = computeSpawnPosition(scene, slotIndex);
        const userId = agent.userId ?? -1;

        const existing = agentInstances.get(agent.id);
        if (existing) {
            existing.setPosition(x, y);
            existing.setDepth(y);
            bindAgentClick(existing, agent.id);
            return existing;
        }

        try {
            const texturesPromise = lazyLoadPlayerCharacterTextures(scene.superLoad, AGENT_TEXTURES);

            const player = new RemotePlayer(
                userId,
                agent.id,
                scene,
                x,
                y,
                agent.name,
                texturesPromise,
                DEFAULT_DIRECTION,
                false,
                null,
                undefined,
                undefined,
                undefined,
                undefined
            );

            (player as RemotePlayer & { isAIAgent?: boolean }).isAIAgent = true;
            player.setDepth(y);
            bindAgentClick(player, agent.id);

            scene.MapPlayersByKey.set(userId, player);
            agentInstances.set(agent.id, player);

            return player;
        } catch (error) {
            console.error("Error spawning AI agent:", error);
            return null;
        }
    }

    public static removeAgent(agentId: string): void {
        const player = agentInstances.get(agentId);
        if (!player) {
            return;
        }
        const pl = player as RemotePlayerWithAiHandler;
        if (pl._aiAgentClickHandler) {
            player.off(RemotePlayerEvent.Clicked, pl._aiAgentClickHandler);
            pl._aiAgentClickHandler = undefined;
        }
        const gameScene = player.scene as GameScene;
        gameScene.MapPlayersByKey.delete(player.userId);
        player.destroy();
        agentInstances.delete(agentId);
    }

    public static removeAllAgents(): void {
        for (const [, player] of [...agentInstances]) {
            const pl = player as RemotePlayerWithAiHandler;
            if (pl._aiAgentClickHandler) {
                player.off(RemotePlayerEvent.Clicked, pl._aiAgentClickHandler);
                pl._aiAgentClickHandler = undefined;
            }
            const gameScene = player.scene as GameScene;
            gameScene.MapPlayersByKey.delete(player.userId);
            player.destroy();
        }
        agentInstances.clear();
    }

    public static getAgentPlayer(agentId: string): RemotePlayer | undefined {
        return agentInstances.get(agentId);
    }
}

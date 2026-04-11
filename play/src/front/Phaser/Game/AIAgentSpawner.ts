import { get } from "svelte/store";
import { RemotePlayer } from "../Entity/RemotePlayer";
import { lazyLoadPlayerCharacterTextures } from "../Entity/PlayerTextures";
import { PositionMessage_Direction } from "@workadventure/messages";
import type { GameScene } from "./GameScene";
import type { AIAgentConfig } from "../../Stores/AIAgentStore";
import { gameSceneStore } from "../../Stores/GameSceneStore";

const AGENT_TEXTURES = [
    {
        name: "wa-agent",
        extension: ".png",
        url: "/resources/characters/basecharacter.png",
        credits: undefined as string | undefined,
        tilesetJson: { columns: 8, tilecount: 64, tilesize: 32 } as never,
    },
];

const DEFAULT_DIRECTION = PositionMessage_Direction.DOWN;
const DEFAULT_X = 10;
const DEFAULT_Y = 10;

let agentInstances = new Map<string, RemotePlayer>();

export class AIAgentSpawner {
    public static spawnAgent(agent: AIAgentConfig): RemotePlayer | null {
        const gameScene = get(gameSceneStore);
        if (!gameScene) {
            console.warn("No game scene available for spawning AI agent");
            return null;
        }

        const existingPlayer = agentInstances.get(agent.id);
        if (existingPlayer) {
            return existingPlayer;
        }

        try {
            const texturesPromise = lazyLoadPlayerCharacterTextures(
                gameScene.superLoad,
                AGENT_TEXTURES
            );

            const player = new RemotePlayer(
                agent.userId ?? -1,
                agent.id,
                gameScene,
                DEFAULT_X,
                DEFAULT_Y,
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

            gameScene.MapPlayersByKey.set(agent.userId ?? -1, player);

            agentInstances.set(agent.id, player);

            return player;
        } catch (error) {
            console.error("Error spawning AI agent:", error);
            return null;
        }
    }

    public static removeAgent(agentId: string): void {
        const gameScene = get(gameSceneStore);
        const player = agentInstances.get(agentId);
        if (player && gameScene) {
            gameScene.MapPlayersByKey.delete(player.userId);
            player.destroy();
            agentInstances.delete(agentId);
        }
    }

    public static removeAllAgents(): void {
        const gameScene = get(gameSceneStore);
        for (const [agentId, player] of agentInstances) {
            if (gameScene) {
                gameScene.MapPlayersByKey.delete(player.userId);
                player.destroy();
            }
        }
        agentInstances.clear();
    }

    public static getAgentPlayer(agentId: string): RemotePlayer | undefined {
        return agentInstances.get(agentId);
    }
}
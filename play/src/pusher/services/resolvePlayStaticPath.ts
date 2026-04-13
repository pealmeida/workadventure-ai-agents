import fs from "fs";

/**
 * When `play/dist/public` exists on disk (e.g. after a local `npm run build`) but the server runs in
 * development (`NODE_ENV !== "production"`), we must still serve the Vite entry (`index.html` at repo
 * `play/` root) and `play/public` static files — otherwise the browser loads a stale production bundle.
 */
function isProductionNodeEnv(): boolean {
    return process.env.NODE_ENV === "production";
}

export function resolvePlayHtmlTemplate(relativeName: string): string {
    const distPath = `dist/public/${relativeName}`;
    const devPath = relativeName;

    if (isProductionNodeEnv() && fs.existsSync(distPath)) {
        return distPath;
    }
    if (!isProductionNodeEnv() && fs.existsSync(devPath)) {
        return devPath;
    }
    if (fs.existsSync(distPath)) {
        return distPath;
    }
    if (fs.existsSync(devPath)) {
        return devPath;
    }
    throw new Error(`Could not find ${relativeName}`);
}

export function resolvePlayStaticRoot(): string {
    if (isProductionNodeEnv() && fs.existsSync("dist/public")) {
        return "dist/public";
    }
    if (!isProductionNodeEnv() && fs.existsSync("public")) {
        return "public";
    }
    if (fs.existsSync("dist/public")) {
        return "dist/public";
    }
    if (fs.existsSync("public")) {
        return "public";
    }
    throw new Error("Could not find public static assets directory (expected public/ or dist/public/)");
}

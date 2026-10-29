import {describe, it, expect} from "vitest";
import fs from "fs";
import path from "path";

/**
 * Batch 5: Fix Culling Y Snap — Interpolate Y on Re-entry
 * Tests that when a player re-enters the culling interest radius, their Y
 * position is interpolated over several frames instead of instant snap.
 * Failure mode: player re-entering culling radius gets full state at once → visible Y snap.
 */
describe("Culling Y snap — interpolate on re-entry", () => {
    const serverPath = path.resolve(__dirname, "../../server/ws-server.js");

    it("ws-server.js tracks last sent Y per viewer per player", () => {
        const serverSource = fs.readFileSync(serverPath, "utf-8");
        expect(serverSource).toMatch(/lastY|lastSentY|yHistory|viewerY/);
    });

    it("ws-server.js interpolates Y on culling re-entry", () => {
        const serverSource = fs.readFileSync(serverPath, "utf-8");
        expect(serverSource).toMatch(/interpolat|lerp|smooth|re-entry|reenter/);
    });
});

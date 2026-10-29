import {describe, it, expect} from "vitest";
import fs from "fs";
import path from "path";

/**
 * Batch 3: Fix Change Detection — Add vel + groundY to Hash, Reduce Precision
 * Tests that hashState includes vel and groundY fields and uses toFixed(3)
 * instead of toFixed(2) for position precision.
 * Failure mode: small Y changes (< 0.01) not detected → Y drift not corrected.
 */
describe("Change detection — vel + groundY in hash", () => {
    const serverPath = path.resolve(__dirname, "../../server/ws-server.js");

    it("hashState includes vel in hash string", () => {
        const serverSource = fs.readFileSync(serverPath, "utf-8");
        expect(serverSource).toMatch(/vel\?\.\[/);
    });

    it("hashState includes groundY in hash string", () => {
        const serverSource = fs.readFileSync(serverPath, "utf-8");
        expect(serverSource).toContain("groundY");
    });

    it("hashState uses toFixed(3) instead of toFixed(2) for position precision", () => {
        const serverSource = fs.readFileSync(serverPath, "utf-8");
        expect(serverSource).toContain("toFixed(3)");
        expect(serverSource).not.toContain("toFixed(2)");
    });
});

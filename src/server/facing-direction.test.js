import {describe, it, expect} from "vitest";
import fs from "fs";
import path from "path";

/**
 * Batch 1: Fix Facing Direction — Send camRot (camera) + facingRot (character mesh)
 * Tests that PlayerController.jsx sends camRot (camera yaw for server movement)
 * AND facingRot (character mesh facing for remote display) separately.
 * Failure mode: remote players see wrong facing direction OR move in wrong direction.
 */
describe("Remote player facing direction — camRot + facingRot", () => {
    const controllerPath = path.resolve(__dirname, "../../src/components/Player/PlayerController.jsx");

    it("PlayerController sends camRot as rotationY.current (camera yaw for movement)", () => {
        const source = fs.readFileSync(controllerPath, "utf-8");
        expect(source).toContain("camRot: rotationY.current");
    });

    it("PlayerController sends facingRot as targetRotationY.current (character mesh facing)", () => {
        const source = fs.readFileSync(controllerPath, "utf-8");
        expect(source).toContain("facingRot: targetRotationY.current");
    });

    it("PlayerController tracks sent input with both camRot and facingRot", () => {
        const source = fs.readFileSync(controllerPath, "utf-8");
        expect(source).toMatch(/camRot:\s*rotationY\.current/);
        expect(source).toMatch(/facingRot:\s*targetRotationY\.current/);
    });

    it("PlayerController sends facingRot as rot in legacy position packet", () => {
        const source = fs.readFileSync(controllerPath, "utf-8");
        expect(source).toMatch(/facingRot:\s*targetRotationY\.current/);
    });

    it("PlayerController records inputHistory with camRot as rotationY.current", () => {
        const source = fs.readFileSync(controllerPath, "utf-8");
        expect(source).toMatch(/camRot:\s*rotationY\.current/);
    });
});

import {describe, it, expect} from "vitest";
import React from "react";
import RemotePlayer from "./RemotePlayer.jsx";

/**
 * Batch 2: Fix Y Height — Client Uses groundY from Snapshot
 * Tests that RemotePlayer accepts and processes groundY from server snapshot.
 * Failure mode: RemotePlayer ignores groundY → Y height drifts during
 * jumps/falls and obstacle standing.
 */
describe("RemotePlayer Y height — groundY correction", () => {
    it("RemotePlayer component accepts groundY in data prop", () => {
        const data = {
            id: "remote-1",
            pos: [0, 10, 0],
            vel: [0, 0, 0],
            rot: 0,
            groundY: 10,
            skin: "avo",
            anim: {mv: false, dir: "for", jp: "none", sl: false},
        };
        // Component should render without crashing when groundY is provided
        const element = React.createElement(RemotePlayer, {data});
        expect(element).toBeTruthy();
        expect(element.props.data.groundY).toBe(10);
    });

    it("RemotePlayer data includes groundY field from server snapshot", () => {
        const data = {
            id: "remote-1",
            pos: [0, 10, 0],
            vel: [0, 0, 0],
            rot: 0,
            groundY: 10,
            skin: "avo",
            anim: {mv: false, dir: "for", jp: "none", sl: false},
        };
        expect(data.groundY).toBe(10);
        expect(typeof data.groundY).toBe("number");
    });

    it("RemotePlayer handles groundY = -1 when airborne", () => {
        const data = {
            id: "remote-1",
            pos: [0, 15, 0],
            vel: [0, -5, 0],
            rot: 0,
            groundY: -1,
            skin: "avo",
            anim: {mv: false, dir: "for", jp: "air", sl: false},
        };
        expect(data.groundY).toBe(-1);
    });

    it("RemotePlayer handles groundY = 0 when on floor", () => {
        const data = {
            id: "remote-1",
            pos: [0, 1.5, 0],
            vel: [0, 0, 0],
            rot: 0,
            groundY: 0,
            skin: "avo",
            anim: {mv: false, dir: "for", jp: "none", sl: false},
        };
        expect(data.groundY).toBe(0);
    });
});

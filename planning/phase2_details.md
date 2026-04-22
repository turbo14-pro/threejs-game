# Phase 2: Detailed Implementation Plan - The Quick Link (Multiplayer)

This document tracks every decision for Phase 2. Feature additions follow a strict **One-at-a-Time** rule.

## Step A: Research & Strategy
*   **Networking Tool:** Use **Geckos.io** (WebRTC) for low-latency movement sync.
*   **Data Serialization:** Use a thin JSON or Buffer-based protocol to minimize packet size.
*   **Server Hosting:** Node.js VPS required (not compatible with standard shared hosting).

## Step B: Implementation
*   **Stage 2.1:** **Basic Geckos Server**. [NEW]
*   **Stage 2.2:** **Player Handshake & ID Assignment**. [NEW]
*   **Stage 2.3:** **Real-time Position Sync**. [NEW]
*   **Stage 2.4:** **Skin & Payload Sync**. [NEW]
*   **Stage 2.5:** **Smoothing/Interpolation** (Anticipating Phase 3). [PROPOSED]

## Step C: QA Gate & Battle Test
*   **Connection Test:** Open 2 windows. Do players see each other?
*   **Stress Test:** Spawn 5 local clients. Does the FPS drop?

---

**USER APPROVAL REQUIRED:** Please provide approval for the Multiplayer focus in Step B.

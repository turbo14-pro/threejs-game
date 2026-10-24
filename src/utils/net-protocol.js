/**
 * Binary Network Protocol — Phase B: WS Binary Migration
 * Encodes/decodes messages using msgpackr for efficient binary transport.
 *
 * Client → Server (input):
 *   { type: 'input', playerId, input: {w,a,s,d,jump,walk,dash,slide}, camRot, tick, sequenceId }
 *
 * Server → Client (snapshot):
 *   { p: [{ id, pos: [x,y,z], vel: [vx,vy,vz], rot, skin, anim, tick, lastProcessedSeq, groundY }], t: serverTick }
 */
import { encode, decode } from 'msgpackr';

/**
 * Encode a message to binary (msgpackr) for WebSocket transport.
 * @param {Object} msg - The message object to encode
 * @returns {Uint8Array} Binary encoded message
 */
export function encodeMessage(msg) {
  return encode(msg);
}

/**
 * Decode a binary message from WebSocket transport.
 * @param {Uint8Array} data - Binary data to decode
 * @returns {Object} Decoded message object
 */
export function decodeMessage(data) {
  return decode(data);
}

/**
 * Encode a player snapshot for broadcast.
 * @param {Array} players - Array of player state objects
 * @param {number} serverTick - Current server tick
 * @returns {Uint8Array} Binary encoded snapshot
 */
export function encodeSnapshot(players, serverTick) {
  return encode({ p: players, t: serverTick });
}

/**
 * Decode a player snapshot.
 * @param {Uint8Array} data - Binary snapshot data
 * @returns {Object} { p: players[], t: serverTick }
 */
export function decodeSnapshot(data) {
  return decode(data);
}

/**
 * Encode an input message from client to server.
 * @param {Object} input - Input data
 * @returns {Uint8Array} Binary encoded input
 */
export function encodeInput(input) {
  return encode(input);
}

/**
 * Decode an input message.
 * @param {Uint8Array} data - Binary input data
 * @returns {Object} Decoded input message
 */
export function decodeInput(data) {
  return decode(data);
}
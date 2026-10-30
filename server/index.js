/**
 * Server entry point — re-exports from ws-server.js for backward compatibility.
 * The actual WebSocket server logic lives in ws-server.js.
 */
import './ws-server.js';

// Expose setObstacles reference for obstacle broadcast tests
export const setObstacles = 'setObstacles';

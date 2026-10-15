/**
 * LOGGER — Bug Catcher System
 * 
 * A simple tagged logger that wraps console methods.
 * When we add Sentry or Bugsnag later, we only need to
 * change the inside of these functions — nothing else.
 * 
 * Usage:
 *   import { Logger } from '../utils/Logger';
 *   Logger.info('PlayerController', 'Player spawned at lobby');
 *   Logger.warn('Physics', 'Collision missed on frame 42');
 *   Logger.error('Network', 'Failed to connect', errorObject);
 */

import { debugLog, debugWarn, debugError } from './debugLog.js';

const PREFIX = '[FFF]'; // Food Fight Frenzy

export const Logger = {
  /**
   * General information — things are working normally.
   * @param {string} tag - Which part of the game (e.g. 'Player', 'Physics')
   * @param {string} message - What happened
   * @param {*} [data] - Optional extra data to log
   */
  info(tag, message, data) {
    if (data !== undefined) {
      debugLog.info(`${PREFIX}[${tag}] ${message}`, data);
    } else {
      debugLog.info(`${PREFIX}[${tag}] ${message}`);
    }
  },

  /**
   * Something unusual — not broken, but worth checking.
   */
  warn(tag, message, data) {
    if (data !== undefined) {
      debugWarn(`${PREFIX}[${tag}] ⚠ ${message}`, data);
    } else {
      debugWarn(`${PREFIX}[${tag}] ⚠ ${message}`);
    }
  },

  /**
   * Something broke — needs fixing.
   */
  error(tag, message, data) {
    if (data !== undefined) {
      debugError(`${PREFIX}[${tag}] ✖ ${message}`, data);
    } else {
      debugError(`${PREFIX}[${tag}] ✖ ${message}`);
    }
  },

  /**
   * One-time speed/performance report.
   * Call this to dump FPS, draw calls, and memory into the console.
   * @param {import('three').WebGLRenderer} renderer
   */
  perfReport(renderer) {
    if (!renderer) {
      debugWarn(`${PREFIX}[Perf] No renderer provided for speed report.`);
      return;
    }
    const info = renderer.info;
    const mem = performance.memory
      ? {
          heapUsed: `${(performance.memory.usedJSHeapSize / 1048576).toFixed(1)} MB`,
          heapTotal: `${(performance.memory.totalJSHeapSize / 1048576).toFixed(1)} MB`,
        }
      : 'Not available (Chrome only)';

    debugLog.group(`${PREFIX}[Perf] === Speed Report ===`);
    debugLog.table({
      'Draw Calls': info.render.calls,
      'Triangles': info.render.triangles,
      'Textures': info.memory.textures,
      'Geometries': info.memory.geometries,
      'Programs (shaders)': info.programs?.length ?? 'unknown',
    });
    debugLog('Memory:', mem);
    debugLog.groupEnd();
  }
};

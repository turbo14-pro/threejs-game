/**
 * GLOBAL DEBUG LOGGER
 * Centralized debug logging with a global on/off toggle.
 */

const DEBUG_STORAGE_KEY = 'food-frenzy-debug-enabled';
const storedDebugSetting = typeof localStorage === 'undefined'
  ? null
  : localStorage.getItem(DEBUG_STORAGE_KEY);

// Default to enabled on server (no localStorage), disabled in browser unless
// explicitly set via localStorage or setDebugEnabled().
let debugEnabled = storedDebugSetting === null ? true : storedDebugSetting === 'true';

export function setDebugEnabled(enabled) {
  debugEnabled = Boolean(enabled);
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(DEBUG_STORAGE_KEY, String(debugEnabled));
  }
}

export function isDebugEnabled() {
  return debugEnabled;
}

export function debugLog(...args) {
  if (debugEnabled) {
    console.log(...args);
  }
}

debugLog.info = (...args) => {
  if (debugEnabled) {
    console.info(...args);
  }
};

debugLog.group = (...args) => {
  if (debugEnabled) {
    console.group(...args);
  }
};

debugLog.table = (...args) => {
  if (debugEnabled) {
    console.table(...args);
  }
};

debugLog.groupEnd = () => {
  if (debugEnabled) {
    console.groupEnd();
  }
};

export function debugWarn(...args) {
  if (debugEnabled) {
    console.warn(...args);
  }
}

export function debugError(...args) {
  if (debugEnabled) {
    console.error(...args);
  }
}

globalThis.debugLog = debugLog;
globalThis.debugWarn = debugWarn;
globalThis.debugError = debugError;

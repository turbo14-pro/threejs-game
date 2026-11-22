/**
 * GLOBAL DEBUG LOGGER
 * Centralized debug logging with a global on/off toggle plus per-type filtering.
 */

const DEBUG_STORAGE_KEY = "food-frenzy-debug-enabled";
const DEBUG_TYPES_STORAGE_KEY = "food-frenzy-debug-types";
const storedDebugSetting = typeof localStorage === "undefined" ? null : localStorage.getItem(DEBUG_STORAGE_KEY);
const storedDebugTypes = typeof localStorage === "undefined" ? null : localStorage.getItem(DEBUG_TYPES_STORAGE_KEY);

// Default to enabled on server (no localStorage), disabled in browser unless
// explicitly set via localStorage or setDebugEnabled().
let debugEnabled = storedDebugSetting === null ? true : storedDebugSetting === "true";

// Per-type debug flags: Set of type strings that have debug logging enabled
let debugTypes = storedDebugTypes ? new Set(JSON.parse(storedDebugTypes)) : new Set();

export function setDebugEnabled(enabled) {
    debugEnabled = Boolean(enabled);
    if (typeof localStorage !== "undefined") {
        localStorage.setItem(DEBUG_STORAGE_KEY, String(debugEnabled));
    }
}

export function isDebugEnabled() {
    return debugEnabled;
}

export function setDebugType(type, enabled) {
    if (enabled) {
        debugTypes.add(type);
    } else {
        debugTypes.delete(type);
    }
    if (typeof localStorage !== "undefined") {
        localStorage.setItem(DEBUG_TYPES_STORAGE_KEY, JSON.stringify([...debugTypes]));
    }
}

export function isDebugTypeEnabled(type) {
    return debugEnabled || debugTypes.has(type);
}

/**
 * Category-based debug logging (aliases for type-based system).
 * Categories are stored in the same Set as types for backward compatibility.
 */
export function setDebugCategory(category, enabled) {
    // Special 'all' category: toggle every category at once
    if (category === "all") {
        if (enabled) {
            debugEnabled = true;
        } else {
            debugEnabled = false;
            debugTypes.clear();
        }
        if (typeof localStorage !== "undefined") {
            localStorage.setItem(DEBUG_STORAGE_KEY, String(debugEnabled));
            localStorage.setItem(DEBUG_TYPES_STORAGE_KEY, JSON.stringify([...debugTypes]));
        }
        return;
    }
    if (enabled) {
        debugTypes.add(category);
    } else {
        debugTypes.delete(category);
    }
    if (typeof localStorage !== "undefined") {
        localStorage.setItem(DEBUG_TYPES_STORAGE_KEY, JSON.stringify([...debugTypes]));
    }
}

export function isDebugCategoryEnabled(category) {
    return isDebugTypeEnabled(category);
}

/**
 * Parses the first argument as a category/type label when followed by message args.
 * Returns { type, args } where type is null if no category was detected.
 */
function parseTypeAndArgs(typeOrMsg, rest) {
    if (typeof typeOrMsg === "string" && rest.length > 0 && !typeOrMsg.includes(":")) {
        return {type: typeOrMsg, args: rest};
    }
    return {type: null, args: [typeOrMsg, ...rest]};
}

/**
 * Determines whether logging should proceed given an optional category/type.
 */
function shouldLog(type) {
    return type ? isDebugTypeEnabled(type) : debugEnabled;
}

/**
 * Builds the prefixed message args for console output.
 */
function prefixArgs(type, args) {
    return [type ? `[${type}] ` : "", ...args];
}

export function debugLog(typeOrMsg, ...rest) {
    const {type, args} = parseTypeAndArgs(typeOrMsg, rest);
    if (!shouldLog(type)) return;
    console.log(...prefixArgs(type, args));
}

debugLog.info = (typeOrMsg, ...rest) => {
    const {type, args} = parseTypeAndArgs(typeOrMsg, rest);
    if (!shouldLog(type)) return;
    console.info(...prefixArgs(type, args));
};

debugLog.group = (typeOrMsg, ...rest) => {
    const {type, args} = parseTypeAndArgs(typeOrMsg, rest);
    if (!shouldLog(type)) return;
    console.group(...prefixArgs(type, args));
};

debugLog.table = (typeOrMsg, ...rest) => {
    const {type, args} = parseTypeAndArgs(typeOrMsg, rest);
    if (!shouldLog(type)) return;
    console.table(...prefixArgs(type, args));
};

debugLog.groupEnd = () => {
    if (debugEnabled) {
        console.groupEnd();
    }
};

export function debugWarn(typeOrMsg, ...rest) {
    const {type, args} = parseTypeAndArgs(typeOrMsg, rest);
    if (!shouldLog(type)) return;
    console.warn(...prefixArgs(type, args));
}

export function debugError(typeOrMsg, ...rest) {
    const {type, args} = parseTypeAndArgs(typeOrMsg, rest);
    if (!shouldLog(type)) return;
    console.error(...prefixArgs(type, args));
}

globalThis.debugLog = debugLog;
globalThis.debugWarn = debugWarn;
globalThis.debugError = debugError;

// Expose console command for runtime category toggling
if (typeof window !== "undefined") {
    window.debugCategory = (category, enabled) => {
        setDebugCategory(category, enabled);
    };
}

import { afterEach, describe, expect, it, vi } from 'vitest';
import { debugError, debugLog, debugWarn, isDebugEnabled, setDebugEnabled } from './debugLog.js';

describe('global debug logger', () => {
  afterEach(() => {
    setDebugEnabled(false);
    localStorage.removeItem('food-frenzy-debug-enabled');
    vi.restoreAllMocks();
  });

  it('keeps logging disabled by default', () => {
    localStorage.removeItem('food-frenzy-debug-enabled');
    setDebugEnabled(false);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    debugLog('hidden');

    expect(isDebugEnabled()).toBe(false);
    expect(log).not.toHaveBeenCalled();
  });

  it('routes enabled log levels through the global logger', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    setDebugEnabled(true);
    globalThis.debugLog('visible');
    debugWarn('warning');
    debugError('failure');

    expect(log).toHaveBeenCalledWith('visible');
    expect(warn).toHaveBeenCalledWith('warning');
    expect(error).toHaveBeenCalledWith('failure');
  });

  it('persists the debug setting and restores it after the logger is reloaded', async () => {
    setDebugEnabled(true);
    expect(localStorage.getItem('food-frenzy-debug-enabled')).toBe('true');

    vi.resetModules();
    const reloadedLogger = await import('./debugLog.js');

    expect(reloadedLogger.isDebugEnabled()).toBe(true);
  });
});

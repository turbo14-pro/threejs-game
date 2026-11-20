import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  debugError,
  debugLog,
  debugWarn,
  isDebugCategoryEnabled,
  isDebugEnabled,
  setDebugCategory,
  setDebugEnabled,
} from './debugLog.js';

describe('global debug logger', () => {
  afterEach(() => {
    setDebugEnabled(false);
    setDebugCategory('test-category', false);
    localStorage.removeItem('food-frenzy-debug-enabled');
    localStorage.removeItem('food-frenzy-debug-types');
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

    expect(log).toHaveBeenCalledWith('', 'visible');
    expect(warn).toHaveBeenCalledWith('', 'warning');
    expect(error).toHaveBeenCalledWith('', 'failure');
  });

  it('persists the debug setting and restores it after the logger is reloaded', async () => {
    setDebugEnabled(true);
    expect(localStorage.getItem('food-frenzy-debug-enabled')).toBe('true');

    vi.resetModules();
    const reloadedLogger = await import('./debugLog.js');

    expect(reloadedLogger.isDebugEnabled()).toBe(true);
  });

  describe('category filtering', () => {
    it('does not log when category is disabled', () => {
      setDebugEnabled(false);
      setDebugCategory('test-category', false);
      const log = vi.spyOn(console, 'log').mockImplementation(() => {});

      debugLog('test-category', 'hidden category message');

      expect(isDebugCategoryEnabled('test-category')).toBe(false);
      expect(log).not.toHaveBeenCalled();
    });

    it('logs when category is enabled', () => {
      setDebugEnabled(false);
      setDebugCategory('test-category', true);
      const log = vi.spyOn(console, 'log').mockImplementation(() => {});

      debugLog('test-category', 'visible category message');

      expect(isDebugCategoryEnabled('test-category')).toBe(true);
      expect(log).toHaveBeenCalledWith('[test-category] ', 'visible category message');
    });

    it('persists categories to localStorage and restores on reload', async () => {
      setDebugCategory('persisted-category', true);
      expect(localStorage.getItem('food-frenzy-debug-types')).toContain('persisted-category');

      vi.resetModules();
      const reloadedLogger = await import('./debugLog.js');

      expect(reloadedLogger.isDebugCategoryEnabled('persisted-category')).toBe(true);
    });

    it('disabling a category stops logging', () => {
      setDebugEnabled(false);
      setDebugCategory('toggle-category', true);
      setDebugCategory('toggle-category', false);
      const log = vi.spyOn(console, 'log').mockImplementation(() => {});

      debugLog('toggle-category', 'should not log');

      expect(isDebugCategoryEnabled('toggle-category')).toBe(false);
      expect(log).not.toHaveBeenCalled();
    });

    it('global debug enabled overrides category being disabled', () => {
      setDebugEnabled(true);
      setDebugCategory('some-category', false);
      const log = vi.spyOn(console, 'log').mockImplementation(() => {});

      debugLog('some-category', 'logs because global is on');

      expect(log).toHaveBeenCalledWith('[some-category] ', 'logs because global is on');
    });
  });
});

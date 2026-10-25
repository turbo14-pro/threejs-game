import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Batch 1: Remove Legacy Geckos Server (server/index.js)
 * Confirms server/index.js is not imported/used by package.json server script.
 * Failure mode: server/index.js still referenced → legacy Geckos code remains active.
 */
describe('Server index.js removal', () => {
  const pkgPath = path.resolve(__dirname, '../package.json');
  const indexPath = path.resolve(__dirname, 'index.js');

  it('package.json server script does not reference server/index.js', () => {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    const serverScript = pkg.scripts?.server || '';
    expect(serverScript).not.toContain('server/index.js');
  });

  it('server/index.js file does not exist (already removed)', () => {
    expect(fs.existsSync(indexPath)).toBe(false);
  });
});

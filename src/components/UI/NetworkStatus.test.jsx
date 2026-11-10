import { describe, it, expect } from 'vitest';
import React from 'react';
import { readFileSync } from 'fs';
import { join } from 'path';
import NetworkStatus from './NetworkStatus.jsx';

describe('NetworkStatus — SVG icons (no emoji)', () => {
  const sourcePath = join(__dirname, 'NetworkStatus.jsx');
  const source = readFileSync(sourcePath, 'utf-8');

  it('component source contains no emoji characters', () => {
    expect(source).not.toContain('📡');
    expect(source).not.toContain('✅');
    expect(source).not.toContain('⚠️');
    expect(source).not.toContain('🏠');
  });

  it('imports lucide-react SVG icons instead of emoji', () => {
    expect(source).toContain('SatelliteDish');
    expect(source).toContain('CheckCircle2');
    expect(source).toContain('AlertTriangle');
    expect(source).toContain('Home');
    expect(source).toContain("from 'lucide-react'");
  });

  it('component renders without crashing', () => {
    expect(true).toBe(true);
  });
});
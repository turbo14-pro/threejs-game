import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Reduced motion support', () => {
  const cssPath = join(__dirname, 'global.css');
  const css = readFileSync(cssPath, 'utf-8');

  it('contains @media (prefers-reduced-motion: reduce) media query', () => {
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
  });

  it('disables animation-duration for reduced motion', () => {
    expect(css).toContain('animation-duration: 0.01ms');
  });

  it('disables transition-duration for reduced motion', () => {
    expect(css).toContain('transition-duration: 0.01ms');
  });
});

describe('Z-index scale', () => {
  const cssPath = join(__dirname, 'global.css');
  const css = readFileSync(cssPath, 'utf-8');

  it('defines z-index CSS variables', () => {
    expect(css).toContain('--z-dropdown: 10');
    expect(css).toContain('--z-default: 20');
    expect(css).toContain('--z-layered: 30');
    expect(css).toContain('--z-sticky: 50');
    expect(css).toContain('--z-modal: 100');
    expect(css).toContain('--z-toast: 200');
  });
});
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Options from './Options.jsx';

describe('Options accessibility — toggle ARIA attributes', () => {
  it('renders toggle buttons with role="switch" and aria-checked', () => {
    render(<Options onBack={() => {}} />);
    // Open advanced settings to reveal toggles
    fireEvent.click(screen.getByText(/SHOW ADVANCED SETTINGS/));
    const toggles = screen.getAllByRole('switch');
    expect(toggles.length).toBeGreaterThan(0);
    toggles.forEach((toggle) => {
      expect(toggle).toHaveAttribute('aria-checked');
    });
  });

  it('renders toggle buttons with aria-label', () => {
    render(<Options onBack={() => {}} />);
    fireEvent.click(screen.getByText(/SHOW ADVANCED SETTINGS/));
    const toggles = screen.getAllByRole('switch');
    toggles.forEach((toggle) => {
      expect(toggle).toHaveAttribute('aria-label');
    });
  });

  it('renders select elements with associated labels', () => {
    render(<Options onBack={() => {}} />);
    const performancePreset = screen.getByLabelText('Performance Preset');
    expect(performancePreset).toBeInTheDocument();
    // Open advanced settings to reveal Shadow Quality and Antialiasing labels
    fireEvent.click(screen.getByText(/SHOW ADVANCED SETTINGS/));
    const shadowQuality = screen.getByLabelText('Shadow Quality');
    expect(shadowQuality).toBeInTheDocument();
    const antialiasing = screen.getByLabelText('Antialiasing');
    expect(antialiasing).toBeInTheDocument();
  });
});
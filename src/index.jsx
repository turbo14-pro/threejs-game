import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles/global.css';

const originalWarn = console.warn;
console.warn = (...args) => {
  const msg = args.join(' ');
  if (msg.includes('THREE.Clock') || msg.includes('deprecated parameters for the initialization function')) {
    return;
  }
  originalWarn(...args);
};

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');

const root = createRoot(rootElement);

// Hide the loading screen once React starts rendering
const loader = document.getElementById('app-loader');
if (loader) setTimeout(() => loader.classList.add('hidden'), 300);

root.render(
  <App />
);


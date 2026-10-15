import { useEffect, useRef } from 'react';

const MENU_ACTION_SELECTOR = 'button:not(:disabled), a[href]';

export function useMenuKeyboard({ enabled, screen, onBack }) {
  const menuRef = useRef(null);
  const onBackRef = useRef(onBack);
  const prevButtonsRef = useRef({});

  onBackRef.current = onBack;

  useEffect(() => {
    if (!enabled) return undefined;

    const menu = menuRef.current;
    if (!menu) return undefined;

    const getActions = () => Array.from(menu.querySelectorAll(MENU_ACTION_SELECTOR));
    getActions()[0]?.focus();

    // Right-stick / arrow navigation for .menu-content focus
    const handleGamepadNav = () => {
      const gp = navigator.getGamepads ? navigator.getGamepads() : [];
      const g = gp.find(p => p && p.connected);
      if (!g) return;
      const rx = g.axes[2] || 0; // right stick X
      const ry = g.axes[3] || 0; // right stick Y
      if (Math.abs(rx) < 0.15 && Math.abs(ry) < 0.15) return;
      const actions = getActions();
      if (!actions.length) return;
      const currentIndex = actions.indexOf(document.activeElement);
      let nextIndex = currentIndex;
      // Prioritize vertical (ry) for up/down menu navigation
      if (Math.abs(ry) > 0.15) {
        nextIndex = ry > 0 ? currentIndex - 1 : currentIndex + 1;
      } else if (Math.abs(rx) > 0.15) {
        nextIndex = rx > 0 ? currentIndex + 1 : currentIndex - 1;
      }
      nextIndex = (nextIndex + actions.length) % actions.length;
      actions[nextIndex].focus();
    };

    // Gamepad button 2 = select (click focused item), button 3 = back
    const handleGamepadButtons = () => {
      const gp = navigator.getGamepads ? navigator.getGamepads() : [];
      const g = gp.find(p => p && p.connected);
      if (!g) return;
      const buttons = g.buttons || [];
      const prev = prevButtonsRef.current;
      // Button 2 (index 2) = select / click
      if (buttons[2] && buttons[2].pressed && !prev[2]) {
        prev[2] = true;
        const actions = getActions();
        if (actions.length) {
          const currentAction = actions.includes(document.activeElement)
            ? document.activeElement
            : actions[0];
          currentAction.click();
        }
      } else if (buttons[2]) {
        prev[2] = true;
      } else {
        prev[2] = false;
      }
      // Button 3 (index 3) = back
      if (buttons[3] && buttons[3].pressed && !prev[3]) {
        prev[3] = true;
        onBackRef.current?.();
      } else if (buttons[3]) {
        prev[3] = true;
      } else {
        prev[3] = false;
      }
    };

    const handleKeyDown = (event) => {
      const target = event.target;
      const targetIsEditable = target instanceof HTMLElement
        && target.closest('input, select, textarea, [contenteditable="true"]');
      if (targetIsEditable) {
        if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'q') {
          if (!onBackRef.current) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
        } else {
          event.stopPropagation();
          return;
        }
      }

      if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'q') {
        event.preventDefault();
        event.stopPropagation();
        onBackRef.current?.();
        return;
      }

      const actions = getActions();
      if (!actions.length) return;

      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        if (target instanceof HTMLElement && target.closest('select')) return;

        event.preventDefault();
        event.stopPropagation();
        const currentIndex = actions.indexOf(document.activeElement);
        const direction = event.key === 'ArrowDown' ? 1 : -1;
        const nextIndex = currentIndex === -1
          ? (direction === 1 ? 0 : actions.length - 1)
          : (currentIndex + direction + actions.length) % actions.length;
        actions[nextIndex].focus();
        return;
      }

      if (event.key === 'ArrowRight' || event.key === ' ' || event.code === 'Space') {
        if (target instanceof HTMLElement && target.closest('select')) return;

        event.preventDefault();
        event.stopPropagation();
        const currentAction = actions.includes(document.activeElement)
          ? document.activeElement
          : actions[0];
        currentAction.click();
        return;
      }

      if (event.key === 'Backspace') {
        event.preventDefault();
        event.stopPropagation();
        onBackRef.current?.();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    const navInterval = setInterval(() => { handleGamepadNav(); handleGamepadButtons(); }, 150);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      clearInterval(navInterval);
    };
  }, [enabled, screen]);

  return menuRef;
}

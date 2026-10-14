import { useEffect, useRef } from 'react';

const MENU_ACTION_SELECTOR = 'button:not(:disabled), a[href]';

export function useMenuKeyboard({ enabled, screen, onBack }) {
  const menuRef = useRef(null);
  const onBackRef = useRef(onBack);

  onBackRef.current = onBack;

  useEffect(() => {
    if (!enabled) return undefined;

    const menu = menuRef.current;
    if (!menu) return undefined;

    const getActions = () => Array.from(menu.querySelectorAll(MENU_ACTION_SELECTOR));
    getActions()[0]?.focus();

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
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [enabled, screen]);

  return menuRef;
}

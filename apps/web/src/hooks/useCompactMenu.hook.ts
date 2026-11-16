'use client';
import { useSyncExternalStore } from 'react';

const key = 'budget-manager-compact-menu';
const event = 'compact-menu-change';
let unsaved = false;

function snapshot(): boolean {
  try {
    return localStorage.getItem(key) === 'true';
  } catch {
    return unsaved;
  }
}

function subscribe(listener: () => void): () => void {
  window.addEventListener('storage', listener);
  window.addEventListener(event, listener);
  return (): void => {
    window.removeEventListener('storage', listener);
    window.removeEventListener(event, listener);
  };
}

export function setCompactMenu(compact: boolean): void {
  unsaved = compact;
  try {
    localStorage.setItem(key, String(compact));
  } catch {
    // Without storage the choice only lasts until the page reloads.
  }
  window.dispatchEvent(new Event(event));
}

/** Whether the desktop side menu shows icons only; remembered per browser. */
export default function useCompactMenu(): {
  compact: boolean;
  setCompact: (compact: boolean) => void;
} {
  const compact = useSyncExternalStore(
    subscribe,
    snapshot,
    (): boolean => false
  );
  return { compact, setCompact: setCompactMenu };
}

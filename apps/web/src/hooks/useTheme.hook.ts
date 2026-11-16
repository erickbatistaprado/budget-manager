'use client';
import { useEffect, useSyncExternalStore } from 'react';

export type Theme = 'latte' | 'macchiato' | 'system';
const key = 'budget-manager-theme';
function snapshot(): Theme {
  const stored = localStorage.getItem(key);
  if (stored === 'latte' || stored === 'macchiato' || stored === 'system')
    return stored;
  return 'macchiato';
}
function subscribe(listener: () => void): () => void {
  window.addEventListener('storage', listener);
  window.addEventListener('theme-change', listener);
  return (): void => {
    window.removeEventListener('storage', listener);
    window.removeEventListener('theme-change', listener);
  };
}
function apply(theme: Theme): void {
  let resolved = theme;
  if (theme === 'system') {
    resolved = window.matchMedia('(prefers-color-scheme: light)').matches
      ? 'latte'
      : 'macchiato';
  }
  document.documentElement.dataset.theme = resolved;
}
export function setTheme(theme: Theme): void {
  localStorage.setItem(key, theme);
  apply(theme);
  window.dispatchEvent(new Event('theme-change'));
}
export function useTheme(): { theme: Theme; setTheme: typeof setTheme } {
  const theme = useSyncExternalStore(
    subscribe,
    snapshot,
    (): Theme => 'macchiato'
  );
  useEffect((): (() => void) => {
    apply(theme);
    const media = window.matchMedia('(prefers-color-scheme: light)');
    const update = (): void => apply(theme);
    media.addEventListener('change', update);
    return (): void => media.removeEventListener('change', update);
  }, [theme]);
  return { theme, setTheme };
}

'use client';
import { useEffect, useRef, type JSX, type ReactNode } from 'react';
import { LuX } from 'react-icons/lu';
import { useI18n } from '@/i18n/useI18n';
import { IconButton } from './index';

/**
 * The app's side panel (forms such as New transaction, goals, the surplus split): a modal that
 * slides in from the left beside the menu, full width on phones. It shows `title` as its heading,
 * so the content inside needs no box or heading of its own. It closes on Escape, on a
 * press outside it and with its close button, and gives focus back to what opened it.
 */
export function SidePanel({
  title,
  onClose,
  children,
  testId,
}: {
  /** Names the panel for assistive technology. */
  title: string;
  onClose: () => void;
  children: ReactNode;
  testId?: string;
}): JSX.Element {
  const dialog = useRef<HTMLDialogElement>(null);
  const { t } = useI18n();
  useEffect((): (() => void) => {
    const element = dialog.current;
    const previous = document.activeElement;
    if (element && !element.open) element.showModal();
    return (): void => {
      element?.close();
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      aria-label={title}
      data-testid={testId}
      onCancel={(event): void => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event): void => {
        // A press on the backdrop reaches the dialog itself, outside its box.
        if (event.target !== event.currentTarget) return;
        const box = event.currentTarget.getBoundingClientRect();
        const inside =
          event.clientX >= box.left &&
          event.clientX <= box.right &&
          event.clientY >= box.top &&
          event.clientY <= box.bottom;
        if (!inside) onClose();
      }}
      className="fixed inset-y-0 right-auto left-0 m-0 h-dvh max-h-none w-full max-w-[500px] overflow-y-auto border-0 border-r border-[var(--ctp-surface1)] bg-[var(--ctp-mantle)] p-5 text-[var(--ctp-text)] shadow-lg transition-transform duration-300 backdrop:bg-[var(--ctp-crust)]/25 backdrop:backdrop-blur-xs starting:-translate-x-full"
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="min-w-0 truncate text-xl font-semibold">{title}</h2>
        <IconButton
          variant="quiet"
          aria-label={t.common.close}
          onClick={onClose}
        >
          <LuX size={20} aria-hidden />
        </IconButton>
      </div>
      {children}
    </dialog>
  );
}

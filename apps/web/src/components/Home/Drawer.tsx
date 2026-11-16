'use client';
import { Button } from '@/components/ui';
import { useEffect, useRef, type JSX, type ReactNode } from 'react';
import { useI18n } from '@/i18n/useI18n';
export default function Drawer({
  children,
  title,
  onClose,
}: {
  children: ReactNode;
  title: string;
  onClose: () => void;
}): JSX.Element {
  const dialog = useRef<HTMLDialogElement>(null);
  const { t } = useI18n();
  useEffect((): (() => void) => {
    const element = dialog.current;
    const previous = document.activeElement;
    element?.showModal();
    return (): void => {
      element?.close();
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      aria-label={title}
      onCancel={onClose}
      className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-full max-w-[500px] overflow-y-auto border-0 bg-[var(--ctp-mantle)] p-4 text-[var(--ctp-text)] backdrop:bg-black/30"
    >
      <Button variant="secondary" className="mb-3" onClick={onClose}>
        {t.common.cancel}
      </Button>
      {children}
    </dialog>
  );
}

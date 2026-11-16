import { Button } from '@/components/ui';
import clsx from 'clsx';
import type { ButtonHTMLAttributes, JSX } from 'react';

interface MenuButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  /** Icon only, centered: the compact side menu. */
  compact?: boolean;
}

export default function MenuButton({
  active = false,
  compact = false,
  children,
  onClick,
  ...props
}: Readonly<MenuButtonProps>): JSX.Element {
  return (
    <Button
      variant={compact ? 'rail' : 'nav'}
      aria-current={active ? 'page' : undefined}
      selected={active}
      onClick={onClick}
      {...props}
      className={clsx('flex items-center', !compact && 'h-11 w-full gap-3')}
    >
      {children}
    </Button>
  );
}

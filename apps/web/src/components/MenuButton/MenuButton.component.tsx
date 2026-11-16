import { Button } from '@/components/ui';
import type { ButtonHTMLAttributes, JSX } from 'react';

interface MenuButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

export default function MenuButton({
  active = false,
  children,
  onClick,
  ...props
}: Readonly<MenuButtonProps>): JSX.Element {
  return (
    <Button
      variant="nav"
      aria-current={active ? 'page' : undefined}
      selected={active}
      onClick={onClick}
      {...props}
      className="flex w-full items-center gap-3"
    >
      {children}
    </Button>
  );
}

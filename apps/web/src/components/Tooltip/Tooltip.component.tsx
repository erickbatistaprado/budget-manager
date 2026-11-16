'use client';

import clsx from 'clsx';
import { type JSX, type ReactNode } from 'react';

export interface TooltipProps {
  tooltip: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  children: ReactNode;
  fullWidth?: boolean;
}

export default function Tooltip({
  tooltip,
  placement = 'right',
  children,
  fullWidth,
}: Readonly<TooltipProps>): JSX.Element {
  const tooltipClasses: string = clsx(
    'absolute z-50 rounded-md bg-[var(--ctp-mantle)] px-2 py-1 text-xs text-[var(--ctp-text)] whitespace-nowrap',
    'opacity-0 group-hover:opacity-100 transition-opacity duration-200',
    'pointer-events-none',
    {
      'bottom-full left-1/2 -translate-x-1/2 mb-1': placement === 'top',
      'top-full left-1/2 -translate-x-1/2 mt-1': placement === 'bottom',
      'left-full top-1/2 -translate-y-1/2 ml-2': placement === 'right',
      'right-full top-1/2 -translate-y-1/2 mr-2': placement === 'left',
    }
  );

  return (
    <div
      className={clsx(
        'group relative inline-flex min-w-0 items-center',
        fullWidth && 'w-full'
      )}
    >
      {children}
      <span className={tooltipClasses}>{tooltip}</span>
    </div>
  );
}

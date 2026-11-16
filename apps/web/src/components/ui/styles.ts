import clsx from 'clsx';

export const buttonStyles = {
  base: 'inline-flex items-center justify-center gap-2 rounded-md font-medium cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ctp-blue)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
  variants: {
    primary:
      'bg-[var(--ctp-blue)] text-[var(--ctp-crust)] hover:enabled:brightness-110',
    secondary:
      'bg-[var(--ctp-surface1)] text-[var(--ctp-text)] hover:enabled:bg-[var(--ctp-surface2)]',
    danger:
      'bg-[var(--ctp-red)]/15 text-[var(--ctp-red)] hover:enabled:bg-[var(--ctp-red)]/25',
    nav: 'w-full !justify-start !gap-3 text-[var(--ctp-text)] hover:enabled:bg-[var(--ctp-blue)]/20',
    ghost: 'text-[var(--ctp-blue)] hover:enabled:bg-[var(--ctp-surface1)]',
    rail: 'h-11 w-11 shrink-0 !justify-start text-[var(--ctp-text)] hover:enabled:bg-[var(--ctp-blue)]/20',
    quiet: 'text-[var(--ctp-subtext0)] hover:enabled:text-[var(--ctp-text)]',
  },
  sizes: {
    sm: 'min-h-8 px-2 py-1 text-sm',
    md: 'min-h-10 px-3 py-2 text-sm',
    lg: 'min-h-12 px-4 py-3 font-bold',
    field: 'h-14 px-4 font-bold',
  },
};
export const control =
  'h-12 w-full min-w-0 rounded-md border border-[var(--ctp-surface2)] bg-[var(--ctp-base)] px-3 text-[var(--ctp-text)] focus:border-[var(--ctp-blue)] focus:ring-2 focus:ring-[var(--ctp-blue)]/25 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50';
export const floatingControl = clsx(
  control,
  'peer block appearance-none px-5 pt-5 pb-1'
);
export const fieldLabel =
  'flex min-w-0 flex-col gap-1 text-sm text-[var(--ctp-subtext1)]';
export const checkboxControl =
  'h-4 w-4 shrink-0 accent-[var(--ctp-blue)] focus-visible:ring-2 focus-visible:ring-[var(--ctp-blue)] disabled:cursor-not-allowed disabled:opacity-50';
export const panelStyle =
  'min-w-0 rounded-lg border border-[var(--ctp-surface1)] bg-[var(--ctp-surface0)] p-4';
export const badgeStyle =
  'inline-flex items-center rounded-full bg-[var(--ctp-surface1)] px-2 py-1 text-xs text-[var(--ctp-subtext1)]';

export function buttonClassName(
  variant: keyof typeof buttonStyles.variants = 'secondary',
  size: keyof typeof buttonStyles.sizes = 'md',
  fullWidth = false,
  className?: string
): string {
  return clsx(
    buttonStyles.base,
    buttonStyles.variants[variant],
    buttonStyles.sizes[size],
    fullWidth && 'w-full',
    className
  );
}

export const selectedButton = 'bg-[var(--ctp-blue)]/20';
export const checkboxLabel = 'flex items-center gap-2';

export const dismissOverlay =
  'fixed inset-0 z-40 cursor-pointer bg-[var(--ctp-crust)]/25 backdrop-blur-xs transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ctp-blue)] disabled:cursor-not-allowed disabled:opacity-50';

'use client';
import clsx from 'clsx';
import type { JSX } from 'react';

/**
 * A row of mutually exclusive options in one rounded container (periods, ranges, filters):
 * equal-width segments, the chosen one raised and tinted. Scrolls inside itself on narrow
 * screens instead of widening the page.
 */
export function SegmentedControl<Value extends string | null>({
  label,
  options,
  value,
  onChange,
  fullWidth = false,
}: {
  /** Names the group for assistive technology. */
  label: string;
  options: readonly { value: Value; label: string }[];
  value: Value;
  onChange: (value: Value) => void;
  fullWidth?: boolean;
}): JSX.Element {
  return (
    <div
      role="group"
      aria-label={label}
      className={clsx(
        'grid max-w-full auto-cols-fr grid-flow-col gap-1 overflow-x-auto rounded-lg border border-[var(--ctp-surface1)] bg-[var(--ctp-crust)]/40 p-1',
        fullWidth ? 'w-full' : 'w-fit'
      )}
    >
      {options.map((option): JSX.Element => {
        const selected = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            aria-pressed={selected}
            onClick={(): void => onChange(option.value)}
            className={clsx(
              'min-h-10 cursor-pointer rounded-md px-4 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-[var(--ctp-blue)] focus-visible:outline-none',
              selected
                ? 'bg-[var(--ctp-surface1)] text-[var(--ctp-blue)] shadow-sm'
                : 'text-[var(--ctp-subtext1)] hover:bg-[var(--ctp-surface0)] hover:text-[var(--ctp-text)]'
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

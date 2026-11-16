'use client';

import clsx from 'clsx';
import {
  cloneElement,
  forwardRef,
  useId,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type ReactElement,
  type HTMLAttributes,
  type ComponentPropsWithRef,
  type JSX,
} from 'react';
import {
  type buttonStyles,
  buttonClassName,
  fieldLabel,
  checkboxControl,
  panelStyle,
  badgeStyle,
  selectedButton,
  checkboxLabel,
  dismissOverlay,
} from './styles';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof buttonStyles.variants;
  size?: keyof typeof buttonStyles.sizes;
  fullWidth?: boolean;
  selected?: boolean;
}
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = 'secondary',
      size = 'md',
      fullWidth,
      selected,
      type = 'button',
      className,
      ...props
    },
    ref
  ): JSX.Element {
    return (
      <button
        ref={ref}
        type={type}
        className={clsx(
          buttonClassName(variant, size, fullWidth, className),
          (selected ??
            (props['aria-pressed'] === true ||
              props['aria-checked'] === true)) &&
            selectedButton
        )}
        {...props}
      />
    );
  }
);
export interface IconButtonProps extends ButtonProps {
  'aria-label': string;
}
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton({ size = 'sm', ...props }, ref): JSX.Element {
    return <Button ref={ref} size={size} {...props} />;
  }
);
export { TextInput, NumberInput, Select } from './outlined';
export type { SelectProps, TextInputProps, OutlineProps } from './outlined';
export type { DateFieldProps } from './dates';
export {
  DateField,
  MonthSwitcher,
  parseFieldDate,
  formatFieldDate,
} from './dates';
export interface CheckboxProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type'
> {
  label?: ReactNode;
}
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  function Checkbox({ className, label, ...props }, ref): JSX.Element {
    const input = (
      <input
        ref={ref}
        type="checkbox"
        className={clsx(checkboxControl, className)}
        {...props}
      />
    );
    return label ? (
      <label className={checkboxLabel}>
        {input}
        {label}
      </label>
    ) : (
      input
    );
  }
);
interface FieldControlProps {
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean | 'true' | 'false';
  label?: ReactNode;
}
export interface FieldProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'children'
> {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactElement<FieldControlProps>;
}
export function Field({
  label,
  hint,
  error,
  children,
  className,
  ...props
}: FieldProps): JSX.Element {
  const generatedId = useId();
  const id = children.props.id ?? generatedId;
  const describedBy =
    clsx(
      children.props['aria-describedby'],
      hint && `${id}-hint`,
      error && `${id}-error`
    ) || undefined;
  return (
    <div className={clsx(fieldLabel, className)} {...props}>
      {cloneElement(children, {
        id,
        label,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : children.props['aria-invalid'],
      })}
      {hint && <p id={`${id}-hint`}>{hint}</p>}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-[var(--ctp-red)]">
          {error}
        </p>
      )}
    </div>
  );
}
export type PanelProps = (
  | ({ as: 'form' } & ComponentPropsWithRef<'form'>)
  | ({ as?: 'section' } & ComponentPropsWithRef<'section'>)
  | ({ as: 'div' } & ComponentPropsWithRef<'div'>)
  | ({ as: 'li' } & ComponentPropsWithRef<'li'>)
) & { title?: string };
export function Panel({
  as = 'section',
  title,
  children,
  className,
  ...props
}: PanelProps): JSX.Element {
  const content = (
    <>
      {title && <h2 className="text-xl font-semibold">{title}</h2>}
      {children}
    </>
  );
  if (as === 'form')
    return (
      <form
        {...(props as ComponentPropsWithRef<'form'>)}
        className={clsx(panelStyle, className)}
      >
        {content}
      </form>
    );
  if (as === 'div')
    return (
      <div
        {...(props as ComponentPropsWithRef<'div'>)}
        className={clsx(panelStyle, className)}
      >
        {content}
      </div>
    );
  if (as === 'li')
    return (
      <li
        {...(props as ComponentPropsWithRef<'li'>)}
        className={clsx(panelStyle, className)}
      >
        {content}
      </li>
    );
  return (
    <section
      {...(props as ComponentPropsWithRef<'section'>)}
      className={clsx(panelStyle, className)}
    >
      {content}
    </section>
  );
}
export const Badge = forwardRef<
  HTMLSpanElement,
  HTMLAttributes<HTMLSpanElement>
>(function Badge({ className, ...props }, ref): JSX.Element {
  return <span ref={ref} className={clsx(badgeStyle, className)} {...props} />;
});

export type DismissOverlayProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  'aria-label': string;
};

export const DismissOverlay = forwardRef<
  HTMLButtonElement,
  DismissOverlayProps
>(function DismissOverlay(
  { className, type = 'button', ...props },
  ref
): JSX.Element {
  return (
    <button
      ref={ref}
      type={type}
      className={clsx(dismissOverlay, className)}
      {...props}
    />
  );
});

export function ProgressBar({
  value,
  label,
  danger = false,
  success = false,
}: {
  value: number;
  label: string;
  danger?: boolean;
  success?: boolean;
}): JSX.Element {
  const percent = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-valuetext={`${Math.round(value)}%`}
      className="h-1 w-full overflow-hidden rounded bg-[var(--ctp-surface1)]"
    >
      <div
        className={clsx(
          'h-full bg-[var(--ctp-blue)]',
          success && 'bg-[var(--ctp-green)]',
          danger && 'bg-[var(--ctp-red)]'
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

/** The vertical line between table columns, shared by the header and the rows. */
export const columnDivider = 'border-l border-[var(--ctp-surface1)]';

export function EntryRow({
  icon,
  description,
  detail,
  date,
  amount,
  actions,
  table = false,
}: {
  table?: boolean;
  icon: ReactNode;
  description: ReactNode;
  detail: ReactNode;
  date: ReactNode;
  amount: ReactNode;
  actions: ReactNode;
}): JSX.Element {
  if (table) {
    return (
      <tr className="border-b border-[var(--ctp-surface1)] text-sm">
        <td className="p-2 sm:p-3">
          <span aria-hidden="true" className="mr-2">
            {icon}
          </span>
          {description}
          <div className="mt-1 space-y-0.5 text-xs text-[var(--ctp-subtext1)] sm:hidden">
            <div>{detail}</div>
            <div>{date}</div>
          </div>
        </td>
        <td
          className={clsx(
            columnDivider,
            'hidden p-3 text-[var(--ctp-subtext1)] sm:table-cell'
          )}
        >
          {detail}
        </td>
        <td
          className={clsx(
            columnDivider,
            'hidden p-3 text-[var(--ctp-subtext1)] sm:table-cell'
          )}
        >
          {date}
        </td>
        <td
          className={clsx(
            columnDivider,
            'p-2 text-right font-semibold whitespace-nowrap tabular-nums sm:p-3'
          )}
        >
          {amount}
        </td>
        <td className="p-2 sm:p-3">
          <div className="flex flex-col items-end gap-1 sm:flex-row sm:items-center sm:justify-end">
            {actions}
          </div>
        </td>
      </tr>
    );
  }
  return (
    <div className="grid min-h-16 min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-[var(--ctp-surface1)] py-3 text-sm sm:grid-cols-[auto_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
      <span aria-hidden="true">{icon}</span>
      <div className="min-w-0 truncate">{description}</div>
      <div className="col-start-2 min-w-0 truncate text-[var(--ctp-subtext1)] sm:col-auto">
        {detail}
      </div>
      <div className="col-start-2 min-w-0 text-[var(--ctp-subtext1)] sm:col-auto">
        {date}
      </div>
      <div className="col-start-3 row-start-1 text-right font-semibold tabular-nums sm:col-auto sm:row-auto">
        {amount}
      </div>
      <div className="col-start-3 row-span-2 flex items-center justify-end gap-1 sm:col-auto sm:row-auto sm:row-span-1">
        {actions}
      </div>
    </div>
  );
}

'use client';

import {
  Children,
  isValidElement,
  forwardRef,
  useId,
  useState,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type ReactNode,
  type JSX,
} from 'react';
import clsx from 'clsx';

export interface OutlineProps {
  label?: ReactNode;
  size?: 'small' | 'medium';
  fullWidth?: boolean;
  helperText?: ReactNode;
  error?: boolean;
  startAdornment?: ReactNode;
  endAdornment?: ReactNode;
}
interface FrameProps extends OutlineProps {
  id: string;
  filled: boolean;
  disabled?: boolean;
  required?: boolean;
  children: ReactNode;
}
export function Outline({
  id,
  label,
  size = 'medium',
  fullWidth = true,
  helperText,
  error,
  filled,
  disabled,
  required,
  startAdornment,
  endAdornment,
  children,
}: FrameProps): JSX.Element {
  const [focused, setFocused] = useState(false);
  return (
    <div
      className={clsx('outlined-field', fullWidth && 'w-full')}
      data-filled={filled}
      data-floating={filled || focused}
      onFocusCapture={(): void => setFocused(true)}
      onBlurCapture={(event): void => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setFocused(false);
      }}
      data-error={error}
      data-disabled={disabled}
      data-size={size}
    >
      <div className="outlined-box">
        {startAdornment && (
          <span className="outlined-start">{startAdornment}</span>
        )}
        {children}
        {label && (
          <label htmlFor={id} className="truncate whitespace-nowrap">
            {label}
            {required && (
              <span className="required-marker" aria-hidden="true" />
            )}
          </label>
        )}
        <fieldset aria-hidden="true">
          <legend className="truncate whitespace-nowrap">
            <span>
              {label}
              {required && ' *'}
            </span>
          </legend>
        </fieldset>
        {endAdornment && <span className="outlined-end">{endAdornment}</span>}
      </div>
      {helperText && (
        <p id={`${id}-helper`} role={error ? 'alert' : undefined}>
          {helperText}
        </p>
      )}
    </div>
  );
}
export interface TextInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'>, OutlineProps {}
export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  function TextInput(
    {
      label,
      size,
      fullWidth,
      helperText,
      error,
      startAdornment,
      endAdornment,
      className,
      id: suppliedId,
      onChange,
      ...props
    },
    ref
  ): JSX.Element {
    const generated = useId();
    const id = suppliedId ?? generated;
    const [uncontrolled, setUncontrolled] = useState(props.defaultValue ?? '');
    const value = props.value ?? uncontrolled;
    return (
      <Outline
        {...{
          id,
          label: label ?? props['aria-label'] ?? props.placeholder,
          size,
          fullWidth,
          helperText,
          error:
            error ||
            props['aria-invalid'] === true ||
            props['aria-invalid'] === 'true',
          startAdornment,
          endAdornment,
          disabled: props.disabled,
          required: props.required,
        }}
        filled={String(value).length > 0}
      >
        <input
          {...props}
          id={id}
          ref={ref}
          className={clsx('truncate whitespace-nowrap', className)}
          aria-invalid={error || props['aria-invalid'] || undefined}
          aria-describedby={
            clsx(props['aria-describedby'], helperText && `${id}-helper`) ||
            undefined
          }
          onChange={(event): void => {
            setUncontrolled(event.target.value);
            onChange?.(event);
          }}
        />
      </Outline>
    );
  }
);
export const NumberInput = forwardRef<
  HTMLInputElement,
  Omit<TextInputProps, 'type'>
>(function NumberInput(props, ref): JSX.Element {
  return <TextInput {...props} type="number" ref={ref} />;
});
export interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'>, OutlineProps {
  options?: readonly {
    label: string;
    value: string | number;
    disabled?: boolean;
  }[];
}
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select(
    {
      label,
      size,
      fullWidth,
      helperText,
      error,
      startAdornment,
      endAdornment,
      className,
      id: suppliedId,
      options,
      children,
      onChange,
      ...props
    },
    ref
  ): JSX.Element {
    const generated = useId();
    const id = suppliedId ?? generated;
    const firstChild = Children.toArray(children).find((child): boolean =>
      isValidElement(child)
    );
    let firstValue: string | number = options?.[0]?.value ?? '';
    if (isValidElement<{ value?: string | number }>(firstChild))
      firstValue = firstChild.props.value ?? '';
    const [uncontrolled, setUncontrolled] = useState(
      props.defaultValue ?? firstValue
    );
    const value = props.value ?? uncontrolled;
    return (
      <Outline
        {...{
          id,
          label: label ?? props['aria-label'],
          size,
          fullWidth,
          helperText,
          error:
            error ||
            props['aria-invalid'] === true ||
            props['aria-invalid'] === 'true',
          startAdornment,
          disabled: props.disabled,
          required: props.required,
        }}
        filled={String(value).length > 0}
        endAdornment={endAdornment ?? <span aria-hidden="true">⌄</span>}
      >
        <select
          {...props}
          id={id}
          ref={ref}
          className={clsx('truncate whitespace-nowrap', className)}
          aria-invalid={error || props['aria-invalid'] || undefined}
          aria-describedby={
            clsx(props['aria-describedby'], helperText && `${id}-helper`) ||
            undefined
          }
          onChange={(event): void => {
            setUncontrolled(event.target.value);
            onChange?.(event);
          }}
        >
          {options
            ? options.map((option): JSX.Element => (
                <option
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                >
                  {option.label}
                </option>
              ))
            : children}
        </select>
      </Outline>
    );
  }
);

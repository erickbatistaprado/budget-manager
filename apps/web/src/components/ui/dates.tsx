'use client';

import clsx from 'clsx';
import { useEffect, useId, useRef, useState, type JSX } from 'react';
import DatePicker from 'react-datepicker';
import { enUS } from 'date-fns/locale/en-US';
import { ptBR } from 'date-fns/locale/pt-BR';
import { useI18n } from '@/i18n/useI18n';
import { Button, IconButton } from './index';
import { TextInput, type OutlineProps } from './outlined';
export interface DateFieldProps extends OutlineProps {
  value: Date | null;
  onChange: (value: Date | null) => void;
  min?: Date;
  max?: Date;
  id?: string;
  name?: string;
  form?: string;
  disabled?: boolean;
  required?: boolean;
  'aria-label'?: string;
}
function nativeDate(value: Date | null): string {
  if (!value) return '';
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}
export function DateField({
  value,
  onChange,
  min,
  max,
  ...props
}: DateFieldProps): JSX.Element {
  const { language } = useI18n();
  const portuguese = language === 'pt';
  const locale = portuguese ? ptBR : enUS;
  const format = portuguese ? 'dd/MM/yyyy' : 'MM/dd/yyyy';
  function display(date: Date | null): string {
    return date
      ? date.toLocaleDateString(portuguese ? 'pt-BR' : 'en-US', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
      : '';
  }
  const [draft, setDraft] = useState(display(value));
  const [invalid, setInvalid] = useState(false);
  const [open, setOpen] = useState(false);
  const [coarse, setCoarse] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const dialog = useId();
  const calendar = useRef<HTMLDivElement>(null);
  useEffect((): void => {
    if (open)
      calendar.current
        ?.querySelector<HTMLElement>('.react-datepicker__day[tabindex="0"]')
        ?.focus();
  }, [open]);
  useEffect((): void => {
    const message = portuguese
      ? 'Informe uma data válida.'
      : 'Enter a valid date.';
    input.current?.setCustomValidity(invalid ? message : '');
  }, [invalid, portuguese]);
  const stamp = value?.getTime();
  const [previous, setPrevious] = useState({ stamp, language });
  if (previous.stamp !== stamp || previous.language !== language) {
    setPrevious({ stamp, language });
    setDraft(display(value));
    setInvalid(false);
  }
  useEffect((): (() => void) | undefined => {
    if (!window.matchMedia) return;
    const media = window.matchMedia('(pointer: coarse)');
    const update = (): void => setCoarse(media.matches);
    update();
    media.addEventListener('change', update);
    return (): void => media.removeEventListener('change', update);
  }, []);
  function close(): void {
    setOpen(false);
    input.current?.focus();
  }
  function choose(date: Date | null): void {
    onChange(date);
    setDraft(display(date));
    setInvalid(false);
    close();
  }
  const invalidMessage = portuguese
    ? 'Informe uma data válida dentro do período permitido.'
    : 'Enter a valid date within the allowed range.';
  return (
    <div
      className={clsx(
        'relative min-w-0',
        props.fullWidth !== false && 'w-full'
      )}
      onKeyDown={(event): void => {
        if (event.key === 'Escape' && open) {
          event.preventDefault();
          event.stopPropagation();
          close();
        }
      }}
    >
      <TextInput
        {...props}
        ref={input}
        onKeyDown={(event): void => {
          if (
            event.key === 'ArrowDown' &&
            event.altKey &&
            !coarse &&
            !props.disabled
          ) {
            event.preventDefault();
            setOpen(true);
          }
        }}
        type={coarse ? 'date' : 'text'}
        inputMode={coarse ? undefined : 'numeric'}
        placeholder={portuguese ? 'dd/mm/aaaa' : 'mm/dd/yyyy'}
        value={coarse ? nativeDate(value) : draft}
        min={nativeDate(min ?? null)}
        max={nativeDate(max ?? null)}
        error={invalid || props.error}
        helperText={invalid ? invalidMessage : props.helperText}
        endAdornment={
          !coarse && (
            <IconButton
              aria-label={portuguese ? 'Abrir calendário' : 'Open calendar'}
              disabled={props.disabled}
              aria-expanded={open}
              aria-controls={dialog}
              onClick={(): void => setOpen(!open)}
            >
              ▦
            </IconButton>
          )
        }
        onChange={(event): void => {
          if (coarse) {
            choose(
              event.target.value
                ? new Date(`${event.target.value}T00:00:00`)
                : null
            );
            return;
          }
          const digits = event.target.value.replace(/\D/g, '').slice(0, 8);
          const masked = [
            digits.slice(0, 2),
            digits.slice(2, 4),
            digits.slice(4),
          ]
            .filter(Boolean)
            .join('/');
          setDraft(masked);
          if (!digits) {
            setInvalid(false);
            onChange(null);
            return;
          }
          const first = Number(digits.slice(0, 2));
          const second = Number(digits.slice(2, 4));
          const year = Number(digits.slice(4));
          const day = portuguese ? first : second;
          const month = portuguese ? second : first;
          const date = new Date(year, month - 1, day);
          const valid =
            digits.length === 8 &&
            year >= 100 &&
            date.getFullYear() === year &&
            date.getMonth() === month - 1 &&
            date.getDate() === day &&
            (!min || date >= min) &&
            (!max || date <= max);
          setInvalid(!valid);
          if (valid) onChange(date);
        }}
      />
      {open && (
        <div
          ref={calendar}
          id={dialog}
          role="dialog"
          aria-label={portuguese ? 'Calendário' : 'Calendar'}
          className="absolute left-0 z-50 w-[17rem] max-w-full rounded-md border border-[var(--ctp-surface2)] bg-[var(--ctp-base)] p-2"
        >
          <DatePicker
            inline
            selected={value}
            onChange={choose}
            minDate={min}
            maxDate={max}
            locale={locale}
            formatWeekDay={(name): string => {
              const weekday = ([0, 1, 2, 3, 4, 5, 6] as const).find(
                (day): boolean =>
                  locale.localize.day(day, { width: 'wide' }) === name
              );
              return weekday === undefined
                ? name.slice(0, 2)
                : locale.localize.day(weekday, { width: 'short' });
            }}
            dateFormat={format}
          />
        </div>
      )}
    </div>
  );
}
export function MonthSwitcher({
  value,
  onChange,
}: {
  value: Date;
  onChange: (date: Date) => void;
}): JSX.Element {
  const { language } = useI18n();
  const portuguese = language === 'pt';
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(value.getFullYear());
  const trigger = useRef<HTMLButtonElement>(null);
  const today = new Date();
  function close(): void {
    setOpen(false);
    trigger.current?.focus();
  }
  return (
    <div
      className="relative flex items-center gap-2"
      onKeyDown={(event): void => {
        if (event.key === 'Escape' && open) {
          event.preventDefault();
          event.stopPropagation();
          close();
        }
      }}
    >
      <IconButton
        aria-label={portuguese ? 'Mês anterior' : 'Previous month'}
        onClick={(): void =>
          onChange(new Date(value.getFullYear(), value.getMonth() - 1, 1))
        }
      >
        ‹
      </IconButton>
      <Button
        ref={trigger}
        aria-expanded={open}
        onClick={(): void => {
          setYear(value.getFullYear());
          setOpen(!open);
        }}
      >
        {value.toLocaleDateString(portuguese ? 'pt-BR' : 'en-US', {
          month: 'long',
          year: 'numeric',
        })}
      </Button>
      <IconButton
        aria-label={portuguese ? 'Próximo mês' : 'Next month'}
        onClick={(): void =>
          onChange(new Date(value.getFullYear(), value.getMonth() + 1, 1))
        }
      >
        ›
      </IconButton>
      {open && (
        <div
          role="dialog"
          aria-label={portuguese ? 'Selecionar mês' : 'Select month'}
          className="absolute top-full left-0 z-50 w-72 max-w-[calc(100vw-4rem)] rounded-md border border-[var(--ctp-surface2)] bg-[var(--ctp-base)] p-3"
        >
          <TextInput
            label={portuguese ? 'Ano' : 'Year'}
            type="number"
            value={year}
            min={100}
            max={9999}
            onChange={(event): void => setYear(Number(event.target.value))}
          />
          <div className="grid grid-cols-3 gap-1">
            {Array.from({ length: 12 }, (unusedValue, month): JSX.Element => (
              <Button
                key={month}
                disabled={!Number.isInteger(year) || year < 100 || year > 9999}
                aria-pressed={
                  value.getMonth() === month && value.getFullYear() === year
                }
                selected={
                  value.getMonth() === month && value.getFullYear() === year
                }
                aria-current={
                  today.getMonth() === month && today.getFullYear() === year
                    ? 'date'
                    : undefined
                }
                onKeyDown={(event): void => {
                  const offsets: Record<string, number> = {
                    ArrowRight: 1,
                    ArrowLeft: -1,
                    ArrowDown: 3,
                    ArrowUp: -3,
                  };
                  const offset = offsets[event.key];
                  if (offset) {
                    event.preventDefault();
                    const buttons =
                      event.currentTarget.parentElement?.querySelectorAll(
                        'button'
                      );
                    buttons?.[(month + offset + 12) % 12]?.focus();
                  }
                }}
                onClick={(): void => {
                  onChange(new Date(year, month, 1));
                  close();
                }}
              >
                {new Date(year, month, 1).toLocaleDateString(
                  portuguese ? 'pt-BR' : 'en-US',
                  { month: 'short' }
                )}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function parseFieldDate(value: string): Date | null {
  return value ? new Date(`${value.replaceAll('/', '-')}T00:00:00`) : null;
}
export function formatFieldDate(value: Date | null): string {
  return nativeDate(value);
}

'use client';
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type JSX,
} from 'react';
import { useI18n } from '@/i18n/useI18n';
import { getLocation } from '@/utils/globalFormats.util';
import { TextInput, type TextInputProps } from './outlined';

type Locale = ReturnType<typeof getLocation>;

function separators(locale: Locale): { group: string; decimal: string } {
  const parts = new Intl.NumberFormat(locale).formatToParts(1234.5);
  return {
    group: parts.find((part): boolean => part.type === 'group')?.value ?? ',',
    decimal:
      parts.find((part): boolean => part.type === 'decimal')?.value ?? '.',
  };
}

/**
 * Reads an amount typed the way the locale writes it ("1.234,56" in pt-BR, "1,234.56" in en-US),
 * also taking a lone separator of the other kind followed by one or two digits as the decimal
 * ("12.5" in pt-BR, "12,5" in en-US). Returns the amount as a plain "1234.56" string, "" for an
 * empty field and null when it is not an amount with at most two decimals.
 */
export function parseMoney(text: string, locale: Locale): string | null {
  const { group, decimal } = separators(locale);
  const compact = text.replace(/\s|R\$/g, '');
  if (compact === '') return '';
  const negative = compact.startsWith('-');
  const unsigned = negative ? compact.slice(1) : compact;
  const other = decimal === ',' ? '.' : ',';
  let decimalMark = decimal;
  if (!unsigned.includes(decimal)) {
    const lone = unsigned.split(other).length === 2;
    if (lone && new RegExp(`\\${other}\\d{1,2}$`).test(unsigned))
      decimalMark = other;
  }
  const at = unsigned.lastIndexOf(decimalMark);
  const whole = at === -1 ? unsigned : unsigned.slice(0, at);
  const fraction = at === -1 ? '' : unsigned.slice(at + 1);
  const groupMark = decimalMark === decimal ? group : decimal;
  const digits = whole.split(groupMark).join('');
  if (!/^\d*$/.test(digits) || !/^\d{0,2}$/.test(fraction)) return null;
  if (digits === '' && fraction === '') return null;
  const amount = `${digits === '' ? '0' : digits.replace(/^0+(?=\d)/, '')}${fraction ? `.${fraction}` : ''}`;
  return negative ? `-${amount}` : amount;
}

/** Shows an amount with the locale's grouping and two decimals, without the currency symbol. */
export function formatMoney(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export interface MoneyInputProps extends Omit<
  TextInputProps,
  'type' | 'value' | 'defaultValue' | 'onChange' | 'min' | 'max' | 'step'
> {
  /** The amount as a number or a plain "1234.56" string; empty for no amount. */
  value: string | number | null | undefined;
  /** Receives the amount as a plain "1234.56" string, or "" when empty or not a valid amount. */
  onValueChange: (value: string) => void;
  min?: number | string;
  max?: number | string;
}

/**
 * Amount field in reais: accepts the separators of the current language, shows the amount
 * formatted when it is not being edited, and reports invalid or out-of-range amounts through
 * the browser's form validation.
 */
export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(
  function MoneyInput(
    {
      value,
      onValueChange,
      min,
      max,
      startAdornment,
      onFocus,
      onBlur,
      ...props
    },
    ref
  ): JSX.Element {
    const { language, t } = useI18n();
    const locale = getLocation(language);
    const input = useRef<HTMLInputElement>(null);
    useImperativeHandle(
      ref,
      (): HTMLInputElement => input.current as HTMLInputElement
    );
    const canonical =
      value === null || value === undefined ? '' : String(value);
    const [draft, setDraft] = useState<string | null>(null);
    // When the form sets a different amount (a reset after saving, a prefill), drop the text
    // being edited so the field shows the new amount.
    const [seen, setSeen] = useState(canonical);
    if (seen !== canonical) {
      setSeen(canonical);
      const typed = draft === null ? null : (parseMoney(draft, locale) ?? '');
      const same =
        typed === canonical ||
        (typed !== null &&
          typed !== '' &&
          canonical !== '' &&
          Number(typed) === Number(canonical));
      if (typed !== null && !same) setDraft(null);
    }
    const number = Number(canonical);
    const formatted =
      canonical === '' || Number.isNaN(number)
        ? canonical
        : formatMoney(number, locale);
    const shown = draft ?? formatted;
    const parsed = parseMoney(shown, locale);
    let message = '';
    if (parsed === null) message = t.common.invalidAmount;
    else if (parsed !== '' && min !== undefined && Number(parsed) < Number(min))
      message = t.common.amountAtLeast(formatMoney(Number(min), locale));
    else if (parsed !== '' && max !== undefined && Number(parsed) > Number(max))
      message = t.common.amountAtMost(formatMoney(Number(max), locale));
    useEffect((): void => {
      input.current?.setCustomValidity(message);
    }, [message]);
    return (
      <TextInput
        {...props}
        ref={input}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        startAdornment={startAdornment ?? <span aria-hidden="true">R$</span>}
        value={shown}
        error={(draft !== null && message !== '') || props.error}
        helperText={draft !== null && message ? message : props.helperText}
        onFocus={(event): void => {
          setDraft(formatted);
          onFocus?.(event);
        }}
        onBlur={(event): void => {
          // Keep text that is not an amount on screen so it can be fixed.
          if (draft === null || parseMoney(draft, locale) !== null)
            setDraft(null);
          onBlur?.(event);
        }}
        onChange={(event): void => {
          const text = event.currentTarget.value;
          setDraft(text);
          onValueChange(parseMoney(text, locale) ?? '');
        }}
      />
    );
  }
);

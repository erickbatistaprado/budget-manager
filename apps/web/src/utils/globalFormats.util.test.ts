import {
  formatCurrency,
  formatDate,
  getApiDate,
  parseApiDate,
} from './globalFormats.util';

describe('parseApiDate', (): void => {
  it('reads API dates as local calendar days', (): void => {
    const date: Date = parseApiDate('2026/11/27');

    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(10);
    expect(date.getDate()).toBe(27);
  });

  it('keeps the first of the month in its own month', (): void => {
    expect(parseApiDate('2026/10/01').getMonth()).toBe(9);
    expect(parseApiDate('2026-10-01').getDate()).toBe(1);
  });

  it('round-trips with getApiDate and formats the same day', (): void => {
    expect(getApiDate(parseApiDate('2026/03/09'))).toBe('2026/03/09');
    expect(formatDate('2026/11/27', 'en')).toBe('11/27/2026');
    expect(formatDate('2026/11/27', 'pt')).toBe('27/11/2026');
  });
});

describe('formatCurrency', (): void => {
  it('formats currency as Brazilian reais with en-US locale for English', (): void => {
    const formatted: string | undefined = formatCurrency(1234.56, 'en');
    expect(formatted).toBe('R$1,234.56');
  });

  it('formats currency as Brazilian reais with pt-BR locale for Portuguese', (): void => {
    const formatted: string | undefined = formatCurrency(1234.56, 'pt');
    expect(formatted?.replace(/\u00a0/g, ' ')).toBe('R$ 1.234,56');
  });

  it('returns undefined when value is undefined', (): void => {
    expect(formatCurrency(undefined, 'en')).toBeUndefined();
  });
});

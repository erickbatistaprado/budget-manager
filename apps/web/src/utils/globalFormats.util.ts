export interface DateRangeTransactions {
  startDate: Date;
  endDate: Date;
}
export function getLocation(language: string): 'en-US' | 'pt-BR' {
  if (language.startsWith('pt')) {
    return 'pt-BR';
  }
  return 'en-US';
}

export function getCurrency(): 'BRL' {
  return 'BRL';
}

export function getLocalDate(date: Date): string {
  const year: number = date.getFullYear();
  const day: string = date.getDate().toString().padStart(2, '0');
  const month: string = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getApiDate(date: Date): string {
  return getLocalDate(date).replaceAll('-', '/');
}

/**
 * Reads an API date (`2026/11/27`) as that calendar day in the browser's time zone. `new
 * Date('2026-11-27')` would read it as midnight UTC, which is still the 26th in Brazil, and would
 * move anything due on the 1st into the previous month.
 */
export function parseApiDate(date: Date | string): Date {
  if (date instanceof Date) {
    return date;
  }
  const match: RegExpMatchArray | null = /^(\d{4})[/-](\d{2})[/-](\d{2})/.exec(
    date
  );
  if (!match) {
    return new Date(date);
  }
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function formatDate(
  date: Date | string,
  language: string = 'en'
): string {
  return parseApiDate(date).toLocaleDateString(getLocation(language), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export function formatCurrency(
  value: bigint | number | undefined,
  language: string = 'en'
): string | undefined {
  return value?.toLocaleString(getLocation(language), {
    currency: 'BRL',
    minimumFractionDigits: 2,
    style: 'currency',
  });
}

export function roundNumbersUp(value: number, divisor: number): number {
  return Math.ceil((value / divisor) * 100) / 100;
}

export function getStartOfTheMonthAndEndOfTheMonth(
  date: Date
): DateRangeTransactions {
  const start = new Date(date);
  start.setDate(1);
  start.setHours(0, 0, 0, 0);

  const end = new Date(date);
  end.setMonth(end.getMonth() + 1);
  end.setDate(0);
  end.setHours(0, 0, 0, 0);

  return { startDate: start, endDate: end };
}

export function getStartOfMonth(date: Date): Date {
  const start = new Date(date);
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  return start;
}

export function getEndOfMonth(date: Date): Date {
  const end = new Date(date);
  end.setMonth(end.getMonth() + 1);
  end.setDate(0);
  end.setHours(23, 59, 59, 999);
  return end;
}

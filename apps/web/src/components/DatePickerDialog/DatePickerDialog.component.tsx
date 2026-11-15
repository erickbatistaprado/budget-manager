'use client';

import { DatePickerCustomButton } from '@/components';
import { useI18n } from '@/i18n/useI18n';
import { enUS } from 'date-fns/locale/en-US';
import { ptBR } from 'date-fns/locale/pt-BR';
import type { Dispatch, JSX, SetStateAction } from 'react';
import DatePicker from 'react-datepicker';

export interface DatePickerDialogProps {
  date: Date;
  setDate: Dispatch<SetStateAction<Date>>;
  dateFormat?: string;
  showMonthYearPicker?: boolean;
  arrows?: boolean;
}

export default function DatePickerDialog({
  date,
  arrows,
  setDate,
  dateFormat,
  showMonthYearPicker,
}: Readonly<DatePickerDialogProps>): JSX.Element {
  const { language } = useI18n();
  const locale = language === 'pt' ? ptBR : enUS;

  return (
    <div className="flex items-center justify-center rounded-xl">
      <DatePicker
        selected={date}
        onChange={(newDate: Date | null): void =>
          setDate(newDate ?? new Date())
        }
        dateFormat={dateFormat ?? 'dd/MMMM/yyyy'}
        showMonthYearPicker={showMonthYearPicker}
        customInput={
          <DatePickerCustomButton arrows={arrows} setDate={setDate} />
        }
        locale={locale}
        showPopperArrow={false}
      />
    </div>
  );
}

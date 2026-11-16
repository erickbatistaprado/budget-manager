'use client';
import { Panel, SegmentedControl } from '@/components/ui';
import { useState, type JSX } from 'react';
import { BarChart, LineChart } from '@mui/x-charts';
import type { Evolution as EvolutionPoint } from '@budget-manager/api-client';
import { useI18n } from '@/i18n/useI18n';
import { parseApiDate } from '@/utils/globalFormats.util';
import { formatBRL } from '@/utils/analytics.util';

import { evolutionData } from './model';
export default function Evolution({
  rows,
}: {
  rows: EvolutionPoint[];
}): JSX.Element {
  const { t, language } = useI18n();
  const labels = t.dashboard;
  const [all, setAll] = useState(false);
  const data = evolutionData(rows, all);
  const compact = new Intl.NumberFormat(language === 'pt' ? 'pt-BR' : 'en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  });
  const axis = [
    {
      width: 80,
      valueFormatter: (value: number): string => compact.format(value),
    },
  ];
  const money = (value: number | null): string =>
    formatBRL(value ?? 0, language);
  const sx = {
    '& .MuiChartsAxis-tickLabel': { fill: 'var(--ctp-text)' },
    '& .MuiChartsAxis-line, & .MuiChartsAxis-tick': {
      stroke: 'var(--ctp-overlay0)',
    },
  };
  return (
    <Panel className="flex w-full flex-col gap-3" aria-labelledby="evolution">
      <div className="flex flex-wrap justify-between gap-2">
        <h2 id="evolution" className="text-xl font-semibold">
          {labels.evolution}
        </h2>
        <SegmentedControl
          label={labels.evolution}
          value={all ? 'all' : 'year'}
          onChange={(range): void => setAll(range === 'all')}
          options={[
            { value: 'year', label: labels.year },
            { value: 'all', label: labels.allTime },
          ]}
        />
      </div>
      <p className="text-sm text-[var(--ctp-subtext0)]">{labels.projection}</p>
      <div className="flex flex-wrap gap-4 text-sm">
        <span className="text-[var(--ctp-green)]">● {labels.surplus}</span>
        <span className="text-[var(--ctp-red)]">● {labels.shortfall}</span>
        <span className="text-[var(--ctp-mauve)]">● {labels.invested}</span>
        <span className="text-[var(--ctp-blue)]">● {labels.netWorth}</span>
      </div>
      <div className="grid min-w-0 lg:grid-cols-2">
        <BarChart
          height={260}
          sx={sx}
          hideLegend
          localeText={{ noData: labels.empty, loading: labels.loading }}
          xAxis={[
            {
              scaleType: 'band',
              data: data.months.map((month): string =>
                parseApiDate(
                  `${month.replace('-', '/')}/01`
                ).toLocaleDateString(language === 'pt' ? 'pt-BR' : 'en-US', {
                  month: 'short',
                  year: '2-digit',
                })
              ),
            },
          ]}
          yAxis={axis}
          series={[
            {
              data: data.positive,
              label: labels.surplus,
              color: 'var(--ctp-green)',
              stack: 'surplus',
              valueFormatter: money,
            },
            {
              data: data.negative,
              label: labels.shortfall,
              color: 'var(--ctp-red)',
              stack: 'surplus',
              valueFormatter: money,
            },
            {
              data: data.invested,
              label: labels.invested,
              color: 'var(--ctp-mauve)',
              valueFormatter: money,
            },
          ]}
        />
        <LineChart
          height={260}
          sx={sx}
          hideLegend
          localeText={{ noData: labels.empty, loading: labels.loading }}
          xAxis={[
            {
              scaleType: 'point',
              data: data.months.map((month): string =>
                parseApiDate(
                  `${month.replace('-', '/')}/01`
                ).toLocaleDateString(language === 'pt' ? 'pt-BR' : 'en-US', {
                  month: 'short',
                  year: '2-digit',
                })
              ),
            },
          ]}
          yAxis={axis}
          series={[
            {
              data: data.netWorth,
              label: labels.netWorth,
              color: 'var(--ctp-blue)',
              valueFormatter: money,
            },
          ]}
        />
      </div>
    </Panel>
  );
}

import { screen } from '@testing-library/react';
import { renderWithI18n } from '@/i18n/testing';
import CardLimit from './CardLimit';

it.each(['en', 'pt'] as const)(
  'shows localized available and total limits in %s',
  (language): void => {
    renderWithI18n(
      <CardLimit creditLimit={50000} availableLimit={40000} showBar />,
      { language }
    );
    expect(
      screen.getByText(
        language === 'pt'
          ? /Limite disponível.*40\.000,00.*de.*50\.000,00/
          : /Available limit.*40,000.00.*of.*50,000.00/
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveValue(20);
  }
);
it.each(['en', 'pt'] as const)(
  'shows over-limit warning with capped bar in %s',
  (language): void => {
    renderWithI18n(
      <CardLimit creditLimit={100} availableLimit={-20} showBar />,
      { language }
    );
    expect(
      screen.getByText(language === 'pt' ? 'Acima do limite' : 'Over the limit')
    ).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveValue(100);
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuetext',
      '120%'
    );
  }
);
it('omits the limit line and bar when no limit is set', (): void => {
  renderWithI18n(
    <CardLimit creditLimit={null} availableLimit={null} showBar />
  );
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  expect(screen.queryByText(/Available limit/)).not.toBeInTheDocument();
});

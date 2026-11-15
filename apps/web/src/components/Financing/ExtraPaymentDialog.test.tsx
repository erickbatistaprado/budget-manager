import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithI18n } from '@/i18n/testing';
import { postFetcher } from '@/libs/fetchers.lib';
import type { Language } from '@/i18n/I18nProvider';
import { en } from '@/i18n/messages/en';
import { pt } from '@/i18n/messages/pt';
import ExtraPaymentDialog from './ExtraPaymentDialog';
jest.mock('@/libs/fetchers.lib', (): object => ({ postFetcher: jest.fn() }));
const post = jest.mocked(postFetcher);
beforeEach((): void => {
  jest.clearAllMocks();
});
it.each<Language>(['en', 'pt'])(
  'shows both options before confirmation in %s',
  async (language): Promise<void> => {
    const texts = language === 'pt' ? pt.financing : en.financing;
    const onSaved = jest.fn().mockResolvedValue(undefined);
    const onClose = jest.fn();
    post.mockResolvedValueOnce([
      { option: 'REDUCE_TERM', interestSaved: 1200, schedule: [] },
      { option: 'REDUCE_PAYMENT', interestSaved: 800, schedule: [] },
    ]);
    renderWithI18n(
      <ExtraPaymentDialog id="loan" onSaved={onSaved} onClose={onClose} />,
      { language }
    );
    expect(screen.queryByText(texts.confirm)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(texts.adjustmentAmount), {
      target: { value: '5000' },
    });
    fireEvent.change(screen.getByLabelText(texts.date), {
      target: { value: '2026-11-28' },
    });
    fireEvent.click(screen.getByRole('button', { name: texts.simulate }));
    await screen.findByText(texts.REDUCE_TERM);
    expect(screen.getByText(texts.REDUCE_PAYMENT)).toBeInTheDocument();
    expect(post).toHaveBeenCalledTimes(1);
    post.mockResolvedValueOnce({});
    fireEvent.click(screen.getAllByRole('button', { name: texts.confirm })[0]);
    await waitFor((): void => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(post).toHaveBeenLastCalledWith('/financings/loan/extra-payments', {
      body: JSON.stringify({
        amount: 5000,
        date: '2026/11/28',
        option: 'REDUCE_TERM',
      }),
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  }
);
it('clears stale simulations after the amount changes', async (): Promise<void> => {
  post.mockResolvedValueOnce([
    { option: 'REDUCE_TERM', interestSaved: 1, schedule: [] },
  ]);
  renderWithI18n(
    <ExtraPaymentDialog id="loan" onSaved={jest.fn()} onClose={jest.fn()} />
  );
  fireEvent.change(screen.getByLabelText(en.financing.adjustmentAmount), {
    target: { value: '10' },
  });
  fireEvent.click(screen.getByRole('button', { name: en.financing.simulate }));
  await screen.findByText(en.financing.REDUCE_TERM);
  fireEvent.change(screen.getByLabelText(en.financing.adjustmentAmount), {
    target: { value: '20' },
  });
  expect(screen.queryByText(en.financing.confirm)).not.toBeInTheDocument();
});

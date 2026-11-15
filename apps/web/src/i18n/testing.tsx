import {
  render,
  type RenderOptions,
  type RenderResult,
} from '@testing-library/react';
import type { JSX, ReactElement, ReactNode } from 'react';
import I18nProvider, { type Language } from './I18nProvider';

export interface RenderWithI18nOptions extends Omit<RenderOptions, 'wrapper'> {
  language?: Language;
}

export function renderWithI18n(
  ui: ReactElement,
  options: RenderWithI18nOptions = {}
): RenderResult {
  const { language = 'en', ...renderOptions } = options;

  function Wrapper({
    children,
  }: Readonly<{ children: ReactNode }>): JSX.Element {
    return <I18nProvider initialLanguage={language}>{children}</I18nProvider>;
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

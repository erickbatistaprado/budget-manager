import { act, renderHook } from '@testing-library/react';
import useHideOnScroll from './useHideOnScroll.hook';

function scrollTo(position: number): void {
  act((): void => {
    Object.defineProperty(window, 'scrollY', {
      value: position,
      configurable: true,
    });
    window.dispatchEvent(new Event('scroll'));
  });
}

beforeEach((): void => {
  jest
    .spyOn(window, 'requestAnimationFrame')
    .mockImplementation((callback: FrameRequestCallback): number => {
      callback(0);
      return 0;
    });
  Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
});

afterEach((): void => {
  jest.restoreAllMocks();
});

it('hides while scrolling down and shows again when scrolling up', (): void => {
  const { result } = renderHook((): boolean => useHideOnScroll());
  expect(result.current).toBe(false);
  scrollTo(40);
  expect(result.current).toBe(false);
  scrollTo(300);
  expect(result.current).toBe(true);
  scrollTo(298);
  expect(result.current).toBe(true);
  scrollTo(250);
  expect(result.current).toBe(false);
  scrollTo(600);
  expect(result.current).toBe(true);
  scrollTo(10);
  expect(result.current).toBe(false);
});

it('stays visible while pinned, for example with a drawer open', (): void => {
  const { result } = renderHook((): boolean => useHideOnScroll(true));
  scrollTo(500);
  expect(result.current).toBe(false);
});

import { useEffect } from 'react';
import { startScrollEngine } from './scrollEngine';

/** Поднимает Lenis и общий rAF-цикл. Вызывается один раз, в корне приложения. */
export function useSmoothScroll(options) {
  useEffect(() => startScrollEngine(options), [options]);
}

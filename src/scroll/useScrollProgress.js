import { useEffect, useRef } from 'react';
import { addTrack } from './scrollEngine';

const clamp01 = (value) => (value < 0 ? 0 : value > 1 ? 1 : value);

/**
 * Считает прогресс элемента относительно вьюпорта и пишет его в CSS-переменную.
 * Значение обновляется в обход React — иначе на каждый кадр летел бы ре-рендер.
 *
 * mode:
 *   'through' — 0, когда верх элемента на нижней кромке экрана; 1, когда низ ушёл за верх.
 *               Для параллакса и масштабирования.
 *   'pinned'  — 0 в момент залипания секции, 1 когда залипание кончилось.
 *               Для длинных sticky-сцен.
 *
 * onChange получает то же число — нужен там, где анимацию рисует не CSS (например WebGL).
 */
export function useScrollProgress(ref, options = {}) {
  const { mode = 'through', varName = '--p', onChange } = options;
  const callback = useRef(onChange);

  useEffect(() => {
    callback.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    let top = 0;
    let height = 0;
    let viewport = 0;
    let last = -1;

    return addTrack({
      measure() {
        const rect = el.getBoundingClientRect();
        top = rect.top;
        height = rect.height;
        viewport = window.innerHeight;
      },
      render() {
        const distance = mode === 'pinned' ? height - viewport : height + viewport;
        const travelled = mode === 'pinned' ? -top : viewport - top;
        const progress = distance > 0 ? clamp01(travelled / distance) : 0;

        // Отсекаем дрожание в четвёртом знаке — лишние записи в стиль ни к чему.
        if (Math.abs(progress - last) < 0.0005) return;
        last = progress;

        if (varName) el.style.setProperty(varName, progress.toFixed(4));
        callback.current?.(progress);
      },
    });
  }, [ref, mode, varName]);
}

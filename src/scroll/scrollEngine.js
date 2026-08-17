import Lenis from 'lenis';

/**
 * Единый движок скролла на всё приложение.
 *
 * Устроен так же, как на shopify.com/editions: один экземпляр Lenis, один
 * requestAnimationFrame-цикл, а каждый эффект — это «трек» с двумя фазами.
 * Сначала для всех треков вызывается measure() (только чтение геометрии),
 * потом render() (только запись стилей). Разделение фаз убирает layout
 * thrashing: браузер пересчитывает layout один раз за кадр, а не по разу
 * на каждый эффект.
 */

const tracks = new Set();

let lenis = null;
let frameId = 0;
let users = 0;

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function frame(time) {
  lenis?.raf(time);

  for (const track of tracks) track.measure();
  for (const track of tracks) track.render();

  frameId = requestAnimationFrame(frame);
}

/**
 * Запускает движок. Возвращает функцию остановки.
 * Считает пользователей — на случай, если хук смонтируется дважды
 * (например, в StrictMode) движок не поднимется второй раз.
 */
export function startScrollEngine(options = {}) {
  users += 1;

  if (users === 1) {
    // При включённом «уменьшить движение» инерцию не навязываем —
    // остаётся нативный скролл, но треки продолжают считать прогресс.
    if (!prefersReducedMotion()) {
      lenis = new Lenis({
        duration: 1.1,
        easing: (t) => 1 - Math.pow(1 - t, 4),
        touchMultiplier: 1.4,
        ...options,
      });
    }
    frameId = requestAnimationFrame(frame);
  }

  return () => {
    users -= 1;
    if (users > 0) return;

    cancelAnimationFrame(frameId);
    frameId = 0;
    lenis?.destroy();
    lenis = null;
  };
}

/**
 * Регистрирует трек: { measure(), render() }.
 * Возвращает функцию отписки — обязательно вызвать при размонтировании.
 */
export function addTrack(track) {
  tracks.add(track);
  return () => tracks.delete(track);
}

/** Плавный скролл к элементу или координате. Без Lenis — нативный fallback. */
export function scrollTo(target, options = {}) {
  if (lenis) {
    lenis.scrollTo(target, { offset: 0, ...options });
    return;
  }

  const node = typeof target === 'string' ? document.querySelector(target) : target;
  node?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
}

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';

// Порт компонента Morphing Text из MagicUI (magicui.design/docs/components/
// morphing-text), приведённый к обычному JSX и своему CSS: ставить его через
// shadcn нельзя — тот тянет Tailwind, TypeScript и алиасы @/, а проект на
// рукописном CSS. Формулы размытия, прозрачности и порог оставлены дословно.
//
// Суть эффекта: две строки лежат друг на друге, у уходящей растёт размытие и
// падает прозрачность, у приходящей наоборот, а общий SVG-фильтр рубит полутона
// по альфе — размытые буквы слипаются в капли и перетекают друг в друга.
//
// Добавлено против оригинала: режим прокрутки. У MagicUI фразы крутит свой
// таймер, здесь их ведёт скролл — секция закреплена, и морф должен идти ровно
// по её прогрессу. Прогресс приходит извне через ref: свой requestAnimationFrame
// в этом режиме не заводится, всё считается внутри цикла скролл-движка.

const MORPH_TIME = 1.5;
const COOLDOWN_TIME = 0.5;

// У MagicUI кегль фиксированный, поэтому радиусы размытия зашиты числами. Здесь
// он резиновый, и то же размытие на мелком тексте «толще» относительно штриха:
// порог съедает букву, и капли получаются жиже, чем на десктопе. Поэтому радиус
// масштабируется кеглем — за единицу взят десктопный, где эффект настроен.
const BASE_FONT = 64;

// На отрезке между соседними фразами морф идёт с 25% до 75% хода, остальное —
// удержание: иначе текст не успевает читаться.
const MORPH_START = 0.25;
const MORPH_END = 0.75;

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

function smoothstep(a, b, x) {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}

export const MorphingText = forwardRef(function MorphingText(
  { texts, className = '', autoplay = true },
  ref,
) {
  const text1Ref = useRef(null);
  const text2Ref = useRef(null);
  const indexRef = useRef(0);
  const morphRef = useRef(0);
  const cooldownRef = useRef(0);
  const timeRef = useRef(null);
  const rootRef = useRef(null);
  const scaleRef = useRef(1);

  // Кегль меняется по медиазапросам, поэтому пересчитываем на resize.
  useEffect(() => {
    const measure = () => {
      const node = rootRef.current;
      if (!node) return;
      const font = parseFloat(getComputedStyle(node).fontSize);
      scaleRef.current = font ? font / BASE_FONT : 1;
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // fraction — доля перехода от текущей фразы к следующей; index — какая пара.
  const setStyles = useCallback(
    (fraction, index) => {
      const first = text1Ref.current;
      const second = text2Ref.current;
      if (!first || !second) return;

      const k = scaleRef.current;
      second.style.filter = `blur(${Math.min(8 / fraction - 8, 100) * k}px)`;
      second.style.opacity = `${Math.pow(fraction, 0.4) * 100}%`;

      const inverted = 1 - fraction;
      first.style.filter = `blur(${Math.min(8 / inverted - 8, 100) * k}px)`;
      first.style.opacity = `${Math.pow(inverted, 0.4) * 100}%`;

      first.textContent = texts[index % texts.length];
      second.textContent = texts[(index + 1) % texts.length];
    },
    [texts],
  );

  useImperativeHandle(
    ref,
    () => ({
      // progress — 0..1 по всей секции; делим его на переходы между фразами.
      setProgress(progress) {
        const spans = texts.length - 1;
        if (spans < 1) {
          setStyles(1, 0);
          return;
        }
        const scaled = clamp01(progress) * spans;
        const segment = Math.min(Math.floor(scaled), spans - 1);
        setStyles(smoothstep(MORPH_START, MORPH_END, scaled - segment), segment);
      },
    }),
    [setStyles, texts.length],
  );

  useEffect(() => {
    if (!autoplay) return undefined;

    let frame = 0;
    timeRef.current = performance.now();

    const morph = () => {
      morphRef.current -= cooldownRef.current;
      cooldownRef.current = 0;
      let fraction = morphRef.current / MORPH_TIME;
      if (fraction > 1) {
        cooldownRef.current = COOLDOWN_TIME;
        fraction = 1;
      }
      setStyles(fraction, indexRef.current);
      if (fraction === 1) indexRef.current += 1;
    };

    const cooldown = () => {
      morphRef.current = 0;
      const first = text1Ref.current;
      const second = text2Ref.current;
      if (!first || !second) return;
      second.style.filter = 'none';
      second.style.opacity = '100%';
      first.style.filter = 'none';
      first.style.opacity = '0%';
    };

    const tick = (now) => {
      frame = requestAnimationFrame(tick);
      const dt = (now - timeRef.current) / 1000;
      timeRef.current = now;
      morphRef.current += dt;
      cooldownRef.current -= dt;
      if (cooldownRef.current <= 0) morph();
      else cooldown();
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [autoplay, setStyles]);

  // Первый кадр до прокрутки: первая фраза целиком, вторая скрыта.
  useEffect(() => {
    if (autoplay) return;
    setStyles(0, 0);
  }, [autoplay, setStyles]);

  return (
    <div className={`morphing-text ${className}`.trim()} ref={rootRef}>
      <span className="morphing-text__line" ref={text1Ref} />
      <span className="morphing-text__line" ref={text2Ref} />

      <svg className="morphing-text__filter" aria-hidden="true">
        <defs>
          <filter id="morphing-threshold">
            <feColorMatrix
              in="SourceGraphic"
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 255 -140"
            />
          </filter>
        </defs>
      </svg>
    </div>
  );
});

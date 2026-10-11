import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import { createTextMorphRenderer } from '../three/textMorphRenderer';

const MORPH_TIME = 1.5;
const COOLDOWN_TIME = 0.5;

const BASE_FONT = 64;

const MAX_BLUR = 26;
const BLUR_STEP = 0.1;
const MORPH_BLUR_POWER = 1.6;

const MORPH_START = 0.1;
const MORPH_END = 0.9;
const SCROLL_EASING = 8.5;

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

function apply(el, fraction, scale) {
  if (fraction <= 0.001) {
    if (el.style.filter !== 'none') el.style.filter = 'none';
    if (el.style.opacity !== '0') el.style.opacity = '0';
    return;
  }

  const blur = MAX_BLUR * Math.pow(1 - fraction, MORPH_BLUR_POWER) * scale;
  const nextFilter = `blur(${(Math.round(blur / BLUR_STEP) * BLUR_STEP).toFixed(1)}px)`;
  const nextOpacity = `${(Math.pow(fraction, 0.4) * 100).toFixed(1)}%`;
  if (el.style.filter !== nextFilter) el.style.filter = nextFilter;
  if (el.style.opacity !== nextOpacity) el.style.opacity = nextOpacity;
}

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
  const canvasRef = useRef(null);
  const rendererRef = useRef(null);
  const currentMorphRef = useRef([0, 0]);

  useEffect(() => {
    let disposed = false;
    let gpu;
    const root = rootRef.current;
    const rebuild = () => {
      gpu?.resize();
      gpu?.draw(...currentMorphRef.current);
    };
    const observer = new ResizeObserver(rebuild);
    document.fonts.ready.then(() => {
      if (disposed) return;
      try {
        gpu = createTextMorphRenderer(canvasRef.current, root, texts);
        rebuild();
        rendererRef.current = gpu;
        root.classList.add('morphing-text--gpu');
        observer.observe(root);
      } catch {
        gpu?.dispose();
        gpu = null;
      }
    });
    return () => {
      disposed = true;
      observer.disconnect();
      rendererRef.current = null;
      root.classList.remove('morphing-text--gpu');
      gpu?.dispose();
    };
  }, [texts]);
  const scaleRef = useRef(1);
  const pairRef = useRef(-1);
  const targetProgressRef = useRef(0);
  const displayedProgressRef = useRef(0);
  const scrollFrameRef = useRef(0);
  const scrollTimeRef = useRef(0);

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

  const setStyles = useCallback(
    (fraction, index) => {
      currentMorphRef.current = [fraction, index];
      if (rendererRef.current) {
        rendererRef.current.draw(fraction, index);
        return;
      }
      const first = text1Ref.current;
      const second = text2Ref.current;
      if (!first || !second) return;

      const k = scaleRef.current;
      apply(second, fraction, k);
      apply(first, 1 - fraction, k);

      if (pairRef.current !== index) {
        first.textContent = texts[index % texts.length];
        second.textContent = texts[(index + 1) % texts.length];
        pairRef.current = index;
      }
    },
    [texts],
  );

  useImperativeHandle(
    ref,
    () => ({
      setProgress(progress) {
        targetProgressRef.current = clamp01(progress);
        if (scrollFrameRef.current) return;

        scrollTimeRef.current = performance.now();
        const tick = (now) => {
          const dt = Math.min(0.05, (now - scrollTimeRef.current) / 1000);
          scrollTimeRef.current = now;
          const target = targetProgressRef.current;
          const current = displayedProgressRef.current;
          const next = current + (target - current) * (1 - Math.exp(-SCROLL_EASING * dt));
          displayedProgressRef.current = Math.abs(target - next) < 0.0001 ? target : next;

          const spans = texts.length - 1;
          if (spans < 1) {
            setStyles(1, 0);
          } else {
            const scaled = displayedProgressRef.current * spans;
            const segment = Math.min(Math.floor(scaled), spans - 1);
            setStyles(smoothstep(MORPH_START, MORPH_END, scaled - segment), segment);
          }

          if (displayedProgressRef.current === targetProgressRef.current) {
            scrollFrameRef.current = 0;
            return;
          }
          scrollFrameRef.current = requestAnimationFrame(tick);
        };
        scrollFrameRef.current = requestAnimationFrame(tick);
      },
    }),
    [setStyles, texts.length],
  );

  useEffect(() => () => {
    if (scrollFrameRef.current) cancelAnimationFrame(scrollFrameRef.current);
    scrollFrameRef.current = 0;
  }, []);

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

  useEffect(() => {
    if (autoplay) return;
    setStyles(0, 0);
  }, [autoplay, setStyles]);

  return (
    <div className={`morphing-text ${className}`.trim()} ref={rootRef} role="img" aria-label={texts.join('. ')}>
      <canvas ref={canvasRef} className="morphing-text__canvas" aria-hidden="true" />
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

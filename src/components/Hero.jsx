import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { useScrollProgress } from '../scroll/useScrollProgress';
import { AsciiVideo } from './AsciiVideo';

// Видео ставится на паузу, когда первый экран целиком ушёл за верх окна.
const GONE = 1;

// Текст спрятан, пока идёт glyph-matrix, и выходит, когда матрица растворилась
// и человек собрался целиком (onSettled у AsciiVideo).
const TEXT_DELAY = 0.1;

// Пока идёт матрица, шапка спрятана классом на <html> (см. .hero-matrix в CSS)
// и возвращается вместе с текстом.
const MATRIX_CLASS = 'hero-matrix';

export function Hero() {
  const ref = useRef(null);
  const contentRef = useRef(null);
  const [gone, setGone] = useState(false);

  const handleProgress = useCallback((progress) => setGone(progress >= GONE), []);

  useScrollProgress(ref, { mode: 'through', varName: null, onChange: handleProgress });

  useLayoutEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return undefined;
    const targets = contentRef.current.querySelectorAll('.hero__kicker, .hero__line');
    gsap.set(targets, { opacity: 0 });
    document.documentElement.classList.add(MATRIX_CLASS);
    return () => {
      gsap.set(targets, { clearProps: 'all' });
      document.documentElement.classList.remove(MATRIX_CLASS);
    };
  }, []);

  const reveal = useCallback(() => {
    const content = contentRef.current;
    if (!content) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const kicker = content.querySelector('.hero__kicker');
    const lines = content.querySelectorAll('.hero__line');
    // Размытие крупного текста дорого для телефона — там только сдвиг и прозрачность.
    const blur = window.matchMedia('(min-width: 900px)').matches;
    const from = (px) => (blur ? { filter: `blur(${px}px)` } : {});
    const to = blur ? { filter: 'blur(0px)', clearProps: 'filter' } : {};

    gsap
      .timeline({ delay: TEXT_DELAY, defaults: { ease: 'power3.out' } })
      .call(() => document.documentElement.classList.remove(MATRIX_CLASS), null, 0)
      .fromTo(
        kicker,
        { opacity: 0, y: 14, ...from(6) },
        { opacity: 1, y: 0, duration: 1, ...to },
        0,
      )
      .fromTo(
        lines,
        { opacity: 0, y: '0.45em', ...from(14) },
        { opacity: 1, y: 0, duration: 1.4, stagger: 0.16, ...to },
        0.15,
      );
  }, []);

  return (
    <section ref={ref} className="hero" id="top">
      <div className="hero__sticky">
        <AsciiVideo paused={gone} onSettled={reveal} />

        <div className="hero__content" ref={contentRef}>
          <p className="hero__kicker">Фронтенд-разработчик — Санкт-Петербург</p>
          <h1 className="hero__title">
            <span className="hero__line">Приложения,</span>
            <span className="hero__line">которые</span>
            <em className="hero__line">
              <span className="hero__title-pull">можно</span> полюбить
            </em>
          </h1>
        </div>
      </div>
    </section>
  );
}

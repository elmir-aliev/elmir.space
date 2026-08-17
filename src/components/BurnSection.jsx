import { useCallback, useEffect, useRef } from 'react';
import { BurnScene } from '../three/burnScene';
import { addTrack } from '../scroll/scrollEngine';
import { useScrollProgress } from '../scroll/useScrollProgress';

/**
 * Длинная sticky-сцена: пока секция залипла, полотно выгорает от центра к краям,
 * а из-под него проступает текст.
 */
export function BurnSection({ src }) {
  const sectionRef = useRef(null);
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);

  const handleProgress = useCallback((value) => {
    sceneRef.current?.setProgress(value);
  }, []);

  useScrollProgress(sectionRef, { mode: 'pinned', varName: '--p', onChange: handleProgress });

  useEffect(() => {
    const canvas = canvasRef.current;
    const section = sectionRef.current;
    if (!canvas || !section) return undefined;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const scene = new BurnScene(canvas, { src, smoothing: reduceMotion ? 1 : 0.12 });
    sceneRef.current = scene;

    // Кадры тратим только пока сцена рядом с экраном
    let visible = false;
    const visibility = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
      },
      { rootMargin: '15% 0px' },
    );
    visibility.observe(section);

    const resize = new ResizeObserver(() => scene.resize());
    resize.observe(canvas);

    const startedAt = performance.now();
    const removeTrack = addTrack({
      measure() {},
      render() {
        if (!visible) return;
        scene.render((performance.now() - startedAt) / 1000);
      },
    });

    return () => {
      removeTrack();
      visibility.disconnect();
      resize.disconnect();
      scene.dispose();
      sceneRef.current = null;
    };
  }, [src]);

  return (
    <section ref={sectionRef} className="burn" id="process">
      <div className="burn__sticky">
        <div className="burn__reveal">
          <p className="burn__kicker">Процесс</p>
          <h2 className="burn__title">
            Сжигаю всё лишнее,
            <br />
            пока не останется суть
          </h2>
          <p className="burn__text">
            Каждый интерфейс проходит через отсев: убираю слои, пока не остаётся то,
            без чего продукт не работает.
          </p>
        </div>

        <canvas ref={canvasRef} className="burn__canvas" aria-hidden="true" />
      </div>
    </section>
  );
}

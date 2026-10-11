import { useCallback, useEffect, useRef } from "react";
import { addTrack } from "../scroll/scrollEngine";

const lines = [
  { text: "Пять лет собираю фронтенд:" },
  { text: "сложная графика" },
  { text: "и интерфейсы, завораживающие дух", accent: true },
];

const ZOOM_LINE = 1;
const ZOOM_WORD = 1;
const ZOOM_CHAR = 0;

const COLOR = [11, 11, 13];
const DIM = 0;
const WAVE_FROM = 0.2;
const WAVE_SPAN = 0.72;
const SPAN = 0.3;
const APPEAR = 0.16;

const ZOOM_START = 0.06;
const ZOOM_BEND = 1.45;
const ZOOM_FILL = 1.12;
const ZOOM_FONT_CAP = 9000;
const INK_X = 0.246;
const INK_Y = 0.5;
const STEM_W = 0.246;
const INK_FROM = 0.84;
const INK_TO = 0.99;
const AIM_SPAN = 0.3;

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const mix = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);

export function Intro() {
  const sceneRef = useRef(null);
  const stageRef = useRef(null);
  const frameRef = useRef(null);
  const textRef = useRef(null);
  const inkRef = useRef(null);
  const targetRef = useRef(null);
  const charsRef = useRef([]);
  const waveRef = useRef(0);
  const zoomRef = useRef(null);
  const lastZoom = useRef(-1);
  const pinRef = useRef(0);
  const shiftRef = useRef({ x: 0, y: 0 });

  const paint = useCallback((wave) => {
    const chars = charsRef.current;
    const total = chars.length;
    if (!total) return;

    const [r, g, b] = COLOR;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      for (let i = 0; i < total; i += 1) {
        const c = chars[i];
        if (c.last === 1) continue;
        c.last = 1;
        c.el.style.color = `rgb(${r}, ${g}, ${b})`;
      }
      return;
    }

    for (let i = 0; i < total; i += 1) {
      const c = chars[i];
      const start = (i / total) * (1 - SPAN);
      const t = clamp01((wave - start) / SPAN);
      if (Math.abs(t - c.last) < 0.004 && t !== 0 && t !== 1) continue;
      c.last = t;

      const a = t < APPEAR ? mix(DIM, 1, t / APPEAR) : 1;
      c.el.style.color = `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`;
    }
  }, []);

  useEffect(() => {
    const root = textRef.current;
    if (!root) return undefined;

    const chars = [];
    root.querySelectorAll(".intro__line").forEach((line, li) => {
      const words = (line.dataset.text || "").split(" ");
      line.textContent = "";
      words.forEach((word, wi) => {
        const wordEl = document.createElement("span");
        wordEl.className = "intro__word";
        [...word].forEach((letter, ci) => {
          const el = document.createElement("span");
          el.className = "intro__char";
          el.textContent = letter;
          wordEl.appendChild(el);
          chars.push({ el, last: -1 });
          if (li === ZOOM_LINE && wi === ZOOM_WORD && ci === ZOOM_CHAR)
            targetRef.current = el;
        });
        line.appendChild(wordEl);
        if (wi < words.length - 1)
          line.appendChild(document.createTextNode(" "));
      });
    });
    charsRef.current = chars;
    paint(waveRef.current);

    return () => {
      charsRef.current = [];
      targetRef.current = null;
    };
  }, [paint]);

  const zoomTo = useCallback((pin) => {
    const stage = stageRef.current;
    const text = textRef.current;
    const frame = frameRef.current;
    const ink = inkRef.current;
    const target = targetRef.current;
    const geom = zoomRef.current;
    if (!stage || !text || !frame || !ink || !target || !geom) return;
    pinRef.current = pin;
    if (pin === lastZoom.current) return;
    lastZoom.current = pin;

    const t0 = import.meta.env.DEV ? performance.now() : 0;
    const sb = stage.getBoundingClientRect();
    const t = clamp01((pin - ZOOM_START) / (1 - ZOOM_START));
    const k = Math.pow(geom.max, Math.pow(t, ZOOM_BEND));
    const alpha = smooth(clamp01((t - INK_FROM) / (INK_TO - INK_FROM)));
    ink.style.opacity = alpha.toFixed(3);

    if (alpha > 0.995) {
      frame.style.visibility = "hidden";
      return;
    }
    frame.style.visibility = "";
    if (!geom.transformZoom) text.style.zoom = k.toFixed(4);

    const shift = shiftRef.current;

    const aim = smooth(clamp01(t / AIM_SPAN));
    const aimX = mix(geom.w / 2, geom.ox, aim);
    const aimY = mix(geom.h / 2, geom.oy, aim);

    shift.x = sb.width / 2 - aimX * k;
    shift.y = sb.height / 2 - aimY * k;
    frame.style.transform = geom.transformZoom
      ? `matrix(${k}, 0, 0, ${k}, ${shift.x}, ${shift.y})`
      : `translate3d(${shift.x.toFixed(2)}px, ${shift.y.toFixed(2)}px, 0)`;

    if (import.meta.env.DEV) {
      const j = (window.__introJitter ||= []);
      j.push([window.scrollY, +sb.top.toFixed(2), +shift.y.toFixed(2)]);
      if (j.length > 150) j.shift();
    }

    if (import.meta.env.DEV) {
      const cost = performance.now() - t0;
      const c = (window.__introCost ||= { n: 0, sum: 0, max: 0 });
      c.n += 1;
      c.sum += cost;
      if (cost > c.max) c.max = cost;
    }
  }, []);

  const measureZoom = useCallback(() => {
    const stage = stageRef.current;
    const text = textRef.current;
    const frame = frameRef.current;
    const target = targetRef.current;
    if (!stage || !text || !frame || !target) return;

    text.style.zoom = "";
    text.style.width = "";
    text.style.maxWidth = "";
    frame.style.transform = "";
    shiftRef.current = { x: 0, y: 0 };

    const sb = stage.getBoundingClientRect();

    const box = getComputedStyle(stage);
    const room =
      sb.width - parseFloat(box.paddingLeft) - parseFloat(box.paddingRight);
    const own = parseFloat(getComputedStyle(text).maxWidth);
    text.style.maxWidth = `${(Number.isFinite(own) ? Math.min(own, room) : room).toFixed(2)}px`;

    const cb = target.getBoundingClientRect();
    const tb = text.getBoundingClientRect();
    const fs = parseFloat(getComputedStyle(text).fontSize) || 16;

    text.style.width = `${tb.width.toFixed(2)}px`;
    text.style.maxWidth = "none";

    zoomRef.current = {
      transformZoom: window.matchMedia(
        "(max-width: 760px), (pointer: coarse)",
      ).matches,
      max: Math.min(
        ZOOM_FONT_CAP / fs,
        Math.max(8, (sb.width / (cb.width * STEM_W)) * ZOOM_FILL),
      ),
      w: tb.width,
      h: tb.height,
      ox: cb.left - tb.left + cb.width * INK_X,
      oy: cb.top - tb.top + cb.height * INK_Y,
    };
    if (import.meta.env.DEV) window.__introTarget = target;

    lastZoom.current = -1;
    zoomTo(pinRef.current);
  }, [zoomTo]);

  useEffect(() => {
    measureZoom();
    document.fonts?.ready.then(measureZoom);

    let width = window.innerWidth;
    const onResize = () => {
      if (window.innerWidth === width) return;
      width = window.innerWidth;
      measureZoom();
    };

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [measureZoom]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return undefined;

    const flat = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (flat) {
      scene.classList.add("intro-scene--flat");
      paint(1);
      return undefined;
    }

    let top = 0;
    let height = 0;
    let viewport = 0;
    let lastWave = -1;

    return addTrack({
      measure() {
        const rect = scene.getBoundingClientRect();
        top = rect.top;
        height = rect.height;
        viewport = window.innerHeight;
      },
      render() {
        const wave = clamp01(
          (viewport - top - WAVE_FROM * viewport) / (WAVE_SPAN * viewport),
        );
        if (Math.abs(wave - lastWave) >= 0.0005) {
          lastWave = wave;
          waveRef.current = wave;
          paint(wave);
        }

        const travel = height - viewport;
        zoomTo(travel > 0 ? clamp01(-top / travel) : 0);
      },
    });
  }, [paint, zoomTo]);

  return (
    <section ref={sceneRef} className="intro-scene">
      <div ref={stageRef} className="intro">
        <div ref={frameRef} className="intro__zoom">
          <h2 className="intro__text" ref={textRef}>
            {lines.map(({ text, accent }) => (
              <span
                key={text}
                data-text={text}
                className={
                  accent ? "intro__line intro__text-accent" : "intro__line"
                }
              >
                {text}
              </span>
            ))}
          </h2>
        </div>
        <div ref={inkRef} className="intro__ink" aria-hidden="true" />
      </div>
    </section>
  );
}

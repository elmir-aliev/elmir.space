import { useCallback, useEffect, useRef } from "react";
import { addTrack } from "../scroll/scrollEngine";

// Строки набраны так, чтобы «г» в «графике» встала почти в центр экрана:
// средняя строка короткая и симметричная, слово с буквой — второе из двух.
// Тогда наезд идёт прямо «в лоб», без увода кадра вбок (07.09.2026).
const lines = [
  { text: "Пять лет собираю фронтенд:" },
  { text: "сложная графика" },
  { text: "и интерфейсы, завораживающие дух", accent: true },
];

// Куда влетает камера: буква «г» в слове «графика» средней строки.
const ZOOM_LINE = 1;
const ZOOM_WORD = 1;
const ZOOM_CHAR = 0;

// Появление текста как на nbnzia.com: буквы возникают волной слева направо по
// ходу прокрутки — будто печатаются. Буква стартует невидимой, проявляется
// сразу акцентным цветом и потом остывает в свой; соседние перекрываются,
// поэтому волна сплошная, а не пощёлкивание по одной букве.
// (У референса ровно так: rgba(белый, .2) → rgba(красный, .92) → тёмный;
// никаких сдвигов, масштабов и размытия — только цвет и прозрачность.)
//
// Цвет один на весь блок — чернильно-чёрный на бумаге секции.
// Волна ведёт только прозрачность.
const COLOR = [11, 11, 13];
// Буква до своей очереди невидима: её и «печатает» волна.
const DIM = 0;
// Волна идёт на входе секции: от 20% высоты экрана после её появления снизу и
// до момента, когда секция закрывает экран целиком (то есть до пина).
// Раньше это же окно задавалось долями сквозного прогресса (0.1…0.46 от
// height+viewport при height = 100dvh) — теперь секция выросла, и окно считается
// прямо в высотах экрана, чтобы отклик остался тем же.
const WAVE_FROM = 0.2;
const WAVE_SPAN = 0.72;
// Ширина «хвоста» одной буквы по ходу волны.
const SPAN = 0.3;
// Доля хвоста на само появление буквы: у референса оно почти мгновенное
// (первый же замер уже rgba(красный, .92)), а остывание в свой цвет — долгое.
const APPEAR = 0.16;

// Наезд на букву идёт весь пин-ход сцены. Масштаб растёт по степени: линейный
// рост читается как торможение, экспонента — как ровный полёт внутрь.
//
// Ведёт наезд `zoom`, а не `transform: scale`. Со scale композитор тянет уже
// растрированный слой и перерисовывает его, только когда прокрутка встала:
// на остановке буква резкая, а в движении мылится (замечание 07.09.2026).
// `zoom` — это раскладка: браузер каждый кадр пересобирает строку и рисует
// глиф в его настоящем кегле, растянутых битмапов в цепочке не остаётся.
const ZOOM_START = 0.06;
const ZOOM_BEND = 1.45;
// Предел масштаба считается от экрана: наезд кончается, когда стойка «Г»
// закрывает кадр по ширине (по высоте она перекрывает его гораздо раньше).
const ZOOM_FILL = 1.12;
// Blink обрезает кегль на 10000px — за этой чертой раскладка поедет, поэтому
// масштаб упирается в предел раньше, а кадр добирают чернила.
const ZOOM_FONT_CAP = 9000;
// Точка входа внутри буквы и ширина её стойки — в долях от рамки буквы
// (замер Inter 600: стойка занимает 6…18px у рамки шириной 48.8px при кегле
// 89px, то есть доли от кегля не зависят). Центр рамки «Г» пришёлся бы на
// бумагу — целимся в середину стойки, чтобы чернила расходились от центра
// экрана ровно во все стороны.
const INK_X = 0.246;
const INK_Y = 0.5;
const STEM_W = 0.246;
// Чернила добирают последние проценты хода: буква к этому моменту уже шире
// кадра, а цвет заливки совпадает с фоном «Избранных работ», поэтому стык
// сцен не виден.
const INK_FROM = 0.84;
const INK_TO = 0.99;

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
    // С prefers-reduced-motion волны нет: текст сразу в своём цвете.
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

  // Разбор строк на буквы: слово остаётся неразрывным, перенос идёт по словам.
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
    if (Math.abs(pin - lastZoom.current) < 0.0004) return;
    lastZoom.current = pin;

    const t = clamp01((pin - ZOOM_START) / (1 - ZOOM_START));
    const k = Math.pow(geom.max, Math.pow(t, ZOOM_BEND));
    const alpha = smooth(clamp01((t - INK_FROM) / (INK_TO - INK_FROM)));
    ink.style.opacity = alpha.toFixed(3);

    // Под сплошной заливкой текста не видно: раскладку в этот кегель не гоняем.
    if (alpha > 0.995) {
      frame.style.visibility = "hidden";
      return;
    }
    frame.style.visibility = "";
    text.style.zoom = k.toFixed(4);

    // Куда буква уехала после пересборки раскладки — читаем и доводим сдвигом.
    // Сдвиг живёт на обёртке, у неё zoom не тронут, поэтому пиксель здесь
    // настоящий и поправка точна с первого кадра.
    const cb = target.getBoundingClientRect();
    const sb = stage.getBoundingClientRect();
    const shift = shiftRef.current;
    shift.x += sb.left + sb.width / 2 - (cb.left + cb.width * INK_X);
    shift.y += sb.top + sb.height / 2 - (cb.top + cb.height * INK_Y);
    frame.style.transform = `translate3d(${shift.x.toFixed(2)}px, ${shift.y.toFixed(
      2,
    )}px, 0)`;
  }, []);

  // Предел наезда: считается по нетронутой раскладке, потому что во время
  // хода zoom врёт про размеры. Замер кэшируется и обновляется на ресайз и
  // после загрузки шрифтов.
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

    const cb = target.getBoundingClientRect();
    const sb = stage.getBoundingClientRect();
    const tb = text.getBoundingClientRect();
    const fs = parseFloat(getComputedStyle(text).fontSize) || 16;

    // Ширину набора фиксируем в пикселях: zoom растит текст, а рамку экрана —
    // нет, и на своей `max-width: 18ch` строка начала бы переноситься заново.
    // С жёсткой шириной пропорция «кегль к строке» держится на любом наезде,
    // и переносы остаются те же, что в покое.
    text.style.width = `${tb.width.toFixed(2)}px`;
    text.style.maxWidth = "none";

    zoomRef.current = {
      max: Math.min(
        ZOOM_FONT_CAP / fs,
        Math.max(8, (sb.width / (cb.width * STEM_W)) * ZOOM_FILL),
      ),
    };
    lastZoom.current = -1;
    zoomTo(pinRef.current);
  }, [zoomTo]);

  useEffect(() => {
    measureZoom();
    document.fonts?.ready.then(measureZoom);
    window.addEventListener("resize", measureZoom);
    return () => window.removeEventListener("resize", measureZoom);
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

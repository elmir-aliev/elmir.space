import { useCallback, useEffect, useRef } from "react";
import { useReveal } from "../scroll/useReveal";
import { useScrollProgress } from "../scroll/useScrollProgress";
import { addTrack } from "../scroll/scrollEngine";
import { overInk, prepareInk } from "./MorphBackdrop";

// Красная строка — вторая, по замечанию от 05.09.2026.
const lines = [
  { text: "Пять лет собираю фронтенд:" },
  { text: "от интерфейсов, завораживающие дух.", accent: true },
  { text: "до лендингов со сложной графикой" },
];

// Появление текста как на nbnzia.com: буквы возникают волной слева направо по
// ходу прокрутки — будто печатаются. Буква стартует невидимой, проявляется
// сразу акцентным цветом и потом остывает в свой; соседние перекрываются,
// поэтому волна сплошная, а не пощёлкивание по одной букве.
// (У референса ровно так: rgba(белый, .2) → rgba(красный, .92) → тёмный;
// никаких сдвигов, масштабов и размытия — только цвет и прозрачность.)
//
// Цвет буквы решается по фону под ней: обычно она цвета тёмного фона страницы,
// а попав на тёмную фигуру — светлая, иначе слилась бы с ней. Раньше это делал
// mix-blend-mode: exclusion, но у него контраст обнуляется ровно на середине
// яркости фона, и в размытой кайме блоба буквы пропадали. Здесь состояния
// только два, середины нет — проверка на попадание в фигуру идёт по её
// геометрии (overInk из MorphBackdrop), а не по цвету пикселя.
const DARK = [11, 11, 13];
const LIGHT = [243, 240, 234];
// Буква до своей очереди невидима: её и «печатает» волна.
const DIM = 0;
// Окно прогресса секции, на котором идёт волна, и ширина «хвоста» одной буквы.
const FROM = 0.28;
const TO = 0.52;
const SPAN = 0.3;
// Доля хвоста на само появление буквы: у референса оно почти мгновенное
// (первый же замер уже rgba(красный, .92)), а остывание в свой цвет — долгое.
const APPEAR = 0.16;

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const mix = (a, b, t) => a + (b - a) * t;

export function Intro() {
  const ref = useReveal({ threshold: 0.12 });
  const textRef = useRef(null);
  const charsRef = useRef([]);
  const progressRef = useRef(0);
  const rectRef = useRef(null);

  const paint = useCallback(() => {
    const chars = charsRef.current;
    const total = chars.length;
    const rect = rectRef.current;
    if (!total || !rect) return;

    const wave = clamp01((progressRef.current - FROM) / (TO - FROM));
    for (let i = 0; i < total; i += 1) {
      const c = chars[i];
      const start = (i / total) * (1 - SPAN);
      const t = clamp01((wave - start) / SPAN);
      // Буква меряется один раз (measureChars), здесь только сдвиг блока.
      const over = overInk(rect.left + c.ox, rect.top + c.oy);
      if (over === c.over && Math.abs(t - c.last) < 0.004 && t !== 0 && t !== 1)
        continue;
      c.last = t;
      c.over = over;

      const [r, g, b] = over ? LIGHT : DARK;
      // Волна «печатает» букву прозрачностью; цвет за неё отвечает фон.
      const a = t < APPEAR ? mix(DIM, 1, t / APPEAR) : 1;
      c.el.style.color = `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`;
    }
  }, []);

  // Разбор строк на буквы: слово остаётся неразрывным, перенос идёт по словам.
  useEffect(() => {
    const root = textRef.current;
    if (!root) return undefined;

    const chars = [];
    root.querySelectorAll(".intro__line").forEach((line) => {
      const words = (line.dataset.text || "").split(" ");
      line.textContent = "";
      words.forEach((word, wi) => {
        const wordEl = document.createElement("span");
        wordEl.className = "intro__word";
        [...word].forEach((letter) => {
          const el = document.createElement("span");
          el.className = "intro__char";
          el.textContent = letter;
          wordEl.appendChild(el);
          chars.push({ el, ox: 0, oy: 0, last: -1, over: null });
        });
        line.appendChild(wordEl);
        if (wi < words.length - 1)
          line.appendChild(document.createTextNode(" "));
      });
    });
    charsRef.current = chars;

    // Центр каждой буквы относительно блока: положение на экране получается
    // сдвигом на рамку блока, поэтому в кадре нужен один getBoundingClientRect,
    // а не по одному на букву.
    const measureChars = () => {
      const base = root.getBoundingClientRect();
      for (const c of chars) {
        const r = c.el.getBoundingClientRect();
        c.ox = r.left + r.width / 2 - base.left;
        c.oy = r.top + r.height / 2 - base.top;
        c.over = null;
      }
      rectRef.current = base;
      paint();
    };

    measureChars();
    // Подмена шрифта на Inter переверстает строки — меряем и после неё.
    document.fonts?.ready.then(measureChars);
    window.addEventListener("resize", measureChars);

    return () => {
      window.removeEventListener("resize", measureChars);
      charsRef.current = [];
    };
  }, [paint]);

  // Фигура живёт своей жизнью — дышит, дрейфует, тянется за курсором, — поэтому
  // цвет пересчитывается каждый кадр, а не только на прокрутке. Считается в
  // цикле скролл-движка: свой requestAnimationFrame не нужен.
  useEffect(() => {
    const root = textRef.current;
    if (!root) return undefined;
    return addTrack({
      measure() {
        const rect = root.getBoundingClientRect();
        // Вне экрана красить нечего — и снимок холста тогда не нужен.
        if (rect.bottom < 0 || rect.top > window.innerHeight) {
          rectRef.current = null;
          return;
        }
        rectRef.current = rect;
        prepareInk(rect.left, rect.top, rect.width, rect.height);
      },
      render() {
        paint();
      },
    });
  }, [paint]);

  const handleProgress = useCallback((progress) => {
    progressRef.current = progress;
  }, []);

  useScrollProgress(ref, {
    mode: "through",
    varName: null,
    onChange: handleProgress,
  });

  // Фон секции — белый лист и тёмный блоб — рисует MorphBackdrop на общем
  // фиксированном холсте под страницей; сама секция прозрачная.
  return (
    <section ref={ref} className="intro">
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
    </section>
  );
}

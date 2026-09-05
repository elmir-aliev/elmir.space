import { useCallback, useEffect, useRef } from "react";
import { useReveal } from "../scroll/useReveal";
import { useScrollProgress } from "../scroll/useScrollProgress";

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
// Цвет один на весь блок — акцентный красный (--accent), как курсив в hero.
// Волна ведёт только прозрачность.
const COLOR = [181, 41, 43];
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

  const paint = useCallback((progress) => {
    const chars = charsRef.current;
    const total = chars.length;
    if (!total) return;

    const [r, g, b] = COLOR;
    const wave = clamp01((progress - FROM) / (TO - FROM));
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
          chars.push({ el, last: -1 });
        });
        line.appendChild(wordEl);
        if (wi < words.length - 1)
          line.appendChild(document.createTextNode(" "));
      });
    });
    charsRef.current = chars;
    paint(progressRef.current);

    return () => {
      charsRef.current = [];
    };
  }, [paint]);

  const handleProgress = useCallback(
    (progress) => {
      progressRef.current = progress;
      paint(progress);
    },
    [paint],
  );

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

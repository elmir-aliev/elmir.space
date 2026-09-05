import { useCallback, useRef } from 'react';
import { useScrollProgress } from '../scroll/useScrollProgress';
import { stackIcons } from '../assets/stackIcons';

const phrases = [
  ['Собираю интерфейсы', 'из проверенного стека'],
  ['От мобильных приложений,', 'до целых систем'],
  ['Каждый инструмент здесь', 'заработал своё место'],
];

/*
 * ox/oy — смещение логотипа от центра экрана в vw/vh на нулевой глубине (за краями экрана);
 * w — размер в px (на узком экране ограничен долей вьюпорта);
 * color — фирменный цвет из simple-icons; без него логотип цветом текста (Three.js чёрный, Lenis — слово);
 * z — глубина в px при --p = 0: камера отъезжает назад на TRAVEL за весь ход, логотип
 * входит с края, уменьшается и стягивается к центру. Все z отрицательные: пока секция
 * не начала прокручиваться, на экране ничего нет.
 */
const TRAVEL = 4600;

const tools = [
  { name: 'React', ox: -58, oy: -34, w: 225, z: -80, color: '#61dafb' },
  { name: 'Three.js', ox: 60, oy: 30, w: 255, z: -460 },
  { name: 'TypeScript', ox: -50, oy: 40, w: 180, z: -840, color: '#3178c6' },
  { name: 'GSAP', ox: 54, oy: -44, w: 210, z: -1220, color: '#0ae448' },
  { name: 'Lenis', ox: -66, oy: 6, w: 255, z: -1600 },
  { name: 'Node.js', ox: 64, oy: -10, w: 195, z: -1980, color: '#5fa04e' },
  { name: 'PostgreSQL', ox: -30, oy: -50, w: 180, z: -2360, color: '#4169e1' },
  { name: 'Docker', ox: 40, oy: 48, w: 240, z: -2740, color: '#2496ed' },
  { name: 'Figma', ox: -60, oy: 34, w: 165, z: -3120, color: '#f24e1e' },
  { name: 'Git', ox: 52, oy: 24, w: 180, z: -3500, color: '#f05032' },
];

function Logo({ name }) {
  const path = stackIcons[name.replace('.', '')];
  if (!path) return <span className="stack__wordmark">{name}</span>;
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={path} fill="currentColor" />
    </svg>
  );
}

/*
 * Смена фраз — как Morphing Text у MagicUI: две фразы лежат друг на друге, у уходящей
 * растёт размытие и падает прозрачность, у приходящей наоборот, а SVG-фильтр
 * с порогом по альфе снова делает края резкими — буквы будто перетекают.
 * Здесь доля перехода берётся не от таймера, а от прогресса прокрутки: между
 * соседними фразами морф идёт на 25–75% отрезка, остальное — удержание.
 */
const MORPH_START = 0.25;
const MORPH_END = 0.75;

function smoothstep(a, b, x) {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
}

function morphStyle(element, fraction) {
  if (fraction <= 0) {
    element.style.opacity = '0';
    element.style.filter = 'blur(100px)';
    return;
  }
  element.style.filter = `blur(${Math.min(8 / fraction - 8, 100)}px)`;
  element.style.opacity = `${Math.pow(fraction, 0.4) * 100}%`;
}

export function Stack() {
  const ref = useRef(null);
  const phraseRefs = useRef([]);

  const handleProgress = useCallback((progress) => {
    const nodes = phraseRefs.current;
    const spans = nodes.length - 1;
    const scaled = progress * spans;
    const segment = Math.min(Math.floor(scaled), Math.max(spans - 1, 0));
    const t = spans ? smoothstep(MORPH_START, MORPH_END, scaled - segment) : 0;

    nodes.forEach((node, index) => {
      if (!node) return;
      if (index === segment) morphStyle(node, 1 - t);
      else if (index === segment + 1) morphStyle(node, t);
      else morphStyle(node, 0);
    });
  }, []);

  useScrollProgress(ref, { mode: 'pinned', varName: '--p', onChange: handleProgress });

  return (
    <section
      ref={ref}
      className="stack"
      id="stack"
      style={{ '--n': phrases.length, '--travel': TRAVEL }}
    >
      <div className="stack__sticky">
        <svg className="stack__filter" aria-hidden="true">
          <defs>
            <filter id="stack-threshold">
              <feColorMatrix
                in="SourceGraphic"
                type="matrix"
                values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 255 -140"
              />
            </filter>
          </defs>
        </svg>

        <div className="stack__phrases">
          {phrases.map(([head, tail], index) => (
            <h2
              key={head}
              ref={(node) => {
                phraseRefs.current[index] = node;
              }}
              className="stack__phrase"
            >
              {head}
              <br />
              {tail}
            </h2>
          ))}
        </div>

        <ul className="stack__cards" aria-label="Библиотеки и инструменты">
          {tools.map((tool) => (
            <li
              key={tool.name}
              className="stack__logo"
              title={tool.name}
              style={{
                '--ox': tool.ox,
                '--oy': tool.oy,
                '--w': tool.w,
                '--z': tool.z,
                '--brand': tool.color,
              }}
            >
              <Logo name={tool.name} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

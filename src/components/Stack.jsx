import { useCallback, useRef } from 'react';
import { useScrollProgress } from '../scroll/useScrollProgress';
import { stackIcons } from '../assets/stackIcons';
import { MorphingText } from './MorphingText';

const phrases = [
  'Собираю интерфейсы из проверенного стека',
  'От мобильных приложений, до целых систем',
  'Каждый инструмент здесь заработал своё место',
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

export function Stack() {
  const ref = useRef(null);
  const morphRef = useRef(null);

  // Фразы ведёт прокрутка секции, а не таймер компонента: onChange вызывается
  // из цикла скролл-движка, поэтому второго тикера не появляется.
  const handleProgress = useCallback((progress) => {
    morphRef.current?.setProgress(progress);
  }, []);

  useScrollProgress(ref, {
    mode: 'pinned',
    varName: '--p',
    onChange: handleProgress,
  });

  return (
    <section
      ref={ref}
      className="stack"
      id="stack"
      style={{ '--n': phrases.length, '--travel': TRAVEL }}
    >
      <div className="stack__sticky">
        <MorphingText
          ref={morphRef}
          texts={phrases}
          autoplay={false}
          className="stack__morph"
        />

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

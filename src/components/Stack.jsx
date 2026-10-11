import { useCallback, useRef } from 'react';
import { useScrollProgress } from '../scroll/useScrollProgress';
import { stackIcons } from '../assets/stackIcons';
import rustIcon from '../assets/stack/rust.svg';
import swiftIcon from '../assets/stack/swift.svg';
import { MorphingText } from './MorphingText';

const phrases = [
  'Собираю интерфейсы из проверенного стека',
  'От мобильных приложений, до целых систем',
  'Каждый инструмент здесь заработал своё место',
];

const TRAVEL = 5360;
const tools = [
  { name: 'React', ox: -58, oy: -34, w: 225, z: -80, color: '#61dafb' },
  { name: 'Three.js', ox: 60, oy: 30, w: 255, z: -460 },
  { name: 'TypeScript', ox: -50, oy: 40, w: 180, z: -840, color: '#3178c6' },
  { name: 'GSAP', ox: 54, oy: -44, w: 210, z: -1220, color: '#0ae448' },
  { name: 'Lenis', ox: -66, oy: 6, w: 255, z: -1600, color: '#f3a6c8' },
  { name: 'Node.js', ox: 64, oy: -10, w: 195, z: -1980, color: '#5fa04e' },
  { name: 'PostgreSQL', ox: -30, oy: -50, w: 180, z: -2360, color: '#4169e1' },
  { name: 'Docker', ox: 40, oy: 48, w: 240, z: -2740, color: '#2496ed' },
  { name: 'Figma', ox: -60, oy: 34, w: 165, z: -3120, color: '#f24e1e' },
  { name: 'Git', ox: 52, oy: 24, w: 180, z: -3500, color: '#f05032' },
  { name: 'Rust', ox: -48, oy: -38, w: 190, z: -3880, color: '#dea584' },
  { name: 'Swift', ox: 56, oy: 38, w: 190, z: -4260, color: '#f05138' },
];
const stackIconImages = { Rust: rustIcon, Swift: swiftIcon };
function Logo({ name }) {
  const image = stackIconImages[name];
  if (image) return <img src={image} alt="" aria-hidden="true" />;
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
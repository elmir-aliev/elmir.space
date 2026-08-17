import { useReveal } from '../scroll/useReveal';

const lines = [
  'Пять лет собираю фронтенд:',
  'от лендингов со сложной графикой',
  'до интерфейсов, которые живут годами.',
];

export function Intro() {
  const ref = useReveal({ threshold: 0.35 });

  return (
    <section ref={ref} className="intro">
      <p className="intro__kicker reveal" style={{ '--i': 0 }}>
        О себе
      </p>

      <h2 className="intro__text">
        {lines.map((line, index) => (
          <span key={line} className="reveal" style={{ '--i': index + 1 }}>
            {line}
          </span>
        ))}
      </h2>
    </section>
  );
}

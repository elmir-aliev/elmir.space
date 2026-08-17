import { useRef } from 'react';
import { useReveal } from '../scroll/useReveal';
import { useScrollProgress } from '../scroll/useScrollProgress';

const works = [
  { id: 1, title: 'Friz', kind: 'Мебельная студия', year: '2026', tone: 'warm' },
  { id: 2, title: 'Kadr', kind: 'Портал фотостудии', year: '2025', tone: 'cold' },
  { id: 3, title: 'Volna', kind: 'Промо музыкального фестиваля', year: '2025', tone: 'deep' },
  { id: 4, title: 'Atlas', kind: 'Дашборд аналитики', year: '2024', tone: 'mono' },
];

function WorkCard({ work, index }) {
  const ref = useRef(null);
  // Прогресс прохода карточки через экран → параллакс медиа внутри неё
  useScrollProgress(ref, { mode: 'through', varName: '--p' });

  return (
    <article ref={ref} className="work reveal" style={{ '--i': index }}>
      <div className={`work__media work__media--${work.tone}`}>
        <span className="work__index">{String(work.id).padStart(2, '0')}</span>
      </div>

      <div className="work__meta">
        <h3>{work.title}</h3>
        <p>{work.kind}</p>
        <span>{work.year}</span>
      </div>
    </article>
  );
}

export function Works() {
  const ref = useReveal({ threshold: 0.05 });

  return (
    <section ref={ref} className="works" id="works">
      <header className="works__head">
        <h2>Избранные работы</h2>
        <p>2024 — 2026</p>
      </header>

      <div className="works__grid">
        {works.map((work, index) => (
          <WorkCard key={work.id} work={work} index={index} />
        ))}
      </div>
    </section>
  );
}

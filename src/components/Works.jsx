import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useScrollProgress } from '../scroll/useScrollProgress';
import frizShot from '../assets/works/friz.jpg';

/*
 * image — главный экран сайта проекта, url — настоящий адрес. Карточка с url
 * кликабельна: её экран разъезжается на весь вьюпорт, и по окончании перехода
 * открывается сам сайт. У проектов без url — заглушка-градиент, клика нет.
 * Без рамки браузера, номеров и анимации при наведении — по замечанию пользователя.
 */
const works = [
  {
    id: 1,
    title: 'Friz',
    kind: 'Мебельная студия',
    year: '2026',
    tone: 'warm',
    url: 'https://friz-spb.ru',
    image: frizShot,
  },
  { id: 2, title: 'Kadr', kind: 'Портал фотостудии', year: '2025', tone: 'cold' },
  { id: 3, title: 'Volna', kind: 'Промо музыкального фестиваля', year: '2025', tone: 'deep' },
  { id: 4, title: 'Atlas', kind: 'Дашборд аналитики', year: '2024', tone: 'mono' },
];

const ZOOM_DURATION = 900;

gsap.registerPlugin(ScrollTrigger);

/*
 * Появление привязано к прокрутке (scrub), а не к моменту входа: карточка
 * раскрывается, пока её верх идёт от нижнего края окна к REVEAL_END, и на быстром
 * скролле Lenis это читается как одно движение. Экран проекта выходит из
 * обрезки с приближенной картинкой, подпись догоняет во второй половине хода.
 */
const SCRUB = 0.8;
const REVEAL_START = 'top 100%';
const REVEAL_END = 'top 52%';
const CLIP_FROM = 'inset(16% 7% 16% 7% round 10px)';
const CLIP_TO = 'inset(0% 0% 0% 0% round 10px)';
const ZOOM_FROM = 1.22;
const DRIFT = 90;

function revealWorks(section) {
  const head = section.querySelectorAll('.works__head > *');
  gsap
    .timeline({
      scrollTrigger: { trigger: section, start: 'top 85%', end: 'top 55%', scrub: SCRUB },
      defaults: { ease: 'none' },
    })
    .fromTo(head, { y: 36, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.15 });

  section.querySelectorAll('.work').forEach((card) => {
    const media = card.querySelector('.work__media');
    const meta = card.querySelectorAll('.work__meta > *');

    gsap
      .timeline({
        scrollTrigger: { trigger: card, start: REVEAL_START, end: REVEAL_END, scrub: SCRUB },
        defaults: { ease: 'none' },
      })
      .fromTo(card, { y: DRIFT }, { y: 0, duration: 1 }, 0)
      .fromTo(
        media,
        { clipPath: CLIP_FROM, '--zoom': ZOOM_FROM, opacity: 0 },
        { clipPath: CLIP_TO, '--zoom': 1, opacity: 1, duration: 0.85 },
        0,
      )
      .fromTo(meta, { y: 26, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, stagger: 0.08 }, 0.45);
  });
}

// Экран проекта из карточки растёт до размеров окна, затем открывается сайт.
function zoomInto(frame, work) {
  const rect = frame.getBoundingClientRect();
  const overlay = document.createElement('div');
  overlay.className = 'work-zoom';
  overlay.style.top = `${rect.top}px`;
  overlay.style.left = `${rect.left}px`;
  overlay.style.width = `${rect.width}px`;
  overlay.style.height = `${rect.height}px`;

  const image = document.createElement('img');
  image.src = work.image;
  image.alt = '';
  overlay.append(image);
  document.body.append(overlay);

  overlay.getBoundingClientRect();
  overlay.classList.add('is-open');
  document.body.classList.add('is-zooming');

  window.setTimeout(() => window.location.assign(work.url), ZOOM_DURATION);
}

function WorkCard({ work, index }) {
  const ref = useRef(null);
  const frameRef = useRef(null);
  useScrollProgress(ref, { mode: 'through', varName: '--p' });

  const handleClick = (event) => {
    event.preventDefault();
    zoomInto(frameRef.current, work);
  };

  const frame = (
    <div ref={frameRef} className={`work__media work__media--${work.tone}`}>
      {work.image && <img src={work.image} alt={`Главный экран сайта ${work.title}`} />}
    </div>
  );

  return (
    <article ref={ref} className="work" style={{ '--i': index }}>
      {work.url ? (
        <a
          className="work__link"
          href={work.url}
          onClick={handleClick}
          aria-label={`Открыть сайт ${work.title}`}
        >
          {frame}
        </a>
      ) : (
        frame
      )}

      <div className="work__meta">
        <h3>{work.title}</h3>
        <p>{work.kind}</p>
        <span>{work.year}</span>
      </div>
    </article>
  );
}

export function Works() {
  const ref = useRef(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => revealWorks(ref.current), ref);
    return () => ctx.revert();
  }, []);

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

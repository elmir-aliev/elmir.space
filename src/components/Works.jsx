import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useScrollProgress } from '../scroll/useScrollProgress';
import frizMain from '../assets/works/friz-intro.png';
import frizInterior from '../assets/works/friz-interior.webp';
import frizProject from '../assets/works/friz-project.webp';

const featuredWork = {
  title: 'Friz',
  url: 'https://friz-spb.ru',
  image: frizMain,
};

const ZOOM_DURATION = 900;
const SCRUB = 0.8;
const REVEAL_START = 'top 96%';
const REVEAL_END = 'top 34%';
const CLIP_FROM = 'inset(14% 6% 14% 6% round 10px)';
const CLIP_TO = 'inset(0% 0% 0% 0% round 10px)';

gsap.registerPlugin(ScrollTrigger);

function revealWork(section) {
  const head = section.querySelectorAll('.works__head > *');
  const work = section.querySelector('.featured-work');
  const hero = work.querySelector('.featured-work__hero');
  const details = work.querySelectorAll('.featured-work__detail');
  const content = work.querySelectorAll('.featured-work__content > *');

  gsap
    .timeline({
      scrollTrigger: { trigger: section, start: 'top 86%', end: 'top 56%', scrub: SCRUB },
      defaults: { ease: 'none' },
    })
    .fromTo(head, { y: 36, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.14 });

  gsap
    .timeline({
      scrollTrigger: { trigger: work, start: REVEAL_START, end: REVEAL_END, scrub: SCRUB },
      defaults: { ease: 'none' },
    })
    .fromTo(work, { y: 88 }, { y: 0, duration: 1 }, 0)
    .fromTo(
      hero,
      { clipPath: CLIP_FROM, '--zoom': 1.18, opacity: 0 },
      { clipPath: CLIP_TO, '--zoom': 1, opacity: 1, duration: 0.75 },
      0,
    )
    .fromTo(
      details,
      { clipPath: 'inset(18% 8% 18% 8% round 10px)', '--zoom': 1.14, opacity: 0 },
      { clipPath: CLIP_TO, '--zoom': 1, opacity: 1, duration: 0.65, stagger: 0.1 },
      0.18,
    )
    .fromTo(
      content,
      { y: 28, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.42, stagger: 0.07 },
      0.48,
    );
}

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

export function Works() {
  const ref = useRef(null);
  const workRef = useRef(null);
  const heroRef = useRef(null);
  useScrollProgress(workRef, { mode: 'through', varName: '--p' });

  useLayoutEffect(() => {
    const ctx = gsap.context(() => revealWork(ref.current), ref);
    return () => ctx.revert();
  }, []);

  const handleOpen = (event) => {
    event.preventDefault();
    zoomInto(heroRef.current, featuredWork);
  };

  return (
    <section ref={ref} className="works" id="works">
      <header className="works__head">
        <h2>Избранная работа</h2>
        <p>01 / 01</p>
      </header>

      <article ref={workRef} className="featured-work">
        <div className="featured-work__gallery">
          <a
            className="featured-work__main-link"
            href={featuredWork.url}
            onClick={handleOpen}
            aria-label="Открыть сайт Friz"
          >
            <div ref={heroRef} className="featured-work__hero">
              <img src={frizMain} alt="Главный экран сайта Friz" />
              <span className="featured-work__open">Открыть сайт ↗</span>
            </div>
          </a>

          <div className="featured-work__details">
            <figure className="featured-work__detail">
              <img src={frizInterior} alt="Интерьер в каталоге Friz" />
            </figure>
            <figure className="featured-work__detail">
              <img src={frizProject} alt="Проект мебели в портфолио Friz" />
            </figure>
          </div>
        </div>

        <div className="featured-work__content">
          <div className="featured-work__intro">
            <p className="featured-work__eyebrow">Digital / 2026</p>
            <h3>Friz</h3>
            <p className="featured-work__summary">
              Сайт мебельной студии с плавными переходами, адаптивной галереей и
              отдельной мобильной механикой.
            </p>
          </div>

          <dl className="featured-work__facts">
            <div>
              <dt>Роль</dt>
              <dd>Frontend-разработчик</dd>
            </div>
            <div>
              <dt>Стек</dt>
              <dd>React , Vite , GSAP, Lenis</dd>
            </div>
            <div>
              <dt>Формат</dt>
              <dd>Digital</dd>
            </div>
          </dl>
        </div>
      </article>
    </section>
  );
}

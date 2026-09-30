import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useScrollProgress } from '../scroll/useScrollProgress';
import frizMain from '../assets/works/friz-intro.png';
import frizVideo1 from '../assets/works/friz-showcase-01.mp4';
import frizVideo2 from '../assets/works/friz-showcase-02.mp4';
import frizVideo3 from '../assets/works/friz-showcase-03.mp4';

const featuredWork = {
  title: 'Friz',
  url: 'https://friz-spb.ru',
  image: frizMain,
};

const showcaseVideos = [frizVideo1, frizVideo2, frizVideo3];

const ZOOM_DURATION = 900;
const SCRUB = 0.8;
const REVEAL_START = 'top 96%';
const REVEAL_END = 'top 34%';

gsap.registerPlugin(ScrollTrigger);

function revealWork(section) {
  const head = section.querySelectorAll('.works__head > *');
  const work = section.querySelector('.featured-work');
  const hero = work.querySelector('.featured-work__hero');
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
      { scale: .92, opacity: 0 },
      { scale: 1, opacity: 1, duration: .75 },
      0,
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

function FrizShowcase({ frameRef, onOpen }) {
  const [active, setActive] = useState(0);
  const videos = useRef([]);

  useEffect(() => {
    videos.current.forEach((video, index) => {
      if (!video) return;
      if (index === active || video.ended) video.currentTime = 0;
      video.play().catch(() => {});
    });
  }, [active]);

  const handleEnded = (index) => {
    if (index !== active) return;
    setActive((index + 1) % showcaseVideos.length);
  };

  return (
    <a
      className="featured-work__main-link"
      href={featuredWork.url}
      onClick={onOpen}
      aria-label="Открыть сайт Friz"
    >
      <div ref={frameRef} className="featured-work__hero featured-work__showcase">
        <div className="featured-work__orbit" aria-hidden="true">
          {showcaseVideos.map((src, index) => {
            const position = (index - active + showcaseVideos.length) % showcaseVideos.length;
            const state = position === 0 ? 'active' : position === 1 ? 'next' : 'previous';
            return (
              <div className={`featured-work__video-card is-${state}`} key={src}>
                <div className="featured-work__video-surface">
                  <video
                    ref={(node) => { videos.current[index] = node; }}
                    src={src}
                    muted
                    playsInline
                    autoPlay
                    loop={index !== active}
                    preload="metadata"
                    onEnded={() => handleEnded(index)}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <span className="featured-work__open">Открыть сайт ↗</span>
      </div>
    </a>
  );
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
        <div className="featured-work__content">
          <div className="featured-work__intro">
            <h3>Friz</h3>
            <p className="featured-work__description">
              Цифровой каталог для Friz, который переводит характер мебельного бренда
              в плавную навигацию, выразительную подачу коллекций и запоминающийся
              визуальный опыт.
            </p>
          </div>
        </div>

        <div className="featured-work__gallery">
          <FrizShowcase frameRef={heroRef} onOpen={handleOpen} />
        </div>
      </article>
    </section>
  );
}

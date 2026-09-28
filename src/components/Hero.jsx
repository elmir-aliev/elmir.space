import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { HeroFlowers } from './HeroFlowers';
import { IronhillWipe } from './IronhillWipe';
import '../styles/hero.css';

gsap.registerPlugin(ScrollTrigger, SplitText);

export function Hero() {
  const heroRef = useRef(null);

  useLayoutEffect(() => {
    const hero = heroRef.current;
    if (!hero) return undefined;

    let split;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ctx = gsap.context((self) => {
      if (reducedMotion) return;
      const heading = hero.querySelector('.hero-content h2');
      split = new SplitText(heading, { type: 'words' });
      gsap.set(split.words, { opacity: 0 });

      ScrollTrigger.create({
        trigger: hero,
        start: 'top top',
        end: 'bottom bottom',
        onUpdate: (trigger) => {
          self.add(() => {
            const revealProgress = Math.max(0, Math.min(1, (trigger.progress - 0.58) / 0.36));
            const total = split.words.length;
            split.words.forEach((word, index) => {
              const from = index / total;
              const to = (index + 1) / total;
              let opacity = 0;
              if (revealProgress >= to) opacity = 1;
              else if (revealProgress >= from) opacity = (revealProgress - from) / (to - from);
              gsap.to(word, { opacity, duration: 0.1, overwrite: true });
            });
          });
        },
      });
    }, heroRef);

    return () => {
      ctx.revert();
      split?.revert();
    };
  }, []);

  return (
    <section
      ref={heroRef}
      className="hero hero--ironhill"
      id="top"
      aria-label="Создаю приложения, которые можно полюбить"
    >
      <div className="hero-img"><HeroFlowers /></div>

      <div className="hero-header">
        <h1>
          <span>Создаю приложения,</span>
          <span>которые <em>можно полюбить</em></span>
        </h1>
      </div>

      <IronhillWipe heroRef={heroRef} />

      <div className="hero-content">
        <h2>
          Пять лет соединяю сложную графику, точную разработку и продуманные
          взаимодействия в цифровые продукты, которыми хочется пользоваться.
        </h2>
      </div>
    </section>
  );
}

import { useCallback, useRef, useState } from 'react';
import { useScrollProgress } from '../scroll/useScrollProgress';
import { AsciiFlower } from './AsciiFlower';
import { Naming } from './Naming';

/**
 * Первый экран: залипает, пока страница уходит вверх.
 * Заголовок и цветок уходят с разной скоростью и гаснут —
 * всё считается из одной переменной --p прямо в CSS.
 *
 * Справа от текста растёт ASCII-цветок. Когда он дорос, под его листвой
 * проявляется поле: введённое имя становится рампой рисунка, и цветок
 * перерисовывается его буквами.
 */

const NAME_LIMIT = 12;

/* К этому прогрессу текст и цветок уже погасли: экран уходит, и поле имени
   вместе с ним — иначе в него можно было бы попасть табом вслепую. */
const FADED = 0.7;

/* Пробел в рампе выбил бы из рисунка целый уровень плотности — он бы стал дырами. */
function cleanName(raw) {
  return raw.replace(/\s+/g, '').toUpperCase().slice(0, NAME_LIMIT);
}

export function Hero() {
  const ref = useRef(null);
  const [name, setName] = useState('');
  const [grown, setGrown] = useState(false);
  const [faded, setFaded] = useState(false);

  // Прогресс приходит каждый кадр, но состояние меняется только на переходе
  // через порог — на одинаковом значении React ре-рендер не запускает.
  const handleProgress = useCallback((progress) => setFaded(progress > FADED), []);
  const handleSettled = useCallback(() => setGrown(true), []);
  const handleName = useCallback((event) => setName(cleanName(event.target.value)), []);

  useScrollProgress(ref, { mode: 'pinned', varName: '--p', onChange: handleProgress });

  return (
    <section ref={ref} className="hero" id="top">
      <div className="hero__sticky">
        <div className="hero__content">
          <p className="hero__kicker">Фронтенд-разработчик — Санкт-Петербург</p>
          <h1 className="hero__title">
            Приложения,
            <br />
            которые <br/> <em>можно почувствовать</em>
          </h1>
          <p className="hero__lead">
            React, Three.js, Lenis. Собираю сайты, которые
            запоминаются с первого экрана.
          </p>
        </div>

        <div className="hero__flower" inert={faded || undefined}>
          <Naming active={grown} value={name} onChange={handleName} />
          <AsciiFlower ramp={name} onSettled={handleSettled} />
        </div>

        <div className="hero__scroll" aria-hidden="true">
          <span>Листайте</span>
          <i />
        </div>
      </div>
    </section>
  );
}

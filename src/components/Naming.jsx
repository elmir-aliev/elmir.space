import { useEffect, useId, useRef } from 'react';

/**
 * Подпись с полем под листвой цветка. Проявляется тем же приёмом, что и сам
 * цветок, только волна идёт слева направо: символы сначала перебирают
 * плотностную рампу и лишь потом садятся на свои места.
 *
 * Подпись и плейсхолдер — одна непрерывная строка: волна проходит по ним
 * подряд, поэтому поле дописывается сразу после надписи, а не отдельно.
 */

const LABEL = 'Дайте ему имя';
const PLACEHOLDER = 'ЭЛЬМИР';
const SCRAMBLE = '.:-=+*#%@';

const DURATION = 1400; // мс на всю строку
const BAND = 5; // сколько символов одновременно перебираются
const SCRAMBLE_HZ = 26; // как и у цветка: реже кадра, иначе рябит

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

export function Naming({ active, value, onChange }) {
  const labelRef = useRef(null);
  const inputRef = useRef(null);
  const inputId = useId();

  useEffect(() => {
    const label = labelRef.current;
    const input = inputRef.current;
    if (!active || !label || !input) return undefined;

    const settle = () => {
      label.textContent = LABEL;
      input.placeholder = PLACEHOLDER;
    };

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      settle();
      return undefined;
    }

    const total = LABEL.length + PLACEHOLDER.length;
    let frame = 0;
    let start = 0;
    let lastScramble = 0;

    const step = (now) => {
      if (!start) start = now;
      const progress = Math.min((now - start) / DURATION, 1);
      // +BAND, чтобы последний символ успел не только показаться, но и досыпаться
      const front = easeOutCubic(progress) * (total + BAND);

      if (now - lastScramble >= 1000 / SCRAMBLE_HZ) {
        lastScramble = now;

        let out = '';
        for (let i = 0; i < total; i += 1) {
          const local = front - i;
          const final = i < LABEL.length ? LABEL[i] : PLACEHOLDER[i - LABEL.length];

          if (local <= 0) out += ' '; // ещё не дошло — держим место, чтобы строка не дёргалась
          else if (local < BAND && final !== ' ') out += SCRAMBLE[(Math.random() * SCRAMBLE.length) | 0];
          else out += final;
        }

        label.textContent = out.slice(0, LABEL.length);
        input.placeholder = out.slice(LABEL.length);
      }

      if (progress < 1) frame = requestAnimationFrame(step);
      else settle();
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [active]);

  return (
    <div className={`naming${active ? ' is-visible' : ''}`}>
      {/* Текст ставит анимация — в разметке пусто, иначе подпись мигнёт целиком до первого кадра */}
      <label className="naming__label" htmlFor={inputId} ref={labelRef} />
      <input
        id={inputId}
        ref={inputRef}
        className="naming__input"
        type="text"
        value={value}
        onChange={onChange}
        placeholder=""
        aria-label={LABEL}
        maxLength={12}
        autoComplete="off"
        spellCheck="false"
        tabIndex={active ? 0 : -1}
      />
    </div>
  );
}

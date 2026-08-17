import { useEffect, useRef } from 'react';
import { FLOWER, LUM_MAX, LUM_MIN } from '../assets/asciiFlower';

/**
 * ASCII-цветок первого экрана: растёт снизу вверх, и пока строка растёт, её
 * символы перебирают плотностную рампу и только потом замирают на своих.
 *
 * Рисунок — 1720 подкрашенных ячеек. Перерисовывать их реактом покадрово нельзя,
 * поэтому разметка ставится один раз, а анимация правит textContent и opacity
 * напрямую. За кадр трогаем только строки внутри полосы роста (BAND), всё что
 * ниже уже замерло, всё что выше ещё не показалось.
 *
 * `ramp` пересаживает рисунок на свои символы (имя, которое ввёл человек).
 * Смена рампы — обычный ререндер: реакт правит только текст ячеек, а поле ввода
 * появляется лишь после `onSettled`, поэтому с анимацией роста они не пересекаются.
 */

/*
 * Рампа по умолчанию. Собственную рампу экспорта (RAMP в модуле данных) не
 * используем: в текущем файле она бинарная, "01", а рисунок читается лучше на
 * классической плотностной шкале. Плотность клетки всё равно берётся из её
 * светлоты, поэтому шкала может быть любой длины.
 */
const DENSITY_RAMP = '.:-=+*#%@';

const DURATION = 3600; // мс на весь рост
const BAND = 9; // сколько строк одновременно перебирают символы
const SCRAMBLE_HZ = 26; // подмена символов реже кадра: на 60 Гц рябит и зря жжёт кадр

// Скрыта / перебирает символы / замерла — чтобы не трогать строку, которой не меняли состояние
const HIDDEN = -1;
const GROWING = 0;
const SETTLED = 1;

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

/**
 * Пересадка рисунка на свою рампу — так же, как это делает поле CHARACTER RAMP
 * в ASCIInator: первая буква ложится на самое разреженное место, последняя на
 * самое плотное. Цвет клетки не трогаем, меняется только глиф.
 *
 * Плотность берём из светлоты цвета, а не из позиции символа в RAMP. Экспорт
 * кладёт плотный глиф на тёмную клетку, поэтому светлота и есть плотность,
 * только в обратную сторону — и у неё полное разрешение. По символу так нельзя:
 * рампа экспорта бывает двухсимвольной ("01"), и тогда из имени в рисунок
 * попали бы всего две буквы.
 */
function rampedChar(hex, ramp) {
  const value = parseInt(hex, 16);
  const luminance =
    0.2126 * ((value >> 16) & 255) + 0.7152 * ((value >> 8) & 255) + 0.0722 * (value & 255);
  const density = (LUM_MAX - luminance) / (LUM_MAX - LUM_MIN);
  return ramp[Math.min(Math.floor(density * ramp.length), ramp.length - 1)];
}

/** Строка рисунка: пробелы отдаём текстом, глифы — span'ами со своим цветом. */
function renderRow(row, colors, ramp) {
  const out = [];
  let gap = '';
  let index = 0;

  for (let x = 0; x < row.length; x += 1) {
    const char = row[x];

    if (char === ' ') {
      gap += char;
      continue;
    }

    if (gap) {
      out.push(gap);
      gap = '';
    }

    const hex = colors.slice(index * 6, index * 6 + 6);
    out.push(
      <span key={x} data-glyph="" style={{ color: `#${hex}` }}>
        {rampedChar(hex, ramp || DENSITY_RAMP)}
      </span>,
    );
    index += 1;
  }

  if (gap) out.push(gap);
  return out;
}

export function AsciiFlower({ ramp = '', onSettled }) {
  const rootRef = useRef(null);
  const settledRef = useRef(onSettled);

  // Держим колбэк в ref, чтобы его смена не перезапускала анимацию роста.
  // Эффект объявлен выше анимационного — на монтировании отработает раньше него.
  useEffect(() => {
    settledRef.current = onSettled;
  });

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const rows = Array.from(root.children);
    const cells = rows.map((row) => Array.from(row.querySelectorAll('[data-glyph]')));
    // Финальные символы снимаем с разметки до старта — она уже отрисована правильной.
    const finals = cells.map((row) => row.map((cell) => cell.textContent));

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      settledRef.current?.();
      return undefined;
    }

    const height = rows.length;
    const state = new Array(height).fill(HIDDEN);
    rows.forEach((row) => {
      row.style.opacity = '0';
    });

    let frame = 0;
    let start = 0;
    let lastScramble = 0;

    const step = (now) => {
      if (!start) start = now;
      const progress = Math.min((now - start) / DURATION, 1);
      // +BAND, чтобы верхняя строка успела не только показаться, но и досыпаться
      const grown = easeOutCubic(progress) * (height + BAND);

      const scramble = now - lastScramble >= 1000 / SCRAMBLE_HZ;
      if (scramble) lastScramble = now;

      for (let y = 0; y < height; y += 1) {
        // 0 у нижней строки: рост идёт снизу вверх
        const local = grown - (height - 1 - y);

        if (local <= 0) {
          if (state[y] !== HIDDEN) {
            rows[y].style.opacity = '0';
            state[y] = HIDDEN;
          }
          continue;
        }

        if (local >= BAND) {
          if (state[y] !== SETTLED) {
            rows[y].style.opacity = '1';
            cells[y].forEach((cell, i) => {
              cell.textContent = finals[y][i];
            });
            state[y] = SETTLED;
          }
          continue;
        }

        rows[y].style.opacity = (local / BAND).toFixed(2);
        state[y] = GROWING;
        if (scramble) {
          cells[y].forEach((cell) => {
            cell.textContent = DENSITY_RAMP[(Math.random() * DENSITY_RAMP.length) | 0];
          });
        }
      }

      if (progress < 1) frame = requestAnimationFrame(step);
      else settledRef.current?.();
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <pre className="ascii-flower" ref={rootRef} aria-hidden="true">
      {/* Сетка статичная, строки не переставляются — индекс тут законный ключ. */}
      {FLOWER.rows.map((row, y) => (
        <span className="ascii-flower__row" key={y}>
          {renderRow(row, FLOWER.colors[y], ramp)}
        </span>
      ))}
    </pre>
  );
}

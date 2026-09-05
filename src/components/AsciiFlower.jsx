import { useEffect, useRef } from 'react';
import { FLOWER, LUM_MAX, LUM_MIN } from '../assets/asciiFlower';

const DENSITY_RAMP = '.:-=+*#%@';

const DURATION = 3600;
const BAND = 9;
const SCRAMBLE_HZ = 26;

const HIDDEN = -1;
const GROWING = 0;
const SETTLED = 1;

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

function rampedChar(hex, ramp) {
  const value = parseInt(hex, 16);
  const luminance =
    0.2126 * ((value >> 16) & 255) + 0.7152 * ((value >> 8) & 255) + 0.0722 * (value & 255);
  const density = (LUM_MAX - luminance) / (LUM_MAX - LUM_MIN);
  return ramp[Math.min(Math.floor(density * ramp.length), ramp.length - 1)];
}

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

  useEffect(() => {
    settledRef.current = onSettled;
  });

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const rows = Array.from(root.children);
    const cells = rows.map((row) => Array.from(row.querySelectorAll('[data-glyph]')));
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
      const grown = easeOutCubic(progress) * (height + BAND);

      const scramble = now - lastScramble >= 1000 / SCRAMBLE_HZ;
      if (scramble) lastScramble = now;

      for (let y = 0; y < height; y += 1) {
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
      {FLOWER.rows.map((row, y) => (
        <span className="ascii-flower__row" key={y}>
          {renderRow(row, FLOWER.colors[y], ramp)}
        </span>
      ))}
    </pre>
  );
}

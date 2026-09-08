import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "@react-three/fiber";
import gsap from "gsap";
import videoSrc from "../assets/hero-loop.mp4";
import { AsciiFilm } from "./AsciiFilm";

const COLS_WIDE = 300;
const COLS_NARROW = 150;

// Кадр всегда разбирается на сетке 300 колонок: пороги ключевания (KEY_STEP,
// EDGE_LIMIT, MIN_ISLAND) подобраны под неё, на 150 колонках край крышки ноутбука
// размывался и заливка то съедала крышку, то не доходила до стены слева от неё.
// Экранная сетка берётся из разобранной усреднением по блоку.
const ANALYSIS_COLS = COLS_WIDE;

const ROW_RATIO = (704 / 1248) * 0.6;

const ANALYSIS_ROWS = Math.round(ANALYSIS_COLS * ROW_RATIO);

const DENSITY_RAMP = " .,:;=+*oO#%@";

const SPEED = 0.5;
const FPS = 24;

const LUM_LOW = 30;
const LUM_HIGH = 236;

const KEY_STEP = 22;
const KEY_CLEANUP = 2;

const EDGE_PASSES = 2;
const EDGE_LIMIT = 100;

const MIN_ISLAND = 0.004;

const KEY_EASE = 0.25;
const KEY_ENTER = 0.62;
const KEY_LEAVE = 0.38;

const NOISE = ".,:;=+*oO#%@";

// Первый экран сначала живёт как glyph-matrix (magicui): сетка случайных знаков,
// каждая клетка с вероятностью MATRIX_RATE меняется раз в MATRIX_TICK мс.
const MATRIX_GLYPHS = "01·•+*/\\<>=";
const MATRIX_RATE = 0.012;
const MATRIX_TICK = 120;
// Матрица живёт не меньше MATRIX_HOLD мс с монтирования, потом растворяется.
const MATRIX_HOLD = 1400;
// Как у magicui: у каждой клетки своя прозрачность (часть знаков почти чёрные),
// при мутации она разыгрывается заново, к низу сетка гаснет на MATRIX_FADE.
const MATRIX_COLOR = "243, 240, 234";
const MATRIX_ALPHA_MIN = 0.08;
const MATRIX_ALPHA_SPREAD = 0.55;
const MATRIX_FADE = 0.6;

// Растворение: каждая клетка получает свой порог DROP; когда прогресс перевалил
// через него, серый знак матрицы гаснет, а на месте фигуры вспыхивает шум и
// через SCRAMBLE оседает в знак видео. Порог — смесь случая и разворота слева направо.
const DISSOLVE = 1.8;
const DISSOLVE_NOISE = 0.55;
const SCRAMBLE = 0.1;

const WIDE = "(min-width: 900px)";

function useColumns() {
  const [cols, setCols] = useState(() =>
    typeof window === "undefined" || window.matchMedia(WIDE).matches
      ? COLS_WIDE
      : COLS_NARROW,
  );

  useEffect(() => {
    const query = window.matchMedia(WIDE);
    const sync = () => setCols(query.matches ? COLS_WIDE : COLS_NARROW);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return cols;
}

export function AsciiVideo({ paused = false, onSettled }) {
  const rootRef = useRef(null);
  const videoRef = useRef(null);
  const colorRef = useRef(null);
  const preRef = useRef(null);
  const matrixRef = useRef(null);
  const filmRef = useRef(null);
  const settledRef = useRef(onSettled);

  // Видео держится и в ref, и в состоянии: ref — чтобы им управлял цикл,
  // состояние — чтобы сцена AsciiFilm смонтировалась уже после элемента,
  // который получает пропом.
  const [mounted, setMounted] = useState(null);
  const attachVideo = useCallback((node) => {
    videoRef.current = node;
    setMounted(node);
  }, []);

  const cols = useColumns();
  const rows = Math.round(cols * ROW_RATIO);

  const keys = useMemo(() => Array.from({ length: rows }, (_, y) => y), [rows]);

  useEffect(() => {
    settledRef.current = onSettled;
  }, [onSettled]);



  useEffect(() => {
    const root = rootRef.current;
    const video = videoRef.current;
    const pre = preRef.current;
    const matrix = matrixRef.current;
    if (!root || !video || !pre || !matrix) return undefined;

    const lines = Array.from(pre.children);
    const blank = " ".repeat(cols);
    lines.forEach((line) => {
      line.textContent = blank;
      line.style.opacity = "";
    });

    const aCols = ANALYSIS_COLS;
    const aRows = ANALYSIS_ROWS;
    const aSize = aCols * aRows;

    // Разобранный кадр приезжает с GPU: RGB — цвет для ключевания,
    // альфа — резкость, из неё берётся плотность знака.
    let pixels = null;

    const back = new Uint8Array(aSize);
    const settled = new Uint8Array(aSize);
    const presence = new Float32Array(aSize);
    let primed = false;

    const seen = new Uint8Array(aSize);
    const scratch = new Uint8Array(aSize);
    const stack = new Int32Array(aSize);
    const chunk = new Int32Array(aSize);
    const minIsland = Math.max(8, Math.round(aSize * MIN_ISLAND));

    const cells = new Array(cols);
    const drop = new Float32Array(cols * rows);
    let frame = 0;

    const ease = () => {
      if (!primed) {
        for (let i = 0; i < aSize; i += 1) {
          settled[i] = back[i];
          presence[i] = back[i];
        }
        primed = true;
        return;
      }
      for (let i = 0; i < aSize; i += 1) {
        presence[i] += (back[i] - presence[i]) * KEY_EASE;
        if (presence[i] > KEY_ENTER) settled[i] = 1;
        else if (presence[i] < KEY_LEAVE) settled[i] = 0;
        back[i] = settled[i];
      }
    };

    const keyOut = (data) => {
      back.fill(0);
      let top = 0;

      const seed = (i) => {
        if (back[i]) return;
        back[i] = 1;
        stack[top] = i;
        top += 1;
      };

      const spread = (j, r, g, b) => {
        if (back[j]) return;
        const q = j << 2;
        if (
          Math.abs(data[q] - r) +
            Math.abs(data[q + 1] - g) +
            Math.abs(data[q + 2] - b) <
          KEY_STEP
        ) {
          back[j] = 1;
          stack[top] = j;
          top += 1;
        }
      };

      const step = (i, j) => {
        const p = i << 2;
        const q = j << 2;
        return (
          Math.abs(data[p] - data[q]) +
          Math.abs(data[p + 1] - data[q + 1]) +
          Math.abs(data[p + 2] - data[q + 2])
        );
      };

      const soft = (i, out, inner) => {
        if (!back[out] || back[inner]) return false;
        const away = step(i, out);
        return away < EDGE_LIMIT && away < step(i, inner);
      };

      for (let x = 0; x < aCols; x += 1) seed(x);
      for (let y = 0; y < aRows; y += 1) {
        seed(y * aCols);
        seed(y * aCols + aCols - 1);
      }

      while (top > 0) {
        top -= 1;
        const i = stack[top];
        const p = i << 2;
        const r = data[p];
        const g = data[p + 1];
        const b = data[p + 2];
        const y = (i / aCols) | 0;
        const x = i - y * aCols;

        if (y > 0) spread(i - aCols, r, g, b);
        if (y < aRows - 1) spread(i + aCols, r, g, b);
        if (x > 0) spread(i - 1, r, g, b);
        if (x < aCols - 1) spread(i + 1, r, g, b);
      }

      for (let n = 0; n < EDGE_PASSES; n += 1) {
        scratch.set(back);
        for (let y = 0; y < aRows; y += 1) {
          for (let x = 0; x < aCols; x += 1) {
            const i = y * aCols + x;
            if (back[i]) continue;
            const vertical =
              y > 0 &&
              y < aRows - 1 &&
              (soft(i, i - aCols, i + aCols) || soft(i, i + aCols, i - aCols));
            const horizontal =
              x > 0 &&
              x < aCols - 1 &&
              (soft(i, i - 1, i + 1) || soft(i, i + 1, i - 1));
            if (vertical || horizontal) scratch[i] = 1;
          }
        }
        back.set(scratch);
      }

      for (let n = 0; n < KEY_CLEANUP; n += 1) {
        scratch.set(back);
        for (let y = 0; y < aRows; y += 1) {
          for (let x = 0; x < aCols; x += 1) {
            const i = y * aCols + x;
            const up = y > 0 && back[i - aCols] === 1;
            const down = y < aRows - 1 && back[i + aCols] === 1;
            const left = x > 0 && back[i - 1] === 1;
            const right = x < aCols - 1 && back[i + 1] === 1;
            const around = up + down + left + right;
            const thin = (up && down) || (left && right);
            if (!back[i] && (around >= 3 || thin)) scratch[i] = 1;
            else if (back[i] && around === 0) scratch[i] = 0;
          }
        }
        back.set(scratch);
      }

      seen.fill(0);
      for (let s = 0; s < aSize; s += 1) {
        if (back[s] || seen[s]) continue;

        let found = 0;
        top = 0;
        seen[s] = 1;
        stack[top] = s;
        top += 1;

        while (top > 0) {
          top -= 1;
          const i = stack[top];
          chunk[found] = i;
          found += 1;
          const y = (i / aCols) | 0;
          const x = i - y * aCols;

          if (y > 0 && !back[i - aCols] && !seen[i - aCols]) {
            seen[i - aCols] = 1;
            stack[top] = i - aCols;
            top += 1;
          }
          if (y < aRows - 1 && !back[i + aCols] && !seen[i + aCols]) {
            seen[i + aCols] = 1;
            stack[top] = i + aCols;
            top += 1;
          }
          if (x > 0 && !back[i - 1] && !seen[i - 1]) {
            seen[i - 1] = 1;
            stack[top] = i - 1;
            top += 1;
          }
          if (x < aCols - 1 && !back[i + 1] && !seen[i + 1]) {
            seen[i + 1] = 1;
            stack[top] = i + 1;
            top += 1;
          }
        }

        if (found < minIsland) {
          for (let n = 0; n < found; n += 1) back[chunk[n]] = 1;
        }
      }

      ease();
    };

    // Свежий кадр: даунскейл, светлота, unsharp и цветовая подложка считаются
    // на GPU (см. AsciiFilm), сюда возвращается готовый буфер сетки разбора,
    // и на CPU остаётся только маска фона.
    const analyze = () => {
      const data = filmRef.current?.analyze();
      if (!data) return false;
      pixels = data;
      keyOut(data);
      return true;
    };

    // Сборка строк по разобранному кадру. t — прогресс растворения матрицы:
    // клетка с порогом выше t ещё принадлежит матрице и здесь пуста.
    // Границы блока разобранной сетки для каждой экранной колонки и строки.
    const span = (count, total) => {
      const from = new Int32Array(count);
      const to = new Int32Array(count);
      for (let n = 0; n < count; n += 1) {
        from[n] = Math.floor((n * total) / count);
        to[n] = Math.max(from[n] + 1, Math.floor(((n + 1) * total) / count));
      }
      return [from, to];
    };
    const [x0, x1] = span(cols, aCols);
    const [y0, y1] = span(rows, aRows);

    const compose = (t) => {
      // Кадра может ещё не быть: первый асинхронный readback приходит на разбор
      // позже, а растворение к этому моменту уже могло закончиться.
      if (!pixels) return;

      const chars = DENSITY_RAMP;
      const last = chars.length - 1;
      const floor = chars[0] === " " ? 1 : 0;

      for (let y = 0; y < rows; y += 1) {
        const row = y * cols;

        for (let x = 0; x < cols; x += 1) {
          const i = row + x;

          if (t < drop[i]) {
            cells[x] = " ";
            continue;
          }

          // Блок разобранной сетки: клетка — фигура, если фигуры в блоке не меньше половины.
          let hidden = 0;
          let total = 0;
          let sum = 0;
          for (let ay = y0[y]; ay < y1[y]; ay += 1) {
            for (let ax = x0[x]; ax < x1[x]; ax += 1) {
              const a = ay * aCols + ax;
              hidden += back[a];
              sum += pixels[(a << 2) + 3];
              total += 1;
            }
          }
          if (hidden * 2 > total) {
            cells[x] = " ";
            continue;
          }
          if (t < drop[i] + SCRAMBLE) {
            cells[x] = NOISE[(Math.random() * NOISE.length) | 0];
            continue;
          }

          const k = (sum / total - LUM_LOW) / (LUM_HIGH - LUM_LOW);
          const level = k <= 0 ? 0 : k >= 1 ? 1 : k;
          cells[x] =
            chars[Math.min(Math.max((level * chars.length) | 0, floor), last)];
        }

        const line = cells.join("");
        if (lines[y].textContent !== line) lines[y].textContent = line;
      }
    };

    // ---- Матрица: canvas с сеткой тех же клеток, накрывающий весь первый экран. ----
    // Её сетка совмещена с сеткой видео: клетка (x, y) кадра — это клетка
    // (x + kx, y + ky) матрицы, поэтому знак гаснет ровно там, где вспыхивает.
    // Рисуется по клеткам: полная отрисовка один раз, дальше только мутации
    // (перерисовать клетку) и растворение (стереть клетку). Живёт около трёх
    // секунд от загрузки, поэтому и остаётся на 2d-холсте.
    const mctx = matrix.getContext("2d");
    let mCols = 0;
    let mRows = 0;
    let kx = 0;
    let ky = 0;
    let cellW = 0;
    let cellH = 0;
    let baseline = 0;
    let mGlyph = new Uint8Array(0);
    let mAlpha = new Float32Array(0);
    let mDrop = new Float32Array(0);
    let mGone = new Uint8Array(0);

    const dropAt = (gx) => {
      const sweep = mCols > 1 ? gx / (mCols - 1) : 0;
      return (
        (DISSOLVE_NOISE * Math.random() + (1 - DISSOLVE_NOISE) * sweep) *
        (1 - SCRAMBLE)
      );
    };

    const randomAlpha = () =>
      MATRIX_ALPHA_MIN + Math.random() * MATRIX_ALPHA_SPREAD;

    const drawCell = (i) => {
      const y = (i / mCols) | 0;
      const x = i - y * mCols;
      mctx.clearRect(x * cellW, y * cellH, cellW, cellH);
      if (mGone[i]) return;
      const fade = 1 - (y / mRows) * MATRIX_FADE;
      mctx.fillStyle = `rgba(${MATRIX_COLOR}, ${(mAlpha[i] * fade).toFixed(3)})`;
      mctx.fillText(MATRIX_GLYPHS[mGlyph[i]], x * cellW, y * cellH + baseline);
    };

    const buildMatrix = () => {
      const hero = root.parentElement;
      const rootRect = root.getBoundingClientRect();
      const heroRect = hero.getBoundingClientRect();
      const preRect = pre.getBoundingClientRect();
      cellW = preRect.width / cols;
      cellH = preRect.height / rows;
      if (!cellW || !cellH) return;

      const frameLeft = preRect.left - rootRect.left;
      const frameTop = preRect.top - rootRect.top;
      const coverLeft = heroRect.left - rootRect.left;
      const coverTop = heroRect.top - rootRect.top;

      kx = Math.max(0, Math.ceil((frameLeft - coverLeft) / cellW));
      ky = Math.max(0, Math.ceil((frameTop - coverTop) / cellH));
      const left = frameLeft - kx * cellW;
      const top = frameTop - ky * cellH;
      mCols = Math.max(
        cols,
        Math.ceil((heroRect.right - rootRect.left - left) / cellW),
      );
      mRows = Math.max(
        rows,
        Math.ceil((heroRect.bottom - rootRect.top - top) / cellH),
      );

      const width = mCols * cellW;
      const height = mRows * cellH;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      matrix.style.left = `${left}px`;
      matrix.style.top = `${top}px`;
      matrix.style.width = `${width}px`;
      matrix.style.height = `${height}px`;
      matrix.width = Math.ceil(width * dpr);
      matrix.height = Math.ceil(height * dpr);
      mctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Тот же шрифт, что у знаков видео; базовая линия — как в строке с line-height: 1.
      const font = getComputedStyle(pre);
      mctx.font = `${font.fontWeight} ${font.fontSize} ${font.fontFamily}`;
      mctx.textBaseline = "alphabetic";
      const metrics = mctx.measureText("@");
      const ascent =
        metrics.fontBoundingBoxAscent || parseFloat(font.fontSize) * 0.8;
      const descent =
        metrics.fontBoundingBoxDescent || parseFloat(font.fontSize) * 0.2;
      baseline = (cellH - (ascent + descent)) / 2 + ascent;

      const total = mCols * mRows;
      mGlyph = new Uint8Array(total);
      mAlpha = new Float32Array(total);
      mDrop = new Float32Array(total);
      mGone = new Uint8Array(total);
      for (let i = 0; i < total; i += 1) {
        mGlyph[i] = (Math.random() * MATRIX_GLYPHS.length) | 0;
        mAlpha[i] = randomAlpha();
        mDrop[i] = dropAt(i % mCols);
      }

      for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < cols; x += 1) {
          const gx = x + kx;
          const gy = y + ky;
          drop[y * cols + x] =
            gx < mCols && gy < mRows ? mDrop[gy * mCols + gx] : dropAt(gx);
        }
      }

      mctx.clearRect(0, 0, width, height);
      for (let i = 0; i < total; i += 1) drawCell(i);
    };

    // Стирает клетки, чей порог перевалил прогресс растворения.
    const renderMatrix = (t) => {
      const total = mGone.length;
      for (let i = 0; i < total; i += 1) {
        if (mGone[i] || t < mDrop[i]) continue;
        mGone[i] = 1;
        drawCell(i);
      }
    };

    const mutate = () => {
      const total = mGlyph.length;
      const count = Math.round(total * MATRIX_RATE);
      for (let n = 0; n < count; n += 1) {
        const i = (Math.random() * total) | 0;
        if (mGone[i]) continue;
        mGlyph[i] = (Math.random() * MATRIX_GLYPHS.length) | 0;
        mAlpha[i] = randomAlpha();
        drawCell(i);
      }
    };

    // ---- Фазы: matrix → dissolve → play ----
    const state = { t: 0 };
    let phase = "matrix";
    let drawnFrame = -1;
    let ticker = 0;
    let tween = null;
    let timer = 0;
    const startedAt = performance.now();

    const finish = () => {
      phase = "play";
      matrix.hidden = true;
      clearInterval(ticker);
      window.removeEventListener("resize", buildMatrix);
      settledRef.current?.();
    };

    const loop = () => {
      frame = requestAnimationFrame(loop);
      const current = (video.currentTime * FPS) | 0;
      // Кадр считается разобранным только если сцена уже смонтирована:
      // <Canvas> поднимается своим корнем и готов на кадр-другой позже.
      const fresh = current !== drawnFrame && analyze();
      if (fresh) drawnFrame = current;
      if (phase === "dissolve") {
        if (drawnFrame < 0) return;
        compose(state.t);
        renderMatrix(state.t);
      } else if (fresh) {
        compose(2);
      }
    };

    const dissolve = () => {
      phase = "dissolve";
      tween = gsap.to(state, {
        t: 1,
        duration: DISSOLVE,
        ease: "power1.inOut",
        onComplete: () => {
          compose(2);
          finish();
        },
      });
      frame = requestAnimationFrame(loop);
    };

    const startLoop = () => {
      video.playbackRate = SPEED;
      video.play().catch(() => {});
      const wait = Math.max(0, MATRIX_HOLD - (performance.now() - startedAt));
      timer = window.setTimeout(dissolve, wait);
    };

    matrix.hidden = false;
    buildMatrix();
    ticker = window.setInterval(() => {
      if (phase !== "play") mutate();
    }, MATRIX_TICK);
    window.addEventListener("resize", buildMatrix);

    if (video.readyState >= 2) startLoop();
    else video.addEventListener("loadeddata", startLoop);

    return () => {
      cancelAnimationFrame(frame);
      clearInterval(ticker);
      tween?.kill();
      clearTimeout(timer);
      window.removeEventListener("resize", buildMatrix);
      video.removeEventListener("loadeddata", startLoop);
    };
  }, [cols, rows, mounted]);

// Корень R3F поднимается вручную через createRoot, а не через <Canvas>:
  // <Canvas> ради JSX-каталога делает extend(THREE) и тянет в сборку весь
  // three целиком (+57 кБ gzip на замере 07.09.2026). Здесь вся сцена — один
  // <primitive>, каталог не нужен, и three остаётся оттрясённым.
  //
  // Размер холста задаёт кадр, а его ширину — заполненный <pre>, поэтому
  // сцена поднимается не сразу, а по первому ненулевому размеру от наблюдателя.
  useEffect(() => {
    const holder = colorRef.current;
    const video = videoRef.current;
    if (!holder || !video) return undefined;

    // Холст свой на каждый подъём корня: контекст WebGL у холста один, и в
    // StrictMode второй корень занял бы контекст первого, а отложенная на
    // полсекунды уборка первого его бы и погасила.
    const canvas = document.createElement("canvas");
    canvas.style.cssText = "display:block;width:100%;height:100%";
    holder.appendChild(canvas);

    const root = createRoot(canvas);
    let cancelled = false;
    let started = false;
    let applied = "";
    let queue = Promise.resolve();

    const sync = () => {
      const rect = holder.getBoundingClientRect();
      const key = `${rect.width}x${rect.height}`;
      if (!rect.width || !rect.height || key === applied) return;
      applied = key;

      const size = { width: rect.width, height: rect.height, top: 0, left: 0 };
      queue = queue.then(async () => {
        if (cancelled) return;
        await root.configure(
          started
            ? { size }
            : {
                frameloop: "never",
                dpr: 1,
                flat: true,
                linear: true,
                size,
                gl: {
                  alpha: false,
                  antialias: false,
                  depth: false,
                  stencil: false,
                  powerPreference: "high-performance",
                },
              },
        );
        if (cancelled || started) return;
        started = true;
        root.render(
          <AsciiFilm
            video={video}
            cols={ANALYSIS_COLS}
            rows={ANALYSIS_ROWS}
            filmRef={filmRef}
          />,
        );
      });
    };

    const observer = new ResizeObserver(sync);
    observer.observe(holder);
    sync();

    return () => {
      cancelled = true;
      observer.disconnect();
      filmRef.current = null;
      root.unmount();
      canvas.remove();
    };
  }, [mounted]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (paused) video.pause();
    else video.play().catch(() => {});
  }, [paused, mounted]);

  return (
    <div
      className="ascii-video"
      ref={rootRef}
      style={{ "--cols": cols, "--rows": rows }}
      aria-hidden="true"
    >
      <div className="ascii-video__frame">
        <video
          className="ascii-video__source"
          ref={attachVideo}
          src={videoSrc}
          muted
          loop
          playsInline
          autoPlay
          preload="auto"
        />
        <div className="ascii-video__color" ref={colorRef} />
        <pre className="ascii-video__glyphs" ref={preRef}>
          {keys.map((y) => (
            <span className="ascii-video__row" key={y} />
          ))}
        </pre>
      </div>
      <canvas className="ascii-video__matrix" ref={matrixRef} hidden />
    </div>
  );
}

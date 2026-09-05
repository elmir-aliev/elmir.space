import { useLayoutEffect, useRef } from "react";
import { addTrack } from "../scroll/scrollEngine";

// Один фиксированный холст на весь экран под hero и «О себе» (у них фон
// прозрачный; у «Работ» и ниже фон свой). На холсте одна тёмная
// фигура, которая живёт три фазы:
//   1. hero закреплён на экране (SCROLL_PART — какую часть хода он мог бы
//      уезжать вверх как при обычном скролле; сейчас 0 — пользователь попросил,
//      чтобы hero не уходил, а сразу превращался в каплю); содержимое гаснет
//      (плавно, чуть уменьшаясь), а дальше страницу ведёт холст: контур из
//      точек по периметру экрана неравномерно (низ отслаивается первым, верх
//      держится дольше всех) стягивается в каплю — зеркально тому, как в
//      конце капля разрастается в страницу «Работ». Резать DOM clip-path
//      пробовали: резкий край рядом с размытым холстом смотрелся хуже, чем
//      чистый холст в конце, и пользователь попросил сделать начало как конец;
//   2. блоб висит за стеклом «О себе», пока текст проезжает мимо;
//   3. перед «Работами» всё то же зеркально: тем же контуром капля разрастается
//      обратно в страницу на весь экран, и это уже фон «Работ». Ход разрастания
//      равен ходу сжатия — его задаёт пустой пролёт .morph-gate.
// Холст низкого разрешения и размыт CSS-фильтром, поэтому фигура мягкая.
// Цветных пятен на стекле нет — по просьбе остались белый лист и блоб.

const RESOLUTION = 1 / 4;
const MAX_SIZE = 420;
// Запас холста за краями окна: размытие у края холста уходит в прозрачность,
// без запаса по периметру окна была бы кайма.
const BLEED = 80;

const PAPER = "#f3f0ea";
const INK = "#0b0b0d";

// Радиус блоба — доля меньшей стороны окна.
const BLOB_RADIUS = 0.21;
// Где блоб висит, когда курсора нет: доли окна; за время стекла сползает на
// FREE_DRIFT. С курсором блоб тянется к нему на MOUSE_PULL расстояния — тем
// сильнее, чем он круглее (пока это ещё страница, тянуть её за мышью нельзя).
const FREE_X = 0.58;
const FREE_Y = 0.5;
const FREE_DRIFT = 0.1;
const MOUSE_PULL = 0.8;
// Насколько блоб тянется за целью (0..1 за кадр) — «живая» задержка.
const FOLLOW = 0.08;
// Ход hero (q, 0..1 по лишней высоте секции сверх экрана): до SCROLL_PART
// страница просто уезжает вверх на SCROLL_PART хода в пикселях; затем содержимое
// гаснет на FADE_FROM..FADE_TO, слегка уменьшаясь до SHRINK_TO; контур начинает
// стягиваться с SHAPE_FROM, когда DOM уже почти прозрачен — иначе над стеклом
// висит призрак прямоугольника.
const SCROLL_PART = 0;
const FADE_FROM = 0;
const FADE_TO = 0.22;
// 1 — без уменьшения: пользователь читал масштаб как «hero уходит назад».
const SHRINK_TO = 1;
const SHAPE_FROM = 0.08;
// Разрастание перед «Работами» идёт по их верхнему краю: от низа пролёта
// (край на V + высота пролёта) до MERGE_END высоты окна. .6 — страница готова,
// когда «Работы» уже вошли на 40% экрана и их заголовок вот-вот покажется:
// при 1 фигура заканчивалась у нижнего края и до заголовка оставался экран
// пустого чёрного. Длина хода = .4·V + высота пролёта.
const MERGE_END = 0.6;
// «Работы» приходят снизу, поэтому и разрастание идёт вниз: в середине хода
// центр фигуры уезжает на GROW_DROP высоты окна (высота растёт на столько же,
// чтобы верх экрана всё равно закрылся), а к концу смещение возвращается в
// ноль — иначе экран закрывается раньше, чем ход закончился. Порядок
// расхождения точек контура зеркальный: первым отходит низ, верх — последним.
const GROW_DROP = 0.3;
// Контур: POINTS опорных точек по периметру. У каждой свой запуск в ход
// стягивания, и запуск меняется вдоль периметра плавно (иначе соседние точки
// разъезжаются и выходит звезда): LAG_TOP — верхние точки держатся за верхний
// край дольше всех, страница стекает с него каплей; LAG_WAVE — волна по
// периметру, чтобы стороны шли не разом; LAG_NOISE — чуть случайности.
// WOBBLE — дрожь радиуса по времени.
const POINTS = 40;
const LAG_TOP = 0.32;
const LAG_WAVE = 0.18;
const LAG_NOISE = 0.04;
const WOBBLE = 0.07;
const BREATH = 0.035;

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (v) => v * v * (3 - 2 * v);
const lerp = (a, b, t) => a + (b - a) * t;

export function MorphBackdrop() {
  const canvasRef = useRef(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const hero = document.querySelector(".hero");
    const heroInner = document.querySelector(".hero__sticky");
    const about = document.querySelector(".intro");
    const gate = document.querySelector(".morph-gate");
    const works = document.querySelector(".works");
    if (!canvas || !hero || !heroInner || !about || !gate || !works)
      return undefined;

    const ctx = canvas.getContext("2d");
    let W = 0;
    let V = 0;
    let k = 1;
    let heroTop = 0;
    let heroHeight = 1;
    let aboutHeight = 1;
    let gateHeight = 1;
    let worksTop = 0;
    // Положение блоба с задержкой: тянется к цели (свободная точка + курсор).
    const at = { x: null, y: null };
    let lastMode = "";
    let lastTransform = "";
    // Опорные точки контура: угол, запуск и параметры дрожи — фиксированы на сессию.
    const wavePhase = Math.random() * Math.PI * 2;
    const nodes = Array.from({ length: POINTS }, (_, i) => {
      const angle = (i / POINTS) * Math.PI * 2;
      const up = (1 - Math.sin(angle)) / 2; // 1 — верх экрана (y вниз)
      return {
        angle,
        lag:
          LAG_TOP * up * up * up +
          LAG_WAVE * (0.5 + 0.5 * Math.sin(2 * angle + wavePhase)) +
          LAG_NOISE * Math.random(),
        freq: 0.5 + Math.random() * 0.7,
        phase: Math.random() * Math.PI * 2,
      };
    });
    const LAG_MAX = LAG_TOP + LAG_WAVE + LAG_NOISE;
    const outline = new Array(POINTS * 3);
    const pointer = { x: 0, y: 0, on: false };
    const start = performance.now();

    const resize = () => {
      W = window.innerWidth;
      V = window.innerHeight;
      const width = W + BLEED * 2;
      const height = V + BLEED * 2;
      k = Math.min(RESOLUTION, MAX_SIZE / Math.max(width, height));
      canvas.width = Math.max(2, Math.round(width * k));
      canvas.height = Math.max(2, Math.round(height * k));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      lastMode = "";
    };

    const onMove = (event) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.on = true;
    };

    const measure = () => {
      const h = hero.getBoundingClientRect();
      heroTop = h.top;
      heroHeight = h.height || 1;
      aboutHeight = about.getBoundingClientRect().height || 1;
      gateHeight = gate.getBoundingClientRect().height || 1;
      worksTop = works.getBoundingClientRect().top;
    };

    const setHero = (shift, scale, opacity, ox, oy) => {
      const next = `${shift | 0}|${scale.toFixed(4)}|${opacity.toFixed(3)}|${ox | 0}|${oy | 0}`;
      if (next === lastTransform) return;
      lastTransform = next;
      // Сдвиг вверх — обычный скролл; масштаб — к точке блоба (в координатах
      // окна, поэтому origin компенсирует сдвиг).
      heroInner.style.transformOrigin = `${ox}px ${oy + shift}px`;
      heroInner.style.transform =
        shift === 0 && scale === 1
          ? ""
          : `translate3d(0, ${-shift}px, 0) scale(${scale})`;
      heroInner.style.opacity = opacity === 1 ? "" : String(opacity);
    };

    // Точка на периметре прямоугольника (центр cx,cy, полуразмеры hw,hh) по лучу angle.
    const onRect = (cx, cy, hw, hh, angle) => {
      const c = Math.cos(angle);
      const sn = Math.sin(angle);
      const k = Math.min(
        hw / Math.max(Math.abs(c), 1e-6),
        hh / Math.max(Math.abs(sn), 1e-6),
      );
      return [cx + c * k, cy + sn * k];
    };

    // Контур фигуры: blob 0 — прямоугольник экрана (с запасом), 1 — круг радиуса r
    // в точке (bx, by). Каждая точка идёт своим ходом (lag), плюс дрожь.
    // Возвращает сглаженный многоугольник (Catmull-Rom, по три точки на сегмент).
    const shape = (blob, bx, by, r, t, drop = 0, growing = false) => {
      const hw = W / 2 + BLEED;
      // Прямоугольник опущен на drop и на столько же выше: верх экрана закрыт.
      const hh = V / 2 + BLEED + drop;
      const rr = r;
      const pts = nodes.map((n) => {
        // На разрастании очередь точек обратная: первым отходит низ.
        const lag = growing ? LAG_MAX - n.lag : n.lag;
        const s = smooth(clamp01((blob - lag) / (1 - LAG_MAX)));
        const [rx, ry] = onRect(W / 2, V / 2 + drop, hw, hh, n.angle);
        const wob = 1 + WOBBLE * s * Math.sin(t * n.freq + n.phase);
        const cxp = bx + Math.cos(n.angle) * rr * wob;
        const cyp = by + Math.sin(n.angle) * rr * wob;
        return [lerp(rx, cxp, s), lerp(ry, cyp, s)];
      });
      const n = pts.length;
      let m = 0;
      for (let i = 0; i < n; i += 1) {
        const p0 = pts[(i - 1 + n) % n];
        const p1 = pts[i];
        const p2 = pts[(i + 1) % n];
        const p3 = pts[(i + 2) % n];
        for (let j = 1; j <= 3; j += 1) {
          const u = j / 3;
          const u2 = u * u;
          const u3 = u2 * u;
          outline[m] = [
            0.5 *
              (2 * p1[0] +
                (-p0[0] + p2[0]) * u +
                (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * u2 +
                (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * u3),
            0.5 *
              (2 * p1[1] +
                (-p0[1] + p2[1]) * u +
                (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * u2 +
                (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * u3),
          ];
          m += 1;
        }
      }
      return outline;
    };

    const draw = (time) => {
      const t = (time - start) / 1000;
      ctx.setTransform(k, 0, 0, k, BLEED * k, BLEED * k);

      // Фазы: q — ход hero по его лишней высоте, e — разрастание перед «Работами».
      const travel = Math.max(1, heroHeight - V);
      const q = clamp01(-heroTop / travel);
      // Разрастание: 0 — «Работы» ещё ниже пролёта, 1 — фигура на весь экран.
      const mergeStart = V + gateHeight;
      const e = clamp01((mergeStart - worksTop) / (mergeStart - V * MERGE_END));
      // Прогресс всего «стекла»: от начала сжатия до конца разрастания.
      const g = clamp01((-heroTop - V) / (aboutHeight + gateHeight + V));

      // Экран целиком тёмный: hero ещё не тронут, либо «Работы» его накрыли
      // (у них свой фон) и блоб уже упал.
      const mode = q <= 0 ? "hero" : e >= 1 ? "works" : "";
      if (mode) {
        setHero(0, 1, 1, 0, 0);
        if (mode !== lastMode) {
          ctx.fillStyle = INK;
          ctx.fillRect(-BLEED, -BLEED, W + BLEED * 2, V + BLEED * 2);
          lastMode = mode;
        }
        return;
      }
      lastMode = "";

      ctx.fillStyle = PAPER;
      ctx.fillRect(-BLEED, -BLEED, W + BLEED * 2, V + BLEED * 2);

      const side = Math.min(W, V);

      // Тёмная фигура.
      const r = side * BLOB_RADIUS * (1 + BREATH * Math.sin(t * 0.8));
      // Экран ↔ капля: blob = 1 — круглый, 0 — весь экран. Одна и та же кривая
      // в обе стороны: в начале стягивание, перед «Работами» разрастание.
      const blob =
        e > 0
          ? 1 - smooth(e)
          : smooth(clamp01((q - SHAPE_FROM) / (1 - SHAPE_FROM)));

      // Своё место блоба и притяжение к курсору (полное — только у круглого).
      const homeX = W * FREE_X + side * 0.04 * Math.sin(t * 0.21);
      // На разрастании блоб ещё и опускается — фигура идёт вниз, к «Работам».
      const grow = smooth(e);
      // Колокол: 0 на концах хода, максимум в середине.
      const dropY = V * GROW_DROP * 4 * grow * (1 - grow);
      const homeY = V * (FREE_Y + FREE_DRIFT * g) + V * GROW_DROP * 0.8 * grow;
      // Притяжение к курсору само гаснет вместе с blob на разрастании.
      const pull = pointer.on ? MOUSE_PULL * blob : 0;
      const toX = homeX + (pointer.x - homeX) * pull;
      const toY = homeY + (pointer.y - homeY) * pull;
      at.x = at.x === null ? toX : at.x + (toX - at.x) * FOLLOW;
      at.y = at.y === null ? toY : at.y + (toY - at.y) * FOLLOW;
      const bx = at.x;
      const by = at.y;

      const path = shape(blob, bx, by, r, t, dropY, e > 0);

      ctx.fillStyle = INK;
      ctx.beginPath();
      // Верх приходящей страницы «Работ» — тот же контур заливки, поэтому его
      // край размыт так же, как капля, и она стекает прямо в него.
      if (worksTop < V + BLEED)
        ctx.rect(-BLEED, worksTop, W + BLEED * 2, V + BLEED - worksTop);
      ctx.moveTo(path[0][0], path[0][1]);
      for (let i = 1; i < path.length; i += 1)
        ctx.lineTo(path[i][0], path[i][1]);
      ctx.closePath();
      ctx.fill();

      // hero сначала уезжает вверх, потом замирает, гаснет и чуть уменьшается
      // к точке блоба; дальше — холст.
      if (q > 0 && q < 1) {
        const shift = Math.min(q, SCROLL_PART) * travel;
        const fade = smooth(clamp01((q - FADE_FROM) / (FADE_TO - FADE_FROM)));
        setHero(shift, lerp(1, SHRINK_TO, fade), 1 - fade, bx, by);
      } else {
        setHero(q >= 1 ? SCROLL_PART * travel : 0, 1, q >= 1 ? 0 : 1, bx, by);
      }
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove, { passive: true });

    const removeTrack = addTrack({
      measure,
      render() {
        draw(performance.now());
      },
    });
    // Первый кадр до показа страницы, чтобы под hero не мигнуло белым.
    measure();
    draw(performance.now());

    return () => {
      removeTrack();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      heroInner.style.transform = "";
      heroInner.style.opacity = "";
      heroInner.style.transformOrigin = "";
    };
  }, []);

  return <canvas className="morph" ref={canvasRef} aria-hidden="true" />;
}

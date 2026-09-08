// Снимает с телефона то, что иначе видно только в Web Inspector: ошибки,
// потерю WebGL-контекста и состояние сцен по ходу прокрутки. Уходит на
// dev-сервер, читается из терминала. Только `apply: 'serve'`.
var ENDPOINT = '/__phone-log';
var queue = [];
var flushing = false;

function push(kind, data) {
  queue.push({ t: Math.round(performance.now()), kind: kind, data: data });
  if (queue.length > 200) queue.splice(0, queue.length - 200);
}

function flush() {
  if (flushing || !queue.length) return;
  flushing = true;
  var batch = queue.splice(0, queue.length);
  fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ua: navigator.userAgent, events: batch }),
    keepalive: true,
  })
    .catch(function () {})
    .finally(function () {
      flushing = false;
    });
}
setInterval(flush, 1000);
addEventListener('pagehide', flush);

// --- ошибки ---
addEventListener('error', function (e) {
  if (e.target && e.target !== window) {
    push('resource-error', { tag: e.target.tagName, src: e.target.currentSrc || e.target.src });
    return;
  }
  push('error', { msg: String(e.message), at: e.filename + ':' + e.lineno, stack: (e.error && e.error.stack || '').slice(0, 600) });
}, true);

addEventListener('unhandledrejection', function (e) {
  var r = e.reason;
  push('rejection', { msg: String(r && r.message || r), stack: (r && r.stack || '').slice(0, 600) });
});

['error', 'warn'].forEach(function (level) {
  var orig = console[level].bind(console);
  console[level] = function () {
    push('console.' + level, { args: [].map.call(arguments, function (a) { return String(a).slice(0, 300); }) });
    orig.apply(null, arguments);
  };
});

// Событие не всплывает — ловим на фазе перехвата.
['webglcontextlost', 'webglcontextcreationerror', 'webglcontextrestored'].forEach(function (type) {
  addEventListener(type, function (e) {
    push(type, { cls: e.target && e.target.className, msg: e.statusMessage || '' });
  }, true);
});

// --- разовый замер возможностей ---
function probe(tag) {
  // getContext здесь не зовём: на пустом холсте он создаст контекст, а на iOS
  // их лимит мал — зонд убил бы то, что измеряет. Живость контекста узнаём из
  // событий webglcontextlost/creationerror выше.
  var canvases = [].map.call(document.querySelectorAll('canvas'), function (c) {
    var r = c.getBoundingClientRect();
    return {
      cls: c.className,
      w: c.width, h: c.height, px: c.width * c.height,
      cssW: Math.round(r.width), cssH: Math.round(r.height),
    };
  });

  var v = document.querySelector('video');
  push('probe:' + tag, {
    vw: innerWidth, vh: innerHeight, dpr: devicePixelRatio,
    dvh: getComputedStyle(document.documentElement).getPropertyValue('--probe-dvh') || null,
    docH: document.documentElement.scrollHeight,
    canvases: canvases,
    video: v ? { paused: v.paused, readyState: v.readyState, w: v.videoWidth, h: v.videoHeight, err: v.error && v.error.code } : null,
    mem: performance.memory ? performance.memory.usedJSHeapSize : null,
  });
}
// Учитывает ли getBoundingClientRect множитель `zoom`. В Blink и в свежем
// WebKit — да, на iOS Safari нужно проверить: если нет, всякая поправка
// положения по замеру рамки внутри zoom-сцены не сходится.
function zoomProbe() {
  var el = document.querySelector('.intro__text');
  if (!el) return;
  // Замер сам ставит zoom — не лезем, если сцена уже в наезде.
  var cur = parseFloat(el.style.zoom);
  if (cur && cur !== 1) return;
  var box = el.parentElement;
  var ch = el.querySelector('.intro__char');
  var snap = function () {
    var r = el.getBoundingClientRect();
    var br = box.getBoundingClientRect();
    var cr = ch ? ch.getBoundingClientRect() : null;
    return {
      rectW: Math.round(r.width), off: el.offsetWidth,
      boxW: Math.round(br.width), boxH: Math.round(br.height),
      fs: getComputedStyle(el).fontSize,
      charW: cr ? +cr.width.toFixed(1) : null,
      charLeft: cr ? Math.round(cr.left) : null,
      docH: document.documentElement.scrollHeight,
    };
  };

  var prev = el.style.zoom;
  var before = snap();
  el.style.zoom = '4';
  el.getBoundingClientRect();
  var after = snap();
  // Кого браузер реально рисует в точке, которую накрыла бы выросшая буква.
  var probePoint = ch ? document.elementFromPoint(
    Math.min(innerWidth - 2, before.charLeft + before.charW * 2.5),
    Math.round(innerHeight / 2),
  ) : null;
  var hit = probePoint ? probePoint.className || probePoint.tagName : null;
  el.style.zoom = prev;

  push('probe:zoom', {
    before: before, after: after, hitAtGrownPoint: hit,
    supports: window.CSS && CSS.supports ? CSS.supports('zoom', '4') : null,
  });
}

addEventListener('load', function () { probe('load'); setTimeout(function () { zoomProbe(); probe('load+3s'); }, 3000); });
addEventListener('resize', function () { probe('resize'); });

// --- темп кадров ---
// Отличает «не успеваем считать» (большие промежутки между кадрами) от
// «считаем вовремя, но картинка отстаёт от нативной инерции iOS» (промежутки
// ровные, а сцена всё равно дёргается).
var frames = [];
var prevTs = 0;
(function tick(ts) {
  if (prevTs) {
    frames.push(ts - prevTs);
    if (frames.length > 120) frames.shift();
  }
  prevTs = ts;
  requestAnimationFrame(tick);
})(0);

function frameStats() {
  if (frames.length < 10) return null;
  var a = frames.slice().sort(function (x, y) { return x - y; });
  var at = function (q) { return +a[Math.floor(a.length * q)].toFixed(1); };
  return { p50: at(0.5), p95: at(0.95), max: +a[a.length - 1].toFixed(1), n: a.length };
}

// Рывок = насколько неровно меняется величина от кадра к кадру: берём вторую
// разность ряда. У гладкого движения она около нуля, у дёрганья — всплески.
function jerkStats() {
  var rows = window.__introJitter;
  if (!rows || rows.length < 12) return null;
  var out = {};
  ['scroll', 'sceneTop', 'shiftY'].forEach(function (name, col) {
    var d2 = [];
    for (var i = 2; i < rows.length; i++) {
      d2.push(Math.abs((rows[i][col] - rows[i - 1][col]) - (rows[i - 1][col] - rows[i - 2][col])));
    }
    d2.sort(function (a, b) { return a - b; });
    out[name] = {
      p50: +d2[Math.floor(d2.length * 0.5)].toFixed(2),
      p95: +d2[Math.floor(d2.length * 0.95)].toFixed(2),
      max: +d2[d2.length - 1].toFixed(2),
    };
  });
  out.n = rows.length;
  return out;
}

// --- состояние сцен по ходу прокрутки ---
var lastY = -1e9;
setInterval(function () {
  var y = scrollY;
  if (Math.abs(y - lastY) < 120) return;
  lastY = y;

  var text = document.querySelector('.intro__text');
  var zoomBox = document.querySelector('.intro__zoom');
  var ink = document.querySelector('.intro__ink');
  var scene = document.querySelector('.intro-scene');
  var r = text && text.getBoundingClientRect();

  // Что нарисовано в центре экрана. Проверка нарочно независимая: считать
  // отклонение той же формулой, что и код, бессмысленно — она покажет ноль
  // даже когда формула неверна (так и вышло 08.09.2026). elementFromPoint
  // спрашивает у движка про реальную отрисовку, и на iOS это единственный
  // честный способ узнать, попала буква в центр или уехала.
  var hit = null;
  if (text) {
    var el = document.elementFromPoint(Math.round(innerWidth / 2), Math.round(innerHeight / 2));
    if (el) {
      hit = {
        cls: el.className || el.tagName,
        ch: (el.textContent || '').slice(0, 12),
        // Совпадает ли с буквой, в которую целится наезд.
        target: el === window.__introTarget,
      };
    }
  }

  push('scroll', {
    y: Math.round(y), vh: innerHeight,
    sceneTop: scene ? Math.round(scene.getBoundingClientRect().top) : null,
    zoom: text ? text.style.zoom : null,
    hit: hit,
    fps: frameStats(),
    jerk: jerkStats(),
    cost: window.__introCost && window.__introCost.n
      ? {
          n: window.__introCost.n,
          avg: +(window.__introCost.sum / window.__introCost.n).toFixed(2),
          max: +window.__introCost.max.toFixed(2),
        }
      : null,
    shift: zoomBox ? zoomBox.style.transform : null,
    textRect: r ? { l: Math.round(r.left), t: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) } : null,
    inkOpacity: ink ? ink.style.opacity : null,
    frameVis: zoomBox ? getComputedStyle(zoomBox).visibility : null,
  });
}, 250);

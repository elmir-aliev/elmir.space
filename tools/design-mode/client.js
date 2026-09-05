const ENDPOINT = '/__design-mode';
const HOTKEY_HINT = '⌘⇧D';

const STYLE_PROPS = [
  'display', 'position', 'top', 'right', 'bottom', 'left', 'z-index',
  'width', 'height', 'max-width', 'min-height', 'box-sizing',
  'margin', 'padding', 'gap', 'overflow',
  'flex-direction', 'align-items', 'justify-content', 'flex', 'grid-template-columns',
  'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing',
  'text-transform', 'text-align', 'white-space', 'color',
  'background-color', 'background-image', 'border', 'border-radius',
  'box-shadow', 'opacity', 'filter', 'mix-blend-mode',
  'transform', 'transform-origin', 'transition', 'animation', 'will-change',
];

let active = false;
let hovered = null;
let selections = [];
let host, root, layer, panel, noteEl, statusEl, listEl;

function cssPath(el) {
  const parts = [];
  let node = el;
  while (node && node.nodeType === 1 && parts.length < 8) {
    if (node.id) {
      parts.unshift('#' + CSS.escape(node.id));
      break;
    }
    let part = node.tagName.toLowerCase();
    const cls = Array.from(node.classList).slice(0, 2);
    if (cls.length) part += '.' + cls.map((c) => CSS.escape(c)).join('.');
    const parent = node.parentElement;
    if (parent) {
      const same = Array.from(parent.children).filter((c) => c.tagName === node.tagName);
      if (same.length > 1) part += `:nth-of-type(${same.indexOf(node) + 1})`;
    }
    parts.unshift(part);
    if (node === document.body) break;
    node = parent;
  }
  return parts.join(' > ');
}

function xPath(el) {
  const parts = [];
  for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
    let i = 1;
    for (let sib = node.previousElementSibling; sib; sib = sib.previousElementSibling) {
      if (sib.tagName === node.tagName) i += 1;
    }
    parts.unshift(`${node.tagName.toLowerCase()}[${i}]`);
  }
  return '/' + parts.join('/');
}

function reactComponents(el) {
  const key = Object.keys(el).find((k) => k.startsWith('__reactFiber$'));
  if (!key) return [];
  const names = [];
  for (let fiber = el[key]; fiber && names.length < 8; fiber = fiber.return) {
    const t = fiber.type;
    let name = null;
    if (typeof t === 'function') name = t.displayName || t.name;
    else if (t && typeof t === 'object') name = t.displayName || (t.render && t.render.name);
    if (name && !names.includes(name)) names.push(name);
  }
  return names;
}

function computedStyles(el) {
  const cs = getComputedStyle(el);
  const out = {};
  for (const prop of STYLE_PROPS) {
    const v = cs.getPropertyValue(prop);
    if (v && v !== 'none' && v !== 'normal' && v !== 'auto') out[prop] = v.trim();
  }
  return out;
}

function capture(el) {
  const r = el.getBoundingClientRect();
  return {
    element: el,
    note: '',
    tag_name: el.tagName.toLowerCase(),
    text_content: (el.textContent || '').trim().slice(0, 300),
    selectors: [cssPath(el)],
    xpath: xPath(el),
    bounds: {
      x: Math.round(r.x), y: Math.round(r.y),
      width: Math.round(r.width), height: Math.round(r.height),
      top: Math.round(r.top), left: Math.round(r.left),
      bottom: Math.round(r.bottom), right: Math.round(r.right),
    },
    computed_styles: computedStyles(el),
    dom_snippet: el.outerHTML.slice(0, 2000),
    react_components: reactComponents(el),
  };
}

const CSS_TEXT = `
:host { all: initial; }
.layer { position: fixed; inset: 0; pointer-events: none; z-index: 2147483646; }
.box { position: fixed; border: 1px solid #4f9dff; background: rgba(79,157,255,.14); pointer-events: none; }
.box.picked { border-color: #ffb454; background: rgba(255,180,84,.12); }
.tag { position: fixed; transform: translateY(-100%); font: 11px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
       background: #4f9dff; color: #06121f; padding: 1px 5px; border-radius: 3px 3px 0 0; white-space: nowrap; pointer-events: none; }
.tag.picked { background: #ffb454; }
.panel { position: fixed; right: 16px; bottom: 16px; width: 340px; z-index: 2147483647;
         background: #10141a; color: #e6edf3; border: 1px solid #2b333d; border-radius: 10px;
         box-shadow: 0 16px 48px rgba(0,0,0,.5); font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
         display: flex; flex-direction: column; overflow: hidden; }
.head { display: flex; align-items: center; justify-content: space-between; gap: 8px;
        padding: 8px 10px; border-bottom: 1px solid #2b333d; color: #8b98a5; }
.head b { color: #ffb454; font-weight: 600; }
.list { max-height: min(460px, calc(100vh - 240px)); overflow-y: auto; }
.row { display: flex; gap: 8px; padding: 8px 10px; border-bottom: 1px solid #1c232c; }
.idx { flex: none; width: 18px; height: 18px; border-radius: 4px; background: #ffb454; color: #06121f;
       display: grid; place-items: center; font-size: 10px; font-weight: 700; }
.meta { flex: 1; min-width: 0; }
.sel { color: #7ee2b8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cmp { color: #8b98a5; font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.row input, .note { width: 100%; margin-top: 4px; background: #0a0d11; color: #e6edf3;
       border: 1px solid #2b333d; border-radius: 5px; padding: 4px 6px; font: inherit; resize: vertical; }
.row input:focus, .note:focus { outline: none; border-color: #4f9dff; }
.del { flex: none; background: none; border: none; color: #5a6672; cursor: pointer; font-size: 14px; padding: 0 2px; }
.del:hover { color: #ff6b6b; }
.foot { padding: 8px 10px; display: flex; flex-direction: column; gap: 8px; }
.note { min-height: 52px; }
.send { background: #4f9dff; color: #06121f; border: none; border-radius: 6px; padding: 7px;
        font: inherit; font-weight: 700; cursor: pointer; }
.send:hover { background: #6cadff; }
.send:disabled { background: #2b333d; color: #5a6672; cursor: default; }
.empty { padding: 14px 10px; color: #5a6672; text-align: center; }
.status { color: #7ee2b8; min-height: 16px; }
`;

function mount() {
  host = document.createElement('div');
  host.setAttribute('data-design-mode', '');
  root = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = CSS_TEXT;
  root.append(style);

  layer = document.createElement('div');
  layer.className = 'layer';

  panel = document.createElement('div');
  panel.className = 'panel';
  panel.innerHTML = `
    <div class="head"><span><b>Дизайн мод</b> — кликай по элементам</span><span>${HOTKEY_HINT}</span></div>
    <div class="list"></div>
    <div class="foot">
      <textarea class="note" placeholder="Общее замечание (необязательно)"></textarea>
      <button class="send">Отправить агенту  ⌘↩</button>
      <div class="status"></div>
    </div>`;

  listEl = panel.querySelector('.list');
  noteEl = panel.querySelector('.note');
  statusEl = panel.querySelector('.status');
  panel.querySelector('.send').addEventListener('click', send);

  root.append(layer, panel);
  document.documentElement.append(host);
}

function drawBox(rect, label, picked) {
  const box = document.createElement('div');
  box.className = 'box' + (picked ? ' picked' : '');
  Object.assign(box.style, {
    top: rect.top + 'px', left: rect.left + 'px',
    width: rect.width + 'px', height: rect.height + 'px',
  });
  const tag = document.createElement('div');
  tag.className = 'tag' + (picked ? ' picked' : '');
  tag.textContent = label;
  Object.assign(tag.style, { top: rect.top + 'px', left: rect.left + 'px' });
  layer.append(box, tag);
}

// Рамки перерисовываются на каждое наведение и прокрутку, список — только когда
// меняется набор выбранных элементов: иначе пересборка строк сбрасывает прокрутку
// списка и фокус в поле замечания.
function renderBoxes() {
  layer.replaceChildren();
  selections.forEach((s, i) => {
    const r = s.element.getBoundingClientRect();
    drawBox(r, `${i + 1} · ${s.tag_name}`, true);
  });
  if (hovered && !selections.some((s) => s.element === hovered)) {
    drawBox(hovered.getBoundingClientRect(), cssPath(hovered), false);
  }
}

function render() {
  renderBoxes();

  if (!selections.length) {
    listEl.innerHTML = '<div class="empty">Ни одного элемента не выбрано</div>';
  } else {
    listEl.replaceChildren(...selections.map((s, i) => {
      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = `
        <div class="idx">${i + 1}</div>
        <div class="meta">
          <div class="sel">${s.selectors[0]}</div>
          <div class="cmp">${s.react_components.slice(0, 3).join(' ‹ ') || s.tag_name}</div>
          <input placeholder="Замечание к этому элементу">
        </div>
        <button class="del" title="Убрать">×</button>`;
      const input = row.querySelector('input');
      input.value = s.note;
      input.addEventListener('input', () => { s.note = input.value; });
      row.querySelector('.del').addEventListener('click', () => {
        selections.splice(i, 1);
        render();
      });
      return row;
    }));
  }
}

const insideOverlay = (e) => e.composedPath().includes(host);

function onMove(e) {
  if (!active || insideOverlay(e)) return;
  const el = e.target;
  if (el !== hovered) { hovered = el; renderBoxes(); }
}

function onClick(e) {
  if (!active || insideOverlay(e)) return;
  e.preventDefault();
  e.stopPropagation();
  const el = e.target;
  const existing = selections.findIndex((s) => s.element === el);
  if (existing >= 0) selections.splice(existing, 1);
  else selections.push(capture(el));
  render();
}

function swallow(e) {
  if (active && !insideOverlay(e)) { e.preventDefault(); e.stopPropagation(); }
}

function onKey(e) {
  if (e.metaKey && e.shiftKey && e.code === 'KeyD') {
    e.preventDefault();
    toggle();
    return;
  }
  if (!active) return;
  if (e.key === 'Escape') { e.preventDefault(); toggle(false); }
  if (e.metaKey && e.key === 'Enter') { e.preventDefault(); send(); }
}

function toggle(next = !active) {
  active = next;
  host.style.display = active ? '' : 'none';
  document.body.style.cursor = active ? 'crosshair' : '';
  if (active) render();
  else { hovered = null; }
}

function buildPrompt(general) {
  const prompt = [];
  selections.forEach((s, i) => {
    prompt.push({ selection: i });
    if (s.note.trim()) prompt.push({ text: s.note.trim() });
  });
  if (general.trim()) prompt.push({ text: general.trim() });
  return prompt;
}

async function send() {
  const general = noteEl.value;
  if (!selections.length && !general.trim()) {
    statusEl.textContent = 'Пусто — выбери элемент или напиши текст';
    return;
  }
  const payload = {
    page_url: location.href,
    timestamp: new Date().toISOString(),
    viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
    prompt: buildPrompt(general),
    requested_change: [...selections.map((s) => s.note.trim()).filter(Boolean), general.trim()]
      .filter(Boolean).join('\n'),
    selections: selections.map(({ element, note, ...rest }) => ({ ...rest, note })),
  };
  statusEl.textContent = 'Отправляю…';
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await res.text());
    const { file } = await res.json();
    statusEl.textContent = 'Отправлено → ' + String(file).split('/').pop();
    selections = [];
    noteEl.value = '';
    render();
    setTimeout(() => { if (statusEl.textContent.startsWith('Отправлено')) statusEl.textContent = ''; }, 4000);
  } catch (err) {
    statusEl.textContent = 'Ошибка: ' + err.message;
  }
}

function init() {
  mount();
  toggle(false);
  addEventListener('keydown', onKey, true);
  addEventListener('mouseover', onMove, true);
  addEventListener('click', onClick, true);
  addEventListener('mousedown', swallow, true);
  addEventListener('mouseup', swallow, true);
  addEventListener('scroll', (e) => active && !insideOverlay(e) && renderBoxes(), true);
  addEventListener('resize', () => active && renderBoxes());
  console.info(`[design-mode] ${HOTKEY_HINT} — включить режим замечаний`);
}

if (document.body) init();
else addEventListener('DOMContentLoaded', init);

import * as THREE from 'three';

/**
 * Рисует «страницу», которая потом сгорает в шейдере.
 * Сделано на canvas, чтобы сцена работала без внешних ассетов —
 * если нужна своя картинка, передайте BurnSection проп `src`.
 */
export function createPageTexture({ width = 1800, height = 1125 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  const pad = width * 0.075;

  const background = ctx.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, '#141416');
  background.addColorStop(0.55, '#0d0d0f');
  background.addColorStop(1, '#17120f');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  // Разметочная сетка
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 6; i += 1) {
    const x = pad + ((width - pad * 2) / 6) * i;
    ctx.beginPath();
    ctx.moveTo(x, pad);
    ctx.lineTo(x, height - pad);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.strokeRect(pad, pad, width - pad * 2, height - pad * 2);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.font = `500 ${width * 0.016}px "Inter", system-ui, sans-serif`;
  ctx.fillText('SELECTED WORK — 2024 / 2026', pad + 28, pad + 62);

  ctx.fillStyle = '#f5f2ec';
  ctx.font = `700 ${width * 0.115}px "Inter", system-ui, sans-serif`;
  ctx.fillText('ПОРТФОЛИО', pad + 20, height * 0.42);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.font = `400 ${width * 0.022}px "Inter", system-ui, sans-serif`;
  ctx.fillText('Фронтенд, интерфейсы и графика в вебе', pad + 28, height * 0.5);

  // Ряд карточек-плейсхолдеров
  const cardTop = height * 0.6;
  const cardHeight = height * 0.24;
  const gap = width * 0.025;
  const cardWidth = (width - pad * 2 - gap * 2) / 3;

  ['Three.js', 'React', 'Motion'].forEach((label, index) => {
    const x = pad + (cardWidth + gap) * index;

    const card = ctx.createLinearGradient(x, cardTop, x + cardWidth, cardTop + cardHeight);
    card.addColorStop(0, index === 1 ? 'rgba(255, 108, 32, 0.28)' : 'rgba(255, 255, 255, 0.09)');
    card.addColorStop(1, 'rgba(255, 255, 255, 0.02)');
    ctx.fillStyle = card;
    ctx.fillRect(x, cardTop, cardWidth, cardHeight);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.strokeRect(x, cardTop, cardWidth, cardHeight);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = `500 ${width * 0.018}px "Inter", system-ui, sans-serif`;
    ctx.fillText(label, x + 24, cardTop + cardHeight - 28);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

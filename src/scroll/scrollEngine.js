import Lenis from "lenis";

const tracks = new Set();

let lenis = null;
let frameId = 0;
let users = 0;

function frame(time) {
  lenis?.raf(time);

  for (const track of tracks) track.measure();
  for (const track of tracks) track.render();

  frameId = requestAnimationFrame(frame);
}

export function startScrollEngine(options = {}) {
  users += 1;

  if (users === 1) {
    lenis = new Lenis({
      duration: 1.1,
      easing: (t) => 1 - Math.pow(1 - t, 4),
      touchMultiplier: 1.4,
      ...options,
    });
    // Для проверок в playwright: window.scrollTo Lenis доводит инерцией,
    // точную позицию даёт только lenis.scrollTo(y, { immediate: true }).
    if (import.meta.env.DEV) window.__lenis = lenis;
    frameId = requestAnimationFrame(frame);
  }

  return () => {
    users -= 1;
    if (users > 0) return;

    cancelAnimationFrame(frameId);
    frameId = 0;
    lenis?.destroy();
    lenis = null;
  };
}

export function getLenis() {
  return lenis;
}

export function addTrack(track) {
  tracks.add(track);
  return () => tracks.delete(track);
}

export function scrollTo(target, options = {}) {
  if (lenis) {
    lenis.scrollTo(target, { offset: 0, ...options });
    return;
  }

  const node =
    typeof target === "string" ? document.querySelector(target) : target;
  node?.scrollIntoView({ behavior: "smooth" });
}

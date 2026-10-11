import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { flowerVertex, flowerFragment, flowerDisplay } from '../three/flowerShaders';

export function HeroFlowers() {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
    } catch {
      return undefined;
    }
    const geometry = new THREE.PlaneGeometry(2, 2);
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 10);
    const targets = [new THREE.WebGLRenderTarget(1, 1), new THREE.WebGLRenderTarget(1, 1)];
    const material = new THREE.ShaderMaterial({
      vertexShader: flowerVertex,
      fragmentShader: flowerFragment,
      uniforms: {
        u_ratio: { value: 1 },
        u_cursor: { value: new THREE.Vector2() },
        u_stop_time: { value: 0 },
        u_stop_randomizer: { value: new THREE.Vector2() },
        u_texture: { value: null },
      },
    });
    const display = new THREE.ShaderMaterial({
      vertexShader: flowerVertex,
      fragmentShader: flowerDisplay,
      uniforms: { u_texture: { value: null } },
    });
    const scene = new THREE.Scene();
    const output = new THREE.Scene();
    scene.add(new THREE.Mesh(geometry, material));
    output.add(new THREE.Mesh(geometry, display));
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let last = 0;
    let elapsed = 0;
    let visible = true;
    let completed = false;
    let width = 0;
    let height = 0;
    let flowerMode = null;
    let flowers = [];
    const duration = 1.15;

    const createFlowers = (mobile) => {
      const count = mobile
        ? 3 + Math.floor(Math.random() * 2)
        : 5 + Math.floor(Math.random() * 3);
      const minGap = mobile ? .18 : .1;
      const positions = [];

      for (let index = 0; index < count; index += 1) {
        let x = .08 + Math.random() * .84;
        let attempts = 0;
        while (positions.some((position) => Math.abs(position - x) < minGap) && attempts < 24) {
          x = .08 + Math.random() * .84;
          attempts += 1;
        }
        positions.push(x);
      }

      return positions.map((x) => [
        x,
        (mobile ? .29 : .27) + Math.random() * (mobile ? .2 : .24),
        Math.random(),
        Math.random(),
      ]);
    };

    const draw = (index, time) => {
      const [x, y, a, b] = flowers[index];
      material.uniforms.u_cursor.value.set(x, y);
      material.uniforms.u_stop_randomizer.value.set(a, b);
      material.uniforms.u_stop_time.value = time;
      material.uniforms.u_texture.value = targets[0].texture;
      renderer.setRenderTarget(targets[1]);
      renderer.render(scene, camera);
      display.uniforms.u_texture.value = targets[1].texture;
      renderer.setRenderTarget(null);
      renderer.render(output, camera);
      targets.reverse();
    };
    const tick = (now) => {
      frame = 0;
      if (!visible || document.hidden || completed) return;
      elapsed += last ? Math.min((now - last) / 1000, .04) : 0;
      last = now;
      const index = Math.floor(elapsed / duration);
      if (index >= flowers.length) { completed = true; return; }
      draw(index, elapsed % duration);
      frame = requestAnimationFrame(tick);
    };
    const start = () => {
      cancelAnimationFrame(frame);
      last = 0;
      if (motion.matches) {
        for (let i = 0; i < flowers.length; i += 1) {
          for (let t = 0; t < 60; t += 1) draw(i, t / 60);
        }
        completed = true;
      } else if (visible && !document.hidden) frame = requestAnimationFrame(tick);
    };
    const resize = () => {
      const box = canvas.parentElement.getBoundingClientRect();
      const w = Math.round(box.width);
      const h = Math.round(box.height);
      if (w === width && h === height) return;
      width = w; height = h;
      const mobile = w < 768;
      if (flowerMode !== mobile) {
        flowerMode = mobile;
        flowers = createFlowers(mobile);
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1 : 1.5));
      renderer.setSize(w, h, false);
      material.uniforms.u_ratio.value = w / h;
      for (const target of targets) {
        target.setSize(Math.round(w * renderer.getPixelRatio()), Math.round(h * renderer.getPixelRatio()));
        renderer.setRenderTarget(target);
        renderer.clear();
      }
      renderer.setRenderTarget(null);
      elapsed = 0; completed = false;
      start();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas.parentElement);
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !completed && !motion.matches) start();
      else { cancelAnimationFrame(frame); last = 0; }
    });
    intersection.observe(canvas);
    const visibility = () => {
      if (document.hidden) { cancelAnimationFrame(frame); last = 0; }
      else if (!completed && !motion.matches) start();
    };
    const preference = () => {
      elapsed = 0; completed = false;
      for (const target of targets) { renderer.setRenderTarget(target); renderer.clear(); }
      renderer.setRenderTarget(null);
      start();
    };
    document.addEventListener('visibilitychange', visibility);
    motion.addEventListener('change', preference);
    resize();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect(); intersection.disconnect();
      document.removeEventListener('visibilitychange', visibility);
      motion.removeEventListener('change', preference);
      geometry.dispose(); material.dispose(); display.dispose();
      targets.forEach(target => target.dispose());
      renderer.dispose();
    };
  }, []);

  return <canvas ref={ref} className="hero-flowers" aria-hidden="true" />;
}

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { addTrack } from '../scroll/scrollEngine';
import { fragmentShader, vertexShader } from '../three/ironhillShaders';

const CONFIG = {
  color: '#ffffff',
  spread: 0.5,
  speed: 2,
};

export function IronhillWipe({ heroRef }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const hero = heroRef.current;
    if (!canvas || !hero) return undefined;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
    } catch {
      return undefined;
    }

    canvas.style.opacity = '0';

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geometry = new THREE.PlaneGeometry(2, 2);
    const color = new THREE.Color(CONFIG.color);
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uProgress: { value: 0 },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uColor: { value: new THREE.Vector3(color.r, color.g, color.b) },
        uSpread: { value: CONFIG.spread },
      },
    });
    scene.add(new THREE.Mesh(geometry, material));

    let heroTop = 0;
    let maxScroll = 1;
    let progress = -1;

    const resize = () => {
      const width = hero.offsetWidth;
      const height = hero.offsetHeight;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(width, height, false);
      material.uniforms.uResolution.value.set(width, height);
      renderer.render(scene, camera);
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(hero);
    resize();

    const removeTrack = addTrack({
      measure() {
        const rect = hero.getBoundingClientRect();
        heroTop = rect.top;
        maxScroll = Math.max(1, rect.height - window.innerHeight);
      },
      render() {
        const next = Math.min(Math.max((-heroTop / maxScroll) * CONFIG.speed, 0), 1.1);
        if (Math.abs(next - progress) < 0.0001) return;
        progress = next;
        material.uniforms.uProgress.value = progress;
        const visibleProgress = Math.min(Math.max((progress - 0.4) / 0.15, 0), 1);
        canvas.style.opacity = `${visibleProgress * visibleProgress * (3 - 2 * visibleProgress)}`;
        renderer.render(scene, camera);
      },
    });

    return () => {
      removeTrack();
      resizeObserver.disconnect();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, [heroRef]);

  return <canvas ref={canvasRef} className="hero-canvas" aria-hidden="true" />;
}

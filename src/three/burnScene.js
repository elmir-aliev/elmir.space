import * as THREE from 'three';
import { burnVertexShader, burnFragmentShader } from './burnShader';
import { createPageTexture } from './pageTexture';

/**
 * Полноэкранный quad с шейдером выгорания.
 * Класс намеренно ничего не знает про React: наружу торчат setProgress,
 * resize, render и dispose — компонент только дёргает их в нужный момент.
 */
export class BurnScene {
  constructor(canvas, { src, smoothing = 0.12 } = {}) {
    this.smoothing = smoothing;
    this.target = 0;
    this.progress = 0;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setClearAlpha(0);

    this.scene = new THREE.Scene();
    // Для fullscreen-квада проекция не нужна — вершины уже в клип-пространстве
    this.camera = new THREE.Camera();

    this.texture = src ? new THREE.TextureLoader().load(src, (loaded) => this.applyTextureSize(loaded)) : createPageTexture();
    this.texture.colorSpace = THREE.SRGBColorSpace;

    this.geometry = new THREE.PlaneGeometry(2, 2);
    this.material = new THREE.ShaderMaterial({
      vertexShader: burnVertexShader,
      fragmentShader: burnFragmentShader,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uTexture: { value: this.texture },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uTexResolution: { value: new THREE.Vector2(1600, 1000) },
        uProgress: { value: 0 },
        uTime: { value: 0 },
      },
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);

    this.applyTextureSize(this.texture);
    this.resize();
  }

  applyTextureSize(texture) {
    const image = texture?.image;
    if (!image?.width || !image?.height) return;
    this.material.uniforms.uTexResolution.value.set(image.width, image.height);
  }

  setProgress(value) {
    this.target = value;
  }

  resize() {
    const canvas = this.renderer.domElement;
    const width = canvas.clientWidth || 1;
    const height = canvas.clientHeight || 1;

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height, false);
    this.material.uniforms.uResolution.value.set(width, height);
  }

  render(elapsed) {
    // Догоняем целевое значение — Lenis сглаживает скролл, а это сглаживает сам эффект
    const ease = this.smoothing >= 1 ? 1 : this.smoothing;
    this.progress += (this.target - this.progress) * ease;

    this.material.uniforms.uProgress.value = this.progress;
    this.material.uniforms.uTime.value = elapsed;
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
    this.renderer.dispose();
  }
}

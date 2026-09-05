import * as THREE from "three";
import { burnVertexShader, burnFragmentShader } from "./burnShader";
import { createPageTexture } from "./pageTexture";

// Длинная сторона нарисованной страницы в пикселях текстуры.
const PAGE_SIZE = 1800;

export class BurnScene {
  constructor(canvas, { src, smoothing = 0.12 } = {}) {
    this.smoothing = smoothing;
    this.target = 0;
    this.progress = 0;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
      powerPreference: "high-performance",
    });
    this.renderer.setClearAlpha(0);

    this.scene = new THREE.Scene();
    this.camera = new THREE.Camera();

    // Без src страница рисуется на canvas под пропорции самого холста (см. resize):
    // на телефоне в портрете иначе от «страницы» оставался бы вырезанный центр.
    this.generated = !src;
    this.texture = src
      ? new THREE.TextureLoader().load(src, (loaded) =>
          this.applyTextureSize(loaded),
        )
      : null;
    if (this.texture) this.texture.colorSpace = THREE.SRGBColorSpace;

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
    if (this.generated) this.fitPageTexture(width, height);
  }

  fitPageTexture(width, height) {
    const size =
      width >= height
        ? { width: PAGE_SIZE, height: Math.round((PAGE_SIZE * height) / width) }
        : {
            width: Math.round((PAGE_SIZE * width) / height),
            height: PAGE_SIZE,
          };

    const image = this.texture?.image;
    if (
      image &&
      Math.abs(image.width / image.height - size.width / size.height) < 0.02
    )
      return;

    this.texture?.dispose();
    this.texture = createPageTexture(size);
    // Без этого three считает текстуру sRGB и переводит её в linear, а обратно
    // на выходе не переводит: страница выходила почти чёрной (замер: 11,11,13
    // в CSS → 1,1,1 на экране) и читалась как тёмный прямоугольник поверх секции.
    this.texture.colorSpace = THREE.NoColorSpace;
    this.material.uniforms.uTexture.value = this.texture;
    this.applyTextureSize(this.texture);
  }

  render(elapsed) {
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
    this.texture?.dispose();
    this.renderer.dispose();
  }
}

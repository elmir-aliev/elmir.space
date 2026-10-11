import * as THREE from "three";
import {
  BLUR_RADIUS,
  LIFT,
  SATURATE,
  SHARPEN,
  analysisFragmentShader,
  blurFragmentShader,
  displayFragmentShader,
  quadVertexShader,
  sharpenFragmentShader,
} from "./asciiShaders";

const TAPS = 8;

function target(width, height, filter) {
  return new THREE.WebGLRenderTarget(width, height, {
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    colorSpace: THREE.NoColorSpace,
    minFilter: filter,
    magFilter: filter,
    depthBuffer: false,
    stencilBuffer: false,
  });
}

function material(fragmentShader, uniforms, defines) {
  return new THREE.ShaderMaterial({
    vertexShader: quadVertexShader,
    fragmentShader,
    uniforms,
    defines,
    depthTest: false,
    depthWrite: false,
  });
}

export function createAsciiPasses(video, cols, rows) {
  const analysis = target(cols, rows, THREE.NearestFilter);
  const blur = target(cols, rows, THREE.NearestFilter);
  const slots = [0, 1].map(() => ({
    frame: target(cols, rows, THREE.LinearFilter),
    pixels: new Uint8Array(cols * rows * 4),
    pending: false,
  }));
  let index = 0;
  let ready = null;
  const texture = new THREE.VideoTexture(video);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.NoColorSpace;
  const texel = new THREE.Vector2(1 / cols, 1 / rows);
  const materials = {
    analysis: material(
      analysisFragmentShader,
      {
        uVideo: { value: texture },
        uSource: { value: new THREE.Vector2(1, 1) },
        uTarget: { value: new THREE.Vector2(cols, rows) },
      },
      { TAPS },
    ),
    blur: material(
      blurFragmentShader,
      { uSource: { value: analysis.texture }, uTexel: { value: texel } },
      { RADIUS: BLUR_RADIUS },
    ),
    sharpen: material(
      sharpenFragmentShader,
      {
        uAnalysis: { value: analysis.texture },
        uBlur: { value: blur.texture },
        uTexel: { value: texel },
      },
      { RADIUS: BLUR_RADIUS, SHARPEN: SHARPEN.toFixed(4) },
    ),
    display: material(
      displayFragmentShader,
      { uAnalysis: { value: null } },
      { SATURATE: SATURATE.toFixed(4), LIFT: LIFT.toFixed(4) },
    ),
  };
  const geometry = new THREE.PlaneGeometry(2, 2);
  const mesh = new THREE.Mesh(geometry, materials.display);
  mesh.frustumCulled = false;
  let disposed = false;
  return {
    mesh,
    analyze(renderer, scene, camera) {
      if (!video.videoWidth) return null;
      const write = slots[index];
      if (!write.pending) {
        materials.analysis.uniforms.uSource.value.set(
          video.videoWidth,
          video.videoHeight,
        );
        mesh.material = materials.analysis;
        renderer.setRenderTarget(analysis);
        renderer.render(scene, camera);

        mesh.material = materials.blur;
        renderer.setRenderTarget(blur);
        renderer.render(scene, camera);
        mesh.material = materials.sharpen;
        renderer.setRenderTarget(write.frame);
        renderer.render(scene, camera);
        renderer.setRenderTarget(null);
        write.pending = true;
        renderer
          .readRenderTargetPixelsAsync(
            write.frame,
            0,
            0,
            cols,
            rows,
            write.pixels,
          )
          .then(() => {
            if (disposed) return;
            write.pending = false;
            
            ready = write;
            index = 1 - index;
          })
          .catch(() => {
            write.pending = false;
          });
      }

      if (!ready) return null;

      materials.display.uniforms.uAnalysis.value = ready.frame.texture;
      mesh.material = materials.display;
      renderer.setRenderTarget(null);
      renderer.render(scene, camera);
      return ready.pixels;
    },
    dispose() {
      disposed = true;
      analysis.dispose();
      blur.dispose();
      for (const slot of slots) slot.frame.dispose();
      texture.dispose();
      geometry.dispose();
      for (const item of Object.values(materials)) item.dispose();
    },
  };
}
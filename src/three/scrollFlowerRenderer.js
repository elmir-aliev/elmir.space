import * as THREE from 'three';
import { flowerVertex, flowerFragment } from './flowerShaders';

const FPS = 60;
const PETAL_START_STEP = 14;
const PETAL_END_STEP = 59;
// In the hero the stem is drawn during the first ~0.2 s, then the petals open.
// The scroll vine already supplies the stem, so we replay only the exact petal
// phase of the same shader instead of drawing a second little stem inside the flower.
const PETAL_DURATION = (PETAL_END_STEP - PETAL_START_STEP) / FPS;

// The scroll flowers deliberately use the very same feedback shader and timing as
// HeroFlowers. The only extra work here is cropping/rotating the accumulated
// texture so a hero flower can sit on a branch instead of filling the whole hero.
export function createScrollFlowerRenderer(canvas, flowers, flowerCanvases) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: false,
    preserveDrawingBuffer: true,
  });
  renderer.setClearColor(0, 0);
  renderer.autoClear = false;

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const geometry = new THREE.PlaneGeometry(2, 2);

  const grow = new THREE.ShaderMaterial({
    vertexShader: flowerVertex,
    fragmentShader: flowerFragment,
    uniforms: {
      u_ratio: { value: 1 },
      u_cursor: { value: new THREE.Vector2(.5, .5) },
      u_stop_time: { value: 0 },
      u_stop_randomizer: { value: new THREE.Vector2() },
      u_texture: { value: null },
    },
  });

  // Keep the blossom's RGB grading identical to `flowerDisplay` from the hero.
  // The only difference is alpha: the hero sits on #0f1115 and can output black
  // outside the flower, while this canvas floats over a light section.  We make
  // ONLY those near-black background pixels transparent; the visible flower is
  // otherwise the same icy-blue image, with the same soft feedback edge.
  const display = new THREE.ShaderMaterial({
    vertexShader: flowerVertex,
    fragmentShader: `
      uniform sampler2D u_texture;
      uniform float u_extent;
      uniform float u_angle;
      varying vec2 vUv;

      void main() {
        vec2 p = vUv - .5;
        float c = cos(u_angle), s = sin(u_angle);
        p = mat2(c, -s, s, c) * p;

        vec3 raw = texture2D(u_texture, .5 + p * u_extent).rgb;
        float light = dot(raw, vec3(.30,.38,.32));

        // Use the SAME luminance structure as flowerDisplay in the hero:
        // the feedback texture itself controls every highlight / overlap instead
        // of flattening the whole blossom to one solid tint.  The base hue is
        // the stem core colour so the flower still belongs to the scroll vine.
        vec3 stemCore = vec3(146.0, 174.0, 200.0) / 255.0; // #92aec8
        float petalMask = smoothstep(.010, .052, light);
        float layer = smoothstep(.030, .58, light);
        vec3 blossom = stemCore * min(1.38, light * 1.28);

        // The hero is rendered on a dark background, while this canvas floats
        // above a light section. Make only the empty / very dark feedback
        // transparent. Soft petals remain translucent and overlaps become denser,
        // which keeps the hero-like glassy layers without a dark fringe.
        float alpha = petalMask * mix(.24, .78, layer);
        if (alpha < .008) discard;
        gl_FragColor = vec4(blossom, alpha);
      }
    `,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      u_texture: { value: null },
      u_extent: { value: .3 },
      u_angle: { value: 0 },
    },
  });

  const growScene = new THREE.Scene();
  const output = new THREE.Scene();
  growScene.add(new THREE.Mesh(geometry, grow));
  output.add(new THREE.Mesh(geometry, display));

  const states = flowers.map(() => ({
    step: PETAL_START_STEP,
    drawnStep: -1,
    drawnAngle: null,
    activatedAt: null,
    wasActive: false,
    targets: [
      new THREE.WebGLRenderTarget(256, 256),
      new THREE.WebGLRenderTarget(256, 256),
    ],
  }));

  const outputSize = 256;
  renderer.setPixelRatio(1);
  renderer.setSize(outputSize, outputSize, false);

  function clearState(state) {
    renderer.setScissorTest(false);
    for (const target of state.targets) {
      renderer.setRenderTarget(target);
      renderer.clear();
    }
    renderer.setRenderTarget(null);
    state.step = PETAL_START_STEP;
    state.drawnStep = -1;
    state.drawnAngle = null;
  }

  states.forEach(clearState);

  return {
    draw(placements, progress, reducedMotion = false) {
      renderer.setRenderTarget(null);
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, outputSize, outputSize);

      const now = performance.now();
      // A flower that was covered by the Friz card used to replay all missed
      // feedback frames synchronously when it became visible again. Spread that
      // work across RAFs instead of blocking one scroll frame.
      let feedbackBudget = reducedMotion ? Number.POSITIVE_INFINITY : 8;

      placements.forEach((box, index) => {
        if (!box) return;

        const flower = flowers[index];
        const state = states[index];
        const activeAt = flower.bloomProgress ?? flower.progress;
        const active = progress >= activeAt;

        if (!active) {
          // Reset on the very first frame above the bloom threshold. The old
          // hysteresis cleared `wasActive` before the reset point was reached,
          // so a second downward pass reused the old timestamp and the flower
          // snapped open. Resetting the feedback state here guarantees the same
          // hero-style opening animation every time the user scrolls down again.
          if (state.activatedAt !== null) {
            clearState(state);
            const flowerCanvas = flowerCanvases[index];
            flowerCanvas?.getContext('2d')?.clearRect(0, 0, flowerCanvas.width, flowerCanvas.height);
            state.activatedAt = null;
          }
          state.wasActive = false;
          return;
        }

        if (state.activatedAt === null) {
          clearState(state);
          state.activatedAt = now;
        }
        state.wasActive = true;

        const elapsed = reducedMotion
          ? PETAL_DURATION
          : Math.min(PETAL_DURATION, (now - state.activatedAt) / 1000);
        const desired = reducedMotion
          ? PETAL_END_STEP
          : Math.min(
              PETAL_END_STEP,
              PETAL_START_STEP + 1 + Math.floor(elapsed * FPS),
            );

        grow.uniforms.u_stop_randomizer.value.set(...flower.seed);

        while (state.step < desired && feedbackBudget > 0) {
          state.step += 1;
          feedbackBudget -= 1;
          grow.uniforms.u_stop_time.value = state.step / FPS;
          grow.uniforms.u_texture.value = state.targets[0].texture;

          renderer.setScissorTest(false);
          renderer.setRenderTarget(state.targets[1]);
          renderer.clear();
          renderer.render(growScene, camera);
          state.targets.reverse();
        }

        const flowerCanvas = flowerCanvases[index];
        if (!flowerCanvas || (
          state.drawnStep === state.step
          && state.drawnAngle === box.angle
        )) return;

        renderer.setRenderTarget(null);
        renderer.setViewport(0, 0, outputSize, outputSize);
        renderer.clear();
        display.uniforms.u_texture.value = state.targets[0].texture;
        display.uniforms.u_extent.value = (.03 + flower.seed[0] * .1) * 2.8;
        display.uniforms.u_angle.value = box.angle;
        renderer.render(output, camera);

        const context = flowerCanvas.getContext('2d');
        context.clearRect(0, 0, flowerCanvas.width, flowerCanvas.height);
        context.drawImage(canvas, 0, 0, flowerCanvas.width, flowerCanvas.height);
        state.drawnStep = state.step;
        state.drawnAngle = box.angle;
      });

      renderer.setScissorTest(false);
    },

    invalidate() {
      states.forEach((state) => {
        state.drawnStep = -1;
        state.drawnAngle = null;
      });
    },

    dispose() {
      states.forEach((state) => state.targets.forEach((target) => target.dispose()));
      grow.dispose();
      display.dispose();
      geometry.dispose();
      renderer.dispose();
    },
  };
}

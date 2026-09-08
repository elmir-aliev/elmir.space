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

// Сколько выборок на клетку берёт даунскейл. Сетка разбора сплюснута по
// вертикали (в ROW_RATIO зашита пропорция знака), поэтому на клетку приходится
// около 4 исходных пикселей по горизонтали и около 7 по вертикали. 4×4 их не
// накрывали, и уровни плотности расходились с прежним drawImage; на 8×8 разбор
// сходится с ним, дальше рост выборок уже ничего не меняет.
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

/*
 * Конвейер первого экрана: один квад, четыре материала и маленькие таргеты.
 *
 * video → analysis (сетка разбора: RGB + светлота)
 *       → blur (горизонталь)
 *       → frame (вертикаль + unsharp: RGB + резкость в альфе)
 *       → readback на CPU (ключевание) и подложка на холст
 *
 * Забирать кадр с GPU синхронно нельзя: readPixels сразу после отрисовки ждёт,
 * пока GPU догонит, и стоил 2,9 мс на кадр (замер 07.09.2026) — дороже всего
 * остального вместе взятого. Поэтому readback асинхронный (через PBO), а
 * таргеты идут пинг-понгом: пока в один пишется свежий кадр, из второго уже
 * прочитанный кадр уходит и в ключевание, и в подложку. Оба слоя видят один и
 * тот же кадр, просто на один разбор позже — само видео не показывается,
 * так что задержка не видна.
 *
 * Ключевание фона заливкой от краёв остаётся последовательным и на GPU не
 * переносится — с CPU уезжает только разбор кадра.
 */
export function createAsciiPasses(video, cols, rows) {
  const analysis = target(cols, rows, THREE.NearestFilter);
  const blur = target(cols, rows, THREE.NearestFilter);

  // Два слота: пока в один пишется свежий кадр и оттуда идёт readback,
  // из второго — уже прочитанного — берутся и подложка, и разбор. Слот целиком:
  // и таргет, и буфер, поэтому оба слоя всегда видят один и тот же кадр.
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

    /*
     * Разбор свежего кадра видео и отрисовка подложки.
     *
     * Возвращает буфер сетки разбора: RGB — цвет для ключевания, альфа —
     * резкость, из неё берётся плотность знака; строки сверху вниз, как
     * раньше давал getImageData. Пока первый readback не дошёл, возвращает
     * null — вызывающему нечего разбирать, и кадр не считается свежим.
     */
    analyze(renderer, scene, camera) {
      if (!video.videoWidth) return null;

      const write = slots[index];

      // Слот, из которого ещё не дочитали, не трогаем: кадр в нём и снимок
      // в буфере должны остаться одним и тем же кадром.
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
            // Кадр дочитан целиком — теперь показываем и разбираем его,
            // а писать следующий будем в освободившийся слот.
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

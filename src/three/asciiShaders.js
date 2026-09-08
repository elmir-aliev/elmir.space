// Проходы разбора кадра для первого экрана. Все считают в байтах sRGB —
// ровно те значения, что раньше приходили из getImageData, чтобы пороги
// ключевания и уровни плотности остались прежними.

// Насыщенность и подъём чёрной точки цветовой подложки.
export const SATURATE = 1.35;
export const LIFT = 0.48;

// Unsharp по светлоте: радиус коробчатого размытия и сила подъёма.
export const SHARPEN = 1.1;
export const BLUR_RADIUS = 4;

// Полноэкранный квад: PlaneGeometry(2, 2) уже лежит в клип-кубе,
// матрицы камеры не нужны.
export const quadVertexShader = /* glsl */ `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

// Даунскейл кадра в сетку разбора коробчатым фильтром по всей площадке,
// которая приходится на клетку: без него LINEAR берёт четыре текселя из
// четырёх с лишним и картинка сыплется на движении.
//
// Кадр кладётся в таргет вверх ногами: readPixels читает строки снизу вверх,
// а разбору (как раньше getImageData) нужны сверху вниз. Обратный поворот —
// в displayFragmentShader.
export const analysisFragmentShader = /* glsl */ `
precision highp float;

uniform sampler2D uVideo;
uniform vec2 uSource;
uniform vec2 uTarget;

varying vec2 vUv;

void main() {
  vec2 footprint = uSource / uTarget;
  vec2 texel = 1.0 / uSource;
  vec2 uv = vec2(vUv.x, 1.0 - vUv.y);

  vec3 sum = vec3(0.0);
  for (int y = 0; y < TAPS; y += 1) {
    for (int x = 0; x < TAPS; x += 1) {
      vec2 offset = ((vec2(float(x), float(y)) + 0.5) / float(TAPS) - 0.5) * footprint;
      sum += texture2D(uVideo, uv + offset * texel).rgb;
    }
  }

  vec3 color = sum / float(TAPS * TAPS);
  gl_FragColor = vec4(color, dot(color, vec3(0.2126, 0.7152, 0.0722)));
}
`;

// Горизонтальная половина коробчатого размытия светлоты: берёт альфу разбора,
// кладёт результат в красный канал. По краям таргет CLAMP_TO_EDGE — так же,
// как раньше clamp() в JS.
export const blurFragmentShader = /* glsl */ `
precision highp float;

uniform sampler2D uSource;
uniform vec2 uTexel;

varying vec2 vUv;

void main() {
  float sum = 0.0;
  for (int i = -RADIUS; i <= RADIUS; i += 1) {
    sum += texture2D(uSource, vUv + vec2(float(i) * uTexel.x, 0.0)).a;
  }
  gl_FragColor = vec4(sum / float(RADIUS * 2 + 1));
}
`;

// Вертикальная половина размытия и сразу unsharp. На выход — кадр целиком:
// RGB для ключевания, резкость в альфе. Этот таргет и уезжает на CPU.
export const sharpenFragmentShader = /* glsl */ `
precision highp float;

uniform sampler2D uAnalysis;
uniform sampler2D uBlur;
uniform vec2 uTexel;

varying vec2 vUv;

void main() {
  float sum = 0.0;
  for (int i = -RADIUS; i <= RADIUS; i += 1) {
    sum += texture2D(uBlur, vUv + vec2(0.0, float(i) * uTexel.y)).r;
  }
  float blurred = sum / float(RADIUS * 2 + 1);

  vec4 frame = texture2D(uAnalysis, vUv);
  float sharpened = frame.a + SHARPEN * (frame.a - blurred);
  gl_FragColor = vec4(frame.rgb, clamp(sharpened, 0.0, 1.0));
}
`;

// Видимая подложка: тот же разобранный кадр, растянутый на кадр билинейно,
// с насыщенностью и подъёмом чёрной точки. Раньше это был попиксельный цикл
// в JS и putImageData на каждый кадр.
export const displayFragmentShader = /* glsl */ `
precision highp float;

uniform sampler2D uAnalysis;

varying vec2 vUv;

void main() {
  vec3 color = texture2D(uAnalysis, vec2(vUv.x, 1.0 - vUv.y)).rgb;
  float gray = dot(color, vec3(0.2126, 0.7152, 0.0722));
  vec3 saturated = clamp(gray + (color - gray) * SATURATE, 0.0, 1.0);
  gl_FragColor = vec4(LIFT + (1.0 - LIFT) * saturated, 1.0);
}
`;

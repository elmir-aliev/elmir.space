
export const SATURATE = 1.35;
export const LIFT = 0.48;

export const SHARPEN = 1.1;
export const BLUR_RADIUS = 4;

export const quadVertexShader =  `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const analysisFragmentShader =  `
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

export const blurFragmentShader =  `
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

export const sharpenFragmentShader =  `
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

export const displayFragmentShader =  `
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

export const burnVertexShader = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

export const burnFragmentShader = `
  precision highp float;

  uniform sampler2D uTexture;
  uniform vec2 uResolution;
  uniform vec2 uTexResolution;
  uniform float uProgress;
  uniform float uTime;

  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float sum = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 5; i++) {
      sum += amp * noise(p);
      p *= 2.02;
      amp *= 0.5;
    }
    return sum;
  }

  vec2 coverUv(vec2 uv, vec2 res, vec2 texRes) {
    float canvasAspect = res.x / res.y;
    float texAspect = texRes.x / texRes.y;
    vec2 scale = canvasAspect > texAspect
      ? vec2(1.0, texAspect / canvasAspect)
      : vec2(canvasAspect / texAspect, 1.0);
    return (uv - 0.5) * scale + 0.5;
  }

  void main() {
    vec2 uv = coverUv(vUv, uResolution, uTexResolution);
    vec4 tex = texture2D(uTexture, uv);

    vec2 centered = (vUv - 0.5) * vec2(uResolution.x / uResolution.y, 1.0);
    float radius = length(centered) / length(vec2(uResolution.x / uResolution.y, 1.0) * 0.5);

    float turbulence = fbm(vUv * 5.2 + vec2(uTime * 0.05, uTime * -0.04));
    float detail = noise(vUv * 22.0 + uTime * 0.3);
    float threshold = mix(radius, turbulence, 0.34) + (detail - 0.5) * 0.035;

    float front = mix(-0.08, 1.18, uProgress);
    float d = threshold - front;

    float alpha = smoothstep(0.0, 0.010, d);

    vec3 color = mix(tex.rgb * 0.06, tex.rgb, smoothstep(0.006, 0.048, d));

    float glow = 1.0 - smoothstep(0.0, 0.042, d);
    vec3 ember = mix(vec3(1.0, 0.95, 0.72), vec3(1.0, 0.24, 0.02), smoothstep(0.0, 0.042, d));
    color += ember * glow * glow * 2.1;

    float sparkNoise = noise(vUv * 130.0 + uTime * 2.2);
    float spark = smoothstep(0.9, 1.0, sparkNoise) * (1.0 - smoothstep(0.0, 0.03, abs(d)));
    color += vec3(1.0, 0.5, 0.12) * spark * 2.4;
    alpha = max(alpha, spark * 0.85 * step(-0.014, d));

    gl_FragColor = vec4(color, alpha * tex.a);
  }
`;

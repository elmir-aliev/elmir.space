export const flowerVertex = `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position, 1.); }
`;
export const flowerFragment = `
uniform float u_ratio;
uniform vec2 u_cursor;
uniform float u_stop_time;
uniform vec2 u_stop_randomizer;
uniform sampler2D u_texture;
varying vec2 vUv;
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1., 0.) : vec2(0., 1.);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0., i1.y, 1.)) + i.x + vec3(0., i1.x, 1.));
    vec3 m = max(.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.);
    m = m*m; m = m*m;
    vec3 x = 2. * fract(p * C.www) - 1.;
    vec3 h = abs(x) - .5;
    vec3 ox = floor(x + .5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - .85373472095314 * (a0*a0 + h*h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130. * dot(m,g);
}
float get_flower_shape(vec2 p, float pet_n, float angle, float outline) {
    angle *= 3.;
    p = vec2(p.x*cos(angle)-p.y*sin(angle), p.x*sin(angle)+p.y*cos(angle));
    float a = atan(p.y,p.x);
    float sector = pow(abs(sin(a*pet_n)), .4) + .25;
    float size = .03 + u_stop_randomizer.x * .1;
    float radial = pow(length(p)/size, 2.);
    radial -= .1*sin(8.*a);
    radial = max(.1,radial);
    radial += smoothstep(0., .03, -p.y+.2*abs(p.x));
    float grow = step(.25,u_stop_time)*pow(u_stop_time,.3);
    float shape = 1.-smoothstep(0.,sector,outline*radial/max(grow,1e-4));
    return shape*step(1e-4,grow)*(1.-step(1.,grow));
}
float get_stem_shape(vec2 p, vec2 uv, float w, float angle) {
    w = max(.004,w);
    float offset = p.y*sin(angle)*pow(3.*uv.y,2.);
    p.x -= offset;
    float noise = .5*snoise(2.*uv*u_stop_randomizer.x);
    noise *= pow(p.y*p.y,.6)*pow(uv.y*uv.y,.3);
    p.x += noise;
    float shape = smoothstep(-w,0.,p.x)*(1.-smoothstep(0.,w,p.x));
    float grow = 1.-smoothstep(0.,.2,u_stop_time);
    shape *= smoothstep(0.,max(pow(grow,.5),1e-4),.03-p.y);
    return shape*(1.-step(.17,u_stop_time));
}
void main() {
    vec3 base = texture2D(u_texture,vUv).xyz;
    vec2 uv = vUv; uv.x *= u_ratio;
    vec2 cursor = vUv-u_cursor; cursor.x *= u_ratio;
    vec3 stem_color = vec3(.1+u_stop_randomizer.x*.6,.6,.2);
    vec3 flower_color = vec3(.6+.5*u_stop_randomizer.y,.1,.9-.5*u_stop_randomizer.y);
    float angle = .5*(u_stop_randomizer.x-.5);
    vec2 branch = vec2(0.,.2+.5*u_stop_randomizer.x);
    float stem = get_stem_shape(cursor,uv,.003,angle)+get_stem_shape(cursor+branch,uv,.003,angle);
    float stem_mask = 1.-get_stem_shape(cursor,uv,.004,angle)-get_stem_shape(cursor+branch,uv,.004,angle);
    float offset = -(2.*step(0.,angle)-1.)*.1*u_stop_time;
    float back_n = 1.+floor(u_stop_randomizer.x*2.);
    float front_n = 2.+floor(u_stop_randomizer.y*2.);
    float back = get_flower_shape(cursor,back_n,angle+offset,1.5);
    float back_mask = 1.-get_flower_shape(cursor,back_n,angle+offset,1.6);
    float front = get_flower_shape(cursor,front_n,angle,1.);
    float front_mask = 1.-get_flower_shape(cursor,front_n,angle,.95);
    vec3 color = base*stem_mask*back_mask*front_mask;
    color += stem*stem_color;
    color += back*(flower_color+vec3(0.,.8*u_stop_time,0.));
    color += front*flower_color;
    color.r *= 1.-(.5*back*front);
    color.b *= 1.-(back*front);
    gl_FragColor = vec4(color,1.);
}
`;
export const flowerHeadFragment = `
uniform vec2 u_seed;
varying vec2 vUv;
float get_flower_shape(vec2 p, float pet_n, float angle, float outline) {
    angle *= 3.;
    p = vec2(p.x*cos(angle)-p.y*sin(angle), p.x*sin(angle)+p.y*cos(angle));
    float a = atan(p.y,p.x);
    float sector = pow(abs(sin(a*pet_n)), .4) + .25;
    float size = .3 + u_seed.x * .18;
    float radial = pow(length(p)/size, 2.);
    radial -= .1*sin(8.*a);
    radial = max(.1,radial);
    radial += smoothstep(0., .03, -p.y+.2*abs(p.x));
    return 1.-smoothstep(0.,sector,outline*radial);
}
void main() {
    vec2 p = vUv - .5;
    float angle = .5*(u_seed.x-.5);
    float back_n = 1.+floor(u_seed.x*2.);
    float front_n = 2.+floor(u_seed.y*2.);
    float back = get_flower_shape(p,back_n,angle+.08,1.5);
    float front = get_flower_shape(p,front_n,angle,1.);
    float alpha = max(back,front);
    float light = back*.78 + front;
    vec3 ice = vec3(.57,.74,.87)*light;
    gl_FragColor = vec4(ice,alpha);
}
`;
export const flowerSpriteDisplay = `
uniform sampler2D u_texture;
varying vec2 vUv;
void main() {
    vec3 c = texture2D(u_texture,vUv).rgb;
    float light = dot(c,vec3(.30,.38,.32));
    vec3 ice = vec3(.57,.74,.87)*light;
    float alpha = smoothstep(.008,.08,light);
    gl_FragColor = vec4(ice,alpha);
}
`;
export const flowerDisplay = `
uniform sampler2D u_texture;
varying vec2 vUv;
void main() {
    vec3 c = texture2D(u_texture,vUv).rgb;
    float light = dot(c,vec3(.30,.38,.32));
    vec3 ice = vec3(.57,.74,.87)*light;
    gl_FragColor = vec4(ice,1.);
}
`;
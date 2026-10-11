import * as THREE from 'three';

const vertexShader = `varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
const weights = `float weight(float x){return exp(-.5*x*x);}`;

export function createTextMorphRenderer(canvas, root, texts) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha:true, antialias:false, depth:false });
  renderer.setPixelRatio(1);
  renderer.setClearColor(0,0);
  const geometry = new THREE.PlaneGeometry(2,2);
  const camera = new THREE.Camera();
  const scene = new THREE.Scene();
  const quad = new THREE.Mesh(geometry);
  scene.add(quad);
  const horizontal = new THREE.ShaderMaterial({vertexShader, fragmentShader:`
    varying vec2 vUv; uniform sampler2D a; uniform sampler2D b;
    uniform vec2 sigma; uniform vec2 resolution;
    ${weights}
    void main(){
      vec2 sum=vec2(0.); float total=0.;
      for(int i=-8;i<=8;i++){
        float t=float(i)*.375; float w=weight(t); total+=w;
        sum.x+=texture2D(a,vUv+vec2(t*sigma.x/resolution.x,0.)).a*w;
        sum.y+=texture2D(b,vUv+vec2(t*sigma.y/resolution.x,0.)).a*w;
      }
      gl_FragColor=vec4(sum/total,0.,1.);
    }`,uniforms:{a:{value:null},b:{value:null},sigma:{value:new THREE.Vector2()},resolution:{value:new THREE.Vector2()}}});
  const vertical = new THREE.ShaderMaterial({vertexShader, fragmentShader:`
    varying vec2 vUv; uniform sampler2D source; uniform vec2 sigma; uniform vec2 resolution;
    ${weights}
    void main(){
      vec2 sum=vec2(0.);float total=0.;
      for(int i=-8;i<=8;i++){
        float t=float(i)*.375;float w=weight(t);total+=w;
        sum.x+=texture2D(source,vUv+vec2(0.,t*sigma.x/resolution.y)).r*w;
        sum.y+=texture2D(source,vUv+vec2(0.,t*sigma.y/resolution.y)).g*w;
      }
      gl_FragColor=vec4(sum/total,0.,1.);
    }`,uniforms:{source:{value:null},sigma:{value:new THREE.Vector2()},resolution:{value:new THREE.Vector2()}}});
  const combine = new THREE.ShaderMaterial({vertexShader, fragmentShader:`
    varying vec2 vUv;uniform sampler2D source;uniform sampler2D sharp;
    uniform vec2 opacity;uniform vec3 ink;uniform float endpoint;
    void main(){
      vec2 masks=texture2D(source,vUv).rg*opacity;
      float alpha=masks.y+masks.x*(1.-masks.y);
      float edge=max(fwidth(alpha)*.75,.004);
      alpha=smoothstep(140./255.-edge,140./255.+edge,alpha);
      alpha=mix(alpha,texture2D(sharp,vUv).a,endpoint);
      gl_FragColor=vec4(ink*alpha,alpha);
    }`,uniforms:{source:{value:null},sharp:{value:null},opacity:{value:new THREE.Vector2()},ink:{value:new THREE.Vector3()},endpoint:{value:0}}});
  let textures=[]; let targets=[]; let scale=1;
  let lastKey=''; let signature='';
  function resize() {
    const style=getComputedStyle(root);
    const width=Math.round(root.clientWidth);
    const measure=document.createElement('canvas').getContext('2d');
    measure.font=`${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    measure.letterSpacing=style.letterSpacing;
    const wrapped=texts.map(text=>{
      const words=(style.textTransform==='uppercase'?text.toLocaleUpperCase():text).split(/\s+/);
      const lines=[];let line='';
      words.forEach(word=>{const candidate=line?`${line} ${word}`:word;
        if(line&&measure.measureText(candidate).width>width){lines.push(line);line=word;}else line=candidate;
      });if(line)lines.push(line);
      return lines;
    });
    const lineHeight=parseFloat(style.lineHeight)||parseFloat(style.fontSize);
    const padding=52*parseFloat(style.fontSize)/64;
    root.style.minHeight=`${Math.ceil(Math.max(...wrapped.map(lines=>lines.length))*lineHeight+padding)}px`;
    const height=Math.round(root.clientHeight);
    const next=[width,height,style.font,style.letterSpacing,style.color,style.textTransform].join('|');
    if (!width || !height || signature===next) return;
    signature=next; lastKey='';
    textures.forEach(t=>t.dispose());targets.forEach(t=>t.dispose());
    const dpr=Math.min(window.devicePixelRatio||1,1.5);
    const w=Math.round(width*dpr),h=Math.round(height*dpr);
    renderer.setSize(w,h,false);
    const fontSize=parseFloat(style.fontSize);scale=fontSize/64*dpr;
    textures=wrapped.map(lines=>{
      const image=document.createElement('canvas');image.width=w;image.height=h;
      const ctx=image.getContext('2d');ctx.scale(dpr,dpr);
      ctx.font=`${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      ctx.letterSpacing=style.letterSpacing;
      ctx.fillStyle='white';ctx.textAlign='center';ctx.textBaseline='middle';
      lines.forEach((value,i)=>ctx.fillText(value,width/2,height/2+(i-(lines.length-1)/2)*lineHeight));
      const texture=new THREE.CanvasTexture(image);texture.generateMipmaps=false;
      texture.minFilter=THREE.LinearFilter;return texture;
    });
    targets=[new THREE.WebGLRenderTarget(w,h,{depthBuffer:false,stencilBuffer:false}),new THREE.WebGLRenderTarget(w,h,{depthBuffer:false,stencilBuffer:false})];
    horizontal.uniforms.resolution.value.set(w,h);vertical.uniforms.resolution.value.set(w,h);
    const rgb=style.color.match(/[\d.]+/g).map(Number);
    combine.uniforms.ink.value.set(rgb[0]/255,rgb[1]/255,rgb[2]/255);
  }
  function draw(fraction,index) {
    if(!textures.length)return;
    const key=`${index}:${fraction.toFixed(5)}`;if(key===lastKey)return;lastKey=key;
    const a=textures[index%textures.length],b=textures[(index+1)%textures.length];
    const blur=f=>Math.min(26,f>0?8/f-8:26)*scale;
    horizontal.uniforms.a.value=a;horizontal.uniforms.b.value=b;
    horizontal.uniforms.sigma.value.set(blur(1-fraction),blur(fraction));
    vertical.uniforms.sigma.value.copy(horizontal.uniforms.sigma.value);
    quad.material=horizontal;renderer.setRenderTarget(targets[0]);renderer.render(scene,camera);
    vertical.uniforms.source.value=targets[0].texture;
    quad.material=vertical;renderer.setRenderTarget(targets[1]);renderer.render(scene,camera);
    combine.uniforms.source.value=targets[1].texture;
    combine.uniforms.opacity.value.set(Math.pow(1-fraction,.4),Math.pow(fraction,.4));
    combine.uniforms.sharp.value=fraction<.5?a:b;
    combine.uniforms.endpoint.value=fraction===0||fraction===1?1:0;
    quad.material=combine;renderer.setRenderTarget(null);renderer.render(scene,camera);
  }
  return { resize, draw, dispose(){textures.forEach(t=>t.dispose());targets.forEach(t=>t.dispose());
    horizontal.dispose();vertical.dispose();combine.dispose();geometry.dispose();renderer.dispose();} };
}

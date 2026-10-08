import { useEffect, useRef } from 'react';
import { addTrack } from '../scroll/scrollEngine';
import { createScrollFlowerRenderer } from '../three/scrollFlowerRenderer';

const clamp01 = value => Math.min(1, Math.max(0, value));
const FLOWER_DATA = [
  { seed:[.7,.8], path:'primary', pathProgress:.08, animation:.042, side:-1, scale:1 },
  { seed:[.73,.84], path:'primary', pathProgress:.16, animation:.073, side:1, scale:1 },
  { seed:[.67,.78], path:'primary', pathProgress:.34, animation:.14, side:-1, scale:1 },
  { seed:[.76,.86], path:'primary', pathProgress:.43, animation:.175, side:1, scale:1 },
  { seed:[.72,.82], path:'primary', pathProgress:.24, animation:.10, side:1, scale:1 },
  { seed:[.68,.76], path:'primary', pathProgress:.52, animation:.21, side:-1, scale:.95 },
  { seed:[.75,.88], path:'primary', pathProgress:.78, animation:.32, side:1, scale:1 },
  { seed:[.7,.8], path:'secondary', pathProgress:.18, animation:.48, side:-1, scale:.92 },
  { seed:[.73,.84], path:'secondary', pathProgress:.36, animation:.58, side:1, scale:.92 },
  { seed:[.67,.78], path:'secondary', pathProgress:.56, animation:.68, side:1, scale:.84, tree:true, fan:-1, leader:true },
  { seed:[.76,.86], path:'secondary', pathProgress:.56, animation:.72, side:1, scale:.76, tree:true, fan:1 },
  { seed:[.71,.81], path:'secondary', pathProgress:.68, animation:.76, side:-1, scale:.82, tree:true, fan:-1, leader:true },
  { seed:[.69,.89], path:'secondary', pathProgress:.68, animation:.80, side:-1, scale:.74, tree:true, fan:1 },
  { seed:[.74,.73], path:'secondary', pathProgress:.80, animation:.84, side:1, scale:.8, tree:true, fan:-1, leader:true },
  { seed:[.66,.85], path:'secondary', pathProgress:.80, animation:.88, side:1, scale:.72, tree:true, fan:1 },
  { seed:[.77,.79], path:'secondary', pathProgress:.91, animation:.92, side:-1, scale:.78, tree:true, fan:-1, leader:true },
  { seed:[.7,.91], path:'secondary', pathProgress:.91, animation:.96, side:-1, scale:.7, tree:true, fan:1 },
  { seed:[.74,.83], path:'secondary', pathProgress:1, animation:.985, side:1, scale:.82, terminal:true },
];
const BRANCH_GROWTH=.025;
// Leave scroll room for terminal shoots after the trunk reaches the bottom.
const TRUNK_RATE=1.16;
const flowers=FLOWER_DATA.map(flower=>{
  const arrival=flower.path==='primary'
    ? flower.pathProgress*.38
    : .4+flower.pathProgress/TRUNK_RATE*.6;
  // Child shoots wait until the parent bough is fully drawn.
  const branchStart=arrival+.004+(flower.tree&&!flower.leader?BRANCH_GROWTH+.003:0);
  return {...flower,progress:branchStart,branchStart,bloomProgress:branchStart+BRANCH_GROWTH+.006};
});

function primaryRoute(width,startY,worksY,card,button) {
  const entryY=Math.max(worksY+100,card.top+card.height*.18);
  const exitX=Math.max(card.left+card.width*.42,button.left-24);
  const exitY=button.top+button.height*.5;
  return `M ${width+8} ${startY}
    C ${width*.83} ${startY}, ${width*.72} ${startY+(worksY-startY)*.55}, ${width*.48} ${startY+(worksY-startY)*.7}
    S ${width*.16} ${worksY-60}, ${width*.13} ${worksY}
    C ${width*.1} ${worksY+60}, ${card.left+card.width*.2} ${entryY-60}, ${card.left+card.width*.2} ${entryY}
    C ${card.left+card.width*.35} ${entryY+card.height*.16}, ${exitX-90} ${exitY-80}, ${exitX} ${exitY}
    C ${exitX+width*.08} ${exitY+70}, ${width*.9} ${exitY+160}, ${width+28} ${exitY+300}`;
}

function secondaryRoute(width,height,startY,contactY) {
  const span=Math.max(400,height-contactY);
  return `M ${width+36} ${startY}
    C ${width*.96} ${startY+24}, ${width*.78} ${contactY+span*.1}, ${width*.72} ${contactY+span*.24}
    C ${width*.64} ${contactY+span*.4}, ${width*.73} ${contactY+span*.56}, ${width*.64} ${contactY+span*.7}
    C ${width*.57} ${contactY+span*.82}, ${width*.69} ${height-100}, ${width*.62} ${height}`;
}

function pointData(path,progress) {
  const length=path.getTotalLength();
  const distance=length*progress;
  const p=path.getPointAtLength(distance);
  const a=path.getPointAtLength(Math.max(0,distance-2));
  const b=path.getPointAtLength(Math.min(length,distance+2));
  const magnitude=Math.max(.001,Math.hypot(b.x-a.x,b.y-a.y));
  return {p,tx:(b.x-a.x)/magnitude,ty:(b.y-a.y)/magnitude};
}

export function ScrollStem() {
  const rootRef=useRef(null);
  const svgRef=useRef(null);
  const primaryRef=useRef(null);
  const primaryCoreRef=useRef(null);
  const secondaryRef=useRef(null);
  const secondaryCoreRef=useRef(null);
  const canvasRef=useRef(null);
  const flowerCanvases=useRef([]);
  const branchBacks=useRef([]);
  const branchCores=useRef([]);

  useEffect(()=>{
    const root=rootRef.current;
    const main=root?.parentElement;
    const hero=document.querySelector('.hero--ironhill');
    const works=document.querySelector('#works');
    const stack=document.querySelector('#stack');
    const process=document.querySelector('#process');
    const contact=document.querySelector('#contact');
    const footer=document.querySelector('.site-footer');
    const frame=document.querySelector('.featured-work__hero');
    const open=document.querySelector('.featured-work__open');
    if(!root||!main||!hero||!works||!stack||!process||!contact||!footer||!frame||!open)return undefined;

    let renderer;
    try { renderer=createScrollFlowerRenderer(canvasRef.current,flowers,flowerCanvases.current); }
    catch { /* SVG vine remains as the fallback. */ }
    let top=0,mainTop=0,primaryStart=0,primaryEnd=1,secondaryStart=0,secondaryEnd=1;
    let placements=[];
    let layoutWidth=window.innerWidth;
    let viewportHeight=window.innerHeight;
    const motion=window.matchMedia('(prefers-reduced-motion: reduce)');

    const layout=()=>{
      const width=main.clientWidth;
      if(Math.abs(window.innerWidth-layoutWidth)>48){layoutWidth=window.innerWidth;viewportHeight=window.innerHeight;}
      mainTop=main.getBoundingClientRect().top+window.scrollY;
      top=hero.offsetTop+(hero.offsetHeight-viewportHeight)*.69;
      const height=Math.max(1,footer.offsetTop+footer.offsetHeight-top);
      primaryStart=top+mainTop;
      secondaryStart=process.offsetTop+process.offsetHeight+mainTop-viewportHeight;
      secondaryEnd=contact.offsetTop+contact.offsetHeight+mainTop-viewportHeight;

      const mainRect=main.getBoundingClientRect();
      const frameRect=frame.getBoundingClientRect();
      const openRect=open.getBoundingClientRect();
      primaryEnd=openRect.top+window.scrollY-viewportHeight*.15;
      let cardTop=0,node=frame;
      while(node&&node!==main){cardTop+=node.offsetTop;node=node.offsetParent;}
      const card={left:frameRect.left-mainRect.left,top:cardTop-top,width:frame.offsetWidth,height:frame.offsetHeight};
      const button={left:openRect.left-mainRect.left,top:openRect.top-mainRect.top-top,width:openRect.width,height:openRect.height};
      const burnStartY=process.offsetTop+process.offsetHeight-top-viewportHeight*.18;
      const contactY=contact.offsetTop-top;

      root.style.top=`${top}px`;root.style.height=`${height}px`;
      svgRef.current.setAttribute('viewBox',`0 0 ${width} ${height}`);
      const primaryD=primaryRoute(width,viewportHeight*.5,works.offsetTop-top,card,button);
      const contactBottomY=contact.offsetTop+contact.offsetHeight-top;
      const footerEndY=footer.offsetTop+footer.offsetHeight-top-Math.max(72,width*.055);
      const secondaryD=secondaryRoute(width,contactBottomY,burnStartY,contactY);
      primaryRef.current.setAttribute('d',primaryD);primaryCoreRef.current.setAttribute('d',primaryD);
      secondaryRef.current.setAttribute('d',secondaryD);secondaryCoreRef.current.setAttribute('d',secondaryD);

      const limbs=new Map();
      placements=flowers.map((flower,index)=>{
        const path=flower.path==='primary'?primaryRef.current:secondaryRef.current;
        const {p,tx,ty}=pointData(path,flower.pathProgress);
        const nx=-ty*flower.side,ny=tx*flower.side;
        const size=(width<768?90:126)*flower.scale;
        let x,y,d,tipTx,tipTy;

        if(flower.terminal){
          // A separate final shoot continues below the unchanged contact tree.
          x=width*(width<768?.88:.86);y=footerEndY;
          const bend=Math.max(120,(y-p.y)*.42);
          const c1x=p.x-width*.04,c1y=p.y+bend*.34;
          const c2x=x-width*.18,c2y=y-bend*.22;
          d=`M ${p.x} ${p.y} C ${c1x} ${c1y} ${c2x} ${c2y} ${x} ${y}`;
          const tipLength=Math.max(.001,Math.hypot(x-c2x,y-c2y));
          tipTx=(x-c2x)/tipLength;tipTy=(y-c2y)/tipLength;
        } else if(flower.tree){
          const group=`${flower.pathProgress}-${flower.side}`;
          let limb=limbs.get(group);
          const reach=Math.min(width*.3,width<768?125:290)*(1.1-flower.pathProgress*.25);
          const inset=size*.6+12;
          const constrainX=value=>Math.max(inset,Math.min(width-inset,value));
          if(!limb){
            // A long, continuous bough; no elbow or identical Y-shaped forks.
            const end={x:constrainX(p.x+nx*reach+tx*reach*.3),y:Math.min(height-inset,p.y+ty*reach*.82+ny*reach*.35)};
            const c1={x:p.x+tx*reach*.5,y:p.y+ty*reach*.5};
            const c2={x:end.x-nx*reach*.28,y:end.y-reach*.2};
            limb={start:p,c1,c2,end};limbs.set(group,limb);
          }
          let origin,c1,c2,end;
          if(flower.leader){
            ({start:origin,c1,c2,end}=limb);
          }else{
            // A finer shoot sprouts tangentially from inside its parent curve.
            const t=.56+(flower.pathProgress-.56)*.3,u=1-t;
            origin={
              x:u*u*u*p.x+3*u*u*t*limb.c1.x+3*u*t*t*limb.c2.x+t*t*t*limb.end.x,
              y:u*u*u*p.y+3*u*u*t*limb.c1.y+3*u*t*t*limb.c2.y+t*t*t*limb.end.y,
            };
            const dx=3*u*u*(limb.c1.x-p.x)+6*u*t*(limb.c2.x-limb.c1.x)+3*t*t*(limb.end.x-limb.c2.x);
            const dy=3*u*u*(limb.c1.y-p.y)+6*u*t*(limb.c2.y-limb.c1.y)+3*t*t*(limb.end.y-limb.c2.y);
            const length=Math.max(.001,Math.hypot(dx,dy));
            const twig=reach*.63;
            end={x:constrainX(origin.x+nx*twig*.9),y:Math.max(contactY+20,origin.y-twig*.55)};
            c1={x:origin.x+dx/length*twig*.36,y:origin.y+dy/length*twig*.36};
            c2={x:end.x-nx*twig*.15,y:end.y+twig*.5};
          }
          x=end.x;y=end.y;
          d=`M ${origin.x} ${origin.y} C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${x} ${y}`;
          const tipLength=Math.max(.001,Math.hypot(x-c2.x,y-c2.y));
          tipTx=(x-c2.x)/tipLength;tipTy=(y-c2.y)/tipLength;
          branchBacks.current[index].style.strokeWidth=flower.leader?'4.4':'3';
          branchCores.current[index].style.strokeWidth=flower.leader?'1.9':'1.2';
        } else {
          const branchLength=(width<768?66:108)*(0.9+flower.seed[0]*.2);
          const forward=branchLength*.9,spread=branchLength*.38;
          x=p.x+tx*forward+nx*spread;y=p.y+ty*forward+ny*spread;
          const c1x=p.x+tx*branchLength*.34+nx*branchLength*.05;
          const c1y=p.y+ty*branchLength*.34+ny*branchLength*.05;
          const c2x=p.x+tx*branchLength*.74+nx*branchLength*.24;
          const c2y=p.y+ty*branchLength*.74+ny*branchLength*.24;
          d=`M ${p.x} ${p.y} C ${c1x} ${c1y} ${c2x} ${c2y} ${x} ${y}`;
          const tipLength=Math.max(.001,Math.hypot(x-c2x,y-c2y));
          tipTx=(x-c2x)/tipLength;tipTy=(y-c2y)/tipLength;
        }
        branchBacks.current[index]?.setAttribute('d',d);
        branchCores.current[index]?.setAttribute('d',d);
        const shaderLean=1.5*(flower.seed[0]-.5);
        const tipAngle=Math.atan2(tipTy,tipTx);
        const flowerX=x+tipTx*size*.035,flowerY=y+tipTy*size*.035;
        const placement={x:flowerX-size/2,y:flowerY-size/2,size,angle:shaderLean-tipAngle-Math.PI/2};
        const flowerCanvas=flowerCanvases.current[index];
        if(flowerCanvas){
          const ratio=Math.min(window.devicePixelRatio,1.5),pixels=Math.round(size*ratio);
          if(flowerCanvas.width!==pixels)flowerCanvas.width=pixels;
          if(flowerCanvas.height!==pixels)flowerCanvas.height=pixels;
          Object.assign(flowerCanvas.style,{left:`${placement.x}px`,top:`${placement.y}px`,width:`${size}px`,height:`${size}px`});
        }
        return placement;
      });
      renderer?.invalidate();
    };

    const observer=new ResizeObserver(layout);observer.observe(main);observer.observe(frame);layout();
    const render=()=>{
      const scroll=window.scrollY;
      const primaryProgress=motion.matches?1:clamp01((scroll-primaryStart)/Math.max(1,primaryEnd-primaryStart));
      const burnReady=motion.matches||process.dataset.burnComplete==='true';
      const secondaryProgress=burnReady?(motion.matches?1:clamp01((scroll-secondaryStart)/Math.max(1,secondaryEnd-secondaryStart))):0;
      const animationProgress=burnReady ? .4+secondaryProgress*.6 : primaryProgress*.38;
      root.style.opacity=primaryProgress>0||secondaryProgress>0?'1':'0';
      for(const path of [primaryRef.current,primaryCoreRef.current])path.style.strokeDashoffset=`${1-primaryProgress}`;
      for(const path of [secondaryRef.current,secondaryCoreRef.current]){
        path.style.visibility=burnReady?'visible':'hidden';path.style.strokeDashoffset=`${1-clamp01(secondaryProgress*TRUNK_RATE)}`;
      }
      flowers.forEach((flower,index)=>{
        const growth=clamp01((animationProgress-flower.branchStart)/BRANCH_GROWTH);
        for(const branch of [branchBacks.current[index],branchCores.current[index]]){
          if(!branch)continue;branch.style.strokeDashoffset=`${1-growth}`;branch.style.visibility=growth>0?'visible':'hidden';
        }
      });
      renderer?.draw(placements,animationProgress,motion.matches);
    };
    const remove=addTrack({measure(){},render});
    const preference=()=>render();motion.addEventListener('change',preference);render();
    return()=>{remove();observer.disconnect();motion.removeEventListener('change',preference);renderer?.dispose();};
  },[]);

  return <div ref={rootRef} className="scroll-stem" aria-hidden="true">
    <svg ref={svgRef} className="scroll-stem__svg" preserveAspectRatio="none">
      <g className="scroll-stem__joined scroll-stem__joined--back">
        <path ref={primaryRef} className="scroll-stem__path" pathLength="1" />
        {flowers.map((flower,index)=>flower.path==='primary'&&<path key={index}
          ref={node=>{branchBacks.current[index]=node;}}
          className="scroll-stem__branch scroll-stem__branch--back" pathLength="1" />)}
      </g>
      <g className="scroll-stem__joined scroll-stem__joined--core">
        <path ref={primaryCoreRef} className="scroll-stem__path scroll-stem__core" pathLength="1" />
        {flowers.map((flower,index)=>flower.path==='primary'&&<path key={index}
          ref={node=>{branchCores.current[index]=node;}}
          className="scroll-stem__branch scroll-stem__branch--core" pathLength="1" />)}
      </g>
      <g className="scroll-stem__joined scroll-stem__joined--back">
        <path ref={secondaryRef} className="scroll-stem__path" pathLength="1" />
        {flowers.map((flower,index)=>flower.path==='secondary'&&<path key={index}
          ref={node=>{branchBacks.current[index]=node;}}
          className="scroll-stem__branch scroll-stem__branch--back" pathLength="1" />)}
      </g>
      <g className="scroll-stem__joined scroll-stem__joined--core">
        <path ref={secondaryCoreRef} className="scroll-stem__path scroll-stem__core" pathLength="1" />
        {flowers.map((flower,index)=>flower.path==='secondary'&&<path key={index}
          ref={node=>{branchCores.current[index]=node;}}
          className="scroll-stem__branch scroll-stem__branch--core" pathLength="1" />)}
      </g>
    </svg>
    {flowers.map((flower,index)=><canvas key={`flower-${flower.path}-${flower.animation}`} ref={node=>{flowerCanvases.current[index]=node;}} className="scroll-stem__flower" />)}
    <canvas ref={canvasRef} className="scroll-stem__renderer" />
  </div>;
}

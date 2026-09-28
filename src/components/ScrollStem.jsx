import { useEffect, useRef } from 'react';
import { addTrack } from '../scroll/scrollEngine';
import { createScrollFlowerRenderer } from '../three/scrollFlowerRenderer';

const clamp01 = value => Math.min(1, Math.max(0, value));
const FLOWER_SEEDS = [
  [.72, .82], [.68, .76], [.75, .88], [.7, .8],
  [.73, .84], [.67, .78], [.76, .86], [.71, .81],
];

const BRANCH_DELAY = .012;
const BRANCH_GROWTH = .032;
const BLOOM_DELAY = .006;

const flowers = FLOWER_SEEDS.map((seed, index) => {
  const progress = .12 + index * .108;
  const branchStart = progress + BRANCH_DELAY;
  return {
    progress,
    branchStart,
    bloomProgress: branchStart + BRANCH_GROWTH + BLOOM_DELAY,
    side: index % 2 ? -1 : 1,
    scale: 1,
    seed,
  };
});

// Monotone vertical anchors: no reversing loop at the section boundary.
function route(width, height, startY, worksY, card) {
  const entryY = Math.max(worksY + 100, card.top + card.height * .18);
  const exitY = card.top + card.height + 30;
  const exitX = card.left + card.width * .8;
  return `M ${width + 8} ${startY}
    C ${width * .83} ${startY}, ${width * .72} ${startY + (worksY-startY)*.55}, ${width * .48} ${startY+(worksY-startY)*.7}
    S ${width * .16} ${worksY-60}, ${width * .13} ${worksY}
    C ${width * .1} ${worksY+60}, ${card.left+card.width*.2} ${entryY-60}, ${card.left+card.width*.2} ${entryY}
    C ${card.left+card.width*.25} ${entryY+card.height*.2}, ${exitX+30} ${exitY-150}, ${exitX} ${exitY}
    C ${exitX-30} ${exitY+150}, ${width*.13} ${exitY+180}, ${width*.12} ${Math.min(height,exitY+400)}
    S ${width*.17} ${height-120}, ${width*.1} ${height}`;
}

export function ScrollStem() {
  const rootRef = useRef(null);
  const svgRef = useRef(null);
  const pathRef = useRef(null);
  const coreRef = useRef(null);
  const canvasRef = useRef(null);
  const branchBacks = useRef([]);
  const branchCores = useRef([]);

  useEffect(() => {
    const root = rootRef.current;
    const hero = document.querySelector('.hero--ironhill');
    const works = document.querySelector('#works');
    const stack = document.querySelector('#stack');
    const frame = document.querySelector('.featured-work__hero');
    const main = root?.parentElement;
    if (!hero || !works || !stack || !frame || !main) return undefined;
    let renderer;
    try { renderer = createScrollFlowerRenderer(canvasRef.current, flowers); }
    catch { /* The vine remains visible when WebGL is unavailable. */ }
    let start = 0, end = 1, top = 0;
    let placements = [];
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const layout = () => {
      const width = main.clientWidth;
      top = hero.offsetTop + (hero.offsetHeight-window.innerHeight)*.69;
      start = top;
      end = stack.offsetTop-window.innerHeight*.18;
      const height = Math.max(1,stack.offsetTop-top);
      // offsetParent coordinates exclude GSAP's temporary entry transforms.
      let cardTop = 0, node = frame;
      while (node && node !== main) { cardTop += node.offsetTop; node = node.offsetParent; }
      const cardRect = frame.getBoundingClientRect();
      const card = { left: cardRect.left-main.getBoundingClientRect().left,
        top: cardTop-top, width: frame.offsetWidth, height: frame.offsetHeight };
      root.style.top = `${top}px`;
      root.style.height = `${height}px`;
      svgRef.current.setAttribute('viewBox',`0 0 ${width} ${height}`);
      const d = route(width,height,window.innerHeight*.5,works.offsetTop-top,card);
      pathRef.current.setAttribute('d',d);
      coreRef.current.setAttribute('d',d);
      const length = pathRef.current.getTotalLength();
      placements = flowers.map((flower,index) => {
        const distance = length*flower.progress;
        const p = pathRef.current.getPointAtLength(distance);
        const a = pathRef.current.getPointAtLength(Math.max(0,distance-2));
        const b = pathRef.current.getPointAtLength(Math.min(length,distance+2));
        const len = Math.max(.001,Math.hypot(b.x-a.x,b.y-a.y));
        const tx=(b.x-a.x)/len, ty=(b.y-a.y)/len;
        const nx=-ty*flower.side, ny=tx*flower.side;
        const branchLength=(width<768?72:118)*(0.9+flower.seed[0]*.2);
        const size=(width<768?84:116)*flower.scale;

        // The offshoot keeps travelling in the SAME direction as the main vine.
        // It only peels away sideways a little, so the fork reads as one living
        // gesture instead of a hook turning back against the growth direction.
        const forward=branchLength*1.02;
        const spread=branchLength*.42;
        const x=p.x+tx*forward+nx*spread;
        const y=p.y+ty*forward+ny*spread;
        const c1x=p.x+tx*branchLength*.34+nx*branchLength*.055;
        const c1y=p.y+ty*branchLength*.34+ny*branchLength*.055;
        const c2x=p.x+tx*branchLength*.78+nx*branchLength*.26;
        const c2y=p.y+ty*branchLength*.78+ny*branchLength*.26;
        const d=`M ${p.x} ${p.y} C ${c1x} ${c1y} ${c2x} ${c2y} ${x} ${y}`;
        branchBacks.current[index]?.setAttribute('d',d);
        branchCores.current[index]?.setAttribute('d',d);

        // The hero shader has a small seed-dependent lean built into the petal
        // geometry. Compensate for it here so the blossom's visual axis follows
        // the terminal tangent of the offshoot instead of occasionally looking
        // back against the branch.
        const tipDx=x-c2x, tipDy=y-c2y;
        const tipLen=Math.max(.001,Math.hypot(tipDx,tipDy));
        const tipTx=tipDx/tipLen, tipTy=tipDy/tipLen;
        const tipAngle=Math.atan2(tipTy,tipTx);
        const shaderLean=1.5*(flower.seed[0]-.5);

        // Keep the flower almost directly on the branch tip. The canvas is drawn
        // above the SVG, so a tiny overlap hides the line naturally under the
        // translucent petals and removes any visible gap at the flower neck.
        const neckOffset=size*.035;
        const flowerX=x+tipTx*neckOffset;
        const flowerY=y+tipTy*neckOffset;

        return {
          x:flowerX-size/2,
          y:flowerY-size/2,
          size,
          // GLSL mat2() is column-major: the display shader samples with R(-angle),
          // so the sprite itself visually rotates by +angle. Account for that sign
          // (and for flowerFragment's seed lean) so the blossom always points in
          // exactly the SAME direction as the terminal tangent of its branch.
          angle:shaderLean-tipAngle-Math.PI/2,
        };
      });
    };
    const observer=new ResizeObserver(layout);
    observer.observe(main);
    observer.observe(frame);
    layout();
    const render=() => {
      const scroll=window.scrollY;
      const p=motion.matches?1:clamp01((scroll-start)/Math.max(1,end-start));
      root.style.opacity=p>0?'1':'0';
      pathRef.current.style.strokeDashoffset=`${1-p}`;
      coreRef.current.style.strokeDashoffset=`${1-p}`;
      flowers.forEach((flower,index)=>{
        // First the main vine must visibly pass the junction. Only after that
        // does the side branch grow; the blossom starts after the branch is done.
        const growth=clamp01((p-flower.branchStart)/BRANCH_GROWTH);
        for (const branch of [branchBacks.current[index], branchCores.current[index]]) {
          if (!branch) continue;
          branch.style.strokeDashoffset=`${1-growth}`;
          branch.style.visibility=growth>0?'visible':'hidden';
        }
      });
      const mainTop=main.getBoundingClientRect().top;
      renderer?.draw(
        placements.map(box=>({...box,y:box.y+top+mainTop})),
        p,
        motion.matches,
      );
    };
    const remove=addTrack({measure(){},render});
    const preference=()=>{render();};
    motion.addEventListener('change',preference);
    render();
    return ()=>{remove(); observer.disconnect(); motion.removeEventListener('change',preference); renderer?.dispose();};
  },[]);

  return (
    <div ref={rootRef} className="scroll-stem" aria-hidden="true">
      <svg ref={svgRef} className="scroll-stem__svg" preserveAspectRatio="none">
        <path ref={pathRef} className="scroll-stem__path" pathLength="1" />
        <path ref={coreRef} className="scroll-stem__path scroll-stem__core" pathLength="1" />
        {flowers.map((flower,index)=>(
          <g key={flower.progress}>
            <path
              ref={node=>{branchBacks.current[index]=node;}}
              className="scroll-stem__branch scroll-stem__branch--back"
              pathLength="1"
            />
            <path
              ref={node=>{branchCores.current[index]=node;}}
              className="scroll-stem__branch scroll-stem__branch--core"
              pathLength="1"
            />
          </g>
        ))}
      </svg>
      <canvas ref={canvasRef} className="scroll-stem__canvas" />
    </div>
  );
}

import { useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { getLenis, startScrollEngine } from './scrollEngine';

gsap.registerPlugin(ScrollTrigger);

export function useSmoothScroll(options) {
  useEffect(() => {
    const stop = startScrollEngine(options);
    const lenis = getLenis();
    const update = () => ScrollTrigger.update();
    lenis?.on('scroll', update);
    return () => {
      lenis?.off('scroll', update);
      stop();
    };
  }, [options]);
}

import { useEffect, useImperativeHandle, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { createAsciiPasses } from "../three/asciiPasses";

export function AsciiFilm({ video, cols, rows, filmRef }) {
  const renderer = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const passes = useMemo(
    () => createAsciiPasses(video, cols, rows),
    [video, cols, rows],
  );
  useEffect(() => () => passes.dispose(), [passes]);
  useImperativeHandle(
    filmRef,
    () => ({
      analyze: () => passes.analyze(renderer, scene, camera),
    }),
    [passes, renderer, scene, camera],
  );
  return <primitive object={passes.mesh} />;
}
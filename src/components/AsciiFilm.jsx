import { useEffect, useImperativeHandle, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { createAsciiPasses } from "../three/asciiPasses";

/*
 * Сцена первого экрана внутри <Canvas frameloop="never">: фреймлупа своего нет,
 * проходы гоняет AsciiVideo из общего rAF скролл-движка — второго тикера в
 * проекте по-прежнему не заводится.
 *
 * filmRef получает { analyze() } — один вызов на свежий кадр видео.
 */
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

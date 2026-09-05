import { Header } from "./components/Header";
import { Hero } from "./components/Hero";
import { Intro } from "./components/Intro";
import { MorphBackdrop } from "./components/MorphBackdrop";
import { Works } from "./components/Works";
import { Stack } from "./components/Stack";
import { BurnSection } from "./components/BurnSection";
import { Contact } from "./components/Contact";
import { useSmoothScroll } from "./scroll/useSmoothScroll";

export default function App() {
  useSmoothScroll();

  return (
    <>
      <Header />
      <MorphBackdrop />
      <main>
        <Hero />
        <Intro />
        {/* Пролёт: на нём капля разрастается обратно в страницу «Работ». */}
        <div className="morph-gate" aria-hidden="true" />
        <Works />
        <Stack />
        <BurnSection />
        <Contact />
      </main>
    </>
  );
}

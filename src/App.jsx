import { Header } from "./components/Header";
import { Hero } from "./components/Hero";
import { Intro } from "./components/Intro";
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
      <main>
        <Hero />
        <Intro />
        <Works />
        <Stack />
        <BurnSection />
        <Contact />
      </main>
    </>
  );
}

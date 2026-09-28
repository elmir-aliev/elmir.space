import { Header } from "./components/Header";
import { Hero } from "./components/Hero";
import { ScrollStem } from "./components/ScrollStem";
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
      <main className="site-main">
        <ScrollStem />
        <Hero />
        <Works />
        <Stack />
        <BurnSection />
        <Contact />
      </main>
    </>
  );
}

import { useReveal } from '../scroll/useReveal';

export function Contact() {
  const ref = useReveal({ threshold: 0.3 });

  return (
    <section ref={ref} className="contact" id="contact">
      <p className="contact__kicker reveal" style={{ '--i': 0 }}>
        Свободен для проектов
      </p>

      <h2 className="contact__title reveal" style={{ '--i': 1 }}>
        Давайте сделаем
        <br />
        что-то заметное
      </h2>

      <a className="contact__mail reveal" style={{ '--i': 2 }} href="mailto:elmir.aliev.1689@gmail.com">
        elmir.aliev.1689@gmail.com
      </a>

      <footer className="contact__footer reveal" style={{ '--i': 3 }}>
        <span>© {new Date().getFullYear()} Elmir</span>
        <span>React · Three.js · Lenis</span>
      </footer>
    </section>
  );
}

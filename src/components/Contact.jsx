import { useReveal } from '../scroll/useReveal';

export function Contact() {
  const ref = useReveal({ threshold: 0.3 });

  return (
    <>
      <section ref={ref} className="contact" id="contact">
        <p className="contact__kicker reveal" style={{ '--i': 0 }}>
          Свободен для проектов
        </p>

        <h2 className="contact__title reveal" style={{ '--i': 1 }}>
          Давайте сделаем
          <br />
          что-то <span>заметное</span>
        </h2>

        <a className="contact__mail reveal" style={{ '--i': 2 }} href="mailto:elmir.aliev.1689@gmail.com">
          elmir.aliev.1689@gmail.com
        </a>
      </section>

      <footer className="site-footer">
        <div className="site-footer__signature" aria-label="Elmir">ELMIR</div>
        <div className="site-footer__meta">
          <span>© {new Date().getFullYear()} Elmir</span>
          <a href="#top">Наверх ↑</a>
        </div>
      </footer>
    </>
  );
}

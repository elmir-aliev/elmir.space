import { useEffect, useRef } from 'react';
import { addTrack, scrollTo } from '../scroll/scrollEngine';

const links = [
  { id: 'works', label: 'Работы' },
  { id: 'process', label: 'Процесс' },
  { id: 'contact', label: 'Контакты' },
];

// Порог сдвига в px, после которого меняем направление — гасит дрожание.
const DIRECTION_STEP = 6;
// Ближе к верху страницы шапка видна всегда.
const TOP_ZONE = 80;

export function Header() {
  const ref = useRef(null);

  const handleClick = (event, id) => {
    event.preventDefault();
    scrollTo(`#${id}`);
  };

  // Шапка показывается только при прокрутке вверх, при прокрутке вниз прячется.
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    let y = window.scrollY;
    let anchor = y;
    let hidden = false;

    return addTrack({
      measure() {
        y = window.scrollY;
      },
      render() {
        const delta = y - anchor;
        let next = hidden;

        if (y <= TOP_ZONE) next = false;
        else if (delta > DIRECTION_STEP) next = true;
        else if (delta < -DIRECTION_STEP) next = false;

        if (Math.abs(delta) > DIRECTION_STEP) anchor = y;
        if (next === hidden) return;
        hidden = next;
        el.classList.toggle('header--hidden', hidden);
      },
    });
  }, []);

  return (
    <header ref={ref} className="header">
      <a className="header__logo" href="#top" onClick={(event) => handleClick(event, 'top')}>
        Elmir<span>.space</span>
      </a>

      <nav className="header__nav">
        {links.map(({ id, label }) => (
          <a key={id} href={`#${id}`} onClick={(event) => handleClick(event, id)}>
            {label}
          </a>
        ))}
      </nav>
    </header>
  );
}

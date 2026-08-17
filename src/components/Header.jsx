import { scrollTo } from '../scroll/scrollEngine';

const links = [
  { id: 'works', label: 'Работы' },
  { id: 'process', label: 'Процесс' },
  { id: 'contact', label: 'Контакты' },
];

export function Header() {
  const handleClick = (event, id) => {
    event.preventDefault();
    scrollTo(`#${id}`);
  };

  return (
    <header className="header">
      <a className="header__logo" href="#top" onClick={(event) => handleClick(event, 'top')}>
        Elmir<span>.dev</span>
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

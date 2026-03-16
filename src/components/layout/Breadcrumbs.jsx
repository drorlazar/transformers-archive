import { Link } from 'react-router-dom';
import './Breadcrumbs.css';

export default function Breadcrumbs({ items }) {
  if (!items || items.length === 0) return null;

  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <ol className="breadcrumbs__list">
        {items.map((item, i) => (
          <li key={i} className="breadcrumbs__item">
            {i > 0 && <span className="breadcrumbs__separator">/</span>}
            {item.to ? (
              <Link to={item.to} className="breadcrumbs__link">
                {item.label}
              </Link>
            ) : (
              <span className="breadcrumbs__current">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

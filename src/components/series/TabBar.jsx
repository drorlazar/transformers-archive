import { NavLink } from 'react-router-dom';
import './TabBar.css';

export default function TabBar({ slug }) {
  return (
    <nav className="tab-bar">
      <div className="tab-bar__inner">
        <NavLink to={`/series/${slug}`} end className="tab-bar__tab">
          Episodes
        </NavLink>
        <NavLink to={`/series/${slug}/characters`} className="tab-bar__tab">
          Characters
        </NavLink>
        <NavLink to={`/series/${slug}/media`} className="tab-bar__tab">
          Media
        </NavLink>
      </div>
    </nav>
  );
}

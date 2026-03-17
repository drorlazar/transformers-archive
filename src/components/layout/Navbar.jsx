import { Link, NavLink } from 'react-router-dom';
import './Navbar.css';

export default function Navbar() {
  return (
    <nav className="navbar">
      <div className="navbar__inner">
        <Link to="/" className="navbar__logo">
          <span className="navbar__logo-text">TRANSFORMERS</span>
        </Link>
        <div className="navbar__links">
          <NavLink to="/" className="navbar__link" end>
            Home
          </NavLink>
          <NavLink to="/about" className="navbar__link">
            About
          </NavLink>
        </div>
      </div>
    </nav>
  );
}

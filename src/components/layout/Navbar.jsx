import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import './Navbar.css';

export default function Navbar() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  function handleSearch(e) {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
      setSearchOpen(false);
      setQuery('');
    }
  }

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
          <button
            className="navbar__search-btn"
            onClick={() => setSearchOpen(!searchOpen)}
            aria-label="Search"
          >
            &#128269;
          </button>
        </div>
      </div>
      {searchOpen && (
        <form className="navbar__search-bar" onSubmit={handleSearch}>
          <input
            className="navbar__search-input"
            type="text"
            placeholder="Search series, characters, episodes..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <button className="navbar__search-submit" type="submit">Search</button>
        </form>
      )}
    </nav>
  );
}

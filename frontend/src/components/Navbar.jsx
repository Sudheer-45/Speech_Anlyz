import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import './Navbar.css';

function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <nav className="navbar">
      <div className="navbar-brand" data-tilt data-tilt-max="10">
        <Link to="/">Comm Analyzer</Link>
      </div>

      <button
        className={`menu-button ${isMenuOpen ? 'open' : ''}`}
        onClick={toggleMenu}
        aria-expanded={isMenuOpen ? "true" : "false"}
        aria-label="Toggle navigation"
        data-tilt
        data-tilt-max="10"
      >
        <span className="hamburger-line"></span>
        <span className="hamburger-line"></span>
        <span className="hamburger-line"></span>
      </button>

      <ul className={`navbar-links ${isMenuOpen ? 'open' : ''}`}>
        <li><Link to="/" onClick={() => setIsMenuOpen(false)} data-tilt data-tilt-max="10">Home</Link></li>
        <li><Link to="/about" onClick={() => setIsMenuOpen(false)} data-tilt data-tilt-max="10">About</Link></li>
        <li><Link to="/login" onClick={() => setIsMenuOpen(false)} data-tilt data-tilt-max="10">Login</Link></li>
        <li><Link to="/signup" onClick={() => setIsMenuOpen(false)} data-tilt data-tilt-max="10">Sign Up</Link></li>
      </ul>
    </nav>
  );
}

export default Navbar;
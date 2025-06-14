// frontend/src/components/AuthenticatedNavbar.jsx

import React, { useState } from 'react'; // Import useState
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navbar.css'; // Your existing CSS file

function AuthenticatedNavbar() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false); // State to manage mobile menu visibility

  const handleLogout = () => {
    logout();
    navigate('/'); // Navigates to the root (login/landing) page
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <Link to="/app">Comm Analyzer</Link> {/* Your brand link */}
      </div>

      {/* Hamburger menu button for smaller screens */}
      <button 
        className={`menu-button ${isMenuOpen ? 'open' : ''}`} // Add 'open' class for animation
        onClick={toggleMenu} 
        aria-expanded={isMenuOpen ? "true" : "false"} 
        aria-label="Toggle navigation"
      >
        <span className="hamburger-line"></span>
        <span className="hamburger-line"></span>
        <span className="hamburger-line"></span>
      </button>

      {/* Navigation links - dynamically apply 'open' class to the ul */}
      <ul className={`navbar-links ${isMenuOpen ? 'open' : ''}`}>
        <li><Link to="/app" onClick={() => setIsMenuOpen(false)}>Home</Link></li>
        <li><Link to="/app/results" onClick={() => setIsMenuOpen(false)}>Results</Link></li>
        <li><Link to="/app/dashboard" onClick={() => setIsMenuOpen(false)}>Dashboard</Link></li>
        <li><Link to="/app/profile" onClick={() => setIsMenuOpen(false)}>Profile</Link></li>
        <li><Link to="/app/tutor" onClick={ () => setIsMenuOpen(false)}>Tutor</Link></li>
        <li><button onClick={handleLogout} className="navbar-logout-btn"><b>Logout</b></button></li>
      </ul>
    </nav>
  );
}

export default AuthenticatedNavbar;
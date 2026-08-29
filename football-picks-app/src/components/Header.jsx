import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  return (
    <header className="header">
      <div className="header-container">
        <Link to="/" className="header-title" onClick={closeMenu}>
          <img src="/images/logo.png" alt="Football Picks" className="header-logo" />
          Football Picks
        </Link>

        {/* Desktop Navigation */}
        <nav className="desktop-nav">
          <Link to="/make-picks" className="nav-link">Make Picks</Link>
          <Link to="/weekly-standings" className="nav-link">Weekly Standings</Link>
          <Link to="/overall-standings" className="nav-link">Overall Standings</Link>
          {isAdmin && (
            <Link to="/admin" className="nav-link admin-link">Admin</Link>
          )}
          <button onClick={handleLogout} className="nav-link logout-btn">Logout</button>
        </nav>

        {/* Mobile Menu Button */}
        <button className="mobile-menu-btn" onClick={toggleMenu}>
          {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

      </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <nav className="mobile-nav">
            <Link to="/make-picks" className="mobile-nav-link" onClick={closeMenu}>
              Make Picks
            </Link>
            <Link to="/weekly-standings" className="mobile-nav-link" onClick={closeMenu}>
              Weekly Standings
            </Link>
            <Link to="/overall-standings" className="mobile-nav-link" onClick={closeMenu}>
              Overall Standings
            </Link>
            {isAdmin && (
              <Link to="/admin" className="mobile-nav-link admin-link" onClick={closeMenu}>
                Admin
              </Link>
            )}
            <button onClick={handleLogout} className="mobile-nav-link logout-btn">
              Logout
            </button>
          </nav>
        )}

      <style jsx="true">{`
        .header {
          background: rgba(255, 255, 255, 0.1);
          -webkit-backdrop-filter: blur(20px);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.2);
          position: sticky;
          top: 0;
          z-index: 1000;
        }

        /* Mobile-specific header fixes */
        @media (max-width: 768px) {
          .header {
            position: sticky !important;
            top: 0 !important;
            z-index: 1000 !important;
            /* Prevent header from causing scroll offset.
               No will-change here: combined with position:sticky it makes the
               blurred header jitter while scrolling on iOS. */
            transform: translateZ(0) !important;
            -webkit-transform: translateZ(0) !important;
          }
        }

        .header-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 1rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .header-title {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: white;
          text-decoration: none;
          font-size: 1.5rem;
          font-weight: 700;
          transition: transform 0.3s ease, background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease, color 0.3s ease, opacity 0.3s ease;
        }

        .header-title:hover {
          color: rgba(150, 200, 255, 1);
        }

        .header-logo {
          width: 48px;
          height: 48px;
          margin-right: 0.75rem;
        }

        @media (min-width: 768px) {
          .header-logo {
            width: 64px;
            height: 64px;
          }
        }

        .desktop-nav {
          display: none;
          align-items: center;
          gap: 2rem;
        }

        @media (min-width: 768px) {
          .desktop-nav {
            display: flex;
          }
        }

        .nav-link {
          color: rgba(255, 255, 255, 0.8);
          text-decoration: none;
          font-weight: 500;
          transition: transform 0.3s ease, background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease, color 0.3s ease, opacity 0.3s ease;
          background: none;
          border: none;
          cursor: pointer;
          font-size: 1rem;
        }

        .nav-link:hover {
          color: rgba(150, 200, 255, 1);
        }

        .logout-btn {
          color: rgba(255, 150, 150, 0.8);
        }

        .logout-btn:hover {
          color: rgba(255, 150, 150, 1);
        }

        .admin-link {
          color: rgba(255, 215, 0, 0.8);
        }

        .admin-link:hover {
          color: rgba(255, 215, 0, 1);
        }

        .mobile-menu-btn {
          display: block;
          background: none;
          border: none;
          color: white;
          cursor: pointer;
          padding: 0.5rem;
          border-radius: 8px;
          transition: transform 0.3s ease, background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease, color 0.3s ease, opacity 0.3s ease;
        }

        .mobile-menu-btn:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        @media (min-width: 768px) {
          .mobile-menu-btn {
            display: none;
          }
        }


        .mobile-nav {
          background: rgba(255, 255, 255, 0.1);
          -webkit-backdrop-filter: blur(20px);
          backdrop-filter: blur(20px);
          border-top: 1px solid rgba(255, 255, 255, 0.2);
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        @media (min-width: 768px) {
          .mobile-nav {
            display: none;
          }
        }

        .mobile-nav-link {
          color: rgba(255, 255, 255, 0.8);
          text-decoration: none;
          font-weight: 500;
          padding: 0.75rem;
          border-radius: 8px;
          transition: transform 0.3s ease, background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease, color 0.3s ease, opacity 0.3s ease;
          background: none;
          border: none;
          cursor: pointer;
          font-size: 1rem;
          text-align: left;
        }

        .mobile-nav-link:hover {
          background: rgba(255, 255, 255, 0.1);
          color: rgba(150, 200, 255, 1);
        }

        .mobile-nav-link.auto-pick-button {
          background: linear-gradient(135deg, rgba(100, 150, 255, 0.3), rgba(150, 200, 255, 0.2));
          -webkit-backdrop-filter: blur(20px);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(100, 150, 255, 0.4);
          color: white;
          font-weight: 600;
          text-align: center;
          margin: 0.5rem 0;
          box-shadow: 
            0 4px 16px rgba(100, 150, 255, 0.2),
            0 0 20px rgba(100, 150, 255, 0.1),
            inset 0 1px 0 rgba(255, 255, 255, 0.2);
        }

        .mobile-nav-link.auto-pick-button:hover {
          background: linear-gradient(135deg, rgba(100, 150, 255, 0.4), rgba(150, 200, 255, 0.3));
          border-color: rgba(100, 150, 255, 0.6);
          color: white;
          transform: translateY(-2px);
          box-shadow: 
            0 8px 25px rgba(100, 150, 255, 0.4),
            0 0 30px rgba(100, 150, 255, 0.2),
            inset 0 1px 0 rgba(255, 255, 255, 0.3);
        }
      `}</style>
    </header>
  );
}

export default Header;
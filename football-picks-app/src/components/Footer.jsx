import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function Footer() {
  const { logout } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-links">
          <Link to="/" className="footer-link">Home</Link>
          <Link to="/weekly-standings" className="footer-link">Weekly Standings</Link>
          <Link to="/overall-standings" className="footer-link">Overall Standings</Link>
          <Link to="/team-stats" className="footer-link">Team Stats</Link>
          <button onClick={handleLogout} className="footer-link logout-btn">
            Logout
          </button>
        </div>
        <div className="footer-text">
          <p>&copy; {new Date().getFullYear()} Football Picks. All rights reserved.</p>
        </div>
      </div>

      <style jsx="true">{`
        .footer {
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(20px);
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          margin-top: auto;
        }

        .footer-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 2rem 1rem;
          text-align: center;
        }

        .footer-links {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 2rem;
          margin-bottom: 1rem;
        }

        @media (max-width: 768px) {
          .footer-links {
            flex-direction: column;
            gap: 1rem;
          }
        }

        .footer-link {
          color: rgba(255, 255, 255, 0.7);
          text-decoration: none;
          font-weight: 500;
          transition: all 0.3s ease;
          background: none;
          border: none;
          cursor: pointer;
          font-size: 1rem;
        }

        .footer-link:hover {
          color: rgba(150, 200, 255, 1);
        }

        .logout-btn {
          color: rgba(255, 150, 150, 0.7);
        }

        .logout-btn:hover {
          color: rgba(255, 150, 150, 1);
        }

        .footer-text {
          color: rgba(255, 255, 255, 0.5);
          font-size: 0.9rem;
        }
      `}</style>
    </footer>
  );
}

export default Footer;
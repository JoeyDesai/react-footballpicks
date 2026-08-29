import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Lock, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { sanitizeString, sanitizeFormData } from '../utils/sanitize';

function Login() {
  // Basic form state for email and password
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  // Fix mobile scroll position on mount
  useEffect(() => {
    // Ensure page starts at top on mobile devices
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                     window.innerWidth <= 768 || 
                     ('ontouchstart' in window);
    
    if (isMobile) {
      // Force scroll to top immediately
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      
      // Also set on window load to handle any delayed rendering
      const handleLoad = () => {
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      };
      
      window.addEventListener('load', handleLoad);
      
      // Cleanup
      return () => {
        window.removeEventListener('load', handleLoad);
      };
    }
  }, []);

  // Handle input changes and clean the data
  const handleChange = (e) => {
    const sanitizedValue = sanitizeString(e.target.value);
    setFormData({
      ...formData,
      [e.target.name]: sanitizedValue
    });
    setError('');
  };

  // Submit the login form and handle the response
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Sanitize form data before submission
    const sanitizedFormData = sanitizeFormData(formData);
    const result = await login(sanitizedFormData.email, sanitizedFormData.password);
    
    if (!result.success) {
      setError(sanitizeString(result.error || 'Login failed'));
    }
    
    setLoading(false);
  };

  return (
    <div className="login-container">
      <div className="login-card glass-container">
        <div className="login-header">
          <h1>Football Picks</h1>
          <p>Sign in to your account</p>
        </div>

        {/* Show error message if login fails */}
        {error && (
          <div className="error-message">
            <AlertCircle size={20} />
            <span>{sanitizeString(error)}</span>
          </div>
        )}

        {/* Main login form with username and password fields */}
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="email">Username</label>
            <div className="input-wrapper">
              <Mail className="input-icon" />
              <input
                type="text"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="glass-input"
                placeholder="Enter your username"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="input-wrapper">
              <Lock className="input-icon" />
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="glass-input"
                placeholder="Enter your password"
                required
              />
            </div>
          </div>

          {/* Submit button that shows loading state */}
          <button
            type="submit"
            className="glass-button primary w-full"
            disabled={loading}
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        {/* Link to create account page */}
        <div className="login-footer">
          <p>Don't have an account?</p>
          <Link to="/create-account" className="glass-button secondary">
            Create Account
          </Link>
        </div>
      </div>

      <style jsx="true">{`
        .login-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
        }

        .login-card {
          width: 100%;
          max-width: 400px;
          text-align: center;
        }

        .login-header {
          margin-bottom: 2rem;
        }


        .login-header h1 {
          font-size: 2rem;
          font-weight: 700;
          margin-bottom: 0.5rem;
          color: white;
        }

        .login-header p {
          color: rgba(255, 255, 255, 0.7);
          font-size: 1rem;
        }

        .error-message {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: rgba(255, 100, 100, 0.2);
          border: 1px solid rgba(255, 100, 100, 0.3);
          border-radius: 8px;
          padding: 1rem;
          margin-bottom: 1.5rem;
          color: rgba(255, 150, 150, 1);
        }

        .login-form {
          margin-bottom: 2rem;
        }

        .form-group {
          margin-bottom: 1.5rem;
          text-align: left;
        }

        .form-group label {
          display: block;
          margin-bottom: 0.5rem;
          color: rgba(255, 255, 255, 0.8);
          font-weight: 500;
        }

        .input-wrapper {
          position: relative;
          display: block;
          width: 100%;
        }

        .input-icon {
          position: absolute;
          left: 1rem;
          top: 50%;
          transform: translateY(-50%);
          color: rgba(255, 255, 255, 0.5);
          width: 20px;
          height: 20px;
        }

        .input-wrapper .glass-input {
          padding-left: 3rem;
        }

        .login-footer {
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          padding-top: 1.5rem;
        }

        .login-footer p {
          color: rgba(255, 255, 255, 0.7);
          margin-bottom: 1rem;
        }

        /* Mobile-specific fixes for input cursor positioning */
        @media (max-width: 768px) {
          .input-wrapper {
            position: relative;
            display: block;
            width: 100%;
            /* Remove any transform that might interfere */
            transform: none;
          }

          .input-wrapper .glass-input {
            font-size: 16px !important; /* Prevents zoom on iOS */
            -webkit-text-size-adjust: 100%;
            -webkit-user-select: text;
            -webkit-tap-highlight-color: transparent;
            line-height: 1.4;
            vertical-align: middle;
            /* Fix cursor positioning */
            position: relative;
            z-index: 1;
            display: block;
            width: 100%;
            margin: 0;
            /* Remove backdrop-filter on mobile to prevent cursor issues */
            -webkit-backdrop-filter: none;
            backdrop-filter: none;
            -webkit-backdrop-filter: none;
            /* Ensure proper text alignment */
            text-align: left;
            text-align: start;
          }

          .input-icon {
            z-index: 2;
            pointer-events: none;
            /* Ensure icon doesn't interfere with cursor */
            position: absolute;
            left: 1rem;
            top: 50%;
            transform: translateY(-50%);
          }

          /* Additional mobile input fixes */
          .glass-input:focus {
            /* Remove complex focus effects on mobile */
            outline: none;
            border-color: rgba(100, 150, 255, 0.6);
            box-shadow: 0 0 0 2px rgba(100, 150, 255, 0.2);
            background: rgba(255, 255, 255, 0.15);
            -webkit-backdrop-filter: none;
            backdrop-filter: none;
            -webkit-backdrop-filter: none;
          }
        }
      `}</style>
    </div>
  );
}

export default Login;
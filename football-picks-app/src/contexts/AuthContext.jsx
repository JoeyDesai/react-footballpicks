import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { authAPI } from '../services/api';
import { sanitizeUserData } from '../utils/sanitize';
import { isAdminUser, getNetworkErrorMessage } from '../config';
import config from '../config';

// Create the authentication context for managing user state across the application
const AuthContext = createContext();

/**
 * Custom hook to access the authentication context
 * @returns {Object} The authentication context containing user state and auth methods
 * @throws {Error} If used outside of an AuthProvider component
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

/**
 * Authentication provider component that manages user authentication state
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components to wrap with auth context
 * @returns {JSX.Element} AuthProvider component
 */
export function AuthProvider({ children }) {
  // State for current authenticated user (null if not logged in)
  const [user, setUser] = useState(null);
  // Loading state to prevent flash of unauthenticated content
  const [loading, setLoading] = useState(true);

  // Check authentication status on component mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  /**
   * Checks if there's an active user session by calling the backend
   * Sets user state if authenticated, otherwise keeps user as null
   */
  const checkAuthStatus = async () => {
    try {
      const response = await authAPI.checkSession();
      if (response.data && response.data.authenticated) {
        setUser(sanitizeUserData(response.data.user));
      }
    } catch (error) {
      console.log('No active session:', error.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Authenticates a user with email and password
   * @param {string} email - User's email address
   * @param {string} password - User's password
   * @returns {Object} Result object with success boolean and optional error message
   */
  const login = useCallback(async (email, password) => {
    try {
      const response = await authAPI.login(email, password);

      if (response.data && response.data.success) {
        setUser(sanitizeUserData(response.data.user));
        return { success: true };
      } else {
        return { success: false, error: response.data?.error || config.errors.invalidCredentials };
      }
    } catch (error) {
      console.error('Login error:', error);
      if (error.response && error.response.data && error.response.data.error) {
        return { success: false, error: error.response.data.error };
      }
      return { success: false, error: getNetworkErrorMessage() };
    }
  }, []);

  /**
   * Logs out the current user by clearing the session and user state
   * Always clears user state even if backend logout fails
   */
  const logout = useCallback(async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
    }
  }, []);

  /**
   * Creates a new user account
   * @param {Object} userData - User registration data (email, password, etc.)
   * @returns {Object} Result object with success boolean and optional error message
   */
  const createAccount = useCallback(async (userData) => {
    try {
      const response = await authAPI.createAccount(userData);
      if (response.data && response.data.success) {
        return { success: true };
      } else {
        return { success: false, error: response.data?.error || config.errors.accountCreationFailed };
      }
    } catch (error) {
      console.error('Create account error:', error);
      if (error.response && error.response.data && error.response.data.error) {
        return { success: false, error: error.response.data.error };
      }
      return { success: false, error: getNetworkErrorMessage() };
    }
  }, []);

  // Check if current user has admin privileges based on email
  const isAdmin = user && isAdminUser(user.email);

  // Context value object containing all authentication state and methods
  // Memoized so consumers only re-render when auth state actually changes
  const value = useMemo(() => ({
    user,           // Current authenticated user object (null if not logged in)
    login,          // Function to authenticate user with email/password
    logout,         // Function to log out current user
    createAccount,  // Function to create new user account
    loading,        // Boolean indicating if auth status is being checked
    isAdmin         // Boolean indicating if current user has admin privileges
  }), [user, login, logout, createAccount, loading, isAdmin]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
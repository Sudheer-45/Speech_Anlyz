// frontend/src/context/AuthContext.js
import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // This function will verify the token with the backend and fetch user details
  const checkAuth = useCallback(async () => {
    setLoading(true); // Always set loading to true when starting auth check
    const token = localStorage.getItem('token');

    if (token) {
      try {
        // IMPORTANT: You'll need a backend endpoint like /api/auth/me
        // to verify the token and return user data based on the token.
        const response = await axios.get('http://localhost:5000/api/auth/me', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setIsAuthenticated(true);
        setUser(response.data.user); // Assuming your backend sends { user: { ... } }
      } catch (error) {
        console.error('Token validation failed:', error);
        localStorage.removeItem('token'); // Token is invalid, remove it
        setIsAuthenticated(false);
        setUser(null);
      }
    } else {
      // No token found
      setIsAuthenticated(false);
      setUser(null);
    }
    setLoading(false); // Set loading to false once check is complete
  }, []); // useCallback with empty dependency array to memoize the function

  // UseEffect to run checkAuth when the component mounts or `checkAuth` itself changes (it won't change here)
  useEffect(() => {
    checkAuth();
  }, [checkAuth]); // Depend on checkAuth to prevent infinite loop/stale closure

  // Function to trigger re-authentication check manually (e.g., after profile update)
  const recheckAuth = () => {
    checkAuth();
  };

  const login = async (token, userData) => {
    localStorage.setItem('token', token);
    // Directly set state, then recheck to ensure consistency with backend
    setIsAuthenticated(true);
    setUser(userData);
    recheckAuth(); // Recheck immediately after login
  };

  const logout = () => {
    localStorage.removeItem('token');
    setIsAuthenticated(false);
    setUser(null);
    recheckAuth(); // Recheck immediately after logout (optional but good practice)
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout, loading, recheckAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
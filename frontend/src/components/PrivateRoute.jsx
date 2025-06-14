import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useEffect,useState } from 'react';
import { useAuth } from '../context/AuthContext';

const PrivateRoute = () => {
  const { isAuthenticated, loading } = useAuth();

  const LoadingSpinner = () => (
    <div className="loading-overlay" aria-live="polite">
        <div className="spinner"></div>
        <span className="sr-only">Loading content...</span>
    </div>
);

const [isLoading, setIsLoading] = useState(true);
  
      useEffect(() => {
          // Simulate loading delay for UX
          const timer = setTimeout(() => {
              setIsLoading(false);
          }, 400);
          return () => clearTimeout(timer);
      }, []);


  if (loading) {
    return <div><LoadingSpinner/>Loading authentication...</div>; // Or a spinner
  }

  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
};

export default PrivateRoute;
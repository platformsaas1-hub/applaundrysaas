import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LoadingScreen } from '../common/LoadingScreen';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * Access controller guarding authenticated routes.
 * Handles three primary login branches:
 * 1. Fully logged out -> Force redirects to /login
 * 2. Authenticated but has NO tenant profile -> Redirects to /register-enterprise
 * 3. Fully authenticated and profile exists -> Render requested workspace route
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { currentUser, userProfile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingScreen label="Menyiapkan data sesi Anda..." />;
  }

  if (!currentUser) {
    // Redirect to login page but preserve prior location
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!userProfile) {
    // Authenticated Google account but has not initialized a business tenant workspace yet
    if (location.pathname !== '/register-enterprise') {
      return <Navigate to="/register-enterprise" replace />;
    }
  } else {
    // Already populated enterprise but trying to navigate to onboarding
    if (location.pathname === '/register-enterprise') {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
}

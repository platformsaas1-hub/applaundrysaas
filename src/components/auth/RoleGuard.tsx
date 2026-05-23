import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';
import { LoadingScreen } from '../common/LoadingScreen';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
}

/**
 * Access controller guarding role restricted routes.
 * Forces redirect to /unauthorized if user's role does not meet criteria.
 */
export function RoleGuard({ children, allowedRoles }: RoleGuardProps) {
  const { userProfile, loading } = useAuth();

  if (loading) {
    return <LoadingScreen label="Mengevaluasi otoritas hak akses..." />;
  }

  if (!userProfile) {
    return <Navigate to="/register-enterprise" replace />;
  }

  const roleApproved = allowedRoles.includes(userProfile.role);

  if (!roleApproved) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}

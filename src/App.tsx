import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { TenantProvider } from './context/TenantContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { RoleGuard } from './components/auth/RoleGuard';
import { DashboardLayout } from './components/layout/DashboardLayout';

// Pages
import { AuthPage } from './pages/AuthPage';
import { Dashboard } from './pages/Dashboard';
import { POSPage } from './pages/POSPage';
import { QueuesPage } from './pages/QueuesPage';
import { CustomersPage } from './pages/CustomersPage';
import { ServicesPage } from './pages/ServicesPage';
import { UnauthorizedPage } from './pages/UnauthorizedPage';
import { FinancialsPage } from './pages/FinancialsPage';
import { AutomationCenterPage } from './pages/AutomationCenterPage';

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <TenantProvider>
          <Router>
            <Routes>
              {/* Public Authentication gate */}
              <Route path="/login" element={<AuthPage />} />
              
              {/* Isolated New Owner Registration Portal */}
              <Route 
                path="/register-enterprise" 
                element={
                  <ProtectedRoute>
                    <AuthPage onboardingOnly={true} />
                  </ProtectedRoute>
                } 
              />

              {/* Secure Dashboard Workspace layout */}
              <Route 
                element={
                  <ProtectedRoute>
                    <DashboardLayout />
                  </ProtectedRoute>
                }
              >
                {/* 1. Dashboard summary home */}
                <Route path="/dashboard" element={<Dashboard />} />
                
                {/* 2. Point of sale checkout */}
                <Route 
                  path="/pos" 
                  element={
                    <RoleGuard allowedRoles={['owner', 'admin', 'kasir']}>
                      <POSPage />
                    </RoleGuard>
                  } 
                />

                {/* 3. Operational conveyor queues */}
                <Route path="/queues" element={<QueuesPage />} />

                {/* 4. CRM Client maps */}
                <Route 
                  path="/customers" 
                  element={
                    <RoleGuard allowedRoles={['owner', 'admin', 'kasir']}>
                      <CustomersPage />
                    </RoleGuard>
                  } 
                />

                {/* 5. Tariff and branches configurators */}
                <Route 
                  path="/services" 
                  element={
                    <RoleGuard allowedRoles={['owner', 'admin']}>
                      <ServicesPage />
                    </RoleGuard>
                  } 
                />

                {/* 6. Unauthorized access warning banner layout */}
                <Route path="/unauthorized" element={<UnauthorizedPage />} />
                
                {/* 7. Financial cockpit (Expenses + Cashflow + Shifts) */}
                <Route 
                  path="/financials" 
                  element={
                    <RoleGuard allowedRoles={['owner', 'admin']}>
                      <FinancialsPage />
                    </RoleGuard>
                  } 
                />

                {/* 8. Automation Center Dashboard */}
                <Route 
                  path="/automation" 
                  element={
                    <RoleGuard allowedRoles={['owner', 'admin']}>
                      <AutomationCenterPage />
                    </RoleGuard>
                  } 
                />
                
                {/* Dynamic Fallback within Dashboard frame */}
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
              </Route>

              {/* Dynamic Global fallback route redirection */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Router>
        </TenantProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

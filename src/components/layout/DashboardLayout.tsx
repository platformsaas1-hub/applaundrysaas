import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useTenant } from '../../context/TenantContext';
import { LoadingScreen } from '../common/LoadingScreen';

/**
 * responsive layout containing Sidebar, Header, and Child router views.
 */
export function DashboardLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { loadingTenant } = useTenant();

  if (loadingTenant) {
    return <LoadingScreen label="Menyiapkan data outlet & layanan..." />;
  }

  return (
    <div className="flex h-screen w-screen bg-slate-50 overflow-hidden font-sans text-slate-800">
      
      {/* 1. SIDEBAR NAVIGATION CONTAINER */}
      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
      />

      {/* 2. CORE WORKSPACE WRAPPER */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden h-full">
        
        {/* Dynamic header navbar */}
        <Header onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)} />

        {/* 3. CHILD ROUTE GRID VIEWSPACE */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50">
          <Outlet />
        </main>
      </div>

    </div>
  );
}

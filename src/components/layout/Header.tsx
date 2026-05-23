import React from 'react';
import { Menu, Wifi, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';

interface HeaderProps {
  onMenuToggle: () => void;
}

export function Header({ onMenuToggle }: HeaderProps) {
  const { userProfile } = useAuth();
  const { outlets, activeOutletId, switchActiveOutlet } = useTenant();

  const handleBranchChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    try {
      await switchActiveOutlet(e.target.value);
    } catch (error) {
      console.error("Failed to switch working outlet context:", error);
    }
  };

  const userInitial = userProfile?.name?.charAt(0).toUpperCase() || 'U';

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-6 shrink-0 relative z-10 shadow-3xs">
      
      {/* Header Left: Hamburger Toggle & Branch switcher */}
      <div className="flex items-center gap-3">
        {/* Toggle Burger on mobile viewports */}
        <button
          onClick={onMenuToggle}
          className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg md:hidden hover:bg-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <Menu className="w-5.5 h-5.5" />
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider hidden lg:inline">
            Workspace:
          </span>
          <select
            value={activeOutletId || ''}
            onChange={handleBranchChange}
            className="bg-slate-150 hover:bg-slate-200 py-1.5 px-3 rounded-lg text-xs font-bold text-slate-700 border border-transparent focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {outlets.map((outlet) => (
              <option key={outlet.outletId} value={outlet.outletId}>
                {outlet.name}
              </option>
            ))}
          </select>
        </div>

        {/* Real-time sync status badges */}
        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[9px] font-bold font-mono tracking-wider rounded-md border border-emerald-100 uppercase">
          <Wifi className="w-3 h-3 text-emerald-600 animate-pulse" />
          <span>Synced</span>
        </span>
      </div>

      {/* Header Right: Role indicator & User display */}
      <div className="flex items-center gap-3">
        <div className="flex flex-col text-right items-end">
          <span className="text-[11px] font-extrabold text-slate-800 capitalize leading-snug">
            {userProfile?.name}
          </span>
          <span className="text-[9px] font-mono tracking-wider font-extrabold text-blue-600 uppercase bg-blue-50 px-1.5 py-0.5 rounded-sm">
            {userProfile?.role}
          </span>
        </div>

        {/* Avatar bubble */}
        <div 
          className="h-9 w-9 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-extrabold border-2 border-white shadow-xs"
          title={`Masuk sebagai ${userProfile?.role}`}
        >
          {userInitial}
        </div>
      </div>
    </header>
  );
}

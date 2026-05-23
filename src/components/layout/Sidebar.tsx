import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { 
  LayoutDashboard, 
  CreditCard, 
  Layers, 
  Users, 
  Sliders, 
  LogOut,
  X,
  Building,
  DollarSign,
  Zap
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { userProfile, logout } = useAuth();
  const { tenant } = useTenant();

  // Role check helper
  const isStaffOnly = userProfile?.role === 'kasir' || userProfile?.role === 'pegawai';

  const menuItems = [
    {
      to: '/dashboard',
      label: 'Ringkasan Dashboard',
      icon: LayoutDashboard,
      allowedRoles: ['owner', 'admin', 'kasir', 'pegawai']
    },
    {
      to: '/pos',
      label: 'Point of Sale (POS)',
      icon: CreditCard,
      allowedRoles: ['owner', 'admin', 'kasir']
    },
    {
      to: '/queues',
      label: 'Antrean Laundry',
      icon: Layers,
      allowedRoles: ['owner', 'admin', 'kasir', 'pegawai']
    },
    {
      to: '/customers',
      label: 'Daftar Pelanggan',
      icon: Users,
      allowedRoles: ['owner', 'admin', 'kasir']
    },
    {
      to: '/services',
      label: 'Tarif & Cabang',
      icon: Sliders,
      allowedRoles: ['owner', 'admin']
    },
    {
      to: '/financials',
      label: 'Keuangan & Shift',
      icon: DollarSign,
      allowedRoles: ['owner', 'admin', 'kasir']
    },
    {
      to: '/automation',
      label: 'Automation Center',
      icon: Zap,
      allowedRoles: ['owner', 'admin', 'kasir']
    }
  ];

  const sidebarClasses = `
    fixed top-0 bottom-0 left-0 z-40 w-64 bg-slate-900 border-r border-slate-800 text-slate-300 flex flex-col justify-between select-none transition-transform duration-350 ease-in-out
    md:translate-x-0 md:static md:h-screen
    ${isOpen ? 'translate-x-0' : '-translate-x-full'}
  `;

  return (
    <>
      {/* Mobile Drawer Overlay Backdrops */}
      {isOpen && (
        <div 
          onClick={onClose}
          className="fixed inset-0 z-30 bg-slate-950/60 backdrop-blur-xs md:hidden"
        />
      )}

      <aside className={sidebarClasses}>
        <div>
          {/* Header section with closing button on Mobile */}
          <div className="p-5 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 bg-blue-600 rounded-lg flex items-center justify-center font-extrabold text-white text-lg shadow-inner tracking-tight">
                🧺
              </div>
              <div>
                <h1 className="text-sm font-extrabold text-white tracking-tight leading-tight">
                  LaundryKu
                </h1>
                <p className="text-[9px] uppercase tracking-widest text-slate-500 font-bold">
                  SaaS Enterprise
                </p>
              </div>
            </div>
            
            <button 
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-white rounded-lg md:hidden hover:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-500"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation link menu items */}
          <nav className="p-4 space-y-1">
            {menuItems.map((item, index) => {
              // Hide navigation links user has no permission for
              const hasAccess = userProfile?.role && item.allowedRoles.includes(userProfile.role);
              if (!hasAccess) return null;

              const Icon = item.icon;

              return (
                <NavLink
                  key={index}
                  to={item.to}
                  onClick={onClose}
                  className={({ isActive }) => `
                    w-full px-3 py-2.5 rounded-lg flex items-center gap-3 font-bold text-xs uppercase tracking-wide transition-all
                    ${isActive 
                      ? 'bg-blue-600 text-white shadow-md' 
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'}
                  `}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Tenant status & settings footer */}
        <div className="p-4 border-t border-slate-800 space-y-3.5 bg-slate-950/25">
          <div className="flex flex-col gap-1.5 p-2 bg-slate-850/50 rounded-lg border border-slate-800 text-xs">
            <div className="flex items-center gap-1.5 text-slate-505">
              <Building className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
                Profil Tenant
              </span>
            </div>
            <span className="font-extrabold text-blue-400 font-sans truncate">
              {tenant?.businessName || "Memuat tenant..."}
            </span>
            <div className="flex justify-between items-center text-[9px] font-mono mt-1">
              <span className="text-slate-500">SaaS Plan:</span>
              <span className="text-emerald-500 uppercase bg-emerald-500/10 px-1 rounded font-bold">
                {tenant?.plan || "free"} plan
              </span>
            </div>
          </div>

          <button
            onClick={() => logout()}
            className="w-full px-3 py-2 rounded-lg flex items-center justify-center gap-2 font-bold text-xs uppercase tracking-wider text-rose-400 bg-rose-950/20 border border-rose-900/30 hover:bg-rose-950/40 hover:text-rose-300 transition-all focus:outline-none focus:ring-1 focus:ring-rose-500"
          >
            <LogOut className="w-4 h-4" />
            <span>Keluar Sesi</span>
          </button>
        </div>
      </aside>
    </>
  );
}

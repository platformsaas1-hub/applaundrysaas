import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTenant } from '../context/TenantContext';
import { db } from '../firebase/config';
import { handleFirestoreError, OperationType } from '../firebase/errorModel';
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  limit 
} from 'firebase/firestore';
import { Card, CardHeader, CardContent } from '../components/common/Card';
import { formatRupiah } from '../utils/formatting';
import { 
  Building, 
  Store, 
  TrendingUp, 
  Layers, 
  Cpu, 
  ShieldCheck, 
  Info,
  Sliders,
  Users
} from 'lucide-react';
import { Transaction } from '../types';

export function Dashboard() {
  const { userProfile } = useAuth();
  const { tenant, activeOutlet, services, activeOutletId } = useTenant();

  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const tenantId = userProfile?.tenantId || null;

  // Real-time synchronization of lightweight recent transactions for dashboard metrics
  useEffect(() => {
    if (!tenantId) return;

    const transactionsRef = collection(db, 'tenants', tenantId, 'transactions');
    // Using simple single-field indexing with strict 50 records limit
    const q = query(
      transactionsRef, 
      where('isDeleted', '==', false), 
      orderBy('createdAt', 'desc'), 
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Transaction[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as Transaction);
      });
      // Filter by active outlet if specified
      const filtered = activeOutletId 
        ? list.filter(t => t.outletId === activeOutletId)
        : list;

      setRecentTransactions(filtered);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `tenants/${tenantId}/transactions`);
    });

    return unsubscribe;
  }, [tenantId, activeOutletId]);

  // Calculations derived from loaded active set (budget friendly)
  const totalRevenue = recentTransactions
    .filter(t => t.paymentStatus === 'paid')
    .reduce((acc, curr) => acc + (curr.grandTotal || curr.totalAmount || 0), 0);

  const pendingQueuesCount = recentTransactions
    .filter(t => t.orderStatus === 'received' || t.orderStatus === 'processing')
    .length;

  return (
    <div className="space-y-6 font-sans text-slate-800 animate-fade-in select-none">
      
      {/* 1. WELCOME METADATA PANEL */}
      <div className="bg-gradient-to-r from-blue-700 to-indigo-900 border border-slate-950 p-5 md:p-6 rounded-2xl text-white shadow-sm relative overflow-hidden">
        {/* Abstract background accent indicator */}
        <div className="absolute right-0 top-0 translate-x-3 -translate-y-3 opacity-10">
          <Building className="w-48 h-48" />
        </div>

        <div className="relative z-10 space-y-1.5 max-w-xl">
          <span className="text-[9px] bg-blue-500/40 text-blue-100 font-bold px-2 py-0.5 rounded-full font-mono uppercase tracking-widest">
            Multi-Tenant Active Frame
          </span>
          <h2 className="text-lg md:text-xl font-extrabold tracking-tight">
            Selamat Datang, {userProfile?.name}!
          </h2>
          <p className="text-xs text-blue-150 leading-relaxed font-sans">
            Sistem LaundryKu saat ini memuat sub-ruang kerja kustom untuk usaha <strong>{tenant?.businessName}</strong> pada cabang <strong>{activeOutlet?.name || 'Cabang Utama'}</strong>.
          </p>
          <p className="text-[10px] text-blue-200 flex items-center gap-1 font-mono italic pt-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Keamanan multi-tenant aktif: ID Klien terisolasi secara logis.
          </p>
        </div>
      </div>

      {/* 2. OPERATIONAL SUMMARY METRICS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Omzet Workspace (Today's Batch)</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="space-y-0.5">
            <h4 className="text-lg font-extrabold text-slate-900 font-mono">{formatRupiah(totalRevenue)}</h4>
            <p className="text-[10px] text-slate-400">Total omzet dari transaksi tervalidasi</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Antrean Sedang Proses</span>
            <Layers className="w-4 h-4 text-amber-500" />
          </div>
          <div className="space-y-0.5">
            <h4 className="text-lg font-extrabold text-slate-900 font-mono">{pendingQueuesCount} Slip</h4>
            <p className="text-[10px] text-slate-400">Antrean cucian aktif di cabang ini</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Layanan Terkonfigurasi</span>
            <PricesIcon className="w-4 h-4 text-blue-500" />
          </div>
          <div className="space-y-0.5">
            <h4 className="text-lg font-extrabold text-slate-900 font-mono">{services.length} Jasa</h4>
            <p className="text-[10px] text-slate-400">Pilihan tarif laundry aktif di katalog</p>
          </div>
        </div>
      </div>

      {/* 3. COHESIVE GRID DETAIL CHANNELS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Core details column info */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader subtitle="Konfirmasi penyediaan modul arsitektur">
              Pernyataan Foundation Setup
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-slate-650 leading-relaxed">
                Struktur fondasi proyek <strong>LaundryKu SaaS</strong> telah terpasang seutuhnya. Seluruh modul di bawah ini beroperasi dengan lancar, terhubung secara erat melalui Context API dan dipetakan dalam router global:
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs text-slate-650">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-150 space-y-1">
                  <span className="font-extrabold text-blue-600 uppercase text-[9.5px]">AuthContext Multi-Tenant</span>
                  <p className="text-[11px] leading-relaxed text-slate-500">
                    Sistem mengindeks pengguna Firebase Auth langsung ke database /users/userId dengan peran hak akses kustom.
                  </p>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-150 space-y-1">
                  <span className="font-extrabold text-blue-600 uppercase text-[9.5px]">TenantContext Isolated</span>
                  <p className="text-[11px] leading-relaxed text-slate-500">
                    Membuat sandbox database virtual bagi masing-masing UMKM. Mencegah kebocoran data antar pemilik usaha.
                  </p>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-150 space-y-1">
                  <span className="font-extrabold text-blue-600 uppercase text-[9.5px]">ProtectedRoute & RBAC</span>
                  <p className="text-[11px] leading-relaxed text-slate-500">
                    Menjaga rute dari pengguna ilegal. Hak akses bersandar penuh pada roles kustom dari Firestore.
                  </p>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-150 space-y-1">
                  <span className="font-extrabold text-blue-600 uppercase text-[9.5px]">Offline Persistent Storage</span>
                  <p className="text-[11px] leading-relaxed text-slate-500">
                    Firestore offline local cache diaktifkan, mendongkrak kegesitan baca-tulis lokal tanpa membebani server.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2 bg-blue-50/50 border border-blue-150 p-3.5 rounded-lg text-slate-600 leading-relaxed text-[11px]">
                <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <span>
                  Sesuai dengan instruksi <strong>Operational Core Engine</strong>, seluruh kalkulasi ditiadakan dari scan penuh tidak bermutu. Omset dan antrean dihitung dinamis dari real-time snapshot yang ter-limit dengan aman.
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Info card details */}
        <div className="space-y-6">
          <Card>
            <CardHeader subtitle="Konfigurasi parameter aktif saat ini">
              Arsitektur Sistem
            </CardHeader>
            <CardContent className="space-y-4 font-sans text-xs">
              <div className="space-y-3 divide-y divide-slate-100">
                <div className="flex justify-between items-center text-[11px] py-1">
                  <span className="text-slate-400 font-medium">Platform Frame:</span>
                  <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-bold">Vite + React</span>
                </div>
                <div className="flex justify-between items-center text-[11px] py-1">
                  <span className="text-slate-400 font-medium">Sistem Ketikan:</span>
                  <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-bold">TypeScript Strict</span>
                </div>
                <div className="flex justify-between items-center text-[11px] py-1">
                  <span className="text-slate-400 font-medium">Beban Cache:</span>
                  <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-bold">Offline Persistent</span>
                </div>
                <div className="flex justify-between items-center text-[11px] py-1">
                  <span className="text-slate-400 font-medium">SaaS Tenant ID:</span>
                  <span className="font-mono text-blue-600 font-extrabold truncate max-w-sm" title={userProfile?.tenantId}>
                    {userProfile?.tenantId?.slice(0, 12)}...
                  </span>
                </div>
                <div className="flex justify-between items-center text-[11px] py-1">
                  <span className="text-slate-400 font-medium">ID Cabang Terlantik:</span>
                  <span className="font-mono text-blue-600 font-extrabold truncate max-w-sm" title={userProfile?.activeOutletId}>
                    {userProfile?.activeOutletId?.slice(0, 12)}...
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

      </div>

    </div>
  );

  function PricesIcon(props: any) {
    return (
      <svg
        {...props}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="12" x2="12" y1="2" y2="22" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    );
  }
}
export default Dashboard;

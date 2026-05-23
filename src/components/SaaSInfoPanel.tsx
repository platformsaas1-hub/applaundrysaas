import React from 'react';
import { QuotaTracker, UserRole } from '../types';

interface SaaSInfoPanelProps {
  quota: QuotaTracker;
  currentRole: UserRole;
  resetQuota: () => void;
}

export const SaaSInfoPanel: React.FC<SaaSInfoPanelProps> = ({
  quota,
  currentRole,
  resetQuota
}) => {
  const readPct = Math.min((quota.reads / 50000) * 100, 100);
  const writePct = Math.min((quota.writes / 20000) * 100, 100);

  return (
    <div id="saas-blueprint-sidebar" className="w-80 bg-white border border-slate-200 rounded-xl shadow-sm p-5 flex flex-col overflow-hidden shrink-0">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 bg-blue-600 rounded-full animate-pulse"></div>
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">SaaS Tech Blueprint</h3>
        </div>
        <button 
          onClick={resetQuota}
          className="text-[10px] text-slate-400 hover:text-blue-600 font-medium underline transition-all"
          title="Reset logging counter"
        >
          Reset Logs
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto pr-1 text-slate-700">
        {/* Live Spark Plan Log section */}
        <section className="bg-slate-50 border border-slate-100 p-3.5 rounded-lg">
          <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex justify-between">
            <span>Quota Usage Sim</span>
            <span className="text-blue-600 font-semibold">Spark Plan (Free)</span>
          </h4>
          
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1.5 font-medium">
                <span className="text-slate-600">Firestore Doc Reads</span>
                <span className="font-mono text-slate-800">{quota.reads} <span className="text-slate-400">/ 50k</span></span>
              </div>
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-sky-500 h-full transition-all duration-500" 
                  style={{ width: `${Math.max(readPct, 2)}%` }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1.5 font-medium">
                <span className="text-slate-600">Firestore Doc Writes</span>
                <span className="font-mono text-slate-800">{quota.writes} <span className="text-slate-400">/ 20k</span></span>
              </div>
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-emerald-500 h-full transition-all duration-500" 
                  style={{ width: `${Math.max(writePct, 2)}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div className="mt-3.5 pt-2.* border-t border-slate-100 flex items-center justify-between">
            <span className="text-[10px] text-slate-500 font-semibold uppercase">Quota Savings Advantage:</span>
            <span className="text-xs bg-emerald-100 text-emerald-800 font-bold font-mono px-1.5 py-0.5 rounded">
              +{quota.savedReads} Saved Reads
            </span>
          </div>
          <p className="text-[9px] text-slate-400 mt-1.5 italic leading-relaxed">
            Every view loads pre-aggregated harian reports instead of fetching all transaction logs.
          </p>
        </section>

        {/* Firestore Paths Definition */}
        <section>
          <h4 class="text-[11px] font-bold text-slate-400 mb-2 uppercase tracking-wide">Firestore Collections</h4>
          <div className="space-y-2 text-xs">
            <div className="p-2.5 bg-slate-50 rounded border border-slate-100">
              <span className="font-mono font-bold text-blue-600 text-[10.5px]">/users/{"{uid}"}</span>
              <p className="text-[10px] text-slate-500 mt-0.5">Role context binding. Role: <span className="text-blue-700 font-bold uppercase">{currentRole}</span></p>
            </div>
            <div className="p-2.5 bg-slate-50 rounded border border-slate-100">
              <span className="font-mono font-bold text-blue-600 text-[10.5px]">/tenants/{"{tenantId}"}/outlets</span>
              <p className="text-[10px] text-slate-500 mt-0.5">Physical sub-branches logic container.</p>
            </div>
            <div className="p-2.5 bg-slate-50 rounded border border-slate-100">
              <span className="font-mono font-bold text-blue-600 text-[10.5px]">/tenants/{"{tenantId}"}/transactions</span>
              <p className="text-[10px] text-slate-500 mt-0.5">POS receipts. Denormalized customer info cached in document.</p>
            </div>
            <div className="p-2.5 bg-slate-50 rounded border border-slate-100">
              <span className="font-mono font-bold text-blue-600 text-[10.5px]">/tenants/{"{tenantId}"}/dailyReports</span>
              <p className="text-[10px] text-slate-500 mt-0.5">Pre-calculated aggregates. Replaces expensive multi-doc scans.</p>
            </div>
          </div>
        </section>

        {/* Firestore Security Rules in focus */}
        <section className="space-y-2">
          <h4 class="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Security & ABAC Check</h4>
          <div className="p-3 bg-slate-900 text-slate-300 font-mono text-[10px] rounded-lg border border-slate-800 space-y-1">
            <p className="text-amber-400">match /transactions/{"{inv}"} &#123;</p>
            <p className="pl-2">allow read: if isSignedIn()</p>
            <p className="pl-4">&& user.tenantId == tenantId;</p>
            <p className="pl-2">allow update: if request.resource</p>
            <p className="pl-4">.diff(resource).affectedKeys()</p>
            <p className="pl-4 text-emerald-400">.hasOnly(['orderStatus', 'workerId'])</p>
            <p className="pl-2">|| <span className="text-slate-400">isAdminOrOwner();</span></p>
            <p className="text-amber-400">&#125;</p>
          </div>
          <div className="bg-amber-50 rounded border border-amber-200 p-2.5 text-[10px] text-amber-800">
            <strong>Role enforcement in action:</strong> 
            {currentRole === 'pegawai' ? (
              <span className="block mt-0.5">💡 Anda masuk sebagai <strong>Pegawai (Cuci)</strong>. Sistem membatasi Anda hanya bisa mengubah status cucian. Anda dicegah mencederai data harga transaksi.</span>
            ) : currentRole === 'kasir' ? (
              <span className="block mt-0.5">💡 Anda masuk sebagai <strong>Kasir</strong>. Anda dapat membuat Invoice baru di POS, menerima uang lunas, mengganti status, namun menu pengaturan harga dan cabang dinonaktifkan.</span>
            ) : (
              <span className="block mt-0.5">💡 Anda masuk sebagai <strong>Owner/Admin</strong>. Anda memegang kendali mutlak atas seluruh menu manajemen, penyesuaian tarif, pengaturan outlet, dan laporan agregasi.</span>
            )}
          </div>
        </section>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-slate-400 text-[10px]">
        <span>v1.0.0-MVP Stable</span>
        <div className="flex gap-1">
          <div className="h-1.5 w-1.5 rounded-full bg-slate-200"></div>
          <div className="h-1.5 w-1.5 rounded-full bg-slate-200"></div>
          <div className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-ping"></div>
        </div>
      </div>
    </div>
  );
};

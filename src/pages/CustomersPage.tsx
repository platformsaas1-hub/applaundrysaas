import React from 'react';
import { Card, CardHeader, CardContent } from '../components/common/Card';
import { Users, Info } from 'lucide-react';

export function CustomersPage() {
  return (
    <div className="space-y-6 font-sans text-slate-800 animate-fade-in select-none">
      <Card>
        <CardHeader subtitle="Data Profil CRM Pelanggan" action={<Users className="w-5 h-5 text-blue-500" />}>
          Daftar Pelanggan Setia
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-slate-650 leading-relaxed">
            Menyimpan histori profil kontak, alamat, dan preferensi parfum kustom pelanggan tetap (frequent buyers) untuk memfasilitasi pengetikan instan saat pencatatan transaksi kasir di POS.
          </p>

          <div className="bg-slate-50 border border-slate-205 p-4 rounded-xl text-xs space-y-1">
            <span className="font-extrabold text-blue-600 block text-[10px] uppercase tracking-wider">Integrasi Database:</span>
            <p className="text-slate-500">
              Profil pelanggan disimpan secara dinamis di bawah subkoleksi /tenants/tenantId/customers/customerId dengan indeks performa pencarian yang dimitigasi.
            </p>
          </div>

          <div className="flex items-start gap-2 bg-blue-50/50 border border-blue-150 p-3 rounded-lg text-[11px] text-slate-600">
            <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <span>Manajemen pelanggan diisolasi mutlak di dalam ruang data tenant Anda.</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
export default CustomersPage;

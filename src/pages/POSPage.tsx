import React from 'react';
import { Card, CardHeader, CardContent } from '../components/common/Card';
import { CreditCard, Info } from 'lucide-react';

export function POSPage() {
  return (
    <div className="space-y-6 font-sans text-slate-800 animate-fade-in select-none">
      <Card>
        <CardHeader subtitle="Modul Transaksi Point of Sale" action={<CreditCard className="w-5 h-5 text-blue-500" />}>
          Point of Sale (POS) - Kasir
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-slate-650 leading-relaxed">
            Halaman interface Point of Sale (POS) dirancang khusus untuk memotong lama antrean transaksi laundry kiloan dan satuan secara cepat. Modul ini beroperasi pada level transaksional cabang aktif.
          </p>

          <div className="bg-slate-50 border border-slate-205 p-4 rounded-xl text-xs space-y-1">
            <span className="font-extrabold text-blue-600 block text-[10px] uppercase tracking-wider">Langkah Selanjutnya:</span>
            <p className="text-slate-500">
              Modul transaksi dinamis, keranjang belanja (cart), kalkulasi diskon, integrasi printer nota termal bluetooth, dan re-calculators akan disusun rincinya pada fase pengembangan berikutnya.
            </p>
          </div>

          <div className="flex items-start gap-2 bg-blue-50/50 border border-blue-150 p-3 rounded-lg text-[11px] text-slate-600">
            <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <span>Fondasi otentikasi multi-tenant yang Anda susun siap dicolok langsung ke state checkout.</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
export default POSPage;

import React from 'react';
import { Card, CardHeader, CardContent } from '../components/common/Card';
import { Sliders, Info } from 'lucide-react';

export function ServicesPage() {
  return (
    <div className="space-y-6 font-sans text-slate-800 animate-fade-in select-none">
      <Card>
        <CardHeader subtitle="Konfigurasi Outlet Multi-Cabang & Layanan" action={<Sliders className="w-5 h-5 text-blue-500" />}>
          Tarif Jasa & Pengaturan Cabang
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-slate-650 leading-relaxed">
            Pintu gerbang untuk mengatur katalog laundry (kiloan, dry-cleaning, sepatu, jaket, dsb.) dan mendaftarkan outlet fisik baru di bawah satu tenant payung SaaS yang sama.
          </p>

          <div className="bg-slate-50 border border-slate-205 p-4 rounded-xl text-xs space-y-1">
            <span className="font-extrabold text-blue-600 block text-[10px] uppercase tracking-wider">Metode Akses:</span>
            <p className="text-slate-500">
              Halaman ini dibatasi keras oleh <strong>RoleGuard Real-time</strong>. Hanya pemegang hak kustom <strong>Owner (Pemilik Biz)</strong> dan <strong>Admin (Manager Utama)</strong> yang diizinkan untuk mengubah nilai biaya operasional.
            </p>
          </div>

          <div className="flex items-start gap-2 bg-blue-50/50 border border-blue-150 p-3 rounded-lg text-[11px] text-slate-600">
            <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <span>Cobalah menurunkan role Anda di header simulasi hak akses untuk membuktikan ketangguhan filtrator RoleGuard!</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
export default ServicesPage;

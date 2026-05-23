import React from 'react';
import { Card, CardHeader, CardContent } from '../components/common/Card';
import { Layers, Info } from 'lucide-react';

export function QueuesPage() {
  return (
    <div className="space-y-6 font-sans text-slate-800 animate-fade-in select-none">
      <Card>
        <CardHeader subtitle="Lacak progres cucian" action={<Layers className="w-5 h-5 text-blue-500" />}>
          Monitor Antrean Laundry
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-slate-650 leading-relaxed">
            Menampilkan antrean cucian aktif di cabang terpilih yang terbagi ke dalam empat gerbang progres utama: <strong>Diterima (Received)</strong>, <strong>Dicuci (Processing)</strong>, <strong>Siap Ambil (Ready)</strong>, dan <strong>Selesai (Delivered)</strong>.
          </p>

          <div className="bg-slate-50 border border-slate-205 p-4 rounded-xl text-xs space-y-1">
            <span className="font-extrabold text-blue-600 block text-[10px] uppercase tracking-wider">Antrean Agregasi List:</span>
            <p className="text-slate-500">
              Sinkronisasi progres laundry dengan trigger real-time onSnapshot listener yang andal akan memastikan staff pencuci pakaian mendapatkan update status seketika di loket dapur.
            </p>
          </div>

          <div className="flex items-start gap-2 bg-blue-50/50 border border-blue-150 p-3 rounded-lg text-[11px] text-slate-600">
            <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <span>Semua role staf laundry terikat dengan filter tenant ID terisolasi.</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
export default QueuesPage;

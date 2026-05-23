import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { Button } from '../components/common/Button';

export function UnauthorizedPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4 select-none font-sans">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-5 text-center">
        <div className="flex justify-center">
          <div className="p-3 bg-rose-50 border border-rose-150 rounded-full text-rose-600 animate-pulse">
            <ShieldAlert className="w-8 h-8" />
          </div>
        </div>

        <div className="space-y-1.5">
          <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
            Hak Akses Ditolak
          </h2>
          <p className="text-xs text-slate-400 font-medium leading-relaxed">
            Maaf, akun Anda tidak memiliki mandat atau peran (role-privilege) yang memadai untuk membuka gerbang konfigurasi ini.
          </p>
        </div>

        <div className="p-3.5 bg-slate-50 border border-slate-150 rounded-xl text-[11px] text-slate-500 text-left leading-relaxed">
          <p className="font-semibold text-slate-700 mb-1">💡 Tips Simulasi Evaluasi:</p>
          Ubah menu dropdown <strong className="text-blue-600 uppercase">Simulasi Hak Akses</strong> yang terletak di pojok header navigasi sebelah atas ke <strong className="text-blue-600 font-extrabold">OWNER</strong> atau <strong className="text-blue-600 font-extrabold">ADMIN</strong> untuk membuka segel pengaman halaman ini.
        </div>

        <div className="flex justify-center pt-2">
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
            onClick={() => navigate('/dashboard')}
          >
            Kembali ke Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}

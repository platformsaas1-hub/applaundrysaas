import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingScreenProps {
  label?: string;
  subtext?: string;
}

/**
 * Universal layout-blocking Loading Page used for context retrievals and secure transitions.
 */
export function LoadingScreen({ 
  label = "Mentranslasikan sesi keamanan...", 
  subtext = "Sistem SaaS sedang menyinkronkan data multi-tenant dengan Firestore."
}: LoadingScreenProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-900 text-slate-100 p-6">
      <div className="text-center max-w-sm space-y-4">
        {/* Visual spinner ring */}
        <div className="flex justify-center">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
        </div>
        
        <div className="space-y-1.5">
          <h3 className="text-sm font-bold tracking-wider text-slate-200 uppercase">
            LaundryKu Enterprise
          </h3>
          <p className="text-xs text-slate-400 font-medium leading-relaxed">
            {label}
          </p>
        </div>

        <p className="text-[10px] text-slate-500 font-mono italic">
          {subtext}
        </p>
      </div>
    </div>
  );
}

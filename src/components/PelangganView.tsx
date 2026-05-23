import React, { useState } from 'react';
import { Customer, UserRole } from '../types';
import { Search, UserPlus, Phone, MapPin, ClipboardList, PackageOpen } from 'lucide-react';

interface PelangganViewProps {
  customers: Customer[];
  currentRole: UserRole;
  onAddCustomer: (cust: Omit<Customer, 'customerId' | 'createdAt'>) => string;
  trackAction: (reads: number, writes: number, savedReads?: number) => void;
}

export const PelangganView: React.FC<PelangganViewProps> = ({
  customers,
  currentRole,
  onAddCustomer,
  trackAction
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showForm, setShowForm] = useState<boolean>(false);
  
  // New Customer State
  const [name, setName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const filtered = customers.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone.includes(searchQuery)
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;

    onAddCustomer({
      name,
      phone,
      address: address || undefined,
      notes: notes || undefined
    });

    // Reset Form
    setName('');
    setPhone('');
    setAddress('');
    setNotes('');
    setShowForm(false);
  };

  return (
    <div className="flex-1 flex overflow-hidden h-full bg-slate-50 font-sans">
      {/* Left pane - Add Customer form */}
      <div className="w-80 border-r border-slate-200 bg-white p-5 flex flex-col overflow-y-auto shrink-0">
        <div className="flex items-center justify-between mb-4 border-b border-slate-50 pb-3 shrink-0">
          <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Direktori Pelanggan</h4>
          <span className="text-[10px] bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded-full font-mono">{customers.length} Orang</span>
        </div>

        <p className="text-xs text-slate-400 mb-6 leading-relaxed">
          Sesuai asas denormalisasi Spark Plan, profil pelanggan disalin langsung ke dalam dokumen transaksi saat POS dibuat untuk menghemat read overhead.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="flex items-center gap-1.5 text-blue-600 font-bold">
            <UserPlus className="w-4 h-4" />
            <span>Mendaftarkan Pelanggan</span>
          </div>

          <div>
            <label className="block font-semibold text-slate-500 mb-1 uppercase tracking-wider">Nama Lengkap*</label>
            <input
              type="text"
              required
              placeholder="Contoh: Ahmad Dhani"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-xs rounded border border-slate-200 p-2 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-500 mb-1 uppercase tracking-wider">Nomor Handphone/WhatsApp*</label>
            <input
              type="text"
              required
              placeholder="Contoh: 081234567..."
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full text-xs rounded border border-slate-200 p-2 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-500 mb-1 uppercase tracking-wider">Alamat Rumah (Opsional)</label>
            <textarea
              placeholder="Contoh: Perumahan Margonda Blok C No. 5"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full text-xs rounded border border-slate-200 p-2 h-16 resize-none focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-500 mb-1 uppercase tracking-wider">Instruksi Alergi Parfum / Pemutih (Opsional)</label>
            <input
              type="text"
              placeholder="Contoh: Alergi lavender, saputangan jangan luntur"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs rounded border border-slate-200 p-2 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-slate-950 text-white p-2.5 font-bold text-xs rounded hover:bg-slate-800 transition-all flex items-center justify-center gap-1.5"
          >
            <UserPlus className="w-3.5 h-3.5" /> Daftarkan Pelanggan Baru
          </button>
        </form>
      </div>

      {/* Right panel - Directory search & catalog list */}
      <div className="flex-1 flex flex-col overflow-hidden p-5 space-y-4">
        {/* Search bar row */}
        <div className="flex items-center justify-between shrink-0 bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2 ml-0.5 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Cari pelanggan berdasarkan nama/no. hp..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                trackAction(1, 0); // local search simulation
              }}
              className="w-full text-xs pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Local indexing search available</span>
        </div>

        {/* Directory List of grids */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="bg-white border rounded-xl p-12 text-center text-slate-400 space-y-2">
              <PackageOpen className="w-10 h-10 mx-auto text-slate-200" />
              <p className="text-xs font-semibold">Tidak ditemukan customer</p>
              <p className="text-[10px] text-slate-400">Silakan input data pendaftaran di form sebelah kiri.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(cust => (
                <div 
                  key={cust.customerId} 
                  className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-col justify-between hover:shadow-xs hover:border-slate-300 transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-slate-800 text-sm">{cust.name}</span>
                      <span className="text-[9px] bg-indigo-50 border border-indigo-100 font-mono text-indigo-700 px-1.5 py-0.5 rounded uppercase font-bold">
                        MEMBER
                      </span>
                    </div>

                    <div className="mt-4 space-y-2 text-xs text-slate-650">
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-mono text-xs">{cust.phone}</span>
                      </div>

                      {cust.address && (
                        <div className="flex items-start gap-2">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                          <span className="text-[11px] leading-relaxed italic">{cust.address}</span>
                        </div>
                      )}

                      {cust.notes && (
                        <div className="flex items-start gap-2 bg-amber-50 rounded border border-amber-100 p-2 text-amber-900">
                          <ClipboardList className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                          <span className="text-[10px] leading-relaxed"><strong>Notes: </strong>{cust.notes}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between text-[10px] text-slate-400">
                    <span>Terdaftar: {new Date(cust.createdAt).toLocaleDateString('id-ID')}</span>
                    <span className="text-slate-400">UID: {cust.customerId.slice(0, 8)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

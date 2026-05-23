import React, { useState } from 'react';
import { Customer, UserRole, Transaction } from '../types';
import { formatRupiah } from '../utils/formatting';
import { Search, UserPlus, Phone, MapPin, ClipboardList, PackageOpen, Award, Sparkles, BookOpen, Clock, Tag, X } from 'lucide-react';

interface PelangganViewProps {
  customers: Customer[];
  transactions?: Transaction[];
  currentRole: UserRole;
  onAddCustomer: (cust: Omit<Customer, 'customerId' | 'createdAt'>) => string;
  trackAction: (reads: number, writes: number, savedReads?: number) => void;
}

export const PelangganView: React.FC<PelangganViewProps> = ({
  customers,
  transactions = [],
  currentRole,
  onAddCustomer,
  trackAction
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  
  // New Customer Form States
  const [name, setName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const filtered = customers.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone.includes(searchQuery)
  );

  const selectedCustomer = customers.find(c => c.customerId === selectedCustomerId) || null;

  // Retrieve matching transaction log records
  const customerTxHistory = selectedCustomer
    ? transactions.filter(tx => 
        tx.customerPhone === selectedCustomer.phone || 
        tx.customerName.toLowerCase() === selectedCustomer.name.toLowerCase()
      ).sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime())
    : [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;

    onAddCustomer({
      name,
      phone,
      address: address || undefined,
      notes: notes || undefined
    });

    // Reset Form fields
    setName('');
    setPhone('');
    setAddress('');
    setNotes('');
  };

  const getOrderStatusLabel = (status: Transaction['orderStatus']) => {
    switch (status) {
      case 'received': return 'Baru Masuk';
      case 'processing': return 'Diproses';
      case 'ready': return 'Siap Diambil';
      case 'delivered': return 'Selesai';
      default: return status;
    }
  };

  return (
    <div className="flex-1 flex overflow-hidden h-full bg-slate-50 font-sans col-span-1">
      {/* Left pane - Add Customer Form */}
      <div className="w-76 border-r border-slate-200 bg-white p-4 flex flex-col overflow-y-auto shrink-0">
        <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3 shrink-0">
          <h4 className="text-xs font-extrabold text-slate-850 uppercase tracking-wider">Pendaftaran Pelanggan</h4>
          <span className="text-[10px] bg-indigo-50 text-indigo-700 font-extrabold px-1.5 py-0.5 rounded-full font-mono">
            {customers.length} Terdaftar
          </span>
        </div>

        <p className="text-[11px] text-slate-400 mb-5 leading-relaxed">
          Sesuai dengan blueprint denormalisasi, profil pelanggan disalin langsung ke dalam transaksi aktif untuk menghemat read overhead Firestore.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="flex items-center gap-1.5 text-blue-600 font-bold">
            <UserPlus className="w-4 h-4" />
            <span className="tracking-wide">Registrasi Pelanggan</span>
          </div>

          <div>
            <label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider text-[10px]">Nama Lengkap*</label>
            <input
              type="text"
              required
              placeholder="Contoh: Ahmad Dhani"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-200 p-2 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider text-[10px]">Nomor WhatsApp*</label>
            <input
              type="text"
              required
              placeholder="Contoh: 081234567..."
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-200 p-2 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider text-[10px]">Alamat Rumah (Opsional)</label>
            <textarea
              placeholder="Contoh: Perumahan Margonda Raya Blok A-5"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-200 p-2 h-14 resize-none focus:ring-1 focus:ring-blue-500 focus:outline-none text-[11px]"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider text-[10px]">Instruksi Khusus / Alergi Parfum</label>
            <input
              type="text"
              placeholder="Contoh: Alergi lavender, setrika licin rapi"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-200 p-2 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-slate-900 border border-slate-800 text-white py-2 px-3 font-bold text-xs rounded-lg hover:bg-slate-800 transition-all flex items-center justify-center gap-1.5"
          >
            <UserPlus className="w-3.5 h-3.5" /> Daftarkan Pelanggan Baru
          </button>
        </form>
      </div>

      {/* Center panel - Customer CRM card directory catalog */}
      <div className="flex-1 flex flex-col overflow-hidden p-4 space-y-4">
        
        {/* Search bar row */}
        <div className="flex items-center justify-between shrink-0 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
          <div className="relative w-72">
            <Search className="absolute left-2.5 top-2.5 ml-0.5 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Cari pelanggan berdasarkan nama atau No. HP..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                trackAction(1, 0); // search stats activity read track logger
              }}
              className="w-full text-xs pl-8 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <span className="text-[10px] text-slate-450 uppercase font-extrabold tracking-wider font-sans">Database Terindeks</span>
        </div>

        {/* Directory cards section catalog */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="bg-white border rounded-xl p-12 text-center text-slate-400 space-y-2 max-w-sm mx-auto mt-8">
              <PackageOpen className="w-12 h-12 mx-auto text-slate-200 animate-pulse" />
              <p className="text-xs font-bold text-slate-700">Tidak ditemukan koordinat pelanggan</p>
              <p className="text-[11px]">Silakan mendaftarkan nama/nomor HP pelanggan baru.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-4">
              {filtered.map(cust => {
                const isFrequent = (cust.totalOrders ?? 0) >= 3;
                const isSlightlyActive = (cust.totalOrders ?? 0) > 0 && (cust.totalOrders ?? 0) < 3;
                const isSelected = selectedCustomerId === cust.customerId;

                return (
                  <div 
                    key={cust.customerId} 
                    onClick={() => {
                      setSelectedCustomerId(cust.customerId);
                      trackAction(2, 0); // Open profile tracking logs read
                    }}
                    className={`bg-white rounded-xl border p-4 shadow-2xs flex flex-col justify-between hover:shadow-sm cursor-pointer transition-all ${
                      isSelected 
                        ? 'ring-2 ring-blue-500 border-blue-200 bg-blue-50/10' 
                        : 'border-slate-200 hover:border-slate-350 bg-white'
                    }`}
                  >
                    <div>
                      {/* Badge loyalties and title parameters */}
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-slate-800 text-[13px] tracking-tight">{cust.name}</span>
                        <div className="flex gap-1.5 items-center">
                          {isFrequent && (
                            <span className="text-[8.5px] bg-amber-50 text-amber-700 border border-amber-200 font-extrabold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                              <Award className="w-2.5 h-2.5 text-amber-600" /> VIP
                            </span>
                          )}
                          {isSlightlyActive && (
                            <span className="text-[8.5px] bg-sky-50 text-sky-700 border border-sky-150 font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                              <Sparkles className="w-2.5 h-2.5 text-sky-500" /> AKTIF
                            </span>
                          )}
                          <span className="text-[8.5px] bg-slate-100 border border-slate-200 font-mono text-slate-650 px-1 py-0.5 rounded">
                            ID: {cust.customerId.slice(-4).toUpperCase()}
                          </span>
                        </div>
                      </div>

                      {/* CRM Loyalty metrics summary parameters values */}
                      <div className="grid grid-cols-3 gap-1 bg-slate-50 p-2 rounded-lg border border-slate-150 my-3 text-center">
                        <div className="flex flex-col">
                          <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">Cucian</span>
                          <span className="font-extrabold text-slate-700 text-xs font-mono">{cust.totalOrders ?? 0}x</span>
                        </div>
                        <div className="flex flex-col border-x border-slate-200">
                          <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">Total Belanja</span>
                          <span className="font-extrabold text-slate-700 text-[10px] font-mono leading-none mt-0.5">{formatRupiah(cust.totalSpent ?? 0)}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">Terakhir</span>
                          <span className="font-extrabold text-slate-700 text-[8.5px] font-mono leading-none mt-0.5">
                            {cust.lastOrderDate ? new Date(cust.lastOrderDate).toLocaleDateString('id', { day: '2-digit', month: '2-digit' }) : '-'}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1.5 text-xs text-slate-650 mt-1">
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="font-mono text-xs">{cust.phone}</span>
                        </div>

                        {cust.address && (
                          <div className="flex items-start gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                            <span className="text-[11px] leading-relaxed italic text-slate-700">{cust.address}</span>
                          </div>
                        )}

                        {cust.notes && (
                          <div className="flex items-start gap-1.5 bg-amber-50 rounded border border-amber-100 p-2 text-amber-900 mt-1">
                            <ClipboardList className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                            <span className="text-[10px] leading-relaxed font-sans"><strong>Notes: </strong>{cust.notes}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-450">
                      <span>Registrasi: {new Date(cust.createdAt).toLocaleDateString('id-ID')}</span>
                      
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCustomerId(cust.customerId);
                        }}
                        className="text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-0.5 font-bold"
                      >
                        <BookOpen className="w-3 h-3" /> Detail Riwayat
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right pane - Selected Customer Transaction History Log sidebar */}
      {selectedCustomer && (
        <div id="crm-transaction-history-sidebar" className="w-[320px] bg-white border-l border-slate-200 p-4 flex flex-col justify-between shrink-0 overflow-hidden h-full">
          <div className="flex flex-col h-full overflow-hidden">
            {/* Header profile view */}
            <div className="pb-3 border-b border-slate-205 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Profil & Riwayat</span>
              </div>
              <button 
                onClick={() => setSelectedCustomerId(null)}
                className="p-1 text-slate-400 hover:bg-slate-100 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Profile parameters details */}
            <div className="py-3 shrink-0 space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-150 mt-3 text-xs">
              <span className="font-extrabold text-slate-800 text-[13.5px] tracking-tight block">{selectedCustomer.name}</span>
              <p className="font-mono text-[10.5px] text-slate-500">{selectedCustomer.phone}</p>
              {selectedCustomer.address && (
                <p className="text-[10.5px] italic text-slate-600 line-clamp-2 mt-1">{selectedCustomer.address}</p>
              )}
            </div>

            {/* Scrolling Transaction Lists */}
            <div className="flex-1 overflow-y-auto mt-4 space-y-3 pr-0.5">
              <span className="block text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">Histori Jasa Cucian ({customerTxHistory.length})</span>
              
              {customerTxHistory.length === 0 ? (
                <div className="text-center py-10 text-slate-400 border border-dashed border-slate-150 rounded-xl bg-slate-50/50 p-4">
                  <Clock className="w-8 h-8 text-slate-200 mx-auto mb-1.5" />
                  <span className="text-[10px] uppercase font-bold text-slate-650">No orders logged</span>
                  <p className="text-[9.5px] text-slate-400 leading-normal mt-0.5">Belum ada invoice transaksi atas nama pelanggan ini di outlet.</p>
                </div>
              ) : (
                customerTxHistory.map(tx => (
                  <div key={tx.transactionId} className="border border-slate-200 rounded-xl p-3 space-y-2 bg-white hover:border-slate-300 transition shadow-3xs text-[10.5px]">
                    
                    {/* Invoice ref row */}
                    <div className="flex justify-between font-mono pb-1 border-b border-dashed border-slate-150">
                      <span className="font-extrabold text-blue-700">{tx.invoiceNumber || tx.transactionId.slice(0, 10)}</span>
                      <span className="text-[9.5px] text-slate-450">{new Date(tx.receivedAt).toLocaleDateString('id-ID')}</span>
                    </div>

                    {/* Services row */}
                    <div className="space-y-0.5 text-slate-600">
                      {tx.items && tx.items.map((it, idx) => (
                        <div key={idx} className="flex justify-between font-medium">
                          <span className="truncate max-w-[170px]">{it.name} <span className="font-normal text-[9px] text-slate-400">({it.qty})</span></span>
                          <span className="font-mono font-bold text-[9.5px]">{formatRupiah(it.totalPrice || (it.qty * it.pricePerUnit))}</span>
                        </div>
                      ))}
                    </div>

                    {/* Totals & Status indicators */}
                    <div className="flex justify-between items-center pt-1 border-t border-slate-100 pb-0.5">
                      <span className="font-semibold text-slate-800">Total Tagihan:</span>
                      <span className="font-extrabold text-blue-600 font-mono">{formatRupiah(tx.totalAmount)}</span>
                    </div>

                    <div className="flex justify-between items-center text-[9px]">
                      <span className={`px-1.5 font-bold rounded ${
                        tx.orderStatus === 'delivered' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-blue-50 text-blue-700 border border-blue-100'
                      }`}>
                        {getOrderStatusLabel(tx.orderStatus)}
                      </span>
                      <span className={`px-1 rounded font-extrabold ${
                        tx.paymentStatus === 'paid' ? 'bg-emerald-50 text-emerald-700' : tx.paymentStatus === 'partial' ? 'bg-indigo-50 text-indigo-700' : 'bg-rose-50 text-rose-700'
                      }`}>
                        {tx.paymentStatus === 'paid' ? 'LUNAS' : tx.paymentStatus === 'partial' ? 'DP' : 'BELUM BAYAR'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-150 text-[10px] text-slate-400 uppercase text-center font-bold font-sans shrink-0">
            LaundryKu Loyalty Directory
          </div>
        </div>
      )}
    </div>
  );
};

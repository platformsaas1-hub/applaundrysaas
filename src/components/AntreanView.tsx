import React, { useState } from 'react';
import { Transaction, UserRole, LaundryService } from '../types';
import { formatRupiah, formatDateTime, getWhatsAppUrl } from '../utils/formatting';
import { Search, Flame, Shuffle, CheckCircle, Package, Send, AlertTriangle, Printer, Trash2, Clock, MapPin, Layers } from 'lucide-react';

interface AntreanViewProps {
  transactions: Transaction[];
  services: LaundryService[];
  currentRole: UserRole;
  onUpdateStatus: (id: string, status: Transaction['orderStatus']) => void;
  onUpdatePayment: (id: string, payStatus: Transaction['paymentStatus'], payMethod: Transaction['paymentMethod']) => void;
  onDeleteTransaction?: (id: string) => void;
  onSelectTransactionForInvoice: (trx: Transaction) => void;
  trackAction: (reads: number, writes: number, savedReads?: number) => void;
}

export const AntreanView: React.FC<AntreanViewProps> = ({
  transactions,
  services,
  currentRole,
  onUpdateStatus,
  onUpdatePayment,
  onDeleteTransaction,
  onSelectTransactionForInvoice,
  trackAction
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [outletFilter, setOutletFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grouped' | 'list'>('grouped');

  // Compute self-healing unique outlet id indexes from the list to build an adaptive filter representation
  const uniqueOutletIds = Array.from(new Set(transactions.map(t => t.outletId).filter(Boolean))) as string[];

  // Core aging indicator calculation helper
  const getAgingString = (receivedAt: string | any) => {
    if (!receivedAt) return '';
    try {
      const now = new Date();
      const receivedDate = new Date(receivedAt);
      const diffMs = now.getTime() - receivedDate.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 65)); // rounded scale
      if (diffMins < 60) {
        return `${Math.max(1, diffMins)}m lalu`;
      }
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) {
        return `${diffHours}j lalu`;
      }
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d lalu`;
    } catch {
      return '';
    }
  };

  // Grouping mapping logic
  const getGroupForStatus = (status: string) => {
    if (['received', 'created', 'queued'].includes(status)) return 'baru';
    if (['processing', 'washing', 'drying', 'ironing', 'packing'].includes(status)) return 'proses';
    if (['ready', 'completed'].includes(status)) return 'siap';
    if (['delivered', 'picked_up'].includes(status)) return 'selesai';
    return 'baru';
  };

  // Universal search filter matching invoice digits and user names
  const filteredList = transactions.filter(t => {
    const matchesSearch = 
      t.transactionId.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (t.invoiceNumber && t.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
      t.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.customerPhone.includes(searchQuery);

    const matchesOutlet = outletFilter === 'all' ? true : t.outletId === outletFilter;
    return matchesSearch && matchesOutlet;
  });

  const getOrderStatusColor = (status: Transaction['orderStatus']) => {
    switch (status) {
      case 'received': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'processing': return 'bg-sky-100 text-sky-800 border-sky-200';
      case 'ready': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'delivered': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getOrderStatusLabel2 = (status: Transaction['orderStatus']) => {
    switch (status) {
      case 'received': return 'Baru Masuk';
      case 'processing': return 'Diproses';
      case 'ready': return 'Siap Diambil';
      case 'delivered': return 'Selesai';
      default: return 'Antrean';
    }
  };

  const handleWhatsappDraftSend = (trx: Transaction) => {
    trackAction(1, 0); // single read of client phone database context
    const textMessage = `Halo Bapak/Ibu *${trx.customerName}*,\n\nKami dari outlet laundry ingin mengabarkan bahwa pakaian Anda dengan nomor nota *${trx.invoiceNumber || trx.transactionId}* telah selesai dicuci dan disetrika rapi ✨\n\nSilakan diambil di outlet terdekat.\nTotal tagihan: *${formatRupiah(trx.totalAmount)}* (Status: ${trx.paymentStatus === 'paid' ? 'Lunas ✅' : trx.paymentStatus === 'partial' ? 'DP Sebagian 💸' : 'Belum Lunas ❌'}).\n\nTerima kasih atas kepercayaannya! 🙏`;
    
    const url = getWhatsAppUrl(trx.customerPhone, textMessage);
    window.open(url, '_blank');
  };

  // Group columns definition
  const columns = [
    { key: 'baru', label: 'Baru Masuk', bg: 'bg-amber-50/70 border-amber-150', accent: 'text-amber-800 bg-amber-100' },
    { key: 'proses', label: 'Sedang Diproses', bg: 'bg-sky-50/70 border-sky-150', accent: 'text-sky-800 bg-sky-100' },
    { key: 'siap', label: 'Siap Diambil', bg: 'bg-indigo-50/70 border-indigo-150', accent: 'text-indigo-800 bg-indigo-100' },
    { key: 'selesai', label: 'Selesai / Delivered', bg: 'bg-emerald-50/70 border-emerald-150', accent: 'text-emerald-800 bg-emerald-100' }
  ];

  // Render individual card helper to remain modular and clean
  const renderTransactionCard = (trx: Transaction) => {
    const ageStr = getAgingString(trx.receivedAt);
    return (
      <div 
        key={trx.transactionId}
        className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs flex flex-col justify-between hover:shadow hover:border-slate-300 transition-all text-xs"
      >
        <div className="space-y-3">
          {/* Card header labels */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 font-mono">
            <div className="flex flex-col gap-0.5">
              <span className="font-extrabold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded text-[10px]">
                {trx.invoiceNumber || trx.transactionId.slice(0, 10)}
              </span>
              {trx.queueNumber && (
                <span className="text-[10px] text-slate-500 font-extrabold">Queue: {trx.queueNumber}</span>
              )}
            </div>
            
            {/* Live aging and status indicator combined */}
            <div className="flex flex-col items-end gap-1">
              <span className={`px-1.5 py-0.5 rounded text-[9.5px] border font-bold ${getOrderStatusColor(trx.orderStatus)}`}>
                {getOrderStatusLabel2(trx.orderStatus)}
              </span>
              {ageStr && (
                <span className="text-[9.5px] text-amber-700 bg-amber-50 px-1 py-0.2 rounded font-sans flex items-center gap-0.5 border border-amber-100">
                  <Clock className="w-2.5 h-2.5 text-amber-600" /> {ageStr}
                </span>
              )}
            </div>
          </div>

          {/* Customer Metadata details */}
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Pelanggan:</span>
              <span className="font-extrabold text-slate-800">{trx.customerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">No. HP:</span>
              <span className="font-mono text-slate-650">{trx.customerPhone}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Total Amount:</span>
              <span className="font-extrabold text-slate-900">{formatRupiah(trx.totalAmount)}</span>
            </div>
            
            {/* Detailed partial balance states */}
            <div className="flex justify-between items-center pt-1">
              <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Status Bayar:</span>
              <div className="flex items-center gap-1.5">
                <span className={`text-[9px] font-extrabold px-1 rounded uppercase ${
                  trx.paymentStatus === 'paid' 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-150' 
                    : trx.paymentStatus === 'partial'
                    ? 'bg-blue-50 text-blue-700 border border-blue-150'
                    : 'bg-rose-50 text-rose-700 border border-rose-150'
                }`}>
                  {trx.paymentStatus === 'paid' ? 'LUNAS' : trx.paymentStatus === 'partial' ? 'DP' : 'BELUM BAYAR'}
                </span>
                {trx.paymentMethod && trx.paymentMethod !== 'none' && (
                  <span className="text-[9px] bg-slate-50 text-slate-500 font-mono border border-slate-150 px-1 rounded uppercase">
                    {trx.paymentMethod}
                  </span>
                )}
              </div>
            </div>
            {(trx.remainingAmount ?? 0) > 0 && (
              <div className="flex justify-between text-rose-600 text-[10.5px]">
                <span className="uppercase tracking-wide font-bold">Sisa Tagihan:</span>
                <span className="font-extrabold font-mono">{formatRupiah(trx.remainingAmount)}</span>
              </div>
            )}
          </div>

          {/* Items listing table inside individual card summary */}
          <div className="bg-slate-50/80 p-2 rounded-lg border border-slate-100 space-y-1">
            <span className="block text-[8.5px] font-bold text-slate-400 uppercase tracking-widest font-sans">Jasa Jasa / Cuci:</span>
            <ul className="divide-y divide-slate-100 font-sans text-[10.5px]">
              {trx.items && trx.items.map((it, idx) => (
                <li key={idx} className="flex justify-between py-0.5 text-slate-650">
                  <span className="truncate max-w-[140px]">{it.name} <span className="text-[9.5px] text-slate-400 font-normal">({it.qty})</span></span>
                  <span className="font-semibold font-mono text-[10px]">{formatRupiah(it.totalPrice || (it.qty * it.pricePerUnit))}</span>
                </li>
              ))}
            </ul>
            {trx.notes && (
              <p className="text-[9.5px] text-amber-800 border-t border-slate-100 pt-1 italic line-clamp-1">
                💬: "{trx.notes}"
              </p>
            )}
          </div>
        </div>

        {/* Card bottom operation controls */}
        <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between">
          <div className="flex gap-1">
            <button
              onClick={() => onSelectTransactionForInvoice(trx)}
              className="p-1.5 bg-slate-100 rounded-md hover:bg-slate-200 text-slate-600 transition"
              title="Cetak Nota Digital"
            >
              <Printer className="w-3.5 h-3.5" />
            </button>
            {['ready', 'processing', 'received', 'created', 'queued'].includes(trx.orderStatus) && (
              <button
                onClick={() => onSelectTransactionForInvoice(trx)}
                className="p-1.5 bg-emerald-50 rounded-md hover:bg-emerald-100 text-emerald-700 border border-emerald-100 transition"
                title="Kirim Notifikasi WhatsApp (Fonnte Engine)"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex gap-1.5">
            {/* Actions workflow triggers */}
            {['received', 'created', 'queued'].includes(trx.orderStatus) && (
              <button
                onClick={() => onUpdateStatus(trx.transactionId, 'processing')}
                className="px-2.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-[10.5px] rounded-md transition flex items-center gap-1"
              >
                <Flame className="w-3 h-3" /> Cuci
              </button>
            )}

            {['processing', 'washing', 'drying', 'ironing', 'packing'].includes(trx.orderStatus) && (
              <button
                onClick={() => onUpdateStatus(trx.transactionId, 'ready')}
                className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[10.5px] rounded-md transition flex items-center gap-1"
              >
                <CheckCircle className="w-3 h-3" /> Selesai
              </button>
            )}

            {trx.orderStatus === 'ready' && (
              <div className="flex gap-1">
                {trx.paymentStatus !== 'paid' && currentRole !== 'pegawai' && (
                  <button
                    onClick={() => {
                      const amountToSettle = trx.remainingAmount || trx.totalAmount;
                      if (confirm(`Selesaikan pembayaran tersisa senilai ${formatRupiah(amountToSettle)}?`)) {
                        onUpdatePayment(trx.transactionId, 'paid', 'cash');
                      }
                    }}
                    className="px-2 py-1 text-[9.5px] border border-rose-200 text-rose-700 hover:bg-rose-50 font-bold rounded-md"
                  >
                    Lunas
                  </button>
                )}
                <button
                  onClick={() => {
                    if (trx.paymentStatus !== 'paid' && currentRole !== 'pegawai') {
                      if (confirm('Tagihan customer belum lunas. Lanjutkan serah terima pakaian sekarang?')) {
                        onUpdateStatus(trx.transactionId, 'delivered');
                      }
                    } else {
                      onUpdateStatus(trx.transactionId, 'delivered');
                    }
                  }}
                  className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[10.5px] rounded-md transition flex items-center gap-1"
                >
                  <Package className="w-3 h-3" /> Serahkan
                </button>
              </div>
            )}

            {['delivered', 'picked_up'].includes(trx.orderStatus) && (
              <span className="text-[9.5px] bg-emerald-50 text-emerald-700 border border-emerald-150 font-bold px-2 py-1 rounded">
                ✓ Selesai & Diserahkan
              </span>
            )}

            {currentRole === 'owner' && onDeleteTransaction && (
              <button
                onClick={() => {
                  if (confirm('Apakah Anda yakin ingin menghapus data antrean transaksi ini dari database?')) {
                    onDeleteTransaction(trx.transactionId);
                  }
                }}
                className="p-1 text-rose-500 hover:bg-rose-50 rounded ml-1"
                title="Hapus Transaksi"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full bg-slate-50 font-sans">
      
      {/* Search and control action toolbar bar */}
      <div className="bg-white border-b border-slate-200 p-4 shrink-0 space-y-3.5 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-600" />
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide">Monitoring Antrean Cucian</h3>
            <span className="text-xs bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-full font-mono">
              {filteredList.length} Antrean
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Scalable Outlet Filter (Foundation ready) */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-0.5">
                <MapPin className="w-3 h-3" /> Outlet:
              </span>
              <select
                value={outletFilter}
                onChange={(e) => setOutletFilter(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 font-bold text-slate-700"
              >
                <option value="all">Semua Outlet</option>
                {uniqueOutletIds.map((oId) => (
                  <option key={oId} value={oId}>{`Outlet #${oId.slice(-4).toUpperCase()}`}</option>
                ))}
              </select>
            </div>

            {/* Layout switch buttons */}
            <div className="bg-slate-100 p-1 rounded-lg flex gap-1">
              <button
                onClick={() => setViewMode('grouped')}
                className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${
                  viewMode === 'grouped' ? 'bg-white text-slate-800 shadow-3xs' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Kolom Status
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${
                  viewMode === 'list' ? 'bg-white text-slate-800 shadow-3xs' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Flat List ({filteredList.length})
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic Search box filter */}
        <div className="relative max-w-md">
          <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Cari berdasarkan No. Nota/Invoice, nama pelanggan, atau Handphone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-8 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Employed layout warning marker if active */}
      {currentRole === 'pegawai' && (
        <div className="bg-amber-50 border-b border-amber-150 px-4 py-2 text-[11px] text-amber-800 flex items-center gap-1.5 font-bold shrink-0">
          <AlertTriangle className="w-3.5 h-3.5 shadow-2xs" />
          <span>Keamanan Terkunci: Status pegawai membatasi manipulasi kas. Hanya diizinkan untuk memajukan progres cuci.</span>
        </div>
      )}

      {/* Main scrolling display body */}
      <div className="flex-1 overflow-auto p-4">
        {filteredList.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400 space-y-2.5 max-w-md mx-auto mt-8">
            <Package className="w-12 h-12 text-slate-200 mx-auto" />
            <h4 className="font-bold text-slate-700">Tidak ada cucian di filter ini</h4>
            <p className="text-xs">Silakan mendaftarkan transaksi baru di menu Kasir POS.</p>
          </div>
        ) : viewMode === 'list' ? (
          /* flat list mode */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredList.map(renderTransactionCard)}
          </div>
        ) : (
          /* Kanban multi status columns mode */
          <div className="flex gap-4 h-full min-w-[1000px] items-stretch">
            {columns.map(col => {
              const colTxs = filteredList.filter(t => getGroupForStatus(t.orderStatus) === col.key);
              return (
                <div 
                  key={col.key} 
                  className={`flex-1 flex flex-col rounded-2xl border ${col.bg} p-3.5 min-w-[240px] max-h-full`}
                >
                  {/* Column Header */}
                  <div className="flex items-center justify-between mb-3 shrink-0">
                    <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">{col.label}</span>
                    <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${col.accent}`}>
                      {colTxs.length}
                    </span>
                  </div>

                  {/* List of scrollable cards within column */}
                  <div className="flex-1 overflow-y-auto space-y-3.5 pr-0.5">
                    {colTxs.length === 0 ? (
                      <div className="h-28 border border-dashed border-slate-200 rounded-xl flex items-center justify-center text-center text-[10px] text-slate-400 p-4">
                        Kosong
                      </div>
                    ) : (
                      colTxs.map(renderTransactionCard)
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};

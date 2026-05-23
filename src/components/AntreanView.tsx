import React, { useState } from 'react';
import { Transaction, UserRole, LaundryService } from '../types';
import { formatRupiah, formatDateTime, getWhatsAppUrl } from '../utils/formatting';
import { Search, Flame, Shuffle, CheckCircle, Package, Send, AlertTriangle, Printer, Trash2 } from 'lucide-react';

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
  const [filterStatus, setFilterStatus] = useState<Transaction['orderStatus'] | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Simulated WhatsApp direct message draft
  const [whatsappSimulationTrx, setWhatsappSimulationTrx] = useState<Transaction | null>(null);

  // Search filter
  const filteredList = transactions.filter(t => {
    const matchesSearch = t.transactionId.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          t.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          t.customerPhone.includes(searchQuery);
    const matchesStatus = filterStatus === 'all' ? true : t.orderStatus === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const getOrderStatusColor = (status: Transaction['orderStatus']) => {
    switch (status) {
      case 'received': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'processing': return 'bg-sky-100 text-sky-700 border-sky-200';
      case 'ready': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
      case 'delivered': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getOrderStatusLabel = (status: Transaction['orderStatus']) => {
    switch (status) {
      case 'received': return 'ANTREAN';
      case 'processing': return 'DI CUCI';
      case 'ready': return 'SIAP AMBIL';
      case 'delivered': return 'DIAMBIL';
      default: return 'UNTYPED';
    }
  };

  const handleWhatsappDraftSend = (trx: Transaction) => {
    trackAction(1, 0); // single read of client phone database context
    const textMessage = `Halo Bapak/Ibu *${trx.customerName}*,\n\nKami dari *Laundry Barokah Utama* ingin mengabarkan bahwa pakaian Anda dengan nomor nota *${trx.transactionId}* telah selesai dicuci dan disetrika rapi ✨\n\nSilakan diambil di outlet terdekat.\nTotal tagihan: *${formatRupiah(trx.totalAmount)}* (Status: ${trx.paymentStatus === 'paid' ? 'Lunas ✅' : 'Belum Lunas ❌'}).\n\nTerima kasih atas kepercayaannya! 🙏`;
    
    // Create actual WhatsApp protocol link
    const url = getWhatsAppUrl(trx.customerPhone, textMessage);
    window.open(url, '_blank');
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full bg-slate-50">
      {/* Top Actions Header */}
      <div className="bg-white border-b border-slate-200 p-4 shrink-0 space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide">Antrean Cucian Aktif</h3>
            <span className="text-xs bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded-full font-mono">
              {filteredList.length} Order
            </span>
          </div>

          {/* Quick Search */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari Nota, Pelanggan, atau No. HP..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Filter Navigation Tabs */}
        <div className="flex flex-wrap gap-1">
          {(['all', 'received', 'processing', 'ready', 'delivered'] as const).map(status => (
            <button
              key={status}
              onClick={() => {
                setFilterStatus(status);
                trackAction(1, 0); // Simulated index-filtered read operation on selection
              }}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                filterStatus === status
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {status === 'all' ? 'SEMUA' : getOrderStatusLabel(status)}
            </button>
          ))}
        </div>
      </div>

      {currentRole === 'pegawai' && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-800 flex items-center gap-2 font-medium shrink-0">
          <AlertTriangle className="w-4 h-4" />
          <span>Sebagai <strong>Pegawai (Cuci)</strong>, Anda dibatasi oleh Security Rules hanya dapat mengupdate progress cuci/setrika.</span>
        </div>
      )}

      {/* Main Queue List Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {filteredList.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400 space-y-3">
            <Package className="w-12 h-12 text-slate-200 mx-auto" />
            <h4 className="font-bold text-slate-700">Tidak ada cucian di filter ini</h4>
            <p className="text-xs max-w-sm mx-auto">Silakan coba ganti tab filter di atas atau daftarkan transaksi baru di tab POS.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {filteredList.map(trx => (
              <div 
                key={trx.transactionId}
                className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col justify-between hover:shadow-md hover:border-slate-300 transition-all font-sans"
              >
                <div>
                  {/* Top card metrics */}
                  <div className="flex items-center justify-between border-b border-slate-50 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-extrabold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                        {trx.transactionId}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {formatDateTime(trx.receivedAt)}
                      </span>
                    </div>

                    <span className={`px-2 py-0.5 rounded-full text-[10px] border font-bold ${getOrderStatusColor(trx.orderStatus)}`}>
                      {getOrderStatusLabel(trx.orderStatus)}
                    </span>
                  </div>

                  {/* Customer details & special specs */}
                  <div className="mt-3 grid grid-cols-2 gap-3.5 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Pelanggan</span>
                      <p className="font-bold text-slate-800 mt-0.5">{trx.customerName}</p>
                      <p className="text-[10px] text-slate-500 font-mono">{trx.customerPhone}</p>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Ringkasan Tagihan</span>
                      <p className="font-extrabold text-slate-800 mt-0.5">{formatRupiah(trx.totalAmount)}</p>
                      <div className="flex justify-end gap-1.5 mt-0.5">
                        <span className={`text-[9px] font-bold px-1 rounded ${
                          trx.paymentStatus === 'paid' 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                            : 'bg-rose-50 text-rose-700 border border-rose-100'
                        }`}>
                          {trx.paymentStatus === 'paid' ? 'LUNAS' : 'BELUM BAYAR'}
                        </span>
                        {trx.paymentMethod !== 'none' && (
                          <span className="text-[9px] text-slate-500 bg-slate-50 border border-slate-100 px-1 rounded uppercase font-mono">
                            {trx.paymentMethod}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Basket specifics descriptions */}
                  <div className="mt-3.5 p-2.5 bg-slate-50 rounded-lg space-y-1 text-slate-600 border border-slate-100">
                    <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest">Detail Jasa:</span>
                    <ul className="text-xs divide-y divide-slate-100">
                      {trx.items.map((it, idx) => (
                        <li key={idx} className="flex justify-between py-1 first:pt-0 last:pb-0">
                          <span className="font-medium">{it.name} <span className="text-slate-400 text-[11px] font-normal">({it.qty})</span></span>
                          <span className="font-semibold text-slate-700 font-mono">{formatRupiah(it.totalPrice)}</span>
                        </li>
                      ))}
                    </ul>
                    {trx.notes && (
                      <p className="text-[10px] mt-1.5 text-amber-800 border-t border-slate-100 pt-1 flex items-center gap-1 leading-normal italic">
                        <span>📝 Notes:</span> "{trx.notes}"
                      </p>
                    )}
                  </div>
                </div>

                {/* Operations Buttons Bar */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap gap-2 items-center justify-between">
                  {/* Left elements: Prints and WhatsApp shortcuts */}
                  <div className="flex gap-1">
                    <button
                      onClick={() => onSelectTransactionForInvoice(trx)}
                      className="p-1.5 bg-slate-100 rounded-md hover:bg-slate-200 text-slate-600 transition-colors"
                      title="Lihat Nota Digital"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                    {trx.orderStatus === 'ready' && (
                      <button
                        onClick={() => handleWhatsappDraftSend(trx)}
                        className="p-1.5 bg-emerald-50 rounded-md hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-all"
                        title="Kirim Pesan WhatsApp Cucian Selesai"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Right elements: Lifecycle state advancement */}
                  <div className="flex gap-2">
                    {/* Progression flow Received -> Processing */}
                    {trx.orderStatus === 'received' && (
                      <button
                        onClick={() => onUpdateStatus(trx.transactionId, 'processing')}
                        className="px-3 py-1.5 bg-sky-600 text-white font-bold text-xs rounded-md hover:bg-sky-700 flex items-center gap-1.5 transition-all"
                      >
                        <Flame className="w-3 h-3" /> Mulai Cuci (Process)
                      </button>
                    )}

                    {/* Progression flow Processing -> Ready */}
                    {trx.orderStatus === 'processing' && (
                      <button
                        onClick={() => onUpdateStatus(trx.transactionId, 'ready')}
                        className="px-3 py-1.5 bg-indigo-600 text-white font-bold text-xs rounded-md hover:bg-indigo-700 flex items-center gap-1.5 transition-all"
                      >
                        <CheckCircle className="w-3 h-3" /> Set Selesai (Ready)
                      </button>
                    )}

                    {/* Progression flow Ready -> Delivered */}
                    {trx.orderStatus === 'ready' && (
                      <div className="flex gap-1.5">
                        {trx.paymentStatus === 'unpaid' && currentRole !== 'pegawai' && (
                          <button
                            onClick={() => onUpdatePayment(trx.transactionId, 'paid', 'cash')}
                            className="px-2.5 py-1.5 border border-rose-200 text-rose-700 hover:bg-rose-50 font-bold text-xs rounded-md"
                            title="Bayar tagihan di tempat"
                          >
                            Set Lunas Tunai
                          </button>
                        )}
                        <button
                          onClick={() => {
                            if (trx.paymentStatus === 'unpaid' && currentRole !== 'pegawai') {
                              if (confirm('Pelanggan belum membayar tagihan. Tandai sebagai Delivered sekarang?')) {
                                onUpdateStatus(trx.transactionId, 'delivered');
                              }
                            } else {
                              onUpdateStatus(trx.transactionId, 'delivered');
                            }
                          }}
                          className="px-3 py-1.5 bg-emerald-600 text-white font-bold text-xs rounded-md hover:bg-emerald-700 flex items-center gap-1.5 transition-all"
                        >
                          <Package className="w-3 h-3" /> Serahkan (Deliver)
                        </button>
                      </div>
                    )}

                    {/* Completed delivered stats */}
                    {trx.orderStatus === 'delivered' && (
                      <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded inline-block">
                        ✓ Diserahkan ke Customer
                      </span>
                    )}

                    {/* Delete order only for Owner/Admin */}
                    {currentRole === 'owner' && onDeleteTransaction && (
                      <button
                        onClick={() => {
                          if (confirm('Apakah Anda yakin ingin menghapus transaksi ini dari db? Ini akan memotong Simulated Write.')) {
                            onDeleteTransaction(trx.transactionId);
                          }
                        }}
                        className="p-1.5 text-rose-500 hover:bg-rose-50 rounded"
                        title="Delete receipt history"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

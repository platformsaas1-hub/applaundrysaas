import React, { useState } from 'react';
import { Transaction, Outlet } from '../types';
import { formatRupiah, formatDateTime, getWhatsAppUrl } from '../utils/formatting';
import { X, Printer, Send, Copy, CheckCircle2 } from 'lucide-react';

interface NotaDigitalProps {
  transaction: Transaction;
  outlet: Outlet;
  onClose: () => void;
  trackAction: (reads: number, writes: number, savedReads?: number) => void;
}

export const NotaDigital: React.FC<NotaDigitalProps> = ({
  transaction,
  outlet,
  onClose,
  trackAction
}) => {
  const [copied, setCopied] = useState(false);

  // Formatting message templates
  const wsTextTemplate = `Halo kak *${transaction.customerName}*,\n\nIni adalah Nota Pembayaran dari *${outlet.name}*.\n\nDetail Transaksi:\n- *Nomor Nota:* ${transaction.transactionId}\n- *Tanggal Dititip:* ${formatDateTime(transaction.receivedAt)}\n- *Total Tagihan:* ${formatRupiah(transaction.totalAmount)}\n- *Status Pembayaran:* ${transaction.paymentStatus === 'paid' ? 'Lunas ✅' : 'Belum Lunas ❌'}\n- *Status Proses:* ${transaction.orderStatus === 'delivered' ? 'Sudah Diambil (Delivered) ✓' : 'Masih dalam Antrean 👔'}\n\nTerima kasih atas kepercayaannya! Kakak bisa melakukan tracking berkala ke CS kami.\n~ LaundryKu SaaS`;

  const handleCopyText = () => {
    trackAction(1, 0); // single read template
    navigator.clipboard.writeText(wsTextTemplate);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendWA = () => {
    trackAction(1, 0); // single read template
    const url = getWhatsAppUrl(transaction.customerPhone, wsTextTemplate);
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
        
        {/* Header toolbar */}
        <div className="bg-slate-900 text-white px-5 py-3.5 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-1.5">
            <Printer className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-bold uppercase tracking-wider">Nota Digital & Notifikasi</span>
          </div>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-slate-850 rounded text-slate-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable contents */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Paper Bill Receipt design block */}
          <div className="border border-slate-200 bg-slate-50/50 p-5 rounded-xl space-y-4 font-mono shadow-inner text-slate-800 text-xs">
            {/* Kop Company Logo Header */}
            <div className="text-center space-y-1">
              <h4 className="text-sm font-extrabold tracking-tight text-slate-950 uppercase">{outlet.name}</h4>
              <p className="text-[10px] text-slate-500 font-sans leading-normal">{outlet.address}</p>
              <p className="text-[10px] text-slate-400 font-sans">Telp/WA: {outlet.phone}</p>
              <div className="border-b border-dashed border-slate-300 py-1"></div>
            </div>

            {/* Invoicing Metadata table */}
            <div className="grid grid-cols-2 gap-y-1 text-[10px] text-slate-600">
              <span>No. Nota:</span>
              <span className="text-right font-bold text-slate-950">{transaction.transactionId}</span>
              <span>Tanggal Masuk:</span>
              <span className="text-right">{formatDateTime(transaction.receivedAt)}</span>
              <span>Pelanggan:</span>
              <span className="text-right font-bold text-slate-900">{transaction.customerName}</span>
              <span>No. HP:</span>
              <span className="text-right">{transaction.customerPhone}</span>
              <span>Petugas Kasir:</span>
              <span className="text-right">{transaction.workerName}</span>
            </div>

            <div className="border-b border-dashed border-slate-300"></div>

            {/* Shopping List Table */}
            <div className="space-y-2">
              <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest font-sans">Detail Transaksi Jasa:</span>
              <div className="space-y-1.5">
                {transaction.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-baseline text-[11px]">
                    <div className="max-w-[180px] break-words">
                      <span>{item.name}</span>
                      <span className="text-slate-400 text-[10px] block">({item.qty} x {formatRupiah(item.pricePerUnit)})</span>
                    </div>
                    <span>{formatRupiah(item.totalPrice)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-b border-dashed border-slate-300"></div>

            {/* Calculations summaries */}
            <div className="space-y-1 text-right text-[11px]">
              {transaction.discountAmount > 0 && (
                <div className="flex justify-between">
                  <span>POTONGAN DISKON</span>
                  <span>-{formatRupiah(transaction.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-xs font-bold text-slate-950 pt-1 border-t border-slate-200">
                <span>TOTAL AKHIR</span>
                <span className="text-sm font-extrabold">{formatRupiah(transaction.totalAmount)}</span>
              </div>
              <div className="flex justify-between text-[10px] text-slate-500 pt-1">
                <span>METODE PEMBAYARAN</span>
                <span className="uppercase font-extrabold text-[10.5px] text-slate-700">
                  {transaction.paymentStatus === 'paid' ? `LUNAS (${transaction.paymentMethod})` : 'BELUM BAYAR'}
                </span>
              </div>
            </div>

            <div className="border-b border-dashed border-slate-300"></div>

            {/* Footnote notes policies */}
            <div className="text-center text-[9px] text-slate-400 space-y-1 font-sans">
              <p>Terima kasih atas kunjungan Anda!</p>
              <p>"Pakaian yang tidak diambil dalam 30 hari diluar tanggung jawab kami."</p>
              <p className="font-semibold text-slate-500 mt-1 uppercase">Powered by LaundryKu Multi-Tenant SaaS</p>
            </div>
          </div>

          {/* Social notification generator */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
              📱 Whatsapp Notification Template (Click-to-Send Gateway)
            </label>
            <div className="bg-slate-900 text-slate-300 rounded-xl p-3 text-xs font-mono select-all leading-relaxed relative border border-slate-800">
              <pre className="whitespace-pre-wrap">{wsTextTemplate}</pre>
            </div>

            <div className="flex gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCopyText}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" /> Copy Message
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleSendWA}
                className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-xs"
              >
                <Send className="w-4 h-4" /> Kirim Real WhatsApp
              </button>
            </div>
          </div>

        </div>

        {/* Bottom actions closing toolbar */}
        <div className="bg-slate-50 border-t border-slate-150 p-4 flex justify-between shrink-0 font-medium">
          <button
            onClick={() => window.print()}
            className="px-4 py-2 text-xs border border-slate-300 text-slate-700 bg-white rounded-lg hover:bg-slate-50 font-bold"
          >
            Cetak Struk Kertas (Thermal)
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs bg-slate-900 text-white rounded-lg hover:bg-slate-800 font-bold"
          >
            Tutup Dialog
          </button>
        </div>

      </div>
    </div>
  );
};

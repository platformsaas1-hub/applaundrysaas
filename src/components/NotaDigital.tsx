import React, { useState, useEffect } from 'react';
import { Transaction, Outlet, NotificationLog } from '../types';
import { formatRupiah, formatDateTime, getWhatsAppUrl } from '../utils/formatting';
import { X, Printer, Send, Copy, CheckCircle2, RefreshCw, AlertCircle, Sparkles, MessageSquare, Clock, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase/config';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { whatsappService } from '../services/whatsapp/whatsappService';
import { TemplateType } from '../services/whatsapp/whatsappTemplates';

interface NotaDigitalProps {
  transaction: Transaction;
  outlet: Outlet;
  onClose: () => void;
  trackAction: (reads: number, writes: number, savedReads?: number) => void;
  autoPrintEnabled?: boolean; // prepared auto print architecture
}

export const NotaDigital: React.FC<NotaDigitalProps> = ({
  transaction,
  outlet,
  onClose,
  trackAction,
  autoPrintEnabled = false
}) => {
  const { userProfile, currentUser } = useAuth();
  const [copied, setCopied] = useState(false);
  const [paperWidth, setPaperWidth] = useState<'58mm' | '80mm'>('58mm');
  const [loadingTemplate, setLoadingTemplate] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; body: string } | null>(null);
  const [notifLogs, setNotifLogs] = useState<NotificationLog[]>([]);

  // Subscribing to delivery activity log dynamically
  useEffect(() => {
    if (!userProfile?.tenantId || !transaction.transactionId) return;

    const notifsRef = collection(db, 'tenants', userProfile.tenantId, 'notifications');
    const q = query(
      notifsRef,
      where('transactionId', '==', transaction.transactionId),
      orderBy('createdAt', 'desc'),
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: NotificationLog[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as NotificationLog);
      });
      setNotifLogs(list);
    }, (error) => {
      console.warn("Could not load notification logs for invoice:", error);
    });

    return unsubscribe;
  }, [userProfile?.tenantId, transaction.transactionId]);

  // Dispatch runner
  const handleTriggerWA = async (templateType: TemplateType) => {
    if (!userProfile?.tenantId) return;
    setLoadingTemplate(templateType);
    setToastMessage(null);
    trackAction(1, 1); // Action tracked

    const servicesSummary = transaction.items?.map(it => `${it.name} (x${it.qty})`).join(', ') || 'Layanan Laundry';
    const estDateString = transaction.estimatedDoneAt 
      ? new Date(transaction.estimatedDoneAt).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }) 
      : 'Segera';

    try {
      const result = await whatsappService.sendNotification({
        tenantId: userProfile.tenantId,
        transactionId: transaction.transactionId,
        customerPhone: transaction.customerPhone,
        customerName: transaction.customerName,
        templateType,
        variables: {
          invoiceNumber: transaction.invoiceNumber || transaction.transactionId,
          outletName: outlet.name,
          remainingBalance: transaction.remainingAmount ?? (transaction.totalAmount - (transaction.paidAmount ?? 0)),
          estimatedDoneDate: estDateString,
          servicesSummary,
          pickupInfo: 'Mohon tanyakan kepada kasir detail jam operasional mampir.'
        },
        sentBy: currentUser?.uid || 'anonymous',
        sentByName: userProfile?.name || 'Kasir',
      });

      if (result.success) {
        setToastMessage({
          type: 'success',
          body: `WhatsApp '${templateType}' berhasil diterbangkan ke vendor gateway (Fonnte) untuk diteruskan ke ${transaction.customerPhone}!`
        });
      } else {
        setToastMessage({
          type: 'error',
          body: `Vendor Error: ${result.error || 'Ditolak oleh gateway'}`
        });
      }
    } catch (err: any) {
      setToastMessage({
        type: 'error',
        body: `System internal dispatch crash: ${err?.message || err}`
      });
    } finally {
      setLoadingTemplate(null);
    }
  };

  // Formatting message templates for WhatsApp
  const wsTextTemplate = `Halo kak *${transaction.customerName}*,\n\nIni adalah Nota Pembayaran dari *${outlet.name}*.\n\nDetail Transaksi:\n- *Nomor Nota:* ${transaction.invoiceNumber || transaction.transactionId}\n- *Tanggal Dititip:* ${formatDateTime(transaction.receivedAt)}\n- *Total Tagihan:* ${formatRupiah(transaction.totalAmount)}\n- *Status Pembayaran:* ${transaction.paymentStatus === 'paid' ? 'Lunas ✅' : transaction.paymentStatus === 'partial' ? 'DP (Bayar Sebagian) 💸' : 'Belum Lunas ❌'}\n- *Status Proses:* ${transaction.orderStatus === 'delivered' ? 'Sudah Diambil (Delivered) ✓' : 'Masih dalam Antrean 👔'}\n\nTerima kasih atas kepercayaannya! Kakak bisa melakukan tracking berkala ke CS kami.\n~ LaundryKu SaaS`;

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

  const handlePrint = () => {
    trackAction(1, 1); // Action logged/tracked
    window.print();
  };

  const getPaymentStatusLabel = (status: Transaction['paymentStatus']) => {
    switch (status) {
      case 'paid': return 'LUNAS';
      case 'partial': return 'DP / SEBAGIAN';
      case 'unpaid': return 'BELUM LUNAS';
      default: return 'BELUM LUNAS';
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans no-print-backdrop">
      {/* Printable styles wrapper injecting page setups for the client printing driver */}
      <style>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          /* Hide everything except the exact paper receipts */
          body > * {
            display: none !important;
          }
          #print-section-root {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: ${paperWidth} !important;
            margin: 0 auto !important;
            padding: 4mm !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
            color: black !important;
            font-size: 10pt !important;
          }
          .no-print {
            display: none !important;
          }
          /* Monochrome thermal adjustments */
          svg, img, span, p, div, table {
            color: black !important;
            border-color: black !important;
          }
        }
      `}</style>

      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-100 flex flex-col max-h-[90vh] no-print col-span-1">
        
        {/* Header toolbar */}
        <div className="bg-slate-900 text-white px-5 py-3.5 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-1.5">
            <Printer className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-bold uppercase tracking-wider">Nota Digital / Cetak Struk</span>
          </div>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-slate-850 rounded text-slate-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable contents */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          
          {/* Thermal Layout Option Toggles */}
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
            <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Pilih Ukuran Kertas Thermal Printer</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaperWidth('58mm')}
                className={`py-1.5 text-xs font-bold rounded-lg border transition-all ${
                  paperWidth === '58mm'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Lebar 58mm (Kasir / Mini)
              </button>
              <button
                type="button"
                onClick={() => setPaperWidth('80mm')}
                className={`py-1.5 text-xs font-bold rounded-lg border transition-all ${
                  paperWidth === '80mm'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Lebar 80mm (Standar POS)
              </button>
            </div>
          </div>

          {/* Paper Bill Receipt preview wrapper */}
          <div className="flex justify-center bg-slate-100/50 p-4 rounded-xl border border-dashed border-slate-200 max-h-[45vh] overflow-y-auto">
            {/* Exactly simulated print panel */}
            <div 
              id="print-section-root"
              style={{ width: paperWidth === '58mm' ? '280px' : '380px' }}
              className="bg-white p-4 border border-slate-200 shadow-sm font-mono text-[11px] text-slate-900 leading-normal space-y-4 select-text"
            >
              {/* Header / Kop Outlet info */}
              <div className="text-center space-y-1">
                <h4 className="text-sm font-extrabold tracking-tight uppercase">{outlet.name}</h4>
                <p className="text-[10px] text-slate-600 leading-normal font-sans">{outlet.address}</p>
                <p className="text-[10px] text-slate-500 font-sans">WhatsApp: {outlet.phone}</p>
                <div className="border-b border-dashed border-slate-300 py-0.5"></div>
              </div>

              {/* Invoice Metadata table */}
              <div className="space-y-1 text-[10px]">
                <div className="flex justify-between">
                  <span>Nota:</span>
                  <span className="font-extrabold">{transaction.invoiceNumber || transaction.transactionId}</span>
                </div>
                {transaction.queueNumber && (
                  <div className="flex justify-between">
                    <span>Antrean (Queue):</span>
                    <span className="font-extrabold text-blue-700">{transaction.queueNumber}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Tgl Masuk:</span>
                  <span>{formatDateTime(transaction.receivedAt)}</span>
                </div>
                {transaction.estimatedDoneAt && (
                  <div className="flex justify-between">
                    <span>Estimasi Selesai:</span>
                    <span className="font-bold text-amber-700">{formatDateTime(transaction.estimatedDoneAt)}</span>
                  </div>
                )}
                <div className="border-b border-dashed border-slate-200 my-1"></div>
                
                {/* Customer specs details */}
                <div className="flex justify-between">
                  <span>Pelanggan:</span>
                  <span className="font-bold">{transaction.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span>Telp Handphone:</span>
                  <span>{transaction.customerPhone}</span>
                </div>
                {transaction.notes && (
                  <div className="mt-1 text-[9.5px] italic text-slate-600 border-l-2 border-slate-300 pl-1">
                    Instruksi: {transaction.notes}
                  </div>
                )}
                <div className="border-b border-dashed border-slate-200 my-1"></div>
                <div className="flex justify-between">
                  <span>Petugas Kasir:</span>
                  <span>{transaction.cashierName || 'Kasir Aktif'}</span>
                </div>
              </div>

              <div className="border-b border-dashed border-slate-300"></div>

              {/* Items listing table with accurate columns layout spacing */}
              <div className="space-y-1.5">
                <span className="block text-[8.5px] font-bold text-slate-400 uppercase tracking-wider font-sans">Daftar Cucian Jasa</span>
                <div className="space-y-1.5">
                  {transaction.items && transaction.items.map((it, idx) => {
                    const price = it.unitPrice || it.pricePerUnit;
                    const sub = it.subtotal || it.totalPrice || (price * it.qty);
                    return (
                      <div key={idx} className="space-y-0.5 text-[10.5px]">
                        <div className="flex justify-between font-bold">
                          <span className="max-w-[190px] truncate">{it.name || it.serviceName}</span>
                          <span>{formatRupiah(sub)}</span>
                        </div>
                        <div className="flex justify-between text-[9.5px] text-slate-500 pl-1">
                          <span>{it.qty} x {formatRupiah(price)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="border-b border-dashed border-slate-300"></div>

              {/* Billing totals section summary */}
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{formatRupiah(transaction.subtotal || transaction.totalAmount + (transaction.discountAmount || 0))}</span>
                </div>
                {transaction.discountAmount > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>Diskon Manual</span>
                    <span>-{formatRupiah(transaction.discountAmount)}</span>
                  </div>
                )}
                {transaction.tax > 0 && (
                  <div className="flex justify-between">
                    <span>Pajak</span>
                    <span>{formatRupiah(transaction.tax)}</span>
                  </div>
                )}
                <div className="flex justify-between font-extrabold border-t border-slate-200 pt-1 text-slate-900">
                  <span>TOTAL AKHIR</span>
                  <span>{formatRupiah(transaction.grandTotal || transaction.totalAmount)}</span>
                </div>
                
                {/* Outstanding balance or fully settled calculations */}
                <div className="flex justify-between pt-0.5">
                  <span>Jumlah Bayar</span>
                  <span className="font-bold">{formatRupiah(transaction.paidAmount ?? 0)}</span>
                </div>

                {/* Settle state or remaining balance badge */}
                <div className="flex justify-between items-center py-1">
                  <span>Status Settle:</span>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold ${
                    transaction.paymentStatus === 'paid'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                      : transaction.paymentStatus === 'partial'
                      ? 'bg-blue-50 text-blue-700 border border-blue-100'
                      : 'bg-rose-50 text-rose-700 border border-rose-100'
                  }`}>
                    {getPaymentStatusLabel(transaction.paymentStatus)}
                  </span>
                </div>

                {(transaction.remainingAmount ?? 0) > 0 && (
                  <div className="flex justify-between text-rose-600 font-extrabold border-t border-dashed border-rose-200 pt-1">
                    <span>SISA TAGIHAN</span>
                    <span>{formatRupiah(transaction.remainingAmount)}</span>
                  </div>
                )}

                {(transaction.changeAmount ?? 0) > 0 && (
                  <div className="flex justify-between text-indigo-700 font-bold border-t border-dashed border-indigo-200 pt-1">
                    <span>KEMBALIAN (CASH)</span>
                    <span>{formatRupiah(transaction.changeAmount)}</span>
                  </div>
                )}

                <div className="flex justify-between text-[9.5px] text-slate-500 pt-1.5 border-t border-dashed border-slate-200">
                  <span>Metode:</span>
                  <span className="uppercase font-bold">{transaction.paymentMethod || 'CASH'}</span>
                </div>
              </div>

              <div className="border-b border-dashed border-slate-300"></div>

              {/* Barcode-like visual layout */}
              <div className="flex flex-col items-center justify-center py-1.5">
                <div className="flex items-stretch h-6 justify-center gap-0.5 opacity-95">
                  <div className="w-1.5 bg-black"></div>
                  <div className="w-0.5 bg-black"></div>
                  <div className="w-0.5 bg-black"></div>
                  <div className="w-1 bg-black"></div>
                  <div className="w-0.5 bg-black"></div>
                  <div className="w-1.5 bg-black"></div>
                  <div className="w-0.5 bg-black"></div>
                  <div className="w-1 bg-black"></div>
                  <div className="w-1.5 bg-black"></div>
                  <div className="w-0.5 bg-black"></div>
                  <div className="w-1 bg-black"></div>
                </div>
                <span className="text-[8.5px] font-mono mt-0.5">*{transaction.invoiceNumber || transaction.transactionId}*</span>
              </div>

              {/* QR-code vector simulator */}
              <div className="flex flex-col items-center justify-center p-1.5 bg-white border border-slate-100 rounded-lg max-w-[120px] mx-auto">
                <svg width="60" height="60" viewBox="0 0 29 29" className="shape-rendering-crispEdges">
                  <path fill="#000000" d="M0 0h7v7H0zm22 0h7v7h-7zM0 22h7v7H0zm9-22h1v1H9zm2 0h1v3h-1zm3 0h4v1h-4zm5 0h1v2h-1zm-9 2h2v1h-2zm3 0h1v2h-1zm1 0h1v1h-1zm3 0h1v1h-1zm-7 3h1v2h-1zm2 0h2v1h-2zm3 0h2v1h-2zm3 0h1v1h-1zm-9 2h1v1H9zm5 0h2v1h-2zm3 0h1v1h-1zm2 0h1v1h-1zm1 0h1v1h-1zm-13 2h1v1H8zm5-1h1v2h-1zm2 0h1v1h-1zm4 0h1v2h-1zm-10 2h3v1h-3zm4 0h1v1h-1zm3 0h2v1h-2zm1 0h1v1h-1zm-10 2h1v1H8zm2 0h1v1h-1zm2 0h1v1h-1zm4 0h1v1h-1zm-9 2h2v1H7zm4 0h1v1h-1zm2 0h3v1h-3zm1 2h2v1h-2zm5 0h1v1h-1zm-1 1h1v1h-1zm-5 1h2v1h-2zm3 0h1v1h-1zm3 0h1v1h-1z"/>
                  <path fill="#000000" d="M1 1h5v5H1zm22 0h5v5h-5zM1 23h5v5H1z"/>
                  <path fill="#ffffff" d="M2 2h3v3H2zm21 0h5v5h-5zM2 24h3v3H2z"/>
                  <path fill="#222222" d="M3 3h1v1H3zm22 0h1v1h-1zM3 25h1v1H3z"/>
                </svg>
                <span className="text-[7.5px] font-mono text-slate-500 mt-1">Scan Nota Digital</span>
              </div>

              {/* Footer notes policies */}
              <div className="text-center text-[8.5px] text-slate-500 space-y-1 font-sans border-t border-dashed border-slate-200 pt-2">
                <p>Terima kasih atas kepercayaan Anda!</p>
                <p className="italic">"Pakaian yang tidak diambil dalam 30 hari di luar tanggung jawab outlet kami."</p>
                <p className="font-semibold text-[7.5px] text-slate-400 mt-1 tracking-wider">LAUNDRYKU WORKSPACE SAAS</p>
              </div>
            </div>
          </div>

          {/* Toast Notification Banner for Real-term Dispatch Outcomes */}
          {toastMessage && (
            <div className={`p-3 text-xs rounded-xl flex items-start gap-2 animate-flicker ${
              toastMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-l-4 border-emerald-500' : 'bg-red-50 text-red-800 border-l-4 border-red-500'
            }`}>
              {toastMessage.type === 'success' ? (
                <CheckCircle2 className="w-4.5 h-4.5 shrink-0 mt-0.5 text-emerald-600 font-bold" />
              ) : (
                <AlertCircle className="w-4.5 h-4.5 shrink-0 mt-0.5 text-red-600 font-bold" />
              )}
              <span className="font-sans leading-tight font-medium">{toastMessage.body}</span>
            </div>
          )}

          {/* NEW WhatsApp Automation Engine Controls */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 shadow-3xs space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-600 animate-pulse" />
                <span className="text-[11px] font-extrabold text-slate-800 uppercase tracking-widest font-sans">
                  WhatsApp Automated Outbox Engine
                </span>
              </div>
              <span className="bg-emerald-100 text-emerald-800 text-[8px] font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                Fonnte Active
              </span>
            </div>

            <p className="text-[10px] text-slate-500 leading-normal font-sans">
              Kirim notifikasi otomatis secara berkala sesuai dengan tahapan proses laundry pelanggan saat ini. Sistem secara dinamis memetakan nama pelanggan, nomor nota, sisa tagihan, rincian item, dan estimasi waktu kelar.
            </p>

            {/* Button grid */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={loadingTemplate !== null}
                onClick={() => handleTriggerWA('order_received')}
                className="flex items-center justify-between p-2.5 bg-white hover:bg-emerald-50 hover:border-emerald-300 border border-slate-200 text-slate-700 hover:text-emerald-800 rounded-xl text-[10px] font-bold transition duration-150 shadow-2xs group disabled:opacity-50"
              >
                <span className="truncate">Kirim WA Diterima</span>
                {loadingTemplate === 'order_received' ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                ) : (
                  <Send className="w-3 h-3 text-slate-400 group-hover:text-emerald-500" />
                )}
              </button>

              <button
                type="button"
                disabled={loadingTemplate !== null}
                onClick={() => handleTriggerWA('order_processing')}
                className="flex items-center justify-between p-2.5 bg-white hover:bg-emerald-50 hover:border-emerald-300 border border-slate-200 text-slate-700 hover:text-emerald-800 rounded-xl text-[10px] font-bold transition duration-150 shadow-2xs group disabled:opacity-50"
              >
                <span className="truncate">Kirim WA Diproses</span>
                {loadingTemplate === 'order_processing' ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                ) : (
                  <Send className="w-3 h-3 text-slate-400 group-hover:text-emerald-500" />
                )}
              </button>

              <button
                type="button"
                disabled={loadingTemplate !== null}
                onClick={() => handleTriggerWA('order_ready')}
                className="flex items-center justify-between p-2.5 bg-white hover:bg-emerald-50 hover:border-emerald-300 border border-slate-200 text-slate-700 hover:text-emerald-800 rounded-xl text-[10px] font-bold transition duration-150 shadow-2xs group disabled:opacity-50"
              >
                <span className="truncate">Kirim WA Siap Diambil</span>
                {loadingTemplate === 'order_ready' ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                ) : (
                  <Send className="w-3 h-3 text-slate-400 group-hover:text-emerald-500" />
                )}
              </button>

              <button
                type="button"
                disabled={loadingTemplate !== null}
                onClick={() => handleTriggerWA('order_completed')}
                className="flex items-center justify-between p-2.5 bg-white hover:bg-emerald-50 hover:border-emerald-300 border border-slate-200 text-slate-700 hover:text-emerald-800 rounded-xl text-[10px] font-bold transition duration-150 shadow-2xs group disabled:opacity-50"
              >
                <span className="truncate">Kirim WA Selesai</span>
                {loadingTemplate === 'order_completed' ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                ) : (
                  <Send className="w-3 h-3 text-slate-400 group-hover:text-emerald-500" />
                )}
              </button>
            </div>

            <button
              type="button"
              disabled={loadingTemplate !== null}
              onClick={() => handleTriggerWA('payment_reminder')}
              className="w-full flex items-center justify-between p-2.5 bg-amber-50 hover:bg-amber-100 hover:border-amber-300 border border-amber-200 text-amber-950 rounded-xl text-[10px] font-bold transition duration-150 shadow-2xs group disabled:opacity-50"
            >
              <span className="truncate">⚠️ Kirim Pesan Tagihan / Pengingat Sampingan</span>
              {loadingTemplate === 'payment_reminder' ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-600" />
              ) : (
                <Send className="w-3 h-3 text-amber-600 group-hover:translate-x-0.5 transition" />
              )}
            </button>
          </div>

          {/* Realtime logs timeline list */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-blue-500" />
                <span className="text-[11px] font-extrabold text-slate-800 uppercase tracking-widest font-sans">
                  Log Pengiriman Struk & Notifikasi (Live)
                </span>
              </div>
              <span className="bg-blue-100 text-blue-900 text-[8px] font-extrabold px-1.5 py-0.5 rounded-full">
                {notifLogs.length} Terkirim
              </span>
            </div>

            {notifLogs.length === 0 ? (
              <p className="text-[10px] text-slate-400 font-sans italic py-3 text-center bg-white rounded-xl border border-dashed border-slate-200">
                Belum ada pengiriman terotomatisasi via Fonnte yang tercatat.
              </p>
            ) : (
              <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                {notifLogs.map((log) => (
                  <div key={log.notificationId} className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-4xs flex flex-col gap-1 text-[10px] font-sans">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-extrabold text-slate-700">
                        {log.templateType === 'order_received' ? 'Order Diterima' :
                         log.templateType === 'order_processing' ? 'Order Diproses' :
                         log.templateType === 'order_ready' ? 'Order Siap Diambil' :
                         log.templateType === 'order_completed' ? 'Order Selesai' :
                         log.templateType === 'payment_reminder' ? 'Pengingat Tagihan' : log.templateType}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wider ${
                        log.status === 'sent' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {log.status === 'sent' ? 'DIPROSES' : 'GAGAL'}
                      </span>
                    </div>
                    <div className="text-[9px] text-slate-400 flex items-center justify-between">
                      <span>Operator: {log.sentByName || 'System'}</span>
                      <span>{new Date(log.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    {log.responseMessage && log.status === 'failed' && (
                      <p className="text-[9px] text-red-650 bg-red-50 p-1.5 rounded-md mt-1 italic border border-red-100">
                        Detail: {log.responseMessage}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Social notification generator - Click to send fallback */}
          <div className="space-y-2.5">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
              📱 WhatsApp Manual Teks / Salin Clipboard
            </label>
            <div className="bg-slate-900 text-slate-300 rounded-xl p-3.5 text-xs font-mono select-all leading-relaxed relative border border-slate-800">
              <pre className="whitespace-pre-wrap">{wsTextTemplate}</pre>
            </div>

            <div className="flex gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCopyText}
                className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600" /> Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4.5 h-4.5" /> Salin Teks WA
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleSendWA}
                className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-2xs"
              >
                <Send className="w-4.5 h-4.5" /> Kirim Manual (Click-to-WA)
              </button>
            </div>
          </div>

        </div>

        {/* Bottom actions closing toolbar */}
        <div className="bg-slate-50 border-t border-slate-150 p-4 flex justify-between shrink-0 font-medium">
          <button
            onClick={handlePrint}
            className="px-4 py-2 text-xs border border-blue-200 text-blue-700 bg-blue-50/50 rounded-lg hover:bg-blue-100 font-bold flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" /> Cetak Struk Kertas (Thermal)
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs bg-slate-900 text-white rounded-lg hover:bg-slate-800 font-bold"
          >
            Selesai & Tutup
          </button>
        </div>

      </div>
    </div>
  );
};

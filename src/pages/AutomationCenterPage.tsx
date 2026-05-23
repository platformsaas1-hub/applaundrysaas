import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTenant } from '../context/TenantContext';
import { db } from '../firebase/config';
import { handleFirestoreError, OperationType } from '../firebase/errorModel';
import { 
  collection, 
  query, 
  onSnapshot, 
  orderBy, 
  limit, 
  doc, 
  updateDoc,
  where,
  Timestamp
} from 'firebase/firestore';
import { 
  Zap, 
  RefreshCw, 
  XOctagon, 
  MessageSquare, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  User, 
  Play, 
  Filter, 
  FileText,
  Send,
  Loader2,
  ShieldAlert
} from 'lucide-react';
import { AutomationJob, AutomationNotificationLog, Transaction } from '../types';
import { runProcessorCycle, triggerManualCustomMessage } from '../services/automation/automationEngine';
import { formatRupiah } from '../utils/formatting';
import { canAccessRoute } from '../utils/rbac';

export function AutomationCenterPage() {
  const { userProfile } = useAuth();
  const { outlets, activeOutletId } = useTenant();

  const [jobs, setJobs] = useState<AutomationJob[]>([]);
  const [logs, setLogs] = useState<AutomationNotificationLog[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [selectedTxId, setSelectedTxId] = useState('');
  const [customMessageText, setCustomMessageText] = useState('');
  
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const [queueActionResult, setQueueActionResult] = useState<string | null>(null);
  
  const [submittingManual, setSubmittingManual] = useState(false);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);

  const tenantId = userProfile?.tenantId || null;

  // 1. Subscribe to Real-Time Automation Jobs List
  useEffect(() => {
    if (!tenantId) return;
    if (userProfile && !canAccessRoute(userProfile.role, '/automation')) return;

    const jobsRef = collection(db, 'tenants', tenantId, 'automationJobs');
    const q = query(
      jobsRef,
      where('isDeleted', '==', false),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: AutomationJob[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as AutomationJob);
      });
      setJobs(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `tenants/${tenantId}/automationJobs`);
    });

    return unsubscribe;
  }, [tenantId, userProfile]);

  // 2. Subscribe to Real-Time Immutable Notification Logs List
  useEffect(() => {
    if (!tenantId) return;
    if (userProfile && !canAccessRoute(userProfile.role, '/automation')) return;

    const logsRef = collection(db, 'tenants', tenantId, 'notificationLogs');
    const q = query(
      logsRef,
      orderBy('createdAt', 'desc'),
      limit(25)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: AutomationNotificationLog[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as AutomationNotificationLog);
      });
      setLogs(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `tenants/${tenantId}/notificationLogs`);
    });

    return unsubscribe;
  }, [tenantId, userProfile]);

  // 3. Subscribe to active non-deleted Transactions to populate manual selects
  useEffect(() => {
    if (!tenantId) return;
    if (userProfile && !canAccessRoute(userProfile.role, '/automation')) return;

    const txRef = collection(db, 'tenants', tenantId, 'transactions');
    const q = query(
      txRef,
      where('isDeleted', '==', false),
      orderBy('createdAt', 'desc'),
      limit(30)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Transaction[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as Transaction);
      });
      setTransactions(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `tenants/${tenantId}/transactions`);
    });

    return unsubscribe;
  }, [tenantId, userProfile]);

  // Custom route check
  if (userProfile && !canAccessRoute(userProfile.role, '/automation')) {
    return (
      <div className="h-[calc(100vh-140px)] flex flex-col justify-center items-center text-slate-500 p-8 text-center bg-slate-50 rounded-2xl mx-6 my-4 border border-slate-200 select-none">
        <ShieldAlert className="w-14 h-14 text-rose-500 mb-4 animate-pulse" />
        <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">Akses Ditolak</h2>
        <p className="text-xs text-slate-500 mt-2 max-w-md font-semibold font-sans">
          Role Anda tidak memiliki izin untuk halaman ini.
        </p>
      </div>
    );
  }

  // Execute queue processor manually
  const handleForceProcessQueue = async () => {
    if (!tenantId) return;
    setIsProcessingQueue(true);
    setQueueActionResult(null);

    try {
      const runCount = await runProcessorCycle(tenantId);
      setQueueActionResult(`Penyelesaian Berhasil: Diproses ${runCount} pesan job WhatsApp.`);
      setTimeout(() => setQueueActionResult(null), 5000);
    } catch (err: any) {
      setQueueActionResult(`Proses Gagal pintu gateway: ${err?.message || err}`);
    } finally {
      setIsProcessingQueue(false);
    }
  };

  // Retry/Re-run a specific automation job (reset back to queued)
  const handleRetryJob = async (jobId: string) => {
    if (!tenantId) return;
    const jobRef = doc(db, 'tenants', tenantId, 'automationJobs', jobId);

    try {
      await updateDoc(jobRef, {
        status: 'queued',
        retryCount: 0,
        nextRetryAt: null,
        errorMessage: null,
        updatedAt: Timestamp.now()
      });
      console.log(`Job restarted successfully: ${jobId}`);
      // Immediately process the queue in background
      runProcessorCycle(tenantId).catch(console.error);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `tenants/${tenantId}/automationJobs/${jobId}`);
    }
  };

  // Cancel/Kill a pending queued automation job
  const handleCancelJob = async (jobId: string) => {
    if (!tenantId) return;
    const jobRef = doc(db, 'tenants', tenantId, 'automationJobs', jobId);

    try {
      await updateDoc(jobRef, {
        status: 'cancelled',
        updatedAt: Timestamp.now()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `tenants/${tenantId}/automationJobs/${jobId}`);
    }
  };

  // Handle manual modal custom message submission
  const handleSubmitManualMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !selectedTxId || !customMessageText.trim()) return;

    const matchedTx = transactions.find(t => t.transactionId === selectedTxId);
    if (!matchedTx) return;

    setSubmittingManual(true);
    try {
      const outletObj = outlets.find(o => o.outletId === matchedTx.outletId || o.outletId === activeOutletId);
      
      const success = await triggerManualCustomMessage({
        tenantId,
        outletId: matchedTx.outletId || activeOutletId || 'outlet_default',
        outletName: outletObj?.name || 'LaundryKu',
        transaction: matchedTx,
        customMessage: customMessageText.trim(),
        operatorUid: userProfile?.userId || 'anonymous',
        operatorName: userProfile?.name || 'Kasir Penjualan'
      });

      if (success) {
        setIsManualModalOpen(false);
        setSelectedTxId('');
        setCustomMessageText('');
      } else {
        alert('Terjadi kesalahan mendaftarkan jadwal pengiriman manual.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingManual(false);
    }
  };

  // Formats trigger label readable
  const formatTrigger = (trig: string) => {
    switch (trig) {
      case 'checkout': return 'POS Checkout';
      case 'status_change': return 'Ubah Status Operational';
      case 'payment_update': return 'Setor Pembayaran';
      case 'manual': return 'Kirim Manual';
      case 'system': return 'Scheduler Otomatis';
      default: return trig;
    }
  };

  // Formats job category readable
  const formatJobType = (type: string) => {
    switch (type) {
      case 'send_receipt': return 'Kirim Nota Pelanggan';
      case 'ready_pickup': return 'Selesai & Siap Diambil';
      case 'overdue_pickup': return 'Pengingat Cucian Mengendap';
      case 'partial_payment_reminder': return 'Tagihan Sebagian Pembayaran';
      case 'custom_manual': return 'WhatsApp WA Manual';
      default: return type;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'queued': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'processing': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'sent': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'failed': return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'cancelled': return 'bg-slate-50 text-slate-500 border-slate-200';
      default: return 'bg-slate-50 border-slate-200';
    }
  };

  const filteredJobs = jobs.filter(j => {
    const sMatch = statusFilter === 'all' || j.status === statusFilter;
    const tMatch = typeFilter === 'all' || j.type === typeFilter;
    return sMatch && tMatch;
  });

  // Calculate stats summary counters
  const queuedCount = jobs.filter(j => j.status === 'queued').length;
  const processingCount = jobs.filter(j => j.status === 'processing').length;
  const sentCount = jobs.filter(j => j.status === 'sent').length;
  const failedCount = jobs.filter(j => j.status === 'failed').length;

  return (
    <div className="space-y-6">
      
      {/* Page header and primary action triggers */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Zap className="w-5 h-5 text-blue-600 fill-blue-100" />
            AUTOMATION CENTER WORKFLOW
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Eskalasi pesan instan WhatsApp otomatis berbasis event digital dengan sistem queue antiblokir.
          </p>
        </div>
        
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => setIsManualModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 text-white rounded-lg text-xs font-extrabold hover:bg-slate-800 tracking-wider shadow-sm transition duration-150"
          >
            <MessageSquare className="w-4 h-4" />
            DIAL WHATSAPP MANUAL
          </button>
          
          <button
            onClick={handleForceProcessQueue}
            disabled={isProcessingQueue}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-extrabold hover:bg-blue-700 tracking-wider shadow-sm disabled:opacity-50 transition duration-150"
          >
            {isProcessingQueue ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4 fill-white" />
            )}
            RUN ACTIVE QUEUE WORKER
          </button>
        </div>
      </div>

      {queueActionResult && (
        <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 text-xs font-bold rounded-lg flex items-center gap-2 animate-pulse">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {queueActionResult}
        </div>
      )}

      {/* Numerical Metrics Grid summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="p-2.5 bg-amber-50 rounded-lg text-amber-600 shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Antrean Queued</p>
            <p className="text-lg font-black text-slate-800 leading-none mt-1">{queuedCount} <span className="text-[10px] text-slate-400 font-normal">Jobs</span></p>
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 rounded-lg text-blue-600 shrink-0 animate-spin">
            <RefreshCw className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Sedang Diproses</p>
            <p className="text-lg font-black text-slate-800 leading-none mt-1">{processingCount} <span className="text-[10px] text-slate-400 font-normal">Active</span></p>
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 rounded-lg text-emerald-600 shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Pesan Terkirim</p>
            <p className="text-lg font-black text-slate-800 leading-none mt-1">{sentCount} <span className="text-[10px] text-slate-400 font-normal">Delivered</span></p>
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="p-2.5 bg-rose-50 rounded-lg text-rose-600 shrink-0">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Gagal Terkirim</p>
            <p className="text-lg font-black text-slate-800 leading-none mt-1">{failedCount} <span className="text-[10px] text-slate-400 font-normal">Retrying</span></p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Core Jobs ledger list view */}
        <div className="xl:col-span-2 space-y-4">
          
          {/* Filtering row */}
          <div className="p-4 bg-white rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-4 shadow-2xs">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Filter Jobs:</span>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
              >
                <option value="all">Semua Status</option>
                <option value="queued">Queued / Menunggu</option>
                <option value="processing">Processing</option>
                <option value="sent">Sent / Berhasil</option>
                <option value="failed">Failed / Gagal</option>
                <option value="cancelled">Cancelled</option>
              </select>

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
              >
                <option value="all">Semua Kategori</option>
                <option value="send_receipt">Kirim Nota Pelanggan</option>
                <option value="ready_pickup">Selesai &amp; Siap Diambil</option>
                <option value="overdue_pickup">Cucian Mengendap</option>
                <option value="partial_payment_reminder">Pengingat Tagihan</option>
                <option value="custom_manual">Kirim Manual</option>
              </select>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            {filteredJobs.length === 0 ? (
              <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
                <FileText className="w-10 h-10 text-slate-300 stroke-1" />
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Tidak ada record job otomatisasi ditemukan</p>
                <p className="text-[11px] text-slate-400 max-w-sm mt-0.5 leading-relaxed">
                  Semua aktivitas transaksi baru di Point of Sale maupun perubahan conveyor antrean akan muncul di sini secara otomatis.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600 border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200/80 font-bold text-slate-500 uppercase tracking-wider text-[10px] select-none">
                      <th className="p-4">Alur / Kategori</th>
                      <th className="p-4">Nama Pelanggan</th>
                      <th className="p-4">Triggered By</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-center">Retry</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredJobs.map((job) => {
                      const isExpanded = expandedJobId === job.jobId;
                      return (
                        <React.Fragment key={job.jobId}>
                          <tr className="hover:bg-slate-50/50 transition duration-100">
                            <td className="p-4">
                              <div>
                                <p className="font-extrabold text-slate-800 leading-tight">
                                  {formatJobType(job.type)}
                                </p>
                                <p className="text-[9px] text-slate-400 font-mono mt-0.5">
                                  ID: {job.jobId} {job.transactionId ? `// Inv: #${job.transactionId.slice(-6)}` : ''}
                                </p>
                              </div>
                            </td>
                            <td className="p-4">
                              <p className="font-bold text-slate-800 flex items-center gap-1">
                                <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                {job.customerName}
                              </p>
                              <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                                {job.customerPhone}
                              </p>
                            </td>
                            <td className="p-4">
                              <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-600 text-[10px] font-bold">
                                {formatTrigger(job.triggeredBy)}
                              </span>
                            </td>
                            <td className="p-4">
                              <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${getStatusColor(job.status)}`}>
                                {job.status.toUpperCase()}
                              </span>
                            </td>
                            <td className="p-4 text-center font-bold text-slate-700 font-mono">
                              {job.retryCount} <span className="text-slate-400">/ {job.maxRetries}</span>
                            </td>
                            <td className="p-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => setExpandedJobId(isExpanded ? null : job.jobId)}
                                  className="px-2 py-1 bg-slate-100 border border-slate-200 hover:bg-slate-200 text-[10px] font-bold rounded-md text-slate-600"
                                >
                                  {isExpanded ? 'Sembunyikan' : 'Baca Pesan'}
                                </button>

                                {['failed', 'cancelled'].includes(job.status) && (
                                  <button
                                    onClick={() => handleRetryJob(job.jobId)}
                                    title="Kirim ulang"
                                    className="p-1 px-1.5 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-600 rounded-md text-[10px] font-bold"
                                  >
                                    RETRY
                                  </button>
                                )}

                                {['queued', 'failed'].includes(job.status) && (
                                  <button
                                    onClick={() => handleCancelJob(job.jobId)}
                                    title="Batalkan pengiriman"
                                    className="p-1 px-1.5 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-600 rounded-md text-[10px] font-bold"
                                  >
                                    CANCEL
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>

                          {isExpanded && (
                            <tr className="bg-slate-50/50">
                              <td colSpan={6} className="p-4 border-t border-b border-slate-100">
                                <div className="space-y-2 text-[11px] font-medium leading-relaxed">
                                  <div className="bg-white p-3 rounded-lg border border-slate-200 font-mono text-slate-700 whitespace-pre-wrap">
                                    {job.message}
                                  </div>
                                  {job.errorMessage && (
                                    <div className="p-2.5 bg-rose-50 border border-rose-100 rounded text-rose-700 font-mono flex items-center gap-1.5 leading-none">
                                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                      Error Trace Log: {job.errorMessage}
                                    </div>
                                  )}
                                  <div className="text-[10px] text-slate-400 flex items-center gap-4">
                                    <span>Dikomit oleh: {job.createdByName} ({job.createdBy})</span>
                                    <span>Masa Cooldown: {job.nextRetryAt ? `Cooldowned hingga ${new Date(job.nextRetryAt instanceof Timestamp ? job.nextRetryAt.toMillis() : new Date(job.nextRetryAt).getTime()).toLocaleTimeString('id-ID')}` : 'Siap diproses'}</span>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar logs list (Immutable Delivery notificationLogs) */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                IMMUTABLE AUDIT LOGS
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-slate-200 border border-slate-300 text-slate-600 font-bold text-[9px] uppercase">
                Gateway Audit
              </span>
            </div>

            <div className="divide-y divide-slate-100 max-h-[580px] overflow-y-auto">
              {logs.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  Belum ada laporan audit log logoritme.
                </div>
              ) : (
                logs.map((log) => {
                  const logTimeObj = log.createdAt instanceof Timestamp 
                    ? log.createdAt.toDate() 
                    : new Date(log.createdAt);
                  return (
                    <div key={log.logId} className="p-3.5 hover:bg-slate-50 text-[11px] space-y-1.5 transition duration-100">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-extrabold text-slate-800 uppercase tracking-wide">
                          {formatJobType(log.type)}
                        </span>
                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold border ${log.status === 'sent' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                          {log.status.toUpperCase()}
                        </span>
                      </div>
                      
                      <div className="font-medium text-slate-600 bg-slate-50 p-2 rounded border border-slate-100 max-h-16 overflow-y-auto text-[10px] leading-tight font-mono select-text">
                        {log.message}
                      </div>

                      <div className="flex items-center justify-between text-[9px] text-slate-400 font-bold">
                        <span>Target: {log.target} // {log.provider}</span>
                        <span>{logTimeObj.toLocaleTimeString('id-ID')}</span>
                      </div>
                      {log.errorMessage && (
                        <p className="text-[9.5px] text-rose-600 font-bold leading-tight">
                          Error: {log.errorMessage}
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Manual Message Schedule Dispatch Drawer/Modal */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-zoomIn">
            <div className="p-4 bg-slate-900 border-b border-slate-800 text-white flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                <Send className="w-4 h-4 text-blue-400 fill-blue-900" />
                KIRIM WHATSAPP MANUAL PELANGGAN
              </h3>
              <button 
                onClick={() => setIsManualModalOpen(false)}
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400"
              >
                <XOctagon className="w-4 h-4 text-slate-400 hover:text-white" />
              </button>
            </div>

            <form onSubmit={handleSubmitManualMessage} className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Pilih Transaksi Aktif / Pelanggan *</label>
                <select
                  required
                  value={selectedTxId}
                  onChange={(e) => setSelectedTxId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                >
                  <option value="">-- Hubungkan Transaksi Pelanggan --</option>
                  {transactions.map(t => (
                    <option key={t.transactionId} value={t.transactionId}>
                      Invoice #{t.invoiceNumber || t.transactionId.slice(-6)}: {t.customerName} ({t.customerPhone}) - Status: {t.orderStatus.toUpperCase()} ({formatRupiah(t.grandTotal || t.totalAmount)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Isi Naskah Pesan Custom WhatsApp *</label>
                <textarea
                  required
                  placeholder="Ketik teks pesan custom di sini. Mendukung pemformatan standar WA seperti bintang (*) untuk teks tebal..."
                  rows={4}
                  value={customMessageText}
                  onChange={(e) => setCustomMessageText(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsManualModalOpen(false)}
                  className="px-3.5 py-2 border border-slate-200 bg-white hover:bg-slate-50 font-extrabold text-xs text-slate-600 rounded-lg uppercase tracking-wider"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingManual}
                  className="px-3.5 py-2 bg-slate-950 hover:bg-slate-800 text-white font-extrabold text-xs rounded-lg uppercase tracking-wider flex items-center gap-1.5 disabled:opacity-50 shadow-sm"
                >
                  {submittingManual ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  Masukkan ke Antrean
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

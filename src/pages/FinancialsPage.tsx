import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTenant } from '../context/TenantContext';
import { db } from '../firebase/config';
import { handleFirestoreError, OperationType } from '../firebase/errorModel';
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  limit, 
  doc, 
  setDoc, 
  updateDoc, 
  Timestamp 
} from 'firebase/firestore';
import { formatRupiah } from '../utils/formatting';
import { Expense, ShiftClosing, Transaction } from '../types';
import { 
  DollarSign, 
  Plus, 
  Trash2, 
  TrendingUp, 
  TrendingDown, 
  Layers, 
  Wallet, 
  Clock, 
  AlertTriangle, 
  ShieldAlert, 
  CheckCircle2, 
  X, 
  Calculator, 
  Calendar, 
  UserCheck, 
  FileText, 
  Search, 
  RefreshCw,
  Sliders,
  Sparkles,
  ArrowRight
} from 'lucide-react';

const EXPENSE_CATEGORIES = [
  { value: 'detergent', label: 'Deterjen / Sabun' },
  { value: 'parfum', label: 'Parfum / Pewangi' },
  { value: 'listrik', label: 'Listrik' },
  { value: 'air', label: 'Air PDAM / Sumur' },
  { value: 'transport', label: 'Transport / BBM' },
  { value: 'maintenance', label: 'Pemeliharaan Mesin' },
  { value: 'gaji', label: 'Gaji Karyawan' },
  { value: 'operasional', label: 'Operasional Lain' },
  { value: 'lainnya', label: 'Pengeluaran Lainnya' }
];

export function FinancialsPage() {
  const { userProfile, currentUser } = useAuth();
  const { tenant, activeOutletId, outlets } = useTenant();

  const tenantId = userProfile?.tenantId || null;
  const currentRole = userProfile?.role || 'kasir';
  const isOwnerOrAdmin = currentRole === 'owner' || currentRole === 'admin';

  // State arrays for components
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [shifts, setShifts] = useState<ShiftClosing[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [activeShift, setActiveShift] = useState<ShiftClosing | null>(null);

  // Filter & Search states
  const [expenseSearch, setExpenseSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedOutletForReports, setSelectedOutletForReports] = useState(activeOutletId || 'all');

  // New Expense Form States
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('detergent');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseNotes, setExpenseNotes] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);

  // Shift Modals States
  const [showOpenShift, setShowOpenShift] = useState(false);
  const [showCloseShift, setShowCloseShift] = useState(false);
  const [openingCashInput, setOpeningCashInput] = useState('');
  const [actualCashInput, setActualCashInput] = useState('');
  const [closeShiftNotes, setCloseShiftNotes] = useState('');

  // 1. Double check permission
  if (currentRole === 'pegawai') {
    return (
      <div id="unauthorized-expense-screen" className="p-8 text-center bg-white rounded-2xl border border-slate-200 shadow-2xs max-w-md mx-auto mt-16 space-y-4">
        <ShieldAlert className="w-16 h-16 text-rose-500 mx-auto animate-bounce" />
        <h2 className="text-lg font-extrabold text-slate-800 uppercase tracking-tight">Akses Ditolak [Pegawai]</h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          Sesuai SOP LaundryKu Enterprise, staf pegawai dilarang keras mengakses laporan jajaran keuangan, pengeluaran kas, maupun pembukuan mesin kassa shift.
        </p>
      </div>
    );
  }

  // 2. Real-time synchronizations of EXPENSES (Tenant-isolated, bounded query)
  useEffect(() => {
    if (!tenantId) return;

    const expenseRef = collection(db, 'tenants', tenantId, 'expenses');
    const q = query(
      expenseRef,
      where('isDeleted', '==', false),
      orderBy('createdAt', 'desc'),
      limit(200)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Expense[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as Expense);
      });
      setExpenses(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `tenants/${tenantId}/expenses`);
    });

    return unsubscribe;
  }, [tenantId]);

  // 3. Real-time synchronizations of Shift history (Tenant-isolated, bounded query)
  useEffect(() => {
    if (!tenantId) return;

    const shiftsRef = collection(db, 'tenants', tenantId, 'shiftClosings');
    const q = query(
      shiftsRef,
      orderBy('createdAt', 'desc'),
      limit(150)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: ShiftClosing[] = [];
      let foundActiveShift: ShiftClosing | null = null;

      snapshot.forEach((docSnap) => {
        const item = docSnap.data() as ShiftClosing;
        list.push(item);

        // Identify currently open shift for the CURRENT logged-in cashier at the ACTIVE outlet
        if (item.status === 'open' && item.cashierId === currentUser?.uid && item.outletId === activeOutletId) {
          foundActiveShift = item;
        }
      });

      setShifts(list);
      setActiveShift(foundActiveShift);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `tenants/${tenantId}/shiftClosings`);
    });

    return unsubscribe;
  }, [tenantId, activeOutletId, currentUser?.uid]);

  // 4. Bounded synchronization of all transaction cash records to sum shift expectations
  useEffect(() => {
    if (!tenantId) return;

    const txRef = collection(db, 'tenants', tenantId, 'transactions');
    const q = query(
      txRef,
      where('isDeleted', '==', false),
      orderBy('createdAt', 'desc'),
      limit(250) // bounded limit to prevent O(N) reads cost
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Transaction[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as Transaction);
      });
      setRecentTransactions(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `tenants/${tenantId}/transactions`);
    });

    return unsubscribe;
  }, [tenantId]);

  // 5. Active dynamic computations of active shift totals
  const activeShiftTransactions = useMemo(() => {
    if (!activeShift) return [];
    
    const openTime = new Date(activeShift.openedAt).getTime();
    return recentTransactions.filter(tx => {
      if (tx.outletId !== activeShift.outletId) return false;
      if (tx.cashierId !== activeShift.cashierId) return false;
      const txTime = new Date(tx.createdAt).getTime();
      return txTime >= openTime;
    });
  }, [activeShift, recentTransactions]);

  // Expected cash on hand = openingCash + revenue from CASH sales
  const activeShiftCalculations = useMemo(() => {
    const cashTotal = activeShiftTransactions
      .filter(tx => tx.paymentMethod?.toLowerCase() === 'cash')
      .reduce((acc, curr) => acc + (curr.paidAmount || curr.grandTotal || curr.totalAmount || 0), 0);

    const nonCashTotal = activeShiftTransactions
      .filter(tx => tx.paymentMethod?.toLowerCase() !== 'cash')
      .reduce((acc, curr) => acc + (curr.paidAmount || curr.grandTotal || curr.totalAmount || 0), 0);

    const totalRevenue = cashTotal + nonCashTotal;
    const totalTransactions = activeShiftTransactions.length;
    const expectedCash = (activeShift?.openingCash || 0) + cashTotal;

    return {
      cashTotal,
      nonCashTotal,
      totalRevenue,
      totalTransactions,
      expectedCash
    };
  }, [activeShift, activeShiftTransactions]);

  // 6. Cashflow Summary Indicators derived from selected Outlet context filter (Tenant Sandboxed)
  const cashflowSummary = useMemo(() => {
    const scopeTxs = recentTransactions.filter(tx => {
      if (selectedOutletForReports !== 'all' && tx.outletId !== selectedOutletForReports) {
        return false;
      }
      return true;
    });

    const activeExpenses = expenses.filter(exp => {
      if (selectedOutletForReports !== 'all' && exp.outletId !== selectedOutletForReports) {
        return false;
      }
      return true;
    });

    // gross revenue = total invoice amount
    const grossRevenue = scopeTxs.reduce((acc, curr) => acc + (curr.grandTotal || curr.totalAmount || 0), 0);
    // paid revenue = total cash/qris/transfer payments captured
    const paidRevenue = scopeTxs.reduce((acc, curr) => acc + (curr.paidAmount || 0), 0);
    // unpaid revenue = remainingAmount
    const unpaidRevenue = scopeTxs.reduce((acc, curr) => acc + (curr.remainingAmount || 0), 0);
    // expense total
    const expenseTotal = activeExpenses.reduce((acc, curr) => acc + (curr.amount || 0), 0);
    // net Income estimated
    const netIncomeEst = paidRevenue - expenseTotal;

    return {
      grossRevenue,
      paidRevenue,
      unpaidRevenue,
      expenseTotal,
      estimatedNetIncome: netIncomeEst,
      transactionCount: scopeTxs.length
    };
  }, [recentTransactions, expenses, selectedOutletForReports]);

  // Expense categories aggregate for pie charts or badges
  const categoryGroupedExpenses = useMemo(() => {
    const map: { [key: string]: number } = {};
    expenses.forEach(e => {
      map[e.category] = (map[e.category] || 0) + e.amount;
    });
    return map;
  }, [expenses]);

  // Action: Add Expense Entry (Cashier / Owner / Admin)
  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !activeOutletId) return;

    const amountNum = parseFloat(expenseAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert("Masukkan nilai jumlah pengeluaran rupiah yang valid.");
      return;
    }

    const generatedId = `exp_${Date.now()}`;
    const expDocRef = doc(db, 'tenants', tenantId, 'expenses', generatedId);

    const payload: Expense = {
      expenseId: generatedId,
      tenantId,
      outletId: activeOutletId,
      category: expenseCategory,
      title: expenseTitle,
      notes: expenseNotes || undefined,
      amount: amountNum,
      createdBy: currentUser?.uid || '',
      createdByName: userProfile?.name || 'Kasir',
      expenseDate,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDeleted: false
    };

    try {
      await setDoc(expDocRef, payload);
      setShowAddExpense(false);
      setExpenseTitle('');
      setExpenseAmount('');
      setExpenseNotes('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `tenants/${tenantId}/expenses/${generatedId}`);
    }
  };

  // Action: Soft Delete Expense (Owner / Admin ONLY)
  const handleDeleteExpense = async (expenseId: string) => {
    if (!isOwnerOrAdmin) return;
    if (!tenantId) return;

    if (!confirm("Apakah Anda yakin ingin menghapus catatan pengeluaran operasional ini?")) {
      return;
    }

    const expDocRef = doc(db, 'tenants', tenantId, 'expenses', expenseId);
    try {
      await updateDoc(expDocRef, {
        isDeleted: true,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `tenants/${tenantId}/expenses/${expenseId}`);
    }
  };

  // Action: Open Shift (Only 1 open shift per Cashier per Outlet)
  const handleOpenShiftSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !activeOutletId) return;

    const startingCash = parseFloat(openingCashInput);
    if (isNaN(startingCash) || startingCash < 0) {
      alert("Masukkan kas modal awal laci kassa yang valid (minimal 0).");
      return;
    }

    // Double check open shift constraint
    const overlappingOpenShift = shifts.find(s => 
      s.status === 'open' && 
      s.cashierId === currentUser?.uid && 
      s.outletId === activeOutletId
    );

    if (overlappingOpenShift) {
      alert("Gagal: Anda mendeteksi kassa shift aktif yang belum ditutup pada outlet ini.");
      return;
    }

    const generatedId = `shift_${Date.now()}`;
    const shiftDocRef = doc(db, 'tenants', tenantId, 'shiftClosings', generatedId);

    const payload: ShiftClosing = {
      shiftId: generatedId,
      tenantId,
      outletId: activeOutletId,
      cashierId: currentUser?.uid || '',
      cashierName: userProfile?.name || 'Kasir Aktif',
      openedAt: new Date().toISOString(),
      openingCash: startingCash,
      expectedCash: startingCash,
      status: 'open',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      await setDoc(shiftDocRef, payload);
      setShowOpenShift(false);
      setOpeningCashInput('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `tenants/${tenantId}/shiftClosings/${generatedId}`);
    }
  };

  // Action: Close Shift
  const handleCloseShiftSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !activeShift) return;

    const physicalCash = parseFloat(actualCashInput);
    if (isNaN(physicalCash) || physicalCash < 0) {
      alert("Masukkan jumlah fisik uang tunai di laci kassa dengan benar.");
      return;
    }

    const expectedCashValue = activeShiftCalculations.expectedCash;
    const diff = physicalCash - expectedCashValue;

    const shiftDocRef = doc(db, 'tenants', tenantId, 'shiftClosings', activeShift.shiftId);

    try {
      await updateDoc(shiftDocRef, {
        closedAt: new Date().toISOString(),
        actualCash: physicalCash,
        cashDifference: diff,
        totalTransactions: activeShiftCalculations.totalTransactions,
        totalRevenue: activeShiftCalculations.totalRevenue,
        notes: closeShiftNotes || undefined,
        status: 'closed',
        updatedAt: new Date().toISOString()
      });

      setShowCloseShift(false);
      setActualCashInput('');
      setCloseShiftNotes('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `tenants/${tenantId}/shiftClosings/${activeShift.shiftId}`);
    }
  };

  // Filtered Expenses Set (Interactive CRM filter)
  const filteredExpenses = expenses.filter(exp => {
    const matchSearch = exp.title.toLowerCase().includes(expenseSearch.toLowerCase()) || 
                        exp.createdByName?.toLowerCase().includes(expenseSearch.toLowerCase());
    const matchCategory = selectedCategory === 'all' || exp.category === selectedCategory;
    return matchSearch && matchCategory;
  });

  return (
    <div className="space-y-6 font-sans text-slate-800 animate-fade-in select-none">
      
      {/* HEADER COCKPIT SECTION */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-base font-extrabold text-slate-900 tracking-tight">Kassa Keuangan & Shift Karyawan</h1>
          <p className="text-[11px] text-slate-500 mt-1">Mengukur profitabilitas harian, pencatatan biaya, serta mutasi fisik modal kas laci.</p>
        </div>

        {/* BUTTON WORKFLOWS */}
        <div className="flex items-center gap-3 self-start md:self-center">
          {activeShift ? (
            <button
              onClick={() => {
                setActualCashInput('');
                setShowCloseShift(true);
              }}
              className="bg-amber-500 hover:bg-amber-600 border border-amber-600 text-white font-extrabold text-xs px-3.5 py-2 rounded-lg flex items-center gap-1.5 shadow-2xs transition-all"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Tutup Shift Kassa ({formatRupiah(activeShiftCalculations.expectedCash)})
            </button>
          ) : (
            <button
              onClick={() => {
                setOpeningCashInput('');
                setShowOpenShift(true);
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs px-3.5 py-2 rounded-lg flex items-center gap-1.5 shadow-2xs transition-all"
            >
              <Clock className="w-3.5 h-3.5" /> Buka Shift Kasir Baru
            </button>
          )}

          <button
            onClick={() => setShowAddExpense(true)}
            className="bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs px-3.5 py-2 rounded-lg flex items-center gap-1.5 shadow-2xs transition-all"
          >
            <Plus className="w-3.5 h-3.5" /> Catat Pengeluaran Baru
          </button>
        </div>
      </div>

      {/* SHIFT COCKPIT ACTIVE NOTICE */}
      {activeShift ? (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-emerald-100 rounded-lg text-emerald-700 mt-0.5 shrink-0">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <span className="text-[10px] bg-emerald-200 text-emerald-800 font-bold font-mono uppercase px-1.5 py-0.5 rounded">SHIFT AKTIF</span>
              <h3 className="text-xs font-bold text-slate-800 mt-1">Anda berada di dalam Shift Kerja yang Terbuka</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Kasir: <strong>{activeShift.cashierName}</strong> • Jam Mulai: <strong>{new Date(activeShift.openedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</strong> • Modal Awal Laci: <strong>{formatRupiah(activeShift.openingCash)}</strong>
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 bg-white/70 p-3 rounded-lg border border-emerald-150 shrink-0">
            <div className="flex flex-col pr-3 border-r border-slate-205">
              <span className="text-[9px] uppercase font-bold text-slate-400">Tunai Masuk (Drawer)</span>
              <span className="font-extrabold text-xs font-mono text-slate-800">{formatRupiah(activeShiftCalculations.cashTotal)}</span>
            </div>
            <div className="flex flex-col pr-3 lg:border-r border-slate-205">
              <span className="text-[9px] uppercase font-bold text-slate-400">Volume Nota (Lunas/DP)</span>
              <span className="font-extrabold text-xs font-mono text-slate-800">{activeShiftCalculations.totalTransactions} Slip</span>
            </div>
            <div className="col-span-2 lg:col-span-1 flex flex-col">
              <span className="text-[9px] uppercase font-bold text-emerald-700">Estimasi Laci Fisik</span>
              <span className="font-mono text-emerald-800 font-extrabold text-xs">{formatRupiah(activeShiftCalculations.expectedCash)}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-xs font-bold">Kassa Tutup: Belum ada shift operasional terdaftar</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Setiap kasir disarankan membuka shift kerja melalui tombol kassa sebelum memproses nota transaksi checkout / POS baru demi keamanan selisih pencatatan.</p>
          </div>
        </div>
      )}

      {/* SECTION 2 — DAILY CASHFLOW SUMMARY COCKPIT */}
      <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">SECTION 2 — DAILY CASHFLOW SUMMARY REPORT</h2>
            <p className="text-[11px] text-slate-500">Agregasi laba rugi real-time virtual terpasang dari database outlet.</p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400 font-medium">Filter Unit Cabang:</span>
            <select
              value={selectedOutletForReports}
              onChange={(e) => setSelectedOutletForReports(e.target.value)}
              className="bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 border border-slate-200 rounded-lg py-1 px-3 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">Semua Cabang (Grup)</option>
              {outlets.map(o => (
                <option key={o.outletId} value={o.outletId}>{o.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 6 GRIDS METRIC CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-3xs space-y-1">
            <span className="text-[9px] uppercase font-bold text-slate-400">Kas Terbit (Gross)</span>
            <TrendingUp className="w-4 h-4 text-blue-500 shrink-0 float-right" />
            <h4 className="text-xs font-extrabold text-slate-800 font-mono pt-1">{formatRupiah(cashflowSummary.grossRevenue)}</h4>
            <p className="text-[9px] text-slate-400 leading-none">Total kotor di nota</p>
          </div>

          <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-150 shadow-3xs space-y-1">
            <span className="text-[9px] uppercase font-bold text-emerald-800">Kas Masuk (Lunas/DP)</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 float-right" />
            <h4 className="text-xs font-black text-emerald-900 font-mono pt-1">{formatRupiah(cashflowSummary.paidRevenue)}</h4>
            <p className="text-[9px] text-emerald-600 leading-none">Uang rill yang diterima</p>
          </div>

          <div className="bg-rose-50/40 p-4 rounded-xl border border-rose-150 shadow-3xs space-y-1">
            <span className="text-[9px] uppercase font-bold text-rose-800">Sisa Piutang (Kredit)</span>
            <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 float-right" />
            <h4 className="text-xs font-black text-rose-900 font-mono pt-1">{formatRupiah(cashflowSummary.unpaidRevenue)}</h4>
            <p className="text-[9px] text-rose-600 leading-none">Belum dibayarkan</p>
          </div>

          <div className="bg-slate-100 p-4 rounded-xl border border-slate-200 shadow-3xs space-y-1">
            <span className="text-[9px] uppercase font-bold text-slate-500">Beban Biaya (Outlet)</span>
            <TrendingDown className="w-4 h-4 text-rose-700 shrink-0 float-right" />
            <h4 className="text-xs font-extrabold text-slate-700 font-mono pt-1">{formatRupiah(cashflowSummary.expenseTotal)}</h4>
            <p className="text-[9px] text-slate-500 leading-none">Biaya operasional rill</p>
          </div>

          <div className="bg-blue-50 p-4 rounded-xl border border-blue-150 shadow-3xs space-y-1 col-span-1 md:col-span-1">
            <span className="text-[9px] uppercase font-bold text-blue-700">Laba Bersih Estimasi</span>
            <DollarSign className="w-4 h-4 text-blue-600 shrink-0 float-right" />
            <h4 className="text-xs font-black text-blue-900 font-mono pt-1">{formatRupiah(cashflowSummary.estimatedNetIncome)}</h4>
            <p className="text-[9px] text-blue-700 leading-none">Penerimaan - Pengeluaran</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-3xs space-y-1">
            <span className="text-[9px] uppercase font-bold text-slate-400">Total Transaksi</span>
            <Layers className="w-4 h-4 text-indigo-500 shrink-0 float-right" />
            <h4 className="text-xs font-extrabold text-slate-800 font-mono pt-1">{cashflowSummary.transactionCount} Nota</h4>
            <p className="text-[9px] text-slate-400 leading-none">Pelayanan tercatat</p>
          </div>

        </div>
      </div>

      {/* CORE DUAL COLUMNS LAYOUT: EXPENSES vs SHIFT HISTORY */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* SECTION 1 — EXPENSE MANAGEMENT SYSTEM */}
        <div className="bg-white p-5 rounded-2xl border border-slate-205 flex flex-col h-[580px] overflow-hidden">
          <div className="flex items-center justify-between pb-3 border-b border-slate-150 shrink-0">
            <div className="space-y-0.5">
              <span className="text-[8.5px] font-black text-slate-450 uppercase tracking-widest block">SECTION 1</span>
              <h2 className="text-xs font-black text-slate-850 uppercase tracking-wide">PENGELUARAN OPERASIONAL OUTLET</h2>
            </div>
            <span className="text-[10px] font-bold font-mono px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
              {filteredExpenses.length} Tercatat
            </span>
          </div>

          {/* Filters shelf */}
          <div className="py-3 flex flex-col sm:flex-row gap-2 shrink-0 border-b border-slate-100">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 ml-0.5 w-3 h-3 text-slate-450" />
              <input
                type="text"
                placeholder="Cari pengeluaran..."
                value={expenseSearch}
                onChange={(e) => setExpenseSearch(e.target.value)}
                className="w-full text-xs pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-[11px]"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="text-xs bg-white border border-slate-200 rounded-lg py-1.5 px-3 focus:outline-none text-[11px]"
            >
              <option value="all">Semua Kategori</option>
              {EXPENSE_CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* List Scrolling */}
          <div className="flex-1 overflow-y-auto py-3 space-y-2.5 pr-1">
            {filteredExpenses.length === 0 ? (
              <div className="text-center py-20 text-slate-400 border border-dashed border-slate-150 rounded-xl bg-slate-50">
                <FileText className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                <span className="text-xs font-bold text-slate-650">Tidak ada pengeluaran logged</span>
                <p className="text-[10px] text-slate-400 mt-1">Gunakan tombol pojok kanan atas untuk menambah modal keluar.</p>
              </div>
            ) : (
              filteredExpenses.map(exp => {
                const categoryLabel = EXPENSE_CATEGORIES.find(c => c.value === exp.category)?.label || exp.category;
                return (
                  <div key={exp.expenseId} className="p-3 bg-slate-50 border border-slate-200 rounded-xl hover:border-slate-300 transition flex items-start justify-between gap-3 text-xs">
                    <div className="space-y-1 overflow-hidden">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[9px] bg-slate-200 text-slate-700 font-extrabold px-1.5 py-0.5 rounded font-mono uppercase">
                          {categoryLabel}
                        </span>
                        <span className="text-slate-400 text-[10px] font-mono">
                          {exp.expenseDate}
                        </span>
                      </div>
                      <h4 className="font-extrabold text-slate-800 text-xs truncate max-w-[210px]" title={exp.title}>{exp.title}</h4>
                      {exp.notes && <p className="text-[10.5px] text-slate-500 italic truncate max-w-[210px]">{exp.notes}</p>}
                      <p className="text-[9px] text-slate-400">Operator: <strong>{exp.createdByName || 'Kasir'}</strong></p>
                    </div>

                    <div className="text-right flex flex-col items-end gap-1.5 shrink-0">
                      <span className="font-mono font-extrabold text-xs text-rose-650">{formatRupiah(exp.amount)}</span>
                      {isOwnerOrAdmin && (
                        <button
                          onClick={() => handleDeleteExpense(exp.expenseId)}
                          className="p-1 hover:bg-rose-50 text-slate-450 hover:text-rose-600 rounded transition"
                          title="Hapus Pengeluaran"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="pt-3 border-t border-slate-150 text-[10px] text-slate-400 uppercase text-center font-bold tracking-wider shrink-0">
            * Kasir memiliki hak membuat, sedangkan hapus diampu Owner.
          </div>
        </div>

        {/* SECTION 3 — SHIFT HISTORIES & REPORT SUMMARY */}
        <div className="bg-white p-5 rounded-2xl border border-slate-205 flex flex-col h-[580px] overflow-hidden">
          <div className="flex items-center justify-between pb-3 border-b border-slate-150 shrink-0">
            <div className="space-y-0.5">
              <span className="text-[8.5px] font-black text-slate-450 uppercase tracking-widest block">SECTION 3 & 5</span>
              <h2 className="text-xs font-black text-slate-850 uppercase tracking-wide">RIWAYAT SHIFT & KASSA TUTUP</h2>
            </div>
            <span className="text-[10px] font-bold font-mono px-2 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-105">
              SOP Terlaporkan
            </span>
          </div>

          {/* List Scrolling shifts */}
          <div className="flex-1 overflow-y-auto py-3 space-y-3 pr-1">
            {shifts.length === 0 ? (
              <div className="text-center py-24 text-slate-400 border border-dashed border-slate-150 rounded-xl bg-slate-50">
                <Clock className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                <span className="text-xs font-bold text-slate-650">Tidak ada sejarah shift terdaftar</span>
                <p className="text-[10px] text-slate-400 mt-1">Buka kassa shift hari ini untuk menyeimbangkan laporan fisik.</p>
              </div>
            ) : (
              shifts.map(sh => {
                const isOpen = sh.status === 'open';
                const showDiff = sh.cashDifference !== undefined;
                return (
                  <div key={sh.shiftId} className="border border-slate-200 rounded-xl p-3.5 space-y-2.5 bg-slate-50/50 hover:bg-white hover:border-slate-350 transition text-xs">
                    {/* Shift Meta heading */}
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="text-[9px] text-slate-400 font-mono uppercase tracking-wider block">ID: {sh.shiftId.slice(-6).toUpperCase()}</span>
                        <span className="font-extrabold text-slate-800 text-[11px]">Kasir: {sh.cashierName}</span>
                      </div>
                      
                      <span className={`px-2 py-0.5 rounded text-[8.5px] font-extrabold tracking-wider ${
                        isOpen 
                          ? 'bg-emerald-55 text-emerald-800 border border-emerald-200' 
                          : 'bg-slate-200 text-slate-700 border border-slate-310'
                      }`}>
                        {isOpen ? '🟢 AKTIF / OPEN' : '🔴 CLOSED'}
                      </span>
                    </div>

                    {/* Timeline logs */}
                    <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-500 py-1 border-y border-dashed border-slate-155">
                      <div>
                        <span>Buka Kassa:</span>
                        <span className="block font-semibold text-slate-700">{new Date(sh.openedAt).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}</span>
                      </div>
                      <div>
                        <span>Tutup Kassa:</span>
                        <span className="block font-semibold text-slate-700">
                          {sh.closedAt ? new Date(sh.closedAt).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) : 'Masih aktif'}
                        </span>
                      </div>
                    </div>

                    {/* Cash balance report parameters */}
                    <div className="grid grid-cols-3 gap-1 px-1.5 py-2 bg-white rounded-lg border border-slate-150 text-center font-mono text-[10px]">
                      <div>
                        <span className="text-[8px] text-slate-400 block pb-0.5">MODAL AWAL</span>
                        <span className="font-bold text-slate-700">{formatRupiah(sh.openingCash)}</span>
                      </div>
                      <div className="border-x border-slate-200">
                        <span className="text-[8px] text-slate-400 block pb-0.5">ESTIMASI LACI</span>
                        <span className="font-extrabold text-slate-800">{formatRupiah(sh.expectedCash)}</span>
                      </div>
                      <div>
                        <span className="text-[8px] text-slate-400 block pb-0.5">FISIK SETOR</span>
                        <span className="font-bold text-slate-705">{sh.actualCash !== undefined ? formatRupiah(sh.actualCash) : '-'}</span>
                      </div>
                    </div>

                    {/* Difference alert if closed */}
                    {!isOpen && showDiff && (
                      <div className={`p-2 rounded-lg flex items-center justify-between text-[11px] ${
                        sh.cashDifference === 0 
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-150' 
                          : sh.cashDifference! < 0 
                          ? 'bg-rose-50 text-rose-800 border border-rose-150' 
                          : 'bg-amber-50 text-amber-800 border border-amber-150'
                      }`}>
                        <span className="font-semibold">Selisih Laci Kassa:</span>
                        <span className="font-extrabold font-mono text-xs">
                          {sh.cashDifference! === 0 
                            ? 'Pas / Sesuai' 
                            : (sh.cashDifference! > 0 ? '+' : '') + formatRupiah(sh.cashDifference!)}
                        </span>
                      </div>
                    )}

                    {sh.notes && (
                      <p className="text-[10px] text-slate-500 italic bg-white p-2 rounded border border-slate-150">
                        <strong>Catatan:</strong> {sh.notes}
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* ======================================================== */}
      {/* 8. PERFORMANCE & BACKWARD COMPATIBILITY MODALS POPUPS */}
      {/* ======================================================== */}

      {/* CREATE NEW EXPENSE DIALOG */}
      {showAddExpense && (
        <div className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full border border-slate-200 p-5 space-y-4 shadow-xl animate-scale-in text-xs">
            <div className="flex items-center justify-between border-b border-slate-150 pb-2.5">
              <h3 className="font-extrabold text-slate-850 uppercase tracking-wide">Pencatatan Biaya Pengeluaran</h3>
              <button onClick={() => setShowAddExpense(false)} className="p-1 text-slate-400 hover:bg-slate-100 rounded-md">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateExpense} className="space-y-3.5 text-xs text-slate-700">
              <div>
                <label className="block font-bold text-slate-500 mb-1">Judul / Deskripsi Pendek Pengeluaran*</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Beli Detergen Liquid Rinso 10L"
                  value={expenseTitle}
                  onChange={(e) => setExpenseTitle(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-200 p-2 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-500 mb-1">Kategori Biaya*</label>
                  <select
                    value={expenseCategory}
                    onChange={(e) => setExpenseCategory(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-200 p-2 focus:ring-1 focus:ring-blue-500 focus:outline-none bg-white"
                  >
                    {EXPENSE_CATEGORIES.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-500 mb-1">Tanggal Transaksi*</label>
                  <input
                    type="date"
                    required
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-200 p-1.5 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-500 mb-1">Nilai Nominal Pengeluaran (Rupiah)*</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-2.5 ml-0.5 font-bold text-slate-400">Rp</span>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="150000"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-200 pl-8 pr-2 py-2 focus:ring-1 focus:ring-blue-500 focus:outline-none font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-500 mb-1">Catatan Keterangan Tambahan (Opsional)</label>
                <textarea
                  placeholder="Detail instruksi/alamat perumahan/merk barang..."
                  value={expenseNotes}
                  onChange={(e) => setExpenseNotes(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-200 p-2 h-16 resize-none focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 border-t border-slate-100 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddExpense(false)}
                  className="flex-1 bg-slate-100 font-bold py-2 rounded-lg text-slate-600 hover:bg-slate-200 transition text-[11px]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-slate-900 border border-slate-800 text-white font-bold py-2 rounded-lg hover:bg-slate-800 transition text-[11px]"
                >
                  Catat Biaya
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* OPEN SHIFT MODAL POPUP */}
      {showOpenShift && (
        <div className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full border border-slate-200 p-5 space-y-4 shadow-xl animate-scale-in text-xs">
            <div className="flex items-center justify-between border-b border-slate-150 pb-2.5">
              <div className="flex items-center gap-1.5 text-blue-600">
                <Clock className="w-4 h-4" />
                <h3 className="font-extrabold text-slate-850 uppercase tracking-wide">Penerbitan Kassa Shift</h3>
              </div>
              <button onClick={() => setShowOpenShift(false)} className="p-1 text-slate-400 hover:bg-slate-100 rounded-md">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleOpenShiftSubmit} className="space-y-4 text-xs">
              <div className="p-3 bg-blue-50 text-blue-900 rounded-lg text-[11px]/relaxed space-y-1">
                <strong>Ketentuan Buka Kassa:</strong>
                <p>Silakan hitung fisik pecahan uang di dalam laci kas sebelum shift dimulai, lalu catat nominalnya sebagai modal penukaran kembalian pelanggan.</p>
              </div>

              <div>
                <label className="block font-bold text-slate-500 mb-1">Nominal Modal Tunai Laci (IDR)*</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-2.5 ml-0.5 font-bold text-slate-400">Rp</span>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="Contoh: 200000"
                    value={openingCashInput}
                    onChange={(e) => setOpeningCashInput(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-200 pl-8 pr-2 py-2 focus:ring-1 focus:ring-blue-500 focus:outline-none font-mono font-bold"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowOpenShift(false)}
                  className="flex-1 bg-slate-100 font-bold py-2 rounded-lg text-slate-650 hover:bg-slate-200 transition text-[11px]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white font-bold py-2 rounded-lg hover:bg-blue-700 transition text-[11px]"
                >
                  Aktifkan Shift Kerja
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CLOSE SHIFT MODAL POPUP */}
      {showCloseShift && (
        <div className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full border border-slate-200 p-5 space-y-4 shadow-xl animate-scale-in text-xs">
            <div className="flex items-center justify-between border-b border-slate-150 pb-2.5">
              <div className="flex items-center gap-1.5 text-amber-600">
                <CheckCircle2 className="w-4 h-4" />
                <h3 className="font-extrabold text-slate-850 uppercase tracking-wide">Tutup Kassa Shift</h3>
              </div>
              <button onClick={() => setShowCloseShift(false)} className="p-1 text-slate-400 hover:bg-slate-100 rounded-md">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCloseShiftSubmit} className="space-y-3.5 text-xs">
              
              <div className="bg-slate-50 border border-slate-150 rounded-lg p-3 space-y-1.5 font-mono text-[11px]">
                <div className="flex justify-between text-slate-500">
                  <span>Modal Kas Awal:</span>
                  <span className="font-semibold text-slate-800">{formatRupiah(activeShift?.openingCash || 0)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Pembayaran Tunai (+):</span>
                  <span className="font-semibold text-slate-800">{formatRupiah(activeShiftCalculations.cashTotal)}</span>
                </div>
                <div className="flex justify-between font-bold border-t border-dashed border-slate-200 pt-1.5 text-slate-700 text-xs">
                  <span>Estimasi Laci:</span>
                  <span className="text-emerald-700">{formatRupiah(activeShiftCalculations.expectedCash)}</span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-500 mb-1">Uang Fisik di Laci Sekarang (IDR)*</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-2.5 ml-0.5 font-bold text-slate-400">Rp</span>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="Contoh: 350000"
                    value={actualCashInput}
                    onChange={(e) => setActualCashInput(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-200 pl-8 pr-2 py-2 focus:ring-1 focus:ring-blue-500 focus:outline-none font-mono font-bold text-amber-900 bg-amber-50/10"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-500 mb-1">Catatan Evaluasi / Bukti Selisih (Opsional)</label>
                <textarea
                  placeholder="Keterangan sisa kembalian, pecahan hilang, atau kendala setoran..."
                  value={closeShiftNotes}
                  onChange={(e) => setCloseShiftNotes(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-200 p-2 h-14 resize-none focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 border-t border-slate-100 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCloseShift(false)}
                  className="flex-1 bg-slate-100 font-bold py-2 rounded-lg text-slate-650 hover:bg-slate-200 transition text-[11px]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-amber-500 text-white font-bold py-2 rounded-lg hover:bg-amber-600 transition text-[11px]"
                >
                  Tutup & Serah Terima
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default FinancialsPage;

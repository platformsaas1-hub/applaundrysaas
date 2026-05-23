import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  writeBatch 
} from 'firebase/firestore';
import { POSView } from '../components/POSView';
import { NotaDigital } from '../components/NotaDigital';
import { Customer, Transaction, LaundryService } from '../types';
import { calculatePaymentDetails } from '../utils/invoice';
import { triggerAutoReceipt } from '../services/automation/automationEngine';
import { getServicesByOutlet } from '../services/services';
import { ShieldAlert } from 'lucide-react';
import { canAccessOutlet } from '../utils/rbac';

export function POSPage() {
  const navigate = useNavigate();
  const { userProfile, currentUser } = useAuth();
  const { services, outlets, activeOutletId } = useTenant();
  const [activeOutletServices, setActiveOutletServices] = useState<LaundryService[]>([]);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [selectedInvoiceTx, setSelectedInvoiceTx] = useState<Transaction | null>(null);
  const [activeShift, setActiveShift] = useState<any | null>(null);
  const [loadingShiftCheck, setLoadingShiftCheck] = useState(true);

  const tenantId = userProfile?.tenantId || null;

  // Sync active cashier shift state in real term
  useEffect(() => {
    if (!tenantId || !activeOutletId || !currentUser?.uid) {
      setLoadingShiftCheck(false);
      return;
    }

    const shiftsRef = collection(db, 'tenants', tenantId, 'shiftClosings');
    const q = query(
      shiftsRef,
      where('status', '==', 'open'),
      where('cashierId', '==', currentUser.uid),
      where('outletId', '==', activeOutletId),
      limit(1)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        let found: any = null;
        snapshot.forEach(docSnap => {
          found = docSnap.data();
        });
        setActiveShift(found);
      } else {
        setActiveShift(null);
      }
      setLoadingShiftCheck(false);
    }, (error) => {
      console.error("Error reading shift status in POSPage:", error);
      setLoadingShiftCheck(false);
    });

    return unsubscribe;
  }, [tenantId, activeOutletId, currentUser?.uid]);

  const [loadingServices, setLoadingServices] = useState<boolean>(false);

  // Load services based on active outlet using the required SERVICES FOUNDATION engine
  useEffect(() => {
    if (!tenantId) {
      setActiveOutletServices([]);
      return;
    }

    const currentOutletId = activeOutletId || outlets.find(o => o.isMainOutlet)?.outletId || outlets[0]?.outletId;
    if (!currentOutletId) {
      setActiveOutletServices([]);
      return;
    }

    setLoadingServices(true);
    getServicesByOutlet(tenantId, currentOutletId, true)
      .then((data) => {
        setActiveOutletServices(data || []);
      })
      .catch((err) => {
        console.error("Failed to load services for outlet:", err);
        setActiveOutletServices([]);
      })
      .finally(() => {
        setLoadingServices(false);
      });
  }, [tenantId, activeOutletId, outlets]);

  const currentRole = userProfile?.role || 'kasir';

  // 1. Sync Customers CRM in real-time
  useEffect(() => {
    if (!tenantId) return;

    const customersRef = collection(db, 'tenants', tenantId, 'customers');
    const q = query(customersRef, where('isDeleted', '==', false));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Customer[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as Customer);
      });
      // Sort in-memory to keep active CRM records on top
      list.sort((a, b) => b.name.localeCompare(a.name));
      setCustomers(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `tenants/${tenantId}/customers`);
    });

    return unsubscribe;
  }, [tenantId]);

  // 2. Sync Recent Transactions to calculate invoice sequence and queue numbers
  useEffect(() => {
    if (!tenantId) return;

    const transactionsRef = collection(db, 'tenants', tenantId, 'transactions');
    // Using simple field index (createdAt desc) to prevent raw compound index delays
    const q = query(
      transactionsRef, 
      where('isDeleted', '==', false), 
      orderBy('createdAt', 'desc'), 
      limit(100)
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

  // Helper: Sequence Computation Logic (Collision-proof and responsive)
  const getNextInvoiceAndQueue = () => {
    const now = new Date();
    // Compact format: DDMMYY
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = String(now.getFullYear()).slice(-2);
    const dateStr = `${day}${month}${year}`;

    const todayPrefix = `LDRY-${dateStr}-`;
    const todayTxs = recentTransactions.filter(tx => tx.invoiceNumber && tx.invoiceNumber.startsWith(todayPrefix));

    let nextSeq = 1;
    if (todayTxs.length > 0) {
      const seqs = todayTxs.map(tx => {
        const parts = tx.invoiceNumber?.split('-');
        if (parts && parts.length === 3) {
          return parseInt(parts[2]) || 0;
        }
        return 0;
      });
      nextSeq = Math.max(...seqs, 0) + 1;
    }
    const invoiceNumber = `LDRY-${dateStr}-${String(nextSeq).padStart(4, '0')}`;

    // Compute queue sequencer matching today's orders
    let nextQueueSeq = 1;
    if (todayTxs.length > 0) {
      const qNums = todayTxs
        .filter(t => t.queueNumber && t.queueNumber.startsWith('A'))
        .map(t => {
          const numPart = t.queueNumber?.slice(1);
          return numPart ? parseInt(numPart) : 0;
        });
      nextQueueSeq = Math.max(...qNums, 0) + 1;
    }
    const queueNumber = `A${String(nextQueueSeq).padStart(3, '0')}`;

    return { invoiceNumber, queueNumber };
  };

  // 3. Dynamic Patient CRM profile registration (synchronous ID yield)
  const handleAddCustomerSync = (newCust: Omit<Customer, 'customerId' | 'createdAt'>): string => {
    if (!tenantId) throw new Error("Multi-tenant breach: Missing tenant context.");

    const generatedId = `cust_${Date.now().toString().slice(-6)}_${Math.random().toString(36).substring(2, 6)}`;
    const custDocRef = doc(db, 'tenants', tenantId, 'customers', generatedId);

    const payload: Customer = {
      ...newCust,
      customerId: generatedId,
      tenantId,
      totalOrders: 0,
      totalSpent: 0,
      isDeleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setDoc(custDocRef, payload).catch((error) => {
      handleFirestoreError(error, OperationType.WRITE, `tenants/${tenantId}/customers/${generatedId}`);
    });

    return generatedId;
  };

  // 4. POS Checkout Core Transaction Handler
  const handleCheckoutTransaction = async (txDraft: Omit<Transaction, 'transactionId' | 'receivedAt'>) => {
    if (!tenantId) return;

    // Sequence computation
    const { invoiceNumber, queueNumber } = getNextInvoiceAndQueue();
    const trxId = `trx_${Date.now().toString().slice(-6)}_${Math.random().toString(36).substring(2, 6)}`;

    // Total calculations
    const orderSubtotal = txDraft.items.reduce((acc, curr) => acc + (curr.totalPrice || (curr.qty * curr.pricePerUnit)), 0);
    const orderDiscount = txDraft.discountAmount || 0;
    const orderTax = 0; // Default flat tax is zero
    const orderGrandTotal = Math.max(0, orderSubtotal - orderDiscount);

    // Auto payment status calculation aligned with business rules
    const calculated = calculatePaymentDetails({
      subtotal: orderSubtotal,
      discountPercent: orderSubtotal > 0 ? (orderDiscount / orderSubtotal) * 100 : 0,
      taxPercent: 0,
      paidAmount: txDraft.paidAmount !== undefined ? txDraft.paidAmount : (txDraft.paymentStatus === 'paid' ? orderGrandTotal : 0)
    });

    // Merge computed values into full production payload
    const transactionPayload: Transaction = {
      ...txDraft,
      transactionId: trxId,
      invoiceNumber,
      queueNumber,
      subtotal: orderSubtotal,
      discount: orderDiscount,
      discountAmount: orderDiscount,
      tax: orderTax,
      totalAmount: orderGrandTotal, // compatibility
      grandTotal: orderGrandTotal,
      paidAmount: calculated.paidAmount,
      remainingAmount: calculated.remainingAmount,
      changeAmount: calculated.changeAmount,
      paymentStatus: calculated.paymentStatus,
      paymentHistory: txDraft.paymentHistory || (calculated.paidAmount > 0 ? [
        {
          paymentId: `pay_${Date.now()}`,
          amount: calculated.paidAmount,
          method: txDraft.paymentMethod || 'cash',
          receivedAt: new Date().toISOString(),
          recordedBy: userProfile?.name || 'Kasir Aktif'
        }
      ] : []),
      cashierId: currentUser?.uid || 'cashier_unknown',
      cashierName: userProfile?.name || 'Kasir Aktif',
      orderStatus: 'received', // Always reset to 'received' as first state of operational queue
      estimatedDoneAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), // 2 Days default SLA
      receivedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDeleted: false
    };

    const batch = writeBatch(db);

    // Write-1: Main transactions listing
    const txRef = doc(db, 'tenants', tenantId, 'transactions', trxId);
    batch.set(txRef, transactionPayload);

    // Write-2: Dual write subcollection transaction item files
    txDraft.items.forEach((item, index) => {
      const itemId = `item_${index}_${Date.now().toString().slice(-4)}`;
      const itemRef = doc(db, 'tenants', tenantId, 'transactions', trxId, 'items', itemId);
      
      batch.set(itemRef, {
        itemId,
        serviceId: item.serviceId,
        name: item.name,
        qty: item.qty,
        pricePerUnit: item.pricePerUnit,
        totalPrice: item.totalPrice,
        subtotal: item.totalPrice,
        itemStatus: 'queued',
        createdAt: new Date().toISOString()
      });
    });

    // Write-3: Increment Patron spent metrics in CRM
    const customerObj = customers.find(c => c.customerId === txDraft.customerId);
    const currentOrders = customerObj?.totalOrders || 0;
    const currentSpent = customerObj?.totalSpent || 0;

    const customerRef = doc(db, 'tenants', tenantId, 'customers', txDraft.customerId);
    batch.set(customerRef, {
      totalOrders: currentOrders + 1,
      totalSpent: currentSpent + orderGrandTotal,
      lastOrderAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }, { merge: true });

    try {
      await batch.commit();
      
      // Auto receipt scheduler trigger
      if (tenantId && activeOutletId) {
        const servicesSummary = txDraft.items.map(it => `${it.name} (x${it.qty})`).join(', ') || 'Layanan Laundry';
        triggerAutoReceipt({
          tenantId,
          outletId: activeOutletId,
          outletName: activeOutletObj?.name || 'LaundryKu',
          transaction: transactionPayload,
          servicesSummary,
          operatorUid: currentUser?.uid || 'anonymous',
          operatorName: userProfile?.name || 'Kasir'
        }).catch(err => console.error('[POS Checkout Automation] Trigger error:', err));
      }

      // Instantly open the invoice receipt dialog
      setSelectedInvoiceTx(transactionPayload);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `tenants/${tenantId}/transactions/${trxId}`);
    }
  };

  const activeOutletObj = outlets.find(o => o.outletId === activeOutletId);

  if (activeOutletId && !canAccessOutlet(userProfile, activeOutletId)) {
    return (
      <div className="h-[calc(100vh-140px)] flex flex-col justify-center items-center text-slate-500 p-8 text-center bg-slate-50 rounded-2xl mx-6 my-4 border border-slate-200">
        <ShieldAlert className="w-16 h-16 text-rose-500 mb-4 animate-bounce" />
        <h2 className="text-lg font-extrabold text-slate-800">Akses Cabang Terbatas</h2>
        <p className="text-sm text-slate-500 mt-2 max-w-md">
          Akun Anda ({userProfile?.role}) tidak diberikan wewenang untuk melihat atau memproses transaksi di cabang <strong>{activeOutletObj?.name || activeOutletId}</strong>.
        </p>
        <p className="text-xs text-slate-400 mt-1 max-w-sm">
          Silakan hubungi pemilik usaha (owner) atau admin untuk mendaftarkan akun Anda di cabang ini.
        </p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col overflow-hidden">
      {!loadingShiftCheck && !activeShift && (
        <div className="bg-amber-500 text-white font-sans text-[11px] font-bold px-4 py-2 shrink-0 flex items-center justify-between gap-4 animate-flicker">
          <span className="flex items-center gap-1.5 leading-none">
            ⚠️ PERINGATAN KASSA: Anda belum mengaktifkan Shift Kerja Kasir hari ini. Transaksi laci lunas tidak akan memiliki modal penyeimbang kasir secara otomatis.
          </span>
          <button 
            onClick={() => navigate('/financials')}
            className="bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-[9px] uppercase tracking-wide px-2.5 py-1 rounded-md shrink-0 border border-slate-700 hover:scale-105 transition duration-150"
          >
            Aktifkan Shift Kerja
          </button>
        </div>
      )}
      <POSView
        services={activeOutletServices}
        customers={customers}
        outlets={outlets}
        currentRole={currentRole}
        activeOutletId={activeOutletId || ''}
        onAddCustomer={handleAddCustomerSync}
        onAddTransaction={handleCheckoutTransaction}
        loadingServices={loadingServices}
        trackAction={(reads, writes) => {
          console.log(`Action metric tracked (reads: ${reads}, writes: ${writes})`);
        }}
      />

      {selectedInvoiceTx && activeOutletObj && (
        <NotaDigital
          transaction={selectedInvoiceTx}
          outlet={activeOutletObj}
          onClose={() => setSelectedInvoiceTx(null)}
          trackAction={(reads, writes) => {
            console.log(`Action metric tracked (reads: ${reads}, writes: ${writes})`);
          }}
        />
      )}
    </div>
  );
}

export default POSPage;

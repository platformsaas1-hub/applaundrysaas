import React, { useState, useEffect } from 'react';
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
  updateDoc 
} from 'firebase/firestore';
import { AntreanView } from '../components/AntreanView';
import { NotaDigital } from '../components/NotaDigital';
import { Transaction } from '../types';
import { triggerAutoReady, triggerAutoPartialPaymentReminder } from '../services/automation/automationEngine';
import { ShieldAlert } from 'lucide-react';
import { canAccessOutlet } from '../utils/rbac';

export function QueuesPage() {
  const { userProfile } = useAuth();
  const { services, outlets, activeOutletId } = useTenant();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedInvoiceTx, setSelectedInvoiceTx] = useState<Transaction | null>(null);

  const tenantId = userProfile?.tenantId || null;
  const currentRole = userProfile?.role || 'pegawai';

  // 1. Subscribe to Tenant's Transactions Collection in Real-Time
  useEffect(() => {
    if (!tenantId) return;

    const txColRef = collection(db, 'tenants', tenantId, 'transactions');
    // Bounded query limiting read footprints defensively
    const q = query(
      txColRef,
      where('isDeleted', '==', false),
      orderBy('createdAt', 'desc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Transaction[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as Transaction);
      });
      // Filter strictly by activeOutletId if set, and check access permissions via canAccessOutlet
      const filteredList = list.filter((tx) => {
        if (activeOutletId && tx.outletId !== activeOutletId) {
          return false;
        }
        return canAccessOutlet(userProfile, tx.outletId);
      });
      
      setTransactions(filteredList);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `tenants/${tenantId}/transactions`);
    });

    return unsubscribe;
  }, [tenantId, activeOutletId]);

  // 2. Drive order lifecycle progress
  const handleUpdateStatus = async (id: string, status: Transaction['orderStatus']) => {
    if (!tenantId) return;

    const txRef = doc(db, 'tenants', tenantId, 'transactions', id);
    const updatePayload: Partial<Transaction> = {
      orderStatus: status,
      updatedAt: new Date().toISOString()
    };

    // Keep statistics correct by flagging proper lifecycle timestamps
    if (status === 'ready') {
      updatePayload.completedAt = new Date().toISOString();
    } else if (status === 'delivered') {
      updatePayload.pickedUpAt = new Date().toISOString();
    }

    const matchedTx = transactions.find(t => t.transactionId === id);

    try {
      await updateDoc(txRef, updatePayload);
      console.log(`Updated transaction ${id} status successfully to: ${status}`);

      if (status === 'ready' && matchedTx) {
        const outletObj = outlets.find(o => o.outletId === matchedTx.outletId || o.outletId === activeOutletId);
        triggerAutoReady({
          tenantId,
          outletId: matchedTx.outletId || activeOutletId || 'outlet_default',
          outletName: outletObj?.name || 'LaundryKu',
          transaction: { ...matchedTx, ...updatePayload },
          operatorUid: userProfile?.userId || 'system',
          operatorName: userProfile?.name || 'Kasir'
        }).catch(err => console.error('[Queue Status Automation] Ready trigger error:', err));
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tenants/${tenantId}/transactions/${id}`);
    }
  };

  // 3. Drive payment settlements upon spot cashier handover
  const handleUpdatePayment = async (id: string, payStatus: Transaction['paymentStatus'], payMethod: Transaction['paymentMethod']) => {
    if (!tenantId) return;

    const txRef = doc(db, 'tenants', tenantId, 'transactions', id);
    const matchedTx = transactions.find(t => t.transactionId === id);
    const totalToPay = matchedTx?.grandTotal || matchedTx?.totalAmount || 0;

    const updatePayload: Partial<Transaction> = {
      paymentStatus: payStatus,
      paymentMethod: payMethod,
      paidAmount: payStatus === 'paid' ? totalToPay : 0,
      remainingAmount: payStatus === 'paid' ? 0 : totalToPay,
      changeAmount: 0,
      updatedAt: new Date().toISOString()
    };

    try {
      await updateDoc(txRef, updatePayload);
      console.log(`Updated transaction ${id} payment ledger successfully.`);

      if (payStatus === 'partial' && matchedTx) {
        const outletObj = outlets.find(o => o.outletId === matchedTx.outletId || o.outletId === activeOutletId);
        triggerAutoPartialPaymentReminder({
          tenantId,
          outletId: matchedTx.outletId || activeOutletId || 'outlet_default',
          outletName: outletObj?.name || 'LaundryKu',
          transaction: { ...matchedTx, ...updatePayload },
          operatorUid: userProfile?.userId || 'system',
          operatorName: userProfile?.name || 'Kasir'
        }).catch(err => console.error('[Queue Payment Automation] Partial trigger error:', err));
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tenants/${tenantId}/transactions/${id}`);
    }
  };

  // 4. Safe Soft-Delete receipt history maintaining ledger records integrity
  const handleDeleteTransaction = async (id: string) => {
    if (!tenantId) return;

    const txRef = doc(db, 'tenants', tenantId, 'transactions', id);
    try {
      await updateDoc(txRef, {
        isDeleted: true,
        updatedAt: new Date().toISOString()
      });
      console.log(`Soft delete executed for transaction document: ${id}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `tenants/${tenantId}/transactions/${id}`);
    }
  };

  // Retrieve active branch object for receipt headers
  const activeOutletObj = outlets.find(o => o.outletId === activeOutletId);

  if (activeOutletId && !canAccessOutlet(userProfile, activeOutletId)) {
    return (
      <div className="h-[calc(100vh-140px)] flex flex-col justify-center items-center text-slate-500 p-8 text-center bg-slate-50 rounded-2xl mx-6 my-4 border border-slate-200">
        <ShieldAlert className="w-16 h-16 text-rose-500 mb-4 animate-bounce" />
        <h2 className="text-lg font-extrabold text-slate-800">Akses Cabang Terbatas</h2>
        <p className="text-sm text-slate-500 mt-2 max-w-md">
          Akun Anda ({userProfile?.role}) tidak diberikan wewenang untuk memproses atau melihat antrean di cabang <strong>{activeOutletObj?.name || activeOutletId}</strong>.
        </p>
        <p className="text-xs text-slate-400 mt-1 max-w-sm">
          Silakan hubungi pemilik usaha (owner) atau admin untuk mendaftarkan akun Anda di cabang ini.
        </p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col overflow-hidden">
      <AntreanView
        transactions={transactions}
        services={services}
        currentRole={currentRole}
        onUpdateStatus={handleUpdateStatus}
        onUpdatePayment={handleUpdatePayment}
        onDeleteTransaction={handleDeleteTransaction}
        onSelectTransactionForInvoice={setSelectedInvoiceTx}
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

export default QueuesPage;

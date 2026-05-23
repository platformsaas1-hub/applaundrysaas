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
      // Optional: Filter by active outlet if user is on specific branch
      const filteredList = activeOutletId 
        ? list.filter(tx => tx.outletId === activeOutletId)
        : list;
      
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

    try {
      await updateDoc(txRef, updatePayload);
      console.log(`Updated transaction ${id} status successfully to: ${status}`);
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

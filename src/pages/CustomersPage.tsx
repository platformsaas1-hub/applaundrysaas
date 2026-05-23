import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase/config';
import { handleFirestoreError, OperationType } from '../firebase/errorModel';
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  doc, 
  setDoc 
} from 'firebase/firestore';
import { PelangganView } from '../components/PelangganView';
import { Customer, Transaction } from '../types';

export function CustomersPage() {
  const { userProfile } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const tenantId = userProfile?.tenantId || null;
  const currentRole = userProfile?.role || 'kasir';

  // Real-time synchronization of customers directory
  useEffect(() => {
    if (!tenantId) return;

    const customersRef = collection(db, 'tenants', tenantId, 'customers');
    const q = query(customersRef, where('isDeleted', '==', false));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Customer[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as Customer);
      });
      // Sort in-memory to keep patronage directory tidy
      list.sort((a, b) => b.name.localeCompare(a.name));
      setCustomers(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `tenants/${tenantId}/customers`);
    });

    return unsubscribe;
  }, [tenantId]);

  // Real-time synchronization of transactions to compute loyalty logs
  useEffect(() => {
    if (!tenantId) return;

    const txRef = collection(db, 'tenants', tenantId, 'transactions');
    const q = query(txRef, where('isDeleted', '==', false));

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
  }, [tenantId]);

  // Synchronous Customer Registration trigger
  const handleAddCustomerSync = (newCust: Omit<Customer, 'customerId' | 'createdAt'>): string => {
    if (!tenantId) throw new Error("Multi-tenant breach: tenant context is required.");

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

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col overflow-hidden">
      <PelangganView
        customers={customers}
        transactions={transactions}
        currentRole={currentRole}
        onAddCustomer={handleAddCustomerSync}
        trackAction={(reads, writes) => {
          console.log(`CRM Action metric tracked (reads: ${reads}, writes: ${writes})`);
        }}
      />
    </div>
  );
}

export default CustomersPage;

import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  collection, 
  doc, 
  onSnapshot, 
  query, 
  where 
} from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { Tenant, Outlet, LaundryService } from '../types';
import { db } from '../firebase/config';
import { handleFirestoreError, OperationType } from '../firebase/errorModel';

interface TenantContextType {
  tenant: Tenant | null;
  outlets: Outlet[];
  services: LaundryService[];
  activeOutlet: Outlet | null;
  activeOutletId: string | null;
  switchActiveOutlet: (outletId: string) => Promise<void>;
  loadingTenant: boolean;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const { userProfile, setProfileActiveOutlet } = useAuth();
  
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [services, setServices] = useState<LaundryService[]>([]);
  const [loadingTenant, setLoadingTenant] = useState<boolean>(false);

  const tenantId = userProfile?.tenantId || null;
  const activeOutletId = userProfile?.activeOutletId || null;

  // Real-time synchronization of Tenant, Outlets, and Services
  useEffect(() => {
    if (!tenantId) {
      setTenant(null);
      setOutlets([]);
      setServices([]);
      setLoadingTenant(false);
      return;
    }

    setLoadingTenant(true);

    // 1. Subscribe to Tenant Document
    const tenantDocRef = doc(db, 'tenants', tenantId);
    const unsubscribeTenant = onSnapshot(tenantDocRef, (snapshot) => {
      if (snapshot.exists()) {
        setTenant(snapshot.data() as Tenant);
      } else {
        setTenant(null);
      }
      setLoadingTenant(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `tenants/${tenantId}`);
    });

    // 2. Subscribe to Outlets Collection
    const outletsColRef = collection(db, 'tenants', tenantId, 'outlets');
    const unsubscribeOutlets = onSnapshot(outletsColRef, (snapshot) => {
      const outletList: Outlet[] = [];
      snapshot.forEach((docSnap) => {
        outletList.push(docSnap.data() as Outlet);
      });
      setOutlets(outletList);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `tenants/${tenantId}/outlets`);
    });

    // 3. Subscribe to Catalog Services Collection to optimize read budgets globally
    const servicesColRef = collection(db, 'tenants', tenantId, 'services');
    const unsubscribeServices = onSnapshot(servicesColRef, (snapshot) => {
      const serviceList: LaundryService[] = [];
      snapshot.forEach((docSnap) => {
        serviceList.push(docSnap.data() as LaundryService);
      });
      setServices(serviceList);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `tenants/${tenantId}/services`);
    });

    return () => {
      unsubscribeTenant();
      unsubscribeOutlets();
      unsubscribeServices();
    };
  }, [tenantId]);

  // Retrieve active outlet object
  const activeOutlet = outlets.find(o => o.outletId === activeOutletId) || null;

  // Switches between branches (multi-outlet feature)
  const switchActiveOutlet = async (outletId: string) => {
    if (!tenantId) return;
    
    const targetOutlet = outlets.find(o => o.outletId === outletId);
    if (!targetOutlet) {
      throw new Error("Specified outlet ID does not exist in the tenant's workspace.");
    }

    // Persist switch inside user profile database
    await setProfileActiveOutlet(outletId);
  };

  return (
    <TenantContext.Provider value={{
      tenant,
      outlets,
      services,
      activeOutlet,
      activeOutletId,
      switchActiveOutlet,
      loadingTenant
    }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}

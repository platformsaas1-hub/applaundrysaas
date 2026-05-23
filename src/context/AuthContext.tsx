import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signOut, 
  signInWithPopup,
  UserCredential
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  writeBatch, 
  collection 
} from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase/config';
import { UserProfile, Tenant, Outlet, LaundryService } from '../types';
import { handleFirestoreError, OperationType } from '../firebase/errorModel';

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  loginWithGoogle: () => Promise<UserCredential>;
  logout: () => Promise<void>;
  registerNewTenantAndOwner: (businessName: string, activeOutletName: string) => Promise<void>;
  setProfileActiveOutlet: (outletId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Monitor auth status change
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      
      if (user) {
        // If logged in, fetch user's business profile from /users/{userId}
        const userDocRef = doc(db, 'users', user.uid);
        try {
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            setUserProfile(userDoc.data() as UserProfile);
          } else {
            // User does not have a tenant linked yet (first login)
            setUserProfile(null);
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
          setUserProfile(null);
        }
      } else {
        // Logged out
        setUserProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Google Login popup
  const loginWithGoogle = async () => {
    try {
      setLoading(true);
      const credential = await signInWithPopup(auth, googleProvider);
      return credential;
    } catch (error) {
      console.error("Google sign-in popup error:", error);
      setLoading(false);
      throw error;
    }
  };

  // Sign out
  const logout = async () => {
    try {
      setLoading(true);
      await signOut(auth);
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Enterprise Multi-Tenant Registration Builder
   * Seeds:
   * 1. A Tenant under /tenants/{tenantId}
   * 2. An initial physical outlet under /tenants/{tenantId}/outlets/{outletId}
   * 3. A set of default services under /tenants/{tenantId}/services/
   * 4. A User profile under /users/{userId} with owner role linked to tenantId
   */
  const registerNewTenantAndOwner = async (businessName: string, activeOutletName: string) => {
    if (!currentUser) throw new Error("Authentication required to register organization.");

    const userId = currentUser.uid;
    const tenantId = `tenant_${userId.slice(0, 10)}_${Date.now().toString().slice(-4)}`;
    const outletId = `outlet_${Date.now().toString().slice(-6)}`;
    
    const batch = writeBatch(db);

    // 1. Tenant Definition
    const tenantData: Tenant = {
      tenantId,
      businessName,
      ownerId: userId,
      status: 'active',
      plan: 'free',
      createdAt: new Date().toISOString()
    };
    const tenantRef = doc(db, 'tenants', tenantId);
    batch.set(tenantRef, tenantData);

    // 2. Default Outlet Definition
    const outletData: Outlet = {
      outletId,
      name: activeOutletName,
      address: "Jl. Centered No. 1, Laundry Center",
      phone: currentUser.phoneNumber || "081234567890",
      createdAt: new Date().toISOString()
    };
    const outletRef = doc(db, 'tenants', tenantId, 'outlets', outletId);
    batch.set(outletRef, outletData);

    // 3. Default Catalog Services
    const defaultServices: Omit<LaundryService, 'createdAt'>[] = [
      {
        serviceId: 'svc_cuci_kering',
        name: 'Cuci Kering Saja',
        type: 'kiloan',
        unit: 'kg',
        pricePerUnit: 6000,
        estimatedDays: 1,
        isActive: true
      },
      {
        serviceId: 'svc_cuci_setrika',
        name: 'Cuci Setrika Reguler',
        type: 'kiloan',
        unit: 'kg',
        pricePerUnit: 8000,
        estimatedDays: 2,
        isActive: true
      },
      {
        serviceId: 'svc_setrika',
        name: 'Setrika Premium',
        type: 'kiloan',
        unit: 'kg',
        pricePerUnit: 5000,
        estimatedDays: 1,
        isActive: true
      },
      {
        serviceId: 'svc_sepatu_canvas',
        name: 'Cuci Sepatu Canvas',
        type: 'sepatu',
        unit: 'pair',
        pricePerUnit: 35000,
        estimatedDays: 3,
        isActive: true
      }
    ];

    defaultServices.forEach(svc => {
      const svcRef = doc(db, 'tenants', tenantId, 'services', svc.serviceId);
      batch.set(svcRef, {
        ...svc,
        createdAt: new Date().toISOString()
      });
    });

    // 4. Global User Profile Definition
    const profileData: UserProfile = {
      userId,
      name: currentUser.displayName || "Pemilik LaundryKu",
      email: currentUser.email || "",
      role: 'owner',
      tenantId,
      activeOutletId: outletId,
      createdAt: new Date().toISOString()
    };
    const userProfileRef = doc(db, 'users', userId);
    batch.set(userProfileRef, profileData);

    try {
      setLoading(true);
      await batch.commit();
      setUserProfile(profileData);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${userId}`);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Switches or updates active working physical outlet referenced inside profile.
   */
  const setProfileActiveOutlet = async (outletId: string) => {
    if (!currentUser || !userProfile) throw new Error("User must be logged in.");

    const updatedProfile = {
      ...userProfile,
      activeOutletId: outletId
    };

    const profileRef = doc(db, 'users', currentUser.uid);
    try {
      await setDoc(profileRef, updatedProfile, { merge: true });
      setUserProfile(updatedProfile);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${currentUser.uid}`);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      currentUser, 
      userProfile, 
      loading, 
      loginWithGoogle, 
      logout,
      registerNewTenantAndOwner,
      setProfileActiveOutlet
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

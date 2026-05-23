import { db } from '../firebase/config';
import { handleFirestoreError, OperationType } from '../firebase/errorModel';
import { 
  collection, 
  doc, 
  getDocs, 
  query, 
  where, 
  writeBatch, 
  setDoc, 
  updateDoc, 
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { Outlet } from '../types';

/**
 * Retrieves all non-deleted outlets for a given tenant.
 * Filters out documents where `isDeleted` is true.
 *
 * @param tenantId - The unique identifier of the tenant.
 * @returns A promise resolving to an array of Outlet objects.
 */
export async function getOutlets(tenantId: string): Promise<Outlet[]> {
  if (!tenantId) {
    return [];
  }

  const collRef = collection(db, 'tenants', tenantId, 'outlets');
  const q = query(collRef, where('isDeleted', '==', false));

  try {
    const snap = await getDocs(q);
    const outletsList: Outlet[] = [];
    snap.forEach((d) => {
      const data = d.data();
      const code = data.code || '';
      outletsList.push({
        ...data,
        outletId: d.id,
        code,
        codeLower: data.codeLower || code.toLowerCase(),
        isMainOutlet: !!data.isMainOutlet,
        active: data.active !== undefined ? data.active : (data.isActive !== undefined ? data.isActive : true),
        isDeleted: !!data.isDeleted
      } as Outlet);
    });
    return outletsList;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `tenants/${tenantId}/outlets`);
  }
}

/**
 * Retrieves all active, non-deleted outlets for a given tenant.
 * Filters for `active == true` and `isDeleted == false`.
 *
 * @param tenantId - The unique identifier of the tenant.
 * @returns A promise resolving to an array of active Outlet objects.
 */
export async function getActiveOutlets(tenantId: string): Promise<Outlet[]> {
  if (!tenantId) {
    return [];
  }

  const collRef = collection(db, 'tenants', tenantId, 'outlets');
  const q = query(
    collRef, 
    where('active', '==', true), 
    where('isDeleted', '==', false)
  );

  try {
    const snap = await getDocs(q);
    const outletsList: Outlet[] = [];
    snap.forEach((d) => {
      const data = d.data();
      const code = data.code || '';
      outletsList.push({
        ...data,
        outletId: d.id,
        code,
        codeLower: data.codeLower || code.toLowerCase(),
        isMainOutlet: !!data.isMainOutlet,
        active: data.active !== undefined ? data.active : (data.isActive !== undefined ? data.isActive : true),
        isDeleted: !!data.isDeleted
      } as Outlet);
    });
    return outletsList;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `tenants/${tenantId}/outlets`);
  }
}

/**
 * Registers and inserts a brand new physical branch outlet under a tenant.
 * Enforces business logic:
 * 1. Checks that the code and name are non-empty.
 * 2. Ensures the branch code is unique under this tenant (case-insensitive).
 * 3. Enforces a single main outlet constraint.
 *
 * @param tenantId - The unique identifier of the tenant.
 * @param outletData - Partial metadata of the outlet to be created.
 * @param actorUserId - Optionally, the user triggering this action.
 * @returns A promise resolving to the created Outlet object.
 */
export async function createOutlet(
  tenantId: string,
  outletData: Partial<Outlet>,
  actorUserId?: string
): Promise<Outlet> {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }
  if (!outletData.name || !outletData.name.trim()) {
    throw new Error('Nama outlet tidak boleh kosong');
  }
  if (!outletData.code || !outletData.code.trim()) {
    throw new Error('Kode cabang tidak boleh kosong');
  }

  const normalizedCode = outletData.code.trim().toUpperCase();

  try {
    // 4. Update duplicate validation: Use where('codeLower', '==', inputCode.toLowerCase())
    const collRef = collection(db, 'tenants', tenantId, 'outlets');
    const qDup = query(
      collRef,
      where('isDeleted', '==', false),
      where('codeLower', '==', normalizedCode.toLowerCase())
    );
    const querySnapshot = await getDocs(qDup);
    let isDuplicate = !querySnapshot.empty;

    // Safety fallback: inspect legacy active/inactive documents without codeLower memory index
    if (!isDuplicate) {
      const existingOutlets = await getOutlets(tenantId);
      isDuplicate = existingOutlets.some(
        (o) => o.code?.toUpperCase() === normalizedCode
      );
    }

    if (isDuplicate) {
      throw new Error(`Sandi / Kode "${normalizedCode}" sudah terpakai oleh cabang lain`);
    }

    const existingOutlets = await getOutlets(tenantId);
    const outletId = outletData.outletId || `outlet_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const docRef = doc(db, 'tenants', tenantId, 'outlets', outletId);

    // If it is the first outlet, it must default to being the main outlet.
    const isFirstOutlet = existingOutlets.length === 0;
    const isMain = outletData.isMainOutlet ?? isFirstOutlet;

    const now = Timestamp.now();
    const payload: Outlet = {
      outletId,
      tenantId,
      code: normalizedCode,
      codeLower: normalizedCode.toLowerCase(),
      name: outletData.name.trim(),
      address: (outletData.address || '').trim(),
      phone: (outletData.phone || '').trim(),
      managerName: (outletData.managerName || '').trim(),
      printerName: (outletData.printerName || '').trim(),
      receiptFooter: (outletData.receiptFooter || '').trim(),
      isMainOutlet: isMain,
      active: outletData.active !== false,
      isActive: outletData.active !== false, // compatibility fallback
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
    };

    // Use serverTimestamp() everywhere for Firestore writes
    const firestorePayload = {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (isMain) {
      // Deactivate main status of all other existing outlets
      const batch = writeBatch(db);
      existingOutlets.forEach((o) => {
        if (o.isMainOutlet) {
          batch.update(doc(db, 'tenants', tenantId, 'outlets', o.outletId), {
            isMainOutlet: false,
            updatedAt: serverTimestamp(),
          });
        }
      });
      batch.set(docRef, firestorePayload);
      await batch.commit();
    } else {
      await setDoc(docRef, firestorePayload);
    }

    return payload;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `tenants/${tenantId}/outlets`);
  }
}

/**
 * Modifies an existing outlet document.
 * Ensures the code is updated safely, tenant ID remains unchanged, and main outlet rules are met.
 *
 * @param tenantId - The unique identifier of the tenant.
 * @param outletId - The unique identifier of the outlet to update.
 * @param outletData - Partial updates for the outlet.
 * @param actorUserId - Optionally, the user triggering this action.
 * @returns A promise resolving to the modified Outlet object.
 */
export async function updateOutlet(
  tenantId: string,
  outletId: string,
  outletData: Partial<Outlet>,
  actorUserId?: string
): Promise<Outlet> {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }
  if (!outletId) {
    throw new Error('Outlet ID is required');
  }
  if (outletData.name !== undefined && !outletData.name.trim()) {
    throw new Error('Nama outlet tidak boleh kosong');
  }

  try {
    const docRef = doc(db, 'tenants', tenantId, 'outlets', outletId);
    
    // Validate unique codes if changing the code field
    if (outletData.code !== undefined) {
      if (!outletData.code.trim()) {
        throw new Error('Kode cabang tidak boleh kosong');
      }
      const normalizedCode = outletData.code.trim().toUpperCase();
      
      const collRef = collection(db, 'tenants', tenantId, 'outlets');
      const qDup = query(
        collRef,
        where('isDeleted', '==', false),
        where('codeLower', '==', normalizedCode.toLowerCase())
      );
      const querySnapshot = await getDocs(qDup);
      let isDuplicate = querySnapshot.docs.some(doc => doc.id !== outletId);

      // Safety fallback check: verify with memory getOutlets
      if (!isDuplicate) {
        const existingOutlets = await getOutlets(tenantId);
        isDuplicate = existingOutlets.some(
          (o) => o.outletId !== outletId && o.code?.toUpperCase() === normalizedCode
        );
      }

      if (isDuplicate) {
        throw new Error(`Sandi / Kode "${normalizedCode}" sudah terpakai oleh cabang lain`);
      }
    }

    const existingOutlets = await getOutlets(tenantId);
    const existingOutlet = existingOutlets.find((o) => o.outletId === outletId);
    if (!existingOutlet) {
      throw new Error(`Outlet dengan ID "${outletId}" tidak ditemukan`);
    }

    const isMain = outletData.isMainOutlet ?? existingOutlet.isMainOutlet;

    const nowStamp = Timestamp.now();
    const updatePayload: any = {
      updatedAt: serverTimestamp(),
    };

    if (outletData.name !== undefined) updatePayload.name = outletData.name.trim();
    if (outletData.code !== undefined) {
      updatePayload.code = outletData.code.trim().toUpperCase();
      updatePayload.codeLower = outletData.code.trim().toLowerCase();
    }
    if (outletData.address !== undefined) updatePayload.address = outletData.address.trim();
    if (outletData.phone !== undefined) updatePayload.phone = outletData.phone.trim();
    if (outletData.managerName !== undefined) updatePayload.managerName = outletData.managerName.trim();
    if (outletData.printerName !== undefined) updatePayload.printerName = outletData.printerName.trim();
    if (outletData.receiptFooter !== undefined) updatePayload.receiptFooter = outletData.receiptFooter.trim();
    
    if (outletData.active !== undefined) {
      updatePayload.active = outletData.active;
      updatePayload.isActive = outletData.active; // compatibility fallback
    }
    
    if (outletData.isMainOutlet !== undefined) {
      updatePayload.isMainOutlet = outletData.isMainOutlet;
    }

    if (isMain && !existingOutlet.isMainOutlet) {
      // Toggle off other main status
      const batch = writeBatch(db);
      existingOutlets.forEach((o) => {
        if (o.outletId !== outletId && o.isMainOutlet) {
          batch.update(doc(db, 'tenants', tenantId, 'outlets', o.outletId), {
            isMainOutlet: false,
            updatedAt: serverTimestamp(),
          });
        }
      });
      batch.update(docRef, updatePayload);
      await batch.commit();
    } else {
      await updateDoc(docRef, updatePayload);
    }

    return {
      ...existingOutlet,
      ...updatePayload,
      updatedAt: nowStamp, // clean local instance to keep calling clients safe
    } as Outlet;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `tenants/${tenantId}/outlets/${outletId}`);
  }
}

/**
 * Performs a safe soft delete of an outlet branch in Firestore by flagging `isDeleted` as true.
 *
 * @param tenantId - The unique identifier of the tenant context.
 * @param outletId - The ID of the branch target.
 * @param actorUserId - Authorizing user.
 */
export async function deleteOutlet(
  tenantId: string,
  outletId: string,
  actorUserId?: string
): Promise<void> {
  if (!tenantId || !outletId) {
    throw new Error('Tenant ID and Outlet ID are required');
  }

  try {
    const docRef = doc(db, 'tenants', tenantId, 'outlets', outletId);
    await updateDoc(docRef, {
      isDeleted: true,
      active: false,
      isActive: false, // compatibility fallback
      deletedAt: serverTimestamp(),
      deletedBy: actorUserId || null,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `tenants/${tenantId}/outlets/${outletId}`);
  }
}

/**
 * Promotes an outlet to being the single Main Outlet for the tenant.
 * All other outlets are synchronously changed to `isMainOutlet: false` in a batch write.
 *
 * @param tenantId - Tenant context.
 * @param outletId - Desired main branch ID.
 * @param actorUserId - Triggering actor user block.
 */
export async function setMainOutlet(
  tenantId: string,
  outletId: string,
  actorUserId?: string
): Promise<void> {
  if (!tenantId || !outletId) {
    throw new Error('Tenant ID and Outlet ID are required');
  }

  try {
    const existingOutlets = await getOutlets(tenantId);
    const targetOutlet = existingOutlets.find((o) => o.outletId === outletId);
    if (!targetOutlet) {
      throw new Error(`Outlet dengan ID "${outletId}" tidak ditemukan`);
    }

    const batch = writeBatch(db);

    // Disable main status for any other outlet
    existingOutlets.forEach((o) => {
      if (o.isMainOutlet && o.outletId !== outletId) {
        batch.update(doc(db, 'tenants', tenantId, 'outlets', o.outletId), {
          isMainOutlet: false,
          updatedAt: serverTimestamp(),
        });
      }
    });

    // Mark the target outlet as main
    batch.update(doc(db, 'tenants', tenantId, 'outlets', outletId), {
      isMainOutlet: true,
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `tenants/${tenantId}/outlets/${outletId}/setMain`);
  }
}

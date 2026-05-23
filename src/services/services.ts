import { db } from '../firebase/config';
import { handleFirestoreError, OperationType } from '../firebase/errorModel';
import { 
  collection, 
  doc, 
  getDocs, 
  query, 
  where, 
  setDoc, 
  updateDoc, 
  Timestamp,
  serverTimestamp 
} from 'firebase/firestore';
import { LaundryService } from '../types';

/**
 * Maps a Firestore document data to the strict LaundryService model.
 * Adds backward compatibility fallbacks for older entries.
 */
function mapDocToService(id: string, data: any): LaundryService {
  const name = data.name || '';
  const price = data.price !== undefined ? data.price : (data.pricePerUnit !== undefined ? data.pricePerUnit : 0);
  const estimatedDurationHours = data.estimatedDurationHours !== undefined 
    ? data.estimatedDurationHours 
    : (data.estimatedDays !== undefined ? data.estimatedDays * 24 : 48);

  const active = data.active !== undefined 
    ? data.active 
    : (data.isActive !== undefined ? data.isActive : true);

  return {
    ...data,
    serviceId: id,
    tenantId: data.tenantId || '',
    name,
    nameLower: data.nameLower || name.toLowerCase(),
    category: data.category || data.type || 'other',
    unit: data.unit || 'kg',
    price,
    estimatedDurationHours,
    isExpress: !!data.isExpress,
    outletIds: data.outletIds || [],
    description: data.description || '',
    active,
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt : Timestamp.now(),
    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt : Timestamp.now(),
    isDeleted: !!data.isDeleted,
    deletedAt: data.deletedAt instanceof Timestamp ? data.deletedAt : null,
    deletedBy: data.deletedBy || null,
    // Legacy mapping properties
    pricePerUnit: price,
    estimatedDays: Math.ceil(estimatedDurationHours / 24),
    type: data.category || data.type || 'other',
    isActive: active,
  } as LaundryService;
}

/**
 * Retrieves all non-deleted laundry services for a given tenant.
 *
 * @param tenantId - The unique identifier of the tenant.
 * @returns A promise resolving to an array of LaundryService objects.
 */
export async function getServices(tenantId: string): Promise<LaundryService[]> {
  if (!tenantId) {
    return [];
  }

  try {
    const collRef = collection(db, 'tenants', tenantId, 'services');
    const q = query(collRef, where('isDeleted', '==', false));
    const snap = await getDocs(q);
    
    const servicesList: LaundryService[] = [];
    snap.forEach((d) => {
      servicesList.push(mapDocToService(d.id, d.data()));
    });
    return servicesList;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `tenants/${tenantId}/services`);
  }
}

/**
 * Retrieves active non-deleted laundry services assigned to a specific outlet.
 *
 * @param tenantId - The unique identifier of the tenant.
 * @param outletId - The unique identifier of the outlet.
 * @param includeLegacy - If true, merges global legacy services (with empty outletIds) as fallback.
 * @returns A promise resolving to a filtered & sorted list of LaundryService objects.
 */
export async function getServicesByOutlet(
  tenantId: string,
  outletId: string,
  includeLegacy?: boolean
): Promise<LaundryService[]> {
  if (!tenantId || !outletId) {
    return [];
  }

  try {
    const collRef = collection(db, 'tenants', tenantId, 'services');
    
    // Core query containing array-contains filter on outletIds
    const q = query(
      collRef,
      where('active', '==', true),
      where('isDeleted', '==', false),
      where('outletIds', 'array-contains', outletId)
    );
    const snap = await getDocs(q);
    const outletServiceList: LaundryService[] = [];
    snap.forEach((d) => {
      outletServiceList.push(mapDocToService(d.id, d.data()));
    });

    if (includeLegacy) {
      // Fetch legacy separately and merge safely
      const allServices = await getServices(tenantId);
      const globalServices = allServices.filter(
        (s) => s.active && !s.isDeleted && (!s.outletIds || s.outletIds.length === 0)
      );

      // Merge distinct services
      const servicesMap = new Map<string, LaundryService>();
      outletServiceList.forEach((s) => servicesMap.set(s.serviceId, s));
      globalServices.forEach((s) => servicesMap.set(s.serviceId, s));

      return Array.from(servicesMap.values()).sort((a, b) => 
        a.name.localeCompare(b.name)
      );
    }

    return outletServiceList.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `tenants/${tenantId}/services/byOutlet/${outletId}`);
  }
}

/**
 * Registers and inserts a new laundry service under a tenant.
 * Enforces business logic:
 * 1. Checks that the service name is non-empty.
 * 2. Prevents duplicate service names (case-insensitive).
 *
 * @param tenantId - The unique identifier of the tenant.
 * @param serviceData - Partial metadata of the service to be created.
 * @param actorUserId - Optionally, the user triggering this action.
 * @returns A promise resolving to the created LaundryService object.
 */
export async function createService(
  tenantId: string,
  serviceData: Partial<LaundryService>,
  actorUserId?: string
): Promise<LaundryService> {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }
  if (!serviceData.name || !serviceData.name.trim()) {
    throw new Error('Nama layanan tidak boleh kosong');
  }

  const trimmedName = serviceData.name.trim();
  const lowerName = trimmedName.toLowerCase();

  try {
    // Check for duplicate service name matching 'nameLower'
    const collRef = collection(db, 'tenants', tenantId, 'services');
    const qDup = query(
      collRef,
      where('isDeleted', '==', false),
      where('nameLower', '==', lowerName)
    );
    const querySnapshot = await getDocs(qDup);
    let isDuplicate = !querySnapshot.empty;

    // Fallback manual duplicate verification for legacy documents without nameLower
    if (!isDuplicate) {
      const activeServices = await getServices(tenantId);
      isDuplicate = activeServices.some(
        (s) => s.name.trim().toLowerCase() === lowerName
      );
    }

    if (isDuplicate) {
      throw new Error(`Layanan dengan nama "${trimmedName}" sudah terdaftar`);
    }

    const serviceId = serviceData.serviceId || `svc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const docRef = doc(db, 'tenants', tenantId, 'services', serviceId);

    const price = serviceData.price !== undefined ? serviceData.price : 0;
    const estimatedHours = serviceData.estimatedDurationHours !== undefined ? serviceData.estimatedDurationHours : 48;
    const active = serviceData.active !== false;

    const payload: LaundryService = {
      serviceId,
      tenantId,
      name: trimmedName,
      nameLower: lowerName,
      category: serviceData.category || 'other',
      unit: serviceData.unit || 'kg',
      price,
      estimatedDurationHours: estimatedHours,
      isExpress: !!serviceData.isExpress,
      outletIds: serviceData.outletIds || [],
      description: serviceData.description || '',
      active,
      createdAt: Timestamp.now(), // set locally for direct return value
      updatedAt: Timestamp.now(), // set locally for direct return value
      isDeleted: false,
      // Compatibility legacy mapping
      pricePerUnit: price,
      estimatedDays: Math.ceil(estimatedHours / 24),
      type: serviceData.category || 'other',
      isActive: active,
    };

    // Store in Firestore with server timestamps
    const firestorePayload = {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(docRef, firestorePayload);

    return payload;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `tenants/${tenantId}/services`);
  }
}

/**
 * Modifies parameters of an existing laundry service.
 * Enforces business logic:
 * 1. Checks that the service name is non-empty if provided.
 * 2. Prevents updating name to a duplicate of an existing service.
 *
 * @param tenantId - The unique identifier of the tenant.
 * @param serviceId - The unique identifier of the service.
 * @param serviceData - Partial properties update.
 * @param actorUserId - Optionally, the user triggering this action.
 * @returns A promise resolving to the modified LaundryService object.
 */
export async function updateService(
  tenantId: string,
  serviceId: string,
  serviceData: Partial<LaundryService>,
  actorUserId?: string
): Promise<LaundryService> {
  if (!tenantId || !serviceId) {
    throw new Error('Tenant ID and Service ID are required');
  }

  if (serviceData.name !== undefined && !serviceData.name.trim()) {
    throw new Error('Nama layanan tidak boleh kosong');
  }

  try {
    const docRef = doc(db, 'tenants', tenantId, 'services', serviceId);

    // Verify unique name restriction if modified
    if (serviceData.name !== undefined) {
      const trimmedName = serviceData.name.trim();
      const lowerName = trimmedName.toLowerCase();

      const collRef = collection(db, 'tenants', tenantId, 'services');
      const qDup = query(
        collRef,
        where('isDeleted', '==', false),
        where('nameLower', '==', lowerName)
      );
      const querySnapshot = await getDocs(qDup);
      let isDuplicate = querySnapshot.docs.some((doc) => doc.id !== serviceId);

      if (!isDuplicate) {
        const activeServices = await getServices(tenantId);
        isDuplicate = activeServices.some(
          (s) => s.serviceId !== serviceId && s.name.trim().toLowerCase() === lowerName
        );
      }

      if (isDuplicate) {
        throw new Error(`Layanan dengan nama "${trimmedName}" sudah terdaftar`);
      }
    }

    const allServices = await getServices(tenantId);
    const existing = allServices.find((s) => s.serviceId === serviceId);
    if (!existing) {
      throw new Error(`Layanan dengan ID "${serviceId}" tidak ditemukan`);
    }

    const updatePayload: any = {
      updatedAt: serverTimestamp(),
    };

    if (serviceData.name !== undefined) {
      updatePayload.name = serviceData.name.trim();
      updatePayload.nameLower = serviceData.name.trim().toLowerCase();
    }
    if (serviceData.category !== undefined) {
      updatePayload.category = serviceData.category;
      updatePayload.type = serviceData.category; // legacy synonym
    }
    if (serviceData.unit !== undefined) {
      updatePayload.unit = serviceData.unit;
    }
    if (serviceData.price !== undefined) {
      updatePayload.price = serviceData.price;
      updatePayload.pricePerUnit = serviceData.price; // legacy sync
    }
    if (serviceData.estimatedDurationHours !== undefined) {
      updatePayload.estimatedDurationHours = serviceData.estimatedDurationHours;
      updatePayload.estimatedDays = Math.ceil(serviceData.estimatedDurationHours / 24); // legacy sync
    }
    if (serviceData.isExpress !== undefined) {
      updatePayload.isExpress = serviceData.isExpress;
    }
    if (serviceData.outletIds !== undefined) {
      updatePayload.outletIds = serviceData.outletIds;
    }
    if (serviceData.description !== undefined) {
      updatePayload.description = serviceData.description;
    }
    if (serviceData.active !== undefined) {
      updatePayload.active = serviceData.active;
      updatePayload.isActive = serviceData.active; // legacy sync
    }

    await updateDoc(docRef, updatePayload);

    const nowStamp = Timestamp.now();
    return {
      ...existing,
      ...updatePayload,
      updatedAt: nowStamp, // clean local instance to keep calling clients safe
    } as LaundryService;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `tenants/${tenantId}/services/${serviceId}`);
  }
}

/**
 * Performs a soft delete on a laundry service, preventing it from appearing in standard menus.
 *
 * @param tenantId - The unique identifier of the tenant.
 * @param serviceId - The unique identifier of the service.
 * @param actorUserId - The unique identifier of the user executing the delete.
 */
export async function deleteService(
  tenantId: string,
  serviceId: string,
  actorUserId?: string
): Promise<void> {
  if (!tenantId || !serviceId) {
    throw new Error('Tenant ID and Service ID are required');
  }

  try {
    const docRef = doc(db, 'tenants', tenantId, 'services', serviceId);
    await updateDoc(docRef, {
      isDeleted: true,
      active: false,
      isActive: false, // compatibility fallback
      deletedBy: actorUserId || null,
      deletedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `tenants/${tenantId}/services/${serviceId}`);
  }
}

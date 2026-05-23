import { UserProfile } from '../types';

/**
 * Role-Based Access Control (RBAC) Outlet Scoping Helper.
 * Determines if a user profile is authorized to access a specific laundry outlet.
 * 
 * Access rules:
 * - 'owner': Full access to all outlets.
 * - 'admin': Full access to all outlets.
 * - 'kasir': Only authorized for their assigned outlets.
 * - 'pegawai': Only authorized for their assigned outlets.
 * 
 * @param user - The active user's profile details.
 * @param outletId - The unique identifier of the target outlet.
 * @returns true if access is permitted, false otherwise.
 */
export function canAccessOutlet(user: UserProfile | null | undefined, outletId: string): boolean {
  if (!user || !outletId) {
    return false;
  }

  const role = user.role;

  // 'owner' and 'admin' possess global access privileges
  if (role === 'owner' || role === 'admin') {
    return true;
  }

  // 'kasir' and 'pegawai' are strictly scoped to assigned outlets
  if (role === 'kasir' || role === 'pegawai') {
    if (user.assignedOutletIds && Array.isArray(user.assignedOutletIds)) {
      if (user.assignedOutletIds.includes(outletId)) {
        return true;
      }
    }
    // Safe fallback backward compatibility: authorize activeOutletId if no custom assigned list exists
    return user.activeOutletId === outletId;
  }

  return false;
}

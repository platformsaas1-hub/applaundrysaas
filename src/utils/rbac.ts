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

/**
 * Route-Based Access Control (RBAC) Route and Page scoping helper.
 * Governs the exact paths a specific user role is allowed to view.
 * 
 * Rules:
 * - 'owner' & 'admin': Full access to all menus/pages.
 * - 'kasir': Allowed Dashboard, POS, Antrian, Pelanggan, and Unauthorized fallbacks.
 * - 'pegawai': Allowed Antrian only, and Unauthorized fallbacks.
 */
export function canAccessRoute(role: string | null | undefined, path: string): boolean {
  if (!role) {
    return false;
  }

  // Normalize path
  const cleanPath = path.split('?')[0].split('#')[0].toLowerCase();

  // OWNER and ADMIN possess absolute routing permission
  if (role === 'owner' || role === 'admin') {
    return true;
  }

  // KASIR has a targeted set of accessible interfaces
  if (role === 'kasir') {
  const allowed = ['/dashboard', '/pos', '/antrian', '/pelanggan', '/unauthorized'];
  return allowed.some(p => cleanPath === p || cleanPath.startsWith(p + '/'));
}

  // PEGAWAI is strictly scoped to the Operational queues list only
  if (role === 'pegawai') {
  const allowed = ['/antrian', '/unauthorized'];
  return allowed.some(p => cleanPath === p || cleanPath.startsWith(p + '/'));
}

  return false;
}

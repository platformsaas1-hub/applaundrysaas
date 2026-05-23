import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  Query, 
  CollectionReference,
  startAfter,
  DocumentSnapshot
} from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * Interface defining guidelines for building safe, bounded, and isolated queries.
 */
export interface SafeQueryOptions {
  /** Field to order by. Defaults to 'createdAt'. */
  orderByField?: string;
  /** Sort order direction. Defaults to 'desc'. */
  orderDirection?: 'asc' | 'desc';
  /** Page size limit to protect budgets from Denial of Wallet. Defaults to 50. */
  limitCount?: number;
  /** Whether to include logically deleted entities. Defaults to false (only active docs). */
  includeDeleted?: boolean;
  /** Snapshot of the document where page cursor starts for pagination. */
  startAfterDoc?: DocumentSnapshot;
}

/**
 * Returns a typed CollectionReference to a specific tenant's subcollection 
 * to guarantee strict multi-tenant context isolation.
 */
export const getTenantSubcollectionRef = (
  tenantId: string, 
  subcollectionName: 'outlets' | 'services' | 'customers' | 'transactions' | 'employees' | 'expenses' | 'dailyReports' | 'activityLogs' | 'queues' | 'inventory' | 'vouchers' | 'memberships'
): CollectionReference => {
  if (!tenantId) {
    throw new Error("Multi-tenant architecture breach: tenantId is required to instantiate subcollections.");
  }
  return collection(db, 'tenants', tenantId, subcollectionName);
};

/**
 * Main query builder reinforcing safe architecture rules:
 * - Always filters out deleted items unless specifically bypassed (soft delete system)
 * - Restricts max document reads using explicit pagination constraints (prevent unbounded queries)
 * - Enables consistent sorting to facilitate predictable indexing.
 */
export const buildSafeQuery = (
  colRef: CollectionReference,
  options: SafeQueryOptions = {}
): Query => {
  const {
    orderByField = 'createdAt',
    orderDirection = 'desc',
    limitCount = 50,
    includeDeleted = false,
    startAfterDoc
  } = options;

  let q: Query = colRef;

  // 1. Soft Delete Filter Guard (Zero Leakage of logical files)
  if (!includeDeleted) {
    q = query(q, where('isDeleted', '==', false));
  }

  // 2. Predictable ordering (Required for Firestore index matching)
  q = query(q, orderBy(orderByField, orderDirection));

  // 3. Document PaginationCursor (Scale and efficiency)
  if (startAfterDoc) {
    q = query(q, startAfter(startAfterDoc));
  }

  // 4. Defensive capping of the results list
  q = query(q, limit(limitCount));

  return q;
};

/**
 * Developer Guidelines for Query Strategy:
 * 
 * 1. TRANSACTION LIST:
 *    const colRef = getTenantSubcollectionRef(tenantId, 'transactions');
 *    const safeQuery = buildSafeQuery(colRef, { orderByField: 'receivedAt', limitCount: 20 });
 * 
 * 2. REAL-TIME ANTRIAN (Queue list):
 *    const colRef = getTenantSubcollectionRef(tenantId, 'queues');
 *    const activeQueueQuery = query(colRef, where('status', 'in', ['pending', 'active']), orderBy('createdAt', 'asc'));
 * 
 * 3. CRM SEARCH:
 *    const colRef = getTenantSubcollectionRef(tenantId, 'customers');
 *    const safeQuery = buildSafeQuery(colRef, { orderByField: 'name', orderDirection: 'asc', limitCount: 10 });
 */

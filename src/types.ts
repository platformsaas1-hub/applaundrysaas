import { Timestamp } from 'firebase/firestore';

/**
 * Multi-user access control roles for multi-tenant isolation.
 */
export type UserRole = 'owner' | 'admin' | 'kasir' | 'pegawai';

/**
 * 1. USERS PROFILE MODEL (/users/{userId})
 * Secure cross-tenant identity index mapping Auth levels to workspaces.
 */
export interface UserProfile {
  userId: string;
  tenantId: string;
  role: UserRole;
  name: string;
  email: string;
  phone?: string;
  photoURL?: string;
  activeOutletId: string;
  isActive?: boolean;
  isDeleted?: boolean;
  createdAt: string | Timestamp | any;
  updatedAt?: string | Timestamp | any;
  lastLoginAt?: string | Timestamp | any;
}

/**
 * 2. TENANTS WORKSPACE MODEL (/tenants/{tenantId})
 * Top-level organizational unit defining the operational boundary of the enterprise.
 */
export interface Tenant {
  tenantId: string;
  businessName: string;
  businessType?: string;
  ownerId: string;
  plan: 'free' | 'basic' | 'premium';
  status?: 'active' | 'suspended' | 'expired'; // Compatible with older schema
  subscriptionStatus?: 'active' | 'suspended' | 'expired'; // Upgraded schema
  maxOutlets?: number;
  maxEmployees?: number;
  timezone?: string;
  currency?: string;
  isActive?: boolean;
  isDeleted?: boolean;
  createdAt: string | Timestamp | any;
  updatedAt?: string | Timestamp | any;
}

/**
 * 3. OUTLETS MODEL (/tenants/{tenantId}/outlets/{outletId})
 * Physical business location or branch under the umbrella of a single tenant.
 */
export interface Outlet {
  outletId: string;
  tenantId?: string;
  code?: string;
  name: string;
  address: string;
  phone: string;
  isMainOutlet?: boolean;
  printerName?: string;
  receiptFooter?: string;
  isActive?: boolean;
  isDeleted?: boolean;
  createdAt: string | Timestamp | any;
  updatedAt?: string | Timestamp | any;
}

/**
 * 4. SERVICES CATALOG MODEL (/tenants/{tenantId}/services/{serviceId})
 * Service menu offering rates per unit of metric.
 */
export interface LaundryService {
  serviceId: string;
  tenantId?: string;
  name: string;
  category?: string;
  type: 'kiloan' | 'satuan' | 'sepatu' | 'karpet' | 'other';
  unit: 'kg' | 'pcs' | 'pair' | 'm2';
  pricePerUnit: number; // For compatibility
  price?: number; // Upgraded price field.
  estimatedDays: number; // For compatibility
  estimatedHours?: number; // Upgraded estimated SLA hours
  queueCategory?: string;
  isExpress?: boolean;
  isActive: boolean;
  isDeleted?: boolean;
  createdAt: string | Timestamp | any;
  updatedAt?: string | Timestamp | any;
}

/**
 * 5. CUSTOMERS CRM MODEL (/tenants/{tenantId}/customers/{customerId})
 * Profile directory of loyal and recurring patrons of the dry cleaner/laundry workspace.
 */
export interface Customer {
  customerId: string;
  tenantId?: string;
  name: string;
  phone: string;
  address?: string;
  notes?: string;
  totalOrders?: number;
  totalSpent?: number;
  memberLevel?: string;
  points?: number;
  lastOrderAt?: string | Timestamp | any;
  isDeleted?: boolean;
  createdAt: string | Timestamp | any;
  updatedAt?: string | Timestamp | any;
}

/**
 * 6. EMPLOYEES MODEL (/tenants/{tenantId}/employees/{employeeId})
 * Internal staff or laundry processor linked to active working outlet.
 */
export interface Employee {
  employeeId: string;
  userId: string;
  tenantId: string;
  outletId: string;
  role: UserRole;
  fullName: string;
  phone: string;
  salaryType: 'monthly' | 'commission' | 'hourly' | string;
  joinDate: string | Timestamp | any;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: string | Timestamp | any;
  updatedAt?: string | Timestamp | any;
}

/**
 * 7. TRANSACTIONS MAIN REGISTER (/tenants/{tenantId}/transactions/{transactionId})
 * Invoice-level ledger storing summary stats and active operation milestones.
 */
export interface Transaction {
  transactionId: string;
  tenantId?: string;
  outletId: string;
  invoiceNumber?: string;
  queueNumber?: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  cashierId?: string;
  cashierName?: string;
  
  // Backwards compatibility array (newly written objects store items inside items/ subcollection)
  items: TransactionItem[];
  
  totalItems?: number;
  totalQty?: number;
  subtotal?: number;
  discount?: number;
  discountAmount?: number; // For compatibility
  tax?: number;
  totalAmount: number; // Matches grandTotal
  grandTotal?: number;
  paidAmount?: number; // Added for partial payments/DP
  remainingAmount?: number; // Added for track outstanding balance
  changeAmount?: number; // Added for change calculation
  
  paymentStatus: 'unpaid' | 'partial' | 'paid' | 'refunded';
  orderStatus: 'created' | 'queued' | 'washing' | 'drying' | 'ironing' | 'packing' | 'ready' | 'completed' | 'picked_up' | 'cancelled' | 'received' | 'processing' | 'delivered';
  paymentMethod: 'cash' | 'qris' | 'transfer' | 'none' | string;
  
  // Custom metadata fields
  weight?: number;
  workerId?: string;
  workerName?: string;
  notes?: string;
  source?: string;
  
  // Timestamps
  receivedAt: string | Timestamp | any;
  estimatedDoneAt?: string | Timestamp | any;
  completedAt?: string | Timestamp | any | null;
  deliveredAt?: string | Timestamp | any | null; // Compatible
  pickedUpAt?: string | Timestamp | any | null;
  
  isDeleted?: boolean;
  createdAt?: string | Timestamp | any;
  updatedAt?: string | Timestamp | any;
  paymentHistory?: Array<{
    paymentId: string;
    amount: number;
    method: string;
    receivedAt: string;
    recordedBy: string;
  }>;
}

/**
 * 8. TRANSACTION ITEM SLIP SUBCOLLECTION (/tenants/{tenantId}/transactions/{transactionId}/items/{itemId})
 * Granular ordered item metrics to limit document footprint and scale.
 */
export interface TransactionItem {
  itemId?: string; // Upgraded unique item SKU reference identifier
  serviceId: string;
  name: string; // Keep 'name' for backwards compatibility
  serviceName?: string; // Upgraded name
  serviceType?: string;
  qty: number;
  pricePerUnit: number; // For compatibility
  unitPrice?: number; // Upgraded unitPrice
  totalPrice?: number; // For compatibility
  subtotal?: number; // Upgraded subtotal
  notes?: string;
  itemStatus?: 'queued' | 'washing' | 'drying' | 'ironing' | 'ready' | 'cancelled' | string;
  createdAt?: string | Timestamp | any;
}

/**
 * 9. EXPENSES MODULE (/tenants/{tenantId}/expenses/{expenseId})
 * Monthly and operational overhead expenditures tracked per outlet.
 */
export interface Expense {
  expenseId: string;
  tenantId: string;
  outletId: string;
  category: string;
  title: string;
  description?: string; // Backwards compatible
  notes?: string; // New field
  amount: number;
  createdBy: string;
  createdByName?: string; // New field
  expenseDate: string | Timestamp | any;
  createdAt: string | Timestamp | any;
  updatedAt?: string | Timestamp | any; // New field
  isDeleted?: boolean; // New field
}

/**
 * 19. SHIFT CLOSINGS MODULE (/tenants/{tenantId}/shiftClosings/{shiftId})
 * Cashier shift closing tracking per cashier per outlet.
 */
export interface ShiftClosing {
  shiftId: string;
  tenantId: string;
  outletId: string;
  cashierId: string;
  cashierName: string;
  openedAt: string | Timestamp | any;
  closedAt?: string | Timestamp | any;
  openingCash: number;
  expectedCash: number;
  actualCash?: number;
  cashDifference?: number;
  totalTransactions?: number;
  totalRevenue?: number;
  notes?: string;
  status: 'open' | 'closed';
  createdAt: string | Timestamp | any;
  updatedAt?: string | Timestamp | any;
}

/**
 * 10. DAILY REPORTS DB (/tenants/{tenantId}/dailyReports/{reportId})
 * Lightweight stats aggregated nightly per branch to prevent high client computation expenses.
 */
export interface DailyReport {
  reportId: string; // YYYY-MM-DD_outletId
  date: string; // YYYY-MM-DD
  outletId: string;
  totalRevenue: number;
  totalExpense?: number;
  netProfit?: number;
  cashRevenue?: number; // compat
  qrisRevenue?: number; // compat
  transferRevenue?: number; // compat
  totalOrders: number;
  completedOrders?: number; // compat
  unpaidOrders?: number;
  paidOrders?: number;
  createdAt?: string | Timestamp | any;
  updatedAt: string | Timestamp | any;
}

/**
 * 11. ACTIVITY LOGS MODULE (/tenants/{tenantId}/activityLogs/{logId})
 * Immutable log history listing operational updates for auditing.
 */
export interface ActivityLog {
  logId: string;
  tenantId: string;
  userId: string;
  userName: string;
  action: string;
  entityType: string;
  entityId: string;
  description: string;
  createdAt: string | Timestamp | any;
}

/**
 * 12. QUEUES (Operational Buffer) (/tenants/{tenantId}/queues/{queueId})
 */
export interface QueueItem {
  queueId: string;
  tenantId: string;
  outletId: string;
  transactionId: string;
  queueNumber: string;
  category: string;
  status: 'pending' | 'active' | 'completed' | 'skipped';
  createdAt: string | Timestamp | any;
  updatedAt: string | Timestamp | any;
}

/**
 * 13. NOTIFICATIONS (/tenants/{tenantId}/notifications/{notificationId})
 */
export interface TenantNotification {
  notificationId: string;
  tenantId: string;
  userId: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string | Timestamp | any;
}

/**
 * 14. SETTINGS (/tenants/{tenantId}/settings/{settingId})
 */
export interface TenantSettings {
  settingId: string;
  tenantId: string;
  whatsappGatewayToken?: string;
  autoSendWhatsapp: boolean;
  taxPercent: number;
  enableVoucher: boolean;
  updatedAt: string | Timestamp | any;
}

/**
 * 15. SUBSCRIPTIONS (/tenants/{tenantId}/subscriptions/{subscriptionId})
 */
export interface TenantSubscription {
  subscriptionId: string;
  tenantId: string;
  plan: 'free' | 'basic' | 'premium';
  status: 'active' | 'expired' | 'suspended';
  startDate: string | Timestamp | any;
  endDate: string | Timestamp | any;
  paidAmount: number;
  paymentReceiptUrl?: string;
  createdAt: string | Timestamp | any;
}

/**
 * 16. INVENTORY (/tenants/{tenantId}/inventory/{itemId})
 */
export interface InventoryItem {
  itemId: string;
  tenantId: string;
  outletId: string;
  name: string;
  skuCode?: string;
  stockQty: number;
  safetyStockQty: number;
  unit: string;
  updatedAt: string | Timestamp | any;
}

/**
 * 17. VOUCHERS (/tenants/{tenantId}/vouchers/{voucherId})
 */
export interface Voucher {
  voucherId: string;
  tenantId: string;
  code: string;
  discountType: 'percentage' | 'fixed_amount';
  discountValue: number;
  minTransactionAmount: number;
  validFrom: string | Timestamp | any;
  validTo: string | Timestamp | any;
  usageCount: number;
  maxUsageLimit: number;
  isActive: boolean;
}

/**
 * 18. MEMBERSHIPS (/tenants/{tenantId}/memberships/{membershipId})
 */
export interface Membership {
  membershipId: string;
  tenantId: string;
  customerId: string;
  level: 'silver' | 'gold' | 'platinum';
  benefitsDescription?: string;
  pointsAccumulated: number;
  joinedAt: string | Timestamp | any;
  expiresAt?: string | Timestamp | any;
}

/**
 * Local client-side tracking state to mitigate runtime firestore expenses.
 */
export interface QuotaTracker {
  reads: number;
  writes: number;
  savedReads: number;
}

/**
 * 20. NOTIFICATION LOGS MODULE (/tenants/{tenantId}/notifications/{notificationId})
 * Track WhatsApp deliveries as lightweight logs for operational auditing.
 */
export interface NotificationLog {
  notificationId: string;
  tenantId: string;
  transactionId: string;
  customerPhone: string;
  templateType: 'order_received' | 'order_processing' | 'order_ready' | 'order_completed' | 'payment_reminder' | string;
  provider: 'fonnte' | string;
  status: 'sent' | 'failed';
  responseMessage?: string;
  createdAt: string;
  sentBy: string;
  sentByName?: string;
}

export interface AutomationJob {
  jobId: string;
  tenantId: string;
  outletId: string;
  type: 'send_receipt' | 'ready_pickup' | 'overdue_pickup' | 'partial_payment_reminder' | 'custom_manual';
  transactionId?: string;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  message: string;
  deliveryChannel: 'whatsapp';
  status: 'queued' | 'processing' | 'sent' | 'failed' | 'cancelled';
  retryCount: number;
  maxRetries: number;
  nextRetryAt?: any | null; // Firestore Timestamp, Date, or string
  createdBy: string;
  createdByName: string;
  triggeredBy: 'system' | 'manual' | 'status_change' | 'payment_update' | 'checkout';
  errorMessage?: string;
  sentAt?: any | null; // Firestore Timestamp, Date, or string
  createdAt: any; // Firestore Timestamp, Date, or string
  updatedAt: any; // Firestore Timestamp, Date, or string
  isDeleted: boolean;
}

export interface AutomationNotificationLog {
  logId: string;
  jobId: string;
  tenantId: string;
  outletId: string;
  transactionId?: string;
  customerId?: string;
  type: string;
  provider: string;
  target: string;
  message: string;
  status: 'queued' | 'sent' | 'failed';
  providerResponse?: any;
  errorMessage?: string;
  createdAt: any; // Firestore Timestamp or date ISO string
}



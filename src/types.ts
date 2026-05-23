export type UserRole = 'owner' | 'admin' | 'kasir' | 'pegawai';

export interface UserProfile {
  userId: string;
  name: string;
  email: string;
  role: UserRole;
  tenantId: string;
  activeOutletId: string;
  createdAt: string;
}

export interface Tenant {
  tenantId: string;
  businessName: string;
  ownerId: string;
  status: 'active' | 'suspended' | 'expired';
  plan: 'free' | 'basic' | 'premium';
  createdAt: string;
}

export interface Outlet {
  outletId: string;
  name: string;
  address: string;
  phone: string;
  createdAt: string;
}

export interface LaundryService {
  serviceId: string;
  name: string;
  type: 'kiloan' | 'satuan' | 'sepatu' | 'karpet' | 'other';
  unit: 'kg' | 'pcs' | 'pair' | 'm2';
  pricePerUnit: number;
  estimatedDays: number;
  isActive: boolean;
  createdAt: string;
}

export interface Customer {
  customerId: string;
  name: string;
  phone: string;
  address?: string;
  notes?: string;
  createdAt: string;
}

export interface TransactionItem {
  serviceId: string;
  name: string;
  qty: number;
  pricePerUnit: number;
  totalPrice: number;
}

export interface Transaction {
  transactionId: string;
  outletId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  items: TransactionItem[];
  totalAmount: number;
  discountAmount: number;
  paymentStatus: 'unpaid' | 'paid' | 'refunded';
  paymentMethod: 'cash' | 'qris' | 'transfer' | 'none';
  orderStatus: 'received' | 'processing' | 'ready' | 'delivered';
  weight?: number;
  workerId: string;
  workerName: string;
  notes?: string;
  receivedAt: string;
  completedAt?: string | null;
  deliveredAt?: string | null;
}

export interface DailyReport {
  reportId: string; // YYYY-MM-DD_outletId
  date: string; // YYYY-MM-DD
  outletId: string;
  totalRevenue: number;
  cashRevenue: number;
  qrisRevenue: number;
  transferRevenue: number;
  totalOrders: number;
  completedOrders: number;
  updatedAt: string;
}

export interface QuotaTracker {
  reads: number;
  writes: number;
  savedReads: number; // how many reads we saved by using aggregates
}

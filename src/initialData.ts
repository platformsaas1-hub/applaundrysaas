import { Timestamp } from 'firebase/firestore';
import { Tenant, Outlet, LaundryService, Customer, Transaction, DailyReport } from './types';

export const INITIAL_TENANT: Tenant = {
  tenantId: 'tenant_laundry_barokah',
  businessName: 'Laundry Barokah Utama',
  ownerId: 'owner_budi',
  status: 'active',
  plan: 'free',
  createdAt: '2026-01-10T12:00:00Z',
};

export const INITIAL_OUTLETS: Outlet[] = [
  {
    outletId: 'outlet_depok',
    tenantId: 'tenant_laundry_barokah',
    code: 'OT-DEPOK',
    codeLower: 'ot-depok',
    name: 'Laundry Barokah - Depok Margonda',
    address: 'Jl. Margonda Raya No. 45, Depok',
    phone: '08123456789',
    isMainOutlet: true,
    active: true,
    createdAt: Timestamp.fromDate(new Date('2026-01-10T12:05:00Z')),
    updatedAt: Timestamp.fromDate(new Date('2026-01-10T12:05:00Z')),
    isDeleted: false
  },
  {
    outletId: 'outlet_sawangan',
    tenantId: 'tenant_laundry_barokah',
    code: 'OT-SAWANGAN',
    codeLower: 'ot-sawangan',
    name: 'Laundry Barokah - Sawangan',
    address: 'Jl. Raya Sawangan No. 12, Depok',
    phone: '08987654321',
    isMainOutlet: false,
    active: true,
    createdAt: Timestamp.fromDate(new Date('2026-03-15T09:00:00Z')),
    updatedAt: Timestamp.fromDate(new Date('2026-03-15T09:00:00Z')),
    isDeleted: false
  }
];

export const INITIAL_SERVICES: LaundryService[] = [
  {
    serviceId: 'svc_cuci_setrika_kg',
    tenantId: 'tenant_laundry_barokah',
    name: 'Cuci + Setrika Reguler',
    nameLower: 'cuci + setrika reguler',
    category: 'kiloan',
    unit: 'kg',
    price: 8000,
    estimatedDurationHours: 48,
    isExpress: false,
    outletIds: ['outlet_depok', 'outlet_sawangan'],
    active: true,
    createdAt: Timestamp.fromDate(new Date('2026-01-10T12:15:00Z')),
    updatedAt: Timestamp.fromDate(new Date('2026-01-10T12:15:00Z')),
    isDeleted: false,
    pricePerUnit: 8000,
    estimatedDays: 2,
    type: 'kiloan'
  },
  {
    serviceId: 'svc_cuci_kering_kg',
    tenantId: 'tenant_laundry_barokah',
    name: 'Cuci Kering Saja',
    nameLower: 'cuci kering saja',
    category: 'kiloan',
    unit: 'kg',
    price: 6000,
    estimatedDurationHours: 24,
    isExpress: false,
    outletIds: ['outlet_depok', 'outlet_sawangan'],
    active: true,
    createdAt: Timestamp.fromDate(new Date('2026-01-11T08:00:00Z')),
    updatedAt: Timestamp.fromDate(new Date('2026-01-11T08:00:00Z')),
    isDeleted: false,
    pricePerUnit: 6000,
    estimatedDays: 1,
    type: 'kiloan'
  },
  {
    serviceId: 'svc_setrika_kg',
    tenantId: 'tenant_laundry_barokah',
    name: 'Setrika Rapi Saja',
    nameLower: 'setrika rapi saja',
    category: 'kiloan',
    unit: 'kg',
    price: 5000,
    estimatedDurationHours: 24,
    isExpress: false,
    outletIds: ['outlet_depok', 'outlet_sawangan'],
    active: true,
    createdAt: Timestamp.fromDate(new Date('2026-01-11T09:00:00Z')),
    updatedAt: Timestamp.fromDate(new Date('2026-01-11T09:00:00Z')),
    isDeleted: false,
    pricePerUnit: 5000,
    estimatedDays: 1,
    type: 'kiloan'
  },
  {
    serviceId: 'svc_sepatu_premium',
    tenantId: 'tenant_laundry_barokah',
    name: 'Sepatu Canvas / Sneakers',
    nameLower: 'sepatu canvas / sneakers',
    category: 'satuan',
    unit: 'pcs',
    price: 25000,
    estimatedDurationHours: 72,
    isExpress: false,
    outletIds: ['outlet_depok', 'outlet_sawangan'],
    active: true,
    createdAt: Timestamp.fromDate(new Date('2026-02-01T10:00:00Z')),
    updatedAt: Timestamp.fromDate(new Date('2026-02-01T10:00:00Z')),
    isDeleted: false,
    pricePerUnit: 25000,
    estimatedDays: 3,
    type: 'satuan'
  },
  {
    serviceId: 'svc_sepatu_leather',
    tenantId: 'tenant_laundry_barokah',
    name: 'Sepatu Leather Care',
    nameLower: 'sepatu leather care',
    category: 'satuan',
    unit: 'pcs',
    price: 40000,
    estimatedDurationHours: 96,
    isExpress: false,
    outletIds: ['outlet_depok'],
    active: true,
    createdAt: Timestamp.fromDate(new Date('2026-02-01T10:30:00Z')),
    updatedAt: Timestamp.fromDate(new Date('2026-02-01T10:30:00Z')),
    isDeleted: false,
    pricePerUnit: 40000,
    estimatedDays: 4,
    type: 'satuan'
  },
  {
    serviceId: 'svc_karpet_bulu_m2',
    tenantId: 'tenant_laundry_barokah',
    name: 'Karpet Bulu Tebal',
    nameLower: 'karpet bulu tebal',
    category: 'satuan',
    unit: 'item',
    price: 15000,
    estimatedDurationHours: 120,
    isExpress: false,
    outletIds: ['outlet_depok'],
    active: true,
    createdAt: Timestamp.fromDate(new Date('2026-02-05T14:00:00Z')),
    updatedAt: Timestamp.fromDate(new Date('2026-02-05T14:00:00Z')),
    isDeleted: false,
    pricePerUnit: 15000,
    estimatedDays: 5,
    type: 'satuan'
  },
  {
    serviceId: 'svc_jas_pria',
    tenantId: 'tenant_laundry_barokah',
    name: 'Cuci Satuan Jas / Blazer',
    nameLower: 'cuci satuan jas / blazer',
    category: 'satuan',
    unit: 'pcs',
    price: 20000,
    estimatedDurationHours: 72,
    isExpress: false,
    outletIds: ['outlet_depok', 'outlet_sawangan'],
    active: true,
    createdAt: Timestamp.fromDate(new Date('2026-02-05T14:30:00Z')),
    updatedAt: Timestamp.fromDate(new Date('2026-02-05T14:30:00Z')),
    isDeleted: false,
    pricePerUnit: 20000,
    estimatedDays: 3,
    type: 'satuan'
  }
];

export const INITIAL_CUSTOMERS: Customer[] = [
  {
    customerId: 'cust_ahmad',
    name: 'Ahmad Dani',
    phone: '628998877665',
    address: 'Apartemen Margonda Residence Tower 2',
    notes: 'Parfum wangi Sakura, jangan terlalu banyak pemutih',
    createdAt: '2026-02-15T09:10:00Z'
  },
  {
    customerId: 'cust_budi',
    name: 'Budi Santoso',
    phone: '6281234567890',
    address: 'Perumahan Pesona Depok Blok G',
    notes: 'Tidak suka pewangi menyengat (minta varian Mild)',
    createdAt: '2026-03-01T11:20:00Z'
  },
  {
    customerId: 'cust_siti',
    name: 'Siti Aminah',
    phone: '6285647382910',
    address: 'Kost Putri Al-Hidayah Margonda',
    notes: 'Baju kerja/hijab mohon disetrika gantung',
    createdAt: '2026-04-10T15:40:00Z'
  },
  {
    customerId: 'cust_rian',
    name: 'Rian Hidayat',
    phone: '6287755443322',
    address: 'Kukusan Kelurahan Gg. Masjid',
    notes: 'Selalu minta ekspres jika selesai cepat',
    createdAt: '2026-05-19T10:00:00Z'
  }
];

export const INITIAL_TRANSACTIONS: Transaction[] = [
  {
    transactionId: 'LKU-2026-0001',
    outletId: 'outlet_depok',
    customerId: 'cust_ahmad',
    customerName: 'Ahmad Dani',
    customerPhone: '628998877665',
    items: [
      {
        serviceId: 'svc_cuci_setrika_kg',
        name: 'Cuci + Setrika Reguler',
        qty: 5,
        pricePerUnit: 8000,
        totalPrice: 40000
      }
    ],
    totalAmount: 40000,
    discountAmount: 0,
    paymentStatus: 'paid',
    paymentMethod: 'qris',
    orderStatus: 'delivered',
    weight: 5,
    workerId: 'worker_kasir_anti',
    workerName: 'Anti (Kasir)',
    notes: 'Lipat rapi, gantung kemeja',
    receivedAt: '2026-05-20T08:30:00Z',
    completedAt: '2026-05-22T09:00:00Z',
    deliveredAt: '2026-05-22T17:00:00Z'
  },
  {
    transactionId: 'LKU-2026-0002',
    outletId: 'outlet_depok',
    customerId: 'cust_budi',
    customerName: 'Budi Santoso',
    customerPhone: '6281234567890',
    items: [
      {
        serviceId: 'svc_cuci_setrika_kg',
        name: 'Cuci + Setrika Reguler',
        qty: 3.5,
        pricePerUnit: 8000,
        totalPrice: 28000
      },
      {
        serviceId: 'svc_sepatu_premium',
        name: 'Sepatu Canvas / Sneakers',
        qty: 1,
        pricePerUnit: 25000,
        totalPrice: 25000
      }
    ],
    totalAmount: 53000,
    discountAmount: 0,
    paymentStatus: 'paid',
    paymentMethod: 'cash',
    orderStatus: 'processing',
    weight: 3.5,
    workerId: 'worker_pegawai_eko',
    workerName: 'Eko (Cuci)',
    notes: 'Kemeja kerja gantung',
    receivedAt: '2026-05-21T10:15:00Z',
    completedAt: null,
    deliveredAt: null
  },
  {
    transactionId: 'LKU-2026-0003',
    outletId: 'outlet_depok',
    customerId: 'cust_siti',
    customerName: 'Siti Aminah',
    customerPhone: '6285647382910',
    items: [
      {
        serviceId: 'svc_cuci_kering_kg',
        name: 'Cuci Kering Saja',
        qty: 4.2,
        pricePerUnit: 6000,
        totalPrice: 25200
      }
    ],
    totalAmount: 25200,
    discountAmount: 0,
    paymentStatus: 'unpaid',
    paymentMethod: 'none',
    orderStatus: 'received',
    weight: 4.2,
    workerId: 'worker_kasir_anti',
    workerName: 'Anti (Kasir)',
    notes: 'Pisahkan pakaian luntur',
    receivedAt: '2026-05-22T07:45:00Z',
    completedAt: null,
    deliveredAt: null
  },
  {
    transactionId: 'LKU-2026-0004',
    outletId: 'outlet_sawangan',
    customerId: 'cust_rian',
    customerName: 'Rian Hidayat',
    customerPhone: '6287755443322',
    items: [
      {
        serviceId: 'svc_karpet_bulu_m2',
        name: 'Karpet Bulu Tebal',
        qty: 6,
        pricePerUnit: 15000,
        totalPrice: 90000
      }
    ],
    totalAmount: 90000,
    discountAmount: 10000,
    paymentStatus: 'paid',
    paymentMethod: 'transfer',
    orderStatus: 'ready',
    weight: 12, // weight approx
    workerId: 'worker_pegawai_budi',
    workerName: 'Budi Santoso',
    notes: 'Pakai plastik pengaman ganda',
    receivedAt: '2026-05-18T14:20:00Z',
    completedAt: '2026-05-22T11:00:00Z',
    deliveredAt: null
  },
  {
    transactionId: 'LKU-2026-0005',
    outletId: 'outlet_depok',
    customerId: 'cust_rian',
    customerName: 'Rian Hidayat',
    customerPhone: '6287755443322',
    items: [
      {
        serviceId: 'svc_cuci_setrika_kg',
        name: 'Cuci + Setrika Reguler',
        qty: 6.5,
        pricePerUnit: 8000,
        totalPrice: 52000
      }
    ],
    totalAmount: 52000,
    discountAmount: 0,
    paymentStatus: 'paid',
    paymentMethod: 'qris',
    orderStatus: 'ready',
    weight: 6.5,
    workerId: 'worker_kasir_anti',
    workerName: 'Anti (Kasir)',
    notes: 'Wangi sakura yang kuat',
    receivedAt: '2026-05-22T09:12:00Z',
    completedAt: '2026-05-22T16:30:00Z',
    deliveredAt: null
  }
];

export const INITIAL_DAILY_REPORTS: DailyReport[] = [
  {
    reportId: '2026-05-22_outlet_depok',
    date: '2026-05-22',
    outletId: 'outlet_depok',
    totalRevenue: 52000, // From LKU-2026-0005 (paid on 2026-05-22), since other paid orders were different days or out-of-day. Wait, we can accumulate
    cashRevenue: 0,
    qrisRevenue: 52000,
    transferRevenue: 0,
    totalOrders: 3, // LKU-2026-0003, LKU-2026-0005
    completedOrders: 1,
    updatedAt: '2026-05-22T16:30:00Z'
  },
  {
    reportId: '2026-05-22_outlet_sawangan',
    date: '2026-05-22',
    outletId: 'outlet_sawangan',
    totalRevenue: 80000, // LKU-2026-0004 had a discount of 10k so paid is 80k.
    cashRevenue: 0,
    qrisRevenue: 0,
    transferRevenue: 80000,
    totalOrders: 1,
    completedOrders: 1,
    updatedAt: '2026-05-22T11:00:00Z'
  }
];

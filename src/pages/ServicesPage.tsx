import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTenant } from '../context/TenantContext';
import { db } from '../firebase/config';
import { handleFirestoreError, OperationType } from '../firebase/errorModel';
import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  writeBatch, 
  Timestamp 
} from 'firebase/firestore';
import { 
  Sliders, 
  Plus, 
  Search, 
  Building, 
  Trash2, 
  Edit3, 
  Check, 
  AlertTriangle, 
  Printer, 
  Clock, 
  Coins, 
  User, 
  X,
  FileText,
  BadgeAlert,
  ToggleLeft,
  ToggleRight,
  Shield,
  Loader2,
  CheckCircle,
  HelpCircle
} from 'lucide-react';
import { LaundryService, Outlet } from '../types';
import { formatRupiah } from '../utils/formatting';

export function ServicesPage() {
  const { userProfile } = useAuth();
  const { services, outlets, loadingTenant } = useTenant();

  const currentRole = userProfile?.role || 'kasir';
  const tenantId = userProfile?.tenantId || '';
  const currentUserId = userProfile?.userId || 'system';

  // Role Permissions Guard Checks
  const isOwner = currentRole === 'owner';
  const isAdmin = currentRole === 'admin';
  const canModifyCatalog = isOwner || isAdmin;
  const canModifyOutlets = isOwner; // OWNER has full access to outlets, ADMIN can read/update (no create/delete)

  // Sub-Navigation Tabs state
  const [activeTab, setActiveTab] = useState<'services' | 'outlets'>('services');

  // Search & Filter state
  const [serviceSearch, setServiceSearch] = useState('');
  const [serviceCategoryFilter, setServiceCategoryFilter] = useState('all');
  const [serviceOutletFilter, setServiceOutletFilter] = useState('all');

  const [outletSearch, setOutletSearch] = useState('');

  // Forms loading button states
  const [submitting, setSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  // Active / non-deleted entities
  const activeOutletsList = useMemo(() => {
    return outlets.filter(o => !o.isDeleted);
  }, [outlets]);

  const activeServicesList = useMemo(() => {
    return services.filter(s => !s.isDeleted);
  }, [services]);

  // Modal display control
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<LaundryService | null>(null);

  const [outletModalOpen, setOutletModalOpen] = useState(false);
  const [selectedOutlet, setSelectedOutlet] = useState<Outlet | null>(null);

  // Service Form inputs state
  const [svcFormName, setSvcFormName] = useState('');
  const [svcFormCategory, setSvcFormCategory] = useState<'kiloan' | 'satuan' | 'express' | 'vip' | 'dry_clean' | 'other'>('kiloan');
  const [svcFormUnit, setSvcFormUnit] = useState<'kg' | 'pcs' | 'item'>('kg');
  const [svcFormPrice, setSvcFormPrice] = useState<number>(0);
  const [svcFormEstHours, setSvcFormEstHours] = useState<number>(12);
  const [svcFormIsExpress, setSvcFormIsExpress] = useState(false);
  const [svcFormOutletIds, setSvcFormOutletIds] = useState<string[]>([]);
  const [svcFormDesc, setSvcFormDesc] = useState('');
  const [svcFormActive, setSvcFormActive] = useState(true);

  // Outlet Form inputs state
  const [outFormCode, setOutFormCode] = useState('');
  const [outFormName, setOutFormName] = useState('');
  const [outFormAddress, setOutFormAddress] = useState('');
  const [outFormPhone, setOutFormPhone] = useState('');
  const [outFormManager, setOutFormManager] = useState('');
  const [outFormPrinter, setOutFormPrinter] = useState('');
  const [outFormFooter, setOutFormFooter] = useState('');
  const [outFormIsMain, setOutFormIsMain] = useState(false);
  const [outFormActive, setOutFormActive] = useState(true);

  // Open Service model initializer
  const openServiceModal = (svc: LaundryService | null = null) => {
    setErrorText(null);
    if (svc) {
      setSelectedService(svc);
      setSvcFormName(svc.name);
      setSvcFormCategory(svc.category);
      setSvcFormUnit(svc.unit);
      setSvcFormPrice(svc.price);
      setSvcFormEstHours(svc.estimatedDurationHours);
      setSvcFormIsExpress(!!svc.isExpress);
      setSvcFormOutletIds(svc.outletIds || []);
      setSvcFormDesc(svc.description || '');
      setSvcFormActive(svc.active);
    } else {
      setSelectedService(null);
      setSvcFormName('');
      setSvcFormCategory('kiloan');
      setSvcFormUnit('kg');
      setSvcFormPrice(0);
      setSvcFormEstHours(24);
      setSvcFormIsExpress(false);
      // Pre-select all active branches in the tenant’s workspace
      setSvcFormOutletIds(activeOutletsList.map(o => o.outletId));
      setSvcFormDesc('');
      setSvcFormActive(true);
    }
    setServiceModalOpen(true);
  };

  // Open Outlet modal initializer
  const openOutletModal = (out: Outlet | null = null) => {
    setErrorText(null);
    if (out) {
      setSelectedOutlet(out);
      setOutFormCode(out.code || '');
      setOutFormName(out.name);
      setOutFormAddress(out.address);
      setOutFormPhone(out.phone || '');
      setOutFormManager(out.managerName || '');
      setOutFormPrinter(out.printerName || '');
      setOutFormFooter(out.receiptFooter || '');
      setOutFormIsMain(!!out.isMainOutlet);
      setOutFormActive(out.active);
    } else {
      setSelectedOutlet(null);
      // Auto generate random code prefix
      setOutFormCode(`OT-${Math.random().toString(36).substring(3, 7).toUpperCase()}`);
      setOutFormName('');
      setOutFormAddress('');
      setOutFormPhone('');
      setOutFormManager('');
      setOutFormPrinter('');
      setOutFormFooter('Terima kasih atas kepercayaan Anda - Clean Clothes, Clean Mind!');
      setOutFormIsMain(activeOutletsList.length === 0); // Active master is default true if it's first branch
      setOutFormActive(true);
    }
    setOutletModalOpen(true);
  };

  // ----------------------------------------------------
  // SUBMIT FLOWS: SERVICE
  // ----------------------------------------------------
  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;

    if (!svcFormName.trim()) {
      setErrorText('Nama tarif layanan tidak boleh kosong');
      return;
    }

    if (svcFormPrice < 0) {
      setErrorText('Harga tarif tidak boleh negatif');
      return;
    }

    if (svcFormOutletIds.length === 0) {
      setErrorText('Pilih sekurang-kurangnya satu cabang outlet');
      return;
    }

    setSubmitting(true);
    setErrorText(null);

    try {
      // Validate duplicate service name
      const queryName = svcFormName.trim().toLowerCase();
      const isDuplicate = activeServicesList.some(s => 
        s.name.toLowerCase() === queryName && 
        s.serviceId !== (selectedService?.serviceId || '')
      );

      if (isDuplicate) {
        throw new Error('Nama layanan tersebut sudah terdaftar di catalog. Silakan gunakan nama lain.');
      }

      const serviceId = selectedService?.serviceId || `svc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const docRef = doc(db, 'tenants', tenantId, 'services', serviceId);

      const payload: LaundryService = {
        serviceId,
        tenantId,
        name: svcFormName.trim(),
        nameLower: svcFormName.trim().toLowerCase(),
        category: svcFormCategory,
        unit: svcFormUnit,
        price: svcFormPrice,
        estimatedDurationHours: svcFormEstHours,
        isExpress: svcFormIsExpress,
        outletIds: svcFormOutletIds,
        description: svcFormDesc.trim(),
        active: svcFormActive,
        createdAt: selectedService?.createdAt || Timestamp.now(),
        updatedAt: Timestamp.now(),
        isDeleted: false,

        // Backward compatibility mappings
        pricePerUnit: svcFormPrice,
        estimatedDays: Math.ceil(svcFormEstHours / 24),
        type: svcFormCategory,
        isActive: svcFormActive
      };

      await setDoc(docRef, payload);
      setServiceModalOpen(false);
    } catch (err: any) {
      setErrorText(err?.message || 'Gagal menyimpan data layanan');
      handleFirestoreError(err, OperationType.WRITE, `tenants/${tenantId}/services`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteService = async (svc: LaundryService) => {
    if (!tenantId || !window.confirm(`Hapus layanan "${svc.name}"?`)) return;

    try {
      const docRef = doc(db, 'tenants', tenantId, 'services', svc.serviceId);
      await updateDoc(docRef, {
        isDeleted: true,
        active: false,
        isActive: false, // Compatibility
        deletedAt: Timestamp.now(),
        deletedBy: currentUserId,
        updatedAt: Timestamp.now()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `tenants/${tenantId}/services/${svc.serviceId}`);
    }
  };

  // Toggle active quickly
  const handleToggleServiceActive = async (svc: LaundryService) => {
    if (!tenantId || !canModifyCatalog) return;

    try {
      const docRef = doc(db, 'tenants', tenantId, 'services', svc.serviceId);
      await updateDoc(docRef, {
        active: !svc.active,
        isActive: !svc.active, // Compatibility
        updatedAt: Timestamp.now()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `tenants/${tenantId}/services/${svc.serviceId}`);
    }
  };

  // ----------------------------------------------------
  // SUBMIT FLOWS: OUTLET
  // ----------------------------------------------------
  const handleSaveOutlet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;

    if (!outFormCode.trim() || !outFormName.trim() || !outFormAddress.trim()) {
      setErrorText('Kode, nama, dan alamat cabang tidak boleh kosong');
      return;
    }

    setSubmitting(true);
    setErrorText(null);

    try {
      // Validate duplicate branch code
      const normCode = outFormCode.trim().toUpperCase();
      const codeDuplicate = activeOutletsList.some(o => 
        o.code.toUpperCase() === normCode && 
        o.outletId !== (selectedOutlet?.outletId || '')
      );

      if (codeDuplicate) {
        throw new Error(`Sandi / Code "${normCode}" sudah terpakai oleh cabang lain`);
      }

      const outletId = selectedOutlet?.outletId || `outlet_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const batch = writeBatch(db);

      // Enforce single main outlet only
      if (outFormIsMain) {
        activeOutletsList.forEach(o => {
          if (o.outletId !== outletId && o.isMainOutlet) {
            batch.update(doc(db, 'tenants', tenantId, 'outlets', o.outletId), {
              isMainOutlet: false,
              updatedAt: Timestamp.now()
            });
          }
        });
      }

      const docRef = doc(db, 'tenants', tenantId, 'outlets', outletId);
      const payload: Outlet = {
        outletId,
        tenantId,
        code: normCode,
        codeLower: normCode.toLowerCase(),
        name: outFormName.trim(),
        address: outFormAddress.trim(),
        phone: outFormPhone.trim(),
        managerName: outFormManager.trim(),
        printerName: outFormPrinter.trim(),
        receiptFooter: outFormFooter.trim(),
        isMainOutlet: outFormIsMain,
        active: outFormActive,
        createdAt: selectedOutlet?.createdAt || Timestamp.now(),
        updatedAt: Timestamp.now(),
        isDeleted: false,

        // Backward compatibility
        isActive: outFormActive
      };

      batch.set(docRef, payload);
      await batch.commit();
      setOutletModalOpen(false);
    } catch (err: any) {
      setErrorText(err?.message || 'Gagal menyimpan data cabang');
      handleFirestoreError(err, OperationType.WRITE, `tenants/${tenantId}/outlets`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteOutlet = async (out: Outlet) => {
    if (!tenantId) return;

    if (out.isMainOutlet) {
      alert('Cabang ini dispesifikasikan sebagai Cabang Utama (Main Branch). Anda wajib memilih cabang utama pengganti terlebih dahulu untuk melanjutkan soft-delete.');
      return;
    }

    if (!window.confirm(`Hapus data Cabang "${out.name}"? Seluruh konfigurasi layout terlampir akan dinonaktifkan.`)) return;

    try {
      const docRef = doc(db, 'tenants', tenantId, 'outlets', out.outletId);
      await updateDoc(docRef, {
        isDeleted: true,
        active: false,
        isActive: false, // Compatibility
        deletedAt: Timestamp.now(),
        deletedBy: currentUserId,
        updatedAt: Timestamp.now()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `tenants/${tenantId}/outlets/${out.outletId}`);
    }
  };

  const handleToggleOutletActive = async (out: Outlet) => {
    if (!tenantId) return;

    try {
      const docRef = doc(db, 'tenants', tenantId, 'outlets', out.outletId);
      await updateDoc(docRef, {
        active: !out.active,
        isActive: !out.active, // Compatibility
        updatedAt: Timestamp.now()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `tenants/${tenantId}/outlets/${out.outletId}`);
    }
  };

  // ----------------------------------------------------
  // FILTERING LOGIC
  // ----------------------------------------------------
  const filteredServices = useMemo(() => {
    return activeServicesList.filter(s => {
      const matchSearch = s.name.toLowerCase().includes(serviceSearch.trim().toLowerCase()) ||
                          (s.description || '').toLowerCase().includes(serviceSearch.trim().toLowerCase());
      const matchCategory = serviceCategoryFilter === 'all' || s.category === serviceCategoryFilter;
      const matchOutlet = serviceOutletFilter === 'all' || (s.outletIds || []).includes(serviceOutletFilter);

      return matchSearch && matchCategory && matchOutlet;
    });
  }, [activeServicesList, serviceSearch, serviceCategoryFilter, serviceOutletFilter]);

  const filteredOutlets = useMemo(() => {
    return activeOutletsList.filter(o => {
      const matchSearch = o.name.toLowerCase().includes(outletSearch.trim().toLowerCase()) ||
                          o.code.toLowerCase().includes(outletSearch.trim().toLowerCase()) ||
                          o.address.toLowerCase().includes(outletSearch.trim().toLowerCase());
      return matchSearch;
    });
  }, [activeOutletsList, outletSearch]);

  const toggleOutletSelectionInForm = (oid: string) => {
    setSvcFormOutletIds(prev => 
      prev.includes(oid) ? prev.filter(x => x !== oid) : [...prev, oid]
    );
  };

  return (
    <div className="space-y-6 font-sans text-slate-800 animate-fade-in select-none">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Sliders className="w-5 h-5 text-blue-600" />
            MASTER CONFIGURATION CENTER
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Monitor tarif jasa katalog laundry &amp; profil administrasi operasional seluruh outlet cabang enterprise.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => setActiveTab('services')}
            className={`px-4 py-2 text-xs font-extrabold tracking-wider rounded-lg border transition duration-150 ${activeTab === 'services' ? 'bg-slate-900 border-slate-900 text-white shadow-xs' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            📋 KATALOG TARIF
          </button>
          <button 
            onClick={() => setActiveTab('outlets')}
            className={`px-4 py-2 text-xs font-extrabold tracking-wider rounded-lg border transition duration-150 ${activeTab === 'outlets' ? 'bg-slate-900 border-slate-900 text-white shadow-xs' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            🏢 CABANG OUTLET
          </button>
        </div>
      </div>

      {loadingTenant && (
        <div className="p-12 text-center text-slate-400 bg-white rounded-xl border border-slate-100 shadow-sm flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mt-1">Sinkronisasi Basis Data Tenant Real-time...</p>
        </div>
      )}

      {/* Role Scoping Notice Alert Block */}
      {!loadingTenant && (
        <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl text-slate-600 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-600" />
            <div>
              <span className="font-extrabold text-blue-700">RBAC Role Enforcement:</span>{' '}
              <span className="font-medium text-[11px]">
                Masuk sebagai <strong className="uppercase">{currentRole}</strong>.{' '}
                {currentRole === 'owner' && 'Akses Penuh master data catalog & registrasi outlet.'}
                {currentRole === 'admin' && 'Akses Penuh services, namun perubahan outlets dibatasi edit saja (bukan hapus/tambah).'}
                {['kasir', 'pegawai'].includes(currentRole) && 'Akses Terbatas: Hanya diizinkan melihat daftar menu tarif.'}
              </span>
            </div>
          </div>
          <span className="px-1.5 py-0.5 rounded bg-blue-105 border border-blue-200 text-blue-700 text-[10px] font-black uppercase">
            {currentRole}
          </span>
        </div>
      )}

      {/* TAB 1: SERVICES MANAGEMENT SCREEN */}
      {!loadingTenant && activeTab === 'services' && (
        <div className="space-y-4">
          
          {/* Tool actions toolbar: search queries, category fitments, active drawer triggers */}
          <div className="bg-white p-4 rounded-xl border border-slate-250 flex flex-col lg:flex-row items-center justify-between gap-4 shadow-3xs">
            
            <div className="w-full flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari tarif layanan..."
                  value={serviceSearch}
                  onChange={(e) => setServiceSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <select
                value={serviceCategoryFilter}
                onChange={(e) => setServiceCategoryFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
              >
                <option value="all">Semua Kategori</option>
                <option value="kiloan">Kiloan</option>
                <option value="satuan">Satuan</option>
                <option value="express">Express</option>
                <option value="vip">VIP</option>
                <option value="dry_clean">Dry Cleaning</option>
                <option value="other">Lainnya (Other)</option>
              </select>

              <select
                value={serviceOutletFilter}
                onChange={(e) => setServiceOutletFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
              >
                <option value="all">Semua Cabang</option>
                {activeOutletsList.map(o => (
                  <option key={o.outletId} value={o.outletId}>{o.name}</option>
                ))}
              </select>
            </div>

            {canModifyCatalog && (
              <button
                onClick={() => openServiceModal(null)}
                className="w-full lg:w-auto flex items-center justify-center gap-1 px-4 py-2 bg-blue-600 text-white text-xs font-black rounded-lg hover:bg-blue-700 tracking-wider transition-all select-none whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                TAMBAH TARIF BARU
              </button>
            )}
          </div>

          {/* Jasa table directory lists */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            {filteredServices.length === 0 ? (
              <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
                <FileText className="w-10 h-10 text-slate-250 stroke-1" />
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Katalog Jasa Kosong</p>
                <p className="text-[11px] text-slate-405 max-w-sm mt-0.5 leading-relaxed">
                  Belum ada tarif terdaftar atau coba sesuaikan query filter pencarian Anda. Klik tombol Tambah Tarif Baru untuk menambahkan katalog laundry baru.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse text-slate-600">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200/80 font-bold text-slate-500 uppercase tracking-wider text-[10px] select-none">
                      <th className="p-4">Menu Jasa / Deskripsi</th>
                      <th className="p-4">Kategori / Unit</th>
                      <th className="p-4">Estimasi SLA</th>
                      <th className="p-4 text-center">Tipe Express</th>
                      <th className="p-4">Penempatan Cabang</th>
                      <th className="p-4 text-right">Biaya / Harga</th>
                      <th className="p-4 text-center">Status</th>
                      {canModifyCatalog && <th className="p-4 text-right">Aksi</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredServices.map(svc => (
                      <tr key={svc.serviceId} className="hover:bg-slate-50/40 transition duration-150">
                        <td className="p-4">
                          <p className="font-extrabold text-slate-800 text-xs">{svc.name}</p>
                          {svc.description && (
                            <p className="text-slate-400 text-[10px] truncate max-w-xs font-medium mt-0.5">
                              {svc.description}
                            </p>
                          )}
                          <p className="text-[8.5px] text-slate-400 font-mono mt-0.5">ID: {svc.serviceId}</p>
                        </td>
                        <td className="p-4">
                          <span className="px-1.5 py-0.5 rounded text-[9.5px] font-extrabold uppercase bg-slate-100 text-slate-600 border border-slate-200">
                            {svc.category}
                          </span>
                          <span className="ml-1.5 text-slate-400 font-bold">/ {svc.unit}</span>
                        </td>
                        <td className="p-4">
                          <span className="font-bold text-slate-700 font-mono flex items-center gap-1 text-[11px]">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            {svc.estimatedDurationHours} Jam
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          {svc.isExpress ? (
                            <span className="px-1.5 py-0.2 rounded-full font-black text-[8.5px] uppercase text-amber-600 bg-amber-50 border border-amber-200 animate-pulse">
                              ⚡ yes
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[10px] font-bold">—</span>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="flex flex-wrap gap-1 max-w-[170px]">
                            {(svc.outletIds || []).map(oid => {
                              const oName = activeOutletsList.find(x => x.outletId === oid)?.name || 'Cabang Unknown';
                              return (
                                <span key={oid} className="px-1 border border-blue-100 bg-blue-50/30 text-blue-700 text-[8.5px] font-extrabold rounded">
                                  {oName}
                                </span>
                              );
                            })}
                          </div>
                        </td>
                        <td className="p-4 text-right font-bold text-slate-800 font-mono text-xs">
                          {formatRupiah(svc.price)}
                        </td>
                        <td className="p-4 text-center">
                          <button
                            disabled={!canModifyCatalog}
                            onClick={() => handleToggleServiceActive(svc)}
                            className="bg-none border-none focus:outline-none shrink-0"
                          >
                            {svc.active ? (
                              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase text-emerald-700 bg-emerald-50 border border-emerald-200">
                                <Check className="w-2.5 h-2.5" /> aktif
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase text-slate-400 bg-slate-55 border border-slate-200">
                                nonaktif
                              </span>
                            )}
                          </button>
                        </td>
                        {canModifyCatalog && (
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => openServiceModal(svc)}
                                title="Edit Layanan"
                                className="p-1 px-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-600 font-black rounded text-[10px]"
                              >
                                EDIT
                              </button>
                              <button
                                onClick={() => handleDeleteService(svc)}
                                title="Hapus Jasa (Soft Delete)"
                                className="p-1 px-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 font-black rounded text-[10px]"
                              >
                                DELETE
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: OUTLETS MANAGEMENT SCREEN */}
      {!loadingTenant && activeTab === 'outlets' && (
        <div className="space-y-4">

          {/* Outlets action toolbar: search, create new branch */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col lg:flex-row items-center justify-between gap-4 shadow-3xs">
            <div className="relative w-full lg:max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari nama, sandi kode, atau alamat cabang..."
                value={outletSearch}
                onChange={(e) => setOutletSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
              />
            </div>

            {isOwner && (
              <button
                onClick={() => openOutletModal(null)}
                className="w-full lg:w-auto flex items-center justify-center gap-1 px-4 py-2 bg-blue-600 text-white text-xs font-black rounded-lg hover:bg-blue-700 tracking-wider transition-all select-none whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                REGISTRASI CABANG BARU
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredOutlets.length === 0 ? (
              <div className="col-span-full p-12 bg-white rounded-xl border border-slate-200 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
                <Building className="w-10 h-10 text-slate-250 stroke-1" />
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Daftar Cabang Kosong</p>
                <p className="text-[11px] text-slate-405 max-w-sm mt-0.5 leading-relaxed">
                  Belum ada profil cabang terdaftar di bawah paying tenant enterprise Anda.
                </p>
              </div>
            ) : (
              filteredOutlets.map(out => (
                <div key={out.outletId} className="bg-white rounded-xl border border-slate-205 py-4 px-5 space-y-4 shadow-3xs flex flex-col justify-between hover:border-blue-300 transition duration-150">
                  
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        {out.isMainOutlet && (
                          <span className="px-1.5 py-0.2 rounded bg-amber-50 text-amber-600 border border-amber-200 uppercase font-black text-[8.5px] tracking-wide mb-1 inline-block">
                            ⭐ Cabang Utama
                          </span>
                        )}
                        <h4 className="font-extrabold text-slate-800 text-xs sm:text-sm">{out.name}</h4>
                        <p className="text-[9px] text-slate-400 font-mono font-bold">Cabang Code: {out.code}</p>
                      </div>

                      <button
                        onClick={() => handleToggleOutletActive(out)}
                        className="bg-none border-none focus:outline-none"
                      >
                        {out.active ? (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase text-emerald-700 bg-emerald-50 border border-emerald-200">
                            Aktif
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase text-slate-400 bg-slate-55 border border-slate-200">
                            Tutup
                          </span>
                        )}
                      </button>
                    </div>

                    <div className="text-[11px] text-slate-505 font-medium space-y-1 bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <p className="line-clamp-2"><span className="font-bold text-slate-600">Alamat:</span> {out.address}</p>
                      {out.phone && <p><span className="font-bold text-slate-600">WA Kontak:</span> {out.phone}</p>}
                      {out.managerName && <p><span className="font-bold text-slate-600">PIC Manager:</span> {out.managerName}</p>}
                    </div>

                    {/* Hardware integration printer ledger specs */}
                    <div className="text-[10px] text-slate-400 font-bold space-y-1">
                      <p className="flex items-center gap-1">
                        <Printer className="w-3.5 h-3.5 text-slate-400" />
                        Printer: <span className="font-mono font-normal text-slate-500">{out.printerName || 'Draft generic thermal printer'}</span>
                      </p>
                      <p className="flex items-start gap-1">
                        <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                        Footer: <span className="font-normal italic text-slate-500 line-clamp-1">"{out.receiptFooter || 'No footer configured'}"</span>
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[9px] text-slate-400 font-mono">ID: {out.outletId}</span>
                    
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => openOutletModal(out)}
                        className="p-1 px-2 border border-blue-200 hover:bg-blue-50 text-blue-600 font-extrabold text-[10px] rounded"
                      >
                        UPDATE
                      </button>
                      
                      {isOwner && !out.isMainOutlet && (
                        <button
                          onClick={() => handleDeleteOutlet(out)}
                          className="p-1 px-2 border border-rose-200 hover:bg-rose-50 text-rose-600 font-extrabold text-[10px] rounded"
                        >
                          DELETE
                        </button>
                      )}
                    </div>
                  </div>

                </div>
              ))
            )}
          </div>

        </div>
      )}

      {/* ----------------------------------------------------
          MODAL DRAWER: SERVICES KATALOG EDITOR
         ---------------------------------------------------- */}
      {serviceModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-zoomIn max-h-[92vh] flex flex-col">
            
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-blue-400" />
                  {selectedService ? 'UBAH DATA LAYANAN TARIF' : 'TAMBAH KATALOG JASA BARU'}
                </h3>
                <p className="text-[9px] text-slate-400 font-mono mt-0.5">
                  {selectedService ? `Service ID: ${selectedService.serviceId}` : 'Konfigurasi jasa menu laundry'}
                </p>
              </div>
              <button 
                onClick={() => setServiceModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveService} className="overflow-y-auto flex-1 p-5 space-y-4">
              {errorText && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {errorText}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Nama Menu Jasa *</label>
                <input
                  required
                  type="text"
                  placeholder="Contoh: Kiloan Cuci Setrika Regular"
                  value={svcFormName}
                  onChange={(e) => setSvcFormName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Kategori *</label>
                  <select
                    value={svcFormCategory}
                    onChange={(e) => setSvcFormCategory(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                  >
                    <option value="kiloan">Kiloan</option>
                    <option value="satuan">Satuan</option>
                    <option value="express">Express</option>
                    <option value="vip">VIP</option>
                    <option value="dry_clean">Dry Clean</option>
                    <option value="other">Lainnya (Other)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Unit Takaran *</label>
                  <select
                    value={svcFormUnit}
                    onChange={(e) => setSvcFormUnit(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                  >
                    <option value="kg">kg (Kiloan)</option>
                    <option value="pcs">pcs (Potongan)</option>
                    <option value="item">item (Pcs/Karpet/Sepatu)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Tarif Harga (Rp) *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs select-none">Rp</span>
                    <input
                      required
                      type="number"
                      placeholder="0"
                      min={0}
                      value={svcFormPrice || ''}
                      onChange={(e) => setSvcFormPrice(Number(e.target.value))}
                      className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Estimasi Durasi (Jam) *</label>
                  <input
                    required
                    type="number"
                    placeholder="24"
                    min={1}
                    value={svcFormEstHours}
                    onChange={(e) => setSvcFormEstHours(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 py-0.5 select-none hover:text-slate-900 cursor-pointer">
                <input
                  type="checkbox"
                  id="svcFormIsExpress"
                  checked={svcFormIsExpress}
                  onChange={(e) => setSvcFormIsExpress(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 border-slate-300 w-4 h-4 cursor-pointer"
                />
                <label htmlFor="svcFormIsExpress" className="text-[10.5px] font-bold text-slate-600 cursor-pointer select-none">
                  Layanan Prioritas Kilat / Express (⚡ Fast SLA)
                </label>
              </div>

              {/* Assignment allocation branches */}
              <div className="space-y-1.5 p-3.5 bg-slate-50 border border-slate-150 rounded-lg">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Ditempatkan di Cabang Outlet *</label>
                <div className="space-y-1.5 mt-1 max-h-32 overflow-y-auto">
                  {activeOutletsList.map(o => {
                    const checked = svcFormOutletIds.includes(o.outletId);
                    return (
                      <div 
                        key={o.outletId} 
                        onClick={() => toggleOutletSelectionInForm(o.outletId)}
                        className="flex items-center justify-between p-2 rounded border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer transition select-none"
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${checked ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300'}`}>
                            {checked && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                          <div>
                            <p className="text-[11px] font-bold text-slate-700 leading-none">{o.name}</p>
                            <p className="text-[9px] text-slate-400 font-mono mt-0.5">{o.code}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-1">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Keterangan Tambahan (Optional)</label>
                <textarea
                  placeholder="Contoh: Sangat disarankan untuk pakaian katun harian saja."
                  rows={2}
                  value={svcFormDesc}
                  onChange={(e) => setSvcFormDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white resize-none"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSvcFormActive(!svcFormActive)}
                    className="bg-none border-none focus:outline-none shrink-0"
                  >
                    {svcFormActive ? (
                      <ToggleRight className="w-10 h-6 text-blue-600 fill-blue-100 cursor-pointer" />
                    ) : (
                      <ToggleLeft className="w-10 h-6 text-slate-400 cursor-pointer" />
                    )}
                  </button>
                  <div>
                    <p className="text-[10px] font-bold text-slate-700 leading-none">Status Aktif Jasa</p>
                    <p className="text-[9px] text-slate-400 leading-normal mt-0.5">Apakah layanan langsung aktif di kasir.</p>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setServiceModalOpen(false)}
                  className="px-4 py-2 text-xs border border-slate-200 hover:bg-slate-50 font-bold text-slate-600 rounded-lg uppercase tracking-wider"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold rounded-lg uppercase tracking-wider flex items-center gap-2 disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle className="w-3.5 h-3.5" />
                  )}
                  SIMPAN KATALOG
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------
          MODAL DRAWER: OUTLET REGISTRATION EDITOR
         ---------------------------------------------------- */}
      {outletModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-zoomIn max-h-[92vh] flex flex-col">
            
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-1.5">
                  <Building className="w-4 h-4 text-blue-400" />
                  {selectedOutlet ? 'PENGATURAN OUTLET CABANG' : 'REGISTRASI CABANG BARU'}
                </h3>
                <p className="text-[9px] text-slate-400 font-mono mt-0.5">
                  {selectedOutlet ? `Outlet ID: ${selectedOutlet.outletId}` : 'Tambah gerai laundry fisik baru'}
                </p>
              </div>
              <button 
                onClick={() => setOutletModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveOutlet} className="overflow-y-auto flex-1 p-5 space-y-4">
              {errorText && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {errorText}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Kode Cabang/Sandi *</label>
                  <input
                    required
                    type="text"
                    disabled={!!selectedOutlet} // Prevent code modifications on production branches
                    placeholder="Contoh: CG-01"
                    value={outFormCode}
                    onChange={(e) => setOutFormCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white disabled:opacity-60"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Nama Outlet Cabang *</label>
                  <input
                    required
                    type="text"
                    placeholder="Contoh: LaundryKu Kelapa Gading"
                    value={outFormName}
                    onChange={(e) => setOutFormName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Alamat Fisik Lengkap *</label>
                <input
                  required
                  type="text"
                  placeholder="Sebutkan jalan, nomor, kecamatan, RT/RW lengkap"
                  value={outFormAddress}
                  onChange={(e) => setOutFormAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">No WhatsApp Khusus Cabang</label>
                  <input
                    type="tel"
                    placeholder="Contoh: 0812xxxxxxxx"
                    value={outFormPhone}
                    onChange={(e) => setOutFormPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Nama PIC/Manager Cabang</label>
                  <input
                    type="text"
                    placeholder="Contoh: Budi Santoso"
                    value={outFormManager}
                    onChange={(e) => setOutFormManager(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-150 rounded-lg space-y-3">
                <span className="font-extrabold text-[9.5px] text-slate-505 block tracking-wide uppercase">🧾 INTEGRASI HARDWARE STRIP / NOTA</span>
                
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Sandi Thermal Printer Cabang</label>
                  <input
                    type="text"
                    placeholder="Contoh: PriaThermal-58mm (Chrome raw printing)"
                    value={outFormPrinter}
                    onChange={(e) => setOutFormPrinter(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-705 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Receipt Footer Terliput</label>
                  <textarea
                    placeholder="Kata mutiara / info follow up sosial media outlet..."
                    rows={2}
                    value={outFormFooter}
                    onChange={(e) => setOutFormFooter(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-705 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 py-0.5 select-none hover:text-slate-900 cursor-pointer">
                <input
                  type="checkbox"
                  id="outFormIsMain"
                  checked={outFormIsMain}
                  onChange={(e) => setOutFormIsMain(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 border-slate-300 w-4 h-4 cursor-pointer"
                />
                <label htmlFor="outFormIsMain" className="text-[10.5px] font-bold text-slate-600 cursor-pointer select-none">
                  Atur sebagai Cabang Utama (Main Branch)
                </label>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setOutFormActive(!outFormActive)}
                    className="bg-none border-none focus:outline-none shrink-0"
                  >
                    {outFormActive ? (
                      <ToggleRight className="w-10 h-6 text-blue-600 fill-blue-100 cursor-pointer" />
                    ) : (
                      <ToggleLeft className="w-10 h-6 text-slate-400 cursor-pointer" />
                    )}
                  </button>
                  <div>
                    <p className="text-[10px] font-bold text-slate-700 leading-none">Status Aktif Cabang</p>
                    <p className="text-[9px] text-slate-400 leading-normal mt-0.5 font-medium">Bila nonaktif, kasir tidak dapat berpindah ke gerai ini.</p>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setOutletModalOpen(false)}
                  className="px-4 py-2 text-xs border border-slate-200 hover:bg-slate-50 font-bold text-slate-600 rounded-lg uppercase tracking-wider"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold rounded-lg uppercase tracking-wider flex items-center gap-2 disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle className="w-3.5 h-3.5" />
                  )}
                  REGISTRASI CABANG
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
export default ServicesPage;

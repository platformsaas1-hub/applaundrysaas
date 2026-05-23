import React, { useState } from 'react';
import { LaundryService, Customer, TransactionItem, Transaction, Outlet, UserRole } from '../types';
import { formatRupiah } from '../utils/formatting';
import { Plus, Minus, Search, UserPlus, ShoppingBag, Percent, AlertCircle } from 'lucide-react';

interface POSViewProps {
  services: LaundryService[];
  customers: Customer[];
  outlets: Outlet[];
  currentRole: UserRole;
  activeOutletId: string;
  onAddCustomer: (cust: Omit<Customer, 'customerId' | 'createdAt'>) => string; // returns generated customerId
  onAddTransaction: (transaction: Omit<Transaction, 'transactionId' | 'receivedAt'>) => void;
  trackAction: (reads: number, writes: number, savedReads?: number) => void;
}

export const POSView: React.FC<POSViewProps> = ({
  services,
  customers,
  outlets,
  currentRole,
  activeOutletId,
  onAddCustomer,
  onAddTransaction,
  trackAction
}) => {
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [searchCustomerQuery, setSearchCustomerQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'kiloan' | 'satuan' | 'sepatu' | 'karpet'>('kiloan');
  
  // Custom customer creation form state
  const [showAddCustomerModal, setShowAddCustomerModal] = useState<boolean>(false);
  const [newCustName, setNewCustName] = useState<string>('');
  const [newCustPhone, setNewCustPhone] = useState<string>('');
  const [newCustAddress, setNewCustAddress] = useState<string>('');
  const [newCustNotes, setNewCustNotes] = useState<string>('');

  // Cart / Items chosen
  const [cart, setCart] = useState<TransactionItem[]>([]);
  const [weightInput, setWeightInput] = useState<number>(3.0); // For kiloan
  const [discount, setDiscount] = useState<number>(0);
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'unpaid'>('paid');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'qris' | 'transfer'>('cash');
  const [orderNotes, setOrderNotes] = useState<string>('');
  const [selectedOutlet, setSelectedOutlet] = useState<string>(activeOutletId || outlets[0]?.outletId || '');

  // Filter customers by search
  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchCustomerQuery.toLowerCase()) ||
    c.phone.includes(searchCustomerQuery)
  );

  const activeCustomerObj = customers.find(c => c.customerId === selectedCustomerId);

  // Filter services by active tab
  const filteredServices = services.filter(s => s.type === activeTab && s.isActive);

  const handleAddToCart = (service: LaundryService) => {
    trackAction(1, 0); // Simulated single read of service profile
    const existingIndex = cart.findIndex(item => item.serviceId === service.serviceId);
    if (existingIndex >= 0) {
      const updated = [...cart];
      updated[existingIndex].qty += 1;
      updated[existingIndex].totalPrice = updated[existingIndex].qty * updated[existingIndex].pricePerUnit;
      setCart(updated);
    } else {
      const quantity = service.type === 'kiloan' ? weightInput : 1;
      setCart([...cart, {
        serviceId: service.serviceId,
        name: service.name,
        qty: quantity,
        pricePerUnit: service.pricePerUnit,
        totalPrice: quantity * service.pricePerUnit
      }]);
    }
  };

  const handleUpdateQty = (serviceId: string, delta: number) => {
    const existingIndex = cart.findIndex(item => item.serviceId === serviceId);
    if (existingIndex < 0) return;
    
    const updated = [...cart];
    const item = updated[existingIndex];
    const serviceOrigin = services.find(s => s.serviceId === serviceId);
    
    if (serviceOrigin?.type === 'kiloan') {
      const newWeight = Math.max(0.1, parseFloat((item.qty + delta).toFixed(1)));
      item.qty = newWeight;
    } else {
      item.qty = Math.max(1, item.qty + delta);
    }
    
    item.totalPrice = item.qty * item.pricePerUnit;
    setCart(updated);
  };

  const handleRemoveFromCart = (serviceId: string) => {
    setCart(cart.filter(item => item.serviceId !== serviceId));
  };

  const handleQuickAddCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim() || !newCustPhone.trim()) return;

    const generatedId = onAddCustomer({
      name: newCustName,
      phone: newCustPhone,
      address: newCustAddress || undefined,
      notes: newCustNotes || undefined
    });

    setSelectedCustomerId(generatedId);
    setShowAddCustomerModal(false);
    // Reset fields
    setNewCustName('');
    setNewCustPhone('');
    setNewCustAddress('');
    setNewCustNotes('');
  };

  const cartSubtotal = cart.reduce((acc, curr) => acc + curr.totalPrice, 0);
  const cartTotal = Math.max(0, cartSubtotal - discount);

  const handleCreateOrder = () => {
    if (!selectedCustomerId) {
      alert('Mohon pilih pelanggan terlebih dahulu!');
      return;
    }
    if (cart.length === 0) {
      alert('Keranjang belanja masih kosong! Silakan pilih layanan laundry.');
      return;
    }

    const customer = customers.find(c => c.customerId === selectedCustomerId)!;
    
    // Add transaction list
    onAddTransaction({
      outletId: selectedOutlet,
      customerId: customer.customerId,
      customerName: customer.name,
      customerPhone: customer.phone,
      items: cart,
      totalAmount: cartTotal,
      discountAmount: discount,
      paymentStatus: paymentStatus,
      paymentMethod: paymentStatus === 'paid' ? paymentMethod : 'none',
      orderStatus: 'received',
      weight: cart.find(i => services.find(s => s.serviceId === i.serviceId)?.type === 'kiloan')?.qty || undefined,
      workerId: 'worker_kasir_curr',
      workerName: 'Kasir Aktif',
      notes: orderNotes || undefined
    });

    // Reset Form
    setCart([]);
    setDiscount(0);
    setOrderNotes('');
    setSelectedCustomerId('');
    setSearchCustomerQuery('');
  };

  // Role Protection check from Rules mapping
  if (currentRole === 'pegawai') {
    return (
      <div className="p-8 h-full flex flex-col justify-center items-center bg-slate-50 text-center">
        <div className="p-4 bg-amber-50 rounded-full text-amber-600 mb-4 border border-amber-200">
          <AlertCircle className="w-12 h-12" />
        </div>
        <h3 className="text-lg font-bold text-slate-800">Akses Ditolak oleh ABAC Rules</h3>
        <p className="text-slate-500 text-sm max-w-sm mt-1">
          Berdasarkan rancangan keamanan multi-tenant, akun dengan Role <strong>Pegawai (Cuci)</strong> dilarang mengakses kasir POS, memanipulasi item belanja, atau kas pembayaran.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex overflow-hidden h-full bg-slate-50">
      {/* Left Column - Choose customer and configurations */}
      <div className="w-80 border-r border-slate-200 bg-white flex flex-col overflow-hidden shrink-0">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
          <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide">Konfigurasi Nota</h3>
          <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.5 rounded">SaaS POS</span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Outlet Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Pilih Cabang Outlet</label>
            <select
              value={selectedOutlet}
              onChange={(e) => setSelectedOutlet(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-200 p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              {outlets.map(out => (
                <option key={out.outletId} value={out.outletId}>{out.name}</option>
              ))}
            </select>
          </div>

          {/* Customer Selection Area */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Cari Pelanggan</label>
              <button
                type="button"
                onClick={() => setShowAddCustomerModal(true)}
                className="text-xs text-blue-600 flex items-center gap-1 hover:underline font-bold"
              >
                <UserPlus className="w-3.5 h-3.5" /> + Baru
              </button>
            </div>

            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Cari nama atau no. HP..."
                value={searchCustomerQuery}
                onChange={(e) => setSearchCustomerQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Customer List Dropdown Container */}
            {searchCustomerQuery && (
              <div className="border border-slate-150 rounded-lg max-h-40 overflow-y-auto divide-y divide-slate-100 shadow-sm bg-white">
                {filteredCustomers.length === 0 ? (
                  <div className="p-3 text-xs text-slate-400 text-center">Pelanggan tidak ditemukan.</div>
                ) : (
                  filteredCustomers.map(cust => (
                    <button
                      key={cust.customerId}
                      type="button"
                      onClick={() => {
                        setSelectedCustomerId(cust.customerId);
                        setSearchCustomerQuery('');
                        trackAction(1, 0); // Simulated read client profile database
                      }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex justify-between items-center"
                    >
                      <div>
                        <p className="font-bold text-slate-700">{cust.name}</p>
                        <p className="text-slate-400 font-mono text-[10px]">{cust.phone}</p>
                      </div>
                      <span className="text-[9px] text-blue-500 bg-blue-50 font-semibold px-1 rounded">Pilih</span>
                    </button>
                  ))
                )}
              </div>
            )}

            {/* Currently Selected Customer Display Card */}
            {activeCustomerObj ? (
              <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-lg flex justify-between items-start">
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-800">{activeCustomerObj.name}</p>
                  <p className="text-[10px] font-mono text-slate-500">{activeCustomerObj.phone}</p>
                  {activeCustomerObj.address && (
                    <p className="text-[10px] text-slate-400 leading-relaxed italic">{activeCustomerObj.address}</p>
                  )}
                  {activeCustomerObj.notes && (
                    <p className="text-[9px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 inline-block">
                      📝 {activeCustomerObj.notes}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setSelectedCustomerId('')}
                  className="text-xs text-rose-500 font-bold hover:underline"
                >
                  Batal
                </button>
              </div>
            ) : (
              <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-400 text-center border-2 border-dashed border-slate-200">
                Pencarian Local Caching: Belum ada customer terpilih.
              </div>
            )}
          </div>

          {/* Order Setting Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Instruksi Khusus POS</label>
            <textarea
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
              placeholder="Contoh: Pisahkan kain putih, minta wangi sakura..."
              className="w-full text-xs rounded-lg border border-slate-200 p-2 h-16 resize-none focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Weight Input (Default for Kiloan Services) */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Berat Timbangan Default (kg)</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setWeightInput(prev => Math.max(0.1, parseFloat((prev - 0.5).toFixed(1))))}
                className="p-1.5 bg-slate-100 rounded-md hover:bg-slate-200"
              >
                <Minus className="w-3.5 h-3.5 text-slate-600" />
              </button>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={weightInput}
                onChange={(e) => setWeightInput(parseFloat(parseFloat(e.target.value).toFixed(1)) || 1)}
                className="w-full text-center text-sm font-bold font-mono border border-slate-200 rounded p-1"
              />
              <button
                type="button"
                onClick={() => setWeightInput(prev => parseFloat((prev + 0.5).toFixed(1)))}
                className="p-1.5 bg-slate-100 rounded-md hover:bg-slate-200"
              >
                <Plus className="w-3.5 h-3.5 text-slate-600" />
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-1 italic">
              *Timbangan kiloan diinput sebelum mendaftarkan item kiloan ke keranjang.
            </p>
          </div>
        </div>
      </div>

      {/* Center Dynamic Column - Layanan Selector */}
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
        {/* Service Type Tabs */}
        <div className="bg-white border-b border-slate-200 p-2 shrink-0 flex items-center justify-between">
          <div className="flex gap-1">
            {(['kiloan', 'satuan', 'sepatu', 'karpet'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-xs font-bold uppercase rounded-lg transition-all ${
                  activeTab === tab
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <span className="text-xs text-slate-400 font-mono pr-2">Local Price Rules</span>
        </div>

        {/* Services Items Grid */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="grid grid-cols-2 gap-4">
            {filteredServices.map(svc => (
              <button
                key={svc.serviceId}
                onClick={() => handleAddToCart(svc)}
                className="bg-white p-4 rounded-xl border border-slate-200 text-left hover:border-blue-500 hover:shadow transition-all group flex flex-col justify-between h-28"
              >
                <div>
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] bg-slate-100 text-slate-600 font-bold uppercase tracking-wider px-1.5 py-0.5 rounded">
                      {svc.type === 'kiloan' ? `${weightInput}kg x` : svc.unit}
                    </span>
                    <span className="text-blue-500 group-hover:text-blue-600 font-bold text-xs">+ Tambah</span>
                  </div>
                  <h4 className="font-bold text-slate-800 text-sm mt-2 line-clamp-1 group-hover:text-blue-700">{svc.name}</h4>
                </div>
                <div className="flex justify-between items-baseline mt-2">
                  <span className="text-xs text-slate-400">Estimasi: {svc.estimatedDays} Hari</span>
                  <span className="font-extrabold text-slate-700 text-sm">
                    {formatRupiah(svc.pricePerUnit)}<span className="text-[10px] text-slate-400 font-normal">/{svc.unit}</span>
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right Column - Billing Cart and Receipt Draft */}
      <div className="w-80 border-l border-slate-200 bg-white flex flex-col overflow-hidden shrink-0">
        <div className="p-4 border-b border-slate-100 bg-slate-50 pr-4 flex items-center gap-2 text-slate-800 font-bold shrink-0">
          <ShoppingBag className="w-4 h-4 text-blue-600" />
          <h3 className="text-sm uppercase tracking-wide">Ringkasan Keranjang</h3>
          <span className="ml-auto text-xs font-mono font-bold bg-slate-200 text-slate-600 px-2 py-0.5 rounded">
            {cart.length} Item
          </span>
        </div>

        {/* Cart Item Cards list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 divide-y divide-slate-50">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col justify-center items-center text-slate-400 text-center space-y-2 py-12">
              <ShoppingBag className="w-10 h-10 text-slate-200" />
              <p className="text-xs font-semibold">Keranjang Kosong</p>
              <p className="text-[10px] text-slate-400 px-4">Pilih jenis layanan di bagian tengah lantas tentukan timbangan kiloan.</p>
            </div>
          ) : (
            cart.map((item, index) => (
              <div key={item.serviceId} className={`pt-3 ${index === 0 ? 'pt-0' : ''} flex flex-col gap-2 font-sans`}>
                <div className="flex justify-between">
                  <h5 className="text-xs font-bold text-slate-700 block max-w-[180px] truncate">{item.name}</h5>
                  <button 
                    onClick={() => handleRemoveFromCart(item.serviceId)}
                    className="text-[10px] text-rose-500 font-bold hover:underline ml-1"
                  >
                    Hapus
                  </button>
                </div>
                
                <div className="flex justify-between items-center bg-slate-50 p-1.5 rounded border border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleUpdateQty(item.serviceId, -1)}
                      className="p-1 bg-white border border-slate-200 rounded-md hover:bg-slate-100 transition-colors"
                      title="Kurangi"
                    >
                      <Minus className="w-2.5 h-2.5" />
                    </button>
                    <span className="font-mono text-xs font-bold px-1">{item.qty}</span>
                    <button
                      type="button"
                      onClick={() => handleUpdateQty(item.serviceId, 1)}
                      className="p-1 bg-white border border-slate-200 rounded-md hover:bg-slate-100 transition-colors"
                      title="Tambah"
                    >
                      <Plus className="w-2.5 h-2.5" />
                    </button>
                  </div>
                  <span className="text-xs font-extrabold text-slate-800">{formatRupiah(item.totalPrice)}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Applied concession / discount */}
        {cart.length > 0 && (
          <div className="p-4 border-t border-slate-100 bg-slate-50 shrink-0 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1">
                <Percent className="w-3 h-3 text-emerald-600" /> Potongan Manual (Diskon)
              </label>
              <input
                type="number"
                min="0"
                step="5000"
                value={discount}
                onChange={(e) => setDiscount(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-28 text-right text-xs font-bold font-mono border border-slate-200 rounded p-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Payment Parameters togglers */}
            <div className="space-y-2 pt-2 border-t border-slate-150">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Metode Pembayaran</span>
              
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setPaymentStatus('paid')}
                  className={`py-1 text-xs font-bold rounded-md border transition-all ${
                    paymentStatus === 'paid'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                      : 'border-slate-200 text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  LUNAS
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPaymentStatus('unpaid');
                  }}
                  className={`py-1 text-xs font-bold rounded-md border transition-all ${
                    paymentStatus === 'unpaid'
                      ? 'bg-amber-50 text-amber-700 border-amber-300'
                      : 'border-slate-200 text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  BELUM LUNAS
                </button>
              </div>

              {paymentStatus === 'paid' && (
                <div className="grid grid-cols-3 gap-1 pt-1.5">
                  {(['cash', 'qris', 'transfer'] as const).map(met => (
                    <button
                      key={met}
                      type="button"
                      onClick={() => setPaymentMethod(met)}
                      className={`py-1 text-[10px] font-medium rounded border uppercase ${
                        paymentMethod === met
                          ? 'bg-blue-50 text-blue-700 border-blue-300'
                          : 'border-slate-200 text-slate-400 hover:bg-slate-50'
                      }`}
                    >
                      {met}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Invoicing calculations */}
            <div className="pt-3 border-t border-slate-200 space-y-1.5 font-sans">
              <div className="flex justify-between text-xs text-slate-500 font-medium">
                <span>Subtotal</span>
                <span>{formatRupiah(cartSubtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-xs text-rose-500 font-medium">
                  <span>Diskon Potongan</span>
                  <span>-{formatRupiah(discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-base text-slate-800 font-extrabold pt-1">
                <span>Total Tagihan</span>
                <span className="text-xl text-blue-600 font-mono">{formatRupiah(cartTotal)}</span>
              </div>
            </div>

            {/* Final checkout button */}
            <button
              onClick={handleCreateOrder}
              className="w-full mt-3 py-3 bg-blue-600 text-white rounded-lg text-sm font-bold shadow-sm hover:bg-blue-700 active:translate-y-[0.5px] transition-all"
            >
              Buat Transaksi & Kirim Nota
            </button>
          </div>
        )}
      </div>

      {/* Add Customer Modal Drawer */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl border border-slate-100 w-full max-w-sm overflow-hidden p-6 gap-4 flex flex-col font-sans">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-blue-600" />
              Daftarkan Pelanggan Baru
            </h3>
            <p className="text-xs text-slate-400">Pendaftaran pelanggan baru akan menyimulasi peningkatan baris write di database Firestore.</p>

            <form onSubmit={handleQuickAddCustomer} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Nama Lengkap*</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Ahmad Dhani"
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  className="w-full text-xs rounded border border-slate-200 p-2 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Nomor WhatsApp*</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: 081234567..."
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                  className="w-full text-xs rounded border border-slate-200 p-2 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Alamat Rumah (Opsional)</label>
                <input
                  type="text"
                  placeholder="Contoh: Apartemen Margonda No. 10"
                  value={newCustAddress}
                  onChange={(e) => setNewCustAddress(e.target.value)}
                  className="w-full text-xs rounded border border-slate-200 p-2 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Catatan Alergi / Wangi (Opsional)</label>
                <input
                  type="text"
                  placeholder="Contoh: Wangi lavender saja, pisahkan saputangan"
                  value={newCustNotes}
                  onChange={(e) => setNewCustNotes(e.target.value)}
                  className="w-full text-xs rounded border border-slate-200 p-2 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddCustomerModal(false)}
                  className="px-3.5 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Simpan Pelanggan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

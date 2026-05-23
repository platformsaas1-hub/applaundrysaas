import React, { useState } from 'react';
import { LaundryService, Outlet, UserRole } from '../types';
import { formatRupiah } from '../utils/formatting';
import { Settings, Plus, Save, AlertCircle, AlertTriangle, Trash2 } from 'lucide-react';

interface LayananViewProps {
  services: LaundryService[];
  outlets: Outlet[];
  currentRole: UserRole;
  onUpdateService: (id: string, price: number, active: boolean) => void;
  onAddService: (svc: Omit<LaundryService, 'serviceId' | 'createdAt'>) => void;
  onAddOutlet?: (out: Omit<Outlet, 'outletId' | 'createdAt'>) => void;
  trackAction: (reads: number, writes: number, savedReads?: number) => void;
}

export const LayananView: React.FC<LayananViewProps> = ({
  services,
  outlets,
  currentRole,
  onUpdateService,
  onAddService,
  onAddOutlet,
  trackAction
}) => {
  const [newSvcName, setNewSvcName] = useState<string>('');
  const [newSvcType, setNewSvcType] = useState<LaundryService['type']>('kiloan');
  const [newSvcUnit, setNewSvcUnit] = useState<LaundryService['unit']>('kg');
  const [newSvcPrice, setNewSvcPrice] = useState<number>(8000);
  const [newSvcDays, setNewSvcDays] = useState<number>(2);

  // New outlet branch form state
  const [newOutName, setNewOutName] = useState<string>('');
  const [newOutAddr, setNewOutAddr] = useState<string>('');
  const [newOutPhone, setNewOutPhone] = useState<string>('');

  const [activeTab, setActiveTab] = useState<'catalog' | 'outlets'>('catalog');

  const [editPriceId, setEditPriceId] = useState<string | null>(null);
  const [tempPrice, setTempPrice] = useState<number>(0);

  const isOperator = currentRole === 'kasir' || currentRole === 'pegawai';

  const handleCreateService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSvcName.trim()) return;

    onAddService({
      name: newSvcName,
      type: newSvcType,
      unit: newSvcUnit,
      pricePerUnit: newSvcPrice,
      estimatedDays: newSvcDays,
      isActive: true
    });

    // Reset Form
    setNewSvcName('');
    setNewSvcPrice(8000);
    setNewSvcDays(2);
  };

  const handleCreateOutlet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOutName.trim() || !newOutPhone.trim() || !onAddOutlet) return;

    onAddOutlet({
      name: newOutName,
      address: newOutAddr,
      phone: newOutPhone
    });

    // Reset Form
    setNewOutName('');
    setNewOutAddr('');
    setNewOutPhone('');
  };

  if (isOperator) {
    return (
      <div className="p-8 h-full flex flex-col justify-center items-center bg-slate-50 text-center">
        <div className="p-4 bg-amber-50 rounded-full text-amber-600 mb-4 border border-amber-200">
          <AlertCircle className="w-12 h-12" />
        </div>
        <h3 className="text-lg font-bold text-slate-800">Akses Terkunci oleh Firestore Rules</h3>
        <p className="text-slate-500 text-sm max-w-sm mt-1">
          Berdasarkan konfigurasi aturan <strong>database safety rules</strong>, menu penyesuaian tarif, program layanan, dan pengaturan fisik multi-cabang eksklusif hanya dapat dikonfigurasi oleh <strong>Owner/Admin</strong>.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex overflow-hidden h-full bg-slate-50">
      {/* Left panel - Configurations and inputs */}
      <div className="w-[340px] border-r border-slate-200 bg-white p-5 flex flex-col overflow-y-auto shrink-0 font-sans">
        
        {/* Toggle options tabs */}
        <div className="flex border border-slate-200 rounded-lg overflow-hidden p-1 bg-slate-50 mb-6 shrink-0">
          <button
            onClick={() => setActiveTab('catalog')}
            className={`flex-1 text-center py-1.5 text-xs font-bold rounded-md uppercase transition-all ${
              activeTab === 'catalog' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Layanan Laundry
          </button>
          <button
            onClick={() => setActiveTab('outlets')}
            className={`flex-1 text-center py-1.5 text-xs font-bold rounded-md uppercase transition-all ${
              activeTab === 'outlets' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Multi-Cabang
          </button>
        </div>

        {activeTab === 'catalog' ? (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Settings className="w-4 h-4 text-blue-600" />
              <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Tambah Layanan Baru</h4>
            </div>

            <form onSubmit={handleCreateService} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-500 mb-1 uppercase tracking-wider">Nama Jasa Laundry</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Cuci Karpet Bulu Domba"
                  value={newSvcName}
                  onChange={(e) => setNewSvcName(e.target.value)}
                  className="w-full text-xs rounded border border-slate-200 p-2 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-500 mb-1 uppercase">Klasifikasi</label>
                  <select
                    value={newSvcType}
                    onChange={(e) => {
                      const type = e.target.value as LaundryService['type'];
                      setNewSvcType(type);
                      setNewSvcUnit(type === 'kiloan' ? 'kg' : 'pcs');
                    }}
                    className="w-full text-xs rounded border border-slate-200 p-2 focus:ring-1 focus:ring-blue-500 focus:outline-none bg-white"
                  >
                    <option value="kiloan">Kiloan</option>
                    <option value="satuan">Satuan</option>
                    <option value="sepatu">Sepatu</option>
                    <option value="karpet">Karpet</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-500 mb-1 uppercase">Satuan Tarif</label>
                  <select
                    value={newSvcUnit}
                    onChange={(e) => setNewSvcUnit(e.target.value as LaundryService['unit'])}
                    className="w-full text-xs rounded border border-slate-200 p-2 focus:ring-1 focus:ring-blue-500 focus:outline-none bg-white"
                  >
                    <option value="kg">kg (Kilogram)</option>
                    <option value="pcs">pcs (Potong)</option>
                    <option value="pair">pair (Sepasang)</option>
                    <option value="m2">m² (Meter Persegi)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-500 mb-1 uppercase">Tarif per Unit (Rp)</label>
                  <input
                    type="number"
                    required
                    min="500"
                    step="500"
                    value={newSvcPrice}
                    onChange={(e) => setNewSvcPrice(parseInt(e.target.value) || 0)}
                    className="w-full text-xs rounded border border-slate-200 p-2 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-500 mb-1 uppercase">Estimasi Kerja (Hari)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="10"
                    value={newSvcDays}
                    onChange={(e) => setNewSvcDays(parseInt(e.target.value) || 2)}
                    className="w-full text-xs rounded border border-slate-200 p-2 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 text-white p-2.5 font-bold text-xs rounded hover:bg-blue-700 transition-all flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Simpan Layanan & Emit Doc
              </button>
            </form>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Settings className="w-4 h-4 text-blue-600" />
              <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Daftarkan Cabang Baru</h4>
            </div>

            <form onSubmit={handleCreateOutlet} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-500 mb-1 uppercase tracking-wider">Nama Outlet Fisik</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Laundry Barokah - Cabang Rangkapan Jaya"
                  value={newOutName}
                  onChange={(e) => setNewOutName(e.target.value)}
                  className="w-full text-xs rounded border border-slate-200 p-2 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-500 mb-1 uppercase tracking-wider">Alamat Lengkap</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Jl. Nusantara Raya No. 4, Depok"
                  value={newOutAddr}
                  onChange={(e) => setNewOutAddr(e.target.value)}
                  className="w-full text-xs rounded border border-slate-200 p-2 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-500 mb-1 uppercase tracking-wider">Nomor Kontak Outlet</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: 081223344..."
                  value={newOutPhone}
                  onChange={(e) => setNewOutPhone(e.target.value)}
                  className="w-full text-xs rounded border border-slate-200 p-2 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 text-white p-2.5 font-bold text-xs rounded hover:bg-blue-700 transition-all flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Tambah Cabang Baru
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Right panel - List of items */}
      <div className="flex-1 p-5 overflow-y-auto">
        {activeTab === 'catalog' ? (
          <div className="space-y-4">
            <h3 className="font-extrabold text-slate-800 text-base">Katalog Menu & Tarif Jasa Aktif</h3>
            <p className="text-xs text-slate-400 mt-1">Mengklik kolom harga membolehkan edit harga instan untuk simulasi dinamika pricing SaaS.</p>

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100">
                  <tr>
                    <th className="px-5 py-3">Nama Jasa</th>
                    <th className="px-5 py-3">Klasifikasi</th>
                    <th className="px-5 py-3 text-right">Tarif</th>
                    <th className="px-5 py-3 text-center">Durasi SLA</th>
                    <th className="px-5 py-3 text-center">Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {services.map(svc => (
                    <tr key={svc.serviceId} className="hover:bg-slate-50/50 transition">
                      <td className="px-5 py-3.5">
                        <span className="font-bold text-slate-700 block">{svc.name}</span>
                        <span className="text-[9px] text-slate-400 font-mono">ID: {svc.serviceId}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 rounded font-semibold text-slate-600 uppercase tracking-wider">{svc.type}</span>
                      </td>
                      <td className="px-5 py-3.5 text-right font-semibold text-slate-800 font-mono">
                        {editPriceId === svc.serviceId ? (
                          <div className="flex items-center justify-end gap-1">
                            <input
                              type="number"
                              value={tempPrice}
                              onChange={(e) => setTempPrice(parseInt(e.target.value) || 0)}
                              className="w-16 border rounded p-0.5 text-right font-mono"
                            />
                            <button
                              onClick={() => {
                                onUpdateService(svc.serviceId, tempPrice, svc.isActive);
                                setEditPriceId(null);
                              }}
                              className="p-1 bg-emerald-50 text-emerald-600 rounded"
                            >
                              <Save className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setEditPriceId(svc.serviceId);
                              setTempPrice(svc.pricePerUnit);
                            }}
                            className="hover:underline font-bold text-blue-600"
                            title="Klik untuk edit"
                          >
                            {formatRupiah(svc.pricePerUnit)}/{svc.unit}
                          </button>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-center font-bold text-slate-500 font-mono">{svc.estimatedDays} Hari</td>
                      <td className="px-5 py-3.5 text-center">
                        <button
                          onClick={() => onUpdateService(svc.serviceId, svc.pricePerUnit, !svc.isActive)}
                          className={`px-2 py-1 text-[9px] font-bold rounded ${
                            svc.isActive 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                              : 'bg-rose-50 text-rose-700 border border-rose-100'
                          }`}
                        >
                          {svc.isActive ? 'AKTIF' : 'NON-AKTIF'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <h3 className="font-extrabold text-slate-800 text-base">Daftar Fisik Cabang Outlet (Tenant Isolation)</h3>
            <p className="text-xs text-slate-400 mt-1">SaaS memisahkan pembukuan tiap cabang. Kasir hanya diberikan akses mutasi data di outlet terpilih.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {outlets.map(out => (
                <div key={out.outletId} className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start">
                      <h4 className="font-bold text-slate-800 text-sm leading-snug">{out.name}</h4>
                      <span className="text-[9px] bg-blue-50 text-blue-700 font-mono font-bold px-1.5 rounded">ID: {out.outletId}</span>
                    </div>
                    <p className="text-xs text-slate-500 italic mt-2 leading-relaxed">{out.address}</p>
                    <p className="text-xs text-slate-400 font-mono mt-1.5">📞 WhatsApp: {out.phone}</p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-medium">
                    <span>Terdaftar: {new Date(out.createdAt).toLocaleDateString()}</span>
                    <span className="text-emerald-600 font-bold flex items-center gap-1">✓ Logic Isolated</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

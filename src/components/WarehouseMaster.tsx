import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  X, 
  Warehouse as WarehouseIcon,
  CheckCircle2
} from 'lucide-react';
import { Warehouse, SystemSettings } from '../types';

interface WarehouseMasterProps {
  warehouses: Warehouse[];
  settings?: SystemSettings;
  onAddWarehouse: (warehouse: Omit<Warehouse, 'id' | 'createdAt'>) => Promise<void>;
  onUpdateWarehouse: (id: string, warehouse: Partial<Warehouse>) => Promise<void>;
  onDeleteWarehouse: (id: string) => Promise<void>;
}

export default function WarehouseMaster({ 
  warehouses, 
  settings,
  onAddWarehouse, 
  onUpdateWarehouse, 
  onDeleteWarehouse
}: WarehouseMasterProps) {
  
  // States
  const [searchQuery, setSearchQuery] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);

  // Form Fields State
  const [formFields, setFormFields] = useState({
    warehouseId: '',
    name: '',
    nameEn: '',
    contactPerson: '',
    address: '',
    addressEn: '',
    phone: '',
    email: '',
    country: 'Republic of Korea',
    zip: '',
    notes: '',
    isDefault: false
  });

  const resetForm = () => {
    setFormFields({
      warehouseId: '',
      name: '',
      nameEn: '',
      contactPerson: '',
      address: '',
      addressEn: '',
      phone: '',
      email: '',
      country: 'Republic of Korea',
      zip: '',
      notes: '',
      isDefault: false
    });
    setEditingWarehouse(null);
  };

  const handleOpenAdd = () => {
    resetForm();
    const nextNum = warehouses.length + 1;
    const padded = String(nextNum).padStart(3, '0');
    setFormFields(prev => ({ 
      ...prev, 
      warehouseId: `WRH-${padded}`,
      isDefault: warehouses.length === 0 // Default true if first warehouse
    }));
    setIsFormOpen(true);
  };

  const handleOpenEdit = (warehouse: Warehouse) => {
    setEditingWarehouse(warehouse);
    setFormFields({
      warehouseId: warehouse.warehouseId || (warehouse as any).code || '',
      name: warehouse.name || '',
      nameEn: warehouse.nameEn || '',
      contactPerson: warehouse.contactPerson || '',
      address: warehouse.address || '',
      addressEn: warehouse.addressEn || '',
      phone: warehouse.phone || '',
      email: warehouse.email || '',
      country: warehouse.country || '',
      zip: warehouse.zip || '',
      notes: warehouse.notes || '',
      isDefault: warehouse.isDefault || false
    });
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formFields.warehouseId || !formFields.name || !formFields.nameEn) {
      alert('発送元ID、会社名、会社名英語は必須です。');
      return;
    }

    // Check duplicate ID
    if (!editingWarehouse) {
      const duplicate = warehouses.some(w => (w.warehouseId || (w as any).code || '').toUpperCase() === formFields.warehouseId.toUpperCase());
      if (duplicate) {
        alert('この発送元倉庫IDは既に登録されています。');
        return;
      }
    }

    try {
      if (editingWarehouse) {
        await onUpdateWarehouse(editingWarehouse.id, formFields);
      } else {
        await onAddWarehouse(formFields);
      }
      setIsFormOpen(false);
      resetForm();
    } catch (err) {
      console.error(err);
      alert('保存中にエラーが発生しました。');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`本当に「${name}」を削除しますか？`)) {
      try {
        await onDeleteWarehouse(id);
      } catch (err) {
        console.error(err);
        alert('削除中にエラーが発生しました。');
      }
    }
  };

  const handleSetDefault = async (warehouse: Warehouse) => {
    if (warehouse.isDefault) return;
    try {
      await onUpdateWarehouse(warehouse.id, { isDefault: true });
      alert(`「${warehouse.name}」をデフォルト発送元倉庫に設定しました。`);
    } catch (err) {
      console.error(err);
      alert('デフォルト設定の更新に失敗しました。');
    }
  };

  const filteredWarehouses = warehouses.filter(w => {
    const query = searchQuery.toLowerCase();
    return (
      (w.name || '').toLowerCase().includes(query) ||
      (w.nameEn || '').toLowerCase().includes(query) ||
      (w.warehouseId || (w as any).code || '').toLowerCase().includes(query) ||
      (w.country || '').toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header and top buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">発送元（海外倉庫）マスタ</h2>
          <p className="text-xs text-slate-500">インボイスのShipper欄に記載される海外倉庫・発送元拠点の情報を登録・管理します。</p>
        </div>
        
        <button
          onClick={handleOpenAdd}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>新規倉庫追加</span>
        </button>
      </div>

      {/* Filter panel */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3.5 top-2.5 h-4.5 w-4.5 text-slate-400" />
          <input
            type="text"
            placeholder="倉庫名、英語名、国などで検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200/85 rounded-lg pl-10 pr-4 py-2 text-xs focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
      </div>

      {/* Grid view of Warehouses */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filteredWarehouses.length === 0 ? (
          <div className="md:col-span-2 bg-white rounded-xl border border-slate-200/80 shadow-sm p-10 text-center text-slate-400 text-xs">
            登録された倉庫情報が見つかりません
          </div>
        ) : (
          filteredWarehouses.map((w) => {
            const isDefaultWarehouse = Boolean(w.isDefault || w.id === settings?.defaultWarehouseId);
            return (
              <div key={w.id} className="bg-white rounded-xl border border-slate-200/85 shadow-sm overflow-hidden flex flex-col justify-between">
                {/* Warehouse Card Header */}
                <div className="p-5 border-b border-slate-100 flex items-start justify-between bg-slate-50/40">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-50 p-2.5 rounded-lg text-blue-600">
                      <WarehouseIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <span>{w.name}</span>
                        {isDefaultWarehouse && (
                          <span className="bg-blue-100 text-blue-800 text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                            <CheckCircle2 className="w-3 h-3 text-blue-600" />
                            <span>デフォルト設定</span>
                          </span>
                        )}
                      </h3>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">倉庫ID: {w.warehouseId || (w as any).code}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {!isDefaultWarehouse && (
                      <button
                        onClick={() => handleSetDefault(w)}
                        className="bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-700 px-2 py-1 rounded text-[10px] font-bold border border-slate-200 transition-colors cursor-pointer"
                        title="デフォルト倉庫に設定"
                      >
                        デフォルトに設定
                      </button>
                    )}
                  <button
                    onClick={() => handleOpenEdit(w)}
                    className="bg-white hover:bg-slate-100 text-slate-600 p-1.5 rounded border border-slate-200 hover:border-slate-300 transition-colors cursor-pointer"
                    title="編集"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(w.id, w.name)}
                    className="bg-white hover:bg-red-50 text-red-600 p-1.5 rounded border border-slate-200 hover:border-red-200 transition-colors cursor-pointer"
                    title="削除"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Warehouse Body details */}
              <div className="p-5 flex-1 space-y-3 text-xs text-slate-600">
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">会社名 (英語)</span>
                  <span className="font-semibold text-slate-800 font-medium">{w.nameEn}</span>
                </div>
                
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">英語住所 / 国</span>
                  <span className="font-medium text-slate-700 block max-h-12 overflow-y-auto leading-relaxed" title={w.addressEn}>{w.addressEn}</span>
                  <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">{w.country} ({w.zip || '郵便番号なし'})</span>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-1">
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase">担当者名</span>
                    <span className="font-medium text-slate-800">{w.contactPerson || '未設定'}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase">電話番号</span>
                    <span className="font-mono text-slate-800">{w.phone || '未設定'}</span>
                  </div>
                </div>

                {w.notes && (
                  <div className="bg-slate-50 p-2.5 rounded border border-slate-100 text-[11px] text-slate-500 leading-relaxed">
                    <strong>備考:</strong> {w.notes}
                  </div>
                )}
              </div>
            </div>
          );
        })
        )}
      </div>

      {/* Form Dialog Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-sm font-bold text-slate-900">
                {editingWarehouse ? '倉庫情報の編集' : '新規倉庫登録'}
              </h3>
              <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">発送元倉庫ID <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={formFields.warehouseId}
                    onChange={(e) => setFormFields(prev => ({ ...prev, warehouseId: e.target.value.toUpperCase() }))}
                    disabled={!!editingWarehouse}
                    className="w-full border border-slate-200 rounded px-3 py-1.5 text-xs bg-slate-50 font-mono focus:outline-none focus:border-blue-500"
                    placeholder="WRH-001"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">会社名 (日本語) <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={formFields.name}
                    onChange={(e) => setFormFields(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full border border-slate-200 rounded px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                    placeholder="サンプル韓国第一倉庫"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">会社名 (英語表記) <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={formFields.nameEn}
                    onChange={(e) => setFormFields(prev => ({ ...prev, nameEn: e.target.value }))}
                    className="w-full border border-slate-200 rounded px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                    placeholder="Sample Korea Warehouse Co., Ltd."
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">担当者名</label>
                  <input
                    type="text"
                    value={formFields.contactPerson}
                    onChange={(e) => setFormFields(prev => ({ ...prev, contactPerson: e.target.value }))}
                    className="w-full border border-slate-200 rounded px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                    placeholder="Hong Gil-dong"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">電話番号</label>
                  <input
                    type="text"
                    value={formFields.phone}
                    onChange={(e) => setFormFields(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full border border-slate-200 rounded px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-blue-500"
                    placeholder="+82-2-1234-5678"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">メールアドレス</label>
                  <input
                    type="email"
                    value={formFields.email}
                    onChange={(e) => setFormFields(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full border border-slate-200 rounded px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-blue-500"
                    placeholder="shipper@example.kr"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">郵便番号</label>
                  <input
                    type="text"
                    value={formFields.zip}
                    onChange={(e) => setFormFields(prev => ({ ...prev, zip: e.target.value }))}
                    className="w-full border border-slate-200 rounded px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-blue-500"
                    placeholder="06164"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">国名 (英語表記)</label>
                  <input
                    type="text"
                    value={formFields.country}
                    onChange={(e) => setFormFields(prev => ({ ...prev, country: e.target.value }))}
                    className="w-full border border-slate-200 rounded px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                    placeholder="Republic of Korea"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">国内住所 (日本語)</label>
                  <input
                    type="text"
                    value={formFields.address}
                    onChange={(e) => setFormFields(prev => ({ ...prev, address: e.target.value }))}
                    className="w-full border border-slate-200 rounded px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                    placeholder="ソウル特別市江南区テヘラン路"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">インボイス用 英語住所 <span className="text-red-500">*</span></label>
                  <textarea
                    required
                    value={formFields.addressEn}
                    onChange={(e) => setFormFields(prev => ({ ...prev, addressEn: e.target.value }))}
                    rows={2}
                    className="w-full border border-slate-200 rounded px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                    placeholder="Teheran-ro, Gangnam-gu, Seoul, Republic of Korea"
                  />
                </div>

                <div className="sm:col-span-2 flex items-center gap-3 py-2 border-t border-slate-100 mt-2">
                  <input
                    type="checkbox"
                    id="isDefault"
                    checked={formFields.isDefault}
                    onChange={(e) => setFormFields(prev => ({ ...prev, isDefault: e.target.checked }))}
                    className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 border-slate-300"
                  />
                  <label htmlFor="isDefault" className="text-xs font-bold text-slate-700 cursor-pointer">
                    この倉庫をデフォルトの発送元にする (新規発送の作成時に自動選択されます)
                  </label>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">備考</label>
                  <textarea
                    value={formFields.notes}
                    onChange={(e) => setFormFields(prev => ({ ...prev, notes: e.target.value }))}
                    rows={2}
                    className="w-full border border-slate-200 rounded px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                    placeholder="その他メモ"
                  />
                </div>

              </div>

              {/* Action Buttons */}
              <div className="border-t border-slate-100 pt-4 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-5 py-2 rounded text-xs font-bold hover:bg-blue-700 cursor-pointer"
                >
                  {editingWarehouse ? '更新する' : '登録する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

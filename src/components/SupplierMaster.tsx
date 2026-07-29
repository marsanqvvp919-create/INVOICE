import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  X, 
  Truck,
  CheckCircle2,
  Mail,
  Phone,
  MapPin,
  FileText
} from 'lucide-react';
import { Supplier, UserRole } from '../types';

interface SupplierMasterProps {
  suppliers: Supplier[];
  currentUserRole: UserRole;
  onAddSupplier: (supplier: Omit<Supplier, 'id' | 'createdAt'>) => Promise<void>;
  onUpdateSupplier: (id: string, supplier: Partial<Supplier>) => Promise<void>;
  onDeleteSupplier: (id: string) => Promise<void>;
}

export default function SupplierMaster({ 
  suppliers, 
  currentUserRole,
  onAddSupplier, 
  onUpdateSupplier, 
  onDeleteSupplier 
}: SupplierMasterProps) {
  
  // States
  const [searchQuery, setSearchQuery] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const isAdmin = currentUserRole === 'ADMIN';

  // Form Fields State
  const [formFields, setFormFields] = useState({
    supplierId: '',
    name: '',
    nameEn: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    addressEn: '',
    notes: '',
    active: true
  });

  const resetForm = () => {
    setFormFields({
      supplierId: '',
      name: '',
      nameEn: '',
      contactPerson: '',
      phone: '',
      email: '',
      address: '',
      addressEn: '',
      notes: '',
      active: true
    });
    setEditingSupplier(null);
  };

  const handleOpenAdd = () => {
    resetForm();
    // Auto-generate ID based on count
    const nextNum = suppliers.length + 1;
    const padded = String(nextNum).padStart(3, '0');
    setFormFields(prev => ({ 
      ...prev, 
      supplierId: `SPL-${padded}`
    }));
    setIsFormOpen(true);
  };

  const handleOpenEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormFields({
      supplierId: supplier.supplierId || '',
      name: supplier.name || '',
      nameEn: supplier.nameEn || '',
      contactPerson: supplier.contactPerson || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      address: supplier.address || '',
      addressEn: supplier.addressEn || '',
      notes: supplier.notes || '',
      active: supplier.active !== false
    });
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Auto-generate supplier ID if left blank
    let supplierId = formFields.supplierId.trim();
    if (!supplierId) {
      const nextNum = suppliers.length + 1;
      supplierId = `SPL-${String(nextNum).padStart(3, '0')}`;
    }

    // Check duplicate ID (excluding currently edited supplier)
    const duplicate = suppliers.some(s => 
      s.id !== editingSupplier?.id && 
      (s.supplierId || '').toUpperCase() === supplierId.toUpperCase()
    );
    if (duplicate) {
      alert('この入荷元IDはすでに登録されています。');
      return;
    }

    // Handle blank name fields with safe fallbacks
    let name = formFields.name.trim();
    let nameEn = formFields.nameEn.trim();

    if (!name && nameEn) {
      name = nameEn;
    } else if (!name && !nameEn) {
      name = `未設定入荷元 (${supplierId})`;
      nameEn = `Supplier ${supplierId}`;
    } else if (name && !nameEn) {
      nameEn = name;
    }

    const payload = {
      ...formFields,
      supplierId,
      name,
      nameEn
    };

    try {
      if (editingSupplier) {
        await onUpdateSupplier(editingSupplier.id, payload);
      } else {
        await onAddSupplier(payload);
      }
      setIsFormOpen(false);
      resetForm();
    } catch (err) {
      console.error(err);
      alert('保存中にエラーが発生しました。');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!isAdmin) {
      alert('管理者権限のみ削除可能です。');
      return;
    }
    if (window.confirm(`本当に入荷元「${name}」を削除しますか？\n削除すると元に戻せません。`)) {
      try {
        await onDeleteSupplier(id);
      } catch (err) {
        console.error(err);
        alert('削除中にエラーが発生しました。');
      }
    }
  };

  const filteredSuppliers = suppliers.filter(s => {
    const query = searchQuery.toLowerCase();
    return (
      (s.name || '').toLowerCase().includes(query) ||
      (s.nameEn || '').toLowerCase().includes(query) ||
      (s.supplierId || '').toLowerCase().includes(query) ||
      (s.contactPerson || '').toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6" id="supplier-master-root">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 bg-blue-50 text-blue-600 rounded-md">
              <Truck className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold text-slate-900">入荷元マスタ管理</h2>
          </div>
          <p className="text-xs text-slate-500">
            製剤ロットの海外仕入先や入荷元の基本情報を一元管理します。
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={handleOpenAdd}
            className="flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow transition-colors cursor-pointer"
            id="add-supplier-btn"
          >
            <Plus className="w-4 h-4" />
            入荷元を追加
          </button>
        )}
      </div>

      {/* Grid List & Filters */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        {/* Search Bar */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center gap-3">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="入荷元ID、入荷元名、英語名、担当者で検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 border border-slate-200 bg-white rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          <div className="text-[10px] text-slate-400 font-semibold sm:ml-auto">
            登録件数: <span className="text-slate-700 font-mono text-xs">{filteredSuppliers.length}</span> / {suppliers.length} 件
          </div>
        </div>

        {/* Desktop Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold">
                <th className="px-5 py-3 w-28">入荷元ID</th>
                <th className="px-5 py-3">入荷元名 (日本語 / 英語)</th>
                <th className="px-5 py-3">担当者・連絡先</th>
                <th className="px-5 py-3">所在地 / 住所</th>
                <th className="px-5 py-3 w-24">状態</th>
                <th className="px-5 py-3 text-right w-24">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {filteredSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-400">
                    入荷元情報が見つかりません。
                  </td>
                </tr>
              ) : (
                filteredSuppliers.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4 font-mono font-bold text-slate-800">
                      {supplier.supplierId || '-'}
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-bold text-slate-800 text-sm">
                        {supplier.name || supplier.nameEn || '未設定入荷元'}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {supplier.nameEn || '-'}
                      </div>
                    </td>
                    <td className="px-5 py-4 space-y-1">
                      {supplier.contactPerson && (
                        <div className="font-medium text-slate-700">{supplier.contactPerson}</div>
                      )}
                      <div className="flex flex-col gap-0.5 text-[10px] text-slate-400 font-mono">
                        {supplier.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-300" /> {supplier.phone}
                          </span>
                        )}
                        {supplier.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3 text-slate-300" /> {supplier.email}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-slate-700 line-clamp-1 max-w-xs" title={supplier.address}>
                        {supplier.address || '-'}
                      </div>
                      {supplier.addressEn && (
                        <div className="text-[10px] text-slate-400 font-mono line-clamp-1 max-w-xs mt-0.5" title={supplier.addressEn}>
                          {supplier.addressEn}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        supplier.active !== false 
                          ? 'bg-emerald-50 text-emerald-700' 
                          : 'bg-slate-100 text-slate-400'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${supplier.active !== false ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                        {supplier.active !== false ? '有効' : '無効'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(supplier)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                          title="編集"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => handleDelete(supplier.id, supplier.name)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                            title="削除"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Form Dialog Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-slate-100 shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-blue-100 text-blue-700 rounded">
                  <Truck className="w-4 h-4" />
                </span>
                <h3 className="font-bold text-slate-900">
                  {editingSupplier ? '入荷元情報の編集' : '新規入荷元の登録'}
                </h3>
              </div>
              <button 
                onClick={() => setIsFormOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Supplier ID */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    入荷元ID <span className="text-slate-400 font-normal text-[10px]">(空欄で自動割り振り)</span>
                  </label>
                  <input
                    type="text"
                    value={formFields.supplierId}
                    onChange={(e) => setFormFields(prev => ({ ...prev, supplierId: e.target.value.toUpperCase() }))}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    placeholder="e.g. SPL-001 (空欄時は自動発行)"
                  />
                </div>

                {/* Status Toggle */}
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={formFields.active}
                      onChange={(e) => setFormFields(prev => ({ ...prev, active: e.target.checked }))}
                      className="w-4 h-4 text-blue-600 border-slate-200 rounded focus:ring-blue-500"
                    />
                    <span className="text-xs font-semibold text-slate-700">有効な入荷元として設定する</span>
                  </label>
                </div>

                {/* Name Ja */}
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    入荷元名 (日本語表示)
                  </label>
                  <input
                    type="text"
                    value={formFields.name}
                    onChange={(e) => setFormFields(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    placeholder="e.g. ソウル本社ラボ"
                  />
                </div>

                {/* Name En */}
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    入荷元名 (英語・インボイス用)
                  </label>
                  <input
                    type="text"
                    value={formFields.nameEn}
                    onChange={(e) => setFormFields(prev => ({ ...prev, nameEn: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    placeholder="e.g. Seoul HQ Laboratories Inc."
                  />
                </div>

                {/* Contact Person */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    担当者名
                  </label>
                  <input
                    type="text"
                    value={formFields.contactPerson}
                    onChange={(e) => setFormFields(prev => ({ ...prev, contactPerson: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    placeholder="e.g. キム・ミンス"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    電話番号
                  </label>
                  <input
                    type="text"
                    value={formFields.phone}
                    onChange={(e) => setFormFields(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    placeholder="e.g. +82-2-1234-5678"
                  />
                </div>

                {/* Email */}
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    メールアドレス
                  </label>
                  <input
                    type="email"
                    value={formFields.email}
                    onChange={(e) => setFormFields(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    placeholder="e.g. contact@seoul-hq-lab.com"
                  />
                </div>

                {/* Address Ja */}
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    所在地・住所 (日本語)
                  </label>
                  <input
                    type="text"
                    value={formFields.address}
                    onChange={(e) => setFormFields(prev => ({ ...prev, address: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    placeholder="e.g. 大韓民国ソウル特別市江南区テヘラン路88"
                  />
                </div>

                {/* Address En */}
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    所在地・住所 (英語)
                  </label>
                  <input
                    type="text"
                    value={formFields.addressEn}
                    onChange={(e) => setFormFields(prev => ({ ...prev, addressEn: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    placeholder="e.g. 88 Teheran-ro, Gangnam-gu, Seoul, South Korea"
                  />
                </div>

                {/* Notes */}
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    備考・メモ
                  </label>
                  <textarea
                    rows={3}
                    value={formFields.notes}
                    onChange={(e) => setFormFields(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    placeholder="特記事項があれば入力してください"
                  />
                </div>

              </div>

              {/* Form Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow transition-colors cursor-pointer"
                >
                  {editingSupplier ? '更新保存' : '登録する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState } from 'react';
import { 
  PackagePlus, 
  History, 
  Search, 
  Plus, 
  TrendingUp, 
  ShieldAlert,
  Boxes
} from 'lucide-react';
import { Product, Warehouse, InventoryTransaction, InventoryLot, User, Supplier } from '../types';
import SearchableSelect, { SelectOption } from './SearchableSelect';

interface StockInputProps {
  products: Product[];
  warehouses: Warehouse[];
  transactions: InventoryTransaction[];
  lots: InventoryLot[];
  suppliers: Supplier[];
  currentUser: User;
  onAddStock: (data: {
    date: string;
    productId: string;
    warehouseId: string;
    lotNo: string;
    expiryDate: string;
    quantity: number;
    purchasePrice: number;
    purchaseCurrency: string;
    notes: string;
    operator: string;
  }) => Promise<void>;
  onAdjustLot?: (lotId: string, newStock: number, notes: string) => Promise<void>;
}

export default function StockInput({
  products,
  warehouses,
  transactions,
  lots,
  suppliers,
  currentUser,
  onAddStock,
  onAdjustLot
}: StockInputProps) {
  
  // States
  const [activeTab, setActiveTab] = useState<'form' | 'lots' | 'history'>('form');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Adjust stock states
  const [adjustingLot, setAdjustingLot] = useState<InventoryLot | null>(null);
  const [adjustNewStock, setAdjustNewStock] = useState<number>(0);
  const [adjustNotes, setAdjustNotes] = useState<string>('');
  const [isAdjusting, setIsAdjusting] = useState<boolean>(false);
  
  // New Stock Form state
  const [formFields, setFormFields] = useState({
    date: new Date().toISOString().substring(0, 10),
    productId: '',
    warehouseId: warehouses.find(w => w.isDefault)?.id || warehouses[0]?.id || '',
    lotNo: '',
    customLotNo: '',
    expiryDate: '2040-12-31',
    quantity: 100,
    purchasePrice: 0,
    purchaseCurrency: 'USD',
    notes: ''
  });

  const handleProductChange = (productId: string) => {
    const p = products.find(prod => prod.id === productId);
    if (p) {
      setFormFields(prev => ({
        ...prev,
        productId,
        purchasePrice: p.purchasePrice || 0,
        purchaseCurrency: p.purchaseCurrency || 'JPY',
        lotNo: p.lotNo || prev.lotNo || '',
        customLotNo: '',
        expiryDate: '2040-12-31'
      }));
    } else {
      setFormFields(prev => ({ ...prev, productId }));
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const finalLot = (formFields.lotNo === 'custom' ? formFields.customLotNo : formFields.lotNo).trim();

    if (!formFields.productId || !formFields.warehouseId || !finalLot) {
      alert('製剤、倉庫、入荷元は必須項目です。');
      return;
    }

    if (formFields.quantity <= 0) {
      alert('入庫数量は1以上にしてください。');
      return;
    }

    try {
      await onAddStock({
        ...formFields,
        lotNo: finalLot,
        operator: currentUser.name
      });
      alert('入庫登録が完了しました。在庫が正常に更新されました。');
      // Reset
      setFormFields(prev => ({
        ...prev,
        lotNo: '',
        customLotNo: '',
        quantity: 100,
        notes: ''
      }));
      // Jump to lots
      setActiveTab('lots');
    } catch (err) {
      console.error(err);
      alert('入庫登録中にエラーが発生しました。');
    }
  };

  // Filters for lots and transactions
  const filteredLots = lots.filter(lot => {
    const prod = products.find(p => p.id === lot.productId);
    const wrh = warehouses.find(w => w.id === lot.warehouseId);
    const query = searchQuery.toLowerCase();
    
    return (
      (prod?.nameJa || '').toLowerCase().includes(query) ||
      (prod?.sku || '').toLowerCase().includes(query) ||
      lot.lotNo.toLowerCase().includes(query) ||
      (wrh?.name || '').toLowerCase().includes(query)
    );
  });

  const filteredTransactions = transactions.filter(tx => {
    const query = searchQuery.toLowerCase();
    return (
      tx.productNameJa.toLowerCase().includes(query) ||
      tx.lotNo.toLowerCase().includes(query) ||
      tx.warehouseName.toLowerCase().includes(query) ||
      tx.type.toLowerCase().includes(query) ||
      tx.notes.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">在庫入庫・履歴管理</h2>
        <p className="text-xs text-slate-500">海外倉庫への製剤入庫作業、入荷元別の在庫管理、在庫変動履歴の監査を行います。</p>
      </div>

      {/* Internal Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => { setActiveTab('form'); setSearchQuery(''); }}
          className={`px-5 py-2.5 font-bold text-xs border-b-2 transition-all cursor-pointer ${
            activeTab === 'form' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <PackagePlus className="w-4 h-4" />
            <span>新規入庫登録</span>
          </div>
        </button>

        <button
          onClick={() => { setActiveTab('lots'); setSearchQuery(''); }}
          className={`px-5 py-2.5 font-bold text-xs border-b-2 transition-all cursor-pointer ${
            activeTab === 'lots' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <Boxes className="w-4 h-4" />
            <span>入荷元別現在庫一覧</span>
          </div>
        </button>

        <button
          onClick={() => { setActiveTab('history'); setSearchQuery(''); }}
          className={`px-5 py-2.5 font-bold text-xs border-b-2 transition-all cursor-pointer ${
            activeTab === 'history' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <History className="w-4 h-4" />
            <span>在庫変動履歴 (カードログ)</span>
          </div>
        </button>
      </div>

      {/* Search panel for Lots/History */}
      {activeTab !== 'form' && (
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
          <div className="relative">
            <Search className="absolute left-3.5 top-2.5 h-4.5 w-4.5 text-slate-400" />
            <input
              type="text"
              placeholder="製剤名、SKU、入荷元、倉庫名で検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200/85 rounded-lg pl-10 pr-4 py-2 text-xs focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
        </div>
      )}

      {/* Tab: Form */}
      {activeTab === 'form' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/80 shadow-sm p-6">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 mb-5 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <span>入庫情報入力</span>
            </h3>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">入庫日 <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    required
                    value={formFields.date}
                    onChange={(e) => setFormFields(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full border border-slate-200 rounded px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">入庫先倉庫 <span className="text-red-500">*</span></label>
                  <select
                    required
                    value={formFields.warehouseId}
                    onChange={(e) => setFormFields(prev => ({ ...prev, warehouseId: e.target.value }))}
                    className="w-full border border-slate-200 rounded px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500 font-semibold"
                  >
                    <option value="">-- 選択してください --</option>
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name} ({w.nameEn})</option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">入庫対象製剤 <span className="text-red-500">*</span></label>
                  <SearchableSelect
                    options={[...products]
                      .filter(p => p.active !== false)
                      .sort((a, b) => {
                        const nameA = a.nameEn || a.nameJa || a.sku || '';
                        const nameB = b.nameEn || b.nameJa || b.sku || '';
                        return nameA.localeCompare(nameB, 'en', { sensitivity: 'base', numeric: true });
                      })
                      .map(p => ({
                        value: p.id,
                        label: `${p.nameEn || p.nameJa} (${p.nameJa || p.nameEn})`,
                        subLabel: `SKU: ${p.sku}`,
                        badge: p.spec || p.unit
                      }))
                    }
                    value={formFields.productId}
                    onChange={(val) => handleProductChange(val)}
                    placeholder="-- 製剤を検索して選択 --"
                    searchPlaceholder="製剤名・SKUで検索..."
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">入荷元（仕入先・配送元など） <span className="text-red-500">*</span></label>
                  <SearchableSelect
                    options={[
                      ...suppliers
                        .filter(s => s.active !== false)
                        .sort((a, b) => (a.name || a.supplierId).localeCompare(b.name || b.supplierId, 'ja'))
                        .map(s => ({
                          value: s.supplierId,
                          label: s.name || s.supplierId || '未設定入荷元',
                          subLabel: `ID: ${s.supplierId}`,
                          badge: s.contactPerson ? `担当: ${s.contactPerson}` : undefined
                        })),
                      {
                        value: 'custom',
                        label: '-- マスタにない入荷元（直接入力） --',
                        subLabel: '新規入力'
                      }
                    ]}
                    value={formFields.lotNo}
                    onChange={(val) => setFormFields(prev => ({ ...prev, lotNo: val }))}
                    placeholder="-- 入荷元を検索して選択 --"
                    searchPlaceholder="入荷元名・IDで検索..."
                  />

                  {formFields.lotNo === 'custom' && (
                    <div className="mt-2">
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">直接入力：新規入荷元コード/名称 <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        required
                        value={formFields.customLotNo}
                        onChange={(e) => setFormFields(prev => ({ ...prev, customLotNo: e.target.value }))}
                        className="w-full border border-slate-200 rounded px-3 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-500 uppercase"
                        placeholder="例: SPL-CUSTOM-LOT"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">入庫数量 <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formFields.quantity}
                    onChange={(e) => setFormFields(prev => ({ ...prev, quantity: Number(e.target.value) }))}
                    className="w-full border border-slate-200 rounded px-3 py-1.5 text-xs font-bold font-mono text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="bg-slate-50 p-2.5 rounded border border-slate-100 flex flex-col justify-center">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">参考仕入れ価格 (マスタ連動)</span>
                  <span className="font-mono font-bold text-slate-700 text-xs">
                    {formFields.purchasePrice.toLocaleString()} {formFields.purchaseCurrency}
                  </span>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">備考</label>
                  <textarea
                    value={formFields.notes}
                    onChange={(e) => setFormFields(prev => ({ ...prev, notes: e.target.value }))}
                    rows={2}
                    placeholder="仕入れ価格やその他の特記情報を入力します"
                    className="w-full border border-slate-200 rounded px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>

              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end">
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2 rounded text-xs cursor-pointer shadow-sm flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>入庫を確定する</span>
                </button>
              </div>
            </form>
          </div>

          {/* Right Column: Instructions */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
            <h4 className="font-bold text-xs text-slate-800 flex items-center gap-1">
              <ShieldAlert className="w-4 h-4 text-amber-500" />
              <span>入庫監査ルールについて</span>
            </h4>
            <div className="text-xs text-slate-600 space-y-2.5 leading-relaxed">
              <p>
                1. <strong>入荷元の管理:</strong> どこからの入庫かを明確にするために、入荷元（例: ソウル本社、取引先A、仕入先B）を必ず記録します。
              </p>
              <p>
                2. <strong>取引履歴の不変性:</strong> 在庫数を直接手動で修正することはできません。入庫・出庫、またはシステム設定からの「在庫調整（ADJ）」を介して、必ず<strong>在庫変動履歴</strong>を残す設計になっています。
              </p>
              <p>
                3. <strong>在庫レベルの最適化:</strong> 各入荷元別の現在庫数が十分に確保されているか確認し、適宜配分を行います。
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Lots */}
      {activeTab === 'lots' && (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="px-5 py-3">保管倉庫</th>
                  <th className="px-5 py-3">製剤名 / SKU</th>
                  <th className="px-5 py-3">入荷元</th>
                  <th className="px-5 py-3 text-right">現在在庫数</th>
                  <th className="px-5 py-3 text-center">アクション</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
                {filteredLots.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-10 text-slate-400">
                      入荷元別在庫データが見つかりません
                    </td>
                  </tr>
                ) : (
                  filteredLots.map((lot) => {
                    const prod = products.find(p => p.id === lot.productId);
                    const wrh = warehouses.find(w => w.id === lot.warehouseId);

                    return (
                      <tr key={lot.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="font-bold text-slate-900">{wrh?.name || '不明倉庫'}</div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">{wrh?.nameEn}</div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="font-bold text-slate-800">{prod?.nameJa || '不明製剤'}</div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">SKU: {prod?.sku}</div>
                        </td>
                        <td className="px-5 py-3.5 font-bold text-slate-900">{lot.lotNo}</td>
                        <td className="px-5 py-3.5 text-right font-bold font-mono text-slate-900">{lot.currentStock} {prod?.unit || 'pcs'}</td>
                        <td className="px-5 py-3.5 text-center">
                          <button
                            onClick={() => {
                              setAdjustingLot(lot);
                              setAdjustNewStock(lot.currentStock);
                              setAdjustNotes('実在庫棚卸に伴う調整');
                            }}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-[10px] rounded border border-slate-200 transition-colors cursor-pointer"
                          >
                            在庫調整
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: History */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="px-5 py-3">日時 / 操作者</th>
                  <th className="px-5 py-3">区分</th>
                  <th className="px-5 py-3">保管倉庫</th>
                  <th className="px-5 py-3">製剤名</th>
                  <th className="px-5 py-3">入荷元</th>
                  <th className="px-5 py-3 text-right">変動数量</th>
                  <th className="px-5 py-3 text-right">処理前後在庫</th>
                  <th className="px-5 py-3">備考</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-slate-400">
                      在庫履歴が見つかりません
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="font-mono text-slate-500 text-[11px]">{tx.date}</div>
                        <div className="text-[10px] text-slate-400 font-semibold mt-0.5">{tx.user}</div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex px-2.5 py-0.5 rounded text-[10px] font-bold ${
                          tx.type === 'IN' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                          tx.type === 'OUT' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' :
                          'bg-amber-50 text-amber-700 border border-amber-100'
                        }`}>
                          {tx.type === 'IN' ? '入庫 (+)' : tx.type === 'OUT' ? '出庫 (-)' : '調整'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-bold text-slate-800">{tx.warehouseName}</td>
                      <td className="px-5 py-3.5 font-semibold text-slate-800">{tx.productNameJa}</td>
                      <td className="px-5 py-3.5 font-bold text-slate-600">{tx.lotNo}</td>
                      <td className="px-5 py-3.5 text-right font-bold font-mono">
                        <span className={tx.quantity > 0 ? 'text-emerald-600' : 'text-red-600'}>
                          {tx.quantity > 0 ? `+${tx.quantity}` : tx.quantity}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-slate-500 text-[11px]">
                        {tx.beforeQty} → {tx.afterQty}
                      </td>
                      <td className="px-5 py-3.5 text-slate-400 text-[11px] max-w-[150px] truncate" title={tx.notes}>
                        {tx.notes || '---'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {adjustingLot && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
              <h3 className="font-bold text-xs uppercase tracking-widest text-slate-300">入荷元別在庫調整・棚卸</h3>
              <button 
                onClick={() => setAdjustingLot(null)}
                className="text-slate-400 hover:text-white transition-colors font-bold text-lg cursor-pointer animate-none"
              >
                &times;
              </button>
            </div>
            
            <div className="p-5 space-y-4">
              <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-150 space-y-1 text-xs text-slate-600">
                <p><strong>保管倉庫:</strong> {warehouses.find(w => w.id === adjustingLot.warehouseId)?.name || '不明'}</p>
                <p><strong>対象製剤:</strong> {products.find(p => p.id === adjustingLot.productId)?.nameJa || '不明'}</p>
                <p><strong>入荷元:</strong> <span className="font-bold text-slate-800">{adjustingLot.lotNo}</span></p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">調整前在庫</label>
                <div className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-3 py-2 rounded-lg border border-slate-200">
                  {adjustingLot.currentStock} {products.find(p => p.id === adjustingLot.productId)?.unit || 'pcs'}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">調整後 (実在庫数) *</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    value={adjustNewStock}
                    onChange={(e) => setAdjustNewStock(Math.max(0, parseInt(e.target.value) || 0))}
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                  <div className="flex gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setAdjustNewStock(prev => Math.max(0, prev - 10))}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded border border-slate-200 cursor-pointer"
                    >
                      -10
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdjustNewStock(prev => prev + 10)}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded border border-slate-200 cursor-pointer"
                    >
                      +10
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">調整理由 / 備考 *</label>
                <textarea
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                  placeholder="例: 定期棚卸による実在庫合わせ"
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="bg-slate-50 px-5 py-4 border-t border-slate-150 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAdjustingLot(null)}
                className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-semibold border border-slate-200 cursor-pointer"
              >
                キャンセル
              </button>
              <button
                type="button"
                disabled={isAdjusting}
                onClick={async () => {
                  if (!onAdjustLot) return;
                  if (adjustNewStock < 0) {
                    alert('在庫数は0以上にしてください。');
                    return;
                  }
                  if (!adjustNotes.trim()) {
                    alert('調整理由を入力してください。');
                    return;
                  }
                  try {
                    setIsAdjusting(true);
                    await onAdjustLot(adjustingLot.id, adjustNewStock, adjustNotes.trim());
                    alert('ロット在庫および製剤マスタ在庫の調整が正常に完了しました。');
                    setAdjustingLot(null);
                  } catch (err: any) {
                    alert(`在庫調整に失敗しました: ${err.message || err}`);
                  } finally {
                    setIsAdjusting(false);
                  }
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-sm"
              >
                {isAdjusting ? '更新中...' : '在庫を更新する'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

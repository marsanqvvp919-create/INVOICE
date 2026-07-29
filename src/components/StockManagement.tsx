import React, { useState } from 'react';
import { 
  Boxes, 
  Warehouse, 
  Truck, 
  ArrowRightLeft, 
  AlertTriangle, 
  Search, 
  Plus, 
  Trash2, 
  History, 
  Sliders,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowRight,
  TrendingDown,
  Sparkles,
  Info
} from 'lucide-react';
import { Product, Warehouse as WarehouseType, InventoryLot, InventoryTransaction, Supplier, User } from '../types';
import SearchableSelect from './SearchableSelect';

interface StockManagementProps {
  products: Product[];
  warehouses: WarehouseType[];
  lots: InventoryLot[];
  transactions: InventoryTransaction[];
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
  onAdjustLot: (lotId: string, newStock: number, notes: string) => Promise<void>;
  onTransferStock?: (productId: string, fromWarehouseId: string, toWarehouseId: string, lotNo: string, quantity: number, notes: string) => Promise<void>;
  onDeleteLot?: (lotId: string) => Promise<void>;
}

export default function StockManagement({
  products,
  warehouses,
  lots,
  transactions,
  suppliers,
  currentUser,
  onAddStock,
  onAdjustLot,
  onTransferStock,
  onDeleteLot
}: StockManagementProps) {
  
  // Tab states
  const [activeTab, setActiveTab] = useState<'overview' | 'breakdown' | 'direct-add' | 'transfer' | 'history'>('overview');
  
  // Filters & Searches
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [filterLowStockOnly, setFilterLowStockOnly] = useState(false);

  // Modal / Inline forms states
  const [adjustingLot, setAdjustingLot] = useState<InventoryLot | null>(null);
  const [adjustNewQty, setAdjustNewQty] = useState<number>(0);
  const [adjustNotes, setAdjustNotes] = useState('');
  const [lotToDelete, setLotToDelete] = useState<{ id: string; lotNo: string; currentStock: number } | null>(null);

  // Stock Transfer Form State
  const [transferFields, setTransferFields] = useState({
    productId: '',
    fromWarehouseId: '',
    toWarehouseId: '',
    lotNo: '',
    quantity: 10,
    notes: ''
  });

  // Direct Add Form State
  const [directAddFields, setDirectAddFields] = useState({
    productId: '',
    warehouseId: warehouses.find(w => w.isDefault)?.id || warehouses[0]?.id || '',
    lotNo: '',
    customLotNo: '',
    expiryDate: '2040-12-31',
    quantity: 100,
    notes: ''
  });

  // Expanded product ID for the Overview tab list details
  const [expandedProductIds, setExpandedProductIds] = useState<Record<string, boolean>>({});

  const isAdmin = currentUser.role === 'ADMIN';

  const toggleProductExpand = (productId: string) => {
    setExpandedProductIds(prev => ({
      ...prev,
      [productId]: !prev[productId]
    }));
  };

  // Calculations for KPI Cards
  const totalDistinctProducts = products.length;
  
  const totalStockAcrossAll = lots.reduce((sum, lot) => sum + (lot.currentStock || 0), 0);
  
  const activeSuppliersCount = suppliers.filter(s => s.active !== false).length;

  // Overview Tab Data filtering & mapping
  const filteredProductOverview = products.filter(p => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = (p.nameJa || '').toLowerCase().includes(query) ||
                          (p.nameEn || '').toLowerCase().includes(query) ||
                          (p.sku || '').toLowerCase().includes(query);
    
    return matchesSearch;
  });

  // Breakdown Tab Data filtering
  const filteredLotsBreakdown = lots.filter(lot => {
    const prod = products.find(p => p.id === lot.productId);
    const wh = warehouses.find(w => w.id === lot.warehouseId);
    
    const query = searchQuery.toLowerCase();
    const matchesSearch = (prod?.nameJa || '').toLowerCase().includes(query) ||
                          (prod?.sku || '').toLowerCase().includes(query) ||
                          lot.lotNo.toLowerCase().includes(query);

    const matchesWarehouse = selectedWarehouseId ? lot.warehouseId === selectedWarehouseId : true;
    const matchesSupplier = selectedSupplierId ? lot.lotNo.toUpperCase() === selectedSupplierId.toUpperCase() : true;

    return matchesSearch && matchesWarehouse && matchesSupplier;
  });

  // Handle Adjustment submit
  const handleAdjustmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingLot) return;
    if (adjustNewQty < 0) {
      alert('現在庫数は0以上にしてください。');
      return;
    }

    try {
      await onAdjustLot(adjustingLot.id, adjustNewQty, adjustNotes || '手動在庫調整');
      alert('在庫の調整が正常に完了しました。');
      setAdjustingLot(null);
      setAdjustNotes('');
    } catch (err) {
      console.error(err);
      alert('在庫調整中にエラーが発生しました。');
    }
  };

  // Handle direct addition
  const handleDirectAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalLot = (directAddFields.lotNo === 'custom' ? directAddFields.customLotNo : directAddFields.lotNo).trim().toUpperCase();
    
    if (!directAddFields.productId || !directAddFields.warehouseId || !finalLot) {
      alert('製剤、倉庫、入荷元は必須項目です。');
      return;
    }
    if (directAddFields.quantity <= 0) {
      alert('在庫数は1個以上にしてください。');
      return;
    }

    const targetProduct = products.find(p => p.id === directAddFields.productId);
    if (!targetProduct) return;

    try {
      await onAddStock({
        date: new Date().toISOString().substring(0, 10),
        productId: directAddFields.productId,
        warehouseId: directAddFields.warehouseId,
        lotNo: finalLot,
        expiryDate: directAddFields.expiryDate || '2040-12-31',
        quantity: directAddFields.quantity,
        purchasePrice: targetProduct.purchasePrice || 0,
        purchaseCurrency: targetProduct.purchaseCurrency || 'USD',
        notes: directAddFields.notes || '在庫管理画面からの初期直接入庫登録',
        operator: currentUser.name
      });

      alert('在庫ロットが正常に追加されました。');
      // Reset
      setDirectAddFields({
        productId: '',
        warehouseId: warehouses.find(w => w.isDefault)?.id || warehouses[0]?.id || '',
        lotNo: '',
        customLotNo: '',
        expiryDate: '2040-12-31',
        quantity: 100,
        notes: ''
      });
      setActiveTab('overview');
    } catch (err) {
      console.error(err);
      alert('在庫ロット追加中にエラーが発生しました。');
    }
  };

  // Handle Transfer stock submission
  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { productId, fromWarehouseId, toWarehouseId, lotNo, quantity, notes } = transferFields;

    if (!productId || !fromWarehouseId || !toWarehouseId || !lotNo || quantity <= 0) {
      alert('すべての項目を正しく入力してください。');
      return;
    }

    if (fromWarehouseId === toWarehouseId) {
      alert('移動元と移動先の倉庫は異なる必要があります。');
      return;
    }

    // Verify origin stock availability
    const sourceLot = lots.find(l => l.productId === productId && l.warehouseId === fromWarehouseId && l.lotNo.toUpperCase() === lotNo.toUpperCase());
    if (!sourceLot || sourceLot.currentStock < quantity) {
      alert(`移動元の在庫が不足しています。（現在庫: ${sourceLot?.currentStock || 0}）`);
      return;
    }

    try {
      if (onTransferStock) {
        await onTransferStock(productId, fromWarehouseId, toWarehouseId, lotNo, quantity, notes || '倉庫間在庫振替');
        alert('倉庫間での在庫振替が正常に処理されました。');
        setTransferFields({
          productId: '',
          fromWarehouseId: '',
          toWarehouseId: '',
          lotNo: '',
          quantity: 10,
          notes: ''
        });
        setActiveTab('overview');
      } else {
        alert('在庫振替機能は現在システム管理者によって制限されています。');
      }
    } catch (err) {
      console.error(err);
      alert('在庫振替処理中にエラーが発生しました。');
    }
  };

  // Handle delete lot
  const handleDeleteLotClick = (lotId: string, lotNo: string, currentStock: number) => {
    if (!isAdmin) {
      alert('管理者権限のみロットの削除が可能です。');
      return;
    }
    setLotToDelete({ id: lotId, lotNo, currentStock });
  };

  // Auto-fill form helper on breakdown click
  const openTransferForLot = (lot: InventoryLot) => {
    setTransferFields({
      productId: lot.productId,
      fromWarehouseId: lot.warehouseId,
      toWarehouseId: warehouses.find(w => w.id !== lot.warehouseId)?.id || '',
      lotNo: lot.lotNo,
      quantity: Math.min(lot.currentStock, 10),
      notes: `倉庫別在庫移動調整`
    });
    setActiveTab('transfer');
  };

  return (
    <div className="space-y-6" id="stock-management-root">
      
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 bg-blue-50 text-blue-600 rounded-md">
              <Boxes className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold text-slate-900">在庫一元管理・倉庫間振替</h2>
          </div>
          <p className="text-xs text-slate-500">
            全拠点の製剤現在庫、入荷元（仕入先）ロット、有効期限を監視し、手動の在庫調整や倉庫間移動を一元管理します。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab('direct-add')}
            className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            在庫の直接追加
          </button>
          
          <button
            onClick={() => setActiveTab('transfer')}
            className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            倉庫間の在庫振替
          </button>
        </div>
      </div>

      {/* KPI Metrics Dashboard Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        {/* Metric 1 */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs flex items-center gap-4">
          <div className="w-10 h-10 bg-slate-50 text-slate-600 rounded-lg flex items-center justify-center shrink-0 border border-slate-100">
            <Boxes className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">総登録製剤数</span>
            <span className="text-lg font-extrabold text-slate-800 font-mono">{totalDistinctProducts} <span className="text-xs font-semibold text-slate-500">SKU</span></span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-50/50 text-blue-600 rounded-lg flex items-center justify-center shrink-0 border border-blue-50/10">
            <Warehouse className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">全拠点 総合現在庫</span>
            <span className="text-lg font-extrabold text-blue-600 font-mono">
              {totalStockAcrossAll.toLocaleString()} <span className="text-xs font-semibold text-slate-400">個</span>
            </span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs flex items-center gap-4">
          <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center shrink-0 border border-indigo-100">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">有効な登録入荷元マスタ</span>
            <span className="text-lg font-extrabold text-indigo-600 font-mono">
              {activeSuppliersCount} <span className="text-xs font-semibold text-slate-400">社</span>
            </span>
          </div>
        </div>

      </div>

      {/* Tabs Layout */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        
        {/* Inner Tab Links */}
        <div className="flex border-b border-slate-100 bg-slate-50/50 overflow-x-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-5 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'overview' 
                ? 'border-blue-600 text-blue-600 bg-white' 
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50/20'
            }`}
          >
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4" />
              <span>製剤別 在庫集計</span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('breakdown')}
            className={`px-5 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'breakdown' 
                ? 'border-blue-600 text-blue-600 bg-white' 
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50/20'
            }`}
          >
            <div className="flex items-center gap-2">
              <Warehouse className="w-4 h-4" />
              <span>ロケーション・入荷元別内訳</span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('direct-add')}
            className={`px-5 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'direct-add' 
                ? 'border-blue-600 text-blue-600 bg-white' 
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50/20'
            }`}
          >
            <div className="flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-600" />
              <span>初期在庫ロット追加</span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('transfer')}
            className={`px-5 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'transfer' 
                ? 'border-blue-600 text-blue-600 bg-white' 
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50/20'
            }`}
          >
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-blue-600" />
              <span>拠点間の在庫振替</span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`px-5 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'history' 
                ? 'border-blue-600 text-blue-600 bg-white' 
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50/20'
            }`}
          >
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-indigo-600" />
              <span>最近の在庫変動履歴</span>
            </div>
          </button>
        </div>

        {/* Tab 1: aggregated overview by product */}
        {activeTab === 'overview' && (
          <div className="p-4 space-y-4">
            
            {/* Filter controls */}
            <div className="flex flex-col sm:flex-row gap-3 items-center">
              <div className="relative w-full sm:max-w-md">
                <Search className="absolute left-3 top-2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="製剤名、SKU、メーカーなどで検索..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* List Table */}
            <div className="overflow-x-auto rounded-lg border border-slate-100">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                    <th className="px-4 py-2.5 w-10"></th>
                    <th className="px-4 py-2.5 w-24">SKU / 製品ID</th>
                    <th className="px-4 py-2.5">製品名 (日本語)</th>
                    <th className="px-4 py-2.5">製品名 (英語 / インボイス用)</th>
                    <th className="px-4 py-2.5">保管状況（ロケーション内訳）</th>
                    <th className="px-4 py-2.5 text-right w-36">総現在庫</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-600">
                  {filteredProductOverview.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-slate-400 font-medium">
                        該当する製剤データが見つかりません。
                      </td>
                    </tr>
                  ) : (
                    filteredProductOverview.map(p => {
                      const productLots = lots.filter(l => l.productId === p.id);
                      const actualStock = productLots.reduce((sum, l) => sum + (l.currentStock || 0), 0);
                      const isExpanded = !!expandedProductIds[p.id];

                      // Count by warehouse
                      const whCounts = productLots.reduce((acc, l) => {
                        const whName = warehouses.find(w => w.id === l.warehouseId)?.name || '不明';
                        if (l.currentStock > 0) {
                          acc[whName] = (acc[whName] || 0) + l.currentStock;
                        }
                        return acc;
                      }, {} as Record<string, number>);

                      const locationSummary = Object.entries(whCounts).map(([name, qty]) => `${name}: ${qty}${p.unit}`).join(', ') || '在庫なし';

                      return (
                        <React.Fragment key={p.id}>
                          <tr className={`hover:bg-slate-50/40 transition-colors ${isExpanded ? 'bg-blue-50/10' : ''}`}>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => toggleProductExpand(p.id)}
                                className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 cursor-pointer"
                              >
                                {isExpanded ? '▼' : '▶'}
                              </button>
                            </td>
                            <td className="px-4 py-3 font-mono font-bold text-slate-800">
                              {p.sku}
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-bold text-slate-800">{p.nameJa}</div>
                              <div className="text-[10px] text-slate-400 font-mono">{p.manufacturer} • {p.spec}</div>
                            </td>
                            <td className="px-4 py-3 font-mono text-slate-500 max-w-xs truncate">
                              {p.nameEn}
                            </td>
                            <td className="px-4 py-3 text-slate-500 text-[11px] font-medium">
                              {locationSummary}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="font-bold font-mono text-sm text-slate-800">
                                {actualStock}
                              </span>
                              <span className="text-slate-400 font-mono text-[10px] ml-1">{p.unit}</span>
                            </td>
                          </tr>

                          {/* Expanded detail row showing constituent lots/suppliers */}
                          {isExpanded && (
                            <tr>
                              <td colSpan={6} className="bg-slate-50/50 p-4 border-l-2 border-blue-500">
                                <div className="space-y-2">
                                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                                    [入荷元・ロット別在庫詳細情報]
                                  </div>
                                  {productLots.length === 0 ? (
                                    <div className="text-slate-400 text-[11px]">現在庫ロットは登録されていません。新規入庫登録を行ってください。</div>
                                  ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                      {productLots.map(l => {
                                        const wh = warehouses.find(w => w.id === l.warehouseId);
                                        const isLotExpired = l.expiryDate ? new Date(l.expiryDate) < new Date() : false;
                                        return (
                                          <div key={l.id} className="bg-white p-3 rounded-lg border border-slate-200/60 shadow-xs flex flex-col justify-between">
                                            <div>
                                              <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1.5 mb-2">
                                                <span className="font-bold text-slate-800 font-mono text-[13px] flex items-center gap-1.5">
                                                  <Truck className="w-3.5 h-3.5 text-blue-500" />
                                                  {l.lotNo}
                                                </span>
                                                <span className="font-bold text-blue-600 font-mono text-sm">
                                                  {l.currentStock} {p.unit}
                                                </span>
                                              </div>
                                              <div className="space-y-1 text-[11px]">
                                                <div className="flex justify-between text-slate-500">
                                                  <span>保管倉庫:</span>
                                                  <span className="font-semibold text-slate-700">{wh?.name || '不明'}</span>
                                                </div>
                                                <div className="flex justify-between text-slate-500">
                                                  <span>有効期限:</span>
                                                  <span className={`font-mono font-semibold ${isLotExpired ? 'text-red-500' : 'text-slate-700'}`}>
                                                    {l.expiryDate && l.expiryDate !== '2040-12-31' ? l.expiryDate : '設定なし'}
                                                    {isLotExpired && ' (期限切れ)'}
                                                  </span>
                                                </div>
                                              </div>
                                            </div>

                                            <div className="flex items-center justify-end gap-1.5 mt-3 pt-2 border-t border-slate-100">
                                              <button
                                                onClick={() => {
                                                  setAdjustingLot(l);
                                                  setAdjustNewQty(l.currentStock);
                                                  setAdjustNotes('');
                                                }}
                                                className="px-2 py-1 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors cursor-pointer"
                                              >
                                                手動調整
                                              </button>
                                              <button
                                                onClick={() => openTransferForLot(l)}
                                                className="px-2 py-1 text-[10px] font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 rounded transition-colors cursor-pointer"
                                              >
                                                他倉庫へ振替
                                              </button>
                                              {isAdmin && (
                                                <button
                                                  onClick={() => handleDeleteLotClick(l.id, l.lotNo, l.currentStock)}
                                                  className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors cursor-pointer"
                                                  title="削除"
                                                >
                                                  <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Breakdown list by warehouse & lot */}
        {activeTab === 'breakdown' && (
          <div className="p-4 space-y-4">
            
            {/* Filter bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="製剤名、SKU、ロット名で検索..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <select
                  value={selectedWarehouseId}
                  onChange={(e) => setSelectedWarehouseId(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none"
                >
                  <option value="">-- 全保管倉庫で絞り込み --</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none font-semibold"
                >
                  <option value="">-- 全入荷元で絞り込み --</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.supplierId}>{s.name} ({s.supplierId})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Breakdown table */}
            <div className="overflow-x-auto rounded-lg border border-slate-100">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                    <th className="px-4 py-2.5">製剤 (SKU)</th>
                    <th className="px-4 py-2.5">保管倉庫</th>
                    <th className="px-4 py-2.5">入荷元・仕入先</th>
                    <th className="px-4 py-2.5">有効期限</th>
                    <th className="px-4 py-2.5 text-right w-24">現在庫数</th>
                    <th className="px-4 py-2.5 text-right w-44">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-600">
                  {filteredLotsBreakdown.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-slate-400 font-medium">
                        該当するロット在庫データが見つかりません。
                      </td>
                    </tr>
                  ) : (
                    filteredLotsBreakdown.map(lot => {
                      const prod = products.find(p => p.id === lot.productId);
                      const wh = warehouses.find(w => w.id === lot.warehouseId);
                      const isExpired = lot.expiryDate ? new Date(lot.expiryDate) < new Date() : false;

                      return (
                        <tr key={lot.id} className="hover:bg-slate-50/40 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-bold text-slate-800">{prod?.nameJa || '不明な製剤'}</div>
                            <div className="text-[10px] text-slate-400 font-mono">SKU: {prod?.sku || '-'}</div>
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-700">
                            {wh?.name || '不明'}
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-slate-700 flex items-center gap-1">
                            <Truck className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                            {lot.lotNo}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`font-mono font-semibold ${isExpired ? 'text-red-500' : 'text-slate-600'}`}>
                              {lot.expiryDate && lot.expiryDate !== '2040-12-31' ? lot.expiryDate : '設定なし'}
                              {isExpired && ' (期限切れ)'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-bold font-mono text-slate-900 text-sm">
                            {lot.currentStock} <span className="text-[10px] text-slate-400 font-normal">{prod?.unit}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => {
                                  setAdjustingLot(lot);
                                  setAdjustNewQty(lot.currentStock);
                                  setAdjustNotes('');
                                }}
                                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded cursor-pointer"
                              >
                                在庫調整
                              </button>
                              <button
                                onClick={() => openTransferForLot(lot)}
                                className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded cursor-pointer"
                              >
                                倉庫振替
                              </button>
                              {isAdmin && (
                                <button
                                  onClick={() => handleDeleteLotClick(lot.id, lot.lotNo, lot.currentStock)}
                                  className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded transition-colors cursor-pointer"
                                  title="削除"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
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

        {/* Tab 3: Direct stock addition */}
        {activeTab === 'direct-add' && (
          <div className="p-6 max-w-3xl mx-auto space-y-6">
            
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-1.5">
                <Plus className="w-5 h-5 text-emerald-600" />
                <span>新規在庫ロット登録 (マスタ同期)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                仕入れ伝票などを介さず、実地棚卸（初期在庫設定）などで新たに特定倉庫に在庫を直接紐付け登録します。
              </p>
            </div>

            <form onSubmit={handleDirectAddSubmit} className="space-y-4 text-xs">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Product Select */}
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    対象製剤 <span className="text-red-500">*</span>
                  </label>
                  <SearchableSelect
                    options={[...products]
                      .filter(p => p.active !== false)
                      .sort((a, b) => {
                        const nameA = a.nameJa || a.sku || '';
                        const nameB = b.nameJa || b.sku || '';
                        return nameA.localeCompare(nameB, 'en', { sensitivity: 'base' });
                      })
                      .map(p => ({
                        value: p.id,
                        label: p.nameJa || p.sku || '名称未設定',
                        subLabel: `SKU: ${p.sku}`,
                        badge: p.spec || p.unit
                      }))
                    }
                    value={directAddFields.productId}
                    onChange={(val) => setDirectAddFields(prev => ({ ...prev, productId: val }))}
                    placeholder="-- 対象製剤を検索して選択 --"
                    searchPlaceholder="製剤名・SKUで検索..."
                  />
                </div>

                {/* Warehouse Select */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    保管倉庫 <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={directAddFields.warehouseId}
                    onChange={(e) => setDirectAddFields(prev => ({ ...prev, warehouseId: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name} ({w.nameEn})</option>
                    ))}
                  </select>
                </div>

                {/* Expiry Date */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    有効期限 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={directAddFields.expiryDate}
                    onChange={(e) => setDirectAddFields(prev => ({ ...prev, expiryDate: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Supplier (LotNo) select */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    入荷元（仕入先マスタ連携） <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={directAddFields.lotNo}
                    onChange={(e) => setDirectAddFields(prev => ({ ...prev, lotNo: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">-- 入荷元を選択してください --</option>
                    {suppliers.filter(s => s.active !== false).map(s => (
                      <option key={s.id} value={s.supplierId}>{s.name} ({s.supplierId})</option>
                    ))}
                    <option value="custom">-- マスタにない入荷元（直接入力） --</option>
                  </select>
                </div>

                {/* Custom LotNo input if chosen */}
                {directAddFields.lotNo === 'custom' && (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      直接入力：新規入荷元コード/ロット <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={directAddFields.customLotNo}
                      onChange={(e) => setDirectAddFields(prev => ({ ...prev, customLotNo: e.target.value }))}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono font-bold uppercase focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g. SPL-CUSTOM-LOT"
                    />
                  </div>
                )}

                {/* Starting stock */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    新規登録在庫数量 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={directAddFields.quantity}
                    onChange={(e) => setDirectAddFields(prev => ({ ...prev, quantity: Number(e.target.value) }))}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold font-mono focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Notes */}
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    登録事由・メモ
                  </label>
                  <textarea
                    rows={2}
                    value={directAddFields.notes}
                    onChange={(e) => setDirectAddFields(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-500"
                    placeholder="e.g. 実地棚卸に伴う初期在庫差異調整、スポット仕入れなど"
                  />
                </div>

              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('overview')}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-lg font-bold text-slate-600 transition-colors cursor-pointer"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  在庫ロットを確定登録する
                </button>
              </div>

            </form>
          </div>
        )}

        {/* Tab 4: Stock transfer form */}
        {activeTab === 'transfer' && (
          <div className="p-6 max-w-3xl mx-auto space-y-6">
            
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-1.5">
                <ArrowRightLeft className="w-5 h-5 text-blue-600" />
                <span>倉庫間 在庫振替処理（ロケーション変更）</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                江南倉庫からナンバーワン倉庫、またはその他の倉庫間へ、特定入荷元ロットの在庫を指定数量だけ物理移動させます。
              </p>
            </div>

            <form onSubmit={handleTransferSubmit} className="space-y-4 text-xs">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Product Select */}
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    移動対象製剤 <span className="text-red-500">*</span>
                  </label>
                  <SearchableSelect
                    options={[...products]
                      .filter(p => p.active !== false)
                      .sort((a, b) => {
                        const nameA = a.nameJa || a.sku || '';
                        const nameB = b.nameJa || b.sku || '';
                        return nameA.localeCompare(nameB, 'en', { sensitivity: 'base' });
                      })
                      .map(p => ({
                        value: p.id,
                        label: p.nameJa || p.sku || '名称未設定',
                        subLabel: `SKU: ${p.sku}`,
                        badge: p.spec || p.unit
                      }))
                    }
                    value={transferFields.productId}
                    onChange={(val) => setTransferFields(prev => ({
                      ...prev,
                      productId: val,
                      lotNo: ''
                    }))}
                    placeholder="-- 移動する製剤を選択 --"
                    searchPlaceholder="製剤名・SKUで検索..."
                  />
                </div>

                {/* From Warehouse Select */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    移動元（搬出倉庫） <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={transferFields.fromWarehouseId}
                    onChange={(e) => setTransferFields(prev => ({ ...prev, fromWarehouseId: e.target.value, lotNo: '' }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">-- 移動元の保管倉庫を選択 --</option>
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>

                {/* To Warehouse Select */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    移動先（搬入倉庫） <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={transferFields.toWarehouseId}
                    onChange={(e) => setTransferFields(prev => ({ ...prev, toWarehouseId: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">-- 移動先の搬入倉庫を選択 --</option>
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>

                {/* Lot/Supplier Select based on product and from warehouse */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    対象ロット・入荷元 <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={transferFields.lotNo}
                    onChange={(e) => setTransferFields(prev => ({ ...prev, lotNo: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">-- 移動可能なロットを選択 --</option>
                    {lots
                      .filter(l => l.productId === transferFields.productId && l.warehouseId === transferFields.fromWarehouseId && l.currentStock > 0)
                      .map(l => (
                        <option key={l.id} value={l.lotNo}>{l.lotNo} (現在庫: {l.currentStock})</option>
                      ))
                    }
                  </select>
                </div>

                {/* Transfer Quantity */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    移動数量 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={transferFields.quantity}
                    onChange={(e) => setTransferFields(prev => ({ ...prev, quantity: Number(e.target.value) }))}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold font-mono focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Notes */}
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    備考・移動理由
                  </label>
                  <textarea
                    rows={2}
                    value={transferFields.notes}
                    onChange={(e) => setTransferFields(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-500"
                    placeholder="e.g. 拠点別需要不均衡に伴う実在庫移動、期限切れ間近の配送調整など"
                  />
                </div>

              </div>

              {/* Warnings explanation */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3.5 flex gap-2.5 items-start">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-[11px] text-amber-800 leading-relaxed">
                  <strong>自動同期処理:</strong> この操作を確定すると、移動元倉庫の該当ロット在庫から数量が差し引かれ、移動先倉庫に該当ロット在庫が加算されます。また、製品マスタの総在庫数に変更は生じませんが、履歴に振替記録（搬出と搬入）が監査可能に記録されます。
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('overview')}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-lg font-bold text-slate-600 transition-colors cursor-pointer"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  在庫振替を処理する
                </button>
              </div>

            </form>
          </div>
        )}

        {/* Tab 5: Recent transactions logs */}
        {activeTab === 'history' && (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-4">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">最近の在庫増減履歴 (直近20件)</h3>
              <span className="text-[10px] text-slate-400 font-mono">Real-time ledger</span>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-100">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                    <th className="px-4 py-2.5 w-40">発生日時</th>
                    <th className="px-4 py-2.5 w-20">種別</th>
                    <th className="px-4 py-2.5">対象製剤</th>
                    <th className="px-4 py-2.5">倉庫ロケーション</th>
                    <th className="px-4 py-2.5">入荷元・ロット</th>
                    <th className="px-4 py-2.5 text-right w-24">増減数</th>
                    <th className="px-4 py-2.5">担当・メモ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-600">
                  {transactions.slice(0, 20).length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-slate-400 font-medium">
                        取引履歴がありません。
                      </td>
                    </tr>
                  ) : (
                    transactions.slice(0, 20).map((tx) => {
                      const isQtyPositive = tx.quantity > 0;
                      const matchingProd = products.find(p => p.id === tx.productId);
                      const displaySku = matchingProd?.sku || (tx as any).sku || 'N/A';
                      return (
                        <tr key={tx.id} className="hover:bg-slate-50/20 transition-colors font-mono">
                          <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                            {tx.date}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-block font-extrabold px-1.5 py-0.5 rounded text-[9px] text-center w-12 ${
                              tx.type === 'IN' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                              tx.type === 'OUT' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                              'bg-indigo-50 text-indigo-700 border border-indigo-100'
                            }`}>
                              {tx.type === 'IN' ? '入庫' : tx.type === 'OUT' ? '出庫' : '在庫調整'}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-sans">
                            <div className="font-bold text-slate-800">{tx.productNameJa}</div>
                            <div className="text-[10px] text-slate-400">SKU: {displaySku}</div>
                          </td>
                          <td className="px-4 py-3 font-sans font-semibold text-slate-700">
                            {tx.warehouseName}
                          </td>
                          <td className="px-4 py-3 text-slate-700 font-bold flex items-center gap-1">
                            <Truck className="w-3.5 h-3.5 text-blue-400" />
                            {tx.lotNo}
                          </td>
                          <td className={`px-4 py-3 text-right font-bold font-mono text-sm ${isQtyPositive ? 'text-emerald-600' : 'text-red-500'}`}>
                            {isQtyPositive ? `+${tx.quantity}` : tx.quantity}
                          </td>
                          <td className="px-4 py-3 font-sans space-y-0.5 max-w-xs">
                            <div className="text-slate-700 font-semibold text-[10px]">実行者: {tx.user}</div>
                            <div className="text-slate-400 text-[10px] truncate" title={tx.notes}>{tx.notes}</div>
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

      </div>

      {/* Adjust Inventory Lot Stock Dialog */}
      {adjustingLot && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-slate-100 shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <span className="p-1 bg-blue-100 text-blue-700 rounded">
                  <Sliders className="w-4 h-4" />
                </span>
                <h3 className="font-bold text-slate-900 text-sm">手動在庫数量の調整</h3>
              </div>
              <button 
                onClick={() => setAdjustingLot(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAdjustmentSubmit} className="p-6 space-y-4 text-xs">
              
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-1.5 leading-relaxed">
                <div className="flex justify-between text-slate-500">
                  <span>対象製剤:</span>
                  <span className="font-bold text-slate-800">
                    {products.find(p => p.id === adjustingLot.productId)?.nameJa || '製剤'}
                  </span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>保管倉庫:</span>
                  <span className="font-semibold text-slate-700">
                    {warehouses.find(w => w.id === adjustingLot.warehouseId)?.name || '倉庫'}
                  </span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>入荷元・ロット:</span>
                  <span className="font-mono font-bold text-blue-700">
                    {adjustingLot.lotNo}
                  </span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>以前の現在庫数:</span>
                  <span className="font-mono font-bold text-slate-700">
                    {adjustingLot.currentStock}
                  </span>
                </div>
              </div>

              {/* New stock entry */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  新しい現在庫数 <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={adjustNewQty}
                  onChange={(e) => setAdjustNewQty(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold font-mono focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Adjust Notes */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  調整の事由・備考 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                  placeholder="e.g. 棚卸補正、破損廃棄、サンプル利用など"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAdjustingLot(null)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-lg font-bold text-slate-600 transition-colors cursor-pointer"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  調整内容を確定する
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {lotToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-slate-100 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-red-600">
              <span className="p-2 bg-red-50 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </span>
              <h3 className="text-sm font-extrabold text-slate-900">在庫ロット削除の確認</h3>
            </div>
            
            <p className="text-xs text-slate-600 leading-relaxed">
              本当にこの入荷元ロット「<strong className="font-semibold text-slate-800">{lotToDelete.lotNo}</strong>」の在庫情報を削除しますか？
            </p>
            
            {lotToDelete.currentStock > 0 && (
              <div className="bg-red-50 border border-red-100 text-red-800 rounded-lg p-3 text-[11px] leading-normal font-medium">
                ⚠️ <strong>警告:</strong> 現在庫が <strong>{lotToDelete.currentStock}</strong> 件残っています。削除すると在庫データが失われ、製品在庫数に不一致が生じる可能性があります。
              </div>
            )}
            
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setLotToDelete(null)}
                className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg font-bold text-xs transition-colors cursor-pointer"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={async () => {
                  const { id } = lotToDelete;
                  setLotToDelete(null);
                  try {
                    if (onDeleteLot) {
                      await onDeleteLot(id);
                      alert('在庫ロットが削除されました。');
                    }
                  } catch (err) {
                    console.error(err);
                    alert('削除処理中にエラーが発生しました。');
                  }
                }}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-xs transition-colors cursor-pointer shadow-xs"
              >
                完全に削除する
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// Inline component helper for Modal Close Button
function X({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

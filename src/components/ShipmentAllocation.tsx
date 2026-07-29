import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Calculator, 
  AlertTriangle, 
  Save, 
  CheckCircle2, 
  FileText,
  Truck,
  FileEdit,
  ChevronDown,
  ChevronUp,
  Download,
  Clock,
  ArrowRight
} from 'lucide-react';
import { 
  Product, 
  Warehouse, 
  Clinic, 
  ShipmentItem, 
  InventoryLot, 
  User, 
  SystemSettings,
  Shipment 
} from '../types';
import SearchableSelect from './SearchableSelect';
import { generateInvoicePDF, loadJapaneseFont } from '../lib/pdf';

interface ShipmentAllocationProps {
  products: Product[];
  warehouses: Warehouse[];
  clinics: Clinic[];
  lots: InventoryLot[];
  currentUser: User;
  settings: SystemSettings;
  onSubmitShipment: (shipmentData: any, status: 'DRAFT' | 'CONFIRMED') => Promise<{ invoiceNo: string; shipment: Shipment }>;
  shipments?: Shipment[];
  onDeleteShipment?: (id: string) => Promise<void>;
  onUpdateShipmentStatus?: (id: string, status: Shipment['status'], trackingNo?: string) => Promise<void>;
  initialPayload?: any;
  onClearInitialPayload?: () => void;
}

export default function ShipmentAllocation({
  products,
  warehouses,
  clinics,
  lots,
  currentUser,
  settings,
  onSubmitShipment,
  shipments = [],
  onDeleteShipment,
  onUpdateShipmentStatus,
  initialPayload,
  onClearInitialPayload
}: ShipmentAllocationProps) {
  
  // States
  const [date, setDate] = useState(new Date().toISOString().substring(0, 10));
  const [warehouseId, setWarehouseId] = useState('');
  const [clinicId, setClinicId] = useState('');
  const [currency, setCurrency] = useState<'USD' | 'KRW' | 'JPY' | 'EUR'>('JPY');
  const [courier, setCourier] = useState('EMS / DHL');
  const [trackingNo, setTrackingNo] = useState('');
  const [shippingCost, setShippingCost] = useState(0);
  const [insurance, setInsurance] = useState(0);
  const [otherCharges, setOtherCharges] = useState(0);
  const [notes, setNotes] = useState('');
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // UI States
  const [showDraftsList, setShowDraftsList] = useState(false);
  const [successToast, setSuccessToast] = useState<{ message: string; pdfUrl?: string; fileName?: string } | null>(null);

  // Filter drafts from shipments
  const draftShipments = shipments.filter(s => s.status === 'DRAFT');

  // Shipment Items list
  const [items, setItems] = useState<{
    id: string; // React list key
    productId: string;
    sku: string;
    nameEn: string;
    nameJa: string;
    lotNo: string;
    expiryDate: string;
    qty: number;
    unit: string;
    unitPrice: number;
    weight: number;
    hsCode: string;
    countryOfOrigin: string;
    availableLots: InventoryLot[]; // Lots available in the selected warehouse
    selectedLotMaxStock: number; // Selected lot current stock
    warningMsg: string;
  }[]>([]);

  // Initialize Warehouse and Currency from settings / default warehouse
  useEffect(() => {
    if (warehouses && warehouses.length > 0) {
      const defaultW = warehouses.find(w => w.id === settings?.defaultWarehouseId) || warehouses.find(w => w.isDefault) || warehouses[0];
      if (defaultW) {
        setWarehouseId(prev => prev || defaultW.id);
      }
    }
    if (settings?.currency) {
      setCurrency(settings.currency);
    }
  }, [settings, warehouses]);

  // Load initial payload or draft if provided via props
  useEffect(() => {
    if (initialPayload) {
      loadDraftIntoForm(initialPayload);
    }
  }, [initialPayload]);

  const loadDraftIntoForm = (draft: any) => {
    if (draft.id) setEditingDraftId(draft.id);
    if (draft.date) setDate(draft.date);
    if (draft.warehouseId) setWarehouseId(draft.warehouseId);
    if (draft.clinicId) setClinicId(draft.clinicId);
    if (draft.currency) setCurrency(draft.currency);
    if (draft.courier) setCourier(draft.courier);
    if (draft.trackingNo) setTrackingNo(draft.trackingNo);
    if (draft.shippingCost !== undefined) setShippingCost(draft.shippingCost);
    if (draft.insurance !== undefined) setInsurance(draft.insurance);
    if (draft.otherCharges !== undefined) setOtherCharges(draft.otherCharges);
    if (draft.notes) setNotes(draft.notes);

    const targetWarehouseId = draft.warehouseId || warehouseId;

    if (draft.items && draft.items.length > 0) {
      const mappedItems = draft.items.map((it: any) => {
        const product = products.find(p => p.id === it.productId);
        const productLots = lots.filter(l => l.productId === it.productId && (!targetWarehouseId || !l.warehouseId || l.warehouseId === targetWarehouseId) && l.currentStock > 0);
        const sortedLots = [...productLots].sort((a, b) => (a.expiryDate || '').localeCompare(b.expiryDate || ''));
        const chosenLot = sortedLots.find(l => l.lotNo === it.lotNo) || sortedLots[0];
        const maxStock = productLots.length > 0
          ? productLots.reduce((sum, l) => sum + (l.currentStock || 0), 0)
          : (product?.currentStock !== undefined ? product.currentStock : 99999);

        return {
          id: Math.random().toString(36).substring(2, 9),
          productId: it.productId,
          sku: it.sku || '',
          nameEn: it.nameEn || '',
          nameJa: it.nameJa || '',
          lotNo: it.lotNo || (chosenLot ? chosenLot.lotNo : 'LOT-TEMP'),
          expiryDate: it.expiryDate || (chosenLot ? chosenLot.expiryDate : ''),
          qty: it.qty || 1,
          unit: it.unit || 'pcs',
          unitPrice: it.unitPrice || 0,
          weight: it.weight || 0.03,
          hsCode: it.hsCode || '',
          countryOfOrigin: it.countryOfOrigin || 'Korea',
          availableLots: sortedLots,
          selectedLotMaxStock: maxStock,
          warningMsg: (it.qty || 1) > maxStock ? `警告: 在庫不足 (現在庫: ${maxStock})` : ''
        };
      });
      setItems(mappedItems);
    }
  };

  // Handle warehouse changes (refresh available lots for all lines)
  const handleWarehouseChange = (wId: string) => {
    setWarehouseId(wId);
    
    // Recalculate available lots and FEFO choices for existing lines
    setItems(prev => prev.map(item => {
      if (!item.productId) return item;
      const product = products.find(p => p.id === item.productId);
      
      const productLots = lots.filter(l => l.productId === item.productId && (!wId || !l.warehouseId || l.warehouseId === wId) && l.currentStock > 0);
      const sortedLots = [...productLots].sort((a, b) => (a.expiryDate || '').localeCompare(b.expiryDate || ''));
      
      const chosenLot = sortedLots[0];
      const maxStock = productLots.length > 0
        ? productLots.reduce((sum, l) => sum + (l.currentStock || 0), 0)
        : (product?.currentStock !== undefined ? product.currentStock : 99999);
      const lotNo = chosenLot ? chosenLot.lotNo : (item.lotNo || product?.lotNo || 'LOT-TEMP');
      const expiryDate = chosenLot ? chosenLot.expiryDate : (item.expiryDate || product?.expiryDate || '');
      
      const warningMsg = item.qty > maxStock ? `警告: 在庫不足 (倉庫内現在庫: ${maxStock})` : '';

      return {
        ...item,
        lotNo,
        expiryDate,
        selectedLotMaxStock: maxStock,
        availableLots: sortedLots,
        warningMsg
      };
    }));
  };

  // Add clean row
  const handleAddItemRow = () => {
    const uniqueId = Math.random().toString(36).substring(2, 9);
    setItems(prev => [
      ...prev,
      {
        id: uniqueId,
        productId: '',
        sku: '',
        nameEn: '',
        nameJa: '',
        lotNo: '',
        expiryDate: '',
        qty: 1,
        unit: 'pcs',
        unitPrice: 0,
        weight: 0.03,
        hsCode: '',
        countryOfOrigin: '',
        availableLots: [],
        selectedLotMaxStock: 99999,
        warningMsg: ''
      }
    ]);
  };

  // Remove row
  const handleRemoveItemRow = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  // Handle product select on item row (Implements FEFO)
  const handleRowProductSelect = (id: string, prodId: string) => {
    const product = products.find(p => p.id === prodId);
    if (!product) return;

    // FEFO: Get all lots for this product in current warehouse, sort by expiry date asc
    const productLots = lots.filter(l => l.productId === prodId && (!warehouseId || !l.warehouseId || l.warehouseId === warehouseId) && l.currentStock > 0);
    const sortedLots = [...productLots].sort((a, b) => (a.expiryDate || '').localeCompare(b.expiryDate || ''));
    
    // Choose the oldest lot first
    const chosenLot = sortedLots[0];
    const lotNo = chosenLot ? chosenLot.lotNo : (product.lotNo || 'LOT-TEMP');
    const expiryDate = chosenLot ? chosenLot.expiryDate : (product.expiryDate || '');
    const maxStock = productLots.length > 0
      ? productLots.reduce((sum, l) => sum + (l.currentStock || 0), 0)
      : (product.currentStock !== undefined ? product.currentStock : 99999);

    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;

      const qty = item.qty || 1;
      const warningMsg = qty > maxStock ? `警告: 在庫不足 (現在庫: ${maxStock})` : '';

      return {
        ...item,
        productId: prodId,
        sku: product.sku || '',
        nameJa: product.nameJa || '',
        nameEn: product.nameEn || '',
        lotNo: lotNo || '',
        expiryDate: expiryDate || '',
        unit: product.unit || 'pcs',
        unitPrice: product.invoicePrice || 0,
        weight: product.weight || 0.03,
        hsCode: product.hsCode || '3002.90',
        countryOfOrigin: product.countryOfOrigin || 'South Korea',
        availableLots: sortedLots,
        selectedLotMaxStock: maxStock,
        warningMsg
      };
    }));
  };

  // Handle lot changes manually on item row
  const handleRowLotSelect = (id: string, lotNum: string) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;

      // Find lot details
      const chosenLot = item.availableLots.find(l => l.lotNo === lotNum);
      const expiryDate = chosenLot ? chosenLot.expiryDate : item.expiryDate;
      const maxStock = chosenLot ? chosenLot.currentStock : item.selectedLotMaxStock;
      
      const qty = item.qty || 1;
      const warningMsg = qty > maxStock ? `警告: 在庫不足 (このロットの現在庫: ${maxStock})` : '';

      return {
        ...item,
        lotNo: lotNum,
        expiryDate,
        warningMsg
      };
    }));
  };

  // Update quantity on item row
  const handleRowQtyChange = (id: string, qty: number) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;

      const cleanQty = qty < 1 ? 1 : qty;
      const maxStock = item.selectedLotMaxStock;
      
      const isUnderExp = false; // check if expired
      let warningMsg = '';
      if (cleanQty > maxStock) {
        warningMsg = `警告: 在庫不足 (倉庫内現在庫: ${maxStock})`;
      }

      return {
        ...item,
        qty: cleanQty,
        warningMsg
      };
    }));
  };

  // Update price manually on item row
  const handleRowPriceChange = (id: string, price: number) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      return {
        ...item,
        unitPrice: price < 0 ? 0 : price
      };
    }));
  };

  // Calculations
  const totalQty = items.reduce((acc, item) => acc + (item.qty || 0), 0);
  const totalWeight = items.reduce((acc, item) => acc + ((item.qty || 0) * (item.weight || 0)), 0);
  const totalItemsAmount = items.reduce((acc, item) => acc + ((item.qty || 0) * (item.unitPrice || 0)), 0);
  const totalInvoiceAmount = totalItemsAmount + shippingCost + insurance + otherCharges;

  const hasWarnings = items.some(item => item.warningMsg.length > 0);
  const hasNoItems = items.length === 0 || items.some(item => !item.productId);

  // Submit allocation
  const handleFormSubmit = async (status: 'DRAFT' | 'CONFIRMED') => {
    if (isSubmitting) return;

    if (!warehouseId) {
      alert('発送元倉庫を選択してください。');
      return;
    }
    if (!clinicId) {
      alert('発送先クリニックを選択してください。');
      return;
    }

    const validItems = items.filter(it => it.productId && it.qty > 0);

    if (validItems.length === 0) {
      alert('発送する製剤を正しく1件以上選択・追加してください。「+ 製剤行を追加」ボタンを押して製剤を選択できます。');
      return;
    }

    if (items.some(it => !it.productId)) {
      alert('製剤が選択されていない行があります。製剤名を選択するか、不要な行を削除してください。');
      return;
    }

    if (status === 'CONFIRMED' && hasWarnings) {
      alert('在庫不足のアラートが出ている状態では、発送確定できません。数量を現在庫以下に変更するか、下書き保存をご利用ください。');
      return;
    }

    const conf = status === 'CONFIRMED' 
      ? window.confirm('この発送を【確定】してよろしいですか？\n確定すると即座に倉庫在庫から減算され、商用インボイス (PDF) が自動作成・ダウンロードされます。')
      : true;

    if (!conf) return;

    setIsSubmitting(true);
    try {
      const payload = {
        date,
        warehouseId,
        clinicId,
        currency,
        courier,
        trackingNo,
        shippingCost,
        insurance,
        otherCharges,
        notes,
        items: validItems.map(it => ({
          productId: it.productId,
          sku: it.sku,
          nameEn: it.nameEn,
          nameJa: it.nameJa,
          lotNo: it.lotNo,
          expiryDate: it.expiryDate,
          qty: it.qty,
          unit: it.unit,
          unitPrice: it.unitPrice,
          amount: it.qty * it.unitPrice,
          weight: it.weight,
          totalWeight: it.qty * it.weight,
          hsCode: it.hsCode,
          countryOfOrigin: it.countryOfOrigin
        })),
        totalQty,
        totalWeight,
        totalItemsAmount,
        totalInvoiceAmount
      };

      const { invoiceNo, shipment } = await onSubmitShipment(payload, status);

      // If we were editing an existing draft and now confirmed, clean up old draft
      if (editingDraftId && status === 'CONFIRMED' && onDeleteShipment) {
        await onDeleteShipment(editingDraftId);
        setEditingDraftId(null);
      }

      if (status === 'CONFIRMED') {
        // Auto generate and download Commercial Invoice PDF
        await loadJapaneseFont();
        const doc = generateInvoicePDF(shipment, settings);
        doc.save(`${invoiceNo}_INVOICE.pdf`);

        setSuccessToast({
          message: `発送の確定・出庫登録が完了しました！ インボイス（${invoiceNo}）のPDFを出力・ダウンロードしました。`,
          fileName: `${invoiceNo}_INVOICE.pdf`
        });
      } else {
        setSuccessToast({
          message: `発送情報を【下書き】（${invoiceNo}）として正常に保存しました。「保存済みの下書き一覧」からいつでも確認・再編集・確定ができます。`
        });
      }

      // Reset Allocation Form
      setClinicId('');
      setItems([]);
      setTrackingNo('');
      setNotes('');
      setShippingCost(0);
      setInsurance(0);
      setOtherCharges(0);
      if (onClearInitialPayload) onClearInitialPayload();
    } catch (err: any) {
      console.error(err);
      alert(`保存エラー: ${err.message || '不明なエラーが発生しました。'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">発送個別振り分け・インボイス作成</h2>
        <p className="text-xs text-slate-500">
          倉庫からの国内発送を作成します。製剤を選択すると、入荷元別の現在庫が自動で割り当てられます。
        </p>
      </div>

      {/* Success Notification Banner */}
      {successToast && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl p-4 shadow-sm flex items-start justify-between gap-3 animate-fadeIn">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-xs font-bold leading-relaxed">{successToast.message}</p>
              {successToast.fileName && (
                <p className="text-[11px] text-emerald-700">
                  📁 ダウンロードファイル名: <span className="font-mono font-bold">{successToast.fileName}</span>
                </p>
              )}
            </div>
          </div>
          <button 
            onClick={() => setSuccessToast(null)}
            className="text-emerald-700 hover:text-emerald-900 text-xs font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Saved Drafts List Drawer */}
      {draftShipments.length > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200/80 p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500 text-white rounded-lg shadow-sm">
                <FileEdit className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>保存済みの下書きデータ</span>
                  <span className="px-2 py-0.5 bg-amber-500 text-white rounded-full text-xs font-extrabold">
                    {draftShipments.length} 件
                  </span>
                </h3>
                <p className="text-xs text-slate-600">
                  作成途中で一時保存された発送データです。クリックしてフォームに読み込んで編集・確定できます。
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowDraftsList(!showDraftsList)}
              className="px-3 py-1.5 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <span>{showDraftsList ? '下書き一覧を隠す' : '下書き一覧を表示'}</span>
              {showDraftsList ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>

          {showDraftsList && (
            <div className="pt-2 border-t border-amber-200/60 grid grid-cols-1 md:grid-cols-2 gap-3">
              {draftShipments.map(draft => {
                const clinicName = draft.clinicSnapshot?.name || draft.clinicSnapshot?.nameEn || '未指定クリニック';
                const warehouseName = draft.warehouseSnapshot?.name || '未指定倉庫';
                
                return (
                  <div key={draft.id} className="bg-white rounded-lg border border-amber-200 p-3.5 shadow-sm hover:border-amber-400 transition-colors flex flex-col justify-between gap-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-200 font-mono">
                          {draft.invoiceNo}
                        </span>
                        <span className="text-[11px] text-slate-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {draft.date}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-slate-900 truncate">
                        🏥 {clinicName}
                      </div>
                      <div className="text-[11px] text-slate-600 flex items-center justify-between">
                        <span>🏢 {warehouseName}</span>
                        <span className="font-semibold text-slate-700">
                          {draft.items?.length || 0} 品目 ({draft.currency} {(draft.totalInvoiceAmount || 0).toLocaleString()})
                        </span>
                      </div>
                      {draft.items && draft.items.length > 0 && (
                        <p className="text-[11px] text-slate-500 truncate bg-slate-50 p-1.5 rounded border border-slate-100">
                          {draft.items.map(it => `${it.nameJa || it.nameEn} (${it.qty}${it.unit})`).join(', ')}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                      {onDeleteShipment && (
                        <button
                          onClick={async () => {
                            if (window.confirm(`下書き ${draft.invoiceNo} を削除してよろしいですか？`)) {
                              await onDeleteShipment(draft.id);
                            }
                          }}
                          className="px-2 py-1 text-red-600 hover:bg-red-50 rounded text-xs font-medium cursor-pointer transition-colors"
                        >
                          削除
                        </button>
                      )}

                      {onUpdateShipmentStatus && (
                        <button
                          onClick={async () => {
                            if (window.confirm(`下書き ${draft.invoiceNo} を今すぐ確定して出庫しますか？`)) {
                              try {
                                await onUpdateShipmentStatus(draft.id, 'CONFIRMED');
                                alert(`下書き ${draft.invoiceNo} を確定・出庫登録しました！`);
                              } catch (e: any) {
                                alert(`確定エラー: ${e.message}`);
                              }
                            }
                          }}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold cursor-pointer transition-colors shadow-sm"
                        >
                          直接確定
                        </button>
                      )}

                      <button
                        onClick={() => {
                          loadDraftIntoForm(draft);
                          setShowDraftsList(false);
                          window.scrollTo({ top: 180, behavior: 'smooth' });
                        }}
                        className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-bold cursor-pointer transition-colors shadow-sm flex items-center gap-1"
                      >
                        <span>編集・再読み込み</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main form (left side) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2.5 flex items-center gap-2">
              <Truck className="w-4.5 h-4.5 text-blue-500" />
              <span>基本発送情報</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">発送日 <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:border-blue-500 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">発送元倉庫 (Shipper) <span className="text-red-500">*</span></label>
                <select
                  value={warehouseId}
                  onChange={(e) => handleWarehouseChange(e.target.value)}
                  className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-500 font-semibold"
                >
                  <option value="">-- 倉庫を選択 --</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name} ({w.nameEn})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">発送先クリニック (Consignee) <span className="text-red-500">*</span></label>
                <SearchableSelect
                  options={[...clinics]
                    .filter(c => c.active !== false)
                    .sort((a, b) => {
                      const nameA = a.name || a.nameEn || '';
                      const nameB = b.name || b.nameEn || '';
                      return nameA.localeCompare(nameB, 'ja');
                    })
                    .map(c => {
                      const primaryName = c.name || c.nameEn || c.clinicId || 'Clinic';
                      const cleanEn = c.nameEn ? c.nameEn.replace(/\s*\([^)]*\)/g, '').trim() : '';
                      const secondaryName = (cleanEn && cleanEn !== c.name) ? cleanEn : undefined;
                      return {
                        value: c.id,
                        label: primaryName,
                        subLabel: secondaryName,
                        badge: c.clinicId
                      };
                    })
                  }
                  value={clinicId}
                  onChange={(val) => setClinicId(val)}
                  placeholder="-- クリニックを検索して選択 --"
                  searchPlaceholder="クリニック名・IDで検索..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">取引通貨</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as any)}
                  className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-500 font-semibold"
                >
                  <option value="USD">USD (米ドル)</option>
                  <option value="KRW">KRW (ウォン)</option>
                  <option value="JPY">JPY (円)</option>
                  <option value="EUR">EUR (ユーロ)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">配送会社</label>
                <input
                  type="text"
                  value={courier}
                  onChange={(e) => setCourier(e.target.value)}
                  className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-500 font-semibold"
                  placeholder="EMS / DHL"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">追跡番号 (Tracking Number)</label>
                <input
                  type="text"
                  value={trackingNo}
                  onChange={(e) => setTrackingNo(e.target.value.toUpperCase())}
                  className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:border-blue-500 font-semibold"
                  placeholder="EG123456789KR"
                />
              </div>
            </div>
          </div>

          {/* Details form block */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5 space-y-4 overflow-visible">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Calculator className="w-4.5 h-4.5 text-indigo-500" />
                <span>発送製剤明細</span>
              </h3>
              <button
                type="button"
                onClick={handleAddItemRow}
                disabled={!warehouseId}
                className="bg-blue-50 hover:bg-blue-100 disabled:bg-slate-100 text-blue-600 disabled:text-slate-400 font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>明細行を追加</span>
              </button>
            </div>

            {!warehouseId && (
              <div className="bg-slate-50 text-slate-500 border border-slate-200 p-6 rounded-lg text-center text-xs">
                明細を追加する前に、まず「発送元倉庫」を選択してください。
              </div>
            )}

            {warehouseId && items.length === 0 && (
              <div className="bg-slate-50 text-slate-400 border border-slate-200 p-8 rounded-lg text-center text-xs font-medium">
                出荷する製剤が登録されていません。「明細行を追加」ボタンを押して出荷登録をしてください。
              </div>
            )}

            {warehouseId && items.length > 0 && (
              <div className="space-y-4">
                {items.map((item, index) => (
                  <div 
                    key={item.id} 
                    className="p-4 rounded-xl border border-slate-200/85 shadow-xs space-y-3 relative hover:border-slate-300 transition-colors bg-slate-50/20"
                  >
                    {/* Delete button top right */}
                    <button
                      type="button"
                      onClick={() => handleRemoveItemRow(item.id)}
                      className="absolute right-3.5 top-3.5 text-slate-400 hover:text-red-600 transition-colors p-1 rounded-md hover:bg-slate-100 cursor-pointer"
                      title="明細削除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    {/* Form grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-7 gap-4 items-end">
                      
                      {/* Product dropdown */}
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">製剤名 <span className="text-red-500">*</span></label>
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
                          value={item.productId}
                          onChange={(val) => handleRowProductSelect(item.id, val)}
                          placeholder="-- 製剤を検索 --"
                          searchPlaceholder="製剤名・SKUで検索..."
                        />
                      </div>

                      {/* Lot number selector */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">入荷元 / 変更</label>
                        {item.availableLots.length === 0 ? (
                          <input
                            type="text"
                            value={item.lotNo}
                            disabled
                            className="w-full border border-slate-200 bg-slate-100 rounded px-2 py-1 text-xs font-mono font-bold"
                          />
                        ) : (
                          <select
                            value={item.lotNo}
                            onChange={(e) => handleRowLotSelect(item.id, e.target.value)}
                            className="w-full border border-slate-200 rounded px-2 py-1 text-xs font-mono font-bold bg-white"
                          >
                            {item.availableLots.map(l => (
                              <option key={l.id} value={l.lotNo}>{l.lotNo} (残: {l.currentStock})</option>
                            ))}
                          </select>
                        )}
                      </div>

                      {/* Quantity */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">発送数量 <span className="text-red-500">*</span></label>
                        <input
                          type="number"
                          required
                          min="1"
                          disabled={!item.productId}
                          value={item.qty}
                          onChange={(e) => handleRowQtyChange(item.id, Number(e.target.value))}
                          className="w-full border border-slate-200 rounded px-2 py-1 text-xs font-bold font-mono text-slate-900 bg-white"
                        />
                      </div>

                      {/* Unit Price */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">単価 (インボイス価格)</label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          disabled={!item.productId}
                          value={item.unitPrice}
                          onChange={(e) => handleRowPriceChange(item.id, Number(e.target.value))}
                          className="w-full border border-slate-200 rounded px-2 py-1 text-xs font-bold font-mono text-slate-900 bg-white"
                        />
                      </div>

                      {/* Calculation results */}
                      <div className="flex flex-col justify-end pb-1.5">
                        <span className="block text-[9px] font-bold text-slate-400 uppercase">明細小計金額</span>
                        <span className="font-mono font-bold text-slate-800 text-xs">
                          ¥{(item.qty * item.unitPrice).toLocaleString()} JPY
                        </span>
                      </div>

                      <div className="flex flex-col justify-end pb-1.5">
                        <span className="block text-[9px] font-bold text-slate-400 uppercase">梱包総重量</span>
                        <span className="font-mono font-medium text-slate-500 text-xs">
                          {(item.qty * item.weight).toFixed(3)} kg
                        </span>
                      </div>

                    </div>

                    {/* Stock limit warning message */}
                    {item.warningMsg && (
                      <div className="text-xs font-bold text-red-600 bg-red-50 px-3 py-1 rounded border border-red-100 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>{item.warningMsg}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right side summary cards */}
        <div className="space-y-6">
          
          {/* Summary / Calculator Card */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5 space-y-4.5">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">金額・重量 自動計算</h3>
            
            <div className="space-y-3 text-xs">
              <div className="flex justify-between font-medium text-slate-600 pb-1.5 border-b border-slate-100">
                <span>合計発送数量:</span>
                <span className="font-bold font-mono text-slate-900 text-sm">{totalQty} 個</span>
              </div>
              <div className="flex justify-between font-medium text-slate-600 pb-1.5 border-b border-slate-100">
                <span>合計梱包重量:</span>
                <span className="font-bold font-mono text-slate-900 text-sm">{totalWeight.toFixed(3)} kg</span>
              </div>
              <div className="flex justify-between font-medium text-slate-600 pb-1.5 border-b border-slate-100">
                <span>商品合計金額:</span>
                <span className="font-bold font-mono text-slate-900 text-sm">¥{totalItemsAmount.toLocaleString()} JPY</span>
              </div>

              {/* Extra charge inputs */}
              <div className="space-y-2 pt-2">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">追加費用 (インボイス加算・円)</label>
                
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <span className="text-[9px] text-slate-400 block mb-0.5">送料 (¥)</span>
                    <input
                      type="number"
                      value={shippingCost}
                      onChange={(e) => setShippingCost(Number(e.target.value))}
                      className="w-full border border-slate-200 rounded px-2 py-1 text-xs font-mono font-semibold"
                    />
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 block mb-0.5">保険料 (¥)</span>
                    <input
                      type="number"
                      value={insurance}
                      onChange={(e) => setInsurance(Number(e.target.value))}
                      className="w-full border border-slate-200 rounded px-2 py-1 text-xs font-mono font-semibold"
                    />
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 block mb-0.5">その他 (¥)</span>
                    <input
                      type="number"
                      value={otherCharges}
                      onChange={(e) => setOtherCharges(Number(e.target.value))}
                      className="w-full border border-slate-200 rounded px-2 py-1 text-xs font-mono font-semibold"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100 flex justify-between items-center pt-3.5 mt-4">
                <span className="text-xs font-bold text-slate-800">インボイス合計金額:</span>
                <span className="text-lg font-bold font-mono text-blue-600">
                  ¥{totalInvoiceAmount.toLocaleString()} JPY
                </span>
              </div>
            </div>

            {/* General notes */}
            <div className="space-y-1 pt-1">
              <label className="block text-xs font-bold text-slate-700">インボイス記載用備考 (Notes)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full border border-slate-200 rounded p-2 text-xs focus:outline-none focus:border-blue-500"
                placeholder="インボイスの備考欄に印字されるメモ"
              />
            </div>

            {/* Actions button */}
            <div className="grid grid-cols-2 gap-3 pt-3">
              <button
                type="button"
                onClick={() => handleFormSubmit('DRAFT')}
                disabled={isSubmitting}
                className="bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-800 font-bold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer border border-slate-300 shadow-sm active:scale-[0.98]"
              >
                {isSubmitting ? (
                  <span className="w-4 h-4 border-2 border-slate-600 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Save className="w-4 h-4 text-slate-600" />
                )}
                <span>下書き保存</span>
              </button>
              
              <button
                type="button"
                onClick={() => handleFormSubmit('CONFIRMED')}
                disabled={isSubmitting}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-blue-600/20 active:scale-[0.98]"
              >
                {isSubmitting ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>発送確定・発行</span>
              </button>
            </div>

            {hasWarnings && (
              <div className="text-[10px] text-red-700 font-semibold bg-red-50 p-3 rounded border border-red-100 leading-relaxed flex items-start gap-1">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-red-600 mt-0.5" />
                <span>在庫数が不足しています。発送確定するには、数量を現在庫以下に減らすか、入庫画面で新しい在庫を登録してください。</span>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}

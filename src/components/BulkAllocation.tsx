import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Layers, 
  AlertTriangle, 
  CheckCircle2, 
  FileArchive,
  Hospital,
  AlertCircle,
  Download,
  X,
  Loader2,
  FileEdit,
  Save,
  Clock,
  ChevronDown,
  ChevronUp,
  Building2,
  CheckSquare,
  Square,
  Package,
  Minus
} from 'lucide-react';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
  setDoc 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  Product, 
  Warehouse, 
  Clinic, 
  InventoryLot, 
  User, 
  SystemSettings,
  Shipment 
} from '../types';
import { generateShipmentsZip } from '../lib/pdf';
import SearchableSelect from './SearchableSelect';

interface BulkAllocationProps {
  products: Product[];
  warehouses: Warehouse[];
  clinics: Clinic[];
  lots: InventoryLot[];
  currentUser: User;
  settings: SystemSettings;
  onSubmitBulkShipments: (shipments: any[]) => Promise<Shipment[]>;
}

interface AllocatedClinic {
  id: string; // react key
  clinicId: string;
  items: {
    id: string;
    productId: string;
    sku: string;
    lotNo: string;
    expiryDate: string;
    qty: number;
    unitPrice: number;
    weight: number;
    unit: string;
    hsCode: string;
    countryOfOrigin: string;
  }[];
}

interface BulkDraft {
  id: string;
  warehouseId: string;
  date: string;
  currency: 'USD' | 'KRW' | 'JPY' | 'EUR';
  allocatedClinics: AllocatedClinic[];
  createdAt: string;
  updatedAt: string;
  createdByName?: string;
}

export default function BulkAllocation({
  products,
  warehouses,
  clinics,
  lots,
  currentUser,
  settings,
  onSubmitBulkShipments
}: BulkAllocationProps) {
  
  // State
  const defaultW = warehouses.find(w => w.id === settings?.defaultWarehouseId) || warehouses.find(w => w.isDefault) || warehouses[0];
  const [warehouseId, setWarehouseId] = useState(defaultW?.id || '');
  const [date, setDate] = useState(new Date().toISOString().substring(0, 10));
  const [currency, setCurrency] = useState<'USD' | 'KRW' | 'JPY' | 'EUR'>('JPY');
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);

  // Sync default warehouse if warehouses/settings load or change asynchronously
  useEffect(() => {
    if (warehouses && warehouses.length > 0 && !activeDraftId) {
      const activeDefault = warehouses.find(w => w.id === settings?.defaultWarehouseId) 
        || warehouses.find(w => w.isDefault) 
        || warehouses[0];
      if (activeDefault) {
        setWarehouseId(activeDefault.id);
      }
    }
  }, [settings?.defaultWarehouseId, warehouses, activeDraftId]);

  const [allocatedClinics, setAllocatedClinics] = useState<AllocatedClinic[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [successInfo, setSuccessInfo] = useState<{ count: number; zipUrl: string; fileName: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Quick clinic addition states
  const [quickSelectClinicId, setQuickSelectClinicId] = useState('');
  const [showMultiClinicModal, setShowMultiClinicModal] = useState(false);
  const [multiSelectedClinicIds, setMultiSelectedClinicIds] = useState<string[]>([]);

  // Custom Confirmation Modal & Toast State
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    cancelText?: string;
    isDanger?: boolean;
    onConfirm: () => void;
  } | null>(null);

  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(prev => prev?.text === text ? null : prev);
    }, 4000);
  };

  // Draft states
  const [drafts, setDrafts] = useState<BulkDraft[]>([]);
  const [showDraftsList, setShowDraftsList] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);

  // Firestore realtime subscription for drafts
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'bulkDrafts'), (snap) => {
      const list: BulkDraft[] = [];
      snap.forEach(d => {
        list.push({ id: d.id, ...d.data() } as BulkDraft);
      });
      list.sort((a, b) => (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || ''));
      setDrafts(list);
    }, (err) => {
      console.error("Firestore draft subscription error:", err);
    });

    return () => unsub();
  }, []);

  // Save draft
  const handleSaveDraft = async () => {
    if (allocatedClinics.length === 0 && !warehouseId) {
      showToast('保存する発送データがありません。発送先クリニックを追加してください。', 'error');
      return;
    }

    setSavingDraft(true);
    setErrorMessage(null);

    try {
      const nowIso = new Date().toISOString();
      const draftPayload = {
        warehouseId,
        date,
        currency,
        allocatedClinics,
        updatedAt: nowIso,
        createdAt: nowIso,
        createdByName: currentUser.name || 'システム管理者'
      };

      if (activeDraftId) {
        await setDoc(doc(db, 'bulkDrafts', activeDraftId), {
          ...draftPayload,
          createdAt: drafts.find(d => d.id === activeDraftId)?.createdAt || nowIso
        }, { merge: true });
        showToast('現在編集中の下書きを更新保存しました。', 'success');
      } else {
        const newRef = await addDoc(collection(db, 'bulkDrafts'), draftPayload);
        setActiveDraftId(newRef.id);
        showToast('一括振り分けの下書きを一時保存しました。', 'success');
      }
    } catch (err: any) {
      console.error('Draft save error:', err);
      showToast(`下書き保存に失敗しました: ${err.message || 'エラー'}`, 'error');
    } finally {
      setSavingDraft(false);
    }
  };

  // Internal load draft execution
  const executeLoadDraft = (draft: BulkDraft) => {
    setWarehouseId(draft.warehouseId || '');
    setDate(draft.date || new Date().toISOString().substring(0, 10));
    setCurrency(draft.currency || 'JPY');
    setAllocatedClinics(draft.allocatedClinics || []);
    setActiveDraftId(draft.id);
    setShowDraftsList(false);
    const targetWh = warehouses.find(w => w.id === draft.warehouseId)?.name || '下書き';
    showToast(`「${targetWh}」の発送データをフォームに読み込みました。`, 'success');
  };

  // Load draft with modal prompt if current form has data
  const handleLoadDraft = (draft: BulkDraft) => {
    if (allocatedClinics.length > 0) {
      setModalConfig({
        isOpen: true,
        title: '下書きの読み込み',
        message: '現在フォームに入力中の内容は上書きされます。下書きを読み込みますか？',
        confirmText: '読み込む',
        cancelText: 'キャンセル',
        isDanger: false,
        onConfirm: () => {
          setModalConfig(null);
          executeLoadDraft(draft);
        }
      });
    } else {
      executeLoadDraft(draft);
    }
  };

  // Delete draft with modal confirmation
  const handleDeleteDraft = (draftId: string) => {
    const targetDraft = drafts.find(d => d.id === draftId);
    const targetWarehouse = warehouses.find(w => w.id === targetDraft?.warehouseId);
    const draftLabel = targetWarehouse?.name || '下書き';

    setModalConfig({
      isOpen: true,
      title: '下書きデータの削除',
      message: `「${draftLabel}」の下書きデータを削除しますか？この操作は取り消せません。`,
      confirmText: '削除する',
      cancelText: 'キャンセル',
      isDanger: true,
      onConfirm: async () => {
        setModalConfig(null);
        try {
          await deleteDoc(doc(db, 'bulkDrafts', draftId));
          if (activeDraftId === draftId) {
            setActiveDraftId(null);
          }
          showToast('下書きデータを削除しました。', 'info');
        } catch (err: any) {
          console.error('Draft delete error:', err);
          showToast(`下書きの削除に失敗しました: ${err.message || 'エラー'}`, 'error');
        }
      }
    });
  };

  const activeClinics = clinics.filter(c => c.active !== false);
  const activeProducts = products.filter(p => p.active !== false);

  // Quick add single clinic
  const handleQuickAddClinic = (cId: string) => {
    if (!cId) return;
    const existing = allocatedClinics.find(c => c.clinicId === cId);
    if (existing) {
      showToast('指定されたクリニックはすでに配分リストに追加されています。', 'info');
      setQuickSelectClinicId('');
      return;
    }

    const key = Math.random().toString(36).substring(2, 9);
    setAllocatedClinics(prev => [
      ...prev,
      {
        id: key,
        clinicId: cId,
        items: []
      }
    ]);
    setQuickSelectClinicId('');
    const targetClinic = clinics.find(c => c.id === cId);
    showToast(`「${targetClinic?.name || targetClinic?.nameEn || 'クリニック'}」を配分先として追加しました。`, 'success');
  };

  // Add multiple clinics at once from modal
  const handleConfirmMultiClinicAdd = () => {
    if (multiSelectedClinicIds.length === 0) {
      showToast('追加するクリニックを選択してください。', 'error');
      return;
    }

    let addedCount = 0;
    const newBlocks: AllocatedClinic[] = [];

    multiSelectedClinicIds.forEach(cId => {
      const exists = allocatedClinics.some(c => c.clinicId === cId);
      if (!exists) {
        newBlocks.push({
          id: Math.random().toString(36).substring(2, 9),
          clinicId: cId,
          items: []
        });
        addedCount++;
      }
    });

    if (newBlocks.length > 0) {
      setAllocatedClinics(prev => [...prev, ...newBlocks]);
      showToast(`${addedCount} 件のクリニックを配分リストに追加しました。`, 'success');
    } else {
      showToast('選択したクリニックはすべて追加済みです。', 'info');
    }

    setShowMultiClinicModal(false);
    setMultiSelectedClinicIds([]);
  };

  // Select/Unselect all clinics for batch add modal
  const handleToggleSelectAllClinics = () => {
    if (multiSelectedClinicIds.length === activeClinics.length) {
      setMultiSelectedClinicIds([]);
    } else {
      setMultiSelectedClinicIds(activeClinics.map(c => c.id));
    }
  };

  // Clear all configurations
  const handleClearAll = () => {
    setModalConfig({
      isOpen: true,
      title: '入力内容のクリア',
      message: '現在のすべての入力・クリニック枠をクリアしますか？',
      confirmText: 'クリアする',
      cancelText: 'キャンセル',
      isDanger: true,
      onConfirm: () => {
        setModalConfig(null);
        setAllocatedClinics([]);
        showToast('フォームの入力内容をクリアしました。', 'info');
      }
    });
  };

  // Add a blank clinic allocation block
  const handleAddClinicBlock = () => {
    const key = Math.random().toString(36).substring(2, 9);
    setAllocatedClinics(prev => [
      ...prev,
      {
        id: key,
        clinicId: '',
        items: []
      }
    ]);
  };

  // Remove clinic allocation block
  const handleRemoveClinicBlock = (id: string) => {
    setAllocatedClinics(prev => prev.filter(c => c.id !== id));
  };

  // Update chosen clinic in block
  const handleClinicSelect = (blockId: string, clinicId: string) => {
    setAllocatedClinics(prev => prev.map(c => {
      if (c.id !== blockId) return c;
      return { ...c, clinicId };
    }));
  };

  // Add blank item row inside clinic block
  const handleAddItemToClinic = (blockId: string) => {
    setAllocatedClinics(prev => prev.map(c => {
      if (c.id !== blockId) return c;
      
      const itemKey = Math.random().toString(36).substring(2, 9);
      return {
        ...c,
        items: [
          ...c.items,
          {
            id: itemKey,
            productId: '',
            sku: '',
            lotNo: '',
            expiryDate: '',
            qty: 5,
            unitPrice: 0,
            weight: 0.03,
            unit: 'pcs',
            hsCode: '3002.90',
            countryOfOrigin: 'Republic of Korea'
          }
        ]
      };
    }));
  };

  // Quick add selected product to specific clinic card
  const handleQuickAddProductToClinic = (blockId: string, prodId: string) => {
    if (!prodId) return;
    const product = products.find(p => p.id === prodId);
    if (!product) return;

    // FEFO lot selection
    const productLots = lots.filter(l => l.productId === prodId && l.warehouseId === warehouseId && l.currentStock > 0);
    const sortedLots = [...productLots].sort((a, b) => (a.expiryDate || '').localeCompare(b.expiryDate || ''));
    const chosenLot = sortedLots[0];
    const lotNo = chosenLot ? chosenLot.lotNo : (product.lotNo || 'LOT-TEMP');
    const expiryDate = chosenLot ? chosenLot.expiryDate : (product.expiryDate || '');

    setAllocatedClinics(prev => prev.map(c => {
      if (c.id !== blockId) return c;

      // If product already in this clinic, increase quantity
      const existingItem = c.items.find(it => it.productId === prodId);
      if (existingItem) {
        return {
          ...c,
          items: c.items.map(it => it.productId === prodId ? { ...it, qty: Number(it.qty) + 5 } : it)
        };
      }

      const itemKey = Math.random().toString(36).substring(2, 9);
      return {
        ...c,
        items: [
          ...c.items,
          {
            id: itemKey,
            productId: prodId,
            sku: product.sku || '',
            lotNo: lotNo || '',
            expiryDate: expiryDate || '',
            qty: 5,
            unitPrice: product.invoicePrice || 0,
            weight: product.weight || 0.03,
            unit: product.unit || 'pcs',
            hsCode: product.hsCode || '3002.90',
            countryOfOrigin: product.countryOfOrigin || 'South Korea'
          }
        ]
      };
    }));
  };

  // Remove item row inside clinic block
  const handleRemoveItemFromClinic = (blockId: string, itemId: string) => {
    setAllocatedClinics(prev => prev.map(c => {
      if (c.id !== blockId) return c;
      return {
        ...c,
        items: c.items.filter(it => it.id !== itemId)
      };
    }));
  };

  // Handle product select inside clinic block item (FEFO recommended automatically)
  const handleItemProductSelect = (blockId: string, itemId: string, prodId: string) => {
    const product = products.find(p => p.id === prodId);
    if (!product) return;

    // FEFO: Find unexpired lots of this product in chosen warehouse, sort by expiryDate asc
    const productLots = lots.filter(l => l.productId === prodId && l.warehouseId === warehouseId && l.currentStock > 0);
    const sortedLots = [...productLots].sort((a, b) => (a.expiryDate || '').localeCompare(b.expiryDate || ''));
    
    const chosenLot = sortedLots[0];
    const lotNo = chosenLot ? chosenLot.lotNo : (product.lotNo || 'LOT-TEMP');
    const expiryDate = chosenLot ? chosenLot.expiryDate : (product.expiryDate || '');

    setAllocatedClinics(prev => prev.map(c => {
      if (c.id !== blockId) return c;
      return {
        ...c,
        items: c.items.map(it => {
          if (it.id !== itemId) return it;
          return {
            ...it,
            productId: prodId,
            sku: product.sku || '',
            lotNo: lotNo || '',
            expiryDate: expiryDate || '',
            unitPrice: product.invoicePrice || 0,
            weight: product.weight || 0.03,
            unit: product.unit || 'pcs',
            hsCode: product.hsCode || '3002.90',
            countryOfOrigin: product.countryOfOrigin || 'South Korea'
          };
        })
      };
    }));
  };

  // Handle manual lot select inside clinic block item
  const handleItemLotSelect = (blockId: string, itemId: string, lotNum: string) => {
    setAllocatedClinics(prev => prev.map(c => {
      if (c.id !== blockId) return c;
      return {
        ...c,
        items: c.items.map(it => {
          if (it.id !== itemId) return it;
          const targetLot = lots.find(l => l.productId === it.productId && l.lotNo === lotNum && l.warehouseId === warehouseId);
          return {
            ...it,
            lotNo: lotNum,
            expiryDate: targetLot?.expiryDate || it.expiryDate
          };
        })
      };
    }));
  };

  // Update item field inside clinic block
  const handleItemFieldChange = (blockId: string, itemId: string, field: string, val: any) => {
    setAllocatedClinics(prev => prev.map(c => {
      if (c.id !== blockId) return c;
      return {
        ...c,
        items: c.items.map(it => {
          if (it.id !== itemId) return it;
          return { ...it, [field]: val };
        })
      };
    }));
  };

  // Aggregated quantities calculation across all clinics
  const getAggregatedAllocations = () => {
    const agg: Record<string, { productId: string; lotNo: string; qty: number; productName: string }> = {};
    
    allocatedClinics.forEach(c => {
      c.items.forEach(it => {
        if (!it.productId || !it.lotNo) return;
        const key = `${it.productId}_${it.lotNo}`;
        const prod = products.find(p => p.id === it.productId);
        
        if (!agg[key]) {
          agg[key] = {
            productId: it.productId,
            lotNo: it.lotNo,
            qty: 0,
            productName: prod?.nameJa || '不明な製剤'
          };
        }
        agg[key].qty += Number(it.qty) || 0;
      });
    });
    
    return Object.values(agg);
  };

  const aggregatedList = getAggregatedAllocations();

  // Validate stock overages
  const getStockValidationErrors = () => {
    const errors: string[] = [];
    
    aggregatedList.forEach(item => {
      const lotStock = lots.find(l => l.productId === item.productId && l.lotNo === item.lotNo && l.warehouseId === warehouseId);
      const limit = lotStock ? lotStock.currentStock : 0;
      
      if (item.qty > limit) {
        errors.push(`【${item.productName}】入荷元:${item.lotNo} の一括振分総数 (${item.qty}個) が、現在庫数 (${limit}個) を超過しています。`);
      }
    });
    
    return errors;
  };

  const stockValidationErrors = getStockValidationErrors();

  // Submit batch allocation - validation & show modal
  const handleBulkSubmit = () => {
    setErrorMessage(null);
    if (!warehouseId) {
      alert('発送元倉庫を選択してください。');
      return;
    }
    if (allocatedClinics.length === 0) {
      alert('振り分け先のクリニックが追加されていません。「発送先クリニックを追加」から振り分け先を登録してください。');
      return;
    }
    if (allocatedClinics.some(c => !c.clinicId)) {
      alert('すべての振り分け枠で発送先クリニックを選択してください。');
      return;
    }
    if (allocatedClinics.some(c => c.items.length === 0 || c.items.some(it => !it.productId))) {
      alert('すべてのクリニックに1点以上の製剤を選択・追加してください。不要な空行があれば削除してください。');
      return;
    }
    if (stockValidationErrors.length > 0) {
      alert('現在庫数を超過した振り分けがあります。数量を調整してください。');
      return;
    }

    setShowConfirmModal(true);
  };

  // Execute batch allocation submit and ZIP download
  const executeBulkSubmit = async () => {
    setShowConfirmModal(false);
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const shipmentsPayloads = allocatedClinics.map(ac => {
        const totalQty = ac.items.reduce((sum, i) => sum + (Number(i.qty) || 0), 0);
        const totalWeight = ac.items.reduce((sum, i) => sum + ((Number(i.qty) || 0) * (i.weight || 0.03)), 0);
        const totalItemsAmount = ac.items.reduce((sum, i) => sum + ((Number(i.qty) || 0) * (i.unitPrice || 0)), 0);

        return {
          date,
          warehouseId,
          clinicId: ac.clinicId,
          currency,
          courier: 'EMS / DHL',
          trackingNo: '',
          shippingCost: 0,
          insurance: 0,
          otherCharges: 0,
          notes: 'Batch Bulk Allocated Shipment',
          items: ac.items.map(it => {
            const prod = products.find(p => p.id === it.productId);
            return {
              productId: it.productId,
              sku: it.sku || (prod ? prod.sku : ''),
              nameEn: prod ? prod.nameEn : 'Product',
              nameJa: prod ? prod.nameJa : '製剤',
              lotNo: it.lotNo,
              expiryDate: it.expiryDate,
              qty: Number(it.qty),
              unit: it.unit || (prod ? prod.unit : 'pcs'),
              unitPrice: it.unitPrice,
              amount: Number(it.qty) * it.unitPrice,
              weight: it.weight,
              totalWeight: Number(it.qty) * it.weight,
              hsCode: it.hsCode || '3002.90',
              countryOfOrigin: it.countryOfOrigin || 'South Korea'
            };
          }),
          totalQty,
          totalWeight,
          totalItemsAmount,
          totalInvoiceAmount: totalItemsAmount
        };
      });

      const createdShipments = await onSubmitBulkShipments(shipmentsPayloads);
      
      const zipBlob = await generateShipmentsZip(createdShipments, settings);
      const fileName = `INVOICES_BATCH_${new Date().toISOString().substring(0,10)}.zip`;
      const zipUrl = URL.createObjectURL(zipBlob);

      const link = document.createElement('a');
      link.href = zipUrl;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setSuccessInfo({
        count: createdShipments.length,
        zipUrl,
        fileName
      });

      if (activeDraftId) {
        try {
          await deleteDoc(doc(db, 'bulkDrafts', activeDraftId));
          setActiveDraftId(null);
        } catch (e) {
          console.warn("Could not delete completed draft:", e);
        }
      }

      setAllocatedClinics([]);
    } catch (err: any) {
      console.error('Bulk allocation submission error:', err);
      setErrorMessage(`一括登録エラー: ${err.message || '不明なエラーが発生しました。'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Draft Notification Banner */}
      <div className="bg-amber-50/90 border border-amber-200/90 rounded-2xl p-4 md:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 md:w-11 md:h-11 bg-amber-500 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs">
            <FileEdit className="w-5 h-5 md:w-6 md:h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-900 text-sm md:text-base">保存済みの下書きデータ</h3>
              <span className="bg-amber-500 text-white font-bold text-xs px-2.5 py-0.5 rounded-full">
                {drafts.length}件
              </span>
            </div>
            <p className="text-slate-600 text-xs mt-0.5">
              作成途中で一時保存された発送データです。クリックしてフォームに読み込んで編集・確定できます。
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowDraftsList(!showDraftsList)}
          className="bg-white hover:bg-amber-100/50 text-amber-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 border border-amber-300/80 shadow-xs transition-all cursor-pointer shrink-0 self-start md:self-auto"
        >
          <span>{showDraftsList ? '下書き一覧を非表示' : '下書き一覧を表示'}</span>
          {showDraftsList ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Active draft banner if loaded */}
      {activeDraftId && (
        <div className="bg-amber-100/80 border border-amber-300 rounded-2xl p-3.5 px-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-950 shadow-xs animate-in fade-in duration-150">
          <div className="flex items-center gap-2 font-medium">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
            <span>現在、下書きデータをフォームに読み込んで編集中です。</span>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => {
                setModalConfig({
                  isOpen: true,
                  title: '下書き編集モード解除',
                  message: 'フォームをクリアして下書き編集モードを解除しますか？ (下書きデータ自体は削除されません)',
                  confirmText: '解除する',
                  cancelText: 'キャンセル',
                  isDanger: false,
                  onConfirm: () => {
                    setModalConfig(null);
                    setActiveDraftId(null);
                    setAllocatedClinics([]);
                    showToast('編集モードを解除しました。', 'info');
                  }
                });
              }}
              className="bg-white hover:bg-amber-50 text-slate-700 px-3 py-1.5 rounded-xl border border-amber-200 font-bold text-xs cursor-pointer transition-colors"
            >
              編集解除
            </button>
            <button
              type="button"
              onClick={() => handleDeleteDraft(activeDraftId)}
              className="bg-rose-500 hover:bg-rose-600 text-white px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
              title="この下書きを完全に削除"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>この下書きを削除</span>
            </button>
          </div>
        </div>
      )}

      {showDraftsList && (
        <div className="bg-white border border-amber-200 rounded-2xl p-5 shadow-sm space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between border-b border-amber-100 pb-3">
            <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600" />
              <span>保存済み下書き一覧 ({drafts.length}件)</span>
            </h4>
            {drafts.length > 0 && (
              <span className="text-[11px] text-slate-500">最終更新日時順</span>
            )}
          </div>

          {drafts.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">
              現在保存されている下書きデータはありません。「下書き保存」ボタンから作成中の状態を一時保存できます。
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {drafts.map(draft => {
                const warehouseName = warehouses.find(w => w.id === draft.warehouseId)?.name || '未選択倉庫';
                const clinicCount = draft.allocatedClinics?.length || 0;
                const totalItemsCount = draft.allocatedClinics?.reduce(
                  (sum, c) => sum + (c.items?.reduce((s, it) => s + (Number(it.qty) || 0), 0) || 0), 0
                ) || 0;
                const isCurrentActive = draft.id === activeDraftId;

                return (
                  <div 
                    key={draft.id} 
                    className={`border rounded-xl p-4 flex flex-col justify-between space-y-3 transition-colors ${
                      isCurrentActive 
                        ? 'bg-amber-100/50 border-amber-400 shadow-xs' 
                        : 'bg-amber-50/40 border-amber-200/70 hover:border-amber-300'
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-start">
                        <span className="font-bold text-slate-900 text-xs truncate max-w-[170px] flex items-center gap-1">
                          {warehouseName}
                          {isCurrentActive && (
                            <span className="bg-amber-500 text-white text-[9px] px-1.5 py-0.2 rounded font-normal">編集中</span>
                          )}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(draft.updatedAt || draft.createdAt).toLocaleDateString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-600 text-[11px]">
                        <span className="bg-white border border-amber-200/80 px-2 py-0.5 rounded font-medium text-amber-900">
                          {clinicCount} クリニック
                        </span>
                        <span className="bg-white border border-amber-200/80 px-2 py-0.5 rounded font-mono font-bold text-slate-800">
                          計 {totalItemsCount} 点
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          ({draft.currency})
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-amber-100/80">
                      <button
                        type="button"
                        onClick={() => handleLoadDraft(draft)}
                        className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold py-1.5 px-3 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>読み込む</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteDraft(draft.id);
                        }}
                        className="bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 hover:border-rose-200 font-medium p-1.5 rounded-lg transition-colors cursor-pointer"
                        title="下書きを削除"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Success Notification Banner */}
      {successInfo && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <p className="text-xs font-bold">
                一括確定・データベース登録が正常に完了しました！（全 {successInfo.count} 件）
              </p>
              <p className="text-[11px] text-emerald-700">
                自動ダウンロードが開始されない場合は、右のボタンからZIPファイルを保存してください。
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={successInfo.zipUrl}
              download={successInfo.fileName}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-3 rounded-lg text-xs flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Download className="w-4 h-4" />
              <span>ZIPファイルをダウンロード</span>
            </a>
            <button
              onClick={() => setSuccessInfo(null)}
              className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Error Message Banner */}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl flex items-center justify-between gap-3 shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <span className="text-xs font-medium">{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header title area */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">複数クリニック一括発送配分画面</h2>
          <p className="text-xs text-slate-500">1回の倉庫搬出作業で、複数の国内各クリニックへ対する発送データ・インボイスを一括して同時作成します。</p>
        </div>
        
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={savingDraft}
            className="bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white font-bold py-2 px-4 rounded-lg text-xs flex items-center gap-1.5 cursor-pointer shadow-sm transition-colors"
          >
            {savingDraft ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{activeDraftId ? '下書き更新保存' : '下書き保存'}</span>
          </button>
        </div>
      </div>

      {/* Basic Batch Settings Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">発送日 <span className="text-red-500">*</span></label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-xs font-mono font-semibold"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">発送元倉庫 (一括適用) <span className="text-red-500">*</span></label>
          <select
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-xs font-semibold focus:outline-none"
          >
            <option value="">-- 倉庫を選択 --</option>
            {warehouses.map(w => {
              const isDefault = w.id === settings?.defaultWarehouseId || w.isDefault;
              return (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.nameEn}){isDefault ? ' 【デフォルト】' : ''}
                </option>
              );
            })}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">取引通貨</label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as any)}
            className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-xs font-semibold focus:outline-none"
          >
            <option value="USD">USD</option>
            <option value="KRW">KRW</option>
            <option value="JPY">JPY</option>
            <option value="EUR">EUR</option>
          </select>
        </div>
      </div>

      {/* PROMINENT CLINIC ADDITION & CONTROL BAR */}
      <div className="bg-white border border-blue-200 rounded-xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
              <Hospital className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>発送先クリニックの追加・配分設定</span>
                <span className="bg-blue-600 text-white font-bold text-xs px-2.5 py-0.5 rounded-full font-mono">
                  {allocatedClinics.length} 件登録中
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                発送先のクリニックを選択して、配分する製剤と数量を指定してください。
              </p>
            </div>
          </div>

          {allocatedClinics.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="text-slate-400 hover:text-red-600 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>すべての枠をクリア</span>
            </button>
          )}
        </div>

        {/* Quick Add Controls Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end pt-1">
          {/* Col A: Search and Add single clinic */}
          <div className="md:col-span-7 space-y-1">
            <label className="block text-xs font-bold text-slate-700">
              クリニックを検索して1件追加
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <SearchableSelect
                  options={activeClinics
                    .sort((a, b) => (a.name || a.nameEn || '').localeCompare(b.name || b.nameEn || '', 'ja'))
                    .map(c => ({
                      value: c.id,
                      label: c.name || c.nameEn || c.clinicId || 'Clinic',
                      subLabel: c.nameEn ? c.nameEn.replace(/\s*\([^)]*\)/g, '').trim() : undefined,
                      badge: c.clinicId
                    }))
                  }
                  value={quickSelectClinicId}
                  onChange={(val) => {
                    setQuickSelectClinicId(val);
                    if (val) handleQuickAddClinic(val);
                  }}
                  placeholder="-- クリニック名またはIDで検索して追加 --"
                  searchPlaceholder="クリニック名・IDで検索..."
                />
              </div>
            </div>
          </div>

          {/* Col B: Multi Clinic Batch Modal Trigger */}
          <div className="md:col-span-3">
            <button
              type="button"
              onClick={() => {
                setMultiSelectedClinicIds(activeClinics.map(c => c.id));
                setShowMultiClinicModal(true);
              }}
              className="w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold py-2 px-3 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Building2 className="w-4 h-4" />
              <span>複数クリニックを一括選択</span>
            </button>
          </div>

          {/* Col C: Blank Block Add */}
          <div className="md:col-span-2">
            <button
              type="button"
              onClick={handleAddClinicBlock}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>空の枠を追加</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Clinic Cards List (Left 2 cols) */}
        <div className="lg:col-span-2 space-y-5">
          {allocatedClinics.length === 0 ? (
            <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center space-y-3">
              <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto">
                <Hospital className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-800">発送先クリニックが登録されていません</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  上の「クリニックを検索して1件追加」や「複数クリニックを一括選択」ボタンから、今回まとめて発送配分を行うクリニックを登録してください。
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMultiSelectedClinicIds(activeClinics.map(c => c.id));
                  setShowMultiClinicModal(true);
                }}
                className="mt-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-5 rounded-xl text-xs inline-flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <Building2 className="w-4 h-4" />
                <span>クリニックをまとめて選択追加</span>
              </button>
            </div>
          ) : (
            allocatedClinics.map((block, bIdx) => {
              const currentClinic = clinics.find(c => c.id === block.clinicId);
              const clinicTotalQty = block.items.reduce((s, it) => s + (Number(it.qty) || 0), 0);
              const clinicTotalAmount = block.items.reduce((s, it) => s + ((Number(it.qty) || 0) * (it.unitPrice || 0)), 0);

              return (
                <div 
                  key={block.id} 
                  className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:border-slate-300 transition-all overflow-hidden space-y-0"
                >
                  {/* Card Header */}
                  <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-200/70 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-[260px]">
                      <span className="w-7 h-7 bg-blue-600 text-white rounded-lg font-mono font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                        #{bIdx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <SearchableSelect
                          options={activeClinics
                            .sort((a, b) => (a.name || a.nameEn || '').localeCompare(b.name || b.nameEn || '', 'ja'))
                            .map(c => ({
                              value: c.id,
                              label: c.name || c.nameEn || c.clinicId || 'Clinic',
                              subLabel: c.nameEn ? c.nameEn.replace(/\s*\([^)]*\)/g, '').trim() : undefined,
                              badge: c.clinicId
                            }))
                          }
                          value={block.clinicId}
                          onChange={(val) => handleClinicSelect(block.id, val)}
                          placeholder="-- 発送先クリニックを選択 --"
                          searchPlaceholder="クリニック名で検索..."
                        />
                      </div>
                    </div>

                    {/* Header Clinic Badge & Total */}
                    <div className="flex items-center gap-3 shrink-0">
                      {currentClinic && (
                        <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                          {currentClinic.clinicId && (
                            <span className="bg-slate-200/70 text-slate-700 px-2 py-0.5 rounded font-mono font-bold text-[10px]">
                              {currentClinic.clinicId}
                            </span>
                          )}
                          {(currentClinic.contactPerson || currentClinic.doctorName) && (
                            <span className="truncate max-w-[140px]">
                              👤 {currentClinic.contactPerson || currentClinic.doctorName}
                            </span>
                          )}
                        </div>
                      )}

                      <div className="text-xs text-right font-mono font-bold bg-blue-50/80 text-blue-900 px-3 py-1 rounded-lg border border-blue-100/80">
                        <span>{clinicTotalQty} 点</span>
                        <span className="mx-1 text-blue-300">|</span>
                        <span>¥{clinicTotalAmount.toLocaleString()} JPY</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveClinicBlock(block.id)}
                        className="text-slate-400 hover:text-rose-600 p-1.5 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                        title="このクリニック枠を削除"
                      >
                        <Trash2 className="w-4.5 h-4.5" />
                      </button>
                    </div>
                  </div>

                  {/* Items Allocation Section inside Clinic Card */}
                  <div className="p-5 space-y-4">
                    {block.items.length === 0 ? (
                      <div className="bg-slate-50/60 rounded-xl border border-dashed border-slate-200 p-6 text-center space-y-2">
                        <p className="text-xs text-slate-500 font-medium">
                          このクリニックへ発送する製剤がまだ追加されていません。
                        </p>
                        <p className="text-[11px] text-slate-400">
                          下の「＋ 製剤を選択して追加」メニューから、発送する製剤を選んでください。
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between border-b border-slate-100 pb-1.5">
                          <span>配分製剤一覧 ({block.items.length}件)</span>
                          <span className="text-slate-400 font-normal">出荷元ロット・期限・数量を指定</span>
                        </div>

                        {block.items.map((it, itemIdx) => {
                          const product = products.find(p => p.id === it.productId);
                          const availableLots = lots.filter(l => l.productId === it.productId && l.warehouseId === warehouseId && l.currentStock > 0);
                          const chosenLotObj = availableLots.find(l => l.lotNo === it.lotNo);
                          const currentStock = chosenLotObj ? chosenLotObj.currentStock : (availableLots[0]?.currentStock || 0);

                          return (
                            <div 
                              key={it.id} 
                              className="bg-slate-50/50 hover:bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-3 transition-colors"
                            >
                              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                                
                                {/* Col 1: Product Selection */}
                                <div className="md:col-span-5 space-y-1">
                                  <label className="block text-[10px] font-bold text-slate-500 uppercase">
                                    製剤 #{itemIdx + 1}
                                  </label>
                                  <SearchableSelect
                                    options={activeProducts
                                      .sort((a, b) => (a.nameEn || a.nameJa || '').localeCompare(b.nameEn || b.nameJa || '', 'en', { numeric: true }))
                                      .map(p => ({
                                        value: p.id,
                                        label: `${p.nameEn || p.nameJa} (${p.nameJa || p.nameEn})`,
                                        subLabel: `SKU: ${p.sku}`,
                                        badge: p.spec || p.unit
                                      }))
                                    }
                                    value={it.productId}
                                    onChange={(val) => handleItemProductSelect(block.id, it.id, val)}
                                    placeholder="-- 製剤を選択 --"
                                    searchPlaceholder="製剤名で検索..."
                                  />
                                </div>

                                {/* Col 2: FEFO Lot Recommendation */}
                                <div className="md:col-span-4 space-y-1">
                                  <label className="block text-[10px] font-bold text-slate-500 uppercase flex items-center justify-between">
                                    <span>出荷元ロット (FEFO)</span>
                                    {it.expiryDate && (
                                      <span className="text-[10px] text-slate-400 font-mono">期限: {it.expiryDate}</span>
                                    )}
                                  </label>
                                  {availableLots.length <= 1 ? (
                                    <div className="w-full border border-slate-200 bg-white rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-800 flex items-center justify-between">
                                      <span>{it.lotNo || 'ロットなし'}</span>
                                      <span className="text-[10px] font-normal text-slate-400 font-sans">
                                        (在庫: {currentStock})
                                      </span>
                                    </div>
                                  ) : (
                                    <select
                                      value={it.lotNo}
                                      onChange={(e) => handleItemLotSelect(block.id, it.id, e.target.value)}
                                      className="w-full border border-slate-200 bg-white rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                                    >
                                      {availableLots.map(l => (
                                        <option key={l.id} value={l.lotNo}>
                                          {l.lotNo} (期限: {l.expiryDate} | 残: {l.currentStock})
                                        </option>
                                      ))}
                                    </select>
                                  )}
                                </div>

                                {/* Col 3: Quantity Stepper */}
                                <div className="md:col-span-2 space-y-1">
                                  <label className="block text-[10px] font-bold text-slate-500 uppercase">
                                    発送数量
                                  </label>
                                  <div className="flex items-center border border-slate-200 rounded-lg bg-white overflow-hidden">
                                    <button
                                      type="button"
                                      onClick={() => handleItemFieldChange(block.id, it.id, 'qty', Math.max(1, (Number(it.qty) || 1) - 1))}
                                      className="px-2 py-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors cursor-pointer"
                                    >
                                      <Minus className="w-3.5 h-3.5" />
                                    </button>
                                    <input
                                      type="number"
                                      required
                                      min="1"
                                      value={it.qty}
                                      onChange={(e) => handleItemFieldChange(block.id, it.id, 'qty', Math.max(1, Number(e.target.value) || 1))}
                                      className="w-full text-center font-mono font-bold text-xs text-slate-900 focus:outline-none"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleItemFieldChange(block.id, it.id, 'qty', (Number(it.qty) || 0) + 1)}
                                      className="px-2 py-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors cursor-pointer"
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>

                                {/* Col 4: Delete item */}
                                <div className="md:col-span-1 flex items-center justify-end pt-5">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveItemFromClinic(block.id, it.id)}
                                    className="text-slate-400 hover:text-rose-600 p-1.5 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                    title="製剤明細を削除"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>

                              </div>

                              {/* Price Subtotal info bar */}
                              {product && (
                                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/50 text-slate-500 font-mono">
                                  <span>単価: ¥{(it.unitPrice || 0).toLocaleString()} JPY / {it.unit || 'pcs'}</span>
                                  <span className="font-bold text-slate-900">
                                    小計: ¥{((it.qty || 0) * (it.unitPrice || 0)).toLocaleString()} JPY
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Product Addition Section for this specific Clinic */}
                    <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                      <div className="w-full sm:w-auto flex-1 max-w-md">
                        <SearchableSelect
                          options={activeProducts
                            .sort((a, b) => (a.nameEn || a.nameJa || '').localeCompare(b.nameEn || b.nameJa || '', 'en', { numeric: true }))
                            .map(p => ({
                              value: p.id,
                              label: `＋ 製剤を追加: ${p.nameEn || p.nameJa}`,
                              subLabel: `SKU: ${p.sku}`,
                              badge: p.spec || p.unit
                            }))
                          }
                          value=""
                          onChange={(val) => {
                            if (val) handleQuickAddProductToClinic(block.id, val);
                          }}
                          placeholder="＋ このクリニックに製剤を選択して追加..."
                          searchPlaceholder="追加したい製剤名で検索..."
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => handleAddItemToClinic(block.id)}
                        className="w-full sm:w-auto bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-1.5 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>空の明細行を追加</span>
                      </button>
                    </div>

                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Real-time sum stock checking & Submit Panel (Right col) */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 space-y-4 sticky top-6">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
              <Layers className="w-4.5 h-4.5 text-indigo-600" />
              <span>一括振分合計 在庫照合</span>
            </h3>

            <p className="text-xs text-slate-500 leading-relaxed">
              登録された全クリニックへの配分合計数量と、選択倉庫の現在庫数をリアルタイムに照合します。
            </p>

            {aggregatedList.length === 0 ? (
              <div className="bg-slate-50 rounded-xl p-6 text-center text-slate-400 text-xs">
                クリニックと配分製剤が入力されると、ここに合計数量が表示されます。
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
                {aggregatedList.map((item, idx) => {
                  const lotStock = lots.find(l => l.productId === item.productId && l.lotNo === item.lotNo && l.warehouseId === warehouseId);
                  const maxQty = lotStock ? lotStock.currentStock : 0;
                  const isExceeded = item.qty > maxQty;

                  return (
                    <div 
                      key={idx} 
                      className={`p-3 rounded-xl border text-xs space-y-1 transition-colors ${
                        isExceeded ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200/80'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <span className="font-bold text-slate-800 line-clamp-1">{item.productName}</span>
                        <span className={`font-mono font-bold shrink-0 ${isExceeded ? 'text-rose-600 text-sm' : 'text-slate-900'}`}>
                          {item.qty} / {maxQty} 個
                        </span>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                        <span>ロット: {item.lotNo}</span>
                        <span className={isExceeded ? 'text-rose-600 font-bold' : 'text-emerald-600 font-semibold'}>
                          {isExceeded ? '⚠️ 在庫不足' : '✓ 在庫あり'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Verification Errors Box */}
            {stockValidationErrors.length > 0 && (
              <div className="bg-rose-50 border border-rose-200 text-rose-900 p-3.5 rounded-xl text-xs space-y-1.5">
                <div className="font-bold flex items-center gap-1.5 text-rose-700">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>在庫数が不足しています</span>
                </div>
                <ul className="list-disc pl-4 space-y-1 text-rose-700 text-[11px]">
                  {stockValidationErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Total Summary */}
            <div className="bg-blue-50/60 p-4 rounded-xl border border-blue-100/80 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600 font-medium">
                <span>発送先クリニック数:</span>
                <span className="font-bold font-mono text-slate-900">{allocatedClinics.length} 件</span>
              </div>
              <div className="flex justify-between text-slate-600 font-medium">
                <span>配分総アイテム数:</span>
                <span className="font-bold font-mono text-slate-900">
                  {allocatedClinics.reduce((sum, c) => sum + c.items.reduce((s, it) => s + (Number(it.qty) || 0), 0), 0)} 個
                </span>
              </div>
              <div className="flex justify-between text-slate-800 font-bold pt-2 border-t border-blue-100">
                <span>合計金額:</span>
                <span className="text-base font-mono text-blue-700">
                  ¥{allocatedClinics.reduce((sum, c) => sum + c.items.reduce((s, it) => s + ((Number(it.qty) || 0) * (it.unitPrice || 0)), 0), 0).toLocaleString()} JPY
                </span>
              </div>
            </div>

            {/* Secondary Draft Save button */}
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={savingDraft || isProcessing}
              className="w-full bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300/80 font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
            >
              {savingDraft ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
                  <span>保存中...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 text-amber-600" />
                  <span>{activeDraftId ? '編集中の下書きを更新保存' : '途中状態を下書き保存'}</span>
                </>
              )}
            </button>

            {/* Bulk execution button */}
            <button
              type="button"
              onClick={handleBulkSubmit}
              disabled={isProcessing}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold py-3.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-emerald-900/10 active:scale-[0.98]"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>処理中...</span>
                </>
              ) : (
                <>
                  <FileArchive className="w-4 h-4" />
                  <span>一括確定してインボイスZIP出力</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>

      {/* Multi-Clinic Selection Modal */}
      {showMultiClinicModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl space-y-4 border border-slate-100 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">複数クリニックの一括選択追加</h3>
                  <p className="text-[11px] text-slate-500">発送対象とするクリニックにチェックを入れて「一括追加」をクリックしてください。</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMultiClinicModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-200/70 text-xs">
              <button
                type="button"
                onClick={handleToggleSelectAllClinics}
                className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1.5 cursor-pointer"
              >
                {multiSelectedClinicIds.length === activeClinics.length ? (
                  <>
                    <CheckSquare className="w-4 h-4" />
                    <span>すべての選択を解除</span>
                  </>
                ) : (
                  <>
                    <Square className="w-4 h-4" />
                    <span>すべてのクリニックを全選択 ({activeClinics.length}件)</span>
                  </>
                )}
              </button>
              <span className="font-mono font-bold text-slate-700">
                {multiSelectedClinicIds.length} / {activeClinics.length} 件選択中
              </span>
            </div>

            <div className="max-h-[320px] overflow-y-auto space-y-2 pr-1">
              {activeClinics.map(c => {
                const isSelected = multiSelectedClinicIds.includes(c.id);
                const isAlreadyAdded = allocatedClinics.some(ac => ac.clinicId === c.id);

                return (
                  <div
                    key={c.id}
                    onClick={() => {
                      if (isSelected) {
                        setMultiSelectedClinicIds(prev => prev.filter(id => id !== c.id));
                      } else {
                        setMultiSelectedClinicIds(prev => [...prev, c.id]);
                      }
                    }}
                    className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-colors ${
                      isSelected 
                        ? 'bg-indigo-50/70 border-indigo-300' 
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={isSelected ? 'text-indigo-600' : 'text-slate-300'}>
                        {isSelected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                          <span>{c.name || c.nameEn}</span>
                          {c.clinicId && (
                            <span className="bg-slate-100 text-slate-600 font-mono text-[10px] px-1.5 py-0.2 rounded border">
                              {c.clinicId}
                            </span>
                          )}
                          {isAlreadyAdded && (
                            <span className="bg-emerald-100 text-emerald-800 text-[10px] px-1.5 py-0.2 rounded font-medium">
                              追加済み
                            </span>
                          )}
                        </div>
                        {c.address && (
                          <p className="text-[10px] text-slate-400 truncate max-w-sm">
                            📍 {c.prefecture}{c.city}{c.address}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowMultiClinicModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleConfirmMultiClinicAdd}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2 rounded-xl text-xs flex items-center gap-2 cursor-pointer shadow-sm transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>選択した {multiSelectedClinicIds.length} 件を追加</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Submit Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4 border border-slate-100 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileArchive className="w-4 h-4 text-emerald-600" />
                <span>一括発送の確定とインボイスZIP出力</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600">
              <div className="bg-slate-50 p-3.5 rounded-xl space-y-2 border border-slate-200/80">
                <div className="flex justify-between">
                  <span className="text-slate-500">発送件数:</span>
                  <span className="font-bold text-slate-900">{allocatedClinics.length} 件 (クリニック)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">発送元倉庫:</span>
                  <span className="font-semibold text-slate-800">
                    {warehouses.find(w => w.id === warehouseId)?.name || '未選択'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">取引通貨 / 発送日:</span>
                  <span className="font-mono font-semibold text-slate-800">{currency} / {date}</span>
                </div>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-xl text-amber-800 leading-relaxed text-[11px] space-y-1">
                <p className="font-bold flex items-center gap-1 text-amber-900">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>注意事項</span>
                </p>
                <p>・確定を実行すると即座に海外倉庫の在庫から出庫が行われます。</p>
                <p>・各クリニック用の商用インボイス(Commercial Invoice)のPDFが一括作成され、ZIP形式でダウンロードされます。</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={executeBulkSubmit}
                disabled={isProcessing}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold px-4 py-2 rounded-lg text-xs flex items-center gap-2 cursor-pointer shadow-sm transition-colors"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>処理中...</span>
                  </>
                ) : (
                  <>
                    <FileArchive className="w-4 h-4" />
                    <span>一括確定してZIP出力</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 animate-in fade-in slide-in-from-top-3 duration-200">
          <div className={`px-4 py-3 rounded-xl shadow-lg border text-xs font-bold flex items-center gap-2.5 ${
            toastMessage.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : toastMessage.type === 'info'
              ? 'bg-slate-900 border-slate-800 text-white'
              : 'bg-emerald-600 border-emerald-500 text-white'
          }`}>
            {toastMessage.type === 'error' && <AlertTriangle className="w-4 h-4 shrink-0" />}
            {toastMessage.type === 'info' && <Clock className="w-4 h-4 shrink-0" />}
            {toastMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0" />}
            <span>{toastMessage.text}</span>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              className="ml-2 text-current opacity-70 hover:opacity-100 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Action Confirmation Modal */}
      {modalConfig?.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-xl space-y-4 border border-slate-100 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                {modalConfig.isDanger ? (
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                ) : (
                  <FileEdit className="w-4 h-4 text-amber-600" />
                )}
                <span>{modalConfig.title}</span>
              </h3>
              <button
                type="button"
                onClick={() => setModalConfig(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {modalConfig.message}
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setModalConfig(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                {modalConfig.cancelText || 'キャンセル'}
              </button>
              <button
                type="button"
                onClick={modalConfig.onConfirm}
                className={`font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors ${
                  modalConfig.isDanger
                    ? 'bg-rose-600 hover:bg-rose-700 text-white'
                    : 'bg-amber-500 hover:bg-amber-600 text-white'
                }`}
              >
                <span>{modalConfig.confirmText}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

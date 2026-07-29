import React, { useState } from 'react';
import { 
  Search, 
  Eye, 
  Edit2, 
  Copy, 
  Trash2, 
  FileDown, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  ChevronDown,
  X,
  RefreshCw,
  Printer,
  ChevronUp,
  FileSpreadsheet,
  CheckSquare,
  Square,
  Calendar
} from 'lucide-react';
import { Shipment, Product, Warehouse, Clinic, SystemSettings } from '../types';
import { generateInvoicePDF, generatePackingListPDF, loadJapaneseFont } from '../lib/pdf';

interface ShipmentHistoryProps {
  shipments: Shipment[];
  products: Product[];
  warehouses: Warehouse[];
  clinics: Clinic[];
  settings: SystemSettings;
  onUpdateShipmentStatus: (id: string, status: Shipment['status'], trackingNo?: string) => Promise<void>;
  onDeleteShipment: (id: string) => Promise<void>;
  onEditShipment: (id: string, updatedData: Partial<Shipment>) => Promise<void>;
  onDuplicateShipment: (shipment: Shipment) => void;
}

export default function ShipmentHistory({
  shipments,
  products,
  warehouses,
  clinics,
  settings,
  onUpdateShipmentStatus,
  onDeleteShipment,
  onEditShipment,
  onDuplicateShipment
}: ShipmentHistoryProps) {
  
  // Search state
  const [searchInvoiceNo, setSearchInvoiceNo] = useState('');
  const [searchClinic, setSearchClinic] = useState('');
  const [searchProduct, setSearchProduct] = useState('');
  const [searchLot, setSearchLot] = useState('');
  const [searchStatus, setSearchStatus] = useState<string>('ALL');
  const [searchCourier, setSearchCourier] = useState('');
  const [searchTrackingNo, setSearchTrackingNo] = useState('');
  const [searchOperator, setSearchOperator] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Detail Modal state
  const [viewingShipment, setViewingShipment] = useState<Shipment | null>(null);
  const [isEditing, setIsEditing] = useState<Shipment | null>(null);

  // Status Change Modal State
  const [statusModal, setStatusModal] = useState<{
    isOpen: boolean;
    shipment: Shipment | null;
    targetStatus: Shipment['status'] | null;
    trackingNo: string;
    errorMsg: string;
    isSubmitting: boolean;
  }>({
    isOpen: false,
    shipment: null,
    targetStatus: null,
    trackingNo: '',
    errorMsg: '',
    isSubmitting: false
  });

  // Delete Modal State
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    shipmentId: string;
    invoiceNo: string;
    errorMsg: string;
    isSubmitting: boolean;
  }>({
    isOpen: false,
    shipmentId: '',
    invoiceNo: '',
    errorMsg: '',
    isSubmitting: false
  });

  // Notification Modal State
  const [notification, setNotification] = useState<{
    isOpen: boolean;
    type: 'success' | 'error';
    title: string;
    message: string;
  }>({
    isOpen: false,
    type: 'success',
    title: '',
    message: ''
  });

  // Edit fields
  const [editTrackingNo, setEditTrackingNo] = useState('');
  const [editShippingCost, setEditShippingCost] = useState(0);
  const [editNotes, setEditNotes] = useState('');

  // Date Quick Set Helpers
  const handleSetThisMonth = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
    setStartDate(firstDay);
    setEndDate(lastDay);
  };

  const handleSetLastMonth = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
    const lastDay = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);
    setStartDate(firstDay);
    setEndDate(lastDay);
  };

  const handleClearDates = () => {
    setStartDate('');
    setEndDate('');
  };

  // Filtering
  const filteredShipments = shipments.filter(s => {
    const invMatch = s.invoiceNo.toLowerCase().includes(searchInvoiceNo.toLowerCase());
    const clinicMatch = (s.clinicSnapshot?.name || '').toLowerCase().includes(searchClinic.toLowerCase()) ||
                        (s.clinicSnapshot?.nameEn || '').toLowerCase().includes(searchClinic.toLowerCase());
    const statusMatch = searchStatus === 'ALL' || s.status === searchStatus;
    
    // Date Range Matching
    const dateFromMatch = !startDate || s.date >= startDate;
    const dateToMatch = !endDate || s.date <= endDate;

    // Sub-items matching
    const itemMatch = searchProduct === '' && searchLot === ''
      ? true
      : s.items.some(it => 
          (it.nameJa.toLowerCase().includes(searchProduct.toLowerCase()) || it.sku.toLowerCase().includes(searchProduct.toLowerCase())) &&
          (it.lotNo.toLowerCase().includes(searchLot.toLowerCase()))
        );

    const courierMatch = s.courier.toLowerCase().includes(searchCourier.toLowerCase());
    const trackingMatch = s.trackingNo.toLowerCase().includes(searchTrackingNo.toLowerCase());
    const operatorMatch = s.createdByName.toLowerCase().includes(searchOperator.toLowerCase());

    return invMatch && clinicMatch && statusMatch && itemMatch && courierMatch && trackingMatch && operatorMatch && dateFromMatch && dateToMatch;
  });

  // Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Selection Handlers
  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSelectConfirmedAndShipped = () => {
    const targetIds = filteredShipments
      .filter(s => s.status === 'CONFIRMED' || s.status === 'SHIPPED')
      .map(s => s.id);
    setSelectedIds(targetIds);
  };

  const handleSelectAllFiltered = () => {
    const allIds = filteredShipments.map(s => s.id);
    setSelectedIds(allIds);
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  const isAllFilteredSelected = filteredShipments.length > 0 && filteredShipments.every(s => selectedIds.includes(s.id));

  const handleToggleSelectAll = () => {
    if (isAllFilteredSelected) {
      setSelectedIds(prev => prev.filter(id => !filteredShipments.some(fs => fs.id === id)));
    } else {
      const newIds = new Set([...selectedIds, ...filteredShipments.map(s => s.id)]);
      setSelectedIds(Array.from(newIds));
    }
  };

  // Export aggregated CSV (Grouped by Product)
  const handleExportAggregatedCSV = () => {
    const selectedShipments = shipments.filter(s => selectedIds.includes(s.id));
    if (selectedShipments.length === 0) {
      setNotification({
        isOpen: true,
        type: 'error',
        title: '対象未選択',
        message: 'CSV出力を行うインボイスデータを1件以上選択してください。'
      });
      return;
    }

    interface AggItem {
      sku: string;
      nameEn: string;
      nameJa: string;
      unit: string;
      totalQty: number;
      totalAmount: number;
      invoiceNumbers: Set<string>;
      lotsMap: Map<string, number>;
    }

    const aggMap = new Map<string, AggItem>();

    selectedShipments.forEach(s => {
      // 取消 (CANCELLED) 分は集計数量に一切反映しない
      if (s.status === 'CANCELLED') return;

      s.items.forEach(it => {
        const key = it.productId || it.sku || it.nameEn;
        if (!aggMap.has(key)) {
          aggMap.set(key, {
            sku: it.sku || '',
            nameEn: it.nameEn || '',
            nameJa: it.nameJa || '',
            unit: it.unit || '個',
            totalQty: 0,
            totalAmount: 0,
            invoiceNumbers: new Set(),
            lotsMap: new Map()
          });
        }
        const itemAgg = aggMap.get(key)!;
        itemAgg.totalQty += (it.qty || 0);
        itemAgg.totalAmount += (it.amount || 0);
        if (s.invoiceNo) itemAgg.invoiceNumbers.add(s.invoiceNo);
        if (it.lotNo) {
          const prevQty = itemAgg.lotsMap.get(it.lotNo) || 0;
          itemAgg.lotsMap.set(it.lotNo, prevQty + (it.qty || 0));
        }
      });
    });

    const escapeCSV = (val: any) => {
      if (val === null || val === undefined) return '""';
      return `"${String(val).replace(/"/g, '""')}"`;
    };

    const headers = [
      'SKU(商品コード)',
      '製剤名(英語)',
      '製剤名(日本語)',
      '単位',
      '合計数量',
      '合計金額',
      '対象インボイス数',
      '対象インボイス番号一覧',
      'ロット別数量内訳'
    ];

    const rows: string[] = [headers.map(escapeCSV).join(',')];

    Array.from(aggMap.values())
      .sort((a, b) => (a.nameEn || a.sku).localeCompare(b.nameEn || b.sku, 'en', { numeric: true }))
      .forEach(agg => {
        const invList = Array.from(agg.invoiceNumbers).join('; ');
        const lotsList = Array.from(agg.lotsMap.entries())
          .map(([lot, qty]) => `${lot}: ${qty}個`)
          .join('; ');

        const row = [
          agg.sku,
          agg.nameEn,
          agg.nameJa,
          agg.unit,
          agg.totalQty,
          agg.totalAmount,
          agg.invoiceNumbers.size,
          invList,
          lotsList
        ].map(escapeCSV).join(',');

        rows.push(row);
      });

    const csvContent = rows.join('\r\n');
    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    link.setAttribute('download', `製剤数量集計_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Export Detailed CSV (Item & Lot Breakdown)
  const handleExportDetailedCSV = () => {
    const selectedShipments = shipments.filter(s => selectedIds.includes(s.id));
    if (selectedShipments.length === 0) return;

    const escapeCSV = (val: any) => {
      if (val === null || val === undefined) return '""';
      return `"${String(val).replace(/"/g, '""')}"`;
    };

    const headers = [
      'インボイス番号',
      '発送日',
      'クリニック名',
      'ステータス',
      'SKU(商品コード)',
      '製剤名(英語)',
      '製剤名(日本語)',
      'ロット番号',
      '使用期限',
      '数量',
      '単位',
      '単価',
      '小計'
    ];

    const rows: string[] = [headers.map(escapeCSV).join(',')];

    selectedShipments.forEach(s => {
      // 取消 (CANCELLED) 分は出力数量明細に反映しない
      if (s.status === 'CANCELLED') return;

      s.items.forEach(it => {
        const row = [
          s.invoiceNo,
          s.date,
          s.clinicSnapshot?.nameEn || s.clinicSnapshot?.name || '',
          s.status === 'CONFIRMED' ? '確定' : s.status === 'SHIPPED' ? '発送済' : s.status === 'DRAFT' ? '下書き' : s.status === 'WAITING' ? '確認待ち' : '取消',
          it.sku,
          it.nameEn,
          it.nameJa,
          it.lotNo,
          it.expiryDate,
          it.qty,
          it.unit,
          it.unitPrice,
          it.amount
        ].map(escapeCSV).join(',');
        rows.push(row);
      });
    });

    const csvContent = rows.join('\r\n');
    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    link.setAttribute('download', `発送明細データ_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadInvoice = async (s: Shipment) => {
    await loadJapaneseFont();
    const doc = generateInvoicePDF(s, settings);
    doc.save(`${s.invoiceNo}_INVOICE.pdf`);
  };

  const handleDownloadPackingList = async (s: Shipment) => {
    await loadJapaneseFont();
    const doc = generatePackingListPDF(s, settings);
    doc.save(`${s.invoiceNo}_PACKING_LIST.pdf`);
  };

  // Open Status Modal
  const openStatusModal = (s: Shipment, targetStatus: Shipment['status']) => {
    setStatusModal({
      isOpen: true,
      shipment: s,
      targetStatus,
      trackingNo: s.trackingNo || '',
      errorMsg: '',
      isSubmitting: false
    });
  };

  // Submit Status Change
  const confirmStatusChange = async () => {
    if (!statusModal.shipment || !statusModal.targetStatus) return;

    const { shipment, targetStatus, trackingNo } = statusModal;

    setStatusModal(prev => ({ ...prev, isSubmitting: true, errorMsg: '' }));

    try {
      await onUpdateShipmentStatus(shipment.id, targetStatus, trackingNo.trim().toUpperCase());
      
      if (targetStatus === 'CONFIRMED') {
        await loadJapaneseFont();
        const doc = generateInvoicePDF(shipment, settings);
        doc.save(`${shipment.invoiceNo}_INVOICE.pdf`);
      }

      setStatusModal({
        isOpen: false,
        shipment: null,
        targetStatus: null,
        trackingNo: '',
        errorMsg: '',
        isSubmitting: false
      });

      // Update viewingShipment if it's currently open
      if (viewingShipment && viewingShipment.id === shipment.id) {
        setViewingShipment(prev => prev ? { ...prev, status: targetStatus, trackingNo: trackingNo.trim().toUpperCase() } : null);
      }

      setNotification({
        isOpen: true,
        type: 'success',
        title: 'ステータス更新完了',
        message: `インボイス [${shipment.invoiceNo}] のステータスを【${
          targetStatus === 'CONFIRMED' ? '確定' :
          targetStatus === 'SHIPPED' ? '発送済み' :
          targetStatus === 'CANCELLED' ? 'キャンセル（在庫自動復元）' : '下書き'
        }】に更新しました。`
      });
    } catch (err: any) {
      console.error(err);
      setStatusModal(prev => ({
        ...prev,
        isSubmitting: false,
        errorMsg: err.message || 'ステータスの更新中にエラーが発生しました。'
      }));
    }
  };

  // Open Delete Modal
  const openDeleteModal = (id: string, invNo: string) => {
    setDeleteModal({
      isOpen: true,
      shipmentId: id,
      invoiceNo: invNo,
      errorMsg: '',
      isSubmitting: false
    });
  };

  // Submit Delete
  const confirmDelete = async () => {
    if (!deleteModal.shipmentId) return;

    setDeleteModal(prev => ({ ...prev, isSubmitting: true, errorMsg: '' }));

    try {
      await onDeleteShipment(deleteModal.shipmentId);
      const deletedInvNo = deleteModal.invoiceNo;

      setDeleteModal({
        isOpen: false,
        shipmentId: '',
        invoiceNo: '',
        errorMsg: '',
        isSubmitting: false
      });

      if (viewingShipment && viewingShipment.id === deleteModal.shipmentId) {
        setViewingShipment(null);
      }

      setNotification({
        isOpen: true,
        type: 'success',
        title: '削除完了',
        message: `下書きデータ [${deletedInvNo}] を正常に削除しました。`
      });
    } catch (err: any) {
      console.error(err);
      setDeleteModal(prev => ({
        ...prev,
        isSubmitting: false,
        errorMsg: err.message || '削除処理中にエラーが発生しました。'
      }));
    }
  };

  const handleOpenEdit = (s: Shipment) => {
    setIsEditing(s);
    setEditTrackingNo(s.trackingNo || '');
    setEditShippingCost(s.shippingCost || 0);
    setEditNotes(s.notes || '');
  };

  const handleSaveEdit = async () => {
    if (!isEditing) return;

    try {
      const totalItemsAmount = isEditing.totalItemsAmount;
      const totalInvoiceAmount = totalItemsAmount + editShippingCost + isEditing.insurance + isEditing.otherCharges;

      await onEditShipment(isEditing.id, {
        trackingNo: editTrackingNo,
        shippingCost: editShippingCost,
        notes: editNotes,
        totalInvoiceAmount
      });

      setIsEditing(null);
      
      setNotification({
        isOpen: true,
        type: 'success',
        title: '更新完了',
        message: '発送追跡情報および送料・備考を更新しました。監査ログに保存されました。'
      });
    } catch (err: any) {
      console.error(err);
      setNotification({
        isOpen: true,
        type: 'error',
        title: '更新失敗',
        message: err.message || '情報の更新に失敗しました。'
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">発送履歴・帳票管理</h2>
        <p className="text-xs text-slate-500">
          全取引の監査、Commercial Invoice、Packing Listの再出力、ステータス変更（発送済、キャンセル調整等）が可能です。
        </p>
      </div>

      {/* Filter panel */}
      <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm space-y-4">
        {/* Date Range Section */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex flex-wrap items-center gap-2 text-xs w-full sm:w-auto">
            <span className="font-bold text-slate-700 text-xs shrink-0 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              <span>発送期間指定:</span>
            </span>
            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer"
              />
              <span className="text-slate-400">〜</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer"
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleSetThisMonth}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded text-xs font-semibold cursor-pointer transition-colors"
            >
              今月
            </button>
            <button
              type="button"
              onClick={handleSetLastMonth}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded text-xs font-semibold cursor-pointer transition-colors"
            >
              先月
            </button>
            {(startDate || endDate) && (
              <button
                type="button"
                onClick={handleClearDates}
                className="text-slate-400 hover:text-slate-600 text-xs underline cursor-pointer px-1"
              >
                期間解除
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">インボイス番号</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="INV-..."
                value={searchInvoiceNo}
                onChange={(e) => setSearchInvoiceNo(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded pl-8 pr-2 py-1.5 text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">クリニック名</label>
            <input
              type="text"
              placeholder="グナル美容外科..."
              value={searchClinic}
              onChange={(e) => setSearchClinic(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">発送状況 (ステータス)</label>
            <select
              value={searchStatus}
              onChange={(e) => setSearchStatus(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:outline-none"
            >
              <option value="ALL">すべて表示</option>
              <option value="DRAFT">下書き (Draft)</option>
              <option value="WAITING">確認待ち (Waiting)</option>
              <option value="CONFIRMED">確定 (Confirmed)</option>
              <option value="SHIPPED">発送済み (Shipped)</option>
              <option value="CANCELLED">キャンセル (Cancelled)</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-950 font-bold py-1.5 px-3 rounded text-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>詳細フィルター</span>
              {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Collapsible Advanced Filters */}
        {showAdvanced && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-3 border-t border-slate-100">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">取扱製剤名 / SKU</label>
              <input
                type="text"
                placeholder="Wellstox..."
                value={searchProduct}
                onChange={(e) => setSearchProduct(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">ロット番号</label>
              <input
                type="text"
                placeholder="LOT-..."
                value={searchLot}
                onChange={(e) => setSearchLot(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">追跡番号 / 配送会社</label>
              <input
                type="text"
                placeholder="EG123..."
                value={searchTrackingNo}
                onChange={(e) => setSearchTrackingNo(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">操作担当者</label>
              <input
                type="text"
                placeholder="操作者名"
                value={searchOperator}
                onChange={(e) => setSearchOperator(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* Selection & Batch CSV Export Panel */}
      <div className="bg-slate-900 text-white p-4 rounded-xl shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border border-slate-800">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-bold text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded border border-emerald-800/80 flex items-center gap-1.5">
            <CheckSquare className="w-4 h-4 text-emerald-400" />
            <span>選択中: {selectedIds.length} 件</span>
          </span>

          <button
            type="button"
            onClick={handleSelectConfirmedAndShipped}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1 rounded text-xs font-semibold cursor-pointer transition-colors"
            title="表示中の「確定」および「発送済み」の全インボイスを選択"
          >
            「確定・発送済み」を一括選択
          </button>

          <button
            type="button"
            onClick={handleSelectAllFiltered}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-2.5 py-1 rounded text-xs font-medium cursor-pointer"
          >
            表示中を全選択
          </button>

          {selectedIds.length > 0 && (
            <button
              type="button"
              onClick={handleClearSelection}
              className="text-slate-400 hover:text-slate-200 text-xs underline cursor-pointer ml-1"
            >
              選択解除
            </button>
          )}

          <span className="text-[11px] text-slate-400 font-normal ml-1">
            ※ 取消(CANCELLED)データはCSV集計数量から自動除外されます
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <button
            type="button"
            disabled={selectedIds.length === 0}
            onClick={handleExportAggregatedCSV}
            className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold px-4 py-1.5 rounded text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>製剤別集計CSV出力</span>
          </button>

          <button
            type="button"
            disabled={selectedIds.length === 0}
            onClick={handleExportDetailedCSV}
            className="w-full sm:w-auto bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 border border-slate-700 font-semibold px-3 py-1.5 rounded text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            title="選択インボイスの出荷品目・ロット別明細CSV"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>品目明細CSV</span>
          </button>
        </div>
      </div>

      {/* Shipments Table List */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="px-3 py-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={isAllFilteredSelected}
                    onChange={handleToggleSelectAll}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    title="表示中のすべての発送を選択/解除"
                  />
                </th>
                <th className="px-5 py-3">インボイス番号 / 発送日</th>
                <th className="px-5 py-3">クリニック名</th>
                <th className="px-5 py-3 text-right">品目数 / 総数量</th>
                <th className="px-5 py-3 text-right">インボイス合計金額</th>
                <th className="px-5 py-3">配送 / 追跡番号</th>
                <th className="px-5 py-3 text-center">状況</th>
                <th className="px-5 py-3 text-center">担当者</th>
                <th className="px-5 py-3 text-right w-44">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
              {filteredShipments.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-400">
                    条件に合致する発送データが見つかりません
                  </td>
                </tr>
              ) : (
                filteredShipments.map((s) => {
                  const isSelected = selectedIds.includes(s.id);
                  return (
                    <tr key={s.id} className={`hover:bg-slate-50/50 transition-colors ${isSelected ? 'bg-blue-50/30' : ''}`}>
                      <td className="px-3 py-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(s.id)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>
                      <td className="px-5 py-4">
                      <div className="font-bold font-mono text-blue-600">{s.invoiceNo}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">{s.date}</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-bold text-slate-800">{s.clinicSnapshot?.nameEn || s.clinicSnapshot?.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono truncate max-w-[150px] mt-0.5" title={s.clinicSnapshot?.name}>
                        {s.clinicSnapshot?.name}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right font-mono">
                      <div className="font-bold text-slate-900">{s.items.length} 品目</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{s.totalQty} 個</div>
                    </td>
                    <td className="px-5 py-4 text-right font-bold font-mono text-slate-950">
                      {s.currency === 'JPY' ? `¥${Math.round(s.totalInvoiceAmount).toLocaleString()}` : `${s.totalInvoiceAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${s.currency}`}
                    </td>
                    <td className="px-5 py-4 font-mono">
                      <div>{s.courier}</div>
                      <div className="text-[10px] text-slate-500 truncate max-w-[110px] font-bold mt-0.5" title={s.trackingNo}>
                        {s.trackingNo || '---'}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold border ${
                        s.status === 'CONFIRMED' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' :
                        s.status === 'SHIPPED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                        s.status === 'DRAFT' ? 'bg-slate-100 text-slate-500 border border-slate-200' :
                        s.status === 'WAITING' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                        'bg-red-50 text-red-700 border border-red-100'
                      }`}>
                        {s.status === 'CONFIRMED' ? '確定' :
                         s.status === 'SHIPPED' ? '発送済' :
                         s.status === 'DRAFT' ? '下書き' :
                         s.status === 'WAITING' ? '確認待ち' : '取消'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center font-semibold text-slate-500 text-[10px]">
                      {s.createdByName || 'System'}
                    </td>
                    
                    <td className="px-5 py-4 text-right">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        
                        {/* Eye details */}
                        <button
                          onClick={() => setViewingShipment(s)}
                          className="bg-white hover:bg-slate-100 text-slate-600 p-1.5 rounded border border-slate-200 hover:border-slate-300 cursor-pointer"
                          title="詳細閲覧・PDFプレビュー"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {/* PDF Downloads */}
                        {s.status !== 'DRAFT' && (
                          <>
                            <button
                              onClick={() => handleDownloadInvoice(s)}
                              className="bg-white hover:bg-blue-50 text-blue-600 p-1.5 rounded border border-slate-200 hover:border-blue-200 cursor-pointer"
                              title="Invoice PDF"
                            >
                              <FileDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDownloadPackingList(s)}
                              className="bg-white hover:bg-indigo-50 text-indigo-600 p-1.5 rounded border border-slate-200 hover:border-indigo-200 cursor-pointer"
                              title="Packing List PDF"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}

                        {/* Edit metadata */}
                        {s.status !== 'CANCELLED' && (
                          <button
                            onClick={() => handleOpenEdit(s)}
                            className="bg-white hover:bg-slate-100 text-slate-600 p-1.5 rounded border border-slate-200 cursor-pointer"
                            title="出荷追跡・経費編集"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Duplicate */}
                        <button
                          onClick={() => onDuplicateShipment(s)}
                          className="bg-white hover:bg-slate-100 text-slate-600 p-1.5 rounded border border-slate-200 cursor-pointer"
                          title="この発送を複製"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>

                        {/* Actions mapping based on status */}
                        {s.status === 'DRAFT' && (
                          <>
                            <button
                              onClick={() => onDuplicateShipment(s)}
                              className="bg-amber-50 hover:bg-amber-100 text-amber-800 px-2 py-1 rounded text-[10px] font-bold border border-amber-200 cursor-pointer flex items-center gap-1"
                              title="下書きを編集フォームに読み込む"
                            >
                              編集
                            </button>
                            <button
                              onClick={() => openStatusModal(s, 'CONFIRMED')}
                              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-[10px] font-bold border border-emerald-100 cursor-pointer"
                            >
                              確定
                            </button>
                            <button
                              onClick={() => openDeleteModal(s.id, s.invoiceNo)}
                              className="bg-white hover:bg-red-50 text-red-600 p-1.5 rounded border border-slate-200 hover:border-red-200 cursor-pointer"
                              title="下書きを完全削除"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}

                        {s.status === 'CONFIRMED' && (
                          <>
                            <button
                              onClick={() => openStatusModal(s, 'SHIPPED')}
                              className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-2 py-1 rounded text-[10px] font-bold border border-blue-100 cursor-pointer"
                            >
                              発送済にする
                            </button>
                            <button
                              onClick={() => openStatusModal(s, 'CANCELLED')}
                              className="bg-red-50 hover:bg-red-100 text-red-700 px-2 py-1 rounded text-[10px] font-bold border border-red-100 cursor-pointer"
                            >
                              取消
                            </button>
                          </>
                        )}

                        {s.status === 'SHIPPED' && (
                          <button
                            onClick={() => openStatusModal(s, 'CANCELLED')}
                            className="bg-red-50 hover:bg-red-100 text-red-700 px-2 py-1 rounded text-[10px] font-bold border border-red-100 cursor-pointer"
                          >
                            取消
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

      {/* Editing Metadata Modal */}
      {isEditing && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-sm font-bold text-slate-900">発送情報の追記・編集 [ {isEditing.invoiceNo} ]</h3>
              <button onClick={() => setIsEditing(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">追跡番号 (Tracking Number)</label>
                <input
                  type="text"
                  value={editTrackingNo}
                  onChange={(e) => setEditTrackingNo(e.target.value.toUpperCase())}
                  className="w-full border border-slate-200 rounded px-3 py-1.5 font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">送料実費 (Shipping Cost)</label>
                <input
                  type="number"
                  value={editShippingCost}
                  onChange={(e) => setEditShippingCost(Number(e.target.value))}
                  className="w-full border border-slate-200 rounded px-3 py-1.5 font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">備考 (Notes)</label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={3}
                  className="w-full border border-slate-200 rounded p-2"
                />
              </div>

              <div className="border-t border-slate-100 pt-4 flex justify-end gap-2">
                <button
                  onClick={() => setIsEditing(null)}
                  className="bg-white border border-slate-200 text-slate-700 px-4 py-1.5 rounded font-semibold cursor-pointer"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-1.5 rounded cursor-pointer"
                >
                  保存する
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Viewing details & Document viewer Modal */}
      {viewingShipment && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-sm font-bold text-slate-900">出荷明細詳細・インボイス閲覧</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">インボイス番号: {viewingShipment.invoiceNo}</p>
              </div>
              <button onClick={() => setViewingShipment(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-slate-700">
              {/* Top metadata grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200/50">
                <div>
                  <span className="text-slate-400 block font-bold text-[9px] uppercase">発送日 / 発行日</span>
                  <span className="font-semibold">{viewingShipment.date}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-bold text-[9px] uppercase">取引通貨 / ステータス</span>
                  <span className="font-semibold">{viewingShipment.currency} / {viewingShipment.status}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-bold text-[9px] uppercase">配送会社 / 追跡番号</span>
                  <span className="font-semibold">{viewingShipment.courier} ({viewingShipment.trackingNo || '未登録'})</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-bold text-[9px] uppercase">操作者 / 作成日時</span>
                  <span className="font-semibold font-mono text-[10px]">{viewingShipment.createdByName}</span>
                </div>
              </div>

              {/* Shipper vs Consignee snapshot */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-slate-200 p-4 rounded-lg space-y-2">
                  <h4 className="font-bold text-slate-900 border-b border-slate-100 pb-1 text-[10px] text-blue-600">SHIPPER (発送元)</h4>
                  <p className="font-bold">{viewingShipment.warehouseSnapshot?.nameEn || viewingShipment.warehouseSnapshot?.name}</p>
                  <p className="text-[11px] text-slate-500">{viewingShipment.warehouseSnapshot?.addressEn || viewingShipment.warehouseSnapshot?.address}</p>
                  <p className="text-[10px] text-slate-400 font-mono">TEL: {viewingShipment.warehouseSnapshot?.phone}</p>
                </div>

                <div className="border border-slate-200 p-4 rounded-lg space-y-2">
                  <h4 className="font-bold text-slate-900 border-b border-slate-100 pb-1 text-[10px] text-indigo-600">CONSIGNEE (配送先クリニック)</h4>
                  <p className="font-bold">{viewingShipment.clinicSnapshot?.nameEn || viewingShipment.clinicSnapshot?.name}</p>
                  <p className="text-[11px] text-slate-500">{viewingShipment.clinicSnapshot?.addressEn || viewingShipment.clinicSnapshot?.address}</p>
                  <p className="text-[10px] text-slate-400 font-mono">TEL: {viewingShipment.clinicSnapshot?.phone}</p>
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-500 uppercase tracking-wider">
                      <th className="px-4 py-2.5">No.</th>
                      <th className="px-4 py-2.5">SKU / 英語名</th>
                      <th className="px-4 py-2.5">ロット / 使用期限</th>
                      <th className="px-4 py-2.5 text-right">数量</th>
                      <th className="px-4 py-2.5 text-right">単価</th>
                      <th className="px-4 py-2.5 text-right">小計金額</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {viewingShipment.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 font-medium">
                        <td className="px-4 py-2.5 font-mono text-slate-400">{idx + 1}</td>
                        <td className="px-4 py-2.5">
                          <div className="font-bold text-slate-800">{item.sku}</div>
                          <div className="text-[10px] text-slate-400 font-sans mt-0.5">{item.nameEn}</div>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-slate-600">
                          <div>{item.lotNo}</div>
                          <span className="text-[10px] text-slate-400 font-sans">Exp: {item.expiryDate}</span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-900">{item.qty} {item.unit}</td>
                        <td className="px-4 py-2.5 text-right font-mono">
                          {viewingShipment.currency === 'JPY' ? `¥${Math.round(item.unitPrice).toLocaleString()}` : `${item.unitPrice.toFixed(2)} USD`}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-950">
                          {viewingShipment.currency === 'JPY' ? `¥${Math.round(item.amount).toLocaleString()}` : `${item.amount.toFixed(2)} USD`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Subtotals & costs */}
              <div className="flex justify-end pt-2">
                <div className="w-80 space-y-2 border-t border-slate-100 pt-2 text-xs font-semibold">
                  <div className="flex justify-between text-slate-500">
                    <span>商品合計金額:</span>
                    <span className="font-mono">
                      {viewingShipment.currency === 'JPY' ? `¥${Math.round(viewingShipment.totalItemsAmount).toLocaleString()}` : `${viewingShipment.totalItemsAmount.toFixed(2)} ${viewingShipment.currency}`}
                    </span>
                  </div>
                  {viewingShipment.shippingCost > 0 && (
                    <div className="flex justify-between text-slate-500">
                      <span>送料 (Shipping):</span>
                      <span className="font-mono">
                        {viewingShipment.currency === 'JPY' ? `¥${Math.round(viewingShipment.shippingCost).toLocaleString()}` : `${viewingShipment.shippingCost.toFixed(2)} ${viewingShipment.currency}`}
                      </span>
                    </div>
                  )}
                  {viewingShipment.insurance > 0 && (
                    <div className="flex justify-between text-slate-500">
                      <span>保険料 (Insurance):</span>
                      <span className="font-mono">
                        {viewingShipment.currency === 'JPY' ? `¥${Math.round(viewingShipment.insurance).toLocaleString()}` : `${viewingShipment.insurance.toFixed(2)} ${viewingShipment.currency}`}
                      </span>
                    </div>
                  )}
                  {viewingShipment.otherCharges > 0 && (
                    <div className="flex justify-between text-slate-500">
                      <span>その他加算:</span>
                      <span className="font-mono">
                        {viewingShipment.currency === 'JPY' ? `¥${Math.round(viewingShipment.otherCharges).toLocaleString()}` : `${viewingShipment.otherCharges.toFixed(2)} ${viewingShipment.currency}`}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-slate-200/80 pt-2 text-sm text-blue-600 font-bold">
                    <span>総合合計額 (GRAND TOTAL):</span>
                    <span className="font-mono">
                      {viewingShipment.currency === 'JPY' ? `¥${Math.round(viewingShipment.totalInvoiceAmount).toLocaleString()}` : `${viewingShipment.totalInvoiceAmount.toFixed(2)} ${viewingShipment.currency}`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Adjustment Logs / Shipment History Trail */}
              {viewingShipment.history && viewingShipment.history.length > 0 && (
                <div className="border border-slate-200 rounded-lg p-4 space-y-2">
                  <h4 className="font-bold text-slate-900 text-[10px] uppercase border-b border-slate-100 pb-1">操作変更履歴</h4>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto font-mono text-[10px] text-slate-500">
                    {viewingShipment.history.map((h, i) => (
                      <div key={i} className="flex gap-4">
                        <span className="text-slate-400 shrink-0">{h.date}</span>
                        <span className="text-slate-700 shrink-0">[{h.user}]</span>
                        <span className="text-indigo-600 shrink-0 font-bold">{h.action}</span>
                        <span className="text-slate-500">{h.detail}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                {viewingShipment.status === 'DRAFT' && (
                  <>
                    <button
                      onClick={() => openStatusModal(viewingShipment, 'CONFIRMED')}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded text-xs cursor-pointer"
                    >
                      下書きを確定する
                    </button>
                    <button
                      onClick={() => openDeleteModal(viewingShipment.id, viewingShipment.invoiceNo)}
                      className="bg-red-50 hover:bg-red-100 text-red-700 font-bold px-3 py-1.5 rounded text-xs border border-red-200 cursor-pointer flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>削除</span>
                    </button>
                  </>
                )}
                {viewingShipment.status === 'CONFIRMED' && (
                  <>
                    <button
                      onClick={() => openStatusModal(viewingShipment, 'SHIPPED')}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1.5 rounded text-xs cursor-pointer"
                    >
                      発送済にする
                    </button>
                    <button
                      onClick={() => openStatusModal(viewingShipment, 'CANCELLED')}
                      className="bg-red-50 hover:bg-red-100 text-red-700 font-bold px-3 py-1.5 rounded text-xs border border-red-200 cursor-pointer"
                    >
                      発送取消 (在庫復元)
                    </button>
                  </>
                )}
                {viewingShipment.status === 'SHIPPED' && (
                  <button
                    onClick={() => openStatusModal(viewingShipment, 'CANCELLED')}
                    className="bg-red-50 hover:bg-red-100 text-red-700 font-bold px-3 py-1.5 rounded text-xs border border-red-200 cursor-pointer"
                  >
                    発送取消 (在庫復元)
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setViewingShipment(null)}
                  className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  閉じる
                </button>

                {viewingShipment.status !== 'DRAFT' && (
                  <>
                    <button
                      onClick={() => handleDownloadInvoice(viewingShipment)}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <FileDown className="w-4 h-4" />
                      <span>Invoice PDF保存</span>
                    </button>
                    <button
                      onClick={() => handleDownloadPackingList(viewingShipment)}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <Printer className="w-4 h-4" />
                      <span>Packing List PDF保存</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status Change Modal */}
      {statusModal.isOpen && statusModal.shipment && statusModal.targetStatus && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-blue-600" />
                <span>発送ステータス変更の確認</span>
              </h3>
              <button 
                onClick={() => setStatusModal(prev => ({ ...prev, isOpen: false }))}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200/60 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">インボイス番号:</span>
                  <span className="font-mono font-bold text-slate-900">{statusModal.shipment.invoiceNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">配送先クリニック:</span>
                  <span className="font-bold text-slate-800">{statusModal.shipment.clinicSnapshot?.nameEn || statusModal.shipment.clinicSnapshot?.name}</span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-slate-200/50">
                  <span className="text-slate-500 font-bold">変更前の状態:</span>
                  <span className="px-2 py-0.5 rounded font-bold bg-slate-200 text-slate-700 text-[10px]">
                    {statusModal.shipment.status}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-bold">変更後の状態:</span>
                  <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                    statusModal.targetStatus === 'CONFIRMED' ? 'bg-indigo-100 text-indigo-800' :
                    statusModal.targetStatus === 'SHIPPED' ? 'bg-emerald-100 text-emerald-800' :
                    statusModal.targetStatus === 'CANCELLED' ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-800'
                  }`}>
                    {statusModal.targetStatus === 'CONFIRMED' ? '確定 (CONFIRMED)' :
                     statusModal.targetStatus === 'SHIPPED' ? '発送済み (SHIPPED)' :
                     statusModal.targetStatus === 'CANCELLED' ? 'キャンセル (CANCELLED)' : '下書き'}
                  </span>
                </div>
              </div>

              {/* Special field for SHIPPED status: Tracking Number */}
              {statusModal.targetStatus === 'SHIPPED' && (
                <div className="space-y-1.5 bg-blue-50/60 p-3.5 rounded-lg border border-blue-100">
                  <label className="block font-bold text-blue-900 text-xs">
                    追跡番号 (Tracking Number)
                  </label>
                  <p className="text-[10px] text-blue-700">
                    配送会社: <span className="font-bold">{statusModal.shipment.courier}</span>
                  </p>
                  <input
                    type="text"
                    placeholder="例: EG123456789KR"
                    value={statusModal.trackingNo}
                    onChange={(e) => setStatusModal(prev => ({ ...prev, trackingNo: e.target.value }))}
                    className="w-full bg-white border border-blue-200 rounded px-3 py-1.5 text-xs font-mono font-bold uppercase focus:outline-none focus:border-blue-500"
                  />
                </div>
              )}

              {/* Special notice for CANCELLED status */}
              {statusModal.targetStatus === 'CANCELLED' && (
                <div className="bg-amber-50 border border-amber-200 text-amber-900 p-3 rounded-lg text-[11px] flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block mb-0.5">在庫の自動復元処理について</span>
                    この発送データをキャンセルすると、対象となっていた各製剤・ロットの在庫数が対象倉庫に自動的に差し戻されます。
                  </div>
                </div>
              )}

              {statusModal.errorMsg && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-xs font-semibold flex items-center gap-2">
                  <XCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{statusModal.errorMsg}</span>
                </div>
              )}

              <div className="border-t border-slate-100 pt-4 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={statusModal.isSubmitting}
                  onClick={() => setStatusModal(prev => ({ ...prev, isOpen: false }))}
                  className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded text-xs font-semibold hover:bg-slate-50 cursor-pointer disabled:opacity-50"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  disabled={statusModal.isSubmitting}
                  onClick={confirmStatusChange}
                  className={`px-4 py-2 rounded text-xs font-bold text-white shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                    statusModal.targetStatus === 'CANCELLED' ? 'bg-red-600 hover:bg-red-700' :
                    statusModal.targetStatus === 'SHIPPED' ? 'bg-blue-600 hover:bg-blue-700' :
                    'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {statusModal.isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{statusModal.isSubmitting ? '処理中...' : '変更を確定する'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-red-100 flex items-center justify-between bg-red-50/50">
              <h3 className="text-sm font-bold text-red-900 flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-red-600" />
                <span>下書き発送データの削除</span>
              </h3>
              <button 
                onClick={() => setDeleteModal(prev => ({ ...prev, isOpen: false }))}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <p className="text-slate-700 font-medium">
                下書きの発送データ <span className="font-mono font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded">[{deleteModal.invoiceNo}]</span> を完全に削除しますか？
              </p>
              <p className="text-slate-500 text-[11px]">
                この操作を取り消すことはできません。
              </p>

              {deleteModal.errorMsg && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-xs font-semibold flex items-center gap-2">
                  <XCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{deleteModal.errorMsg}</span>
                </div>
              )}

              <div className="border-t border-slate-100 pt-4 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={deleteModal.isSubmitting}
                  onClick={() => setDeleteModal(prev => ({ ...prev, isOpen: false }))}
                  className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded text-xs font-semibold hover:bg-slate-50 cursor-pointer disabled:opacity-50"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  disabled={deleteModal.isSubmitting}
                  onClick={confirmDelete}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2 rounded text-xs shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {deleteModal.isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{deleteModal.isSubmitting ? '削除中...' : '削除を実行する'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notification Modal */}
      {notification.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className={`px-6 py-4 border-b flex items-center justify-between ${
              notification.type === 'success' ? 'bg-emerald-50/60 border-emerald-100' : 'bg-red-50/60 border-red-100'
            }`}>
              <h3 className={`text-sm font-bold flex items-center gap-2 ${
                notification.type === 'success' ? 'text-emerald-900' : 'text-red-900'
              }`}>
                {notification.type === 'success' ? (
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-600" />
                )}
                <span>{notification.title}</span>
              </h3>
              <button 
                onClick={() => setNotification(prev => ({ ...prev, isOpen: false }))}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <p className="text-slate-700 font-medium leading-relaxed">
                {notification.message}
              </p>

              <div className="border-t border-slate-100 pt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setNotification(prev => ({ ...prev, isOpen: false }))}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-5 py-2 rounded text-xs cursor-pointer shadow-sm"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

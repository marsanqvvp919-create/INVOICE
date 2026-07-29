import React, { useState } from 'react';
import { 
  Package, 
  TrendingUp, 
  FileText, 
  Layers, 
  Clock, 
  ArrowRight,
  Truck,
  Plus,
  Sparkles,
  Building2,
  Box,
  RefreshCw,
  X,
  XCircle,
  CheckCircle,
  AlertTriangle,
  Trash2,
  ExternalLink,
  Ban
} from 'lucide-react';
import { Shipment, Product, Clinic, SystemSettings } from '../types';
import { generateInvoicePDF, loadJapaneseFont } from '../lib/pdf';

interface DashboardProps {
  products: Product[];
  shipments: Shipment[];
  clinics: Clinic[];
  settings?: SystemSettings;
  setActiveTab: (tab: string) => void;
  setSelectedShipmentId?: (id: string) => void;
  onUpdateShipmentStatus?: (id: string, status: Shipment['status'], trackingNo?: string) => Promise<void>;
  onDeleteShipment?: (id: string) => Promise<void>;
}

export default function Dashboard({ 
  products, 
  shipments, 
  clinics, 
  settings,
  setActiveTab,
  setSelectedShipmentId,
  onUpdateShipmentStatus,
  onDeleteShipment
}: DashboardProps) {
  
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

  // Open Status Change Modal
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

  // Submit Status Change (Confirm / Shipped / Cancel)
  const confirmStatusChange = async () => {
    if (!statusModal.shipment || !statusModal.targetStatus || !onUpdateShipmentStatus) return;

    const { shipment, targetStatus, trackingNo } = statusModal;

    setStatusModal(prev => ({ ...prev, isSubmitting: true, errorMsg: '' }));

    try {
      await onUpdateShipmentStatus(shipment.id, targetStatus, trackingNo.trim().toUpperCase());
      
      if (targetStatus === 'CONFIRMED' && settings) {
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

      setNotification({
        isOpen: true,
        type: 'success',
        title: 'ステータス更新完了',
        message: `インボイス [${shipment.invoiceNo}] のステータスを【${
          targetStatus === 'CONFIRMED' ? '確定' :
          targetStatus === 'SHIPPED' ? '発送済み' :
          targetStatus === 'CANCELLED' ? 'キャンセル（在庫自動復元完了）' : '下書き'
        }】に正常更新しました。`
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
  
  // Calculations
  const totalStock = products.reduce((acc, p) => acc + (p.currentStock || 0), 0);
  
  // Current month stats
  const currentMonthStr = new Date().toISOString().substring(0, 7); // YYYY-MM
  const thisMonthShipments = shipments.filter(s => (s.date || '').startsWith(currentMonthStr) && s.status !== 'CANCELLED');
  const thisMonthConfirmed = thisMonthShipments.filter(s => s.status === 'CONFIRMED' || s.status === 'SHIPPED');
  
  const monthlyShipmentCount = thisMonthShipments.length;
  const monthlyQuantity = thisMonthConfirmed.reduce((acc, s) => acc + s.totalQty, 0);
  
  // Pending (Draft & Waiting) shipments
  const pendingShipments = shipments.filter(s => s.status === 'DRAFT' || s.status === 'WAITING');
  
  // Recent Invoices
  const recentInvoices = [...shipments]
    .sort((a, b) => (b.createdAt || b.date || '').localeCompare(a.createdAt || a.date || ''))
    .slice(0, 6);

  // Clinic shipment distribution (Excluding CANCELLED)
  const clinicShipmentMap: Record<string, number> = {};
  shipments.filter(s => s.status !== 'CANCELLED').forEach(s => {
    const name = s.clinicSnapshot?.name || '不明なクリニック';
    clinicShipmentMap[name] = (clinicShipmentMap[name] || 0) + 1;
  });
  
  const clinicShipmentList = Object.entries(clinicShipmentMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Metric Cards Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
        {/* This month's total quantity shipped */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all duration-200 flex items-center justify-between group">
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">今月の発送数量</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-black font-mono text-slate-900 group-hover:text-emerald-600 transition-colors">{monthlyQuantity.toLocaleString()}</span>
              <span className="text-xs text-slate-500 font-bold">個</span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium">確定済み発送の合計</p>
          </div>
          <div className="w-12 h-12 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
            <Truck className="w-6 h-6" />
          </div>
        </div>

        {/* This month's shipments count */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all duration-200 flex items-center justify-between group">
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">今月の発送件数</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-black font-mono text-slate-900 group-hover:text-indigo-600 transition-colors">{monthlyShipmentCount}</span>
              <span className="text-xs text-slate-500 font-bold">件</span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium">{currentMonthStr}の発送実績</p>
          </div>
          <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* Unconfirmed data count */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all duration-200 flex items-center justify-between group">
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">未確定の発送データ</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-black font-mono text-amber-600 group-hover:text-amber-700 transition-colors">{pendingShipments.length}</span>
              <span className="text-xs text-slate-500 font-bold">件</span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium">下書き・確認待ちデータ</p>
          </div>
          <div className="w-12 h-12 bg-amber-50 border border-amber-100 rounded-2xl flex items-center justify-center text-amber-600 group-hover:scale-110 transition-transform">
            <Clock className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Invoices & Products */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Recent Invoices Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">最近の発送インボイス</h3>
                  <p className="text-[11px] text-slate-500 font-medium">直近作成された発送データ一覧</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setActiveTab('shipments')}
                className="text-xs text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-blue-50 transition-colors cursor-pointer"
              >
                <span>すべて表示</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                    <th className="px-5 py-3">インボイス番号</th>
                    <th className="px-5 py-3">発送日</th>
                    <th className="px-5 py-3">発送先クリニック</th>
                    <th className="px-5 py-3 text-right">数量</th>
                    <th className="px-5 py-3 text-right">金額</th>
                    <th className="px-5 py-3 text-center">ステータス</th>
                    <th className="px-5 py-3 text-center">クイック操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {recentInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-slate-400 font-medium">
                        発送履歴データがありません
                      </td>
                    </tr>
                  ) : (
                    recentInvoices.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-5 py-3.5 font-bold font-mono text-blue-600">
                          <button 
                            type="button"
                            onClick={() => setActiveTab('shipments')}
                            className="hover:underline flex items-center gap-1 cursor-pointer"
                            title="発送履歴管理で詳細を表示"
                          >
                            <span>{s.invoiceNo}</span>
                            <ExternalLink className="w-3 h-3 text-blue-400 opacity-60 hover:opacity-100" />
                          </button>
                        </td>
                        <td className="px-5 py-3.5 text-slate-500 font-mono">
                          {s.date}
                        </td>
                        <td className="px-5 py-3.5 font-bold text-slate-800 max-w-[180px] truncate">
                          {s.clinicSnapshot?.name || '不明なクリニック'}
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono font-bold text-slate-900">
                          {s.totalQty.toLocaleString()}
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono font-bold text-slate-900">
                          {s.currency === 'JPY' ? `¥${Math.round(s.totalInvoiceAmount).toLocaleString()}` : `${s.totalInvoiceAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${s.currency}`}
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            s.status === 'CONFIRMED' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                            s.status === 'SHIPPED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                            s.status === 'DRAFT' ? 'bg-slate-100 text-slate-600 border border-slate-200' :
                            s.status === 'WAITING' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                            'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}>
                            {s.status === 'CONFIRMED' ? '確定' :
                             s.status === 'SHIPPED' ? '発送済み' :
                             s.status === 'DRAFT' ? '下書き' :
                             s.status === 'WAITING' ? '確認待ち' : 'キャンセル'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {s.status === 'DRAFT' && (
                              <button
                                type="button"
                                onClick={() => openStatusModal(s, 'CONFIRMED')}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1 rounded text-[10px] font-bold shadow-xs cursor-pointer transition-colors"
                              >
                                確定する
                              </button>
                            )}

                            {s.status === 'CONFIRMED' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => openStatusModal(s, 'SHIPPED')}
                                  className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-[10px] font-bold shadow-xs cursor-pointer transition-colors"
                                >
                                  発送済
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openStatusModal(s, 'CANCELLED')}
                                  className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition-colors flex items-center gap-0.5"
                                  title="発送をキャンセルして在庫を復元"
                                >
                                  <Ban className="w-3 h-3 text-rose-600" />
                                  <span>取消</span>
                                </button>
                              </>
                            )}

                            {s.status === 'SHIPPED' && (
                              <button
                                type="button"
                                onClick={() => openStatusModal(s, 'CANCELLED')}
                                className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition-colors flex items-center gap-0.5"
                                title="発送をキャンセルして在庫を復元"
                              >
                                <Ban className="w-3 h-3 text-rose-600" />
                                <span>取消</span>
                              </button>
                            )}

                            {s.status === 'CANCELLED' && (
                              <span className="text-[10px] text-slate-400 font-medium italic">処理済</span>
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

          {/* Product Stock Status Grid */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                  <Box className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">製剤別在庫状況</h3>
                  <p className="text-[11px] text-slate-500 font-medium">主要製剤のリアルタイム在庫数</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setActiveTab('products')}
                className="text-xs text-indigo-600 hover:text-indigo-700 font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-indigo-50 transition-colors cursor-pointer"
              >
                <span>マスタ詳細</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {products.map(p => {
                const isLow = (p.currentStock || 0) <= (p.minStock || 0);
                return (
                  <div key={p.id} className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 flex items-center justify-between transition-colors">
                    <div className="min-w-0 pr-2">
                      <p className="font-bold text-xs text-slate-900 truncate">{p.nameJa}</p>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">SKU: {p.sku}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="flex items-baseline justify-end gap-1 font-mono">
                        <span className={`text-sm font-black ${isLow ? 'text-rose-600' : 'text-slate-900'}`}>{p.currentStock}</span>
                        <span className="text-[10px] font-bold text-slate-500">{p.unit}</span>
                      </div>
                      {isLow && (
                        <span className="text-[9px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200 inline-block mt-0.5">
                          適正在庫割れ
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Right Column: Quick Action CTA & Distribution Chart */}
        <div className="space-y-6">
          
          {/* Quick Action Hero Card */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 text-white rounded-2xl p-6 shadow-md relative overflow-hidden">
            <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
            
            <div className="space-y-4 relative z-10">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 text-[10px] font-bold">一括処理対応</span>
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              </div>

              <div>
                <h4 className="text-base font-extrabold text-white tracking-tight">複数クリニック一括発送</h4>
                <p className="text-xs text-slate-300 leading-relaxed mt-1">
                  海外倉庫から複数の日本国内提携クリニックへワンストップで一括発送データを生成できます。
                </p>
              </div>

              <div className="pt-2">
                <button 
                  type="button"
                  onClick={() => setActiveTab('bulk-allocation')}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-600/30 cursor-pointer"
                >
                  <Layers className="w-4 h-4 text-white" />
                  <span>一括発送フォームを開く</span>
                </button>
              </div>
            </div>
          </div>

          {/* Clinic Distribution Panel */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">クリニック別発送シェア</h3>
                <p className="text-[11px] text-slate-500 font-medium">発送頻度の高い提携クリニック</p>
              </div>
            </div>
            
            <div className="space-y-3 pt-1">
              {clinicShipmentList.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6 font-medium">
                  十分な発送履歴がありません
                </p>
              ) : (
                clinicShipmentList.map((c, i) => {
                  const maxCount = Math.max(...clinicShipmentList.map(item => item.count));
                  const widthPercent = (c.count / maxCount) * 100;
                  
                  return (
                    <div key={i} className="space-y-1.5">
                      <div className="flex justify-between text-xs font-bold text-slate-800">
                        <span className="truncate max-w-[170px]">{c.name}</span>
                        <span className="font-mono text-blue-600">{c.count}件</span>
                      </div>
                      <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-500"
                          style={{ width: `${widthPercent}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Master Overview Card */}
          <div className="bg-slate-900/5 border border-slate-200/80 rounded-2xl p-5 space-y-3 text-xs text-slate-700">
            <h4 className="font-extrabold text-slate-900 flex items-center gap-2">
              <span>システム基本統計</span>
            </h4>
            <div className="space-y-2.5 pt-1">
              <div className="flex justify-between items-center border-b border-slate-200/60 pb-2">
                <span className="text-slate-500 font-medium">登録クリニック数</span>
                <span className="font-bold font-mono text-slate-900">{clinics.length} 院</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-200/60 pb-2">
                <span className="text-slate-500 font-medium">取扱製剤数</span>
                <span className="font-bold font-mono text-slate-900">{products.length} 品目</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">今月発送確定額</span>
                <span className="font-bold font-mono text-blue-600">
                  ¥{Math.round(thisMonthConfirmed.reduce((acc, s) => acc + s.totalInvoiceAmount, 0)).toLocaleString()} 円
                </span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Status Change Confirmation Modal */}
      {statusModal.isOpen && statusModal.shipment && statusModal.targetStatus && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-blue-600" />
                <span>発送ステータス変更の確認</span>
              </h3>
              <button 
                type="button"
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
                type="button"
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


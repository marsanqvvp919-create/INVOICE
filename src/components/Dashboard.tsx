import React from 'react';
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
  Box
} from 'lucide-react';
import { Shipment, Product, Clinic } from '../types';

interface DashboardProps {
  products: Product[];
  shipments: Shipment[];
  clinics: Clinic[];
  setActiveTab: (tab: string) => void;
  setSelectedShipmentId?: (id: string) => void;
}

export default function Dashboard({ 
  products, 
  shipments, 
  clinics, 
  setActiveTab,
  setSelectedShipmentId
}: DashboardProps) {
  
  // Calculations
  const totalStock = products.reduce((acc, p) => acc + (p.currentStock || 0), 0);
  
  // Current month stats
  const currentMonthStr = new Date().toISOString().substring(0, 7); // YYYY-MM
  const thisMonthShipments = shipments.filter(s => (s.date || '').startsWith(currentMonthStr));
  const thisMonthConfirmed = thisMonthShipments.filter(s => s.status === 'CONFIRMED' || s.status === 'SHIPPED');
  
  const monthlyShipmentCount = thisMonthShipments.length;
  const monthlyQuantity = thisMonthConfirmed.reduce((acc, s) => acc + s.totalQty, 0);
  
  // Pending (Draft & Waiting) shipments
  const pendingShipments = shipments.filter(s => s.status === 'DRAFT' || s.status === 'WAITING');
  
  // Recent Invoices
  const recentInvoices = [...shipments]
    .sort((a, b) => (b.createdAt || b.date || '').localeCompare(a.createdAt || a.date || ''))
    .slice(0, 6);

  // Clinic shipment distribution
  const clinicShipmentMap: Record<string, number> = {};
  shipments.forEach(s => {
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        {/* Total Stock */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all duration-200 flex items-center justify-between group">
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">海外倉庫 総在庫数</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-black font-mono text-slate-900 group-hover:text-blue-600 transition-colors">{totalStock.toLocaleString()}</span>
              <span className="text-xs text-slate-500 font-bold">個</span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium">全{products.length}品目の合算</p>
          </div>
          <div className="w-12 h-12 bg-blue-50 border border-blue-100 rounded-2xl flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
            <Package className="w-6 h-6" />
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {recentInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-10 text-slate-400 font-medium">
                        発送履歴データがありません
                      </td>
                    </tr>
                  ) : (
                    recentInvoices.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-5 py-3.5 font-bold font-mono text-blue-600">
                          {s.invoiceNo}
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
                  {thisMonthConfirmed.reduce((acc, s) => acc + s.totalInvoiceAmount, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} USD相当
                </span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}


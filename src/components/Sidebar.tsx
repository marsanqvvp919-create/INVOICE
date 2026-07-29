import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Hospital, 
  Package, 
  Warehouse, 
  PackagePlus, 
  Layers, 
  History, 
  ShieldAlert, 
  Settings,
  Boxes,
  Truck,
  ChevronDown,
  ChevronRight,
  Database,
  Sparkles,
  ArrowUpRight
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function Sidebar({ 
  activeTab, 
  setActiveTab
}: SidebarProps) {
  const masterTabIds = ['clinics', 'products', 'warehouses', 'suppliers'];
  const [isMasterOpen, setIsMasterOpen] = useState(() => masterTabIds.includes(activeTab));

  useEffect(() => {
    if (masterTabIds.includes(activeTab)) {
      setIsMasterOpen(true);
    }
  }, [activeTab]);
  
  const mainMenuItems = [
    { id: 'dashboard', label: 'ダッシュボード', icon: LayoutDashboard },
    { id: 'bulk-allocation', label: '複数クリニック一括発送', icon: Layers, badge: '一括' },
    { id: 'shipments', label: '発送履歴・帳票管理', icon: History },
    { id: 'stock-input', label: '在庫入庫登録・履歴', icon: PackagePlus },
    { id: 'stock-management', label: '拠点在庫一元管理', icon: Boxes },
  ];

  const masterMenuItems = [
    { id: 'clinics', label: 'クリニックマスタ', icon: Hospital },
    { id: 'products', label: '製剤マスタ', icon: Package },
    { id: 'warehouses', label: '発送元倉庫マスタ', icon: Warehouse },
    { id: 'suppliers', label: '入荷元マスタ', icon: Truck },
  ];

  const otherMenuItems = [
    { id: 'audit-logs', label: '監査ログ', icon: ShieldAlert },
    { id: 'settings', label: 'システム設定', icon: Settings },
  ];

  const isAnyMasterActive = masterTabIds.includes(activeTab);

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col h-screen border-r border-slate-800/80 fixed left-0 top-0 z-30 shadow-xl">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/40">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-xl flex items-center justify-center font-black text-white text-lg shadow-md shadow-blue-500/20 shrink-0">
            M
          </div>
          <div className="leading-tight">
            <h1 className="text-white font-extrabold text-sm tracking-tight flex items-center gap-1.5">
              <span>薬製発送インボイス</span>
            </h1>
            <p className="text-slate-400 text-[9px] font-semibold uppercase tracking-widest mt-0.5">Logistics OS</p>
          </div>
        </div>
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-xs shadow-emerald-400/50" title="システム正常稼働中" />
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6 custom-scrollbar">
        {/* Main Section */}
        <div>
          <div className="px-3 mb-2 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
            メイン機能
          </div>
          <nav className="space-y-1">
            {mainMenuItems.map((item) => {
              const isActive = activeTab === item.id;
              const Icon = item.icon;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    isActive 
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25 font-bold' 
                      : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold shrink-0 ${
                      isActive ? 'bg-white/20 text-white' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Master Management Group Accordion */}
        <div>
          <div className="px-3 mb-2 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
            データ管理
          </div>
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => setIsMasterOpen(!isMasterOpen)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                isAnyMasterActive 
                  ? 'bg-slate-800 text-blue-400 font-bold border border-slate-700/60' 
                  : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Database className={`w-4 h-4 shrink-0 ${isAnyMasterActive ? 'text-blue-400' : 'text-slate-400'}`} />
                <span>マスタ管理</span>
              </div>
              {isMasterOpen ? (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              )}
            </button>

            {isMasterOpen && (
              <div className="mt-1 space-y-1 pl-3 border-l-2 border-slate-800 ml-3 py-1">
                {masterMenuItems.map((item) => {
                  const isActive = activeTab === item.id;
                  const Icon = item.icon;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveTab(item.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-all cursor-pointer ${
                        isActive 
                          ? 'bg-blue-600/15 text-blue-400 font-bold border border-blue-500/20' 
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* System Settings Section */}
        <div>
          <div className="px-3 mb-2 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
            システム
          </div>
          <nav className="space-y-1">
            {otherMenuItems.map((item) => {
              const isActive = activeTab === item.id;
              const Icon = item.icon;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    isActive 
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25 font-bold' 
                      : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* User Info / Quick Link Footer */}
      <div className="p-3.5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-[10px] text-blue-400 shrink-0">
            ADM
          </div>
          <div className="min-w-0 leading-none">
            <p className="text-slate-200 font-bold text-xs truncate">管理者</p>
            <p className="text-slate-400 text-[10px] truncate mt-0.5">ADMIN ACCESS</p>
          </div>
        </div>
      </div>
    </aside>
  );
}



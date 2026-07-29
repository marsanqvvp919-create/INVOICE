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
  ArrowUpRight,
  X
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ 
  activeTab, 
  setActiveTab,
  isOpen = false,
  onClose
}: SidebarProps) {
  const masterTabIds = ['clinics', 'products', 'warehouses', 'suppliers'];
  const [isMasterOpen, setIsMasterOpen] = useState(() => masterTabIds.includes(activeTab));

  useEffect(() => {
    if (masterTabIds.includes(activeTab)) {
      setIsMasterOpen(true);
    }
  }, [activeTab]);

  const handleSelectTab = (tabId: string) => {
    setActiveTab(tabId);
    if (onClose) onClose();
  };
  
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
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-40 lg:hidden transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside 
        className={`w-64 bg-slate-950 text-slate-300 flex flex-col h-screen border-r border-slate-800/80 fixed left-0 top-0 z-50 shadow-2xl transition-transform duration-300 lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } selection:bg-blue-500 selection:text-white`}
      >
        {/* Brand Header */}
        <div className="px-3.5 py-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/60 backdrop-blur-md">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 via-indigo-600 to-blue-700 rounded-xl flex items-center justify-center font-black text-white text-lg shadow-lg shadow-blue-500/30 shrink-0 ring-1 ring-white/20">
              M
            </div>
            <div className="leading-tight min-w-0">
              <h1 className="text-white font-extrabold text-sm tracking-tight flex items-center gap-1.5 whitespace-nowrap">
                <span>メディフロー</span>
                <span className="text-[10px] font-mono text-blue-400 font-bold bg-blue-500/10 border border-blue-500/20 px-1 py-0.2 rounded shrink-0">PRO</span>
              </h1>
              <p className="text-slate-400 text-[9.5px] font-semibold tracking-wider mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">発送・在庫統合管理OS</p>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5">
            <div className="hidden sm:flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[8.5px] font-bold text-emerald-400 tracking-tight">ONLINE</span>
            </div>

            {/* Close Button for Mobile Drawer */}
            <button
              type="button"
              onClick={onClose}
              className="lg:hidden text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
              aria-label="メニューを閉じる"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto px-3.5 py-5 space-y-6">
        {/* Main Section */}
        <div>
          <div className="px-3 mb-2 text-slate-400 text-[10px] font-bold tracking-widest uppercase">
            メインオペレーション
          </div>
          <nav className="space-y-1">
            {mainMenuItems.map((item) => {
              const isActive = activeTab === item.id;
              const Icon = item.icon;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectTab(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer group ${
                    isActive 
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/30 font-bold ring-1 ring-white/10' 
                      : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-blue-400'}`} />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-extrabold shrink-0 ${
                      isActive ? 'bg-white/20 text-white' : 'bg-blue-500/15 text-blue-400 border border-blue-500/25'
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
          <div className="px-3 mb-2 text-slate-400 text-[10px] font-bold tracking-widest uppercase">
            基幹マスタDB
          </div>
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => setIsMasterOpen(!isMasterOpen)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer ${
                isAnyMasterActive 
                  ? 'bg-slate-900 text-blue-400 font-bold border border-slate-800' 
                  : 'text-slate-300 hover:bg-slate-900 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Database className={`w-4 h-4 shrink-0 ${isAnyMasterActive ? 'text-blue-400' : 'text-slate-400'}`} />
                <span>マスタデータベース</span>
              </div>
              {isMasterOpen ? (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              )}
            </button>

            {isMasterOpen && (
              <div className="mt-1 space-y-1 pl-3 border-l-2 border-slate-800/80 ml-3 py-1">
                {masterMenuItems.map((item) => {
                  const isActive = activeTab === item.id;
                  const Icon = item.icon;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectTab(item.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-all duration-150 cursor-pointer ${
                        isActive 
                          ? 'bg-blue-600/20 text-blue-300 font-bold border border-blue-500/30' 
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
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
          <div className="px-3 mb-2 text-slate-400 text-[10px] font-bold tracking-widest uppercase">
            ガバナンス＆設定
          </div>
          <nav className="space-y-1">
            {otherMenuItems.map((item) => {
              const isActive = activeTab === item.id;
              const Icon = item.icon;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer group ${
                    isActive 
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/30 font-bold ring-1 ring-white/10' 
                      : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-blue-400'}`} />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* User Info / Quick Link Footer */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-900/80 backdrop-blur-md flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center font-bold text-xs text-white shrink-0 shadow-sm">
            管理
          </div>
          <div className="min-w-0 leading-tight">
            <p className="text-slate-200 font-bold text-xs truncate">システム管理者</p>
            <p className="text-slate-400 text-[10px] truncate">統合権限アクティブ</p>
          </div>
        </div>
      </div>
    </aside>
  </>
);
}



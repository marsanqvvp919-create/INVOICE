import React, { useState } from 'react';
import { ShieldAlert, Search, RefreshCw, Trash2 } from 'lucide-react';
import { AuditLog } from '../types';

interface AuditLogsProps {
  logs: AuditLog[];
  onClearLogs?: () => Promise<void>;
}

export default function AuditLogs({ logs, onClearLogs }: AuditLogsProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredLogs = logs.filter(log => {
    const q = searchQuery.toLowerCase();
    return (
      log.user.toLowerCase().includes(q) ||
      log.action.toLowerCase().includes(q) ||
      log.target.toLowerCase().includes(q) ||
      log.before.toLowerCase().includes(q) ||
      log.after.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">システム監査ログ</h2>
          <p className="text-xs text-slate-500">発送データの金額変更・ロット調整、システム設定の上書き等のアクション履歴を全件不変保存・監査します。</p>
        </div>

        {onClearLogs && (
          <button
            onClick={() => {
              if (window.confirm('監査ログを全削除しますか？（※デモ用の全クリア機能です）')) {
                onClearLogs();
              }
            }}
            className="bg-white hover:bg-red-50 text-red-600 border border-slate-200 hover:border-red-200 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer shadow-sm self-start"
          >
            <Trash2 className="w-4 h-4" />
            <span>デモログをクリア</span>
          </button>
        )}
      </div>

      {/* Filter panel */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3.5 top-2.5 h-4.5 w-4.5 text-slate-400" />
          <input
            type="text"
            placeholder="操作者、アクション名、変更内容で検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200/85 rounded-lg pl-10 pr-4 py-2 text-xs focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
      </div>

      {/* Logs list table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-mono text-[11px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="px-5 py-3 w-40">実行日時</th>
                <th className="px-5 py-3 w-44">操作担当者</th>
                <th className="px-5 py-3 w-36">アクション区分</th>
                <th className="px-5 py-3">変更対象オブジェクト</th>
                <th className="px-5 py-3">変更前の状態 (Before)</th>
                <th className="px-5 py-3">変更後の状態 (After)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600 font-medium">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400 font-sans text-xs">
                    監査ログは記録されていません
                  </td>
                </tr>
              ) : (
                [...filteredLogs]
                  .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
                  .map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3.5 text-slate-400 whitespace-nowrap">{log.date}</td>
                      <td className="px-5 py-3.5 font-bold text-slate-800 whitespace-nowrap">
                        <span>{log.user}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                          {log.action}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-bold text-slate-900 whitespace-nowrap">{log.target}</td>
                      <td className="px-5 py-3.5 text-slate-500 max-w-[200px] truncate" title={log.before}>
                        {log.before || '---'}
                      </td>
                      <td className="px-5 py-3.5 text-blue-600 font-semibold max-w-[200px] truncate" title={log.after}>
                        {log.after}
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

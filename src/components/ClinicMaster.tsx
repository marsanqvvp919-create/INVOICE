import React, { useState, useRef } from 'react';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Download, 
  Upload, 
  X, 
  AlertCircle, 
  CheckCircle,
  FileSpreadsheet
} from 'lucide-react';
import { Clinic } from '../types';

interface ClinicMasterProps {
  clinics: Clinic[];
  onAddClinic: (clinic: Omit<Clinic, 'id' | 'createdAt'>) => Promise<void>;
  onUpdateClinic: (id: string, clinic: Partial<Clinic>) => Promise<void>;
  onDeleteClinic: (id: string) => Promise<void>;
  onImportClinics: (clinics: Omit<Clinic, 'id' | 'createdAt'>[]) => Promise<void>;
}

export default function ClinicMaster({ 
  clinics, 
  onAddClinic, 
  onUpdateClinic, 
  onDeleteClinic,
  onImportClinics
}: ClinicMasterProps) {
  
  // States
  const [searchQuery, setSearchQuery] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingClinic, setEditingClinic] = useState<Clinic | null>(null);
  const [isCsvImportOpen, setIsCsvImportOpen] = useState(false);
  const [csvPreview, setCsvPreview] = useState<any[]>([]);
  const [csvErrors, setCsvErrors] = useState<{ row: number; error: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form Fields State
  const [formFields, setFormFields] = useState({
    clinicId: '',
    name: '',
    nameEn: '',
    corporationName: '',
    contactPerson: '',
    contactPersonEn: '',
    doctorName: '',
    doctorNameEn: '',
    zip: '',
    prefecture: '',
    city: '',
    address: '',
    building: '',
    addressEn: '',
    phone: '',
    email: '',
    notes: '',
    active: true
  });

  const resetForm = () => {
    setFormFields({
      clinicId: '',
      name: '',
      nameEn: '',
      corporationName: '',
      contactPerson: '',
      contactPersonEn: '',
      doctorName: '',
      doctorNameEn: '',
      zip: '',
      prefecture: '',
      city: '',
      address: '',
      building: '',
      addressEn: '',
      phone: '',
      email: '',
      notes: '',
      active: true
    });
    setEditingClinic(null);
  };

  const handleOpenAdd = () => {
    resetForm();
    // Auto-generate temporary sequential Clinic ID
    const nextNum = clinics.length + 1;
    const padded = String(nextNum).padStart(3, '0');
    setFormFields(prev => ({ ...prev, clinicId: `CLN-${padded}` }));
    setIsFormOpen(true);
  };

  const handleOpenEdit = (clinic: Clinic) => {
    setEditingClinic(clinic);
    setFormFields({
      clinicId: clinic.clinicId || '',
      name: clinic.name || '',
      nameEn: clinic.nameEn || '',
      corporationName: clinic.corporationName || '',
      contactPerson: clinic.contactPerson || '',
      contactPersonEn: clinic.contactPersonEn || '',
      doctorName: clinic.doctorName || '',
      doctorNameEn: clinic.doctorNameEn || '',
      zip: clinic.zip || '',
      prefecture: clinic.prefecture || '',
      city: clinic.city || '',
      address: clinic.address || '',
      building: clinic.building || '',
      addressEn: clinic.addressEn || '',
      phone: clinic.phone || '',
      email: clinic.email || '',
      notes: clinic.notes || '',
      active: clinic.active !== false
    });
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Auto-generate clinic ID if left blank
    let clinicId = formFields.clinicId.trim();
    if (!clinicId) {
      const nextNum = clinics.length + 1;
      clinicId = `CLN-${String(nextNum).padStart(3, '0')}`;
    }

    // Check duplicate ID (if not editing and clinicId was manually given)
    if (!editingClinic && formFields.clinicId.trim()) {
      const duplicate = clinics.some(c => (c.clinicId || '').toUpperCase() === clinicId.toUpperCase());
      if (duplicate) {
        alert('このクリニックIDは既に登録されています。');
        return;
      }
    }

    // Handle blank name fields with safe fallbacks
    let name = formFields.name.trim();
    let nameEn = formFields.nameEn.trim();

    if (!name && nameEn) {
      name = nameEn;
    } else if (!name && !nameEn) {
      name = `未設定クリニック (${clinicId})`;
      nameEn = `Clinic ${clinicId}`;
    } else if (name && !nameEn) {
      nameEn = name;
    }

    const payload = {
      ...formFields,
      clinicId,
      name,
      nameEn
    };

    try {
      if (editingClinic) {
        await onUpdateClinic(editingClinic.id, payload);
      } else {
        await onAddClinic(payload);
      }
      setIsFormOpen(false);
      resetForm();
    } catch (err) {
      console.error(err);
      alert('保存中にエラーが発生しました。');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`本当に「${name}」を削除しますか？`)) {
      try {
        await onDeleteClinic(id);
      } catch (err) {
        console.error(err);
        alert('削除中にエラーが発生しました。');
      }
    }
  };

  // Searching logic (clinicName, phone, address)
  const filteredClinics = clinics.filter(c => {
    const query = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(query) ||
      c.nameEn.toLowerCase().includes(query) ||
      c.phone.includes(query) ||
      c.address.toLowerCase().includes(query) ||
      c.clinicId.toLowerCase().includes(query)
    );
  });

  // Helper to split CSV line respecting quotes
  const parseCsvLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' || char === "'") {
        if (inQuotes && line[i + 1] === char) {
          current += char;
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim().replace(/^"|"$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim().replace(/^"|"$/g, ''));
    return result;
  };

  // Header column aliases mapping
  const headerAliasMap: Record<string, string> = {
    clinicid: 'clinicId', 'クリニックid': 'clinicId', 'クリニックｉｄ': 'clinicId', 'クリニックコード': 'clinicId', id: 'clinicId', 'コード': 'clinicId',
    name: 'name', clinicname: 'name', 'クリニック名': 'name', 'クリニック名称': 'name', '名称': 'name', '施設名': 'name', '医院名': 'name', '病院名': 'name',
    nameen: 'nameEn', clinicnameen: 'nameEn', 'クリニック名(英語)': 'nameEn', 'クリニック名（英語）': 'nameEn', '英語表記': 'nameEn', '英語名': 'nameEn', '英語名称': 'nameEn',
    corporationname: 'corporationName', '法人名': 'corporationName', '医療法人名': 'corporationName',
    contactperson: 'contactPerson', '担当者': 'contactPerson', '担当者名': 'contactPerson', '窓口': 'contactPerson',
    doctorname: 'doctorName', '医師名': 'doctorName', '医師名(日本語)': 'doctorName', '医師名（日本語）': 'doctorName', '院長名': 'doctorName', '医師': 'doctorName',
    doctornameen: 'doctorNameEn', '医師名(英語)': 'doctorNameEn', '医師名（英語）': 'doctorNameEn', '医師英語名': 'doctorNameEn',
    zip: 'zip', postalcode: 'zip', '郵便番号': 'zip', '〒': 'zip',
    prefecture: 'prefecture', '都道府県': 'prefecture',
    city: 'city', '市区町村': 'city',
    address: 'address', '住所': 'address', '番地': 'address', '住所(日本語)': 'address', '住所（日本語）': 'address',
    building: 'building', '建物名': 'building', 'ビル名': 'building',
    addressen: 'addressEn', '英語住所': 'addressEn', '住所(英語)': 'addressEn', '住所（英語）': 'addressEn',
    phone: 'phone', tel: 'phone', '電話番号': 'phone', '連絡先': 'phone',
    email: 'email', mail: 'email', 'メール': 'email', 'メールアドレス': 'email',
    notes: 'notes', memo: 'notes', '備考': 'notes', 'メモ': 'notes',
    active: 'active', status: 'active', 'ステータス': 'active', '有効': 'active'
  };

  // CSV Import parsing logic
  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      
      if (lines.length <= 1) {
        alert('CSVにヘッダー行以外の有効なデータが含まれていません。');
        return;
      }

      const rawHeaders = parseCsvLine(lines[0]);
      const mappedHeaders = rawHeaders.map(h => {
        const key = h.toLowerCase().replace(/[\s\-_]/g, '');
        return headerAliasMap[key] || headerAliasMap[h] || h;
      });

      const parsedData: any[] = [];
      const errorsList: { row: number; error: string }[] = [];

      for (let i = 1; i < lines.length; i++) {
        const rowValues = parseCsvLine(lines[i]);

        // Map columns
        const rowObj: Record<string, string> = {};
        mappedHeaders.forEach((header, idx) => {
          rowObj[header] = (rowValues[idx] || '').trim();
        });

        // Auto-fill Clinic ID if blank
        let clinicId = rowObj['clinicId'] || '';
        if (!clinicId) {
          const autoNum = clinics.length + parsedData.length + 1;
          clinicId = `CLN-${String(autoNum).padStart(3, '0')}`;
        }

        // Auto-fill Clinic Names if blank
        let name = rowObj['name'] || '';
        let nameEn = rowObj['nameEn'] || '';
        if (!name && nameEn) {
          name = nameEn;
        } else if (!name && !nameEn) {
          name = `未設定クリニック (${clinicId})`;
          nameEn = `Clinic ${clinicId}`;
        } else if (name && !nameEn) {
          nameEn = name;
        }

        // Auto-fill English Address if blank
        let addressEn = rowObj['addressEn'] || '';
        if (!addressEn) {
          const parts = [rowObj['prefecture'], rowObj['city'], rowObj['address'], rowObj['building']].filter(Boolean);
          addressEn = parts.length > 0 ? parts.join(', ') : (rowObj['address'] || '');
        }

        // Parse Active boolean
        const activeVal = (rowObj['active'] || '').toLowerCase();
        const active = activeVal === 'false' || activeVal === '無効' || activeVal === '0' ? false : true;

        parsedData.push({
          rowNum: i + 1,
          clinicId,
          name,
          nameEn,
          corporationName: rowObj['corporationName'] || '',
          contactPerson: rowObj['contactPerson'] || '',
          doctorName: rowObj['doctorName'] || '',
          doctorNameEn: rowObj['doctorNameEn'] || '',
          zip: rowObj['zip'] || '',
          prefecture: rowObj['prefecture'] || '',
          city: rowObj['city'] || '',
          address: rowObj['address'] || '',
          building: rowObj['building'] || '',
          addressEn,
          phone: rowObj['phone'] || '',
          email: rowObj['email'] || '',
          notes: rowObj['notes'] || '',
          active
        });
      }

      setCsvPreview(parsedData);
      setCsvErrors(errorsList);
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleConfirmImport = async () => {
    if (csvErrors.length > 0) {
      alert('エラー行を修正してからインポートしてください。');
      return;
    }

    try {
      // Filter out meta values and save
      const cleanData = csvPreview.map(({ rowNum, ...rest }) => rest);
      await onImportClinics(cleanData);
      setIsCsvImportOpen(false);
      setCsvPreview([]);
      setCsvErrors([]);
      alert('CSVインポートが完了しました。');
    } catch (err) {
      console.error(err);
      alert('インポート中にエラーが発生しました。');
    }
  };

  // CSV Export logic
  const handleExportCsv = () => {
    const headers = [
      'clinicId', 'name', 'nameEn', 'corporationName', 'contactPerson', 
      'doctorName', 'doctorNameEn',
      'zip', 'prefecture', 'city', 'address', 'building', 
      'addressEn', 'phone', 'email', 'notes', 'active'
    ];

    const csvContent = [
      headers.join(','),
      ...clinics.map(c => [
        `"${c.clinicId}"`,
        `"${c.name}"`,
        `"${c.nameEn}"`,
        `"${c.corporationName || ''}"`,
        `"${c.contactPerson || ''}"`,
        `"${c.doctorName || ''}"`,
        `"${c.doctorNameEn || ''}"`,
        `"${c.zip || ''}"`,
        `"${c.prefecture || ''}"`,
        `"${c.city || ''}"`,
        `"${c.address || ''}"`,
        `"${c.building || ''}"`,
        `"${c.addressEn || ''}"`,
        `"${c.phone || ''}"`,
        `"${c.email || ''}"`,
        `"${c.notes || ''}"`,
        c.active
      ].join(','))
    ].join('\n');

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `clinic_master_${new Date().toISOString().substring(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header and top buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">クリニックマスタ</h2>
          <p className="text-xs text-slate-500">発送先となる各提携クリニックの登録・編集・CSV連携を行います。</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportCsv}
            className="bg-white border border-slate-200 text-slate-700 px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 hover:bg-slate-50 cursor-pointer shadow-sm"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>CSV出力</span>
          </button>
          
          <button
            onClick={() => setIsCsvImportOpen(true)}
            className="bg-white border border-slate-200 text-slate-700 px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 hover:bg-slate-50 cursor-pointer shadow-sm"
          >
            <Upload className="w-4 h-4 text-slate-500" />
            <span>CSV一括登録</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>新規クリニック登録</span>
          </button>
        </div>
      </div>

      {/* Filter panel */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-2.5 h-4.5 w-4.5 text-slate-400" />
          <input
            type="text"
            placeholder="クリニック名、ID、電話番号、住所で検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200/85 rounded-lg pl-10 pr-4 py-2 text-xs focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
        {searchQuery && (
          <button 
            onClick={() => setSearchQuery('')}
            className="text-xs text-slate-500 hover:text-slate-800 font-semibold"
          >
            クリア
          </button>
        )}
      </div>

      {/* Table view */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200/80 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="px-5 py-3 w-28">ID</th>
                <th className="px-5 py-3">クリニック名</th>
                <th className="px-5 py-3">英語表記 / 英語住所</th>
                <th className="px-5 py-3">連絡先</th>
                <th className="px-5 py-3">ステータス</th>
                <th className="px-5 py-3 text-right w-24">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
              {filteredClinics.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400">
                    クリニックデータが見つかりません
                  </td>
                </tr>
              ) : (
                filteredClinics.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4 font-bold font-mono text-slate-900">{c.clinicId}</td>
                    <td className="px-5 py-4">
                      <div className="font-bold text-slate-800">{c.name}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{c.corporationName || '法人名なし'}</div>
                    </td>
                    <td className="px-5 py-4 max-w-[300px]">
                      <div className="font-semibold text-slate-600 truncate">{c.nameEn}</div>
                      <div className="text-[10px] text-slate-400 truncate mt-0.5" title={c.addressEn}>{c.addressEn || '未登録'}</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-slate-700">{c.phone || 'N/A'}</div>
                      {c.contactPerson && <div className="text-[10px] text-slate-500 mt-0.5">担当: {c.contactPerson}</div>}
                      {c.doctorName && <div className="text-[10px] text-blue-600 font-bold mt-0.5">医師: {c.doctorName}</div>}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        c.active 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                          : 'bg-slate-100 text-slate-500 border border-slate-200'
                      }`}>
                        {c.active ? '有効' : '無効'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(c)}
                          className="bg-white hover:bg-slate-100 text-slate-600 p-1.5 rounded border border-slate-200 hover:border-slate-300 transition-colors cursor-pointer"
                          title="編集"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(c.id, c.name)}
                          className="bg-white hover:bg-red-50 text-red-600 p-1.5 rounded border border-slate-200 hover:border-red-200 transition-colors cursor-pointer"
                          title="削除"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Form Dialog Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-sm font-bold text-slate-900">
                {editingClinic ? 'クリニック情報の編集' : '新規クリニック登録'}
              </h3>
              <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    クリニックID <span className="text-slate-400 font-normal">(空欄で自動発行)</span>
                  </label>
                  <input
                    type="text"
                    value={formFields.clinicId}
                    onChange={(e) => setFormFields(prev => ({ ...prev, clinicId: e.target.value.toUpperCase() }))}
                    disabled={!!editingClinic}
                    className="w-full border border-slate-200 rounded px-3 py-1.5 text-xs bg-slate-50 font-mono focus:outline-none focus:border-blue-500"
                    placeholder="CLN-001 (未入力の場合は自動割り振り)"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">法人名</label>
                  <input
                    type="text"
                    value={formFields.corporationName}
                    onChange={(e) => setFormFields(prev => ({ ...prev, corporationName: e.target.value }))}
                    className="w-full border border-slate-200 rounded px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                    placeholder="医療法人社団○○"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    クリニック名 (日本語)
                  </label>
                  <input
                    type="text"
                    value={formFields.name}
                    onChange={(e) => setFormFields(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full border border-slate-200 rounded px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                    placeholder="グナル美容外科"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    クリニック名 (英語表記)
                  </label>
                  <input
                    type="text"
                    value={formFields.nameEn}
                    onChange={(e) => setFormFields(prev => ({ ...prev, nameEn: e.target.value }))}
                    className="w-full border border-slate-200 rounded px-3 py-1.5 text-xs font-medium focus:outline-none focus:border-blue-500"
                    placeholder="Geunal Plastic Surgery Clinic"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">担当者名 (日本語)</label>
                  <input
                    type="text"
                    value={formFields.contactPerson}
                    onChange={(e) => setFormFields(prev => ({ ...prev, contactPerson: e.target.value }))}
                    className="w-full border border-slate-200 rounded px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                    placeholder="田中 太郎"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">担当者名 (英語表記) <span className="text-slate-400 font-normal">(インボイス記載用)</span></label>
                  <input
                    type="text"
                    value={formFields.contactPersonEn}
                    onChange={(e) => setFormFields(prev => ({ ...prev, contactPersonEn: e.target.value }))}
                    className="w-full border border-slate-200 rounded px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                    placeholder="Taro Tanaka"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">医師名 (日本語)</label>
                  <input
                    type="text"
                    value={formFields.doctorName}
                    onChange={(e) => setFormFields(prev => ({ ...prev, doctorName: e.target.value }))}
                    className="w-full border border-slate-200 rounded px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                    placeholder="佐藤 茂"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">医師名 (英語表記) <span className="text-slate-400 font-normal">(インボイス記載用)</span></label>
                  <input
                    type="text"
                    value={formFields.doctorNameEn}
                    onChange={(e) => setFormFields(prev => ({ ...prev, doctorNameEn: e.target.value }))}
                    className="w-full border border-slate-200 rounded px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                    placeholder="Dr. Shigeru Sato"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">電話番号</label>
                  <input
                    type="text"
                    value={formFields.phone}
                    onChange={(e) => setFormFields(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full border border-slate-200 rounded px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-blue-500"
                    placeholder="03-1234-5678"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">メールアドレス</label>
                  <input
                    type="email"
                    value={formFields.email}
                    onChange={(e) => setFormFields(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full border border-slate-200 rounded px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-blue-500"
                    placeholder="contact@clinic-example.com"
                  />
                </div>

                <div className="border-t border-slate-100 sm:col-span-2 pt-3">
                  <h4 className="text-xs font-bold text-blue-600 mb-2">国内配送先住所 (日本語)</h4>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">郵便番号</label>
                  <input
                    type="text"
                    value={formFields.zip}
                    onChange={(e) => setFormFields(prev => ({ ...prev, zip: e.target.value }))}
                    className="w-full border border-slate-200 rounded px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-blue-500"
                    placeholder="100-0001"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">都道府県</label>
                  <input
                    type="text"
                    value={formFields.prefecture}
                    onChange={(e) => setFormFields(prev => ({ ...prev, prefecture: e.target.value }))}
                    className="w-full border border-slate-200 rounded px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                    placeholder="東京都"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">市区町村</label>
                  <input
                    type="text"
                    value={formFields.city}
                    onChange={(e) => setFormFields(prev => ({ ...prev, city: e.target.value }))}
                    className="w-full border border-slate-200 rounded px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                    placeholder="千代田区"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">番地・建物名</label>
                  <input
                    type="text"
                    value={formFields.address}
                    onChange={(e) => setFormFields(prev => ({ ...prev, address: e.target.value }))}
                    className="w-full border border-slate-200 rounded px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                    placeholder="千代田1-1-1 ビル3F"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    インボイス用 英語住所 <span className="text-slate-400 font-normal">(空欄時は日本語住所から自動補完)</span>
                  </label>
                  <textarea
                    value={formFields.addressEn}
                    onChange={(e) => setFormFields(prev => ({ ...prev, addressEn: e.target.value }))}
                    rows={2}
                    className="w-full border border-slate-200 rounded px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                    placeholder="3F, 1-1-1, Chiyoda, Chiyoda-ku, Tokyo, 100-0001, Japan"
                  />
                </div>

                <div className="border-t border-slate-100 sm:col-span-2 pt-3">
                  <h4 className="text-xs font-bold text-slate-500 mb-2">その他設定</h4>
                </div>

                <div className="sm:col-span-2 flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="active"
                    checked={formFields.active}
                    onChange={(e) => setFormFields(prev => ({ ...prev, active: e.target.checked }))}
                    className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 border-slate-300"
                  />
                  <label htmlFor="active" className="text-xs font-bold text-slate-700 cursor-pointer">有効化する (無効に設定すると発送先に表示されません)</label>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">備考</label>
                  <textarea
                    value={formFields.notes}
                    onChange={(e) => setFormFields(prev => ({ ...prev, notes: e.target.value }))}
                    rows={2}
                    className="w-full border border-slate-200 rounded px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                    placeholder="その他メモなどがあれば記入してください"
                  />
                </div>

              </div>

              {/* Action Buttons */}
              <div className="border-t border-slate-100 pt-4 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-5 py-2 rounded text-xs font-bold hover:bg-blue-700 cursor-pointer"
                >
                  {editingClinic ? '更新する' : '登録する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {isCsvImportOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                <span>CSV一括インポート</span>
              </h3>
              <button 
                onClick={() => {
                  setIsCsvImportOpen(false);
                  setCsvPreview([]);
                  setCsvErrors([]);
                }} 
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="bg-slate-50 p-4 rounded-lg text-xs text-slate-600 border border-slate-200 space-y-2">
                <p className="font-bold text-slate-800">【CSVフォーマット規定】</p>
                <p>1行目はヘッダー行として、以下の項目名（日本語または英語）を設定できます：</p>
                <p className="font-mono bg-white p-2 rounded border border-slate-100 overflow-x-auto text-[10px]">
                  clinicId, name, nameEn, corporationName, contactPerson, doctorName, doctorNameEn, zip, prefecture, city, address, building, addressEn, phone, email, notes, active
                </p>
                <p className="text-emerald-700 font-semibold">※空欄の項目（クリニックID、名前、住所等）があるデータも自動補完（ID自動発行など）してそのまま一括インポートできます。</p>
              </div>

              {/* Upload Dropzone */}
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:bg-slate-50 cursor-pointer transition-colors space-y-2"
              >
                <Upload className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-xs font-bold text-slate-700">ファイルを選択、またはここにドラッグ＆ドロップしてください</p>
                <p className="text-[10px] text-slate-400">CSV形式ファイルのみサポート（UTF-8エンコード推奨）</p>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleCsvUpload}
                  accept=".csv"
                  className="hidden"
                />
              </div>

              {/* Errors list */}
              {csvErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-xs text-red-800 space-y-2">
                  <h4 className="font-bold flex items-center gap-1">
                    <AlertCircle className="w-4 h-4 text-red-600" />
                    <span>CSVファイルにバリデーションエラーが見つかりました ({csvErrors.length}件)</span>
                  </h4>
                  <ul className="list-disc pl-5 space-y-1 text-red-700 max-h-40 overflow-y-auto">
                    {csvErrors.map((err, idx) => (
                      <li key={idx}><strong>{err.row}行目:</strong> {err.error}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* CSV Preview */}
              {csvPreview.length > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1">
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                      <span>インポートプレビュー ({csvPreview.length}件)</span>
                    </h4>
                    {csvErrors.length === 0 && (
                      <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-bold">
                        エラーなし：インポート可能です
                      </span>
                    )}
                  </div>
                  
                  <div className="border border-slate-200 rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                    <table className="w-full text-left border-collapse text-[10px]">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-500 uppercase tracking-wider">
                          <th className="px-3 py-2">行</th>
                          <th className="px-3 py-2">クリニックID</th>
                          <th className="px-3 py-2">クリニック名</th>
                          <th className="px-3 py-2">英語名</th>
                          <th className="px-3 py-2">英語住所</th>
                          <th className="px-3 py-2">電話番号</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {csvPreview.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="px-3 py-2 font-mono text-slate-400">{row.rowNum}</td>
                            <td className="px-3 py-2 font-bold font-mono text-slate-800">{row.clinicId}</td>
                            <td className="px-3 py-2 text-slate-800">{row.name}</td>
                            <td className="px-3 py-2 text-slate-600">{row.nameEn}</td>
                            <td className="px-3 py-2 text-slate-500 truncate max-w-xs" title={row.addressEn}>{row.addressEn}</td>
                            <td className="px-3 py-2 font-mono text-slate-500">{row.phone}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>

            {/* Import Footer actions */}
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-2.5 bg-slate-50/50">
              <button
                type="button"
                onClick={() => {
                  setIsCsvImportOpen(false);
                  setCsvPreview([]);
                  setCsvErrors([]);
                }}
                className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded text-xs font-semibold hover:bg-slate-50 cursor-pointer"
              >
                キャンセル
              </button>
              <button
                type="button"
                disabled={csvPreview.length === 0 || csvErrors.length > 0}
                onClick={handleConfirmImport}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 text-white disabled:text-slate-400 px-5 py-2 rounded text-xs font-bold cursor-pointer transition-colors"
              >
                一括インポートを確定
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

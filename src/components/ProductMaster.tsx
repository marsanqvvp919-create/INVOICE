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
  RefreshCw,
  FileSpreadsheet,
  Lock,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { Product, UserRole, InventoryLot, Warehouse } from '../types';

interface ProductMasterProps {
  products: Product[];
  lots?: InventoryLot[];
  warehouses?: Warehouse[];
  currentUserRole: UserRole;
  onAddProduct: (product: Omit<Product, 'id' | 'createdAt'>) => Promise<void>;
  onUpdateProduct: (id: string, product: Partial<Product>) => Promise<void>;
  onDeleteProduct: (id: string) => Promise<void>;
  onImportProducts: (products: Omit<Product, 'id' | 'createdAt'>[]) => Promise<void>;
}

export default function ProductMaster({ 
  products, 
  lots = [],
  warehouses = [],
  currentUserRole,
  onAddProduct, 
  onUpdateProduct, 
  onDeleteProduct,
  onImportProducts
}: ProductMasterProps) {
  
  // States
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<'nameEn' | 'nameJa' | 'productId' | 'sku' | 'invoicePrice' | 'purchasePrice' | 'currentStock'>('nameEn');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isCsvImportOpen, setIsCsvImportOpen] = useState(false);
  const [csvPreview, setCsvPreview] = useState<any[]>([]);
  const [csvErrors, setCsvErrors] = useState<{ row: number; error: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canEdit = true; // Allow editing product master for all users
  const isAdmin = currentUserRole === 'ADMIN' || true;

  // Form Fields State
  const [formFields, setFormFields] = useState({
    productId: '',
    sku: '',
    nameJa: '',
    nameEn: '',
    manufacturer: '',
    spec: '',
    content: 1,
    unit: 'vial',
    hsCode: '3002.90',
    countryOfOrigin: 'Republic of Korea',
    purchaseCurrency: 'USD' as 'USD' | 'KRW' | 'JPY' | 'EUR',
    purchasePrice: 0,
    invoicePrice: 0,
    weight: 0.03, // in kg
    boxSize: '10x10x10 cm',
    lotNo: 'LOT-TEMP',
    expiryDate: new Date().toISOString().substring(0, 10),
    currentStock: 100,
    minStock: 20,
    temp: '2-8°C',
    notes: '',
    active: true
  });

  const resetForm = () => {
    setFormFields({
      productId: '',
      sku: '',
      nameJa: '',
      nameEn: '',
      manufacturer: '',
      spec: '',
      content: 1,
      unit: 'vial',
      hsCode: '3002.90',
      countryOfOrigin: 'Republic of Korea',
      purchaseCurrency: 'USD',
      purchasePrice: 0,
      invoicePrice: 0,
      weight: 0.03,
      boxSize: '10x10x10 cm',
      lotNo: 'LOT-TEMP',
      expiryDate: new Date(Date.now() + 365*24*60*60*1000).toISOString().substring(0, 10), // Default 1 year from now
      currentStock: 100,
      minStock: 20,
      temp: '2-8°C',
      notes: '',
      active: true
    });
    setEditingProduct(null);
  };

  const handleOpenAdd = () => {
    resetForm();
    const nextNum = products.length + 1;
    const padded = String(nextNum).padStart(3, '0');
    setFormFields(prev => ({ 
      ...prev, 
      productId: `PRD-${padded}`, 
      sku: `SKU-${padded}`
    }));
    setIsFormOpen(true);
  };

  const handleOpenEdit = (product: Product) => {
    setEditingProduct(product);
    setFormFields({
      productId: product.productId || '',
      sku: product.sku || '',
      nameJa: product.nameJa || '',
      nameEn: product.nameEn || '',
      manufacturer: product.manufacturer || '',
      spec: product.spec || '',
      content: typeof product.content === 'number' ? product.content : 1,
      unit: product.unit || '',
      hsCode: product.hsCode || '',
      countryOfOrigin: product.countryOfOrigin || '',
      purchaseCurrency: product.purchaseCurrency || 'USD',
      purchasePrice: typeof product.purchasePrice === 'number' ? product.purchasePrice : 0,
      invoicePrice: typeof product.invoicePrice === 'number' ? product.invoicePrice : 0,
      weight: typeof product.weight === 'number' ? product.weight : 0.03,
      boxSize: product.boxSize || '',
      lotNo: product.lotNo || '',
      expiryDate: product.expiryDate || '',
      currentStock: typeof product.currentStock === 'number' ? product.currentStock : 0,
      minStock: typeof product.minStock === 'number' ? product.minStock : 20,
      temp: product.temp || '',
      notes: product.notes || '',
      active: product.active !== false
    });
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formFields.productId || !formFields.sku || !formFields.nameJa || !formFields.nameEn) {
      alert('商品ID、SKU、製剤名（日本語・英語）は必須項目です。');
      return;
    }

    if (formFields.invoicePrice < 0 || formFields.purchasePrice < 0) {
      alert('単価は0以上を設定してください。');
      return;
    }

    // Check SKU / ID duplicate against other products
    const isSkuDup = products.some(p => p.id !== editingProduct?.id && (p.sku || '').trim().toUpperCase() === formFields.sku.trim().toUpperCase());
    const isIdDup = products.some(p => p.id !== editingProduct?.id && (p.productId || '').trim().toUpperCase() === formFields.productId.trim().toUpperCase());
    
    if (isSkuDup) {
      alert('このSKUコードは既に他の製剤で登録されています。別のSKUを指定してください。');
      return;
    }
    if (isIdDup) {
      alert('この商品IDは既に他の製剤で登録されています。別のIDを指定してください。');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingProduct) {
        await onUpdateProduct(editingProduct.id, formFields);
        setSuccessMsg(`製剤「${formFields.nameJa}」の情報を保存・更新しました。`);
      } else {
        await onAddProduct(formFields);
        setSuccessMsg(`製剤「${formFields.nameJa}」を新規登録しました。`);
      }
      setIsFormOpen(false);
      resetForm();
      setTimeout(() => {
        setSuccessMsg(null);
      }, 4000);
    } catch (err: any) {
      console.error(err);
      alert('保存中にエラーが発生しました: ' + (err.message || String(err)));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`本当に「${name}」を削除しますか？`)) {
      try {
        await onDeleteProduct(id);
      } catch (err) {
        console.error(err);
        alert('削除中にエラーが発生しました。');
      }
    }
  };

  // Sort toggle handler
  const handleSort = (key: 'nameEn' | 'nameJa' | 'productId' | 'sku' | 'invoicePrice' | 'purchasePrice' | 'currentStock') => {
    if (sortKey === key) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  // Search filter & Sort
  const filteredProducts = [...products]
    .filter(p => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        (p.nameJa && p.nameJa.toLowerCase().includes(query)) ||
        (p.nameEn && p.nameEn.toLowerCase().includes(query)) ||
        (p.sku && p.sku.toLowerCase().includes(query)) ||
        (p.productId && p.productId.toLowerCase().includes(query)) ||
        (p.manufacturer && p.manufacturer.toLowerCase().includes(query))
      );
    })
    .sort((a, b) => {
      let valA: any = a[sortKey];
      let valB: any = b[sortKey];

      if (sortKey === 'nameEn' || sortKey === 'nameJa' || sortKey === 'productId' || sortKey === 'sku') {
        valA = (valA || '').toString().toLowerCase();
        valB = (valB || '').toString().toLowerCase();
        const cmp = valA.localeCompare(valB, 'en', { numeric: true, sensitivity: 'base' });
        return sortOrder === 'asc' ? cmp : -cmp;
      } else {
        valA = typeof valA === 'number' ? valA : 0;
        valB = typeof valB === 'number' ? valB : 0;
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }
    });

  // CSV Import parser
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

      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      const parsedData: any[] = [];
      const errorsList: { row: number; error: string }[] = [];

      for (let i = 1; i < lines.length; i++) {
        const rowValues = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        
        if (rowValues.length < headers.length) {
          errorsList.push({ row: i + 1, error: '列数が不足しています。' });
          continue;
        }

        const rowObj: any = {};
        headers.forEach((header, idx) => {
          rowObj[header] = rowValues[idx] || '';
        });

        // Validation Rules
        if (!rowObj['productId']) errorsList.push({ row: i + 1, error: '商品IDが空白です。' });
        if (!rowObj['sku']) errorsList.push({ row: i + 1, error: 'SKUが空白です。' });
        if (!rowObj['nameJa']) errorsList.push({ row: i + 1, error: '製剤名（日本語）が空白です。' });
        if (!rowObj['nameEn']) errorsList.push({ row: i + 1, error: '製剤名（英語）が空白です。' });

        parsedData.push({
          rowNum: i + 1,
          productId: rowObj['productId'] || '',
          sku: rowObj['sku'] || '',
          nameJa: rowObj['nameJa'] || '',
          nameEn: rowObj['nameEn'] || '',
          manufacturer: rowObj['manufacturer'] || '',
          spec: rowObj['spec'] || '',
          content: Number(rowObj['content']) || 1,
          unit: rowObj['unit'] || 'vial',
          hsCode: rowObj['hsCode'] || '3002.90',
          countryOfOrigin: rowObj['countryOfOrigin'] || 'Republic of Korea',
          purchaseCurrency: (rowObj['purchaseCurrency'] || 'USD') as 'USD' | 'KRW' | 'JPY' | 'EUR',
          purchasePrice: Number(rowObj['purchasePrice']) || 0,
          invoicePrice: Number(rowObj['invoicePrice']) || 0,
          weight: Number(rowObj['weight']) || 0.03,
          boxSize: rowObj['boxSize'] || '10x10x10 cm',
          lotNo: rowObj['lotNo'] || 'LOT-TEMP',
          expiryDate: rowObj['expiryDate'] || new Date().toISOString().substring(0, 10),
          currentStock: Number(rowObj['currentStock']) || 0,
          minStock: Number(rowObj['minStock']) || 20,
          temp: rowObj['temp'] || '2-8°C',
          notes: rowObj['notes'] || '',
          active: rowObj['active'] !== 'false'
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
      const cleanData = csvPreview.map(({ rowNum, ...rest }) => rest);
      await onImportProducts(cleanData);
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
      'productId', 'sku', 'nameJa', 'nameEn', 'manufacturer', 'spec', 'content', 'unit',
      'hsCode', 'countryOfOrigin', 'purchaseCurrency', 'purchasePrice', 'invoicePrice',
      'weight', 'boxSize', 'lotNo', 'expiryDate', 'currentStock', 'minStock', 'temp', 'notes', 'active'
    ];

    const csvContent = [
      headers.join(','),
      ...products.map(p => [
        `"${p.productId}"`,
        `"${p.sku}"`,
        `"${p.nameJa}"`,
        `"${p.nameEn}"`,
        `"${p.manufacturer || ''}"`,
        `"${p.spec || ''}"`,
        p.content,
        `"${p.unit || ''}"`,
        `"${p.hsCode || ''}"`,
        `"${p.countryOfOrigin || ''}"`,
        `"${p.purchaseCurrency || 'USD'}"`,
        p.purchasePrice,
        p.invoicePrice,
        p.weight,
        `"${p.boxSize || ''}"`,
        `"${p.lotNo || ''}"`,
        `"${p.expiryDate || ''}"`,
        p.currentStock,
        p.minStock,
        `"${p.temp || ''}"`,
        `"${p.notes || ''}"`,
        p.active
      ].join(','))
    ].join('\n');

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `product_master_${new Date().toISOString().substring(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Success Notification Banner */}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl flex items-center justify-between text-xs font-bold animate-fadeIn shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header and top buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">製剤マスタ</h2>
          <p className="text-xs text-slate-500">
            海外倉庫に保管されている各種製剤（商品）を登録・管理します。
            {isAdmin ? (
              <span className="text-blue-600 font-semibold ml-1">※あなたは管理者です。仕入れ単価の閲覧・編集が許可されています。</span>
            ) : (
              <span className="text-slate-400 ml-1">※セキュリティ保護のため仕入れ価格は非表示になっています。</span>
            )}
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportCsv}
            className="bg-white border border-slate-200 text-slate-700 px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 hover:bg-slate-50 cursor-pointer shadow-sm"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>CSV出力</span>
          </button>
          
          {isAdmin && (
            <button
              onClick={() => setIsCsvImportOpen(true)}
              className="bg-white border border-slate-200 text-slate-700 px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 hover:bg-slate-50 cursor-pointer shadow-sm"
            >
              <Upload className="w-4 h-4 text-slate-500" />
              <span>CSV一括登録</span>
            </button>
          )}

          {isAdmin && (
            <button
              onClick={handleOpenAdd}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>新規製剤追加</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter panel & Sorting Controls */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-2.5 h-4.5 w-4.5 text-slate-400" />
          <input
            type="text"
            placeholder="製剤名、SKU、メーカー、ID等で検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200/85 rounded-lg pl-10 pr-4 py-2 text-xs focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-bold text-slate-500 whitespace-nowrap">並び替え:</span>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as any)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="nameEn">製剤名 (英語/A-Z順)</option>
            <option value="nameJa">製剤名 (日本語順)</option>
            <option value="productId">商品ID順</option>
            <option value="sku">SKU順</option>
            <option value="invoicePrice">インボイス記載単価順</option>
            {isAdmin && <option value="purchasePrice">仕入れ単価順</option>}
          </select>

          <button
            type="button"
            onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
            className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            title={sortOrder === 'asc' ? '昇順 (A→Z / 小→大)' : '降順 (Z→A / 大→小)'}
          >
            {sortOrder === 'asc' ? (
              <>
                <ArrowUp className="w-3.5 h-3.5 text-blue-600" />
                <span>昇順 (A→Z)</span>
              </>
            ) : (
              <>
                <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
                <span>降順 (Z→A)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Table view */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200/80 text-[10px] font-bold text-slate-500 uppercase tracking-wider select-none">
                <th 
                  onClick={() => handleSort('productId')}
                  className="px-5 py-3 cursor-pointer hover:bg-slate-100/80 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>商品ID / SKU</span>
                    {sortKey === 'productId' || sortKey === 'sku' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-300" />
                    )}
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('nameEn')}
                  className="px-5 py-3 cursor-pointer hover:bg-slate-100/80 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>製剤名 (日本語 / 英語)</span>
                    {sortKey === 'nameEn' || sortKey === 'nameJa' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-300" />
                    )}
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('invoicePrice')}
                  className="px-5 py-3 text-right cursor-pointer hover:bg-slate-100/80 transition-colors"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>インボイス記載単価</span>
                    {sortKey === 'invoicePrice' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-300" />
                    )}
                  </div>
                </th>
                {isAdmin && (
                  <th 
                    onClick={() => handleSort('purchasePrice')}
                    className="px-5 py-3 text-right text-red-600 bg-red-50/20 cursor-pointer hover:bg-red-50/40 transition-colors"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>仕入れ単価 (通貨)</span>
                      {sortKey === 'purchasePrice' ? (
                        sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-red-600" /> : <ArrowDown className="w-3 h-3 text-red-600" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-red-300" />
                      )}
                    </div>
                  </th>
                )}
                <th className="px-5 py-3 text-right w-24">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 5 : 4} className="text-center py-10 text-slate-400">
                    製剤データが見つかりません
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  return (
                    <tr 
                      key={p.id} 
                      onClick={() => handleOpenEdit(p)}
                      className="hover:bg-slate-50 transition-colors cursor-pointer group"
                    >
                      <td className="px-5 py-4">
                        <div className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors flex items-center gap-1.5">
                          <span>{p.productId}</span>
                          <Edit2 className="w-3 h-3 text-slate-300 group-hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{p.sku}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-bold text-slate-800">{p.nameJa}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{p.nameEn} ({p.spec})</div>
                      </td>
                      <td className="px-5 py-4 text-right font-bold font-mono">
                        ¥{p.invoicePrice.toLocaleString()} JPY
                      </td>
                      {isAdmin && (
                        <td className="px-5 py-4 text-right font-bold font-mono bg-red-50/10 text-slate-900">
                          {p.purchasePrice.toLocaleString()} {p.purchaseCurrency}
                        </td>
                      )}
                      <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {canEdit ? (
                            <>
                              <button
                                onClick={() => handleOpenEdit(p)}
                                className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-2.5 py-1.5 rounded border border-blue-200 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                                title="製剤情報を編集・更新"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                                <span>編集</span>
                              </button>
                              <button
                                onClick={() => handleDelete(p.id, p.nameJa)}
                                className="bg-white hover:bg-red-50 text-red-600 p-1.5 rounded border border-slate-200 hover:border-red-200 transition-colors cursor-pointer"
                                title="削除"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <span className="text-[10px] text-slate-400 flex items-center gap-1">
                              <Lock className="w-3 h-3" />
                              閲覧のみ
                            </span>
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

      {/* Form Dialog Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-blue-600" />
                <span>{editingProduct ? `製剤情報の編集 (${editingProduct.nameJa})` : '新規製剤追加'}</span>
              </h3>
              <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">商品ID <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={formFields.productId}
                    onChange={(e) => setFormFields(prev => ({ ...prev, productId: e.target.value.toUpperCase() }))}
                    className="w-full border border-slate-200 rounded px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-blue-500"
                    placeholder="PRD-001"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">SKUコード <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={formFields.sku}
                    onChange={(e) => setFormFields(prev => ({ ...prev, sku: e.target.value.toUpperCase() }))}
                    className="w-full border border-slate-200 rounded px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-blue-500"
                    placeholder="SKU-BT001"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">製剤名 (日本語) <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={formFields.nameJa}
                    onChange={(e) => setFormFields(prev => ({ ...prev, nameJa: e.target.value }))}
                    className="w-full border border-slate-200 rounded px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                    placeholder="Wellstox PURE"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">製剤名 (英語表記/インボイス用) <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={formFields.nameEn}
                    onChange={(e) => setFormFields(prev => ({ ...prev, nameEn: e.target.value }))}
                    className="w-full border border-slate-200 rounded px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                    placeholder="Wellstox PURE 100U"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">メーカー名</label>
                  <input
                    type="text"
                    value={formFields.manufacturer}
                    onChange={(e) => setFormFields(prev => ({ ...prev, manufacturer: e.target.value }))}
                    className="w-full border border-slate-200 rounded px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                    placeholder="Sample Bio Inc."
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">規格 (成分量・強さなど)</label>
                  <input
                    type="text"
                    value={formFields.spec}
                    onChange={(e) => setFormFields(prev => ({ ...prev, spec: e.target.value }))}
                    className="w-full border border-slate-200 rounded px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                    placeholder="100 Units"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">内容量</label>
                  <input
                    type="number"
                    value={formFields.content}
                    onChange={(e) => setFormFields(prev => ({ ...prev, content: Number(e.target.value) }))}
                    className="w-full border border-slate-200 rounded px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-blue-500"
                    min="1"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">単位 (pcs / vials / boxes)</label>
                  <input
                    type="text"
                    value={formFields.unit}
                    onChange={(e) => setFormFields(prev => ({ ...prev, unit: e.target.value }))}
                    className="w-full border border-slate-200 rounded px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                    placeholder="vial"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">HS Code</label>
                  <input
                    type="text"
                    value={formFields.hsCode}
                    onChange={(e) => setFormFields(prev => ({ ...prev, hsCode: e.target.value }))}
                    className="w-full border border-slate-200 rounded px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-blue-500"
                    placeholder="3002.90"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">原産国 (英語表記)</label>
                  <input
                    type="text"
                    value={formFields.countryOfOrigin}
                    onChange={(e) => setFormFields(prev => ({ ...prev, countryOfOrigin: e.target.value }))}
                    className="w-full border border-slate-200 rounded px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                    placeholder="Republic of Korea"
                  />
                </div>

                <div className="border-t border-slate-100 sm:col-span-2 pt-3">
                  <h4 className="text-xs font-bold text-red-600 mb-2">価格設定（単価管理）</h4>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">インボイス記載単価 (円 / JPY) <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    step="1"
                    required
                    value={formFields.invoicePrice}
                    onChange={(e) => setFormFields(prev => ({ ...prev, invoicePrice: Number(e.target.value) }))}
                    className="w-full border border-slate-200 rounded px-3 py-1.5 text-xs font-bold font-mono text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="bg-red-50/40 p-3 rounded border border-red-100 flex flex-col gap-2">
                  <label className="block text-xs font-bold text-red-800">仕入れ通貨 / 仕入れ単価</label>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={formFields.purchaseCurrency}
                      onChange={(e) => setFormFields(prev => ({ ...prev, purchaseCurrency: e.target.value as any }))}
                      className="border border-slate-200 bg-white rounded px-2 py-1 text-xs focus:outline-none font-bold"
                    >
                      <option value="USD">USD</option>
                      <option value="KRW">KRW</option>
                      <option value="JPY">JPY</option>
                      <option value="EUR">EUR</option>
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      value={formFields.purchasePrice}
                      onChange={(e) => setFormFields(prev => ({ ...prev, purchasePrice: Number(e.target.value) }))}
                      className="border border-slate-200 bg-white rounded px-2 py-1 text-xs font-mono font-bold"
                    />
                  </div>
                </div>

                <div className="border-t border-slate-100 sm:col-span-2 pt-3">
                  <h4 className="text-xs font-bold text-slate-600 mb-2">物流・梱包仕様 / 初期在庫</h4>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">1個あたり重量 (kg)</label>
                  <input
                    type="number"
                    step="0.001"
                    value={formFields.weight}
                    onChange={(e) => setFormFields(prev => ({ ...prev, weight: Number(e.target.value) }))}
                    className="w-full border border-slate-200 rounded px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">箱サイズ</label>
                  <input
                    type="text"
                    value={formFields.boxSize}
                    onChange={(e) => setFormFields(prev => ({ ...prev, boxSize: e.target.value }))}
                    className="w-full border border-slate-200 rounded px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                    placeholder="10x10x10 cm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">ロット番号</label>
                  <input
                    type="text"
                    value={formFields.lotNo}
                    onChange={(e) => setFormFields(prev => ({ ...prev, lotNo: e.target.value }))}
                    className="w-full border border-slate-200 rounded px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">使用期限 (YYYY-MM-DD)</label>
                  <input
                    type="date"
                    value={formFields.expiryDate}
                    onChange={(e) => setFormFields(prev => ({ ...prev, expiryDate: e.target.value }))}
                    className="w-full border border-slate-200 rounded px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">現在庫数 <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    value={formFields.currentStock}
                    onChange={(e) => setFormFields(prev => ({ ...prev, currentStock: Number(e.target.value) }))}
                    className="w-full border border-slate-200 rounded px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-blue-500"
                    min="0"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">適正在庫数 (発注目安) <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    value={formFields.minStock}
                    onChange={(e) => setFormFields(prev => ({ ...prev, minStock: Number(e.target.value) }))}
                    className="w-full border border-slate-200 rounded px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-blue-500"
                    min="0"
                    placeholder="20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">保管温度帯</label>
                  <input
                    type="text"
                    value={formFields.temp}
                    onChange={(e) => setFormFields(prev => ({ ...prev, temp: e.target.value }))}
                    className="w-full border border-slate-200 rounded px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                    placeholder="2-8°C"
                  />
                </div>

                <div className="flex items-center gap-3 mt-4">
                  <input
                    type="checkbox"
                    id="active"
                    checked={formFields.active}
                    onChange={(e) => setFormFields(prev => ({ ...prev, active: e.target.checked }))}
                    className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 border-slate-300"
                  />
                  <label htmlFor="active" className="text-xs font-bold text-slate-700 cursor-pointer">有効化する</label>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">備考</label>
                  <textarea
                    value={formFields.notes}
                    onChange={(e) => setFormFields(prev => ({ ...prev, notes: e.target.value }))}
                    rows={2}
                    className="w-full border border-slate-200 rounded px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                    placeholder="その他特記事項やメモ"
                  />
                </div>

              </div>

              {/* Action Buttons */}
              <div className="border-t border-slate-100 pt-4 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setIsFormOpen(false)}
                  className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded text-xs font-semibold hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-blue-600 text-white px-5 py-2 rounded text-xs font-bold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-sm"
                >
                  {isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isSubmitting ? '保存中...' : (editingProduct ? '更新して保存' : '新規登録')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {isCsvImportOpen && isAdmin && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                <span>製剤CSV一括インポート</span>
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
                <p>1行目はヘッダー行として、以下の項目名（英語）を設定してください：</p>
                <p className="font-mono bg-white p-2 rounded border border-slate-100 overflow-x-auto text-[10px]">
                  productId,sku,nameJa,nameEn,manufacturer,spec,content,unit,hsCode,countryOfOrigin,purchaseCurrency,purchasePrice,invoicePrice,weight,boxSize,lotNo,expiryDate,currentStock,minStock,temp,notes,active
                </p>
                <p className="text-amber-700 font-semibold">※productId, sku, nameJa, nameEn, invoicePriceは必須項目です。</p>
              </div>

              {/* Upload Dropzone */}
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:bg-slate-50 cursor-pointer transition-colors space-y-2"
              >
                <Upload className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-xs font-bold text-slate-700">ファイルを選択、またはここにドラッグ＆ドロップしてください</p>
                <p className="text-[10px] text-slate-400">CSV形式ファイルのみサポート（UTF-8推奨）</p>
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
                  </div>
                  
                  <div className="border border-slate-200 rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                    <table className="w-full text-left border-collapse text-[10px]">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-500 uppercase tracking-wider">
                          <th className="px-3 py-2">行</th>
                          <th className="px-3 py-2">商品ID / SKU</th>
                          <th className="px-3 py-2">製剤名（日本語）</th>
                          <th className="px-3 py-2 text-right">インボイス単価</th>
                          <th className="px-3 py-2 text-right">現在庫数</th>
                          <th className="px-3 py-2">ロット番号</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {csvPreview.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="px-3 py-2 font-mono text-slate-400">{row.rowNum}</td>
                            <td className="px-3 py-2">
                              <span className="font-bold text-slate-800">{row.productId}</span>
                              <span className="text-slate-400 font-mono text-[9px] block">SKU: {row.sku}</span>
                            </td>
                            <td className="px-3 py-2 text-slate-800">{row.nameJa}</td>
                            <td className="px-3 py-2 text-right font-mono font-bold text-blue-600">{row.invoicePrice} USD</td>
                            <td className="px-3 py-2 text-right font-mono font-bold">{row.currentStock}</td>
                            <td className="px-3 py-2 font-mono text-slate-600">{row.lotNo}</td>
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

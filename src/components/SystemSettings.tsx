import React, { useState, useEffect } from 'react';
import { Save, Settings, ShieldCheck, Image, FileText, Download, CheckCircle, Loader2, Check } from 'lucide-react';
import { SystemSettings as SettingsType, Warehouse, Shipment } from '../types';
import { generateInvoicePDF, loadJapaneseFont } from '../lib/pdf';

interface SystemSettingsProps {
  settings: SettingsType;
  warehouses: Warehouse[];
  onSaveSettings: (settings: SettingsType) => Promise<void>;
}

export default function SystemSettings({
  settings,
  warehouses,
  onSaveSettings
}: SystemSettingsProps) {
  
  // State
  const [activeTab, setActiveTab] = useState<'settings' | 'preview'>('settings');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessTime, setSaveSuccessTime] = useState<string | null>(null);
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);

  const [formFields, setFormFields] = useState<SettingsType>({
    prefix: 'INV-',
    currency: 'USD',
    defaultWarehouseId: '',
    declaration: 'We hereby certify that the information contained in this invoice is true and correct and that the contents of this shipment are as stated above.',
    termsOfDelivery: 'DAP (Delivered at Place)',
    reasonForExport: 'Commercial Sample / Gift',
    minStockWarning: true,
    weightUnit: 'kg',
    dateFormat: 'YYYY-MM-DD',
    decimalPlaces: 2,
    companyLogo: '',
    signatureImage: ''
  });

  useEffect(() => {
    if (settings) {
      setFormFields({
        prefix: settings.prefix || 'INV-',
        currency: settings.currency || 'JPY',
        defaultWarehouseId: settings.defaultWarehouseId || '',
        declaration: settings.declaration || '',
        termsOfDelivery: settings.termsOfDelivery || '',
        reasonForExport: settings.reasonForExport || '',
        minStockWarning: settings.minStockWarning !== false,
        weightUnit: settings.weightUnit || 'kg',
        dateFormat: settings.dateFormat || 'YYYY-MM-DD',
        decimalPlaces: settings.decimalPlaces ?? 2,
        companyLogo: settings.companyLogo || '',
        signatureImage: settings.signatureImage || ''
      });
    }
  }, [settings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setShowSuccessBanner(false);
    try {
      await onSaveSettings(formFields);
      const nowStr = new Date().toLocaleTimeString('ja-JP');
      setSaveSuccessTime(nowStr);
      setShowSuccessBanner(true);
      setTimeout(() => {
        setShowSuccessBanner(false);
      }, 10000);
    } catch (err: any) {
      console.error(err);
      alert('設定保存エラーが発生しました: ' + (err?.message || String(err)));
    } finally {
      setIsSaving(false);
    }
  };

  const activeWarehouse = warehouses.find(w => w.id === formFields.defaultWarehouseId)
    || warehouses.find(w => w.isDefault)
    || warehouses[0];

  const sampleWarehouseSnapshot = activeWarehouse ? {
    name: activeWarehouse.name,
    nameEn: activeWarehouse.nameEn || activeWarehouse.name,
    address: activeWarehouse.address,
    addressEn: activeWarehouse.addressEn || activeWarehouse.address,
    phone: activeWarehouse.phone || '',
    email: activeWarehouse.email || '',
    country: activeWarehouse.country || 'South Korea',
    zip: activeWarehouse.zip || '',
    contactPerson: activeWarehouse.contactPerson || '',
    contactPersonEn: (activeWarehouse as any).contactPersonEn || ''
  } : {
    name: 'ナンバーワン',
    nameEn: 'No1 LLC',
    address: '大韓民国ソウル特別市九老区デジタル路26ギル5',
    addressEn: '5 Digital-ro 26-gil, Guro District, Seoul, South Korea',
    phone: '+82-10-7237-7260',
    email: 'info@no1-llc.com',
    country: 'South Korea',
    zip: '',
    contactPerson: '',
    contactPersonEn: ''
  };

  const handleDownloadSamplePDF = async () => {
    const isDecimal = formFields.currency === 'USD' || formFields.currency === 'EUR';
    const sampleShipment: Shipment = {
      id: 'sample-id',
      invoiceNo: `${formFields.prefix || 'INV-'}20260721-001`,
      date: '2026-07-21',
      warehouseId: activeWarehouse?.id || 'sample-warehouse',
      warehouseSnapshot: sampleWarehouseSnapshot,
      clinicId: 'sample-clinic',
      clinicSnapshot: {
        name: 'グナル美容外科クリニック',
        nameEn: 'Geunal Aesthetic Clinic',
        address: '東京都渋谷区神宮前1-2-3',
        addressEn: '1-2-3 Jingumae, Shibuya-ku, Tokyo, Japan',
        phone: '+81-3-1234-5678',
        email: 'contact@geunal-clinic.jp',
        zip: '150-0001',
        doctorName: '山田 太郎',
        doctorNameEn: 'Dr. Taro Yamada',
        contactPerson: '佐藤 美咲',
        contactPersonEn: 'Misaki Sato'
      },
      currency: formFields.currency as any,
      courier: 'DHL Express',
      trackingNo: 'JD1234567890',
      shippingCost: 0,
      insurance: 0,
      otherCharges: 0,
      notes: 'Keep cold. Handle with care.',
      items: [
        {
          productId: 'prod-1',
          sku: 'SKU-NEU-100',
          nameJa: 'ニューロノックス 100単位',
          nameEn: 'Neuronox 100 Units',
          lotNo: 'NTX2026B',
          expiryDate: '2028-04-12',
          qty: 10,
          unit: 'vials',
          unitPrice: isDecimal ? 120.00 : 12000,
          amount: isDecimal ? 1200.00 : 120000,
          weight: 0.05,
          totalWeight: 0.5,
          hsCode: '3002.90',
          countryOfOrigin: 'South Korea'
        },
        {
          productId: 'prod-2',
          sku: 'SKU-REJ-002',
          nameJa: 'リジュラン 2ml',
          nameEn: 'Rejuran 2ml',
          lotNo: 'RJR993C',
          expiryDate: '2027-11-30',
          qty: 15,
          unit: 'syringes',
          unitPrice: isDecimal ? 85.00 : 8500,
          amount: isDecimal ? 1275.00 : 127500,
          weight: 0.03,
          totalWeight: 0.45,
          hsCode: '3004.90',
          countryOfOrigin: 'South Korea'
        }
      ],
      totalQty: 25,
      totalWeight: 0.95,
      totalItemsAmount: isDecimal ? 2475.00 : 247500,
      totalInvoiceAmount: isDecimal ? 2475.00 : 247500,
      status: 'CONFIRMED',
      createdBy: 'system',
      createdByName: 'システム管理者',
      updatedBy: 'system',
      updatedByName: 'システム管理者',
      createdAt: '2026-07-21T00:00:00Z',
      updatedAt: '2026-07-21T00:00:00Z',
      history: []
    };

    try {
      await loadJapaneseFont();
      const doc = generateInvoicePDF(sampleShipment, formFields);
      doc.save(`SAMPLE_INVOICE_${sampleShipment.invoiceNo}.pdf`);
    } catch (e) {
      console.error(e);
      alert('PDFの生成中にエラーが発生しました。画像を読み込めない形式か、不正なデータが含まれている可能性があります。');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-2">
        <div>
          <h2 className="text-xl font-bold text-slate-900">システム基本設定</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            インボイス採番ルール、取引条件、署名イメージ、警告ライン設定などシステム共通パラメータを設定します。
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 self-start sm:self-auto shrink-0">
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'settings'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>パラメータ設定</span>
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'preview'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-500 hover:text-indigo-600'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>インボイス出来上がりプレビュー</span>
          </button>
        </div>
      </div>

      {activeTab === 'settings' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main form (left side) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/80 shadow-sm p-6 space-y-4">
          
          {showSuccessBanner && (
            <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-lg p-4 flex items-center justify-between shadow-sm animate-fade-in">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-500 text-white rounded-full p-1.5 shrink-0">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-sm text-emerald-950 flex items-center gap-2">
                    <span>システム基本設定を保存しました</span>
                    <span className="text-[10px] bg-emerald-200 text-emerald-800 font-bold px-2 py-0.5 rounded-full">Firestore同期済</span>
                  </div>
                  <div className="text-xs text-emerald-700 mt-0.5">
                    クラウドデータベースに正常に書き込まれました (保存時刻: {saveSuccessTime})。以降新規作成されるすべてのインボイスおよびPDFに即座に適用されます。
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSuccessBanner(false)}
                className="text-emerald-800 hover:text-emerald-950 text-xs font-bold px-2.5 py-1 rounded border border-emerald-300 bg-white hover:bg-emerald-50 cursor-pointer shrink-0 ml-2"
              >
                閉じる
              </button>
            </div>
          )}

          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
            <Settings className="w-4 h-4 text-blue-500" />
            <span>パラメータ設定項目</span>
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              
              <div>
                <label className="block font-bold text-slate-700 mb-1">インボイス番号接頭辞 (Prefix)</label>
                <input
                  type="text"
                  value={formFields.prefix}
                  onChange={(e) => setFormFields(prev => ({ ...prev, prefix: e.target.value.toUpperCase() }))}
                  className="w-full border border-slate-200 rounded px-3 py-1.5 font-mono font-bold"
                  placeholder="INV-"
                />
                <span className="text-[10px] text-slate-400 block mt-0.5">※例: INV-20260720-001 のように自動採番されます。</span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">デフォルト通貨 (Currency)</label>
                <select
                  value={formFields.currency}
                  onChange={(e) => setFormFields(prev => ({ ...prev, currency: e.target.value as any }))}
                  className="w-full border border-slate-200 rounded px-3 py-1.5 font-semibold"
                >
                  <option value="USD">USD ($)</option>
                  <option value="KRW">KRW (₩)</option>
                  <option value="JPY">JPY (¥)</option>
                  <option value="EUR">EUR (€)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">デフォルト発送元倉庫</label>
                <select
                  value={formFields.defaultWarehouseId}
                  onChange={(e) => setFormFields(prev => ({ ...prev, defaultWarehouseId: e.target.value }))}
                  className="w-full border border-slate-200 rounded px-3 py-1.5 font-semibold"
                >
                  <option value="">-- 未指定 --</option>
                  {warehouses.map(w => {
                    const isDefault = w.id === formFields.defaultWarehouseId || w.isDefault;
                    return (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.nameEn}){isDefault ? ' 【デフォルト】' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">引渡条件 (Terms of Delivery)</label>
                <input
                  type="text"
                  value={formFields.termsOfDelivery}
                  onChange={(e) => setFormFields(prev => ({ ...prev, termsOfDelivery: e.target.value }))}
                  className="w-full border border-slate-200 rounded px-3 py-1.5"
                  placeholder="DAP"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">輸出目的 (Reason for Export)</label>
                <input
                  type="text"
                  value={formFields.reasonForExport}
                  onChange={(e) => setFormFields(prev => ({ ...prev, reasonForExport: e.target.value }))}
                  className="w-full border border-slate-200 rounded px-3 py-1.5"
                  placeholder="Commercial Samples"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">重量単位 (Weight Unit)</label>
                <select
                  value={formFields.weightUnit}
                  onChange={(e) => setFormFields(prev => ({ ...prev, weightUnit: e.target.value }))}
                  className="w-full border border-slate-200 rounded px-3 py-1.5"
                >
                  <option value="kg">kg (キログラム)</option>
                  <option value="g">g (グラム)</option>
                  <option value="lbs">lbs (ポンド)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">日付フォーマット</label>
                <select
                  value={formFields.dateFormat}
                  onChange={(e) => setFormFields(prev => ({ ...prev, dateFormat: e.target.value }))}
                  className="w-full border border-slate-200 rounded px-3 py-1.5"
                >
                  <option value="YYYY-MM-DD">YYYY-MM-DD (2026-07-20)</option>
                  <option value="DD/MM/YYYY">DD/MM/YYYY (20/07/2026)</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY (07/20/2026)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">小数点以下桁数</label>
                <select
                  value={formFields.decimalPlaces}
                  onChange={(e) => setFormFields(prev => ({ ...prev, decimalPlaces: Number(e.target.value) }))}
                  className="w-full border border-slate-200 rounded px-3 py-1.5"
                >
                  <option value={0}>0桁（整数表示のみ）</option>
                  <option value={1}>1桁 (0.0)</option>
                  <option value={2}>2桁 (0.00)</option>
                  <option value={3}>3桁 (0.000)</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-700 mb-1">インボイス印刷 誓約・宣言文 (Declaration Statement)</label>
                <textarea
                  value={formFields.declaration}
                  onChange={(e) => setFormFields(prev => ({ ...prev, declaration: e.target.value }))}
                  rows={3}
                  className="w-full border border-slate-200 rounded p-2.5 leading-relaxed font-sans"
                  placeholder="We hereby certify..."
                />
              </div>

              <div className="border-t border-slate-100 sm:col-span-2 pt-3">
                <h4 className="font-bold text-blue-600 mb-2">ロゴ・署名イメージ（デモ用）</h4>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Image className="w-3.5 h-3.5 text-slate-400" />
                  <span>会社ロゴ画像 URL / Base64</span>
                </label>
                <input
                  type="text"
                  value={formFields.companyLogo}
                  onChange={(e) => setFormFields(prev => ({ ...prev, companyLogo: e.target.value }))}
                  className="w-full border border-slate-200 rounded px-3 py-1.5 font-mono"
                  placeholder="https://... または data:image/png;base64,..."
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  <span>出荷担当者 署名画像 URL / Base64</span>
                </label>
                <input
                  type="text"
                  value={formFields.signatureImage}
                  onChange={(e) => setFormFields(prev => ({ ...prev, signatureImage: e.target.value }))}
                  className="w-full border border-slate-200 rounded px-3 py-1.5 font-mono"
                  placeholder="data:image/png;base64,..."
                />
              </div>

            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <div className="text-xs text-slate-500 flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Firestoreリアルタイム同期有効</span>
                {saveSuccessTime && <span className="text-slate-400 ml-1">(最終保存: {saveSuccessTime})</span>}
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold px-6 py-2 rounded text-xs flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>保存中...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>システム設定を保存</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Info panel (right side) */}
        <div className="space-y-6">
          {/* Active Settings Status Card */}
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-5 space-y-3">
            <h4 className="font-bold text-xs text-emerald-900 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>現在有効な設定 (Firestore保存済)</span>
              </span>
              <span className="text-[10px] bg-emerald-200/80 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                ACTIVE
              </span>
            </h4>
            <div className="text-xs text-slate-700 space-y-1.5 font-mono bg-white p-3 rounded-lg border border-emerald-100 shadow-2xs leading-relaxed">
              <div><span className="text-slate-400 font-sans">Prefix:</span> <strong className="text-slate-900">{settings.prefix || 'INV-'}</strong></div>
              <div><span className="text-slate-400 font-sans">Currency:</span> <strong className="text-slate-900">{settings.currency || 'JPY'}</strong></div>
              <div><span className="text-slate-400 font-sans">Weight Unit:</span> <strong className="text-slate-900">{settings.weightUnit || 'kg'}</strong></div>
              <div><span className="text-slate-400 font-sans">Terms of Delivery:</span> <strong className="text-slate-900">{settings.termsOfDelivery || 'DAP'}</strong></div>
              <div><span className="text-slate-400 font-sans">Reason for Export:</span> <strong className="text-slate-900">{settings.reasonForExport || 'Commercial Samples'}</strong></div>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
            <h4 className="font-bold text-xs text-slate-800 flex items-center gap-1">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>採番ルールの挙動</span>
            </h4>
            <div className="text-xs text-slate-600 space-y-2.5 leading-relaxed">
              <p>
                - インボイス番号は、確定保存または下書き保存を実行する際に、以下のロジックで自動決定されます。
              </p>
              <p className="bg-white p-2 border border-slate-100 rounded font-mono font-bold text-[10px] text-indigo-600">
                インボイス番号 = [接頭辞] + [作成年月日 YYYYMMDD] + [当日の3桁連番]
              </p>
              <p>
                - 例えば接頭辞を <code>INV-</code> とし、2026年7月20日に本日1件目のインボイスを作った場合は <code>INV-20260720-001</code> になります。
              </p>
              <p>
                - 採番は、Firestoreのカウンターコレクションと連携しているため、他ユーザーとの同時操作でも番号が重複しないように設計されています。
              </p>
            </div>
          </div>
        </div>
        </div>
      ) : (
        <InvoiceLivePreview
          formFields={formFields}
          sampleWarehouseSnapshot={sampleWarehouseSnapshot}
          handleDownloadSamplePDF={handleDownloadSamplePDF}
        />
      )}
    </div>
  );
}

function InvoiceLivePreview({
  formFields,
  sampleWarehouseSnapshot,
  handleDownloadSamplePDF
}: {
  formFields: SettingsType;
  sampleWarehouseSnapshot: any;
  handleDownloadSamplePDF: () => void;
}) {
  const isDecimal = formFields.currency === 'USD' || formFields.currency === 'EUR';
  const currencySymbol = formFields.currency === 'JPY' ? '¥' : formFields.currency === 'USD' ? '$' : formFields.currency === 'KRW' ? '₩' : '€';
  
  const formatValue = (val: number) => {
    return val.toLocaleString(undefined, {
      minimumFractionDigits: formFields.decimalPlaces ?? 2,
      maximumFractionDigits: formFields.decimalPlaces ?? 2
    });
  };

  const sampleItems = [
    { sku: 'SKU-NEU-100', nameEn: 'Neuronox 100 Units', lot: 'NTX2026B', expiry: '2028-04-12', hsCode: '3002.90', qty: 10, unit: 'vials', price: isDecimal ? 120 : 12000, total: isDecimal ? 1200 : 120000 },
    { sku: 'SKU-REJ-002', nameEn: 'Rejuran 2ml', lot: 'RJR993C', expiry: '2027-11-30', hsCode: '3004.90', qty: 15, unit: 'syringes', price: isDecimal ? 85 : 8500, total: isDecimal ? 1275 : 127500 },
  ];

  const subtotal = sampleItems.reduce((acc, item) => acc + item.total, 0);
  const grandTotal = subtotal;

  return (
    <div className="space-y-6">
      <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-slate-800">インボイス印刷プレビュー（ライブ）</h3>
          <p className="text-xs text-slate-500 mt-1">
            システム基本設定のパラメータが、PDF出力および印刷時にどのようにレイアウトされるかをリアルタイムで確認できます。
          </p>
        </div>
        <button
          onClick={handleDownloadSamplePDF}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2 rounded text-xs flex items-center gap-1.5 cursor-pointer shadow-sm shrink-0 transition-all active:scale-95 flex items-center gap-1"
        >
          <Download className="w-4 h-4" />
          <span>サンプルPDFをダウンロード</span>
        </button>
      </div>

      {/* A4 Document Container */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-lg max-w-4xl mx-auto p-8 sm:p-12 font-sans text-slate-700 select-none overflow-x-auto">
        <div className="min-w-[700px]">
          {/* Header Section */}
          <div className="flex justify-between items-start border-b border-slate-200 pb-6 mb-6">
            <div className="space-y-3">
              {formFields.companyLogo ? (
                <img
                  src={formFields.companyLogo}
                  alt="Company Logo"
                  className="max-h-12 max-w-[200px] object-contain"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="h-10 w-36 bg-slate-100 rounded flex items-center justify-center border border-slate-200 border-dashed text-[10px] text-slate-400 font-mono">
                  [ 会社ロゴエリア ]
                </div>
              )}
              <h1 className="text-xl font-black text-slate-900 tracking-tight">INVOICE</h1>
            </div>

            <div className="text-right text-[11px] space-y-1 font-mono text-slate-500">
              <div><span className="font-bold text-slate-800">Invoice No:</span> {formFields.prefix}20260721-001</div>
              <div><span className="font-bold text-slate-800">Invoice Date:</span> 2026-07-21</div>
              <div><span className="font-bold text-slate-800">Shipping Date:</span> 2026-07-21</div>
              <div><span className="font-bold text-slate-800">Currency:</span> {formFields.currency}</div>
            </div>
          </div>

          {/* Parties Section */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            {/* Shipper */}
            <div className="border border-slate-200 rounded p-4 text-[11px] space-y-2.5 leading-relaxed">
              <div className="bg-slate-50 text-[10px] font-bold text-slate-600 px-2 py-0.5 rounded border border-slate-200 inline-block mb-1">
                SHIPPER / EXPORTER
              </div>
              <div className="font-bold text-slate-800 text-xs">{sampleWarehouseSnapshot.nameEn || sampleWarehouseSnapshot.name}</div>
              <div>{sampleWarehouseSnapshot.addressEn || sampleWarehouseSnapshot.address}</div>
              <div><span className="text-slate-400">Country:</span> {sampleWarehouseSnapshot.country}</div>
              <div><span className="text-slate-400">Postal Code:</span> {sampleWarehouseSnapshot.zip || '(None)'}</div>
              <div><span className="text-slate-400">Tel:</span> {sampleWarehouseSnapshot.phone || '-'}</div>
            </div>

            {/* Consignee */}
            <div className="border border-slate-200 rounded p-4 text-[11px] space-y-2.5 leading-relaxed">
              <div className="bg-slate-50 text-[10px] font-bold text-slate-600 px-2 py-0.5 rounded border border-slate-200 inline-block mb-1">
                CONSIGNEE / IMPORTER
              </div>
              <div className="font-bold text-slate-800 text-xs">Geunal Aesthetic Clinic</div>
              <div>1-2-3 Jingumae, Shibuya-ku, Tokyo, Japan</div>
              <div><span className="text-slate-400">Country:</span> Japan</div>
              <div><span className="text-slate-400">Postal Code:</span> 150-0001</div>
              <div><span className="text-slate-400">Doctor:</span> Dr. Taro Yamada</div>
              <div><span className="text-slate-400">Contact:</span> Sato Misaki</div>
              <div><span className="text-slate-400">Tel:</span> +81-3-1234-5678</div>
            </div>
          </div>

          {/* Shipping & Delivery Info */}
          <div className="border border-slate-200 rounded p-4 mb-6 text-[11px]">
            <div className="bg-slate-50 text-[10px] font-bold text-slate-600 px-2 py-0.5 rounded border border-slate-200 inline-block mb-3">
              SHIPPING & DELIVERY INFORMATION
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2.5 text-slate-700 leading-relaxed">
              <div><span className="text-slate-400 font-medium">Shipping Route:</span> {sampleWarehouseSnapshot.country || 'South Korea'} to Japan</div>
              <div><span className="text-slate-400 font-medium">Reason for Export:</span> {formFields.reasonForExport || 'Commercial Sample'}</div>
              <div><span className="text-slate-400 font-medium">Country of Origin:</span> {sampleWarehouseSnapshot.country || 'South Korea'}</div>
              <div><span className="text-slate-400 font-medium">Terms of Delivery:</span> {formFields.termsOfDelivery || 'DAP'}</div>
            </div>
          </div>

          {/* Items Table */}
          <table className="w-full text-left text-[11px] border-collapse mb-6">
            <thead>
              <tr className="bg-slate-800 text-white font-bold">
                <th className="py-2.5 px-2 pl-3 rounded-l">No.</th>
                <th className="py-2.5 px-2">Description of Goods</th>
                <th className="py-2.5 px-2 text-right">Qty / Unit</th>
                <th className="py-2.5 px-2 text-right">Unit Price</th>
                <th className="py-2.5 px-2 text-right pr-3 rounded-r">Amount</th>
              </tr>
            </thead>
            <tbody>
              {sampleItems.map((item, idx) => (
                <tr key={idx} className={`${idx % 2 === 1 ? 'bg-slate-50/60' : ''} border-b border-slate-100 hover:bg-slate-50/40 transition-colors`}>
                  <td className="py-3 px-2 pl-3 text-slate-400 font-mono">{idx + 1}</td>
                  <td className="py-3 px-2 font-semibold text-slate-800 leading-relaxed">{item.nameEn}</td>
                  <td className="py-3 px-2 text-right font-mono font-bold text-slate-600">{item.qty} {item.unit}</td>
                  <td className="py-3 px-2 text-right font-mono">{currencySymbol} {formatValue(item.price)}</td>
                  <td className="py-3 px-2 text-right pr-3 font-mono font-bold text-slate-800">{currencySymbol} {formatValue(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Bottom Summary block (right-aligned) */}
          <div className="flex justify-end mb-8">
            <div className="w-72 border border-slate-100 rounded bg-slate-50/50 p-4 text-[11px] space-y-2">
              <div className="flex justify-between text-slate-500">
                <span>Total Items Qty:</span>
                <span className="font-mono font-semibold text-slate-700">25 pcs</span>
              </div>
              <div className="flex justify-between text-slate-500 border-b border-slate-100 pb-2">
                <span>Subtotal Amount:</span>
                <span className="font-mono font-semibold text-slate-700">{currencySymbol} {formatValue(subtotal)}</span>
              </div>
              <div className="flex justify-between text-xs font-bold text-slate-900 pt-1">
                <span>TOTAL INVOICE VALUE:</span>
                <span className="font-mono text-indigo-600">{formFields.currency} {formatValue(grandTotal)}</span>
              </div>
            </div>
          </div>

          {/* Declaration */}
          <div className="space-y-1.5 text-[11px]">
            <div className="font-bold text-slate-800">Declaration:</div>
            <p className="italic text-slate-500 leading-relaxed max-w-2xl bg-slate-50/40 p-3 rounded border border-slate-100 mb-6">
              {formFields.declaration || "(No declaration statement configured)"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

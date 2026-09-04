import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  Upload, 
  Download, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  FileText, 
  RefreshCw, 
  Layers, 
  Database, 
  Sparkles, 
  Eye, 
  ArrowRight, 
  Check, 
  X, 
  Building2, 
  Package, 
  Calendar, 
  DollarSign, 
  HelpCircle, 
  FileArchive, 
  Search, 
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  FileCode,
  ExternalLink,
  PlusCircle,
  Truck
} from 'lucide-react';
import { 
  Clinic, 
  Product, 
  Warehouse, 
  Shipment, 
  SystemSettings 
} from '../types';
import { 
  parseShippingCsv, 
  convertAllocationsToShipments, 
  CsvParseResult, 
  ParsedClinicAllocation 
} from '../lib/csvInvoiceParser';
import { generateShipmentsZip, generateInvoicePDF } from '../lib/pdf';
import { SAMPLE_CLINICS_MASTER, SAMPLE_PRODUCTS_MASTER } from '../data/sampleClinicProductData';
import { db } from '../lib/firebase';
import { collection, writeBatch, doc } from 'firebase/firestore';

interface CsvInvoiceImporterProps {
  clinics: Clinic[];
  products: Product[];
  warehouses: Warehouse[];
  settings: SystemSettings;
  onNavigateToShipments?: () => void;
  onRefreshMasters?: () => void;
}

const DEFAULT_SAMPLE_CSV = `INVOICE DRIVE,出荷資料 0901,,,,,,,
Company Name,Recipient's Name,Invoice number,Packaging Items,quantity,significant,tracking number,,LINE
5DENTAL東京銀座,YOTARO ABE,260901-1,Vitamin C Inj.,7,クール,8765 5113 0691,済,済
,,,,,,,,
THE LANA CLINIC 大阪梅田,HIROAKI MATSUMORI,260901-2,Vitamin C Inj.,6,クール,8765 5118 7933,済,
,,,,,,,,
永島メディカルクリニック,SHUICHI NAGASHIMA,260901-3,Vitamin C Inj.,5,クール,8765 5123 4141,済,済
,,,,,,,,
康安外科内科医院,NARUMI YASUMASA,260901-4,Vitamin C Inj.,10,クール,8765 5129 8680,済,済
,,,,,,,,
メリアビューティークリニック,HARUKI YAMAMOTO,260901-5,Neuramis Deep (Lido),3,クール,8765 5135 6675,済,済
,,,Vitamin C Inj.,10,,,,
,,,,,,,,
名古屋美容外科,MUTSUHIRO NAKAMURA,260901-6,Kabelline,25,,8765 5141 8324,済,済
,,,,,,,,
上野注入クリニック,TAKAHITO HARIU,260901-7,Kabelline,50,,8765 5146 8903,済,済
,,,,,,,,
サクラギクリニック,TETSUSHI SAKURAGI,260901-8,Kabelline,5,,8765 5154 7389,済,済
,,,,,,,,
みきなクリニック,REMI TOKAI,260901-9,Kabelline,2,,8765 5158 9948,済,済
,,,,,,,,
AZ BEAUTY CLINIC,JUN KIMURA,260901-10,Kabelline,5,,8765 5182 8624,済,済
,,,,,,,,
WITH BEAUTY CLINIC,SACHI TERAMURA,260901-11,Kabelline,13,,8765 5191 9508,済,済
,,,,,,,,
You's clinic Aoyama,YU HASEGAWA,260901-12,Kabelline,3,,8765 5196 3890 ,済,済
,,,,,,,,
京都駅前美容外科,YUKIFUMI TATSUYAMA,260901-13,Kabelline,2,クール,8765 5201 2240 ,済,済
,,,Liporase Inj.,2,,,,
,,,,,,,,
医療法人社団東美会 フィラークリニック 新宿院,MACHIKO NAGAI,260901-14,Liporase Inj.,1,クール,8765 5206 1889,済,
,,,,,,,,
SHINSAIBASHI Ai CLINIC,SHOJI TAKAMI,260901-15,Liporase Inj.,1,クール,8765 5211 8517,済,済
,,,,,,,,
BiOLiSクリニック,KAZUSHI SASAKI,260901-16,Elravie Re2o,17,,8765 6215 9539,済,済
,,,,,,,,
M&B美容皮フ科クリニック,TOSHIYUKI KAWASHIMA,260901-17,Elravie Re2o,10,,8765 5220 4476,済,済
,,,,,,,,
こばやし内科小児科クリニック,YASUTOSHI KOBAYASHI,260901-18,Elravie Re2o,4,,8765 5226 0568,済,済
,,,,,,,,
はばたきファミリークリニック,MASATO KANBE,260901-19,Neuramis light (Lido),10,クール,8765 5248 2903,済,済
,,,Rejuran HB(Plus),4,,,済,
,,,Rejuran i,4,,,済,
,,,Rejuran,4,,,済,
,,,,,,,,
AZABU TS Clinic,TSUNEAKI SONO,260901-20,Rejuran i,5,,8765 5232 7149,済,済
,,,Rejuran,10,,,済,
,,,,,,,,
エバーグリーンメディカルクリニック,OUKA NUMATA,260901-21,KiaraReju,10,クール,8765 5222 9208,済,済
,,,Neuramis Deep (Lido),20,,,済,
,,,,,,,,
ナチュラルスキンクリニック 自由ヶ丘院,AYA ENYAMA,260901-22,The Chaeum premium No.1,2,,8765 5215 6882,済,済
,,,The Chaeum premium No.2,1,,,済,
,,,The Chaeum premium No.3,2,,,済,
,,,The Chaeum premium No.4,1,,,済,
,,,Rejuran i,50,,,済,
,,,,,,,,
茜道頓堀クリニック,UNSO OH,260901-23,VOLUDERMDEEP,1,,8765 5206 2083,済,済
,,,VOLUDERM FINE,1,,,済,
,,,VOLUDERMSUB-Q,1,,,済,
,,,,,,,,
ラジニアクリニック,KENTARO UEKI,260901-24,Rejuran HB(Plus),10,クール,8765 5197 9878,済,済
,,,,,,,,
VERA CLINIC,KENSHIRO TAKUBO,260901-25,Mirror Cannula MC-25050C,1,クール,8765 5413 6780,済,済
,,,The Chaeum premium No.1,1,,,済,
,,,Liporase Inj.,1,,,済,
,,,MUCHCAINE Plus,2,,,済,
,,,,,,,,
東京シルククリニック 神田院,KEISUKE KAMIYA,260901-26,JUVELOOK,200,,8765 5187 7931,済,済
,,,,,,,,
心斎橋コムロ美容外科,HIDEYUKI IKEUCHI,260901-27,Rejuran,5,,8765 5181 2268,済,済
,,,,,,,,
銀座Mitaクリニック,ATSUKO MITA,260901-28,JUVELOOK,2,,8765 5176 0922,済,済
,,,Neuramis Deep (Lido),20,,,済,
,,,Neuramis light (Lido),2,,,済,
,,,Rejuran i,5,,,済,
,,,,,,,,
フジクリニック,NAOKI FUJIMOTO,260901-29,LUTHIONE 1200mg,3,,8765 5166 6619,済,済
,,,,,,,,
中濵クリニック,MASAO NAKAHAMA,260901-30,Neuramis Deep (Lido),10,,8765 5158 2233,済,済
,,,,,,,,
藤ナチュレ美容クリニック 銀座院,KYOHEI OGAWA,260901-31,The Chaeum premium No.1,3,,8765 5149 2850,済,済
,,,,,,,,
NARU Beauty Clinic,NARUHIKO ISHIBASHI,260901-32,VOLUDERMSUB-Q,5,,8765 5144 1881,済,済
,,,,,,,,
アイネクリニック,YUKO SAOTOME,260901-33,DR.MICRO NEEDLES 35GX2mm,1,,8765 5137 7353,済,済
,,,,,,,,
TOGASHI CLINIC,RYOTA TOGASHI,260901-34,Collaju,31,クール,8765 5131 8137,,`;

export default function CsvInvoiceImporter({
  clinics,
  products,
  warehouses,
  settings,
  onNavigateToShipments,
  onRefreshMasters
}: CsvInvoiceImporterProps) {
  // Input State
  const [inputMode, setInputMode] = useState<'upload' | 'paste'>('upload');
  const [csvText, setCsvText] = useState<string>('');
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  
  // Shipping Context State
  const defaultWh = warehouses.find(w => w.isDefault) || warehouses[0] || {
    id: 'wh-default',
    warehouseId: 'WH-SEOUL-01',
    name: 'Seoul Main Hub (No1 LLC)',
    nameEn: 'No1 LLC Seoul Distribution Center',
    contactPerson: 'Director of Logistics',
    address: '5 Digital-ro 26-gil, Guro District, Seoul, South Korea',
    addressEn: '5 Digital-ro 26-gil, Guro District, Seoul, South Korea',
    phone: '+82-10-7237-7260',
    email: 'logistics@no1-beauty.kr',
    country: 'South Korea',
    zip: '08389',
    notes: 'Primary Export Warehouse',
    isDefault: true,
    createdAt: new Date().toISOString()
  };

  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(defaultWh.id);
  const [shippingDate, setShippingDate] = useState<string>(new Date().toISOString().substring(0, 10));
  const [currency, setCurrency] = useState<'JPY' | 'USD' | 'KRW' | 'EUR'>('JPY');

  // Parsing Options
  const [showConfigAccordion, setShowConfigAccordion] = useState<boolean>(false);
  const [productColOverride, setProductColOverride] = useState<number | undefined>(undefined);
  const [qtyColOverride, setQtyColOverride] = useState<number | undefined>(undefined);

  // Analysis / Parsed Result State
  const [parseResult, setParseResult] = useState<CsvParseResult | null>(null);
  const [selectedAllocIds, setSelectedAllocIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'MATCHED' | 'WARNING'>('ALL');

  // Operation States
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [isGeneratingZip, setIsGeneratingZip] = useState<boolean>(false);
  const [isSavingDb, setIsSavingDb] = useState<boolean>(false);
  const [isSeedingMasters, setIsSeedingMasters] = useState<boolean>(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Preview Modal
  const [previewShipment, setPreviewShipment] = useState<Shipment | null>(null);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  // Active warehouse
  const activeWarehouse = useMemo(() => {
    return warehouses.find(w => w.id === selectedWarehouseId) || defaultWh;
  }, [warehouses, selectedWarehouseId, defaultWh]);

  // Execute parsing when csvText or options change
  const handleParseCsv = (textToParse: string = csvText) => {
    if (!textToParse || !textToParse.trim()) {
      showToast('解析するCSVデータを入力またはアップロードしてください。', 'error');
      return;
    }

    setIsParsing(true);
    try {
      const result = parseShippingCsv(
        textToParse,
        clinics,
        products,
        settings,
        {
          productCol: productColOverride,
          qtyCol: qtyColOverride
        }
      );

      setParseResult(result);
      // Select all allocations by default
      const allIds = new Set(result.allocations.map(a => a.id));
      setSelectedAllocIds(allIds);

      if (result.allocations.length === 0) {
        showToast('有効な出荷データが見つかりませんでした。ヘッダーや形式をご確認ください。', 'error');
      } else {
        showToast(`CSVを正常に解析しました（クリニック: ${result.totalClinics}件、製剤品目: ${result.totalItemsCount}行）。`, 'success');
      }
    } catch (err: any) {
      console.error('CSV Parsing Error:', err);
      showToast(`CSV解析中にエラーが発生しました: ${err.message || 'フォーマットエラー'}`, 'error');
    } finally {
      setIsParsing(false);
    }
  };

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCsvText(content);
      handleParseCsv(content);
    };
    reader.onerror = () => {
      showToast('ファイルの読み込みに失敗しました。', 'error');
    };
    reader.readAsText(file, 'UTF-8');
  };

  // Load sample CSV
  const handleLoadSample = () => {
    setCsvText(DEFAULT_SAMPLE_CSV);
    setUploadedFileName('出荷資料_0901_sample.csv');
    setInputMode('paste');
    handleParseCsv(DEFAULT_SAMPLE_CSV);
  };

  // Auto-seed or Sync Missing Masters into Firestore
  const handleSeedMastersToDb = async () => {
    setIsSeedingMasters(true);
    try {
      const batch = writeBatch(db);
      let addedClinics = 0;
      let addedProducts = 0;

      // 1. Add sample clinics that don't exist in clinics list
      for (const sampleClinic of SAMPLE_CLINICS_MASTER) {
        const exists = clinics.some(c => 
          c.name.trim() === sampleClinic.name.trim() || 
          (c.nameEn && c.nameEn.trim().toLowerCase() === sampleClinic.nameEn.trim().toLowerCase())
        );
        if (!exists) {
          const newDocRef = doc(collection(db, 'clinics'));
          batch.set(newDocRef, {
            ...sampleClinic,
            createdAt: new Date().toISOString()
          });
          addedClinics++;
        }
      }

      // 2. Add sample products that don't exist in products list
      for (const sampleProd of SAMPLE_PRODUCTS_MASTER) {
        const exists = products.some(p => 
          p.sku.trim().toLowerCase() === sampleProd.sku.trim().toLowerCase() ||
          p.nameEn.trim().toLowerCase() === sampleProd.nameEn.trim().toLowerCase()
        );
        if (!exists) {
          const newDocRef = doc(collection(db, 'products'));
          batch.set(newDocRef, {
            ...sampleProd,
            createdAt: new Date().toISOString()
          });
          addedProducts++;
        }
      }

      if (addedClinics > 0 || addedProducts > 0) {
        await batch.commit();
        showToast(`データベースに未登録のクリニック ${addedClinics} 件、製剤 ${addedProducts} 件を登録しました！`, 'success');
        if (onRefreshMasters) onRefreshMasters();
        // Re-parse with newly added items
        setTimeout(() => {
          if (csvText) handleParseCsv(csvText);
        }, 1000);
      } else {
        showToast('すべてのサンプルクリニック・製剤はすでにデータベースに登録されています。', 'info');
      }
    } catch (err: any) {
      console.error('Error seeding masters:', err);
      showToast(`マスタ登録中にエラーが発生しました: ${err.message || '不明なエラー'}`, 'error');
    } finally {
      setIsSeedingMasters(false);
    }
  };

  // Toggle selection
  const handleToggleSelectAll = () => {
    if (!parseResult) return;
    if (selectedAllocIds.size === parseResult.allocations.length) {
      setSelectedAllocIds(new Set());
    } else {
      setSelectedAllocIds(new Set(parseResult.allocations.map(a => a.id)));
    }
  };

  const handleToggleSelectOne = (id: string) => {
    setSelectedAllocIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Filtered allocations for display
  const filteredAllocations = useMemo(() => {
    if (!parseResult) return [];
    return parseResult.allocations.filter(alloc => {
      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchClinic = alloc.clinicNameCsv.toLowerCase().includes(q) ||
                            (alloc.matchedClinic?.nameEn || '').toLowerCase().includes(q) ||
                            alloc.doctorNameEnFromDb.toLowerCase().includes(q);
        const matchItem = alloc.items.some(it => 
          it.nameEn.toLowerCase().includes(q) || 
          it.nameJa.toLowerCase().includes(q) || 
          it.sku.toLowerCase().includes(q)
        );
        if (!matchClinic && !matchItem) return false;
      }

      // Status filter
      if (filterStatus === 'MATCHED') {
        return alloc.isDbMatched && alloc.items.every(it => it.isProductDbMatched);
      }
      if (filterStatus === 'WARNING') {
        return !alloc.isDbMatched || alloc.items.some(it => !it.isProductDbMatched);
      }

      return true;
    });
  }, [parseResult, searchQuery, filterStatus]);

  // Selected shipments conversion
  const selectedShipments = useMemo(() => {
    if (!parseResult) return [];
    const chosenAllocations = parseResult.allocations.filter(a => selectedAllocIds.has(a.id));
    return convertAllocationsToShipments(
      chosenAllocations,
      activeWarehouse,
      settings,
      shippingDate,
      currency
    );
  }, [parseResult, selectedAllocIds, activeWarehouse, settings, shippingDate, currency]);

  // Action: Export ZIP of all Invoices
  const handleExportZip = async () => {
    if (selectedShipments.length === 0) {
      showToast('出力対象のインボイスを選択してください。', 'error');
      return;
    }

    setIsGeneratingZip(true);
    try {
      const zipBlob = await generateShipmentsZip(selectedShipments, settings);
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      const datePart = shippingDate.replace(/-/g, '');
      a.download = `INVOICES_${datePart}_${selectedShipments.length}CLINICS.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast(`全 ${selectedShipments.length} 通のインボイスPDFを一括ZIPとしてダウンロードしました！`, 'success');
    } catch (err: any) {
      console.error('ZIP Generation Error:', err);
      showToast(`ZIP作成中にエラーが発生しました: ${err.message || 'エラー'}`, 'error');
    } finally {
      setIsGeneratingZip(false);
    }
  };

  // Action: Save to Firestore Shipments Database
  const handleSaveToDatabase = async () => {
    if (selectedShipments.length === 0) {
      showToast('保存対象のインボイスを選択してください。', 'error');
      return;
    }

    setIsSavingDb(true);
    try {
      const batch = writeBatch(db);
      selectedShipments.forEach(shipment => {
        const newDocRef = doc(collection(db, 'shipments'));
        batch.set(newDocRef, {
          ...shipment,
          id: newDocRef.id,
          createdAt: new Date().toISOString()
        });
      });

      await batch.commit();
      showToast(`全 ${selectedShipments.length} 件のインボイスを出荷履歴データベースに保存・確定しました！`, 'success');
    } catch (err: any) {
      console.error('Database Save Error:', err);
      showToast(`データベース保存中にエラーが発生しました: ${err.message || 'エラー'}`, 'error');
    } finally {
      setIsSavingDb(false);
    }
  };

  // Action: Open Single Invoice PDF Preview
  const handlePreviewSingle = (alloc: ParsedClinicAllocation) => {
    const singleShipment = convertAllocationsToShipments(
      [alloc],
      activeWarehouse,
      settings,
      shippingDate,
      currency
    )[0];

    setPreviewShipment(singleShipment);
    try {
      const doc = generateInvoicePDF(singleShipment, settings);
      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      setPreviewPdfUrl(url);
    } catch (e) {
      console.error('PDF Preview Generation Error:', e);
      showToast('プレビューPDFの生成に失敗しました。', 'error');
    }
  };

  const closePreviewModal = () => {
    if (previewPdfUrl) {
      URL.revokeObjectURL(previewPdfUrl);
      setPreviewPdfUrl(null);
    }
    setPreviewShipment(null);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Page Title & Context Header */}
      <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center gap-1.5">
                <FileSpreadsheet className="w-3.5 h-3.5" />
                CSV AUTOMATED INVOICE ENGINE
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                A列・E列 データベース自動照合
              </span>
            </div>
            <h2 className="text-xl lg:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <span>CSV出荷データ一括インボイス作成</span>
            </h2>
            <p className="text-slate-400 text-xs mt-1.5 max-w-3xl leading-relaxed">
              CSVファイルを読み込み、<strong className="text-slate-200">A列のクリニック名</strong>と<strong className="text-slate-200">E列の製剤</strong>をデータベースから参照して一括データ化します。<br className="hidden sm:inline" />
              <span className="text-blue-400 font-medium">B列（受取人名）は無視してDBの医師名を採用</span>、
              <span className="text-indigo-400 font-medium">C列（番号）は無視してシステム自動採番</span>を行い、一式でインボイスPDFを一括出力します。
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleLoadSample}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 shadow-sm flex items-center gap-2 transition-all cursor-pointer hover:text-white"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>サンプルの出荷CSVを読込</span>
            </button>
            <button
              type="button"
              onClick={handleSeedMastersToDb}
              disabled={isSeedingMasters}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              title="CSV内のクリニック・製剤をデータベースへ一括登録"
            >
              {isSeedingMasters ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Database className="w-3.5 h-3.5 text-indigo-400" />
              )}
              <span>未登録マスタをDBへ一括登録</span>
            </button>
          </div>
        </div>
      </div>

      {/* Input / Upload Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
        {/* Step 1 & Controls Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between pb-4 mb-4 border-b border-slate-800 gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-black">
              1
            </div>
            <h3 className="text-sm font-bold text-white">CSV入力・ファイル選択</h3>
            
            {/* Input Mode Selector */}
            <div className="ml-4 flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setInputMode('upload')}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  inputMode === 'upload' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                ファイルアップロード
              </button>
              <button
                type="button"
                onClick={() => setInputMode('paste')}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  inputMode === 'paste' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                テキスト貼り付け
              </button>
            </div>
          </div>

          {/* Quick Context Settings */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            {/* Warehouse select */}
            <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-400">発送元倉庫:</span>
              <select
                value={selectedWarehouseId}
                onChange={(e) => setSelectedWarehouseId(e.target.value)}
                className="bg-transparent text-white font-bold border-none outline-none cursor-pointer text-xs"
              >
                {warehouses.map(w => (
                  <option key={w.id} value={w.id} className="bg-slate-900 text-white">
                    {w.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Select */}
            <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-400">インボイス日付:</span>
              <input
                type="date"
                value={shippingDate}
                onChange={(e) => setShippingDate(e.target.value)}
                className="bg-transparent text-white font-bold border-none outline-none cursor-pointer text-xs"
              />
            </div>

            {/* Currency */}
            <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800">
              <DollarSign className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-400">通貨:</span>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as any)}
                className="bg-transparent text-white font-bold border-none outline-none cursor-pointer text-xs"
              >
                <option value="JPY" className="bg-slate-900 text-white">JPY (¥)</option>
                <option value="USD" className="bg-slate-900 text-white">USD ($)</option>
                <option value="KRW" className="bg-slate-900 text-white">KRW (₩)</option>
                <option value="EUR" className="bg-slate-900 text-white">EUR (€)</option>
              </select>
            </div>

            {/* Advanced column toggle */}
            <button
              type="button"
              onClick={() => setShowConfigAccordion(!showConfigAccordion)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1 text-xs"
            >
              <span>列マッピング設定</span>
              {showConfigAccordion ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
        </div>

        {/* Collapsible Column Specification Info */}
        {showConfigAccordion && (
          <div className="mb-4 p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-300 flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-blue-400" />
                CSV列マッピングルール仕様
              </span>
              <span className="text-[11px] text-slate-500 font-mono">仕様に基づき自動検出済み</span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5">
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 block">A列 (1列目)</span>
                <p className="font-bold text-white mt-0.5">クリニック名</p>
                <p className="text-[10px] text-emerald-400 mt-1">DBから同様の名前で照合・取得</p>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 block">B列 (2列目)</span>
                <p className="font-bold text-amber-300 line-through">受取人氏名</p>
                <p className="text-[10px] text-amber-400 mt-1">CSV値は無視 → DBの医師名を適用</p>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 block">C列 (3列目)</span>
                <p className="font-bold text-indigo-300 line-through">インボイス番号</p>
                <p className="text-[10px] text-indigo-400 mt-1">CSV値は無視 → システム自動採番</p>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 block">E列 / D列</span>
                <p className="font-bold text-white mt-0.5">Packaging Items (製剤)</p>
                <p className="text-[10px] text-emerald-400 mt-1">DBを参照して単価・規格を取得</p>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 block">F列 / E列 &amp; G列以降</span>
                <p className="font-bold text-white mt-0.5">数量 (quantity)</p>
                <p className="text-[10px] text-slate-400 mt-1">G列以降の追跡番号等は無視</p>
              </div>
            </div>
          </div>
        )}

        {/* Upload Mode UI */}
        {inputMode === 'upload' ? (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              onChange={handleFileUpload}
              className="hidden"
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-700 hover:border-blue-500 rounded-xl p-8 text-center bg-slate-950/40 hover:bg-slate-950/80 transition-all cursor-pointer group"
            >
              <div className="w-12 h-12 rounded-xl bg-blue-600/10 text-blue-400 group-hover:bg-blue-600 group-hover:text-white mx-auto flex items-center justify-center mb-3 transition-colors">
                <Upload className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">
                {uploadedFileName ? `選択中: ${uploadedFileName}` : 'CSVファイルをクリックして選択、またはドラッグ＆ドロップ'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                .csv または .txt 形式の出荷資料ファイルをそのままアップロードできます
              </p>
            </div>
          </div>
        ) : (
          /* Direct Text Paste Mode UI */
          <div className="space-y-2">
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="ここにCSVテキストを貼り付けてください（例: 5DENTAL東京銀座,YOTARO ABE,260901-1,Vitamin C Inj.,7,...）"
              rows={7}
              className="w-full bg-slate-950 text-slate-200 border border-slate-800 rounded-xl p-3.5 font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-y placeholder:text-slate-600"
            />
            <div className="flex items-center justify-between text-xs text-slate-500 px-1">
              <span>{csvText ? `${csvText.split('\n').filter(Boolean).length} 行のデータが入力されています` : 'データ未入力'}</span>
              <button
                type="button"
                onClick={() => handleParseCsv()}
                disabled={!csvText.trim() || isParsing}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {isParsing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <PlayIcon className="w-3.5 h-3.5" />}
                <span>CSVを解析してデータ化</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Step 2: Parsed & Database Matched Review Section */}
      {parseResult && parseResult.allocations.length > 0 && (
        <div className="space-y-4">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-md">
              <span className="text-xs font-bold text-slate-400 block">作成インボイス数</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-white font-mono">{parseResult.totalShipments}</span>
                <span className="text-xs font-medium text-slate-400">通（全{parseResult.totalClinics}クリニック）</span>
              </div>
              <p className="text-[11px] text-emerald-400 mt-1 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                システム番号を自動割り当て完了
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-md">
              <span className="text-xs font-bold text-slate-400 block">合計出荷個数</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-blue-400 font-mono">{parseResult.totalQuantity}</span>
                <span className="text-xs font-medium text-slate-400">pcs ({parseResult.totalItemsCount}明細行)</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                複数品目のクリニックも正確に合算
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-md">
              <span className="text-xs font-bold text-slate-400 block">インボイス合計金額</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-emerald-400 font-mono">
                  {currency === 'JPY' ? '¥' : '$'} {parseResult.totalAmount.toLocaleString()}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                DB単価を参照して自動算出
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-md">
              <span className="text-xs font-bold text-slate-400 block">データベース照合状態</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className={`text-lg font-black font-mono ${parseResult.unmatchedClinicsCount === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {parseResult.totalClinics - parseResult.unmatchedClinicsCount} / {parseResult.totalClinics}
                </span>
                <span className="text-xs text-slate-400">院 DB照合完了</span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-[10px] text-slate-400">
                  {parseResult.unmatchedClinicsCount === 0 
                    ? '全クリニックの住所・医師名を取得済' 
                    : `${parseResult.unmatchedClinicsCount}件 未登録`}
                </span>
                {parseResult.unmatchedClinicsCount > 0 && (
                  <button
                    type="button"
                    onClick={handleSeedMastersToDb}
                    className="text-[10px] font-bold text-indigo-400 hover:underline cursor-pointer"
                  >
                    DBへ一括登録
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              {/* Select All Checkbox */}
              <button
                type="button"
                onClick={handleToggleSelectAll}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-2 cursor-pointer"
              >
                <div className={`w-4 h-4 rounded flex items-center justify-center border ${
                  selectedAllocIds.size === parseResult.allocations.length 
                    ? 'bg-blue-600 border-blue-600 text-white' 
                    : 'border-slate-600'
                }`}>
                  {selectedAllocIds.size === parseResult.allocations.length && <Check className="w-3 h-3" />}
                </div>
                <span>全選択 / 解除 ({selectedAllocIds.size}/{parseResult.allocations.length})</span>
              </button>

              {/* Search Filter */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="クリニック名・製剤で絞り込み..."
                  className="bg-slate-950 border border-slate-800 text-white pl-8 pr-3 py-1.5 rounded-lg text-xs outline-none focus:border-blue-500 w-48 sm:w-64"
                />
              </div>

              {/* Status Filter */}
              <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setFilterStatus('ALL')}
                  className={`px-2.5 py-1 rounded font-medium ${filterStatus === 'ALL' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400'}`}
                >
                  すべて ({parseResult.allocations.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterStatus('MATCHED')}
                  className={`px-2.5 py-1 rounded font-medium ${filterStatus === 'MATCHED' ? 'bg-emerald-950 text-emerald-300 font-bold' : 'text-slate-400'}`}
                >
                  照合済 ({parseResult.allocations.length - parseResult.unmatchedClinicsCount})
                </button>
                {parseResult.unmatchedClinicsCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setFilterStatus('WARNING')}
                    className={`px-2.5 py-1 rounded font-medium ${filterStatus === 'WARNING' ? 'bg-amber-950 text-amber-300 font-bold' : 'text-slate-400'}`}
                  >
                    未登録あり ({parseResult.unmatchedClinicsCount})
                  </button>
                )}
              </div>
            </div>

            {/* Primary Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* ZIP Export Button */}
              <button
                type="button"
                onClick={handleExportZip}
                disabled={isGeneratingZip || selectedShipments.length === 0}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-600/30 flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
              >
                {isGeneratingZip ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <FileArchive className="w-4 h-4" />
                )}
                <span>一括インボイスPDF出力 (ZIPダウンロード)</span>
              </button>

              {/* Save to Firestore DB Button */}
              <button
                type="button"
                onClick={handleSaveToDatabase}
                disabled={isSavingDb || selectedShipments.length === 0}
                className="px-3.5 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
              >
                {isSavingDb ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Database className="w-4 h-4" />
                )}
                <span>出荷履歴DBに一括登録・保存</span>
              </button>
            </div>
          </div>

          {/* Allocation Cards List */}
          <div className="space-y-3">
            {filteredAllocations.map((alloc, idx) => {
              const isSelected = selectedAllocIds.has(alloc.id);

              return (
                <div
                  key={alloc.id}
                  className={`bg-slate-900 border rounded-xl overflow-hidden transition-all shadow-md ${
                    isSelected ? 'border-slate-700 ring-1 ring-blue-500/20' : 'border-slate-800/80 opacity-70'
                  }`}
                >
                  {/* Allocation Header */}
                  <div className="bg-slate-950/60 p-3.5 border-b border-slate-800/80 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="flex items-start md:items-center gap-3">
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelectOne(alloc.id)}
                        className="w-4 h-4 mt-1 md:mt-0 rounded bg-slate-900 border-slate-700 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />

                      {/* Number Badge */}
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-bold">
                        #{idx + 1}
                      </span>

                      {/* Generated Invoice No */}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-white font-mono tracking-wider">
                            {alloc.systemGeneratedInvoiceNo}
                          </span>
                          <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">
                            システム自動採番（CSVのC列「{alloc.csvIgnoredInvoiceNo || '未指定'}」は無視）
                          </span>
                        </div>
                        <div className="text-xs font-bold text-slate-200 mt-0.5 flex items-center gap-1.5">
                          <span>{alloc.clinicNameCsv}</span>
                          {alloc.isDbMatched ? (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 font-bold flex items-center gap-1">
                              <ShieldCheck className="w-2.5 h-2.5" />
                              DB照合完了
                            </span>
                          ) : alloc.dbLookupSource === 'MASTER_PRESET' ? (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 font-bold">
                              マスタプリセット自動補完
                            </span>
                          ) : (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-400 border border-amber-500/20 font-bold">
                              未登録（仮データ）
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Recipient & Action buttons */}
                    <div className="flex items-center gap-4 text-xs">
                      {/* Recipient note */}
                      <div className="text-right hidden sm:block">
                        <div className="text-slate-400 text-[10px]">宛名（医師名）</div>
                        <div className="text-slate-200 font-bold font-mono">
                          {alloc.doctorNameEnFromDb}
                        </div>
                        <div className="text-[9px] text-slate-500">
                          DB参照（CSVのB列「{alloc.csvIgnoredRecipient || '未指定'}」は無視）
                        </div>
                      </div>

                      {/* Total */}
                      <div className="text-right pl-3 border-l border-slate-800">
                        <div className="text-slate-400 text-[10px]">インボイス合計</div>
                        <div className="text-sm font-black text-emerald-400 font-mono">
                          {currency === 'JPY' ? '¥' : '$'} {alloc.totalAmount.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">{alloc.totalQty} pcs</div>
                      </div>

                      {/* Preview Button */}
                      <button
                        type="button"
                        onClick={() => handlePreviewSingle(alloc)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
                        title="インボイスPDFプレビュー"
                      >
                        <Eye className="w-3.5 h-3.5 text-blue-400" />
                        <span>プレビュー</span>
                      </button>
                    </div>
                  </div>

                  {/* Items List Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950/40 text-slate-400 text-[10px] uppercase font-bold border-b border-slate-800/60">
                        <tr>
                          <th className="py-2 px-4">品目名（製剤）</th>
                          <th className="py-2 px-3">SKU</th>
                          <th className="py-2 px-3 text-right">個数 (F列)</th>
                          <th className="py-2 px-3 text-right">DB単価</th>
                          <th className="py-2 px-4 text-right">小計金額</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/40">
                        {alloc.items.map((it) => (
                          <tr key={it.id} className="hover:bg-slate-800/20 text-slate-300">
                            <td className="py-2.5 px-4">
                              <div className="font-bold text-white flex items-center gap-1.5">
                                <span>{it.nameEn}</span>
                                {it.isProductDbMatched ? (
                                  <span className="text-[9px] px-1 rounded bg-emerald-500/10 text-emerald-400">DB</span>
                                ) : (
                                  <span className="text-[9px] px-1 rounded bg-amber-500/10 text-amber-400">Preset</span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400">{it.nameJa}</div>
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-400 text-[11px]">
                              {it.sku}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-white text-xs">
                              {it.qty} <span className="text-[10px] font-normal text-slate-400">{it.unit}</span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-300 text-xs">
                              {currency === 'JPY' ? '¥' : '$'} {it.unitPrice.toLocaleString()}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-400 text-xs">
                              {currency === 'JPY' ? '¥' : '$'} {it.amount.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Single Invoice PDF Preview Modal */}
      {previewShipment && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-400" />
                  <span>インボイスPDFプレビュー: {previewShipment.invoiceNo}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  宛先: {previewShipment.clinicSnapshot?.nameEn || previewShipment.clinicSnapshot?.name}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {previewPdfUrl && (
                  <a
                    href={previewPdfUrl}
                    download={`${previewShipment.invoiceNo}_INVOICE.pdf`}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>このPDFをダウンロード</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={closePreviewModal}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body / PDF Iframe */}
            <div className="flex-1 bg-slate-950 p-2 overflow-hidden flex items-center justify-center min-h-[500px]">
              {previewPdfUrl ? (
                <iframe
                  src={previewPdfUrl}
                  title="PDF Preview"
                  className="w-full h-[600px] rounded-lg border border-slate-800"
                />
              ) : (
                <div className="text-slate-400 text-xs flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
                  <span>PDFプレビューを生成中...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce">
          <div className={`px-4 py-3 rounded-xl shadow-2xl text-xs font-bold flex items-center gap-2.5 border ${
            toast.type === 'success' 
              ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/50' 
              : toast.type === 'error'
              ? 'bg-rose-950/90 text-rose-200 border-rose-500/50'
              : 'bg-slate-900/90 text-white border-slate-700'
          }`}>
            {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
            {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400" />}
            {toast.type === 'info' && <Sparkles className="w-4 h-4 text-blue-400" />}
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function PlayIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

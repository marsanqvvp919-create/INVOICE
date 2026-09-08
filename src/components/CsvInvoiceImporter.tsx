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
  Truck,
  Edit3,
  MapPin,
  Phone,
  UserCheck,
  Info
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
  ParsedClinicAllocation,
  validateClinicInvoiceCompleteness,
  ClinicDataValidation
} from '../lib/csvInvoiceParser';
import { generateShipmentsZip, generateInvoicePDF } from '../lib/pdf';
import { SAMPLE_CLINICS_MASTER, SAMPLE_PRODUCTS_MASTER } from '../data/sampleClinicProductData';
import { db } from '../lib/firebase';
import { collection, writeBatch, doc, addDoc } from 'firebase/firestore';

interface CsvInvoiceImporterProps {
  clinics: Clinic[];
  products: Product[];
  warehouses: Warehouse[];
  settings: SystemSettings;
  onNavigateToShipments?: () => void;
  onRefreshMasters?: () => void;
  onAddClinic?: (clinic: Omit<Clinic, 'id' | 'createdAt'>) => Promise<string | void>;
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
  onRefreshMasters,
  onAddClinic
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
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'MATCHED' | 'WARNING' | 'INCOMPLETE'>('ALL');

  // Operation States
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [isGeneratingZip, setIsGeneratingZip] = useState<boolean>(false);
  const [isSavingDb, setIsSavingDb] = useState<boolean>(false);
  const [isSeedingMasters, setIsSeedingMasters] = useState<boolean>(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Manual Clinic Fill & Missing Clinic Resolution
  const [isManualModalOpen, setIsManualModalOpen] = useState<boolean>(false);
  const [manualTargetAlloc, setManualTargetAlloc] = useState<ParsedClinicAllocation | null>(null);
  const [isConfirmMasterOpen, setIsConfirmMasterOpen] = useState<boolean>(false);
  const [isSavingMaster, setIsSavingMaster] = useState<boolean>(false);

  // Manual Fill Form State
  const [manualForm, setManualForm] = useState<{
    name: string;
    nameEn: string;
    addressEn: string;
    doctorName: string;
    doctorNameEn: string;
    phone: string;
    zip: string;
    corporationName: string;
    contactPerson: string;
  }>({
    name: '',
    nameEn: '',
    addressEn: '',
    doctorName: '',
    doctorNameEn: '',
    phone: '',
    zip: '',
    corporationName: '',
    contactPerson: ''
  });

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
        return alloc.isDbMatched && !alloc.clinicValidation.isIncomplete && alloc.items.every(it => it.isProductDbMatched);
      }
      if (filterStatus === 'INCOMPLETE') {
        return alloc.clinicValidation.isIncomplete;
      }
      if (filterStatus === 'WARNING') {
        return !alloc.isDbMatched || alloc.clinicValidation.isIncomplete || alloc.items.some(it => !it.isProductDbMatched);
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

  // Open manual clinic fill modal
  const handleOpenManualModal = (alloc: ParsedClinicAllocation) => {
    setManualTargetAlloc(alloc);
    
    // Existing matched clinic or preset data
    const existing = alloc.matchedClinic;
    
    // Auto-generate candidate nameEn if none
    let defaultNameEn = existing?.nameEn || '';
    if (!defaultNameEn) {
      const isPureLatin = /^[a-zA-Z0-9\s&.,'-]+$/.test(alloc.clinicNameCsv);
      defaultNameEn = isPureLatin ? alloc.clinicNameCsv.toUpperCase() : '';
    }

    // Auto candidate for doctorNameEn:
    // If CSV Column B (csvIgnoredRecipient) has latin characters, suggest it (clean Dr.)
    let defaultDocEn = existing?.doctorNameEn || alloc.doctorNameEnFromDb || '';
    if (!defaultDocEn && alloc.csvIgnoredRecipient && /[a-zA-Z]/.test(alloc.csvIgnoredRecipient)) {
      defaultDocEn = alloc.csvIgnoredRecipient.replace(/^Dr\.?\s*/i, '').trim();
    }

    setManualForm({
      name: existing?.name || alloc.clinicNameCsv || '',
      nameEn: defaultNameEn,
      addressEn: existing?.addressEn || '',
      doctorName: existing?.doctorName || alloc.doctorNameJaFromDb || (alloc.csvIgnoredRecipient && !/[a-zA-Z]/.test(alloc.csvIgnoredRecipient) ? alloc.csvIgnoredRecipient : ''),
      doctorNameEn: defaultDocEn.replace(/^Dr\.?\s*/i, '').trim(),
      phone: existing?.phone || '',
      zip: existing?.zip || '',
      corporationName: existing?.corporationName || '',
      contactPerson: existing?.contactPerson || ''
    });

    setIsManualModalOpen(true);
  };

  // User clicked "Apply" in manual modal -> trigger confirm popup "Register to clinic master?"
  const handlePromptConfirmMaster = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualForm.name.trim()) {
      showToast('クリニック名（日本語）を入力してください。', 'error');
      return;
    }
    if (!manualForm.nameEn.trim()) {
      showToast('クリニック名（英語表記）を入力してください。', 'error');
      return;
    }
    if (!manualForm.addressEn.trim()) {
      showToast('英語住所（Address in English）を入力してください。', 'error');
      return;
    }
    if (!manualForm.doctorNameEn.trim()) {
      showToast('医師名（英語表記・Dr.不要）を入力してください。', 'error');
      return;
    }
    if (!manualForm.phone.trim()) {
      showToast('電話番号を入力してください。', 'error');
      return;
    }

    // Open confirm popup
    setIsConfirmMasterOpen(true);
  };

  // Final apply logic: either save to master (Firestore) or apply temporarily to this invoice
  const handleApplyAndSaveClinic = async (saveToMaster: boolean) => {
    if (!manualTargetAlloc) return;
    
    setIsSavingMaster(true);
    try {
      const cleanDoctorNameEn = (manualForm.doctorNameEn || '').replace(/^Dr\.?\s*/i, '').trim();
      const targetClinicName = manualTargetAlloc.clinicNameCsv;

      let resultingClinic: Clinic;

      if (saveToMaster) {
        // Save to Firestore clinics collection
        const clinicId = `CLN-${Date.now().toString().slice(-6)}`;
        const payload: Omit<Clinic, 'id'> = {
          clinicId,
          name: manualForm.name.trim() || targetClinicName,
          nameEn: manualForm.nameEn.trim() || manualForm.name.trim() || targetClinicName,
          corporationName: manualForm.corporationName.trim() || '',
          contactPerson: manualForm.contactPerson.trim() || '',
          doctorName: manualForm.doctorName.trim() || cleanDoctorNameEn,
          doctorNameEn: cleanDoctorNameEn,
          zip: manualForm.zip.trim() || '',
          prefecture: '',
          city: '',
          address: '',
          building: '',
          addressEn: manualForm.addressEn.trim(),
          phone: manualForm.phone.trim(),
          email: '',
          notes: 'CSVインボイス作成時の不足分手動入力により登録',
          active: true,
          createdAt: new Date().toISOString()
        };

        let newId = '';
        if (onAddClinic) {
          const res = await onAddClinic(payload);
          newId = typeof res === 'string' ? res : `cln_${Date.now()}`;
        } else {
          const docRef = await addDoc(collection(db, 'clinics'), payload);
          newId = docRef.id;
        }

        resultingClinic = { id: newId, ...payload };
        showToast(`クリニック「${manualForm.name}」をクリニックマスタに登録し、インボイスに反映しました！`, 'success');
        if (onRefreshMasters) onRefreshMasters();
      } else {
        // Temporary apply for this session without persisting to master
        resultingClinic = {
          id: `temp_${Date.now()}`,
          clinicId: `TEMP-${Date.now().toString().slice(-4)}`,
          name: manualForm.name.trim() || targetClinicName,
          nameEn: manualForm.nameEn.trim() || manualForm.name.trim() || targetClinicName,
          corporationName: manualForm.corporationName.trim() || '',
          contactPerson: manualForm.contactPerson.trim() || '',
          doctorName: manualForm.doctorName.trim() || cleanDoctorNameEn,
          doctorNameEn: cleanDoctorNameEn,
          zip: manualForm.zip.trim() || '',
          prefecture: '',
          city: '',
          address: '',
          building: '',
          addressEn: manualForm.addressEn.trim(),
          phone: manualForm.phone.trim(),
          email: '',
          notes: 'CSVインボイス手動補完（マスタ未登録）',
          active: true,
          createdAt: new Date().toISOString()
        };
        showToast(`今回のインボイスにのみ「${manualForm.name}」の不足情報を反映しました（マスタには未登録）。`, 'info');
      }

      // Update allocations in parseResult
      setParseResult(prev => {
        if (!prev) return null;
        const nextAllocations = prev.allocations.map(alloc => {
          // If matches target clinic name or ID, apply!
          if (alloc.clinicNameCsv.trim() === targetClinicName.trim() || alloc.id === manualTargetAlloc.id) {
            const clinicValidation = validateClinicInvoiceCompleteness(resultingClinic);
            const nextWarnings = alloc.warnings.filter(w => !w.includes('クリニック') && !w.includes('未登録') && !w.includes('データ不十分'));
            if (clinicValidation.isIncomplete) {
              nextWarnings.push(`【データ不十分】必須項目未入力: ${clinicValidation.missingFieldLabels.join('、')}`);
            }

            return {
              ...alloc,
              matchedClinic: resultingClinic,
              isDbMatched: true,
              dbLookupSource: saveToMaster ? ('FIRESTORE' as const) : ('MASTER_PRESET' as const),
              doctorNameEnFromDb: cleanDoctorNameEn,
              doctorNameJaFromDb: resultingClinic.doctorName,
              clinicValidation,
              warnings: nextWarnings
            };
          }
          return alloc;
        });

        const unmatchedCount = nextAllocations.filter(a => !a.isDbMatched).length;
        const incompleteCount = nextAllocations.filter(a => a.clinicValidation.isIncomplete).length;
        return {
          ...prev,
          allocations: nextAllocations,
          unmatchedClinicsCount: unmatchedCount,
          incompleteClinicsCount: incompleteCount
        };
      });

      setIsConfirmMasterOpen(false);
      setIsManualModalOpen(false);
      setManualTargetAlloc(null);
    } catch (e: any) {
      console.error('Error applying clinic:', e);
      showToast(`処理中にエラーが発生しました: ${e.message || '不明なエラー'}`, 'error');
    } finally {
      setIsSavingMaster(false);
    }
  };

  // Action: Export ZIP of all Invoices
  const handleExportZip = async () => {
    if (selectedShipments.length === 0) {
      showToast('出力対象のインボイスを選択してください。', 'error');
      return;
    }

    // Safety check for incomplete clinic data (クリニック名英語表記、医師名英語表記、電話番号、インボイス用英語住所)
    const incompleteSelected = parseResult?.allocations.filter(a => selectedAllocIds.has(a.id) && a.clinicValidation.isIncomplete) || [];
    if (incompleteSelected.length > 0) {
      const summaryList = incompleteSelected.slice(0, 5).map(a => 
        `・${a.clinicNameCsv}: 欠落 [${a.clinicValidation.missingFieldLabels.join('、')}]`
      ).join('\n');
      const moreMsg = incompleteSelected.length > 5 ? `\n...他 ${incompleteSelected.length - 5} 件` : '';

      const confirmProceed = window.confirm(
        `【警告：クリニックデータ不十分】\n` +
        `選択されたインボイスの中に、必須情報が欠けているクリニックが ${incompleteSelected.length} 件あります。\n\n` +
        `対象クリニック:\n${summaryList}${moreMsg}\n\n` +
        `※商業インボイスの税関申告・配送には以下の4項目がすべて必須です:\n` +
        `  ①クリニック名英語表記\n` +
        `  ②医師名英語表記（Dr.不要）\n` +
        `  ③電話番号\n` +
        `  ④インボイス用英語住所\n\n` +
        `欠落したまま出力すると税関保留や宛先不明の原因となる恐れがあります。\n` +
        `各行の「不足分を入力」ボタンから入力することを推奨します。\n\n` +
        `このままZIP出力を続行しますか？`
      );
      if (!confirmProceed) return;
    } else {
      // General unmatched check
      const unmatchedSelected = parseResult?.allocations.filter(a => selectedAllocIds.has(a.id) && !a.isDbMatched) || [];
      if (unmatchedSelected.length > 0) {
        const confirmProceed = window.confirm(
          `【ご注意】未登録のクリニックが ${unmatchedSelected.length} 件含まれています。\n` +
          `（例: ${unmatchedSelected[0].clinicNameCsv}）\n\n` +
          `このまま出力すると、インボイスの英語住所や医師名が仮の状態で作成されます。\n` +
          `「手作業で不足分を入力」ボタンから入力することを推奨します。\n\n` +
          `このままZIP出力を続行しますか？`
        );
        if (!confirmProceed) return;
      }
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

    // Safety check for incomplete clinic data (クリニック名英語表記、医師名英語表記、電話番号、インボイス用英語住所)
    const incompleteSelected = parseResult?.allocations.filter(a => selectedAllocIds.has(a.id) && a.clinicValidation.isIncomplete) || [];
    if (incompleteSelected.length > 0) {
      const summaryList = incompleteSelected.slice(0, 5).map(a => 
        `・${a.clinicNameCsv}: 欠落 [${a.clinicValidation.missingFieldLabels.join('、')}]`
      ).join('\n');
      const moreMsg = incompleteSelected.length > 5 ? `\n...他 ${incompleteSelected.length - 5} 件` : '';

      const confirmProceed = window.confirm(
        `【警告：クリニックデータ不十分】\n` +
        `選択されたインボイスの中に、必須情報が欠けているクリニックが ${incompleteSelected.length} 件あります。\n\n` +
        `対象クリニック:\n${summaryList}${moreMsg}\n\n` +
        `※出荷履歴DBに保存すると、不完全な宛先・医師名情報で登録されます。\n` +
        `不足データを手作業で入力してから保存することを推奨します。\n\n` +
        `このまま出荷履歴DBに保存しますか？`
      );
      if (!confirmProceed) return;
    } else {
      // General unmatched check
      const unmatchedSelected = parseResult?.allocations.filter(a => selectedAllocIds.has(a.id) && !a.isDbMatched) || [];
      if (unmatchedSelected.length > 0) {
        const confirmProceed = window.confirm(
          `【ご注意】未登録のクリニックが ${unmatchedSelected.length} 件含まれています。\n` +
          `（例: ${unmatchedSelected[0].clinicNameCsv}）\n\n` +
          `このまま保存すると出荷履歴の住所・医師名情報が不完全になります。\n` +
          `「手作業で不足分を入力」してから保存することを推奨します。\n\n` +
          `このまま出荷履歴DBに保存しますか？`
        );
        if (!confirmProceed) return;
      }
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
          {/* Insufficient Clinic Data Alert Banner (User requirement: alert if nameEn, doctorNameEn, phone, or addressEn is missing) */}
          {parseResult.incompleteClinicsCount > 0 && (
            <div className="bg-slate-900 border-2 border-rose-500 rounded-2xl p-4 sm:p-5 shadow-2xl relative overflow-hidden ring-4 ring-rose-500/10">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-rose-500 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-lg shadow-rose-500/30">
                    <AlertTriangle className="w-6 h-6 stroke-[2.5]" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h4 className="text-base font-black text-rose-400 tracking-wide">
                        【警告アラート】クリニックデータ不十分なインボイスが {parseResult.incompleteClinicsCount} 件あります
                      </h4>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-500 text-white shadow-sm">
                        必須4項目の入力が必要です
                      </span>
                    </div>

                    <p className="text-sm text-slate-200 leading-relaxed">
                      商業インボイス（海外向け輸出入・税関申告書類）を発行するには、以下の<strong className="text-white font-bold underline decoration-rose-500 underline-offset-2">4項目すべて</strong>が必要です。<br className="hidden sm:inline" />
                      いずれか1つでも欠けていると、通関時の保留や宛先不明配送トラブルの原因となります。
                    </p>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 pb-1">
                      <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800 text-[11px]">
                        <span className="text-slate-400 block font-medium">① クリニック名英語表記</span>
                        <span className="text-rose-400 font-bold">必須（TO: 宛先クリニック）</span>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800 text-[11px]">
                        <span className="text-slate-400 block font-medium">② 医師名英語表記</span>
                        <span className="text-rose-400 font-bold">必須（attn: 医師名・Dr.不要）</span>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800 text-[11px]">
                        <span className="text-slate-400 block font-medium">③ 電話番号</span>
                        <span className="text-rose-400 font-bold">必須（TEL: 配送連絡先）</span>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800 text-[11px]">
                        <span className="text-slate-400 block font-medium">④ インボイス用英語住所</span>
                        <span className="text-rose-400 font-bold">必須（Address: 配送先住所）</span>
                      </div>
                    </div>

                    {/* Quick Clinic Repair List */}
                    <div className="pt-2.5 border-t border-slate-800/80">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <span className="text-xs font-bold text-rose-300">
                          データ不十分なクリニック一覧（クリックして不足項目を入力）:
                        </span>
                        <button
                          type="button"
                          onClick={() => setFilterStatus('INCOMPLETE')}
                          className="text-xs font-bold text-rose-400 hover:text-rose-300 underline cursor-pointer"
                        >
                          不十分なクリニックのみ絞り込み表示 ({parseResult.incompleteClinicsCount}件)
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-2.5">
                        {Array.from(new Set(parseResult.allocations.filter(a => a.clinicValidation.isIncomplete).map(a => a.clinicNameCsv))).map(name => {
                          const targetAlloc = parseResult.allocations.find(a => a.clinicNameCsv === name);
                          const missingLabels = targetAlloc?.clinicValidation.missingFieldLabels || [];
                          return (
                            <button
                              key={name}
                              type="button"
                              onClick={() => targetAlloc && handleOpenManualModal(targetAlloc)}
                              className="px-3 py-1.5 rounded-xl text-xs bg-slate-950 hover:bg-slate-800 border-2 border-rose-500/70 hover:border-rose-400 flex items-center gap-2 transition-all cursor-pointer shadow-md hover:scale-[1.02] group"
                            >
                              <Building2 className="w-4 h-4 text-rose-400 shrink-0" />
                              <div className="text-left">
                                <span className="font-bold text-white block">{name}</span>
                                <span className="text-[10px] text-rose-300 font-normal">
                                  欠落: {missingLabels.join('・')}
                                </span>
                              </div>
                              <span className="ml-1 px-2 py-0.5 rounded-md bg-rose-500 group-hover:bg-rose-400 text-white font-black text-[11px] flex items-center gap-1 shadow-sm shrink-0">
                                <Edit3 className="w-3 h-3" />
                                不足分を入力
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Missing Clinics in DB Alert Banner */}
          {parseResult.unmatchedClinicsCount > 0 && (
            <div className="bg-slate-900 border-2 border-amber-500 rounded-2xl p-4 sm:p-5 shadow-2xl relative overflow-hidden">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 mt-0.5 shadow-md">
                    <AlertTriangle className="w-6 h-6 stroke-[2.5]" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h4 className="text-base font-black text-amber-400 tracking-wide">
                        【要確認】マスタに未登録のクリニックが {parseResult.unmatchedClinicsCount} 件あります
                      </h4>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-500 text-slate-950 shadow-sm">
                        マスタ登録推奨
                      </span>
                    </div>

                    <p className="text-sm text-slate-200 leading-relaxed">
                      インボイスを正常に発行するため、<strong className="text-white font-bold underline decoration-amber-500/80 underline-offset-2">英語住所・医師名（英語・Dr.不要）・電話番号</strong>などの不足情報を手作業で入力してください。<br className="hidden sm:inline" />
                      入力時に「クリニックマスタに登録」を選択すれば、自動でデータベースに保存され次回以降も照合されます。
                    </p>

                    {/* Unmatched Clinic Buttons List */}
                    <div className="pt-2.5 border-t border-slate-800/80">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-bold text-slate-300">未登録クリニック一覧（クリックして不足情報を入力）:</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2.5">
                        {Array.from(new Set(parseResult.allocations.filter(a => !a.isDbMatched).map(a => a.clinicNameCsv))).map(name => {
                          const targetAlloc = parseResult.allocations.find(a => a.clinicNameCsv === name);
                          return (
                            <button
                              key={name}
                              type="button"
                              onClick={() => targetAlloc && handleOpenManualModal(targetAlloc)}
                              className="px-3 py-1.5 rounded-xl text-xs bg-slate-950 hover:bg-slate-800 border-2 border-amber-500/70 hover:border-amber-400 flex items-center gap-2 transition-all cursor-pointer shadow-md hover:scale-[1.02] group"
                            >
                              <Building2 className="w-4 h-4 text-amber-400 shrink-0" />
                              <span className="font-bold text-white">{name}</span>
                              <span className="px-2 py-0.5 rounded-md bg-amber-500 group-hover:bg-amber-400 text-slate-950 font-black text-[11px] flex items-center gap-1 shadow-sm shrink-0">
                                <Edit3 className="w-3 h-3" />
                                不足分を入力
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

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
              <span className="text-xs font-bold text-slate-400 block">インボイス必須データ充足状態</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className={`text-lg font-black font-mono ${parseResult.incompleteClinicsCount === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {parseResult.totalClinics - parseResult.incompleteClinicsCount} / {parseResult.totalClinics}
                </span>
                <span className="text-xs text-slate-400">院 充足完了</span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className={`text-[10px] font-semibold ${parseResult.incompleteClinicsCount === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {parseResult.incompleteClinicsCount === 0 
                    ? '全クリニックの必須4項目充足済' 
                    : `⚠️ ${parseResult.incompleteClinicsCount}件 データ不十分`}
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
                  データ完備 ({parseResult.allocations.length - parseResult.incompleteClinicsCount})
                </button>
                {parseResult.incompleteClinicsCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setFilterStatus('INCOMPLETE')}
                    className={`px-2.5 py-1 rounded font-medium flex items-center gap-1.5 ${filterStatus === 'INCOMPLETE' ? 'bg-rose-500 text-white font-black' : 'text-rose-400 font-bold hover:bg-rose-500/10'}`}
                  >
                    <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
                    <span>データ不十分 ({parseResult.incompleteClinicsCount})</span>
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

              const clinicNameEnVal = alloc.matchedClinic?.nameEn || (alloc.clinicValidation?.hasNameEn ? alloc.clinicNameCsv : '');
              const doctorEnVal = alloc.doctorNameEnFromDb || alloc.matchedClinic?.doctorNameEn || '';
              const phoneVal = alloc.matchedClinic?.phone || '';
              const addressEnVal = alloc.matchedClinic?.addressEn || '';

              const isNameEnValid = Boolean(alloc.clinicValidation?.hasNameEn ?? (clinicNameEnVal && clinicNameEnVal.trim()));
              const isDoctorValid = Boolean(alloc.clinicValidation?.hasDoctorNameEn ?? (doctorEnVal && doctorEnVal.trim()));
              const isPhoneValid = Boolean(alloc.clinicValidation?.hasPhone ?? (phoneVal && phoneVal.trim()));
              const isAddressValid = Boolean(alloc.clinicValidation?.hasAddressEn ?? (addressEnVal && addressEnVal.trim()));

              const missingLabels: string[] = [];
              if (!isNameEnValid) missingLabels.push('クリニック名英語表記');
              if (!isDoctorValid) missingLabels.push('医師名英語表記');
              if (!isPhoneValid) missingLabels.push('電話番号');
              if (!isAddressValid) missingLabels.push('インボイス用英語住所');

              const isIncomplete = missingLabels.length > 0;

              return (
                <div
                  key={alloc.id}
                  className={`bg-slate-900 border rounded-xl overflow-hidden transition-all shadow-md ${
                    isIncomplete
                      ? 'border-rose-500 ring-2 ring-rose-500/30 shadow-lg shadow-rose-950/20'
                      : !alloc.isDbMatched 
                      ? 'border-amber-500/50 ring-1 ring-amber-500/20' 
                      : isSelected 
                      ? 'border-slate-700 ring-1 ring-blue-500/20' 
                      : 'border-slate-800/80 opacity-70'
                  }`}
                >
                  {/* Missing Clinic Urgent Alert Strip (Priority 1: Incomplete Invoice Data) */}
                  {isIncomplete ? (
                    <div className="bg-rose-500/20 border-b border-rose-500/40 px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 text-rose-300 font-bold">
                        <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                        <span>
                          【警告アラート】インボイス作成用データ不十分:
                          <span className="text-white font-black ml-1.5 underline decoration-rose-400">
                            {missingLabels.join('、')}
                          </span>
                          が欠けています
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleOpenManualModal(alloc)}
                        className="px-3 py-1 rounded-lg bg-rose-500 hover:bg-rose-400 text-white font-black text-xs flex items-center gap-1.5 transition-all shadow-md shadow-rose-500/30 shrink-0 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>不足分を入力して解消</span>
                      </button>
                    </div>
                  ) : !alloc.isDbMatched ? (
                    <div className="bg-amber-500/15 border-b border-amber-500/30 px-3.5 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 text-amber-300 font-bold">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>クリニックマスタ未登録：英語住所・医師名などの情報をご確認ください</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleOpenManualModal(alloc)}
                        className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 transition-all shadow-md shadow-amber-500/20 shrink-0 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>手作業で不足分を入力</span>
                      </button>
                    </div>
                  ) : null}

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
                        <div className="text-xs font-bold text-slate-200 mt-0.5 flex flex-wrap items-center gap-1.5">
                          <span>{alloc.clinicNameCsv}</span>
                          {isIncomplete ? (
                            <span className="text-[9px] px-2 py-0.5 rounded bg-rose-500/25 text-rose-300 border border-rose-500/50 font-black flex items-center gap-1 shadow-xs">
                              <AlertTriangle className="w-3 h-3 text-rose-400" />
                              データ不十分 ({missingLabels.join('・')} 欠落)
                            </span>
                          ) : alloc.isDbMatched ? (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 font-bold flex items-center gap-1">
                              <ShieldCheck className="w-2.5 h-2.5" />
                              必須4項目完備
                            </span>
                          ) : alloc.dbLookupSource === 'MASTER_PRESET' ? (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 font-bold">
                              マスタプリセット自動補完
                            </span>
                          ) : (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/20 font-bold flex items-center gap-1">
                              <AlertCircle className="w-2.5 h-2.5" />
                              マスタ未登録
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Recipient & Action buttons */}
                    <div className="flex items-center gap-3 sm:gap-4 text-xs">
                      {/* Recipient note */}
                      <div className="text-right hidden sm:block">
                        <div className="text-slate-400 text-[10px]">宛名（医師名）</div>
                        <div className={`font-bold font-mono ${isDoctorValid ? 'text-slate-200' : 'text-rose-400 font-black'}`}>
                          {doctorEnVal || '⚠️ 未入力'}
                        </div>
                        <div className="text-[9px] text-slate-500">
                          {alloc.isDbMatched ? 'マスタ/手動入力参照' : `CSV B列「${alloc.csvIgnoredRecipient || '未指定'}」は無視`}
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

                      {/* Manual Fill / Edit Button */}
                      <button
                        type="button"
                        onClick={() => handleOpenManualModal(alloc)}
                        className={`px-2.5 py-1.5 rounded-lg border flex items-center gap-1.5 text-xs font-semibold cursor-pointer transition-all ${
                          isIncomplete
                            ? 'bg-rose-600 hover:bg-rose-500 text-white font-bold border-rose-500 shadow-sm shadow-rose-600/30'
                            : !alloc.isDbMatched 
                            ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold border-amber-400 shadow-sm shadow-amber-500/20' 
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700'
                        }`}
                        title="クリニック必須情報の入力・修正"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>{isIncomplete ? '不足分を入力' : alloc.isDbMatched ? '情報修正' : '不足分入力'}</span>
                      </button>

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

                  {/* 4 Required Fields Verification Row */}
                  <div className="bg-slate-950/80 px-3.5 py-2 border-b border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-[11px]">
                    {/* Field 1: Clinic Name En */}
                    <div className={`p-1.5 px-2 rounded-lg border flex items-center justify-between gap-2 ${
                      isNameEnValid ? 'bg-slate-900/90 border-slate-800 text-slate-300' : 'bg-rose-950/40 border-rose-500/60 text-rose-200'
                    }`}>
                      <div className="truncate min-w-0">
                        <span className="text-[9px] text-slate-400 block font-medium">① 英語クリニック名</span>
                        <span className={`font-mono font-bold truncate block ${isNameEnValid ? 'text-white' : 'text-rose-300'}`}>
                          {clinicNameEnVal || alloc.clinicNameCsv || '⚠️ 未入力'}
                        </span>
                      </div>
                      {isNameEnValid ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <span className="px-1.5 py-0.5 rounded bg-rose-500 text-white font-black text-[9px] shrink-0">欠落</span>
                      )}
                    </div>

                    {/* Field 2: Doctor Name En */}
                    <div className={`p-1.5 px-2 rounded-lg border flex items-center justify-between gap-2 ${
                      isDoctorValid ? 'bg-slate-900/90 border-slate-800 text-slate-300' : 'bg-rose-950/40 border-rose-500/60 text-rose-200'
                    }`}>
                      <div className="truncate min-w-0">
                        <span className="text-[9px] text-slate-400 block font-medium">② 医師名（英語・Dr.不要）</span>
                        <span className={`font-mono font-bold truncate block ${isDoctorValid ? 'text-white' : 'text-rose-300'}`}>
                          {doctorEnVal || '⚠️ 未入力'}
                        </span>
                      </div>
                      {isDoctorValid ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <span className="px-1.5 py-0.5 rounded bg-rose-500 text-white font-black text-[9px] shrink-0">欠落</span>
                      )}
                    </div>

                    {/* Field 3: Phone */}
                    <div className={`p-1.5 px-2 rounded-lg border flex items-center justify-between gap-2 ${
                      isPhoneValid ? 'bg-slate-900/90 border-slate-800 text-slate-300' : 'bg-rose-950/40 border-rose-500/60 text-rose-200'
                    }`}>
                      <div className="truncate min-w-0">
                        <span className="text-[9px] text-slate-400 block font-medium">③ 電話番号</span>
                        <span className={`font-mono font-bold truncate block ${isPhoneValid ? 'text-white' : 'text-rose-300'}`}>
                          {phoneVal || '⚠️ 未入力'}
                        </span>
                      </div>
                      {isPhoneValid ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <span className="px-1.5 py-0.5 rounded bg-rose-500 text-white font-black text-[9px] shrink-0">欠落</span>
                      )}
                    </div>

                    {/* Field 4: Address En */}
                    <div className={`p-1.5 px-2 rounded-lg border flex items-center justify-between gap-2 ${
                      isAddressValid ? 'bg-slate-900/90 border-slate-800 text-slate-300' : 'bg-rose-950/40 border-rose-500/60 text-rose-200'
                    }`}>
                      <div className="truncate min-w-0">
                        <span className="text-[9px] text-slate-400 block font-medium">④ インボイス用英語住所</span>
                        <span className={`font-mono font-bold truncate block ${isAddressValid ? 'text-white' : 'text-rose-300'}`} title={addressEnVal}>
                          {addressEnVal || '⚠️ 未入力'}
                        </span>
                      </div>
                      {isAddressValid ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <span className="px-1.5 py-0.5 rounded bg-rose-500 text-white font-black text-[9px] shrink-0">欠落</span>
                      )}
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

            {/* Single Invoice PDF Preview Incomplete Warning */}
            {(() => {
              const val = validateClinicInvoiceCompleteness(previewShipment.clinicSnapshot);
              if (val.isIncomplete) {
                return (
                  <div className="bg-rose-500/20 border-b border-rose-500/40 px-5 py-2.5 flex items-center justify-between gap-3 text-xs text-rose-300">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>
                        【警告】インボイス必須項目が欠落しています: 
                        <strong className="text-white font-bold ml-1">{val.missingFieldLabels.join('、')}</strong>
                      </span>
                    </div>
                    <span className="text-[11px] text-rose-200">※通関時に保留されるリスクがあります</span>
                  </div>
                );
              }
              return null;
            })()}

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

      {/* Manual Clinic Information Input Modal */}
      {isManualModalOpen && manualTargetAlloc && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>クリニック不足情報の入力・手動補完</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                      未登録補完
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    インボイス印字に必要な英語住所・医師名などの不足情報を入力してください
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsManualModalOpen(false);
                  setManualTargetAlloc(null);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handlePromptConfirmMaster} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              {/* Insufficient Data Alert in Modal */}
              {manualTargetAlloc.clinicValidation.isIncomplete && (
                <div className="p-3.5 rounded-xl bg-rose-500/15 border-2 border-rose-500/40 text-rose-300 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <div className="font-bold text-rose-200 flex items-center gap-1.5">
                      <span className="text-sm font-black">【データ不十分アラート】</span>
                      <span>海外インボイス必須項目が欠けています</span>
                    </div>
                    <p className="text-white font-medium">
                      未入力の項目: <strong className="underline decoration-rose-400 text-rose-200 font-mono font-bold">【{manualTargetAlloc.clinicValidation.missingFieldLabels.join('、')}】</strong>
                    </p>
                    <p className="text-[11px] text-rose-300 leading-normal">
                      ※商業インボイスの作成には「クリニック名英語表記」「医師名英語表記（Dr.不要）」「電話番号」「英語住所」の4項目がすべて必須です。
                    </p>
                  </div>
                </div>
              )}

              {/* CSV Raw Context Information Notice */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider">CSV記載のクリニック名 (A列)</span>
                  <p className="text-xs font-bold text-white font-mono mt-0.5">{manualTargetAlloc.clinicNameCsv}</p>
                </div>
                {manualTargetAlloc.csvIgnoredRecipient && (
                  <div className="border-t sm:border-t-0 sm:border-l border-slate-800 pt-2 sm:pt-0 sm:pl-3 flex items-center justify-between sm:justify-start gap-2">
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider">CSV記載の受取人 (B列)</span>
                      <p className="text-xs font-bold text-slate-300 font-mono mt-0.5">{manualTargetAlloc.csvIgnoredRecipient}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const clean = manualTargetAlloc.csvIgnoredRecipient.replace(/^Dr\.?\s*/i, '').trim();
                        setManualForm(prev => ({
                          ...prev,
                          doctorNameEn: clean
                        }));
                        showToast(`医師名（英語）に「${clean}」をコピーしました`, 'info');
                      }}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-blue-400 text-[10px] font-bold border border-slate-700 cursor-pointer transition-colors"
                      title="医師名（英語）にコピー"
                    >
                      英語名にコピー
                    </button>
                  </div>
                )}
              </div>

              {/* Form Fields Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Clinic Name (Japanese) */}
                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    クリニック名（日本語） <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={manualForm.name}
                    onChange={(e) => setManualForm({ ...manualForm, name: e.target.value })}
                    placeholder="例: 5DENTAL東京銀座"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white placeholder:text-slate-600 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Clinic Name (English) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-300 font-bold flex items-center gap-1.5">
                      <span>クリニック名（英語表記）</span>
                      <span className="text-rose-400">*</span>
                      {!manualForm.nameEn.trim() ? (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold">必須・未入力</span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold">充足</span>
                      )}
                    </label>
                    <button
                      type="button"
                      onClick={() => setManualForm(prev => ({ ...prev, nameEn: prev.nameEn.toUpperCase() }))}
                      className="text-[10px] text-blue-400 hover:underline font-bold"
                    >
                      大文字化 (UPPERCASE)
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={manualForm.nameEn}
                    onChange={(e) => setManualForm({ ...manualForm, nameEn: e.target.value })}
                    placeholder="例: 5DENTAL TOKYO GINZA"
                    className={`w-full bg-slate-950 border rounded-lg px-3 py-2 text-white placeholder:text-slate-600 outline-none focus:ring-1 focus:ring-blue-500 font-mono uppercase ${
                      !manualForm.nameEn.trim() ? 'border-rose-500/80 focus:border-rose-500' : 'border-slate-800 focus:border-blue-500'
                    }`}
                  />
                </div>
              </div>

              {/* English Address (Full Width) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-bold flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-blue-400" />
                    <span>英語住所（Address in English）</span>
                    <span className="text-rose-400">*</span>
                    {!manualForm.addressEn.trim() ? (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold">必須・未入力</span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold">充足</span>
                    )}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (!manualForm.addressEn) {
                        setManualForm(prev => ({
                          ...prev,
                          addressEn: '3F Ginza Medical Bldg, 5-1-1 Ginza, Chuo-ku, Tokyo 104-0061, Japan'
                        }));
                      }
                    }}
                    className="text-[10px] text-slate-400 hover:text-blue-400 underline"
                  >
                    サンプル住所を挿入
                  </button>
                </div>
                <textarea
                  required
                  rows={2}
                  value={manualForm.addressEn}
                  onChange={(e) => setManualForm({ ...manualForm, addressEn: e.target.value })}
                  placeholder="例: 3F Ginza Medical Bldg, 5-1-1 Ginza, Chuo-ku, Tokyo 104-0061, Japan"
                  className={`w-full bg-slate-950 border rounded-lg px-3 py-2 text-white placeholder:text-slate-600 outline-none focus:ring-1 focus:ring-blue-500 font-mono ${
                    !manualForm.addressEn.trim() ? 'border-rose-500/80 focus:border-rose-500' : 'border-slate-800 focus:border-blue-500'
                  }`}
                />
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  ※インボイスPDFの宛先住所に直接印字されます（ビル名・番地・市区町村・国名）
                </span>
              </div>

              {/* Doctor Names Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Doctor Name (English) - Dr. excluded */}
                <div>
                  <label className="block text-slate-300 font-bold mb-1 flex items-center gap-1.5">
                    <span>医師名（英語表記）</span>
                    <span className="text-rose-400">*</span>
                    {!manualForm.doctorNameEn.trim() ? (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold">必須・未入力</span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold">充足</span>
                    )}
                  </label>
                  <input
                    type="text"
                    required
                    value={manualForm.doctorNameEn}
                    onChange={(e) => {
                      // Automatically strip Dr. prefix if user types it
                      const sanitized = e.target.value.replace(/^Dr\.?\s*/i, '');
                      setManualForm({ ...manualForm, doctorNameEn: sanitized });
                    }}
                    placeholder="例: TARO YAMADA （Dr.不要）"
                    className={`w-full bg-slate-950 border rounded-lg px-3 py-2 text-white placeholder:text-slate-600 outline-none focus:ring-1 focus:ring-blue-500 font-mono uppercase ${
                      !manualForm.doctorNameEn.trim() ? 'border-rose-500/80 focus:border-rose-500' : 'border-slate-800 focus:border-blue-500'
                    }`}
                  />
                  <span className="text-[10px] text-amber-400 block mt-0.5 font-medium">
                    ※「Dr.」の入力は不要です（入力された場合も自動で除去されます）
                  </span>
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-slate-300 font-bold mb-1 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-blue-400" />
                    <span>電話番号（Phone）</span>
                    <span className="text-rose-400">*</span>
                    {!manualForm.phone.trim() ? (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold">必須・未入力</span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold">充足</span>
                    )}
                  </label>
                  <input
                    type="text"
                    required
                    value={manualForm.phone}
                    onChange={(e) => setManualForm({ ...manualForm, phone: e.target.value })}
                    placeholder="例: 03-1234-5678"
                    className={`w-full bg-slate-950 border rounded-lg px-3 py-2 text-white placeholder:text-slate-600 outline-none focus:ring-1 focus:ring-blue-500 font-mono ${
                      !manualForm.phone.trim() ? 'border-rose-500/80 focus:border-rose-500' : 'border-slate-800 focus:border-blue-500'
                    }`}
                  />
                </div>
              </div>

              {/* Optional Fields Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-800/80">
                {/* Doctor Name (Japanese) */}
                <div>
                  <label className="block text-slate-400 text-[11px] font-medium mb-1">
                    医師名（日本語 / 任意）
                  </label>
                  <input
                    type="text"
                    value={manualForm.doctorName}
                    onChange={(e) => setManualForm({ ...manualForm, doctorName: e.target.value })}
                    placeholder="例: 山田 太郎"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-white placeholder:text-slate-600 outline-none focus:border-blue-500"
                  />
                </div>

                {/* Zip Code */}
                <div>
                  <label className="block text-slate-400 text-[11px] font-medium mb-1">
                    郵便番号（任意）
                  </label>
                  <input
                    type="text"
                    value={manualForm.zip}
                    onChange={(e) => setManualForm({ ...manualForm, zip: e.target.value })}
                    placeholder="例: 104-0061"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-white placeholder:text-slate-600 outline-none focus:border-blue-500 font-mono"
                  />
                </div>

                {/* Corporation Name */}
                <div>
                  <label className="block text-slate-400 text-[11px] font-medium mb-1">
                    法人名（任意）
                  </label>
                  <input
                    type="text"
                    value={manualForm.corporationName}
                    onChange={(e) => setManualForm({ ...manualForm, corporationName: e.target.value })}
                    placeholder="例: 医療法人社団○○会"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-white placeholder:text-slate-600 outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsManualModalOpen(false);
                    setManualTargetAlloc(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-600/30 flex items-center gap-2 cursor-pointer transition-all"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>入力内容をインボイスに反映する</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* "Register to Clinic Master?" Confirmation Popup */}
      {isConfirmMasterOpen && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
                <Database className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">クリニックマスタへの登録確認</h4>
                <p className="text-xs text-slate-400">マスタ登録を行うか選択してください</p>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 mb-5 space-y-1.5 text-xs">
              <p className="text-slate-300">
                入力されたクリニック「<strong className="text-white font-bold">{manualForm.name}</strong>」の情報を、クリニックマスタに登録しますか？
              </p>
              <div className="text-[11px] text-slate-400 pt-1.5 border-t border-slate-800 space-y-1 font-mono">
                <div>英語名: {manualForm.nameEn}</div>
                <div>医師名: {manualForm.doctorNameEn}</div>
                <div>電話番号: {manualForm.phone}</div>
              </div>
            </div>

            <div className="space-y-2.5">
              {/* Option 1: Yes, Register to Master */}
              <button
                type="button"
                disabled={isSavingMaster}
                onClick={() => handleApplyAndSaveClinic(true)}
                className="w-full py-3 px-4 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
              >
                {isSavingMaster ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>はい（クリニックマスタに登録してインボイス作成）</span>
              </button>
              <p className="text-[10px] text-slate-400 text-center">
                ※マスタに保存され、今後のCSV取込でも自動で住所・医師名が照合されます
              </p>

              {/* Option 2: No, Apply temporarily for this invoice only */}
              <button
                type="button"
                disabled={isSavingMaster}
                onClick={() => handleApplyAndSaveClinic(false)}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
              >
                <span>いいえ（今回のみ一時適用してインボイス作成）</span>
              </button>

              {/* Cancel */}
              <button
                type="button"
                disabled={isSavingMaster}
                onClick={() => setIsConfirmMasterOpen(false)}
                className="w-full py-2 text-xs text-slate-500 hover:text-slate-300 cursor-pointer transition-colors"
              >
                戻る（入力画面を再編集）
              </button>
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

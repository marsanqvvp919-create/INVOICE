import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  setDoc, 
  getDocs,
  runTransaction,
  writeBatch
} from 'firebase/firestore';
import { db } from './lib/firebase';
import { 
  Product, 
  Clinic, 
  Warehouse, 
  InventoryLot, 
  InventoryTransaction, 
  Shipment, 
  AuditLog, 
  SystemSettings as SettingsType, 
  User, 
  UserRole,
  Supplier
} from './types';

// Component Imports
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import ShipmentAllocation from './components/ShipmentAllocation';
import BulkAllocation from './components/BulkAllocation';
import ShipmentHistory from './components/ShipmentHistory';
import StockInput from './components/StockInput';
import ClinicMaster from './components/ClinicMaster';
import ProductMaster from './components/ProductMaster';
import WarehouseMaster from './components/WarehouseMaster';
import SupplierMaster from './components/SupplierMaster';
import StockManagement from './components/StockManagement';
import SystemSettings from './components/SystemSettings';
import AuditLogs from './components/AuditLogs';
import { loadJapaneseFont } from './lib/pdf';

// Static default user context for audits/created-by fields
const currentUser: User = { uid: 'system', name: 'システム管理者', email: 'system@example.com', role: 'ADMIN' };

const DEFAULT_SETTINGS: SettingsType = {
  prefix: 'INV-',
  currency: 'JPY',
  defaultWarehouseId: '',
  declaration: 'We hereby certify that the information contained in this invoice is true and correct and that the contents of this shipment are as stated above.',
  termsOfDelivery: 'DAP (Delivered at Place)',
  reasonForExport: 'Commercial Sample / Gift',
  minStockWarning: true,
  weightUnit: 'kg',
  dateFormat: 'YYYY-MM-DD',
  decimalPlaces: 2,
  companyLogo: 'https://images.unsplash.com/photo-1557200134-90327ee9fafa?q=80&w=300&auto=format&fit=crop',
  signatureImage: ''
};

export default function App() {
  // Navigation state
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isInitializing, setIsInitializing] = useState(true);

  // Firestore Realtime Collections States
  const [products, setProducts] = useState<Product[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [lots, setLots] = useState<InventoryLot[]>([]);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [settings, setSettings] = useState<SettingsType>(DEFAULT_SETTINGS);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // Buffer state to pass duplicate to allocation tab
  const [duplicatePayload, setDuplicatePayload] = useState<any | null>(null);
  const [hasMigrated, setHasMigrated] = useState(false);

  // Subscriptions
  useEffect(() => {
    // Load Japanese font in background for PDF generation
    loadJapaneseFont().catch(err => console.warn("Could not load Japanese font background:", err));

    const unsubProducts = onSnapshot(collection(db, 'products'), (snap) => {
      const list: Product[] = [];
      snap.forEach(doc => list.push({ id: doc.id, ...doc.data() } as Product));
      setProducts(list.sort((a, b) => (a.sku || '').localeCompare(b.sku || '')));
    });

    const unsubClinics = onSnapshot(collection(db, 'clinics'), (snap) => {
      const list: Clinic[] = [];
      snap.forEach(doc => list.push({ id: doc.id, ...doc.data() } as Clinic));
      setClinics(list.sort((a, b) => (a.name || '').localeCompare(b.name || '')));
    });

    const unsubWarehouses = onSnapshot(collection(db, 'warehouses'), (snap) => {
      const list: Warehouse[] = [];
      snap.forEach(doc => list.push({ id: doc.id, ...doc.data() } as Warehouse));
      setWarehouses(list.sort((a, b) => (a.name || '').localeCompare(b.name || '')));
    });

    const unsubLots = onSnapshot(collection(db, 'inventoryLots'), (snap) => {
      const list: InventoryLot[] = [];
      snap.forEach(doc => list.push({ id: doc.id, ...doc.data() } as InventoryLot));
      setLots(list);
    });

    const unsubTx = onSnapshot(collection(db, 'inventoryTransactions'), (snap) => {
      const list: InventoryTransaction[] = [];
      snap.forEach(doc => list.push({ id: doc.id, ...doc.data() } as InventoryTransaction));
      setTransactions(list.sort((a, b) => (b.date || b.createdAt || '').localeCompare(a.date || a.createdAt || '')));
    });

    const unsubShipments = onSnapshot(collection(db, 'shipments'), (snap) => {
      const list: Shipment[] = [];
      snap.forEach(doc => list.push({ id: doc.id, ...doc.data() } as Shipment));
      setShipments(list.sort((a, b) => (b.date || b.createdAt || '').localeCompare(a.date || a.createdAt || '')));
    });

    const unsubAudit = onSnapshot(collection(db, 'auditLogs'), (snap) => {
      const list: AuditLog[] = [];
      snap.forEach(doc => list.push({ id: doc.id, ...doc.data() } as AuditLog));
      setAuditLogs(list.sort((a, b) => (b.date || '').localeCompare(a.date || '')));
    });

    const unsubSuppliers = onSnapshot(collection(db, 'suppliers'), (snap) => {
      const list: Supplier[] = [];
      snap.forEach(doc => list.push({ id: doc.id, ...doc.data() } as Supplier));
      setSuppliers(list.sort((a, b) => (a.supplierId || a.name || '').localeCompare(b.supplierId || b.name || '')));
    });

    const unsubSettings = onSnapshot(doc(db, 'systemSettings', 'default'), (docSnap) => {
      if (docSnap.exists()) {
        setSettings(docSnap.data() as SettingsType);
      } else {
        // write defaults if not exist
        setDoc(doc(db, 'systemSettings', 'default'), DEFAULT_SETTINGS);
      }
      setIsInitializing(false);
    });

    return () => {
      unsubProducts();
      unsubClinics();
      unsubWarehouses();
      unsubLots();
      unsubTx();
      unsubShipments();
      unsubAudit();
      unsubSuppliers();
      unsubSettings();
    };
  }, []);

  // Auto-migration/sync for default warehouse
  useEffect(() => {
    if (isInitializing || warehouses.length === 0 || hasMigrated) return;

    const runMigration = async () => {
      setHasMigrated(true); // Prevent re-running during the same session

      // Check if a default warehouse already exists in settings or warehouses
      const existingDefault = warehouses.find(w => w.id === settings.defaultWarehouseId) || warehouses.find(w => w.isDefault);
      
      if (!existingDefault) {
        // Only set default if no warehouse is currently set as default
        const targetW = warehouses.find(w => (w.warehouseId || (w as any).code) === 'IC-IFZL') || warehouses[0];
        if (targetW) {
          await updateDoc(doc(db, 'warehouses', targetW.id), { isDefault: true });
          await setDoc(doc(db, 'systemSettings', 'default'), { defaultWarehouseId: targetW.id }, { merge: true });
          setSettings(prev => ({ ...prev, defaultWarehouseId: targetW.id }));
        }
      }
    };

    runMigration().catch(err => console.error('Migration error:', err));
  }, [isInitializing, warehouses, hasMigrated, settings.defaultWarehouseId]);

  // Quick seed database if completely empty
  const handleSeedDatabase = async () => {
    setIsInitializing(true);
    try {
      const batch = writeBatch(db);

      // Seed default warehouses
      const w1Ref = doc(collection(db, 'warehouses'));
      const w2Ref = doc(collection(db, 'warehouses'));
      batch.set(w1Ref, { warehouseId: 'SL-GANG', name: 'ソウル江南センター', nameEn: 'Seoul Gangnam Center', code: 'SL-GANG', address: '大韓民国ソウル特別市江南区テヘラン路123', addressEn: '123 Teheran-ro, Gangnam-gu, Seoul, South Korea', phone: '+82-2-555-1234', isDefault: false, active: true });
      batch.set(w2Ref, { warehouseId: 'IC-IFZL', name: 'ナンバーワン', nameEn: 'No1 LLC', code: 'IC-IFZL', address: '大韓民国ソウル特別市九老区デジタル路26ギル5', addressEn: '5 Digital-ro 26-gil, Guro District, Seoul, South Korea', phone: '+82-10-7237-7260', isDefault: true, active: true, country: 'South Korea', zip: '', contactPerson: '' });

      // Seed initial products
      const p1Ref = doc(collection(db, 'products'));
      const p2Ref = doc(collection(db, 'products'));
      const p3Ref = doc(collection(db, 'products'));
      batch.set(p1Ref, { sku: 'BTLX-100', nameJa: 'ボツラックス 100U', nameEn: 'BOTULAX 100U', invoicePrice: 42.50, purchasePrice: 28.00, purchaseCurrency: 'USD', weight: 0.035, hsCode: '3002.90.3000', countryOfOrigin: 'South Korea', unit: 'vials', currentStock: 250, minStock: 50, lotNo: 'BTL-2026A', expiryDate: '2027-06-30', active: true });
      batch.set(p2Ref, { sku: 'WSTX-050', nameJa: 'ウェルストックス 50U', nameEn: 'WELLSTOX 50U', invoicePrice: 35.00, purchasePrice: 20.00, purchaseCurrency: 'USD', weight: 0.030, hsCode: '3002.90.3000', countryOfOrigin: 'South Korea', unit: 'vials', currentStock: 180, minStock: 40, lotNo: 'WST-050-01', expiryDate: '2026-12-15', active: true });
      batch.set(p3Ref, { sku: 'WSTX-100', nameJa: 'ウェルストックス 100U', nameEn: 'WELLSTOX 100U', invoicePrice: 58.00, purchasePrice: 35.00, purchaseCurrency: 'USD', weight: 0.035, hsCode: '3002.90.3000', countryOfOrigin: 'South Korea', unit: 'vials', currentStock: 300, minStock: 60, lotNo: 'WST-100-02', expiryDate: '2027-03-20', active: true });

      // Seed initial clinics
      const c1Ref = doc(collection(db, 'clinics'));
      const c2Ref = doc(collection(db, 'clinics'));
      const c3Ref = doc(collection(db, 'clinics'));
      batch.set(c1Ref, { clinicId: 'SBC-TYO', name: '品川美容外科 東京本院', nameEn: 'Shinagawa Beauty Clinic Tokyo', contactPerson: '田中 太郎', contactPersonEn: 'Taro Tanaka', doctorName: '佐藤 茂', doctorNameEn: 'Dr. Shigeru Sato', zip: '108-0075', prefecture: '東京都', city: '港区', address: '港南2丁目15番2号 品川インターシティB棟', addressEn: 'B-Block, Shinagawa Intercity, 2-15-2 Konan, Minato-ku, Tokyo, Japan', phone: '03-1234-5678', email: 'tyo-h@shinagawa.co.jp', active: true, notes: '東京本社' });
      batch.set(c2Ref, { clinicId: 'SBC-SJK', name: '湘南美容クリニック 新宿本院', nameEn: 'Shonan Beauty Clinic Shinjuku', contactPerson: '佐藤 恵', contactPersonEn: 'Megumi Sato', doctorName: '相川 佳之', doctorNameEn: 'Dr. Yoshiyuki Aikawa', zip: '163-1324', prefecture: '東京都', city: '新宿区', address: '西新宿6-5-1 新宿アイランドタワー24F', addressEn: '24F Shinjuku Island Tower, 6-5-1 Nishi-Shinjuku, Shinjuku-ku, Tokyo, Japan', phone: '03-8765-4321', email: 'shinjuku@sbc.co.jp', active: true, notes: '新宿本店' });
      batch.set(c3Ref, { clinicId: 'GNL-OSK', name: 'グナル美容外科 大阪梅田院', nameEn: 'Gunal Clinic Osaka Umeda', contactPerson: '鈴木 一郎', contactPersonEn: 'Ichiro Suzuki', doctorName: 'グナル チョル', doctorNameEn: 'Dr. Chul Gunal', zip: '530-0001', prefecture: '大阪府', city: '大阪市北区', address: '梅田1丁目2番3号', addressEn: '1-2-3 Umeda, Kita-ku, Osaka, Japan', phone: '06-4444-5555', email: 'umeda@gunal-clinic.jp', active: true, notes: '大阪梅田院' });

      // Seed initial lots for FEFO testing (now placed in w2Ref/IC-IFZL as the default)
      const lot1Ref = doc(collection(db, 'inventoryLots'));
      const lot2Ref = doc(collection(db, 'inventoryLots'));
      const lot3Ref = doc(collection(db, 'inventoryLots'));
      const lot4Ref = doc(collection(db, 'inventoryLots'));
      batch.set(lot1Ref, { productId: p1Ref.id, warehouseId: w2Ref.id, lotNo: 'BTL-2026A', expiryDate: '2027-06-30', currentStock: 250 });
      batch.set(lot2Ref, { productId: p2Ref.id, warehouseId: w2Ref.id, lotNo: 'WST-050-01', expiryDate: '2026-12-15', currentStock: 180 });
      batch.set(lot3Ref, { productId: p3Ref.id, warehouseId: w2Ref.id, lotNo: 'WST-100-02', expiryDate: '2027-03-20', currentStock: 200 });
      batch.set(lot4Ref, { productId: p3Ref.id, warehouseId: w2Ref.id, lotNo: 'WST-100-01-EARLY', expiryDate: '2026-10-31', currentStock: 100 });

      // Seed basic transactions
      batch.set(doc(collection(db, 'inventoryTransactions')), {
        date: new Date().toISOString().substring(0, 16).replace('T', ' '),
        type: 'IN',
        productId: p1Ref.id,
        productNameJa: 'ボツラックス 100U',
        sku: 'BTLX-100',
        warehouseId: w2Ref.id,
        warehouseName: 'ナンバーワン',
        lotNo: 'BTL-2026A',
        quantity: 250,
        beforeQty: 0,
        afterQty: 250,
        user: 'System Seeder',
        notes: '初期データベース構築シード入庫'
      });

      // Update default Settings default warehouse
      batch.set(doc(db, 'systemSettings', 'default'), {
        ...DEFAULT_SETTINGS,
        defaultWarehouseId: w2Ref.id
      });

      await batch.commit();
      alert('初期シードデータのインポートが完了しました。');
    } catch (err) {
      console.error(err);
      alert('シードデータの構築に失敗しました。');
    } finally {
      setIsInitializing(false);
    }
  };

  // 1. Audit Log helper
  const logAuditAction = async (action: string, target: string, before: string, after: string) => {
    try {
      await addDoc(collection(db, 'auditLogs'), {
        date: new Date().toISOString().substring(0, 19).replace('T', ' '),
        user: currentUser.name,
        action,
        target,
        before,
        after
      });
    } catch (e) {
      console.error('Audit Log writing failure:', e);
    }
  };

  // 2. Settings Saver
  const handleSaveSettings = async (updated: SettingsType) => {
    const beforeStr = JSON.stringify(settings);
    const sanitized: SettingsType = {
      prefix: updated.prefix || 'INV-',
      currency: updated.currency || 'JPY',
      defaultWarehouseId: updated.defaultWarehouseId || '',
      declaration: updated.declaration || '',
      termsOfDelivery: updated.termsOfDelivery || '',
      reasonForExport: updated.reasonForExport || '',
      minStockWarning: updated.minStockWarning !== false,
      weightUnit: updated.weightUnit || 'kg',
      dateFormat: updated.dateFormat || 'YYYY-MM-DD',
      decimalPlaces: typeof updated.decimalPlaces === 'number' ? updated.decimalPlaces : 2,
      companyLogo: updated.companyLogo || '',
      signatureImage: updated.signatureImage || ''
    };
    try {
      await setDoc(doc(db, 'systemSettings', 'default'), sanitized);
      setSettings(sanitized);

      // Sync isDefault flag on warehouses in Firestore
      if (sanitized.defaultWarehouseId) {
        for (const w of warehouses) {
          const shouldBeDefault = w.id === sanitized.defaultWarehouseId;
          if (w.isDefault !== shouldBeDefault) {
            await updateDoc(doc(db, 'warehouses', w.id), { isDefault: shouldBeDefault });
          }
        }
      }

      await logAuditAction('SETTINGS_UPDATE', 'System Settings', beforeStr, JSON.stringify(sanitized));
    } catch (error: any) {
      console.error('Failed to save settings:', error);
      throw new Error(`Firestore Settings Write Failed: ${error.message || error}`);
    }
  };

  // 3. Add Stock Handler (IN Transaction)
  const handleAddStock = async (data: {
    date: string;
    productId: string;
    warehouseId: string;
    lotNo: string;
    expiryDate: string;
    quantity: number;
    purchasePrice: number;
    purchaseCurrency: string;
    notes: string;
    operator: string;
  }) => {
    // Read lots outside the transaction to locate the matching document ID
    const lotQuerySnap = await getDocs(collection(db, 'inventoryLots'));
    let existingLotDocId = '';
    lotQuerySnap.forEach(ldoc => {
      const ldata = ldoc.data() as InventoryLot;
      if (ldata.productId === data.productId && 
          ldata.warehouseId === data.warehouseId && 
          (ldata.lotNo || '').toUpperCase() === (data.lotNo || '').toUpperCase()) {
        existingLotDocId = ldoc.id;
      }
    });

    await runTransaction(db, async (tx) => {
      const prodRef = doc(db, 'products', data.productId);
      const prodSnap = await tx.get(prodRef);
      if (!prodSnap.exists()) throw new Error('製剤マスタが見つかりません');
      const product = prodSnap.data() as Product;

      const wrhRef = doc(db, 'warehouses', data.warehouseId);
      const wrhSnap = await tx.get(wrhRef);
      if (!wrhSnap.exists()) throw new Error('倉庫が見つかりません');
      const warehouse = wrhSnap.data() as Warehouse;

      let currentLotQty = 0;
      if (existingLotDocId) {
        const lotRef = doc(db, 'inventoryLots', existingLotDocId);
        const lotSnap = await tx.get(lotRef);
        if (lotSnap.exists()) {
          currentLotQty = (lotSnap.data() as InventoryLot).currentStock || 0;
        }
      }

      const beforeProductStock = product.currentStock || 0;
      const afterProductStock = beforeProductStock + data.quantity;

      // Write transaction
      const txRef = doc(collection(db, 'inventoryTransactions'));
      tx.set(txRef, {
        date: new Date().toISOString().substring(0, 19).replace('T', ' '),
        type: 'IN',
        productId: data.productId,
        productNameJa: product.nameJa,
        sku: product.sku,
        warehouseId: data.warehouseId,
        warehouseName: warehouse.name,
        lotNo: (data.lotNo || '').toUpperCase(),
        quantity: data.quantity,
        beforeQty: beforeProductStock,
        afterQty: afterProductStock,
        user: data.operator,
        notes: data.notes || '通常入庫登録'
      });

      // Update Product
      tx.update(prodRef, {
        currentStock: afterProductStock
      });

      // Update/Create Lot
      if (existingLotDocId) {
        const lotRef = doc(db, 'inventoryLots', existingLotDocId);
        tx.update(lotRef, {
          currentStock: currentLotQty + data.quantity,
          expiryDate: data.expiryDate // update expiry date just in case
        });
      } else {
        const lotRef = doc(collection(db, 'inventoryLots'));
        tx.set(lotRef, {
          productId: data.productId,
          warehouseId: data.warehouseId,
          lotNo: (data.lotNo || '').toUpperCase(),
          expiryDate: data.expiryDate,
          currentStock: data.quantity
        });
      }
    });

    await logAuditAction('INVENTORY_IN', `Product:${data.productId}`, 'Stock Added', `Qty: +${data.quantity}`);
  };

  // Helper: auto-generate unique Invoice Number securely (INV-YYYYMMDD-XXX)
  const generateInvoiceNo = async (dateStr: string): Promise<string> => {
    const cleanDate = dateStr.replace(/-/g, ''); // YYYYMMDD
    const prefix = settings.prefix || 'INV-';
    
    // Count existing shipments for this date to make increment
    const snap = await getDocs(collection(db, 'shipments'));
    let dayCount = 1;
    snap.forEach(d => {
      const s = d.data() as Shipment;
      if (s.date === dateStr) {
        dayCount++;
      }
    });

    const seq = String(dayCount).padStart(3, '0');
    return `${prefix}${cleanDate}-${seq}`;
  };

  // 4. Submit Single Shipment Handler
  const handleSubmitShipment = async (payload: any, status: 'DRAFT' | 'CONFIRMED'): Promise<{ invoiceNo: string; shipment: Shipment }> => {
    const invoiceNo = await generateInvoiceNo(payload.date);
    
    // Read lots outside the transaction
    const lotQuerySnap = await getDocs(collection(db, 'inventoryLots'));
    let createdShipment: Shipment | null = null;
    
    await runTransaction(db, async (transaction) => {
      const warehouseRef = payload.warehouseId ? doc(db, 'warehouses', payload.warehouseId) : null;
      const clinicRef = payload.clinicId ? doc(db, 'clinics', payload.clinicId) : null;

      // 1. READ PHASE
      const warehouseSnap = warehouseRef ? await transaction.get(warehouseRef) : null;
      const clinicSnap = clinicRef ? await transaction.get(clinicRef) : null;

      const productSnaps: Record<string, any> = {};
      const lotSnaps: Record<string, any> = {};

      if (status === 'CONFIRMED') {
        if (!warehouseSnap || !warehouseSnap.exists()) {
          throw new Error('発送元倉庫を選択してください');
        }
        if (!clinicSnap || !clinicSnap.exists()) {
          throw new Error('発送先クリニックを選択してください');
        }

        for (const item of payload.items) {
          const productRef = doc(db, 'products', item.productId);
          if (!productSnaps[item.productId]) {
            productSnaps[item.productId] = await transaction.get(productRef);
          }

          // Find specific lot with fallback matching
          let lotDocId = '';
          lotQuerySnap.forEach(ldoc => {
            const ldata = ldoc.data() as InventoryLot;
            if (ldata.productId === item.productId && 
                ldata.lotNo === item.lotNo &&
                (!ldata.warehouseId || ldata.warehouseId === payload.warehouseId)) {
              lotDocId = ldoc.id;
            }
          });
          if (!lotDocId) {
            lotQuerySnap.forEach(ldoc => {
              const ldata = ldoc.data() as InventoryLot;
              if (ldata.productId === item.productId && 
                  (!ldata.warehouseId || ldata.warehouseId === payload.warehouseId)) {
                lotDocId = ldoc.id;
              }
            });
          }
          if (!lotDocId) {
            lotQuerySnap.forEach(ldoc => {
              const ldata = ldoc.data() as InventoryLot;
              if (ldata.productId === item.productId) {
                lotDocId = ldoc.id;
              }
            });
          }

          if (lotDocId && !lotSnaps[lotDocId]) {
            lotSnaps[lotDocId] = await transaction.get(doc(db, 'inventoryLots', lotDocId));
          }
        }
      }

      // If status is CONFIRMED, execute stock reduction
      if (status === 'CONFIRMED') {
        const itemsUpdates: any[] = [];

        for (const item of payload.items) {
          const productSnap = productSnaps[item.productId];
          if (!productSnap || !productSnap.exists()) throw new Error(`製剤 ID ${item.productId} が見つかりません`);
          const productData = productSnap.data() as Product;
          const productStock = productData.currentStock || 0;

          if (productStock < item.qty) {
            throw new Error(`製剤「${productData.nameJa}」の在庫が不足しています (倉庫・マスター現在庫: ${productStock})`);
          }

          // Find specific lot with fallback matching
          let lotDocId = '';
          lotQuerySnap.forEach(ldoc => {
            const ldata = ldoc.data() as InventoryLot;
            if (ldata.productId === item.productId && 
                ldata.lotNo === item.lotNo &&
                (!ldata.warehouseId || ldata.warehouseId === payload.warehouseId)) {
              lotDocId = ldoc.id;
            }
          });
          if (!lotDocId) {
            lotQuerySnap.forEach(ldoc => {
              const ldata = ldoc.data() as InventoryLot;
              if (ldata.productId === item.productId && 
                  (!ldata.warehouseId || ldata.warehouseId === payload.warehouseId)) {
                lotDocId = ldoc.id;
              }
            });
          }
          if (!lotDocId) {
            lotQuerySnap.forEach(ldoc => {
              const ldata = ldoc.data() as InventoryLot;
              if (ldata.productId === item.productId) {
                lotDocId = ldoc.id;
              }
            });
          }

          let lotStock = 0;
          if (lotDocId) {
            const lotSnap = lotSnaps[lotDocId];
            if (lotSnap && lotSnap.exists()) {
              lotStock = (lotSnap.data() as InventoryLot).currentStock || 0;
            }
          }

          itemsUpdates.push({
            item,
            productRef: doc(db, 'products', item.productId),
            productData,
            lotDocId,
            lotStock,
            newProductStock: Math.max(0, productStock - item.qty)
          });
        }

        // 2. WRITE PHASE
        for (const update of itemsUpdates) {
          if (update.lotDocId) {
            // Subtract lot stock
            const lotRef = doc(db, 'inventoryLots', update.lotDocId);
            transaction.update(lotRef, {
              currentStock: Math.max(0, update.lotStock - update.item.qty)
            });
          } else {
            // Auto-create lot record if no lot existed
            const newLotRef = doc(collection(db, 'inventoryLots'));
            transaction.set(newLotRef, {
              productId: update.item.productId,
              warehouseId: payload.warehouseId,
              lotNo: update.item.lotNo || 'LOT-TEMP',
              expiryDate: update.item.expiryDate || '',
              currentStock: Math.max(0, update.productData.currentStock - update.item.qty),
              updatedAt: new Date().toISOString()
            });
          }

          // Subtract product master stock
          transaction.update(update.productRef, {
            currentStock: update.newProductStock
          });

          // Write OUT stock transaction
          const txRef = doc(collection(db, 'inventoryTransactions'));
          transaction.set(txRef, {
            date: new Date().toISOString().substring(0, 19).replace('T', ' '),
            type: 'OUT',
            productId: update.item.productId,
            productNameJa: update.productData.nameJa,
            sku: update.productData.sku,
            warehouseId: payload.warehouseId,
            warehouseName: warehouseSnap?.exists() ? warehouseSnap.data().name : '未指定倉庫',
            lotNo: update.item.lotNo,
            quantity: -update.item.qty,
            beforeQty: update.productData.currentStock,
            afterQty: update.newProductStock,
            user: currentUser.name,
            notes: `発送インボイス出庫: ${invoiceNo}`
          });
        }
      }

      // Save Shipment record
      const shipmentRef = doc(collection(db, 'shipments'));
      const warehouseSnapshot: Partial<Warehouse> = warehouseSnap && warehouseSnap.exists() 
        ? (warehouseSnap.data() as Warehouse) 
        : { id: payload.warehouseId || '', name: '未指定倉庫' };

      const clinicSnapshot: Partial<Clinic> = clinicSnap && clinicSnap.exists() 
        ? (clinicSnap.data() as Clinic) 
        : { id: payload.clinicId || '', name: '未指定クリニック', nameEn: 'Unspecified Clinic' };

      const shipmentData: Shipment = {
        id: shipmentRef.id,
        ...payload,
        invoiceNo,
        status,
        warehouseSnapshot,
        clinicSnapshot,
        createdById: currentUser.uid,
        createdByName: currentUser.name,
        history: [{
          date: new Date().toISOString().substring(0, 16).replace('T', ' '),
          user: currentUser.name,
          action: 'CREATED',
          detail: `インボイス ${status} を作成`
        }]
      };

      transaction.set(shipmentRef, shipmentData);
      createdShipment = shipmentData;
    });

    await logAuditAction('SHIPMENT_CREATE', invoiceNo, 'None', `Created shipment as ${status}`);
    return { invoiceNo, shipment: createdShipment! };
  };

  // 5. Submit Bulk Shipment (Multiple Clinics in One Batch)
  const handleBulkShipmentsSubmit = async (shipmentsPayloads: any[]): Promise<Shipment[]> => {
    const createdList: Shipment[] = [];
    
    // Read lots outside the transactions
    const lotQuerySnap = await getDocs(collection(db, 'inventoryLots'));

    // Fetch all shipments once to count existing ones and avoid race conditions / stale cache
    const shipmentsSnap = await getDocs(collection(db, 'shipments'));
    const allExistingShipments = shipmentsSnap.docs.map(d => d.data() as Shipment);

    // Keep track of counts per date (both existing and newly added in this batch)
    const dateCounts: Record<string, number> = {};

    for (const payload of shipmentsPayloads) {
      const dateStr = payload.date;
      if (dateCounts[dateStr] === undefined) {
        // Count how many exist in DB for this date
        const dbCount = allExistingShipments.filter(s => s.date === dateStr).length;
        dateCounts[dateStr] = dbCount + 1;
      } else {
        dateCounts[dateStr] += 1;
      }

      const cleanDate = dateStr.replace(/-/g, ''); // YYYYMMDD
      const prefix = settings.prefix || 'INV-';
      const seq = String(dateCounts[dateStr]).padStart(3, '0');
      const invoiceNo = `${prefix}${cleanDate}-${seq}`;
      
      const newShipment = await runTransaction(db, async (transaction) => {
        const warehouseRef = doc(db, 'warehouses', payload.warehouseId);
        const clinicRef = doc(db, 'clinics', payload.clinicId);

        // 1. READ PHASE
        const warehouseSnap = await transaction.get(warehouseRef);
        const clinicSnap = await transaction.get(clinicRef);

        const productSnaps: Record<string, any> = {};
        const lotSnaps: Record<string, any> = {};

        for (const item of payload.items) {
          const productRef = doc(db, 'products', item.productId);
          if (!productSnaps[item.productId]) {
            productSnaps[item.productId] = await transaction.get(productRef);
          }

          // Find specific lot
          let lotDocId = '';
          lotQuerySnap.forEach(ldoc => {
            const ldata = ldoc.data() as InventoryLot;
            if (ldata.productId === item.productId && 
                ldata.lotNo === item.lotNo && 
                (!ldata.warehouseId || ldata.warehouseId === payload.warehouseId)) {
              lotDocId = ldoc.id;
            }
          });
          if (!lotDocId) {
            lotQuerySnap.forEach(ldoc => {
              const ldata = ldoc.data() as InventoryLot;
              if (ldata.productId === item.productId && 
                  (!ldata.warehouseId || ldata.warehouseId === payload.warehouseId)) {
                lotDocId = ldoc.id;
              }
            });
          }
          if (!lotDocId) {
            lotQuerySnap.forEach(ldoc => {
              const ldata = ldoc.data() as InventoryLot;
              if (ldata.productId === item.productId) {
                lotDocId = ldoc.id;
              }
            });
          }

          if (lotDocId && !lotSnaps[lotDocId]) {
            lotSnaps[lotDocId] = await transaction.get(doc(db, 'inventoryLots', lotDocId));
          }
        }

        if (!warehouseSnap.exists() || !clinicSnap.exists()) {
          throw new Error('倉庫またはクリニックが正しく検出できません');
        }

        const itemsUpdates: any[] = [];

        // Validate and prepare updates
        for (const item of payload.items) {
          const productSnap = productSnaps[item.productId];
          if (!productSnap || !productSnap.exists()) {
            throw new Error(`製剤 ${item.productId} がマスタにありません`);
          }
          const productData = productSnap.data() as Product;

          // Find specific lot ID
          let lotDocId = '';
          lotQuerySnap.forEach(ldoc => {
            const ldata = ldoc.data() as InventoryLot;
            if (ldata.productId === item.productId && 
                ldata.lotNo === item.lotNo && 
                (!ldata.warehouseId || ldata.warehouseId === payload.warehouseId)) {
              lotDocId = ldoc.id;
            }
          });
          if (!lotDocId) {
            lotQuerySnap.forEach(ldoc => {
              const ldata = ldoc.data() as InventoryLot;
              if (ldata.productId === item.productId && 
                  (!ldata.warehouseId || ldata.warehouseId === payload.warehouseId)) {
                lotDocId = ldoc.id;
              }
            });
          }
          if (!lotDocId) {
            lotQuerySnap.forEach(ldoc => {
              const ldata = ldoc.data() as InventoryLot;
              if (ldata.productId === item.productId) {
                lotDocId = ldoc.id;
              }
            });
          }

          let lotStock = 0;
          if (lotDocId) {
            const lotSnap = lotSnaps[lotDocId];
            if (lotSnap && lotSnap.exists()) {
              lotStock = (lotSnap.data() as InventoryLot).currentStock || 0;
            }
          }

          if (!lotDocId || lotStock < item.qty) {
            throw new Error(`一括振り分け処理中：${productData.nameJa} (ロット ${item.lotNo}) の在庫が不足しています`);
          }

          itemsUpdates.push({
            item,
            productRef: doc(db, 'products', item.productId),
            productData,
            lotDocId,
            lotStock,
            newProductStock: (productData.currentStock || 0) - item.qty
          });
        }

        // 2. WRITE PHASE
        for (const update of itemsUpdates) {
          // Reduce lot stock
          transaction.update(doc(db, 'inventoryLots', update.lotDocId), {
            currentStock: update.lotStock - update.item.qty
          });

          // Reduce product stock
          transaction.update(update.productRef, {
            currentStock: update.newProductStock
          });

          // Write inventory transaction
          transaction.set(doc(collection(db, 'inventoryTransactions')), {
            date: new Date().toISOString().substring(0, 19).replace('T', ' '),
            type: 'OUT',
            productId: update.item.productId,
            productNameJa: update.productData.nameJa,
            sku: update.productData.sku,
            warehouseId: payload.warehouseId,
            warehouseName: warehouseSnap.data().name,
            lotNo: update.item.lotNo,
            quantity: -update.item.qty,
            beforeQty: update.productData.currentStock,
            afterQty: update.newProductStock,
            user: currentUser.name,
            notes: `一括振り分けインボイス出庫: ${invoiceNo}`
          });
        }

        const newShipmentData = {
          ...payload,
          invoiceNo,
          status: 'CONFIRMED' as const,
          warehouseSnapshot: warehouseSnap.data(),
          clinicSnapshot: clinicSnap.data(),
          createdById: currentUser.uid,
          createdByName: currentUser.name,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          history: [{
            date: new Date().toISOString().substring(0, 16).replace('T', ' '),
            user: currentUser.name,
            action: 'CREATED_BULK',
            detail: '一括振り分けシステムによる一括確定'
          }]
        };

        const newDocRef = doc(collection(db, 'shipments'));
        transaction.set(newDocRef, newShipmentData);
        
        return { id: newDocRef.id, ...newShipmentData } as Shipment;
      });

      createdList.push(newShipment);
      await logAuditAction('SHIPMENT_CREATE_BULK', invoiceNo, 'None', 'Bulk Created and Confirmed');
    }

    return createdList;
  };

  // 6. Update Shipment Status (DRAFT -> CONFIRMED, or Rollback Cancel)
  const handleUpdateShipmentStatus = async (id: string, status: Shipment['status'], trackingNo?: string) => {
    const shipmentRef = doc(db, 'shipments', id);
    
    // Read lots outside the transaction
    const lotQuerySnap = await getDocs(collection(db, 'inventoryLots'));

    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(shipmentRef);
      if (!snap.exists()) throw new Error('指定 of 発送データが見つかりません');
      const s = snap.data() as Shipment;

      const beforeStatus = s.status;
      if (beforeStatus === status) return;

      // 1. READ PHASE
      const productSnaps: Record<string, any> = {};
      const lotSnaps: Record<string, any> = {};

      if (beforeStatus === 'DRAFT' && status === 'CONFIRMED') {
        for (const item of s.items) {
          const productRef = doc(db, 'products', item.productId);
          if (!productSnaps[item.productId]) {
            productSnaps[item.productId] = await transaction.get(productRef);
          }

          let lotDocId = '';
          lotQuerySnap.forEach(ldoc => {
            const ldata = ldoc.data() as InventoryLot;
            if (ldata.productId === item.productId && 
                ldata.lotNo === item.lotNo &&
                (!ldata.warehouseId || ldata.warehouseId === s.warehouseId)) {
              lotDocId = ldoc.id;
            }
          });
          if (!lotDocId) {
            lotQuerySnap.forEach(ldoc => {
              const ldata = ldoc.data() as InventoryLot;
              if (ldata.productId === item.productId && 
                  (!ldata.warehouseId || ldata.warehouseId === s.warehouseId)) {
                lotDocId = ldoc.id;
              }
            });
          }
          if (!lotDocId) {
            lotQuerySnap.forEach(ldoc => {
              const ldata = ldoc.data() as InventoryLot;
              if (ldata.productId === item.productId) {
                lotDocId = ldoc.id;
              }
            });
          }

          if (lotDocId && !lotSnaps[lotDocId]) {
            lotSnaps[lotDocId] = await transaction.get(doc(db, 'inventoryLots', lotDocId));
          }
        }
      }

      if ((beforeStatus === 'CONFIRMED' || beforeStatus === 'SHIPPED') && status === 'CANCELLED') {
        for (const item of s.items) {
          const productRef = doc(db, 'products', item.productId);
          if (!productSnaps[item.productId]) {
            productSnaps[item.productId] = await transaction.get(productRef);
          }

          let lotDocId = '';
          lotQuerySnap.forEach(ldoc => {
            const ldata = ldoc.data() as InventoryLot;
            if (ldata.productId === item.productId && 
                ldata.lotNo === item.lotNo &&
                (!ldata.warehouseId || ldata.warehouseId === s.warehouseId)) {
              lotDocId = ldoc.id;
            }
          });
          if (!lotDocId) {
            lotQuerySnap.forEach(ldoc => {
              const ldata = ldoc.data() as InventoryLot;
              if (ldata.productId === item.productId) {
                lotDocId = ldoc.id;
              }
            });
          }

          if (lotDocId && !lotSnaps[lotDocId]) {
            lotSnaps[lotDocId] = await transaction.get(doc(db, 'inventoryLots', lotDocId));
          }
        }
      }

      // 2. VALIDATION & WRITE PHASE
      // Case A: CONFIRMING from DRAFT status
      if (beforeStatus === 'DRAFT' && status === 'CONFIRMED') {
        const itemsUpdates: any[] = [];

        for (const item of s.items) {
          const productSnap = productSnaps[item.productId];
          if (!productSnap || !productSnap.exists()) throw new Error(`製剤 ${item.nameJa} がマスタにありません`);
          const productData = productSnap.data() as Product;

          let lotDocId = '';
          lotQuerySnap.forEach(ldoc => {
            const ldata = ldoc.data() as InventoryLot;
            if (ldata.productId === item.productId && 
                ldata.lotNo === item.lotNo &&
                (!ldata.warehouseId || ldata.warehouseId === s.warehouseId)) {
              lotDocId = ldoc.id;
            }
          });
          if (!lotDocId) {
            lotQuerySnap.forEach(ldoc => {
              const ldata = ldoc.data() as InventoryLot;
              if (ldata.productId === item.productId && 
                  (!ldata.warehouseId || ldata.warehouseId === s.warehouseId)) {
                lotDocId = ldoc.id;
              }
            });
          }
          if (!lotDocId) {
            lotQuerySnap.forEach(ldoc => {
              const ldata = ldoc.data() as InventoryLot;
              if (ldata.productId === item.productId) {
                lotDocId = ldoc.id;
              }
            });
          }

          let lotStock = 0;
          if (lotDocId) {
            const lotSnap = lotSnaps[lotDocId];
            if (lotSnap && lotSnap.exists()) {
              lotStock = (lotSnap.data() as InventoryLot).currentStock || 0;
            }
          }

          if (!lotDocId || lotStock < item.qty) {
            throw new Error(`製剤 ${item.nameJa} (ロット ${item.lotNo}) の在庫が不足しているため、下書きから確定に変更できません。`);
          }

          itemsUpdates.push({
            item,
            productRef: doc(db, 'products', item.productId),
            productData,
            lotDocId,
            lotStock,
            newProductStock: (productData.currentStock || 0) - item.qty
          });
        }

        // Apply writes for Case A
        for (const update of itemsUpdates) {
          transaction.update(doc(db, 'inventoryLots', update.lotDocId), {
            currentStock: update.lotStock - update.item.qty
          });

          transaction.update(update.productRef, {
            currentStock: update.newProductStock
          });

          transaction.set(doc(collection(db, 'inventoryTransactions')), {
            date: new Date().toISOString().substring(0, 19).replace('T', ' '),
            type: 'OUT',
            productId: update.item.productId,
            productNameJa: update.productData.nameJa,
            sku: update.productData.sku,
            warehouseId: s.warehouseId,
            warehouseName: s.warehouseSnapshot?.name || '不明倉庫',
            lotNo: update.item.lotNo,
            quantity: -update.item.qty,
            beforeQty: update.productData.currentStock,
            afterQty: update.newProductStock,
            user: currentUser.name,
            notes: `下書き確定化による搬出: ${s.invoiceNo}`
          });
        }
      }

      // Case B: CANCELLING an already CONFIRMED/SHIPPED shipment (Rollback quantities)
      if ((beforeStatus === 'CONFIRMED' || beforeStatus === 'SHIPPED') && status === 'CANCELLED') {
        const itemsUpdates: any[] = [];

        for (const item of s.items) {
          const productSnap = productSnaps[item.productId];
          if (!productSnap || !productSnap.exists()) continue;
          const productData = productSnap.data() as Product;

          let lotDocId = '';
          lotQuerySnap.forEach(ldoc => {
            const ldata = ldoc.data() as InventoryLot;
            if (ldata.productId === item.productId && 
                ldata.warehouseId === s.warehouseId && 
                ldata.lotNo === item.lotNo) {
              lotDocId = ldoc.id;
            }
          });

          let lotStock = 0;
          if (lotDocId) {
            const lotSnap = lotSnaps[lotDocId];
            if (lotSnap && lotSnap.exists()) {
              lotStock = (lotSnap.data() as InventoryLot).currentStock || 0;
            }
          }

          itemsUpdates.push({
            item,
            productRef: doc(db, 'products', item.productId),
            productData,
            lotDocId,
            lotStock,
            newProductStock: (productData.currentStock || 0) + item.qty
          });
        }

        // Apply writes for Case B
        for (const update of itemsUpdates) {
          transaction.update(update.productRef, {
            currentStock: update.newProductStock
          });

          if (update.lotDocId) {
            transaction.update(doc(db, 'inventoryLots', update.lotDocId), {
              currentStock: update.lotStock + update.item.qty
            });
          } else {
            // Re-create the lot if it was deleted
            const lotRef = doc(collection(db, 'inventoryLots'));
            transaction.set(lotRef, {
              productId: update.item.productId,
              warehouseId: s.warehouseId,
              lotNo: update.item.lotNo,
              expiryDate: update.item.expiryDate || '',
              currentStock: update.item.qty
            });
          }

          transaction.set(doc(collection(db, 'inventoryTransactions')), {
            date: new Date().toISOString().substring(0, 19).replace('T', ' '),
            type: 'ADJ',
            productId: update.item.productId,
            productNameJa: update.productData.nameJa,
            sku: update.productData.sku,
            warehouseId: s.warehouseId,
            warehouseName: s.warehouseSnapshot?.name || '不明倉庫',
            lotNo: update.item.lotNo,
            quantity: update.item.qty,
            beforeQty: update.productData.currentStock,
            afterQty: update.newProductStock,
            user: currentUser.name,
            notes: `発送キャンセルに伴う在庫差し戻し: ${s.invoiceNo}`
          });
        }
      }

      const updatedHistory = [
        ...(s.history || []),
        {
          date: new Date().toISOString().substring(0, 16).replace('T', ' '),
          user: currentUser.name,
          action: 'STATUS_CHANGE',
          detail: `状況変更: ${beforeStatus} → ${status}`
        }
      ];

      const updates: any = {
        status,
        history: updatedHistory
      };

      if (trackingNo !== undefined && trackingNo !== '') {
        updates.trackingNo = trackingNo;
      }

      transaction.update(shipmentRef, updates);
      await logAuditAction('STATUS_UPDATE', s.invoiceNo, beforeStatus, status);
    });
  };

  // 7. Delete Shipment (Draft only)
  const handleDeleteShipment = async (id: string) => {
    const docRef = doc(db, 'shipments', id);
    await deleteDoc(docRef);
    await logAuditAction('SHIPMENT_DELETE', id, 'Exist', 'Deleted draft shipment');
  };

  // 8. Edit Shipment (Audit logged tracking fields)
  const handleEditShipment = async (id: string, updatedData: Partial<Shipment>) => {
    const docRef = doc(db, 'shipments', id);
    await updateDoc(docRef, {
      ...updatedData,
      history: [
        ...(shipments.find(s => s.id === id)?.history || []),
        {
          date: new Date().toISOString().substring(0, 16).replace('T', ' '),
          user: currentUser.name,
          action: 'METADATA_UPDATE',
          detail: '追加費用、追跡番号、備考等の修正'
        }
      ]
    });
    await logAuditAction('SHIPMENT_EDIT', id, 'Metadata changed', JSON.stringify(updatedData));
  };

  // 9. Duplicate Shipment
  const handleDuplicateShipment = (shipment: Shipment) => {
    setDuplicatePayload(shipment);
    setActiveTab('allocation');
  };

  // Clinic Master CRUD functions
  const handleAddClinic = async (clinic: Omit<Clinic, 'id' | 'createdAt'>) => {
    await addDoc(collection(db, 'clinics'), {
      ...clinic,
      createdAt: new Date().toISOString()
    });
    await logAuditAction('CLINIC_ADD', clinic.name, 'None', JSON.stringify(clinic));
  };

  const handleUpdateClinic = async (id: string, updated: Partial<Clinic>) => {
    const docRef = doc(db, 'clinics', id);
    await updateDoc(docRef, updated);
    await logAuditAction('CLINIC_UPDATE', id, 'Modified fields', JSON.stringify(updated));
  };

  const handleDeleteClinic = async (id: string) => {
    const docRef = doc(db, 'clinics', id);
    await deleteDoc(docRef);
    await logAuditAction('CLINIC_DELETE', id, 'Exist', 'Deleted clinic');
  };

  const handleImportClinics = async (newClinics: Omit<Clinic, 'id' | 'createdAt'>[]) => {
    const batch = writeBatch(db);
    newClinics.forEach(c => {
      const ref = doc(collection(db, 'clinics'));
      batch.set(ref, {
        ...c,
        createdAt: new Date().toISOString()
      });
    });
    await batch.commit();
    await logAuditAction('CLINIC_IMPORT_CSV', 'Clinics CSV', 'None', `Imported ${newClinics.length} clinics`);
  };

  // Product Master CRUD functions
  const handleAddProduct = async (product: Omit<Product, 'id' | 'createdAt'>) => {
    const docRef = await addDoc(collection(db, 'products'), {
      ...product,
      createdAt: new Date().toISOString()
    });

    const defaultWId = settings.defaultWarehouseId || warehouses.find(w => w.isDefault)?.id || warehouses[0]?.id || '';
    if (product.currentStock > 0 && defaultWId) {
      // Create a matching lot
      await addDoc(collection(db, 'inventoryLots'), {
        productId: docRef.id,
        warehouseId: defaultWId,
        lotNo: (product.lotNo || 'LOT-TEMP').toUpperCase(),
        expiryDate: product.expiryDate || new Date(Date.now() + 365*24*60*60*1000).toISOString().substring(0, 10),
        currentStock: product.currentStock,
        updatedAt: new Date().toISOString()
      });

      // Record transaction
      await addDoc(collection(db, 'inventoryTransactions'), {
        date: new Date().toISOString().substring(0, 19).replace('T', ' '),
        type: 'IN',
        productId: docRef.id,
        productNameJa: product.nameJa,
        sku: product.sku,
        warehouseId: defaultWId,
        warehouseName: warehouses.find(w => w.id === defaultWId)?.name || 'デフォルト倉庫',
        lotNo: (product.lotNo || 'LOT-TEMP').toUpperCase(),
        expiryDate: product.expiryDate || '',
        quantity: product.currentStock,
        beforeQty: 0,
        afterQty: product.currentStock,
        user: currentUser.name,
        notes: '製剤マスタ新規追加に伴う自動初期ロット在庫構築',
        createdAt: new Date().toISOString()
      });
    }

    await logAuditAction('PRODUCT_ADD', product.nameJa, 'None', JSON.stringify(product));
  };

  const handleUpdateProduct = async (id: string, updated: Partial<Product>) => {
    const docRef = doc(db, 'products', id);
    const oldProduct = products.find(p => p.id === id);
    
    await updateDoc(docRef, updated);

    if (oldProduct) {
      const defaultWId = settings.defaultWarehouseId || warehouses.find(w => w.isDefault)?.id || warehouses[0]?.id || '';
      
      const stockDiff = (updated.currentStock ?? oldProduct.currentStock) - (oldProduct.currentStock || 0);
      const newLotNo = (updated.lotNo || oldProduct.lotNo || 'LOT-TEMP').toUpperCase();
      const newExpiry = updated.expiryDate || oldProduct.expiryDate || '';

      if (stockDiff !== 0 || updated.lotNo !== oldProduct.lotNo || updated.expiryDate !== oldProduct.expiryDate) {
        // Find existing lot for this product in default warehouse
        const lotSnap = await getDocs(collection(db, 'inventoryLots'));
        let targetLotDocId = '';
        let targetLotCurrentStock = 0;

        lotSnap.forEach(ldoc => {
          const ldata = ldoc.data() as InventoryLot;
          if (ldata.productId === id && ldata.warehouseId === defaultWId) {
            targetLotDocId = ldoc.id;
            targetLotCurrentStock = ldata.currentStock || 0;
          }
        });

        if (targetLotDocId) {
          const lotRef = doc(db, 'inventoryLots', targetLotDocId);
          await updateDoc(lotRef, {
            lotNo: newLotNo,
            expiryDate: newExpiry,
            currentStock: targetLotCurrentStock + stockDiff,
            updatedAt: new Date().toISOString()
          });
        } else {
          await addDoc(collection(db, 'inventoryLots'), {
            productId: id,
            warehouseId: defaultWId,
            lotNo: newLotNo,
            expiryDate: newExpiry,
            currentStock: updated.currentStock ?? oldProduct.currentStock ?? 0,
            updatedAt: new Date().toISOString()
          });
        }

        // Record adjustment transaction
        if (stockDiff !== 0) {
          await addDoc(collection(db, 'inventoryTransactions'), {
            date: new Date().toISOString().substring(0, 19).replace('T', ' '),
            type: 'ADJ',
            productId: id,
            productNameJa: updated.nameJa || oldProduct.nameJa,
            sku: updated.sku || oldProduct.sku,
            warehouseId: defaultWId,
            warehouseName: warehouses.find(w => w.id === defaultWId)?.name || 'デフォルト倉庫',
            lotNo: newLotNo,
            expiryDate: newExpiry,
            quantity: stockDiff,
            beforeQty: oldProduct.currentStock || 0,
            afterQty: updated.currentStock ?? oldProduct.currentStock ?? 0,
            user: currentUser.name,
            notes: '製剤マスタ編集に伴う自動在庫調整（システム自動同期）',
            createdAt: new Date().toISOString()
          });
        }
      }
    }

    await logAuditAction('PRODUCT_UPDATE', id, 'Modified fields', JSON.stringify(updated));
  };

  const handleAdjustLot = async (lotId: string, newStock: number, notes: string) => {
    await runTransaction(db, async (transaction) => {
      const lotRef = doc(db, 'inventoryLots', lotId);
      const lotSnap = await transaction.get(lotRef);
      if (!lotSnap.exists()) throw new Error('ロットデータが見つかりません');
      const lotData = lotSnap.data() as InventoryLot;

      const productRef = doc(db, 'products', lotData.productId);
      const productSnap = await transaction.get(productRef);
      if (!productSnap.exists()) throw new Error('製剤マスタが見つかりません');
      const productData = productSnap.data() as Product;

      const warehouseRef = doc(db, 'warehouses', lotData.warehouseId);
      const warehouseSnap = await transaction.get(warehouseRef);
      const warehouseName = warehouseSnap.exists() ? (warehouseSnap.data() as Warehouse).name : '不明な倉庫';

      const beforeLotStock = lotData.currentStock || 0;
      const diff = newStock - beforeLotStock;

      const beforeProductStock = productData.currentStock || 0;
      const afterProductStock = beforeProductStock + diff;

      // Update lot
      transaction.update(lotRef, { 
        currentStock: newStock,
        updatedAt: new Date().toISOString()
      });

      // Update product
      transaction.update(productRef, { 
        currentStock: afterProductStock 
      });

      // Record transaction
      transaction.set(doc(collection(db, 'inventoryTransactions')), {
        date: new Date().toISOString().substring(0, 19).replace('T', ' '),
        type: 'ADJ',
        productId: lotData.productId,
        productNameJa: productData.nameJa,
        sku: productData.sku,
        warehouseId: lotData.warehouseId,
        warehouseName: warehouseName,
        lotNo: lotData.lotNo,
        expiryDate: lotData.expiryDate || '',
        quantity: diff,
        beforeQty: beforeProductStock,
        afterQty: afterProductStock,
        user: currentUser.name,
        notes: notes || 'ロット現在庫数の手動調整',
        createdAt: new Date().toISOString()
      });
    });

    await logAuditAction('LOT_STOCK_ADJUST', lotId, 'Adjusted', `New Stock: ${newStock}`);
  };

  const handleTransferStock = async (
    productId: string,
    fromWarehouseId: string,
    toWarehouseId: string,
    lotNo: string,
    quantity: number,
    notes: string
  ) => {
    const lotQuerySnap = await getDocs(collection(db, 'inventoryLots'));
    
    let sourceLotId = '';
    let sourceExpiry = '';
    lotQuerySnap.forEach(ldoc => {
      const ldata = ldoc.data() as InventoryLot;
      if (ldata.productId === productId && ldata.warehouseId === fromWarehouseId && ldata.lotNo.toUpperCase() === lotNo.toUpperCase()) {
        sourceLotId = ldoc.id;
        sourceExpiry = ldata.expiryDate || '';
      }
    });

    if (!sourceLotId) throw new Error('移動元のロットデータが見つかりません');

    let destLotId = '';
    lotQuerySnap.forEach(ldoc => {
      const ldata = ldoc.data() as InventoryLot;
      if (ldata.productId === productId && ldata.warehouseId === toWarehouseId && ldata.lotNo.toUpperCase() === lotNo.toUpperCase()) {
        destLotId = ldoc.id;
      }
    });

    await runTransaction(db, async (transaction) => {
      const sourceLotRef = doc(db, 'inventoryLots', sourceLotId);
      const productRef = doc(db, 'products', productId);
      const fromWhRef = doc(db, 'warehouses', fromWarehouseId);
      const toWhRef = doc(db, 'warehouses', toWarehouseId);

      // 1. READ PHASE
      const sourceLotSnap = await transaction.get(sourceLotRef);
      const productSnap = await transaction.get(productRef);
      const fromWhSnap = await transaction.get(fromWhRef);
      const toWhSnap = await transaction.get(toWhRef);

      let destLotSnap = null;
      if (destLotId) {
        destLotSnap = await transaction.get(doc(db, 'inventoryLots', destLotId));
      }

      // 2. VALIDATION & WRITE PHASE
      if (!sourceLotSnap.exists()) throw new Error('移動元ロットが存在しません');
      const sourceLotData = sourceLotSnap.data() as InventoryLot;

      if (sourceLotData.currentStock < quantity) {
        throw new Error('移動元倉庫の在庫が不足しています');
      }

      if (!productSnap.exists()) throw new Error('対象製剤マスタが見つかりません');
      const productData = productSnap.data() as Product;

      const fromWhName = fromWhSnap.exists() ? (fromWhSnap.data() as Warehouse).name : '不明倉庫';
      const toWhName = toWhSnap.exists() ? (toWhSnap.data() as Warehouse).name : '不明倉庫';

      transaction.update(sourceLotRef, {
        currentStock: sourceLotData.currentStock - quantity,
        updatedAt: new Date().toISOString()
      });

      if (destLotId) {
        const destLotRef = doc(db, 'inventoryLots', destLotId);
        const destStock = (destLotSnap && destLotSnap.exists()) ? (destLotSnap.data() as InventoryLot).currentStock : 0;
        transaction.update(destLotRef, {
          currentStock: destStock + quantity,
          updatedAt: new Date().toISOString()
        });
      } else {
        const newLotRef = doc(collection(db, 'inventoryLots'));
        transaction.set(newLotRef, {
          productId,
          warehouseId: toWarehouseId,
          lotNo: lotNo.toUpperCase(),
          expiryDate: sourceExpiry || '2040-12-31',
          currentStock: quantity,
          updatedAt: new Date().toISOString()
        });
      }

      transaction.set(doc(collection(db, 'inventoryTransactions')), {
        date: new Date().toISOString().substring(0, 19).replace('T', ' '),
        type: 'OUT',
        productId,
        productNameJa: productData.nameJa,
        sku: productData.sku,
        warehouseId: fromWarehouseId,
        warehouseName: fromWhName,
        lotNo: lotNo.toUpperCase(),
        quantity: -quantity,
        beforeQty: productData.currentStock || 0,
        afterQty: productData.currentStock || 0,
        user: currentUser.name,
        notes: notes || `倉庫間移動による搬出 (移動先: ${toWhName})`,
        createdAt: new Date().toISOString()
      });

      transaction.set(doc(collection(db, 'inventoryTransactions')), {
        date: new Date().toISOString().substring(0, 19).replace('T', ' '),
        type: 'IN',
        productId,
        productNameJa: productData.nameJa,
        sku: productData.sku,
        warehouseId: toWarehouseId,
        warehouseName: toWhName,
        lotNo: lotNo.toUpperCase(),
        quantity: quantity,
        beforeQty: productData.currentStock || 0,
        afterQty: productData.currentStock || 0,
        user: currentUser.name,
        notes: notes || `倉庫間移動による搬入 (移動元: ${fromWhName})`,
        createdAt: new Date().toISOString()
      });
    });

    await logAuditAction('LOT_STOCK_TRANSFER', productId, fromWarehouseId, `Moved ${quantity} of ${lotNo} to ${toWarehouseId}`);
  };

  const handleDeleteLot = async (lotId: string) => {
    await runTransaction(db, async (transaction) => {
      const lotRef = doc(db, 'inventoryLots', lotId);
      const lotSnap = await transaction.get(lotRef);
      if (!lotSnap.exists()) throw new Error('削除対象のロットが見つかりません');
      const lotData = lotSnap.data() as InventoryLot;

      const productRef = doc(db, 'products', lotData.productId);
      const productSnap = await transaction.get(productRef);
      if (!productSnap.exists()) throw new Error('製品マスタが見つかりません');
      const productData = productSnap.data() as Product;

      const warehouseSnap = await transaction.get(doc(db, 'warehouses', lotData.warehouseId));
      const warehouseName = warehouseSnap.exists() ? (warehouseSnap.data() as Warehouse).name : '不明倉庫';

      const beforeStock = productData.currentStock || 0;
      const lotStock = lotData.currentStock || 0;
      const afterStock = beforeStock - lotStock;

      transaction.delete(lotRef);

      transaction.update(productRef, {
        currentStock: afterStock
      });

      if (lotStock > 0) {
        transaction.set(doc(collection(db, 'inventoryTransactions')), {
          date: new Date().toISOString().substring(0, 19).replace('T', ' '),
          type: 'ADJ',
          productId: lotData.productId,
          productNameJa: productData.nameJa,
          sku: productData.sku,
          warehouseId: lotData.warehouseId,
          warehouseName: warehouseName,
          lotNo: lotData.lotNo,
          quantity: -lotStock,
          beforeQty: beforeStock,
          afterQty: afterStock,
          user: currentUser.name,
          notes: '入荷元ロット削除に伴う自動在庫破棄調整',
          createdAt: new Date().toISOString()
        });
      }
    });

    await logAuditAction('LOT_DELETE', lotId, 'Exist', 'Deleted inventory lot and recalculated overall product stock');
  };

  const handleDeleteProduct = async (id: string) => {
    // 1. Delete product document
    const docRef = doc(db, 'products', id);
    await deleteDoc(docRef);

    // 2. Cascade delete all associated inventory lots
    const lotQuerySnap = await getDocs(collection(db, 'inventoryLots'));
    const batch = writeBatch(db);
    let lotCount = 0;
    
    lotQuerySnap.forEach(ldoc => {
      const ldata = ldoc.data() as InventoryLot;
      if (ldata.productId === id) {
        batch.delete(doc(db, 'inventoryLots', ldoc.id));
        lotCount++;
      }
    });

    if (lotCount > 0) {
      await batch.commit();
    }

    await logAuditAction('PRODUCT_DELETE', id, 'Exist', `Deleted product and its ${lotCount} associated inventory lots`);
  };

  const handleImportProducts = async (newProducts: Omit<Product, 'id' | 'createdAt'>[]) => {
    const defaultWId = settings.defaultWarehouseId || warehouses.find(w => w.isDefault)?.id || warehouses[0]?.id || '';
    const defaultWName = warehouses.find(w => w.id === defaultWId)?.name || 'デフォルト倉庫';

    const batch = writeBatch(db);

    newProducts.forEach(p => {
      const productRef = doc(collection(db, 'products'));
      const productId = productRef.id;

      batch.set(productRef, {
        ...p,
        createdAt: new Date().toISOString()
      });

      if (p.currentStock > 0 && defaultWId) {
        const lotRef = doc(collection(db, 'inventoryLots'));
        batch.set(lotRef, {
          productId: productId,
          warehouseId: defaultWId,
          lotNo: (p.lotNo || 'LOT-TEMP').toUpperCase(),
          expiryDate: p.expiryDate || new Date(Date.now() + 365*24*60*60*1000).toISOString().substring(0, 10),
          currentStock: p.currentStock,
          updatedAt: new Date().toISOString()
        });

        const txRef = doc(collection(db, 'inventoryTransactions'));
        batch.set(txRef, {
          date: new Date().toISOString().substring(0, 19).replace('T', ' '),
          type: 'IN',
          productId: productId,
          productNameJa: p.nameJa,
          sku: p.sku,
          warehouseId: defaultWId,
          warehouseName: defaultWName,
          lotNo: (p.lotNo || 'LOT-TEMP').toUpperCase(),
          expiryDate: p.expiryDate || '',
          quantity: p.currentStock,
          beforeQty: 0,
          afterQty: p.currentStock,
          user: currentUser.name,
          notes: '製剤CSV一括インポートに伴う自動初期ロット在庫構築',
          createdAt: new Date().toISOString()
        });
      }
    });

    await batch.commit();
    await logAuditAction('PRODUCT_IMPORT_CSV', 'Products CSV', 'None', `Imported ${newProducts.length} products`);
  };

  // Supplier Master CRUD functions
  const handleAddSupplier = async (supplier: Omit<Supplier, 'id' | 'createdAt'>) => {
    await addDoc(collection(db, 'suppliers'), {
      ...supplier,
      createdAt: new Date().toISOString()
    });
    await logAuditAction('SUPPLIER_ADD', supplier.name, 'None', JSON.stringify(supplier));
  };

  const handleUpdateSupplier = async (id: string, updated: Partial<Supplier>) => {
    const docRef = doc(db, 'suppliers', id);
    await updateDoc(docRef, updated);
    await logAuditAction('SUPPLIER_UPDATE', id, 'Modified fields', JSON.stringify(updated));
  };

  const handleDeleteSupplier = async (id: string) => {
    const docRef = doc(db, 'suppliers', id);
    await deleteDoc(docRef);
    await logAuditAction('SUPPLIER_DELETE', id, 'Exist', 'Deleted supplier');
  };

  // Warehouse Master CRUD functions
  const handleAddWarehouse = async (warehouse: Omit<Warehouse, 'id' | 'createdAt'>) => {
    const docRef = await addDoc(collection(db, 'warehouses'), {
      ...warehouse,
      createdAt: new Date().toISOString()
    });

    if (warehouse.isDefault) {
      // Reset isDefault on other warehouses
      const otherWarehouses = warehouses.filter(w => w.id !== docRef.id && w.isDefault);
      for (const ow of otherWarehouses) {
        await updateDoc(doc(db, 'warehouses', ow.id), { isDefault: false });
      }
      // Update system settings defaultWarehouseId
      await setDoc(doc(db, 'systemSettings', 'default'), { defaultWarehouseId: docRef.id }, { merge: true });
      setSettings(prev => ({ ...prev, defaultWarehouseId: docRef.id }));
    }

    await logAuditAction('WAREHOUSE_ADD', warehouse.name, 'None', JSON.stringify(warehouse));
  };

  const handleUpdateWarehouse = async (id: string, updated: Partial<Warehouse>) => {
    const docRef = doc(db, 'warehouses', id);
    await updateDoc(docRef, updated);

    if (updated.isDefault === true) {
      // Reset isDefault on other warehouses
      const otherWarehouses = warehouses.filter(w => w.id !== id && w.isDefault);
      for (const ow of otherWarehouses) {
        await updateDoc(doc(db, 'warehouses', ow.id), { isDefault: false });
      }
      // Update system settings defaultWarehouseId
      await setDoc(doc(db, 'systemSettings', 'default'), { defaultWarehouseId: id }, { merge: true });
      setSettings(prev => ({ ...prev, defaultWarehouseId: id }));
    } else if (updated.isDefault === false && settings.defaultWarehouseId === id) {
      const remaining = warehouses.filter(w => w.id !== id);
      if (remaining.length > 0) {
        const nextDefault = remaining[0];
        await updateDoc(doc(db, 'warehouses', nextDefault.id), { isDefault: true });
        await setDoc(doc(db, 'systemSettings', 'default'), { defaultWarehouseId: nextDefault.id }, { merge: true });
        setSettings(prev => ({ ...prev, defaultWarehouseId: nextDefault.id }));
      }
    }

    await logAuditAction('WAREHOUSE_UPDATE', id, 'Modified fields', JSON.stringify(updated));
  };

  const handleDeleteWarehouse = async (id: string) => {
    const docRef = doc(db, 'warehouses', id);
    await deleteDoc(docRef);

    if (settings.defaultWarehouseId === id) {
      const remaining = warehouses.filter(w => w.id !== id);
      if (remaining.length > 0) {
        const nextDefault = remaining[0];
        await updateDoc(doc(db, 'warehouses', nextDefault.id), { isDefault: true });
        await setDoc(doc(db, 'systemSettings', 'default'), { defaultWarehouseId: nextDefault.id }, { merge: true });
        setSettings(prev => ({ ...prev, defaultWarehouseId: nextDefault.id }));
      } else {
        await setDoc(doc(db, 'systemSettings', 'default'), { defaultWarehouseId: '' }, { merge: true });
        setSettings(prev => ({ ...prev, defaultWarehouseId: '' }));
      }
    }

    await logAuditAction('WAREHOUSE_DELETE', id, 'Exist', 'Deleted warehouse');
  };

  // UI Loading State
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <div className="text-xs font-mono text-slate-400">LOADING INVOICE DATABASE WORKSPACE...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/70 flex font-sans text-slate-800 antialiased">
      {/* Sidebar navigation */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
      />

      {/* Main Content Area */}
      <main className="flex-1 min-h-screen flex flex-col ml-0 md:ml-64 transition-all duration-300">
        
        {/* Sticky Header */}
        <header className="h-16 bg-white/90 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-20 flex items-center justify-between px-6 md:px-8 shrink-0 shadow-xs">
          <div className="flex items-center gap-3">
            <h2 className="text-base md:text-lg font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <span>{
                activeTab === 'dashboard' ? 'ダッシュボード' :
                activeTab === 'bulk-allocation' ? '複数クリニック一括発送' :
                activeTab === 'shipments' ? '発送履歴・帳票管理' :
                activeTab === 'stock-input' ? '在庫入庫登録・履歴' :
                activeTab === 'stock-management' ? '拠点在庫一元管理' :
                activeTab === 'clinics' ? 'クリニックマスタ' :
                activeTab === 'products' ? '製剤マスタ' :
                activeTab === 'warehouses' ? '発送元倉庫マスタ' :
                activeTab === 'suppliers' ? '入荷元マスタ' :
                activeTab === 'audit-logs' ? '監査ログ' :
                activeTab === 'settings' ? 'システム設定' : '薬製発送インボイス'
              }</span>
            </h2>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 hidden sm:inline-block">
              {activeTab.toUpperCase()}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider leading-none">本日</p>
              <p className="text-xs font-bold text-slate-700 mt-0.5 font-mono">
                {new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}
              </p>
            </div>
            {activeTab === 'dashboard' && (
              <button 
                type="button"
                onClick={() => setActiveTab('bulk-allocation')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs transition-all shadow-sm hover:shadow-md cursor-pointer flex items-center gap-1.5"
              >
                <span className="text-base leading-none">+</span>
                <span>新規発送作成</span>
              </button>
            )}
          </div>
        </header>

        {/* Content Container */}
        <div className="p-5 md:p-8 flex-1 flex flex-col space-y-6 overflow-x-hidden">
          {/* Quick Seed Warning Bar (Only displayed if products are empty) */}
          {products.length === 0 && (
            <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-white p-4 rounded-2xl shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 border border-amber-400">
              <div className="text-xs font-bold leading-relaxed flex items-center gap-2">
                <span className="text-base">⚠️</span>
                <span>データベース（Firestore）が空です。検証用にボツラックス等の製剤、江南倉庫、品川クリニックを含む初期テストデータをワンクリックで自動構築できます。</span>
              </div>
              <button
                type="button"
                onClick={handleSeedDatabase}
                className="bg-slate-900 hover:bg-black text-white font-extrabold text-xs px-4 py-2 rounded-xl cursor-pointer transition-colors shadow-sm shrink-0"
              >
                シードデータをインポートする
              </button>
            </div>
          )}

          {/* Tab router mapping */}
          {activeTab === 'dashboard' && (
            <Dashboard 
              products={products} 
              clinics={clinics} 
              shipments={shipments} 
              setActiveTab={setActiveTab}
            />
          )}

          {activeTab === 'bulk-allocation' && (
            <BulkAllocation 
              products={products}
              warehouses={warehouses}
              clinics={clinics}
              lots={lots}
              currentUser={currentUser}
              settings={settings}
              onSubmitBulkShipments={handleBulkShipmentsSubmit}
            />
          )}

          {activeTab === 'shipments' && (
            <ShipmentHistory 
              shipments={shipments}
              products={products}
              warehouses={warehouses}
              clinics={clinics}
              settings={settings}
              onUpdateShipmentStatus={handleUpdateShipmentStatus}
              onDeleteShipment={handleDeleteShipment}
              onEditShipment={handleEditShipment}
              onDuplicateShipment={handleDuplicateShipment}
            />
          )}

          {activeTab === 'stock-input' && (
            <StockInput 
              products={products}
              warehouses={warehouses}
              transactions={transactions}
              lots={lots}
              suppliers={suppliers}
              currentUser={currentUser}
              onAddStock={handleAddStock}
              onAdjustLot={handleAdjustLot}
            />
          )}

          {activeTab === 'stock-management' && (
            <StockManagement 
              products={products}
              warehouses={warehouses}
              lots={lots}
              transactions={transactions}
              suppliers={suppliers}
              currentUser={currentUser}
              onAddStock={handleAddStock}
              onAdjustLot={handleAdjustLot}
              onTransferStock={handleTransferStock}
              onDeleteLot={handleDeleteLot}
            />
          )}

          {activeTab === 'clinics' && (
            <ClinicMaster 
              clinics={clinics}
              onAddClinic={handleAddClinic}
              onUpdateClinic={handleUpdateClinic}
              onDeleteClinic={handleDeleteClinic}
              onImportClinics={handleImportClinics}
            />
          )}

          {activeTab === 'products' && (
            <ProductMaster 
              products={products}
              lots={lots}
              warehouses={warehouses}
              currentUserRole={currentUser.role}
              onAddProduct={handleAddProduct}
              onUpdateProduct={handleUpdateProduct}
              onDeleteProduct={handleDeleteProduct}
              onImportProducts={handleImportProducts}
            />
          )}

          {activeTab === 'warehouses' && (
            <WarehouseMaster 
              warehouses={warehouses}
              settings={settings}
              onAddWarehouse={handleAddWarehouse}
              onUpdateWarehouse={handleUpdateWarehouse}
              onDeleteWarehouse={handleDeleteWarehouse}
            />
          )}

          {activeTab === 'suppliers' && (
            <SupplierMaster 
              suppliers={suppliers}
              currentUserRole={currentUser.role}
              onAddSupplier={handleAddSupplier}
              onUpdateSupplier={handleUpdateSupplier}
              onDeleteSupplier={handleDeleteSupplier}
            />
          )}

          {activeTab === 'settings' && (
            <SystemSettings 
              settings={settings}
              warehouses={warehouses}
              onSaveSettings={handleSaveSettings}
            />
          )}

          {activeTab === 'audit-logs' && (
            <AuditLogs logs={auditLogs} />
          )}
        </div>

        {/* Footer Info */}
        <footer className="h-12 bg-white/60 border-t border-slate-200/80 px-6 md:px-8 flex items-center justify-between text-[11px] font-medium text-slate-400 shrink-0">
          <div>&copy; 2026 MediFlow Logistics OS</div>
          <div className="flex items-center gap-3">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span>クラウド同期中</span>
          </div>
        </footer>
      </main>
    </div>
  );
}

import { Clinic, Product, Shipment, ShipmentItem, Warehouse, SystemSettings } from '../types';
import { SAMPLE_CLINICS_MASTER, SAMPLE_PRODUCTS_MASTER } from '../data/sampleClinicProductData';

export interface ParsedCsvRow {
  rawRowIndex: number;
  clinicNameRaw: string;
  recipientRaw: string;
  invoiceNoRaw: string;
  productNameRaw: string;
  qtyRaw: number;
  extraColumns: string[];
}

export interface ClinicDataValidation {
  isIncomplete: boolean;
  missingFieldLabels: string[]; // e.g. ['クリニック名英語表記', '医師名英語表記', '電話番号', 'インボイス用英語住所']
  missingFields: {
    nameEn: boolean;         // クリニック名英語表記
    doctorNameEn: boolean;   // 医師名英語表記
    phone: boolean;          // 電話番号
    addressEn: boolean;      // インボイス用英語住所
  };
  hasNameEn: boolean;
  hasDoctorNameEn: boolean;
  hasPhone: boolean;
  hasAddressEn: boolean;
}

/**
 * Validates whether the clinic has all 4 required fields for commercial invoice creation:
 * 1. クリニック名英語表記 (nameEn)
 * 2. 医師名英語表記 (doctorNameEn)
 * 3. 電話番号 (phone)
 * 4. インボイス用英語住所 (addressEn)
 */
export function validateClinicInvoiceCompleteness(clinic: Partial<Clinic> | null | undefined): ClinicDataValidation {
  const hasNameEn = Boolean(clinic?.nameEn && clinic.nameEn.trim());
  const cleanDocEn = clinic?.doctorNameEn ? clinic.doctorNameEn.replace(/^Dr\.?\s*/i, '').trim() : (clinic?.contactPersonEn ? clinic.contactPersonEn.replace(/^Dr\.?\s*/i, '').trim() : '');
  const hasDoctorNameEn = Boolean(cleanDocEn);
  const hasPhone = Boolean(clinic?.phone && clinic.phone.trim());
  const hasAddressEn = Boolean(clinic?.addressEn && clinic.addressEn.trim());

  const missingFieldLabels: string[] = [];
  if (!hasNameEn) missingFieldLabels.push('クリニック名英語表記');
  if (!hasDoctorNameEn) missingFieldLabels.push('医師名英語表記');
  if (!hasPhone) missingFieldLabels.push('電話番号');
  if (!hasAddressEn) missingFieldLabels.push('インボイス用英語住所');

  return {
    isIncomplete: missingFieldLabels.length > 0,
    missingFieldLabels,
    missingFields: {
      nameEn: !hasNameEn,
      doctorNameEn: !hasDoctorNameEn,
      phone: !hasPhone,
      addressEn: !hasAddressEn,
    },
    hasNameEn,
    hasDoctorNameEn,
    hasPhone,
    hasAddressEn,
  };
}

export interface ParsedClinicAllocation {
  id: string; // temporary key
  clinicNameCsv: string;
  matchedClinic: Clinic | null;
  isDbMatched: boolean;
  dbLookupSource: 'FIRESTORE' | 'MASTER_PRESET' | 'UNMATCHED';
  
  // Recipient info: strictly from DB as user instructed
  doctorNameEnFromDb: string;
  doctorNameJaFromDb: string;
  csvIgnoredRecipient: string;
  
  // Invoice No: strictly system-generated as user instructed
  systemGeneratedInvoiceNo: string;
  csvIgnoredInvoiceNo: string;

  // Validation alert details for required invoice fields
  clinicValidation: ClinicDataValidation;
  
  items: {
    id: string;
    productNameCsv: string;
    matchedProduct: Product | null;
    isProductDbMatched: boolean;
    sku: string;
    nameEn: string;
    nameJa: string;
    qty: number;
    unit: string;
    unitPrice: number;
    amount: number;
    weight: number;
    totalWeight: number;
    hsCode: string;
    countryOfOrigin: string;
  }[];

  totalQty: number;
  totalAmount: number;
  totalWeight: number;
  isValid: boolean;
  warnings: string[];
}

export interface CsvParseResult {
  allocations: ParsedClinicAllocation[];
  totalClinics: number;
  totalShipments: number;
  totalItemsCount: number;
  totalQuantity: number;
  totalAmount: number;
  unmatchedClinicsCount: number;
  incompleteClinicsCount: number;
  unmatchedProductsCount: number;
  detectedColumns: {
    clinicCol: number;
    recipientCol: number;
    invoiceCol: number;
    productCol: number;
    qtyCol: number;
  };
  warnings: string[];
}

/**
 * Standard CSV line splitter handling quoted strings with commas and escaped quotes
 */
export function parseCsvText(text: string): string[][] {
  const lines: string[][] = [];
  // Remove UTF-8 BOM if present
  const cleanText = text.replace(/^\uFEFF/, '');
  const rawLines = cleanText.split(/\r\n|\n|\r/);

  for (const rawLine of rawLines) {
    if (!rawLine.trim()) continue;

    const row: string[] = [];
    let insideQuotes = false;
    let currentCell = '';

    for (let i = 0; i < rawLine.length; i++) {
      const char = rawLine[i];
      const nextChar = rawLine[i + 1];

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          currentCell += '"';
          i++; // skip escaped quote
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === ',' && !insideQuotes) {
        row.push(currentCell.trim());
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
    row.push(currentCell.trim());
    lines.push(row);
  }

  return lines;
}

/**
 * String normalization for matching
 */
function normalizeStr(str: string): string {
  return (str || '')
    .toLowerCase()
    .replace(/[\s\u3000]+/g, '') // remove all half-width and full-width spaces
    .replace(/[（\(][^\)]*[）\)]/g, '') // remove parenthesized details
    .replace(/[-_・.#/]/g, '') // remove punctuation: hyphens, underscores, dots, hashes, slashes
    .trim();
}

/**
 * Standardize common packaging/product variants like "No.1" / "No 1" / "1"
 */
function canonicalProductKey(str: string): string {
  return normalizeStr(str)
    .replace(/no\.?(\d+)/g, '$1') // e.g. "no.1" -> "1", "no1" -> "1"
    .replace(/number(\d+)/g, '$1')
    .replace(/#(\d+)/g, '$1');
}

/**
 * Find clinic in user's DB or fallback sample master with tiered precision
 */
export function findMatchingClinic(
  clinicName: string, 
  dbClinics: Clinic[]
): { clinic: Clinic | null; source: 'FIRESTORE' | 'MASTER_PRESET' | 'UNMATCHED' } {
  if (!clinicName) return { clinic: null, source: 'UNMATCHED' };

  const cleanName = clinicName.trim();
  const cleanLower = cleanName.toLowerCase();
  const normalized = normalizeStr(cleanName);

  // Tier 1: Exact match in Firestore
  const exactDb = dbClinics.find(c => 
    c.name.trim() === cleanName || 
    (c.nameEn && c.nameEn.trim().toLowerCase() === cleanLower)
  );
  if (exactDb) return { clinic: exactDb, source: 'FIRESTORE' };

  // Tier 2: Exact match in Sample Master Preset
  const exactPreset = SAMPLE_CLINICS_MASTER.find(c => 
    c.name.trim() === cleanName || 
    (c.nameEn && c.nameEn.trim().toLowerCase() === cleanLower)
  );
  if (exactPreset) {
    return { 
      clinic: { id: `preset_${exactPreset.clinicId}`, ...exactPreset, createdAt: new Date().toISOString() }, 
      source: 'MASTER_PRESET' 
    };
  }

  // Tier 3: Normalized exact match in Firestore
  const normExactDb = dbClinics.find(c => {
    const cNormJa = normalizeStr(c.name);
    const cNormEn = normalizeStr(c.nameEn || '');
    return cNormJa === normalized || cNormEn === normalized;
  });
  if (normExactDb) return { clinic: normExactDb, source: 'FIRESTORE' };

  // Tier 4: Normalized exact match in Sample Master Preset
  const normExactPreset = SAMPLE_CLINICS_MASTER.find(c => {
    const pNormJa = normalizeStr(c.name);
    const pNormEn = normalizeStr(c.nameEn || '');
    return pNormJa === normalized || pNormEn === normalized;
  });
  if (normExactPreset) {
    return { 
      clinic: { id: `preset_${normExactPreset.clinicId}`, ...normExactPreset, createdAt: new Date().toISOString() }, 
      source: 'MASTER_PRESET' 
    };
  }

  // Tier 5: Safe substring match with minimum length constraints (prevent short strings matching)
  if (normalized.length >= 4) {
    const safeSubDb = dbClinics.find(c => {
      const cNormJa = normalizeStr(c.name);
      const cNormEn = normalizeStr(c.nameEn || '');
      if (cNormJa.length < 4 && cNormEn.length < 4) return false;
      return (cNormJa.length >= 4 && (cNormJa.includes(normalized) || normalized.includes(cNormJa))) ||
             (cNormEn.length >= 4 && (cNormEn.includes(normalized) || normalized.includes(cNormEn)));
    });
    if (safeSubDb) return { clinic: safeSubDb, source: 'FIRESTORE' };

    const safeSubPreset = SAMPLE_CLINICS_MASTER.find(c => {
      const pNormJa = normalizeStr(c.name);
      const pNormEn = normalizeStr(c.nameEn || '');
      if (pNormJa.length < 4 && pNormEn.length < 4) return false;
      return (pNormJa.length >= 4 && (pNormJa.includes(normalized) || normalized.includes(pNormJa))) ||
             (pNormEn.length >= 4 && (pNormEn.includes(normalized) || normalized.includes(pNormEn)));
    });
    if (safeSubPreset) {
      return { 
        clinic: { id: `preset_${safeSubPreset.clinicId}`, ...safeSubPreset, createdAt: new Date().toISOString() }, 
        source: 'MASTER_PRESET' 
      };
    }
  }

  return { clinic: null, source: 'UNMATCHED' };
}

/**
 * Find product in user's DB or fallback sample master with strict tiered matching
 */
export function findMatchingProduct(
  productName: string, 
  dbProducts: Product[]
): { product: Product | null; source: 'FIRESTORE' | 'MASTER_PRESET' | 'UNMATCHED' } {
  if (!productName) return { product: null, source: 'UNMATCHED' };

  const cleanName = productName.trim();
  const cleanLower = cleanName.toLowerCase();
  const normalized = normalizeStr(cleanName);
  const canonTarget = canonicalProductKey(cleanName);

  // -------------------------------------------------------------
  // Tier 1: Exact case-insensitive matches (Highest confidence)
  // -------------------------------------------------------------
  // 1a. In user's Firestore products
  const exactDb = dbProducts.find(p => 
    p.nameEn.trim().toLowerCase() === cleanLower ||
    p.nameJa.trim().toLowerCase() === cleanLower ||
    p.sku.trim().toLowerCase() === cleanLower
  );
  if (exactDb) return { product: exactDb, source: 'FIRESTORE' };

  // 1b. In Sample Products Master preset
  const exactPreset = SAMPLE_PRODUCTS_MASTER.find(p => 
    p.nameEn.toLowerCase() === cleanLower ||
    p.nameJa.toLowerCase() === cleanLower ||
    p.sku.toLowerCase() === cleanLower
  );
  if (exactPreset) {
    return {
      product: { id: `preset_${exactPreset.productId}`, ...exactPreset, createdAt: new Date().toISOString() },
      source: 'MASTER_PRESET'
    };
  }

  // -------------------------------------------------------------
  // Tier 2: Canonical Exact Matches (Resolves "No.1" vs "1" etc.)
  // -------------------------------------------------------------
  // 2a. In user's Firestore products
  const canonDb = dbProducts.find(p => {
    // Ignore corrupted/empty short single character names from matching
    if (p.nameEn.trim().length <= 1 && cleanLower.length > 2) return false;
    return canonicalProductKey(p.nameEn) === canonTarget || 
           canonicalProductKey(p.nameJa) === canonTarget ||
           canonicalProductKey(p.sku) === canonTarget;
  });
  if (canonDb) return { product: canonDb, source: 'FIRESTORE' };

  // 2b. In Sample Products Master preset
  const canonPreset = SAMPLE_PRODUCTS_MASTER.find(p => 
    canonicalProductKey(p.nameEn) === canonTarget || 
    canonicalProductKey(p.nameJa) === canonTarget ||
    canonicalProductKey(p.sku) === canonTarget
  );
  if (canonPreset) {
    return {
      product: { id: `preset_${canonPreset.productId}`, ...canonPreset, createdAt: new Date().toISOString() },
      source: 'MASTER_PRESET'
    };
  }

  // -------------------------------------------------------------
  // Tier 3: Normalized Exact Matches (Symbols/spaces removed)
  // -------------------------------------------------------------
  // 3a. In user's Firestore products
  const normExactDb = dbProducts.find(p => {
    if (p.nameEn.trim().length <= 1 && cleanLower.length > 2) return false;
    return normalizeStr(p.nameEn) === normalized || 
           normalizeStr(p.nameJa) === normalized ||
           normalizeStr(p.sku) === normalized;
  });
  if (normExactDb) return { product: normExactDb, source: 'FIRESTORE' };

  // 3b. In Sample Products Master preset
  const normExactPreset = SAMPLE_PRODUCTS_MASTER.find(p => 
    normalizeStr(p.nameEn) === normalized || 
    normalizeStr(p.nameJa) === normalized ||
    normalizeStr(p.sku) === normalized
  );
  if (normExactPreset) {
    return {
      product: { id: `preset_${normExactPreset.productId}`, ...normExactPreset, createdAt: new Date().toISOString() },
      source: 'MASTER_PRESET'
    };
  }

  // -------------------------------------------------------------
  // Tier 4: Safe Substring / Fuzzy match with strict thresholds
  // NOTE: NEVER allow short strings (< 4 chars) to match via includes!
  // This prevents garbage records like "1" from matching "The Chaeum premium No.1"
  // -------------------------------------------------------------
  if (normalized.length >= 4) {
    // Check Firestore
    let bestDbMatch: { product: Product; score: number } | null = null;
    for (const p of dbProducts) {
      if (!p.nameEn || p.nameEn.trim().length < 4) continue;
      const pNormEn = normalizeStr(p.nameEn);
      const pNormJa = normalizeStr(p.nameJa || '');
      
      const checkCandidate = (candNorm: string) => {
        if (candNorm.length < 4) return 0;
        if (candNorm === normalized) return 1.0;
        if (candNorm.includes(normalized)) return normalized.length / candNorm.length;
        if (normalized.includes(candNorm)) return candNorm.length / normalized.length;
        return 0;
      };

      const score = Math.max(checkCandidate(pNormEn), checkCandidate(pNormJa));
      if (score >= 0.75) {
        if (!bestDbMatch || score > bestDbMatch.score) {
          bestDbMatch = { product: p, score };
        }
      }
    }
    if (bestDbMatch) return { product: bestDbMatch.product, source: 'FIRESTORE' };

    // Check Sample Master Preset
    let bestPresetMatch: { preset: typeof SAMPLE_PRODUCTS_MASTER[0]; score: number } | null = null;
    for (const p of SAMPLE_PRODUCTS_MASTER) {
      const pNormEn = normalizeStr(p.nameEn);
      const pNormJa = normalizeStr(p.nameJa || '');

      const checkCandidate = (candNorm: string) => {
        if (candNorm.length < 4) return 0;
        if (candNorm === normalized) return 1.0;
        if (candNorm.includes(normalized)) return normalized.length / candNorm.length;
        if (normalized.includes(candNorm)) return candNorm.length / normalized.length;
        return 0;
      };

      const score = Math.max(checkCandidate(pNormEn), checkCandidate(pNormJa));
      if (score >= 0.75) {
        if (!bestPresetMatch || score > bestPresetMatch.score) {
          bestPresetMatch = { preset: p, score };
        }
      }
    }
    if (bestPresetMatch) {
      return {
        product: { 
          id: `preset_${bestPresetMatch.preset.productId}`, 
          ...bestPresetMatch.preset, 
          createdAt: new Date().toISOString() 
        },
        source: 'MASTER_PRESET'
      };
    }
  }

  return { product: null, source: 'UNMATCHED' };
}

/**
 * Core parsing and database matching engine according to user requirements:
 * 1. Column A: Clinic name (check DB, pull matched clinic details)
 * 2. Column B: Ignore CSV value! Pull recipient/doctor name strictly from DB
 * 3. Column C: Ignore CSV value! Generate invoice number automatically by system
 * 4. Column E (or D depending on file structure): Product name (look up in DB)
 * 5. Column F (or E): Quantity
 * 6. Column G+: Ignore
 */
export function parseShippingCsv(
  csvText: string,
  dbClinics: Clinic[],
  dbProducts: Product[],
  settings?: SystemSettings,
  columnMappingOverride?: {
    productCol?: number;
    qtyCol?: number;
  }
): CsvParseResult {
  const rawRows = parseCsvText(csvText);
  const warnings: string[] = [];

  if (rawRows.length === 0) {
    return {
      allocations: [],
      totalClinics: 0,
      totalShipments: 0,
      totalItemsCount: 0,
      totalQuantity: 0,
      totalAmount: 0,
      unmatchedClinicsCount: 0,
      incompleteClinicsCount: 0,
      unmatchedProductsCount: 0,
      detectedColumns: { clinicCol: 0, recipientCol: 1, invoiceCol: 2, productCol: 3, qtyCol: 4 },
      warnings: ['CSVデータが空です。']
    };
  }

  // Column detection
  let clinicCol = 0;
  let recipientCol = 1;
  let invoiceCol = 2;
  let productCol = 3;
  let qtyCol = 4;

  let startRowIdx = 0;

  // Scan first few rows to locate headers
  for (let r = 0; r < Math.min(rawRows.length, 5); r++) {
    const row = rawRows[r];
    const rowStr = row.join(' ').toLowerCase();

    // Check if this row is a header row
    if (rowStr.includes('company name') || rowStr.includes('クリニック') || rowStr.includes('recipient') || rowStr.includes('packaging items') || rowStr.includes('quantity')) {
      startRowIdx = r + 1;

      // Identify columns from header
      row.forEach((cell, idx) => {
        const cLower = cell.toLowerCase().trim();
        if (cLower.includes('company') || cLower.includes('clinic') || cLower.includes('クリニック') || cLower.includes('医院')) {
          clinicCol = idx;
        } else if (cLower.includes('recipient') || cLower.includes('受取') || cLower.includes('宛名') || cLower.includes('医師')) {
          recipientCol = idx;
        } else if (cLower.includes('invoice number') || cLower.includes('invoice') || cLower.includes('インボイス番号')) {
          invoiceCol = idx;
        } else if (cLower.includes('packaging items') || cLower.includes('product') || cLower.includes('品名') || cLower.includes('製剤') || cLower.includes('商品')) {
          productCol = idx;
        } else if (cLower.includes('quantity') || cLower.includes('qty') || cLower.includes('個数') || cLower.includes('数量')) {
          qtyCol = idx;
        }
      });
      break;
    }
  }

  // Override if manually specified
  if (columnMappingOverride?.productCol !== undefined) productCol = columnMappingOverride.productCol;
  if (columnMappingOverride?.qtyCol !== undefined) qtyCol = columnMappingOverride.qtyCol;

  // Group rows into clinics
  const allocations: ParsedClinicAllocation[] = [];
  let currentAlloc: ParsedClinicAllocation | null = null;
  let clinicCounter = 0;

  const dateStr = (new Date()).toISOString().slice(2, 10).replace(/-/g, ''); // YYMMDD
  const basePrefix = settings?.prefix || 'INV-';

  for (let r = startRowIdx; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (row.length === 0) continue;

    const colAVal = (row[clinicCol] || '').trim();
    const colBVal = (row[recipientCol] || '').trim();
    const colCVal = (row[invoiceCol] || '').trim();
    const colProductVal = (row[productCol] || '').trim();
    const colQtyStr = (row[qtyCol] || '').trim();

    // Check if this row is an informational header repeated or blank row
    if (colAVal.toLowerCase().includes('company name') || (colAVal === '' && colProductVal === '')) {
      continue;
    }

    // New Clinic Row detected
    if (colAVal !== '') {
      clinicCounter++;
      const matched = findMatchingClinic(colAVal, dbClinics);
      const clinicObj = matched.clinic;
      const clinicValidation = validateClinicInvoiceCompleteness(clinicObj);

      // Rule: System generates the invoice number (CSV Column C is ignored)
      const paddedNum = String(clinicCounter).padStart(3, '0');
      const generatedInvoiceNo = `${basePrefix}${dateStr}-${paddedNum}`;

      // Rule: Recipient is pulled strictly from DB (CSV Column B is ignored, strictly WITHOUT "Dr." prefix)
      const rawDocEn = clinicObj?.doctorNameEn || '';
      const docEn = rawDocEn.replace(/^Dr\.?\s*/i, '').trim();
      const docJa = clinicObj?.doctorName || clinicObj?.contactPerson || '';

      currentAlloc = {
        id: `alloc_${clinicCounter}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        clinicNameCsv: colAVal,
        matchedClinic: clinicObj,
        isDbMatched: matched.source === 'FIRESTORE',
        dbLookupSource: matched.source,
        doctorNameEnFromDb: docEn,
        doctorNameJaFromDb: docJa,
        csvIgnoredRecipient: colBVal,
        systemGeneratedInvoiceNo: generatedInvoiceNo,
        csvIgnoredInvoiceNo: colCVal,
        clinicValidation,
        items: [],
        totalQty: 0,
        totalAmount: 0,
        totalWeight: 0,
        isValid: true,
        warnings: []
      };

      if (matched.source === 'UNMATCHED') {
        currentAlloc.warnings.push(`クリニック「${colAVal}」がデータベースに未登録です。`);
      } else if (matched.source === 'MASTER_PRESET') {
        currentAlloc.warnings.push(`マスタープリセットから自動補完しました（未確定）。`);
      }

      if (clinicValidation.isIncomplete) {
        currentAlloc.warnings.push(`【データ不十分】必須項目未入力: ${clinicValidation.missingFieldLabels.join('、')}`);
      }

      allocations.push(currentAlloc);
    }

    // Process Product Item (either on the clinic row or continuation rows)
    if (currentAlloc && colProductVal !== '') {
      const rawQty = parseInt(colQtyStr.replace(/[^\d]/g, ''), 10) || 1;
      const matchedProd = findMatchingProduct(colProductVal, dbProducts);
      const prodObj = matchedProd.product;

      const unitPrice = prodObj ? (prodObj.invoicePrice || 5000) : 5000;
      const unitWeight = prodObj ? (prodObj.weight || 0.04) : 0.04;
      const sku = prodObj ? prodObj.sku : `SKU-${normalizeStr(colProductVal).substring(0, 8).toUpperCase()}`;
      const nameEn = prodObj ? prodObj.nameEn : colProductVal;
      const nameJa = prodObj ? prodObj.nameJa : colProductVal;
      const unit = prodObj ? (prodObj.unit || 'vials') : 'vials';
      const hsCode = prodObj ? (prodObj.hsCode || '3004.90.9990') : '3004.90.9990';
      const origin = prodObj ? (prodObj.countryOfOrigin || 'South Korea') : 'South Korea';

      const lineAmount = rawQty * unitPrice;
      const lineWeight = rawQty * unitWeight;

      currentAlloc.items.push({
        id: `item_${currentAlloc.items.length + 1}_${Math.random().toString(36).substr(2, 5)}`,
        productNameCsv: colProductVal,
        matchedProduct: prodObj,
        isProductDbMatched: matchedProd.source === 'FIRESTORE',
        sku,
        nameEn,
        nameJa,
        qty: rawQty,
        unit,
        unitPrice,
        amount: lineAmount,
        weight: unitWeight,
        totalWeight: lineWeight,
        hsCode,
        countryOfOrigin: origin
      });

      currentAlloc.totalQty += rawQty;
      currentAlloc.totalAmount += lineAmount;
      currentAlloc.totalWeight = parseFloat((currentAlloc.totalWeight + lineWeight).toFixed(3));

      if (matchedProd.source === 'UNMATCHED') {
        currentAlloc.warnings.push(`製剤「${colProductVal}」がデータベースに未登録です。`);
      }
    }
  }

  // Summary calculations
  let totalItemsCount = 0;
  let totalQuantity = 0;
  let totalAmount = 0;
  let unmatchedClinicsCount = 0;
  let incompleteClinicsCount = 0;
  let unmatchedProductsCount = 0;

  allocations.forEach(alloc => {
    totalItemsCount += alloc.items.length;
    totalQuantity += alloc.totalQty;
    totalAmount += alloc.totalAmount;

    if (!alloc.isDbMatched) unmatchedClinicsCount++;
    if (alloc.clinicValidation.isIncomplete) incompleteClinicsCount++;
    alloc.items.forEach(it => {
      if (!it.isProductDbMatched) unmatchedProductsCount++;
    });
  });

  return {
    allocations,
    totalClinics: allocations.length,
    totalShipments: allocations.length,
    totalItemsCount,
    totalQuantity,
    totalAmount,
    unmatchedClinicsCount,
    incompleteClinicsCount,
    unmatchedProductsCount,
    detectedColumns: { clinicCol, recipientCol, invoiceCol, productCol, qtyCol },
    warnings
  };
}

/**
 * Convert parsed allocations into complete Shipment records ready for PDF generation & Firestore saving
 */
export function convertAllocationsToShipments(
  allocations: ParsedClinicAllocation[],
  defaultWarehouse: Warehouse,
  settings: SystemSettings,
  shippingDate?: string,
  currency: 'JPY' | 'USD' | 'KRW' | 'EUR' = 'JPY'
): Shipment[] {
  const targetDate = shippingDate || new Date().toISOString().substring(0, 10);

  return allocations.map(alloc => {
    const clinicSnapshot: Partial<Clinic> = alloc.matchedClinic ? {
      ...alloc.matchedClinic,
      name: alloc.matchedClinic.name || alloc.clinicNameCsv,
      nameEn: alloc.matchedClinic.nameEn || '',
      doctorName: alloc.doctorNameJaFromDb || alloc.matchedClinic.doctorName || '',
      doctorNameEn: alloc.doctorNameEnFromDb || alloc.matchedClinic.doctorNameEn || '',
      phone: alloc.matchedClinic.phone || '',
      addressEn: alloc.matchedClinic.addressEn || '',
    } : {
      name: alloc.clinicNameCsv,
      nameEn: '',
      doctorName: alloc.doctorNameJaFromDb || '',
      doctorNameEn: alloc.doctorNameEnFromDb || '',
      address: '',
      addressEn: '',
      phone: '',
      zip: ''
    };

    const items: ShipmentItem[] = alloc.items.map(it => ({
      productId: it.matchedProduct?.id || `prd_${it.sku}`,
      sku: it.sku,
      nameEn: it.nameEn,
      nameJa: it.nameJa,
      lotNo: it.matchedProduct?.lotNo || 'LOT-260901',
      expiryDate: it.matchedProduct?.expiryDate || '2028-12-31',
      qty: it.qty,
      unit: it.unit,
      unitPrice: it.unitPrice,
      amount: it.amount,
      weight: it.weight,
      totalWeight: it.totalWeight,
      hsCode: it.hsCode,
      countryOfOrigin: it.countryOfOrigin
    }));

    const nowIso = new Date().toISOString();

    return {
      id: `shipment_${alloc.systemGeneratedInvoiceNo}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      invoiceNo: alloc.systemGeneratedInvoiceNo,
      date: targetDate,
      warehouseId: defaultWarehouse.id,
      warehouseSnapshot: defaultWarehouse,
      clinicId: alloc.matchedClinic?.id || alloc.id,
      clinicSnapshot,
      currency,
      courier: 'EMS / DHL Express',
      trackingNo: '',
      shippingCost: 0,
      insurance: 0,
      otherCharges: 0,
      notes: `CSV一括インボイス作成 (原データクリニック名: ${alloc.clinicNameCsv})`,
      items,
      totalQty: alloc.totalQty,
      totalWeight: alloc.totalWeight,
      totalItemsAmount: alloc.totalAmount,
      totalInvoiceAmount: alloc.totalAmount,
      status: 'CONFIRMED',
      createdBy: 'system',
      createdByName: 'システム自動インポート',
      updatedBy: 'system',
      updatedByName: 'システム自動インポート',
      createdAt: nowIso,
      updatedAt: nowIso,
      history: [
        {
          date: nowIso,
          user: 'システム',
          action: 'CREATED_FROM_CSV',
          detail: `CSV出荷資料からインボイス自動生成 (${alloc.items.length}品目, 合計${alloc.totalQty}点)`
        }
      ]
    };
  });
}

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
  onDeleteAllClinics?: () => Promise<void>;
  onImportClinics: (clinics: Omit<Clinic, 'id' | 'createdAt'>[], replaceAll?: boolean) => Promise<void>;
}

export default function ClinicMaster({ 
  clinics, 
  onAddClinic, 
  onUpdateClinic, 
  onDeleteClinic,
  onDeleteAllClinics,
  onImportClinics
}: ClinicMasterProps) {
  
  // States
  const [searchQuery, setSearchQuery] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingClinic, setEditingClinic] = useState<Clinic | null>(null);
  const [isCsvImportOpen, setIsCsvImportOpen] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [replaceAllMode, setReplaceAllMode] = useState(false);
  const [csvPreview, setCsvPreview] = useState<any[]>([]);
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

    const cleanDoctorNameEn = (formFields.doctorNameEn || '').replace(/^Dr\.?\s*/i, '').trim();
    const payload = {
      ...formFields,
      doctorNameEn: cleanDoctorNameEn,
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

  // Helper to clean and unquote CSV field values and collapse internal newlines
  const cleanCsvField = (field: string): string => {
    if (!field) return '';
    let val = field.trim();
    // Strip enclosing quotes (handles multiple enclosing levels e.g. """...""")
    while ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1).trim();
    }
    // Replace internal newlines (\r\n, \r, \n) with a space and condense whitespace
    val = val.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ');
    return val.trim();
  };

  // Full RFC-4180 compliant CSV parser that properly preserves multiline cells across lines
  const parseCsvToRecords = (csvText: string): string[][] => {
    let text = csvText;
    // Strip UTF-8 BOM if present
    if (text.charCodeAt(0) === 0xFEFF) {
      text = text.slice(1);
    }

    const records: string[][] = [];
    let currentRecord: string[] = [];
    let currentField = '';
    let inQuotes = false;
    let quoteChar = '"';
    let i = 0;
    const len = text.length;

    while (i < len) {
      const char = text[i];

      if (inQuotes) {
        if (char === quoteChar) {
          // Escaped quote: "" or ''
          if (i + 1 < len && text[i + 1] === quoteChar) {
            currentField += char;
            i += 2;
          } else {
            inQuotes = false;
            i++;
          }
        } else {
          // Inside quoted cell: retain newlines and all characters
          currentField += char;
          i++;
        }
      } else {
        if (char === '"' || char === "'") {
          // Opening quote for empty or whitespace-only field
          if (currentField.trim() === '') {
            inQuotes = true;
            quoteChar = char;
            currentField = '';
            i++;
          } else {
            currentField += char;
            i++;
          }
        } else if (char === ',') {
          currentRecord.push(cleanCsvField(currentField));
          currentField = '';
          i++;
        } else if (char === '\r') {
          if (i + 1 < len && text[i + 1] === '\n') {
            i += 2;
          } else {
            i++;
          }
          currentRecord.push(cleanCsvField(currentField));
          if (currentRecord.some(c => c.length > 0)) {
            records.push(currentRecord);
          }
          currentRecord = [];
          currentField = '';
        } else if (char === '\n') {
          i++;
          currentRecord.push(cleanCsvField(currentField));
          if (currentRecord.some(c => c.length > 0)) {
            records.push(currentRecord);
          }
          currentRecord = [];
          currentField = '';
        } else {
          currentField += char;
          i++;
        }
      }
    }

    if (currentField.length > 0 || currentRecord.length > 0) {
      currentRecord.push(cleanCsvField(currentField));
      if (currentRecord.some(c => c.length > 0)) {
        records.push(currentRecord);
      }
    }

    return records;
  };

  // Check if the first row is a header row
  const isCsvHeaderRow = (record: string[]): boolean => {
    if (!record || record.length === 0) return false;

    const firstCol = (record[0] || '').trim();
    // If first column is purely numeric or starts with CLN-, it is definitely a data row, not a header
    if (/^[0-9]+$/.test(firstCol) || /^CLN-[0-9]+/i.test(firstCol)) {
      return false;
    }

    const headerKeywords = [
      'clinicid', 'クリニックid', 'クリニックｉｄ', 'クリニックコード', 'id', 'コード',
      'name', 'clinicname', 'クリニック名', '顧客名', '顧客', '施設名', '医院名', '病院名',
      'nameen', '英語表記', '英語名', '担当者', '院長名', '医師名', '住所', '電話番号', 'tel', 'phone', 'email'
    ];

    let matches = 0;
    for (const cell of record) {
      const clean = cell.toLowerCase().replace(/[\s\-_（）\(\)\/\\\:：]/g, '');
      if (headerKeywords.some(kw => clean === kw || clean.includes(kw))) {
        matches++;
      }
    }

    return matches >= 2;
  };

  // Helper to decode CSV buffer supporting Shift-JIS (Windows-31J) & UTF-8
  const decodeCsvBuffer = (buffer: ArrayBuffer): string => {
    // 1. Try UTF-8 with fatal: true
    try {
      const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
      const text = utf8Decoder.decode(buffer);
      // If no fatal error and does not contain replacement character \uFFFD or Shift-JIS mojibake marker
      if (!text.includes('\uFFFD') && !text.includes('NjbN')) {
        return text;
      }
    } catch {
      // Fall through to Shift-JIS
    }

    // 2. Try Shift-JIS (standard Excel export encoding in Japan)
    try {
      const sjisDecoder = new TextDecoder('shift-jis');
      const sjisText = sjisDecoder.decode(buffer);
      return sjisText;
    } catch {
      // 3. Relaxed UTF-8 fallback
      const fallbackDecoder = new TextDecoder('utf-8');
      return fallbackDecoder.decode(buffer);
    }
  };

  // Header column aliases mapping
  const headerAliasMap: Record<string, string> = {
    // Clinic ID (A列 / 1列目)
    clinicid: 'clinicId', 'クリニックid': 'clinicId', 'クリニックｉｄ': 'clinicId', 'クリニックコード': 'clinicId', id: 'clinicId', 'コード': 'clinicId', 'njbnid': 'clinicId',
    
    // Clinic Name / 顧客名 (B列 / 2列目)
    name: 'name', clinicname: 'name', 'クリニック名': 'name', 'クリニック名称': 'name', '名称': 'name', '施設名': 'name', '医院名': 'name', '病院名': 'name', '顧客名': 'name', '顧客': 'name', 'ڋq': 'name',
    
    // Clinic Name En / クリニック名英語表記 (C列 / 3列目)
    nameen: 'nameEn', clinicnameen: 'nameEn', 'クリニック名(英語)': 'nameEn', 'クリニック名（英語）': 'nameEn', 'クリニック名英語表記': 'nameEn', '英語表記': 'nameEn', '英語名': 'nameEn', '英語名称': 'nameEn', 'njbnp\\l': 'nameEn', 'njbnp/l': 'nameEn',
    
    // Contact Person / 担当者 (D列 / 4列目)
    contactperson: 'contactPerson', '担当者': 'contactPerson', '担当者名': 'contactPerson', '窓口': 'contactPerson', 's': 'contactPerson',
    
    // Doctor Name / 院長名 / 医師名 (E列 / 5列目)
    doctorname: 'doctorName', '医師名': 'doctorName', '医師名(日本語)': 'doctorName', '医師名（日本語）': 'doctorName', '院長名': 'doctorName', '院長名(日本語)': 'doctorName', '院長名（日本語）': 'doctorName', '院長': 'doctorName', '医師': 'doctorName', '@': 'doctorName',
    
    // Doctor Name En / 院長名英語表記 / 医師名英語表記 (F列 / 6列目)
    doctornameen: 'doctorNameEn', '医師名(英語)': 'doctorNameEn', '医師名（英語）': 'doctorNameEn', '医師英語名': 'doctorNameEn', '院長名(英語)': 'doctorNameEn', '院長名（英語）': 'doctorNameEn', '院長名英語表記': 'doctorNameEn', '@p\\l': 'doctorNameEn', '@p/l': 'doctorNameEn',
    
    // License url / 医師免許等 (G列 / 7列目)
    licenseurl: 'licenseUrl', '医師免許等': 'licenseUrl', '医師免許': 'licenseUrl', '免許証等': 'licenseUrl', '免許証': 'licenseUrl', '添付書類': 'licenseUrl', '添付書類等': 'licenseUrl', 'tƋ': 'licenseUrl',
    
    // Payment Method / 支払方法 (H列 / 8列目)
    paymentmethod: 'paymentMethod', '支払方法': 'paymentMethod', '支払い方法': 'paymentMethod', '決済方法': 'paymentMethod', 'x@': 'paymentMethod',
    
    // Closing Day / 締日 (I列 / 9列目)
    closingday: 'closingDay', '締日': 'closingDay', '締め日': 'closingDay',
    
    // Payment Day / 支払日 (J列 / 10列目)
    paymentday: 'paymentDay', '支払日': 'paymentDay', '支払期日': 'paymentDay', 'x': 'paymentDay',
    
    // Email 1 / メールアドレス1 (K列 / 11列目)
    email: 'email', mail: 'email', 'メール': 'email', 'メールアドレス': 'email', 'メールアドレス1': 'email', 'メール1': 'email', '[ahx1': 'email',
    
    // Email 2 / メールアドレス2 (L列 / 12列目)
    email2: 'email2', 'メールアドレス2': 'email2', 'メール2': 'email2', '[ahx2': 'email2',
    
    // Phone / 電話番号 (M列 / 13列目)
    phone: 'phone', tel: 'phone', '電話番号': 'phone', '連絡先': 'phone', 'tel番号': 'phone', 'dbԍ': 'phone',
    
    // Address / クリニック住所 (N列 / 14列目)
    address: 'address', '住所': 'address', '番地': 'address', '住所(日本語)': 'address', '住所（日本語）': 'address', 'クリニック住所': 'address', '所在地': 'address', 'njbnz': 'address',
    
    // Address En / 住所英語表記 (O列 / 15列目)
    addressen: 'addressEn', '英語住所': 'addressEn', '住所(英語)': 'addressEn', '住所（英語）': 'addressEn', '住所英語表記': 'addressEn', 'zp\\l': 'addressEn', 'zp/l': 'addressEn',
    
    // Referrer / 顧客紹介者 (P列 / 16列目)
    referrer: 'referrer', '顧客紹介者': 'referrer', '紹介者': 'referrer', 'ڋqЉ': 'referrer',
    
    // Referral Commission / 紹介手数料率 (Q列 / 17列目)
    referralrate: 'referralRate', '紹介手数料率': 'referralRate', '紹介手数料': 'referralRate', '手数料率': 'referralRate', '手数料': 'referralRate', 'Љ萔': 'referralRate',
    
    // Referral Items (R, S列 / 18, 19列目)
    referralitem1: 'referralItem1', '紹介品目（1）': 'referralItem1', '紹介品目(1)': 'referralItem1', '紹介品目1': 'referralItem1', 'Љ於i1j': 'referralItem1',
    referralitem2: 'referralItem2', '紹介品目（2）': 'referralItem2', '紹介品目(2)': 'referralItem2', '紹介品目2': 'referralItem2', 'Љ於i2j': 'referralItem2',
    
    // Legacy / other common headers
    corporationname: 'corporationName', '法人名': 'corporationName', '医療法人名': 'corporationName',
    zip: 'zip', postalcode: 'zip', '郵便番号': 'zip', '〒': 'zip',
    prefecture: 'prefecture', '都道府県': 'prefecture',
    city: 'city', '市区町村': 'city',
    building: 'building', '建物名': 'building', 'ビル名': 'building',
    notes: 'notes', memo: 'notes', '備考': 'notes', 'メモ': 'notes',
    active: 'active', status: 'active', 'ステータス': 'active', '有効': 'active'
  };

  // CSV Import parsing logic
  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const buffer = event.target?.result as ArrayBuffer;
      const text = decodeCsvBuffer(buffer);
      
      // Parse CSV into 2D records using the multiline-aware state machine
      const records = parseCsvToRecords(text);
      if (records.length === 0) {
        alert('CSVファイルが空です。');
        return;
      }

      const isHeaderRow = isCsvHeaderRow(records[0]);
      const rawHeaders = isHeaderRow ? records[0] : [];
      const mappedHeaders = isHeaderRow 
        ? rawHeaders.map(h => {
            const key = h.toLowerCase().replace(/[\s\-_]/g, '');
            return headerAliasMap[key] || headerAliasMap[h] || h;
          })
        : [];

      const parsedData: any[] = [];
      const startLine = isHeaderRow ? 1 : 0;

      for (let i = startLine; i < records.length; i++) {
        const rowValues = records[i];
        // Skip completely empty lines where every cell is blank
        if (!rowValues || rowValues.every(val => !val || val.trim() === '')) {
          continue;
        }

        const actualCsvRowNum = i + 1;

        // Map columns if header row was present
        const rowObj: Record<string, string> = {};
        if (isHeaderRow) {
          mappedHeaders.forEach((header, idx) => {
            rowObj[header] = (rowValues[idx] || '').trim();
          });
        }

        // Positional fallback for the 19-column clinic format:
        // Col 0: clinicId (A列: クリニックID)
        // Col 1: name (B列: 顧客名)
        // Col 2: nameEn (C列: クリニック名英語表記)
        // Col 3: contactPerson (D列: 担当者)
        // Col 4: doctorName (E列: 院長名 / 医師名)
        // Col 5: doctorNameEn (F列: 院長名英語表記)
        // Col 6: licenseUrl (G列: 医師免許等)
        // Col 7: paymentMethod (H列: 支払方法)
        // Col 8: closingDay (I列: 締日)
        // Col 9: paymentDay (J列: 支払日)
        // Col 10: email1 (K列: メールアドレス1)
        // Col 11: email2 (L列: メールアドレス2)
        // Col 12: phone (M列: 電話番号)
        // Col 13: address (N列: クリニック住所)
        // Col 14: addressEn (O列: 住所英語表記)
        // Col 15: referrer (P列: 顧客紹介者)
        // Col 16: referralRate (Q列: 紹介手数料率)
        // Col 17: referralItem1 (R列: 紹介品目1)
        // Col 18: referralItem2 (S列: 紹介品目2)
        const is19ColFormat = rowValues.length >= 13;

        // Read columns EXACTLY as provided in CSV - DO NOT substitute or pack blanks across columns!
        let clinicId = (rowObj['clinicId'] || (is19ColFormat ? rowValues[0] : '') || '').trim();
        const name = (rowObj['name'] || (is19ColFormat ? rowValues[1] : '') || '').trim();
        const nameEn = (rowObj['nameEn'] || (is19ColFormat ? rowValues[2] : '') || '').trim();
        const contactPerson = (rowObj['contactPerson'] || (is19ColFormat && rowValues[3] ? rowValues[3] : '') || '').trim();
        const doctorName = (rowObj['doctorName'] || (is19ColFormat && rowValues[4] ? rowValues[4] : '') || '').trim();
        const doctorNameEn = (rowObj['doctorNameEn'] || (is19ColFormat && rowValues[5] ? rowValues[5] : '') || '').trim().replace(/^Dr\.?\s*/i, '');
        const licenseUrl = (rowObj['licenseUrl'] || (is19ColFormat && rowValues[6] ? rowValues[6] : '') || '').trim();
        const paymentMethod = (rowObj['paymentMethod'] || (is19ColFormat && rowValues[7] ? rowValues[7] : '') || '').trim();
        const closingDay = (rowObj['closingDay'] || (is19ColFormat && rowValues[8] ? rowValues[8] : '') || '').trim();
        const paymentDay = (rowObj['paymentDay'] || (is19ColFormat && rowValues[9] ? rowValues[9] : '') || '').trim();
        const email1 = (rowObj['email'] || (is19ColFormat && rowValues[10] ? rowValues[10] : '') || '').trim();
        const email2 = (rowObj['email2'] || (is19ColFormat && rowValues[11] ? rowValues[11] : '') || '').trim();
        const phone = (rowObj['phone'] || (is19ColFormat && rowValues[12] ? rowValues[12] : '') || '').trim();
        const rawAddress = (rowObj['address'] || (is19ColFormat && rowValues[13] ? rowValues[13] : '') || '').trim();
        const addressEn = (rowObj['addressEn'] || (is19ColFormat && rowValues[14] ? rowValues[14] : '') || '').trim();
        const referrer = (rowObj['referrer'] || (is19ColFormat && rowValues[15] ? rowValues[15] : '') || '').trim();
        const referralRate = (rowObj['referralRate'] || (is19ColFormat && rowValues[16] ? rowValues[16] : '') || '').trim();
        const referralItem1 = (rowObj['referralItem1'] || (is19ColFormat && rowValues[17] ? rowValues[17] : '') || '').trim();
        const referralItem2 = (rowObj['referralItem2'] || (is19ColFormat && rowValues[18] ? rowValues[18] : '') || '').trim();

        // Only assign auto-fallback ID if CSV completely lacks a clinicId
        if (!clinicId) {
          const autoNum = clinics.length + parsedData.length + 1;
          clinicId = `CLN-${String(autoNum).padStart(3, '0')}`;
        }

        // Auto-extract zip and prefecture if present in address string, preserving address as-is
        const zipMatch = rawAddress.match(/〒?\s*([0-9]{3}-?[0-9]{4})/);
        const zip = rowObj['zip'] || (zipMatch ? zipMatch[1] : '');
        const prefMatch = rawAddress.match(/^(東京都|北海道|(?:京都|大阪)府|.{2,3}県)/);
        const prefecture = rowObj['prefecture'] || (prefMatch ? prefMatch[1] : '');

        // Parse Active boolean
        const activeVal = (rowObj['active'] || '').toLowerCase();
        const active = activeVal === 'false' || activeVal === '無効' || activeVal === '0' ? false : true;

        // Check matching with existing clinic
        const idRaw = clinicId.toUpperCase();
        const idStripped = idRaw.replace(/^0+/, '');
        const nameLower = name.toLowerCase();

        const existingMatch = clinics.find(c => {
          const cId = (c.clinicId || '').toUpperCase();
          const cIdStripped = cId.replace(/^0+/, '');
          const cName = (c.name || '').toLowerCase();
          return (idRaw && cId === idRaw) ||
                 (idStripped && cIdStripped === idStripped) ||
                 (nameLower && cName && cName === nameLower);
        });

        parsedData.push({
          rowNum: actualCsvRowNum,
          isUpdate: !!existingMatch,
          matchedClinicId: existingMatch?.clinicId,
          clinicId,
          name, // exact CSV value, blank if blank
          nameEn, // exact CSV value, blank if blank (never filled with Japanese name)
          corporationName: rowObj['corporationName'] || '',
          contactPerson,
          doctorName,
          doctorNameEn,
          zip,
          prefecture,
          city: rowObj['city'] || '',
          address: rawAddress, // exact CSV address as-is
          building: rowObj['building'] || '',
          addressEn, // exact CSV English address as-is (never filled with Japanese address)
          phone,
          email: email1, // exact CSV Email 1
          email2, // exact CSV Email 2
          licenseUrl,
          paymentMethod,
          closingDay,
          paymentDay,
          referrer,
          referralRate,
          referralItem1,
          referralItem2,
          notes: rowObj['notes'] || '',
          active
        });
      }

      setCsvPreview(parsedData);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleConfirmImport = async () => {
    if (csvPreview.length === 0) {
      alert('インポート対象のデータがありません。');
      return;
    }

    try {
      // Ensure all fields are sanitized strings or booleans, NEVER undefined/null for Firestore
      const cleanData = csvPreview.map(({ rowNum, isUpdate, matchedClinicId, ...rest }) => {
        const sanitized: Record<string, any> = {};
        for (const [key, val] of Object.entries(rest)) {
          if (val === undefined || val === null) {
            sanitized[key] = '';
          } else if (typeof val === 'string') {
            sanitized[key] = val; // preserve exact string including empty strings ""
          } else {
            sanitized[key] = val;
          }
        }
        if (typeof sanitized.active !== 'boolean') sanitized.active = true;
        return sanitized;
      });

      await onImportClinics(cleanData as any, replaceAllMode);
      setIsCsvImportOpen(false);
      setCsvPreview([]);
      const updateCount = csvPreview.filter(p => p.isUpdate).length;
      const newCount = csvPreview.length - updateCount;
      if (replaceAllMode) {
        alert(`クリニックマスタ全置換インポートが完了しました（全 ${cleanData.length} 件をそのまま反映しました）`);
      } else {
        alert(`クリニックマスタのCSV反映が完了しました（全 ${cleanData.length} 件：既存更新 ${updateCount} 件、新規追加 ${newCount} 件）`);
      }
    } catch (err) {
      console.error('CSV import error:', err);
      alert('インポート中にエラーが発生しました。コンソールログを確認してください。');
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

  const handleConfirmDeleteAll = async () => {
    const confirmed = window.confirm(
      `【警告】クリニックマスタの全データ（${clinics.length}件）を完全に削除します。\n` +
      `この操作は取り消せません。再度CSVから登録し直す場合は「OK」を押してください。`
    );
    if (!confirmed) return;

    setIsDeletingAll(true);
    try {
      if (onDeleteAllClinics) {
        await onDeleteAllClinics();
        alert('クリニックマスタを全件削除しました。新しいCSVを取り込んでください。');
      }
    } catch (err: any) {
      console.error('Failed to delete all clinics:', err);
      alert('全件削除中にエラーが発生しました: ' + (err?.message || '不明なエラー'));
    } finally {
      setIsDeletingAll(false);
    }
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
          {clinics.length > 0 && onDeleteAllClinics && (
            <button
              type="button"
              onClick={handleConfirmDeleteAll}
              disabled={isDeletingAll}
              className="bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50 transition-colors"
              title="クリニックマスタの全データを削除します"
            >
              <Trash2 className="w-4 h-4 text-rose-500" />
              <span>{isDeletingAll ? '削除中...' : 'マスタ全件削除'}</span>
            </button>
          )}

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
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    医師名 (英語表記) <span className="text-slate-400 font-normal">(Dr.表記は不要)</span>
                  </label>
                  <input
                    type="text"
                    value={formFields.doctorNameEn}
                    onChange={(e) => setFormFields(prev => ({ ...prev, doctorNameEn: e.target.value }))}
                    className="w-full border border-slate-200 rounded px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                    placeholder="Tetsu Asai (※Dr.は記載不要)"
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
                }} 
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="bg-slate-50 p-4 rounded-lg text-xs text-slate-600 border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-slate-800">【対応CSVフォーマット】</p>
                  <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium border border-blue-200">
                    Shift-JIS / UTF-8 自動判定対応
                  </span>
                </div>
                <p>19列形式（クリニック一覧エクスポート）および従来形式の両方に対応しています：</p>
                <div className="font-mono bg-white p-2.5 rounded border border-slate-200 overflow-x-auto text-[10px] text-slate-700 leading-relaxed">
                  A:クリニックID, B:顧客名, C:クリニック名英語表記, D:担当者, E:院長名, F:院長名英語表記, G:医師免許等, H:支払方法, I:締日, J:支払日, K:メールアドレス1, L:メールアドレス2, M:電話番号, N:クリニック住所, O:住所英語表記, P:顧客紹介者, Q:紹介手数料率, R:紹介品目1, S:紹介品目2
                </div>
                <div className="flex flex-col gap-1 text-[11px] text-slate-600">
                  <p className="text-emerald-700 font-medium">
                    ✓ 既存反映ルール：クリニックID（000005743 / 5743など）またはクリニック名が一致するデータは、現在のクリニックマスタの情報を上書き更新します。一致しない場合は新規登録されます。
                  </p>
                  <p className="text-slate-500">
                    ✓ 住所・郵便番号・英語住所・医師名（Dr.接頭辞除去）なども自動補完・整形されます。
                  </p>
                </div>
              </div>

              {/* Replace all mode checkbox */}
              <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-3 flex items-start gap-2.5">
                <input
                  type="checkbox"
                  id="replaceAllClinics"
                  checked={replaceAllMode}
                  onChange={(e) => setReplaceAllMode(e.target.checked)}
                  className="mt-0.5 rounded text-amber-600 focus:ring-amber-500 h-4 w-4 border-amber-300"
                />
                <label htmlFor="replaceAllClinics" className="text-xs text-amber-900 cursor-pointer select-none">
                  <span className="font-bold">全置換モードで取り込む（危険）:</span> 既存のクリニックデータをすべて削除し、このCSVのデータのみでクリニックマスタを初期化・再構築します。
                  <span className="block text-[10px] text-amber-700 mt-0.5">※通常はチェックを外したままにしてください（既存データを安全に最新情報へ更新します）。</span>
                </label>
              </div>

              {/* Upload Dropzone */}
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:bg-slate-50 cursor-pointer transition-colors space-y-2"
              >
                <Upload className="w-7 h-7 text-slate-400 mx-auto" />
                <p className="text-xs font-bold text-slate-700">ファイルを選択、またはここにドラッグ＆ドロップしてください</p>
                <p className="text-[10px] text-slate-400">CSV形式ファイル（Excel出力のShift-JISまたはUTF-8）</p>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleCsvUpload}
                  accept=".csv"
                  className="hidden"
                />
              </div>

              {/* CSV Preview */}
              {csvPreview.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex flex-wrap justify-between items-center gap-2">
                    <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>インポートプレビュー (全 {csvPreview.length} 件)</span>
                      <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-bold border border-blue-200">
                        既存更新: {csvPreview.filter(r => r.isUpdate).length} 件
                      </span>
                      <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-bold border border-emerald-200">
                        新規追加: {csvPreview.filter(r => !r.isUpdate).length} 件
                      </span>
                    </h4>
                    <span className="text-[11px] text-slate-500">
                      ※空欄項目は他列で詰めず、そのまま空白として安全にFirestoreに保存されます
                    </span>
                  </div>
                  
                  <div className="border border-slate-200 rounded-lg overflow-hidden max-h-72 overflow-y-auto">
                    <table className="w-full text-left border-collapse text-[10px]">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600 tracking-wider sticky top-0 z-10 shadow-xs">
                          <th className="px-3 py-2 text-center">状態</th>
                          <th className="px-3 py-2">行</th>
                          <th className="px-3 py-2">クリニックID</th>
                          <th className="px-3 py-2">顧客名 / クリニック名</th>
                          <th className="px-3 py-2">英語表記</th>
                          <th className="px-3 py-2">院長名 (日/英)</th>
                          <th className="px-3 py-2">電話番号</th>
                          <th className="px-3 py-2">クリニック住所</th>
                          <th className="px-3 py-2">英語住所</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {csvPreview.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-3 py-2 text-center whitespace-nowrap">
                              {row.isUpdate ? (
                                <span className="bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded text-[9px] font-bold">
                                  既存更新
                                </span>
                              ) : (
                                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded text-[9px] font-bold">
                                  新規追加
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 font-mono text-slate-400">{row.rowNum}</td>
                            <td className="px-3 py-2 font-bold font-mono text-slate-800">{row.clinicId}</td>
                            <td className="px-3 py-2 text-slate-800 font-medium">
                              {row.name || <span className="text-slate-300 italic text-[10px]">(空白)</span>}
                            </td>
                            <td className="px-3 py-2 text-slate-600">
                              {row.nameEn || <span className="text-slate-300 italic text-[10px]">(空白)</span>}
                            </td>
                            <td className="px-3 py-2 text-slate-600">
                              {row.doctorName || row.doctorNameEn ? (
                                `${row.doctorName || '-'}${row.doctorNameEn ? ` (${row.doctorNameEn})` : ''}`
                              ) : (
                                <span className="text-slate-300 italic text-[10px]">-</span>
                              )}
                            </td>
                            <td className="px-3 py-2 font-mono text-slate-500">
                              {row.phone || <span className="text-slate-300 italic text-[10px]">-</span>}
                            </td>
                            <td className="px-3 py-2 text-slate-600 max-w-xs truncate" title={row.address}>
                              {row.address || <span className="text-slate-300 italic text-[10px]">(空白)</span>}
                            </td>
                            <td className="px-3 py-2 text-slate-500 max-w-xs truncate" title={row.addressEn}>
                              {row.addressEn || <span className="text-slate-300 italic text-[10px]">(空白)</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>

            {/* Import Footer actions */}
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="text-[11px] text-slate-500">
                {csvPreview.length > 0 && (
                  <span>
                    全 <strong className="text-slate-800">{csvPreview.length}</strong> 件のレコード（空欄項目もそのまま空白としてFirestoreに安全に反映されます）
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsCsvImportOpen(false);
                    setCsvPreview([]);
                  }}
                  className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  disabled={csvPreview.length === 0}
                  onClick={handleConfirmImport}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 text-white disabled:text-slate-400 px-5 py-2 rounded text-xs font-bold cursor-pointer transition-colors shadow-xs"
                >
                  {replaceAllMode ? '全置換インポートを実行' : 'CSVのデータをそのまま反映する'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

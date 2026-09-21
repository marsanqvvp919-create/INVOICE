import { useState, useEffect, useMemo } from 'react';
import { Shipment } from '../types';
import { parseInvoiceNo, isInvoiceMatchingDate } from './invoiceSequence';

export interface CachedInvoiceRecord {
  invoiceNo: string;
  date: string; // "YYYY-MM-DD"
  sequenceNumber: number;
  clinicName?: string;
  issuedAt: string; // ISO String
  source: 'ZIP_EXPORT' | 'PDF_DOWNLOAD' | 'DB_SAVE' | 'CSV_IMPORT' | 'MANUAL';
}

const STORAGE_KEY = 'AIS_TODAY_ISSUED_INVOICES_V1';
const CACHE_EVENT_NAME = 'ais-invoice-cache-updated';

/**
 * Safely reads all cached invoice records from localStorage.
 */
export function getAllCachedInvoices(): CachedInvoiceRecord[] {
  if (typeof window === 'undefined' || !window.localStorage) {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [];
  } catch (e) {
    console.warn('Failed to parse invoice cache from localStorage:', e);
    return [];
  }
}

/**
 * Writes records to localStorage and notifies active components.
 */
function writeCacheToStorage(records: CachedInvoiceRecord[]): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    // Keep at most 2000 recent records to prevent storage overflow
    const trimmed = records.slice(-2000);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    window.dispatchEvent(new CustomEvent(CACHE_EVENT_NAME));
  } catch (e) {
    console.error('Failed to write invoice cache to localStorage:', e);
  }
}

/**
 * Returns cached invoice records filtered for a specific date ("YYYY-MM-DD").
 */
export function getCachedInvoices(dateStr?: string): CachedInvoiceRecord[] {
  const all = getAllCachedInvoices();
  if (!dateStr) return all;
  return all.filter(r => r.date === dateStr || isInvoiceMatchingDate(r.invoiceNo, dateStr));
}

/**
 * Returns the highest sequence number found in the cache for the target date.
 */
export function getMaxSequenceFromCache(dateStr: string): number {
  const forDate = getCachedInvoices(dateStr);
  let maxSeq = 0;
  for (const item of forDate) {
    if (item.sequenceNumber && item.sequenceNumber > maxSeq) {
      maxSeq = item.sequenceNumber;
    }
    const parsed = parseInvoiceNo(item.invoiceNo);
    if (parsed?.sequence && parsed.sequence > maxSeq) {
      maxSeq = parsed.sequence;
    }
  }
  return Math.max(maxSeq, forDate.length);
}

/**
 * Returns a Set of all lowercase invoice numbers currently recorded in the cache.
 */
export function getUsedInvoiceNumbersFromCache(dateStr?: string): Set<string> {
  const records = dateStr ? getCachedInvoices(dateStr) : getAllCachedInvoices();
  const set = new Set<string>();
  for (const r of records) {
    if (r.invoiceNo) {
      set.add(r.invoiceNo.trim().toLowerCase());
    }
  }
  return set;
}

/**
 * Registers new issued invoice records into the persistent daily cache.
 * Automatically deduplicates by invoiceNo.
 */
export function recordIssuedInvoices(
  items: Array<{
    invoiceNo: string;
    date: string;
    sequenceNumber?: number;
    clinicName?: string;
    source?: CachedInvoiceRecord['source'];
  }>
): CachedInvoiceRecord[] {
  if (!items || items.length === 0) return getAllCachedInvoices();

  const current = getAllCachedInvoices();
  const existingMap = new Map<string, CachedInvoiceRecord>();
  current.forEach(c => existingMap.set(c.invoiceNo.trim().toLowerCase(), c));

  let hasChanges = false;
  const nowIso = new Date().toISOString();

  for (const item of items) {
    if (!item.invoiceNo || !item.invoiceNo.trim()) continue;
    const cleanNo = item.invoiceNo.trim();
    const key = cleanNo.toLowerCase();

    // Derive sequence number if not explicitly passed
    let seq = item.sequenceNumber;
    if (!seq || seq <= 0) {
      const parsed = parseInvoiceNo(cleanNo);
      seq = parsed?.sequence || 1;
    }

    const existing = existingMap.get(key);
    if (!existing) {
      existingMap.set(key, {
        invoiceNo: cleanNo,
        date: item.date,
        sequenceNumber: seq,
        clinicName: item.clinicName || '',
        issuedAt: nowIso,
        source: item.source || 'MANUAL'
      });
      hasChanges = true;
    } else {
      // Update source or metadata if promoted to higher priority source (e.g. DB_SAVE or ZIP_EXPORT)
      if (item.source && item.source !== existing.source) {
        existing.source = item.source;
        if (item.clinicName && !existing.clinicName) existing.clinicName = item.clinicName;
        hasChanges = true;
      }
    }
  }

  if (hasChanges) {
    const updated = Array.from(existingMap.values());
    writeCacheToStorage(updated);
    return updated;
  }

  return current;
}

/**
 * Synchronizes existing Firestore database shipments into the local cache.
 * This guarantees that even after page reloads, DB records are reflected in cache.
 */
export function syncShipmentsToCache(shipments: Shipment[]): void {
  if (!shipments || shipments.length === 0) return;
  const toAdd = shipments.map(s => {
    const parsed = parseInvoiceNo(s.invoiceNo);
    return {
      invoiceNo: s.invoiceNo,
      date: s.date,
      sequenceNumber: parsed?.sequence,
      clinicName: s.clinicSnapshot?.name || s.clinicSnapshot?.nameEn,
      source: 'DB_SAVE' as const
    };
  });
  recordIssuedInvoices(toAdd);
}

/**
 * Clears cached invoice records for a specific date ("YYYY-MM-DD").
 * Useful when user wants to reset today's sequence count.
 */
export function clearCachedInvoicesForDate(dateStr: string): void {
  const current = getAllCachedInvoices();
  const filtered = current.filter(r => r.date !== dateStr && !isInvoiceMatchingDate(r.invoiceNo, dateStr));
  writeCacheToStorage(filtered);
}

/**
 * Clears all cached invoice records across all dates.
 */
export function clearAllInvoiceCache(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent(CACHE_EVENT_NAME));
  } catch (e) {
    console.error('Failed to clear invoice cache:', e);
  }
}

/**
 * React hook to observe and interact with the daily issued invoice cache.
 */
export function useDailyInvoiceCache(dateStr: string) {
  const [cachedList, setCachedList] = useState<CachedInvoiceRecord[]>(() => getCachedInvoices(dateStr));

  useEffect(() => {
    setCachedList(getCachedInvoices(dateStr));
    const handleUpdate = () => {
      setCachedList(getCachedInvoices(dateStr));
    };
    window.addEventListener(CACHE_EVENT_NAME, handleUpdate);
    return () => window.removeEventListener(CACHE_EVENT_NAME, handleUpdate);
  }, [dateStr]);

  const maxSeq = useMemo(() => {
    return getMaxSequenceFromCache(dateStr);
  }, [cachedList, dateStr]);

  const usedInvoiceNumbers = useMemo(() => {
    return getUsedInvoiceNumbersFromCache(dateStr);
  }, [cachedList, dateStr]);

  return {
    cachedInvoices: cachedList,
    maxSequence: maxSeq,
    usedInvoiceNumbers,
    clearForDate: () => clearCachedInvoicesForDate(dateStr),
    clearAll: () => clearAllInvoiceCache(),
    refresh: () => setCachedList(getCachedInvoices(dateStr))
  };
}

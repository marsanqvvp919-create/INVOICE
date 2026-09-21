import { Shipment, SystemSettings } from '../types';
import { getMaxSequenceFromCache, getUsedInvoiceNumbersFromCache } from './dailyInvoiceCache';

/**
 * Validates whether a candidate string is a legitimate invoice number for international commercial use.
 * Rejects strings containing Japanese/CJK characters, invalid symbols, or lacking alphanumeric characters.
 */
export function isValidInvoiceNumberString(val: string | undefined | null): boolean {
  if (!val || typeof val !== 'string') return false;
  const trimmed = val.trim();
  if (trimmed.length < 2 || trimmed.length > 50) return false;

  // Reject Japanese / CJK / multi-byte characters
  if (/[\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\uFF00-\uFFEF\u4E00-\u9FAF]/.test(trimmed)) {
    return false;
  }

  // Reject any characters outside printable ASCII 0x21-0x7E
  if (/[^\x21-\x7E]/.test(trimmed)) {
    return false;
  }

  // Must match valid invoice code format: alphanumeric starting/ending with allowable delimiters
  if (!/^[A-Za-z0-9][A-Za-z0-9\-_#/.]*$/.test(trimmed)) {
    return false;
  }

  // Must contain at least one digit or alphanumeric character
  return /[A-Za-z0-9]/.test(trimmed);
}

/**
 * Extracts date information and sequence number from an invoice number string.
 * Examples:
 * - "INV-20260920-005" -> sequence: 5, dateDigits: "20260920", prefix: "INV-"
 * - "INV-260920-001"   -> sequence: 1, dateDigits: "260920", prefix: "INV-"
 * - "260920-3"          -> sequence: 3, dateDigits: "260920", prefix: ""
 * - "20260920-12"       -> sequence: 12, dateDigits: "20260920", prefix: ""
 */
export function parseInvoiceNo(invoiceNo: string): {
  prefix?: string;
  dateDigits?: string;
  sequence?: number;
} | null {
  if (!invoiceNo || typeof invoiceNo !== 'string') return null;
  const trimmed = invoiceNo.trim();

  // Reject Japanese or CJK text immediately
  if (/[\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\uFF00-\uFFEF\u4E00-\u9FAF]/.test(trimmed)) {
    return null;
  }

  // Pattern 1: Prefix (optional) + Date (6 or 8 digits) + Separator (-) + Sequence
  const matchWithDate = trimmed.match(/^(.*?)(?:(?:\b|(?<=\D))(\d{6}|\d{8}))[-_/](\d+)$/);
  if (matchWithDate) {
    return {
      prefix: matchWithDate[1] || '',
      dateDigits: matchWithDate[2],
      sequence: parseInt(matchWithDate[3], 10)
    };
  }

  // Pattern 2: Ends with separator and digits (e.g. "INV-005" or "CUSTOM-12")
  // Only accept if string contains alphanumeric characters before separator
  const matchSuffix = trimmed.match(/^[A-Za-z0-9\-_#/.]*?[-_/](\d+)$/);
  if (matchSuffix) {
    return {
      sequence: parseInt(matchSuffix[1], 10)
    };
  }

  return null;
}

/**
 * Checks if an invoice number string matches or contains the specified target date.
 * targetDateStr is in "YYYY-MM-DD" format (e.g. "2026-09-20").
 */
export function isInvoiceMatchingDate(invoiceNo: string, targetDateStr: string): boolean {
  if (!invoiceNo || !targetDateStr) return false;
  const clean8 = targetDateStr.replace(/-/g, ''); // 20260920
  const clean6 = clean8.slice(2); // 260920
  
  return invoiceNo.includes(clean8) || invoiceNo.includes(clean6);
}

/**
 * Calculates the current maximum sequence number for a given target date among existing shipments.
 * Inspects both explicit `shipment.date === targetDateStr` and invoice number strings matching that date.
 */
export function getMaxSequenceForDate(
  targetDateStr: string,
  existingShipments: Shipment[] = [],
  includeCache: boolean = true
): number {
  if (!targetDateStr) return 0;
  
  let maxSeq = 0;
  let matchingShipmentsCount = 0;

  for (const s of existingShipments) {
    const isSameDate = s.date === targetDateStr || isInvoiceMatchingDate(s.invoiceNo, targetDateStr);
    if (isSameDate) {
      matchingShipmentsCount++;
      const parsed = parseInvoiceNo(s.invoiceNo);
      if (parsed?.sequence && parsed.sequence > maxSeq) {
        maxSeq = parsed.sequence;
      }
    }
  }

  let result = Math.max(maxSeq, matchingShipmentsCount);

  // Cross-reference with persistent daily browser cache
  if (includeCache) {
    const cacheMax = getMaxSequenceFromCache(targetDateStr);
    result = Math.max(result, cacheMax);
  }

  return result;
}

/**
 * Formats a standard sequential invoice number.
 * Format: ${prefix}${YYYYMMDD}-${seq(3 digits)}
 * e.g. "INV-20260920-001"
 */
export function formatStandardInvoiceNo(
  prefix: string = 'INV-',
  dateStr: string,
  seq: number
): string {
  const cleanDate = dateStr.replace(/-/g, ''); // YYYYMMDD
  const effectivePrefix = prefix || 'INV-';
  const paddedSeq = String(seq).padStart(3, '0');
  return `${effectivePrefix}${cleanDate}-${paddedSeq}`;
}

/**
 * Result of resolving invoice numbers for a batch.
 */
export interface ResolvedInvoiceAllocation {
  invoiceNo: string;
  isFromCsv: boolean;
  isAutoSequential: boolean;
  isCollisionAvoided: boolean;
  sequenceNumber: number;
}

/**
 * Resolves sequential invoice numbers for a list of clinic allocations,
 * guaranteeing ZERO collision within the target date (considering both DB and cache).
 */
export function resolveBatchInvoiceNumbers(
  items: Array<{
    id: string;
    csvInvoiceNo?: string;
    existingInvoiceNo?: string;
  }>,
  targetDateStr: string,
  existingShipments: Shipment[] = [],
  settings?: SystemSettings,
  includeCache: boolean = true
): Map<string, ResolvedInvoiceAllocation> {
  const prefix = settings?.prefix || 'INV-';
  const clean8 = targetDateStr.replace(/-/g, '');
  const clean6 = clean8.slice(2);

  // Set of all already-used invoice numbers in the database and cache (normalized lowercase)
  const usedInvoiceNumbers = new Set<string>();
  existingShipments.forEach(s => {
    if (s.invoiceNo && isValidInvoiceNumberString(s.invoiceNo)) {
      usedInvoiceNumbers.add(s.invoiceNo.trim().toLowerCase());
    }
  });

  if (includeCache) {
    const cacheUsed = getUsedInvoiceNumbersFromCache(targetDateStr);
    cacheUsed.forEach(no => {
      if (isValidInvoiceNumberString(no)) {
        usedInvoiceNumbers.add(no.trim().toLowerCase());
      }
    });
  }

  // Calculate the starting sequence number for this date from existing database records + cache
  let nextSeq = getMaxSequenceForDate(targetDateStr, existingShipments, includeCache) + 1;

  const results = new Map<string, ResolvedInvoiceAllocation>();

  for (const item of items) {
    const rawCandidate = (item.csvInvoiceNo || item.existingInvoiceNo || '').trim();
    const candidateLower = rawCandidate.toLowerCase();
    const isValidFormat = isValidInvoiceNumberString(rawCandidate);

    // Check if the candidate number is a collision with existing shipments or already assigned in this batch
    const isAlreadyUsed = isValidFormat && usedInvoiceNumbers.has(candidateLower);

    // If no candidate provided, invalid format (e.g. Japanese text/clinic name), or collides:
    if (!rawCandidate || !isValidFormat || isAlreadyUsed) {
      const generatedNo = formatStandardInvoiceNo(prefix, targetDateStr, nextSeq);
      usedInvoiceNumbers.add(generatedNo.toLowerCase());
      
      results.set(item.id, {
        invoiceNo: generatedNo,
        isFromCsv: false,
        isAutoSequential: true,
        isCollisionAvoided: Boolean(rawCandidate && isValidFormat && isAlreadyUsed),
        sequenceNumber: nextSeq
      });

      nextSeq++;
    } else {
      // Valid, non-colliding candidate provided in CSV / manual input
      usedInvoiceNumbers.add(candidateLower);

      // If the candidate contains a sequence number matching this date,
      // advance nextSeq past it to avoid colliding with upcoming items
      const parsed = parseInvoiceNo(rawCandidate);
      if (parsed?.sequence && (rawCandidate.includes(clean8) || rawCandidate.includes(clean6))) {
        if (parsed.sequence >= nextSeq) {
          nextSeq = parsed.sequence + 1;
        }
      }

      results.set(item.id, {
        invoiceNo: rawCandidate,
        isFromCsv: true,
        isAutoSequential: false,
        isCollisionAvoided: false,
        sequenceNumber: parsed?.sequence || nextSeq
      });
    }
  }

  return results;
}

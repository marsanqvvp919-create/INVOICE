import { Shipment, SystemSettings } from '../types';

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
  const matchSuffix = trimmed.match(/[-_/](\d+)$/);
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
  existingShipments: Shipment[] = []
): number {
  if (!targetDateStr) return 0;
  
  const clean8 = targetDateStr.replace(/-/g, ''); // e.g. "20260920"
  const clean6 = clean8.slice(2); // e.g. "260920"

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

  // Ensure sequence is at least equal to the count of matching shipments for that date
  return Math.max(maxSeq, matchingShipmentsCount);
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
 * guaranteeing ZERO collision within the target date.
 */
export function resolveBatchInvoiceNumbers(
  items: Array<{
    id: string;
    csvInvoiceNo?: string;
    existingInvoiceNo?: string;
  }>,
  targetDateStr: string,
  existingShipments: Shipment[] = [],
  settings?: SystemSettings
): Map<string, ResolvedInvoiceAllocation> {
  const prefix = settings?.prefix || 'INV-';
  const clean8 = targetDateStr.replace(/-/g, '');
  const clean6 = clean8.slice(2);

  // Set of all already-used invoice numbers in the database (normalized lowercase)
  const usedInvoiceNumbers = new Set<string>();
  existingShipments.forEach(s => {
    if (s.invoiceNo) {
      usedInvoiceNumbers.add(s.invoiceNo.trim().toLowerCase());
    }
  });

  // Calculate the starting sequence number for this date from existing database records
  let nextSeq = getMaxSequenceForDate(targetDateStr, existingShipments) + 1;

  const results = new Map<string, ResolvedInvoiceAllocation>();

  for (const item of items) {
    const rawCandidate = (item.csvInvoiceNo || item.existingInvoiceNo || '').trim();
    const candidateLower = rawCandidate.toLowerCase();

    // Check if the candidate number is a collision with existing shipments or already assigned in this batch
    const isAlreadyUsed = rawCandidate !== '' && usedInvoiceNumbers.has(candidateLower);

    // If no candidate provided, or candidate collides with an existing shipment on the same day:
    if (!rawCandidate || isAlreadyUsed) {
      const generatedNo = formatStandardInvoiceNo(prefix, targetDateStr, nextSeq);
      usedInvoiceNumbers.add(generatedNo.toLowerCase());
      
      results.set(item.id, {
        invoiceNo: generatedNo,
        isFromCsv: Boolean(rawCandidate && !isAlreadyUsed),
        isAutoSequential: true,
        isCollisionAvoided: Boolean(rawCandidate && isAlreadyUsed),
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

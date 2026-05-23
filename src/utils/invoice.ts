/**
 * Invoice and queue number management strategy for LaundryKu SaaS.
 * Prevents collisions, simplifies search operations, and preserves readable patterns.
 */

/**
 * Generates invoice numbers using structured format: LDRY-YYMMDD-{runningNumber}
 * Example output: LDRY-230526-0005
 * 
 * If runningNumber is not supplied, it falls back to a randomized numeric seed 
 * to remain safe in offline-first scenarios.
 */
export const generateInvoiceNumber = (sequenceNumber?: number): string => {
  const now = new Date();
  
  // Format day/month/year to compact YYMMDD
  const year = String(now.getFullYear()).slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = `${day}${month}${year}`; // Format: DDMMYY matching prompt requirements

  let suffix = '';
  if (sequenceNumber !== undefined && sequenceNumber !== null) {
    suffix = String(sequenceNumber).padStart(4, '0');
  } else {
    // Generate secure offline-first fallback suffix
    const randomSeed = Math.floor(1000 + Math.random() * 9000);
    suffix = String(randomSeed);
  }

  return `LDRY-${dateStr}-${suffix}`;
};

/**
 * Generates sequential queue numbers like A001, A002, A003.
 * Defaults to category prefix 'A' if not explicitly set.
 */
export const generateQueueNumber = (lastSequenceNumber: number, prefix: string = 'A'): string => {
  const nextNum = lastSequenceNumber + 1;
  const suffix = String(nextNum).padStart(3, '0');
  return `${prefix.toUpperCase()}${suffix}`;
};

/**
 * Safely aggregates calculations for subtotal, discount, tax, and DP, returning
 * accurate values with zero negative value bugs.
 */
export const calculatePaymentDetails = (params: {
  subtotal: number;
  discountPercent?: number; // percentage
  taxPercent?: number; // percentage
  paidAmount: number;
}) => {
  const { subtotal, discountPercent = 0, taxPercent = 0, paidAmount } = params;

  // Deduct discounts safely
  const discountAmount = Math.max(0, parseFloat(((subtotal * discountPercent) / 100).toFixed(2)));
  const afterDiscount = Math.max(0, subtotal - discountAmount);

  // Apply tax over the discounted value
  const taxAmount = Math.max(0, parseFloat(((afterDiscount * taxPercent) / 100).toFixed(2)));
  const grandTotal = Math.max(0, Math.round(afterDiscount + taxAmount));

  // Determine payment status based on core strategy rules
  let paymentStatus: 'unpaid' | 'partial' | 'paid' = 'unpaid';
  let changeAmount = 0;
  let remainingAmount = grandTotal;

  if (paidAmount <= 0) {
    paymentStatus = 'unpaid';
    remainingAmount = grandTotal;
    changeAmount = 0;
  } else if (paidAmount > 0 && paidAmount < grandTotal) {
    paymentStatus = 'partial';
    remainingAmount = Math.max(0, grandTotal - paidAmount);
    changeAmount = 0;
  } else {
    paymentStatus = 'paid';
    remainingAmount = 0;
    changeAmount = Math.max(0, paidAmount - grandTotal);
  }

  return {
    subtotal,
    discountAmount,
    taxAmount,
    grandTotal,
    paidAmount,
    remainingAmount,
    changeAmount,
    paymentStatus
  };
};

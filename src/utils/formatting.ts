import { Timestamp } from 'firebase/firestore';

/**
 * Formats utility rates into Indonesian IDR currency string representation.
 */
export const formatRupiah = (value: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(value);
};

/**
 * Parses any timestamp-like value (string, Date, Timestamp, or numeric seconds/ms) 
 * safe against crashes. Returns a native JS Date or null if invalid.
 */
export const safeDateParser = (dateLike: any): Date | null => {
  if (!dateLike) return null;
  try {
    if (typeof dateLike === 'object' && dateLike !== null) {
      if (typeof dateLike.toDate === 'function') {
        return dateLike.toDate();
      }
      if (typeof dateLike.seconds === 'number') {
        return new Date(dateLike.seconds * 1000);
      }
      if (dateLike instanceof Date) {
        return dateLike;
      }
    }
    const parsed = new Date(dateLike);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  } catch (err) {
    console.warn("safeDateParser failed to parse date-like object:", dateLike, err);
  }
  return null;
};

/**
 * Normalizes a date value into Firestore Timestamp or its representation.
 * If Firestore is offline or a direct Timestamp isn't supplied, converts it safely.
 */
export const normalizeTimestamp = (dateLike: any): any => {
  if (!dateLike) return null;
  const parsedDate = safeDateParser(dateLike);
  if (!parsedDate) return null;
  return Timestamp.fromDate(parsedDate);
};

/**
 * Formats a Date-like value with specified formatting options.
 */
export const safeFormatDate = (
  dateLike: any, 
  options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }
): string => {
  const parsedDate = safeDateParser(dateLike);
  if (!parsedDate) return '-';
  return parsedDate.toLocaleDateString('id-ID', options);
};

/**
 * Universal date-time compiler supporting ISO strings, JS Dates, and Firestore Timestamp objects resiliently.
 */
export const formatDateTime = (isoString?: any): string => {
  return safeFormatDate(isoString);
};

/**
 * Generates ready-to-use secure link for CRM WhatsApp integrations.
 */
export const getWhatsAppUrl = (phone: string, text: string): string => {
  let formattedPhone = phone.trim().replace(/[^0-9]/g, '');
  if (formattedPhone.startsWith('0')) {
    formattedPhone = '62' + formattedPhone.slice(1);
  }
  return `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(text)}`;
};

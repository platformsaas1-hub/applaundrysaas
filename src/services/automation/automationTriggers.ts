import { db } from '../../firebase/config';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { AutomationJob, Transaction } from '../../types';
import { canSendAutomation } from './automationCooldown';
import { WHATSAPP_TEMPLATES } from '../whatsapp/whatsappTemplates';
import { runProcessorCycle } from './automationProcessor';
import { formatRupiah } from '../../utils/formatting';

/**
 * Creates an automation job safely and schedules it for async queue execution.
 */
async function scheduleJob(
  tenantId: string,
  outletId: string,
  type: 'send_receipt' | 'ready_pickup' | 'overdue_pickup' | 'partial_payment_reminder' | 'custom_manual',
  transaction: Transaction,
  message: string,
  triggeredBy: 'system' | 'manual' | 'status_change' | 'payment_update' | 'checkout',
  operatorUid: string,
  operatorName: string
): Promise<boolean> {
  if (!tenantId || !outletId || !transaction.customerPhone) {
    return false;
  }

  // 1. Doublecheck anti-spam block limits globally
  const isAllowed = await canSendAutomation(tenantId, transaction.customerPhone, type);
  if (!isAllowed) {
    console.log(`[Automation Trigger] Blocked scheduling to prevent spam. Phone: ${transaction.customerPhone}, Type: ${type}`);
    return false;
  }

  const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const jobDocRef = doc(db, 'tenants', tenantId, 'automationJobs', jobId);

  const newJob: AutomationJob = {
    jobId,
    tenantId,
    outletId,
    type,
    transactionId: transaction.transactionId,
    customerId: transaction.customerId || '',
    customerName: transaction.customerName,
    customerPhone: transaction.customerPhone,
    message,
    deliveryChannel: 'whatsapp',
    status: 'queued',
    retryCount: 0,
    maxRetries: 3,
    nextRetryAt: null,
    createdBy: operatorUid,
    createdByName: operatorName || 'System',
    triggeredBy,
    isDeleted: false,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  };

  try {
    await setDoc(jobDocRef, newJob);
    console.log(`[Automation Trigger] Succeeded styling and queueing job: ${jobId} (type: ${type})`);

    // Proactively launch processor cycle asynchronously after scheduling to bypass page refresh delays
    setTimeout(() => {
      runProcessorCycle(tenantId).catch(err => {
        console.error('[Automation Background Trigger] Error running processor run-loop:', err);
      });
    }, 800);

    return true;
  } catch (error) {
    console.error(`[Automation Trigger] Crash registering job to Firestore:`, error);
    return false;
  }
}

/**
 * Event 1: Auto Receipt (triggered after successful checkout)
 */
export async function triggerAutoReceipt(options: {
  tenantId: string;
  outletId: string;
  outletName: string;
  transaction: Transaction;
  servicesSummary?: string;
  operatorUid: string;
  operatorName: string;
}): Promise<boolean> {
  const { tenantId, outletId, outletName, transaction, servicesSummary, operatorUid, operatorName } = options;

  let estString = 'Segera';
  if (transaction.estimatedDoneAt) {
    const dateObj = typeof transaction.estimatedDoneAt === 'string' 
      ? new Date(transaction.estimatedDoneAt) 
      : (transaction.estimatedDoneAt instanceof Timestamp ? transaction.estimatedDoneAt.toDate() : new Date(transaction.estimatedDoneAt.seconds * 1000));
    estString = dateObj.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
  }

  const invoiceNum = transaction.invoiceNumber || transaction.transactionId;
  const remaining = transaction.remainingAmount ?? (transaction.totalAmount - (transaction.paidAmount ?? 0));

  const textMessage = WHATSAPP_TEMPLATES.order_received.render({
    customerName: transaction.customerName,
    invoiceNumber: invoiceNum,
    outletName,
    remainingBalance: remaining,
    estimatedDoneDate: estString,
    servicesSummary: servicesSummary || 'Layanan Laundry laundry'
  });

  return scheduleJob(
    tenantId,
    outletId,
    'send_receipt',
    transaction,
    textMessage,
    'checkout',
    operatorUid,
    operatorName
  );
}

/**
 * Event 2: Auto Ready Pickup (triggered on orderStatus changes into 'ready' or similar)
 */
export async function triggerAutoReady(options: {
  tenantId: string;
  outletId: string;
  outletName: string;
  transaction: Transaction;
  operatorUid: string;
  operatorName: string;
}): Promise<boolean> {
  const { tenantId, outletId, outletName, transaction, operatorUid, operatorName } = options;

  const invoiceNum = transaction.invoiceNumber || transaction.transactionId;
  const remaining = transaction.remainingAmount ?? (transaction.totalAmount - (transaction.paidAmount ?? 0));

  const textMessage = WHATSAPP_TEMPLATES.order_ready.render({
    customerName: transaction.customerName,
    invoiceNumber: invoiceNum,
    outletName,
    remainingBalance: remaining,
    pickupInfo: 'Mohon tanyakan detail jam operasional mampir ke CS.'
  });

  return scheduleJob(
    tenantId,
    outletId,
    'ready_pickup',
    transaction,
    textMessage,
    'status_change',
    operatorUid,
    operatorName
  );
}

/**
 * Event 3: Auto Overdue Pickup (triggered if orderStatus remains 'ready' > 3 days and not picked up)
 */
export async function triggerAutoOverduePickup(options: {
  tenantId: string;
  outletId: string;
  outletName: string;
  transaction: Transaction;
  operatorUid: string;
  operatorName: string;
}): Promise<boolean> {
  const { tenantId, outletId, outletName, transaction, operatorUid, operatorName } = options;

  const invoiceNum = transaction.invoiceNumber || transaction.transactionId;
  const remaining = transaction.remainingAmount ?? (transaction.totalAmount - (transaction.paidAmount ?? 0));

  const textMessage = `Halo Kak *${transaction.customerName}*! 🙏

Ini adalah pengingat ramah dari *${outletName}*. Laundry milik Kakak dengan nomor invoice *#${invoiceNum}* telah berstatus *SIAP DIAMBIL* sejak 3 hari yang lalu. 🧺👔

💰 Tagihan sisa yang belum tuntas: *${formatRupiah(remaining)}*

Mohon kesediaan Kakak untuk dapat mengambil laundry di outlet sesegera mungkin ya Kak, agar menjaga kebersihan dan kesegaran serat kain cucian Anda.

Terima kasih banyak atas perhatian dan kerja samanya! Have a nice day. 😊🌸`;

  return scheduleJob(
    tenantId,
    outletId,
    'overdue_pickup',
    transaction,
    textMessage,
    'system',
    operatorUid,
    operatorName
  );
}

/**
 * Event 4: Auto Partial Payment Reminder (triggered if paymentStatus remains 'partial' / outstanding balance)
 */
export async function triggerAutoPartialPaymentReminder(options: {
  tenantId: string;
  outletId: string;
  outletName: string;
  transaction: Transaction;
  operatorUid: string;
  operatorName: string;
}): Promise<boolean> {
  const { tenantId, outletId, outletName, transaction, operatorUid, operatorName } = options;

  const invoiceNum = transaction.invoiceNumber || transaction.transactionId;
  const remaining = transaction.remainingAmount ?? (transaction.totalAmount - (transaction.paidAmount ?? 0));

  const textMessage = WHATSAPP_TEMPLATES.payment_reminder.render({
    customerName: transaction.customerName,
    invoiceNumber: invoiceNum,
    outletName,
    remainingBalance: remaining
  });

  return scheduleJob(
    tenantId,
    outletId,
    'partial_payment_reminder',
    transaction,
    textMessage,
    'payment_update',
    operatorUid,
    operatorName
  );
}

/**
 * Manual Fallback Engine triggers (Owner triggers custom manual automation message)
 */
export async function triggerManualCustomMessage(options: {
  tenantId: string;
  outletId: string;
  outletName: string;
  transaction: Transaction;
  customMessage: string;
  operatorUid: string;
  operatorName: string;
}): Promise<boolean> {
  const { tenantId, outletId, transaction, customMessage, operatorUid, operatorName } = options;

  return scheduleJob(
    tenantId,
    outletId,
    'custom_manual',
    transaction,
    customMessage,
    'manual',
    operatorUid,
    operatorName
  );
}

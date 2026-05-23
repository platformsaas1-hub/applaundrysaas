import { db } from '../../firebase/config';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs, 
  runTransaction, 
  doc, 
  Timestamp 
} from 'firebase/firestore';
import { AutomationJob, AutomationNotificationLog } from '../../types';
import { FonnteProvider } from '../whatsapp/fonnteProvider';

const provider = new FonnteProvider();

/**
 * Calculates next retry time based on the retry attempt count
 */
const getNextRetryTime = (retryCount: number): Date => {
  const now = Date.now();
  if (retryCount === 1) {
    return new Date(now + 5 * 60 * 1000); // +5 minutes
  } else if (retryCount === 2) {
    return new Date(now + 30 * 60 * 1000); // +30 minutes
  } else if (retryCount === 3) {
    return new Date(now + 120 * 60 * 1000); // +2 hours
  }
  return new Date();
};

/**
 * Single-job processor with strict transaction-based state locking
 */
export async function processSingleJob(tenantId: string, jobId: string): Promise<boolean> {
  if (!tenantId || !jobId) return false;

  const jobDocRef = doc(db, 'tenants', tenantId, 'automationJobs', jobId);
  
  try {
    // 1. Transaction-based optimistic locking to change status "queued" -> "processing"
    const jobData = await runTransaction(db, async (transaction) => {
      const jobDoc = await transaction.get(jobDocRef);
      if (!jobDoc.exists()) {
        throw new Error('Draft job not found');
      }

      const data = jobDoc.data() as AutomationJob;

      // Queue guidelines: ignore deleted, cancelled, sent, or active processing jobs
      if (data.isDeleted || data.status !== 'queued') {
        throw new Error(`Queue state mismatch. Job status is: ${data.status}`);
      }

      // Check nextRetryAt constraints if present to respect backoffs
      if (data.nextRetryAt) {
        const nextTime = data.nextRetryAt instanceof Timestamp 
          ? data.nextRetryAt.toMillis() 
          : new Date(data.nextRetryAt).getTime();
        
        if (nextTime > Date.now()) {
          throw new Error('Retry window cooldown has not expired yet');
        }
      }

      // Transition queued -> processing
      transaction.update(jobDocRef, {
        status: 'processing',
        updatedAt: Timestamp.now()
      });

      return data;
    });

    console.log(`[Queue Processor] Acquired lock. Processing job ${jobId} under ${tenantId}.`);

    // 2. Transmit the payload via physical Fonnte SMS/WA endpoint
    // Standardize phone format if needed
    let targetPhone = jobData.customerPhone;
    if (targetPhone.startsWith('0')) {
      targetPhone = '62' + targetPhone.slice(1);
    } else if (targetPhone.startsWith('8')) {
      targetPhone = '62' + targetPhone;
    }

    const result = await provider.sendMessage({
      to: targetPhone,
      message: jobData.message
    });

    // 3. Update the outcome state ledger
    const now = Timestamp.now();
    const logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const logDocRef = doc(db, 'tenants', tenantId, 'notificationLogs', logId);

    if (result.success) {
      // 3A. Success state: status -> sent
      await runTransaction(db, async (transaction) => {
        transaction.update(jobDocRef, {
          status: 'sent',
          sentAt: now,
          updatedAt: now,
          errorMessage: null
        });

        // Write immutable notificationLog
        const logPayload: AutomationNotificationLog = {
          logId,
          jobId,
          tenantId,
          outletId: jobData.outletId,
          transactionId: jobData.transactionId || '',
          customerId: jobData.customerId || '',
          type: jobData.type,
          provider: provider.id,
          target: targetPhone,
          message: jobData.message,
          status: 'sent',
          providerResponse: result.responseRaw || null,
          createdAt: now
        };
        transaction.set(logDocRef, logPayload);
      });

      console.log(`[Queue Processor] Job ${jobId} successfully dispatched to gateway.`);
      return true;
    } else {
      // 3B. Failed state: determine if we retry or fail permanently
      const currentRetry = jobData.retryCount + 1;
      const canRetry = currentRetry <= jobData.maxRetries;

      await runTransaction(db, async (transaction) => {
        if (canRetry) {
          // Transitions: failed -> queued
          const nextRetryDate = getNextRetryTime(currentRetry);
          transaction.update(jobDocRef, {
            status: 'queued',
            retryCount: currentRetry,
            nextRetryAt: Timestamp.fromDate(nextRetryDate),
            updatedAt: now,
            errorMessage: result.error || 'Gateway failed'
          });
        } else {
          // Max retries exceeded: permanent failure
          transaction.update(jobDocRef, {
            status: 'failed',
            updatedAt: now,
            errorMessage: `${result.error || 'Unknown gateway issue'} (Max backoffs exceeded)`
          });
        }

        // Always write audit log entry regardless
        const logPayload: AutomationNotificationLog = {
          logId,
          jobId,
          tenantId,
          outletId: jobData.outletId,
          transactionId: jobData.transactionId || '',
          customerId: jobData.customerId || '',
          type: jobData.type,
          provider: provider.id,
          target: targetPhone,
          message: jobData.message,
          status: 'failed',
          providerResponse: result.responseRaw || null,
          errorMessage: result.error || 'Gate rejected request',
          createdAt: now
        };
        transaction.set(logDocRef, logPayload);
      });

      console.warn(`[Queue Processor] Job ${jobId} dispatch failed. Retry ${currentRetry}/${jobData.maxRetries}.`);
      return false;
    }
  } catch (error: any) {
    console.error(`[Queue Processor] Lock or dispatch crash on job ${jobId}:`, error?.message || error);
    
    // In case of any unhandled exceptions (system crash), try to restore job status back to queued if it is stuck on 'processing'
    try {
      await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(jobDocRef);
        if (docSnap.exists() && docSnap.data().status === 'processing') {
          transaction.update(jobDocRef, {
            status: 'queued',
            errorMessage: `System processor crash: ${error?.message || error}`,
            updatedAt: Timestamp.now()
          });
        }
      });
    } catch (resetErr) {
      // Ignore fallback exceptions
    }

    return false;
  }
}

/**
 * Processor cycle executor.
 * Keeps read cost to a lightweight single read bounded by 10 per cycle.
 */
export async function runProcessorCycle(tenantId: string): Promise<number> {
  if (!tenantId) return 0;

  try {
    const jobsRef = collection(db, 'tenants', tenantId, 'automationJobs');
    
    // Status filters: status == queued AND isDeleted == false
    // Sort chronologically using indexes to optimize costs
    const q = query(
      jobsRef,
      where('status', '==', 'queued'),
      where('isDeleted', '==', false),
      orderBy('createdAt', 'asc'),
      limit(10)
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      return 0;
    }

    let processedCount = 0;
    
    // Loop through jobs. If nextRetryAt is set and is in the future, filter it in memory rather than complex compound index queries on Firestore
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data() as AutomationJob;
      
      if (data.nextRetryAt) {
        const nextTime = data.nextRetryAt instanceof Timestamp 
          ? data.nextRetryAt.toMillis() 
          : new Date(data.nextRetryAt).getTime();
        
        if (nextTime > Date.now()) {
          continue; // Cooldown not elapsed
        }
      }

      const success = await processSingleJob(tenantId, data.jobId);
      if (success) {
        processedCount++;
      }
    }

    return processedCount;
  } catch (err) {
    console.error(`[Queue Processor] Error running processor cycle for tenant ${tenantId}:`, err);
    return 0;
  }
}

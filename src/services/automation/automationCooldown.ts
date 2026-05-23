import { db } from '../../firebase/config';
import { collection, query, where, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';

/**
 * Checks if a message of a specific type can be sent to a customer phone (cooldown check).
 * Rule: NO SAME TYPE MESSAGE to the same customer phone within a 24-hour window.
 */
export async function canSendAutomation(
  tenantId: string,
  customerPhone: string,
  type: 'send_receipt' | 'ready_pickup' | 'overdue_pickup' | 'partial_payment_reminder' | 'custom_manual'
): Promise<boolean> {
  if (!tenantId || !customerPhone || !type) return false;

  try {
    const jobsRef = collection(db, 'tenants', tenantId, 'automationJobs');
    
    // We filter by customerPhone and type, ordered by createdAt desc, to find the most recent job
    const q = query(
      jobsRef,
      where('customerPhone', '==', customerPhone),
      where('type', '==', type),
      where('isDeleted', '==', false),
      orderBy('createdAt', 'desc'),
      limit(5)
    );
    
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      return true; // No history, sending is permitted
    }
    
    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
    
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const status = data.status;
      
      // We only consider successful ('sent'), queued, or active ('processing') runs as blocks.
      // If it was cancelled or failed permanently (and not currently Retrying), we can allow re-triggering.
      if (!['sent', 'queued', 'processing'].includes(status)) {
        continue;
      }
      
      let createdMillis = 0;
      if (data.createdAt instanceof Timestamp) {
        createdMillis = data.createdAt.toMillis();
      } else if (data.createdAt && typeof data.createdAt.seconds === 'number') {
        createdMillis = data.createdAt.seconds * 1000;
      } else if (data.createdAt) {
        createdMillis = new Date(data.createdAt).getTime();
      }
      
      if (createdMillis > twentyFourHoursAgo) {
        console.log(`[Cooldown Engine] Cooldown ACTIVE for ${customerPhone} (type: ${type}). Job ${data.jobId} was created within 24h.`);
        return false; // Under cooldown, DO NOT duplicate
      }
    }
    
    return true; // Outside 24h window, safe to send
  } catch (error) {
    console.warn('[Cooldown Engine] Error checking cooldown limits, permitting fallback delivery:', error);
    return true; // Permit on query failures so critical alerts aren't choked
  }
}

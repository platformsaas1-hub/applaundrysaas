import { FonnteProvider } from './fonnteProvider';
import { WhatsAppProvider, WhatsAppSendResult } from './whatsappProvider';
import { WHATSAPP_TEMPLATES, TemplateType, TemplateVariables } from './whatsappTemplates';
import { db } from '../../firebase/config';
import { doc, setDoc } from 'firebase/firestore';
import { NotificationLog } from '../../types';

export class WhatsAppService {
  private static instance: WhatsAppService;
  private provider: WhatsAppProvider;

  private constructor() {
    // Current default provider is Fonnte as per specifications
    this.provider = new FonnteProvider();
  }

  public static getInstance(): WhatsAppService {
    if (!WhatsAppService.instance) {
      WhatsAppService.instance = new WhatsAppService();
    }
    return WhatsAppService.instance;
  }

  /**
   * Decoupled future-use mechanism to switch provider on the fly!
   */
  public setProvider(customProvider: WhatsAppProvider) {
    this.provider = customProvider;
  }

  /**
   * Standardizes Indonesian mobile numbers to international 62 format.
   * Standard inputs:
   * - "0812345678" -> "62812345678"
   * - "+62812345678" -> "62812345678"
   * - "812345678" -> "62812345678"
   * - "62812345678" -> "62812345678"
   */
  public normalizePhoneNumber(phone: string): string {
    let clean = phone.replace(/[^0-9+]/g, '');

    if (clean.startsWith('+')) {
      clean = clean.substring(1);
    }

    if (clean.startsWith('0')) {
      clean = '62' + clean.slice(1);
    } else if (clean.startsWith('8')) {
      clean = '62' + clean;
    }

    // Default Indonesian code prepend if it looks like a short raw mobile without code
    if (clean.length >= 9 && !clean.startsWith('62')) {
      clean = '62' + clean;
    }

    return clean;
  }

  /**
   * Entrypoint to trigger an automated or manual WhatsApp notification.
   */
  public async sendNotification(options: {
    tenantId: string;
    transactionId: string;
    customerPhone: string;
    customerName: string;
    templateType: TemplateType;
    variables: Omit<TemplateVariables, 'customerName'>;
    sentBy: string;
    sentByName?: string;
  }): Promise<WhatsAppSendResult> {
    const { tenantId, transactionId, customerPhone, customerName, templateType, variables, sentBy, sentByName } = options;

    if (!customerPhone) {
      return {
        success: false,
        error: 'Nomor telepon pelanggan kosong.',
      };
    }

    const normalizedPhone = this.normalizePhoneNumber(customerPhone);
    const template = WHATSAPP_TEMPLATES[templateType];

    if (!template) {
      return {
        success: false,
        error: `Kategori template '${templateType}' tidak ditemukan.`,
      };
    }

    // Compile dynamic variables
    const completeVars: TemplateVariables = {
      ...variables,
      customerName,
    };

    const renderedMessage = template.render(completeVars);

    // Dispatch via Provider Abstraction
    const result = await this.provider.sendMessage({
      to: normalizedPhone,
      message: renderedMessage,
    });

    // Logging notification history to Firestore (Section 7 — FIRESTORE LOGGING)
    try {
      const notificationId = `notif_${Date.now()}`;
      const notifDocRef = doc(db, 'tenants', tenantId, 'notifications', notificationId);

      const logPayload: NotificationLog = {
        notificationId,
        tenantId,
        transactionId,
        customerPhone: normalizedPhone,
        templateType,
        provider: this.provider.id,
        status: result.success ? 'sent' : 'failed',
        responseMessage: result.success ? 'Message processed successfully' : (result.error || 'Unknown gateway issue'),
        createdAt: new Date().toISOString(),
        sentBy,
        sentByName: sentByName || 'Kasir',
      };

      await setDoc(notifDocRef, logPayload);
    } catch (dbError) {
      console.error('Error logging whatsapp notification to Firestore:', dbError);
      // Do not crash the customer interaction if firestore logging fails, but alert in diagnostic console
    }

    return result;
  }
}

export const whatsappService = WhatsAppService.getInstance();

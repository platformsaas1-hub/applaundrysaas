export interface WhatsAppSendOptions {
  to: string; // Normalized phone number (e.g., "628xxxxxxxx")
  message: string;
}

export interface WhatsAppSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  responseRaw?: any;
}

export interface WhatsAppProvider {
  id: string;
  name: string;
  sendMessage(options: WhatsAppSendOptions): Promise<WhatsAppSendResult>;
}

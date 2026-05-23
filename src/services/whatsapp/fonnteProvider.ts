import { WhatsAppProvider, WhatsAppSendOptions, WhatsAppSendResult } from './whatsappProvider';

export class FonnteProvider implements WhatsAppProvider {
  id = 'fonnte';
  name = 'Fonnte';

  private get baseUrl(): string {
    const metaEnv = (import.meta as any).env || {};
    return metaEnv.VITE_FONNTE_BASE_URL || 'https://api.fonnte.com';
  }

  private get token(): string {
    const metaEnv = (import.meta as any).env || {};
    return metaEnv.VITE_FONNTE_TOKEN || '';
  }

  async sendMessage(options: WhatsAppSendOptions): Promise<WhatsAppSendResult> {
    if (!this.token) {
      console.warn('WhatsApp service warning: VITE_FONNTE_TOKEN is missing or empty.');
      return {
        success: false,
        error: 'Fonnte token API tidak terkonfigurasi. Silakan hubungi administrator.',
      };
    }

    try {
      // Fonnte accepts multipart/form-data or URLSearchParams. URLSearchParams is safe for cross-origin and light payloads.
      const formData = new URLSearchParams();
      formData.append('target', options.to);
      formData.append('message', options.message);
      formData.append('countryCode', '62'); // Default fallback for Indonesia

      const url = `${this.baseUrl}/send`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': this.token,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `Fonnte API HTTP error ${response.status}: ${errorText}`,
        };
      }

      const responseBody = await response.json();
      
      // Fonnte typical response: { status: true, detail: "...", ... }
      if (responseBody?.status === true) {
        return {
          success: true,
          messageId: responseBody.id || responseBody.detail || 'msg_success',
          responseRaw: responseBody,
        };
      } else {
        return {
          success: false,
          error: responseBody?.reason || responseBody?.detail || 'Gagal dikirim oleh Fonnte',
          responseRaw: responseBody,
        };
      }
    } catch (err: any) {
      console.error('Fonnte dispatch error:', err);
      return {
        success: false,
        error: err?.message || 'Gagal menghubungi server Fonnte',
      };
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';

/** Point d'ancrage WhatsApp Business — envoi réel désactivé sans identifiants. */
@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  async sendMessage(phone: string, message: string) {
    const token = process.env.WHATSAPP_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_ID;
    if (!token || !phoneId) {
      this.logger.log(`WhatsApp simulé (identifiants Business absents) : ${phone} → ${message.slice(0, 60)}…`);
      return { status: 'simulated' as const, detail: 'WHATSAPP_TOKEN/WHATSAPP_PHONE_ID non configurés' };
    }
    try {
      const response = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: phone.replace(/\D/g, ''),
          type: 'text',
          text: { body: message },
        }),
      });
      return { status: response.ok ? ('sent' as const) : ('failed' as const), detail: `HTTP ${response.status}` };
    } catch (err) {
      return { status: 'failed' as const, detail: err instanceof Error ? err.message : String(err) };
    }
  }
}

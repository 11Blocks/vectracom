import { Injectable, Logger } from '@nestjs/common';

/**
 * Canal Telegram (ajout à la demande de Green-T).
 * Envoi réel via Bot API dès que TELEGRAM_BOT_TOKEN est configuré ;
 * sinon simulation tracée.
 */
@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  async sendMessage(chatId: string, message: string) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      this.logger.log(`Telegram simulé (TELEGRAM_BOT_TOKEN absent) : chat ${chatId} → ${message.slice(0, 60)}…`);
      return { status: 'simulated' as const, detail: 'TELEGRAM_BOT_TOKEN non configuré' };
    }
    try {
      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
      });
      return { status: response.ok ? ('sent' as const) : ('failed' as const), detail: `HTTP ${response.status}` };
    } catch (err) {
      return { status: 'failed' as const, detail: err instanceof Error ? err.message : String(err) };
    }
  }
}

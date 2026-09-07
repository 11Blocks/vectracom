import { Injectable, Logger } from '@nestjs/common';

/** Envoi push via Expo Notifications — immédiatement utilisable avec EXPO_ACCESS_TOKEN. */
@Injectable()
export class ExpoService {
  private readonly logger = new Logger(ExpoService.name);

  async sendPush(tokens: string[], title: string, body: string, data?: Record<string, unknown>) {
    if (tokens.length === 0) return { status: 'simulated' as const, detail: 'aucun token' };
    const accessToken = process.env.EXPO_ACCESS_TOKEN;
    if (!accessToken) {
      this.logger.log(`Push simulé (EXPO_ACCESS_TOKEN absent) : ${title} → ${tokens.length} appareil(s)`);
      return { status: 'simulated' as const, detail: 'EXPO_ACCESS_TOKEN non configuré' };
    }
    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(
          tokens.map((to) => ({ to, title, body, data: data ?? {}, sound: 'default' })),
        ),
      });
      return { status: response.ok ? ('sent' as const) : ('failed' as const), detail: `HTTP ${response.status}` };
    } catch (err) {
      return { status: 'failed' as const, detail: err instanceof Error ? err.message : String(err) };
    }
  }
}

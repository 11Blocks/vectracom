import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Client Matrix optionnel (Dendrite).
 * Si MATRIX_HOMESERVER est absent → no-op (chat Nest seul).
 * Quand Dendrite tourne : provision / miroir peuvent être branchés ici.
 */
@Injectable()
export class MatrixClient {
  private readonly logger = new Logger(MatrixClient.name);
  private readonly baseUrl: string | null;
  private readonly enabled: boolean;

  constructor(config: ConfigService) {
    this.baseUrl = config.get<string>('MATRIX_HOMESERVER')?.replace(/\/$/, '') || null;
    this.enabled = Boolean(this.baseUrl);
    if (this.enabled) {
      this.logger.log(`Matrix homeserver configuré : ${this.baseUrl}`);
    } else {
      this.logger.log('Matrix désactivé — chat Nest (Postgres) uniquement');
    }
  }

  isEnabled() {
    return this.enabled;
  }

  /** Health check léger (ne bloque pas le chat Nest). */
  async ping(): Promise<{ ok: boolean; detail: string }> {
    if (!this.baseUrl) return { ok: false, detail: 'MATRIX_HOMESERVER non configuré' };
    try {
      const res = await fetch(`${this.baseUrl}/_matrix/client/versions`);
      return { ok: res.ok, detail: `HTTP ${res.status}` };
    } catch (e) {
      return { ok: false, detail: e instanceof Error ? e.message : String(e) };
    }
  }
}

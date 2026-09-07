import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { ImportPreviewRowDto } from './dto/import-preview-row.dto';

export interface StoredPreview {
  companyId: string;
  fileName: string;
  createdAt: Date;
  rows: ImportPreviewRowDto[];
}

/**
 * Aperçus d'import en attente de confirmation, indexés par fileId.
 * TTL 1 h. Mono-instance en dev ; à basculer sur Redis (déjà dans la stack)
 * dès le passage multi-instances.
 */
@Injectable()
export class PreviewStoreService {
  private readonly logger = new Logger(PreviewStoreService.name);
  private readonly store = new Map<string, { expiresAt: number; preview: StoredPreview }>();
  private readonly ttlMs = 60 * 60 * 1000;

  constructor() {
    const sweeper = setInterval(() => this.sweep(), 10 * 60 * 1000);
    sweeper.unref?.();
  }

  save(companyId: string, fileName: string, rows: ImportPreviewRowDto[]): { fileId: string } {
    const fileId = uuidv4();
    this.store.set(fileId, {
      expiresAt: Date.now() + this.ttlMs,
      preview: { companyId, fileName, createdAt: new Date(), rows },
    });
    return { fileId };
  }

  get(fileId: string): StoredPreview | null {
    const entry = this.store.get(fileId);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.store.delete(fileId);
      return null;
    }
    return entry.preview;
  }

  delete(fileId: string) {
    this.store.delete(fileId);
  }

  private sweep() {
    const now = Date.now();
    let removed = 0;
    for (const [id, entry] of this.store) {
      if (entry.expiresAt < now) {
        this.store.delete(id);
        removed++;
      }
    }
    if (removed > 0) this.logger.log(`Sweep aperçus expirés : ${removed} supprimé(s)`);
  }
}

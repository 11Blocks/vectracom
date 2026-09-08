import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from '../auth/entities/company.entity';
import { ChatService } from './chat.service';
import { IaVisionService } from '../ia-vision/ia-vision.service';

export type RemonteeIngestDto = {
  companyId?: string;
  /** Nom tenant (Company.name) — alias historique « companySlug ». */
  companySlug?: string;
  text?: string;
  photoUrl?: string;
  senderName?: string;
  senderPhone?: string;
  groupName?: string;
  /** Si true (défaut quand photoUrl), lance IA Vision. */
  runVision?: boolean;
};

/**
 * Pont WhatsApp « Remontée » → salon chat + pipeline IA Vision.
 * Authentifié par REMONTEE_BRIDGE_SECRET (header X-Remontee-Secret).
 */
@Injectable()
export class RemonteeBridgeService {
  private readonly logger = new Logger(RemonteeBridgeService.name);

  constructor(
    private readonly chat: ChatService,
    private readonly iaVision: IaVisionService,
    @InjectRepository(Company) private readonly companies: Repository<Company>,
  ) {}

  assertSecret(header?: string) {
    const expected = process.env.REMONTEE_BRIDGE_SECRET;
    if (!expected) {
      throw new BadRequestException(
        'REMONTEE_BRIDGE_SECRET non configuré — définir le secret bridge dans .env',
      );
    }
    if (!header || header !== expected) {
      throw new UnauthorizedException('Secret Remontée invalide');
    }
  }

  status() {
    return {
      bridgeSecretConfigured: Boolean(process.env.REMONTEE_BRIDGE_SECRET),
      whatsappGroupFilter: process.env.REMONTEE_WHATSAPP_GROUP || 'Remontée',
      mautrixProfile: 'docker compose --profile remontee',
      ingestPath: 'POST /api/v1/remontee/ingest',
      simulatePath: 'POST /api/v1/remontee/simulate',
    };
  }

  async resolveCompanyId(dto: RemonteeIngestDto): Promise<string> {
    if (dto.companyId) {
      const c = await this.companies.findOne({ where: { id: dto.companyId } });
      if (!c) throw new BadRequestException('companyId inconnu');
      return c.id;
    }
    if (dto.companySlug) {
      const byName = await this.companies
        .createQueryBuilder('c')
        .where('LOWER(c.name) = LOWER(:n)', { n: dto.companySlug })
        .getOne();
      if (!byName) throw new BadRequestException('companySlug (name) inconnu');
      return byName.id;
    }
    const only = await this.companies.find({ take: 2 });
    if (only.length === 1) return only[0].id;
    throw new BadRequestException('Préciser companyId ou companySlug');
  }

  private isRemonteeGroup(groupName?: string): boolean {
    if (!groupName) return true; // pas de filtre fourni → accepter
    const filter = (process.env.REMONTEE_WHATSAPP_GROUP || 'Remontée').toLowerCase();
    const g = groupName.toLowerCase();
    const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return norm(g).includes(norm(filter)) || g.includes('remont');
  }

  async ingest(dto: RemonteeIngestDto) {
    if (!this.isRemonteeGroup(dto.groupName)) {
      this.logger.log(`Message ignoré (groupe « ${dto.groupName} » ≠ Remontée)`);
      return { ignored: true, reason: 'groupe hors périmètre Remontée' };
    }

    const companyId = await this.resolveCompanyId(dto);
    const senderName = dto.senderName || dto.senderPhone || 'WhatsApp Remontée';
    const text = (dto.text || '').trim();

    if (!text && !dto.photoUrl) {
      throw new BadRequestException('text ou photoUrl requis');
    }

    const chat = await this.chat.ingestToRemontee(companyId, {
      body: text || 'Photo Remontée',
      photoUrl: dto.photoUrl,
      senderName,
      source: 'whatsapp',
    });

    let vision: {
      incidentId?: string;
      incidentNumber?: string;
      rubrique?: string | null;
      error?: string;
    } | null = null;

    const shouldVision = dto.runVision !== false && Boolean(dto.photoUrl);
    if (shouldVision && dto.photoUrl) {
      try {
        const result = await this.iaVision.analyzeImage(
          companyId,
          {
            imageUrl: dto.photoUrl,
            annotation: text || undefined,
          },
          null,
        );
        vision = {
          incidentId: result.incident?.id,
          incidentNumber: result.incident?.incidentNumber,
          rubrique: result.analysis?.rubriqueDetected || result.incident?.rubrique,
        };
        await this.chat.ingestToRemontee(companyId, {
          body: `IA Vision : ${vision.incidentNumber || 'OK'} · ${vision.rubrique || '—'} (validation humaine requise)`,
          senderName: 'VECTRACOM IA',
          source: 'system',
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.warn(`IA Vision Remontée échouée : ${msg}`);
        vision = { error: msg };
        await this.chat.ingestToRemontee(companyId, {
          body: `IA Vision : échec analyse — ${msg.slice(0, 120)}`,
          senderName: 'VECTRACOM IA',
          source: 'system',
        });
      }
    }

    return {
      ignored: false,
      companyId,
      chat,
      vision,
    };
  }
}

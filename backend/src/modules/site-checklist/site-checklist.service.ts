import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  SiteChecklistTemplate,
  SiteSheetType,
  SiteChecklistSection,
} from './entities/site-checklist-template.entity';
import { Mission } from '../missions/entities/mission.entity';
import { MissionFieldReport } from '../missions/entities/field-report.entity';
import { PriceItem } from '../stock/entities/price-item.entity';
import { SaveSiteChecklistDto } from './dto/save-site-checklist.dto';

/** Correspondance type de mission → fiche de chantier. */
const MISSION_TO_SHEET: Record<string, SiteSheetType> = {
  OSM: 'OSM',
  GC: 'GC',
  DENSIFICATION: 'DENSIF',
  SURVEY_OSM: 'SURVEY_OSM',
};

@Injectable()
export class SiteChecklistService {
  constructor(
    @InjectRepository(SiteChecklistTemplate)
    private readonly templateRepository: Repository<SiteChecklistTemplate>,
    @InjectRepository(Mission)
    private readonly missionRepository: Repository<Mission>,
    @InjectRepository(MissionFieldReport)
    private readonly reportRepository: Repository<MissionFieldReport>,
    @InjectRepository(PriceItem)
    private readonly priceItemRepository: Repository<PriceItem>,
  ) {}

  async createTemplate(
    companyId: string,
    dto: {
      templateType: string;
      label: string;
      description?: string;
      sections: SiteChecklistSection[];
      requiredPhotos?: Array<{ type: string; label: string; count: number }>;
      extraFields?: Record<string, unknown>;
    },
  ) {
    const templateType = dto.templateType as SiteSheetType;
    const existing = await this.templateRepository.findOne({ where: { companyId, templateType } });
    if (existing) {
      throw new BadRequestException(`Un template ${templateType} existe déjà pour ce tenant`);
    }
    return this.templateRepository.save(
      this.templateRepository.create({
        companyId,
        templateType,
        label: dto.label,
        description: dto.description ?? null,
        sections: dto.sections,
        requiredPhotos: dto.requiredPhotos ?? [],
        extraFields: dto.extraFields ?? {},
      }),
    );
  }

  listTemplates(companyId: string) {
    return this.templateRepository.find({ where: { companyId }, order: { templateType: 'ASC' } });
  }

  async findTemplate(companyId: string, templateType: SiteSheetType) {
    const template = await this.templateRepository.findOne({ where: { companyId, templateType } });
    if (!template) throw new NotFoundException(`Template ${templateType} introuvable`);
    return template;
  }

  async updateTemplate(
    companyId: string,
    templateType: SiteSheetType,
    dto: {
      label?: string;
      description?: string | null;
      sections?: SiteChecklistSection[];
      requiredPhotos?: Array<{ type: string; label: string; count: number }>;
      extraFields?: Record<string, unknown>;
    },
  ) {
    const template = await this.findTemplate(companyId, templateType);
    Object.assign(template, {
      ...(dto.label !== undefined ? { label: dto.label } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.sections !== undefined ? { sections: dto.sections } : {}),
      ...(dto.requiredPhotos !== undefined ? { requiredPhotos: dto.requiredPhotos } : {}),
      ...(dto.extraFields !== undefined ? { extraFields: dto.extraFields } : {}),
    });
    return this.templateRepository.save(template);
  }

  async removeTemplate(companyId: string, templateType: SiteSheetType) {
    const template = await this.findTemplate(companyId, templateType);
    await this.templateRepository.remove(template);
    return { deleted: true };
  }

  /** Fiche d'une mission : template applicable + données déjà saisies. */
  async getForMission(companyId: string, missionId: string) {
    const mission = await this.missionRepository.findOne({ where: { companyId, id: missionId } });
    if (!mission) throw new NotFoundException('Mission introuvable');

    const sheetType = MISSION_TO_SHEET[mission.typeTache];
    if (!sheetType) {
      return { applicable: false, templateType: null, template: null, saved: null };
    }
    const template = await this.findTemplate(companyId, sheetType).catch(() => null);
    const report = await this.reportRepository.findOne({ where: { missionId } });
    return {
      applicable: true,
      templateType: sheetType,
      template,
      saved: (report?.data?.siteChecklist as Record<string, unknown>) ?? null,
    };
  }

  /**
   * Sauvegarde de la fiche : données + photos dans le rapport terrain
   * (data.siteChecklist), valorisation des items du bordereau dans
   * priceItemsUsed et montantTotal (prix de la version active du bordereau).
   */
  async saveForMission(companyId: string, missionId: string, dto: SaveSiteChecklistDto) {
    const mission = await this.missionRepository.findOne({ where: { companyId, id: missionId } });
    if (!mission) throw new NotFoundException('Mission introuvable');

    const sheetType = MISSION_TO_SHEET[mission.typeTache];
    if (!sheetType) {
      throw new BadRequestException(
        `Pas de fiche de chantier pour le type ${mission.typeTache} (OSM, GC, DENSIFICATION, SURVEY_OSM)`,
      );
    }

    let report = await this.reportRepository.findOne({ where: { missionId } });
    if (!report) {
      report = await this.reportRepository.save(
        this.reportRepository.create({
          companyId,
          missionId,
          missionType: mission.typeTache,
        }),
      );
    }

    // Valorisation bordereau : quantités × prix unitaire (version 2025 active).
    const priceLines: Array<{ itemNumber: number; quantity: number; unitPrice?: number }> = [];
    let montantTotal = 0;
    for (const line of dto.priceItems ?? []) {
      const priceItem = await this.priceItemRepository.findOne({
        where: { companyId, itemNumber: line.itemNumber, version: '2025', isActive: true },
      });
      const unitPrice = priceItem ? Number(priceItem.unitPrice) : 0;
      priceLines.push({ ...line, unitPrice });
      montantTotal += unitPrice * line.quantity;
    }
    if (priceLines.length > 0) {
      report.priceItemsUsed = priceLines;
      report.montantTotal = String(montantTotal);
    }

    report.data = {
      ...report.data,
      siteChecklist: {
        templateType: sheetType,
        savedAt: new Date().toISOString(),
        data: dto.data,
        photos: dto.photos ?? [],
      },
    };
    await this.reportRepository.save(report);

    return {
      templateType: sheetType,
      missionId,
      priceItemsUsed: priceLines,
      montantTotal,
    };
  }
}

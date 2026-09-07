import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ComplianceChecklistTemplate, ChecklistItem } from './entities/checklist-template.entity';
import { ComplianceRecord, ComplianceStatus } from './entities/compliance-record.entity';
import {
  CompanyComplianceDocument,
  ComplianceDocType,
} from './entities/company-compliance-document.entity';
import { Team } from '../teams/entities/team.entity';
import { CreateChecklistTemplateDto } from './dto/create-checklist-template.dto';
import { CreateComplianceDocumentDto } from './dto/create-compliance-document.dto';

@Injectable()
export class ComplianceService {
  constructor(
    @InjectRepository(ComplianceChecklistTemplate)
    private readonly checklistRepository: Repository<ComplianceChecklistTemplate>,
    @InjectRepository(ComplianceRecord)
    private readonly recordRepository: Repository<ComplianceRecord>,
    @InjectRepository(CompanyComplianceDocument)
    private readonly documentRepository: Repository<CompanyComplianceDocument>,
    @InjectRepository(Team)
    private readonly teamRepository: Repository<Team>,
  ) {}

  // ------------------- Checklists opérationnelles -------------------

  async createChecklist(companyId: string, dto: CreateChecklistTemplateDto) {
    const missionType = dto.missionType.trim().toUpperCase();
    const existing = await this.checklistRepository.findOne({ where: { companyId, missionType } });
    if (existing) throw new ConflictException(`Checklist déjà définie pour ${missionType}`);
    return this.checklistRepository.save(
      this.checklistRepository.create({ companyId, missionType, items: dto.items }),
    );
  }

  listChecklists(companyId: string) {
    return this.checklistRepository.find({ where: { companyId }, order: { missionType: 'ASC' } });
  }

  async findChecklist(companyId: string, id: string) {
    const checklist = await this.checklistRepository.findOne({ where: { companyId, id } });
    if (!checklist) throw new NotFoundException('Checklist introuvable');
    return checklist;
  }

  async updateChecklist(companyId: string, id: string, items: ChecklistItem[]) {
    const checklist = await this.findChecklist(companyId, id);
    checklist.items = items;
    return this.checklistRepository.save(checklist);
  }

  async removeChecklist(companyId: string, id: string) {
    const checklist = await this.findChecklist(companyId, id);
    await this.checklistRepository.remove(checklist);
    return { deleted: true };
  }

  // ------------------- Records par équipe -------------------

  async createRecord(companyId: string, teamId: string) {
    const team = await this.teamRepository.findOne({ where: { companyId, id: teamId } });
    if (!team) throw new BadRequestException('Équipe inconnue pour ce tenant');
    const existing = await this.recordRepository.findOne({ where: { companyId, teamId } });
    if (existing) throw new ConflictException(`Un record de conformité existe déjà pour ${team.name}`);
    await this.recordRepository.save(this.recordRepository.create({ companyId, teamId }));
    // Relecture avec l'équipe chargée (réponse API complète).
    return this.recordRepository.findOne({ where: { companyId, teamId }, relations: ['team'] });
  }

  async listRecords(companyId: string, filters: { teamId?: string; status?: string }) {
    const qb = this.recordRepository
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.team', 'team')
      .where('r.company_id = :companyId', { companyId })
      .orderBy('team.name', 'ASC');
    if (filters.teamId) qb.andWhere('r.team_id = :teamId', { teamId: filters.teamId });
    if (filters.status) qb.andWhere('r.status = :status', { status: filters.status });
    return qb.getMany();
  }

  async updateRecord(
    companyId: string,
    id: string,
    dto: { status?: string; observations?: string | null },
  ) {
    const record = await this.recordRepository.findOne({ where: { companyId, id } });
    if (!record) throw new NotFoundException('Record de conformité introuvable');
    if (dto.status !== undefined) record.status = dto.status as ComplianceStatus;
    if (dto.observations !== undefined) record.observations = dto.observations;
    return this.recordRepository.save(record);
  }

  // ------------------- Documents contractuels (3 piliers) -------------------

  async addDocument(companyId: string, dto: CreateComplianceDocumentDto) {
    return this.documentRepository.save(
      this.documentRepository.create({
        companyId,
        docType: dto.docType as ComplianceDocType,
        fileUrl: dto.fileUrl.trim(),
        signed: dto.signed ?? false,
        signedAt: dto.signedAt?.slice(0, 10) ?? null,
      }),
    );
  }

  listDocuments(companyId: string) {
    return this.documentRepository.find({ where: { companyId }, order: { docType: 'ASC' } });
  }

  async updateDocument(
    companyId: string,
    id: string,
    dto: { signed?: boolean; signedAt?: string | null; fileUrl?: string },
  ) {
    const doc = await this.documentRepository.findOne({ where: { companyId, id } });
    if (!doc) throw new NotFoundException('Document introuvable');
    if (dto.signed !== undefined) doc.signed = dto.signed;
    if (dto.signedAt !== undefined) doc.signedAt = dto.signedAt?.slice(0, 10) ?? null;
    if (dto.fileUrl !== undefined) doc.fileUrl = dto.fileUrl;
    return this.documentRepository.save(doc);
  }

  async removeDocument(companyId: string, id: string) {
    const doc = await this.documentRepository.findOne({ where: { companyId, id } });
    if (!doc) throw new NotFoundException('Document introuvable');
    await this.documentRepository.remove(doc);
    return { deleted: true };
  }

  /** Synthèse contractuelle : les 3 piliers signés ? */
  async contractSummary(companyId: string) {
    const docs = await this.documentRepository.find({ where: { companyId } });
    const pillars = (['code_conduite', 'charte_sst', 'dechets_d3e'] as const).map((type) => {
      const signed = docs.filter((d) => d.docType === type && d.signed);
      return { pillar: type, signed: signed.length > 0, documents: docs.filter((d) => d.docType === type).length };
    });
    return { pillars, complete: pillars.every((p) => p.signed) };
  }

  /** Lot P5 — met à jour les domaines d'habilitation et l'étape de validation. */
  async updateHabilitation(
    companyId: string,
    recordId: string,
    dto: { habilitationDomains?: string[]; validationStep?: string },
  ) {
    const record = await this.recordRepository.findOne({ where: { companyId, id: recordId } });
    if (!record) throw new NotFoundException('Dossier équipe introuvable');
    if (dto.habilitationDomains !== undefined) {
      record.habilitationDomains = dto.habilitationDomains;
    }
    if (dto.validationStep !== undefined) {
      record.validationStep = dto.validationStep as typeof record.validationStep;
    }
    return this.recordRepository.save(record);
  }

  /** Export Excel VALIDATION EQUIPES 3STB (9 domaines + étape). */
  async exportValidation3stb(companyId: string): Promise<Buffer> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const XLSX = require('xlsx') as typeof import('xlsx');
    const {
      HABILITATION_DOMAINS,
      HABILITATION_DOMAIN_LABELS,
    } = require('./entities/compliance-record.entity') as typeof import('./entities/compliance-record.entity');

    const records = await this.recordRepository.find({
      where: { companyId },
      relations: ['team'],
      order: { createdAt: 'ASC' },
    });

    const rows = records.map((r) => {
      const row: Record<string, string> = {
        Equipe: r.team?.name ?? r.teamId,
        Zone: r.team?.zone ?? '',
        Statut: r.status,
        Etape: r.validationStep,
      };
      for (const d of HABILITATION_DOMAINS) {
        row[HABILITATION_DOMAIN_LABELS[d]] = (r.habilitationDomains ?? []).includes(d) ? 'OUI' : '';
      }
      row.Observations = r.observations ?? '';
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(
      rows.length ? rows : [{ Equipe: '(aucune équipe)', Statut: '', Etape: '' }],
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'VALIDATION_3STB');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }
}

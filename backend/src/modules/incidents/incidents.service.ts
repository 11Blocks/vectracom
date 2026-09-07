import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Incident,
  IncidentRubrique,
  IncidentSeverity,
  IncidentStatus,
} from './entities/incident.entity';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { Mission } from '../missions/entities/mission.entity';
import { PdfGeneratorService } from '../../common/pdf/pdf-generator.service';

/** Transitions autorisées du cycle de vie incident. */
const STATUS_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  signalement: ['en_cours'],
  en_cours: ['en_attente', 'corrige'],
  en_attente: ['en_cours'],
  corrige: ['cloture'],
  cloture: [],
};

/** Sévérité déduite de l'impact client (>50 CRITICAL, ≥10 MAJEUR, >0 MINEUR). */
export function severityFromClients(clients: number): IncidentSeverity {
  if (clients > 50) return 'CRITICAL';
  if (clients >= 10) return 'MAJEUR';
  if (clients > 0) return 'MINEUR';
  return 'INFORMATION';
}

@Injectable()
export class IncidentsService {
  constructor(
    @InjectRepository(Incident)
    private readonly incidentRepository: Repository<Incident>,
    @InjectRepository(Mission)
    private readonly missionRepository: Repository<Mission>,
    private readonly pdf: PdfGeneratorService,
  ) {}

  /** Numéro INC-YYYY-NNNN séquentiel par tenant et par année. */
  private async nextIncidentNumber(companyId: string): Promise<string> {
    const year = new Date().getUTCFullYear();
    const count = await this.incidentRepository.count({ where: { companyId } });
    return `INC-${year}-${String(count + 1).padStart(4, '0')}`;
  }

  async create(companyId: string, dto: CreateIncidentDto, reportedBy: string | null): Promise<Incident> {
    const clients = dto.clientsImpacted ?? 0;
    return this.incidentRepository.save(
      this.incidentRepository.create({
        companyId,
        incidentNumber: await this.nextIncidentNumber(companyId),
        source: (dto.source as never) ?? 'WHATSAPP',
        reportedBy,
        rubrique: dto.rubrique as IncidentRubrique,
        zone: dto.zone.trim(),
        olt: dto.olt?.trim() ?? null,
        gpsLatitude: dto.gpsLatitude !== undefined ? String(dto.gpsLatitude) : null,
        gpsLongitude: dto.gpsLongitude !== undefined ? String(dto.gpsLongitude) : null,
        address: dto.address ?? null,
        pboReference: dto.pboReference ?? null,
        pboDefaut: (dto.pboDefaut as never) ?? null,
        pboAnnee: dto.pboAnnee ?? null,
        pboSemaine: dto.pboSemaine ?? null,
        pboPlaque: dto.pboPlaque ?? null,
        pboConstitutions: dto.pboConstitutions ?? null,
        pboEquipeAssignee: dto.pboEquipeAssignee ?? null,
        pioType: (dto.pioType as never) ?? null,
        pioEtat: (dto.pioEtat as never) ?? null,
        pioNbCables: dto.pioNbCables ?? null,
        pioCableType: dto.pioCableType ?? null,
        pioAccessoires: dto.pioAccessoires ?? null,
        chambreType: (dto.chambreType as never) ?? null,
        chambreEtat: (dto.chambreEtat as never) ?? null,
        clientsImpacted: clients,
        ndList: dto.ndList ?? [],
        annotationOriginale: dto.annotationOriginale ?? null,
        photos: dto.photos ?? [],
        status: 'signalement',
        severity: severityFromClients(clients),
      }),
    );
  }

  async list(
    companyId: string,
    filters: { rubrique?: string; status?: string; zone?: string; severity?: string },
  ) {
    const qb = this.incidentRepository
      .createQueryBuilder('i')
      .where('i.company_id = :companyId', { companyId })
      .orderBy('i.reportedAt', 'DESC')
      .take(500);
    if (filters.rubrique) qb.andWhere('i.rubrique = :r', { r: filters.rubrique });
    if (filters.status) qb.andWhere('i.status = :s', { s: filters.status });
    if (filters.severity) qb.andWhere('i.severity = :sev', { sev: filters.severity });
    if (filters.zone) qb.andWhere('i.zone ILIKE :z', { z: `%${filters.zone}%` });
    return qb.getMany();
  }

  async findOne(companyId: string, id: string): Promise<Incident> {
    const incident = await this.incidentRepository.findOne({ where: { companyId, id } });
    if (!incident) throw new NotFoundException('Incident introuvable');
    return incident;
  }

  async assignTeam(companyId: string, id: string, dto: { teamId: string; technicianIds?: string[]; validationNotes?: string }) {
    const incident = await this.findOne(companyId, id);
    if (incident.status === 'cloture') throw new BadRequestException('Incident clôturé');
    incident.assignedTeamId = dto.teamId;
    incident.assignedTechnicianIds = dto.technicianIds ?? [];
    incident.assignedAt = new Date();
    incident.validationNotes = dto.validationNotes ?? incident.validationNotes;
    if (incident.status === 'signalement') incident.status = 'en_cours';
    return this.incidentRepository.save(incident);
  }

  async updateStatus(companyId: string, id: string, dto: { status: string; validationNotes?: string }) {
    const incident = await this.findOne(companyId, id);
    const target = dto.status as IncidentStatus;
    const allowed = STATUS_TRANSITIONS[incident.status] ?? [];
    if (!allowed.includes(target)) {
      throw new BadRequestException(
        `Transition interdite : ${incident.status} -> ${target} (autorisées : ${allowed.join(', ') || 'aucune'})`,
      );
    }
    incident.status = target;
    if (dto.validationNotes !== undefined) incident.validationNotes = dto.validationNotes;
    return this.incidentRepository.save(incident);
  }

  async resolve(companyId: string, id: string, dto: { actionTaken: string; resolutionDetails?: Record<string, unknown>; resolvedBy?: string }) {
    const incident = await this.findOne(companyId, id);
    if (!['en_cours', 'en_attente'].includes(incident.status)) {
      throw new BadRequestException(`Résolution impossible depuis le statut ${incident.status}`);
    }
    incident.actionTaken = dto.actionTaken;
    incident.resolutionDetails = dto.resolutionDetails ?? null;
    incident.resolvedAt = new Date();
    incident.resolvedBy = dto.resolvedBy ?? null;
    incident.status = 'corrige';
    return this.incidentRepository.save(incident);
  }

  /** Rapport PDF : localisation, annotation, actions, matériel, résolution. */
  async generateReport(companyId: string, id: string): Promise<{ buffer: Buffer; fileName: string }> {
    const i = await this.findOne(companyId, id);
    if (!i.resolvedAt) throw new BadRequestException('Incident non résolu — rapport impossible');

    const lines: Array<{ text: string; size?: number; bold?: boolean; spaceBefore?: number }> = [
      { text: 'VECTRACOM', size: 16, bold: true },
      { text: `Rapport d'incident ${i.incidentNumber}`, size: 14, bold: true, spaceBefore: 4 },
      { text: `Rubrique : ${i.rubrique}    Severite : ${i.severity}    Statut : ${i.status}`, spaceBefore: 8 },
      { text: `Zone : ${i.zone}${i.olt ? ' (OLT ' + i.olt + ')' : ''}` },
      { text: `GPS : ${i.gpsLatitude ?? '-'}, ${i.gpsLongitude ?? '-'}` },
      { text: `Signale le ${new Date(i.reportedAt).toLocaleString('fr-FR')} via ${i.source}` },
      ...(i.pboReference ? [{ text: `PBO : ${i.pboReference} - defaut ${i.pboDefaut ?? '-'}`, spaceBefore: 8 }] : []),
      ...(i.pioType ? [{ text: `PIO : ${i.pioType} - etat ${i.pioEtat ?? '-'} - ${i.pioNbCables ?? 0} cable(s)`, spaceBefore: 8 }] : []),
      ...(i.chambreType ? [{ text: `Chambre : ${i.chambreType} - etat ${i.chambreEtat ?? '-'}`, spaceBefore: 8 }] : []),
      { text: `Clients impactes : ${i.clientsImpacted}`, spaceBefore: 8 },
      ...(i.annotationOriginale ? [{ text: `Annotation : ${i.annotationOriginale.slice(0, 100)}`, size: 9 }] : []),
      { text: 'Traitement', size: 12, bold: true, spaceBefore: 12 },
      { text: `Equipe assignee : ${i.assignedTeamId ?? '-'}` },
      { text: `Action realisee : ${i.actionTaken ?? '-'}` },
      { text: `Resolu le ${i.resolvedAt ? new Date(i.resolvedAt).toLocaleString('fr-FR') : '-'}` },
      ...(i.resolutionDetails?.items_used
        ? [{ text: `Materiel : ${JSON.stringify(i.resolutionDetails.items_used)}`, size: 9 }]
        : []),
      { text: `Photos : ${i.photos.length} piece(s) jointe(s)` },
    ];

    const buffer = this.pdf.generate(lines);
    i.reportPdfUrl = `/api/v1/incidents/${i.id}/report`;
    i.reportGeneratedAt = new Date();
    await this.incidentRepository.save(i);
    return { buffer, fileName: `${i.incidentNumber}.pdf` };
  }

  async close(companyId: string, id: string) {
    const incident = await this.findOne(companyId, id);
    if (incident.status !== 'corrige') throw new BadRequestException('Clôture : incident doit être corrige');
    incident.status = 'cloture';
    return this.incidentRepository.save(incident);
  }

  /**
   * Génération de missions SAV depuis un incident — toujours déclenchée par un
   * humain (jamais automatique). Mode groupée (1 mission pour tous les ND) ou
   * individuelle (1 mission par ND). Les missions créées sont liées à
   * l'incident via relatedMissionIds.
   */
  async generateSavMissions(
    companyId: string,
    id: string,
    dto: { mode: 'groupee' | 'individuelle'; teamId?: string; dateMission?: string },
  ): Promise<{ incident: Incident; created: Mission[] }> {
    const incident = await this.findOne(companyId, id);
    if (incident.status === 'cloture') throw new BadRequestException('Incident clôturé — génération SAV impossible');

    const nds = (incident.ndList ?? []).filter(Boolean);
    const targets = dto.mode === 'individuelle' && nds.length > 0 ? nds : [null];
    if (dto.mode === 'individuelle' && nds.length === 0) {
      throw new BadRequestException('Mode individuelle impossible : aucune liste ND sur cet incident');
    }

    const dateMission = dto.dateMission ? new Date(dto.dateMission) : new Date(Date.now() + 86_400_000);
    const created: Mission[] = [];
    for (const nd of targets) {
      const mission = await this.missionRepository.save(
        this.missionRepository.create({
          companyId,
          clientSite: nd
            ? `SAV ${nd} — incident ${incident.incidentNumber}`
            : `SAV incident ${incident.incidentNumber} (${nds.length || incident.clientsImpacted} client(s))`,
          typeTache: 'SAV',
          zone: incident.zone,
          dateMission,
          status: 'planifiee',
          teamId: dto.teamId ?? incident.assignedTeamId ?? null,
          sonatelOlt: incident.olt,
          importMeta: {
            teamLabel: null,
            technicians: [],
            sourceFile: `incident:${incident.incidentNumber}`,
          },
        }),
      );
      created.push(mission);
    }

    incident.relatedMissionIds = [...(incident.relatedMissionIds ?? []), ...created.map((m) => m.id)];
    incident.status = incident.status === 'signalement' ? 'en_cours' : incident.status;
    const saved = await this.incidentRepository.save(incident);
    return { incident: saved, created };
  }

}

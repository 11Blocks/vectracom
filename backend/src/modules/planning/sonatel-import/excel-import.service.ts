import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as XLSX from 'xlsx';
import { Company } from '../../auth/entities/company.entity';
import { Mission, TERMINAL_MISSION_STATUSES } from '../../missions/entities/mission.entity';
import { AuditService } from '../../../common/audit/audit.service';
import { Partner } from '../../partners/entities/partner.entity';
import { classifyBlocage } from '../../../common/sonatel-vocabulary';
import { ColumnMappingService } from './column-mapping.service';
import { PreviewStoreService } from './preview-store.service';
import { ImportPreviewRowDto } from './dto/import-preview-row.dto';
import { TechnicianResolverService } from '../../technicians/technician-resolver.service';

type RawRow = Record<string, unknown>;

interface MappedRow {
  dossierNumber: string | null;
  client: string | null;
  task: string | null;
  zone: string | null;
  dateMission: Date | null;
  olt: string | null;
  produit: string | null;
  subcontractor: string | null;
  // Champs réels du Planning global FTTH (lot P1)
  segment: string | null;
  coper: string | null;
  commandeClient: string | null;
  typeLogement: string | null;
  clientAvise: string | null;
  contactClient: string | null;
  heure: string | null;
  ageDays: number | null;
  srPlaque: string | null;
  gpsEasyWork: string | null;
  ciPrcl: string | null;
  importSource: 'PLANNING' | 'SURCH' | 'TRAITEES';
  blocageMotif: string | null;
  /** Motif normalisé (zone_ineligible, saturation…). */
  blocageCode: string | null;
  gpsFromMotif: string | null;
  /** Libellé équipe lu directement dans la feuille (colonne EQUIPE). */
  equipe: string | null;
}

interface AffectInfo {
  team: string | null;
  technicians: string[];
  heureDebut: string | null;
  heureFin: string | null;
}

export interface ImportStats {
  totalRows: number;
  afterSubcontractorFilter: number;
  nouvelle: number;
  mise_a_jour: number;
  ignoree: number;
  invalide: number;
}

@Injectable()
export class ExcelImportService {
  private readonly logger = new Logger(ExcelImportService.name);

  constructor(
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(Mission)
    private readonly missionRepository: Repository<Mission>,
    @InjectRepository(Partner)
    private readonly partnerRepository: Repository<Partner>,
    private readonly mappingService: ColumnMappingService,
    private readonly previewStore: PreviewStoreService,
    private readonly technicianResolver: TechnicianResolverService,
    private readonly audit: AuditService,
  ) {}

  // ------------------------------------------------------------------
  // 1. Aperçu : parse → filtre ST → jointure AFFECT → doublons → stats
  // ------------------------------------------------------------------

  async preview(
    file: { buffer: Buffer; originalname: string },
    companyId: string,
    options?: { includeTraitees?: boolean },
  ) {
    const company = await this.companyRepository.findOne({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Tenant introuvable');

    const workbook = this.parseFile(file.buffer);
    const planningRows = this.extractPlanningSheet(workbook);
    const surchRows = this.extractSheet(workbook, 'SURCH');
    const traiteesRows = options?.includeTraitees ? this.extractSheet(workbook, 'TRAITEES') : [];
    const affectRows = this.extractAffectSheet(workbook);

    const subcontractor = company.sonatelSubcontractorName;
    const partnerCodes = (await this.partnerRepository.find({ where: { companyId } }))
      .filter((p) => p.active)
      .map((p) => p.code);
    const filteredPlanning = this.filterBySubcontractor(planningRows, subcontractor, partnerCodes);
    const filteredSurch = this.filterBySubcontractor(surchRows, subcontractor, partnerCodes);
    const filteredTraitees = this.filterBySubcontractor(traiteesRows, subcontractor, partnerCodes);

    const mappings = await this.mappingService.getEffective(companyId);
    const mapped = [
      ...this.mapColumns(filteredPlanning, mappings.planning, 'PLANNING'),
      ...this.mapColumns(filteredSurch, mappings.planning, 'SURCH'),
      ...this.mapColumns(filteredTraitees, mappings.planning, 'TRAITEES'),
    ];
    const affectByDossier = this.buildAffectIndex(affectRows, mappings.affect);

    const existing = await this.detectDuplicates(mapped, companyId);
    const rows: ImportPreviewRowDto[] = mapped.map((row) => {
      const affect = affectByDossier.get(row.dossierNumber ?? '') ?? {
        team: null,
        technicians: [],
        heureDebut: null,
        heureFin: null,
      };
      if (!affect.team && row.equipe) {
        return this.classifyRow(
          row,
          { team: row.equipe, technicians: [], heureDebut: affect.heureDebut, heureFin: affect.heureFin },
          existing,
        );
      }
      return this.classifyRow(row, affect, existing);
    });

    const totalInput = planningRows.length + surchRows.length + traiteesRows.length;
    const stats = this.computeStats(totalInput, mapped.length, rows);
    const { fileId } = this.previewStore.save(companyId, file.originalname, rows);
    this.logger.log(
      `Aperçu ${file.originalname} (${company.name}) : ${stats.afterSubcontractorFilter}/${stats.totalRows} lignes ST [PLANNING ${filteredPlanning.length} + SURCH ${filteredSurch.length} + TRAITEES ${filteredTraitees.length}] → ${stats.nouvelle} nouvelle(s), ${stats.mise_a_jour} màj, ${stats.ignoree} ignorée(s), ${stats.invalide} invalide(s)`,
    );

    return {
      fileId,
      fileName: file.originalname,
      affectSheetFound: affectRows !== null,
      surchCount: filteredSurch.length,
      traiteesCount: filteredTraitees.length,
      subcontractorFilter: subcontractor,
      usingDefaultMappings: mappings.usingDefaults,
      stats,
      rows,
    };
  }

  // ------------------------------------------------------------------
  // 2. Confirmation : écriture idempotente en base
  // ------------------------------------------------------------------

  async confirm(fileId: string, companyId: string, selectedRows?: string[], userId: string | null = null) {
    const preview = this.previewStore.get(fileId);
    if (!preview) throw new NotFoundException('Aperçu expiré ou introuvable — relancez l\'upload');
    if (preview.companyId !== companyId) {
      throw new NotFoundException('Aperçu expiré ou introuvable — relancez l\'upload');
    }

    const selection = new Set(selectedRows ?? []);
    const candidates = preview.rows.filter(
      (r) =>
        (r.action === 'nouvelle' || r.action === 'mise_a_jour') &&
        (selection.size === 0 || selection.has(r.dossierNumber)),
    );
    // Un même dossier présent plusieurs fois dans le fichier : la dernière ligne l'emporte.
    const byDossier = new Map<string, (typeof candidates)[number]>();
    for (const r of candidates) byDossier.set(r.dossierNumber, r);
    const importable = [...byDossier.values()];
    const duplicatesInFile = candidates.length - importable.length;

    let created = 0;
    let updated = 0;
    let skippedClosed = 0;
    let keptManualTeam = 0;
    // Cache de résolution libellés → IDs (une équipe/technicien résolu une fois par import).
    const resolveCache = new Map<string, { teamId: string | null; technicianIds: string[] }>();
    // Partenaires du tenant : code ST (SOFATELCOM…) → id.
    const partnerRows = await this.partnerRepository.find({ where: { companyId } });
    const partnerByCode = new Map(partnerRows.map((p) => [p.code.toUpperCase(), p.id]));

    // Résolution des libellés équipe/techniciens avant l'écriture.
    const resolved = new Map<string, { teamId: string | null; technicianIds: string[]; hasLabels: boolean }>();
    for (const row of importable) {
      const teamLabel = row.team ?? null;
      const techLabels = row.technicians ?? [];
      const hasLabels = Boolean(teamLabel) || techLabels.length > 0;
      let teamId: string | null = null;
      let technicianIds: string[] = [];
      if (hasLabels) {
        const cacheKey = `${teamLabel ?? ''}|${techLabels.join(';')}`;
        if (!resolveCache.has(cacheKey)) {
          const r = await this.technicianResolver.resolve(companyId, teamLabel, techLabels);
          resolveCache.set(cacheKey, { teamId: r.teamId, technicianIds: r.technicianIds });
        }
        ({ teamId, technicianIds } = resolveCache.get(cacheKey)!);
      }
      resolved.set(row.dossierNumber, { teamId, technicianIds, hasLabels });
    }

    // Écriture tout-ou-rien : une erreur annule l'import complet.
    await this.missionRepository.manager.transaction(async (em) => {
    for (const row of importable) {
      const { teamId, technicianIds, hasLabels } = resolved.get(row.dossierNumber)!;

      const existing = await em.findOne(Mission, {
        where: { companyId, sonatelDossierNumber: row.dossierNumber },
      });

      const extras = this.sonatelExtras(row, partnerByCode);

      if (existing) {
        if (TERMINAL_MISSION_STATUSES.includes(existing.status)) {
          skippedClosed++;
          continue;
        }
        existing.clientSite = row.client ?? existing.clientSite;
        existing.typeTache = row.task ?? existing.typeTache;
        existing.zone = row.zone ?? existing.zone;
        // Une mission déjà démarrée garde sa date.
        if (row.dateMission && existing.status !== 'en_cours') existing.dateMission = new Date(row.dateMission);
        existing.sonatelOlt = row.olt ?? existing.sonatelOlt;
        Object.assign(existing, extras);
        const manualTeam = existing.importMeta?.teamAssignedBy === 'manual' && !!existing.teamId;
        if (hasLabels && !manualTeam) {
          if (teamId) existing.teamId = teamId;
          if (technicianIds.length > 0) existing.technicianIds = technicianIds;
        }
        if (hasLabels && manualTeam && teamId && teamId !== existing.teamId) keptManualTeam++;
        existing.importMeta = {
          ...existing.importMeta,
          teamLabel: row.team ?? null,
          technicians: row.technicians ?? [],
          heureDebut: row.heureDebut ?? null,
          heureFin: row.heureFin ?? null,
          sourceFile: preview.fileName,
          ...(hasLabels && !manualTeam && teamId ? { teamAssignedBy: 'import' as const } : {}),
        };
        await em.save(existing);
        updated++;
      } else {
        await em.insert(Mission, {
          companyId,
          teamId: hasLabels ? teamId : null,
          technicianIds: hasLabels ? technicianIds : [],
          clientSite: row.client ?? '(client non renseigné)',
          typeTache: row.task ?? '(tâche non renseignée)',
          zone: row.zone ?? null,
          dateMission: row.dateMission ? new Date(row.dateMission) : new Date(),
          status: 'planifiee',
          sonatelDossierNumber: row.dossierNumber,
          sonatelOlt: row.olt ?? null,
          sonatelProduit: null,
          ...extras,
          importMeta: {
            teamLabel: row.team ?? null,
            technicians: row.technicians ?? [],
            heureDebut: row.heureDebut ?? null,
            heureFin: row.heureFin ?? null,
            sourceFile: preview.fileName,
            ...(hasLabels && teamId ? { teamAssignedBy: 'import' as const } : {}),
          },
        });
        created++;
      }
    }
    });

    this.previewStore.delete(fileId);
    this.logger.log(`Import confirmé (${preview.fileName}) : ${created} créée(s), ${updated} mise(s) à jour`);
    const result = {
      fileName: preview.fileName,
      selected: importable.length,
      created,
      updated,
      skippedClosed,
      duplicatesInFile,
      keptManualTeam,
    };
    await this.audit.log({
      companyId, actorId: userId, action: 'planning.import', entityType: 'planning_import', entityId: null,
      payload: result,
    });
    return result;
  }

  /** Historique des imports planning (journal d'audit). */
  async history(companyId: string) {
    const rows = await this.missionRepository.query(
      `SELECT a.created_at AS "at", a.payload, u.full_name AS "userName", u.email AS "userEmail"
         FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id
        WHERE a.company_id = $1 AND a.action = 'planning.import'
        ORDER BY a.created_at DESC LIMIT 50`,
      [companyId],
    );
    return rows;
  }

  // ------------------------------------------------------------------
  // Méthodes unitaires (testables indépendamment)
  // ------------------------------------------------------------------

  /** Lit le classeur Excel depuis un buffer. */
  parseFile(buffer: Buffer): XLSX.WorkBook {
    try {
      return XLSX.read(buffer, { type: 'buffer', cellDates: true });
    } catch {
      throw new BadRequestException('Fichier illisible : format Excel (.xlsx/.xls) attendu');
    }
  }

  /** Onglet PLANNING → lignes brutes. */
  extractPlanningSheet(workbook: XLSX.WorkBook): RawRow[] {
    const name = this.findSheet(workbook, 'PLANNING');
    if (!name) {
      throw new BadRequestException('Onglet « PLANNING » introuvable dans le fichier');
    }
    return XLSX.utils.sheet_to_json<RawRow>(workbook.Sheets[name], { defval: null });
  }

  /** Onglet AFFECT → lignes brutes, ou null si absent (repli prévu par le cahier des charges). */
  extractAffectSheet(workbook: XLSX.WorkBook): RawRow[] | null {
    const name = this.findSheet(workbook, 'AFFECT');
    if (!name) return null;
    return XLSX.utils.sheet_to_json<RawRow>(workbook.Sheets[name], { defval: null });
  }

  /**
   * Ne garde que les lignes du sous-traitant connecté (colonne ST).
   * Sans sonatelSubcontractorName configuré, aucun filtrage (compte tout).
   */
  filterBySubcontractor(rows: RawRow[], subcontractorName: string | null, partnerCodes: string[] = []): RawRow[] {
    // Le sous-traitant peut travailler pour plusieurs partenaires (SOFATELCOM + 3STB) :
    // on garde les lignes dont le ST correspond à l'un d'eux (ou du nom historique configuré).
    const accepted = new Set(
      [...partnerCodes, subcontractorName ?? '']
        .map((c) => c.trim().toUpperCase())
        .filter(Boolean),
    );
    if (accepted.size === 0) return rows;
    return rows.filter((row) => {
      const st = this.stringValue(row['ST']) ?? this.stringValue(row['st']);
      // Exports CRM (TRAITEES) sans colonne ST : conservés.
      if (st === null) return true;
      return accepted.has(st.trim().toUpperCase());
    });
  }

  /**
   * Alias normalisés par champ : en-têtes réels des fichiers SONATEL
   * (« NomduClient », « Tâches », « Dated'intervention »…) reconnus même si
   * le mapping configuré pointe d'anciens libellés.
   */
  private static readonly HEADER_ALIASES: Record<string, string[]> = {
    dossierNumber: ['demande', 'numerodossier', 'dossier'],
    client: ['nomduclient', 'client', 'nomclient', 'nomduclientcontact'],
    task: ['taches', 'tache', 'typedetache', 'tachesplanifiees'],
    zone: ['zone', 'adresse'],
    dateMission: ['datedintervention', 'date', 'dateintervention', 'datedinterventionprevue'],
    olt: ['olt'],
    produit: ['produit', 'commandeclient'],
    subcontractor: ['st', 'sous_traitant'],
    equipe: ['equipe', 'equipes'],
    segment: ['segment'],
    coper: ['coper'],
    commandeClient: ['commandeclient', 'produit'],
    typeLogement: ['typedelogement'],
    clientAvise: ['clientavise'],
    contactClient: ['contactclient'],
    heure: ['heure'],
    ageDays: ['age'],
    srPlaque: ['sr'],
    gpsEasyWork: ['coordonneesgpssureasywork', 'gps'],
    ciPrcl: ['ciprcl'],
  };

  /** Normalise un en-tête : minuscule, sans accent ni caractères non alphanumériques. */
  private normalizeHeader(h: string): string {
    return h
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  /** Index normalisé des en-têtes réels d'une ligne (une fois par feuille). */
  private buildHeaderIndex(sampleRow: RawRow): Map<string, string> {
    const index = new Map<string, string>();
    for (const key of Object.keys(sampleRow)) {
      index.set(this.normalizeHeader(key), key);
    }
    return index;
  }

  /** Applique la correspondance configurée : lignes brutes → champs VECTRACOM. */
  mapColumns(
    rows: RawRow[],
    mappings: Array<{ sourceColumnName: string; targetField: string }>,
    importSource: 'PLANNING' | 'SURCH' | 'TRAITEES' = 'PLANNING',
  ): MappedRow[] {
    const byTarget = new Map(mappings.map((m) => [m.targetField, m.sourceColumnName]));
    const headerIndex = rows.length > 0 ? this.buildHeaderIndex(rows[0]) : new Map<string, string>();
    const pick = (row: RawRow, target: string): string | null => {
      const col = byTarget.get(target);
      const value = col !== undefined ? this.stringValue(row[col]) : null;
      if (value !== null) return value;
      // Repli : alias normalisé (en-têtes réels SONATEL).
      for (const alias of ExcelImportService.HEADER_ALIASES[target] ?? []) {
        const realKey = headerIndex.get(alias);
        if (realKey !== undefined) {
          const v = this.stringValue(row[realKey]);
          if (v !== null) return v;
        }
      }
      return null;
    };
    const pickNumber = (row: RawRow, target: string): number | null => {
      const raw = pick(row, target);
      if (raw === null) return null;
      const n = Number(raw.replace(',', '.'));
      return isFinite(n) ? Math.round(n) : null;
    };

    return rows.map((row) => {
      const adresse = pick(row, 'zone') ?? '';
      // TRAITEES : l'avis client contient le motif de blocage (parfois avec GPS).
      const clientAvise = pick(row, 'clientAvise');
      const blocage = importSource === 'TRAITEES' && clientAvise ? clientAvise : null;
      const gpsFromMotif = this.extractGps(blocage ?? '') ?? this.extractGps(pick(row, 'gpsEasyWork') ?? '');
      return {
        dossierNumber: pick(row, 'dossierNumber'),
        client: pick(row, 'client'),
        task: pick(row, 'task'),
        zone: this.cleanZone(pick(row, 'zone')),
        dateMission: this.dateValue(row[byTarget.get('dateMission') ?? '']),
        olt: pick(row, 'olt'),
        produit: pick(row, 'produit') ?? pick(row, 'commandeClient'),
        subcontractor: pick(row, 'subcontractor'),
        segment: pick(row, 'segment'),
        coper: pick(row, 'coper'),
        commandeClient: pick(row, 'commandeClient'),
        typeLogement: pick(row, 'typeLogement'),
        clientAvise,
        contactClient: pick(row, 'contactClient'),
        heure: pick(row, 'heure'),
        ageDays: pickNumber(row, 'ageDays'),
        srPlaque: pick(row, 'srPlaque'),
        gpsEasyWork: pick(row, 'gpsEasyWork') ?? gpsFromMotif,
        ciPrcl: pick(row, 'ciPrcl'),
        importSource,
        blocageMotif: blocage,
        blocageCode: classifyBlocage(blocage ?? clientAvise ?? '').motif,
        gpsFromMotif,
        equipe: pick(row, 'equipe'),
      };
    });
  }

  /** Onglet par nom (PLANNING / SURCH / TRAITEES…) → lignes brutes. */
  extractSheet(workbook: XLSX.WorkBook, needle: string): RawRow[] {
    const name = this.findSheet(workbook, needle);
    if (!name) return [];
    return XLSX.utils.sheet_to_json<RawRow>(workbook.Sheets[name], { defval: null });
  }

  /** Extrait des coordonnées GPS d'un texte (ex. « Zone inéligible_14.39,-16.94 »). */
  extractGps(text: string): string | null {
    const m = text.match(/(-?\d{1,2}[.,]\d{3,})\s*[,; ]\s*(-?\d{1,3}[.,]\d{3,})/);
    if (!m) return null;
    return `${m[1].replace(',', '.')}|${m[2].replace(',', '.')}`;
  }

  /** Si la valeur zone est une adresse SONATEL, en extrait la zone ; sinon la garde. */
  private cleanZone(raw: string | null): string | null {
    if (!raw) return null;
    if (raw.includes('!')) return this.zoneFromAddress(raw);
    return raw;
  }

  /**
   * Zone depuis l'adresse SONATEL « ! QUARTIER ! VILLE ! ZONE ! détail » :
   * dernier segment significatif (ex. MBOUR, THIES, PIKINE).
   */
  zoneFromAddress(adresse: string): string | null {
    if (!adresse) return null;
    const parts = adresse
      .split('!')
      .map((p) => p.trim())
      .filter((p) => p.length > 1 && !/^%/.test(p));
    // La zone SONATEL est le dernier segment purement alphabétique
    // (les détails finaux contiennent numéros, GPS ou repères).
    const alpha = parts.filter((p) => /^[A-Za-zÀ-ÿ' -]+$/.test(p) && p.length >= 3);
    return alpha.length > 0 ? alpha[alpha.length - 1].toUpperCase() : null;
  }

  /** Champs SONATEL réels à écrire sur la mission (confirm). */
  private sonatelExtras(row: ImportPreviewRowDto, partnerByCode: Map<string, string>) {
    const partnerId = row.partner ? partnerByCode.get(row.partner.toUpperCase()) ?? null : null;
    return {
      partnerId,
      segment: row.segment ?? null,
      srPlaque: row.srPlaque ?? null,
      coper: row.coper ?? null,
      commandeClient: row.commandeClient ?? null,
      typeLogement: row.typeLogement ?? null,
      clientAvise: row.clientAvise ?? null,
      contactClient: row.contactClient ?? null,
      heure: row.heure ?? null,
      ageDays: row.ageDays ?? null,
      gpsEasyWork: row.gps ?? null,
      blocageMotif: row.blocageMotif ?? null,
      surcharge: !!row.surcharge,
      importSource: row.importSource ?? 'PLANNING',
    };
  }

  /** Missions existantes pour les n° de dossier du lot (clé d'idempotence). */
  async detectDuplicates(
    rows: MappedRow[],
    companyId: string,
  ): Promise<Map<string, Mission>> {
    const numbers = rows
      .map((r) => r.dossierNumber)
      .filter((n): n is string => Boolean(n));
    if (numbers.length === 0) return new Map();

    const missions = await this.missionRepository.find({
      where: { companyId, sonatelDossierNumber: In(numbers) },
    });
    return new Map(missions.map((m) => [m.sonatelDossierNumber!, m]));
  }

  /** Construit les missions à importer à partir de l'aperçu validé. */
  buildMissions(previewRows: ImportPreviewRowDto[]): Array<Partial<Mission>> {
    return previewRows
      .filter((r) => r.action === 'nouvelle' || r.action === 'mise_a_jour')
      .map((r) => ({
        sonatelDossierNumber: r.dossierNumber,
        clientSite: r.client ?? '(client non renseigné)',
        typeTache: r.task ?? '(tâche non renseignée)',
        zone: r.zone ?? null,
        dateMission: r.dateMission ? new Date(r.dateMission) : new Date(),
        sonatelOlt: r.olt ?? null,
        technicianIds: [],
        importMeta: {
          teamLabel: r.team ?? null,
          technicians: r.technicians ?? [],
          heureDebut: r.heureDebut ?? null,
          heureFin: r.heureFin ?? null,
        },
      }));
  }

  // ------------------------------------------------------------------
  // Internes
  // ------------------------------------------------------------------

  private findSheet(workbook: XLSX.WorkBook, needle: string): string | null {
    const exact = workbook.SheetNames.find((n) => n.trim().toUpperCase() === needle);
    if (exact) return exact;
    return workbook.SheetNames.find((n) => n.trim().toUpperCase().includes(needle)) ?? null;
  }

  private stringValue(v: unknown): string | null {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    if (s === '' || /^(n\/a|na|#n\/a|n#a|-)$/i.test(s)) return null;
    return s;
  }

  /** Dates Excel : Date (cellDates), série numérique, ISO ou jj/mm/aaaa. */
  private dateValue(v: unknown): Date | null {
    if (v === null || v === undefined || v === '') return null;
    if (v instanceof Date && !isNaN(v.getTime())) return v;
    if (typeof v === 'number' && isFinite(v)) {
      // Série Excel : jours depuis le 1899-12-30 (gestion du faux 29/02/1900 inclus).
      const ms = Math.round((v - 25569) * 86400 * 1000);
      const d = new Date(ms);
      return isNaN(d.getTime()) ? null : d;
    }
    if (typeof v === 'string') {
      const iso = Date.parse(v);
      if (!isNaN(iso)) return new Date(iso);
      const fr = v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
      if (fr) {
        const d = new Date(Number(fr[3]), Number(fr[2]) - 1, Number(fr[1]));
        return isNaN(d.getTime()) ? null : d;
      }
    }
    return null;
  }

  private buildAffectIndex(
    affectRows: RawRow[] | null,
    mappings: Array<{ sourceColumnName: string; targetField: string }>,
  ): Map<string, AffectInfo> {
    const index = new Map<string, AffectInfo>();
    if (!affectRows) return index;
    const byTarget = new Map(mappings.map((m) => [m.targetField, m.sourceColumnName]));

    for (const row of affectRows) {
      const dossier = this.stringValue(row[byTarget.get('dossierNumber') ?? '']);
      if (!dossier) continue;
      const team = this.stringValue(row[byTarget.get('team') ?? '']);
      const techRaw = this.stringValue(row[byTarget.get('technicians') ?? '']);
      const technicians = techRaw
        ? techRaw.split(/[,;/]/).map((t) => t.trim()).filter(Boolean)
        : [];
      const heureDebut = this.stringValue(row[byTarget.get('heureDebut') ?? '']) || null;
      const heureFin = this.stringValue(row[byTarget.get('heureFin') ?? '']) || null;
      index.set(dossier, { team, technicians, heureDebut, heureFin });
    }
    return index;
  }

  private classifyRow(
    row: MappedRow,
    affect: AffectInfo,
    existing: Map<string, Mission>,
  ): ImportPreviewRowDto {
    if (!row.dossierNumber) {
      return { ...this.toPreviewFields(row, affect), action: 'invalide', reason: 'N° de dossier (colonne Demande) manquant' };
    }
    if (!row.client && !row.task) {
      return { ...this.toPreviewFields(row, affect), action: 'invalide', reason: 'Ni client ni tâche renseignés' };
    }
    const mission = existing.get(row.dossierNumber);
    if (mission && TERMINAL_MISSION_STATUSES.includes(mission.status)) {
      return {
        ...this.toPreviewFields(row, affect),
        action: 'ignorée',
        reason: `Mission déjà ${mission.status} — jamais écrasée`,
      };
    }
    return {
      ...this.toPreviewFields(row, affect),
      action: mission ? 'mise_a_jour' : 'nouvelle',
    };
  }

  private toPreviewFields(row: MappedRow, affect: AffectInfo) {
    return {
      dossierNumber: row.dossierNumber ?? '',
      client: row.client,
      task: row.task,
      zone: row.zone,
      dateMission: row.dateMission ? row.dateMission.toISOString() : null,
      olt: row.olt,
      team: affect.team,
      technicians: affect.technicians,
      heureDebut: affect.heureDebut,
      heureFin: affect.heureFin,
      srPlaque: row.srPlaque,
      segment: row.segment,
      ageDays: row.ageDays,
      gps: row.gpsEasyWork ?? row.gpsFromMotif,
      blocageMotif: row.blocageMotif,
      partner: row.subcontractor,
      surcharge: row.importSource === 'SURCH',
      importSource: row.importSource,
    };
  }

  private computeStats(totalRows: number, filtered: number, rows: ImportPreviewRowDto[]): ImportStats {
    const count = (action: string) => rows.filter((r) => r.action === action).length;
    return {
      totalRows,
      afterSubcontractorFilter: filtered,
      nouvelle: count('nouvelle'),
      mise_a_jour: count('mise_a_jour'),
      ignoree: count('ignorée'),
      invalide: count('invalide'),
    };
  }
}

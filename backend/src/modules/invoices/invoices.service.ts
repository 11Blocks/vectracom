import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as XLSX from 'xlsx';
import { Invoice, InvoiceCorrectionEntry } from './entities/invoice.entity';
import { InvoiceLine, InvoiceCategory } from './entities/invoice-line.entity';
import { InvoicePenalty } from './entities/invoice-penalty.entity';
import { Mission } from '../missions/entities/mission.entity';
import { MissionFieldReport } from '../missions/entities/field-report.entity';
import { PriceItem } from '../stock/entities/price-item.entity';
import { Company } from '../auth/entities/company.entity';
import { PdfGeneratorService } from '../../common/pdf/pdf-generator.service';
import { GenerateInvoiceDto } from './dto/generate-invoice.dto';
import { CorrectInvoiceDto } from './dto/correct-invoice.dto';
import { SettingsService } from '../settings/settings.service';

/** TVA Sénégal — défaut ; surchargeable via Paramètres → Facturation. */
const DEFAULT_TVA_RATE = 0.18;

/** Missions incluses dans la facture : clôturées terrain ou validées. */
const BILLABLE_STATUSES = ['terminee', 'validee'];

/** Catégorie de facture par type de mission. */
const TYPE_CATEGORY: Record<string, InvoiceCategory> = {
  INSTALLATION: 'PRODUCTION',
  DENSIFICATION: 'PRODUCTION',
  DEPLOIEMENT: 'PRODUCTION',
  SURVEY: 'PRODUCTION',
  SAV: 'SAV',
  OSM: 'TS',
  SURVEY_OSM: 'TS',
  GC: 'TS',
  INFRA: 'TS',
  PLANTATION: 'TS',
  DEVOIEMENT: 'TS',
};

/** Libellés de prestation pour les travaux spéciaux (feuille TS de l'attachement). */
const PRESTATION_LABELS: Record<string, string> = {
  OSM: "Installation OSM (ligne LS)",
  SURVEY_OSM: 'Survey OSM',
  GC: 'Travaux génie civil',
  INFRA: 'Réparation INFRA (reflectométrie + raccordement)',
  PLANTATION: 'Plantation poteau',
  DEVOIEMENT: 'Dévoiement câble',
};

/** Item du bordereau 3STB par défaut pour chaque type de mission. */
const TYPE_PRICE_ITEM: Record<string, number> = {
  INSTALLATION: 4,
  DENSIFICATION: 50,
  DEPLOIEMENT: 4,
  SURVEY: 1,
  SAV: 32,
  OSM: 41,
  SURVEY_OSM: 3,
  GC: 10,
  INFRA: 48,
  PLANTATION: 45,
  DEVOIEMENT: 52,
};

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(InvoiceLine)
    private readonly lineRepository: Repository<InvoiceLine>,
    @InjectRepository(InvoicePenalty)
    private readonly penaltyRepository: Repository<InvoicePenalty>,
    @InjectRepository(Mission)
    private readonly missionRepository: Repository<Mission>,
    @InjectRepository(MissionFieldReport)
    private readonly reportRepository: Repository<MissionFieldReport>,
    @InjectRepository(PriceItem)
    private readonly priceItemRepository: Repository<PriceItem>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    private readonly pdf: PdfGeneratorService,
    private readonly settings: SettingsService,
  ) {}

  // ------------------------------------------------------------------
  // 1. Génération : missions clôturées → lignes regroupées + bordereau
  // ------------------------------------------------------------------

  async generate(companyId: string, dto: GenerateInvoiceDto, generatedBy: string | null) {
    const periodStart = dto.periodStart.slice(0, 10);
    const periodEnd = dto.periodEnd.slice(0, 10);
    if (periodEnd < periodStart) {
      throw new BadRequestException('Fin de période avant le début');
    }

    const monthKey = periodStart.slice(0, 7).replace('-', '');
    const existingForPeriod = await this.invoiceRepository.findOne({
      where: { companyId, periodStart, periodEnd },
    });
    if (existingForPeriod) {
      throw new ConflictException(`Une facture existe déjà pour cette période (${existingForPeriod.invoiceNumber})`);
    }
    const seq = (await this.invoiceRepository.count({ where: { companyId } })) + 1;
    const invoiceNumber = `FACT-${monthKey}-${String(seq).padStart(4, '0')}`;

    // Missions clôturées de la période
    const missions = await this.missionRepository
      .createQueryBuilder('m')
      .where('m.company_id = :companyId', { companyId })
      .andWhere('m.date_mission >= :start AND m.date_mission <= :end', {
        start: new Date(periodStart),
        end: `${periodEnd}T23:59:59.999Z`,
      })
      .andWhere('m.status IN (:...statuses)', { statuses: BILLABLE_STATUSES })
      .getMany();

    if (missions.length === 0) {
      throw new BadRequestException('Aucune mission clôturée sur la période — facture vide refusée');
    }

    // Prix : grilles duales par partenaire (P1) — SOFATELCOM prestations / 3STB bordereau.
    const priceItems = await this.priceItemRepository.find({
      where: { companyId, version: '2025', isActive: true },
    });
    const priceByNumber = new Map(
      priceItems.filter((p) => p.priceGrid !== 'GRID_SOFATELCOM').map((p) => [p.itemNumber, p]),
    );
    const sofatelyGrid = new Map(
      priceItems
        .filter((p) => p.priceGrid === 'GRID_SOFATELCOM')
        .map((p) => [p.designation, p] as const),
    );
    const prestaByCode = new Map(
      priceItems
        .filter((p) => p.priceGrid === 'GRID_SOFATELCOM')
        .map((p) => [String(p.category) + ':' + this.sofatelyKey(p.designation), p] as const),
    );
    void sofatelyGrid;

    const invoice = await this.invoiceRepository.save(
      this.invoiceRepository.create({
        companyId,
        invoiceNumber,
        periodStart,
        periodEnd,
        status: 'brouillon',
        generatedBy,
        corrections: [],
      }),
    );

    // a) Regroupement par prestation réelle : partenaire + type + issue SAV + blocage.
    //    Clé = catégorie:prestation (ex. PRODUCTION:Survey, SAV:Relevé dérangement).
    const reports = await this.reportRepository
      .createQueryBuilder('r')
      .innerJoin(Mission, 'm', 'm.id = r.mission_id')
      .where('r.company_id = :companyId AND m.status IN (:...statuses)', {
        companyId,
        statuses: BILLABLE_STATUSES,
      })
      .andWhere('m.date_mission >= :start AND m.date_mission <= :end', {
        start: new Date(periodStart),
        end: `${periodEnd}T23:59:59.999Z`,
      })
      .getMany();
    const reportByMission = new Map(reports.map((r) => [r.missionId, r]));

    const byPrestation = new Map<string, { category: string; itemType: string; unitPrice: number }>();
    for (const mission of missions) {
      const report = reportByMission.get(mission.id);
      const isSofately = !!mission.partnerId; // grille prestations si partenaire SOFATELCOM
      void isSofately;
      const prestation = this.resolvePrestation(mission, report);
      const priceItem = prestaByCode.get(`${prestation.category}:${prestation.key}`) ??
        priceByNumber.get(TYPE_PRICE_ITEM[mission.typeTache] ?? -1) ?? null;
      const unitPrice = priceItem ? Number(priceItem.unitPrice) : 0;
      const entry = byPrestation.get(`${prestation.category}:${prestation.key}`) ?? {
        category: prestation.category,
        itemType: prestation.label,
        unitPrice,
      };
      byPrestation.set(`${prestation.category}:${prestation.key}`, entry);
    }
    const counts = new Map<string, number>();
    for (const mission of missions) {
      const report = reportByMission.get(mission.id);
      const prestation = this.resolvePrestation(mission, report);
      const key = `${prestation.category}:${prestation.key}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    for (const [key, quantity] of counts) {
      const entry = byPrestation.get(key)!;
      await this.lineRepository.insert({
        companyId,
        invoiceId: invoice.id,
        category: entry.category,
        itemType: entry.itemType,
        quantity,
        unitPrice: String(entry.unitPrice),
        total: String(entry.unitPrice * quantity),
      } as never);
    }

    // b) Items du bordereau consommés via fiches de chantier (Phase 7)
    const consumedReports = await this.reportRepository
      .createQueryBuilder('r')
      .innerJoin(Mission, 'm', 'm.id = r.mission_id')
      .where('r.company_id = :companyId AND m.status IN (:...statuses)', {
        companyId,
        statuses: BILLABLE_STATUSES,
      })
      .andWhere('m.date_mission >= :start AND m.date_mission <= :end', {
        start: new Date(periodStart),
        end: `${periodEnd}T23:59:59.999Z`,
      })
      .getMany();

    const byItem = new Map<number, { quantity: number; unitPrice: number; designation: string }>();
    for (const report of consumedReports) {
      for (const used of report.priceItemsUsed ?? []) {
        const priceItem = priceByNumber.get(used.itemNumber);
        const entry = byItem.get(used.itemNumber) ?? {
          quantity: 0,
          unitPrice: used.unitPrice ?? (priceItem ? Number(priceItem.unitPrice) : 0),
          designation: priceItem?.designation ?? `Item ${used.itemNumber}`,
        };
        entry.quantity += used.quantity;
        byItem.set(used.itemNumber, entry);
      }
    }
    for (const [itemNumber, entry] of byItem) {
      await this.lineRepository.insert({
        companyId,
        invoiceId: invoice.id,
        category: 'TS',
        itemType: `Item ${itemNumber} — ${entry.designation}`,
        quantity: entry.quantity,
        unitPrice: String(entry.unitPrice),
        total: String(entry.unitPrice * entry.quantity),
      } as never);
    }

    await this.recomputeTotals(companyId, invoice.id);
    this.logger.log(`Facture ${invoiceNumber} générée : ${missions.length} mission(s), ${byPrestation.size + byItem.size} ligne(s)`);

    return this.findOne(companyId, invoice.id);
  }

  // ------------------------------------------------------------------
  // 2. Lecture / prévisualisation
  // ------------------------------------------------------------------

  async list(companyId: string, filters: { status?: string; periodStart?: string }) {
    const qb = this.invoiceRepository
      .createQueryBuilder('i')
      .where('i.company_id = :companyId', { companyId })
      .orderBy('i.periodStart', 'DESC');
    if (filters.status) qb.andWhere('i.status = :status', { status: filters.status });
    if (filters.periodStart) qb.andWhere('i.period_start >= :period', { period: filters.periodStart });
    return qb.getMany();
  }

  async findOne(companyId: string, id: string) {
    const invoice = await this.invoiceRepository.findOne({ where: { companyId, id } });
    if (!invoice) throw new NotFoundException('Facture introuvable');
    return invoice;
  }

  /** Aperçu complet : entête + lignes + pénalités + totaux. */
  async preview(companyId: string, id: string) {
    const invoice = await this.findOne(companyId, id);
    const [lines, penalties, company] = await Promise.all([
      this.lineRepository.find({ where: { companyId, invoiceId: id }, order: { category: 'ASC', itemType: 'ASC' } }),
      this.penaltyRepository.find({ where: { companyId, invoiceId: id } }),
      this.companyRepository.findOne({ where: { id: companyId } }),
    ]);
    return {
      invoice,
      company: company ? { name: company.name, sonatelSubcontractorName: company.sonatelSubcontractorName } : null,
      client: 'SONATEL SA',
      lines,
      penalties,
      totals: {
        totalHt: Number(invoice.totalHt),
        totalTva: Number(invoice.totalTva),
        penaltiesTotal: Number(invoice.penaltiesTotal),
        totalTtc: Number(invoice.totalTtc),
      },
    };
  }

  // ------------------------------------------------------------------
  // 3. Correction tracée
  // ------------------------------------------------------------------

  async correct(companyId: string, id: string, dto: CorrectInvoiceDto, correctedBy: string | null) {
    const invoice = await this.findOne(companyId, id);
    if (invoice.status === 'finalisee' || invoice.status === 'envoyee') {
      throw new BadRequestException(`Facture ${invoice.status} — correction impossible`);
    }

    const historyEntry: InvoiceCorrectionEntry = { at: new Date().toISOString(), by: correctedBy, changes: [] };

    for (const correction of dto.lines) {
      const line = await this.resolveLine(companyId, id, correction.lineId, correction.itemType);
      if (correction.quantity === undefined && correction.unitPrice === undefined) {
        throw new BadRequestException(
          `Correction sans valeur pour « ${line.itemType} » : quantity ou unitPrice requis`,
        );
      }

      if (!line.isCorrected) {
        line.isCorrected = true;
        line.originalQuantity = line.quantity;
        line.originalUnitPrice = line.unitPrice;
      }
      if (correction.quantity !== undefined && correction.quantity !== line.quantity) {
        historyEntry.changes.push({
          lineId: line.id,
          itemType: line.itemType,
          field: 'quantity',
          from: line.quantity,
          to: correction.quantity,
          reason: correction.correctionReason,
        });
        line.quantity = correction.quantity;
      }
      if (correction.unitPrice !== undefined && String(correction.unitPrice) !== line.unitPrice) {
        historyEntry.changes.push({
          lineId: line.id,
          itemType: line.itemType,
          field: 'unitPrice',
          from: Number(line.unitPrice),
          to: correction.unitPrice,
          reason: correction.correctionReason,
        });
        line.unitPrice = String(correction.unitPrice);
      }
      line.total = String(line.quantity * Number(line.unitPrice));
      line.correctionReason = correction.correctionReason;
      await this.lineRepository.save(line);
    }

    if (historyEntry.changes.length > 0) {
      invoice.corrections = [...(invoice.corrections ?? []), historyEntry];
      invoice.status = invoice.status === 'brouillon' ? 'en_correction' : invoice.status;
      await this.invoiceRepository.save(invoice);
    }
    await this.recomputeTotals(companyId, id);
    return this.preview(companyId, id);
  }

  // ------------------------------------------------------------------
  // 4. Finalisation
  // ------------------------------------------------------------------

  async finalize(companyId: string, id: string, notes: string | undefined, validatedBy: string) {
    const invoice = await this.findOne(companyId, id);
    if (invoice.status === 'finalisee' || invoice.status === 'envoyee') {
      throw new BadRequestException('Facture déjà finalisée');
    }
    invoice.status = 'finalisee';
    invoice.notes = notes ?? invoice.notes;
    invoice.validatedBy = validatedBy;
    invoice.validatedAt = new Date();
    await this.invoiceRepository.save(invoice);
    return this.findOne(companyId, id);
  }

  async remove(companyId: string, id: string) {
    const invoice = await this.findOne(companyId, id);
    if (invoice.status !== 'brouillon') {
      throw new BadRequestException('Seule une facture en brouillon peut être supprimée');
    }
    await this.invoiceRepository.remove(invoice);
    return { deleted: true };
  }

  // ------------------------------------------------------------------
  // 5. Exports
  // ------------------------------------------------------------------

  /** PDF de présentation (direction / SONATEL). */
  async exportPdf(companyId: string, id: string): Promise<{ buffer: Buffer; fileName: string }> {
    const detail = await this.preview(companyId, id);
    const i = detail.invoice;
    const lines: Array<{ text: string; size?: number; bold?: boolean; spaceBefore?: number }> = [
      { text: (detail.company?.name ?? 'VECTRACOM').toUpperCase(), size: 16, bold: true },
      { text: 'Facture mensuelle de prestations', size: 13, bold: true, spaceBefore: 4 },
      { text: `Facture : ${i.invoiceNumber}    Statut : ${i.status}`, spaceBefore: 8 },
      { text: `Periode : ${i.periodStart} au ${i.periodEnd}` },
      { text: `Client : SONATEL SA    Fournisseur : ${detail.company?.sonatelSubcontractorName ?? detail.company?.name ?? '-'}` },
      { text: 'Detail des prestations', size: 12, bold: true, spaceBefore: 12 },
      { text: 'Categorie      Item                                          Qte   PU         Total', bold: true },
      ...detail.lines.map(
        (l) =>
          `${l.category.padEnd(14)} ${l.itemType.slice(0, 44).padEnd(45)} ${String(l.quantity).padStart(4)} ${Number(l.unitPrice).toLocaleString('fr-FR').padStart(10)} ${Number(l.total).toLocaleString('fr-FR').padStart(12)}`,
      ).map((text) => ({ text, size: 9 })),
      { text: 'Penalites KPI', size: 12, bold: true, spaceBefore: 10 },
      ...(detail.penalties.length > 0
        ? detail.penalties.map((p) => ({ text: `${p.kpiName}: cible ${Number(p.target)} / reel ${Number(p.actual)} → -${Number(p.penaltyAmount).toLocaleString('fr-FR')} FCFA`, size: 9 }))
        : [{ text: 'Aucune penalite appliquee', size: 9 }]),
      { text: `Total HT : ${Number(i.totalHt).toLocaleString('fr-FR')} FCFA`, bold: true, spaceBefore: 12 },
      { text: `TVA (18%) : ${Number(i.totalTva).toLocaleString('fr-FR')} FCFA` },
      { text: `Penalites : -${Number(i.penaltiesTotal).toLocaleString('fr-FR')} FCFA` },
      { text: `Total TTC : ${Number(i.totalTtc).toLocaleString('fr-FR')} FCFA`, bold: true },
      ...(i.notes ? [{ text: `Notes : ${i.notes}`, size: 9, spaceBefore: 8 }] : []),
    ];
    const buffer = this.pdf.generate(lines);
    await this.invoiceRepository.update({ companyId, id }, { pdfUrl: `/api/v1/invoices/${id}/export-pdf` });
    return { buffer, fileName: `${i.invoiceNumber}.pdf` };
  }

  /** Excel de détail (analyse interne). */
  async exportExcel(companyId: string, id: string): Promise<{ buffer: Buffer; fileName: string }> {
    const detail = await this.preview(companyId, id);
    const rows: Array<Record<string, string | number>> = detail.lines.map((l) => ({
      Categorie: l.category,
      Item: l.itemType,
      Quantite: l.quantity,
      'Prix unitaire (FCFA)': Number(l.unitPrice),
      'Total (FCFA)': Number(l.total),
      Corrigee: l.isCorrected ? 'oui' : 'non',
      'Qte initiale': l.originalQuantity ?? '',
      'PU initial': l.originalUnitPrice ? Number(l.originalUnitPrice) : '',
      'Motif correction': l.correctionReason ?? '',
    }));
    rows.push(
      { Categorie: '', Item: 'TOTAL HT', Quantite: '', 'Prix unitaire (FCFA)': '', 'Total (FCFA)': Number(detail.invoice.totalHt), Corrigee: '', 'Qte initiale': '', 'PU initial': '', 'Motif correction': '' },
      { Categorie: '', Item: 'TVA 18%', Quantite: '', 'Prix unitaire (FCFA)': '', 'Total (FCFA)': Number(detail.invoice.totalTva), Corrigee: '', 'Qte initiale': '', 'PU initial': '', 'Motif correction': '' },
      { Categorie: '', Item: 'Penalites', Quantite: '', 'Prix unitaire (FCFA)': '', 'Total (FCFA)': -Number(detail.invoice.penaltiesTotal), Corrigee: '', 'Qte initiale': '', 'PU initial': '', 'Motif correction': '' },
      { Categorie: '', Item: 'TOTAL TTC', Quantite: '', 'Prix unitaire (FCFA)': '', 'Total (FCFA)': Number(detail.invoice.totalTtc), Corrigee: '', 'Qte initiale': '', 'PU initial': '', 'Motif correction': '' },
    );
    const sheet = XLSX.utils.json_to_sheet(rows);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Facture');
    const buffer = XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    await this.invoiceRepository.update({ companyId, id }, { excelUrl: `/api/v1/invoices/${id}/export-excel` });
    return { buffer, fileName: `${detail.invoice.invoiceNumber}.xlsx` };
  }

  // ------------------------------------------------------------------
  // Internes
  // ------------------------------------------------------------------

  private async resolveLine(companyId: string, invoiceId: string, lineId?: string, itemType?: string) {
    const where: Record<string, unknown> = { companyId, invoiceId };
    if (lineId) where.id = lineId;
    else if (itemType) where.itemType = itemType;
    else throw new BadRequestException('Correction sans cible (lineId ou itemType requis)');
    const line = await this.lineRepository.findOne({ where });
    if (!line) throw new NotFoundException('Ligne de facture introuvable');
    return line;
  }

  /** Recalcule HT/TVA/pénalités/TTC depuis les lignes et pénalités réelles (public : utilisé par les KPI). */
  /** Clé normalisée d'une désignation de grille SOFATELCOM. */
  private sofatelyKey(designation: string): string {
    return designation
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\(.*?\)/g, '')
      .replace(/[^a-z0-9+ ]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 40);
  }

  /**
   * P4 — Prestation réelle d'une mission selon le workflow SONATEL :
   * Survey+Installation réussie → prestation complète ; blocage GPS remonté →
   * « Déplacement avec remontée de blocage » ; SAV → issue (Relevé/REOR/Déplacement) ;
   * sinon prestation standard du type.
   */
  private resolvePrestation(mission: Mission, report: MissionFieldReport | undefined): {
    category: InvoiceCategory;
    key: string;
    label: string;
  } {
    const type = mission.typeTache;

    // SAV : l'issue terrain (étape 6) détermine la ligne de facture.
    if (type === 'SAV') {
      if (report?.savOutcome === 'REOR') return { category: 'SAV', key: 'diagnostic derangement sans releve + re', label: 'Diagnostic de dérangement (sans relève) + REOR' };
      if (report?.savOutcome === 'DEPLACEMENT') return { category: 'SAV', key: 'deplacement sav', label: 'Déplacement SAV' };
      return { category: 'SAV', key: 'releve derangement', label: 'Relevé dérangement' };
    }

    // Production : blocage remonté avec GPS → déplacement facturé (1 950 F).
    if (mission.blocageMotif && ['INSTALLATION', 'DENSIFICATION', 'DEPLOIEMENT'].includes(type)) {
      if (report?.fieldStatus === 'echec') {
        return { category: 'PRODUCTION', key: 'deplacement avec remontee de blocage production', label: 'Déplacement avec remontée de blocage (Production)' };
      }
    }

    // Survey+Installation : la tâche SONATEL « Survey + Installation ».
    if (['INSTALLATION', 'DENSIFICATION', 'DEPLOIEMENT'].includes(type)) {
      return { category: 'PRODUCTION', key: 'survey + installation', label: 'Survey + Installation' };
    }
    if (type === 'SURVEY') return { category: 'PRODUCTION', key: 'survey', label: 'Survey' };

    // Travaux spéciaux : bordereau 3STB via TYPE_PRICE_ITEM.
    const label = PRESTATION_LABELS[type] ?? type;
    return { category: TYPE_CATEGORY[type] ?? 'TS', key: `bordereau:${TYPE_PRICE_ITEM[type] ?? 0}`, label };
  }

  async recomputeTotals(companyId: string, invoiceId: string) {
    const [lines, penalties] = await Promise.all([
      this.lineRepository.find({ where: { companyId, invoiceId } }),
      this.penaltyRepository.find({ where: { companyId, invoiceId } }),
    ]);
    const totalHt = lines.reduce((sum, l) => sum + Number(l.total), 0);
    const penaltiesTotal = penalties.reduce((sum, p) => sum + Number(p.penaltyAmount), 0);
    const tvaRate = await this.settings.getTvaRate(companyId).catch(() => DEFAULT_TVA_RATE);
    const totalTva = Math.round(totalHt * tvaRate * 100) / 100;
    const totalTtc = Math.round((totalHt + totalTva - penaltiesTotal) * 100) / 100;
    await this.invoiceRepository.update(
      { companyId, id: invoiceId },
      {
        totalHt: String(totalHt),
        totalTva: String(totalTva),
        penaltiesTotal: String(penaltiesTotal),
        totalTtc: String(totalTtc),
      },
    );
  }
}

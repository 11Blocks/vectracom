import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, IsNull, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import * as XLSX from 'xlsx';
import {
  EDITABLE_INVOICE_STATUSES,
  Invoice,
  InvoiceClientSnapshot,
  InvoiceCorrectionEntry,
  InvoiceStatus,
} from './entities/invoice.entity';
import { InvoiceLine, InvoiceCategory } from './entities/invoice-line.entity';
import { InvoicePenalty } from './entities/invoice-penalty.entity';
import { InvoicePayment, PaymentMethod } from './entities/invoice-payment.entity';
import { Client } from './entities/client.entity';
import { Mission } from '../missions/entities/mission.entity';
import { MissionFieldReport } from '../missions/entities/field-report.entity';
import { PriceItem } from '../stock/entities/price-item.entity';
import { Company } from '../auth/entities/company.entity';
import { PdfGeneratorService } from '../../common/pdf/pdf-generator.service';
import { AuditService } from '../../common/audit/audit.service';
import { GenerateInvoiceDto } from './dto/generate-invoice.dto';
import { CorrectInvoiceDto } from './dto/correct-invoice.dto';
import {
  AddPaymentDto,
  CreateManualInvoiceDto,
  InvoiceLineInputDto,
  UpdateInvoiceHeaderDto,
} from './dto/invoice-lifecycle.dto';
import { SettingsService } from '../settings/settings.service';
import { pageParams } from '../../common/pagination';

/** Statuts émis (numérotés) dont on peut enregistrer l'encaissement. */
const PAYABLE_STATUSES: InvoiceStatus[] = ['finalisee', 'envoyee', 'partiellement_payee'];

/** Tolérance d'arrondi FCFA pour solder une facture. */
const PAYMENT_TOLERANCE = 1;

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

const DEFAULT_CLIENT_NAME = 'SONATEL SA';

const round0 = (n: number) => Math.round(n);
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (isoDate: string, days: number) => {
  const d = new Date(isoDate + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
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
    @InjectRepository(InvoicePayment)
    private readonly paymentRepository: Repository<InvoicePayment>,
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
    @InjectRepository(Mission)
    private readonly missionRepository: Repository<Mission>,
    @InjectRepository(MissionFieldReport)
    private readonly reportRepository: Repository<MissionFieldReport>,
    @InjectRepository(PriceItem)
    private readonly priceItemRepository: Repository<PriceItem>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    private readonly dataSource: DataSource,
    private readonly pdf: PdfGeneratorService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
  ) {}

  // ------------------------------------------------------------------
  // 1. Génération : missions validées non facturées → lignes regroupées
  // ------------------------------------------------------------------

  async generate(
    companyId: string,
    dto: GenerateInvoiceDto,
    generatedBy: string | null,
    options: { skipIfPeriodExists?: boolean } = {},
  ) {
    const periodStart = dto.periodStart.slice(0, 10);
    const periodEnd = dto.periodEnd.slice(0, 10);
    if (periodEnd < periodStart) {
      throw new BadRequestException('Fin de période avant le début');
    }

    const samePeriod = await this.invoiceRepository.find({
      where: { companyId, kind: 'periodique', periodStart, periodEnd },
    });
    const liveSamePeriod = samePeriod.filter((i) => i.status !== 'annulee');
    if (options.skipIfPeriodExists && liveSamePeriod.length > 0) {
      throw new ConflictException(`Une facture existe déjà pour cette période (${liveSamePeriod[0].invoiceNumber})`);
    }
    const openDraft = liveSamePeriod.find((i) => EDITABLE_INVOICE_STATUSES.includes(i.status));
    if (openDraft) {
      throw new ConflictException(
        `Le brouillon ${openDraft.invoiceNumber} couvre déjà cette période — complétez-le ou supprimez-le`,
      );
    }

    const billing = await this.settings.getBilling(companyId);
    const statuses = billing.billTerminatedMissions ? ['terminee', 'validee'] : ['validee'];

    const missions = await this.missionRepository
      .createQueryBuilder('m')
      .where('m.company_id = :companyId', { companyId })
      .andWhere('m.date_mission >= :start AND m.date_mission <= :end', {
        start: new Date(periodStart),
        end: `${periodEnd}T23:59:59.999Z`,
      })
      .andWhere('m.status IN (:...statuses)', { statuses })
      .andWhere('m.invoice_id IS NULL')
      .getMany();

    if (missions.length === 0) {
      throw new BadRequestException(
        billing.billTerminatedMissions
          ? 'Aucune mission terminée ou validée non encore facturée sur la période'
          : 'Aucune mission validée non encore facturée sur la période (validez les missions terminées, ou activez « facturer les missions terminées » dans Paramètres → Facturation)',
      );
    }

    const client = dto.clientId ? await this.getClient(companyId, dto.clientId) : await this.ensureDefaultClient(companyId);

    // Prix : dernière version active de chaque item (grilles 3STB et SOFATELCOM).
    const priceItems = (await this.priceItemRepository.find({ where: { companyId, isActive: true } }))
      .sort((a, b) => String(b.version).localeCompare(String(a.version)));
    const priceByNumber = new Map<number, PriceItem>();
    const prestaByCode = new Map<string, PriceItem>();
    for (const p of priceItems) {
      if (p.priceGrid === 'GRID_SOFATELCOM') {
        const key = String(p.category) + ':' + this.sofatelyKey(p.designation);
        if (!prestaByCode.has(key)) prestaByCode.set(key, p);
      } else if (!priceByNumber.has(p.itemNumber)) {
        priceByNumber.set(p.itemNumber, p);
      }
    }

    const missionIds = missions.map((m) => m.id);
    const reports = await this.reportRepository.find({ where: { companyId, missionId: In(missionIds) } });
    const reportByMission = new Map(reports.map((r) => [r.missionId, r]));

    // a) Regroupement par prestation réelle (catégorie:prestation).
    const byPrestation = new Map<string, { category: InvoiceCategory; itemType: string; unitPrice: number; quantity: number }>();
    for (const mission of missions) {
      const prestation = this.resolvePrestation(mission, reportByMission.get(mission.id));
      const key = `${prestation.category}:${prestation.key}`;
      const entry = byPrestation.get(key);
      if (entry) {
        entry.quantity += 1;
        continue;
      }
      const priceItem = prestaByCode.get(key) ?? priceByNumber.get(TYPE_PRICE_ITEM[mission.typeTache] ?? -1) ?? null;
      byPrestation.set(key, {
        category: prestation.category,
        itemType: prestation.label,
        unitPrice: priceItem ? Number(priceItem.unitPrice) : 0,
        quantity: 1,
      });
    }

    // b) Items du bordereau consommés via les fiches de chantier.
    const byItem = new Map<number, { quantity: number; unitPrice: number; designation: string; unit: string | null }>();
    for (const report of reports) {
      for (const used of report.priceItemsUsed ?? []) {
        const priceItem = priceByNumber.get(used.itemNumber);
        const entry = byItem.get(used.itemNumber) ?? {
          quantity: 0,
          unitPrice: used.unitPrice ?? (priceItem ? Number(priceItem.unitPrice) : 0),
          designation: priceItem?.designation ?? `Item ${used.itemNumber}`,
          unit: priceItem?.unit ?? null,
        };
        entry.quantity += Number(used.quantity) || 0;
        byItem.set(used.itemNumber, entry);
      }
    }

    const invoiceId = await this.dataSource.transaction(async (em) => {
      const invoice = await em.save(
        em.create(Invoice, {
          companyId,
          invoiceNumber: this.provisionalNumber(),
          kind: 'periodique',
          clientId: client?.id ?? null,
          periodStart,
          periodEnd,
          status: 'brouillon',
          generatedBy,
          corrections: [],
          tvaRate: String(billing.tvaRate),
          missionCount: missions.length,
        }),
      );
      let position = 0;
      const lines: Partial<InvoiceLine>[] = [];
      for (const entry of byPrestation.values()) {
        lines.push({
          companyId,
          invoiceId: invoice.id,
          category: entry.category,
          itemType: entry.itemType,
          quantity: entry.quantity,
          unitPrice: String(entry.unitPrice),
          total: String(round0(entry.unitPrice * entry.quantity)),
          position: position++,
        });
      }
      for (const [itemNumber, entry] of byItem) {
        if (entry.quantity <= 0) continue;
        lines.push({
          companyId,
          invoiceId: invoice.id,
          category: 'TS',
          itemType: `Item ${itemNumber} — ${entry.designation}`,
          quantity: entry.quantity,
          unit: entry.unit,
          unitPrice: String(entry.unitPrice),
          total: String(round0(entry.unitPrice * entry.quantity)),
          position: position++,
        });
      }
      if (lines.length) await em.insert(InvoiceLine, lines as never);
      await em.update(Mission, { companyId, id: In(missionIds), invoiceId: IsNull() }, { invoiceId: invoice.id });
      await this.recomputeTotals(companyId, invoice.id, em);
      return invoice.id;
    });

    this.logger.log(`Facture périodique générée : ${missions.length} mission(s), ${byPrestation.size + byItem.size} ligne(s)`);
    await this.audit.log({
      companyId,
      actorId: generatedBy,
      action: 'invoice.generate',
      entityType: 'invoice',
      entityId: invoiceId,
      payload: { periodStart, periodEnd, missions: missions.length },
    });
    return this.findOne(companyId, invoiceId);
  }

  /** Facture manuelle : lignes libres, client au choix, hors missions. */
  async createManual(companyId: string, dto: CreateManualInvoiceDto, userId: string | null) {
    const billing = await this.settings.getBilling(companyId);
    const client = dto.clientId ? await this.getClient(companyId, dto.clientId) : null;
    const issueDate = dto.issueDate?.slice(0, 10) ?? null;
    const periodStart = dto.periodStart?.slice(0, 10) ?? issueDate ?? today();
    const periodEnd = dto.periodEnd?.slice(0, 10) ?? periodStart;
    if (periodEnd < periodStart) throw new BadRequestException('Fin de période avant le début');

    const invoiceId = await this.dataSource.transaction(async (em) => {
      const invoice = await em.save(
        em.create(Invoice, {
          companyId,
          invoiceNumber: this.provisionalNumber(),
          kind: 'manuelle',
          clientId: client?.id ?? null,
          title: dto.title?.trim() || null,
          issueDate,
          dueDate: dto.dueDate?.slice(0, 10) ?? null,
          periodStart,
          periodEnd,
          status: 'brouillon',
          generatedBy: userId,
          corrections: [],
          notes: dto.notes ?? null,
          discountAmount: String(round0(dto.discountAmount ?? 0)),
          tvaRate: String(billing.tvaRate),
        }),
      );
      await em.insert(
        InvoiceLine,
        dto.lines.map((l, index) => this.buildLine(companyId, invoice.id, l, index)) as never,
      );
      await this.recomputeTotals(companyId, invoice.id, em);
      return invoice.id;
    });
    await this.audit.log({
      companyId,
      actorId: userId,
      action: 'invoice.create_manual',
      entityType: 'invoice',
      entityId: invoiceId,
      payload: { lines: dto.lines.length, clientId: client?.id ?? null },
    });
    return this.findOne(companyId, invoiceId);
  }

  // ------------------------------------------------------------------
  // 2. Lecture / prévisualisation
  // ------------------------------------------------------------------

  async list(
    companyId: string,
    filters: {
      status?: string; periodStart?: string; kind?: string; clientId?: string;
      search?: string; overdue?: string; limit?: number; offset?: number;
    },
  ): Promise<[Array<Invoice & { clientName: string | null; remaining: number; overdue: boolean }>, number]> {
    const qb = this.invoiceRepository
      .createQueryBuilder('i')
      .leftJoin(Client, 'c', 'c.id = i.client_id')
      .addSelect(['c.name'])
      .where('i.company_id = :companyId', { companyId })
      .orderBy('i.period_start', 'DESC')
      .addOrderBy('i.created_at', 'DESC');
    if (filters.status) qb.andWhere('i.status = :status', { status: filters.status });
    if (filters.kind) qb.andWhere('i.kind = :kind', { kind: filters.kind });
    if (filters.clientId) qb.andWhere('i.client_id = :clientId', { clientId: filters.clientId });
    if (filters.periodStart) qb.andWhere('i.period_start >= :period', { period: filters.periodStart });
    if (filters.overdue === 'true') {
      qb.andWhere('i.due_date < :today AND i.status IN (:...payable)', { today: today(), payable: PAYABLE_STATUSES });
    }
    if (filters.search?.trim()) {
      qb.andWhere("(i.invoice_number ILIKE :q OR c.name ILIKE :q OR i.client_snapshot->>'name' ILIKE :q)", {
        q: `%${filters.search.trim()}%`,
      });
    }
    const total = await qb.clone().getCount();
    const { take, skip } = pageParams(filters, 500, 2000);
    // Jointure 1-1 (client) : limit/offset SQL directs, sans sous-requête DISTINCT.
    qb.limit(take).offset(skip);
    const { entities, raw } = await qb.getRawAndEntities();
    const clientNames = new Map<string, string | null>(raw.map((r: Record<string, unknown>) => [r.i_id as string, (r.c_name as string) ?? null]));
    const now = today();
    const items = entities.map((i) => ({
      ...i,
      clientName: i.clientSnapshot?.name ?? clientNames.get(i.id) ?? (i.kind === 'periodique' ? DEFAULT_CLIENT_NAME : null),
      remaining: this.remaining(i),
      overdue: !!i.dueDate && i.dueDate < now && PAYABLE_STATUSES.includes(i.status),
    }));
    return [items, total];
  }

  /** Synthèse financière et compteurs par statut (toutes factures, indépendamment de la page affichée). */
  async summary(companyId: string, clientId?: string) {
    const where: Record<string, unknown> = { companyId };
    if (clientId) where.clientId = clientId;
    const all = await this.invoiceRepository.find({
      where,
      select: ['id', 'kind', 'status', 'totalTtc', 'amountPaid', 'dueDate'],
    });
    const now = today();
    const issued = all.filter((i) => !['brouillon', 'en_correction', 'annulee'].includes(i.status) && i.kind !== 'avoir');
    const byStatus: Record<string, number> = {};
    for (const i of all) byStatus[i.status] = (byStatus[i.status] ?? 0) + 1;
    return {
      total: all.length,
      byStatus,
      issuedTtc: issued.reduce((s, i) => s + Number(i.totalTtc ?? 0), 0),
      paid: issued.reduce((s, i) => s + Number(i.amountPaid ?? 0), 0),
      remaining: issued.reduce((s, i) => s + this.remaining(i), 0),
      overdue: all.filter((i) => !!i.dueDate && i.dueDate < now && PAYABLE_STATUSES.includes(i.status)).length,
      drafts: all.filter((i) => EDITABLE_INVOICE_STATUSES.includes(i.status)).length,
    };
  }

  async findOne(companyId: string, id: string) {
    const invoice = await this.invoiceRepository.findOne({ where: { companyId, id } });
    if (!invoice) throw new NotFoundException('Facture introuvable');
    return invoice;
  }

  /** Aperçu complet : émetteur, client, lignes, pénalités, paiements, totaux. */
  async preview(companyId: string, id: string) {
    const invoice = await this.findOne(companyId, id);
    const [lines, penalties, payments, company, client, billing, credit] = await Promise.all([
      this.lineRepository.find({ where: { companyId, invoiceId: id }, order: { position: 'ASC', category: 'ASC', itemType: 'ASC' } }),
      this.penaltyRepository.find({ where: { companyId, invoiceId: id } }),
      this.paymentRepository.find({ where: { companyId, invoiceId: id }, order: { paidAt: 'ASC', createdAt: 'ASC' } }),
      this.companyRepository.findOne({ where: { id: companyId } }),
      invoice.clientId ? this.clientRepository.findOne({ where: { companyId, id: invoice.clientId } }) : Promise.resolve(null),
      this.settings.getBilling(companyId),
      this.invoiceRepository.findOne({ where: { companyId, creditedInvoiceId: id } }),
    ]);
    const tvaRate = invoice.tvaRate !== null ? Number(invoice.tvaRate) : billing.tvaRate;
    return {
      invoice,
      company: company
        ? {
            name: company.name,
            sonatelSubcontractorName: company.sonatelSubcontractorName,
            address: company.address,
            city: company.city,
            ninea: company.ninea,
            rccm: company.rccm,
            phone: company.contactPhone,
            email: company.contactEmail,
            bankName: company.bankName,
            bankAccount: company.bankAccount,
            logoUrl: company.logoUrl,
            invoiceFooter: company.invoiceFooter,
          }
        : null,
      client: invoice.clientSnapshot ?? (client ? this.snapshot(client) : invoice.kind === 'periodique' ? { name: DEFAULT_CLIENT_NAME } : null),
      clientId: invoice.clientId,
      lines,
      penalties,
      payments,
      creditNote: credit ? { id: credit.id, invoiceNumber: credit.invoiceNumber } : null,
      editable: EDITABLE_INVOICE_STATUSES.includes(invoice.status),
      overdue: !!invoice.dueDate && invoice.dueDate < today() && PAYABLE_STATUSES.includes(invoice.status),
      totals: {
        linesTotal: lines.reduce((s, l) => s + Number(l.total), 0),
        discount: Number(invoice.discountAmount),
        totalHt: Number(invoice.totalHt),
        tvaRate,
        totalTva: Number(invoice.totalTva),
        penaltiesTotal: Number(invoice.penaltiesTotal),
        totalTtc: Number(invoice.totalTtc),
        amountPaid: Number(invoice.amountPaid),
        remaining: this.remaining(invoice),
      },
    };
  }

  // ------------------------------------------------------------------
  // 3. Édition du brouillon : lignes, entête, remise
  // ------------------------------------------------------------------

  async correct(companyId: string, id: string, dto: CorrectInvoiceDto, correctedBy: string | null) {
    const invoice = await this.findOne(companyId, id);
    this.assertEditable(invoice);

    const historyEntry: InvoiceCorrectionEntry = { at: new Date().toISOString(), by: correctedBy, changes: [] };

    for (const correction of dto.lines) {
      const line = await this.resolveLine(companyId, id, correction.lineId, correction.itemType);
      if (
        correction.quantity === undefined &&
        correction.unitPrice === undefined &&
        correction.label === undefined &&
        correction.category === undefined
      ) {
        throw new BadRequestException(`Correction sans valeur pour « ${line.itemType} »`);
      }

      if (!line.isCorrected) {
        line.isCorrected = true;
        line.originalQuantity = line.quantity;
        line.originalUnitPrice = line.unitPrice;
      }
      if (correction.quantity !== undefined && correction.quantity !== Number(line.quantity)) {
        historyEntry.changes.push({
          lineId: line.id, itemType: line.itemType, field: 'quantity',
          from: Number(line.quantity), to: correction.quantity, reason: correction.correctionReason,
        });
        line.quantity = correction.quantity;
      }
      if (correction.unitPrice !== undefined && correction.unitPrice !== Number(line.unitPrice)) {
        historyEntry.changes.push({
          lineId: line.id, itemType: line.itemType, field: 'unitPrice',
          from: Number(line.unitPrice), to: correction.unitPrice, reason: correction.correctionReason,
        });
        line.unitPrice = String(correction.unitPrice);
      }
      if (correction.label !== undefined && correction.label.trim() !== line.itemType) {
        historyEntry.changes.push({
          lineId: line.id, itemType: line.itemType, field: 'header',
          from: line.itemType, to: correction.label.trim(), reason: correction.correctionReason,
        });
        line.itemType = correction.label.trim();
      }
      if (correction.category !== undefined) line.category = correction.category as InvoiceCategory;
      line.total = String(round0(Number(line.quantity) * Number(line.unitPrice)));
      line.correctionReason = correction.correctionReason;
      await this.lineRepository.save(line);
    }

    if (historyEntry.changes.length > 0) {
      invoice.corrections = [...(invoice.corrections ?? []), historyEntry];
      invoice.status = 'en_correction';
      await this.invoiceRepository.save(invoice);
    }
    await this.recomputeTotals(companyId, id);
    await this.audit.log({
      companyId, actorId: correctedBy, action: 'invoice.correct', entityType: 'invoice', entityId: id,
      payload: { changes: historyEntry.changes.length },
    });
    return this.preview(companyId, id);
  }

  async updateHeader(companyId: string, id: string, dto: UpdateInvoiceHeaderDto, userId: string | null) {
    const invoice = await this.findOne(companyId, id);
    this.assertEditable(invoice);
    const changes: InvoiceCorrectionEntry['changes'] = [];
    const track = (field: string, from: unknown, to: unknown) => {
      if (String(from ?? '') !== String(to ?? '')) {
        changes.push({ lineId: 'header', itemType: field, field: 'header', from: (from ?? null) as never, to: (to ?? null) as never });
      }
    };

    if (dto.clientId !== undefined) {
      if (dto.clientId) await this.getClient(companyId, dto.clientId);
      track('client', invoice.clientId, dto.clientId);
      invoice.clientId = dto.clientId;
    }
    if (dto.title !== undefined) { track('objet', invoice.title, dto.title); invoice.title = dto.title?.trim() || null; }
    if (dto.issueDate !== undefined) { const v = dto.issueDate?.slice(0, 10) ?? null; track('date', invoice.issueDate, v); invoice.issueDate = v; }
    if (dto.dueDate !== undefined) { const v = dto.dueDate?.slice(0, 10) ?? null; track('échéance', invoice.dueDate, v); invoice.dueDate = v; }
    if (dto.periodStart !== undefined) { track('début période', invoice.periodStart, dto.periodStart.slice(0, 10)); invoice.periodStart = dto.periodStart.slice(0, 10); }
    if (dto.periodEnd !== undefined) { track('fin période', invoice.periodEnd, dto.periodEnd.slice(0, 10)); invoice.periodEnd = dto.periodEnd.slice(0, 10); }
    if (invoice.periodEnd < invoice.periodStart) throw new BadRequestException('Fin de période avant le début');
    if (dto.discountAmount !== undefined) {
      track('remise', Number(invoice.discountAmount), round0(dto.discountAmount));
      invoice.discountAmount = String(round0(dto.discountAmount));
    }
    if (dto.tvaRate !== undefined) {
      track('taux TVA', invoice.tvaRate === null ? null : Number(invoice.tvaRate), dto.tvaRate);
      invoice.tvaRate = dto.tvaRate === null ? null : String(dto.tvaRate);
    }
    if (dto.notes !== undefined) invoice.notes = dto.notes;

    if (changes.length) {
      invoice.corrections = [...(invoice.corrections ?? []), { at: new Date().toISOString(), by: userId, changes }];
    }
    await this.invoiceRepository.save(invoice);
    await this.recomputeTotals(companyId, id);
    if (changes.length) {
      await this.audit.log({
        companyId, actorId: userId, action: 'invoice.update_header', entityType: 'invoice', entityId: id,
        payload: { fields: changes.map((c) => c.itemType) },
      });
    }
    return this.preview(companyId, id);
  }

  // ------------------------------------------------------------------
  // 4. Cycle de vie : finalisation, envoi, paiements, avoir
  // ------------------------------------------------------------------

  async finalize(companyId: string, id: string, notes: string | undefined, validatedBy: string) {
    const invoice = await this.findOne(companyId, id);
    if (!EDITABLE_INVOICE_STATUSES.includes(invoice.status)) {
      throw new BadRequestException(`Facture ${invoice.status} — déjà finalisée`);
    }
    const lineCount = await this.lineRepository.count({ where: { companyId, invoiceId: id } });
    if (lineCount === 0) throw new BadRequestException('Facture sans ligne — finalisation impossible');
    await this.recomputeTotals(companyId, id);
    const fresh = await this.findOne(companyId, id);
    if (Number(fresh.totalTtc) <= 0) {
      throw new BadRequestException('Total TTC nul ou négatif — vérifiez les lignes, la remise et les pénalités');
    }

    const billing = await this.settings.getBilling(companyId);
    const client = fresh.clientId
      ? await this.clientRepository.findOne({ where: { companyId, id: fresh.clientId } })
      : fresh.kind === 'periodique' ? await this.ensureDefaultClient(companyId) : null;

    await this.dataSource.transaction(async (em) => {
      const issueDate = fresh.issueDate ?? today();
      fresh.invoiceNumber = await this.nextNumber(em, companyId, billing.invoiceNumberFormat, issueDate);
      fresh.issueDate = issueDate;
      fresh.dueDate = fresh.dueDate ?? addDays(issueDate, client?.paymentTermsDays ?? billing.paymentTermsDays);
      fresh.clientId = client?.id ?? fresh.clientId;
      fresh.clientSnapshot = client ? this.snapshot(client) : fresh.clientSnapshot;
      fresh.status = 'finalisee';
      fresh.notes = notes ?? fresh.notes;
      fresh.validatedBy = validatedBy;
      fresh.validatedAt = new Date();
      await em.save(fresh);
    });
    await this.audit.log({
      companyId, actorId: validatedBy, action: 'invoice.finalize', entityType: 'invoice', entityId: id,
      payload: { invoiceNumber: fresh.invoiceNumber, totalTtc: Number(fresh.totalTtc) },
    });
    return this.findOne(companyId, id);
  }

  async markSent(companyId: string, id: string, userId: string | null) {
    const invoice = await this.findOne(companyId, id);
    if (invoice.status !== 'finalisee') {
      throw new BadRequestException(`Seule une facture finalisée peut être marquée envoyée (statut : ${invoice.status})`);
    }
    invoice.status = 'envoyee';
    invoice.sentAt = new Date();
    await this.invoiceRepository.save(invoice);
    await this.audit.log({ companyId, actorId: userId, action: 'invoice.send', entityType: 'invoice', entityId: id, payload: { invoiceNumber: invoice.invoiceNumber } });
    return this.findOne(companyId, id);
  }

  async addPayment(companyId: string, id: string, dto: AddPaymentDto, userId: string | null) {
    const invoice = await this.findOne(companyId, id);
    if (!PAYABLE_STATUSES.includes(invoice.status)) {
      throw new BadRequestException(`Encaissement impossible sur une facture ${invoice.status}`);
    }
    const remaining = this.remaining(invoice);
    const amount = Math.round(dto.amount * 100) / 100;
    if (amount > remaining + PAYMENT_TOLERANCE) {
      throw new BadRequestException(`Montant supérieur au reste à encaisser (${remaining.toLocaleString('fr-FR')} FCFA)`);
    }
    const payment = await this.paymentRepository.save(
      this.paymentRepository.create({
        companyId,
        invoiceId: id,
        amount: String(amount),
        paidAt: dto.paidAt.slice(0, 10),
        method: (dto.method ?? 'virement') as PaymentMethod,
        reference: dto.reference?.trim() || null,
        note: dto.note ?? null,
        recordedBy: userId,
      }),
    );
    await this.refreshPaymentStatus(companyId, id);
    await this.audit.log({
      companyId, actorId: userId, action: 'invoice.payment_add', entityType: 'invoice', entityId: id,
      payload: { paymentId: payment.id, amount, method: payment.method },
    });
    return this.preview(companyId, id);
  }

  async removePayment(companyId: string, id: string, paymentId: string, userId: string | null) {
    const invoice = await this.findOne(companyId, id);
    if (invoice.status === 'annulee') throw new BadRequestException('Facture annulée');
    const payment = await this.paymentRepository.findOne({ where: { companyId, invoiceId: id, id: paymentId } });
    if (!payment) throw new NotFoundException('Encaissement introuvable');
    await this.paymentRepository.remove(payment);
    await this.refreshPaymentStatus(companyId, id);
    await this.audit.log({
      companyId, actorId: userId, action: 'invoice.payment_remove', entityType: 'invoice', entityId: id,
      payload: { amount: Number(payment.amount), paidAt: payment.paidAt },
    });
    return this.preview(companyId, id);
  }

  /**
   * Annulation d'une facture émise par avoir total : l'avoir reprend les lignes en
   * négatif, la facture passe « annulée » et ses missions redeviennent facturables.
   */
  async cancelWithCreditNote(companyId: string, id: string, reason: string, userId: string | null) {
    const invoice = await this.findOne(companyId, id);
    if (invoice.kind === 'avoir') throw new BadRequestException('Un avoir ne peut pas être annulé');
    if (EDITABLE_INVOICE_STATUSES.includes(invoice.status)) {
      throw new BadRequestException('Brouillon non émis : supprimez-le au lieu de l’annuler');
    }
    if (invoice.status === 'annulee') throw new BadRequestException('Facture déjà annulée');
    if (Number(invoice.amountPaid) > 0) {
      throw new BadRequestException('Des encaissements existent : supprimez-les (ou remboursez) avant d’émettre l’avoir');
    }
    const lines = await this.lineRepository.find({ where: { companyId, invoiceId: id }, order: { position: 'ASC' } });

    const creditId = await this.dataSource.transaction(async (em) => {
      const issueDate = today();
      const credit = await em.save(
        em.create(Invoice, {
          companyId,
          invoiceNumber: await this.nextNumber(em, companyId, 'AV-{YYYY}-{####}', issueDate),
          kind: 'avoir',
          clientId: invoice.clientId,
          clientSnapshot: invoice.clientSnapshot,
          title: `Avoir sur facture ${invoice.invoiceNumber}`,
          issueDate,
          periodStart: invoice.periodStart,
          periodEnd: invoice.periodEnd,
          status: 'finalisee',
          generatedBy: userId,
          validatedBy: userId,
          validatedAt: new Date(),
          corrections: [],
          notes: reason,
          creditedInvoiceId: invoice.id,
          tvaRate: invoice.tvaRate,
          discountAmount: String(-Number(invoice.discountAmount)),
          totalHt: String(-Number(invoice.totalHt)),
          totalTva: String(-Number(invoice.totalTva)),
          penaltiesTotal: String(-Number(invoice.penaltiesTotal)),
          totalTtc: String(-Number(invoice.totalTtc)),
        }),
      );
      if (lines.length) {
        await em.insert(
          InvoiceLine,
          lines.map((l, index) => ({
            companyId,
            invoiceId: credit.id,
            category: l.category,
            itemType: l.itemType,
            unit: l.unit,
            quantity: -Number(l.quantity),
            unitPrice: l.unitPrice,
            total: String(-Number(l.total)),
            position: index,
          })) as never,
        );
      }
      invoice.status = 'annulee';
      invoice.cancelledAt = new Date();
      invoice.cancelReason = reason;
      invoice.corrections = [
        ...(invoice.corrections ?? []),
        { at: new Date().toISOString(), by: userId, changes: [{ lineId: 'status', itemType: 'statut', field: 'status', from: 'emise', to: 'annulee', reason }] },
      ];
      await em.save(invoice);
      await em.update(Mission, { companyId, invoiceId: invoice.id }, { invoiceId: null });
      return credit.id;
    });
    await this.audit.log({
      companyId, actorId: userId, action: 'invoice.cancel_credit_note', entityType: 'invoice', entityId: id,
      payload: { reason, creditNoteId: creditId },
    });
    return this.preview(companyId, creditId);
  }

  async remove(companyId: string, id: string, userId: string | null = null) {
    const invoice = await this.findOne(companyId, id);
    if (!EDITABLE_INVOICE_STATUSES.includes(invoice.status)) {
      throw new BadRequestException('Seul un brouillon peut être supprimé — une facture émise s’annule par avoir');
    }
    await this.dataSource.transaction(async (em) => {
      await em.update(Mission, { companyId, invoiceId: invoice.id }, { invoiceId: null });
      await em.remove(invoice);
    });
    await this.audit.log({
      companyId, actorId: userId, action: 'invoice.delete_draft', entityType: 'invoice', entityId: id,
      payload: { invoiceNumber: invoice.invoiceNumber, totalTtc: Number(invoice.totalTtc) },
    });
    return { deleted: true };
  }

  /** Missions valorisées par la facture (traçabilité). */
  async missions(companyId: string, id: string) {
    await this.findOne(companyId, id);
    return this.missionRepository.find({
      where: { companyId, invoiceId: id },
      select: ['id', 'clientSite', 'typeTache', 'dateMission', 'status', 'sonatelDossierNumber', 'zone'],
      order: { dateMission: 'ASC' },
    });
  }

  // ------------------------------------------------------------------
  // 5. Clients
  // ------------------------------------------------------------------

  listClients(companyId: string) {
    return this.clientRepository.find({ where: { companyId }, order: { active: 'DESC', name: 'ASC' } });
  }

  async createClient(companyId: string, dto: Partial<Client>, userId: string | null) {
    const name = String(dto.name ?? '').trim();
    await this.assertClientNameFree(companyId, name);
    const client = await this.clientRepository.save(
      this.clientRepository.create({ ...this.cleanClient(dto), name, companyId, active: true }),
    );
    await this.audit.log({ companyId, actorId: userId, action: 'client.create', entityType: 'client', entityId: client.id, payload: { name } });
    return client;
  }

  async updateClient(companyId: string, id: string, dto: Partial<Client>, userId: string | null) {
    const client = await this.getClient(companyId, id);
    if (dto.name !== undefined && dto.name.trim().toLowerCase() !== client.name.toLowerCase()) {
      await this.assertClientNameFree(companyId, dto.name.trim(), id);
      client.name = dto.name.trim();
    }
    Object.assign(client, this.cleanClient(dto));
    if (dto.active !== undefined) client.active = dto.active;
    const saved = await this.clientRepository.save(client);
    await this.audit.log({ companyId, actorId: userId, action: 'client.update', entityType: 'client', entityId: id, payload: { fields: Object.keys(dto) } });
    return saved;
  }

  // ------------------------------------------------------------------
  // 6. Exports
  // ------------------------------------------------------------------

  async exportPdf(companyId: string, id: string): Promise<{ buffer: Buffer; fileName: string }> {
    const d = await this.preview(companyId, id);
    const i = d.invoice;
    const fcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} F`;
    const title = i.kind === 'avoir' ? 'AVOIR' : EDITABLE_INVOICE_STATUSES.includes(i.status) ? 'FACTURE (BROUILLON)' : 'FACTURE';
    const co = d.company;
    const cl = d.client as InvoiceClientSnapshot | null;
    const text: Array<{ text: string; size?: number; bold?: boolean; mono?: boolean; spaceBefore?: number }> = [
      { text: (co?.name ?? 'VECTRACOM').toUpperCase(), size: 16, bold: true },
      ...[
        [co?.address, co?.city].filter(Boolean).join(', '),
        [co?.ninea ? `NINEA ${co.ninea}` : '', co?.rccm ? `RCCM ${co.rccm}` : ''].filter(Boolean).join('   '),
        [co?.phone, co?.email].filter(Boolean).join('   '),
      ].filter(Boolean).map((t) => ({ text: t, size: 9 })),
      { text: `${title} N° ${i.invoiceNumber}`, size: 14, bold: true, spaceBefore: 12 },
      { text: `Date : ${i.issueDate ?? '-'}    Échéance : ${i.dueDate ?? '-'}    Période : ${i.periodStart} au ${i.periodEnd}` },
      ...(i.title ? [{ text: `Objet : ${i.title}` }] : []),
      { text: 'Client', size: 11, bold: true, spaceBefore: 10 },
      { text: cl?.name ?? '-' },
      ...[
        [cl?.address, cl?.city].filter(Boolean).join(', '),
        [cl?.ninea ? `NINEA ${cl.ninea}` : '', cl?.rccm ? `RCCM ${cl.rccm}` : ''].filter(Boolean).join('   '),
      ].filter(Boolean).map((t) => ({ text: t, size: 9 })),
      { text: 'Désignation                               Qté       PU (F)      Total (F)', mono: true, bold: true, size: 9, spaceBefore: 12 },
      ...d.lines.map((l) => ({
        text: `${l.itemType.slice(0, 40).padEnd(40)} ${String(Number(l.quantity)).padStart(6)} ${Math.round(Number(l.unitPrice)).toLocaleString('fr-FR').padStart(12)} ${Math.round(Number(l.total)).toLocaleString('fr-FR').padStart(14)}`,
        mono: true,
        size: 9,
      })),
      ...(d.totals.discount ? [{ text: `Remise : -${fcfa(d.totals.discount)}`, spaceBefore: 8 }] : []),
      { text: `Total HT : ${fcfa(d.totals.totalHt)}`, bold: true, spaceBefore: 10 },
      { text: `TVA (${Math.round(d.totals.tvaRate * 10000) / 100} %) : ${fcfa(d.totals.totalTva)}` },
      ...(d.penalties.length
        ? [
            { text: `Pénalités KPI : -${fcfa(d.totals.penaltiesTotal)}` },
            ...d.penalties.map((p) => ({ text: `   ${p.kpiName} : cible ${Number(p.target)} / réel ${Number(p.actual)}`, size: 8 })),
          ]
        : []),
      { text: `Net à payer : ${fcfa(d.totals.totalTtc)}`, bold: true, size: 12 },
      ...(d.payments.length
        ? [
            { text: `Déjà encaissé : ${fcfa(d.totals.amountPaid)}    Reste dû : ${fcfa(d.totals.remaining)}`, spaceBefore: 6 },
          ]
        : []),
      ...(i.notes ? [{ text: `Notes : ${i.notes}`, size: 9, spaceBefore: 8 }] : []),
      ...(co?.bankAccount ? [{ text: `Règlement par virement : ${co.bankName ?? ''} ${co.bankAccount}`, size: 9, spaceBefore: 10 }] : []),
      ...(co?.invoiceFooter ? [{ text: co.invoiceFooter, size: 8, spaceBefore: 6 }] : []),
    ];
    const buffer = this.pdf.generate(text);
    await this.invoiceRepository.update({ companyId, id }, { pdfUrl: `/api/v1/invoices/${id}/export-pdf` });
    return { buffer, fileName: `${i.invoiceNumber}.pdf` };
  }

  /** Excel de détail (analyse interne). */
  async exportExcel(companyId: string, id: string): Promise<{ buffer: Buffer; fileName: string }> {
    const detail = await this.preview(companyId, id);
    const empty = { Categorie: '', Quantite: '', 'Prix unitaire (FCFA)': '', Corrigee: '', 'Qte initiale': '', 'PU initial': '', 'Motif correction': '' };
    const rows: Array<Record<string, string | number>> = detail.lines.map((l) => ({
      Categorie: l.category,
      Item: l.itemType,
      Quantite: Number(l.quantity),
      'Prix unitaire (FCFA)': Number(l.unitPrice),
      'Total (FCFA)': Number(l.total),
      Corrigee: l.isCorrected ? 'oui' : 'non',
      'Qte initiale': l.originalQuantity ?? '',
      'PU initial': l.originalUnitPrice ? Number(l.originalUnitPrice) : '',
      'Motif correction': l.correctionReason ?? '',
    }));
    rows.push(
      { ...empty, Item: 'REMISE', 'Total (FCFA)': -detail.totals.discount },
      { ...empty, Item: 'TOTAL HT', 'Total (FCFA)': detail.totals.totalHt },
      { ...empty, Item: `TVA ${Math.round(detail.totals.tvaRate * 10000) / 100}%`, 'Total (FCFA)': detail.totals.totalTva },
      { ...empty, Item: 'Penalites', 'Total (FCFA)': -detail.totals.penaltiesTotal },
      { ...empty, Item: 'NET A PAYER', 'Total (FCFA)': detail.totals.totalTtc },
      { ...empty, Item: 'ENCAISSE', 'Total (FCFA)': detail.totals.amountPaid },
      { ...empty, Item: 'RESTE DU', 'Total (FCFA)': detail.totals.remaining },
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

  assertEditable(invoice: Invoice) {
    if (!EDITABLE_INVOICE_STATUSES.includes(invoice.status)) {
      throw new BadRequestException(`Facture ${invoice.status} — modification impossible (émettez un avoir si nécessaire)`);
    }
  }

  buildLine(companyId: string, invoiceId: string, l: InvoiceLineInputDto, position: number): Partial<InvoiceLine> {
    return {
      companyId,
      invoiceId,
      category: (l.category ?? 'AUTRE') as InvoiceCategory,
      itemType: l.itemType.trim(),
      unit: l.unit?.trim() || null,
      quantity: l.quantity,
      unitPrice: String(l.unitPrice),
      total: String(round0(l.quantity * l.unitPrice)),
      position,
    };
  }

  private remaining(invoice: Invoice): number {
    if (invoice.kind === 'avoir' || invoice.status === 'annulee' || EDITABLE_INVOICE_STATUSES.includes(invoice.status)) return 0;
    return Math.max(0, Math.round((Number(invoice.totalTtc) - Number(invoice.amountPaid)) * 100) / 100);
  }

  private async refreshPaymentStatus(companyId: string, id: string) {
    const invoice = await this.findOne(companyId, id);
    const payments = await this.paymentRepository.find({ where: { companyId, invoiceId: id } });
    const paid = Math.round(payments.reduce((s, p) => s + Number(p.amount), 0) * 100) / 100;
    invoice.amountPaid = String(paid);
    const ttc = Number(invoice.totalTtc);
    if (paid <= 0) {
      invoice.status = invoice.sentAt ? 'envoyee' : 'finalisee';
      invoice.paidAt = null;
    } else if (paid + PAYMENT_TOLERANCE >= ttc) {
      invoice.status = 'payee';
      const last = payments.map((p) => p.paidAt).sort().pop();
      invoice.paidAt = last ? new Date(last + 'T12:00:00Z') : new Date();
    } else {
      invoice.status = 'partiellement_payee';
      invoice.paidAt = null;
    }
    await this.invoiceRepository.save(invoice);
  }

  private provisionalNumber(): string {
    return `BROUILLON-${randomUUID().slice(0, 8).toUpperCase()}`;
  }

  /**
   * Numéro définitif continu par tenant, calculé sous verrou transactionnel.
   * Format : {YYYY} {YY} {MM} et un bloc {###…} pour le compteur.
   */
  private async nextNumber(em: EntityManager, companyId: string, format: string, issueDate: string): Promise<string> {
    await em.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`invoice-number:${companyId}`]);
    const rendered = format
      .replace(/\{YYYY\}/g, issueDate.slice(0, 4))
      .replace(/\{YY\}/g, issueDate.slice(2, 4))
      .replace(/\{MM\}/g, issueDate.slice(5, 7));
    const match = rendered.match(/\{(#+)\}/);
    if (!match || match.index === undefined) throw new BadRequestException(`Format de numéro invalide : ${format}`);
    const prefix = rendered.slice(0, match.index);
    const suffix = rendered.slice(match.index + match[0].length);
    const width = match[1].length;
    const rows: Array<{ invoice_number: string }> = await em.query(
      `SELECT invoice_number FROM invoices WHERE company_id = $1 AND invoice_number LIKE $2`,
      [companyId, `${prefix.replace(/[%_\\]/g, '\\$&')}%${suffix.replace(/[%_\\]/g, '\\$&')}`],
    );
    let max = 0;
    for (const r of rows) {
      const middle = r.invoice_number.slice(prefix.length, r.invoice_number.length - suffix.length);
      if (/^\d+$/.test(middle)) max = Math.max(max, Number(middle));
    }
    return `${prefix}${String(max + 1).padStart(width, '0')}${suffix}`;
  }

  private snapshot(client: Client): InvoiceClientSnapshot {
    return {
      name: client.name,
      ninea: client.ninea,
      rccm: client.rccm,
      address: client.address,
      city: client.city,
      email: client.email,
      phone: client.phone,
    };
  }

  private async getClient(companyId: string, id: string): Promise<Client> {
    const client = await this.clientRepository.findOne({ where: { companyId, id } });
    if (!client) throw new NotFoundException('Client introuvable');
    return client;
  }

  /** Client SONATEL par défaut des factures périodiques (créé au premier besoin). */
  private async ensureDefaultClient(companyId: string): Promise<Client> {
    const existing = await this.clientRepository
      .createQueryBuilder('c')
      .where('c.company_id = :companyId', { companyId })
      .andWhere("(upper(c.code) = 'SONATEL' OR c.name ILIKE 'sonatel%')")
      .orderBy('c.active', 'DESC')
      .getOne();
    if (existing) return existing;
    return this.clientRepository.save(
      this.clientRepository.create({ companyId, name: DEFAULT_CLIENT_NAME, code: 'SONATEL', city: 'Dakar', active: true }),
    );
  }

  private async assertClientNameFree(companyId: string, name: string, exceptId?: string) {
    if (name.length < 2) throw new BadRequestException('Nom du client requis');
    const qb = this.clientRepository
      .createQueryBuilder('c')
      .where('c.company_id = :companyId AND lower(c.name) = lower(:name)', { companyId, name });
    if (exceptId) qb.andWhere('c.id != :exceptId', { exceptId });
    if ((await qb.getCount()) > 0) throw new ConflictException(`Le client « ${name} » existe déjà`);
  }

  private cleanClient(dto: Partial<Client>): Partial<Client> {
    const out: Partial<Client> = {};
    for (const key of ['code', 'ninea', 'rccm', 'address', 'city', 'contactName', 'email', 'phone', 'notes'] as const) {
      if (dto[key] !== undefined) out[key] = (typeof dto[key] === 'string' ? (dto[key] as string).trim() || null : dto[key]) as never;
    }
    if (dto.paymentTermsDays !== undefined) out.paymentTermsDays = dto.paymentTermsDays;
    return out;
  }

  private async resolveLine(companyId: string, invoiceId: string, lineId?: string, itemType?: string) {
    const where: Record<string, unknown> = { companyId, invoiceId };
    if (lineId) where.id = lineId;
    else if (itemType) where.itemType = itemType;
    else throw new BadRequestException('Correction sans cible (lineId ou itemType requis)');
    const line = await this.lineRepository.findOne({ where });
    if (!line) throw new NotFoundException('Ligne de facture introuvable');
    return line;
  }

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
   * Prestation réelle d'une mission selon le workflow SONATEL :
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

    if (type === 'SAV') {
      if (report?.savOutcome === 'REOR') return { category: 'SAV', key: 'diagnostic derangement sans releve + re', label: 'Diagnostic de dérangement (sans relève) + REOR' };
      if (report?.savOutcome === 'DEPLACEMENT') return { category: 'SAV', key: 'deplacement sav', label: 'Déplacement SAV' };
      return { category: 'SAV', key: 'releve derangement', label: 'Relevé dérangement' };
    }

    if (mission.blocageMotif && ['INSTALLATION', 'DENSIFICATION', 'DEPLOIEMENT'].includes(type)) {
      if (report?.fieldStatus === 'echec') {
        return { category: 'PRODUCTION', key: 'deplacement avec remontee de blocage production', label: 'Déplacement avec remontée de blocage (Production)' };
      }
    }

    if (['INSTALLATION', 'DENSIFICATION', 'DEPLOIEMENT'].includes(type)) {
      return { category: 'PRODUCTION', key: 'survey + installation', label: 'Survey + Installation' };
    }
    if (type === 'SURVEY') return { category: 'PRODUCTION', key: 'survey', label: 'Survey' };

    const label = PRESTATION_LABELS[type] ?? type;
    return { category: TYPE_CATEGORY[type] ?? 'TS', key: `bordereau:${TYPE_PRICE_ITEM[type] ?? 0}`, label };
  }

  /** Recalcule HT (lignes − remise), TVA, pénalités et net à payer, arrondis au franc. */
  async recomputeTotals(companyId: string, invoiceId: string, em?: EntityManager) {
    const manager = em ?? this.dataSource.manager;
    const invoice = await manager.findOne(Invoice, { where: { companyId, id: invoiceId } });
    if (!invoice || invoice.kind === 'avoir') return;
    const [lines, penalties] = await Promise.all([
      manager.find(InvoiceLine, { where: { companyId, invoiceId } }),
      manager.find(InvoicePenalty, { where: { companyId, invoiceId } }),
    ]);
    const linesTotal = lines.reduce((sum, l) => sum + Number(l.total), 0);
    const totalHt = round0(linesTotal - Number(invoice.discountAmount ?? 0));
    const penaltiesTotal = round0(penalties.reduce((sum, p) => sum + Number(p.penaltyAmount), 0));
    const tvaRate = invoice.tvaRate !== null && invoice.tvaRate !== undefined
      ? Number(invoice.tvaRate)
      : await this.settings.getTvaRate(companyId).catch(() => 0.18);
    const totalTva = round0(totalHt * tvaRate);
    const totalTtc = totalHt + totalTva - penaltiesTotal;
    await manager.update(
      Invoice,
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

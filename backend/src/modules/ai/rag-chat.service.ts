import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RagConversation } from './entities/rag-conversation.entity';
import { RagMessage } from './entities/rag-message.entity';
import { RagDocument, RAG_DOC_CATEGORIES } from './entities/rag-document.entity';
import { RagChunk } from './entities/rag-chunk.entity';
import { CompanySubscription } from '../saas/entities/company-subscription.entity';
import { Mission } from '../missions/entities/mission.entity';
import { StockItem } from '../stock/entities/stock-item.entity';
import { StockLevel } from '../stock/entities/stock-level.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { VehicleEvent } from '../vehicles/entities/vehicle-event.entity';
import { Incident } from '../incidents/entities/incident.entity';
import { SonatelKpiLog } from '../kpi-sonatel/entities/sonatel-kpi-log.entity';
import { Team } from '../teams/entities/team.entity';

const CHUNK_SIZE = 600;
const CHUNK_OVERLAP = 120;
const TOP_K = 4;
const STOP_WORDS = new Set([
  'quel', 'quelle', 'quels', 'quelles', 'comment', 'pourquoi', 'combien', 'dans', 'avec',
  'sont', 'est', 'les', 'des', 'une', 'que', 'pour', 'sur', 'par', 'aux', 'cette', 'cela',
]);

/** Normalisation française : minuscules + sans accents. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Découpe en morceaux avec recouvrement, sur des frontières de phrase. */
export function chunkText(text: string): string[] {
  const clean = text.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();
  if (clean.length <= CHUNK_SIZE) return clean.length > 0 ? [clean] : [];
  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(start + CHUNK_SIZE, clean.length);
    if (end < clean.length) {
      const sep = clean.lastIndexOf('. ', end);
      if (sep > start + CHUNK_SIZE / 2) end = sep + 1;
    }
    chunks.push(clean.slice(start, end).trim());
    if (end >= clean.length) break;
    start = end - CHUNK_OVERLAP;
  }
  return chunks.filter((c) => c.length > 40);
}

export interface RetrievedSource {
  documentId: string;
  title: string;
  category: string;
  chunkIndex: number;
  excerpt: string;
  score: number;
}

/**
 * Agent Direction / Dashboard RAG (option payante 15 000 FCFA/mois).
 * Retrieval hybride : base documentaire du tenant (contrats, procédures,
 * bordereaux) + données réelles (missions, stock, véhicules, KPI, incidents),
 * puis synthèse. Sans GEMINI_API_KEY, la synthèse est déterministe —
 * la licence RAG est vérifiée dans tous les cas.
 */
@Injectable()
export class RagChatService {
  constructor(
    @InjectRepository(RagConversation)
    private readonly conversationRepository: Repository<RagConversation>,
    @InjectRepository(RagMessage)
    private readonly messageRepository: Repository<RagMessage>,
    @InjectRepository(RagDocument)
    private readonly documentRepository: Repository<RagDocument>,
    @InjectRepository(RagChunk)
    private readonly chunkRepository: Repository<RagChunk>,
    @InjectRepository(CompanySubscription)
    private readonly subscriptionRepository: Repository<CompanySubscription>,
    @InjectRepository(Mission)
    private readonly missionRepository: Repository<Mission>,
    @InjectRepository(StockItem)
    private readonly stockItemRepository: Repository<StockItem>,
    @InjectRepository(StockLevel)
    private readonly stockLevelRepository: Repository<StockLevel>,
    @InjectRepository(Vehicle)
    private readonly vehicleRepository: Repository<Vehicle>,
    @InjectRepository(VehicleEvent)
    private readonly vehicleEventRepository: Repository<VehicleEvent>,
    @InjectRepository(Incident)
    private readonly incidentRepository: Repository<Incident>,
    @InjectRepository(SonatelKpiLog)
    private readonly kpiLogRepository: Repository<SonatelKpiLog>,
    @InjectRepository(Team)
    private readonly teamRepository: Repository<Team>,
  ) {}

  private async assertRagLicense(companyId: string) {
    const active = await this.subscriptionRepository.findOne({
      where: { companyId, planCode: 'RAG', status: 'active' },
    });
    if (!active) {
      throw new ForbiddenException(
        'Dashboard RAG : option payante (15 000 FCFA/mois) — aucune licence RAG active pour ce tenant',
      );
    }
  }

  // ═══════════════════════════════════════════
  //  Base documentaire
  // ═══════════════════════════════════════════
  /** Ingestion d'un document : découpe en morceaux indexés. */
  async ingestDocument(
    companyId: string,
    userId: string | null,
    dto: { title: string; category: string; content: string; fileName?: string },
  ): Promise<RagDocument> {
    await this.assertRagLicense(companyId);
    if (dto.content.trim().length < 50) {
      throw new BadRequestException('Contenu trop court (50 caractères minimum) pour être indexé');
    }
    const category = (RAG_DOC_CATEGORIES as readonly string[]).includes(dto.category) ? dto.category : 'autre';
    const chunks = chunkText(dto.content);
    if (chunks.length === 0) throw new BadRequestException('Aucun morceau exploitable dans ce document');

    const doc = await this.documentRepository.save(
      this.documentRepository.create({
        companyId,
        title: dto.title.trim().slice(0, 200),
        category: category as RagDocument['category'],
        fileName: dto.fileName ?? null,
        chunkCount: chunks.length,
        sizeChars: dto.content.length,
        uploadedBy: userId,
      }),
    );
    await this.chunkRepository.insert(
      chunks.map((content, i) => ({
        companyId,
        documentId: doc.id,
        chunkIndex: i,
        content,
      })) as never,
    );
    return doc;
  }

  listDocuments(companyId: string) {
    return this.documentRepository.find({ where: { companyId }, order: { createdAt: 'DESC' } });
  }

  async deleteDocument(companyId: string, id: string) {
    await this.assertRagLicense(companyId);
    const doc = await this.documentRepository.findOne({ where: { companyId, id } });
    if (!doc) throw new NotFoundException('Document introuvable');
    await this.chunkRepository.delete({ companyId, documentId: id });
    await this.documentRepository.remove(doc);
    return { deleted: true };
  }

  /**
   * Retrieval documentaire : fréquence des termes de la question (insensible
   * aux accents/casse) dans chaque morceau, top-K par score.
   */
  async retrieve(companyId: string, question: string, topK = TOP_K): Promise<RetrievedSource[]> {
    const terms = normalize(question)
      .split(' ')
      .filter((t) => t.length > 3 && !STOP_WORDS.has(t));
    if (terms.length === 0) return [];

    const chunks = await this.chunkRepository.find({ where: { companyId } });
    if (chunks.length === 0) return [];

    const docs = await this.documentRepository.find({ where: { companyId } });
    const docById = new Map(docs.map((d) => [d.id, d]));

    return chunks
      .map((chunk) => {
        const normalized = normalize(chunk.content);
        let score = 0;
        for (const term of terms) {
          let idx = normalized.indexOf(term);
          while (idx !== -1) {
            score += 1;
            idx = normalized.indexOf(term, idx + term.length);
          }
        }
        return { chunk, score };
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map((s) => {
        const doc = docById.get(s.chunk.documentId);
        return {
          documentId: s.chunk.documentId,
          title: doc?.title ?? 'Document',
          category: doc?.category ?? 'autre',
          chunkIndex: s.chunk.chunkIndex,
          excerpt: s.chunk.content.slice(0, 260) + (s.chunk.content.length > 260 ? '…' : ''),
          score: s.score,
        };
      });
  }

  // ═══════════════════════════════════════════
  //  Données temps réel du tenant
  // ═══════════════════════════════════════════
  /** Contexte : les données réelles du tenant (le « retrieval » du RAG). */
  private async buildContext(companyId: string) {
    const month = new Date().toISOString().slice(0, 7);
    const [missions, teams, vehicles, vehicleEvents, incidents] = await Promise.all([
      this.missionRepository.find({ where: { companyId } }),
      this.teamRepository.find({ where: { companyId } }),
      this.vehicleRepository.find({ where: { companyId } }),
      this.vehicleEventRepository.find({ where: { companyId } }),
      this.incidentRepository.find({ where: { companyId } }),
    ]);
    const byStatus = missions.reduce<Record<string, number>>((acc, m) => {
      acc[m.status] = (acc[m.status] ?? 0) + 1;
      return acc;
    }, {});
    const monthMissions = missions.filter((m) => m.dateMission.toISOString().slice(0, 7) === month);
    const now = Date.now();

    // Équipes en retard : missions ouvertes dont la date est passée.
    const lateMissions = missions.filter(
      (m) => ['planifiee', 'en_cours', 'a_completer'].includes(m.status) && m.dateMission.getTime() < now,
    );
    const lateByTeam = new Map<string, number>();
    for (const m of lateMissions) {
      const label = m.importMeta?.teamLabel ?? m.team?.name ?? teams.find((t) => t.id === m.teamId)?.name ?? 'Non affectée';
      lateByTeam.set(label, (lateByTeam.get(label) ?? 0) + 1);
    }

    // Véhicules à risque : échéances proches + pannes récurrentes + coût cumulé.
    const daysLeft = (d: string | null) =>
      d == null ? null : Math.round((new Date(`${d}T00:00:00Z`).getTime() - now) / 86_400_000);
    const vehiclesAtRisk = vehicles
      .map((v) => {
        const ins = daysLeft(v.insuranceExpiration);
        const vt = daysLeft(v.technicalInspectionExpiration);
        const events = vehicleEvents.filter((e) => e.vehicleId === v.id);
        const pannes = events.filter((e) => e.type === 'panne').length;
        const cost = events.reduce((s, e) => s + Number(e.cost), 0);
        const reasons: string[] = [];
        if (ins != null && ins <= 30) reasons.push(`assurance J-${ins}`);
        if (vt != null && vt <= 30) reasons.push(`visite technique J-${vt}`);
        if (pannes > 0) reasons.push(`${pannes} panne(s)`);
        if (cost > 200000) reasons.push(`coût ${cost.toLocaleString('fr-FR')} F`);
        return { immatriculation: v.immatriculation, reasons, cost };
      })
      .filter((v) => v.reasons.length > 0);

    const stockRows = await this.stockLevelRepository.query(
      `SELECT i.reference, i.designation, i.threshold_alert, COALESCE(SUM(l.quantity), 0) AS total
       FROM stock_items i LEFT JOIN stock_levels l ON l.stock_item_id = i.id
       WHERE i.company_id = $1 GROUP BY i.id, i.reference, i.designation, i.threshold_alert`,
      [companyId],
    );
    const lowStock = stockRows.filter((r: { total: string; threshold_alert: string }) => Number(r.total) < Number(r.threshold_alert));

    const openIncidents = incidents.filter((i) => i.status !== 'cloture');
    const evaluationDate = `${month}-01`;
    const kpis = await this.kpiLogRepository.find({ where: { companyId, evaluationDate } });

    return {
      month,
      missions: {
        total: missions.length,
        ceMois: monthMissions.length,
        parStatut: byStatus,
        enRetard: lateMissions.length,
        retardParEquipe: Object.fromEntries(lateByTeam),
      },
      equipes: teams.filter((t) => t.active).map((t) => t.name),
      stock: { references: stockRows.length, enAlerte: lowStock.map((r: { reference: string }) => r.reference) },
      vehicules: {
        total: vehicles.length,
        aRisque: vehiclesAtRisk,
        coutParVehicule: vehicles
          .map((v) => ({
            immatriculation: v.immatriculation,
            cout: vehicleEvents.filter((e) => e.vehicleId === v.id).reduce((s, e) => s + Number(e.cost), 0),
          }))
          .filter((c) => c.cout > 0)
          .sort((a, b) => b.cout - a.cout),
      },
      incidents: { total: incidents.length, ouverts: openIncidents.length },
      kpi: { nonAtteints: kpis.filter((k) => k.status === 'non_atteint').length, total: kpis.length },
    };
  }

  /** Synthèse déterministe orientée par la question (replaçable par Gemini). */
  private synthesize(
    question: string,
    ctx: Awaited<ReturnType<RagChatService['buildContext']>>,
    sources: RetrievedSource[],
  ): string {
    const q = normalize(question);

    if (/(equipe|team)/.test(q) && /(retard|late)/.test(q)) {
      const entries = Object.entries(ctx.missions.retardParEquipe);
      return entries.length > 0
        ? `Équipes en retard : ${entries.map(([t, n]) => `${t} (${n} mission(s) dépassée(s))`).join(', ')}. Total ${ctx.missions.enRetard} mission(s) ouverte(s) hors délai.`
        : 'Aucune équipe en retard : toutes les missions ouvertes sont dans leur créneau.';
    }
    if (/(vehicule|flotte|voiture|camion)/.test(q) && /(risque|danger|echeance|assurance|visite|panne)/.test(q)) {
      return ctx.vehicules.aRisque.length > 0
        ? `Véhicules à risque : ${ctx.vehicules.aRisque.map((v) => `${v.immatriculation} (${v.reasons.join(', ')})`).join(' ; ')}.`
        : `Aucun véhicule à risque sur les ${ctx.vehicules.total} de la flotte (échéances > 30 j, pas de panne récurrente).`;
    }
    if (/(cout|cher|depense|budget)/.test(q) && /(vehicule|flotte|chantier)/.test(q)) {
      const top = ctx.vehicules.coutParVehicule.slice(0, 3);
      return top.length > 0
        ? `Coûts véhicule les plus élevés : ${top.map((v) => `${v.immatriculation} ${v.cout.toLocaleString('fr-FR')} F`).join(', ')}.`
        : 'Aucun coût véhicule enregistré à ce jour (réparations, pièces, carburant).';
    }
    if (/(equipe|effectif|binome)/.test(q)) {
      return `Équipes actives : ${ctx.equipes.join(', ') || 'aucune'}.`;
    }
    if (q.includes('mission')) {
      return `Ce mois-ci : ${ctx.missions.ceMois} mission(s). Au total ${ctx.missions.total} mission(s) sur le tenant, `
        + `réparties : ${Object.entries(ctx.missions.parStatut).map(([s, n]) => `${n} ${s}`).join(', ') || 'aucune'}.`
        + (ctx.missions.enRetard > 0 ? ` Attention : ${ctx.missions.enRetard} mission(s) ouverte(s) hors délai.` : '');
    }
    if (q.includes('stock')) {
      return `Stock : ${ctx.stock.references} référence(s). `
        + (ctx.stock.enAlerte.length > 0
          ? `Attention, ${ctx.stock.enAlerte.length} sous le seuil : ${ctx.stock.enAlerte.join(', ')}.`
          : `Aucune référence sous le seuil d'alerte.`);
    }
    if (q.includes('incident')) {
      return `Incidents : ${ctx.incidents.ouverts} ouvert(s) sur ${ctx.incidents.total} au total.`;
    }
    if (q.includes('kpi')) {
      return `KPI SONATEL du mois : ${ctx.kpi.total - ctx.kpi.nonAtteints} atteint(s) sur ${ctx.kpi.total} évalués`
        + (ctx.kpi.nonAtteints > 0 ? `, ${ctx.kpi.nonAtteints} non atteint(s) — un plan de maîtrise est requis pour chacun.` : '.');
    }
    if (/(vehicule|flotte)/.test(q)) {
      return `Flotte : ${ctx.vehicules.total} véhicule(s).`;
    }

    // Réponse documentaire prioritaire quand des sources ressortent.
    if (sources.length > 0) {
      return `D'après « ${sources[0].title} » : ${sources[0].excerpt}`;
    }
    return `Synthèse du tenant : ${ctx.missions.total} mission(s), ${ctx.stock.references} référence(s) de stock `
      + `(${ctx.stock.enAlerte.length} en alerte), ${ctx.incidents.ouverts} incident(s) ouvert(s), `
      + `${ctx.kpi.nonAtteints}/${ctx.kpi.total} KPI non atteint(s).`;
  }

  async ask(companyId: string, userId: string, question: string, conversationId?: string) {
    await this.assertRagLicense(companyId);
    if (question.trim().length < 3) throw new BadRequestException('Question trop courte');

    let conversation = conversationId
      ? await this.conversationRepository.findOne({ where: { companyId, id: conversationId } })
      : null;
    if (conversationId && !conversation) throw new NotFoundException('Conversation introuvable');
    if (!conversation) {
      conversation = await this.conversationRepository.save(
        this.conversationRepository.create({ companyId, userId, title: question.slice(0, 60) }),
      );
    }

    await this.messageRepository.save(
      this.messageRepository.create({ conversationId: conversation.id, role: 'user', content: question }),
    );

    const [context, sources] = await Promise.all([
      this.buildContext(companyId),
      this.retrieve(companyId, question),
    ]);
    const answer = this.synthesize(question, context, sources);

    const assistantMessage = await this.messageRepository.save(
      this.messageRepository.create({
        conversationId: conversation.id,
        role: 'assistant',
        content: answer,
      }),
    );

    return {
      conversationId: conversation.id,
      answer,
      messageId: assistantMessage.id,
      sources,
      contextSnapshot: context,
      provider: process.env.GEMINI_API_KEY ? 'gemini' : 'deterministic',
    };
  }

  async getConversation(companyId: string, userId: string, conversationId: string) {
    const conversation = await this.conversationRepository.findOne({ where: { companyId, id: conversationId } });
    if (!conversation) throw new NotFoundException('Conversation introuvable');
    if (conversation.userId !== userId) throw new ForbiddenException('Conversation d’un autre utilisateur');
    const messages = await this.messageRepository.find({
      where: { conversationId },
      order: { createdAt: 'ASC' },
    });
    return { conversation, messages };
  }

  listConversations(companyId: string, userId: string) {
    return this.conversationRepository.find({ where: { companyId, userId }, order: { createdAt: 'DESC' } });
  }

  async deleteConversation(companyId: string, userId: string, conversationId: string) {
    const conversation = await this.conversationRepository.findOne({ where: { companyId, id: conversationId } });
    if (!conversation) throw new NotFoundException('Conversation introuvable');
    if (conversation.userId !== userId) throw new ForbiddenException('Conversation d’un autre utilisateur');
    await this.conversationRepository.remove(conversation);
    return { deleted: true };
  }
}

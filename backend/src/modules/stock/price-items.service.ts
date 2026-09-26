import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PriceItem } from './entities/price-item.entity';
import { CreatePriceItemDto, UpdatePriceItemDto } from './dto/create-price-item.dto';
import { AuditService } from '../../common/audit/audit.service';

export const DEFAULT_PRICE_GRID = 'BORDEREAU_3STB';

/**
 * Bordereau de prix (grilles 3STB / SOFATELCOM) : CRUD versionné, duplication
 * de version (révision tarifaire), activation, recherche plein texte.
 * La facturation utilise, par item, la version active la plus récente.
 */
@Injectable()
export class PriceItemsService {
  constructor(
    @InjectRepository(PriceItem)
    private readonly priceItemRepository: Repository<PriceItem>,
    private readonly audit: AuditService,
  ) {}

  /** Version active la plus récente d'une grille (repli : la plus récente tout court). */
  async currentVersion(companyId: string, priceGrid = DEFAULT_PRICE_GRID): Promise<string> {
    const rows = (await this.priceItemRepository.query(
      `SELECT version, bool_or(is_active) AS active FROM price_items
        WHERE company_id = $1 AND price_grid = $2 GROUP BY version`,
      [companyId, priceGrid],
    )) as Array<{ version: string; active: boolean }>;
    const sorted = rows.sort((a, b) => b.version.localeCompare(a.version));
    return (sorted.find((r) => r.active) ?? sorted[0])?.version ?? String(new Date().getFullYear());
  }

  async versions(companyId: string) {
    const rows = (await this.priceItemRepository.query(
      `SELECT price_grid AS "priceGrid", version, COUNT(*)::int AS count,
              COUNT(*) FILTER (WHERE is_active)::int AS "activeCount",
              MIN(effective_from) AS "effectiveFrom", MAX(updated_at) AS "updatedAt"
         FROM price_items WHERE company_id = $1
        GROUP BY price_grid, version ORDER BY price_grid, version DESC`,
      [companyId],
    )) as Array<{ priceGrid: string; version: string; count: number; activeCount: number }>;
    const current = new Map<string, string>();
    for (const grid of new Set(rows.map((r) => r.priceGrid))) current.set(grid, await this.currentVersion(companyId, grid));
    return rows.map((r) => ({ ...r, current: current.get(r.priceGrid) === r.version }));
  }

  async list(companyId: string, filters: { category?: string; version?: string; isActive?: boolean; priceGrid?: string }) {
    const qb = this.priceItemRepository
      .createQueryBuilder('p')
      .where('p.company_id = :companyId', { companyId })
      .orderBy('p.item_number', 'ASC');
    if (filters.category) qb.andWhere('p.category = :category', { category: filters.category });
    if (filters.version) qb.andWhere('p.version = :version', { version: filters.version });
    if (filters.priceGrid) qb.andWhere('p.price_grid = :priceGrid', { priceGrid: filters.priceGrid });
    if (filters.isActive !== undefined) qb.andWhere('p.is_active = :isActive', { isActive: filters.isActive });
    return qb.getMany();
  }

  async create(companyId: string, dto: CreatePriceItemDto, userId: string | null = null): Promise<PriceItem> {
    const priceGrid = dto.priceGrid ?? DEFAULT_PRICE_GRID;
    const version = dto.version ?? (await this.currentVersion(companyId, priceGrid));
    const existing = await this.priceItemRepository.findOne({
      where: { companyId, itemNumber: dto.itemNumber, version, priceGrid },
    });
    if (existing) {
      throw new ConflictException(`Item ${dto.itemNumber} déjà défini en version ${version}`);
    }
    const saved = await this.priceItemRepository.save(
      this.priceItemRepository.create({
        companyId,
        itemNumber: dto.itemNumber,
        designation: dto.designation.trim(),
        unit: dto.unit.trim(),
        unitPrice: String(dto.unitPrice),
        category: dto.category?.trim() || null,
        subCategory: dto.subCategory?.trim() || null,
        version,
        priceGrid,
        effectiveFrom: new Date().toISOString().slice(0, 10),
        isActive: dto.isActive ?? true,
      }),
    );
    await this.audit.log({
      companyId, actorId: userId, action: 'price.create', entityType: 'price_item', entityId: saved.id,
      payload: { itemNumber: saved.itemNumber, version, priceGrid, unitPrice: dto.unitPrice },
    });
    return saved;
  }

  async findByItemNumber(companyId: string, itemNumber: number, version?: string, priceGrid = DEFAULT_PRICE_GRID): Promise<PriceItem> {
    const v = version ?? (await this.currentVersion(companyId, priceGrid));
    const item = await this.priceItemRepository.findOne({
      where: { companyId, itemNumber, version: v, priceGrid },
    });
    if (!item) throw new NotFoundException(`Item ${itemNumber} (version ${v}) introuvable`);
    return item;
  }

  async update(companyId: string, itemNumber: number, dto: UpdatePriceItemDto, version?: string, priceGrid = DEFAULT_PRICE_GRID, userId: string | null = null) {
    const item = await this.findByItemNumber(companyId, itemNumber, version, priceGrid);
    const before = { unitPrice: Number(item.unitPrice), designation: item.designation, isActive: item.isActive };
    Object.assign(item, {
      ...(dto.designation !== undefined ? { designation: dto.designation.trim() } : {}),
      ...(dto.unit !== undefined ? { unit: dto.unit } : {}),
      ...(dto.unitPrice !== undefined ? { unitPrice: String(dto.unitPrice) } : {}),
      ...(dto.category !== undefined ? { category: dto.category } : {}),
      ...(dto.subCategory !== undefined ? { subCategory: dto.subCategory } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      ...(dto.effectiveFrom !== undefined ? { effectiveFrom: dto.effectiveFrom } : {}),
      ...(dto.effectiveTo !== undefined ? { effectiveTo: dto.effectiveTo } : {}),
    });
    await this.priceItemRepository.save(item);
    await this.audit.log({
      companyId, actorId: userId, action: 'price.update', entityType: 'price_item', entityId: item.id,
      payload: { itemNumber, version: item.version, priceGrid, before, after: { unitPrice: Number(item.unitPrice), designation: item.designation, isActive: item.isActive } },
    });
    // Relecture : la colonne numeric formate le prix avec son échelle (2).
    return this.findByItemNumber(companyId, itemNumber, item.version, priceGrid);
  }

  async remove(companyId: string, itemNumber: number, version?: string, priceGrid = DEFAULT_PRICE_GRID, userId: string | null = null) {
    const item = await this.findByItemNumber(companyId, itemNumber, version, priceGrid);
    await this.priceItemRepository.remove(item);
    await this.audit.log({
      companyId, actorId: userId, action: 'price.delete', entityType: 'price_item', entityId: null,
      payload: { itemNumber, version: item.version, priceGrid, unitPrice: Number(item.unitPrice), designation: item.designation },
    });
    return { deleted: true };
  }

  /**
   * Révision tarifaire : copie une version vers une nouvelle, avec variation
   * optionnelle en % (arrondie au franc). La nouvelle version est inactive
   * tant qu'elle n'est pas activée.
   */
  async duplicateVersion(
    companyId: string,
    dto: { priceGrid?: string; fromVersion: string; toVersion: string; percentChange?: number },
    userId: string | null = null,
  ) {
    const priceGrid = dto.priceGrid ?? DEFAULT_PRICE_GRID;
    const toVersion = dto.toVersion.trim();
    if (!toVersion) throw new BadRequestException('Nouvelle version requise');
    const source = await this.priceItemRepository.find({ where: { companyId, priceGrid, version: dto.fromVersion } });
    if (!source.length) throw new NotFoundException(`Version ${dto.fromVersion} introuvable`);
    const clash = await this.priceItemRepository.count({ where: { companyId, priceGrid, version: toVersion } });
    if (clash) throw new ConflictException(`La version ${toVersion} existe déjà`);
    const factor = 1 + (dto.percentChange ?? 0) / 100;
    const today = new Date().toISOString().slice(0, 10);
    await this.priceItemRepository.insert(
      source.map((p) => ({
        companyId,
        itemNumber: p.itemNumber,
        designation: p.designation,
        unit: p.unit,
        unitPrice: String(Math.round(Number(p.unitPrice) * factor)),
        category: p.category,
        subCategory: p.subCategory,
        priceGrid,
        version: toVersion,
        effectiveFrom: today,
        // effectiveTo renseigné = « inactif du fait du changement de version » (réactivé à l'activation) ;
        // les items désactivés à la main dans la source restent désactivés.
        effectiveTo: p.isActive ? today : null,
        isActive: false,
      })),
    );
    await this.audit.log({
      companyId, actorId: userId, action: 'price.version_duplicate', entityType: 'price_grid', entityId: null,
      payload: { priceGrid, fromVersion: dto.fromVersion, toVersion, percentChange: dto.percentChange ?? 0, items: source.length },
    });
    return { priceGrid, version: toVersion, items: source.length };
  }

  /** Active une version : ses items deviennent actifs, ceux des autres versions de la grille inactifs. */
  async activateVersion(companyId: string, dto: { priceGrid?: string; version: string }, userId: string | null = null) {
    const priceGrid = dto.priceGrid ?? DEFAULT_PRICE_GRID;
    const count = await this.priceItemRepository.count({ where: { companyId, priceGrid, version: dto.version } });
    if (!count) throw new NotFoundException(`Version ${dto.version} introuvable`);
    const today = new Date().toISOString().slice(0, 10);
    await this.priceItemRepository.manager.transaction(async (em) => {
      await em.query(
        `UPDATE price_items SET is_active = false, effective_to = COALESCE(effective_to, $4::date), updated_at = now()
          WHERE company_id = $1 AND price_grid = $2 AND version <> $3 AND is_active`,
        [companyId, priceGrid, dto.version, today],
      );
      await em.query(
        `UPDATE price_items SET is_active = true, effective_to = NULL, effective_from = COALESCE(effective_from, $4::date), updated_at = now()
          WHERE company_id = $1 AND price_grid = $2 AND version = $3 AND effective_to IS NOT NULL`,
        [companyId, priceGrid, dto.version, today],
      );
    });
    await this.audit.log({
      companyId, actorId: userId, action: 'price.version_activate', entityType: 'price_grid', entityId: null,
      payload: { priceGrid, version: dto.version, items: count },
    });
    return { priceGrid, version: dto.version, items: count };
  }

  /**
   * Recherche plein texte (lexique français) avec repli ILIKE — fonctionne
   * sans colonne tsvector matérialisée (elle existe en prod via migration).
   */
  async search(companyId: string, query: string, version?: string, priceGrid = DEFAULT_PRICE_GRID): Promise<PriceItem[]> {
    const q = query.trim();
    if (q.length < 2) throw new BadRequestException('Requête trop courte (2 caractères minimum)');
    const v = version ?? (await this.currentVersion(companyId, priceGrid));
    return this.priceItemRepository
      .createQueryBuilder('p')
      .where('p.company_id = :companyId AND p.version = :version AND p.price_grid = :priceGrid', { companyId, version: v, priceGrid })
      .andWhere(
        `(to_tsvector('french', coalesce(p.designation, '') || ' ' || coalesce(p.category, '') || ' ' || coalesce(p.sub_category, ''))
            @@ plainto_tsquery('french', :q)
          OR p.designation ILIKE :like
          OR coalesce(p.category, '') ILIKE :like
          OR coalesce(p.sub_category, '') ILIKE :like
          OR p.item_number::text = :q)`,
        { q, like: `%${q}%` },
      )
      .orderBy('p.item_number', 'ASC')
      .take(50)
      .getMany();
  }

  async categories(companyId: string): Promise<string[]> {
    const rows = await this.priceItemRepository
      .createQueryBuilder('p')
      .select('DISTINCT p.category', 'category')
      .where('p.company_id = :companyId', { companyId })
      .getRawMany();
    return rows.map((r) => r.category).filter((c): c is string => Boolean(c)).sort();
  }
}

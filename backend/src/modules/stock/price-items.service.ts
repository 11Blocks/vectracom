import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PriceItem } from './entities/price-item.entity';
import { CreatePriceItemDto, UpdatePriceItemDto } from './dto/create-price-item.dto';

/** Bordereau de prix 3STB : CRUD versionné + recherche plein texte. */
@Injectable()
export class PriceItemsService {
  constructor(
    @InjectRepository(PriceItem)
    private readonly priceItemRepository: Repository<PriceItem>,
  ) {}

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

  async create(companyId: string, dto: CreatePriceItemDto): Promise<PriceItem> {
    const version = dto.version ?? '2025';
    const existing = await this.priceItemRepository.findOne({
      where: { companyId, itemNumber: dto.itemNumber, version },
    });
    if (existing) {
      throw new ConflictException(`Item ${dto.itemNumber} déjà défini en version ${version}`);
    }
    return this.priceItemRepository.save(
      this.priceItemRepository.create({
        companyId,
        itemNumber: dto.itemNumber,
        designation: dto.designation.trim(),
        unit: dto.unit.trim(),
        unitPrice: String(dto.unitPrice),
        category: dto.category?.trim() ?? null,
        subCategory: dto.subCategory?.trim() ?? null,
        version,
        effectiveFrom: new Date().toISOString().slice(0, 10),
        isActive: dto.isActive ?? true,
      }),
    );
  }

  async findByItemNumber(companyId: string, itemNumber: number, version = '2025'): Promise<PriceItem> {
    const item = await this.priceItemRepository.findOne({
      where: { companyId, itemNumber, version },
    });
    if (!item) throw new NotFoundException(`Item ${itemNumber} (version ${version}) introuvable`);
    return item;
  }

  async update(companyId: string, itemNumber: number, dto: UpdatePriceItemDto, version = '2025') {
    const item = await this.findByItemNumber(companyId, itemNumber, version);
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
    // Relecture : la colonne numeric formate le prix avec son échelle (2).
    return this.findByItemNumber(companyId, itemNumber, version);
  }

  async remove(companyId: string, itemNumber: number, version = '2025') {
    const item = await this.findByItemNumber(companyId, itemNumber, version);
    await this.priceItemRepository.remove(item);
    return { deleted: true };
  }

  /**
   * Recherche plein texte (lexique français) avec repli ILIKE — fonctionne
   * sans colonne tsvector matérialisée (elle existe en prod via migration).
   */
  async search(companyId: string, query: string, version = '2025'): Promise<PriceItem[]> {
    const q = query.trim();
    if (q.length < 2) throw new BadRequestException('Requête trop courte (2 caractères minimum)');
    return this.priceItemRepository
      .createQueryBuilder('p')
      .where('p.company_id = :companyId AND p.version = :version', { companyId, version })
      .andWhere(
        `(to_tsvector('french', coalesce(p.designation, '') || ' ' || coalesce(p.category, '') || ' ' || coalesce(p.sub_category, ''))
            @@ plainto_tsquery('french', :q)
          OR p.designation ILIKE :like
          OR coalesce(p.category, '') ILIKE :like
          OR coalesce(p.sub_category, '') ILIKE :like)`,
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

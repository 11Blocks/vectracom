import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Module,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { IsIn, IsNumber, IsOptional, IsString, IsUUID, Min, MinLength } from 'class-validator';
import { Repository } from 'typeorm';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { StockPurchase, PURCHASE_STATUSES, PurchaseStatus } from './entities/stock-purchase.entity';

/** Seuil de perte contractuel SONATEL (au-delà → sanction). */
const DEFAULT_LOSS_THRESHOLD_PCT = 10;

class CreatePurchaseDto {
  @IsOptional() @IsUUID() stockItemId?: string | null;
  @IsString() @MinLength(2) designation!: string;
  @IsNumber() @Min(1) quantity!: number;
  @IsNumber() @Min(0) unitCost!: number;
  @IsOptional() @IsString() reason?: string;
  @IsOptional() @IsString() note?: string;
}

class UpdatePurchaseDto {
  @IsOptional() @IsUUID() stockItemId?: string | null;
  @IsOptional() @IsString() designation?: string;
  @IsOptional() @IsNumber() @Min(1) quantity?: number;
  @IsOptional() @IsNumber() @Min(0) unitCost?: number;
  @IsOptional() @IsString() reason?: string | null;
  @IsOptional() @IsString() note?: string | null;
}

class PurchaseStatusDto {
  @IsIn(PURCHASE_STATUSES as unknown as string[]) status!: string;
}

class PurchasesService {
  constructor(@InjectRepository(StockPurchase) private readonly repo: Repository<StockPurchase>) {}

  async list(companyId: string, status?: string) {
    const rows: any[] = await this.repo.query(
      `SELECT p.*, i.reference AS item_reference, i.designation AS item_designation
         FROM stock_purchases p
         LEFT JOIN stock_items i ON i.id = p.stock_item_id
        WHERE p.company_id = $1
          ${status ? 'AND p.status = $2' : ''}
        ORDER BY p.created_at DESC`,
      status ? [companyId, status] : [companyId],
    );
    return rows.map((r) => ({
      id: r.id,
      stockItemId: r.stock_item_id,
      itemReference: r.item_reference,
      itemDesignation: r.item_designation,
      designation: r.designation,
      quantity: Number(r.quantity),
      unitCost: Number(r.unit_cost),
      totalCost: Number(r.quantity) * Number(r.unit_cost),
      reason: r.reason,
      status: r.status,
      sonatelValidatedAt: r.sonatel_validated_at,
      invoiceId: r.invoice_id,
      note: r.note,
      createdAt: r.created_at,
    }));
  }

  /**
   * Pertes matériel : ratio pertes/entrées par article, avec alerte sanction
   * dès que le taux dépasse le seuil contractuel (10 % par défaut).
   */
  async pertesSummary(companyId: string) {
    const rows: any[] = await this.repo.query(
      `SELECT i.id, i.reference, i.designation,
              COALESCE(SUM(CASE WHEN m.type = 'entree' THEN m.quantity END), 0) AS entrees,
              COALESCE(SUM(CASE WHEN m.type IN ('perte', 'sortie_feraillerie') THEN m.quantity END), 0) AS pertes
         FROM stock_items i
         LEFT JOIN stock_movements m ON m.stock_item_id = i.id AND m.company_id = i.company_id AND m.cancelled_at IS NULL
        WHERE i.company_id = $1
        GROUP BY i.id, i.reference, i.designation
        ORDER BY pertes DESC`,
      [companyId],
    );
    const items = rows.map((r) => {
      const entrees = Number(r.entrees);
      const pertes = Number(r.pertes);
      const taux = entrees > 0 ? Math.round((pertes / entrees) * 1000) / 10 : 0;
      return {
        stockItemId: r.id,
        reference: r.reference,
        designation: r.designation,
        entrees,
        pertes,
        taux,
        depasseSeuil: taux > DEFAULT_LOSS_THRESHOLD_PCT,
      };
    });
    const depassements = items.filter((x) => x.depasseSeuil);
    return { seuilPct: DEFAULT_LOSS_THRESHOLD_PCT, totalPertes: items.reduce((s, x) => s + x.pertes, 0), depassements, items };
  }

  async create(companyId: string, dto: CreatePurchaseDto, userId: string) {
    return this.repo.save(
      this.repo.create({
        companyId,
        stockItemId: dto.stockItemId ?? null,
        designation: dto.designation.trim(),
        quantity: dto.quantity,
        unitCost: dto.unitCost,
        reason: dto.reason ?? null,
        note: dto.note ?? null,
        status: 'en_attente',
        createdBy: userId,
      }),
    );
  }

  async update(companyId: string, id: string, dto: UpdatePurchaseDto) {
    const p = await this.repo.findOne({ where: { companyId, id } });
    if (!p) throw new NotFoundException('Achat introuvable');
    if (dto.stockItemId !== undefined) p.stockItemId = dto.stockItemId;
    if (dto.designation !== undefined) p.designation = dto.designation.trim();
    if (dto.quantity !== undefined) p.quantity = dto.quantity;
    if (dto.unitCost !== undefined) p.unitCost = dto.unitCost;
    if (dto.reason !== undefined) p.reason = dto.reason;
    if (dto.note !== undefined) p.note = dto.note;
    return this.repo.save(p);
  }

  async setStatus(companyId: string, id: string, status: PurchaseStatus) {
    const p = await this.repo.findOne({ where: { companyId, id } });
    if (!p) throw new NotFoundException('Achat introuvable');
    if (status === 'valide_sonatel') p.sonatelValidatedAt = new Date();
    if (status === 'en_attente') p.sonatelValidatedAt = null;
    p.status = status;
    return this.repo.save(p);
  }
}

@Controller('stock-purchases')
@Roles(UserRole.ADMIN, UserRole.DIRECTION, UserRole.MAGASINIER)
export class PurchasesController {
  constructor(private readonly svc: PurchasesService) {}

  @Get()
  list(@CurrentUser('companyId') companyId: string | null, @Query('status') status?: string) {
    this.requireTenant(companyId);
    return this.svc.list(companyId!, status);
  }

  @Get('pertes')
  pertes(@CurrentUser('companyId') companyId: string | null) {
    this.requireTenant(companyId);
    return this.svc.pertesSummary(companyId!);
  }

  @Post()
  create(@CurrentUser('companyId') companyId: string | null, @CurrentUser('id') userId: string, @Body() dto: CreatePurchaseDto) {
    this.requireTenant(companyId);
    return this.svc.create(companyId!, dto, userId);
  }

  @Put(':id')
  update(@CurrentUser('companyId') companyId: string | null, @Param('id') id: string, @Body() dto: UpdatePurchaseDto) {
    this.requireTenant(companyId);
    return this.svc.update(companyId!, id, dto);
  }

  @Post(':id/status')
  setStatus(@CurrentUser('companyId') companyId: string | null, @Param('id') id: string, @Body() dto: PurchaseStatusDto) {
    this.requireTenant(companyId);
    return this.svc.setStatus(companyId!, id, dto.status as PurchaseStatus);
  }

  private requireTenant(companyId: string | null): void {
    if (!companyId) throw new BadRequestException('Réservé aux comptes rattachés à un tenant');
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([StockPurchase])],
  controllers: [PurchasesController],
  providers: [PurchasesService],
  exports: [TypeOrmModule],
})
export class PurchasesModule {}

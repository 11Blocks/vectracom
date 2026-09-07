import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { IsArray, IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SerialLifecycleService } from './serial-lifecycle.service';
import { StockViewsService } from './stock-views.service';

class ReceiveBatchDto {
  @IsString() reference!: string;
  @IsArray() serials!: Array<{ serialNumber: string; cartonNumber?: string }>;
}

class DeliverDto {
  @IsUUID() teamId!: string;
  @IsArray() @IsUUID(undefined, { each: true }) serialIds!: string[];
}

class InstallDto {
  @IsOptional() nd?: string;
  @IsOptional() @IsUUID() missionId?: string;
}

class ReturnDto {
  @IsBoolean() defect!: boolean;
}

class ReturnToSonatelDto {
  @IsArray() @IsUUID(undefined, { each: true }) serialIds!: string[];
}

class ScrapSaleDto {
  @IsOptional()
  amountFcfa?: number;
}

class RecoverDto {
  @IsBoolean() defect!: boolean;
}

@Controller('stock-serials')
@Roles(UserRole.ADMIN, UserRole.DIRECTION, UserRole.CHEF_EQUIPE, UserRole.MAGASINIER)
export class SerialLifecycleController {
  constructor(
    private readonly lifecycle: SerialLifecycleService,
    private readonly views: StockViewsService,
  ) {}

  /** État du parc sérialisé d'un article (bout en bout). */
  @Get('fleet')
  fleet(@CurrentUser('companyId') companyId: string | null, @Query('reference') reference: string) {
    this.requireTenant(companyId);
    if (!reference) throw new BadRequestException('reference requis');
    return this.lifecycle.fleet(companyId!, reference);
  }

  /** Outillage / matériel affecté aux équipes. */
  @Get('tooling')
  tooling(
    @CurrentUser('companyId') companyId: string | null,
    @Query('teamId') teamId?: string,
  ) {
    this.requireTenant(companyId);
    return this.lifecycle.toolingByTeam(companyId!, teamId);
  }

  /** Recherche par n° de série ou ND client. */
  @Get('search')
  search(@CurrentUser('companyId') companyId: string | null, @Query('q') q: string) {
    this.requireTenant(companyId);
    if (!q || q.trim().length < 3) throw new BadRequestException('Requête trop courte (3 caractères min.)');
    return this.lifecycle.search(companyId!, q.trim());
  }

  @Post('receive-batch')
  receive(
    @CurrentUser('companyId') companyId: string | null,
    @Body() dto: ReceiveBatchDto,
  ) {
    this.requireTenant(companyId);
    return this.lifecycle.receiveBatch(companyId!, dto);
  }

  @Post(':id/deliver')
  deliver(
    @CurrentUser('companyId') companyId: string | null,
    @Param('id') id: string,
    @Body() dto: DeliverDto,
  ) {
    this.requireTenant(companyId);
    return this.lifecycle.deliverToTeam(companyId!, [id, ...dto.serialIds.filter((s) => s !== id)], dto.teamId);
  }

  @Post(':id/install')
  install(
    @CurrentUser('companyId') companyId: string | null,
    @Param('id') id: string,
    @Body() dto: InstallDto,
  ) {
    this.requireTenant(companyId);
    return this.lifecycle.installAtClient(companyId!, id, dto.nd, dto.missionId);
  }

  @Post(':id/return')
  returnFromField(
    @CurrentUser('companyId') companyId: string | null,
    @Param('id') id: string,
    @Body() dto: ReturnDto,
  ) {
    this.requireTenant(companyId);
    return this.lifecycle.returnFromField(companyId!, id, dto.defect);
  }

  @Post(':id/recover')
  recover(
    @CurrentUser('companyId') companyId: string | null,
    @Param('id') id: string,
    @Body() dto: RecoverDto,
  ) {
    this.requireTenant(companyId);
    return this.lifecycle.markRecovered(companyId!, id, dto.defect);
  }

  @Post(':id/scrap-sale')
  scrapSale(
    @CurrentUser('companyId') companyId: string | null,
    @Param('id') id: string,
    @Body() dto: ScrapSaleDto,
  ) {
    this.requireTenant(companyId);
    return this.lifecycle.scrapSale(companyId!, id, dto.amountFcfa);
  }

  @Post('return-to-sonatel')
  returnToSonatel(
    @CurrentUser('companyId') companyId: string | null,
    @Body() dto: ReturnToSonatelDto,
  ) {
    this.requireTenant(companyId);
    return this.lifecycle.returnToSonatel(companyId!, dto.serialIds);
  }

  /** Vue hiérarchique du stock par région (Green-T). */
  @Get('views/by-region')
  byRegion(@CurrentUser('companyId') companyId: string | null) {
    this.requireTenant(companyId);
    return this.views.byRegion(companyId!);
  }

  private requireTenant(companyId: string | null): void {
    if (!companyId) throw new BadRequestException('Réservé aux comptes rattachés à un tenant');
  }
}

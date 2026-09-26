import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { IsBooleanString, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PriceItemsService } from './price-items.service';
import {
  ActivatePriceVersionDto,
  CreatePriceItemDto,
  DuplicatePriceVersionDto,
  UpdatePriceItemDto,
} from './dto/create-price-item.dto';
import { PRICE_GRIDS } from './entities/price-item.entity';

class ListPriceItemsQueryDto {
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() version?: string;
  @IsOptional() @IsIn(PRICE_GRIDS as unknown as string[]) priceGrid?: string;
  @IsOptional() @IsBooleanString() isActive?: string;
}

class SearchQueryDto {
  @IsString()
  q!: string;

  @IsOptional() @IsString() version?: string;
  @IsOptional() @IsIn(PRICE_GRIDS as unknown as string[]) priceGrid?: string;
}

class ItemQueryDto {
  @IsOptional() @IsString() version?: string;
  @IsOptional() @IsIn(PRICE_GRIDS as unknown as string[]) priceGrid?: string;
}

class ItemNumberParamDto {
  @Type(() => Number) @IsInt() @Min(1) itemNumber!: number;
}

@Controller('price-items')
@Roles(UserRole.ADMIN, UserRole.DIRECTION, UserRole.CHEF_EQUIPE, UserRole.MAGASINIER)
export class PriceItemsController {
  constructor(private readonly priceItemsService: PriceItemsService) {}

  @Get()
  list(@CurrentUser('companyId') companyId: string | null, @Query() query: ListPriceItemsQueryDto) {
    this.requireTenant(companyId);
    return this.priceItemsService.list(companyId!, {
      category: query.category,
      version: query.version,
      priceGrid: query.priceGrid,
      isActive: query.isActive === undefined ? undefined : query.isActive === 'true',
    });
  }

  @Get('search')
  search(@CurrentUser('companyId') companyId: string | null, @Query() query: SearchQueryDto) {
    this.requireTenant(companyId);
    return this.priceItemsService.search(companyId!, query.q, query.version, query.priceGrid);
  }

  @Get('categories')
  categories(@CurrentUser('companyId') companyId: string | null) {
    this.requireTenant(companyId);
    return this.priceItemsService.categories(companyId!);
  }

  /** Versions par grille (nombre d'items, version courante). */
  @Get('versions')
  versions(@CurrentUser('companyId') companyId: string | null) {
    this.requireTenant(companyId);
    return this.priceItemsService.versions(companyId!);
  }

  @Post('versions/duplicate')
  @Roles(UserRole.ADMIN)
  duplicateVersion(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('id') userId: string,
    @Body() dto: DuplicatePriceVersionDto,
  ) {
    this.requireTenant(companyId);
    return this.priceItemsService.duplicateVersion(companyId!, dto, userId);
  }

  @Post('versions/activate')
  @Roles(UserRole.ADMIN)
  activateVersion(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('id') userId: string,
    @Body() dto: ActivatePriceVersionDto,
  ) {
    this.requireTenant(companyId);
    return this.priceItemsService.activateVersion(companyId!, dto, userId);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@CurrentUser('companyId') companyId: string | null, @CurrentUser('id') userId: string, @Body() dto: CreatePriceItemDto) {
    this.requireTenant(companyId);
    return this.priceItemsService.create(companyId!, dto, userId);
  }

  @Get(':itemNumber')
  findOne(
    @CurrentUser('companyId') companyId: string | null,
    @Param() param: ItemNumberParamDto,
    @Query() q: ItemQueryDto,
  ) {
    this.requireTenant(companyId);
    return this.priceItemsService.findByItemNumber(companyId!, param.itemNumber, q.version, q.priceGrid);
  }

  @Put(':itemNumber')
  @Roles(UserRole.ADMIN)
  update(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('id') userId: string,
    @Param() param: ItemNumberParamDto,
    @Body() dto: UpdatePriceItemDto,
    @Query() q: ItemQueryDto,
  ) {
    this.requireTenant(companyId);
    return this.priceItemsService.update(companyId!, param.itemNumber, dto, q.version, q.priceGrid, userId);
  }

  @Delete(':itemNumber')
  @Roles(UserRole.ADMIN)
  remove(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('id') userId: string,
    @Param() param: ItemNumberParamDto,
    @Query() q: ItemQueryDto,
  ) {
    this.requireTenant(companyId);
    return this.priceItemsService.remove(companyId!, param.itemNumber, q.version, q.priceGrid, userId);
  }

  private requireTenant(companyId: string | null): void {
    if (!companyId) throw new BadRequestException('Réservé aux comptes rattachés à un tenant');
  }
}
